// ─────────────────────────────────────────────
//  Database: Simple JSON file-based store
//  (Replace with PostgreSQL for production)
// ─────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const TENDERS_FILE  = path.join(DATA_DIR, 'tenders.json');
const DOCS_FILE     = path.join(DATA_DIR, 'documents.json');
const QA_FILE       = path.join(DATA_DIR, 'qa.json');
const META_FILE     = path.join(DATA_DIR, 'meta.json');

// ── Ensure data directory ─────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return fallback; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── Tenders ───────────────────────────────────
function getAllTenders() {
  return readJSON(TENDERS_FILE, []);
}

function getTender(id) {
  return getAllTenders().find(t => t.id === id) || null;
}

function tenderExists(id) {
  return getAllTenders().some(t => t.id === id);
}

function saveTender(tender) {
  const all = getAllTenders();
  const idx = all.findIndex(t => t.id === tender.id);
  if (idx >= 0) all[idx] = tender;
  else all.unshift(tender);
  writeJSON(TENDERS_FILE, all);
}

function updateTender(id, updates) {
  const all = getAllTenders();
  const idx = all.findIndex(t => t.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    writeJSON(TENDERS_FILE, all);
  }
}

// ── Documents ─────────────────────────────────
function getDocuments() {
  return readJSON(DOCS_FILE, []);
}

function saveDocument(doc) {
  const all = getDocuments();
  const idx = all.findIndex(d => d.name === doc.name);
  if (idx >= 0) all[idx] = doc;
  else all.push(doc);
  writeJSON(DOCS_FILE, all);
}

function deleteDocument(name) {
  const all = getDocuments().filter(d => d.name !== name);
  writeJSON(DOCS_FILE, all);
}

// ── Q&A Memory ────────────────────────────────
function getQA() {
  return readJSON(QA_FILE, []);
}

function saveQA(question, answer) {
  const all = getQA();
  all.push({ question, answer, savedAt: new Date().toISOString() });
  writeJSON(QA_FILE, all);
}

// ── Meta ──────────────────────────────────────
function getMeta() {
  return readJSON(META_FILE, {});
}

function setMeta(key, value) {
  const meta = getMeta();
  meta[key] = value;
  writeJSON(META_FILE, meta);
}

function getLastScan() { return getMeta().lastScan || null; }
function setLastScan(v) { setMeta('lastScan', v); }
function getNextScan() { return getMeta().nextScan || null; }
function setNextScan(v) { setMeta('nextScan', v); }

module.exports = {
  getAllTenders, getTender, tenderExists, saveTender, updateTender,
  getDocuments, saveDocument, deleteDocument,
  getQA, saveQA,
  getLastScan, setLastScan, getNextScan, setNextScan,
};
