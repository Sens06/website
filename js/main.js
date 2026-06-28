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

  /* ── Модалка кейса ── */
  const caseModal = document.getElementById('case-modal');
  const caseModalBody = document.getElementById('case-modal-body');
  const caseCards = document.querySelectorAll('.card--case');
  let lastCaseFocus = null;

  function openCaseModal(card) {
    if (!caseModal || !caseModalBody) return;
    const full = card.querySelector('.case-full');
    caseModalBody.innerHTML = '';
    if (full && full.content) {
      caseModalBody.appendChild(full.content.cloneNode(true));
    }
    lastCaseFocus = document.activeElement;
    caseModal.classList.add('is-open');
    const closeBtn = caseModal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeCaseModal() {
    if (!caseModal) return;
    caseModal.classList.remove('is-open');
    if (lastCaseFocus && lastCaseFocus.focus) lastCaseFocus.focus();
  }

  caseCards.forEach(function (card) {
    card.addEventListener('click', function () {
      openCaseModal(card);
    });
  });

  if (caseModal) {
    caseModal.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', closeCaseModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && caseModal.classList.contains('is-open')) {
        closeCaseModal();
      }
    });
  }

})();
