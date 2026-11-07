/* 词格 · 伴奏卡点作词器 */
(() => {
  'use strict';

  /* ═══════════════ 工具 ═══════════════ */
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad2 = n => String(Math.floor(n)).padStart(2, '0');
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const debounce = (fn, ms = 400) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };

  function fmtTime(t, withCs = true) {
    if (!Number.isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t % 1) * 100);
    return `${pad2(m)}:${pad2(s)}${withCs ? '.' + pad2(c) : ''}`;
  }
  function fmtLrc(t) {
    if (!Number.isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t % 1) * 100);
    return `${pad2(m)}:${pad2(s)}.${pad2(c)}`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const CJK = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

  function syllableCount(text) {
    const t = String(text || '').trim();
    if (!t) return 0;
    let n = 0;
    for (const ch of t) if (CJK.test(ch)) n++;
    const words = t.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
    for (const w of words) {
      const g = w.toLowerCase().replace(/e$/, '').match(/[aeiouy]+/g);
      n += g ? g.length : 1;
    }
    return n;
  }

  function splitUnits(text) {
    const t = String(text || '').trim();
    if (!t) return [];
    const units = [];
    let buf = '';
    for (const ch of t) {
      if (CJK.test(ch) || /\s/.test(ch)) {
        if (buf) { units.push(buf); buf = ''; }
        if (!/\s/.test(ch)) units.push(ch);
      } else {
        buf += ch;
      }
    }
    if (buf) units.push(buf);
    return units;
  }

  function smartJoin(cells) {
    let out = '';
    for (const raw of cells) {
      const t = String(raw || '').trim();
      if (!t) continue;
      if (!out) { out = t; continue; }
      const a = out[out.length - 1], b = t[0];
      const latinA = /[A-Za-z0-9'’.,!?;:)\]]/.test(a);
      const latinB = /[A-Za-z0-9'’(\[]/.test(b);
      out += (latinA && latinB) ? ' ' + t : t;
    }
    return out;
  }

  /* ═══════════════ 状态 ═══════════════ */
  const LS_KEY = 'cige.project.v1';

  const S = {
    ctx: null, buffer: null, fileName: '', fileSize: 0, duration: 0,
    peaks: null,
    bpm: 120, firstBeat: 0, beatsPerBar: 4, confidence: 0,
    bars: [], sections: [],
    playing: false, source: null, anchor: 0, cursor: 0,
    view: { start: 0, end: 1 },
    curBar: -1, curBeat: -1, curRow: null, curWrap: null, curProgress: null,
    tapTimes: [], lastTap: 0,
    cssW: 0, cssH: 158, dpr: 1, waveDirty: true
  };

  /* ═══════════════ DOM ═══════════════ */
  const els = {
    empty: $('#emptyState'), studio: $('#studio'),
    fileInput: $('#fileInput'), loading: $('#loading'), loadingText: $('#loadingText'),
    dropOverlay: $('#dropOverlay'),
    trackName: $('#trackName'), trackInfo: $('#trackInfo'),
    waveWrap: $('#waveWrap'), wave: $('#wave'),
    btnPlay: $('#btnPlay'), timeNow: $('#timeNow'), timeDur: $('#timeDur'),
    barNow: $('#barNow'), beatNow: $('#beatNow'), bpmChip: $('#bpmChip'),
    bpmInput: $('#bpmInput'), bpbSelect: $('#bpbSelect'), offsetInput: $('#offsetInput'),
    btnHalf: $('#btnHalf'), btnDouble: $('#btnDouble'),
    btnTap: $('#btnTap'), tapHint: $('#tapHint'), btnAlign: $('#btnAlign'), btnReanalyze: $('#btnReanalyze'),
    confFill: $('#confFill'), confLabel: $('#confLabel'),
    grid: $('#grid'), gridScroll: $('#gridScroll'), gridInfo: $('#gridInfo'),
    btnAddSection: $('#btnAddSection'),
    btnExport: $('#btnExport'), saveHint: $('#saveHint'), btnHarmony: $('#btnHarmony'),
    btnStudio: $('#btnStudio'), btnLearn: $('#btnLearn'),
    dialog: $('#exportDialog'), exportText: $('#exportText'), exportTabs: $('#exportTabs'),
    exportInfo: $('#exportInfo'), btnCopy: $('#btnCopy'), btnDownload: $('#btnDownload'),
    btnCloseDialog: $('#btnCloseDialog')
  };

  const wctx = els.wave.getContext('2d');
  const cache = document.createElement('canvas');

  /* ═══════════════ 节拍计算 ═══════════════ */
  const beatDur = () => 60 / S.bpm;
  const barDur = () => beatDur() * S.beatsPerBar;
  const barStart = b => S.firstBeat + b * barDur();

  function totalBars() {
    if (!S.duration) return 0;
    const remain = S.duration - S.firstBeat;
    if (remain <= 0) return 0;
    return clamp(Math.floor(remain / barDur()) + 1, 0, 800);
  }

  function syncBars() {
    const total = totalBars();
    if (S.bars.length > total) S.bars.length = total;
    while (S.bars.length < total) S.bars.push({ cells: new Array(S.beatsPerBar).fill(''), chord: '' });
    for (const bar of S.bars) {
      if (typeof bar.chord !== 'string') bar.chord = '';
      if (!Array.isArray(bar.cells)) bar.cells = [];
      while (bar.cells.length < S.beatsPerBar) bar.cells.push('');
      if (bar.cells.length > S.beatsPerBar) bar.cells.length = S.beatsPerBar;
    }
    S.sections = S.sections.filter(s => s.bar >= 0 && s.bar < total && typeof s.name === 'string');
  }

  /* ═══════════════ 音频加载 ═══════════════ */
  function showLoading(text) {
    els.loadingText.textContent = text;
    els.loading.hidden = false;
  }
  const hideLoading = () => { els.loading.hidden = true; };

  async function loadAudioFile(file) {
    if (!file) return;
    showLoading('正在解码音频…');
    await frame();
    try {
      if (!S.ctx) S.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (S.ctx.state === 'suspended') await S.ctx.resume().catch(() => {});
      const ab = await file.arrayBuffer();
      const buffer = await S.ctx.decodeAudioData(ab);
      pause(true);

      S.buffer = buffer;
      S.duration = buffer.duration;
      S.fileName = file.name;
      S.fileSize = file.size;
      S.bars = [];
      S.sections = [];
      S.cursor = 0;

      els.loadingText.textContent = '正在解析节拍…';
      await frame();

      computePeaks(buffer);
      const res = detectTempo(buffer);
      S.bpm = res.bpm;
      S.firstBeat = res.firstBeat;
      S.confidence = res.confidence;

      const restored = restoreProject(file);
      if (!restored) S.sections = [{ bar: 0, name: '主歌' }];

      syncBars();

      if (window.ChordDetector) {
        els.loadingText.textContent = '正在识别和弦…';
        await frame();
        try {
          const chords = window.ChordDetector.detectChords(buffer, {
            bpm: S.bpm, firstBeat: S.firstBeat, beatsPerBar: S.beatsPerBar
          });
          chords.forEach((c, i) => {
            if (c && S.bars[i] && !S.bars[i].chord) S.bars[i].chord = c;
          });
        } catch (err) { console.warn('和弦识别跳过', err); }
      }

      renderGrid();
      applyUI();

      if (pendingChords) {
        const p = pendingChords;
        pendingChords = null;
        applyHarmony(p);
      }
      showStudio();

      S.view = { start: 0, end: S.duration };
      await frame();
      layoutWave();
      S.waveDirty = true;
      paint();
      saveProject();
    } catch (err) {
      console.error(err);
      els.loading.hidden = true;
      alert('音频解码失败：' + (err && err.message ? err.message : err));
    } finally {
      hideLoading();
    }
  }

  function showStudio() {
    els.empty.hidden = true;
    els.studio.hidden = false;
    els.btnExport.disabled = false;
    els.trackName.textContent = S.fileName || '伴奏';
    const ch = S.buffer ? S.buffer.numberOfChannels : 2;
    const sr = S.buffer ? Math.round(S.buffer.sampleRate / 1000) : 44;
    els.trackInfo.textContent = `· ${fmtTime(S.duration, false)} · ${sr} kHz · ${ch === 1 ? '单声道' : ch + ' 声道'}`;
    els.timeDur.textContent = fmtTime(S.duration);
  }

  /* ═══════════════ 波形峰值 ═══════════════ */
  function computePeaks(buffer) {
    const sr = buffer.sampleRate;
    const block = Math.max(1, Math.round(sr * 0.004));
    const n = Math.floor(buffer.length / block);
    const min = new Float32Array(n);
    const max = new Float32Array(n);
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
    let maxAbs = 0;
    for (let i = 0; i < n; i++) {
      const s = i * block;
      let mn = 0, mx = 0;
      for (let j = 0; j < block; j++) {
        const v = ch1 ? (ch0[s + j] + ch1[s + j]) * 0.5 : ch0[s + j];
        if (v > mx) mx = v; else if (v < mn) mn = v;
      }
      min[i] = mn; max[i] = mx;
      const a = Math.max(Math.abs(mn), Math.abs(mx));
      if (a > maxAbs) maxAbs = a;
    }
    S.peaks = { blockSec: block / sr, min, max, n, maxAbs: maxAbs || 1 };
  }

  /* ═══════════════ BPM / 节拍自动解析 ═══════════════ */
  function detectTempo(buffer) {
    const fallback = { bpm: 120, firstBeat: 0, confidence: 0 };
    const sr = buffer.sampleRate;
    const hopSec = 0.005;
    const hop = Math.max(1, Math.round(sr * hopSec));
    /* 实际帧长按整数采样点回算，避免 44.1kHz 下 nominal/actual 不一致导致相位随时间漂移 */
    const frameSec = hop / sr;
    const frames = Math.floor(buffer.length / hop);
    if (frames < 200) return fallback;

    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;

    /* 1. 能量包络 */
    const env = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      const s = i * hop;
      let sum = 0;
      for (let j = 0; j < hop; j++) {
        const v = ch1 ? (ch0[s + j] + ch1[s + j]) * 0.5 : ch0[s + j];
        sum += v * v;
      }
      env[i] = Math.sqrt(sum / hop);
    }

    /* 2. 平滑 + 起音强度 */
    const sm = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      let acc = 0, cnt = 0;
      for (let j = -3; j <= 3; j++) {
        const p = i + j;
        if (p >= 0 && p < frames) { acc += env[p]; cnt++; }
      }
      sm[i] = cnt ? acc / cnt : 0;
    }
    const onset = new Float32Array(frames);
    let onsetMax = 0;
    for (let i = 1; i < frames; i++) {
      const d = sm[i] - sm[i - 1];
      onset[i] = d > 0 ? d : 0;
      if (onset[i] > onsetMax) onsetMax = onset[i];
    }
    if (onsetMax <= 1e-9) return fallback;
    for (let i = 0; i < frames; i++) onset[i] /= onsetMax;

    /* 3. 自相关 */
    const minLag = Math.round((60 / 200) / frameSec);
    const maxLag = Math.min(Math.round((60 / 40) / frameSec), frames - 10);
    const ac = new Float32Array(maxLag + 2);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let dot = 0, e1 = 0, e2 = 0;
      for (let i = 0; i + lag < frames; i++) {
        const a = onset[i], b = onset[i + lag];
        dot += a * b; e1 += a * a; e2 += b * b;
      }
      ac[lag] = dot / (Math.sqrt(e1 * e2) + 1e-9);
    }

    /* 4. 候选峰 */
    const cands = [];
    let bestLag = minLag, bestAc = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (ac[lag] > bestAc) { bestAc = ac[lag]; bestLag = lag; }
    }
    const threshold = Math.max(0.06, bestAc * 0.35);
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1] && ac[lag] > threshold) {
        let refined = lag;
        const den = 2 * ac[lag] - ac[lag - 1] - ac[lag + 1];
        if (Math.abs(den) > 1e-9) refined = lag + 0.5 * (ac[lag - 1] - ac[lag + 1]) / den;
        cands.push({ lag: refined, ac: ac[lag] });
      }
    }
    if (!cands.length) {
      cands.push({ lag: bestLag, ac: Math.max(0, bestAc) });
    }
    cands.sort((a, b) => b.ac - a.ac);
    const top = cands.slice(0, 6);

    /* 5. 梳状打分 + 相位搜索 */
    function comb(lagF) {
      const lag = Math.max(2, Math.round(lagF));
      let best = -1, phase = 0;
      for (let p = 0; p < lag; p++) {
        let acc = 0, cnt = 0;
        for (let i = p; i < frames; i += lag) { acc += onset[i]; cnt++; }
        acc /= (cnt || 1);
        if (acc > best) { best = acc; phase = p; }
      }
      return { score: best, phase };
    }

    let winner = null;
    for (const c of top) {
      const bpm = 60 / (c.lag * frameSec);
      if (bpm < 45 || bpm > 220) continue;
      const cb = comb(c.lag);
      /* 节奏先验：流行/说唱伴奏的主脉冲多落在 70–160，避免半速误判 */
      const prior = Math.exp(-Math.pow(Math.log(bpm / 120), 2) / (2 * 0.62 * 0.62));
      const score = (c.ac * 0.7 + cb.score * 0.3) * prior;
      if (!winner || score > winner.score) {
        /* 相位贴近周期末端时回退一拍，让网格从开头附近铺起 */
        let fb = cb.phase * frameSec;
        if (fb > (60 / bpm) * 0.95) fb -= 60 / bpm;
        winner = { score, bpm, firstBeat: Math.max(0, fb), lag: c.lag, ac: c.ac };
      }
    }
    if (!winner) {
      const c = top[0];
      const cb = comb(c.lag);
      const bpm = 60 / (c.lag * frameSec);
      let fb = cb.phase * frameSec;
      if (fb > (60 / bpm) * 0.95) fb -= 60 / bpm;
      winner = { score: c.ac, bpm, firstBeat: Math.max(0, fb), ac: c.ac };
    }

    return {
      bpm: Math.round(clamp(winner.bpm, 30, 320) * 100) / 100,
      firstBeat: winner.firstBeat,
      confidence: clamp(winner.ac / 0.65, 0, 1)
    };
  }

  /* ═══════════════ 画布 ═══════════════ */
  function layoutWave() {
    const w = els.waveWrap.clientWidth;
    if (!w) return;
    S.cssW = w;
    S.cssH = 158;
    S.dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const cv of [els.wave, cache]) {
      cv.width = Math.round(w * S.dpr);
      cv.height = Math.round(S.cssH * S.dpr);
    }
    S.waveDirty = true;
  }

  function niceStep(span, target = 6) {
    const raw = span / target;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / pow;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return m * pow;
  }

  function renderStatic() {
    const w = S.cssW, h = S.cssH;
    if (!w || !h) return;
    const g = cache.getContext('2d');
    g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#fcfcfe';
    g.fillRect(0, 0, w, h);

    const start = S.view.start, end = S.view.end;
    const span = Math.max(0.001, end - start);
    const pxPerSec = w / span;
    const mid = h * 0.5;

    /* 中线 */
    g.fillStyle = '#eceef5';
    g.fillRect(0, Math.round(mid), w, 1);

    /* 波形 */
    const P = S.peaks;
    if (P && P.n) {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#b9b4ff');
      grad.addColorStop(1, '#5b52f0');
      g.fillStyle = grad;
      const amp = (h * 0.63) / P.maxAbs;
      const per = span / w;
      for (let x = 0; x < w; x++) {
        const t0 = start + x * per;
        const b0 = Math.max(0, Math.floor(t0 / P.blockSec));
        const b1 = Math.min(P.n - 1, Math.floor((t0 + per) / P.blockSec));
        let mn = 0, mx = 0;
        if (b1 >= b0) {
          for (let b = b0; b <= b1; b++) {
            if (P.min[b] < mn) mn = P.min[b];
            if (P.max[b] > mx) mx = P.max[b];
          }
        } else {
          const b = clamp(Math.round(t0 / P.blockSec), 0, P.n - 1);
          mn = P.min[b]; mx = P.max[b];
        }
        const y0 = mid - mx * amp;
        const y1 = mid - mn * amp;
        g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
      }
    }

    /* 节拍网格 */
    const T = beatDur();
    const bpb = S.beatsPerBar;
    const pxPerBeat = T * pxPerSec;
    const kStart = Math.floor((start - S.firstBeat) / T);
    const kEnd = Math.ceil((end - S.firstBeat) / T);
    const showBeats = pxPerBeat >= 6;
    for (let k = kStart; k <= kEnd; k++) {
      const isBar = (((k % bpb) + bpb) % bpb) === 0;
      if (!isBar && !showBeats) continue;
      const x = Math.round(((S.firstBeat + k * T) - start) * pxPerSec);
      if (x < -2 || x > w + 2) continue;
      g.fillStyle = isBar ? 'rgba(79,70,229,.30)' : 'rgba(79,70,229,.11)';
      g.fillRect(x, 0, isBar ? 1.5 : 1, h);
    }

    /* 顶部渐隐 */
    const fadeTop = g.createLinearGradient(0, 0, 0, 18);
    fadeTop.addColorStop(0, 'rgba(252,252,254,.92)');
    fadeTop.addColorStop(1, 'rgba(252,252,254,0)');
    g.fillStyle = fadeTop;
    g.fillRect(0, 0, w, 18);

    /* 小节号（绘制在渐隐之上，保证可读） */
    if (T * bpb * pxPerSec >= 54) {
      g.font = '10px -apple-system, "PingFang SC", sans-serif';
      g.fillStyle = 'rgba(79,70,229,.72)';
      for (let k = kStart; k <= kEnd; k++) {
        if ((((k % bpb) + bpb) % bpb) !== 0) continue;
        const barIdx = Math.floor(k / bpb);
        if (barIdx < 0) continue;
        const x = ((S.firstBeat + k * T) - start) * pxPerSec;
        g.fillText(String(barIdx + 1), Math.round(x) + 4, 13);
      }
    }

    /* 时间刻度 */
    const step = niceStep(span, Math.max(3, Math.round(w / 110)));
    g.font = '10px -apple-system, "PingFang SC", sans-serif';
    g.fillStyle = '#b3b8c4';
    for (let t = Math.ceil(start / step) * step; t <= end; t += step) {
      const x = (t - start) * pxPerSec;
      g.fillRect(Math.round(x), h - 15, 1, 5);
      if (x < w - 34) g.fillText(fmtTime(t, false), Math.round(x) + 4, h - 4);
    }
  }

  function paint() {
    if (!S.cssW) return;
    if (S.waveDirty) { renderStatic(); S.waveDirty = false; }
    const w = S.cssW, h = S.cssH;
    wctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    wctx.clearRect(0, 0, w, h);
    wctx.drawImage(cache, 0, 0, w, h);
    if (!S.buffer) return;

    const start = S.view.start, span = Math.max(0.001, S.view.end - start);
    const pxPerSec = w / span;
    const t = nowTime();

    /* 当前拍高亮 */
    const T = beatDur();
    if (t >= S.firstBeat) {
      const k = Math.floor((t - S.firstBeat) / T);
      const a = S.firstBeat + k * T;
      const x0 = Math.max(0, (a - start) * pxPerSec);
      const x1 = Math.min(w, (a + T - start) * pxPerSec);
      if (x1 > x0) {
        wctx.fillStyle = 'rgba(79,70,229,.10)';
        wctx.fillRect(x0, 0, x1 - x0, h);
      }
    }

    /* 播放头 */
    const x = (t - start) * pxPerSec;
    if (x >= -1 && x <= w + 1) {
      wctx.fillStyle = '#4f46e5';
      wctx.fillRect(Math.max(0, Math.min(w - 2, x - 1)), 0, 2, h);
      wctx.beginPath();
      wctx.arc(clamp(x, 3, w - 3), 7, 3.5, 0, Math.PI * 2);
      wctx.fill();
    }
  }

  /* ═══════════════ 播放 ═══════════════ */
  function nowTime() {
    if (!S.playing) return S.cursor;
    return clamp(S.ctx.currentTime - S.anchor, 0, S.duration);
  }

  async function play() {
    if (!S.buffer || S.playing) return;
    try {
      if (S.ctx.state === 'suspended') await S.ctx.resume();
    } catch (e) { /* ignore */ }
    if (S.cursor >= S.duration - 0.04) S.cursor = 0;
    const src = S.ctx.createBufferSource();
    src.buffer = S.buffer;
    src.connect(S.ctx.destination);
    src.onended = () => {
      if (S.source !== src) return;
      S.source = null;
      S.playing = false;
      S.cursor = S.duration;
      updatePlayButton();
      updateTransport(true);
    };
    try { src.start(0, S.cursor); } catch (e) { return; }
    S.source = src;
    S.anchor = S.ctx.currentTime - S.cursor;
    S.playing = true;
    updatePlayButton();
  }

  function pause(silent) {
    if (!S.playing) { if (!silent) { S.cursor = clamp(S.cursor, 0, S.duration); } return; }
    S.cursor = nowTime();
    S.playing = false;
    const src = S.source;
    S.source = null;
    if (src) { try { src.stop(); } catch (e) { /* ignore */ } }
    updatePlayButton();
    if (!silent) updateTransport(true);
  }

  function seek(t) {
    t = clamp(t, 0, S.duration || 0);
    const was = S.playing;
    if (was) pause(true);
    S.cursor = t;
    if (was) play(); else { updateTransport(true); paint(); }
    if (!was) updateHighlight(true);
  }

  function updatePlayButton() {
    els.btnPlay.classList.toggle('is-playing', S.playing);
    els.btnPlay.setAttribute('aria-label', S.playing ? '暂停' : '播放');
  }

  /* ═══════════════ 播放位置 UI ═══════════════ */
  let lastUI = 0;
  function updateTransport(force) {
    const now = performance.now();
    if (!force && now - lastUI < 30) return;
    lastUI = now;
    const t = nowTime();
    els.timeNow.textContent = fmtTime(t);

    let bar = -1, beat = -1;
    if (S.buffer && t >= S.firstBeat) {
      const k = (t - S.firstBeat) / beatDur();
      bar = Math.floor(k / S.beatsPerBar);
      beat = Math.floor(k) % S.beatsPerBar;
      if (bar >= S.bars.length) { bar = -1; beat = -1; }
    }
    els.barNow.textContent = bar >= 0 ? String(bar + 1) : '–';
    els.beatNow.textContent = beat >= 0 ? String(beat + 1) : '–';
  }

  function updateHighlight(force) {
    if (!S.buffer) return;
    const t = nowTime();
    const T = beatDur();
    let bar = -1, beat = -1, frac = 0;
    if (t >= S.firstBeat) {
      const k = (t - S.firstBeat) / T;
      bar = Math.floor(k / S.beatsPerBar);
      beat = ((Math.floor(k) % S.beatsPerBar) + S.beatsPerBar) % S.beatsPerBar;
      frac = k - Math.floor(k);
      if (bar >= S.bars.length) { bar = -1; beat = -1; }
    }

    if (bar !== S.curBar || beat !== S.curBeat || force) {
      if (S.curWrap) S.curWrap.classList.remove('is-playing');
      if (S.curRow) S.curRow.classList.remove('is-current');
      S.curWrap = null; S.curRow = null; S.curProgress = null;
      S.curBar = bar; S.curBeat = beat;

      if (bar >= 0) {
        const row = els.grid.querySelector(`.bar-row[data-bar="${bar}"]`);
        if (row) {
          row.classList.add('is-current');
          const wrap = row.querySelectorAll('.cell-wrap')[beat];
          if (wrap) {
            wrap.classList.add('is-playing');
            S.curWrap = wrap;
            S.curProgress = wrap.querySelector('.cell-progress');
          }
          S.curRow = row;
          autoScrollTo(row);
        }
      }
    }
    if (S.curProgress) {
      S.curProgress.style.transform = `scaleX(${clamp(frac, 0, 1)})`;
    }
  }

  let lastAutoScroll = 0;
  function rowTopInScroll(row) {
    const sc = els.gridScroll;
    const sr = sc.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    return rr.top - sr.top + sc.scrollTop;
  }
  function autoScrollTo(row) {
    if (!S.playing) return;
    const sc = els.gridScroll;
    const top = rowTopInScroll(row);
    const h = row.offsetHeight;
    const near = sc.scrollTop;
    if (top < near + 4 || top + h > near + sc.clientHeight - 12) {
      sc.scrollTop = Math.max(0, top - sc.clientHeight * 0.35);
      lastAutoScroll = performance.now();
    }
  }

  /* ═══════════════ 网格渲染 ═══════════════ */
  function renderGrid() {
    const bpb = S.beatsPerBar;
    els.grid.style.setProperty('--bpb', bpb);
    const frag = document.createDocumentFragment();
    const secMap = new Map(S.sections.map(s => [s.bar, s]));
    for (let b = 0; b < S.bars.length; b++) {
      const sec = secMap.get(b);
      if (sec) frag.appendChild(buildSectionRow(sec));
      frag.appendChild(buildBarRow(b));
      frag.appendChild(buildChordRow(b));
    }
    els.grid.replaceChildren(frag);
    S.curBar = -1; S.curBeat = -1; S.curRow = null; S.curWrap = null; S.curProgress = null;
    updateGridInfo();
    updateHighlight(true);
  }

  function buildBarRow(b) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.dataset.bar = b;
    const p = String(b + 1).padStart(2, '0');
    let html = `<div class="bar-gutter"><span class="bar-no">${p}</span><span class="bar-time">${fmtTime(barStart(b), false)}</span></div>`;
    for (let k = 0; k < S.beatsPerBar; k++) {
      const v = S.bars[b].cells[k] || '';
      const dense = syllableCount(v) > 2 ? ' is-dense' : '';
      html += `<div class="cell-wrap${dense}"><input class="cell" type="text" maxlength="24" data-bar="${b}" data-beat="${k}" value="${escapeHtml(v)}" autocomplete="off" spellcheck="false"><i class="cell-progress"></i></div>`;
    }
    row.innerHTML = html;
    return row;
  }

  function buildChordRow(b) {
    const row = document.createElement('div');
    row.className = 'chord-row';
    row.dataset.bar = b;
    const chord = escapeHtml(S.bars[b].chord || '');
    row.innerHTML = `
      <div class="bar-gutter chord-gutter"><span class="chord-label">和弦</span></div>
      <input class="chord-chip" type="text" maxlength="10" data-bar="${b}" value="${chord}"
        placeholder="—" autocomplete="off" spellcheck="false">`;
    return row;
  }

  function buildSectionRow(sec) {
    const row = document.createElement('div');
    row.className = 'section-row';
    row.dataset.bar = sec.bar;
    row.innerHTML = `
      <input class="sec-name" type="text" value="${escapeHtml(sec.name)}" maxlength="18" spellcheck="false">
      <span class="sec-time">${fmtTime(barStart(sec.bar), false)}</span>
      <div class="spacer"></div>
      <button class="sec-del" title="删除段落">✕</button>`;
    return row;
  }

  function updateGridInfo() {
    const filled = S.bars.reduce((acc, b) => acc + b.cells.filter(c => c.trim()).length, 0);
    const total = S.bars.length * S.beatsPerBar;
    els.gridInfo.textContent = `共 ${S.bars.length} 小节 · ${total} 拍 · 已填 ${filled} 拍`;
  }

  function updateDensity(input) {
    const wrap = input.closest('.cell-wrap');
    if (!wrap) return;
    wrap.classList.toggle('is-dense', syllableCount(input.value) > 2);
  }

  function focusCell(bar, beat) {
    if (bar < 0 || bar >= S.bars.length) return;
    beat = ((beat % S.beatsPerBar) + S.beatsPerBar) % S.beatsPerBar;
    const inp = els.grid.querySelector(`.cell[data-bar="${bar}"][data-beat="${beat}"]`);
    if (inp) {
      inp.focus();
      inp.select();
      const sc = els.gridScroll;
      const row = inp.closest('.bar-row');
      const top = rowTopInScroll(row);
      if (top < sc.scrollTop) sc.scrollTop = top - 8;
      if (top + 40 > sc.scrollTop + sc.clientHeight) sc.scrollTop = top - sc.clientHeight + 56;
    }
  }

  /* ═══════════════ 设置同步 ═══════════════ */
  function applyUI() {
    els.bpmInput.value = S.bpm.toFixed(2);
    els.bpmChip.textContent = S.bpm.toFixed(2);
    els.bpbSelect.value = String(S.beatsPerBar);
    els.offsetInput.value = S.firstBeat.toFixed(3);
    const c = Math.round(S.confidence * 100);
    els.confFill.style.width = c + '%';
    els.confLabel.textContent = S.confidence > 0
      ? (c >= 70 ? '较高' : c >= 45 ? '一般' : '较低') + ' ' + c + '%'
      : '手动';
  }

  function setBpm(v, opts) {
    const nv = clamp(Math.round((Number(v) || 0) * 100) / 100, 30, 320);
    if (!nv) return;
    S.bpm = nv;
    els.bpmInput.value = nv.toFixed(2);
    els.bpmChip.textContent = nv.toFixed(2);
    if (!opts || !opts.silent) {
      syncBars(); renderGrid();
      S.waveDirty = true; paint();
      saveProject();
    }
  }

  function setFirstBeat(v) {
    S.firstBeat = Math.max(0, Math.round((Number(v) || 0) * 1000) / 1000);
    els.offsetInput.value = S.firstBeat.toFixed(3);
    syncBars(); renderGrid();
    S.waveDirty = true; paint();
    saveProject();
  }

  /* ═══════════════ 导出 ═══════════════ */
  let exportFormat = 'lrc';

  function collectText() {
    const T = beatDur();
    let totalLines = 0;

    if (exportFormat === 'lrc') {
      let out = '';
      for (let b = 0; b < S.bars.length; b++) {
        const text = smartJoin(S.bars[b].cells);
        if (!text) continue;
        out += `[${fmtLrc(barStart(b))}]${text}\n`;
        totalLines++;
      }
      return { text: out.trimEnd() + '\n', lines: totalLines, ext: 'lrc' };
    }

    if (exportFormat === 'elrc') {
      let out = '';
      for (let b = 0; b < S.bars.length; b++) {
        const cells = S.bars[b].cells;
        const t0 = barStart(b);
        let line = `[${fmtLrc(t0)}]`;
        let has = false;
        let lastEnd = t0;
        for (let k = 0; k < cells.length; k++) {
          const raw = String(cells[k] || '').trim();
          if (!raw) continue;
          has = true;
          const units = splitUnits(raw);
          if (!units.length) continue;
          const cellStart = t0 + k * T;
          const d = T / units.length;
          units.forEach((u, i) => {
            line += `<${fmtLrc(cellStart + i * d)}>${u}`;
            lastEnd = cellStart + (i + 1) * d;
          });
        }
        if (!has) continue;
        line += `<${fmtLrc(lastEnd)}>`;
        out += line + '\n';
        totalLines++;
      }
      return { text: out, lines: totalLines, ext: 'lrc' };
    }

    if (exportFormat === 'txt') {
      let out = `词格 · 伴奏卡点作词\n伴奏：${S.fileName || '—'}\nBPM：${S.bpm.toFixed(2)}　拍号：${S.beatsPerBar}/4\n\n`;
      const secMap = new Map(S.sections.map(s => [s.bar, s.name]));
      for (let b = 0; b < S.bars.length; b++) {
        if (secMap.has(b)) out += `\n【${secMap.get(b)}】\n`;
        const text = smartJoin(S.bars[b].cells);
        const chord = (S.bars[b].chord || '').trim();
        if (!text && !chord) continue;
        const mark = String(b + 1).padStart(3, '0');
        const tag = chord ? `[${chord}] ` : '';
        out += `${mark}  ${fmtTime(barStart(b), false)}  ${tag}${text}\n`;
        totalLines++;
      }
      return { text: out, lines: totalLines, ext: 'txt' };
    }

    const project = {
      app: '词格', version: 1,
      audio: S.fileName, audioSize: S.fileSize,
      duration: Math.round(S.duration * 1000) / 1000,
      bpm: S.bpm, firstBeat: S.firstBeat, beatsPerBar: S.beatsPerBar,
      sections: S.sections.slice(),
      bars: S.bars.map(b => ({ cells: b.cells.slice(), chord: b.chord || '' }))
    };
    return { text: JSON.stringify(project, null, 2), lines: S.bars.length, ext: 'json' };
  }

  function buildExport(fmt) {
    exportFormat = fmt;
    const { text, lines, ext } = collectText();
    els.exportText.value = text || '（还没有填写歌词）';
    els.exportInfo.textContent = `${lines} 行 · .${ext}` + (S.buffer ? ` · ${fmtTime(S.duration, false)}` : '');
    els.exportTabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.format === fmt));
    S._exportExt = ext;
  }

  function openExport() {
    if (!S.buffer) return;
    buildExport(exportFormat);
    if (typeof els.dialog.showModal === 'function') {
      if (!els.dialog.open) els.dialog.showModal();
    } else {
      els.dialog.setAttribute('open', '');
    }
  }

  function closeExport() {
    if (typeof els.dialog.close === 'function') els.dialog.close();
    else els.dialog.removeAttribute('open');
  }

  function exportFileName() {
    const base = (S.fileName || '词格').replace(/\.[^.]+$/, '') || '词格';
    return `${base}_词格.${S._exportExt || 'txt'}`;
  }

  function download() {
    const blob = new Blob([els.exportText.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function copyText() {
    const text = els.exportText.value;
    try {
      await navigator.clipboard.writeText(text);
      flashCopy('已复制');
    } catch (e) {
      els.exportText.removeAttribute('readonly');
      els.exportText.select();
      try { document.execCommand('copy'); flashCopy('已复制'); }
      catch (err) { flashCopy('复制失败'); }
      els.exportText.setAttribute('readonly', '');
    }
  }
  function flashCopy(msg) {
    const old = els.btnCopy.textContent;
    els.btnCopy.textContent = msg;
    setTimeout(() => { els.btnCopy.textContent = old; }, 1200);
  }

  /* ═══════════════ 持久化 ═══════════════ */
  function saveProject() {
    if (!S.fileName) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        audioName: S.fileName, audioSize: S.fileSize,
        bpm: S.bpm, firstBeat: S.firstBeat, beatsPerBar: S.beatsPerBar,
        bars: S.bars.map(b => ({ cells: b.cells, chord: b.chord || '' })),
        sections: S.sections,
        savedAt: Date.now()
      }));
      hintSaved();
    } catch (e) { /* 容量超限时忽略 */ }
  }
  const saveProjectDebounced = debounce(saveProject, 500);

  function hintSaved() {
    els.saveHint.textContent = '已保存';
    els.saveHint.classList.add('show');
    clearTimeout(hintSaved._t);
    hintSaved._t = setTimeout(() => els.saveHint.classList.remove('show'), 1400);
  }

  /* 和弦台联动：接收和弦进行并按小节填入 */
  const HARMONY_KEY = 'cige.chords.incoming';
  let pendingChords = null;

  function applyHarmony(payload) {
    if (!payload || !Array.isArray(payload.chords)) return false;
    const list = payload.chords.map(c => (typeof c === 'string' ? c.trim() : '')).filter(Boolean);
    if (!list.length) return false;
    if (!S.bars.length) { pendingChords = payload; return false; }
    S.bars.forEach((bar, i) => { bar.chord = list[i % list.length]; });
    renderGrid();
    saveProject();
    els.saveHint.textContent = '和弦已导入';
    els.saveHint.classList.add('show');
    clearTimeout(hintSaved._t);
    hintSaved._t = setTimeout(() => els.saveHint.classList.remove('show'), 1600);
    return true;
  }

  (function readPendingHarmony() {
    try {
      const raw = localStorage.getItem(HARMONY_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      localStorage.removeItem(HARMONY_KEY);
      if (p && Date.now() - (p.at || 0) < 600000) pendingChords = p;
    } catch (e) { /* ignore */ }
  })();

  function restoreProject(file) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      if (p.audioName !== file.name || p.audioSize !== file.size) return false;
      if (typeof p.bpm === 'number') S.bpm = clamp(p.bpm, 30, 320);
      if (typeof p.firstBeat === 'number') S.firstBeat = Math.max(0, p.firstBeat);
      if ([2, 3, 4, 6, 8].includes(p.beatsPerBar)) S.beatsPerBar = p.beatsPerBar;
      if (Array.isArray(p.sections)) S.sections = p.sections.filter(s => s && typeof s.bar === 'number');
      if (Array.isArray(p.bars)) {
        S.bars = p.bars.map(item => {
          const cells = Array.isArray(item) ? item : (item && item.cells) || [];
          return {
            cells: Array.from({ length: S.beatsPerBar }, (_, i) => (typeof cells[i] === 'string' ? cells[i] : '')),
            chord: !Array.isArray(item) && item && typeof item.chord === 'string' ? item.chord : ''
          };
        });
      }
      return true;
    } catch (e) { return false; }
  }

  /* ═══════════════ 事件绑定 ═══════════════ */
  /* 导入 */
  const pickFile = () => els.fileInput.click();
  $('#btnImport').addEventListener('click', pickFile);
  $('#btnEmptyImport').addEventListener('click', pickFile);
  $('#btnCtxChange').addEventListener('click', pickFile);

  els.btnHarmony.addEventListener('click', () => {
    window.open('harmony.html', 'cige-harmony', 'width=1180,height=820,menubar=no,toolbar=no');
  });

  els.btnStudio.addEventListener('click', () => {
    window.open('studio.html', 'cige-studio', 'width=1240,height=860,menubar=no,toolbar=no');
  });

  els.btnLearn.addEventListener('click', () => {
    window.open('learn.html', 'cige-learn', 'width=1180,height=820,menubar=no,toolbar=no');
  });

  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'cige:chords') applyHarmony(e.data);
  });

  // Safari 等浏览器可能拿不到 opener，用 storage 事件做跨窗口兜底
  window.addEventListener('storage', e => {
    if (e.key !== HARMONY_KEY || !e.newValue) return;
    try {
      const p = JSON.parse(e.newValue);
      localStorage.removeItem(HARMONY_KEY);
      if (p) applyHarmony(p);
    } catch (err) { /* ignore */ }
  });

  els.fileInput.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) loadAudioFile(f);
  });

  let dragDepth = 0;
  window.addEventListener('dragenter', e => {
    if (!e.dataTransfer || Array.from(e.dataTransfer.types).indexOf('Files') < 0) return;
    dragDepth++;
    els.dropOverlay.classList.add('on');
  });
  window.addEventListener('dragleave', e => {
    if (!e.dataTransfer) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) els.dropOverlay.classList.remove('on');
  });
  window.addEventListener('dragover', e => { if (e.dataTransfer) e.preventDefault(); });
  window.addEventListener('drop', e => {
    e.preventDefault();
    dragDepth = 0;
    els.dropOverlay.classList.remove('on');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadAudioFile(f);
  });

  /* 画布交互 */
  let drag = null;
  els.waveWrap.addEventListener('pointerdown', e => {
    if (!S.buffer) return;
    drag = { x0: e.clientX, start: S.view.start, end: S.view.end, moved: false };
    try { els.waveWrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  els.waveWrap.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    if (Math.abs(dx) > 4) drag.moved = true;
    if (drag.moved) {
      const span = drag.end - drag.start;
      const dt = -dx * span / Math.max(1, els.waveWrap.clientWidth);
      setView(drag.start + dt, drag.end + dt);
    }
  });
  els.waveWrap.addEventListener('pointerup', e => {
    if (drag && !drag.moved && S.buffer) {
      const rect = els.waveWrap.getBoundingClientRect();
      const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      seek(S.view.start + ratio * (S.view.end - S.view.start));
    }
    drag = null;
  });
  els.waveWrap.addEventListener('wheel', e => {
    if (!S.buffer) return;
    e.preventDefault();
    const rect = els.waveWrap.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const anchor = S.view.start + ratio * (S.view.end - S.view.start);
    zoomAround(anchor, e.deltaY > 0 ? 1.25 : 0.8);
  }, { passive: false });

  function setView(start, end) {
    const dur = S.duration || 1;
    let span = clamp(end - start, 0.4, dur);
    let s = clamp(start, 0, Math.max(0, dur - span));
    S.view = { start: s, end: s + span };
    S.waveDirty = true;
    paint();
  }

  function zoomAround(anchor, factor) {
    const dur = S.duration || 1;
    const span = (S.view.end - S.view.start) * factor;
    const ns = clamp(span, 0.4, dur);
    const ratio = ns / (S.view.end - S.view.start);
    const s = anchor - (anchor - S.view.start) * ratio;
    setView(s, s + ns);
  }

  $('#btnZoomIn').addEventListener('click', () => {
    zoomAround((S.view.start + S.view.end) / 2, 0.7);
  });
  $('#btnZoomOut').addEventListener('click', () => {
    zoomAround((S.view.start + S.view.end) / 2, 1.4);
  });
  $('#btnZoomAll').addEventListener('click', () => setView(0, S.duration || 1));

  /* 播放 */
  els.btnPlay.addEventListener('click', () => { S.playing ? pause() : play(); });

  window.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (e.code === 'Space' && !typing) {
      e.preventDefault();
      S.playing ? pause() : play();
    }
  });

  /* 校准 */
  els.bpmInput.addEventListener('change', () => setBpm(els.bpmInput.value));
  els.bpmInput.addEventListener('keydown', e => { if (e.key === 'Enter') els.bpmInput.blur(); });
  els.btnHalf.addEventListener('click', () => setBpm(S.bpm / 2));
  els.btnDouble.addEventListener('click', () => setBpm(S.bpm * 2));

  els.bpbSelect.addEventListener('change', () => {
    S.beatsPerBar = Number(els.bpbSelect.value) || 4;
    syncBars(); renderGrid(); paint(); saveProject();
  });

  els.offsetInput.addEventListener('change', () => setFirstBeat(els.offsetInput.value));

  document.querySelectorAll('[data-nudge]').forEach(btn => {
    btn.addEventListener('click', () => {
      setFirstBeat(S.firstBeat + Number(btn.dataset.nudge));
    });
  });

  document.querySelectorAll('[data-beat]').forEach(btn => {
    btn.addEventListener('click', () => {
      setFirstBeat(S.firstBeat + Number(btn.dataset.beat) * beatDur());
    });
  });

  els.btnAlign.addEventListener('click', () => {
    if (!S.buffer) return;
    setFirstBeat(nowTime());
    els.tapHint.textContent = `首拍已对齐到 ${fmtTime(S.firstBeat)}`;
  });

  els.btnTap.addEventListener('click', () => {
    const now = performance.now() / 1000;
    if (now - S.lastTap > 2.2) S.tapTimes = [];
    S.tapTimes.push(now);
    S.lastTap = now;
    if (S.tapTimes.length > 9) S.tapTimes.shift();
    const n = S.tapTimes.length;
    if (n >= 2) {
      const interval = (S.tapTimes[n - 1] - S.tapTimes[0]) / (n - 1);
      if (interval > 0.19 && interval < 2.1) {
        setBpm(60 / interval);
        els.tapHint.textContent = `已打点 ${n} 次 · ${(60 / interval).toFixed(2)} BPM`;
        return;
      }
    }
    els.tapHint.textContent = `已打点 ${n} 次，继续…`;
  });

  els.btnReanalyze.addEventListener('click', async () => {
    if (!S.buffer) return;
    showLoading('正在重新解析节拍…');
    await frame();
    const res = detectTempo(S.buffer);
    S.bpm = res.bpm; S.firstBeat = res.firstBeat; S.confidence = res.confidence;
    syncBars();
    if (window.ChordDetector) {
      const chords = window.ChordDetector.detectChords(S.buffer, {
        bpm: S.bpm, firstBeat: S.firstBeat, beatsPerBar: S.beatsPerBar
      });
      S.bars.forEach((bar, i) => { bar.chord = chords[i] || ''; });
    }
    renderGrid(); applyUI(); paint(); saveProject();
    hideLoading();
  });

  /* 歌词输入 */
  els.grid.addEventListener('input', e => {
    const chip = e.target.closest('.chord-chip');
    if (chip) {
      const bar = Number(chip.dataset.bar);
      if (S.bars[bar]) { S.bars[bar].chord = chip.value.trim(); saveProjectDebounced(); }
      return;
    }
    const inp = e.target.closest('.cell');
    if (!inp) return;
    const bar = Number(inp.dataset.bar);
    const beat = Number(inp.dataset.beat);
    if (!S.bars[bar] || !S.bars[bar].cells) return;
    S.bars[bar].cells[beat] = inp.value;
    updateDensity(inp);
    updateGridInfo();
    saveProjectDebounced();
  });

  els.grid.addEventListener('keydown', e => {
    const inp = e.target.closest('.cell');
    if (inp) {
      const bar = Number(inp.dataset.bar);
      const beat = Number(inp.dataset.beat);
      const bpb = S.beatsPerBar;
      let handled = true;
      if (e.key === 'ArrowRight') {
        if (beat + 1 < bpb) focusCell(bar, beat + 1);
        else focusCell(bar + 1, 0);
      } else if (e.key === 'ArrowLeft') {
        if (beat - 1 >= 0) focusCell(bar, beat - 1);
        else focusCell(bar - 1, bpb - 1);
      } else if (e.key === 'ArrowDown') {
        focusCell(bar + 1, beat);
      } else if (e.key === 'ArrowUp') {
        focusCell(bar - 1, beat);
      } else if (e.key === 'Enter') {
        focusCell(bar + 1, 0);
      } else if (e.key === 'Escape') {
        inp.blur();
      } else {
        handled = false;
      }
      if (handled && e.key !== 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    const secName = e.target.closest('.sec-name');
    if (secName && e.key === 'Enter') secName.blur();
  });

  els.grid.addEventListener('change', e => {
    const secName = e.target.closest('.sec-name');
    if (!secName) return;
    const row = secName.closest('.section-row');
    const bar = Number(row.dataset.bar);
    const sec = S.sections.find(s => s.bar === bar);
    if (sec) { sec.name = secName.value.trim() || '段落'; secName.value = sec.name; saveProjectDebounced(); }
  });

  els.grid.addEventListener('click', e => {
    const del = e.target.closest('.sec-del');
    if (!del) return;
    const row = del.closest('.section-row');
    const bar = Number(row.dataset.bar);
    S.sections = S.sections.filter(s => s.bar !== bar);
    renderGrid();
    saveProject();
  });

  els.btnAddSection.addEventListener('click', () => {
    const bar = (S.curBar >= 0 && S.curBar < S.bars.length) ? S.curBar : 0;
    if (S.sections.some(s => s.bar === bar)) {
      els.tapHint.textContent = '该小节已有段落标记';
      return;
    }
    S.sections.push({ bar, name: `段落 ${S.sections.length + 1}` });
    S.sections.sort((a, b) => a.bar - b.bar);
    renderGrid();
    const inp = els.grid.querySelector(`.section-row[data-bar="${bar}"] .sec-name`);
    if (inp) { inp.focus(); inp.select(); }
    saveProject();
  });

  /* 导出 */
  els.btnExport.addEventListener('click', openExport);
  els.exportTabs.addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    buildExport(tab.dataset.format);
  });

  els.btnCopy.addEventListener('click', copyText);
  els.btnDownload.addEventListener('click', download);
  els.btnCloseDialog.addEventListener('click', closeExport);
  els.dialog.addEventListener('click', e => {
    if (e.target === els.dialog) closeExport();
  });

  /* 尺寸 */
  if (window.ResizeObserver) {
    new ResizeObserver(() => { layoutWave(); paint(); }).observe(els.waveWrap);
  } else {
    window.addEventListener('resize', () => { layoutWave(); paint(); });
  }

  /* ═══════════════ 主循环 ═══════════════ */
  function tick(ts) {
    requestAnimationFrame(tick);
    if (!S.buffer) return;
    if (S.playing) {
      const t = nowTime();
      if (t >= S.duration) pause();
    }
    if (ts - lastUI > 33) updateTransport(false);
    updateHighlight(false);
    if (S.playing) paint();
  }

  /* 初始 */
  applyUI();
  updatePlayButton();
  updateTransport(true);
  requestAnimationFrame(tick);
})();
