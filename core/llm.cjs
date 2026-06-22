"use strict";
// Free LLM brain. Provider-aware:
//  - 'anthropic' (default): the cc.freemodel.dev proxy ECM already uses
//    (Anthropic Messages API: POST /v1/messages, x-api-key header).
//  - 'openai': any OpenAI-compatible endpoint (OpenRouter, Groq, local).
const axios = require("axios");
const config = require("../core/config.cjs");
const log = require("./logger.cjs").make("llm");

const provider = config.llm.provider;

const client = axios.create({
  baseURL: config.llm.baseUrl,
  timeout: 150000,
  headers:
    provider === "anthropic"
      ? {
          "Content-Type": "application/json",
          "x-api-key": config.llm.apiKey,
          "anthropic-version": "2023-06-01",
        }
      : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.llm.apiKey}`,
        },
});

async function chat(messages, opts = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await attemptChat(messages, opts);
    } catch (e) {
      lastErr = e;
      const transient =
        e.code === "ECONNABORTED" || // axios timeout
        /timeout/i.test(e.message) ||
        [429, 500, 502, 503, 504].includes(e.response?.status);
      if (!transient || attempt === 2) break;
      const wait = attempt === 0 ? 2000 : 4000;
      log.warn(`transient LLM error (attempt ${attempt + 1}/3), retrying in ${wait / 1000}s`, e.message);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  const msg = lastErr.response?.data?.error?.message || lastErr.response?.data?.error || lastErr.message;
  log.error("chat failed", typeof msg === "string" ? msg : JSON.stringify(msg));
  throw new Error(`LLM error: ${typeof msg === "string" ? msg : lastErr.message}`);
}

async function attemptChat(messages, opts = {}) {
  const model = opts.fast ? config.llm.fastModel : opts.model || config.llm.model;
  if (provider === "anthropic") {
    const system = messages.find((m) => m.role === "system")?.content;
    const turns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    const { data } = await client.post("/v1/messages", {
      model,
      max_tokens: opts.maxTokens ?? 1200,
      temperature: opts.temperature ?? 0.6,
      system,
      messages: turns.length ? turns : [{ role: "user", content: " " }],
    });
    return (data.content || []).map((b) => b.text || "").join("").trim();
  }
  // openai-compatible
  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 1200,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  const { data } = await client.post("/chat/completions", body);
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function complete(system, user, opts = {}) {
  return chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    opts
  );
}

async function json(system, user, opts = {}) {
  const sys = `${system}\n\nRespond ONLY with a single valid JSON object. No prose, no markdown fences.`;
  let raw = stripFences(
    await chat(
      [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      { ...opts, json: true }
    )
  );
  try {
    return JSON.parse(raw);
  } catch {
    const fixed = await chat(
      [
        { role: "system", content: "Fix this into one valid JSON object. Output JSON only." },
        { role: "user", content: raw },
      ],
      { json: true, temperature: 0 }
    );
    return JSON.parse(stripFences(fixed));
  }
}

function stripFences(s) {
  const m = s.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

module.exports = { chat, complete, json };
