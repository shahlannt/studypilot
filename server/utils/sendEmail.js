// Mail courier: real SMTP delivery when configured, otherwise a readable
// console fallback so the app (and the verification/reset flows) remain
// testable without any mail credentials.
//
// Configure via these env vars (all optional):
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE ('true' for 465),
//   SMTP_USER, SMTP_PASS, SMTP_FROM (defaults to SMTP_USER)

const nodemailer = require('nodemailer');
const net = require('net');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER) return null; // no SMTP configured → log mode
  transporter = nodemailer.createTransport({
    // SMTP_HOST_V4 (if provided) forces a specific IPv4; otherwise the hostname
    // is used. IPv4 preference is handled globally via dns.setDefaultResultOrder
    // ('ipv4first') at boot — no hand-picked addresses needed for Gmail.
    host: (process.env.SMTP_HOST_V4 && process.env.SMTP_HOST_V4.trim()) || SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Lenient timeouts — mail is sent fire-and-forget (sendEmailAsync), so the
    // HTTP request never waits on these. Too-tight values cause false
    // "Connection timeout" on slow cold-starts.
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000
  });
  return transporter;
}

// Boot-time connectivity probe: reports whether the SMTP host is reachable
// over IPv4 on the common ports. Lets us see the real error (e.g. "port 465
// blocked" vs "proxy refused") instead of guessing from a failed send.
function probeSmtp(hostname = process.env.SMTP_HOST) {
  if (!hostname) return;
  const configured = Number(process.env.SMTP_PORT || 587);
  const ports = [...new Set([configured, 465, 587])].filter((p) => Number.isInteger(p) && p > 0);
  for (const port of ports) {
    const s = net.connect({ host: hostname, port, family: 4 });
    // If neither 'connect' nor 'error' fires within 8s, the SYN is being
    // dropped silently — typical of Gmail blocking cloud/datacenter egress.
    const kill = setTimeout(() => {
      console.log(`[mail] probe: ${hostname}:${port} NO RESPONSE after 8s (SYN dropped / egress blocked — not a creds issue)`);
      s.destroy();
    }, 8000);
    s.on('connect', () => {
      clearTimeout(kill);
      console.log(`[mail] probe: ${hostname}:${port} REACHABLE (IPv4)`);
      s.destroy();
    });
    s.on('error', (e) => {
      clearTimeout(kill);
      console.log(`[mail] probe: ${hostname}:${port} ${e.code || e.message}`);
    });
  }
}

async function sendEmail({ to, subject, text, html }) {
  const t = getTransporter();
  if (t) {
    await t.sendMail({
      from: process.env.SMTP_FROM || `StudyPilot <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html
    });
    return;
  }

  // Dev / no-SMTP fallback: print the email to the server log so the flow
  // can be tested end-to-end. The console link is clickable in most terminals.
  console.log('\n────────── [STUDYPILOT MAIL (no SMTP — printed to log)] ──────────');
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('────────────────────────────────────────────────────────────');
  console.log(text || html || '');
  console.log('────────────────────────────────────────────────────────────\n');
}

// Fire-and-forget delivery helper: sends in the background so an HTTP request
// NEVER blocks on the mail server (a slow/unreachable SMTP must not make
// register or forgot-password hang). Outcomes are logged server-side.
function sendEmailAsync(payload) {
  sendEmail(payload).then(
    () => console.log(`[mail] ✓ sent "${payload.subject}" to ${payload.to}`),
    (err) => console.error(`[mail] ✗ failed to send "${payload.subject}" to ${payload.to}:`, err.message)
  );
}

module.exports = { sendEmail, sendEmailAsync, probeSmtp };