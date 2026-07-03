/*
 * Cloudflare Worker: приём заявки с формы сайта.
 * Что делает: принимает POST с данными заявки → создаёт карточку в Trello
 * и шлёт уведомление в Telegram. Работает на серверах Cloudflare (вне РФ),
 * поэтому Telegram и Trello доступны даже при блокировке.
 *
 * Секреты (задаются в настройках Worker → Variables and Secrets, НЕ в коде):
 *   TRELLO_KEY      — API-ключ Trello
 *   TRELLO_TOKEN    — токен Trello
 *   TRELLO_LIST_ID  — id списка «Квалифицированные»
 *   TG_BOT_TOKEN    — токен Telegram-бота
 *   TG_CHAT_ID      — id чата, куда слать уведомления
 *   ALLOWED_ORIGIN  — домен сайта (напр. https://example.ru); можно "*" на старте
 */

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Предзапрос браузера (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, cors);
    }

    // Читаем тело заявки
    let data;
    try {
      data = await request.json();
    } catch {
      return json({ ok: false, error: 'Bad JSON' }, 400, cors);
    }

    const methodLabels = { telegram: 'Telegram', phone: 'Телефон', vk: 'VK' };
    const name = (data.name || '').toString().trim() || 'Без имени';
    const niche = (data.niche || '').toString().trim();
    const method = methodLabels[data.method] || (data.method || '').toString();
    const contact = (data.contact || '').toString().trim();
    const comment = (data.comment || '').toString().trim();
    const source = (data.form_source || '').toString().trim();
    const pageUrl = (data.page_url || '').toString().trim();

    // Собираем UTM-метки, если пришли
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const utm = utmKeys
      .filter((k) => data[k])
      .map((k) => `${k}: ${data[k]}`);

    // ── Карточка Trello ──
    const cardTitle = niche ? `Заявка: ${name} — ${niche}` : `Заявка: ${name}`;
    const descLines = [
      `**Имя:** ${name}`,
      niche && `**Ниша:** ${niche}`,
      (method || contact) && `**Связь:** ${method}${contact ? ` — ${contact}` : ''}`,
      comment && `**Комментарий:** ${comment}`,
      source && `**Источник формы:** ${source}`,
      utm.length && `**UTM:** ${utm.join(', ')}`,
      pageUrl && `**Страница:** ${pageUrl}`,
    ].filter(Boolean);
    const cardDesc = descLines.join('\n');

    // ── Текст в Telegram (HTML) ──
    const tgLines = [
      '🔔 <b>Новая заявка</b>',
      '',
      `<b>Имя:</b> ${esc(name)}`,
      niche && `<b>Ниша:</b> ${esc(niche)}`,
      (method || contact) && `<b>Связь:</b> ${esc(method)}${contact ? ` — ${esc(contact)}` : ''}`,
      comment && `<b>Комментарий:</b> ${esc(comment)}`,
      source && `<b>Источник:</b> ${esc(source)}`,
      utm.length && `<b>UTM:</b> ${esc(utm.join(', '))}`,
      pageUrl && `<b>Страница:</b> ${esc(pageUrl)}`,
    ].filter(Boolean);
    const tgText = tgLines.join('\n');

    // Шлём в обе стороны параллельно, одна ошибка не роняет вторую
    const [trelloRes, tgRes] = await Promise.allSettled([
      sendToTrello(env, cardTitle, cardDesc),
      sendToTelegram(env, tgText),
    ]);

    const trelloOk = trelloRes.status === 'fulfilled' && trelloRes.value.ok;
    const tgOk = tgRes.status === 'fulfilled' && tgRes.value.ok;

    // Хотя бы карточка Trello должна создаться — иначе заявка потеряна
    if (!trelloOk) {
      const info =
        trelloRes.status === 'fulfilled'
          ? trelloRes.value
          : { status: 'exception', body: String(trelloRes.reason) };
      return json(
        {
          ok: false,
          trello: trelloOk,
          telegram: tgOk,
          error: 'Trello failed',
          trelloStatus: info.status,
          trelloBody: info.body,
        },
        502,
        cors
      );
    }
    return json({ ok: true, trello: trelloOk, telegram: tgOk }, 200, cors);
  },
};

async function sendToTrello(env, name, desc) {
  const url = new URL('https://api.trello.com/1/cards');
  url.searchParams.set('key', env.TRELLO_KEY);
  url.searchParams.set('token', env.TRELLO_TOKEN);
  url.searchParams.set('idList', env.TRELLO_LIST_ID);
  url.searchParams.set('name', name);
  url.searchParams.set('desc', desc);
  url.searchParams.set('pos', 'top');
  const res = await fetch(url, { method: 'POST' });
  let body = '';
  if (!res.ok) {
    try {
      body = (await res.text()).slice(0, 300);
    } catch {}
  }
  return { ok: res.ok, status: res.status, body };
}

async function sendToTelegram(env, text) {
  if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) return { ok: false, skipped: true };
  const res = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TG_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  return { ok: res.ok, status: res.status };
}

// Экранируем спецсимволы для HTML-режима Telegram
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
