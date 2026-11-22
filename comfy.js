/* ============================================================
   ComfyUI — workflow cards + a node graph drawn from the JSON
   ============================================================ */
(function () {
  'use strict';

  var DATA = window.XYC_COMFY;
  if (!DATA || !DATA.workflows || !DATA.workflows.length) return;

  var NS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;
  var grid = document.getElementById('comfyGrid');
  var tabs = document.getElementById('comfyTabs');
  var svg = document.getElementById('comfySvg');
  var scroll = document.getElementById('comfyScroll');
  var nameNode = document.getElementById('comfyGraphName');
  var footNode = document.getElementById('comfyGraphFoot');
  var zoomLabel = document.getElementById('comfyZoomLabel');

  var active = DATA.workflows[0].id;
  var scale = window.innerWidth <= 640 ? 0.78 : 0.7;

  function lang() { return root.getAttribute('lang') === 'zh-CN' ? 'zh' : 'en'; }
  function t(en, zh) { return lang() === 'zh' ? zh : en; }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function workflow(id) {
    for (var i = 0; i < DATA.workflows.length; i += 1) {
      if (DATA.workflows[i].id === id) return DATA.workflows[i];
    }
    return DATA.workflows[0];
  }

  function nameOf(wf) { return lang() === 'zh' ? wf.name_zh : wf.name_en; }
  function tagOf(wf) { return lang() === 'zh' ? wf.tag_zh : wf.tag_en; }
  function descOf(wf) { return lang() === 'zh' ? wf.desc_zh : wf.desc_en; }

  function truncate(text, max) {
    var value = String(text || '').replace(/\s+/g, ' ').trim();
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
  }

  /* ---------------- cards ---------------- */
  var CARD_ART = {
    basic: 'illu-land-clouds-v',
    hq: 'illu-land-forest',
    reference: 'illu-land-lake',
    default: 'illu-land-sunset'
  };

  function renderCards() {
    if (!grid) return;
    grid.textContent = '';
    DATA.workflows.forEach(function (wf, index) {
      var card = el('article', 'comfy-card');
      card.setAttribute('data-workflow', wf.id);
      card.style.animationDelay = (index * 70) + 'ms';

      if (CARD_ART[wf.id]) {
        var art = el('div', 'comfy-card-art');
        var artImg = document.createElement('img');
        artImg.className = 'line-art';
        artImg.src = 'img/line/' + CARD_ART[wf.id] + '.webp';
        artImg.width = 512;
        artImg.height = 512;
        artImg.loading = 'lazy';
        artImg.decoding = 'async';
        artImg.alt = '';
        art.appendChild(artImg);
        card.appendChild(art);
      }

      var top = el('div', 'comfy-card-top');
      top.appendChild(el('span', 'comfy-num', String(index + 1).padStart(2, '0')));
      top.appendChild(el('span', 'comfy-card-tag', tagOf(wf)));
      card.appendChild(top);

      card.appendChild(el('h3', null, nameOf(wf)));
      card.appendChild(el('p', 'comfy-card-desc', descOf(wf)));

      var pipe = el('div', 'comfy-pipe');
      var stages = lang() === 'zh' ? wf.pipe_zh : wf.pipe_en;
      stages.forEach(function (stage, stageIndex) {
        if (stageIndex) pipe.appendChild(el('span', 'comfy-pipe-arrow', '→'));
        pipe.appendChild(el('span', 'comfy-pipe-stage', stage));
      });
      card.appendChild(pipe);

      var chips = el('div', 'comfy-chips');
      [
        [t('steps', '步数'), wf.steps],
        ['CFG', wf.cfg],
        [t('sampler', '采样器'), wf.sampler],
        [t('denoise', '降噪'), wf.denoise],
        [t('size', '尺寸'), wf.resolution]
      ].forEach(function (pair) {
        var chip = el('span', 'comfy-chip');
        chip.appendChild(el('i', null, pair[0]));
        chip.appendChild(el('b', null, pair[1]));
        chips.appendChild(chip);
      });
      card.appendChild(chips);

      var actions = el('div', 'comfy-actions');
      var open = el('button', 'comfy-open', t('View graph', '看节点图'));
      open.type = 'button';
      open.addEventListener('click', function () {
        selectWorkflow(wf.id, true);
      });
      actions.appendChild(open);
      var download = el('a', 'comfy-json', 'JSON');
      download.href = wf.file;
      download.setAttribute('download', '');
      actions.appendChild(download);
      card.appendChild(actions);

      grid.appendChild(card);
    });
  }

  /* ---------------- tabs ---------------- */
  function renderTabs() {
    if (!tabs) return;
    tabs.textContent = '';
    DATA.workflows.forEach(function (wf) {
      var btn = el('button', 'comfy-tab' + (wf.id === active ? ' on' : ''), nameOf(wf));
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', wf.id === active ? 'true' : 'false');
      btn.setAttribute('data-workflow', wf.id);
      btn.addEventListener('click', function () { selectWorkflow(wf.id); });
      tabs.appendChild(btn);
    });
  }

  /* ---------------- graph ---------------- */
  var TYPE_CLASS = {
    MODEL: 'cg-model',
    CLIP: 'cg-clip',
    CONDITIONING: 'cg-cond',
    LATENT: 'cg-latent',
    VAE: 'cg-vae',
    IMAGE: 'cg-image'
  };

  function summaryLines(node) {
    var w = node.widgets || [];
    var type = node.type;
    var lines = [];
    function push(value, max) {
      var text = truncate(value, max || 54);
      if (text) lines.push(text);
    }
    if (type === 'CheckpointLoaderSimple') {
      push(String(w[0] || '').split('/').pop(), 46);
      push(t('checkpoint', '模型'), 20);
    } else if (type === 'CLIPTextEncode') {
      var text = String(w[0] || '');
      var first = text.slice(0, 52);
      var rest = text.slice(52, 104);
      lines.push(first);
      if (rest) lines.push(rest);
    } else if (type === 'KSampler') {
      push(t('steps', '步数') + ' ' + w[2] + ' · CFG ' + w[3], 46);
      push(String(w[4] || '') + ' · ' + String(w[5] || ''), 46);
      push(t('denoise', '降噪') + ' ' + w[6], 46);
    } else if (type === 'EmptyLatentImage') {
      push(w[0] + ' × ' + w[1] + ' · batch ' + w[2], 46);
    } else if (type === 'LatentUpscale') {
      push(String(w[0] || '') + ' · ' + w[1] + ' × ' + w[2], 46);
    } else if (type === 'SaveImage') {
      push('prefix "' + String(w[0] || '') + '"', 46);
    } else if (type === 'LoadImage') {
      push('image: ' + String(w[0] || '—'), 46);
    } else if (type === 'SamplerCustom') {
      push('cfg ' + w[3] + ' · ' + t('add noise', '加噪') + ' ' + w[0], 46);
    } else if (type === 'SDTurboScheduler') {
      push(t('steps', '步数') + ' ' + w[0] + ' · ' + t('denoise', '降噪') + ' ' + w[1], 46);
    } else if (type === 'KSamplerSelect') {
      push(String(w[0] || ''), 40);
    } else if (type === 'VAEDecode') {
      lines = [];
    } else if (w.length) {
      push(w.filter(function (v) { return typeof v !== 'object'; }).join(' · '), 50);
    }
    return lines.slice(0, 3);
  }

  function graphBounds(wf) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    wf.nodes.forEach(function (node) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.w);
      maxY = Math.max(maxY, node.y + node.h);
    });
    var pad = 42;
    return {
      x: minX - pad, y: minY - pad,
      w: Math.max(1, maxX - minX + pad * 2),
      h: Math.max(1, maxY - minY + pad * 2)
    };
  }

  function drawGraph() {
    if (!svg) return;
    var wf = workflow(active);
    svg.textContent = '';
    var box = graphBounds(wf);
    svg.setAttribute('viewBox', box.x + ' ' + box.y + ' ' + box.w + ' ' + box.h);
    svg.setAttribute('width', Math.round(box.w * scale));
    svg.setAttribute('height', Math.round(box.h * scale));
    svg.style.width = Math.round(box.w * scale) + 'px';
    svg.style.height = Math.round(box.h * scale) + 'px';

    var byId = {};
    wf.nodes.forEach(function (node) { byId[node.id] = node; });

    (wf.links || []).forEach(function (link) {
      var from = byId[link[1]];
      var to = byId[link[3]];
      if (!from || !to) return;
      var sy = from.y + 32 + Math.min(link[2] || 0, 6) * 16;
      var ty = to.y + 32 + Math.min(link[4] || 0, 6) * 16;
      sy = Math.min(from.y + from.h - 12, sy);
      ty = Math.min(to.y + to.h - 12, ty);
      var sx = from.x + from.w;
      var tx = to.x;
      var mid = Math.max(40, Math.abs(tx - sx) * 0.45);
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', 'M' + sx + ' ' + sy + ' C' + (sx + mid) + ' ' + sy + ', ' +
        (tx - mid) + ' ' + ty + ', ' + tx + ' ' + ty);
      path.setAttribute('class', 'cg-link ' + (TYPE_CLASS[link[5]] || 'cg-other'));
      svg.appendChild(path);
    });

    wf.nodes.forEach(function (node) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'cg-node' + (/Sampler|KSampler/.test(node.type) ? ' is-sampler' : ''));
      g.setAttribute('data-node', node.id);

      var rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', node.x);
      rect.setAttribute('y', node.y);
      rect.setAttribute('width', node.w);
      rect.setAttribute('height', node.h);
      rect.setAttribute('rx', 10);
      rect.setAttribute('class', 'cg-box');
      g.appendChild(rect);

      var header = document.createElementNS(NS, 'line');
      header.setAttribute('x1', node.x);
      header.setAttribute('y1', node.y + 30);
      header.setAttribute('x2', node.x + node.w);
      header.setAttribute('y2', node.y + 30);
      header.setAttribute('class', 'cg-rule');
      g.appendChild(header);

      var type = document.createElementNS(NS, 'text');
      type.setAttribute('x', node.x + 12);
      type.setAttribute('y', node.y + 20);
      type.setAttribute('class', 'cg-type');
      type.textContent = node.type;
      g.appendChild(type);

      var titleText = lang() === 'zh'
        ? (node.title_zh || node.title)
        : (node.title_en || node.title);
      if (titleText && titleText !== node.type) {
        var title = document.createElementNS(NS, 'text');
        title.setAttribute('x', node.x + node.w - 12);
        title.setAttribute('y', node.y + 20);
        title.setAttribute('text-anchor', 'end');
        title.setAttribute('class', 'cg-title');
        title.textContent = truncate(titleText, 22);
        g.appendChild(title);
      }

      summaryLines(node).forEach(function (line, index) {
        var text = document.createElementNS(NS, 'text');
        text.setAttribute('x', node.x + 12);
        text.setAttribute('y', node.y + 49 + index * 15);
        text.setAttribute('class', 'cg-body');
        text.textContent = line;
        g.appendChild(text);
      });

      var ins = Math.min(node.inputs || 0, 4);
      for (var i = 0; i < ins; i += 1) {
        var dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', node.x);
        dot.setAttribute('cy', node.y + 38 + i * 16);
        dot.setAttribute('r', 3);
        dot.setAttribute('class', 'cg-dot');
        g.appendChild(dot);
      }
      var outs = Math.min(node.outputs || 0, 4);
      for (var j = 0; j < outs; j += 1) {
        var out = document.createElementNS(NS, 'circle');
        out.setAttribute('cx', node.x + node.w);
        out.setAttribute('cy', node.y + 38 + j * 16);
        out.setAttribute('r', 3);
        out.setAttribute('class', 'cg-dot out');
        g.appendChild(out);
      }

      svg.appendChild(g);
    });

    /* a SaveImage node preview, so the output lives inside the graph too */
    wf.nodes.forEach(function (node) {
      if (node.type !== 'SaveImage') return;
      var clipId = 'cgclip-' + wf.id + '-' + node.id;
      var defs = document.createElementNS(NS, 'defs');
      var clip = document.createElementNS(NS, 'clipPath');
      clip.setAttribute('id', clipId);
      var clipRect = document.createElementNS(NS, 'rect');
      clipRect.setAttribute('x', node.x + 12);
      clipRect.setAttribute('y', node.y + 70);
      clipRect.setAttribute('width', node.w - 24);
      clipRect.setAttribute('height', node.h - 82);
      clipRect.setAttribute('rx', 6);
      clip.appendChild(clipRect);
      defs.appendChild(clip);
      svg.appendChild(defs);

      var image = document.createElementNS(NS, 'image');
      image.setAttribute('href', 'img/comfy/krea2.webp');
      image.setAttribute('x', node.x + 12);
      image.setAttribute('y', node.y + 70);
      image.setAttribute('width', node.w - 24);
      image.setAttribute('height', node.h - 82);
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      image.setAttribute('clip-path', 'url(#' + clipId + ')');
      image.setAttribute('class', 'cg-preview-img');
      svg.appendChild(image);

      var note = document.createElementNS(NS, 'text');
      note.setAttribute('x', node.x + 20);
      note.setAttribute('y', node.y + node.h - 22);
      note.setAttribute('class', 'cg-preview-note');
      note.textContent = t('example output', '示例出图');
      svg.appendChild(note);
    });

    if (nameNode) nameNode.textContent = nameOf(wf);
    if (footNode) {
      footNode.textContent = wf.nodeCount + ' ' + t('nodes', '个节点') + ' · ' +
        wf.linkCount + ' ' + t('links', '条连线') + ' · ' + wf.file.split('/').pop();
    }
    if (zoomLabel) zoomLabel.textContent = Math.round(scale * 100) + '%';
    var jump = document.getElementById('comfyOutputJump');
    if (jump) {
      var over = scroll && (scroll.scrollWidth > scroll.clientWidth + 4);
      jump.style.display = over ? '' : 'none';
    }
  }

  function selectWorkflow(id, scrollToGraph) {
    active = id;
    Array.prototype.forEach.call(document.querySelectorAll('.comfy-tab'), function (btn) {
      var on = btn.getAttribute('data-workflow') === id;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    drawGraph();
    if (scroll && scrollToGraph) {
      var section = document.getElementById('graph');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  var outputJump = document.getElementById('comfyOutputJump');
  if (outputJump) outputJump.addEventListener('click', function () {
    if (scroll) scroll.scrollTo({ left: scroll.scrollWidth, behavior: 'smooth' });
  });

  /* zoom */
  var zoomIn = document.getElementById('comfyZoomIn');
  var zoomOut = document.getElementById('comfyZoomOut');
  var fit = document.getElementById('comfyFit');
  if (zoomIn) zoomIn.addEventListener('click', function () {
    scale = Math.min(1.2, Math.round((scale + 0.1) * 10) / 10);
    drawGraph();
  });
  if (zoomOut) zoomOut.addEventListener('click', function () {
    scale = Math.max(0.4, Math.round((scale - 0.1) * 10) / 10);
    drawGraph();
  });
  if (fit) fit.addEventListener('click', function () {
    var wf = workflow(active);
    var box = graphBounds(wf);
    var width = scroll ? scroll.clientWidth - 24 : 900;
    scale = Math.max(0.35, Math.min(1.1, Math.round((width / box.w) * 100) / 100));
    drawGraph();
    if (scroll) scroll.scrollLeft = 0;
  });

  /* ---------------- boot / language ---------------- */
  function paint() {
    renderCards();
    renderTabs();
    drawGraph();
  }

  document.addEventListener('xyc:lang', paint);

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(drawGraph, 160);
  });

  paint();
})();
