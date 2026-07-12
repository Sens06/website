/**
 * К.Л.А.Ц — main.js
 * Vanilla JS: бургер-меню, плавная прокрутка, sticky-шапка
 */

(function () {
  'use strict';

  /* ── DOM-элементы ── */
  const burger  = document.getElementById('burger');
  const nav     = document.getElementById('main-nav');
  const header  = document.querySelector('.site-header');
  const navLinks = nav ? nav.querySelectorAll('a') : [];

  /* ── Цели Яндекс.Метрики ───────────────────────────────────────────────────
     Сайт отправляет события; цели с такими же идентификаторами заведены в кабинете
     (тип «JS-событие», создаются скриптом yandex-direct/monitor/metrika_goals.py).

     Воронка заявки:
       form_view        — долистал до формы
       form_open        — открыл форму в поп-апе
       form_start       — начал заполнять
       form_submit      — отправил заявку (успех)
       lead_lp / lead_case / lead_main — заявка с посадочной / кейса / главной

     Вовлечённость:
       case_open        — открыл кейс в поп-апе
       shot_zoom        — увеличил скриншот
       phone_click      — клик по номеру телефона
       messenger_click  — клик в Telegram / WhatsApp

     Параметром уходит form_source (какая кнопка) и page_group (тип страницы) —
     их видно в отчёте по цели. Заявка дополнительно ловится целью на URL «Спасибо». */
  const METRIKA_ID = 110373071;

  function reachGoal(name, params) {
    if (typeof window.ym !== 'function') return;   /* Метрика могла не загрузиться */
    try { window.ym(METRIKA_ID, 'reachGoal', name, params || undefined); } catch (e) {}
  }

  /* Группа страницы — чтобы отличать заявки с посадочных, кейсов и главной.
     Метрика не видит form_source (он уходит в воркер), поэтому передаём сами. */
  function pageGroup() {
    if (/\/lp\//.test(location.pathname)) return 'lp';
    if (/\/cases\//.test(location.pathname)) return 'case';
    return 'main';
  }

  /* ── Бургер-меню ── */
  function openMenu() {
    burger.classList.add('is-open');
    nav.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    burger.classList.remove('is-open');
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  function toggleMenu() {
    const isOpen = burger.classList.contains('is-open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  if (burger && nav) {
    burger.addEventListener('click', toggleMenu);

    /* Закрыть при клике на ссылку меню */
    navLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        if (nav.classList.contains('is-open')) {
          closeMenu();
        }
      });
    });

    /* Закрыть при клике вне меню */
    document.addEventListener('click', function (e) {
      if (
        nav.classList.contains('is-open') &&
        !nav.contains(e.target) &&
        !burger.contains(e.target)
      ) {
        closeMenu();
      }
    });

    /* Закрыть по Escape */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        closeMenu();
        burger.focus();
      }
    });
  }

  /* ── Плавная прокрутка по якорям ── */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      /* pop-up кнопки не скроллят к якорю — их обрабатывает форма */
      if (link.hasAttribute('data-popup')) return;

      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      const headerH = header ? header.offsetHeight : 64;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - headerH;

      window.scrollTo({
        top: targetTop,
        behavior: 'smooth'
      });
    });
  });

  /* ── Формы заявки: инлайн + pop-up, пометка источника (form_source) + UTM ──
     Реальная отправка в Telegram-бот / CRM — этап интеграций. Сейчас собираем
     payload (поля + form_source + UTM + URL страницы) и показываем подтверждение. */
  const METHODS = {
    telegram: {
      label: 'Telegram',
      placeholder: '@username',
      prefix: '@',
      pattern: /^@?[a-zA-Z0-9_]{5,32}$/,
      error: 'Ник в формате @username (5–32 символа: латиница, цифры, _).'
    },
    phone: {
      label: 'Телефон',
      placeholder: '+7 900 000-00-00',
      prefix: '',
      pattern: /^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/,
      error: 'Номер в формате +7 900 000-00-00.'
    },
    vk: {
      label: 'VK',
      placeholder: 'vk.com/username',
      prefix: 'vk.com/',
      pattern: /^(https?:\/\/)?(www\.)?vk\.com\/[a-zA-Z0-9_.]{2,}$|^[a-zA-Z0-9_.]{2,}$/,
      error: 'Ссылка vk.com/... или логин профиля.'
    }
  };

  function getUTM() {
    const p = new URLSearchParams(location.search);
    const out = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      const v = p.get(k);
      if (v) out[k] = v;
    });
    return out;
  }

  /* Страницы в подпапках (cases/, lp/) лежат на уровень глубже — им нужен ../ */
  const isSubPage = /\/(cases|lp)\//.test(location.pathname);

  /* Страница «Спасибо» (для цели в Метрике) */
  const thankYouHref = isSubPage ? '../spasibo.html' : 'spasibo.html';

  function initContactForm(form, getSource, onAfterReset) {
    const methodSel = form.querySelector('[name="method"]');
    const contactInput = form.querySelector('[name="contact"]');
    const nameInput = form.querySelector('[name="name"]');
    const consent = form.querySelector('[name="consent"]');
    const contactField = contactInput.closest('.form-field');
    const contactLabel = contactField ? contactField.querySelector('label') : null;

    function setError(field, msg) {
      const el = form.querySelector('.field-error[data-for="' + field + '"]') || document.getElementById('error-' + field);
      if (el) el.textContent = msg || '';
    }
    function currentMethod() { return METHODS[methodSel.value]; }
    function resetContact() {
      contactInput.disabled = true;
      contactInput.placeholder = 'Сначала выберите способ связи';
      if (contactLabel) contactLabel.textContent = 'Контакт';
    }

    methodSel.addEventListener('change', function () {
      const m = currentMethod();
      if (m) {
        contactInput.disabled = false;
        contactInput.placeholder = m.placeholder;
        if (contactLabel) contactLabel.textContent = 'Контакт (' + m.label + ')';
        contactInput.value = m.prefix || '';
        try {
          contactInput.focus();
          const len = contactInput.value.length;
          contactInput.setSelectionRange(len, len);
        } catch (e) {}
      } else {
        contactInput.value = '';
        resetContact();
      }
      setError('method', '');
      setError('contact', '');
    });

    function validate() {
      let ok = true;
      if (!nameInput.value.trim()) { setError('name', 'Укажите имя.'); ok = false; } else { setError('name', ''); }
      const m = currentMethod();
      if (!m) { setError('method', 'Выберите способ связи.'); ok = false; } else { setError('method', ''); }
      if (m) {
        const val = contactInput.value.trim();
        if (!val) { setError('contact', 'Заполните контакт.'); ok = false; }
        else if (!m.pattern.test(val)) { setError('contact', m.error); ok = false; }
        else { setError('contact', ''); }
      }
      if (!consent.checked) { setError('consent', 'Нужно согласие на обработку персональных данных.'); ok = false; } else { setError('consent', ''); }
      return ok;
    }

    function val(name) {
      const el = form.querySelector('[name="' + name + '"]');
      return el ? el.value.trim() : '';
    }

    /* Начал заполнять форму — считаем один раз, показывает реальный интерес */
    let started = false;
    form.addEventListener('input', function () {
      if (started) return;
      started = true;
      reachGoal('form_start', { page_group: pageGroup() });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;

      /* На посадочных ниша известна заранее, а у пользователя спрашиваем только город.
         Префикс из data-niche-prefix склеивается с полем, чтобы в CRM пришло
         «Натяжные потолки, Краснодар», а не просто «Краснодар». */
      const nichePrefix = form.getAttribute('data-niche-prefix') || '';
      const nicheValue = (nichePrefix + val('niche')).trim();

      const data = {
        name: val('name'),
        niche: nicheValue,
        method: methodSel.value,
        contact: contactInput.value.trim(),
        comment: val('comment'),
        form_source: (getSource && getSource()) || 'unknown',
        page_url: location.href
      };
      const utm = getUTM();
      for (const k in utm) { data[k] = utm[k]; }

      const submitBtn = form.querySelector('.btn-submit');
      const originalText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Отправка...'; }

      fetch('https://clatz-lead.clatz.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      .then(function (res) {
        if (!res.ok) throw new Error('bad status ' + res.status);
        return res.json();
      })
      .then(function (result) {
        if (!result || !result.ok) throw new Error('worker not ok');
        const src = data.form_source;
        reachGoal('form_submit', { form_source: src, page_group: pageGroup() });
        reachGoal('lead_' + pageGroup(), { form_source: src });
        /* Успех → переадресация на страницу «Спасибо» (там цель в Метрике) */
        window.location.href = thankYouHref;
      })
      .catch(function (err) {
        if (window.console) console.error('Ошибка отправки заявки:', err);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Ошибка, попробуйте ещё раз';
          submitBtn.style.backgroundColor = '';
        }
      });
    });
  }

  /* Инлайн-форма (главная, посадочные). Источник — из data-source, иначе main_form */
  const inlineForm = document.getElementById('contact-form');
  if (inlineForm) {
    initContactForm(inlineForm, function () {
      return inlineForm.getAttribute('data-source') || 'main_form';
    });
  }

  /* Pop-up форма (на всех страницах) */
  (function () {
    const triggers = document.querySelectorAll('[data-popup]');
    if (!triggers.length) return;

    const privacyHref = isSubPage ? '../privacy.html' : 'privacy.html';

    const modal = document.createElement('div');
    modal.className = 'form-modal';
    modal.innerHTML =
      '<div class="form-modal-dialog" role="dialog" aria-modal="true" aria-label="Заявка на экспресс-аудит">' +
        '<button type="button" class="form-modal-close" aria-label="Закрыть">&times;</button>' +
        '<h2 class="h-emboss">Получите бесплатный экспресс-аудит</h2>' +
        '<p class="section-sub form-modal-sub">Разберём вашу рекламу или нишу и покажем точки роста.</p>' +
        '<form class="contact-form" novalidate>' +
          '<div class="form-row">' +
            '<div class="form-field"><label>Имя</label><input type="text" class="ym-disable-keys" name="name" placeholder="Ваше имя" autocomplete="given-name" required><span class="field-error" data-for="name" role="alert"></span></div>' +
            '<div class="form-field"><label>Ниша бизнеса</label><input type="text" class="ym-disable-keys" name="niche" placeholder="Например: строительство, e-commerce"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-field"><label>Удобный способ связи</label><select name="method" required><option value="" selected disabled>Выберите способ</option><option value="telegram">Telegram</option><option value="phone">Телефон</option><option value="vk">VK</option></select><span class="field-error" data-for="method" role="alert"></span></div>' +
            '<div class="form-field"><label>Контакт</label><input type="text" class="ym-disable-keys" name="contact" placeholder="Сначала выберите способ связи" disabled required><span class="field-error" data-for="contact" role="alert"></span></div>' +
          '</div>' +
          '<div class="form-field form-field--full"><label>Комментарий <span class="field-optional">(необязательно)</span></label><textarea class="ym-disable-keys" name="comment" rows="4" placeholder="Расскажите о задаче, бюджете или текущей рекламе"></textarea></div>' +
          '<div class="form-consent"><input type="checkbox" name="consent" required id="pf-consent"><label for="pf-consent">Я даю согласие на обработку персональных данных и принимаю <a href="' + privacyHref + '" target="_blank" rel="noopener noreferrer">политику конфиденциальности</a>.</label></div>' +
          '<span class="field-error" data-for="consent" role="alert"></span>' +
          '<button type="submit" class="btn btn-cta btn-submit">Получить экспресс-аудит</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(modal);

    let popupSource = 'popup';
    let lastFocus = null;
    const closeBtn = modal.querySelector('.form-modal-close');
    const popupForm = modal.querySelector('form');

    function closeModal() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    initContactForm(popupForm, function () { return popupSource; }, closeModal);

    function openModal(source) {
      popupSource = source || 'popup';
      reachGoal('form_open', { form_source: popupSource, page_group: pageGroup() });
      lastFocus = document.activeElement;
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      const first = popupForm.querySelector('[name="name"]');
      if (first) first.focus();
    }

    /* Делегирование: ловим и кнопки, которые появились позже
       (например, внутри кейса, подгруженного в pop-up). */
    document.addEventListener('click', function (e) {
      const t = e.target.closest ? e.target.closest('[data-popup]') : null;
      if (!t) return;
      e.preventDefault();

      /* Если кнопка внутри модалки кейса — сначала закрываем кейс */
      const caseModal = t.closest('.case-modal');
      if (caseModal) {
        caseModal.classList.remove('is-open');
      }

      openModal(t.getAttribute('data-source') || 'popup');
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
  })();

  /* ── Активная ссылка навигации при скролле (IntersectionObserver) ── */
  const sections = document.querySelectorAll('section[id], header[id]');

  if ('IntersectionObserver' in window && sections.length) {
    const observerOptions = {
      root: null,
      rootMargin: '-60px 0px -50% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        const id = entry.target.getAttribute('id');
        navLinks.forEach(function (link) {
          link.classList.remove('nav-active');
          const href = link.getAttribute('href');
          if (href === '#' + id) {
            link.classList.add('nav-active');
          }
        });
      });
    }, observerOptions);

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  /* ── Кейсы: барабан ── */
  const drum = document.getElementById('cases-drum');
  if (drum) {
    const track = drum.querySelector('.drum-track');
    const cards = Array.prototype.slice.call(track.querySelectorAll('.drum-card'));
    const upBtn = drum.querySelector('.drum-btn--up');
    const downBtn = drum.querySelector('.drum-btn--down');
    const dotsBox = drum.querySelector('.drum-dots');
    const n = cards.length;
    let active = 0;

    /* автопрокрутка ставится на паузу на 40 сек после любого действия пользователя */
    let pauseUntil = 0;
    function markInteraction() { pauseUntil = Date.now() + 40000; }

    /* точки-индикаторы */
    const dots = cards.map(function (_, i) {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'drum-dot';
      d.setAttribute('aria-label', 'Кейс ' + (i + 1));
      d.addEventListener('click', function () { markInteraction(); go(i); });
      if (dotsBox) dotsBox.appendChild(d);
      return d;
    });

    function render() {
      const baseH = cards[0].offsetHeight || 168;
      const step = baseH * 0.66 + 20;
      cards.forEach(function (card, i) {
        let off = i - active;
        if (off > n / 2) off -= n;
        if (off < -n / 2) off += n;
        const abs = Math.abs(off);
        const scale = off === 0 ? 1 : 0.84;
        const opacity = off === 0 ? 1 : (abs === 1 ? 0.4 : 0);
        card.style.transform =
          'translate(-50%, -50%) translateY(' + (off * step) + 'px) scale(' + scale + ')';
        card.style.opacity = opacity;
        card.style.zIndex = String(10 - abs);
        card.style.pointerEvents = abs <= 1 ? 'auto' : 'none';
        card.classList.toggle('is-active', off === 0);
        card.setAttribute('aria-hidden', off === 0 ? 'false' : 'true');
        card.tabIndex = off === 0 ? 0 : -1;
      });
      dots.forEach(function (d, i) { d.classList.toggle('is-on', i === active); });
    }

    function go(i) { active = ((i % n) + n) % n; render(); }
    function next() { go(active + 1); }
    function prev() { go(active - 1); }

    if (upBtn) upBtn.addEventListener('click', function () { markInteraction(); prev(); });
    if (downBtn) downBtn.addEventListener('click', function () { markInteraction(); next(); });

    /* клик по карточке: если не активна — вывести в центр, если активна — перейти */
    cards.forEach(function (card, i) {
      card.addEventListener('click', function (e) {
        markInteraction();
        if (i !== active) { e.preventDefault(); go(i); }
      });
    });

    /* стрелки клавиатуры */
    drum.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp') { e.preventDefault(); markInteraction(); prev(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); markInteraction(); next(); }
    });

    /* свайп / удержание пальцем по вертикали (мобайл) */
    let startY = null;
    track.addEventListener('touchstart', function (e) {
      markInteraction();
      startY = e.touches[0].clientY;
    }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (startY === null) return;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dy) > 40) { if (dy < 0) next(); else prev(); }
      startY = null;
    });

    /* автопрокрутка раз в 5 сек; замирает на 40 сек после взаимодействия */
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      setInterval(function () {
        if (!document.hidden && Date.now() >= pauseUntil) next();
      }, 5000);
    }

    window.addEventListener('resize', render);
    render();
  }

  /* ── Лайтбокс для скринов кейсов и посадочных ──
     Делегирование на document: подхватывает и картинки, которые появились позже
     (например, кейс, подгруженный в pop-up). */
  const SHOT_SELECTOR = '.case-figure img, .lp-shot img';

  if (document.querySelector(SHOT_SELECTOR) || document.querySelector('[data-case-modal]')) {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<button type="button" class="lightbox-close" aria-label="Закрыть">&times;</button><img alt="">';
    document.body.appendChild(lb);

    const lbImg = lb.querySelector('img');
    const lbClose = lb.querySelector('.lightbox-close');
    let lastFocus = null;

    function openLb(src, alt) {
      reachGoal('shot_zoom', { page_group: pageGroup() });
      lbImg.src = src;
      lbImg.alt = alt || '';
      lastFocus = document.activeElement;
      lb.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      lbClose.focus();
    }

    function closeLb() {
      lb.classList.remove('is-open');
      /* Прокрутку страницы возвращаем, только если под лайтбоксом нет открытой модалки */
      if (!document.querySelector('.form-modal.is-open, .case-modal.is-open')) {
        document.body.style.overflow = '';
      }
      lbImg.removeAttribute('src');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    document.addEventListener('click', function (e) {
      const img = e.target.closest ? e.target.closest(SHOT_SELECTOR) : null;
      if (img) openLb(img.currentSrc || img.src, img.alt);
    });

    /* То же с клавиатуры: у скринов на посадочных есть tabindex + role="button" */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const fig = e.target.closest ? e.target.closest('.lp-shot[tabindex]') : null;
      if (!fig) return;
      const img = fig.querySelector('img');
      if (!img) return;
      e.preventDefault();
      openLb(img.currentSrc || img.src, img.alt);
    });

    lbClose.addEventListener('click', closeLb);
    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLb();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb.classList.contains('is-open')) closeLb();
    });
  }

  /* ── Кейс в pop-up (на посадочных): подтягиваем страницу кейса и показываем её
        в модалке, не уводя человека с посадочной. ── */
  (function () {
    const caseTriggers = document.querySelectorAll('[data-case-modal]');
    if (!caseTriggers.length) return;

    const modal = document.createElement('div');
    modal.className = 'case-modal';
    modal.innerHTML =
      '<div class="case-modal-dialog" role="dialog" aria-modal="true" aria-label="Кейс">' +
        '<button type="button" class="case-modal-close" aria-label="Закрыть">&times;</button>' +
        '<div class="case-modal-content"><p class="case-modal-loading">Загружаем кейс…</p></div>' +
      '</div>';
    document.body.appendChild(modal);

    const content = modal.querySelector('.case-modal-content');
    const dialog = modal.querySelector('.case-modal-dialog');
    const closeBtn = modal.querySelector('.case-modal-close');
    const cache = {};
    let lastFocus = null;

    function closeModal() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    /* Хвост кейса в модалке: кнопка закрывает кейс и открывает форму заявки */
    const caseEnd =
      '<div class="case-modal-end">' +
        '<p>Хочешь такой же поток заявок в своём городе? Разберём твою рекламу и посчитаем прогноз — бесплатно.</p>' +
        '<a href="#lp-form" class="btn btn-cta" data-popup data-source="lp_potolki_case_modal">Оставить заявку</a>' +
      '</div>';

    function render(html, withEnd) {
      content.innerHTML = withEnd ? html + caseEnd : html;
      dialog.scrollTop = 0;
    }

    /* Из страницы кейса берём только содержательную часть: обложку, заголовок,
       теги, факты и статью. Шапка, подвал и кнопки «назад» в модалке не нужны. */
    function extract(text) {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const page = doc.querySelector('.case-page .container');
      if (!page) return null;

      page.querySelectorAll('.case-back-top, .case-end').forEach(function (el) {
        el.remove();
      });
      return page.innerHTML;
    }

    caseTriggers.forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        const href = trigger.getAttribute('href');
        if (!href) return;

        reachGoal('case_open', { page_group: pageGroup() });
        lastFocus = document.activeElement;
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        closeBtn.focus();

        if (cache[href]) {
          render(cache[href], true);
          return;
        }

        render('<p class="case-modal-loading">Загружаем кейс…</p>', false);

        fetch(href)
          .then(function (res) {
            if (!res.ok) throw new Error('bad status ' + res.status);
            return res.text();
          })
          .then(function (text) {
            const html = extract(text);
            if (!html) throw new Error('case content not found');
            cache[href] = html;
            render(html, true);
          })
          .catch(function (err) {
            if (window.console) console.error('Не удалось загрузить кейс:', err);
            /* Если подгрузить не вышло — просто уводим на страницу кейса */
            window.location.href = href;
          });
      });
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) {
      /* Esc сначала закрывает лайтбокс поверх модалки, потом саму модалку */
      const lbOpen = document.querySelector('.lightbox.is-open');
      if (e.key === 'Escape' && !lbOpen && modal.classList.contains('is-open')) closeModal();
    });
  })();

  /* ── Уведомление о cookie (первый визит) ── */
  (function () {
    try { if (localStorage.getItem('klac_cookie_ok')) return; } catch (e) {}
    const privacyHref = isSubPage ? '../privacy.html' : 'privacy.html';
    const bar = document.createElement('div');
    bar.className = 'cookie-bar';
    bar.innerHTML =
      '<p>Мы используем cookie и Яндекс.Метрику, чтобы сайт работал лучше. Продолжая пользоваться сайтом, вы соглашаетесь с <a href="' + privacyHref + '">политикой конфиденциальности</a>.</p>' +
      '<button type="button" class="btn btn-cta cookie-ok">Понятно</button>';
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.classList.add('is-show'); });
    bar.querySelector('.cookie-ok').addEventListener('click', function () {
      try { localStorage.setItem('klac_cookie_ok', '1'); } catch (e) {}
      bar.classList.remove('is-show');
      setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 200);
    });
  })();

  /* ── Клики по телефону и мессенджерам → цели Метрики ──
     Делегирование на document: ловит ссылки в шапке, футере, поп-апе и на посадочных. */
  document.addEventListener('click', function (e) {
    const link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) {
      reachGoal('phone_click');
    } else if (/(^|\/\/)(t\.me|wa\.me|api\.whatsapp\.com)/.test(href) ||
               /t\.me\/|wa\.me\//.test(href)) {
      reachGoal('messenger_click');
    }
  });


  /* ── Долистал до формы заявки ──
     Верх воронки: сколько людей вообще дошли до формы. Считаем один раз. */
  (function () {
    const formSection = document.getElementById('lp-form') || document.getElementById('contact');
    if (!formSection || !('IntersectionObserver' in window)) return;

    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reachGoal('form_view', { page_group: pageGroup() });
        obs.disconnect();
      });
    }, { threshold: 0.3 });

    obs.observe(formSection);
  })();

})();
