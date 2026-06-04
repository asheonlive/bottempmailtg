# Telegram Bot

A simple Telegram bot (Python, [python-telegram-bot](https://docs.python-telegram-bot.org/)) ready to deploy on Railway.

## Commands

- `/start` — greet the user
- `/help` — list commands
- `/echo <text>` — repeat text back
- Any plain text message — echoed back

## Run locally

```bash
cd telegram-bot
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # then edit .env and paste your BOT_TOKEN
export $(grep -v '^#' .env | xargs)   # load .env into the shell (macOS/Linux)
python bot.py
```

## Deploy on Railway

1. Push this folder to a GitHub repo.
2. In [Railway](https://railway.app): **New Project → Deploy from GitHub repo** → pick this repo.
3. Open the service → **Variables** tab → add:
   - `BOT_TOKEN` = your token from [@BotFather](https://t.me/BotFather)
4. Railway builds and runs `python bot.py` automatically. Your bot is live.

## Security

- The token is read from the `BOT_TOKEN` environment variable — never hardcoded.
- `.env` is gitignored so your token never lands in version control.
- If a token ever leaks, revoke it in BotFather (`/mybots → API Token → Revoke`).
