import { config } from '../config';
import logger from '../logger';

/** Optional Telegram notification to the candidate themself. No-op when not configured. */
export async function notify(text: string): Promise<void> {
  if (!config.telegramToken || !config.telegramChatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.telegramChatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) logger.warn({ action: 'notify', status: res.status });
  } catch (err) {
    logger.warn({ action: 'notify', error: String(err) });
  }
}
