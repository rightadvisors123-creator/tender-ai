// ─────────────────────────────────────────────
//  AI Engine v2 — Upgraded with all team points
//  Right Advisors — MSME registered
// ─────────────────────────────────────────────
const https = require('https');
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

function callClaude(messages, system = '', maxTokens = 1000) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return reject(new Error('ANTHROPIC_API_KEY not set'));
    const body = JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens, system, messages });
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve((parsed.content || []).map(i => i.text || '').join('\n'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

function parseJSON(raw) {
  try { return JSON.parse(raw.replace(/```json|```/g, '').trim()); }
  catch { return null; }
}

async function checkEligibility(tender, profile) {
  const prompt = `You are a government tender eligibility expert in India.
Tender: ${tender.title} | Authority: ${tender.org} | Location: ${tender.location} | Value: ${tender.valueStr} | Portal: ${tender.portal} | Ref: ${tender.tenderNo}
Company — Right Advisors: Turnover ₹${profile.turnoverCr}Cr | Solvency ₹${profile.solvencyCr}Cr | MSME Registered | Delhi NCR | Manpower Supply | EPF/ESIC/GST/ISO | No banning

Return JSON only (no markdown):
{"eligible":true,"score":85,"passed":[],"failed":[],"warnings":[],"banningClause":false,
"msmeExemption":{"emdExempt":true,"stampPaperExempt":false,"note":"MSME — EMD likely exempted"},
"emd":{"required":true,"amount":"~2% of tender value","msmeExempt":true},
"preBidMeeting":{"scheduled":false,"date":"Check portal","venue":"Check portal"},
"siteVisit":{"required":false,"note":"Verify in tender document"},
"bankGuarantee":{"required":true,"percentage":"5-10%","note":"Standard for manpower contracts"},
"securityDeposit":{"required":true,"percentage":"5%","note":"Standard for manpower contracts"},
"workExperience":{"required":true,"minYears":"3 years","minValue":"Similar to tender value","note":"Provide past work orders"},
"geographicalPresence":{"required":false,"state":"Delhi NCR","note":"Right Advisors Delhi NCR based — meets requirement"},
"blacklistingUndertaking":{"required":true,"note":"Self declaration on letterhead required"},
"affidavitRequired":false,"stampPaperRequired":false,
"recommendation":"advice on whether to bid"}`;

  try {
    const raw = await callClaude([{ role: 'user', content: prompt }], 'You are a tender eligibility expert. Return JSON only.');
    const result = parseJSON(raw);
    if (result) return result;
  } catch (err) { console.log('Eligibility AI error:', err.message); }
  return ruleBasedEligibility(tender, profile);
}

function ruleBasedEligibility(tender, profile) {
  const passed = [], failed = [], warnings = [];
  let score = 60;
  const reqTurnover = tender.valueCr * 2;
  if (profile.turnoverCr >= reqTurnover) { passed.push(`Turnover ₹${profile.turnoverCr}Cr meets requirement`); score += 15; }
  else { failed.push(`Turnover may be insufficient`); score -= 10; }
  if (profile.solvencyCr >= tender.valueCr * 0.05) { passed.push(`Solvency ₹${profile.solvencyCr}Cr adequate`); score += 10; }
  passed.push('Category: Manpower Supply — exact match');
  passed.push('Location: Delhi NCR — matches');
  passed.push('MSME Registered — EMD exemption applicable');
  passed.push('No banning/blacklisting confirmed');
  score += 15;
  warnings.push('Verify EMD exemption in tender document');
  warnings.push('Check pre-bid meeting schedule on portal');
  warnings.push('Confirm if stamp paper/affidavit required');
  return {
    eligible: failed.length === 0 && score >= 70, score: Math.min(100, score),
    passed, failed, warnings, banningClause: false,
    msmeExemption: { emdExempt: true, stampPaperExempt: false, note: 'MSME registered — EMD likely exempted. Confirm in tender document.' },
    emd: { required: true, amount: `~₹${(tender.valueCr * 0.02).toFixed(2)} Cr (est.)`, msmeExempt: true },
    preBidMeeting: { scheduled: false, date: 'Check portal', venue: 'Check portal' },
    siteVisit: { required: false, note: 'Verify in tender document' },
    bankGuarantee: { required: true, percentage: '5-10%', note: 'Standard for manpower contracts' },
    securityDeposit: { required: true, percentage: '5%', note: 'Typically 5% of contract value' },
    workExperience: { required: true, minYears: '3 years', minValue: 'Similar contracts', note: 'Provide past work orders and performance certificates' },
    geographicalPresence: { required: false, state: 'Delhi NCR', note: 'Right Advisors Delhi NCR based — meets requirement' },
    blacklistingUndertaking: { required: true, note: 'Self declaration on company letterhead required' },
    affidavitRequired: false, stampPaperRequired: false,
    recommendation: failed.length === 0 ? 'Eligible. Verify EMD exemption as MSME before submission.' : 'Review failed criteria before bidding.',
  };
}

async function draftBid(tender, profile, qa = []) {
  const qaContext = qa.length > 0 ? '\n\nPreviously answered questions:\n' + qa.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n') : '';
  const prompt = `Write professional technical bid covering letter for Indian government tender.
Tender: ${tender.title} | Authority: ${tender.org} | Location: ${tender.location} | Value: ${tender.valueStr} | Ref: ${tender.tenderNo} | Deadline: ${tender.deadline || 'As per document'}
Company: Right Advisors — Your Human Resource Partner | MSME Registered | Delhi NCR | Turnover ₹20Cr | Solvency ₹3Cr | EPF/ESIC/GST/ISO | Labour License | No banning | Phone: 9999917353 | Email: Ssinghalbansal@rightadvisors.com${qaContext}
Write 400-450 word formal letter including: tender reference, MSME status + EMD exemption claim, financial eligibility, similar work experience, statutory compliance, geographical presence Delhi NCR, blacklisting declaration, bank guarantee capability, professional closing.
Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  try {
    return await callClaude([{ role: 'user', content: prompt }], 'You are an expert in Indian government tender bids.', 1000);
  } catch (err) { return generateFallbackBid(tender, profile); }
}

function generateFallbackBid(tender, profile) {
  return `Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}

To,
The Tender Committee,
${tender.org}
${tender.location}

Subject: Submission of Technical Bid — "${tender.title}"
Reference: Tender No. ${tender.tenderNo}

Respected Sir/Madam,

Right Advisors — Your Human Resource Partner, a registered MSME enterprise, hereby submits our technical bid for the above-mentioned tender.

ABOUT US: Delhi NCR based manpower supply company with 10+ years experience supplying skilled, semi-skilled and unskilled workforce to Central/State Government departments and PSUs.

FINANCIAL ELIGIBILITY:
• Average Annual Turnover: ₹20 Crore (FY 2022-23, 2023-24, 2024-25) — CA Audited
• Bank Solvency: ₹3 Crore (Current)

MSME EMD EXEMPTION: Being MSME registered (Udyam Certificate enclosed), we claim EMD exemption as per GoI MSME policy.

COMPLIANCE: EPF ✓ | ESIC ✓ | GST ✓ | Labour License ✓ | ISO Certified ✓ | Minimum Wages Act ✓

EXPERIENCE: Successfully executed similar manpower contracts for Government departments in Delhi NCR. Work orders and performance certificates enclosed.

GEOGRAPHICAL PRESENCE: Headquartered in Delhi NCR — immediate deployment capability across Delhi, Noida, Gurugram, Faridabad, Ghaziabad.

DECLARATIONS:
1. Not banned/blacklisted by any Central/State Govt or PSU department
2. Capable of providing Bank Guarantee/Security Deposit as required
3. All information is true and correct

Yours faithfully,
Authorised Signatory
Right Advisors | 9999917353 | Ssinghalbansal@rightadvisors.com`;
}

async function buildChecklist(tender, vaultDocs = []) {
  const vaultNames = vaultDocs.map(d => d.name);
  const items = [
    { item: 'Audited P&L Statement FY 2022-23', category: 'Financial', required: true, note: 'CA certified' },
    { item: 'Audited P&L Statement FY 2023-24', category: 'Financial', required: true, note: 'CA certified' },
    { item: 'Audited P&L Statement FY 2024-25', category: 'Financial', required: true, note: 'CA certified' },
    { item: 'Bank Solvency Certificate (₹3 Cr)', category: 'Financial', required: true, note: 'From scheduled bank, current date' },
    { item: 'EMD or MSME Exemption Certificate', category: 'Financial', required: true, msmeRelated: true, note: 'Submit Udyam certificate for EMD exemption' },
    { item: 'Bank Guarantee / Security Deposit Letter', category: 'Financial', required: true, note: '5-10% of contract value — confirm in tender document' },
    { item: 'Tender Fee Payment Receipt', category: 'Financial', required: false, note: 'If tender fee applicable — check portal' },
    { item: 'GST Registration Certificate', category: 'Legal', required: true, note: 'Active GST number' },
    { item: 'PAN Card (Company)', category: 'Legal', required: true, note: 'Company PAN card' },
    { item: 'EPF Registration Certificate', category: 'Legal', required: true, note: 'Active EPF code' },
    { item: 'ESIC Registration Certificate', category: 'Legal', required: true, note: 'Active ESIC code' },
    { item: 'Company Registration Certificate', category: 'Legal', required: true, note: 'MCA / ROC certificate' },
    { item: 'Labour License', category: 'Legal', required: true, note: 'Valid and current' },
    { item: 'MSME / Udyam Registration Certificate', category: 'Legal', required: true, msmeRelated: true, note: 'Required for EMD exemption claim' },
    { item: 'Stamp Paper Affidavit (if required)', category: 'Legal', required: false, note: 'Check tender document — some tenders require notarised affidavit' },
    { item: 'Past Work Orders — Similar Contracts (min 2)', category: 'Technical', required: true, note: 'Government manpower contracts preferred' },
    { item: 'Performance Certificates from Clients (min 2)', category: 'Technical', required: true, note: 'Must mention EPF/ESIC compliance and timely salary' },
    { item: 'ISO Certificate', category: 'Technical', required: false, note: 'Strengthens technical bid' },
    { item: 'List of Manpower Currently Deployed', category: 'Technical', required: false, note: 'Shows operational capacity' },
    { item: 'Proof of Geographical Presence — Delhi NCR', category: 'Technical', required: false, note: 'Office address proof / rent agreement' },
    { item: 'Pre-Bid Meeting Attendance Proof', category: 'Technical', required: false, note: 'Check portal for pre-bid meeting schedule' },
    { item: 'Site Visit Confirmation (if required)', category: 'Technical', required: false, note: 'Check tender document for site visit requirement' },
    { item: 'Covering Letter on Company Letterhead', category: 'Administrative', required: true, note: 'Signed by authorised signatory with stamp' },
    { item: 'Self-Declaration — No Banning/Blacklisting', category: 'Administrative', required: true, note: 'On company letterhead — signed and stamped' },
    { item: 'Blacklisting Undertaking on Stamp Paper', category: 'Administrative', required: false, note: 'Some tenders require notarised undertaking — verify' },
    { item: 'Power of Attorney / Authorisation Letter', category: 'Administrative', required: true, note: 'If signatory is not director/proprietor' },
    { item: 'Digital Signature Certificate (DSC)', category: 'Administrative', required: true, note: 'Class 3 DSC — mandatory for portal submission' },
  ];
  return items.map(item => ({
    ...item,
    inVault: vaultNames.some(v => v.toLowerCase().includes(item.item.toLowerCase().split(' ')[0])),
    checked: false,
  }));
}

module.exports = { checkEligibility, draftBid, buildChecklist };
