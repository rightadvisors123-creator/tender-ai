// ─────────────────────────────────────────────
//  Right Advisors — Autonomous Tender System
//  Main Server: Scanner + Eligibility + Alerts
// ─────────────────────────────────────────────
const express = require('express');
const cron    = require('node-cron');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const scanner = require('./scanner');
const ai      = require('./ai');
const alerts  = require('./alerts');
const db      = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Company Profile (Right Advisors) ──────────
const PROFILE = {
  name:           'Right Advisors',
  turnoverCr:     20,
  solvencyCr:     3,
  minTenderCr:    1,
  location:       'Delhi NCR',
  category:       'Manpower Supply',
  noBanning:      true,
  email:          'Ssinghalbansal@rightadvisors.com',
  phone:          '9999917353',
};

// ── Health check ──────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', system: 'Right Advisors Tender AI', version: '1.0' });
});

// ── Manual trigger scan ───────────────────────
app.post('/api/scan', async (req, res) => {
  res.json({ message: 'Scan started in background' });
  runFullScan();
});

// ── Get all tenders ───────────────────────────
app.get('/api/tenders', (req, res) => {
  const tenders = db.getAllTenders();
  res.json(tenders);
});

// ── Get single tender ─────────────────────────
app.get('/api/tenders/:id', (req, res) => {
  const t = db.getTender(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});

// ── Update tender status ──────────────────────
app.patch('/api/tenders/:id', (req, res) => {
  db.updateTender(req.params.id, req.body);
  res.json({ ok: true });
});

// ── Upload document to vault ──────────────────
app.post('/api/vault/upload', (req, res) => {
  const { name, category, data, mimeType } = req.body;
  if (!name || !data) return res.status(400).json({ error: 'name and data required' });
  db.saveDocument({ name, category, data, mimeType, uploadedAt: new Date().toISOString() });
  res.json({ ok: true, message: `${name} saved to vault` });
});

// ── Get vault documents ───────────────────────
app.get('/api/vault', (req, res) => {
  res.json(db.getDocuments());
});

// ── Delete vault document ─────────────────────
app.delete('/api/vault/:name', (req, res) => {
  db.deleteDocument(req.params.name);
  res.json({ ok: true });
});

// ── Get stats ─────────────────────────────────
app.get('/api/stats', (req, res) => {
  const tenders = db.getAllTenders();
  res.json({
    total:    tenders.length,
    eligible: tenders.filter(t => t.eligible).length,
    drafted:  tenders.filter(t => t.bidDraft).length,
    submitted:tenders.filter(t => t.status === 'submitted').length,
    lastScan: db.getLastScan(),
    nextScan: db.getNextScan(),
    docsInVault: db.getDocuments().length,
  });
});

// ── Answer question (Q&A memory) ──────────────
app.post('/api/qa', async (req, res) => {
  const { question, answer } = req.body;
  db.saveQA(question, answer);
  res.json({ ok: true });
});

app.get('/api/qa', (req, res) => {
  res.json(db.getQA());
});

// ── MAIN SCAN FUNCTION ────────────────────────
async function runFullScan() {
  console.log('\n🔍 Starting tender scan at', new Date().toISOString());
  db.setLastScan(new Date().toISOString());

  try {
    // 1. Pull tenders from all portals
    const raw = await scanner.fetchAllPortals();
    console.log(`📥 Found ${raw.length} raw tenders`);

    let newEligible = 0;

    for (const tender of raw) {
      // Skip if already processed
      if (db.tenderExists(tender.id)) continue;

      // 2. AI eligibility check
      const eligResult = await ai.checkEligibility(tender, PROFILE);
      tender.eligible    = eligResult.eligible;
      tender.score       = eligResult.score;
      tender.passed      = eligResult.passed;
      tender.failed      = eligResult.failed;
      tender.warnings    = eligResult.warnings;
      tender.status      = eligResult.eligible ? 'eligible' : 'not_eligible';
      tender.scannedAt   = new Date().toISOString();

      if (eligResult.eligible) {
        // 3. Auto-draft bid
        console.log(`✍️  Drafting bid for: ${tender.title}`);
        const qa = db.getQA();
        tender.bidDraft    = await ai.draftBid(tender, PROFILE, qa);
        tender.checklist   = await ai.buildChecklist(tender, db.getDocuments());
        tender.status      = 'draft_ready';
        newEligible++;

        // 4. Send alerts
        await alerts.sendWhatsApp(tender, PROFILE);
        await alerts.sendEmail(tender, PROFILE);
      }

      db.saveTender(tender);
    }

    console.log(`✅ Scan complete. ${newEligible} new eligible tenders found.`);
    db.setNextScan(new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString());

  } catch (err) {
    console.error('❌ Scan error:', err.message);
  }
}

// ── SCHEDULER: every 6 hours ──────────────────
cron.schedule('0 */6 * * *', () => {
  console.log('⏰ Cron triggered — running scan');
  runFullScan();
});

// Run immediately on startup
setTimeout(() => runFullScan(), 3000);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Right Advisors Tender AI running on port ${PORT}`);
  db.setNextScan(new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString());
});
