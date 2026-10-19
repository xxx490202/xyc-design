/* ============================================================
   xyc design — site behaviour
   language switch · project menu · mobile nav · reveal
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var LANG_KEY = 'xyc-lang';

  /* ---------------- language ---------------- */
  function paramLang() {
    try {
      var value = new URLSearchParams(window.location.search).get('lang');
      return value === 'zh' || value === 'en' ? value : null;
    } catch (err) {
      return null;
    }
  }

  function readLang() {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      return saved === 'zh' ? 'zh' : 'en';
    } catch (err) {
      return 'en';
    }
  }

  function applyLang(lang) {
    var pick = lang === 'zh' ? 'zh' : 'en';
    root.setAttribute('lang', pick === 'zh' ? 'zh-CN' : 'en');

    var nodes = document.querySelectorAll('[data-en][data-zh]');
    Array.prototype.forEach.call(nodes, function (el) {
      var value = el.getAttribute(pick === 'zh' ? 'data-zh' : 'data-en');
      if (value !== null) el.innerHTML = value;
    });

    var buttons = document.querySelectorAll('[data-lang]');
    Array.prototype.forEach.call(buttons, function (btn) {
      var on = btn.getAttribute('data-lang') === pick;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    var titleEn = document.body.getAttribute('data-title-en');
    var titleZh = document.body.getAttribute('data-title-zh');
    if (titleEn && titleZh) document.title = pick === 'zh' ? titleZh : titleEn;

    try { localStorage.setItem(LANG_KEY, pick); } catch (err) {}
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-lang]'), function (btn) {
    btn.addEventListener('click', function () {
      applyLang(btn.getAttribute('data-lang'));
    });
  });

  /* ---------------- sticky nav state ---------------- */
  var nav = document.getElementById('siteNav');
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('is-stuck', window.scrollY > 6);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- project dropdown ---------------- */
  var holder = document.getElementById('projectNav');
  var trigger = holder ? holder.querySelector('.nav-trigger') : null;
  var menu = document.getElementById('projectMenu');

  function setExpanded(on) {
    if (trigger) trigger.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  function isMobile() {
    return window.matchMedia('(max-width: 720px)').matches;
  }

  if (holder && trigger && menu) {
    holder.addEventListener('mouseenter', function () { setExpanded(true); });
    holder.addEventListener('mouseleave', function () { setExpanded(false); });
    holder.addEventListener('focusin', function () { setExpanded(true); });
    holder.addEventListener('focusout', function (event) {
      if (!holder.contains(event.relatedTarget)) setExpanded(false);
    });

    trigger.addEventListener('click', function (event) {
      if (isMobile()) {
        event.preventDefault();
        var open = holder.classList.toggle('is-open');
        setExpanded(open);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        holder.classList.remove('is-open');
        setExpanded(false);
        if (trigger) trigger.blur();
      }
    });

    document.addEventListener('click', function (event) {
      if (!isMobile() && !holder.contains(event.target)) setExpanded(false);
    });
  }

  /* ---------------- mobile nav ---------------- */
  var toggle = document.getElementById('navToggle');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    Array.prototype.forEach.call(nav.querySelectorAll('.nav-links a'), function (link) {
      link.addEventListener('click', function () {
        if (link.classList.contains('nav-trigger') && isMobile()) return;
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    window.addEventListener('resize', function () {
      if (!isMobile()) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        if (holder) holder.classList.remove('is-open');
      }
    });
  }

  /* ---------------- reveal on scroll ---------------- */
  var revealNodes = document.querySelectorAll('[data-reveal]');

  if (!('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(revealNodes, function (el) { el.classList.add('in'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    Array.prototype.forEach.call(revealNodes, function (el, i) {
      var delay = el.getAttribute('data-delay');
      if (!delay) {
        // stagger siblings that sit in the same grid/row
        var siblings = el.parentElement ? el.parentElement.querySelectorAll(':scope > [data-reveal]') : [];
        var index = Array.prototype.indexOf.call(siblings, el);
        delay = index > 0 ? Math.min(index * 70, 280) : 0;
      }
      el.style.transitionDelay = delay + 'ms';
      observer.observe(el);
    });
  }

  /* ---------------- copy to clipboard ---------------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy') || '';
      var zh = root.getAttribute('lang') === 'zh-CN';

      function done() {
        btn.classList.add('done');
        btn.textContent = zh ? '已复制' : 'Copied';
        window.setTimeout(function () {
          btn.classList.remove('done');
          btn.textContent = zh ? '复制' : 'Copy';
        }, 1600);
      }

      function fallback() {
        var field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.top = '-1000px';
        document.body.appendChild(field);
        field.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(field);
        done();
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    });
  });

  /* ---------------- email popover ---------------- */
  var MAILS = [
    { address: '3386079378@qq.com', tag: 'QQ' },
    { address: 'xyc060825@outlook.com', tag: 'Outlook' }
  ];
  var mailPop = null;
  var mailAnchor = null;

  function mailLang() {
    return document.documentElement.getAttribute('lang') === 'zh-CN';
  }

  function copyText(text, done) {
    var fallback = function () {
      var field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.top = '-1000px';
      document.body.appendChild(field);
      field.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(field);
      done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
      return;
    }
    fallback();
  }

  function buildMailPop() {
    var node = document.createElement('div');
    node.className = 'mail-pop';
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-label', 'Email');
    var head = document.createElement('div');
    head.className = 'mail-pop-head';
    var title = document.createElement('span');
    title.textContent = mailLang() ? '写信给我' : 'Write to me';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'mail-pop-x';
    close.setAttribute('aria-label', mailLang() ? '关闭' : 'Close');
    close.textContent = '✕';
    close.addEventListener('click', closeMailPop);
    head.appendChild(title);
    head.appendChild(close);
    node.appendChild(head);

    var rows = document.createElement('div');
    rows.className = 'mail-rows';
    MAILS.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'mail-row';
      var link = document.createElement('a');
      link.href = 'mailto:' + item.address;
      link.textContent = item.address;
      var tag = document.createElement('em');
      tag.textContent = item.tag;
      link.appendChild(tag);
      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'mail-copy';
      copy.textContent = mailLang() ? '复制' : 'Copy';
      copy.addEventListener('click', function () {
        copyText(item.address, function () {
          copy.textContent = mailLang() ? '已复制' : 'Copied';
          copy.classList.add('done');
          window.setTimeout(function () {
            copy.textContent = mailLang() ? '复制' : 'Copy';
            copy.classList.remove('done');
          }, 1400);
        });
      });
      row.appendChild(link);
      row.appendChild(copy);
      rows.appendChild(row);
    });
    node.appendChild(rows);

    var foot = document.createElement('div');
    foot.className = 'mail-pop-foot';
    foot.textContent = mailLang()
      ? '点地址直接写邮件，或复制下来。'
      : 'Click an address to write, or copy one.';
    node.appendChild(foot);

    document.body.appendChild(node);
    return node;
  }

  function placeMailPop() {
    if (!mailPop || !mailAnchor) return;
    var rect = mailAnchor.getBoundingClientRect();
    var width = mailPop.offsetWidth;
    var height = mailPop.offsetHeight;
    var left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
    var top = rect.bottom + 10;
    if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 10);
    mailPop.style.left = Math.round(left) + 'px';
    mailPop.style.top = Math.round(top) + 'px';
  }

  function openMailPop(trigger) {
    if (!mailPop) mailPop = buildMailPop();
    mailAnchor = trigger;
    Array.prototype.forEach.call(mailPop.querySelectorAll('.mail-copy'), function (btn) {
      btn.classList.remove('done');
      btn.textContent = mailLang() ? '复制' : 'Copy';
    });
    mailPop.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    placeMailPop();
    var first = mailPop.querySelector('.mail-row a');
    if (first) first.focus({ preventScroll: true });
  }

  function closeMailPop() {
    if (!mailPop) return;
    mailPop.classList.remove('open');
    if (mailAnchor) mailAnchor.setAttribute('aria-expanded', 'false');
    mailAnchor = null;
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-mail]'), function (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      if (mailAnchor === trigger) { closeMailPop(); return; }
      openMailPop(trigger);
    });
  });

  document.addEventListener('click', function (event) {
    if (!mailPop || !mailPop.classList.contains('open')) return;
    if (mailPop.contains(event.target)) return;
    if (event.target.closest && event.target.closest('[data-mail]')) return;
    closeMailPop();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMailPop();
  });

  var mailTick = false;
  window.addEventListener('scroll', function () {
    if (!mailPop || !mailPop.classList.contains('open') || mailTick) return;
    mailTick = true;
    window.requestAnimationFrame(function () {
      mailTick = false;
      placeMailPop();
    });
  }, { passive: true });
  window.addEventListener('resize', function () {
    if (mailPop && mailPop.classList.contains('open')) placeMailPop();
  });

  /* ---------------- start ---------------- */
  applyLang(paramLang() || readLang());
})();
