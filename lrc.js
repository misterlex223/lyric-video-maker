/* ============================================================
   lrc.js — LRC 解析 + 双语配对
   支持：
   · [mm:ss.xx] / [mm:ss:xx] / [mm:ss]
   · 一行多个时间戳 [t1][t2]text（增强 LRC 重复段）
   · 字级时间 <mm:ss.xx>word<mm:ss.xx>（逐字卡拉OK）
   · 元数据 [ti:] [ar:] [offset:]
   ============================================================ */
(function (global) {
  'use strict';

  const TAG_RE = /\[(\d{1,3}):(\d{1,2})(?:([.:])(\d{1,3}))?\]/g;
  const WORD_RE = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;

  function toSec(mm, ss, frac) {
    let s = parseInt(mm, 10) * 60 + parseInt(ss, 10);
    if (frac != null && frac !== '') s += parseFloat('0.' + frac);
    return s;
  }

  const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

  /* ---------- 字级时间解析 ---------- */
  function parseWords(text) {
    const marks = [];
    let m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text)) !== null) {
      marks.push({ t: toSec(m[1], m[2], m[3]), end: m.index + m[0].length, idx: m.index });
    }
    if (marks.length < 2) return null;

    const words = [];
    for (let i = 0; i < marks.length - 1; i++) {
      const seg = text.slice(marks[i].end, marks[i + 1].idx);
      if (!seg.trim()) continue;                 // 相邻两个时间戳之间的空段
      words.push({
        text: seg,
        start: marks[i].t,
        end: marks[i + 1].t
      });
    }
    if (!words.length) return null;

    // 判断是否需要补空格（拉丁语系词之间被吃掉空白）
    const plain = text.replace(WORD_RE, '');
    return { words: words, spaced: !CJK.test(plain) };
  }

  /* ---------- 主解析 ---------- */
  function parse(text) {
    text = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const meta = { ti: '', ar: '', offset: 0 };
    const lines = [];

    text.split('\n').forEach(function (raw) {
      const line = raw.trim();
      if (!line) return;

      // 元数据（[ti:] [ar:] [offset:] …）
      const metaM = /^\[(ti|ar|al|by|offset)\s*:\s*([^\]]*)\]/i.exec(line);
      if (metaM) {
        const k = metaM[1].toLowerCase();
        const v = metaM[2].trim();
        if (k === 'offset') meta.offset = parseInt(v, 10) || 0;   // 毫秒，正 = 提前
        else meta[k] = v;
        return;
      }

      // 行首连续时间戳
      const times = [];
      let m, pos = 0;
      TAG_RE.lastIndex = 0;
      while ((m = TAG_RE.exec(line)) !== null) {
        if (m.index !== pos) break;
        times.push(toSec(m[1], m[2], m[4]));
        pos = m.index + m[0].length;
        TAG_RE.lastIndex = pos;
      }
      if (!times.length) return;

      const rest = line.slice(pos).trim();
      if (!rest) {                                                // 空行（间奏标记）
        times.forEach(t => lines.push({ t: t, text: '', words: null }));
        return;
      }

      const wordInfo = parseWords(rest);
      // 字级 LRC 会把词间空白吃掉，这里按语言重建（拉丁语系补空格）
      const plain = wordInfo
        ? wordInfo.words.map(w => w.text).join(wordInfo.spaced ? ' ' : '')
        : rest;

      times.forEach(function (t) {
        lines.push({
          t: t,
          text: plain.trim(),
          words: wordInfo ? wordInfo.words : null,
          spaced: wordInfo ? wordInfo.spaced : true
        });
      });
    });

    lines.sort((a, b) => a.t - b.t);
    // 去重（同时间同文本）
    const out = [];
    lines.forEach(l => {
      const p = out[out.length - 1];
      if (p && Math.abs(p.t - l.t) < 0.001 && p.text === l.text) return;
      out.push(l);
    });
    return { meta: meta, lines: out };
  }

  function hasWordTiming(lines) {
    return (lines || []).some(l => l.words && l.words.length);
  }

  /* ---------- 双语配对 ---------- */
  /**
   * @param {object} main  主歌词 parse 结果（可为 null）
   * @param {object} sub   译文 parse 结果（可为 null）
   * @param {string} mode  dual | adjacent | split | main | sub
   * @param {object} opt   {tolerance, splitter, mainLines, subLines}
   */
  function buildPairs(main, sub, mode, opt) {
    opt = opt || {};
    const tol = Math.max(0.05, parseFloat(opt.tolerance) || 1.5);
    let pairs = [];

    const mk = (t, m, s) => ({ t: t, main: m || null, sub: s || null, end: null });

    if (mode === 'split') {
      const src = (main && main.lines.length) ? main : sub;
      const sp = (opt.splitter || '/').trim();
      (src ? src.lines : []).forEach(function (l) {
        let a = l.text, b = '';
        const i = l.text.indexOf(sp);
        if (i >= 0) { a = l.text.slice(0, i).trim(); b = l.text.slice(i + sp.length).trim(); }
        pairs.push(mk(l.t, Object.assign({}, l, { text: a, words: null }), b ? { t: l.t, text: b, words: null } : null));
      });
    } else if (mode === 'adjacent') {
      const src = (main && main.lines.length) ? main : sub;
      const arr = src ? src.lines : [];
      let i = 0;
      while (i < arr.length) {
        const cur = arr[i];
        const nxt = arr[i + 1];
        if (nxt && nxt.text && (nxt.t - cur.t) <= tol) {
          pairs.push(mk(cur.t, cur, nxt));
          i += 2;
        } else {
          pairs.push(mk(cur.t, cur, null));
          i += 1;
        }
      }
    } else if (mode === 'sub') {
      (sub ? sub.lines : []).forEach(l => pairs.push(mk(l.t, null, l)));
    } else if (mode === 'main') {
      (main ? main.lines : []).forEach(l => pairs.push(mk(l.t, l, null)));
    } else {
      /* dual：两个文件按时间就近配对 */
      const A = (main ? main.lines : []).slice();
      const B = (sub ? sub.lines : []).slice();
      const used = new Array(B.length).fill(false);
      const orphans = [];

      A.forEach(function (a) {
        let best = -1, bestD = Infinity;
        for (let k = 0; k < B.length; k++) {
          if (used[k]) continue;
          const d = Math.abs(B[k].t - a.t);
          if (B[k].t < a.t - tol) continue;
          if (B[k].t > a.t + tol) break;
          if (d < bestD) { bestD = d; best = k; }
        }
        if (best >= 0) { used[best] = true; pairs.push(mk(a.t, a, B[best])); }
        else pairs.push(mk(a.t, a, null));
      });

      B.forEach(function (b, k) { if (!used[k]) orphans.push(mk(b.t, null, b)); });

      // 把未配对的译文按时间插回序列
      orphans.forEach(function (o) {
        let pos = pairs.length;
        for (let i = 0; i < pairs.length; i++) { if (pairs[i].t > o.t) { pos = i; break; } }
        pairs.splice(pos, 0, o);
      });
    }

    pairs.sort((a, b) => a.t - b.t);
    for (let i = 0; i < pairs.length; i++) {
      pairs[i].end = (i + 1 < pairs.length) ? pairs[i + 1].t : pairs[i].t + 6;
      pairs[i].index = i;
    }
    return pairs;
  }

  /* ---------- 找当前行 ---------- */
  function findIndex(pairs, t) {
    if (!pairs.length) return -1;
    let lo = 0, hi = pairs.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (pairs[mid].t <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  global.LRC = { parse: parse, buildPairs: buildPairs, findIndex: findIndex, hasWordTiming: hasWordTiming };
})(window);
