/* 和弦台 · 词格和弦工作台 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const QUALITIES = [
    { id: '', label: '大三', suffix: '', intervals: [0, 4, 7] },
    { id: 'm', label: '小三', suffix: 'm', intervals: [0, 3, 7] },
    { id: '7', label: '属七', suffix: '7', intervals: [0, 4, 7, 10] },
    { id: 'm7', label: '小七', suffix: 'm7', intervals: [0, 3, 7, 10] },
    { id: 'maj7', label: '大七', suffix: 'maj7', intervals: [0, 4, 7, 11] },
    { id: '6', label: '六', suffix: '6', intervals: [0, 4, 7, 9] },
    { id: 'm6', label: '小六', suffix: 'm6', intervals: [0, 3, 7, 9] },
    { id: 'sus2', label: '挂二', suffix: 'sus2', intervals: [0, 2, 7] },
    { id: 'sus4', label: '挂四', suffix: 'sus4', intervals: [0, 5, 7] },
    { id: 'dim', label: '减三', suffix: 'dim', intervals: [0, 3, 6] },
    { id: 'aug', label: '增三', suffix: 'aug', intervals: [0, 4, 8] },
    { id: 'add9', label: '加九', suffix: 'add9', intervals: [0, 4, 7, 14] }
  ];
  const NUMERALS = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
  const FUNCTIONS = { 0: '主', 4: '主', 9: '主', 5: '下属', 2: '下属', 7: '属', 11: '属' };
  const SECTIONS = ['', '主歌', '预副歌', '副歌', '桥段', '尾声'];
  const LS_KEY = 'cige.harmony.v1';

  const PRESETS = [
    { name: 'I–V–vi–III', desc: '卡农感，最常见', chords: [[0, ''], [7, ''], [9, 'm'], [4, '']] },
    { name: 'vi–IV–I–V', desc: '流行 6415', chords: [[9, 'm'], [5, ''], [0, ''], [7, '']] },
    { name: 'I–vi–IV–V', desc: '经典 1645', chords: [[0, ''], [9, 'm'], [5, ''], [7, '']] },
    { name: 'IV–V–iii–vi', desc: '4536 循环', chords: [[5, ''], [7, ''], [4, 'm'], [9, 'm']] },
    { name: 'ii–V–I–vi', desc: 'ii-V-I 爵士基础', chords: [[2, 'm7'], [7, '7'], [0, 'maj7'], [9, 'm7']] },
    { name: 'I7–IV7–V7', desc: '12 小节 Blues', chords: [
      [0, '7'], [0, '7'], [0, '7'], [0, '7'], [5, '7'], [5, '7'], [0, '7'], [0, '7'],
      [7, '7'], [5, '7'], [0, '7'], [7, '7']
    ] },
    { name: 'i–VI–III–VII', desc: '小调循环', chords: [[0, 'm'], [8, ''], [4, ''], [10, '']] }
  ];

  const state = {
    key: 0,
    mode: 'major',
    bpm: 120,
    bpb: 4,
    bars: [
      { chord: '0|', section: '主歌' },
      { chord: '7|', section: '' },
      { chord: '9|m', section: '' },
      { chord: '5|', section: '' }
    ],
    sel: 0,
    playing: false,
    idx: 0,
    timer: null,
    ctx: null,
    master: null
  };

  const els = {
    keySelect: $('#keySelect'), modeSelect: $('#modeSelect'),
    bpmInput: $('#bpmInput'), bpbSelect: $('#bpbSelect'),
    presets: $('#presets'), libTabs: $('#libTabs'), libGrid: $('#libGrid'),
    barGrid: $('#barGrid'), progInfo: $('#progInfo'), timeInfo: $('#timeInfo'),
    btnAddBar: $('#btnAddBar'), btnDelBar: $('#btnDelBar'), btnClear: $('#btnClear'),
    btnPlay: $('#btnPlay'), btnSend: $('#btnSend'), btnCopy: $('#btnCopy'), btnJson: $('#btnJson'),
    toast: $('#toast'), libTarget: $('#libTarget')
  };

  /* ── 基础工具 ── */
  const qualityOf = id => QUALITIES.find(q => q.id === id) || QUALITIES[0];
  const chordName = (root, qid) => NOTES[root] + qualityOf(qid).suffix;
  const parseChord = c => {
    const i = c.indexOf('|');
    return { root: Number(c.slice(0, i)) || 0, qid: c.slice(i + 1) };
  };
  const barDur = () => (60 / state.bpm) * state.bpb;
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  const fmt = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        key: state.key, mode: state.mode, bpm: state.bpm, bpb: state.bpb, bars: state.bars
      }));
    } catch (e) { /* ignore */ }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.key === 'number') state.key = p.key % 12;
      if (p.mode === 'minor' || p.mode === 'major') state.mode = p.mode;
      if (typeof p.bpm === 'number') state.bpm = Math.min(240, Math.max(40, p.bpm));
      if ([2, 3, 4, 6, 8].includes(p.bpb)) state.bpb = p.bpb;
      if (Array.isArray(p.bars) && p.bars.length) {
        state.bars = p.bars.map(b => ({
          chord: typeof b.chord === 'string' ? b.chord : '0|',
          section: SECTIONS.includes(b.section) ? b.section : ''
        }));
      }
    } catch (e) { /* ignore */ }
  }

  /* ── 渲染 ── */
  function chordOptions(selected) {
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

  function funcLabel(chord) {
    if (!chord) return '—';
    const { root, qid } = parseChord(chord);
    const deg = (root - state.key + 12) % 12;
    const num = NUMERALS[deg];
    const f = FUNCTIONS[deg] || (state.mode === 'minor' ? '变' : '变');
    return `${num}${qualityOf(qid).suffix} · ${f}`;
  }

  function renderBars() {
    els.barGrid.innerHTML = state.bars.map((bar, i) => `
      <div class="bar${i === state.sel ? ' on' : ''}" data-i="${i}">
        <div class="bar-head">
          <span class="bar-no">${String(i + 1).padStart(2, '0')}</span>
          <input class="bar-sec" data-i="${i}" value="${bar.section}" placeholder="段落" list="sections">
        </div>
        <select class="bar-chord" data-i="${i}">${chordOptions(bar.chord)}</select>
        <div class="bar-func">${funcLabel(bar.chord)}</div>
      </div>`).join('');

    const total = state.bars.length * barDur();
    els.progInfo.textContent = `${state.bars.length} 小节 · ${state.bpb}/4 · ${NOTES[state.key]} ${state.mode === 'minor' ? '小调' : '大调'}`;
    els.timeInfo.textContent = `循环时长 ${fmt(total)}`;
    els.libTarget.textContent = `将填入第 ${state.sel + 1} 小节`;
    save();
  }

  function renderKey() {
    els.keySelect.innerHTML = NOTES.map((n, i) => `<option value="${i}"${i === state.key ? ' selected' : ''}>${n}</option>`).join('');
    els.modeSelect.value = state.mode;
    els.bpmInput.value = state.bpm;
    els.bpbSelect.value = state.bpb;
  }

  let libQuality = '';

  function renderLib() {
    els.libTabs.innerHTML = QUALITIES.map(q =>
      `<button data-q="${q.id}" class="${q.id === libQuality ? 'on' : ''}">${q.label}</button>`
    ).join('');
    els.libGrid.innerHTML = NOTES.map((n, r) =>
      `<button data-root="${r}">${n}${qualityOf(libQuality).suffix}</button>`
    ).join('');
  }

  function renderPresets() {
    els.presets.innerHTML = PRESETS.map((p, i) =>
      `<button class="preset" data-p="${i}">${p.name}<b>${p.desc}</b></button>`
    ).join('');
  }

  /* ── 音频 ── */
  function ensureCtx() {
    if (!state.ctx) {
      state.ctx = new (window.AudioContext || window.webkitAudioContext)();
      state.master = state.ctx.createGain();
      state.master.gain.value = 0.16;
      state.master.connect(state.ctx.destination);
    }
    if (state.ctx.state === 'suspended') state.ctx.resume().catch(() => {});
    return state.ctx;
  }

  function playChord(root, qid, at, dur) {
    const ctx = ensureCtx();
    const tones = qualityOf(qid).intervals;
    const base = 57 + root;
    for (const iv of tones) {
      const f = midiHz(base + iv);
      for (const type of ['sine', 'triangle']) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = f;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(type === 'sine' ? 0.55 : 0.22, at + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, at + dur);
        osc.connect(g).connect(state.master);
        osc.start(at);
        osc.stop(at + dur + 0.02);
      }
    }
    // 低音
    const bass = ctx.createOscillator();
    const bg = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.value = midiHz(45 + root);
    bg.gain.setValueAtTime(0, at);
    bg.gain.linearRampToValueAtTime(0.5, at + 0.05);
    bg.gain.exponentialRampToValueAtTime(0.001, at + dur);
    bass.connect(bg).connect(state.master);
    bass.start(at);
    bass.stop(at + dur + 0.02);
  }

  function click(at) {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1046;
    g.gain.setValueAtTime(0.12, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.035);
    osc.connect(g).connect(state.master);
    osc.start(at);
    osc.stop(at + 0.05);
  }

  function previewChord(chord) {
    if (!chord) return;
    ensureCtx();
    const { root, qid } = parseChord(chord);
    playChord(root, qid, state.ctx.currentTime + 0.02, 0.7);
  }

  function highlight(i) {
    els.barGrid.querySelectorAll('.bar').forEach((el, k) => el.classList.toggle('playing', k === i));
  }

  function startPlay() {
    if (state.playing) { stopPlay(); return; }
    if (!state.bars.length) return;
    ensureCtx();
    state.playing = true;
    state.idx = 0;
    els.btnPlay.textContent = '■ 停止';
    const dur = barDur();
    const step = () => {
      if (!state.playing) return;
      const i = state.idx % state.bars.length;
      const bar = state.bars[i];
      highlight(i);
      const at = state.ctx.currentTime + 0.03;
      if (bar.chord) {
        const { root, qid } = parseChord(bar.chord);
        playChord(root, qid, at, dur - 0.02);
      }
      for (let b = 0; b < state.bpb; b++) click(at + b * (60 / state.bpm));
      state.idx++;
      state.timer = setTimeout(step, dur * 1000);
    };
    step();
  }

  function stopPlay() {
    state.playing = false;
    clearTimeout(state.timer);
    state.timer = null;
    els.btnPlay.textContent = '▶ 播放';
    els.barGrid.querySelectorAll('.bar').forEach(el => el.classList.remove('playing'));
  }

  /* ── 发送 / 导出 ── */
  function exportData() {
    return {
      type: 'cige:chords',
      key: state.key,
      mode: state.mode,
      bpm: state.bpm,
      bpb: state.bpb,
      chords: state.bars.map(b => (b.chord ? chordName(parseChord(b.chord).root, parseChord(b.chord).qid) : '')),
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

  function chordSheet() {
    const lines = state.bars.map((b, i) => {
      const sec = b.section ? `【${b.section}】` : '';
      const name = b.chord ? chordName(parseChord(b.chord).root, parseChord(b.chord).qid).padEnd(7, ' ') : '—';
      return `${String(i + 1).padStart(3, '0')}  ${name}  ${sec}`;
    });
    return `和弦台 · 和弦进行\n调性：${NOTES[state.key]} ${state.mode === 'minor' ? '小调' : '大调'}　BPM：${state.bpm}　拍号：${state.bpb}/4\n\n${lines.join('\n')}\n`;
  }

  function copyText() {
    const text = chordSheet();
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

  function downloadJson() {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `词格_和弦进行_${NOTES[state.key]}${state.mode === 'minor' ? 'm' : ''}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ── 事件 ── */
  els.keySelect.addEventListener('change', () => {
    state.key = Number(els.keySelect.value);
    renderBars();
  });
  els.modeSelect.addEventListener('change', () => {
    state.mode = els.modeSelect.value;
    renderBars();
  });
  els.bpmInput.addEventListener('change', () => {
    const v = Number(els.bpmInput.value);
    state.bpm = Number.isFinite(v) ? Math.min(240, Math.max(40, v)) : 120;
    els.bpmInput.value = state.bpm;
    renderBars();
  });
  els.bpbSelect.addEventListener('change', () => {
    state.bpb = Number(els.bpbSelect.value);
    renderBars();
  });

  els.barGrid.addEventListener('click', e => {
    const bar = e.target.closest('.bar');
    if (!bar || e.target.closest('select,input')) return;
    state.sel = Number(bar.dataset.i);
    els.barGrid.querySelectorAll('.bar').forEach((el, k) => el.classList.toggle('on', k === state.sel));
    els.libTarget.textContent = `将填入第 ${state.sel + 1} 小节`;
  });

  els.barGrid.addEventListener('change', e => {
    const i = Number(e.target.dataset.i);
    if (!Number.isFinite(i) || !state.bars[i]) return;
    if (e.target.classList.contains('bar-chord')) {
      state.bars[i].chord = e.target.value;
      e.target.closest('.bar').querySelector('.bar-func').textContent = funcLabel(e.target.value);
      if (!state.playing) previewChord(e.target.value);
      save();
    } else if (e.target.classList.contains('bar-sec')) {
      state.bars[i].section = e.target.value.trim().slice(0, 6);
      save();
    }
  });

  els.libTabs.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    libQuality = b.dataset.q;
    renderLib();
  });

  els.libGrid.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (!state.bars[state.sel]) return;
    const root = Number(b.dataset.root);
    state.bars[state.sel].chord = `${root}|${libQuality}`;
    renderBars();
    state.sel = Math.min(state.sel, state.bars.length - 1);
    previewChord(state.bars[state.sel].chord);
  });

  els.presets.addEventListener('click', e => {
    const b = e.target.closest('.preset');
    if (!b) return;
    const preset = PRESETS[Number(b.dataset.p)];
    state.bars = preset.chords.map(([root, q], i) => ({
      chord: `${root}|${q}`,
      section: i === 0 ? '主歌' : ''
    }));
    state.sel = 0;
    renderBars();
    toast(`已套用「${preset.name}」`);
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

  els.btnClear.addEventListener('click', () => {
    state.bars = [{ chord: '', section: '' }];
    state.sel = 0;
    renderBars();
  });

  els.btnPlay.addEventListener('click', startPlay);
  els.btnSend.addEventListener('click', sendToCige);
  els.btnCopy.addEventListener('click', copyText);
  els.btnJson.addEventListener('click', downloadJson);

  document.addEventListener('keydown', e => {
    if (e.target.matches('select,input')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      state.sel = Math.min(state.bars.length - 1, Math.max(0, state.sel + dir));
      els.barGrid.querySelectorAll('.bar').forEach((el, k) => el.classList.toggle('on', k === state.sel));
      els.libTarget.textContent = `将填入第 ${state.sel + 1} 小节`;
      e.preventDefault();
    } else if (e.key === ' ') {
      e.preventDefault();
      startPlay();
    }
  });

  /* ── 初始化 ── */
  restore();
  renderKey();
  renderPresets();
  renderLib();
  renderBars();
})();
