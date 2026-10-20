/* ============================================================
   xyc design — extensions demos
   Simulated interface fragments for Skill / Plugin /
   Connector / MCP Server. No network, no real API.
   ============================================================ */
(function () {
  'use strict';

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function wait(ms) { return new Promise(function (r) { window.setTimeout(r, REDUCE ? 0 : ms); }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* type text into an element, character by character */
  function type(el, text, speed) {
    return new Promise(function (resolve) {
      if (!el) { resolve(); return; }
      if (REDUCE) { el.textContent = text; resolve(); return; }
      var i = 0;
      var step = speed || 18;
      var caret = document.createElement('i');
      caret.className = 'caret';
      function tick() {
        i = Math.min(text.length, i + 2);
        el.textContent = text.slice(0, i);
        el.appendChild(caret);
        if (i < text.length) window.setTimeout(tick, step);
        else { caret.remove(); resolve(); }
      }
      el.textContent = '';
      el.appendChild(caret);
      tick();
    });
  }

  /* ---------------- autoplay on first view ---------------- */
  function autoStart(root, fn) {
    if (!root) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || done) return;
        done = true;
        io.disconnect();
        window.setTimeout(fn, 320);
      });
    }, { threshold: 0.35 });
    io.observe(root);
  }

  /* ============================================================
     MCP bench
     ============================================================ */
  var bench = q('.bench');
  if (bench) {
    var benchItems = qa('.bench-item', bench);
    var scenes = qa('.bscene', bench);

    function pickScene(id) {
      benchItems.forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-scene') === id); });
      scenes.forEach(function (s) {
        var on = s.getAttribute('data-scene') === id;
        s.classList.toggle('on', on);
        if (on && s.hasAttribute('data-auto') && !s.dataset.played) {
          s.dataset.played = '1';
          window.setTimeout(function () { s.dispatchEvent(new CustomEvent('scene:show', { bubbles: true })); }, 220);
        }
      });
    }
    benchItems.forEach(function (b) {
      b.addEventListener('click', function () { pickScene(b.getAttribute('data-scene')); });
    });
    if (benchItems.length) pickScene(benchItems[0].getAttribute('data-scene'));
  }

  /* ---------------- ask ---------------- */
  qa('.bscene[data-scene="ask"]').forEach(function (scene) {
    var opts = qa('.ask-opt', scene);
    var go = q('.ask-go', scene);
    var out = q('.ask-result', scene);
    var preset = opts.filter(function (o) { return o.classList.contains('on'); })[0];
    var chosen = preset ? (preset.getAttribute('data-value') || preset.textContent.trim()) : '';

    opts.forEach(function (opt) {
      opt.addEventListener('click', function () {
        chosen = opt.getAttribute('data-value') || opt.textContent.trim();
        opts.forEach(function (o) { o.classList.toggle('on', o === opt); });
        if (out) { out.classList.remove('on'); out.textContent = ''; }
        if (go) { go.disabled = false; go.classList.remove('is-done'); go.textContent = 'Continue'; }
      });
    });

    if (go) {
      go.disabled = false;
      go.addEventListener('click', function () {
        if (!chosen) return;
        go.classList.add('is-done');
        go.textContent = 'Answered';
        go.disabled = true;
        if (out) {
          out.innerHTML = '';
          out.appendChild(document.createTextNode('turn resumes with '));
          var b = document.createElement('b');
          b.textContent = chosen;
          out.appendChild(b);
          out.appendChild(document.createTextNode(' — one card, no free-text guessing.'));
          out.classList.add('on');
        }
      });
    }

    if (out && opts.length) {
      out.classList.remove('on');
    }
  });

  /* ---------------- browser ---------------- */
  qa('.bscene[data-scene="browser"]').forEach(function (scene) {
    var go = q('.br-go', scene);
    var cursor = q('.cursor', scene);
    var page = q('.mb-page', scene);
    var rows = qa('.mb-row', scene);
    var note = q('.br-note', scene);

    if (go) {
      go.addEventListener('click', function () {
        if (!rows.length || !page || !cursor) return;
        var target = rows[1];
        rows.forEach(function (r) { r.classList.remove('is-hit'); });
        cursor.classList.remove('tween');
        cursor.classList.add('on');
        cursor.style.transform = 'translate(' + (target.offsetLeft + 90) + 'px,' + (target.offsetTop + 8) + 'px)';
        go.disabled = true;
        go.textContent = 'Working…';
        window.setTimeout(function () {
          target.classList.add('is-hit');
          go.textContent = 'Read';
          go.disabled = false;
          if (note) {
            note.innerHTML = '';
            var b = document.createElement('b');
            b.textContent = 'read · 3 paragraphs';
            note.appendChild(b);
            note.appendChild(document.createTextNode(' · the tab is still open in Quanta’s browser'));
          }
        }, REDUCE ? 0 : 820);
      });
    }
  });

  /* ---------------- memory ---------------- */
  qa('.bscene[data-scene="memory"]').forEach(function (scene) {
    var input = q('.mem-search .d-input', scene);
    var notes = qa('.mem-note', scene);
    var save = q('.mem-save', scene);
    var chips = qa('.mem-chip', scene);
    var count = q('.mem-count', scene);

    function filter(term) {
      var t = (term || '').trim().toLowerCase();
      var hits = 0;
      notes.forEach(function (n) {
        var hay = ((n.getAttribute('data-tags') || '') + ' ' + n.textContent).toLowerCase();
        var hit = !t || hay.indexOf(t) !== -1;
        n.classList.toggle('hit', Boolean(t) && hit);
        n.classList.toggle('hide', Boolean(t) && !hit);
        if (hit) hits += 1;
      });
      if (count) count.textContent = String(hits);
    }

    if (input) {
      input.addEventListener('input', function () { filter(input.value); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); filter(input.value); } });
    }
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.toggle('on', c === chip); });
        if (input) input.value = chip.getAttribute('data-q') || chip.textContent.trim();
        filter(chip.getAttribute('data-q') || chip.textContent.trim());
      });
    });
    if (save) {
      save.addEventListener('click', function () {
        var note = document.createElement('div');
        note.className = 'mem-note new';
        note.setAttribute('data-tags', 'preference tables chinese');
        note.innerHTML = '<div class="mn-title">Prefers tables in Chinese</div>' +
          '<div class="mn-meta">Wiki/summaries · m-20261020-7f2a · chat</div>' +
          '<div class="mn-body">Saved from this turn. Tags: preference, tables.</div>';
        if (notes.length) notes[0].parentNode.insertBefore(note, notes[0]);
        else scene.appendChild(note);
        notes.unshift(note);
        note.classList.add('hit');
        window.setTimeout(function () { note.classList.remove('new'); }, 500);
        save.textContent = 'Saved ✓';
        save.disabled = true;
        window.setTimeout(function () { save.textContent = 'Save a note'; save.disabled = false; }, 1800);
        filter(input ? input.value : '');
      });
    }
  });

  /* ---------------- schedule ---------------- */
  qa('.bscene[data-scene="schedule"]').forEach(function (scene) {
    var switches = qa('.switch', scene);
    var run = q('.sched-run', scene);
    var clock = q('.sched-next', scene);

    switches.forEach(function (sw) {
      sw.addEventListener('click', function () {
        sw.classList.toggle('on');
        sw.setAttribute('aria-pressed', sw.classList.contains('on') ? 'true' : 'false');
      });
    });

    if (run) {
      run.addEventListener('click', function () {
        var row = qa('.sched-row', scene).filter(function (r) {
          var sw = q('.switch', r);
          return sw && sw.classList.contains('on');
        })[0] || qa('.sched-row', scene)[0];
        if (!row) return;
        var state = q('.s-state', row);
        if (!state) return;
        run.disabled = true;
        state.className = 's-state run';
        state.textContent = 'running…';
        window.setTimeout(function () {
          state.className = 's-state ok';
          state.textContent = 'done ✓';
          run.disabled = false;
          if (clock) clock.textContent = 'next · in 6h 04m';
        }, REDUCE ? 0 : 1100);
      });
    }
  });

  /* ---------------- harness ---------------- */
  qa('.bscene[data-scene="harness"]').forEach(function (scene) {
    var ask = q('.cons-ask', scene);
    var cards = qa('.cons', scene);
    var foot = q('.cons-foot', scene);

    function run() {
      if (!cards.length) return;
      cards.forEach(function (c) { c.classList.remove('answered'); });
      cards.forEach(function (card, i) {
        window.setTimeout(function () {
          card.classList.add('answered');
          if (i === cards.length - 1 && foot) {
            foot.classList.add('on');
            foot.textContent = 'consensus 1 · objection 2 — the main thread decides.';
          }
        }, REDUCE ? 0 : 380 * (i + 1));
      });
    }

    if (ask) {
      ask.addEventListener('click', function () {
        run();
        ask.textContent = 'Asking…';
        window.setTimeout(function () { ask.textContent = 'Ask all three'; }, REDUCE ? 0 : 1500);
      });
    }
    scene.addEventListener('scene:show', run);
  });

  /* ---------------- cua ---------------- */
  var CUA_ROWS = {
    Finder: [['Desktop', '12 items'], ['Documents', '84 files'], ['Downloads', '6 items']],
    Quanta: [['Maestro', '3 chats'], ['Analyse', '1 chart'], ['Crawler', '128 new']],
    Settings: [['Appearance', 'Auto'], ['Memory', '84 notes'], ['Voice', 'Rhema']],
    Weather: [['Nanjing', '22°'], ['Cloudy', '—'], ['Wind', '3']]
  };

  qa('.bscene[data-scene="cua"]').forEach(function (scene) {
    var icons = qa('.dt-icon', scene);
    var win = q('.dt-window', scene);
    var cursor = q('.dt-cursor', scene);
    var note = q('.cua-note', scene);

    icons.forEach(function (icon) {
      icon.addEventListener('click', function () {
        icons.forEach(function (i) { i.classList.remove('on'); });
        icon.classList.add('on');
        if (cursor && win) {
          var desktop = icon.closest('.desktop');
          var x = icon.offsetLeft + 12;
          var y = icon.offsetTop + 30;
          cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
          cursor.classList.add('on');
          win.classList.remove('on');
          window.setTimeout(function () {
            win.classList.add('on');
            var app = icon.getAttribute('data-app') || 'Settings';
            var wt = q('.w-title', win);
            if (wt) wt.textContent = app + ' — 3 rows';
            var rows = CUA_ROWS[app] || CUA_ROWS.Settings;
            qa('.w-row', win).forEach(function (row, i) {
              if (!rows[i]) return;
              row.textContent = rows[i][0];
              var em = document.createElement('em');
              em.textContent = rows[i][1];
              row.appendChild(em);
            });
            if (note) note.textContent = 'moved · clicked · screenshot verified';
          }, REDUCE ? 0 : 820);
        }
      });
    });
  });

  /* ---------------- screen ---------------- */
  qa('.bscene[data-scene="screen"]').forEach(function (scene) {
    var shot = q('.scr-shot', scene);
    var flash = q('.screen-flash', scene);
    var marquee = q('.marquee', scene);
    var note = q('.scr-note', scene);

    if (shot) {
      shot.addEventListener('click', function () {
        if (flash) {
          flash.classList.remove('fire');
          void flash.offsetWidth;
          flash.classList.add('fire');
        }
        if (marquee) marquee.classList.add('on');
        if (note) note.textContent = 'capture 1440×900 · PNG 386 KB · returned to the model';
      });
    }
  });

  /* ---------------- materials ---------------- */
  qa('.bscene[data-scene="materials"]').forEach(function (scene) {
    var rows = qa('.file-row', scene);
    var go = q('.jev-run', scene);
    var out = q('.jev', scene);

    rows.forEach(function (row) {
      row.addEventListener('click', function () {
        row.classList.toggle('on');
        var mark = q('.f-mark', row);
        if (mark) mark.textContent = row.classList.contains('on') ? 'selected' : '';
      });
    });

    if (go) {
      go.addEventListener('click', function () {
        var picked = rows.filter(function (r) { return r.classList.contains('on'); }).length;
        if (!picked) {
          go.textContent = 'Pick a file first';
          window.setTimeout(function () { go.textContent = 'Run judgments'; }, 1400);
          return;
        }
        var chips = qa('span', out);
        chips.forEach(function (c) { c.classList.remove('on'); });
        chips.forEach(function (chip, i) {
          window.setTimeout(function () { chip.classList.add('on'); }, REDUCE ? 0 : 220 * i);
        });
        go.textContent = 'Judged ' + picked + ' file' + (picked > 1 ? 's' : '');
        window.setTimeout(function () { go.textContent = 'Run judgments'; }, 2000);
      });
    }
  });

  /* ---------------- pages ---------------- */
  qa('.bscene[data-scene="pages"]').forEach(function (scene) {
    var tabs = qa('.page-tab', scene);
    var previews = qa('.page-preview', scene);

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = tab.getAttribute('data-pp');
        tabs.forEach(function (t) { t.classList.toggle('on', t === tab); });
        previews.forEach(function (p) { p.hidden = p.getAttribute('data-pp') !== id; });
      });
    });
  });

  /* ---------------- tab panels (MCP entries) ---------------- */
  qa('[data-tabs]').forEach(function (root) {
    var tabs = qa('.tab', root);
    var panels = qa('.tpanel', root);
    if (!tabs.length) return;

    function pick(id) {
      tabs.forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-tab') === id); });
      panels.forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-panel') === id); });
      root.setAttribute('data-state', id);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { pick(tab.getAttribute('data-tab')); });
    });
    pick(tabs[0].getAttribute('data-tab'));
  });

  /* ============================================================
     Skill demos
     ============================================================ */
  qa('[data-demo="image"]').forEach(function (root) {
    var prompt = q('.imgdemo-prompt', root);
    var chips = qa('.prompt-chip', root);
    var ratios = qa('.ratio-chip', root);
    var go = q('.img-go', root);
    var tiles = qa('.img-tile', root);
    var bar = q('.progress i', root);
    var status = q('.img-status', root);
    var busy = false;

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.toggle('on', c === chip); });
        if (prompt) prompt.textContent = chip.getAttribute('data-p') || '';
        tiles.forEach(function (t) { t.classList.remove('on', 'sel'); });
        if (bar) bar.style.width = '0%';
        if (status) status.textContent = 'ready';
      });
    });
    ratios.forEach(function (chip) {
      chip.addEventListener('click', function () {
        ratios.forEach(function (c) { c.classList.toggle('on', c === chip); });
      });
    });
    tiles.forEach(function (tile) {
      tile.addEventListener('click', function () {
        if (!tile.classList.contains('on')) return;
        var was = tile.classList.contains('sel');
        tiles.forEach(function (t) { t.classList.remove('sel'); });
        if (!was) tile.classList.add('sel');
      });
    });

    function run() {
      if (busy) return;
      busy = true;
      if (go) { go.disabled = true; go.textContent = 'Generating…'; }
      tiles.forEach(function (t) { t.classList.remove('on', 'sel'); });
      if (bar) bar.style.width = '0%';
      if (status) status.textContent = 'POST /v1/images/generations · agnes-image-2.5-flash';
      window.setTimeout(function () { if (bar) bar.style.width = '34%'; }, REDUCE ? 0 : 320);
      window.setTimeout(function () { if (bar) bar.style.width = '72%'; }, REDUCE ? 0 : 760);
      window.setTimeout(function () { if (bar) bar.style.width = '100%'; }, REDUCE ? 0 : 1080);
      window.setTimeout(function () {
        tiles.forEach(function (t, i) {
          window.setTimeout(function () { t.classList.add('on'); }, REDUCE ? 0 : i * 110);
        });
        if (go) { go.disabled = false; go.textContent = 'Generate 4'; }
        if (status) status.textContent = 'Saved: 4 images · 2K · ' + (q('.ratio-chip.on', root) ? q('.ratio-chip.on', root).textContent.trim() : '3:4');
        busy = false;
      }, REDUCE ? 0 : 1240);
    }

    if (go) go.addEventListener('click', run);
    autoStart(root.closest('.demo') || root, run);
  });

  qa('[data-demo="video"]').forEach(function (root) {
    var go = q('.vid-go', root);
    var log = q('.vid-log', root);
    var frames = qa('.vid-frame', root);
    var modes = qa('.mode-chip', root);
    var status = q('.vid-status', root);
    var timer = null;

    modes.forEach(function (mode) {
      mode.addEventListener('click', function () {
        modes.forEach(function (m) { m.classList.toggle('on', m === mode); });
        if (status) status.textContent = 'mode=' + (mode.getAttribute('data-mode') || 'text');
      });
    });

    function line(text, cls) {
      if (!log) return;
      var d = document.createElement('div');
      d.innerHTML = text;
      if (cls) d.className = cls;
      log.appendChild(d);
      while (log.children.length > 5) log.removeChild(log.firstChild);
    }

    function play() {
      var i = 0;
      window.clearInterval(timer);
      timer = window.setInterval(function () {
        frames.forEach(function (f) { f.classList.remove('is-play'); });
        if (frames[i]) frames[i].classList.add('is-play');
        i += 1;
        if (i >= frames.length) { window.clearInterval(timer); }
      }, REDUCE ? 120 : 420);
    }

    function run() {
      if (!log) return;
      log.innerHTML = '';
      frames.forEach(function (f) { f.classList.remove('is-play'); });
      if (go) { go.disabled = true; go.textContent = 'Queued…'; }
      line('POST /v1/videos · keyframe · 5s · 720P');
      window.setTimeout(function () { line('task vd_8f21 · <b>status=queued</b>'); }, REDUCE ? 0 : 420);
      window.setTimeout(function () { line('poll 61s · <b>status=running</b> 42%'); }, REDUCE ? 0 : 900);
      window.setTimeout(function () { line('poll 61s · <b>status=running</b> 88%'); }, REDUCE ? 0 : 1360);
      window.setTimeout(function () {
        line('<span class="ok">completed · saved agnes_video.mp4</span>');
        if (go) { go.disabled = false; go.textContent = 'Generate again'; }
        play();
      }, REDUCE ? 0 : 1820);
    }

    if (go) go.addEventListener('click', run);
    autoStart(root.closest('.demo') || root, function () { run(); });
  });

  /* ============================================================
     Plugin demos
     ============================================================ */
  qa('[data-demo="stream"]').forEach(function (root) {
    var runBtn = q('.ls-run', root);
    var think = q('.stream-think', root);
    var pills = qa('.status-pill', root);
    var log = q('.evt-log', root);
    var compact = q('.compact-note', root);
    var busy = false;

    var TEXT = 'The user wants the crawler’s failures summarised. I should read the last run log, ' +
      'count the failed hosts, then answer with the three that keep timing out.';

    function logLine(t) {
      if (!log) return;
      var d = document.createElement('div');
      d.innerHTML = t;
      log.appendChild(d);
      while (log.children.length > 4) log.removeChild(log.firstChild);
    }

    async function run() {
      if (busy) return;
      busy = true;
      if (runBtn) { runBtn.disabled = true; runBtn.textContent = 'Streaming…'; }
      pills.forEach(function (p) { p.classList.remove('on', 'live'); });
      log.innerHTML = '';
      if (compact) compact.classList.remove('on');
      if (pills[0]) pills[0].classList.add('live');

      logLine('agent/assistant-stream · delta ×41');
      await type(think, TEXT, 16);
      if (pills[0]) { pills[0].classList.remove('live'); pills[0].classList.add('on'); }
      if (pills[1]) pills[1].classList.add('live');
      logLine('agent/status · <b>tool</b> read_log');
      await wait(700);
      if (pills[1]) { pills[1].classList.remove('live'); pills[1].classList.add('on'); }
      if (pills[2]) pills[2].classList.add('live');
      logLine('jobs · background #2 started · crawl.hostcheck');
      await wait(700);
      if (pills[2]) { pills[2].classList.remove('live'); pills[2].classList.add('on'); }
      if (pills[3]) pills[3].classList.add('live');
      logLine('context · 41k → compact 8k');
      if (compact) compact.classList.add('on');
      await wait(600);
      if (pills[3]) { pills[3].classList.remove('live'); pills[3].classList.add('on'); }
      if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'Replay the turn'; }
      busy = false;
    }

    if (runBtn) runBtn.addEventListener('click', run);
    autoStart(root.closest('.demo') || root, run);
  });

  qa('[data-demo="scope"]').forEach(function (root) {
    var roles = qa('.scope-role', root);
    var chips = qa('.tool-chip', root);
    var code = q('.sc-list', root);
    var roleName = q('.scope-name', root);

    function apply(role) {
      var allow = (role.getAttribute('data-allow') || '').split(/\s+/).filter(Boolean);
      chips.forEach(function (chip) {
        var tool = chip.getAttribute('data-tool');
        var ok = allow.indexOf(tool) !== -1;
        chip.classList.toggle('allow', ok);
        chip.classList.toggle('deny', !ok);
      });
      if (code) code.textContent = '[' + allow.map(function (a) { return "'" + a + "'"; }).join(', ') + ']';
      if (roleName) roleName.textContent = role.getAttribute('data-name') || 'subagent';
      roles.forEach(function (r) { r.classList.toggle('on', r === role); });
    }

    roles.forEach(function (role) {
      role.addEventListener('click', function () { apply(role); });
    });
    if (roles.length) apply(roles[0]);
  });

  /* ============================================================
     Connector demos
     ============================================================ */
  var CHATS = {
    feishu: [
      { in: '把今天的舆情报告发我一份', out: '今天的报告：3 个平台，128 条新增，负面 11 条。已附 PDF。', meta: 'feishu · openapi reply · 1.2s' },
      { in: '明天早上九点再跑一次', out: '已排：明天 09:00，跑完后仍发到这条会话。', meta: 'feishu · schedule created' }
    ],
    qq: [
      { in: '帮我看下这台机器还剩多少空间', out: '根分区 240 GB，已用 186 GB，剩 54 GB。日志目录占了 21 GB。', meta: 'qq · passive reply · msg_id 8f21' },
      { in: '把日志目录清一下', out: '已清理 30 天前的日志，释放 18.4 GB。', meta: 'qq · passive reply · 0.9s' }
    ],
    wechat: [
      { in: '把昨天那份表格发我', out: '找到了：舆情汇总-20261019.xlsx（2.1 MB）。', meta: 'wechat · local bridge · file sent' },
      { in: '顺便统计一下评论数', out: '共 4,812 条评论，其中新增 316 条。', meta: 'wechat · local bridge · 1.4s' }
    ]
  };

  qa('[data-chat]').forEach(function (root) {
    var id = root.getAttribute('data-chat');
    var script = CHATS[id];
    if (!script) return;
    var body = q('.chat-body', root);
    var send = q('.c-send', root);
    var typing = q('.typing', root);
    var step = 0;
    var busy = false;

    if (!body) return;

    function bubble(text, dir, meta) {
      var el = document.createElement('div');
      el.className = 'msg ' + dir;
      el.appendChild(document.createTextNode(text));
      if (meta) {
        var m = document.createElement('div');
        m.className = 'm-card';
        m.textContent = meta;
        el.appendChild(m);
      }
      body.appendChild(el);
      window.requestAnimationFrame(function () { el.classList.add('on'); });
      body.scrollTop = body.scrollHeight;
      return el;
    }

    async function turn() {
      if (busy) return;
      busy = true;
      var item = script[step % script.length];
      step += 1;
      if (send) send.disabled = true;
      bubble(item.in, 'in');
      await wait(420);
      if (typing) typing.classList.add('on');
      await wait(900);
      if (typing) typing.classList.remove('on');
      bubble(item.out, 'out', item.meta);
      if (send) {
        send.disabled = false;
        if (step >= script.length) send.textContent = 'Send again';
      }
      busy = false;
    }

    if (send) send.addEventListener('click', turn);
    autoStart(root.closest('.demo') || root, turn);
  });

  /* ---------------- voice ---------------- */
  qa('[data-demo="voice"]').forEach(function (root) {
    var go = q('.v-talk', root);
    var wave = q('.wave', root);
    var asr = q('.asr', root);
    var tts = q('.tts-bar', root);
    var track = q('.tts-track i', root);
    var busy = false;

    async function run() {
      if (busy) return;
      busy = true;
      if (go) { go.disabled = true; go.textContent = 'Listening…'; }
      if (wave) wave.classList.add('live');
      if (tts) { tts.classList.remove('on'); if (track) track.style.width = '0%'; }
      if (asr) asr.textContent = '';
      await wait(700);
      if (asr) await type(asr, 'read my schedule for this week', 30);
      if (wave) wave.classList.remove('live');
      if (go) go.textContent = 'Thinking…';
      await wait(800);
      if (tts) tts.classList.add('on');
      if (track) {
        track.style.width = '0%';
        window.setTimeout(function () { track.style.width = '100%'; }, REDUCE ? 0 : 120);
      }
      await wait(1400);
      if (go) { go.disabled = false; go.textContent = 'Talk again'; }
      busy = false;
    }

    if (go) go.addEventListener('click', run);
    autoStart(root.closest('.demo') || root, run);
  });
})();
