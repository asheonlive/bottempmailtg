"""
Telegram bot entry point.

The bot token is read from the BOT_TOKEN environment variable.
NEVER hardcode the token here — set it in Railway (or a local .env file).
"""

import logging
import os

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start."""
    user = update.effective_user
    await update.message.reply_html(
        f"Hi {user.mention_html()}! 👋\n"
        "I'm your bot. Send /help to see what I can do."
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help."""
    await update.message.reply_text(
        "Available commands:\n"
        "/start - greet you\n"
        "/help - show this message\n"
        "/echo <text> - I repeat your text back\n\n"
        "You can also just send me any message and I'll echo it."
    )


async def echo_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /echo <text>."""
    text = " ".join(context.args) if context.args else "(nothing to echo)"
    await update.message.reply_text(text)


async def echo_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Echo any non-command text message."""
    await update.message.reply_text(update.message.text)


def main() -> None:
    token = os.environ.get("BOT_TOKEN")
    if not token:
        raise RuntimeError(
            "BOT_TOKEN environment variable is not set. "
            "Set it in Railway's Variables tab, or in a local .env file."
        )

    app = Application.builder().token(token).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("echo", echo_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo_message))

    logger.info("Bot starting (polling)...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
