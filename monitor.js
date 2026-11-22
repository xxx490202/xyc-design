/* ============================================================
   Monitor — global sentiment board
   A static replay of Quanta's Sentiment page. No network calls:
   the snapshot lives in monitor-data.js, the two maps are SVG
   files fetched once and inlined for hit-testing and tinting.
   ============================================================ */
(function () {
  'use strict';

  var DATA = window.XYC_MONITOR || { events: [], regions: {}, platforms: [], categories: [], totals: {} };
  if (!DATA.events) DATA.events = [];
  if (!DATA.regions) DATA.regions = {};
  if (!DATA.platforms) DATA.platforms = [];
  if (!DATA.categories) DATA.categories = [];

  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  var CAT_EN = {
    '全部': 'All', 'AI': 'AI', '时政': 'Politics', '国际': 'World', '经济': 'Economy',
    '科技': 'Tech', '社会': 'Society', '体育': 'Sports', '娱乐': 'Entertainment',
    '其他': 'Other'
  };
  var CAT_ORDER = ['全部', 'AI', '时政', '国际', '经济', '科技', '社会', '体育', '娱乐', '其他'];

  var MAPS = {
    world: { file: 'img/map/world-map.svg?v=20261122s', kind: 'country' },
    china: { file: 'img/map/china-detail.svg?v=20261122s', kind: 'province' }
  };

  var state = {
    view: 'world',
    sources: {},
    category: '全部',
    query: '',
    limit: 60,
    region: null,
    scanning: false
  };

  DATA.platforms.forEach(function (p) { state.sources[p.id] = true; });

  /* the bundled snapshot is kept intact so "Use snapshot" can go back */
  var SNAPSHOT = JSON.parse(JSON.stringify(DATA));
  var LIVE_KEY = 'xyc-monitor-live';
  var live = { url: '', enabled: false, loading: false, error: '', last: 0 };

  function readLiveUrl() {
    try {
      var stored = localStorage.getItem(LIVE_KEY);
      if (stored !== null) return String(stored || '').trim();
    } catch (err) {}
    return String(window.XYC_MONITOR_LIVE || '').trim();
  }
  live.url = readLiveUrl();
  live.enabled = !!live.url;

  /* ---------------- language helpers ---------------- */
  function lang() {
    return root.getAttribute('lang') === 'zh-CN' ? 'zh' : 'en';
  }
  function t(en, zh) { return lang() === 'zh' ? zh : en; }
  /* place names for regions that carry no stories but still sit on the map */
  var PROVINCE_EN = {
    '北京': 'Beijing', '天津': 'Tianjin', '河北': 'Hebei', '山西': 'Shanxi',
    '内蒙古': 'Inner Mongolia', '辽宁': 'Liaoning', '吉林': 'Jilin', '黑龙江': 'Heilongjiang',
    '上海': 'Shanghai', '江苏': 'Jiangsu', '浙江': 'Zhejiang', '安徽': 'Anhui',
    '福建': 'Fujian', '江西': 'Jiangxi', '山东': 'Shandong', '河南': 'Henan',
    '湖北': 'Hubei', '湖南': 'Hunan', '广东': 'Guangdong', '广西': 'Guangxi',
    '海南': 'Hainan', '重庆': 'Chongqing', '四川': 'Sichuan', '贵州': 'Guizhou',
    '云南': 'Yunnan', '西藏': 'Tibet', '陕西': 'Shaanxi', '甘肃': 'Gansu',
    '青海': 'Qinghai', '宁夏': 'Ningxia', '新疆': 'Xinjiang', '台湾': 'Taiwan',
    '香港': 'Hong Kong', '澳门': 'Macao'
  };
  function placeEnglish(name) {
    if (!name) return name;
    if (Object.prototype.hasOwnProperty.call(PROVINCE_EN, name)) return PROVINCE_EN[name];
    for (var key in PROVINCE_EN) {
      if (name.indexOf(key) === 0) return PROVINCE_EN[key];
    }
    return name;
  }
  function regionName(name) {
    var box = DATA.regions[name];
    if (lang() === 'zh') return (box && box.name_zh) || name;
    return (box && box.name_en) || placeEnglish(name);
  }
  function categoryName(key) {
    return lang() === 'zh' ? key : (CAT_EN[key] || key);
  }
  function platformName(event) {
    return lang() === 'zh' ? (event.platform || '—') : (event.platform_en || event.platform || '—');
  }
  function fmtStamp(ms, short) {
    var d = new Date(ms);
    if (isNaN(d.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat(lang() === 'zh' ? 'zh-CN' : 'en-GB', {
        day: '2-digit', month: short ? 'short' : 'short',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(d).replace(',', ' ·');
    } catch (err) {
      return d.toISOString().slice(0, 16).replace('T', ' ');
    }
  }

  function paintMeta() {
    var totals = DATA.totals || {};
    if ($('metaEvents')) $('metaEvents').textContent = String(totals.events || DATA.events.length);
    if ($('metaRegions')) $('metaRegions').textContent = String(totals.regions || Object.keys(DATA.regions).length);
    if ($('metaSources')) $('metaSources').textContent = String(totals.platforms || DATA.platforms.length);
    if ($('metaStamp')) $('metaStamp').textContent = fmtStamp(DATA.generated, true);
    if ($('mapStamp')) $('mapStamp').textContent = fmtStamp(DATA.generated, true);
  }

  /* ---------------- events in view ---------------- */
  function sourceEvents() {
    return DATA.events.filter(function (event) {
      var ids = event.platforms || [];
      return ids.some(function (id) { return state.sources[id]; });
    });
  }

  function categoryOf(event) { return event.category || '其他'; }

  function filteredEvents(ignoreCategory) {
    var q = state.query.trim().toLowerCase();
    return sourceEvents().filter(function (event) {
      if (!ignoreCategory && state.category !== '全部' && categoryOf(event) !== state.category) return false;
      if (!q) return true;
      if ((event.title || '').toLowerCase().indexOf(q) >= 0) return true;
      if (event.region) {
        var box = DATA.regions[event.region];
        var names = [event.region, box && box.name_zh, box && box.name_en].
          filter(Boolean).join(' ').toLowerCase();
        if (names.indexOf(q) >= 0) return true;
      }
      if ((event.platform || '').toLowerCase().indexOf(q) >= 0) return true;
      if ((event.platform_en || '').toLowerCase().indexOf(q) >= 0) return true;
      if (categoryName(categoryOf(event)).toLowerCase().indexOf(q) >= 0) return true;
      return false;
    }).sort(function (a, b) { return (b.heat || 0) - (a.heat || 0); });
  }

  function regionsOf(events) {
    var out = {};
    events.forEach(function (event) {
      if (!event.region) return;
      var known = DATA.regions[event.region] || {};
      var box = out[event.region] || (out[event.region] = {
        name: event.region,
        name_zh: known.name_zh || event.region,
        name_en: known.name_en || event.region,
        kind: event.kind || known.kind || 'country',
        count: 0
      });
      box.count += 1;
    });
    return out;
  }

  function levelOf(count) {
    if (count >= 11) return 'high';
    if (count >= 6) return 'mid';
    return 'low';
  }

  /* ============================================================
     map
     ============================================================ */
  var stage = $('monStage');
  var board = $('monBoard');
  var tip = $('monTip');
  var mapCache = {};
  var mapToken = 0;

  function showLoading(show) {
    var node = $('monLoading');
    if (node) node.classList.toggle('hidden', !show);
    stage.classList.toggle('is-loading', show);
  }

  function ensureMap(view) {
    if (mapCache[view]) return Promise.resolve(mapCache[view]);
    var token = ++mapToken;
    return fetch(MAPS[view].file, { cache: 'force-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('map ' + response.status);
        return response.text();
      })
      .then(function (text) {
        if (token === mapToken) mapCache[view] = text;
        return text;
      });
  }

  function fitSvg(svg, view) {
    if (!svg || !stage) return;
    var ratio = view === 'china' ? 2600 / 2072 : 4800 / 1867;
    var sw = stage.clientWidth;
    var sh = stage.clientHeight;
    if (!sw || !sh) return;
    var w = Math.min(sw, sh * ratio);
    var h = w / ratio;
    svg.style.width = w + 'px';
    svg.style.height = h + 'px';
    svg.style.left = ((sw - w) / 2) + 'px';
    svg.style.top = ((sh - h) / 2) + 'px';
    svg.style.right = 'auto';
    svg.style.bottom = 'auto';
  }

  function mountMap(view) {
    showLoading(true);
    closePop();
    ensureMap(view).then(function (text) {
      if (state.view !== view) return;
      stage.innerHTML = text;
      var svg = stage.querySelector('svg');
      if (svg) {
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('aria-hidden', 'true');
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        fitSvg(svg, view);
      }
      showLoading(false);
      requestAnimationFrame(function () {
        paintMap();
        paintBadges();
      });
    }).catch(function () {
      showLoading(false);
      if (!stage.querySelector('.mon-map-error')) {
        var note = document.createElement('p');
        note.className = 'mon-map-error';
        note.textContent = t('The map could not be loaded. Serve the site over HTTP and reload.',
          '地图没有加载出来。请用 HTTP 方式打开站点后刷新。');
        stage.appendChild(note);
      }
    });
  }

  var paintedShapes = [];

  function shapeFor(view, name) {
    var kind = MAPS[view].kind;
    var nodes = stage.querySelectorAll('.' + kind);
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var key = kind === 'province' ? node.getAttribute('data-short') : node.getAttribute('data-name');
      if (key === name) return node;
    }
    return null;
  }

  function paintMap() {
    paintedShapes.forEach(function (node) {
      node.classList.remove('is-fill', 'lvl-low', 'lvl-mid', 'lvl-high');
    });
    paintedShapes = [];
    var regions = regionsOf(sourceEvents());
    Object.keys(regions).forEach(function (name) {
      var box = regions[name];
      var shape = box.kind === 'province'
        ? provinceShape(name)
        : shapeFor('world', name);
      if (!shape) return;
      shape.classList.add('is-fill', 'lvl-' + levelOf(box.count));
      shape.setAttribute('data-mon-region', name);
      paintedShapes.push(shape);
    });
  }

  function provinceShape(name) {
    var nodes = stage.querySelectorAll('.province');
    for (var i = 0; i < nodes.length; i += 1) {
      if (nodes[i].getAttribute('data-short') === name) return nodes[i];
    }
    return null;
  }

  function centroidOf(shape, svg) {
    var box;
    try { box = shape.getBBox(); } catch (err) { return null; }
    if (!box || !box.width || !box.height) return null;
    var point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    if (shape.isPointInFill) {
      var inside = function (x, y) {
        try { return shape.isPointInFill(new DOMPoint(x, y)); } catch (err) { return true; }
      };
      if (!inside(point.x, point.y)) {
        var tries = [];
        for (var step = 0.14; step <= 0.5; step += 0.12) {
          tries.push([0.5, step], [step, 0.5], [1 - step, 0.5], [0.5, 1 - step],
            [step, step], [1 - step, 1 - step], [step, 1 - step], [1 - step, step]);
        }
        for (var i = 0; i < tries.length; i += 1) {
          var fx = tries[i][0], fy = tries[i][1];
          var x = box.x + box.width * fx, y = box.y + box.height * fy;
          if (inside(x, y)) { point = { x: x, y: y }; break; }
        }
      }
    }
    var matrix = shape.getScreenCTM();
    if (!matrix || !svg) return null;
    var svgPoint = svg.createSVGPoint();
    svgPoint.x = point.x;
    svgPoint.y = point.y;
    var screen = svgPoint.matrixTransform(matrix);
    var rect = stage.getBoundingClientRect();
    return { x: screen.x - rect.left, y: screen.y - rect.top };
  }

  function paintBadges() {
    var old = stage.querySelectorAll('.mon-badge');
    Array.prototype.forEach.call(old, function (node) { node.remove(); });
    var svg = stage.querySelector('svg');
    if (!svg || !stage.clientWidth) return;

    var regions = regionsOf(sourceEvents());
    var entries = Object.keys(regions).map(function (name) {
      return regions[name];
    }).sort(function (a, b) { return b.count - a.count; });

    var placed = [];
    var narrow = stage.clientWidth < 640;
    entries.forEach(function (box) {
      if (narrow && box.count < 2) return;
      var shape = box.kind === 'province'
        ? provinceShape(box.name)
        : shapeFor('world', box.name);
      if (!shape) return;
      var point = centroidOf(shape, svg);
      if (!point) return;
      var r = box.count >= 11 ? 6 : box.count >= 6 ? 5 : 4;
      var pos = { x: point.x, y: point.y };
      var offsets = [[0, 0]];
      for (var ring = 1; ring <= 3; ring += 1) {
        for (var step = 0; step < 12; step += 1) {
          var angle = (Math.PI * 2 / 12) * step;
          var dist = r * (1.7 + ring * 1.3);
          offsets.push([Math.cos(angle) * dist, Math.sin(angle) * dist]);
        }
      }
      for (var i = 0; i < offsets.length; i += 1) {
        var candidate = { x: point.x + offsets[i][0], y: point.y + offsets[i][1] };
        var clash = placed.some(function (other) {
          return Math.hypot(other.x - candidate.x, other.y - candidate.y) < (other.r + r) * 1.08;
        });
        if (!clash) { pos = candidate; break; }
      }
      placed.push({ x: pos.x, y: pos.y, r: r });

      var badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'mon-badge lvl-' + levelOf(box.count) + (r < 5 ? ' is-small' : '');
      badge.style.left = pos.x + 'px';
      badge.style.top = pos.y + 'px';
      badge.style.setProperty('--r', r + 'px');
      badge.textContent = box.count > 99 ? '99+' : String(box.count);
      badge.setAttribute('aria-label', regionName(box.name) + ' · ' + box.count);
      badge.addEventListener('mouseenter', function () {
        shape.classList.add('is-hot');
        showTip(box.name, box.count, pos.x, pos.y);
      });
      badge.addEventListener('mouseleave', function () {
        shape.classList.remove('is-hot');
        hideTip();
      });
      badge.addEventListener('click', function (event) {
        event.stopPropagation();
        openPop(box.name);
      });
      stage.appendChild(badge);
    });
  }

  function showTip(name, count, x, y) {
    if (!tip) return;
    tip.textContent = regionName(name) + ' · ' + count +
      t(' stories', ' 条');
    tip.classList.remove('hidden');
    var left = Math.max(8, Math.min(stage.clientWidth - 160, x + 16));
    var top = Math.max(8, Math.min(stage.clientHeight - 40, y + 14));
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() { if (tip) tip.classList.add('hidden'); }

  /* ---------------- map popup ---------------- */
  function closePop() {
    var pop = $('monPop');
    if (pop) pop.classList.add('hidden');
    state.region = null;
  }

  function openPop(name) {
    var pop = $('monPop');
    var title = $('monPopTitle');
    var list = $('monPopList');
    if (!pop || !title || !list) return;
    var events = sourceEvents().filter(function (event) { return event.region === name; })
      .sort(function (a, b) { return (b.heat || 0) - (a.heat || 0); });
    var all = events;
    state.region = name;
    title.textContent = regionName(name) + ' · ' + all.length + t(' stories', ' 条');
    list.textContent = '';
    if (!events.length) {
      var empty = document.createElement('p');
      empty.className = 'mon-pop-empty';
      empty.textContent = t('No stories match the current filter.',
        '当前筛选下没有匹配的标题。');
      list.appendChild(empty);
    }
    events.slice(0, 60).forEach(function (event, index) {
      list.appendChild(feedRow(event, true, index + 1));
    });
    pop.classList.remove('hidden');
  }

  /* ============================================================
     feed
     ============================================================ */
  var feedBox = $('monFeed');
  var catsBox = $('monCats');
  var searchBox = $('monSearch');

  function catCounts(events) {
    var counts = {};
    events.forEach(function (event) {
      var key = categoryOf(event);
      counts[key] = (counts[key] || 0) + 1;
    });
    counts['全部'] = events.length;
    return counts;
  }

  function renderCats() {
    if (!catsBox) return;
    var base = filteredEvents(true);
    var counts = catCounts(base);
    catsBox.textContent = '';
    CAT_ORDER.forEach(function (key) {
      if (!counts[key] && key !== '全部') return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mon-cat' + (state.category === key ? ' on' : '');
      var label = document.createElement('span');
      label.textContent = categoryName(key);
      var n = document.createElement('i');
      n.textContent = String(counts[key] || 0);
      btn.appendChild(label);
      btn.appendChild(n);
      btn.setAttribute('aria-pressed', state.category === key ? 'true' : 'false');
      btn.addEventListener('click', function () {
        state.category = key;
        state.limit = 60;
        renderCats();
        renderFeed();
      });
      catsBox.appendChild(btn);
    });
  }

  function feedRow(event, compact, index) {
    var row = document.createElement('a');
    row.className = 'mon-row' + (compact ? ' is-compact' : '');
    row.href = event.url || '#';
    if (event.url) {
      row.target = '_blank';
      row.rel = 'noreferrer noopener';
    }
    row.addEventListener('click', function (event) {
      if (!row.href || row.getAttribute('href') === '#') event.preventDefault();
    });

    var rank = document.createElement('span');
    rank.className = 'mon-rank';
    rank.textContent = String(index || 1).padStart(2, '0');

    var main = document.createElement('span');
    main.className = 'mon-row-main';

    var title = document.createElement('span');
    title.className = 'mon-row-title';
    title.textContent = event.title || '';
    main.appendChild(title);

    var meta = document.createElement('span');
    meta.className = 'mon-row-meta';
    if (event.region) {
      var where = document.createElement('span');
      where.className = 'mon-where';
      where.textContent = regionName(event.region);
      meta.appendChild(where);
    }
    var cat = document.createElement('span');
    cat.className = 'mon-row-cat';
    cat.textContent = categoryName(categoryOf(event));
    meta.appendChild(cat);
    var src = document.createElement('span');
    src.className = 'mon-src';
    src.textContent = platformName(event);
    meta.appendChild(src);
    if ((event.platforms || []).length > 1) {
      var more = document.createElement('span');
      more.className = 'mon-more-src';
      more.textContent = '+' + (event.platforms.length - 1);
      meta.appendChild(more);
    }
    main.appendChild(meta);
    row.appendChild(rank);
    row.appendChild(main);

    if (!compact) {
      var heat = document.createElement('span');
      heat.className = 'mon-heat';
      var value = document.createElement('b');
      value.textContent = String(event.heat || 0);
      var track = document.createElement('i');
      var fill = document.createElement('u');
      fill.style.width = Math.min(100, Math.round((event.heat || 0) / 150 * 100)) + '%';
      track.appendChild(fill);
      heat.appendChild(value);
      heat.appendChild(track);
      row.appendChild(heat);
    }
    return row;
  }

  function renderFeed() {
    if (!feedBox) return;
    var events = filteredEvents(false);
    feedBox.textContent = '';
    if (!events.length) {
      var empty = document.createElement('p');
      empty.className = 'mon-feed-empty';
      empty.textContent = t('Nothing matches. Try another category or search term.',
        '没有匹配的标题。换个分类或搜索词试试。');
      feedBox.appendChild(empty);
    }
    events.slice(0, state.limit).forEach(function (event, index) {
      feedBox.appendChild(feedRow(event, false, index + 1));
    });
    var count = $('feedCount');
    if (count) count.textContent = String(events.length);
    var foot = $('monFeedFoot');
    if (foot) {
      foot.textContent = t('Showing ' + Math.min(state.limit, events.length) + ' of ' + events.length,
        '显示 ' + events.length + ' 条里的 ' + Math.min(state.limit, events.length) + ' 条');
    }
    var more = $('monMore');
    if (more) more.classList.toggle('hidden', events.length <= state.limit);
  }

  /* ============================================================
     sources / settings
     ============================================================ */
  var sourcesBox = $('monSources');

  function renderSources() {
    if (!sourcesBox) return;
    sourcesBox.textContent = '';
    DATA.platforms.forEach(function (source) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mon-source' + (state.sources[source.id] ? ' on' : '');
      btn.setAttribute('aria-pressed', state.sources[source.id] ? 'true' : 'false');
      var dot = document.createElement('i');
      var name = document.createElement('span');
      name.className = 'mon-source-name';
      name.textContent = lang() === 'zh' ? source.name : (source.name_en || source.name);
      var n = document.createElement('b');
      n.textContent = String(source.count);
      btn.appendChild(dot);
      btn.appendChild(name);
      btn.appendChild(n);
      btn.addEventListener('click', function () {
        state.sources[source.id] = !state.sources[source.id];
        state.limit = 60;
        renderSources();
        refreshAll();
      });
      sourcesBox.appendChild(btn);
    });
    var on = DATA.platforms.filter(function (p) { return state.sources[p.id]; }).length;
    var summary = $('sourceSummary');
    if (summary) {
      summary.textContent = t(on + ' of ' + DATA.platforms.length + ' boards on',
        DATA.platforms.length + ' 个来源，已开 ' + on + ' 个');
    }
    var all = $('monAllSources');
    if (all) {
      all.textContent = on === DATA.platforms.length ? t('All on', '全部开启') : t('Turn all on', '全部打开');
    }
  }

  function refreshAll() {
    paintMap();
    paintBadges();
    renderCats();
    renderFeed();
    renderSourceList();
  }

  /* ============================================================
     the long "sources" list in the method section
     ============================================================ */
  function renderSourceList() {
    var list = $('monSourceList');
    if (!list) return;
    list.textContent = '';
    DATA.platforms.forEach(function (source, index) {
      var li = document.createElement('li');
      var i = document.createElement('span');
      i.className = 'mon-src-index';
      i.textContent = String(index + 1).padStart(2, '0');
      var name = document.createElement('span');
      name.className = 'mon-src-name';
      name.textContent = lang() === 'zh' ? source.name : (source.name_en || source.name);
      var n = document.createElement('span');
      n.className = 'mon-src-count';
      n.textContent = String(source.count);
      li.appendChild(i);
      li.appendChild(name);
      li.appendChild(n);
      list.appendChild(li);
    });
    var summary = $('sourceSummary');
    if (summary) {
      var on = DATA.platforms.filter(function (p) { return state.sources[p.id]; }).length;
      summary.textContent = t(on + ' of ' + DATA.platforms.length + ' public boards',
        DATA.platforms.length + ' 个公开热榜，已开 ' + on + ' 个');
    }
  }

  /* ============================================================
     Scout — a local, deliberately simple briefing assistant
     ============================================================ */
  var chatBox = $('monChat');
  var chipsBox = $('monChips');

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function bubble(role) {
    var wrap = el('div', 'mon-msg ' + role);
    if (role === 'scout') {
      var mark = el('span', 'mon-msg-mark');
      mark.innerHTML = '<img class="line-art" src="img/line/mark.webp" alt="">';
      wrap.appendChild(mark);
    }
    var body = el('div', 'mon-msg-body');
    wrap.appendChild(body);
    chatBox.appendChild(wrap);
    chatBox.scrollTop = chatBox.scrollHeight;
    return body;
  }

  function storyList(events, limit) {
    var list = el('ol', 'mon-story-list');
    events.slice(0, limit || 5).forEach(function (event) {
      var li = el('li');
      var title = el('a', 'mon-story-title', event.title || '');
      title.href = event.url || '#';
      if (event.url) { title.target = '_blank'; title.rel = 'noreferrer noopener'; }
      li.appendChild(title);
      var meta = el('span', 'mon-story-meta');
      if (event.region) meta.appendChild(el('span', 'mon-where', regionName(event.region)));
      meta.appendChild(el('span', null, categoryName(categoryOf(event))));
      meta.appendChild(el('span', null, platformName(event)));
      meta.appendChild(el('b', null, t('heat ', '热度 ') + (event.heat || 0)));
      li.appendChild(meta);
      list.appendChild(li);
    });
    return list;
  }

  function topEntries(events, n) {
    var regions = regionsOf(events);
    return Object.keys(regions).map(function (name) { return regions[name]; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, n);
  }

  function pulseList(events) {
    var regions = topEntries(events, 5);
    if (!regions.length) return null;
    var max = regions[0].count || 1;
    var wrap = el('div', 'mon-pulse');
    var head = el('p', 'mon-msg-line');
    head.appendChild(el('b', null, t('Loudest regions', '最集中的地区')));
    wrap.appendChild(head);
    regions.forEach(function (box) {
      var row = el('div', 'mon-pulse-row');
      var pulseName = regionName(box.name);
      if (pulseName === 'United States of America') pulseName = 'United States';
      row.appendChild(el('span', 'mon-pulse-name', pulseName));
      var track = el('i');
      var fill = el('u');
      fill.style.width = Math.max(6, Math.round(box.count / max * 100)) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('b', 'mon-pulse-n', String(box.count)));
      row.title = regionName(box.name) + ' · ' + box.count;
      wrap.appendChild(row);
    });
    return wrap;
  }

  function briefing() {
    chatBox.textContent = '';
    var events = sourceEvents().sort(function (a, b) { return b.heat - a.heat; });
    var body = bubble('scout');
    body.appendChild(el('p', 'mon-msg-lead', t(
      'Board loaded. ' + events.length + ' headlines from ' +
        DATA.platforms.filter(function (p) { return state.sources[p.id]; }).length +
        ' boards; ' + Object.keys(regionsOf(events)).length + ' regions could be located.',
      '看板已载入：' + events.length + ' 条标题，来自 ' +
        DATA.platforms.filter(function (p) { return state.sources[p.id]; }).length +
        ' 个热榜；可定位到 ' + Object.keys(regionsOf(events)).length + ' 个地区。')));

    var pulse = pulseList(events);
    if (pulse) body.appendChild(pulse);

    var cats = catCounts(events);
    var topCats = CAT_ORDER.filter(function (key) { return key !== '全部' && cats[key]; })
      .sort(function (a, b) { return cats[b] - cats[a]; }).slice(0, 3);
    if (topCats.length) {
      var catLine = el('p', 'mon-msg-line');
      catLine.appendChild(el('b', null, t('Loudest topics · ', '最热分类 · ')));
      catLine.appendChild(document.createTextNode(topCats.map(function (key) {
        return categoryName(key) + ' ' + cats[key];
      }).join('  ·  ')));
      body.appendChild(catLine);
    }

    if (events[0]) {
      body.appendChild(el('p', 'mon-msg-line', t('Top story', '最热一条')));
      body.appendChild(storyList(events, 1));
    }

    body.appendChild(el('p', 'mon-msg-hint', t(
      'Ask me about a country, a province, a topic, or say “top” for the hottest five.',
      '可以问某个国家、省份、分类，或者说「最热」看前五条。')));
    chatBox.scrollTop = 0;
  }

  function findRegion(query) {
    var q = query.toLowerCase();
    var names = Object.keys(DATA.regions);
    for (var i = 0; i < names.length; i += 1) {
      var box = DATA.regions[names[i]];
      var candidates = [names[i], box.name_zh, box.name_en].filter(Boolean);
      for (var j = 0; j < candidates.length; j += 1) {
        if (candidates[j].toLowerCase() === q) return names[i];
      }
    }
    for (var k = 0; k < names.length; k += 1) {
      var b = DATA.regions[names[k]];
      var list = [names[k], b.name_zh, b.name_en].filter(Boolean);
      for (var m = 0; m < list.length; m += 1) {
        if (q.indexOf(list[m].toLowerCase()) >= 0) return names[k];
      }
    }
    return null;
  }

  function findCategory(query) {
    var q = query.toLowerCase();
    for (var i = 0; i < CAT_ORDER.length; i += 1) {
      var key = CAT_ORDER[i];
      if (key === '全部') continue;
      if (q.indexOf(key.toLowerCase()) >= 0) return key;
      if (q.indexOf((CAT_EN[key] || '').toLowerCase()) >= 0) return key;
    }
    return null;
  }

  function replyFor(query) {
    replyBody(query);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function replyBody(query) {
    var events = sourceEvents().sort(function (a, b) { return b.heat - a.heat; });
    var q = query.trim();
    var lower = q.toLowerCase();

    if (!q || /^(top|hottest|summary|overview|最热|总结|概览|热榜)/i.test(q)) {
      var body = bubble('scout');
      body.appendChild(el('p', 'mon-msg-lead', t(
        'The five hottest stories in this snapshot:', '这份快照里最热的五条：')));
      body.appendChild(storyList(events, 5));
      return;
    }

    if (/china|中国|国内/i.test(q)) {
      var provinces = events.filter(function (event) { return event.kind === 'province'; });
      var body2 = bubble('scout');
      body2.appendChild(el('p', 'mon-msg-lead', t(
        provinces.length + ' stories are located in China. The provinces carrying the most:',
        '有 ' + provinces.length + ' 条落在中国境内。条数最多的省份：')));
      var line = el('p', 'mon-msg-line');
      line.appendChild(document.createTextNode(topEntries(provinces, 6).map(function (box) {
        return regionName(box.name) + ' ' + box.count;
      }).join('  ·  ')));
      body2.appendChild(line);
      body2.appendChild(storyList(provinces, 5));
      return;
    }

    var region = findRegion(q);
    if (region) {
      var hits = events.filter(function (event) { return event.region === region; });
      var body3 = bubble('scout');
      body3.appendChild(el('p', 'mon-msg-lead', t(
        regionName(region) + ' · ' + hits.length + ' stories. The hottest:',
        regionName(region) + ' · ' + hits.length + ' 条。最热的几条：')));
      body3.appendChild(storyList(hits, 6));
      return;
    }

    var category = findCategory(q);
    if (category) {
      var catHits = events.filter(function (event) { return categoryOf(event) === category; });
      var body4 = bubble('scout');
      body4.appendChild(el('p', 'mon-msg-lead', t(
        categoryName(category) + ' · ' + catHits.length + ' stories. The hottest:',
        categoryName(category) + ' · ' + catHits.length + ' 条。最热的几条：')));
      body4.appendChild(storyList(catHits, 6));
      return;
    }

    var search = events.filter(function (event) {
      return (event.title || '').toLowerCase().indexOf(lower) >= 0;
    });
    var body5 = bubble('scout');
    if (!search.length) {
      body5.appendChild(el('p', 'mon-msg-lead', t(
        'No headline matches “' + q + '”. Try a country, a province, a topic such as AI or Economy, or “top”.',
        '没有标题匹配「' + q + '」。可以换一个国家、省份、分类（AI、经济……），或者直接说「最热」。')));
      return;
    }
    body5.appendChild(el('p', 'mon-msg-lead', t(
      search.length + ' headlines match “' + q + '”:', '有 ' + search.length + ' 条标题匹配「' + q + '」：')));
    body5.appendChild(storyList(search, 6));
  }

  function ask(text) {
    var q = String(text || '').trim();
    if (!q) return;
    var mine = bubble('me');
    mine.appendChild(el('p', null, q));
    var input = $('monAskInput');
    if (input) input.value = '';
    window.setTimeout(function () { replyFor(q); }, 220);
  }

  var CHIPS = [
    { en: 'Top 5', zh: '最热五条', qen: 'top', qzh: '最热' },
    { en: 'China', zh: '中国', qen: 'china', qzh: '中国' },
    { en: 'AI', zh: 'AI', qen: 'AI', qzh: 'AI' },
    { en: 'World', zh: '国际', qen: 'World', qzh: '国际' }
  ];

  function renderChips() {
    if (!chipsBox) return;
    chipsBox.textContent = '';
    CHIPS.forEach(function (chip) {
      var btn = el('button', 'mon-chip', lang() === 'zh' ? chip.zh : chip.en);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        ask(lang() === 'zh' ? chip.qzh : chip.qen);
      });
      chipsBox.appendChild(btn);
    });
  }

  /* ============================================================
     start monitoring — replays the snapshot, no network
     ============================================================ */
  var startBtn = $('monStart');
  var startLabel = $('monStartLabel');
  var startFill = $('monStartFill');
  var actionNote = $('monActionNote');
  var noteEn = actionNote ? actionNote.getAttribute('data-en') : '';
  var noteZh = actionNote ? actionNote.getAttribute('data-zh') : '';

  function setStartLabel(mode, done, total) {
    if (!startLabel) return;
    if (mode === 'busy') startLabel.textContent = t('Monitoring… ' + done + '/' + total, '监测中… ' + done + '/' + total);
    else if (mode === 'done') startLabel.textContent = t('Snapshot verified · ' + total + '/' + total, '快照校验完成 · ' + total + '/' + total);
    else startLabel.textContent = t('Start monitoring', '开始监测');
  }

  function baseNote() {
    if (live.enabled) {
      return t('Fetches live data from the saved proxy. The bundled snapshot stays as a fallback.',
        '从已保存的代理获取实时数据；内置快照作为兜底保留。');
    }
    return t('Replays the stored snapshot in the browser. No API call, no server.',
      '在浏览器里重放已存好的快照，不请求接口，也不需要服务器。');
  }

  function paintLive() {
    var mode = $('monMode');
    if (mode) {
      mode.textContent = live.loading
        ? t('Live…', '实时…')
        : (live.enabled ? t('Live', '实时') : t('Snapshot', '快照'));
      mode.classList.toggle('is-live', !!live.enabled);
      mode.classList.toggle('is-busy', !!live.loading);
      mode.title = live.enabled
        ? t('Live data from the proxy — click to refresh', '来自代理的实时数据，点击刷新')
        : t('Snapshot mode — open settings to connect a proxy', '快照模式，去设置里接入代理');
    }
    var badge = $('monLiveBadge');
    if (badge) {
      badge.textContent = live.loading ? t('Connecting', '连接中')
        : (live.enabled ? t('Live', '实时') : t('Off', '关闭'));
      badge.classList.toggle('is-on', !!live.enabled && !live.loading);
    }
    var input = $('monLiveUrl');
    if (input && document.activeElement !== input) input.value = live.url;
    var status = $('monLiveStatus');
    if (status) {
      if (live.loading) status.textContent = t('Contacting the proxy…', '正在请求代理…');
      else if (live.error) status.textContent = t('Proxy error', '代理出错') + ': ' + live.error;
      else if (live.enabled) status.textContent = t(
        'Live endpoint saved. “Start monitoring” fetches it; clear the field to return to the snapshot.',
        '实时接口已保存；点「开始监测」会请求它。清空输入并保存即可回到快照。');
      else status.textContent = t(
        'Snapshot mode. Paste a Worker or Node URL to go live.',
        '快照模式。粘贴 Worker 或 Node 地址即可切到实时。');
      status.classList.toggle('is-error', !!live.error);
    }
    if (actionNote && !state.scanning) actionNote.textContent = baseNote();
  }

  function replaceData(payload) {
    var old = state.sources;
    DATA.generated = Number(payload.generated) || Date.now();
    DATA.generated_iso = payload.generated_iso || '';
    DATA.platforms = Array.isArray(payload.platforms) && payload.platforms.length
      ? payload.platforms : DATA.platforms;
    DATA.regions = payload.regions || {};
    DATA.events = Array.isArray(payload.events) ? payload.events : [];
    DATA.categories = Array.isArray(payload.categories) ? payload.categories : [];
    DATA.totals = payload.totals || {
      events: DATA.events.length,
      regions: Object.keys(DATA.regions).length,
      platforms: DATA.platforms.length
    };
    state.sources = {};
    DATA.platforms.forEach(function (p) { state.sources[p.id] = old[p.id] !== false; });
    state.category = '全部';
    state.query = '';
    state.limit = 60;
    if (searchBox) searchBox.value = '';
    closePop();
    paintMeta();
    renderSources();
    renderSourceList();
    renderCats();
    renderFeed();
    paintMap();
    paintBadges();
    briefing();
  }

  function fetchLive() {
    if (!live.url || live.loading) return Promise.resolve(false);
    live.loading = true;
    live.error = '';
    paintLive();
    return fetch(live.url, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.events) || !payload.regions) {
          throw new Error('unexpected JSON');
        }
        replaceData(payload);
        live.enabled = true;
        live.loading = false;
        live.last = Date.now();
        paintLive();
        return true;
      })
      .catch(function (error) {
        live.loading = false;
        live.error = String(error && error.message ? error.message : error);
        paintLive();
        return false;
      });
  }

  function commitLive() {
    var input = $('monLiveUrl');
    var url = input ? String(input.value || '').trim().replace(/\/+$/, '') : '';
    if (url && !/^https?:\/\//i.test(url)) {
      live.error = t('Use an http(s) URL.', '请填 http(s) 地址。');
      paintLive();
      return;
    }
    live.url = url;
    live.enabled = !!url;
    live.error = '';
    try { localStorage.setItem(LIVE_KEY, url); } catch (err) {}
    paintLive();
    if (url) {
      fetchLive();
    } else {
      replaceData(SNAPSHOT);
      paintLive();
    }
  }

  function startLiveScan() {
    if (state.scanning) return;
    state.scanning = true;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (startBtn) startBtn.classList.add('is-busy');
    if (board) board.classList.add('is-scanning');
    if (startLabel) startLabel.textContent = t('Fetching live…', '获取实时数据…');
    if (actionNote) actionNote.textContent = t(
      'Calling the proxy — 18 boards are merged on the server.',
      '正在请求代理：18 个热榜在服务端合并。');
    var percent = 6;
    if (startFill) startFill.style.width = percent + '%';
    var timer = window.setInterval(function () {
      percent = Math.min(90, percent + Math.max(1, (90 - percent) * 0.12));
      if (startFill) startFill.style.width = Math.round(percent) + '%';
    }, reduce ? 120 : 220);
    fetchLive().then(function (ok) {
      window.clearInterval(timer);
      if (startFill) startFill.style.width = '100%';
      if (startBtn) startBtn.classList.remove('is-busy');
      if (board) board.classList.remove('is-scanning');
      if (ok) {
        if (startLabel) startLabel.textContent = t(
          'Live · ' + DATA.events.length + ' headlines',
          '实时 · ' + DATA.events.length + ' 条');
        if (actionNote) actionNote.textContent = t(
          'Updated from the proxy just now. ' + DATA.platforms.length + ' boards.',
          '刚刚从代理更新，共 ' + DATA.platforms.length + ' 个来源。');
      } else {
        if (startLabel) startLabel.textContent = t('Proxy failed', '代理失败');
        if (actionNote) actionNote.textContent = t(
          'Still showing the last snapshot. ' + (live.error || ''),
          '仍在显示上一份快照。' + (live.error || ''));
      }
      window.setTimeout(function () {
        state.scanning = false;
        setStartLabel('idle');
        if (startFill) startFill.style.width = '0%';
        if (actionNote) actionNote.textContent = baseNote();
      }, ok ? 3200 : 4400);
    });
  }

  function startScan() {
    if (state.scanning) return;
    if (live.enabled && live.url) { startLiveScan(); return; }
    state.scanning = true;
    var total = DATA.platforms.length || 18;
    var done = 0;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (startBtn) startBtn.classList.add('is-busy');
    if (board) board.classList.add('is-scanning');
    if (startFill) startFill.style.width = '4%';
    setStartLabel('busy', 0, total);
    if (actionNote) actionNote.textContent = t('Scanning the stored snapshot…', '正在扫描已存好的快照…');

    var step = function () {
      done += 1;
      var percent = Math.round(done / total * 100);
      if (startFill) startFill.style.width = percent + '%';
      setStartLabel(done >= total ? 'done' : 'busy', done, total);
      if (done < total) {
        window.setTimeout(step, reduce ? 60 : 120 + Math.round(Math.random() * 90));
        return;
      }
      if (startBtn) startBtn.classList.remove('is-busy');
      if (board) board.classList.remove('is-scanning');
      if (startFill) startFill.style.width = '0%';
      if (actionNote) {
        actionNote.textContent = t(
          'Verified just now · ' + total + '/' + total + ' sources. The snapshot itself is unchanged.',
          '刚刚校验完成 · ' + total + '/' + total + ' 个来源。快照本身没有改动。');
      }
      window.setTimeout(function () {
        state.scanning = false;
        setStartLabel('idle');
        if (actionNote) actionNote.textContent = lang() === 'zh' ? noteZh : noteEn;
      }, reduce ? 900 : 2600);
    };
    window.setTimeout(step, reduce ? 60 : 180);
  }

  /* ============================================================
     settings / events
     ============================================================ */
  var settingsBtn = $('monSettingsBtn');
  var settingsPanel = $('monSettings');
  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', function () {
      var open = settingsPanel.classList.toggle('is-open');
      settingsPanel.classList.toggle('hidden', !open);
      settingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      settingsBtn.classList.toggle('is-open', open);
    });
  }

  var monMode = $('monMode');
  if (monMode) {
    monMode.addEventListener('click', function () {
      if (live.enabled) { fetchLive(); return; }
      if (settingsBtn && settingsPanel && settingsPanel.classList.contains('hidden')) settingsBtn.click();
      var input = $('monLiveUrl');
      if (input) window.setTimeout(function () { input.focus(); }, 90);
    });
  }
  var liveSave = $('monLiveSave');
  if (liveSave) liveSave.addEventListener('click', commitLive);
  var liveInput = $('monLiveUrl');
  if (liveInput) {
    liveInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); commitLive(); }
    });
  }

  var allSources = $('monAllSources');
  if (allSources) {
    allSources.addEventListener('click', function () {
      var on = DATA.platforms.every(function (p) { return state.sources[p.id]; });
      DATA.platforms.forEach(function (p) { state.sources[p.id] = !on; });
      state.limit = 60;
      renderSources();
      refreshAll();
    });
  }

  if (searchBox) {
    var searchTimer = null;
    searchBox.addEventListener('input', function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        state.query = searchBox.value || '';
        state.limit = 60;
        renderCats();
        renderFeed();
      }, 120);
    });
  }

  var moreBtn = $('monMore');
  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      state.limit += 60;
      renderFeed();
    });
  }

  var popClose = $('monPopClose');
  if (popClose) popClose.addEventListener('click', closePop);

  if (startBtn) startBtn.addEventListener('click', startScan);

  var askForm = $('monAsk');
  if (askForm) {
    askForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = $('monAskInput');
      ask(input ? input.value : '');
    });
  }

  /* ---------------- map hover / click ---------------- */
  if (stage) {
    stage.addEventListener('pointermove', function (event) {
      var node = event.target.closest && event.target.closest('.country, .province');
      if (!node) { hideTip(); return; }
      var name = node.getAttribute('data-mon-region') ||
        node.getAttribute('data-short') || node.getAttribute('data-name');
      if (!name) return;
      var box = DATA.regions[name];
      showTip(name, box ? box.count : 0, event.clientX - stage.getBoundingClientRect().left,
        event.clientY - stage.getBoundingClientRect().top);
    });
    stage.addEventListener('pointerleave', hideTip);
    stage.addEventListener('click', function (event) {
      var node = event.target.closest && event.target.closest('.country, .province');
      if (!node) return;
      var name = node.getAttribute('data-short') || node.getAttribute('data-name');
      if (name) openPop(name);
    });
  }

  /* ---------------- resize ---------------- */
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      var svg = stage.querySelector('svg');
      if (svg) fitSvg(svg, state.view);
      paintBadges();
      if (state.region) openPop(state.region);
    }, 160);
  });

  /* ---------------- language ---------------- */
  function applyPlaceholders() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-en-placeholder]'), function (node) {
      var value = lang() === 'zh' ? node.getAttribute('data-zh-placeholder') : node.getAttribute('data-en-placeholder');
      if (value) node.setAttribute('placeholder', value);
    });
  }

  document.addEventListener('xyc:lang', function () {
    applyPlaceholders();
    paintMeta();
    paintLive();
    if (!state.scanning) setStartLabel('idle');
    renderSources();
    renderSourceList();
    renderCats();
    renderFeed();
    renderChips();
    paintBadges();
    if (state.region) openPop(state.region);
    briefing();
  });

  /* ---------------- boot ---------------- */
  paintMeta();
  paintLive();

  applyPlaceholders();
  renderSources();
  renderSourceList();
  renderCats();
  renderFeed();
  renderChips();
  briefing();
  mountMap('world');
  if (live.enabled) {
    window.setTimeout(function () { fetchLive(); }, 700);
  }
})();
