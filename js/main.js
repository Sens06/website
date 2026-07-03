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

  /* ── Форма заявки: способ связи + валидация формата ──
     Этап 5: реальная отправка (Telegram-бот) и проверка существования контакта
     (TG/VK login, валидный телефон) — это требует сервера/бота, на статике невозможно. */
  const form = document.getElementById('contact-form');
  if (form) {
    const nameInput = document.getElementById('field-name');
    const methodSel = document.getElementById('field-method');
    const contactInput = document.getElementById('field-contact');
    const contactLabel = document.getElementById('label-contact');
    const consent = document.getElementById('field-consent');

    const METHODS = {
      telegram: {
        label: 'Telegram',
        placeholder: '@username',
        pattern: /^@?[a-zA-Z0-9_]{5,32}$/,
        error: 'Ник в формате @username (5–32 символа: латиница, цифры, _).'
      },
      phone: {
        label: 'Телефон',
        placeholder: '+7 900 000-00-00',
        pattern: /^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/,
        error: 'Номер в формате +7 900 000-00-00.'
      },
      vk: {
        label: 'VK',
        placeholder: 'vk.com/username',
        pattern: /^(https?:\/\/)?(www\.)?vk\.com\/[a-zA-Z0-9_.]{2,}$|^[a-zA-Z0-9_.]{2,}$/,
        error: 'Ссылка vk.com/... или логин профиля.'
      }
    };

    function setError(field, msg) {
      const el = document.getElementById('error-' + field);
      if (el) el.textContent = msg || '';
    }

    function currentMethod() {
      return METHODS[methodSel.value];
    }

    methodSel.addEventListener('change', function () {
      const m = currentMethod();
      if (m) {
        contactInput.disabled = false;
        contactInput.placeholder = m.placeholder;
        contactLabel.textContent = 'Контакт (' + m.label + ')';
      } else {
        contactInput.disabled = true;
        contactInput.value = '';
        contactInput.placeholder = 'Сначала выберите способ связи';
        contactLabel.textContent = 'Контакт';
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

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;

      const submitBtn = form.querySelector('.btn-submit');
      const originalText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';
      }

      /* Заглушка до этапа 5 (реальная отправка в Telegram-бот) */
      setTimeout(function () {
        if (submitBtn) {
          submitBtn.textContent = 'Заявка отправлена';
          submitBtn.style.backgroundColor = '#2a7a4a';
        }
        setTimeout(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            submitBtn.style.backgroundColor = '';
          }
          form.reset();
          contactInput.disabled = true;
          contactInput.placeholder = 'Сначала выберите способ связи';
          contactLabel.textContent = 'Контакт';
        }, 4000);
      }, 800);
    });
  }

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

  /* ── Лайтбокс для скринов кейсов ── */
  const figImgs = document.querySelectorAll('.case-figure img');
  if (figImgs.length) {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<button type="button" class="lightbox-close" aria-label="Закрыть">&times;</button><img alt="">';
    document.body.appendChild(lb);

    const lbImg = lb.querySelector('img');
    const lbClose = lb.querySelector('.lightbox-close');
    let lastFocus = null;

    function openLb(src, alt) {
      lbImg.src = src;
      lbImg.alt = alt || '';
      lastFocus = document.activeElement;
      lb.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      lbClose.focus();
    }

    function closeLb() {
      lb.classList.remove('is-open');
      document.body.style.overflow = '';
      lbImg.removeAttribute('src');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    figImgs.forEach(function (img) {
      img.addEventListener('click', function () {
        openLb(img.currentSrc || img.src, img.alt);
      });
    });

    lbClose.addEventListener('click', closeLb);
    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLb();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb.classList.contains('is-open')) closeLb();
    });
  }

})();
