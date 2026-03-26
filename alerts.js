// ─────────────────────────────────────────────
//  Alerts: WhatsApp (Twilio) + Email (SendGrid)
// ─────────────────────────────────────────────
const https = require('https');

// ── WhatsApp via Twilio ───────────────────────
async function sendWhatsApp(tender, profile) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  const to    = process.env.WHATSAPP_TO || `whatsapp:+91${profile.phone}`;

  if (!sid || !token) {
    console.log('⚠️  Twilio not configured — skipping WhatsApp alert');
    return;
  }

  const message = `🎯 *Right Advisors — New Eligible Tender!*

📋 *${tender.title}*
🏛️ Authority: ${tender.org}
📍 Location: ${tender.location}
💰 Value: ${tender.valueStr}
🗓️ Deadline: ${tender.deadline || 'Check portal'}
🔢 Ref No: ${tender.tenderNo}
📊 Eligibility Score: ${tender.score}/100 ✅
🌐 Portal: ${tender.portal}

Bid draft is READY. Open dashboard to review and submit.
Dashboard: ${process.env.DASHBOARD_URL || 'http://your-server.railway.app'}`;

  const body = new URLSearchParams({
    From: from,
    To:   to,
    Body: message,
  }).toString();

  return new Promise((resolve) => {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const req = https.request({
      hostname: 'api.twilio.com',
      path:     `/2010-04-01/Accounts/${sid}/Messages.json`,
      method:   'POST',
      headers:  {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      res.on('data', () => {});
      res.on('end', () => {
        console.log(`📲 WhatsApp alert sent for: ${tender.title}`);
        resolve();
      });
    });
    req.on('error', e => {
      console.log('WhatsApp error:', e.message);
      resolve();
    });
    req.write(body);
    req.end();
  });
}

// ── Email via SendGrid ────────────────────────
async function sendEmail(tender, profile) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const toEmail = process.env.ALERT_EMAIL || profile.email;

  if (!apiKey) {
    console.log('⚠️  SendGrid not configured — skipping email alert');
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #0d1520; padding: 24px; text-align: center;">
      <h1 style="color: #f5a623; margin: 0; font-size: 22px;">Right Advisors</h1>
      <p style="color: #6b7c94; margin: 6px 0 0; font-size: 13px;">Autonomous Tender AI — New Match Found</p>
    </div>
    <div style="padding: 28px;">
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <strong style="color: #166534;">✅ Eligible Tender Found — Score: ${tender.score}/100</strong>
      </div>
      <h2 style="font-size: 16px; color: #1a2a3a; margin: 0 0 16px;">${tender.title}</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #6b7c94; font-size: 13px; width: 40%;">Authority</td><td style="font-size: 13px;">${tender.org}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7c94; font-size: 13px;">Location</td><td style="font-size: 13px;">${tender.location}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7c94; font-size: 13px;">Tender Value</td><td style="font-size: 13px; font-weight: bold; color: #166534;">${tender.valueStr}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7c94; font-size: 13px;">Deadline</td><td style="font-size: 13px; color: #dc2626;">${tender.deadline || 'Check portal'}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7c94; font-size: 13px;">Reference No.</td><td style="font-size: 13px;">${tender.tenderNo}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7c94; font-size: 13px;">Portal</td><td style="font-size: 13px;">${tender.portal}</td></tr>
      </table>
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 20px 0;">
        <strong style="color: #92400e;">📋 Bid draft is ready. Open dashboard to review and submit.</strong>
      </div>
      <a href="${process.env.DASHBOARD_URL || 'http://your-server.railway.app'}" 
         style="display: block; background: #f5a623; color: #000; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
        Open Dashboard →
      </a>
    </div>
    <div style="padding: 16px 28px; border-top: 1px solid #f0f0f0; font-size: 11px; color: #999; text-align: center;">
      Right Advisors · 9999917353 · Ssinghalbansal@rightadvisors.com
    </div>
  </div>
</body>
</html>`;

  const payload = JSON.stringify({
    personalizations: [{ to: [{ email: toEmail }] }],
    from:    { email: 'alerts@rightadvisors.com', name: 'Right Advisors Tender AI' },
    subject: `🎯 New Tender Match: ${tender.title.slice(0, 60)} — ${tender.valueStr}`,
    content: [{ type: 'text/html', value: html }],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.sendgrid.com',
      path:     '/v3/mail/send',
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      res.on('data', () => {});
      res.on('end', () => {
        console.log(`📧 Email alert sent to: ${toEmail}`);
        resolve();
      });
    });
    req.on('error', e => { console.log('Email error:', e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

module.exports = { sendWhatsApp, sendEmail };
