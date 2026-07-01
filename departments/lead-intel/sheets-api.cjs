"use strict";
// Google Sheets API — write-back module for updating Status column.
// Requires a Google Cloud Service Account or OAuth2 credentials.
// Falls back to logging status changes when credentials are absent.
const axios = require("axios");
const db = require("../../core/db.cjs");
const log = require("../../core/logger.cjs").make("sheets-api");

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

// Extract spreadsheet ID from a Google Sheets URL
function extractSheetId(url) {
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  return m ? m[1] : null;
}

// Get auth headers (service account or API key)
function getAuthHeaders() {
  const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (saKey) {
    // Service account JSON key — sign a JWT and exchange for access token
    // For now, return null and use API key fallback
    try {
      const key = JSON.parse(saKey);
      return { client_email: key.client_email, private_key: key.private_key };
    } catch (e) {
      log.warn("invalid GOOGLE_SERVICE_ACCOUNT_KEY", e.message);
    }
  }
  return null;
}

// Update Status column for a row in the sheet by matching email or phone
async function updateStatus(sheetUrl, { email, phone, status }) {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    log.warn("cannot update status: invalid sheet URL");
    return { updated: false, reason: "invalid-sheet-url" };
  }

  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const saCreds = getAuthHeaders();

  if (!apiKey && !saCreds) {
    log.info(`status update (no API key): ${email || phone} → ${status}`);
    return { updated: false, reason: "no-credentials", logged: true };
  }

  try {
    // Read header row to find Status column index
    const readUrl = `${SHEETS_API}/${sheetId}/values/A1:Z1?key=${apiKey}`;
    const { data } = await axios.get(readUrl, { timeout: 10000 });
    const headers = data.values?.[0] || [];
    const statusCol = headers.findIndex(h => /status/i.test(h));
    if (statusCol === -1) {
      log.warn("Status column not found in sheet headers");
      return { updated: false, reason: "no-status-column" };
    }

    // Read all rows to find the matching row
    const allUrl = `${SHEETS_API}/${sheetId}/values/A:Z?key=${apiKey}`;
    const allData = await axios.get(allUrl, { timeout: 15000 });
    const rows = allData.data.values || [];

    // Find matching row by email or phone
    const emailCol = headers.findIndex(h => /email/i.test(h));
    const phoneCol = headers.findIndex(h => /phone|mobile|number/i.test(h));

    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (email && emailCol >= 0 && row[emailCol] === email) { targetRow = i + 1; break; }
      if (phone && phoneCol >= 0 && row[phoneCol] === phone) { targetRow = i + 1; break; }
    }

    if (targetRow === -1) {
      log.warn(`lead not found in sheet: ${email || phone}`);
      return { updated: false, reason: "lead-not-found" };
    }

    // Update the Status cell
    const colLetter = String.fromCharCode(65 + statusCol);
    const cellRef = `${colLetter}${targetRow}`;
    const updateUrl = `${SHEETS_API}/${sheetId}/values/${cellRef}?valueInputOption=USER_ENTERED&key=${apiKey}`;
    await axios.put(updateUrl, { values: [[status]] }, { timeout: 10000 });

    log.info(`sheet updated: ${cellRef} → ${status} (${email || phone})`);
    return { updated: true, cell: cellRef, status };
  } catch (e) {
    log.error(`sheet update failed: ${e.message}`);
    return { updated: false, reason: e.message };
  }
}

// Batch update multiple lead statuses
async function batchUpdateStatus(sheetUrl, updates = []) {
  const results = [];
  for (const u of updates) {
    results.push(await updateStatus(sheetUrl, u));
  }
  return results;
}

// Export all leads with their current status as CSV (for reporting)
async function exportLeads(brandId) {
  const leads = await db.many(
    `select l.full_name, l.email, l.phone, l.company_id, l.status, l.source, l.created_at,
            c.name as company_name
     from ait_leads l
     left join ait_companies c on c.id = l.company_id
     where l.brand_id=$1
     order by l.created_at desc`,
    [brandId]
  );

  const headers = ["Name", "Email", "Phone", "Company", "Status", "Source", "Created"];
  const csvRows = [headers.join(",")];
  for (const l of leads) {
    csvRows.push([
      `"${l.full_name || ""}"`,
      `"${l.email || ""}"`,
      `"${l.phone || ""}"`,
      `"${l.company_name || ""}"`,
      `"${l.status || ""}"`,
      `"${l.source || ""}"`,
      `"${l.created_at || ""}"`,
    ].join(","));
  }
  return csvRows.join("\n");
}

module.exports = { extractSheetId, updateStatus, batchUpdateStatus, exportLeads };
