// Telegram temp-mail bot — Vercel webhook function.
//
// Stateless by design: each Telegram user gets a deterministic mail.tm inbox
// derived from their user id, so we never need a database.
//
// Required env var: BOT_TOKEN  (from @BotFather)
// Optional env vars:
//   WEBHOOK_SECRET  - if set, Telegram must send it in the secret-token header
//   MAIL_SALT       - extra secret mixed into the inbox password (set anything)

import crypto from 'node:crypto';

const TELEGRAM_API = () => `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
const MAILTM = 'https://api.mail.tm';
const SALT = process.env.MAIL_SALT || 'tempmail-default-salt';

// ---- Telegram helpers -------------------------------------------------------

async function tg(method, payload) {
  await fetch(`${TELEGRAM_API()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function send(chatId, text) {
  return tg('sendMessage', { chat_id: chatId, parse_mode: 'HTML', text, disable_web_page_preview: true });
}

// ---- mail.tm helpers --------------------------------------------------------

async function getDomain() {
  const r = await fetch(`${MAILTM}/domains?page=1`);
  const j = await r.json();
  const domains = (j['hydra:member'] || []).filter((d) => d.isActive);
  // Deterministic pick so a user's address stays stable across requests.
  domains.sort((a, b) => (a.domain < b.domain ? -1 : 1));
  if (!domains.length) throw new Error('no active mail.tm domains');
  return domains[0].domain;
}

function creds(userId, domain) {
  const address = `tg${userId}@${domain}`;
  const hash = crypto.createHash('sha256').update(`${userId}-${SALT}`).digest('hex');
  const password = `Tg1!${hash.slice(0, 24)}`;
  return { address, password };
}

async function getToken(address, password) {
  const r = await fetch(`${MAILTM}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, password }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.token || null;
}

async function ensureAccount(userId) {
  const domain = await getDomain();
  const { address, password } = creds(userId, domain);
  let token = await getToken(address, password);
  if (!token) {
    // Account doesn't exist yet — create it, then log in.
    await fetch(`${MAILTM}/accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address, password }),
    });
    token = await getToken(address, password);
  }
  return { address, token };
}

async function listMessages(token) {
  const r = await fetch(`${MAILTM}/messages?page=1`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) return [];
  const j = await r.json();
  return j['hydra:member'] || [];
}

async function readMessage(token, id) {
  const r = await fetch(`${MAILTM}/messages/${id}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return r.json();
}

// ---- formatting -------------------------------------------------------------

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function helpText() {
  return (
    '📧 <b>Temp Mail Bot</b>\n\n' +
    'Disposable email addresses, right in Telegram.\n\n' +
    '<b>Commands</b>\n' +
    '/email — show your temp email address\n' +
    '/inbox — list received messages\n' +
    '/read &lt;number&gt; — open a message from the list\n' +
    '/help — show this message\n\n' +
    'Use the address anywhere, then check /inbox.'
  );
}

// ---- update handling --------------------------------------------------------

async function handleUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const [cmd, ...rest] = msg.text.trim().split(/\s+/);
  const arg = rest.join(' ');

  switch (cmd) {
    case '/start':
    case '/help':
      await send(chatId, helpText());
      return;

    case '/email':
    case '/new': {
      const { address, token } = await ensureAccount(userId);
      if (!token) return send(chatId, '⚠️ Could not reach the mail service. Try again in a moment.');
      return send(chatId, `📧 Your temp email:\n<code>${escapeHtml(address)}</code>\n\nSend mail to it, then use /inbox.`);
    }

    case '/inbox': {
      const { address, token } = await ensureAccount(userId);
      if (!token) return send(chatId, '⚠️ Could not reach the mail service. Try again in a moment.');
      const msgs = await listMessages(token);
      if (!msgs.length) return send(chatId, `📭 Inbox empty for <code>${escapeHtml(address)}</code>.`);
      const lines = msgs.slice(0, 10).map((m, i) =>
        `${i + 1}. <b>${escapeHtml(m.subject || '(no subject)')}</b>\n   from ${escapeHtml(m.from?.address || '?')}`
      );
      return send(chatId, `📥 <b>Inbox</b> (<code>${escapeHtml(address)}</code>)\n\n${lines.join('\n')}\n\nUse /read &lt;number&gt; to open one.`);
    }

    case '/read': {
      const n = parseInt(arg, 10);
      if (!n) return send(chatId, 'Usage: /read &lt;number&gt; (the number from /inbox)');
      const { token } = await ensureAccount(userId);
      if (!token) return send(chatId, '⚠️ Could not reach the mail service. Try again in a moment.');
      const msgs = await listMessages(token);
      const m = msgs[n - 1];
      if (!m) return send(chatId, 'No message with that number. Check /inbox.');
      const full = await readMessage(token, m.id);
      let body = full?.text || stripHtml((full?.html || []).join('\n')) || '(no text content)';
      body = body.slice(0, 3500);
      return send(chatId,
        `✉️ <b>${escapeHtml(m.subject || '(no subject)')}</b>\nfrom ${escapeHtml(m.from?.address || '?')}\n\n${escapeHtml(body)}`
      );
    }

    default:
      return send(chatId, 'Unknown command. Try /help');
  }
}

// ---- Vercel entry point -----------------------------------------------------

export default async function handler(req, res) {
  // Health check / browser visit
  if (req.method !== 'POST') {
    res.status(200).send('Temp Mail Bot webhook is running.');
    return;
  }

  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    res.status(401).send('unauthorized');
    return;
  }

  let update = req.body;
  if (typeof update === 'string') {
    try { update = JSON.parse(update); } catch { update = null; }
  }

  // Always answer 200 quickly so Telegram doesn't retry-storm on errors.
  try {
    if (update) await handleUpdate(update);
  } catch (err) {
    console.error('handler error:', err);
  }
  res.status(200).send('ok');
}
