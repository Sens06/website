/* ============================================================
   Лёгкий JS для лендингов по ботам. Самостоятельный.
   Форма → воркёр clatz-lead, UTM, поп-ап, демо-симулятор чата.
   ============================================================ */
(function () {
  'use strict';

  var LEAD_ENDPOINT = 'https://clatz-lead.clatz.workers.dev';
  var THANKS = 'spasibo2.html';
  var phoneRe = /^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/;

  function ym() { try { if (typeof window.ym === 'function') window.ym.apply(null, arguments); } catch (e) {} }
  function goal(n, p) { ym(110373071, 'reachGoal', n, p || undefined); }

  function getUTM() {
    var p = new URLSearchParams(location.search), out = {};
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function (k) {
      var v = p.get(k); if (v) out[k] = v;
    });
    return out;
  }

  /* Простая маска телефона РФ */
  function maskPhone(input) {
    input.addEventListener('input', function () {
      var d = input.value.replace(/\D/g, '');
      if (d[0] === '8') d = '7' + d.slice(1);
      if (d[0] !== '7') d = '7' + d;
      d = d.slice(0, 11);
      var r = '+7';
      if (d.length > 1) r += ' (' + d.slice(1, 4);
      if (d.length >= 4) r += ') ' + d.slice(4, 7);
      if (d.length >= 7) r += '-' + d.slice(7, 9);
      if (d.length >= 9) r += '-' + d.slice(9, 11);
      input.value = r;
    });
  }

  function initForm(form) {
    var nameEl = form.querySelector('[name="name"]');
    var phoneEl = form.querySelector('[name="phone"]');
    var nicheEl = form.querySelector('[name="niche"]');
    var consentEl = form.querySelector('[name="consent"]');
    if (phoneEl) maskPhone(phoneEl);

    function setErr(field, msg) {
      var el = form.querySelector('.err[data-for="' + field + '"]');
      if (el) el.textContent = msg || '';
    }
    function validate() {
      var ok = true;
      if (!nameEl.value.trim()) { setErr('name', 'Укажите имя.'); ok = false; } else setErr('name', '');
      var ph = (phoneEl.value || '').trim();
      if (!ph) { setErr('phone', 'Укажите телефон.'); ok = false; }
      else if (!phoneRe.test(ph)) { setErr('phone', 'Формат: +7 900 000-00-00.'); ok = false; }
      else setErr('phone', '');
      if (consentEl && !consentEl.checked) { setErr('consent', 'Нужно согласие на обработку данных.'); ok = false; } else setErr('consent', '');
      return ok;
    }

    var started = false;
    form.addEventListener('input', function () { if (!started) { started = true; goal('form_start'); } });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      var prefix = form.getAttribute('data-niche-prefix') || '';
      var niche = (prefix + (nicheEl ? nicheEl.value : '')).trim().replace(/,\s*$/, '');
      var data = {
        name: nameEl.value.trim(),
        niche: niche,
        method: 'phone',
        contact: phoneEl.value.trim(),
        comment: '',
        form_source: form.getAttribute('data-source') || 'ai_lp',
        page_url: location.href
      };
      var utm = getUTM(); for (var k in utm) data[k] = utm[k];

      var btn = form.querySelector('[type="submit"]');
      var txt = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Отправка…'; }

      fetch(LEAD_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      })
      .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error('worker not ok');
        goal('form_submit', { form_source: data.form_source });
        window.location.href = THANKS;
      })
      .catch(function (err) {
        if (window.console) console.error('Ошибка отправки:', err);
        if (btn) { btn.disabled = false; btn.textContent = 'Ошибка, попробуйте ещё раз'; }
      });
    });
  }

  /* Поп-ап: [data-pop] открывает, переносит form_source в форму поп-апа */
  function initPop() {
    var pop = document.getElementById('pop');
    if (!pop) return;
    var popForm = pop.querySelector('form');
    function open(src) {
      if (popForm && src) popForm.setAttribute('data-source', src);
      pop.classList.add('is-open');
      goal('form_open', { form_source: src || '' });
      var f = pop.querySelector('input'); if (f) setTimeout(function(){ f.focus(); }, 50);
    }
    function close() { pop.classList.remove('is-open'); }
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-pop]');
      if (t) { e.preventDefault(); open(t.getAttribute('data-source') || t.getAttribute('data-pop') || ''); }
      if (e.target.closest('.pop__close') || e.target === pop) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* Демо-симулятор чата. Сценарий берётся из window.__DEMO (массив шагов). */
  function initDemo() {
    var box = document.getElementById('demo-body');
    var btn = document.getElementById('demo-run');
    if (!box || !btn || !window.__DEMO) return;
    var running = false;
    function typing() {
      var t = document.createElement('div');
      t.className = 'typing'; t.innerHTML = '<i></i><i></i><i></i>';
      box.appendChild(t); box.scrollTop = box.scrollHeight; return t;
    }
    function bubble(step) {
      var b = document.createElement('div');
      b.className = 'bubble bubble--' + step.who;
      b.textContent = step.text;
      box.appendChild(b); box.scrollTop = box.scrollHeight;
    }
    function run() {
      if (running) return; running = true;
      box.innerHTML = ''; btn.disabled = true; btn.textContent = 'Демо идёт…';
      goal('demo_run');
      var i = 0;
      (function next() {
        if (i >= window.__DEMO.length) { running = false; btn.disabled = false; btn.textContent = 'Повторить демо'; return; }
        var step = window.__DEMO[i++];
        if (step.who === 'in') {
          var t = typing();
          setTimeout(function () { box.removeChild(t); bubble(step); setTimeout(next, 500); }, 750);
        } else {
          bubble(step); setTimeout(next, 650);
        }
      })();
    }
    btn.addEventListener('click', run);
  }

  /* Бургер-меню (мобильное, с frosted-glass панелью) */
  function initBurger() {
    var burger = document.getElementById('burger');
    var nav = document.getElementById('nav');
    var scrim = document.getElementById('nav-scrim');
    if (!burger || !nav) return;
    function toggle(open) {
      burger.classList.toggle('is-open', open);
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (scrim) { scrim.hidden = !open; scrim.classList.toggle('is-open', open); }
      document.body.style.overflow = open ? 'hidden' : '';
    }
    var closeBtn = document.getElementById('nav-close');
    burger.addEventListener('click', function () { toggle(!nav.classList.contains('is-open')); });
    if (closeBtn) closeBtn.addEventListener('click', function () { toggle(false); });
    if (scrim) scrim.addEventListener('click', function () { toggle(false); });
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      // Якорь внутри страницы: закрыть меню, затем плавно доскроллить с отступом под шапку
      if (href.length > 1 && href.charAt(0) === '#') {
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          toggle(false);
          setTimeout(function () {
            var y = target.getBoundingClientRect().top + window.pageYOffset - 72;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }, 60);
          return;
        }
      }
      toggle(false); // прочие ссылки (tel:, data-pop) — просто закрыть меню
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
  }

  /* Шапка: размытие включается только когда страница прокручена */
  function initHeaderScroll() {
    var hdr = document.querySelector('.hdr');
    if (!hdr) return;
    function upd() { hdr.classList.toggle('is-scrolled', window.scrollY > 12); }
    upd();
    window.addEventListener('scroll', upd, { passive: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('form.js-lead'), initForm);
    initPop();
    initDemo();
    initBurger();
    initHeaderScroll();
  });
})();
