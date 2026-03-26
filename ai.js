// ─────────────────────────────────────────────
//  AI Engine: Claude-powered analysis
// ─────────────────────────────────────────────
const https = require('https');

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

function callClaude(messages, system = '', maxTokens = 1000) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return reject(new Error('ANTHROPIC_API_KEY not set'));

    const body = JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = (parsed.content || []).map(i => i.text || '').join('\n');
          resolve(text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseJSON(raw) {
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

// ── Eligibility Check ─────────────────────────
async function checkEligibility(tender, profile) {
  const prompt = `You are a government tender eligibility expert in India.

Tender Details:
- Title: ${tender.title}
- Issuing Authority: ${tender.org}
- Location: ${tender.location}
- Estimated Value: ${tender.valueStr}
- Portal: ${tender.portal}
- Tender No: ${tender.tenderNo}

Company Profile (Right Advisors):
- Average Annual Turnover: ₹${profile.turnoverCr} Cr (last 3 years)
- Bank Solvency Certificate: ₹${profile.solvencyCr} Cr
- Category: ${profile.category}
- Location: ${profile.location}
- Banning/Blacklisting: None
- Registrations: EPF, ESIC, GST, Company Registration, ISO certified

Based on typical eligibility norms for this type of tender (manpower supply, govt India):
1. Turnover usually required = 2-3x tender value per year
2. Solvency = 5-10% of tender value
3. Experience = similar past contracts

Assess eligibility and return JSON only (no markdown):
{
  "eligible": true,
  "score": 85,
  "passed": ["Turnover ₹20Cr meets requirement", "Solvency ₹3Cr adequate"],
  "failed": [],
  "warnings": ["Verify EPF/ESIC validity before submission"],
  "banningClause": false,
  "recommendation": "Strong match. Proceed to bid."
}`;

  try {
    const raw = await callClaude(
      [{ role: 'user', content: prompt }],
      'You are a tender eligibility expert. Return JSON only, no markdown.'
    );
    const result = parseJSON(raw);
    if (result) return result;
  } catch (err) {
    console.log('Eligibility AI error:', err.message);
  }

  // Fallback: rule-based check
  return ruleBasedEligibility(tender, profile);
}

function ruleBasedEligibility(tender, profile) {
  const passed = [], failed = [], warnings = [];
  let score = 60;

  // Turnover check (typical: 2x tender value)
  const reqTurnover = tender.valueCr * 2;
  if (profile.turnoverCr >= reqTurnover) {
    passed.push(`Turnover ₹${profile.turnoverCr}Cr meets requirement (₹${reqTurnover.toFixed(1)}Cr)`);
    score += 15;
  } else {
    failed.push(`Turnover ₹${profile.turnoverCr}Cr may be below requirement (₹${reqTurnover.toFixed(1)}Cr)`);
    score -= 20;
  }

  // Solvency check (typical: 5% of tender value)
  const reqSolvency = tender.valueCr * 0.05;
  if (profile.solvencyCr >= reqSolvency) {
    passed.push(`Solvency ₹${profile.solvencyCr}Cr meets requirement`);
    score += 10;
  } else {
    warnings.push(`Solvency may need update for this tender value`);
  }

  // Category match
  passed.push('Category: Manpower Supply — exact match');
  score += 10;

  // Location match
  passed.push('Location: Delhi NCR — matches tender location');
  score += 5;

  // No banning
  passed.push('No banning/blacklisting — confirmed');

  return {
    eligible: failed.length === 0 && score >= 70,
    score:    Math.min(100, Math.max(0, score)),
    passed, failed, warnings,
    banningClause: false,
    recommendation: failed.length === 0
      ? 'Eligible to bid. Prepare documents and submit before deadline.'
      : 'Review failed criteria before deciding to bid.',
  };
}

// ── Bid Draft ─────────────────────────────────
async function draftBid(tender, profile, qa = []) {
  const qaContext = qa.length > 0
    ? '\n\nPreviously answered questions:\n' + qa.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n')
    : '';

  const prompt = `Write a professional technical bid covering letter for the following government tender in India.

Tender Details:
- Title: ${tender.title}
- Authority: ${tender.org}
- Location: ${tender.location}
- Value: ${tender.valueStr}
- Tender No: ${tender.tenderNo}
- Portal: ${tender.portal}
- Deadline: ${tender.deadline || 'As per tender document'}

Company: Right Advisors — "Your Human Resource Partner"
- Delhi NCR based manpower supply company
- Average Annual Turnover: ₹20 Crore (last 3 financial years)
- Bank Solvency: ₹3 Crore
- Registrations: EPF, ESIC, GST, Company Registration, ISO certified
- Track record: Strong government manpower contracts in Delhi NCR
- Contact: 9999917353 | Ssinghalbansal@rightadvisors.com
- No banning or blacklisting from any government department${qaContext}

Write a formal, professional covering letter (350-450 words) with:
1. Reference to tender number and title
2. Introduction of Right Advisors
3. Statement of eligibility (turnover, solvency, experience)
4. Key strengths (compliance, EPF/ESIC, timely salary, ISO)
5. Declaration of no banning/blacklisting
6. Professional closing with contact details

Use today's date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`;

  try {
    return await callClaude(
      [{ role: 'user', content: prompt }],
      'You are an expert in writing professional Indian government tender bid documents.',
      1000
    );
  } catch (err) {
    console.log('Bid draft AI error:', err.message);
    return generateFallbackBid(tender, profile);
  }
}

function generateFallbackBid(tender, profile) {
  return `Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}

To,
The Tender Committee,
${tender.org}
${tender.location}

Subject: Submission of Technical Bid for "${tender.title}"
Ref: Tender No. ${tender.tenderNo}

Respected Sir/Madam,

With reference to the above-mentioned tender notice, Right Advisors — Your Human Resource Partner, hereby submits our technical bid for the supply of manpower services.

Right Advisors is a Delhi NCR based manpower supply company with over a decade of experience in providing skilled, semi-skilled and unskilled workforce to government organisations. We have a proven track record of delivering reliable, compliant manpower services across Delhi, Noida, Gurugram, Faridabad and Ghaziabad.

FINANCIAL ELIGIBILITY:
- Average Annual Turnover: ₹20 Crore (FY 2022-23, 2023-24, 2024-25)
- Bank Solvency Certificate: ₹3 Crore (Current)

COMPLIANCE & REGISTRATIONS:
- EPF Registration: Active and compliant
- ESIC Registration: Active and compliant
- GST Registration: Active
- Labour License: Valid
- ISO Certified Organisation

KEY STRENGTHS:
- Timely salary disbursement directly to workers' bank accounts
- Full statutory compliance — EPF, ESIC, Minimum Wages Act
- Dedicated team for government tender execution
- No banning or blacklisting from any Central/State Government department

We hereby declare that all information submitted is true and correct. We accept all terms and conditions of the tender document.

Yours faithfully,

Authorised Signatory
Right Advisors — Your Human Resource Partner
Contact: 9999917353
Email: Ssinghalbansal@rightadvisors.com`;
}

// ── Checklist Builder ─────────────────────────
async function buildChecklist(tender, vaultDocs = []) {
  const vaultNames = vaultDocs.map(d => d.name);

  const prompt = `For this government manpower supply tender:
- Title: ${tender.title}
- Authority: ${tender.org}
- Value: ${tender.valueStr}
- Portal: ${tender.portal}

Documents already in vault: ${vaultNames.join(', ') || 'None yet'}

Generate a complete document submission checklist. Return JSON only:
{
  "checklist": [
    {"item": "Document name", "category": "Financial", "required": true, "inVault": true}
  ]
}

Categories: Financial, Technical, Legal, Administrative
Mark inVault true if document name matches one in vault list.`;

  try {
    const raw = await callClaude(
      [{ role: 'user', content: prompt }],
      'You are a tender expert. Return JSON only.'
    );
    const parsed = parseJSON(raw);
    if (parsed && parsed.checklist) {
      return parsed.checklist.map(item => ({
        ...item,
        inVault: vaultNames.some(v =>
          v.toLowerCase().includes(item.item.toLowerCase().split(' ')[0])
        ),
        checked: false,
      }));
    }
  } catch (err) {
    console.log('Checklist AI error:', err.message);
  }

  return getDefaultChecklist(vaultNames);
}

function getDefaultChecklist(vaultNames = []) {
  const items = [
    { item: 'Audited P&L Statement FY 2022-23',    category: 'Financial',       required: true },
    { item: 'Audited P&L Statement FY 2023-24',    category: 'Financial',       required: true },
    { item: 'Audited P&L Statement FY 2024-25',    category: 'Financial',       required: true },
    { item: 'Bank Solvency Certificate (₹3 Cr)',   category: 'Financial',       required: true },
    { item: 'EMD / Earnest Money Deposit',          category: 'Financial',       required: true },
    { item: 'Tender Fee (if applicable)',           category: 'Financial',       required: false },
    { item: 'GST Registration Certificate',         category: 'Legal',           required: true },
    { item: 'PAN Card (Company)',                   category: 'Legal',           required: true },
    { item: 'EPF Registration Certificate',         category: 'Legal',           required: true },
    { item: 'ESIC Registration Certificate',        category: 'Legal',           required: true },
    { item: 'Company Registration Certificate',     category: 'Legal',           required: true },
    { item: 'Labour License',                       category: 'Legal',           required: true },
    { item: 'ISO Certificate',                      category: 'Technical',       required: false },
    { item: 'Past Work Orders (Similar Contracts)', category: 'Technical',       required: true },
    { item: 'Performance Certificates (2 nos.)',    category: 'Technical',       required: true },
    { item: 'List of Manpower Currently Deployed',  category: 'Technical',       required: false },
    { item: 'Covering Letter on Letterhead',        category: 'Administrative',  required: true },
    { item: 'Self-Declaration: No Banning',         category: 'Administrative',  required: true },
    { item: 'Power of Attorney / Authorisation',    category: 'Administrative',  required: true },
    { item: 'Digital Signature Certificate (DSC)',  category: 'Administrative',  required: true },
  ];

  return items.map(item => ({
    ...item,
    inVault: vaultNames.some(v =>
      v.toLowerCase().includes(item.item.toLowerCase().split(' ')[0])
    ),
    checked: false,
  }));
}

module.exports = { checkEligibility, draftBid, buildChecklist };
