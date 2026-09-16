// Email courier: sends transactional email via the Brevo (Sendinblue) API
// over HTTPS. Brevo is reachable from any host — including Render's cloud
// egress, where direct SMTP to smtp.gmail.com is silently dropped by Google.
// Falls back to printing the email to the server log when no BREVO_API_KEY is
// configured, so the verification/reset flows stay testable without creds.
//
// Env vars:
//   BREVO_API_KEY — required to send. Create a free account (300 emails/day),
//                   add a sender, and paste the master/tx API key here.
//   EMAIL_FROM    — e.g. "StudyPilot <shahlann522@gmail.com>". Must be a
//                   sender verified in the Brevo account. Defaults to
//                   SMTP_FROM / SMTP_USER (kept for the already-configured
//                   SMTP values) and finally to a plain fallback.

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const getApiKey = () => (process.env.BREVO_API_KEY || '').trim();

const getFrom = () =>
  (
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    (process.env.SMTP_USER ? `StudyPilot <${process.env.SMTP_USER}>` : '')
  ).trim();

// One-line description of the active backend, printed at boot.
function emailBackendName() {
  if (getApiKey()) return `Brevo API (from: ${getFrom() || '<unset — add EMAIL_FROM>'})`;
  return 'log mode (no BREVO_API_KEY — emails printed to the server log)';
}

async function sendEmail({ to, subject, text, html }) {
  const apiKey = getApiKey();
  if (apiKey) {
    const from = getFrom();
    if (!from) {
      throw new Error(
        'No from address — set EMAIL_FROM to a sender verified in your Brevo account ' +
          '(e.g. "StudyPilot <you@example.com>")'
      );
    }
    const m = from.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
    const sender = m
      ? { name: m[1] || 'StudyPilot', email: m[2] }
      : { name: 'StudyPilot', email: from };

    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text
      })
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Brevo HTTP ${res.status}: ${errBody.slice(0, 300)}`);
    }
    return;
  }

  // Dev / no-key fallback: print the email to the server log so the flow
  // can be tested end-to-end. The console link is clickable in most terminals.
  console.log('\n────────── [STUDYPILOT MAIL (log mode — no BREVO_API_KEY)] ──────────');
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('────────────────────────────────────────────────────────────');
  console.log(text || html || '');
  console.log('────────────────────────────────────────────────────────────\n');
}

// Fire-and-forget delivery helper: sends in the background so an HTTP request
// NEVER blocks on the mail service (slow/unreachable mail must not make
// register or forgot-password hang). Outcomes are logged server-side.
function sendEmailAsync(payload) {
  sendEmail(payload).then(
    () => console.log(`[mail] ✓ sent "${payload.subject}" to ${payload.to}`),
    (err) => console.error(`[mail] ✗ failed to send "${payload.subject}" to ${payload.to}:`, err.message)
  );
}

module.exports = { sendEmail, sendEmailAsync, emailBackendName };