"use strict";
// Render proposal markdown-ish text to a simple PDF (free, pdfkit).
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const OUT_DIR = path.join(__dirname, "..", "..", "output", "proposals");

function toPDF(id, title, body) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `proposal-${id}.pdf`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(file);
    doc.pipe(stream);
    doc.fontSize(18).text(title || "Proposal", { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    body.split("\n").forEach((line) => {
      if (/^#{1,3}\s/.test(line)) doc.moveDown(0.3).fontSize(14).text(line.replace(/^#+\s/, "")).fontSize(11);
      else doc.text(line);
    });
    doc.end();
    stream.on("finish", () => resolve(file));
    stream.on("error", reject);
  });
}

module.exports = { toPDF };
