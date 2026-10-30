/* ============================================================
   app.js — 9:16 歌词视频播放器
   ============================================================ */
(function () {
  'use strict';

  const W = 1080, H = 1920;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  /* ---------------- 配置 ---------------- */
  const DEF = {
    bilingual: 'dual', splitter: '/', tolerance: 1.5, offset: 0, visible: 3,
    scroll: 'smooth', anchor: 0.5, transDur: 0.45,
    layerMode: 'full', lx: 8, ly: 58, lw: 84, lh: 28, drag: false,
    layerBg: '#000000', layerAlpha: 0.35, radius: 24, pad: 40, valign: 'center',
    font: 'PingFang SC', size: 66, color: '#ffffff', weight: '700',
    subFont: 'PingFang SC', subSize: 46, subColor: '#ffd76a', gap: 18,
    lineH: 1.3, align: 'center', stroke: 0, strokeColor: '#000000',
    shadow: 14, shadowColor: '#000000', wrap: true, subPos: 'below',
    hiEnable: true, hiColor: '#ffd76a', hiScale: 1.08, dim: 0.45,
    karaoke: true, sungColor: '#ffd76a', unsungColor: '#ffffff', wordOff: 0,
    fit: 'cover', bgScale: 1, bgX: 0, bgY: 0, bgBlur: 0, bgDark: 0, canvasBg: '#0b0b0f',
    fps: '30', bitrate: '8000000', recStart: '0'
  };
  const BIND = {
    bilingual: ['cfg-bilingual', 'sel'], splitter: ['cfg-splitter', 'txt'],
    tolerance: ['cfg-tolerance', 'rng'], offset: ['cfg-offset', 'rng'],
    visible: ['cfg-visible', 'rng'], scroll: ['cfg-scroll', 'sel'],
    anchor: ['cfg-anchor', 'rng'], transDur: ['cfg-transdur', 'rng'], layerMode: ['cfg-layer-mode', 'sel'],
    lx: ['cfg-lx', 'num'], ly: ['cfg-ly', 'num'], lw: ['cfg-lw', 'num'], lh: ['cfg-lh', 'num'],
    drag: ['cfg-drag', 'chk'], layerBg: ['cfg-layer-bg', 'col'],
    layerAlpha: ['cfg-layer-alpha', 'rng'], radius: ['cfg-radius', 'rng'], pad: ['cfg-pad', 'rng'],
    valign: ['cfg-valign', 'sel'],
    font: ['cfg-font', 'sel'], size: ['cfg-size', 'rng'], color: ['cfg-color', 'col'],
    weight: ['cfg-weight', 'sel'], subFont: ['cfg-subfont', 'sel'],
    subSize: ['cfg-subsize', 'rng'], subColor: ['cfg-subcolor', 'col'],
    gap: ['cfg-gap', 'rng'], lineH: ['cfg-lineh', 'rng'], align: ['cfg-align', 'sel'],
    stroke: ['cfg-stroke', 'rng'], strokeColor: ['cfg-strokecolor', 'col'],
    shadow: ['cfg-shadow', 'rng'], shadowColor: ['cfg-shadowcolor', 'col'],
    wrap: ['cfg-wrap', 'chk'], subPos: ['cfg-subpos', 'sel'],
    hiEnable: ['cfg-hi-enable', 'chk'], hiColor: ['cfg-hicolor', 'col'],
    hiScale: ['cfg-hiscale', 'rng'], dim: ['cfg-dim', 'rng'],
    karaoke: ['cfg-karaoke', 'chk'], sungColor: ['cfg-sungcolor', 'col'],
    unsungColor: ['cfg-unsungcolor', 'col'], wordOff: ['cfg-wordoff', 'rng'],
    fit: ['cfg-fit', 'sel'], bgScale: ['cfg-bgscale', 'rng'], bgX: ['cfg-bgx', 'rng'],
    bgY: ['cfg-bgy', 'rng'], bgBlur: ['cfg-bgblur', 'rng'], bgDark: ['cfg-bgdark', 'rng'],
    canvasBg: ['cfg-canvasbg', 'col'],
    fps: ['cfg-fps', 'sel'], bitrate: ['cfg-bitrate', 'sel'], recStart: ['cfg-recstart', 'sel']
  };
  const C = Object.assign({}, DEF);

  /* ---------------- 运行时状态 ---------------- */
  const S = {
    audioName: '', bgName: '', mainName: '', subName: '',
    main: null, sub: null, pairs: [],
    previewIdx: 0,
    guides: false,
    recording: false,
    audioCtx: null, audioSrcNode: null, audioDest: null
  };

  const audioEl = new Audio();
  audioEl.preload = 'auto';
  audioEl.volume = 1;

  const canvas = $('stage');
  const ctx = canvas.getContext('2d');
  const bgImg = new Image();

  /* ---------------- 字体 ---------------- */
  const FONTS = [
    ['PingFang SC', '苹方 PingFang SC'], ['Songti SC', '宋体 Songti SC'],
    ['STSong', '华文宋体'], ['STHeiti', '华文黑体'], ['Heiti SC', '黑体 Heiti'],
    ['Kaiti SC', '楷体 Kaiti'], ['STKaiti', '华文楷体'], ['Yuanti SC', '圆体 Yuanti'],
    ['Hiragino Sans GB', '冬青黑体'], ['Microsoft YaHei', '微软雅黑'],
    ['SimSun', '宋体 SimSun'], ['Source Han Sans CN', '思源黑体'],
    ['Noto Sans SC', 'Noto Sans SC'], ['Helvetica Neue', 'Helvetica Neue'],
    ['Arial', 'Arial'], ['Georgia', 'Georgia'], ['Times New Roman', 'Times New Roman'],
    ['Impact', 'Impact'], ['Futura', 'Futura'], ['Avenir Next', 'Avenir Next'],
    ['Trebuchet MS', 'Trebuchet MS'], ['Courier New', 'Courier New'],
    ['Baskerville', 'Baskerville'], ['Palatino', 'Palatino']
  ];
  function fillFontSelects() {
    document.querySelectorAll('.fontsel').forEach(sel => {
      const cur = sel.value;
      sel.innerHTML = FONTS.map(f => `<option value="${f[0]}">${f[1]}</option>`).join('') +
        '<option value="__custom__">＋ 载入字体文件…</option>';
      if (cur) sel.value = cur;
    });
  }
  function addFont(name, family) {
    FONTS.unshift([family, name]);
    fillFontSelects();
  }

  /* ---------------- 控件绑定 ---------------- */
  function readEl(key) {
    const [id, type] = BIND[key];
    const el = $(id); if (!el) return;
    if (type === 'chk') C[key] = el.checked;
    else if (type === 'rng' || type === 'num') C[key] = parseFloat(el.value);
    else C[key] = el.value;
  }
  function writeEl(key) {
    const [id, type] = BIND[key];
    const el = $(id); if (!el) return;
    if (type === 'chk') el.checked = !!C[key];
    else el.value = C[key];
    if (type === 'rng') { const n = $(id + '-n'); if (n) n.value = C[key]; }
    if (type === 'num') { const r = $(id.replace(/-n$/, '')); if (r && r.type === 'range') r.value = C[key]; }
  }
  function initBinds() {
    Object.keys(BIND).forEach(key => {
      const [id, type] = BIND[key];
      const el = $(id); if (!el) return;
      writeEl(key);
      const handler = () => {
        readEl(key);
        if (type === 'rng') { const n = $(id + '-n'); if (n) n.value = C[key]; }
        if (type === 'num') { const r = $(id.replace(/-n$/, '')); if (r && r.type === 'range' && r !== el) r.value = C[key]; }
        onCfgChange(key);
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
      if (type === 'rng') {
        const n = $(id + '-n');
        if (n) n.addEventListener('input', () => {
          const v = parseFloat(n.value);
          if (isNaN(v)) return;
          C[key] = v; el.value = v; onCfgChange(key);
        });
      }
      if (type === 'sel' && (id === 'cfg-font' || id === 'cfg-subfont')) {
        el.addEventListener('change', () => {
          if (el.value === '__custom__') { pickFont(id); }
        });
      }
    });
  }
  function pickFont(selId) {
    const inp = $('file-font');
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const fam = 'UF_' + f.name.replace(/[^a-zA-Z0-9]/g, '');
      const face = new FontFace(fam, 'url(' + URL.createObjectURL(f) + ')');
      face.load().then(() => {
        document.fonts.add(face);
        addFont(f.name.replace(/\.(ttf|otf|woff2?)$/i, ''), fam);
        const sel = $(selId);
        sel.value = fam;
        C[selId === 'cfg-font' ? 'font' : 'subFont'] = fam;
        requestDraw();
      }).catch(() => alert('字体载入失败：' + f.name));
      inp.value = '';
    };
    inp.click();
  }

  function onCfgChange(key) {
    if (key === 'bilingual' || key === 'tolerance' || key === 'splitter') {
      if (key === 'bilingual') {
        if (C.bilingual === 'adjacent') C.tolerance = 0.35; else C.tolerance = 1.5;
        writeEl('tolerance');
      }
      rebuild();
    }
    if (key === 'layerMode' || key === 'drag' || key === 'scroll') updateVisibility();
    if (key === 'font' || key === 'subFont' || key === 'size' || key === 'subSize' ||
        key === 'lineH' || key === 'gap' || key === 'wrap' || key === 'align' || key === 'weight' || key === 'subPos') {
      S.pairs.forEach(p => p._k = null);
    }
    if (key === 'drag') { updateOverlay(); }
    requestDraw();
  }

  function updateVisibility() {
    const mode = C.bilingual;
    document.querySelectorAll('[data-when]').forEach(el => {
      const w = el.getAttribute('data-when');
      el.classList.toggle('hide', !w.split(' ').includes(mode));
    });
    const custom = C.layerMode === 'custom';
    document.querySelectorAll('[data-when-custom]').forEach(el => {
      el.classList.toggle('hide', !custom);
    });
    document.querySelectorAll('[data-scroll]').forEach(el => {
      el.classList.toggle('hide', el.getAttribute('data-scroll') !== C.scroll);
    });
  }

  /* ---------------- 文件载入 ---------------- */
  function bindFileBtn(btnId, inputId, onPick) {
    $(btnId).addEventListener('click', () => $(inputId).click());
    $(inputId).addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) onPick(f);
      e.target.value = '';
    });
  }
  bindFileBtn('btn-audio', 'file-audio', f => {
    if (S.audioURL) URL.revokeObjectURL(S.audioURL);
    S.audioURL = URL.createObjectURL(f);
    audioEl.src = S.audioURL;
    S.audioName = f.name.replace(/\.[^.]+$/, '');
    $('empty-hint') && ($('empty-hint').style.display = 'none');
    updateTags();
  });
  bindFileBtn('btn-bg', 'file-bg', f => {
    if (S.bgURL) URL.revokeObjectURL(S.bgURL);
    S.bgURL = URL.createObjectURL(f);
    bgImg.onload = () => { $('empty-hint').style.display = 'none'; requestDraw(); };
    bgImg.src = S.bgURL;
    S.bgName = f.name;
    updateTags();
  });
  bindFileBtn('btn-lrc-main', 'file-lrc-main', f => loadLrc(f, 'main'));
  bindFileBtn('btn-lrc-sub', 'file-lrc-sub', f => loadLrc(f, 'sub'));

  function loadLrc(file, slot) {
    const fr = new FileReader();
    fr.onload = () => {
      let text = fr.result;
      if (/\uFFFD/.test(text)) {                       // 疑似 GBK，重读
        const fr2 = new FileReader();
        fr2.onload = () => { applyLrc(fr2.result, file.name, slot); };
        fr2.readAsText(file, 'gbk');
        return;
      }
      applyLrc(text, file.name, slot);
    };
    fr.readAsText(file, 'utf-8');
  }
  function applyLrc(text, name, slot) {
    const parsed = LRC.parse(text);
    if (!parsed.lines.length) { alert('没有解析到歌词：' + name); return; }
    S[slot] = parsed;
    S[slot + 'Name'] = name;
    if (slot === 'main') {
      S.title = parsed.meta.ti || name.replace(/\.[^.]+$/, '');
      S.artist = parsed.meta.ar || '';
    }
    $('empty-hint').style.display = 'none';
    updateTags();
    rebuild();
  }

  function updateTags() {
    const tags = [];
    if (S.audioName) tags.push(['🎵', S.audioName]);
    if (S.bgName) tags.push(['🖼', S.bgName]);
    if (S.mainName) tags.push(['主', S.mainName]);
    if (S.subName) tags.push(['译', S.subName]);
    $('filetags').innerHTML = tags.map(t => `<span class="tag">${t[0]} <b>${t[1]}</b></span>`).join('');
  }

  // 拖放
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    files.forEach(f => {
      const n = f.name.toLowerCase();
      if (/\.(mp3|m4a|wav|ogg|flac|aac)$/.test(n)) { $('file-audio').files = filesOf(f); $('file-audio').dispatchEvent(new Event('change')); }
      else if (/\.(png|jpe?g|webp|gif|bmp|avif)$/.test(n)) { $('file-bg').files = filesOf(f); $('file-bg').dispatchEvent(new Event('change')); }
      else if (/\.(lrc|txt)$/.test(n)) {
        const target = S.main ? 'file-lrc-sub' : 'file-lrc-main';
        $(target).files = filesOf(f);
        $(target).dispatchEvent(new Event('change'));
      } else if (/\.(ttf|otf|woff2?)$/.test(n)) {
        const fam = 'UF_' + f.name.replace(/[^a-zA-Z0-9]/g, '');
        new FontFace(fam, 'url(' + URL.createObjectURL(f) + ')').load().then(face => {
          document.fonts.add(face);
          addFont(f.name.replace(/\.(ttf|otf|woff2?)$/i, ''), fam);
        });
      }
    });
  });
  function filesOf(f) {
    const dt = new DataTransfer(); dt.items.add(f); return dt.files;
  }

  /* ---------------- 双语重建 ---------------- */
  function rebuild() {
    if (!S.main && !S.sub) { S.pairs = []; requestDraw(); return; }
    S.pairs = LRC.buildPairs(S.main, S.sub, C.bilingual, {
      tolerance: C.tolerance, splitter: C.splitter
    });
    S.pairs.forEach(p => p._k = null);
    const hasWords = LRC.hasWordTiming((S.main && S.main.lines) || []) ||
                     LRC.hasWordTiming((S.sub && S.sub.lines) || []);
    const hint = $('karaoke-hint');
    if (hint) {
      hint.textContent = hasWords ? '已检测到字级时间，逐字卡拉OK 可用。'
                                  : '未检测到字级时间标签 <mm:ss.xx>，逐字卡拉OK 不生效（仍可整行高亮）。';
      hint.style.color = hasWords ? '#6fbf73' : '';
    }
    requestDraw();
  }

  /* ---------------- 工具 ---------------- */
  function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function fontStr(size, weight, family) {
    return `${weight} ${size}px "${family}", -apple-system, "PingFang SC", sans-serif`;
  }
  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  const CJKre = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/;
  function tokenize(str) {
    const out = []; let buf = '';
    for (const ch of String(str)) {
      if (CJKre.test(ch)) { if (buf) { out.push(buf); buf = ''; } out.push(ch); }
      else if (ch === ' ') { out.push(buf + ch); buf = ''; }
      else buf += ch;
    }
    if (buf) out.push(buf);
    return out;
  }
  function wrapText(c, text, maxW) {
    if (!text) return [];
    const toks = tokenize(text);
    const lines = []; let cur = '';
    toks.forEach(tk => {
      const test = cur + tk;
      if (cur && c.measureText(test).width > maxW) {
        lines.push(cur.trimEnd());
        cur = tk.trim() === '' ? '' : tk;
      } else cur = test;
    });
    if (cur.trim()) lines.push(cur.trimEnd());
    return lines.length ? lines : [text];
  }
  function fmtTime(t) {
    t = Math.max(0, t || 0);
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  /* ---------------- 布局测量 ---------------- */
  function layerRect() {
    if (C.layerMode === 'full') return { x: 0, y: 0, w: W, h: H };
    return {
      x: C.lx / 100 * W, y: C.ly / 100 * H,
      w: C.lw / 100 * W, h: C.lh / 100 * H
    };
  }
  function measureBlock(p, maxW) {
    const key = [C.font, C.size, C.weight, C.subFont, C.subSize, C.lineH, C.gap,
                 C.wrap ? 1 : 0, C.align, Math.round(maxW), C.subPos].join('|');
    if (p._k === key) return p;
    p._k = key;
    ctx.font = fontStr(C.size, C.weight, C.font);
    const mt = p.main ? p.main.text : '';
    p._ml = C.wrap ? wrapText(ctx, mt, maxW) : (mt ? [mt] : []);
    ctx.font = fontStr(C.subSize, '400', C.subFont);
    const st = p.sub ? p.sub.text : '';
    p._sl = C.wrap ? wrapText(ctx, st, maxW) : (st ? [st] : []);
    const mh = p._ml.length ? p._ml.length * C.size * C.lineH : 0;
    const sh = p._sl.length ? p._sl.length * C.subSize * C.lineH : 0;
    p._h = mh + sh + (mh && sh ? C.gap : 0);
    return p;
  }

  /* ---------------- 绘制 ---------------- */
  function drawBackground() {
    ctx.fillStyle = C.canvasBg;
    ctx.fillRect(0, 0, W, H);
    if (!bgImg.src || !bgImg.width) return;

    const iw = bgImg.width, ih = bgImg.height;
    let dw, dh;
    if (C.fit === 'stretch') { dw = W; dh = H; }
    else {
      const sc = C.fit === 'contain' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
      dw = iw * sc; dh = ih * sc;
    }
    dw *= C.bgScale; dh *= C.bgScale;
    const dx = (W - dw) / 2 + C.bgX / 100 * W;
    const dy = (H - dh) / 2 + C.bgY / 100 * H;

    ctx.save();
    if (C.bgBlur > 0 && 'filter' in ctx) ctx.filter = `blur(${C.bgBlur}px)`;
    ctx.drawImage(bgImg, dx, dy, dw, dh);
    ctx.restore();

    if (C.bgDark > 0) {
      ctx.fillStyle = `rgba(0,0,0,${C.bgDark})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawLayerBg(r) {
    if (C.layerAlpha <= 0) return;
    ctx.fillStyle = hexToRgba(C.layerBg, C.layerAlpha);
    roundRect(ctx, r.x, r.y, r.w, r.h, C.radius);
    ctx.fill();
  }

  function drawGuides() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, H * 0.5); ctx.lineTo(W, H * 0.5);
    ctx.moveTo(0, H * 0.78); ctx.lineTo(W, H * 0.78);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.font = '28px -apple-system,sans-serif';
    ctx.fillText('底部 22%：平台 UI 遮挡区', 24, H * 0.78 - 16);
    ctx.restore();
  }

  function setTextStyle() {
    if (C.shadow > 0) {
      ctx.shadowColor = C.shadowColor;
      ctx.shadowBlur = C.shadow;
      ctx.shadowOffsetY = Math.round(C.shadow * 0.35);
    } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  }
  function strokeOrFill(text, x, y, fill) {
    if (C.stroke > 0) {
      ctx.lineWidth = C.stroke * 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = C.strokeColor;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function drawLyrics(r, time) {
    const pairs = S.pairs;
    if (!pairs.length) return;

    let idx = LRC.findIndex(pairs, time);
    if (idx < 0) idx = 0;
    const started = time >= pairs[0].t;

    const pad = C.pad;
    const inner = { x: r.x + pad, y: r.y + pad, w: r.w - pad * 2, h: r.h - pad * 2 };
    if (inner.w <= 10 || inner.h <= 10) return;
    const maxW = inner.w;

    const vis = Math.max(1, Math.round(C.visible));
    const above = vis > 1 ? 1 : 0;
    const below = vis - 1 - above;

    ctx.save();
    ctx.textBaseline = 'top';
    // 文字裁剪到字幕层圆角区域内，避免行溢出层外
    roundRect(ctx, r.x, r.y, r.w, r.h, C.radius);
    ctx.clip();

    let items = [];
    if (C.scroll === 'smooth') {
      /* 平滑滚动：新行出现时，整体从「上一行居中」缓动滑到「当前行居中」，
         位移、缩放、淡化全部按同一条缓动曲线插值，避免整块瞬跳 */
      const cur = measureBlock(pairs[idx], maxW);
      const prev = idx > 0 ? measureBlock(pairs[idx - 1], maxW) : null;
      const lineDur = Math.max(0.15, (cur.end - cur.t) || 6);
      const dur = Math.max(0.02, Math.min(C.transDur, lineDur * 0.6));
      const e = (prev && started) ? easeOut(clamp((time - pairs[idx].t) / dur, 0, 1)) : 1;
      const shift = (prev && started) ? ((prev._h + cur._h) / 2) * (1 - e) : 0;
      const hi = C.hiEnable ? (C.hiScale - 1) : 0;

      const from = Math.max(0, idx - 1);
      const to = Math.min(pairs.length - 1, idx + below);
      let top = inner.y + inner.h * C.anchor - cur._h / 2;
      for (let i = idx - 1; i >= from; i--) top -= measureBlock(pairs[i], maxW)._h;
      let y = top;
      for (let i = from; i <= to; i++) {
        const b = measureBlock(pairs[i], maxW);
        let al = C.dim, sc = 1;
        if (started && i === idx) {
          al = C.dim + (1 - C.dim) * e;
          sc = 1 + hi * e;
        } else if (started && i === idx - 1) {
          al = 1 + (C.dim - 1) * e;
          sc = 1 + hi * (1 - e);
        }
        items.push({ p: b, i: i, y: y + shift, al: al, sc: sc });
        y += b._h;
      }
    } else {
      const from = idx;
      const to = Math.min(pairs.length - 1, idx + vis - 1);
      const spacing = Math.round(C.size * 0.3);
      let total = 0;
      for (let i = from; i <= to; i++) total += measureBlock(pairs[i], maxW)._h + spacing;
      total -= spacing;
      let y = C.valign === 'top' ? inner.y
            : C.valign === 'bottom' ? inner.y + inner.h - total
            : inner.y + (inner.h - total) / 2;
      const hi = C.hiEnable ? (C.hiScale - 1) : 0;
      for (let i = from; i <= to; i++) {
        const b = measureBlock(pairs[i], maxW);
        let al = C.dim, sc = 1;
        if (started && i === idx) {
          const e = clamp((time - b.t) / 0.22, 0, 1);
          al = C.dim + (1 - C.dim) * e;
          sc = 1 + hi * e;
        }
        items.push({ p: b, i: i, y: y, al: al, sc: sc });
        y += b._h + spacing;
      }
    }

    S._items = items;
    items.forEach(it => {
      if (it.al <= 0.01) return;
      ctx.globalAlpha = it.al;
      drawBlock(it.p, inner, maxW, it.y, it.i === idx && started, time, it.sc);
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawBlock(p, inner, maxW, top, isCur, time, scIn) {
    setTextStyle();
    const mainLines = p._ml || [], subLines = p._sl || [];
    const sc = scIn || 1;
    let y = top;

    const drawSide = (lines, size, weight, family, baseColor, words, spaced) => {
      if (!lines.length) return;
      const lhPx = size * C.lineH;
      const fs = size * sc;                     // 实际绘制字号（含高亮放大插值）
      if (isCur && C.karaoke && words && words.length) {
        // 逐字卡拉OK：整行单行绘制，必要时自动缩放到区域宽度
        ctx.font = fontStr(fs, weight, family);
        const spaceW = ctx.measureText(' ').width;
        let totalW = 0;
        const ww = words.map(w => {
          const wd = ctx.measureText(w.text).width;
          totalW += wd + (spaced ? spaceW : 0);
          return wd;
        });
        if (spaced) totalW -= spaceW;
        let s = fs;
        if (totalW > maxW && totalW > 0) {
          const k = maxW / totalW;
          s = fs * k;
          ctx.font = fontStr(s, weight, family);
          for (let wi = 0; wi < ww.length; wi++) ww[wi] *= k;
          totalW = maxW;
        }
        let x = C.align === 'center' ? inner.x + (maxW - totalW) / 2
              : C.align === 'right' ? inner.x + maxW - totalW : inner.x;
        const ty = y + (lhPx - s) / 2;
        const sp = spaced ? ctx.measureText(' ').width : 0;
        words.forEach((w, i) => {
          const sung = time >= (w.start + C.wordOff);
          const col = sung ? C.sungColor : (isCur && C.hiEnable ? C.unsungColor : baseColor);
          strokeOrFill(w.text, x, ty, col);
          x += ww[i] + sp;
        });
        y += lhPx;
      } else {
        ctx.font = fontStr(fs, weight, family);
        const s = fs;
        lines.forEach(ln => {
          const w = ctx.measureText(ln).width;
          const x = C.align === 'center' ? inner.x + (maxW - w) / 2
                  : C.align === 'right' ? inner.x + maxW - w : inner.x;
          strokeOrFill(ln, x, y + (size * C.lineH - s) / 2, baseColor);
          y += size * C.lineH;
        });
      }
    };

    const mainColor = (isCur && C.hiEnable) ? C.hiColor : C.color;
    const mainObj = p.main || {};
    const subObj = p.sub || {};
    if (C.subPos === 'above') {
      drawSide(subLines, C.subSize, '400', C.subFont, C.subColor, subObj.words, subObj.spaced);
      drawSide(mainLines, C.size, C.weight, C.font, mainColor, mainObj.words, mainObj.spaced);
    } else {
      drawSide(mainLines, C.size, C.weight, C.font, mainColor, mainObj.words, mainObj.spaced);
      drawSide(subLines, C.subSize, '400', C.subFont, C.subColor, subObj.words, subObj.spaced);
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  function render(time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    const r = layerRect();
    drawLayerBg(r);
    drawLyrics(r, time);
    if (S.guides && !S.recording) drawGuides();
  }

  /* ---------------- 主循环 ---------------- */
  let dirty = true;
  function requestDraw() { dirty = true; }
  function loop() {
    const t = currentLyricTime();
    if (dirty || !audioEl.paused || S.recording) {
      render(t);
      dirty = false;
      updatePlaybar();
    }
    requestAnimationFrame(loop);
  }
  function currentLyricTime() {
    if (audioEl.src && !isNaN(audioEl.duration)) return audioEl.currentTime - C.offset;
    if (S.pairs.length) {
      const p = S.pairs[clamp(S.previewIdx, 0, S.pairs.length - 1)];
      return p.t + 0.15;
    }
    return 0;
  }

  function updatePlaybar() {
    const dur = audioEl.duration || 0;
    $('t-cur').textContent = fmtTime(audioEl.currentTime);
    $('t-dur').textContent = fmtTime(dur);
    if (!$('seek').dataset.dragging) {
      $('seek').value = dur ? (audioEl.currentTime / dur) * 1000 : 0;
    }
    const idx = LRC.findIndex(S.pairs, currentLyricTime());
    const p = idx >= 0 ? S.pairs[idx] : null;
    $('linetag').textContent = p ? ((p.main && p.main.text) || (p.sub && p.sub.text) || '—') : '—';
    $('btn-play').textContent = audioEl.paused ? '▶' : '❚❚';
  }

  /* ---------------- 播放控制 ---------------- */
  $('btn-play').addEventListener('click', togglePlay);
  $('btn-stop').addEventListener('click', () => { audioEl.pause(); audioEl.currentTime = 0; requestDraw(); });
  $('btn-prev').addEventListener('click', () => jumpLine(-1));
  $('btn-next').addEventListener('click', () => jumpLine(1));
  function togglePlay() {
    if (!audioEl.src) { alert('先载入音乐文件'); return; }
    ensureAudioCtx();
    if (audioEl.paused) audioEl.play().catch(e => alert('播放失败：' + e.message));
    else audioEl.pause();
    requestDraw();
  }
  function jumpLine(dir) {
    if (!S.pairs.length) return;
    const t = currentLyricTime();
    let idx = LRC.findIndex(S.pairs, t);
    if (idx < 0) idx = 0;
    let target = clamp(idx + dir, 0, S.pairs.length - 1);
    if (dir < 0 && idx >= 0 && t - S.pairs[idx].t > 1.2) target = idx;
    const nt = S.pairs[target].t + C.offset + 0.02;
    if (audioEl.src && !isNaN(audioEl.duration)) audioEl.currentTime = clamp(nt, 0, audioEl.duration);
    else S.previewIdx = target;
    requestDraw();
  }
  const seek = $('seek');
  seek.addEventListener('pointerdown', () => seek.dataset.dragging = '1');
  seek.addEventListener('pointerup', () => delete seek.dataset.dragging);
  seek.addEventListener('input', () => {
    const d = audioEl.duration;
    if (d) audioEl.currentTime = (seek.value / 1000) * d;
    requestDraw();
  });
  $('vol').addEventListener('input', e => audioEl.volume = parseFloat(e.target.value));
  audioEl.addEventListener('play', requestDraw);
  audioEl.addEventListener('pause', requestDraw);
  audioEl.addEventListener('seeked', requestDraw);

  document.addEventListener('keydown', e => {
    if (/input|select|textarea/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'ArrowLeft') { audioEl.currentTime = Math.max(0, audioEl.currentTime - 3); requestDraw(); }
    else if (e.code === 'ArrowRight') { audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + 3); requestDraw(); }
  });

  /* ---------------- 字幕区域可视化拖拽 ---------------- */
  let ov = null;
  function buildOverlay() {
    ov = document.createElement('div');
    ov.className = 'layer-ov';
    ov.innerHTML = ['nw', 'ne', 'sw', 'se'].map(d => `<i class="h ${d}"></i>`).join('');
    $('stage-holder').appendChild(ov);
    ov.addEventListener('pointerdown', startDrag);
  }
  function updateOverlay() {
    if (!ov) return;
    const show = C.layerMode === 'custom' && C.drag && !S.recording;
    ov.style.display = show ? 'block' : 'none';
    if (!show) return;
    ov.style.left = C.lx + '%'; ov.style.top = C.ly + '%';
    ov.style.width = C.lw + '%'; ov.style.height = C.lh + '%';
  }
  function startDrag(e) {
    const h = e.target.classList;
    const mode = h.contains('se') ? 'se' : h.contains('sw') ? 'sw' : h.contains('ne') ? 'ne' :
                 h.contains('nw') ? 'nw' : 'move';
    const holder = $('stage-holder').getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const s = { lx: C.lx, ly: C.ly, lw: C.lw, lh: C.lh };
    document.body.classList.add('dragging');
    const move = ev => {
      const dx = (ev.clientX - sx) / holder.width * 100;
      const dy = (ev.clientY - sy) / holder.height * 100;
      let { lx, ly, lw, lh } = s;
      if (mode === 'move') { lx += dx; ly += dy; }
      else {
        if (mode.includes('e')) lw += dx;
        if (mode.includes('s')) lh += dy;
        if (mode.includes('w')) { lx += dx; lw -= dx; }
        if (mode.includes('n')) { ly += dy; lh -= dy; }
      }
      C.lx = clamp(lx, 0, 100 - lw); C.ly = clamp(ly, 0, 100 - lh);
      C.lw = clamp(lw, 5, 100 - C.lx); C.lh = clamp(lh, 3, 100 - C.ly);
      writeEl('lx'); writeEl('ly'); writeEl('lw'); writeEl('lh');
      updateOverlay(); requestDraw();
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.body.classList.remove('dragging');
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  /* ---------------- 录制 ---------------- */
  let recorder = null, chunks = [];
  function ensureAudioCtx() {
    if (S.audioCtx) return S.audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    try {
      const src = ac.createMediaElementSource(audioEl);
      const dest = ac.createMediaStreamDestination();
      src.connect(dest); src.connect(ac.destination);
      S.audioCtx = ac; S.audioSrcNode = src; S.audioDest = dest;
    } catch (e) { /* 忽略：重复创建 */ }
    return S.audioCtx;
  }
  function pickMime() {
    const list = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    for (const m of list) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
    return '';
  }
  $('btn-rec').addEventListener('click', () => {
    if (S.recording) { stopRec(); return; }
    if (!audioEl.src) { alert('先载入音乐文件'); return; }
    startRec();
  });
  function startRec() {
    ensureAudioCtx();
    if (S.audioCtx && S.audioCtx.state === 'suspended') S.audioCtx.resume();
    const vStream = canvas.captureStream(parseInt(C.fps, 10));
    let stream = vStream;
    if (S.audioDest) {
      const tracks = vStream.getVideoTracks().concat(S.audioDest.stream.getAudioTracks());
      stream = new MediaStream(tracks);
    }
    const mime = pickMime();
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: mime || undefined,
        videoBitsPerSecond: parseInt(C.bitrate, 10)
      });
    } catch (e) { alert('录制初始化失败：' + e.message); return; }
    chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const ext = (mime.indexOf('mp4') >= 0) ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mime || 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (S.title || S.audioName || '歌词视频') + '_歌词视频.' + ext;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 15000);
      $('rec-status').textContent = '已导出 ' + a.download + '（' + (blob.size / 1048576).toFixed(1) + ' MB）';
      S.recording = false;
      $('btn-rec').classList.remove('recording');
      $('btn-rec').textContent = '● 录制导出';
      $('rec-badge').classList.remove('on');
      updateOverlay();
    };
    recorder.start(1000);
    S.recording = true;
    $('btn-rec').classList.add('recording');
    $('btn-rec').textContent = '■ 停止并保存';
    $('rec-badge').classList.add('on');
    $('rec-status').textContent = '录制中…请保持本窗口可见';
    updateOverlay();
    if (C.recStart === '0') audioEl.currentTime = 0;
    audioEl.play().then(() => { }).catch(() => { });
    audioEl.onended = () => { if (S.recording) stopRec(); };
    document.querySelector('.stage-holder').scrollIntoView({ block: 'center' });
  }
  function stopRec() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    audioEl.pause();
    $('rec-status').textContent = '正在打包…';
  }

  /* ---------------- 预设 ---------------- */
  const PKEY = 'lyricplayer.preset.v1';
  $('btn-preset-save').addEventListener('click', () => {
    localStorage.setItem(PKEY, JSON.stringify(C));
    $('rec-status').textContent = '预设已保存到本机浏览器';
  });
  $('btn-preset-load').addEventListener('click', () => {
    const raw = localStorage.getItem(PKEY);
    if (!raw) { alert('还没有保存过预设'); return; }
    Object.assign(C, JSON.parse(raw));
    Object.keys(BIND).forEach(writeEl);
    updateVisibility(); updateOverlay();
    S.pairs.forEach(p => p._k = null);
    requestDraw();
  });

  /* ---------------- 其他 ---------------- */
  $('btn-guides').addEventListener('click', () => {
    S.guides = !S.guides;
    $('btn-guides').style.color = S.guides ? 'var(--acc)' : '';
    requestDraw();
  });
  $('btn-fs').addEventListener('click', () => {
    const el = $('stage-holder');
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen && el.requestFullscreen();
  });

  /* ---------------- 启动 ---------------- */
  fillFontSelects();
  initBinds();
  updateVisibility();
  buildOverlay();
  updateOverlay();
  updateTags();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestDraw);
  requestAnimationFrame(loop);

  // 调试钩子（控制台可用：__player.audioEl.currentTime = 60）
  window.__player = { audioEl: audioEl, S: S, C: C, render: render, requestDraw: requestDraw, rebuild: rebuild, jumpLine: jumpLine };
})();
