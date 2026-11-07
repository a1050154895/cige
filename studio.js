/* 编曲台 · 词格多轨伴奏工作台（风格模板 / 伴奏组合 / 混音 / MIDI） */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const QUALITIES = [
    { id: '', label: '大三', suffix: '', intervals: [0, 4, 7] },
    { id: 'm', label: '小三', suffix: 'm', intervals: [0, 3, 7] },
    { id: '7', label: '属七', suffix: '7', intervals: [0, 4, 7, 10] },
    { id: 'maj7', label: '大七', suffix: 'maj7', intervals: [0, 4, 7, 11] },
    { id: 'm7', label: '小七', suffix: 'm7', intervals: [0, 3, 7, 10] },
    { id: '6', label: '六', suffix: '6', intervals: [0, 4, 7, 9] },
    { id: 'm6', label: '小六', suffix: 'm6', intervals: [0, 3, 7, 9] },
    { id: 'sus2', label: '挂二', suffix: 'sus2', intervals: [0, 2, 7] },
    { id: 'sus4', label: '挂四', suffix: 'sus4', intervals: [0, 5, 7] },
    { id: 'dim', label: '减三', suffix: 'dim', intervals: [0, 3, 6] },
    { id: 'aug', label: '增三', suffix: 'aug', intervals: [0, 4, 8] },
    { id: 'add9', label: '加九', suffix: 'add9', intervals: [0, 4, 7, 14] },
    { id: 'm7b5', label: '半减', suffix: 'm7b5', intervals: [0, 3, 6, 10] }
  ];
  const NUMERALS = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
  const FUNCTIONS = { 0: '主', 4: '主', 9: '主', 5: '下属', 2: '下属', 7: '属', 11: '属' };
  const SECTIONS = ['', '主歌', '预副歌', '副歌', '桥段', '尾声'];
  const LS_KEY = 'cige.studio.v1';

  const DEFAULT_TRACKS = [
    { id: 'drums', name: '鼓组', inst: 'drums', on: true, vol: .84, pan: 0, solo: false },
    { id: 'bass', name: '贝斯', inst: 'bass', on: true, vol: .72, pan: 0, solo: false },
    { id: 'chord', name: '和弦伴奏', inst: 'piano', on: true, vol: .7, pan: 0, solo: false },
    { id: 'arp', name: '琶音', inst: 'guitar', on: false, vol: .58, pan: .06, solo: false },
    { id: 'pad', name: '铺底', inst: 'strings', on: false, vol: .52, pan: 0, solo: false },
    { id: 'lead', name: '词格旋律', inst: 'lead', on: false, vol: .62, pan: 0, solo: false }
  ];

  // 风格只决定律动取向；具体演奏法由各轨道乐器决定（见 乐器演奏法引擎）
  const STYLES = [
    { id: 'pop', name: '流行', desc: '钢琴柱式 · 木吉他扫弦 · 稳定四拍' },
    { id: 'rock', name: '摇滚', desc: '电吉他强切 · 贝斯推进 · 硬朗鼓点' },
    { id: 'folk', name: '民谣', desc: '木吉他扫弦/指弹 · 轻鼓 · 呼吸感' },
    { id: 'edm', name: '电子', desc: '四踩 · 合成贝斯 · 16 分琶音' },
    { id: 'jazz', name: '爵士', desc: '走贝斯 · 切分 Comping · Swing 鼓点' },
    { id: 'ballad', name: '抒情', desc: '长音铺底 · 慢歌呼吸 · 稀疏鼓点' }
  ];

  const COMBOS = [
    { id: 'pop-piano', name: '流行钢琴', desc: '钢琴柱式 · 轻鼓 · 稳定四拍', style: 'pop',
      inst: { drums: 'drums', bass: 'bass', chord: 'piano', arp: 'guitar', pad: 'strings' },
      on: { drums: true, bass: true, chord: true, arp: false, pad: false },
      vol: { drums: .84, bass: .72, chord: .72, arp: .58, pad: .52 } },
    { id: 'folk-guitar', name: '民谣吉他', desc: '木吉他分解 · 轻鼓 · 呼吸感', style: 'folk',
      inst: { drums: 'drums', bass: 'bass', chord: 'guitar', arp: 'guitar', pad: 'strings' },
      on: { drums: true, bass: true, chord: true, arp: true, pad: false },
      vol: { drums: .66, bass: .7, chord: .55, arp: .62, pad: .52 } },
    { id: 'rock-band', name: '摇滚乐队', desc: '电吉他八分 · 强拍 · 推进感', style: 'rock',
      inst: { drums: 'drums', bass: 'bass', chord: 'eguitar', arp: 'eguitar', pad: 'pad' },
      on: { drums: true, bass: true, chord: true, arp: false, pad: false },
      vol: { drums: .9, bass: .76, chord: .66, arp: .58, pad: .5 } },
    { id: 'edm-synth', name: '电子舞曲', desc: '四踩 · 合成贝斯 · 16 分琶音', style: 'edm',
      inst: { drums: 'drums', bass: 'synthbass', chord: 'epiano', arp: 'pluck', pad: 'pad' },
      on: { drums: true, bass: true, chord: true, arp: true, pad: false },
      vol: { drums: .9, bass: .78, chord: .6, arp: .64, pad: .5 } },
    { id: 'jazz-trio', name: '爵士三重奏', desc: '走贝斯 · 七和弦 · 松弛', style: 'jazz',
      inst: { drums: 'drums', bass: 'bass', chord: 'epiano', arp: 'pluck', pad: 'strings' },
      on: { drums: true, bass: true, chord: true, arp: false, pad: false },
      vol: { drums: .7, bass: .74, chord: .66, arp: .58, pad: .5 } },
    { id: 'ballad-strings', name: '弦乐抒情', desc: '钢琴 + 弦乐铺底 · 慢歌', style: 'ballad',
      inst: { drums: 'drums', bass: 'bass', chord: 'piano', arp: 'strings', pad: 'strings' },
      on: { drums: true, bass: true, chord: true, arp: false, pad: true },
      vol: { drums: .58, bass: .66, chord: .66, arp: .58, pad: .6 } }
  ];

  const state = {
    key: 0, mode: 'major', bpm: 120, bpb: 4,
    bars: [
      { chord: '0|', section: '主歌' }, { chord: '5|', section: '' },
      { chord: '7|', section: '' }, { chord: '9|m', section: '' },
      { chord: '9|m', section: '副歌' }, { chord: '5|', section: '' },
      { chord: '0|', section: '' }, { chord: '7|', section: '' }
    ],
    style: 'pop',
    variation: 0,
    combo: 'pop-piano',
    tracks: DEFAULT_TRACKS.map(t => ({ ...t })),
    favorites: [], history: [],
    sel: 0, onlyFav: false,
    playing: false,
    cige: null
  };

  let engine = null;
  let schedTimer = null;
  let uiTimers = [];
  let nextBarTime = 0;
  let playIndex = 0;
  let wavBusy = false;

  const els = {
    styles: $('#styles'), combos: $('#combos'), instGrid: $('#instGrid'),
    btnOnlyFav: $('#btnOnlyFav'), histInfo: $('#histInfo'),
    btnPlay: $('#btnPlay'), posBar: $('#posBar'), posInfo: $('#posInfo'),
    bpmInput: $('#bpmInput'), bpbSelect: $('#bpbSelect'), btnVariation: $('#btnVariation'), loopInfo: $('#loopInfo'),
    trackRows: $('#trackRows'), mixInfo: $('#mixInfo'),
    barGrid: $('#barGrid'), progInfo: $('#progInfo'), cigeInfo: $('#cigeInfo'),
    btnAddBar: $('#btnAddBar'), btnDelBar: $('#btnDelBar'), btnClearBars: $('#btnClearBars'),
    btnSheet: $('#btnSheet'), btnMidi: $('#btnMidi'), btnJson: $('#btnJson'), btnSend: $('#btnSend'),
    btnSyncCige: $('#btnSyncCige'), btnWav: $('#btnWav'),
    toast: $('#toast')
  };

  /* ── 基础工具 ── */
  const qualityOf = id => QUALITIES.find(q => q.id === id) || QUALITIES[0];
  const parseChord = c => {
    const i = c.indexOf('|');
    return { root: Number(c.slice(0, i)) || 0, qid: c.slice(i + 1) };
  };

  /* 和弦名称（词格工程存的 "Am7" 等）→ 编曲台 root|qid */
  function noteToPc(text) {
    const m = /^([A-Ga-g])([#b♯♭]?)/.exec(text);
    if (!m) return null;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
    if (base == null) return null;
    let pc = base;
    if (m[2] === '#' || m[2] === '♯') pc += 1;
    if (m[2] === 'b' || m[2] === '♭') pc -= 1;
    return ((pc % 12) + 12) % 12;
  }

  function qualityFromName(rest) {
    if (!rest) return '';
    const s = rest.toLowerCase();
    if (/sus2/.test(s)) return 'sus2';
    if (/sus4|sus/.test(s)) return 'sus4';
    if (/m7b5|ø|dim7|°7/.test(s)) return 'm7b5';
    if (/dim|°/.test(s)) return 'dim';
    if (/aug|\+/.test(s)) return 'aug';
    if (/add9|add2|9/.test(s)) return 'add9';
    if (/m7|min7/.test(s)) return 'm7';
    if (/m6|min6/.test(s)) return 'm6';
    if (/maj7|M7/.test(rest) || /major7/.test(s)) return 'maj7';
    if (/m|min/.test(s)) return 'm';
    if (/7/.test(s)) return '7';
    if (/6/.test(s)) return '6';
    return '';
  }

  function parseChordName(name) {
    const raw = String(name || '').split('/')[0].trim();
    if (!raw) return '';
    const pc = noteToPc(raw);
    if (pc == null) return '';
    const rest = raw.slice(1).replace(/^[#b♯♭]/, '');
    return `${pc}|${qualityFromName(rest)}`;
  }

  /* 歌词切分（与词格同一规则：中文按字，拉丁按词） */
  const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
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
    for (const raw of cells || []) {
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

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function barLyric(bar) {
    if (!bar || !Array.isArray(bar.cells)) return '';
    return smartJoin(bar.cells).trim();
  }
  const trackById = id => state.tracks.find(t => t.id === id);
  const barDur = () => (60 / state.bpm) * state.bpb;
  const meterText = () => (state.bpb === 6 ? '6/8' : `${state.bpb}/4`);
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const chordName = (root, qid) => NOTES[root] + qualityOf(qid).suffix;
  const anySolo = () => state.tracks.some(t => t.solo);

  function audible(t) {
    return !!t && t.on && (!anySolo() || t.solo);
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        key: state.key, bpm: state.bpm, bpb: state.bpb,
        bars: state.bars.map(b => ({ chord: b.chord, section: b.section, cells: b.cells || null })),
        style: state.style, variation: state.variation, combo: state.combo,
        tracks: state.tracks, favorites: state.favorites, history: state.history,
        cige: state.cige
      }));
    } catch (e) { /* ignore */ }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.bpm === 'number') state.bpm = Math.min(240, Math.max(40, p.bpm));
      if ([2, 3, 4, 6, 8].includes(p.bpb)) state.bpb = p.bpb;
      if (typeof p.key === 'number') state.key = p.key % 12;
      if (Array.isArray(p.bars) && p.bars.length) {
        state.bars = p.bars.map(b => ({
          chord: typeof b.chord === 'string' ? b.chord : '0|',
          section: typeof b.section === 'string' ? b.section.slice(0, 6) : '',
          cells: Array.isArray(b.cells)
            ? Array.from({ length: state.bpb }, (_, i) => String(b.cells[i] == null ? '' : b.cells[i]))
            : null
        }));
      }
      if (STYLES.some(s => s.id === p.style)) state.style = p.style;
      if (typeof p.variation === 'number') state.variation = Math.max(0, p.variation | 0);
      if (COMBOS.some(c => c.id === p.combo) || p.combo === 'custom') state.combo = p.combo;
      if (Array.isArray(p.tracks)) {
        state.tracks = DEFAULT_TRACKS.map(def => {
          const found = p.tracks.find(t => t.id === def.id);
          if (!found) return { ...def };
          return {
            ...def,
            inst: typeof found.inst === 'string' ? found.inst : def.inst,
            on: !!found.on,
            vol: Math.min(1, Math.max(0, Number(found.vol) || def.vol)),
            pan: Math.min(1, Math.max(-1, Number(found.pan) || 0)),
            solo: !!found.solo
          };
        });
      }
      if (Array.isArray(p.favorites)) state.favorites = p.favorites.filter(id => COMBOS.some(c => c.id === id));
      if (Array.isArray(p.history)) state.history = p.history.filter(id => COMBOS.some(c => c.id === id)).slice(0, 4);
      if (p.cige && typeof p.cige === 'object') {
        state.cige = { audioName: String(p.cige.audioName || ''), at: Number(p.cige.at) || 0 };
      }
    } catch (e) { /* ignore */ }
  }

  function engineReady() {
    if (!engine) engine = window.CigeSynth.createEngine({ master: .33 });
    engine.resume();
    return engine;
  }

  function chordStack(root, qid, base) {
    const iv = qualityOf(qid).intervals.slice();
    const arr = iv.map(x => base + root + x);
    const rot = state.variation % 3;
    for (let i = 0; i < rot; i++) arr.push(arr.shift() + 12);
    return arr;
  }

  function funcLabel(chord) {
    if (!chord) return '—';
    const { root, qid } = parseChord(chord);
    const deg = (root - state.key + 12) % 12;
    return `${NUMERALS[deg]}${qualityOf(qid).suffix} · ${FUNCTIONS[deg] || '变'}`;
  }

  function barName(bar) {
    if (!bar.chord) return '—';
    const { root, qid } = parseChord(bar.chord);
    return chordName(root, qid);
  }

  /* ── 词格工程联动 ── */
  const CIGE_KEY = 'cige.project.v1';

  function readCigeProject() {
    try {
      const raw = localStorage.getItem(CIGE_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p || !Array.isArray(p.bars) || !p.bars.length) return null;
      return p;
    } catch (e) { return null; }
  }

  function cigeLabel() {
    const lyricBars = state.bars.filter(b => barLyric(b)).length;
    if (state.cige) {
      const name = state.cige.audioName
        ? state.cige.audioName.replace(/\.(mp3|wav|m4a|aac|flac|ogg)$/i, '')
        : '词格工程';
      return lyricBars ? `词格：${name} · ${lyricBars} 小节有词` : `词格：${name} · 无歌词`;
    }
    return readCigeProject() ? '检测到词格工程 · 点“同步词格”' : '未同步词格';
  }

  function syncFromCige(silent) {
    const p = readCigeProject();
    if (!p) {
      if (!silent) toast('词格还没有工程：先在词格导入伴奏、填词');
      return false;
    }
    const bpm = Number(p.bpm);
    if (Number.isFinite(bpm)) state.bpm = Math.min(240, Math.max(40, Math.round(bpm)));
    const bpb = Number(p.beatsPerBar);
    if ([2, 3, 4, 6, 8].includes(bpb)) state.bpb = bpb;
    const secMap = new Map();
    for (const s of p.sections || []) {
      if (s && typeof s.bar === 'number' && typeof s.name === 'string') secMap.set(s.bar, s.name.slice(0, 6));
    }
    state.bars = p.bars.map((b, i) => {
      const cells = Array.from({ length: state.bpb }, (_, k) =>
        String((b && b.cells && b.cells[k]) == null ? '' : b.cells[k]));
      return {
        chord: parseChordName(b && b.chord) || '0|',
        section: secMap.get(i) || '',
        cells
      };
    });
    state.sel = Math.min(state.sel, state.bars.length - 1);
    state.cige = { audioName: String(p.audioName || '词格工程'), at: Date.now() };
    const lead = trackById('lead');
    const hasLyric = state.bars.some(b => barLyric(b));
    if (lead && hasLyric) lead.on = true;
    if (state.playing) stopPlay();
    els.bpmInput.value = state.bpm;
    els.bpbSelect.value = String(state.bpb);
    renderAll();
    if (!silent) {
      toast(hasLyric
        ? `已同步 ${state.bars.length} 小节 · 词格旋律已生成`
        : `已同步 ${state.bars.length} 小节（词格暂无歌词）`);
    }
    return true;
  }

  /* ── 歌词 → 旋律事件 ── */
  const MELODY_CONTOURS = [
    [0, 1, 2, 1, 0, -1, 0, 1],
    [0, -1, -2, -1, 0, 1, 2, 1],
    [0, 1, 0, -1, 0, 1, 2, 2],
    [0, 2, 1, 3, 2, 1, 0, 1]
  ];

  function melodyPool(root, qid) {
    const iv = qualityOf(qid).intervals;
    const base = 60 + ((root + 12) % 12);
    const pool = [];
    for (let oct = 0; oct < 2; oct++) {
      for (const x of iv) pool.push(base + x + oct * 12);
    }
    return pool.sort((a, b) => a - b);
  }

  function lyricEvents(c, bar) {
    const out = [];
    if (!Array.isArray(bar.cells) || !bar.cells.some(x => String(x || '').trim())) return out;
    const pool = melodyPool(c.root, c.qid);
    const contour = MELODY_CONTOURS[(c.variation + c.barIndex) % MELODY_CONTOURS.length];
    const chorus = c.lift > 1;
    const center = Math.min(pool.length - 2, 1 + (c.barIndex % 2) + (chorus ? 1 : 0));
    let syl = 0;
    for (let beat = 0; beat < Math.min(bar.cells.length, c.bpb); beat++) {
      const units = splitUnits(bar.cells[beat]);
      const n = units.length;
      for (let k = 0; k < n; k++) {
        const step = beat * 4 + (n === 1 ? 0 : (k * 4) / n);
        const dur = n === 1 ? 3.6 : Math.max(.8, (4 / n) * .92);
        const idx = Math.max(0, Math.min(pool.length - 1, center + contour[syl % contour.length]));
        out.push({
          track: 'lead', step, midi: Math.min(88, pool[idx]), dur,
          gain: (.7 + (chorus ? .08 : 0)) * c.lift,
          lyric: units[k]
        });
        syl++;
      }
    }
    return out;
  }

  /* ── 乐器演奏法引擎 ───────────────────────────────────────────
     不是所有轨道共用同一套节奏，而是按「角色 × 乐器 × 风格」生成：
     钢琴=左手低音+右手柱式，电钢=切分 Comping，管风琴=持续音+脚键盘，
     木吉他=扫弦/指弹，电吉他=强切 power chord，弦乐/Pad=长音铺底，
     贝斯=根音五度/走贝斯/八分驱动，拨弦=分解琶音，主音=旋律短句。
  ──────────────────────────────────────────────────────────── */
  const E = (out, track, step, midi, dur, gain) => {
    out.push({
      track, step: +Math.max(0, step).toFixed(2), midi: Math.round(midi),
      dur: Math.max(.35, +dur.toFixed(2)), gain: +gain.toFixed(3)
    });
  };
  const K = (out, drum, step, gain) => {
    out.push({ track: 'drums', drum, step: +Math.max(0, step).toFixed(2), gain: +gain.toFixed(3) });
  };

  const chordNotes = (c, base) => chordStack(c.root, c.qid, base);

  function chordAt(out, c, track, step, dur, gain, base) {
    for (const m of chordNotes(c, base == null ? 60 : base)) {
      E(out, track, step, m, dur, gain * c.lift);
    }
  }

  /* 扫弦：同一和弦错开几毫秒落下，才有“扫”的颗粒感 */
  function strum(out, c, step, dir, gain) {
    const arr = chordNotes(c, 48);
    if (dir === 'up') arr.reverse();
    arr.forEach((m, i) => E(out, 'chord', step + i * .06, m, 1.3, gain * c.lift));
  }

  function strumPattern(out, c, kind) {
    const S = c.steps;
    const downUp = [[0, 'down'], [2, 'up'], [4, 'down'], [6, 'up'],
      [8, 'down'], [10, 'up'], [12, 'down'], [14, 'up']];
    const folk = [[0, 'down'], [4, 'up'], [5.5, 'down'], [8, 'down'], [11.5, 'up'], [13.5, 'down']];
    for (const [s, dir] of (kind === 'folk' ? folk : downUp)) {
      if (s < S) strum(out, c, s, dir, kind === 'folk' ? .36 : .3);
    }
  }

  function powerChord(out, c, step, gain, dur) {
    const base = 48 + c.root;
    for (const x of [0, 7, 12]) E(out, 'chord', step, base + x, dur, gain * c.lift);
  }

  function fingerpick(out, c) {
    const S = c.steps, v = c.variation;
    const low = 36 + c.root + (v % 2 ? 7 : 0);
    const high = chordNotes(c, 48).map(m => m + 12);
    E(out, 'arp', 0, low, 3.6, .5 * c.lift);
    for (const s of [2, 4, 6, 10, 12, 14]) {
      if (s >= S) continue;
      E(out, 'arp', s, high[(s + v) % high.length], 1.6, .4 * c.lift);
    }
    if (S >= 8) E(out, 'arp', 8, low, 3.6, .46 * c.lift);
  }

  function arpeggio(out, c, track, stepSize, gain) {
    const notes = chordNotes(c, 60).concat(chordNotes(c, 72));
    const n = notes.length;
    for (let s = 0, k = c.variation % n; s < c.steps; s += stepSize, k++) {
      E(out, track, s, notes[k % n], stepSize === 1 ? .9 : 2.2, gain * c.lift);
    }
  }

  /* 鼓组：不同风格有自己的律动，而不是一条通用四拍 */
  function drumGroove(out, c) {
    const S = c.steps, v = c.variation;
    const hit = (k, s, g) => { if (s < S) K(out, k, s, g * c.lift); };

    if (state.style === 'edm') {
      for (let b = 0; b < c.bpb; b++) {
        const s = b * 4;
        hit('kick', s, 1);
        if (b % 2 === 1) hit('clap', s, .85);
        for (let k = 0; k < 4; k++) hit('hat', s + k, k === 0 ? .42 : .3);
      }
      hit('openhat', S - 2, .5);
      return;
    }

    if (state.style === 'jazz') {
      for (let s = 0; s < S; s += 4) { hit('hat', s, .48); hit('hat', s + 3.2, .34); }
      for (let b = 0; b < c.bpb; b++) {
        if (b % 2 === 0) hit('kick', b * 4, .42);
        else hit('snare', b * 4, .3);
      }
      return;
    }

    for (let b = 0; b < c.bpb; b++) {
      const s = b * 4;
      if (state.style === 'ballad') {
        if (b === 0) hit('kick', 0, .55);
        if (b === Math.floor(c.bpb / 2)) hit('snare', s, .28);
        hit('hat', s, .18);
      } else if (state.style === 'folk') {
        if (b === 0) hit('kick', 0, .6);
        if (b === 2) hit('kick', s, .45);
        if (b === 1 || b === 3) hit('snare', s, .3);
        hit('hat', s, .18);
      } else if (state.style === 'rock') {
        hit('kick', s, b % 2 === 0 ? .85 : .5);
        if (b % 2 === 1) hit('snare', s, .82);
        hit('hat', s, .4);
        hit('hat', s + 2, .34);
        if (b === c.bpb - 1) hit('hat', s + 3, .26);
      } else {
        if (b % 2 === 0) hit('kick', s, .8);
        else hit('snare', s, .68);
        hit('hat', s, .42);
        hit('hat', s + 2, .3);
      }
    }
    if (S >= 12 && (v === 2 || v === 5)) {
      for (let k = 0; k < 4; k++) hit('snare', S - 4 + k, .12 + k * .04);
    }
  }

  /* 和弦轨：乐器决定“怎么弹和弦” */
  function chordTrack(out, c) {
    const inst = trackById('chord').inst;
    const S = c.steps, v = c.variation;
    const bass = 36 + c.root;

    switch (inst) {
      case 'piano': {
        E(out, 'chord', 0, bass + 12, S / 2, .5 * c.lift);
        if (S >= 12) E(out, 'chord', S / 2, bass + 12, S / 2, .44 * c.lift);
        if (state.style === 'ballad') {
          chordAt(out, c, 'chord', 0, S, .55);
        } else if (state.style === 'jazz') {
          for (const s of (v % 2 ? [0, 3.2, 5.2, 8.4] : [0, 2.2, 5, 7.4])) {
            chordAt(out, c, 'chord', s, 1.7, .4);
          }
        } else {
          chordAt(out, c, 'chord', 0, 3.3, .52);
          if (S >= 8) chordAt(out, c, 'chord', 8, 3.3, .5);
          if (v % 3 === 1 && S >= 12) chordAt(out, c, 'chord', 11, 2.6, .4);
        }
        break;
      }
      case 'epiano': {
        const hits = state.style === 'jazz'
          ? [0, 2.4, 4.8, 7.4, 10, 12.4]
          : [0, 2.5, 5.5, 8, 10.5];
        for (const s of hits) if (s < S) chordAt(out, c, 'chord', s, 1.4, .4);
        break;
      }
      case 'organ': {
        chordAt(out, c, 'chord', 0, S, .45);
        E(out, 'chord', 0, bass + 12, S / 2, .38 * c.lift);
        break;
      }
      case 'guitar': {
        strumPattern(out, c, state.style === 'folk' || v % 2 === 0 ? 'folk' : 'pop');
        break;
      }
      case 'eguitar': {
        const hits = state.style === 'rock' ? [0, 4, 6, 8, 12, 14] : [0, 4, 8, 12];
        for (const s of hits) if (s < S) powerChord(out, c, s, s % 4 === 0 ? .48 : .36, 1.1);
        break;
      }
      case 'pluck': {
        arpeggio(out, c, 'chord', 2, .42);
        break;
      }
      case 'strings': {
        // 弦乐分两层：低层大提琴 + 高层小提琴，形成真正的弦乐群
        chordAt(out, c, 'chord', 0, S, .34, 48);
        chordAt(out, c, 'chord', 0, S, .24, 60);
        break;
      }
      case 'pad': {
        chordAt(out, c, 'chord', 0, S, .38, 48);
        break;
      }
      case 'bass': {
        E(out, 'chord', 0, bass, 3.4, .55 * c.lift);
        if (S >= 8) E(out, 'chord', 8, bass + 7, 3.4, .5 * c.lift);
        break;
      }
      case 'synthbass': {
        E(out, 'chord', 0, bass, 3.4, .6 * c.lift);
        if (S >= 8) E(out, 'chord', 8, bass + 12, 3.4, .55 * c.lift);
        break;
      }
      default: chordAt(out, c, 'chord', 0, 3.3, .5);
    }
  }

  /* 贝斯轨：根音五度 / 八分驱动 / 爵士走贝斯 */
  function bassTrack(out, c) {
    const inst = trackById('bass').inst;
    const S = c.steps, v = c.variation;
    const root = 36 + c.root;
    const fifth = root + 7;
    const oct = root + 12;
    const N = (s, m, d, g) => E(out, 'bass', s, m, d, g * c.lift);

    if (state.style === 'jazz') {
      const iv = c.tones;
      for (let k = 0; k < Math.min(4, Math.ceil(S / 4)); k++) {
        const s = k * 4;
        const m = k === 0 ? root
          : k === 1 ? root + (iv[1] == null ? 4 : iv[1])
          : k === 2 ? root + (iv[2] == null ? 7 : iv[2])
          : c.nextBass - 1;
        N(s, m, 3.4, .8);
      }
      return;
    }
    if (state.style === 'ballad') {
      N(0, root, S / 2, .66);
      if (S >= 8) N(S / 2, root, S / 2, .58);
      return;
    }
    if (inst === 'synthbass') {
      for (let s = 0; s < S; s += 2) N(s, s % 8 === 6 ? fifth : root, 1.7, .72);
      if (v % 2 === 1) for (let s = 1; s < S; s += 2) N(s, oct, .8, .28);
      return;
    }
    if (inst === 'piano') {
      N(0, root, 3.6, .62);
      if (S >= 8) N(8, oct, 3.6, .55);
      return;
    }
    if (state.style === 'rock') {
      for (let s = 0; s < S; s += 2) N(s, s % 8 === 4 ? fifth : root, 1.7, .78);
      return;
    }
    if (state.style === 'edm') {
      for (let s = 0; s < S; s += 2) N(s, s % 8 === 6 ? fifth : root, 1.5, .78);
      return;
    }
    // 流行 / 民谣：根音打底，后半拍换五度或八度
    N(0, root, 3.2, .78);
    if (S >= 8) N(8, v % 2 ? oct : fifth, 3.2, .72);
    if (S >= 16 && v % 3 === 1) N(12, oct, 1.5, .5);
  }

  /* 琶音轨：吉他指弹 / 钢琴阿尔贝蒂 / 拨弦分解 / 电吉他闷切 */
  function arpTrack(out, c) {
    const inst = trackById('arp').inst;
    const S = c.steps, v = c.variation;

    if (inst === 'guitar') { fingerpick(out, c); return; }

    if (inst === 'eguitar') {
      const base = 48 + c.root;
      for (let s = 0; s < S; s++) {
        const m = [base, base + 7, base + 12, base + 7][(s + v) % 4];
        E(out, 'arp', s, m, .85, s % 4 === 0 ? .3 : .22);
      }
      return;
    }

    if (inst === 'piano') {
      const notes = chordNotes(c, 60);
      const low = notes[0] - 12, mid = notes[1], high = notes[2] == null ? notes[0] + 12 : notes[2];
      const seq = [low, mid, high, mid];
      for (let s = 0, k = 0; s < S; s += 2, k++) {
        E(out, 'arp', s, seq[k % 4], 1.8, .4 * c.lift);
      }
      return;
    }

    if (inst === 'strings' || inst === 'pad' || inst === 'organ') {
      arpeggio(out, c, 'arp', 4, .3);
      return;
    }

    arpeggio(out, c, 'arp', inst === 'pluck' && state.style === 'edm' ? 1 : 2, .42);
  }

  /* 铺底轨：真正会延音的乐器走长音，钢琴类改为两半软和弦 */
  function padTrack(out, c) {
    const inst = trackById('pad').inst;
    const S = c.steps;
    if (inst === 'organ') {
      chordAt(out, c, 'pad', 0, S, .4, 48);
      E(out, 'pad', 0, 36 + c.root, S / 2, .35 * c.lift);
      return;
    }
    if (inst === 'piano' || inst === 'epiano' || inst === 'guitar' ||
        inst === 'eguitar' || inst === 'pluck') {
      chordAt(out, c, 'pad', 0, S / 2, .38, 48);
      chordAt(out, c, 'pad', S / 2, S / 2, .34, 48);
      return;
    }
    chordAt(out, c, 'pad', 0, S, .42, 48);
    if (c.lift > 1) {
      for (const m of chordNotes(c, 48)) E(out, 'pad', 0, m + 12, S, .22 * c.lift);
    }
  }

  /* 旋律轨：有词唱词，没词时按乐器给一段 riff */
  function leadTrack(out, c, bar) {
    const lyr = lyricEvents(c, bar);
    if (lyr.length) { out.push(...lyr); return; }

    const inst = trackById('lead').inst;
    const pool = melodyPool(c.root, c.qid);
    const contour = MELODY_CONTOURS[(c.variation + c.barIndex) % MELODY_CONTOURS.length];
    const center = Math.min(pool.length - 2, 1 + (c.barIndex % 2) + (c.lift > 1 ? 1 : 0));
    const note = k => Math.min(88, pool[Math.max(0, Math.min(pool.length - 1, center + contour[k % contour.length]))]);

    if (inst === 'strings' || inst === 'pad' || inst === 'organ') {
      E(out, 'lead', 0, note(2), c.steps, .55 * c.lift);
      return;
    }
    if (inst === 'guitar' || inst === 'eguitar') {
      for (let s = 0, k = 0; s < c.steps; s += 2, k++) {
        E(out, 'lead', s, note(k), 1.5, .4 * c.lift);
      }
      return;
    }
    const rhythm = state.style === 'ballad'
      ? [0, 2, 6, 8, 12]
      : inst === 'epiano' ? [0, 2, 5, 8, 10, 13]
      : [0, 1, 3, 6, 8, 9, 11, 13];
    let k = 0;
    for (const s of rhythm) {
      if (s >= c.steps) continue;
      E(out, 'lead', s, note(k), 1.2, (.55 + (c.lift > 1 ? .06 : 0)) * c.lift);
      k++;
    }
  }

  /* ── 编曲上下文与事件生成 ── */
  function arrangeBar(bar, barIndex) {
    const out = [];
    const { root, qid } = parseChord(bar.chord || '0|');
    const nextBar = state.bars[(barIndex + 1) % state.bars.length] || bar;
    const nextBass = 36 + parseChord(nextBar.chord || '0|').root;
    const c = {
      root, qid,
      tones: qualityOf(qid).intervals,
      chordMidis: chordStack(root, qid, 60),
      bassMidi: 36 + root,
      nextBass,
      bpb: state.bpb,
      steps: state.bpb * 4,
      variation: state.variation % 8,
      lift: (bar.section === '副歌' || bar.section === '预副歌') ? 1.08 : 1,
      barIndex
    };
    drumGroove(out, c);
    chordTrack(out, c);
    bassTrack(out, c);
    arpTrack(out, c);
    padTrack(out, c);
    leadTrack(out, c, bar);
    return out;
  }

  function scheduleEvents(eng, evs, at, stepDur) {
    for (const e of evs) {
      if (e.track === 'drums') {
        const t = trackById('drums');
        if (!audible(t)) continue;
        eng.playDrum(e.drum, at + e.step * stepDur, { gain: e.gain * t.vol, pan: t.pan });
        continue;
      }
      const t = trackById(e.track);
      if (!audible(t)) continue;
      eng.playNote(t.inst, e.midi, at + e.step * stepDur, e.dur * stepDur, {
        gain: e.gain * t.vol, pan: t.pan
      });
    }
  }

  function scheduleBar(bar, barIndex, at) {
    scheduleEvents(engine, arrangeBar(bar, barIndex), at, (60 / state.bpm) / 4);
  }

  /* ── 播放 ── */
  function startPlay() {
    if (state.playing) { stopPlay(); return; }
    if (!state.bars.length) return;
    engineReady();
    state.playing = true;
    playIndex = 0;
    nextBarTime = engine.now() + .07;
    els.btnPlay.classList.add('is-on');
    schedTimer = setInterval(pump, 50);
    pump();
  }

  function pump() {
    if (!state.playing || !engine) return;
    const ctx = engine.ctx;
    while (nextBarTime < ctx.currentTime + .32) {
      const i = playIndex % state.bars.length;
      const t = nextBarTime;
      scheduleBar(state.bars[i], i, t);
      const delay = Math.max(0, (t - ctx.currentTime) * 1000);
      uiTimers.push(setTimeout(() => {
        highlightBar(i);
        updatePos(i);
      }, delay));
      nextBarTime += barDur();
      playIndex++;
    }
  }

  function stopPlay() {
    state.playing = false;
    clearInterval(schedTimer);
    schedTimer = null;
    uiTimers.forEach(clearTimeout);
    uiTimers = [];
    els.btnPlay.classList.remove('is-on');
    els.barGrid.querySelectorAll('.bar').forEach(el => el.classList.remove('playing'));
    updatePos(Math.min(state.sel, state.bars.length - 1));
  }

  function highlightBar(i) {
    els.barGrid.querySelectorAll('.bar').forEach((el, k) => el.classList.toggle('playing', k === i));
  }

  function updatePos(i) {
    if (!state.bars.length) {
      els.posBar.textContent = '—';
      els.posInfo.textContent = '0 小节';
      return;
    }
    if (i < 0) i = 0;
    const bar = state.bars[i] || state.bars[0];
    els.posBar.textContent = String(i + 1).padStart(2, '0');
    els.posInfo.textContent = `/ ${state.bars.length} 小节${bar.section ? ' · ' + bar.section : ''}`;
  }

  /* ── 渲染 ── */
  function renderStyles() {
    els.styles.innerHTML = STYLES.map(s =>
      `<button class="style${s.id === state.style ? ' on' : ''}" data-id="${s.id}">${s.name}<b>${s.desc}</b></button>`
    ).join('');
  }

  function renderCombos() {
    const fav = id => state.favorites.includes(id);
    const list = state.onlyFav ? COMBOS.filter(c => fav(c.id)) : COMBOS;
    els.combos.innerHTML = list.map(c => `
      <div class="combo${c.id === state.combo ? ' on' : ''}" data-id="${c.id}">
        <div class="combo-main">
          <div class="combo-name">${c.name}</div>
          <div class="combo-desc">${c.desc}</div>
        </div>
        <button class="star${fav(c.id) ? ' on' : ''}" data-star="${c.id}" title="收藏">${fav(c.id) ? '★' : '☆'}</button>
      </div>`).join('') || '<p class="hint">还没有收藏的伴奏组合</p>';
    els.btnOnlyFav.classList.toggle('on', state.onlyFav);
    const recent = state.history.slice(0, 3).map(id => (COMBOS.find(c => c.id === id) || {}).name).filter(Boolean);
    els.histInfo.textContent = recent.length ? `最近：${recent.join(' / ')}` : '暂无历史';
  }

  function renderInstruments() {
    const list = window.CigeSynth.INSTRUMENTS;
    els.instGrid.innerHTML = list.map(it =>
      `<button class="inst" data-inst="${it.id}" title="${it.group}">${it.name}</button>`
    ).join('');
  }

  function tonalOptions(selected) {
    return window.CigeSynth.INSTRUMENTS
      .filter(it => it.kind === 'tonal')
      .map(it => `<option value="${it.id}"${it.id === selected ? ' selected' : ''}>${it.name}</option>`)
      .join('');
  }

  function techniqueOf(role, inst) {
    if (role === 'drums') return '律动';
    if (role === 'bass') {
      if (inst === 'synthbass') return '八分驱动';
      if (inst === 'bass') return state.style === 'jazz' ? '走贝斯' : '根音五度';
      return '低音线条';
    }
    if (role === 'chord') {
      switch (inst) {
        case 'piano': return '低音+柱式';
        case 'epiano': return '切分Comping';
        case 'organ': return '持续音+脚键盘';
        case 'guitar': return '扫弦';
        case 'eguitar': return 'Power强切';
        case 'pluck': return '分解琶音';
        case 'strings': return '弦乐长音';
        case 'pad': return '气垫铺底';
        case 'bass': return '低音和弦';
        case 'synthbass': return '低音脉冲';
        default: return '柱式';
      }
    }
    if (role === 'arp') {
      switch (inst) {
        case 'guitar': return '指弹';
        case 'eguitar': return '16分闷切';
        case 'piano': return '阿尔贝蒂';
        case 'pluck': return '琶音';
        case 'strings':
        case 'pad': return '慢琶音';
        default: return '分解';
      }
    }
    if (role === 'pad') {
      if (inst === 'organ') return '持续音';
      if (inst === 'strings') return '弦乐长音';
      if (inst === 'pad') return '气垫铺底';
      if (inst === 'piano' || inst === 'epiano' || inst === 'guitar' || inst === 'eguitar' || inst === 'pluck') return '软和弦';
      return '长音铺底';
    }
    if (inst === 'strings' || inst === 'pad' || inst === 'organ') return '长音乐句';
    if (inst === 'guitar' || inst === 'eguitar') return '八分乐句';
    if (inst === 'piano' || inst === 'epiano') return '切分短句';
    return '旋律/Riff';
  }

  function renderTracks() {
    els.trackRows.innerHTML = state.tracks.map(t => {
      const instHtml = t.id === 'drums'
        ? '<select class="t-inst" disabled><option>鼓组</option></select>'
        : `<select class="t-inst" title="切换乐器会同时切换演奏法">${tonalOptions(t.inst)}</select>`;
      return `
      <div class="track-row${t.on ? '' : ' off'}${t.solo ? ' soloed' : ''}" data-id="${t.id}">
        <div class="t-name"><i></i><span>${t.name}</span><b class="t-tech">${techniqueOf(t.id, t.inst)}</b></div>
        ${instHtml}
        <button class="t-toggle${t.on ? ' on' : ''}">${t.on ? '开' : '关'}</button>
        <input class="vol" type="range" min="0" max="100" value="${Math.round(t.vol * 100)}">
        <span class="t-val vol-val">${Math.round(t.vol * 100)}</span>
        <input class="pan" type="range" min="-50" max="50" value="${Math.round(t.pan * 50)}">
        <span class="t-val pan-val">${Math.round(t.pan * 50)}</span>
        <button class="t-solo${t.solo ? ' on' : ''}">S</button>
        <button class="t-preview">试听</button>
      </div>`;
    }).join('');
    const enabled = state.tracks.filter(t => t.on).length;
    els.mixInfo.textContent = `${state.tracks.length} 轨 · ${enabled} 轨启用`;
  }

  function barOptions(selected) {
    let html = `<option value=""${selected === '' ? ' selected' : ''}>—</option>`;
    for (const q of QUALITIES) {
      html += `<optgroup label="${q.label}">`;
      for (let r = 0; r < 12; r++) {
        const v = `${r}|${q.id}`;
        html += `<option value="${v}"${v === selected ? ' selected' : ''}>${NOTES[r]}${q.suffix}</option>`;
      }
      html += '</optgroup>';
    }
    return html;
  }

  function renderBars() {
    els.barGrid.innerHTML = state.bars.map((bar, i) => {
      const lyric = barLyric(bar);
      return `
      <div class="bar${i === state.sel ? ' on' : ''}${lyric ? ' has-lyric' : ''}" data-i="${i}">
        <div class="bar-head">
          <span class="bar-no">${String(i + 1).padStart(2, '0')}</span>
          <input class="bar-sec" data-i="${i}" value="${escapeHtml(bar.section)}" placeholder="段落" list="sections">
        </div>
        <select class="bar-chord" data-i="${i}">${barOptions(bar.chord)}</select>
        <div class="bar-func">${funcLabel(bar.chord)}</div>
        ${lyric ? `<div class="bar-lyric" title="${escapeHtml(lyric)}">${escapeHtml(lyric)}</div>` : ''}
      </div>`;
    }).join('');
    const style = STYLES.find(s => s.id === state.style) || STYLES[0];
    const combo = COMBOS.find(c => c.id === state.combo);
    els.progInfo.textContent = `${state.bars.length} 小节 · ${meterText()} · ${style.name}${combo ? ' · ' + combo.name : ''}`;
    els.loopInfo.textContent = `循环 ${fmt(state.bars.length * barDur())}`;
    if (els.cigeInfo) els.cigeInfo.textContent = cigeLabel();
    if (els.btnSyncCige) els.btnSyncCige.classList.toggle('is-hot', !state.cige && !!readCigeProject());
    updatePos(Math.min(state.sel, state.bars.length - 1));
    save();
  }

  function renderAll() {
    renderStyles();
    renderCombos();
    renderTracks();
    renderBars();
  }

  /* ── 试听：按该乐器真实的演奏法弹一小节 ── */
  function previewBar(bar, instId, trackId) {
    if (!bar || !bar.chord) return;
    engineReady();
    const role = trackId || (instId === 'drums' ? 'drums' : 'chord');
    const evs = arrangeBar(bar, state.sel).filter(e => e.track === role);
    if (!evs.length) { toast('这一小节没有可试听的内容'); return; }
    const t0 = engine.now() + .05;
    const stepDur = (60 / state.bpm) / 4;
    for (const e of evs) {
      if (e.track === 'drums') engine.playDrum(e.drum, t0 + e.step * stepDur, { gain: e.gain });
      else engine.playNote(instId, e.midi, t0 + e.step * stepDur, e.dur * stepDur, { gain: e.gain });
    }
  }

  function applyCombo(id) {
    const combo = COMBOS.find(c => c.id === id);
    if (!combo) return;
    state.combo = id;
    state.style = combo.style;
    state.tracks.forEach(t => {
      if (combo.inst[t.id]) t.inst = combo.inst[t.id];
      if (combo.on[t.id] != null) t.on = combo.on[t.id];
      if (combo.vol[t.id] != null) t.vol = combo.vol[t.id];
      t.solo = false;
    });
    state.history = [id].concat(state.history.filter(x => x !== id)).slice(0, 4);
    renderAll();
    toast(`已应用「${combo.name}」`);
  }

  /* ── 导出：功能谱 / MIDI / JSON / 发送 ── */
  function chordSheet() {
    const style = STYLES.find(s => s.id === state.style) || STYLES[0];
    const combo = COMBOS.find(c => c.id === state.combo);
    const lines = state.bars.map((b, i) => {
      const sec = b.section ? `【${b.section}】` : '';
      const lyric = barLyric(b);
      return `${String(i + 1).padStart(3, '0')}  ${barName(b).padEnd(8, ' ')}  ${funcLabel(b.chord).padEnd(10, ' ')} ${sec}${lyric ? '  ' + lyric : ''}`;
    });
    return [
      '编曲台 · 和弦功能谱',
      `调性：${NOTES[state.key]}　BPM：${state.bpm}　拍号：${meterText()}`,
      `风格：${style.name}${combo ? '　伴奏组合：' + combo.name : ''}`,
      '',
      '小节  和弦       级数/功能    段落',
      ...lines,
      ''
    ].join('\n');
  }

  function download(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1200);
  }

  function copyText(text) {
    const done = () => toast('和弦谱已复制');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败'); }
    ta.remove();
  }

  function exportData() {
    return {
      type: 'cige:chords',
      key: state.key,
      mode: state.mode,
      bpm: state.bpm,
      bpb: state.bpb,
      chords: state.bars.map(b => barName(b)),
      sections: state.bars.map(b => ({ section: b.section }))
    };
  }

  function sendToCige() {
    const data = exportData();
    try {
      localStorage.setItem('cige.chords.incoming', JSON.stringify({ ...data, at: Date.now() }));
    } catch (e) { /* ignore */ }
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(data, '*');
      toast('已发送到词格');
    } else {
      toast('已保存，打开词格后自动导入');
    }
  }

  /* ── MIDI ── */
  const MIDI_TRACKS = [
    { id: 'drums', name: '鼓组', channel: 9, program: null },
    { id: 'bass', name: '贝斯', channel: 1, program: 33 },
    { id: 'chord', name: '和弦伴奏', channel: 2, program: 0 },
    { id: 'arp', name: '琶音', channel: 3, program: 25 },
    { id: 'pad', name: '铺底', channel: 4, program: 48 },
    { id: 'lead', name: '词格旋律', channel: 5, program: 81 }
  ];
  const DRUM_MIDI = { kick: 36, snare: 38, hat: 42, openhat: 46, clap: 39, rim: 37 };

  function vlq(n) {
    const out = [n & 0x7f];
    n >>= 7;
    while (n > 0) { out.unshift((n & 0x7f) | 0x80); n >>= 7; }
    return out;
  }
  function u32(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  function chunk(id, data) {
    return id.split('').map(c => c.charCodeAt(0)).concat(u32(data.length), data);
  }
  function utf8Bytes(s) {
    if (window.TextEncoder) return Array.from(new TextEncoder().encode(s));
    return Array.from(unescape(encodeURIComponent(s))).map(c => c.charCodeAt(0));
  }

  function buildMidi() {
    const division = 480;
    const stepTicks = 120;          // 16 分音符
    const stepsPerBar = state.bpb * 4;
    const barTicks = stepsPerBar * stepTicks;
    const tempo = Math.round(60000000 / state.bpm);
    const denPow = state.bpb === 6 ? 3 : 2;

    const notesByTrack = {};
    for (const mt of MIDI_TRACKS) notesByTrack[mt.id] = [];
    const enabled = state.tracks.filter(t => t.on);
    for (let i = 0; i < state.bars.length; i++) {
      const evs = arrangeBar(state.bars[i], i);
      for (const e of evs) {
        if (!enabled.some(t => t.id === e.track)) continue;
        const tick = Math.round(i * barTicks + e.step * stepTicks);
        if (e.track === 'drums') {
          notesByTrack.drums.push({
            tick, midi: DRUM_MIDI[e.drum] || 36,
            dur: Math.max(40, Math.round(stepTicks / 2))
          });
        } else {
          notesByTrack[e.track].push({
            tick, midi: e.midi,
            dur: Math.max(40, Math.round(e.dur * stepTicks))
          });
        }
      }
    }

    const tempoTrack = [];
    tempoTrack.push(0x00, 0xFF, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255);
    tempoTrack.push(0x00, 0xFF, 0x58, 0x04, state.bpb, denPow, 0, 0);
    tempoTrack.push(0x00, 0xFF, 0x2F, 0x00);

    const trackChunks = [chunk('MTrk', tempoTrack)];
    for (const mt of MIDI_TRACKS) {
      const notes = notesByTrack[mt.id];
      if (!notes.length) continue;
      const events = [];
      for (const n of notes) {
        events.push({ tick: n.tick, on: true, midi: n.midi });
        events.push({ tick: n.tick + n.dur, on: false, midi: n.midi });
      }
      events.sort((a, b) => a.tick - b.tick || (a.on ? 1 : 0) - (b.on ? 1 : 0));
      const data = [];
      const nb = utf8Bytes(mt.name);
      data.push(0x00, 0xFF, 0x03, nb.length, ...nb);
      if (mt.program != null) data.push(0x00, 0xC0 | mt.channel, mt.program, 0x00);
      let last = 0;
      for (const e of events) {
        data.push(...vlq(e.tick - last));
        if (e.on) data.push(0x90 | mt.channel, e.midi, 84);
        else data.push(0x80 | mt.channel, e.midi, 40);
        last = e.tick;
      }
      data.push(0x00, 0xFF, 0x2F, 0x00);
      trackChunks.push(chunk('MTrk', data));
    }

    /* 歌词元事件轨（FF 05），DAW 里可直接显示歌词 */
    const lyricRows = [];
    state.bars.forEach((bar, i) => {
      (bar.cells || []).forEach((cell, beat) => {
        const text = String(cell || '').trim();
        if (text) lyricRows.push({ tick: i * barTicks + beat * stepTicks, text });
      });
    });
    if (lyricRows.length) {
      const data = [];
      const nb = utf8Bytes('歌词');
      data.push(0x00, 0xFF, 0x03, nb.length, ...nb);
      let last = 0;
      for (const row of lyricRows) {
        const lb = utf8Bytes(row.text);
        data.push(...vlq(row.tick - last), 0xFF, 0x05, lb.length, ...lb);
        last = row.tick;
      }
      data.push(0x00, 0xFF, 0x2F, 0x00);
      trackChunks.push(chunk('MTrk', data));
    }

    const headerBytes = [
      0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06,
      0x00, 0x01, 0x00, trackChunks.length & 255, (division >> 8) & 255, division & 255
    ];
    const trackBytes = trackChunks.reduce((a, b) => a.concat(b), []);
    return new Uint8Array(headerBytes.concat(trackBytes));
  }

  function exportMidi() {
    const bytes = buildMidi();
    download(`词格_编曲_${NOTES[state.key]}.mid`, new Blob([bytes], { type: 'audio/midi' }));
    const hasLyric = state.bars.some(b => barLyric(b));
    toast(hasLyric
      ? 'MIDI 已导出（6 轨 + 歌词轨）'
      : 'MIDI 已导出（鼓/贝斯/和弦/琶音/铺底/旋律分轨）');
  }

  function downloadJson() {
    const data = {
      app: 'cige-studio', version: 1,
      key: state.key, bpm: state.bpm, bpb: state.bpb,
      style: state.style, combo: state.combo, variation: state.variation,
      tracks: state.tracks, bars: state.bars,
      chords: state.bars.map(b => barName(b))
    };
    download(`词格_编曲工程_${NOTES[state.key]}.json`, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  }

  /* ── 离线渲染 WAV（本地并轨，不经过任何服务器） ── */
  function encodeWav(buffer) {
    const ch = buffer.numberOfChannels;
    const len = buffer.length;
    const bytes = new Uint8Array(44 + len * ch * 2);
    const dv = new DataView(bytes.buffer);
    const str = (off, s) => { for (let i = 0; i < s.length; i++) bytes[off + i] = s.charCodeAt(i); };
    str(0, 'RIFF');
    dv.setUint32(4, 36 + len * ch * 2, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true);
    dv.setUint16(22, ch, true);
    dv.setUint32(24, buffer.sampleRate, true);
    dv.setUint32(28, buffer.sampleRate * ch * 2, true);
    dv.setUint16(32, ch * 2, true);
    dv.setUint16(34, 16, true);
    str(36, 'data');
    dv.setUint32(40, len * ch * 2, true);
    const chans = [];
    for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
    let off = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i]));
        dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off += 2;
      }
    }
    return bytes;
  }

  async function exportWav() {
    if (wavBusy) return;
    if (!state.bars.length) { toast('还没有小节'); return; }
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) { toast('当前浏览器不支持离线渲染'); return; }
    wavBusy = true;
    if (els.btnWav) els.btnWav.disabled = true;
    toast('正在本地并轨渲染 WAV…');
    try {
      const sr = 44100;
      const barSec = barDur();
      const total = state.bars.length * barSec + .6;
      const off = new Offline(2, Math.ceil(total * sr), sr);
      const eng = window.CigeSynth.createEngine({ ctx: off, master: .5 });
      const stepDur = (60 / state.bpm) / 4;
      for (let i = 0; i < state.bars.length; i++) {
        scheduleEvents(eng, arrangeBar(state.bars[i], i), i * barSec, stepDur);
      }
      const buf = await off.startRendering();
      const bytes = encodeWav(buf);
      download(`词格_编曲_${NOTES[state.key]}.wav`, new Blob([bytes], { type: 'audio/wav' }));
      toast(`WAV 已导出 · ${(bytes.length / 1048576).toFixed(1)} MB`);
    } catch (err) {
      toast('WAV 渲染失败：' + ((err && err.message) || err));
    } finally {
      wavBusy = false;
      if (els.btnWav) els.btnWav.disabled = false;
    }
  }

  /* ── 事件 ── */
  els.styles.addEventListener('click', e => {
    const b = e.target.closest('.style');
    if (!b) return;
    state.style = b.dataset.id;
    state.combo = 'custom';
    renderAll();
    toast(`风格切换为「${(STYLES.find(s => s.id === state.style) || {}).name}」`);
  });

  els.combos.addEventListener('click', e => {
    const star = e.target.closest('.star');
    if (star) {
      e.stopPropagation();
      const id = star.dataset.star;
      state.favorites = state.favorites.includes(id)
        ? state.favorites.filter(x => x !== id)
        : state.favorites.concat(id);
      renderCombos();
      save();
      return;
    }
    const c = e.target.closest('.combo');
    if (c) applyCombo(c.dataset.id);
  });

  els.btnOnlyFav.addEventListener('click', () => {
    state.onlyFav = !state.onlyFav;
    renderCombos();
  });

  els.instGrid.addEventListener('click', e => {
    const b = e.target.closest('.inst');
    if (!b) return;
    engineReady();
    const id = b.dataset.inst;
    if (id === 'drums') previewBar(state.bars[state.sel], 'drums');
    else engine.previewNote(id, 64, .7);
    toast(`试听 ${b.textContent}`);
  });

  els.bpmInput.addEventListener('change', () => {
    const v = Number(els.bpmInput.value);
    state.bpm = Number.isFinite(v) ? Math.min(240, Math.max(40, v)) : 120;
    els.bpmInput.value = state.bpm;
    if (state.playing) stopPlay();
    renderBars();
  });

  els.bpbSelect.addEventListener('change', () => {
    state.bpb = Number(els.bpbSelect.value);
    if (state.playing) stopPlay();
    renderBars();
  });

  els.btnVariation.addEventListener('click', () => {
    state.variation++;
    renderBars();
    if (!state.playing) previewBar(state.bars[state.sel], trackById('chord').inst);
    toast('已重新生成演奏织体');
  });

  els.trackRows.addEventListener('click', e => {
    const row = e.target.closest('.track-row');
    if (!row) return;
    const t = trackById(row.dataset.id);
    if (!t) return;
    if (e.target.closest('.t-toggle')) {
      t.on = !t.on;
      renderTracks();
      save();
    } else if (e.target.closest('.t-solo')) {
      t.solo = !t.solo;
      renderTracks();
      save();
    } else if (e.target.closest('.t-preview')) {
      previewBar(state.bars[state.sel], t.inst, t.id);
    }
  });

  els.trackRows.addEventListener('change', e => {
    const row = e.target.closest('.track-row');
    if (!row) return;
    const t = trackById(row.dataset.id);
    if (!t) return;
    if (e.target.classList.contains('t-inst')) {
      t.inst = e.target.value;
      save();
      renderTracks();
      previewBar(state.bars[state.sel], t.inst, t.id);
    }
  });

  els.trackRows.addEventListener('input', e => {
    const row = e.target.closest('.track-row');
    if (!row) return;
    const t = trackById(row.dataset.id);
    if (!t) return;
    if (e.target.classList.contains('vol')) {
      t.vol = Number(e.target.value) / 100;
      row.querySelector('.vol-val').textContent = e.target.value;
      save();
    } else if (e.target.classList.contains('pan')) {
      t.pan = Number(e.target.value) / 50;
      row.querySelector('.pan-val').textContent = e.target.value;
      save();
    }
  });

  els.barGrid.addEventListener('click', e => {
    const bar = e.target.closest('.bar');
    if (!bar || e.target.closest('select,input')) return;
    state.sel = Number(bar.dataset.i);
    els.barGrid.querySelectorAll('.bar').forEach((el, k) => el.classList.toggle('on', k === state.sel));
    updatePos(state.sel);
    previewBar(state.bars[state.sel], trackById('chord').inst);
  });

  els.barGrid.addEventListener('change', e => {
    const i = Number(e.target.dataset.i);
    if (!Number.isFinite(i) || !state.bars[i]) return;
    if (e.target.classList.contains('bar-chord')) {
      state.bars[i].chord = e.target.value;
      const barEl = e.target.closest('.bar');
      barEl.querySelector('.bar-func').textContent = funcLabel(e.target.value);
      save();
      if (!state.playing) previewBar(state.bars[i], trackById('chord').inst);
    } else if (e.target.classList.contains('bar-sec')) {
      state.bars[i].section = e.target.value.trim().slice(0, 6);
      save();
    }
  });

  els.btnAddBar.addEventListener('click', () => {
    const last = state.bars[state.bars.length - 1];
    state.bars.push({ chord: last ? last.chord : '0|', section: '' });
    state.sel = state.bars.length - 1;
    renderBars();
  });

  els.btnDelBar.addEventListener('click', () => {
    if (state.bars.length <= 1) return;
    state.bars.pop();
    state.sel = Math.min(state.sel, state.bars.length - 1);
    renderBars();
  });

  els.btnClearBars.addEventListener('click', () => {
    state.bars = [{ chord: '', section: '' }];
    state.sel = 0;
    renderBars();
  });

  els.btnPlay.addEventListener('click', startPlay);
  els.btnSheet.addEventListener('click', () => copyText(chordSheet()));
  els.btnMidi.addEventListener('click', exportMidi);
  els.btnJson.addEventListener('click', downloadJson);
  els.btnSend.addEventListener('click', sendToCige);
  if (els.btnSyncCige) els.btnSyncCige.addEventListener('click', () => syncFromCige(false));
  if (els.btnWav) els.btnWav.addEventListener('click', exportWav);

  document.addEventListener('keydown', e => {
    if (e.target.matches('select,input,textarea')) return;
    if (e.key === ' ') { e.preventDefault(); startPlay(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const d = e.key === 'ArrowRight' ? 1 : -1;
      state.sel = Math.min(state.bars.length - 1, Math.max(0, state.sel + d));
      els.barGrid.querySelectorAll('.bar').forEach((el, k) => el.classList.toggle('on', k === state.sel));
      updatePos(state.sel);
      e.preventDefault();
    }
  });

  window.addEventListener('beforeunload', () => {
    if (state.playing) stopPlay();
  });

  /* ── 初始化 ── */
  restore();
  els.bpmInput.value = state.bpm;
  els.bpbSelect.value = String(state.bpb);
  renderInstruments();
  renderAll();
})();
