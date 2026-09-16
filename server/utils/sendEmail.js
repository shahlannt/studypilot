// Mail courier: real SMTP delivery when configured, otherwise a readable
// console fallback so the app (and the verification/reset flows) remain
// testable without any mail credentials.
//
// Configure via these env vars (all optional):
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE ('true' for 465),
//   SMTP_USER, SMTP_PASS, SMTP_FROM (defaults to SMTP_USER)

const nodemailer = require('nodemailer');

let transporter = null;

const dns = require('dns');

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER) return null; // no SMTP configured → log mode
  transporter = nodemailer.createTransport({
    // Use IPv4 explicitly. Some hosts (Render free tier) have no IPv6
    // egress, and smtp.gmail.com often resolves to IPv6 first → ENETUNREACH.
    host: (process.env.SMTP_HOST_V4 && process.env.SMTP_HOST_V4.trim()) || SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Fail fast instead of hanging (nodemailer defaults are ~2 minutes).
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });
  return transporter;
}

// Resolve the SMTP host's IPv4 addresses once at boot, so a host with no
// IPv6 egress (Render free tier) connects even when the hostname resolves
// to IPv6 first. Falls back gracefully if the lookup fails.
async function resolveSmtpHost(hostname) {
  if (!hostname) return;
  try {
    const addrs = await dns.promises.resolve4(hostname);
    if (addrs && addrs.length) {
      process.env.SMTP_HOST_V4 = addrs[0];
      console.log(`[mail] using IPv4 ${addrs[0]} for ${hostname} (SMTP egress is IPv4-only)`);
    }
  } catch (err) {
    console.warn(`[mail] IPv4 lookup for ${hostname} failed (${err.code || err.message}); will use hostname as-is.`);
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

module.exports = { sendEmail, sendEmailAsync, resolveSmtpHost };