"""Telegram Bot API client. Activates only if TELEGRAM_BOT_TOKEN is set."""
from __future__ import annotations

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger()


def is_configured() -> bool:
    return bool(settings.telegram_bot_token)


class TelegramError(Exception):
    pass


async def send_message(
    chat_id: str,
    text: str,
    parse_mode: str = "Markdown",
) -> dict:
    """Send a message to a Telegram chat. Raises TelegramError on failure."""
    if not is_configured():
        raise TelegramError(
            "Telegram bot token is not configured. Set TELEGRAM_BOT_TOKEN env var."
        )
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            data = resp.json()
            if not data.get("ok"):
                raise TelegramError(
                    f"Telegram API error: {data.get('description', 'unknown')}"
                )
            return data["result"]
    except httpx.HTTPError as e:
        raise TelegramError(f"HTTP error reaching Telegram: {e}") from e


def format_instruction_notification(
    *,
    instruction_text: str,
    client_id: str,
    company: str | None,
    person_name: str | None,
    device: str | None,
    instruction_id: str,
    priority: int,
) -> str:
    """Render an operator instruction as a Telegram-friendly Markdown message."""
    title_parts = [p for p in (company, person_name) if p]
    target = " / ".join(title_parts) if title_parts else client_id

    lines = [
        "🤖 *Claude Log Central から指示が届きました*",
        "",
        f"宛先: *{target}*",
    ]
    if device:
        lines.append(f"💻 デバイス: {device}")
    lines.append(f"🆔 client\\_id: `{client_id}`")
    if priority:
        lines.append(f"⚡ 優先度: {priority}")
    lines.append("")
    lines.append("📝 *指示内容:*")
    # Telegram Markdown escapes — keep simple, fallback to text-mode if needed
    safe_text = instruction_text.replace("`", "'").replace("*", "·")
    lines.append(f"```\n{safe_text}\n```")
    lines.append("")
    lines.append(f"_id: {instruction_id}_")
    return "\n".join(lines)
