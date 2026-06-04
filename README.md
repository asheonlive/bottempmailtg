# Temp Mail Telegram Bot

A disposable-email Telegram bot that runs **free** as a [Vercel](https://vercel.com) webhook
function — no always-on server, no credit card. Email is provided by the free
[mail.tm](https://docs.mail.tm/) API (no API key required).

## Commands

- `/email` — show your temp email address
- `/inbox` — list received messages
- `/read <number>` — open a message from the inbox list
- `/help` — show help

Each Telegram user gets their own inbox automatically (no database — the inbox is
derived deterministically from the user id).

## Deploy on Vercel (free, no card)

1. Push this repo to GitHub (already done if you're reading this there).
2. Go to [vercel.com](https://vercel.com) → **Add New… → Project** → import this repo.
3. Before deploying, open **Environment Variables** and add:
   - `BOT_TOKEN` = your token from [@BotFather](https://t.me/BotFather)
   - *(optional)* `WEBHOOK_SECRET` = any random string
   - *(optional)* `MAIL_SALT` = any random string
4. Click **Deploy**. Note your deployment URL, e.g. `https://bottempmailtg.vercel.app`.

## Connect Telegram to the webhook (one time)

Telegram needs to know where to send messages. Visit this URL in your browser,
replacing `<BOT_TOKEN>` and `<YOUR_VERCEL_URL>`:

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<YOUR_VERCEL_URL>/api/bot
```

If you set `WEBHOOK_SECRET`, append `&secret_token=<YOUR_SECRET>` to that URL.

You should see `{"ok":true,...}`. Now message your bot — `/email` to begin.

To check status later: `https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo`

## Security

- Tokens live only in Vercel env vars — never in the code or git.
- `.env` is gitignored.
- If a token leaks, revoke it in BotFather (`/mybots → API Token → Revoke`).
