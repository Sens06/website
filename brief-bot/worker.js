/*
 * Cloudflare Worker: Telegram-бот брифа для клиентов агентства К.Л.А.Ц.
 *
 * Сценарий: после созвона менеджер отправляет клиенту ссылку на бота
 * (https://t.me/<имя_бота>). Клиент пошагово заполняет бриф:
 * согласие на обработку ПДн → контакты → ниша → ссылки → опыт →
 * логотипы → конкуренты → контент → рекламные каналы и бюджеты →
 * вопрос про публикацию исследования → подтверждение.
 *
 * Готовый бриф прилетает в чат менеджера (ADMIN_CHAT_ID) вместе с логотипами.
 *
 * Состояние каждого клиента хранится в Cloudflare KV, поэтому клиент может
 * закрыть бота и вернуться позже — бот продолжит с того же шага. Команда
 * /edit (или кнопка «Изменить ответы») позволяет вернуться к любому уже
 * заполненному шагу.
 *
 * Cron-триггер раз в 30 минут проверяет незавершённые брифы: если клиент
 * молчит больше 12 часов — бот шлёт одно напоминание.
 *
 * Секреты (Settings → Variables and Secrets, НЕ в коде):
 *   BOT_TOKEN       — токен бота от @BotFather
 *   ADMIN_CHAT_ID   — id чата, куда слать готовые брифы
 *   WEBHOOK_SECRET  — произвольная строка; та же передаётся в setWebhook
 * Привязки (wrangler.jsonc):
 *   BRIEF_KV        — KV namespace для состояний
 */

const PRIVACY_URL = 'https://clatz.ru/privacy.html';
const REMIND_AFTER_MS = 12 * 60 * 60 * 1000; // 12 часов

// ─────────────────────────────────────────────────────────────────────────────
// Шаги брифа
// ─────────────────────────────────────────────────────────────────────────────

const CHANNELS = [
  'Таргетированная реклама ВКонтакте',
  'Контекстная реклама (Яндекс Директ)',
  'Telegram Ads / посевы в каналах',
  'Реклама у блогеров и инфлюенсеров',
  'SEO-продвижение',
  'Авито / маркетплейсы',
  'Офлайн-реклама (наружка, радио, печать)',
  'Другие каналы (двухгис, купонаторы и т.п.)',
];

function channelStep(title) {
  return {
    key: 'channel: ' + title,
    label: title,
    kind: 'channel',
    prompt:
      `📊 <b>${title}</b>\n\n` +
      'Использовали этот канал за последние 3 месяца?\n\n' +
      'Если <b>да</b> — напишите, какой месячный бюджет закладывали ' +
      '(можно помесячно, например: «апрель 30 000, май 45 000, июнь 45 000») ' +
      'и пару слов о результатах.\n' +
      'Если <b>нет</b> — нажмите кнопку ниже.',
  };
}

const STEPS = [
  {
    key: 'Имя',
    label: 'Имя',
    kind: 'text',
    prompt: '👤 Как к вам обращаться? Напишите имя и фамилию.',
  },
  {
    key: 'Телефон',
    label: 'Телефон',
    kind: 'phone',
    prompt:
      '📞 Оставьте номер телефона для связи.\n\n' +
      'Можно нажать кнопку «Отправить мой контакт» внизу или написать номер вручную.',
  },
  {
    key: 'E-mail',
    label: 'E-mail',
    kind: 'email',
    prompt: '📧 Укажите электронную почту — на неё пришлём материалы и отчёты.',
  },
  {
    key: 'Компания',
    label: 'Компания',
    kind: 'text',
    prompt: '🏢 Как называется ваша компания / бренд?',
  },
  {
    key: 'Ниша',
    label: 'Ниша',
    kind: 'text',
    prompt:
      '🎯 Опишите вашу нишу:\n' +
      '• чем занимаетесь, какой продукт или услуга;\n' +
      '• средний чек;\n' +
      '• география работы (город / регион / вся РФ);\n' +
      '• кто ваш типичный клиент.',
  },
  {
    key: 'Ссылки (сайт и соцсети)',
    label: 'Ссылки',
    kind: 'text',
    prompt:
      '🔗 Пришлите одним сообщением все ссылки:\n' +
      '• сайт (если есть);\n' +
      '• все соцсети — ВКонтакте, Telegram, Instagram*, YouTube, Дзен и т.д.\n\n' +
      'Если чего-то нет — так и напишите, например «сайта нет».',
  },
  {
    key: 'Опыт в нише',
    label: 'Опыт в нише',
    kind: 'text',
    prompt:
      '📈 Расскажите про ваш опыт:\n' +
      '• сколько лет вы на рынке;\n' +
      '• как развивался бизнес;\n' +
      '• что сейчас является главным источником клиентов.',
  },
  {
    key: 'Опыт продвижения',
    label: 'Опыт продвижения',
    kind: 'text',
    prompt:
      '🧪 Какой опыт продвижения уже был?\n' +
      '• что пробовали (сами или с подрядчиками);\n' +
      '• что сработало, а что нет;\n' +
      '• почему, на ваш взгляд, не сработало.',
  },
  {
    key: 'Логотипы и фирменный стиль',
    label: 'Логотипы',
    kind: 'files',
    prompt:
      '🖼 Загрузите ваши логотипы и, если есть, брендбук / фирменный стиль.\n\n' +
      'Можно отправить несколько картинок или файлов подряд, либо прислать ' +
      'ссылку на диск. Когда закончите — нажмите «Готово». ' +
      'Если логотипов нет — нажмите «Пропустить».',
  },
  {
    key: 'Конкуренты',
    label: 'Конкуренты',
    kind: 'text',
    prompt:
      '⚔️ Назовите основных конкурентов, на которых вы ориентируетесь:\n' +
      '• названия компаний;\n' +
      '• ссылки на их сайты и соцсети;\n' +
      '• что вам нравится в их продвижении.',
  },
  {
    key: 'Контент: кто ведёт',
    label: 'Контент: кто ведёт',
    kind: 'text',
    prompt:
      '✍️ Кто сейчас занимается контентом?\n' +
      '• сами, штатный сотрудник или подрядчик;\n' +
      '• на каких площадках публикуетесь;\n' +
      '• кто снимает фото/видео.',
  },
  {
    key: 'Контент: форматы и частота',
    label: 'Контент: форматы',
    kind: 'text',
    prompt:
      '🗓 Как часто выходит контент и в каких форматах ' +
      '(посты, сторис, Reels/клипы, статьи, видео)?\n' +
      'Какие форматы у вашей аудитории заходят лучше всего?',
  },
  {
    key: 'Контент: план и пожелания',
    label: 'Контент: пожелания',
    kind: 'text',
    prompt:
      '💡 Есть ли контент-план, рубрики, tone of voice?\n' +
      'Что хотите улучшить или изменить в контенте?',
  },
  ...CHANNELS.map(channelStep),
  {
    key: 'Публикация исследования в наших соцсетях',
    label: 'Публикация исследования',
    kind: 'share',
    prompt:
      '📣 Мы проводим исследование по вашей нише и записываем разбор.\n\n' +
      'Готовы ли вы, чтобы мы поделились записью этого исследования ' +
      'в социальных сетях агентства К.Л.А.Ц?',
  },
];

const CONSENT = -1; // шаг согласия на обработку ПДн
const CONFIRM = STEPS.length; // виртуальный шаг «проверьте и отправьте»

// ─────────────────────────────────────────────────────────────────────────────
// Точка входа
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/webhook') {
      return new Response('Not found', { status: 404 });
    }
    // Telegram подписывает запросы секретом, который мы передали в setWebhook
    if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    try {
      if (update.message) await onMessage(env, update.message);
      else if (update.callback_query) await onCallback(env, update.callback_query);
    } catch (e) {
      // Отвечаем 200, чтобы Telegram не ретраил один и тот же апдейт бесконечно
      console.error('update failed', e);
    }
    return new Response('ok');
  },

  // Cron: напоминание о незавершённом брифе спустя 12 часов тишины
  async scheduled(event, env) {
    let cursor;
    do {
      const page = await env.BRIEF_KV.list({ prefix: 'user:', cursor });
      for (const { name } of page.keys) {
        const state = await kvGet(env, name);
        if (!state || state.completed || state.reminded || state.step === CONSENT) continue;
        if (Date.now() - (state.last_activity || 0) < REMIND_AFTER_MS) continue;
        await tg(env, 'sendMessage', {
          chat_id: state.chat_id,
          text:
            '👋 Похоже, вы начали заполнять бриф, но не закончили.\n\n' +
            'Все ваши ответы сохранены — можно продолжить с того же места. ' +
            'Просто ответьте на последний вопрос или нажмите /start.\n\n' +
            'Чем быстрее заполним бриф, тем быстрее подготовим для вас стратегию 🙂',
        }).catch(() => {});
        state.reminded = true;
        await kvPut(env, name, state);
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Обработка сообщений
// ─────────────────────────────────────────────────────────────────────────────

async function onMessage(env, msg) {
  if (!msg.chat || msg.chat.type !== 'private') return;
  const chatId = msg.chat.id;
  let state = await getState(env, chatId);

  // Команды
  const text = (msg.text || '').trim();
  if (text === '/start') return onStart(env, chatId, msg.from, state);
  if (text === '/edit') return showEditMenu(env, chatId, state);
  if (text === '/help') {
    return send(env, chatId,
      'Я бот агентства <b>К.Л.А.Ц</b> — помогаю заполнить бриф перед стартом работы.\n\n' +
      '/start — начать или продолжить заполнение\n' +
      '/edit — изменить уже заполненные ответы\n\n' +
      'Все ответы сохраняются автоматически: если закроете чат, ' +
      'сможете продолжить с того же места.');
  }

  if (!state) return onStart(env, chatId, msg.from, null);

  if (state.completed) {
    return send(env, chatId,
      '✅ Ваш бриф уже отправлен, спасибо! Менеджер свяжется с вами.\n\n' +
      'Если нужно что-то дополнить — напишите менеджеру напрямую ' +
      'или начните бриф заново командой /start.');
  }

  // До согласия на обработку ПДн ответы не принимаем
  if (state.step === CONSENT) return askConsent(env, chatId);

  if (state.step === CONFIRM) {
    return showSummary(env, chatId, state);
  }

  const step = STEPS[state.step];
  const answer = extractAnswer(step, msg);
  if (answer === null) {
    return send(env, chatId, invalidAnswerHint(step));
  }

  if (step.kind === 'files') {
    // Файлы копим до кнопки «Готово»
    if (answer.file) {
      state.logos.push(answer.file);
      await touchAndSave(env, state);
      return send(env, chatId,
        `📎 Принято (всего: ${state.logos.length}). Пришлите ещё или нажмите «Готово».`,
        filesKeyboard());
    }
    // Текст на шаге файлов — например, ссылка на диск
    state.logos_note = ((state.logos_note || '') + '\n' + answer.text).trim();
    await touchAndSave(env, state);
    return send(env, chatId,
      '📝 Записал. Можно прикрепить файлы или нажать «Готово».', filesKeyboard());
  }

  state.answers[step.key] = answer.text;
  await advance(env, state);
}

// /start: новый бриф или возврат к незавершённому
async function onStart(env, chatId, from, state) {
  if (state && !state.completed && state.step !== CONSENT) {
    const stepNo = Math.min(state.step + 1, STEPS.length);
    return send(env, chatId,
      `👋 С возвращением! Вы остановились на шаге <b>${stepNo} из ${STEPS.length}</b>. ` +
      'Все предыдущие ответы сохранены.',
      { inline_keyboard: [
        [{ text: '▶️ Продолжить', callback_data: 'resume' }],
        [{ text: '✏️ Изменить ответы', callback_data: 'editmenu' }],
        [{ text: '🔄 Начать заново', callback_data: 'restart' }],
      ] });
  }
  if (state && state.completed) {
    return send(env, chatId,
      '✅ Ваш бриф уже отправлен. Хотите заполнить заново?',
      { inline_keyboard: [[{ text: '🔄 Заполнить заново', callback_data: 'restart' }]] });
  }

  state = newState(chatId, from);
  await touchAndSave(env, state);
  await send(env, chatId,
    'Здравствуйте! 👋\n\n' +
    'Это бот маркетингового агентства <b>К.Л.А.Ц</b>. ' +
    'Здесь вы заполните бриф — он нужен, чтобы мы глубоко разобрались ' +
    `в вашем бизнесе и подготовили рабочую стратегию. Всего ${STEPS.length} коротких шагов, ` +
    'это займёт 10–15 минут.\n\n' +
    '💾 Ответы сохраняются автоматически: если отвлечётесь — ' +
    'продолжите с того же места.\n' +
    '✏️ Любой ответ можно изменить командой /edit.');
  return askConsent(env, chatId);
}

async function askConsent(env, chatId) {
  return send(env, chatId,
    '📄 <b>Прежде чем начать</b>\n\n' +
    'Нажимая «Принимаю», вы:\n' +
    `• даёте согласие на обработку персональных данных в соответствии со ст. 9 152-ФЗ (<a href="${PRIVACY_URL}">политика конфиденциальности</a>);\n` +
    '• соглашаетесь с условиями работы с агентством К.Л.А.Ц: данные брифа ' +
    'используются только для подготовки маркетинговой стратегии и не передаются третьим лицам.',
    { inline_keyboard: [
      [{ text: '✅ Принимаю', callback_data: 'consent:yes' }],
      [{ text: '❌ Не принимаю', callback_data: 'consent:no' }],
    ] });
}

// ─────────────────────────────────────────────────────────────────────────────
// Обработка нажатий на кнопки
// ─────────────────────────────────────────────────────────────────────────────

async function onCallback(env, cq) {
  const chatId = cq.message && cq.message.chat.id;
  await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id }).catch(() => {});
  if (!chatId) return;

  let state = await getState(env, chatId);
  const data = cq.data || '';

  if (data === 'restart') {
    state = newState(chatId, cq.from);
    await touchAndSave(env, state);
    return askConsent(env, chatId);
  }
  if (!state) return onStart(env, chatId, cq.from, null);

  if (data === 'consent:yes') {
    if (state.step !== CONSENT) return;
    state.consent_at = new Date().toISOString();
    state.step = 0;
    await touchAndSave(env, state);
    await send(env, chatId, '✅ Спасибо! Согласие зафиксировано. Начинаем.');
    return askStep(env, state);
  }
  if (data === 'consent:no') {
    return send(env, chatId,
      'Понимаю. Но без согласия на обработку данных мы, к сожалению, ' +
      'не можем принять бриф — в нём есть ваши контакты.\n\n' +
      'Если передумаете — нажмите /start. Вопросы по обработке данных ' +
      'можно задать менеджеру.');
  }

  if (state.completed) {
    return send(env, chatId, '✅ Бриф уже отправлен. Начать заново — /start.');
  }

  if (data === 'resume') return askStep(env, state);
  if (data === 'editmenu') return showEditMenu(env, chatId, state);

  if (data.startsWith('edit:')) {
    const idx = parseInt(data.slice(5), 10);
    if (isNaN(idx) || idx < 0 || idx >= STEPS.length || idx > state.max_step) return;
    state.return_step = state.step;
    state.step = idx;
    await touchAndSave(env, state);
    return askStep(env, state, true);
  }

  if (data === 'logos:done' || data === 'logos:skip') {
    if (state.step >= STEPS.length || STEPS[state.step].kind !== 'files') return;
    const step = STEPS[state.step];
    const parts = [];
    if (state.logos.length) parts.push(`Файлов загружено: ${state.logos.length}`);
    if (state.logos_note) parts.push(state.logos_note);
    state.answers[step.key] = parts.join('\n') ||
      (data === 'logos:skip' ? 'Пропущено (логотипов нет)' : 'Готово (без файлов)');
    return advance(env, state);
  }

  if (data === 'ch:no') {
    if (state.step >= STEPS.length || STEPS[state.step].kind !== 'channel') return;
    state.answers[STEPS[state.step].key] = 'Не использовали';
    return advance(env, state);
  }

  if (data.startsWith('share:')) {
    if (state.step >= STEPS.length || STEPS[state.step].kind !== 'share') return;
    const map = { yes: 'Да, готов(а)', no: 'Нет', talk: 'Обсудим отдельно' };
    state.answers[STEPS[state.step].key] = map[data.slice(6)] || data.slice(6);
    return advance(env, state);
  }

  if (data === 'send') {
    if (state.step !== CONFIRM) return;
    return submitBrief(env, state);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Движение по шагам
// ─────────────────────────────────────────────────────────────────────────────

// Сохранить ответ текущего шага и перейти дальше (учитывая режим редактирования)
async function advance(env, state) {
  if (state.return_step != null && state.step < state.return_step) {
    // Редактировали старый шаг — возвращаемся туда, где остановились
    state.step = state.return_step;
    state.return_step = null;
    await touchAndSave(env, state);
    await send(env, state.chat_id, '✅ Ответ обновлён. Возвращаемся к текущему шагу.');
    return askStep(env, state);
  }
  state.return_step = null;
  state.step += 1;
  state.max_step = Math.max(state.max_step, state.step);
  await touchAndSave(env, state);
  return askStep(env, state);
}

// Задать вопрос текущего шага
async function askStep(env, state, editing = false) {
  const chatId = state.chat_id;
  if (state.step >= CONFIRM) return showSummary(env, chatId, state);

  const step = STEPS[state.step];
  const head = editing
    ? `✏️ <b>Изменение ответа: ${esc(step.label)}</b>`
    : `<b>Шаг ${state.step + 1} из ${STEPS.length}</b>`;
  const prev = state.answers[step.key];
  const prevNote = editing && prev ? `\n\nТекущий ответ:\n<i>${esc(prev)}</i>` : '';

  if (step.kind === 'phone') {
    // Кнопка «поделиться контактом» — это reply-клавиатура, не inline
    return tg(env, 'sendMessage', {
      chat_id: chatId,
      text: `${head}\n\n${step.prompt}${prevNote}`,
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [[{ text: '📲 Отправить мой контакт', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  let kb = null;
  if (step.kind === 'files') kb = filesKeyboard();
  if (step.kind === 'channel') {
    kb = { inline_keyboard: [[{ text: '➖ Не использовали', callback_data: 'ch:no' }]] };
  }
  if (step.kind === 'share') {
    kb = { inline_keyboard: [
      [{ text: '✅ Да, готов(а)', callback_data: 'share:yes' }],
      [{ text: '🤔 Обсудим отдельно', callback_data: 'share:talk' }],
      [{ text: '❌ Нет', callback_data: 'share:no' }],
    ] };
  }
  return send(env, chatId, `${head}\n\n${step.prompt}${prevNote}`, kb);
}

function filesKeyboard() {
  return { inline_keyboard: [
    [{ text: '✅ Готово', callback_data: 'logos:done' }],
    [{ text: '⏭ Пропустить', callback_data: 'logos:skip' }],
  ] };
}

// Меню «изменить ответы»: кнопка на каждый уже пройденный шаг
async function showEditMenu(env, chatId, state) {
  if (!state || state.step === CONSENT) {
    return send(env, chatId, 'Сначала начните заполнение брифа: /start');
  }
  if (state.completed) {
    return send(env, chatId, '✅ Бриф уже отправлен. Начать заново — /start.');
  }
  const last = Math.min(state.max_step, STEPS.length - 1);
  const rows = [];
  for (let i = 0; i <= last; i += 2) {
    const row = [{ text: `${i + 1}. ${STEPS[i].label}`, callback_data: `edit:${i}` }];
    if (i + 1 <= last) {
      row.push({ text: `${i + 2}. ${STEPS[i + 1].label}`, callback_data: `edit:${i + 1}` });
    }
    rows.push(row);
  }
  rows.push([{ text: '▶️ Продолжить заполнение', callback_data: 'resume' }]);
  return send(env, chatId,
    '✏️ Выберите шаг, который хотите изменить:', { inline_keyboard: rows });
}

// ─────────────────────────────────────────────────────────────────────────────
// Разбор ответов
// ─────────────────────────────────────────────────────────────────────────────

// Вернуть {text} или {file} из сообщения, либо null если ответ не подходит
function extractAnswer(step, msg) {
  const text = (msg.text || msg.caption || '').trim();

  if (step.kind === 'files') {
    if (msg.photo && msg.photo.length) {
      const best = msg.photo[msg.photo.length - 1];
      return { file: { type: 'photo', file_id: best.file_id } };
    }
    if (msg.document) {
      return { file: {
        type: 'document',
        file_id: msg.document.file_id,
        name: msg.document.file_name || '',
      } };
    }
    return text ? { text } : null;
  }

  if (step.kind === 'phone') {
    if (msg.contact && msg.contact.phone_number) {
      return { text: msg.contact.phone_number };
    }
    const digits = text.replace(/\D/g, '');
    return digits.length >= 10 ? { text } : null;
  }

  if (step.kind === 'email') {
    return /^\S+@\S+\.\S+$/.test(text) ? { text } : null;
  }

  // text / channel / share — принимаем любой непустой текст
  return text ? { text } : null;
}

function invalidAnswerHint(step) {
  switch (step.kind) {
    case 'phone':
      return 'Не похоже на номер телефона 🤔 Напишите номер с кодом ' +
             '(например, +7 900 123-45-67) или нажмите кнопку «Отправить мой контакт».';
    case 'email':
      return 'Не похоже на e-mail 🤔 Напишите адрес в формате name@example.ru.';
    case 'files':
      return 'Прикрепите картинку или файл, пришлите ссылку на диск, ' +
             'либо нажмите «Готово» / «Пропустить».';
    default:
      return 'Напишите, пожалуйста, ответ текстом 🙂';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Сводка и отправка брифа
// ─────────────────────────────────────────────────────────────────────────────

function buildSummary(state, forAdmin) {
  const lines = [];
  if (forAdmin) {
    const u = state.username ? `@${state.username}` : '—';
    lines.push('🆕 <b>Новый бриф К.Л.А.Ц</b>');
    lines.push(`Telegram: ${u} (id ${state.chat_id}, ${esc(state.tg_name || '')})`);
    lines.push(`Согласие на обработку ПДн: ${state.consent_at}`);
    lines.push('');
  }
  for (const step of STEPS) {
    const a = state.answers[step.key];
    lines.push(`<b>${esc(step.key)}</b>`);
    lines.push(a ? esc(a) : '—');
    lines.push('');
  }
  if (state.logos.length) {
    lines.push(`📎 Логотипы/файлы: ${state.logos.length} шт.` +
      (forAdmin ? ' (отправлены отдельными сообщениями ниже)' : ''));
  }
  return lines.join('\n');
}

async function showSummary(env, chatId, state) {
  await send(env, chatId,
    '🏁 <b>Почти готово!</b> Проверьте ваши ответы:');
  await sendLong(env, chatId, buildSummary(state, false));
  return send(env, chatId, 'Всё верно?', { inline_keyboard: [
    [{ text: '✅ Отправить бриф', callback_data: 'send' }],
    [{ text: '✏️ Изменить ответ', callback_data: 'editmenu' }],
  ] });
}

async function submitBrief(env, state) {
  // Бриф — менеджеру
  await sendLong(env, env.ADMIN_CHAT_ID, buildSummary(state, true));
  for (const f of state.logos) {
    const method = f.type === 'photo' ? 'sendPhoto' : 'sendDocument';
    const params = { chat_id: env.ADMIN_CHAT_ID };
    params[f.type === 'photo' ? 'photo' : 'document'] = f.file_id;
    await tg(env, method, params).catch((e) => console.error('logo send failed', e));
  }

  state.completed = true;
  state.completed_at = new Date().toISOString();
  await touchAndSave(env, state);

  return send(env, state.chat_id,
    '🎉 <b>Бриф отправлен, спасибо!</b>\n\n' +
    'Мы внимательно изучим ответы, проведём исследование вашей ниши ' +
    'и вернёмся со стратегией. Менеджер свяжется с вами в ближайшее время.\n\n' +
    'Хорошего дня! 🚀');
}

// ─────────────────────────────────────────────────────────────────────────────
// Состояние в KV
// ─────────────────────────────────────────────────────────────────────────────

function newState(chatId, from) {
  return {
    chat_id: chatId,
    username: (from && from.username) || '',
    tg_name: from ? [from.first_name, from.last_name].filter(Boolean).join(' ') : '',
    step: CONSENT,
    max_step: 0,
    return_step: null,
    answers: {},
    logos: [],
    logos_note: '',
    consent_at: null,
    completed: false,
    reminded: false,
    last_activity: Date.now(),
  };
}

async function getState(env, chatId) {
  return kvGet(env, `user:${chatId}`);
}

async function kvGet(env, key) {
  const raw = await env.BRIEF_KV.get(key);
  return raw ? JSON.parse(raw) : null;
}

async function kvPut(env, key, state) {
  await env.BRIEF_KV.put(key, JSON.stringify(state));
}

// Любая активность клиента сбрасывает таймер напоминания
async function touchAndSave(env, state) {
  state.last_activity = Date.now();
  state.reminded = false;
  await kvPut(env, `user:${state.chat_id}`, state);
}

// ─────────────────────────────────────────────────────────────────────────────
// Telegram API
// ─────────────────────────────────────────────────────────────────────────────

async function tg(env, method, params) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data.result;
}

function send(env, chatId, text, inlineKeyboard) {
  const params = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    // Убираем reply-клавиатуру (кнопку контакта), если inline-кнопок нет
    reply_markup: inlineKeyboard || { remove_keyboard: true },
  };
  return tg(env, 'sendMessage', params);
}

// Telegram ограничивает сообщение 4096 символами — режем по строкам
async function sendLong(env, chatId, text) {
  const LIMIT = 3800;
  let chunk = '';
  for (const line of text.split('\n')) {
    if (chunk.length + line.length + 1 > LIMIT) {
      await send(env, chatId, chunk);
      chunk = '';
    }
    chunk += (chunk ? '\n' : '') + line;
  }
  if (chunk) await send(env, chatId, chunk);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
