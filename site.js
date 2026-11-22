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

    syncThemeLabels();
    document.dispatchEvent(new CustomEvent('xyc:lang', { detail: { lang: pick } }));
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
    return window.matchMedia('(max-width: 960px)').matches;
  }

  if (holder && trigger && menu) {
    holder.addEventListener('mouseenter', function () { setExpanded(true); });
    holder.addEventListener('mouseleave', function () { setExpanded(false); });
    holder.addEventListener('focusin', function () { setExpanded(true); });
    holder.addEventListener('focusout', function (event) {
      if (!holder.contains(event.relatedTarget)) setExpanded(false);
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

  /* ---------------- second-row explore menu ---------------- */
  Array.prototype.forEach.call(document.querySelectorAll('.subnav-trigger'), function (btn) {
    var menu = btn.parentElement ? btn.parentElement.querySelector('.project-menu') : null;
    if (!menu) return;
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      var open = menu.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function (event) {
    if (event.target.closest && event.target.closest('.subnav-explore')) return;
    Array.prototype.forEach.call(document.querySelectorAll('.subnav-explore .project-menu.is-open'), function (menu) {
      menu.classList.remove('is-open');
      var btn = menu.parentElement.querySelector('.subnav-trigger');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  });

  /* every expandable top-level item works the same way on phones */
  Array.prototype.forEach.call(document.querySelectorAll('.nav-links > li.has-menu'), function (item) {
    var itemTrigger = item.querySelector('.nav-trigger');
    if (!itemTrigger) return;
    itemTrigger.addEventListener('click', function (event) {
      if (!isMobile()) return;
      event.preventDefault();
      var open = item.classList.toggle('is-open');
      itemTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* ---------------- mobile nav ---------------- */
  var toggle = document.getElementById('navToggle');
  var primaryMenu = document.getElementById('primaryMenu');
  if (toggle && nav) {
    function setNavOpen(open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('menu-open', open);
    }

    if (primaryMenu && !primaryMenu.querySelector('.mobile-menu-head')) {
      var head = document.createElement('li');
      head.className = 'mobile-menu-head';
      head.innerHTML = '<a class="brand" href="index.html" aria-label="xyc design — home">' +
        '<span class="mark"><img class="line-art" src="img/line/mark.webp" alt="" width="160" height="160"></span>' +
        'xyc<em>design.</em></a>' +
        '<button class="mobile-menu-close" type="button" aria-label="Close menu"><span></span><span></span></button>';
      primaryMenu.insertBefore(head, primaryMenu.firstChild);
      head.querySelector('.mobile-menu-close').addEventListener('click', function () { setNavOpen(false); });
    }

    toggle.addEventListener('click', function () {
      setNavOpen(!nav.classList.contains('is-open'));
    });

    Array.prototype.forEach.call(nav.querySelectorAll('.nav-links a'), function (link) {
      link.addEventListener('click', function () {
        if (link.classList.contains('nav-trigger') && isMobile()) return;
        setNavOpen(false);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) setNavOpen(false);
    });

    window.addEventListener('resize', function () {
      if (!isMobile()) {
        setNavOpen(false);
        if (holder) holder.classList.remove('is-open');
        Array.prototype.forEach.call(document.querySelectorAll('.nav-links > li.has-menu'), function (item) {
          item.classList.remove('is-open');
        });
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

  /* ============================================================
     theme — claude light / dark, follows the system by default
     ============================================================ */
  var THEME_KEY = 'xyc-theme';
  var DARK_QUERY = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function storedTheme() {
    try {
      var value = localStorage.getItem(THEME_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch (err) {
      return null;
    }
  }

  function isDark() {
    return root.getAttribute('data-theme') === 'dark';
  }

  function syncThemeLabels() {
    var zh = root.getAttribute('lang') === 'zh-CN';
    var dark = isDark();
    var label = zh
      ? (dark ? '切换到浅色模式' : '切换到深色模式')
      : (dark ? 'Switch to light theme' : 'Switch to dark theme');
    Array.prototype.forEach.call(document.querySelectorAll('.theme-toggle'), function (btn) {
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });
  }

  function paintTheme(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#141413' : '#faf9f5');
    syncThemeLabels();
  }

  function setTheme(theme, persist) {
    paintTheme(theme);
    if (!persist) return;
    try { localStorage.setItem(THEME_KEY, theme); } catch (err) {}
  }

  Array.prototype.forEach.call(document.querySelectorAll('.theme-toggle'), function (btn) {
    btn.addEventListener('click', function () {
      setTheme(isDark() ? 'light' : 'dark', true);
    });
  });

  if (DARK_QUERY) {
    var onSystemTheme = function (event) {
      if (storedTheme()) return;      // an explicit choice wins over the system
      paintTheme(event.matches ? 'dark' : 'light');
    };
    if (DARK_QUERY.addEventListener) DARK_QUERY.addEventListener('change', onSystemTheme);
    else if (DARK_QUERY.addListener) DARK_QUERY.addListener(onSystemTheme);
  }

  /* ============================================================
     capability map — draw the constellation lines
     ============================================================ */
  function initStarmap() {
    var map = document.getElementById('starmap');
    if (!map) return;

    var svg = map.querySelector('.starmap-lines');
    var core = map.querySelector('.starmap-core');
    var hubs = Array.prototype.slice.call(map.querySelectorAll('.starmap-hub'));
    if (!svg || !core || !hubs.length) return;

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var stacked = window.matchMedia('(max-width: 900px)');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var revealed = false;

    function localRect(el) {
      var r = el.getBoundingClientRect();
      var m = map.getBoundingClientRect();
      return { x: r.left - m.left, y: r.top - m.top, w: r.width, h: r.height };
    }

    function middle(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

    /* where the segment (fx,fy)->(tx,ty) first enters the inset rect */
    function clipT(fx, fy, tx, ty, r, pad) {
      var x1 = r.x + pad, y1 = r.y + pad;
      var x2 = r.x + r.w - pad, y2 = r.y + r.h - pad;
      var dx = tx - fx, dy = ty - fy;
      var t0 = 0, t1 = 1;
      var p = [-dx, dx, -dy, dy];
      var q = [fx - x1, x2 - fx, fy - y1, y2 - fy];
      for (var i = 0; i < 4; i += 1) {
        if (p[i] === 0) {
          if (q[i] < 0) return null;
        } else {
          var t = q[i] / p[i];
          if (p[i] < 0) {
            if (t > t1) return null;
            if (t > t0) t0 = t;
          } else {
            if (t < t0) return null;
            if (t < t1) t1 = t;
          }
        }
      }
      return { a: t0, b: t1 };
    }

    /* draw from the edge of `fromRect` to the edge of `targetRect` */
    function addLine(fx, fy, tx, ty, targetRect, pad, hub, fromRect, delay, hubEl, leafEl) {
      var dist = Math.sqrt((tx - fx) * (tx - fx) + (ty - fy) * (ty - fy));
      if (!dist) return;

      var start = { x: fx, y: fy };
      if (fromRect) {
        var out = clipT(fx, fy, tx, ty, fromRect, 8);
        if (out) start = { x: fx + (tx - fx) * out.b, y: fy + (ty - fy) * out.b };
      }

      var end = { x: tx, y: ty };
      var t = targetRect ? clipT(fx, fy, tx, ty, targetRect, pad) : null;
      if (t) {
        var gap = Math.min(0.35, 8 / dist);
        var tt = Math.max(0, t.a - gap);
        end = { x: fx + (tx - fx) * tt, y: fy + (ty - fy) * tt };
      }

      var line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', start.x.toFixed(1));
      line.setAttribute('y1', start.y.toFixed(1));
      line.setAttribute('x2', end.x.toFixed(1));
      line.setAttribute('y2', end.y.toFixed(1));
      line.setAttribute('data-hub', hub);
      if (!reduceMotion.matches) {
        var len = Math.hypot(end.x - start.x, end.y - start.y);
        line.style.strokeDasharray = len.toFixed(1) + 'px';
        line.style.setProperty('--len', len.toFixed(1) + 'px');
        line.style.setProperty('--ld', (delay || 0).toFixed(2) + 's');
      }
      line._ln = { sx: start.x, sy: start.y, ex: end.x, ey: end.y, hubEl: hubEl || null, leafEl: leafEl || null };
      svg.appendChild(line);
    }

    function draw() {
      svg.textContent = '';
      if (stacked.matches) return;

      var cr = localRect(core);
      var c = middle(cr);
      var w = map.clientWidth, h = map.clientHeight;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

      hubs.forEach(function (hub, hi) {
        var node = hub.querySelector('.starmap-node');
        if (!node) return;
        var key = hub.getAttribute('data-hub');
        var nr = localRect(node);
        var nc = middle(nr);
        addLine(c.x, c.y, nc.x, nc.y, nr, 4, key, cr, 0.12 + hi * 0.07, node, null);

        Array.prototype.forEach.call(hub.querySelectorAll('.starmap-leaves li'), function (leaf, li) {
          var lr = localRect(leaf);
          var lc = middle(lr);
          addLine(nc.x, nc.y, lc.x, lc.y, lr, 3, key, null, 0.3 + hi * 0.07 + li * 0.05, node, leaf);
        });
      });
    }

    function focusHub(key) {
      map.classList.add('is-focus');
      Array.prototype.forEach.call(map.querySelectorAll('[data-hub]'), function (el) {
        if (el.classList.contains('starmap-hub')) return;
        el.classList.toggle('is-on', el.getAttribute('data-hub') === key);
      });
      Array.prototype.forEach.call(svg.querySelectorAll('line'), function (line) {
        line.classList.toggle('is-hot', line.getAttribute('data-hub') === key);
      });
    }

    function clearFocus() {
      map.classList.remove('is-focus');
      Array.prototype.forEach.call(map.querySelectorAll('.is-on'), function (el) {
        el.classList.remove('is-on');
      });
      Array.prototype.forEach.call(svg.querySelectorAll('line.is-hot'), function (line) {
        line.classList.remove('is-hot');
      });
    }

    map.addEventListener('pointerover', function (event) {
      var el = event.target.closest ? event.target.closest('[data-hub]') : null;
      if (!el || el === map) return;
      var hub = el.getAttribute('data-hub');
      if (hub) focusHub(hub);
    });
    map.addEventListener('pointerleave', clearFocus);

    var tick = false;
    function redraw() {
      if (tick) return;
      tick = true;
      window.requestAnimationFrame(function () {
        tick = false;
        clearFocus();
        if (stacked.matches) stopFloat();
        else if (revealed) startFloat();
        draw();
      });
    }

    window.addEventListener('resize', redraw);
    if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(map);
    document.addEventListener('xyc:lang', function () {
      window.requestAnimationFrame(draw);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

    /* stagger the labels, then draw the lines outward from the centre */
    hubs.forEach(function (hub, hi) {
      var node = hub.querySelector('.starmap-node');
      if (node) {
        node.style.setProperty('--d', (0.05 + hi * 0.05).toFixed(2) + 's');
        node.style.setProperty('--f', (7 + (hi % 3) * 1.5).toFixed(1) + 'px');
        node.style.setProperty('--fx', (2.5 + (hi % 2) * 1.5).toFixed(1) + 'px');
        node.style.setProperty('--fd', (6.4 + (hi % 3) * 0.9).toFixed(1) + 's');
      }
      Array.prototype.forEach.call(hub.querySelectorAll('.starmap-leaves li'), function (leaf, li) {
        leaf.style.setProperty('--d', (0.16 + hi * 0.05 + li * 0.035).toFixed(2) + 's');
        leaf.style.setProperty('--f', (4.5 + ((hi + li) % 3) * 1.6).toFixed(1) + 'px');
        leaf.style.setProperty('--fx', (1.6 + ((hi + li) % 3) * 0.9).toFixed(1) + 'px');
        leaf.style.setProperty('--fd', (5.4 + ((hi * 2 + li) % 4) * 0.8).toFixed(1) + 's');
      });
    });
    var core = map.querySelector('.starmap-word');
    if (core) core.style.setProperty('--d', '0.02s');

    /* ---------- slow float: labels drift, lines follow ---------- */
    var floatRaf = null;
    var floatStart = 0;

    function offsetFor(el, t) {
      var p = el._fl;
      if (!p) return { x: 0, y: 0 };
      var a = t * Math.PI * 2 / p.pd;
      return { x: p.ax * Math.sin(a + p.ph), y: p.ay * Math.cos(a + p.ph * 1.3) };
    }

    function floatFrame(ts) {
      if (!floatStart) floatStart = ts;
      var t = (ts - floatStart) / 1000;
      var box = map.getBoundingClientRect();
      var visible = box.bottom > -160 && box.top < window.innerHeight + 160;
      if (visible) {
        hubs.forEach(function (hub) {
          var node = hub.querySelector('.starmap-node');
          if (!node) return;
          var o = offsetFor(node, t);
          node._of = o;
          node.style.transform = 'translate(-50%,-50%) translate(' + o.x.toFixed(2) + 'px,' + o.y.toFixed(2) + 'px)';
          Array.prototype.forEach.call(hub.querySelectorAll('.starmap-leaves li'), function (leaf) {
            var lo = offsetFor(leaf, t);
            leaf._of = lo;
            leaf.style.transform = 'translate(-50%,-50%) translate(' + lo.x.toFixed(2) + 'px,' + lo.y.toFixed(2) + 'px)';
          });
        });
        Array.prototype.forEach.call(svg.querySelectorAll('line'), function (line) {
          var m = line._ln;
          if (!m) return;
          var ho = (m.hubEl && m.hubEl._of) || { x: 0, y: 0 };
          var lo = (m.leafEl && m.leafEl._of) || { x: 0, y: 0 };
          var x1 = m.sx + (m.leafEl ? ho.x : 0);
          var y1 = m.sy + (m.leafEl ? ho.y : 0);
          var x2 = m.ex + (m.leafEl ? lo.x : ho.x);
          var y2 = m.ey + (m.leafEl ? lo.y : ho.y);
          line.setAttribute('x1', x1.toFixed(1));
          line.setAttribute('y1', y1.toFixed(1));
          line.setAttribute('x2', x2.toFixed(1));
          line.setAttribute('y2', y2.toFixed(1));
        });
      }
      floatRaf = window.requestAnimationFrame(floatFrame);
    }

    function startFloat() {
      if (floatRaf || reduceMotion.matches) return;
      hubs.forEach(function (hub, hi) {
        var node = hub.querySelector('.starmap-node');
        if (node && !node._fl) node._fl = { ax: 3 + (hi % 2) * 1.6, ay: 8 + (hi % 3) * 1.8, pd: 6.4 + (hi % 3) * 0.9, ph: hi * 0.9 };
        Array.prototype.forEach.call(hub.querySelectorAll('.starmap-leaves li'), function (leaf, li) {
          if (!leaf._fl) leaf._fl = { ax: 1.8 + ((hi + li) % 3) * 1.1, ay: 5 + ((hi * 2 + li) % 3) * 1.7, pd: 5.2 + ((hi + li) % 4) * 0.8, ph: hi * 1.1 + li * 0.8 };
        });
      });
      floatStart = 0;
      floatRaf = window.requestAnimationFrame(floatFrame);
    }

    function stopFloat() {
      if (floatRaf) window.cancelAnimationFrame(floatRaf);
      floatRaf = null;
      Array.prototype.forEach.call(map.querySelectorAll('.starmap-node, .starmap-leaves li'), function (el) {
        el.style.transform = '';
        el._of = null;
      });
    }

    function reveal() {
      if (revealed) return;
      revealed = true;
      map.classList.add('is-in');
      if (!stacked.matches) startFloat();
      window.setTimeout(function () {
        Array.prototype.forEach.call(map.querySelectorAll('.starmap-node, .starmap-leaves li, .starmap-word, .starmap-mark'), function (el) {
          el.style.removeProperty('--d');
        });
        Array.prototype.forEach.call(svg.querySelectorAll('line'), function (line) {
          line.style.removeProperty('--ld');
        });
      }, 1700);
    }

    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      reveal();
    } else {
      var mapIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          reveal();
          mapIO.disconnect();
        });
      }, { threshold: 0.18 });
      mapIO.observe(map);
    }

    draw();
    window.setTimeout(draw, 380);
  }


  /* mobile capability map: a vertical constellation, built from the same
     branch/leaf data as the desktop map (Claude's phone layout). */
  function initMobileStarmap() {
    var map = document.getElementById('starmap');
    if (!map) return;
    var mq = window.matchMedia('(max-width: 640px)');
    var NS = 'http://www.w3.org/2000/svg';
    var LAYOUT = [
      { hub: [122, 108], leaves: [[18, 52], [205, 62], [18, 112], [18, 152], [210, 142]] },
      { hub: [232, 252], leaves: [[30, 202], [152, 208], [260, 224], [258, 286]] },
      { hub: [106, 402], leaves: [[16, 352], [26, 390], [188, 344], [194, 426]] },
      { hub: [236, 552], leaves: [[60, 498], [255, 490], [262, 592], [255, 628]] },
      { hub: [108, 702], leaves: [[24, 652], [238, 644], [224, 700], [30, 716]] },
      { hub: [224, 842], leaves: [[58, 786], [56, 822], [62, 856], [188, 880]] }
    ];

    function clear() {
      Array.prototype.forEach.call(map.querySelectorAll('.starmap-mobile, .sm-svg'), function (el) {
        el.remove();
      });
    }

    function build() {
      clear();
      if (!mq.matches) return;
      var W = map.clientWidth;
      if (!W) return;
      var H = Math.round(W * 920 / 342);
      var wrap = document.createElement('div');
      wrap.className = 'starmap-mobile';
      wrap.style.height = H + 'px';
      map.appendChild(wrap);

      var VH = map.clientHeight || (H + 50);
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'sm-svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + VH);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      map.appendChild(svg);

      function clamp(el) {
        var r = el.getBoundingClientRect();
        var hw = r.width / 2;
        var hh = r.height / 2;
        var x = parseFloat(el.style.left) || 0;
        var y = parseFloat(el.style.top) || 0;
        x = Math.max(hw + 4, Math.min(W - hw - 4, x));
        y = Math.max(hh + 2, Math.min(H - hh - 2, y));
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        return { x: x, y: y };
      }

      function line(x1, y1, x2, y2, cls, key) {
        var l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', x1.toFixed(1));
        l.setAttribute('y1', (y1 + 50).toFixed(1));
        l.setAttribute('x2', x2.toFixed(1));
        l.setAttribute('y2', (y2 + 50).toFixed(1));
        l.setAttribute('class', 'sm-line ' + cls);
        if (key) l.setAttribute('data-hub', key);
        svg.appendChild(l);
      }

      var hubEls = Array.prototype.slice.call(map.querySelectorAll('.starmap-hub'));
      var hubPos = [];
      hubEls.forEach(function (hubEl, i) {
        var node = hubEl.querySelector('.starmap-node');
        var leaves = Array.prototype.slice.call(hubEl.querySelectorAll('.starmap-leaves li'));
        var L = LAYOUT[i];
        if (!node || !L) return;
        var key = hubEl.getAttribute('data-hub') || node.getAttribute('data-hub') || ('h' + i);
        var hb = document.createElement('button');
        hb.type = 'button';
        hb.className = 'sm-hub';
        hb.setAttribute('data-hub', key);
        hb.setAttribute('aria-pressed', 'false');
        hb.textContent = node.textContent.trim();
        hb.style.left = (L.hub[0] / 342 * W) + 'px';
        hb.style.top = (L.hub[1] / 920 * H) + 'px';
        hb.style.animationDelay = (0.05 + i * 0.03).toFixed(2) + 's';
        wrap.appendChild(hb);
        var hp = clamp(hb);
        hubPos.push({ x: hp.x, y: hp.y, key: key, el: hb });

        hb.addEventListener('click', function () {
          var already = wrap.classList.contains('is-focus') &&
            wrap.querySelector('.sm-hub.is-on') &&
            wrap.querySelector('.sm-hub.is-on').getAttribute('data-hub') === key;
          wrap.classList.toggle('is-focus', !already);
          Array.prototype.forEach.call(wrap.querySelectorAll('.is-on'), function (el) {
            el.classList.remove('is-on');
          });
          if (!already) {
            Array.prototype.forEach.call(wrap.querySelectorAll('[data-hub="' + key + '"]'), function (el) {
              el.classList.add('is-on');
            });
          }
          Array.prototype.forEach.call(wrap.querySelectorAll('.sm-hub'), function (el) {
            el.setAttribute('aria-pressed', el.getAttribute('data-hub') === key && !already ? 'true' : 'false');
          });
        });

        leaves.forEach(function (leaf, j) {
          var pos = L.leaves[j] || [0, 0];
          var sp = document.createElement('span');
          sp.className = 'sm-leaf';
          sp.setAttribute('data-hub', key);
          sp.textContent = leaf.textContent.trim();
          sp.style.left = (pos[0] / 342 * W) + 'px';
          sp.style.top = (pos[1] / 920 * H) + 'px';
          sp.style.animationDelay = (0.08 + i * 0.03 + j * 0.025).toFixed(2) + 's';
          wrap.appendChild(sp);
          var lp = clamp(sp);
          line(hp.x, hp.y, lp.x, lp.y, 'sec', key);
        });
      });

      for (var i = 1; i < hubPos.length; i += 1) {
        line(hubPos[i - 1].x, hubPos[i - 1].y, hubPos[i].x, hubPos[i].y, 'pri', hubPos[i].key);
      }

      /* the wordmark at the top is the root of the chain */
      var coreEl = map.querySelector('.starmap-core');
      if (coreEl && hubPos.length) {
        var mapBox = map.getBoundingClientRect();
        var coreBottom = coreEl.getBoundingClientRect().bottom - mapBox.top;
        line(W / 2, coreBottom - 50, hubPos[0].x, hubPos[0].y, 'pri core', hubPos[0].key);
      }
    }

    build();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
    document.addEventListener('xyc:lang', build);
    var timer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(build, 180);
    });
  }

  initStarmap();
  initMobileStarmap();


  /* ============================================================
     hero orbit — two rings of drawings circling the plate.
     Tiles fade out at the edges, and hovering one opens a card.
     ============================================================ */
  var TILE_ITEMS = {
    design: {
      title: { en: 'Design', zh: '设计' },
      text: {
        en: 'Product thinking, interface, motion and design systems — carried to the last empty state.',
        zh: '产品思考、界面、动效与设计系统——一直做到最后一个空状态。'
      },
      art: 'img/line/illu-desk.webp',
      href: '#roles',
      cta: { en: 'See what I do', zh: '看看我做什么' }
    },
    engineering: {
      title: { en: 'Engineering', zh: '工程' },
      text: {
        en: 'LLM applications, agents and the plumbing around them — retrieval, tools, memory, guardrails.',
        zh: '大模型应用与 Agent，以及它们周围的管道：检索、工具、记忆与护栏。'
      },
      art: 'img/line/illu-brain.webp',
      href: '#map',
      cta: { en: 'Open the map', zh: '打开能力图谱' }
    },
    delivery: {
      title: { en: 'Delivery', zh: '交付' },
      text: {
        en: 'From the first prototype to the shipped build, then the long maintenance nobody writes about.',
        zh: '从第一版原型到上线，再到没人写进案例的长期维护。'
      },
      art: 'img/line/illu-stairs-v.webp',
      href: '#work',
      cta: { en: 'View the work', zh: '查看作品' }
    },
    works: {
      title: { en: 'Archive', zh: '作品档案' },
      text: {
        en: 'Five linked works — an interactive archive, a palace in data, a mourning study, four seasons, a pixel run.',
        zh: '五个已上线的作品：一册瓷器档案、一座数据宫殿、一次哀悼研究、四季海报、一局像素跑酷。'
      },
      art: 'img/line/illu-folder-v.webp',
      href: 'archive.html',
      cta: { en: 'Open the archive', zh: '打开作品档案' }
    },
    map: {
      title: { en: 'Capability map', zh: '能力图谱' },
      text: {
        en: 'Six branches and the twenty-five things hanging under them, from empty states to guardrails.',
        zh: '六个支点，和挂在上面的二十五件具体手艺——从空状态到护栏。'
      },
      art: 'img/line/illu-documents.webp',
      href: '#map',
      cta: { en: 'Read the map', zh: '看这张图' }
    },
    about: {
      title: { en: 'About', zh: '关于' },
      text: {
        en: 'Independent designer and AI engineer, based in Nanjing. Fewer projects, carried further.',
        zh: '独立设计师与 AI 工程师，常驻南京。项目接得少，但每一件都走得更远。'
      },
      art: 'img/line/illu-coffee-v.webp',
      href: '#about',
      cta: { en: 'About me', zh: '关于我' }
    },
    contact: {
      title: { en: 'Contact', zh: '联系' },
      text: {
        en: 'Have something worth making? I take on a small number of projects each year.',
        zh: '有件值得做出来的事？每年我只接少量项目。'
      },
      art: 'img/line/illu-chat.webp',
      href: 'mailto:3386079378@qq.com',
      cta: { en: 'Write to me', zh: '写信给我' }
    }
,
    greek: {
      title: { en: 'The column', zh: '柱' },
      text: { en: 'A load-bearing line. The oldest interface pattern there is.', zh: '一条承重的线。最老的界面范式。' },
      art: 'img/line/illu-greek-column.webp',
      href: '#map',
      cta: { en: 'Open the map', zh: '打开能力图谱' }
    },
    ariadne: {
      title: { en: 'Ariadne', zh: '阿里阿德涅' },
      text: { en: 'The thread through the maze: a path back out of the screen.', zh: '穿过迷宫的那根线：一条从界面里走回来的路。' },
      art: 'img/line/illu-greek-ariadne-v.webp',
      href: '#map',
      cta: { en: 'Follow the thread', zh: '沿着线走' }
    },
    diogenes: {
      title: { en: 'Diogenes', zh: '第欧根尼' },
      text: { en: 'A lantern at noon, looking for one honest interface.', zh: '正午提灯，找一张诚实的界面。' },
      art: 'img/line/illu-greek-diogenes.webp',
      href: '#about',
      cta: { en: 'About me', zh: '关于我' }
    },
    cave: {
      title: { en: 'The cave', zh: '洞穴' },
      text: { en: 'Shadows on the wall; the interface is the fire.', zh: '墙上的影子；界面就是那堆火。' },
      art: 'img/line/illu-philo-cave.webp',
      href: '#work',
      cta: { en: 'View the work', zh: '查看作品' }
    },
    ship: {
      title: { en: 'Ship of Theseus', zh: '忒修斯之船' },
      text: { en: 'Same planks, new ship — every redesign.', zh: '同样的木板，新的船——每一次改版。' },
      art: 'img/line/illu-philo-ship.webp',
      href: '#work',
      cta: { en: 'View the work', zh: '查看作品' }
    },
    mobius: {
      title: { en: 'Möbius', zh: '莫比乌斯' },
      text: { en: 'One side, no end: the loop a user should never notice.', zh: '只有一面，没有尽头：用户不该察觉的那个循环。' },
      art: 'img/line/illu-philo-mobius-v.webp',
      href: '#map',
      cta: { en: 'Open the map', zh: '打开能力图谱' }
    },
    abyss: {
      title: { en: 'The abyss', zh: '深渊' },
      text: { en: 'Look long enough and the roadmap looks back.', zh: '看得够久，路线图也会回望你。' },
      art: 'img/line/illu-philo-abyss-v.webp',
      href: '#about',
      cta: { en: 'About me', zh: '关于我' }
    }  };

  function initHeroOrbit() {
    var orbit = document.querySelector('.hero-orbit');
    var plate = document.querySelector('.hero-plate');
    var stage = document.querySelector('.hero-stage');
    var pop = document.getElementById('tilePop');
    if (!orbit || !plate || !stage || !pop) return;

    var tiles = Array.prototype.slice.call(orbit.querySelectorAll('.hf'));
    if (!tiles.length) return;

    var wide = window.matchMedia('(min-width: 1320px)');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var rings = { out: [], in: [] };
    tiles.forEach(function (el) {
      rings[el.getAttribute('data-ring') === 'in' ? 'in' : 'out'].push(el);
    });

    var geo = null;
    var raf = null;
    var elapsed = 0;
    var last = null;
    var paused = false;
    var active = null;
    var closeTimer = null;
    var SPEED = { out: -1 / 260, in: 1 / 190 };

    function lang() {
      return document.documentElement.getAttribute('lang') === 'zh-CN' ? 'zh' : 'en';
    }

    function measure() {
      var sr = stage.getBoundingClientRect();
      var pr = plate.getBoundingClientRect();
      var half = Math.sqrt(pr.width * pr.width + pr.height * pr.height) / 2;
      geo = {
        cx: pr.left - sr.left + pr.width / 2,
        cy: pr.top - sr.top + pr.height / 2,
        w: sr.width,
        h: sr.height,
        in: { r: half + 40 },
        out: { r: half + 243 }
      };
      tiles.forEach(function (el, i) {
        el._w = el.offsetWidth;
        el._h = el.offsetHeight;
        if (el._sway === undefined) el._sway = (((i * 37) % 9) - 4) / 130;
      });
    }

    var spread = 0;
    var boost = 0;
    var introT = 0;
    var introElapsed = 0;
    var scrollFade = 1;

    function easeOutExpo(x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); }

    function place(el, base, t) {
      var key = el.getAttribute('data-ring') === 'in' ? 'in' : 'out';
      var g = geo[key];
      var a = base + (reduce.matches ? 0 : SPEED[key] * t * Math.PI * 2);
      var sway = el._sway || 0;
      var rad = g.r * (1 + sway) * (0.58 + 0.42 * spread);
      var x = geo.cx + rad * Math.cos(a);
      var y = geo.cy + rad * Math.sin(a);
      var edge = Math.min(x, geo.w - x, y, geo.h - y);
      var fade = Math.min(1, Math.max(0, (edge - 14) / 104));
      var on = el === active;
      var opacity = 0.94 * fade * scrollFade * introT;
      el.style.transform = 'translate3d(' + (x - el._w / 2).toFixed(1) + 'px,' +
        (y - el._h / 2).toFixed(1) + 'px,0) rotate(' + (sway * 70).toFixed(1) + 'deg) scale(' +
        (on ? 1.05 : 1) + ')';
      el.style.opacity = opacity.toFixed(3);
      el.style.pointerEvents = opacity > 0.25 ? 'auto' : 'none';
    }

    function frame(ts) {
      if (last === null) last = ts;
      var dt = Math.min(120, ts - last) / 1000;
      last = ts;

      // entry: the field expands out of the middle, then settles
      introElapsed += dt;
      if (introT < 1) introT = Math.min(1, introElapsed / 0.5);
      if (spread < 1) spread = easeOutExpo(Math.min(1, introElapsed / 1.9));

      // wheel / scroll gives the orbit a short push, then it damps back
      if (!paused) elapsed += dt * (1 + boost);
      boost *= Math.pow(0.06, dt);

      // scrolling the hero away fades the whole field
      var stageTop = stage.getBoundingClientRect().top;
      var progress = Math.min(1, Math.max(0, (0 - stageTop) / (geo.h * 0.85)));
      var target = 1 - progress;
      scrollFade += (target - scrollFade) * Math.min(1, dt * 8);

      rings.out.forEach(function (el, i) { place(el, (i / rings.out.length) * Math.PI * 2 - Math.PI / 2, elapsed); });
      rings.in.forEach(function (el, i) { place(el, (i / rings.in.length) * Math.PI * 2, elapsed); });
      if (active) positionPop(active);
      raf = window.requestAnimationFrame(frame);
    }

    function kick(amount) {
      if (!orbit.classList.contains('is-live')) return;
      boost = Math.min(2.6, boost + amount);
    }

    window.addEventListener('wheel', function (event) {
      if (!event.deltaY) return;
      kick(Math.min(0.9, Math.abs(event.deltaY) / 420));
    }, { passive: true });

    function stop() {
      if (raf) window.cancelAnimationFrame(raf);
      raf = null;
      last = null;
    }

    /* ---------- popup ---------- */
    function paintPop(el) {
      var item = TILE_ITEMS[el.getAttribute('data-id')];
      if (!item) return;
      var l = lang();
      pop.innerHTML = '';
      var title = document.createElement('div');
      title.className = 'tp-title';
      title.textContent = item.title[l];
      var art = document.createElement('div');
      art.className = 'tp-art';
      var img = document.createElement('img');
      img.src = item.art;
      img.alt = '';
      img.className = 'line-art';
      art.appendChild(img);
      var text = document.createElement('p');
      text.className = 'tp-text';
      text.textContent = item.text[l];
      var cta = document.createElement('a');
      cta.className = 'tp-cta';
      cta.href = item.href;
      cta.textContent = item.cta[l] + ' →';
      pop.appendChild(title);
      pop.appendChild(art);
      pop.appendChild(text);
      pop.appendChild(cta);
    }

    function positionPop(el) {
      var r = el.getBoundingClientRect();
      var w = pop.offsetWidth;
      var h = pop.offsetHeight;
      var gap = 18;
      var left = r.right + gap;
      if (left + w > window.innerWidth - 12) left = r.left - gap - w;
      left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
      var top = r.top + r.height / 2 - h / 2;
      top = Math.max(84, Math.min(top, window.innerHeight - h - 12));
      pop.style.left = Math.round(left) + 'px';
      pop.style.top = Math.round(top) + 'px';
    }

    function openPop(el) {
      window.clearTimeout(closeTimer);
      if (active === el) return;
      active = el;
      paused = true;
      paintPop(el);
      pop.classList.add('is-open');
      pop.setAttribute('aria-hidden', 'false');
      positionPop(el);
    }

    function closePop() {
      active = null;
      paused = false;
      pop.classList.remove('is-open');
      pop.setAttribute('aria-hidden', 'true');
    }

    function scheduleClose() {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(closePop, 220);
    }

    tiles.forEach(function (el) {
      el.addEventListener('mouseenter', function () { openPop(el); });
      el.addEventListener('mouseleave', scheduleClose);
    });
    pop.addEventListener('mouseenter', function () { window.clearTimeout(closeTimer); });
    pop.addEventListener('mouseleave', scheduleClose);
    var lastY = window.scrollY;
    window.addEventListener('scroll', function () {
      if (!active) return;
      if (Math.abs(window.scrollY - lastY) > 24) { lastY = window.scrollY; closePop(); }
      else positionPop(active);
    }, { passive: true });
    document.addEventListener('xyc:lang', function () { if (active) { paintPop(active); positionPop(active); } });

    /* ---------- lifecycle ---------- */
    function render() {
      stop();
      if (!wide.matches) {
        orbit.classList.remove('is-live');
        closePop();
        return;
      }
      orbit.classList.add('is-live');
      measure();
      if (reduce.matches) {
        rings.out.forEach(function (el, i) { place(el, (i / rings.out.length) * Math.PI * 2 - Math.PI / 2, elapsed); });
        rings.in.forEach(function (el, i) { place(el, (i / rings.in.length) * Math.PI * 2, elapsed); });
        return;
      }
      raf = window.requestAnimationFrame(frame);
    }

    var resizeTick = false;
    window.addEventListener('resize', function () {
      if (resizeTick) return;
      resizeTick = true;
      window.requestAnimationFrame(function () {
        resizeTick = false;
        render();
      });
    });
    if (reduce.addEventListener) reduce.addEventListener('change', render);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
    render();
  }

  initHeroOrbit();


  /* ============================================================
     home showcases — flip through the app screens
     ============================================================ */
  function initShowcases() {
    var articles = Array.prototype.slice.call(document.querySelectorAll('[data-showcase]'));

    function flipSwap(card, img, src, done) {
      if (!card || !img) return;
      var pre = new Image();
      pre.onload = function () {
        card.classList.add('is-flip');
        window.setTimeout(function () {
          img.src = src;
          card.classList.remove('is-flip');
          if (done) done();
        }, 190);
      };
      pre.onerror = function () { if (done) done(); };
      pre.src = src;
    }

    function lang() {
      return document.documentElement.getAttribute('lang') === 'zh-CN' ? 'zh' : 'en';
    }
    function noteFor(btn) {
      if (lang() === 'zh' && btn.getAttribute('data-note-zh')) return btn.getAttribute('data-note-zh');
      return btn.getAttribute('data-note') || '';
    }

    articles.forEach(function (article) {
      var list = article.querySelector('[data-shotlist]');
      var img = article.querySelector('[data-shot-img]');
      var note = article.querySelector('[data-shot-note]');
      if (!list || !img) return;
      var buttons = Array.prototype.slice.call(list.querySelectorAll('button'));
      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          buttons.forEach(function (b, i) {
            b.classList.toggle('is-on', b === btn);
            var assist = article.querySelectorAll('[data-assistlist] li')[i];
            if (assist) assist.classList.toggle('is-on', b === btn);
          });
          flipSwap(article.querySelector('.sc-card'), img, btn.getAttribute('data-shot'), function () {
            if (note) note.textContent = noteFor(btn);
          });
        });
        btn.addEventListener('mouseenter', function () {
          if (btn.classList.contains('is-on')) return;
          btn.click();
        });
      });
    });

    document.addEventListener('xyc:lang', function () {
      var on = document.querySelector('[data-shotlist] button.is-on');
      var note = document.querySelector('[data-shot-note]');
      if (on && note) note.textContent = noteFor(on);
    });

    var focus = document.querySelector('[data-focusstack]');
    if (focus) {
      var focusImg = focus.querySelector('[data-focus-img]');
      var focusCard = focus.querySelector('.sc-card');
      var shots = ['img/focusos/focus.webp', 'img/focusos/day.webp', 'img/focusos/week.webp', 'img/focusos/insights.webp'];
      var idx = 0;
      var timer = null;
      var hovered = false;

      function tick() {
        if (hovered || document.hidden) return;
        idx = (idx + 1) % shots.length;
        flipSwap(focusCard, focusImg, shots[idx]);
      }
      function start() {
        if (timer) return;
        timer = window.setInterval(tick, 4800);
      }
      focus.addEventListener('mouseenter', function () { hovered = true; focus.classList.add('is-open'); });
      focus.addEventListener('mouseleave', function () { hovered = false; focus.classList.remove('is-open'); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) start(); });
        }, { threshold: 0.3 }).observe(focus);
      } else {
        start();
      }
    }
  }

  initShowcases();

  /* ---------------- start ---------------- */
  paintTheme(storedTheme() || (DARK_QUERY && DARK_QUERY.matches ? 'dark' : 'light'));
  applyLang(paramLang() || readLang());
})();
