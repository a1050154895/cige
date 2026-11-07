/* 学习中心 · 和弦字典 / 听辨练习 / 实用乐理 */
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
    { id: 'm7b5', label: '半减', suffix: 'm7b5', intervals: [0, 3, 6, 10] },
    { id: 'dim7', label: '减七', suffix: 'dim7', intervals: [0, 3, 6, 9] }
  ];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const NUMERALS = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
  const FUNCS = ['主', '下属', '主', '下属', '属', '主', '属'];

  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10]
  };

  const DESCS = {
    '': '大三和弦：根音 + 大三度 + 纯五度，稳定明亮，是绝大多数进行的主和弦。',
    'm': '小三和弦：根音 + 小三度 + 纯五度，柔和内敛，常见于 ii、vi、iv 级。',
    '7': '属七和弦：大三和弦加小七度，紧张感强，常出现在 V 级推动解决。',
    'maj7': '大七和弦：大三和弦加大七度，色彩通透，常用于 I、IV 级。',
    'm7': '小七和弦：小三和弦加小七度，爵士与流行 ii–V–I 的基础。',
    '6': '六和弦：大三和弦加大六度，轻盈通透，常用于结尾或过渡。',
    'm6': '小六和弦：小三和弦加大六度，色彩柔和，常见于爵士。',
    'sus2': '挂二和弦：用二度替代三度，悬而未决，适合作为织体变化。',
    'sus4': '挂四和弦：用四度替代三度，制造张力后再解决到三度。',
    'dim': '减三和弦：两个小三度，紧张不稳定，常作过渡或经过和弦。',
    'aug': '增三和弦：含增五度，色彩不稳定，常用于色彩化处理。',
    'add9': '加九和弦：大三和弦再叠九度，流行旋律里非常常见。',
    'm7b5': '半减七和弦：小七度 + 减五度，常作为小调 ii° 使用。',
    'dim7': '减七和弦：三个小三度，张力极强，多用于过渡。'
  };

  const PROGS = {
    major: [
      { name: 'I–V–vi–III', tag: '卡农感 · 最常用', degrees: [0, 4, 5, 2] },
      { name: 'vi–IV–I–V', tag: '流行 6415', degrees: [5, 3, 0, 4] },
      { name: 'I–vi–IV–V', tag: '经典 1645', degrees: [0, 5, 3, 4] },
      { name: 'IV–V–iii–vi', tag: '4536 循环', degrees: [3, 4, 2, 5] },
      { name: 'ii–V–I', tag: '爵士终止', degrees: [1, 4, 0] }
    ],
    minor: [
      { name: 'i–VI–III–VII', tag: '小调循环', degrees: [0, 5, 2, 6] },
      { name: 'i–iv–V–i', tag: '小调正格', degrees: [0, 3, 4, 0] },
      { name: 'i–VII–VI–V', tag: '下行推进', degrees: [0, 6, 5, 4] },
      { name: 'iv–V–i', tag: '小调终止', degrees: [3, 4, 0] }
    ]
  };

  const INTERVALS = [
    [0, '同音'], [1, '小二度'], [2, '大二度'], [3, '小三度'], [4, '大三度'],
    [5, '纯四度'], [6, '减五度'], [7, '纯五度'], [8, '小六度'], [9, '大六度'],
    [10, '小七度'], [11, '大七度'], [12, '纯八度']
  ];

  const state = {
    view: 'dict',
    key: 0, mode: 'major', seventh: false,
    selected: { kind: 'degree', deg: 0 },
    libQuality: '',
    earLevel: 'plus',
    ear: null,
    stats: { score: 0, attempts: 0, correct: 0, streak: 0, best: 0 }
  };

  let engine = null;
  const qualityOf = id => QUALITIES.find(q => q.id === id) || QUALITIES[0];

  function ensureEngine() {
    if (!engine) engine = window.CigeSynth.createEngine({ master: .34 });
    engine.resume();
    return engine;
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function chordName(root, qid) {
    return NOTES[root] + qualityOf(qid).suffix;
  }

  function qualityFrom(iv) {
    const key = iv.slice(0, 4).join(',');
    const map = {
      '0,4,7': '', '0,3,7': 'm', '0,3,6': 'dim', '0,4,8': 'aug',
      '0,4,7,11': 'maj7', '0,4,7,10': '7', '0,3,7,10': 'm7',
      '0,3,6,10': 'm7b5', '0,3,6,9': 'dim7'
    };
    return map[key] || '';
  }

  function degreeInfo(deg, seventh) {
    const scale = SCALES[state.mode];
    const rootOff = scale[deg];
    const thirdOff = scale[(deg + 2) % 7] + (deg + 2 >= 7 ? 12 : 0);
    const fifthOff = scale[(deg + 4) % 7] + (deg + 4 >= 7 ? 12 : 0);
    const sevOff = scale[(deg + 6) % 7] + (deg + 6 >= 7 ? 12 : 0);
    const iv = seventh ? [0, thirdOff - rootOff, fifthOff - rootOff, sevOff - rootOff] : [0, thirdOff - rootOff, fifthOff - rootOff];
    const root = (state.key + rootOff) % 12;
    return {
      root,
      iv,
      qid: qualityFrom(iv),
      deg,
      degreeLabel: `${ROMAN[deg]}${qualityOf(qualityFrom(iv)).suffix}`,
      func: FUNCS[deg]
    };
  }

  function infoForSelected() {
    if (state.selected.kind === 'degree') return degreeInfo(state.selected.deg, state.seventh);
    const root = state.selected.root;
    const qid = state.selected.qid;
    const deg = (root - state.key + 12) % 12;
    return {
      root, qid, iv: qualityOf(qid).intervals.slice(), deg,
      degreeLabel: `${NUMERALS[deg]}${qualityOf(qid).suffix}`,
      func: FUNCS[deg] || '变'
    };
  }

  function noteName(root, iv) {
    return NOTES[((root + iv) % 12 + 12) % 12];
  }

  function toneLabel(iv, idx) {
    if (idx === 0) return '根';
    if (iv > 12) return '九';
    return ['', '三', '五', '七'][idx] || '音';
  }

  /* ── DOM ── */
  const els = {
    tabs: $('#tabs'),
    viewDict: $('#view-dict'), viewEar: $('#view-ear'), viewTheory: $('#view-theory'),
    keySelect: $('#keySelect'), modeSelect: $('#modeSelect'), seventhSeg: $('#seventhSeg'),
    degreeGrid: $('#degreeGrid'), qualTabs: $('#qualTabs'), rootGrid: $('#rootGrid'),
    dName: $('#dName'), dSub: $('#dSub'), noteChips: $('#noteChips'),
    mNotes: $('#mNotes'), mIntervals: $('#mIntervals'), mDegree: $('#mDegree'), mFunc: $('#mFunc'),
    dTip: $('#dTip'), dHint: $('#dHint'), btnPlayChord: $('#btnPlayChord'), btnSendChord: $('#btnSendChord'),
    progList: $('#progList'),
    earLevel: $('#earLevel'), earLevelLabel: $('#earLevelLabel'), earOptions: $('#earOptions'),
    earFeedback: $('#earFeedback'), earHint: $('#earHint'), revealInfo: $('#revealInfo'),
    btnHear: $('#btnHear'), btnNewQ: $('#btnNewQ'), btnNext: $('#btnNext'),
    statScore: $('#statScore'), statAcc: $('#statAcc'), statStreak: $('#statStreak'), statBest: $('#statBest'),
    intervalTable: $('#intervalTable'), theoryTable: $('#theoryTable'), tableKey: $('#tableKey'),
    theoryProgressions: $('#theoryProgressions'), toast: $('#toast')
  };

  /* ── 和弦字典渲染 ── */
  function renderKey() {
    els.keySelect.innerHTML = NOTES.map((n, i) =>
      `<option value="${i}"${i === state.key ? ' selected' : ''}>${n}</option>`
    ).join('');
    els.modeSelect.value = state.mode;
    els.seventhSeg.querySelectorAll('button').forEach(b =>
      b.classList.toggle('on', (b.dataset.seventh === '1') === state.seventh)
    );
  }

  function renderDegrees() {
    els.degreeGrid.innerHTML = [0, 1, 2, 3, 4, 5, 6].map(deg => {
      const info = degreeInfo(deg, state.seventh);
      const on = state.selected.kind === 'degree' && state.selected.deg === deg;
      return `<button class="${on ? 'on' : ''}" data-deg="${deg}">
        <span>${info.degreeLabel}</span><i>${chordName(info.root, info.qid)}</i>
      </button>`;
    }).join('');
  }

  function renderLibrary() {
    els.qualTabs.innerHTML = QUALITIES.map(q =>
      `<button data-q="${q.id}" class="${q.id === state.libQuality ? 'on' : ''}">${q.label}</button>`
    ).join('');
    els.rootGrid.innerHTML = NOTES.map((n, r) =>
      `<button data-root="${r}">${n}${qualityOf(state.libQuality).suffix}</button>`
    ).join('');
  }

  function renderDetail() {
    const info = infoForSelected();
    const q = qualityOf(info.qid);
    const degreeText = info.degreeLabel;
    els.dName.textContent = chordName(info.root, info.qid);
    els.dSub.textContent = `${q.label}和弦 · ${degreeText} · ${info.func}功能`;
    els.noteChips.innerHTML = info.iv.map((iv, idx) =>
      `<div class="note-chip${idx === 0 ? ' root' : ''}">
        <b>${noteName(info.root, iv)}</b><span>${toneLabel(iv, idx)}音</span>
      </div>`
    ).join('');
    els.mNotes.textContent = info.iv.map(iv => noteName(info.root, iv)).join(' · ');
    els.mIntervals.textContent = info.iv.join(' · ');
    els.mDegree.textContent = degreeText;
    els.mFunc.textContent = `${info.func}功能`;
    els.dTip.textContent = DESCS[info.qid] || '';
    els.btnPlayChord.textContent = `▶ 试听 ${chordName(info.root, info.qid)}`;
    return info;
  }

  function renderProgressions(target, compact) {
    const list = PROGS[state.mode];
    const cards = list.map((p, i) => {
      const names = p.degrees.map(d => {
        const info = degreeInfo(d, false);
        return chordName(info.root, info.qid);
      }).join(' – ');
      return `<div class="prog-card" data-prog="${i}">
        ${compact ? `<p>${p.name}</p><em>${names}</em>` : `<b>${p.name}</b><span>${p.tag} · ${names}</span>`}
      </div>`;
    }).join('');
    if (target === 'list') els.progList.innerHTML = cards;
    else if (target === 'theory') els.theoryProgressions.innerHTML = cards;
  }

  function renderTheoryTable() {
    els.tableKey.textContent = `${NOTES[state.key]} ${state.mode === 'minor' ? '小调' : '大调'}`;
    els.theoryTable.innerHTML = [0, 1, 2, 3, 4, 5, 6].map(deg => {
      const info = degreeInfo(deg, false);
      const desc = DESCS[info.qid] || '';
      return `<tr class="clickable" data-deg="${deg}">
        <td><b>${ROMAN[deg]}</b></td>
        <td>${chordName(info.root, info.qid)}</td>
        <td>${FUNCS[deg]}</td>
        <td>${desc.replace(/^[^：]+：/, '').slice(0, 22)}</td>
      </tr>`;
    }).join('');
  }

  function renderStats() {
    const s = state.stats;
    els.statScore.textContent = s.score;
    els.statAcc.textContent = s.attempts ? Math.round((s.correct / s.attempts) * 100) + '%' : '—';
    els.statStreak.textContent = s.streak;
    els.statBest.textContent = s.best;
  }

  function renderAllDict() {
    renderKey();
    renderDegrees();
    renderLibrary();
    renderDetail();
    renderProgressions('list', false);
    renderTheoryTable();
  }

  /* ── 试听 ── */
  function playInfo(info) {
    ensureEngine();
    engine.previewChord('piano', 60 + info.root, info.iv, 1.25, { gain: .95 });
  }

  function playProgression(index) {
    ensureEngine();
    const p = PROGS[state.mode][index];
    if (!p) return;
    const base = engine.now() + .05;
    p.degrees.forEach((deg, i) => {
      const info = degreeInfo(deg, false);
      engine.playChord('piano', 60 + info.root, info.iv, base + i * .75, .72, { gain: .8 });
    });
    toast(`试听 ${p.name}`);
  }

  /* ── 听辨练习 ── */
  const EAR_POOL = {
    basic: ['', 'm'],
    plus: ['', 'm', '7', 'maj7', 'm7'],
    hard: ['', 'm', '7', 'maj7', 'm7', 'dim', 'sus4', 'm7b5', '6', 'm6']
  };

  function earLabel(level) {
    return { basic: '入门', plus: '进阶', hard: '挑战' }[level] || '进阶';
  }

  function newQuestion() {
    const pool = EAR_POOL[state.earLevel] || EAR_POOL.plus;
    const correct = {
      root: Math.floor(Math.random() * 12),
      qid: pool[Math.floor(Math.random() * pool.length)]
    };
    const seen = {};
    const options = [];
    const k = (r, q) => `${r}|${q}`;
    seen[k(correct.root, correct.qid)] = true;
    options.push(correct);
    let guard = 0;
    while (options.length < 4 && guard++ < 80) {
      const cand = {
        root: Math.floor(Math.random() * 12),
        qid: pool[Math.floor(Math.random() * pool.length)]
      };
      if (seen[k(cand.root, cand.qid)]) continue;
      seen[k(cand.root, cand.qid)] = true;
      options.push(cand);
    }
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    state.ear = { correct, options, answered: false };
    renderEarOptions();
    els.earFeedback.textContent = '';
    els.earFeedback.className = 'feedback';
    els.revealInfo.textContent = '';
    els.btnNext.hidden = true;
    els.earOptions.querySelectorAll('.option').forEach(b => b.classList.remove('disabled', 'right', 'wrong'));
    els.earHint.textContent = '点击「播放题目」听和弦';
    els.earLevelLabel.textContent = earLabel(state.earLevel);
  }

  function renderEarOptions() {
    if (!state.ear) return;
    els.earOptions.innerHTML = state.ear.options.map((o, i) => {
      const q = qualityOf(o.qid);
      return `<button class="option" data-i="${i}">
        <b>${chordName(o.root, o.qid)}</b>
        <span>${q.label}和弦</span>
      </button>`;
    }).join('');
  }

  function playEar() {
    if (!state.ear) return;
    ensureEngine();
    const c = state.ear.correct;
    engine.previewChord('piano', 60 + c.root, qualityOf(c.qid).intervals, 1.35, { gain: .95 });
    els.earHint.textContent = '听清楚了吗？选择你的答案';
  }

  function answerEar(index) {
    const ear = state.ear;
    if (!ear || ear.answered) return;
    ear.answered = true;
    const picked = ear.options[index];
    const correct = ear.correct;
    const isRight = picked.root === correct.root && picked.qid === correct.qid;
    const buttons = els.earOptions.querySelectorAll('.option');
    buttons.forEach((b, i) => {
      const o = ear.options[i];
      b.classList.add('disabled');
      if (o.root === correct.root && o.qid === correct.qid) b.classList.add('right');
      else if (i === index) b.classList.add('wrong');
    });

    const s = state.stats;
    s.attempts++;
    if (isRight) {
      s.correct++;
      s.streak++;
      s.best = Math.max(s.best, s.streak);
      s.score += 10 + s.streak * 2;
      els.earFeedback.textContent = `正确！+${10 + s.streak * 2} 分，当前连对 ${s.streak}`;
      els.earFeedback.className = 'feedback ok';
    } else {
      s.streak = 0;
      els.earFeedback.textContent = `答案是 ${chordName(correct.root, correct.qid)}，你选的是 ${chordName(picked.root, picked.qid)}`;
      els.earFeedback.className = 'feedback bad';
    }
    const cq = qualityOf(correct.qid);
    els.revealInfo.textContent = `答案：${chordName(correct.root, correct.qid)}（${cq.intervals.map(iv => noteName(correct.root, iv)).join(' · ')}）`;
    els.btnNext.hidden = false;
    els.earHint.textContent = '看构成音，再听一遍会更容易记住';
    renderStats();
    saveStats();
    // 答完后自动再播一次答案
    setTimeout(playEar, 260);
  }

  function saveStats() {
    try { localStorage.setItem('cige.learn.stats', JSON.stringify(state.stats)); } catch (e) { /* ignore */ }
  }

  function loadStats() {
    try {
      const p = JSON.parse(localStorage.getItem('cige.learn.stats') || '{}');
      state.stats = {
        score: Number(p.score) || 0,
        attempts: Number(p.attempts) || 0,
        correct: Number(p.correct) || 0,
        streak: 0,
        best: Number(p.best) || 0
      };
    } catch (e) { /* ignore */ }
  }

  /* ── 标签页 ── */
  function switchView(view) {
    state.view = view;
    els.tabs.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.view === view));
    els.viewDict.hidden = view !== 'dict';
    els.viewEar.hidden = view !== 'ear';
    els.viewTheory.hidden = view !== 'theory';
    if (view === 'ear' && !state.ear) newQuestion();
  }

  /* ── 事件 ── */
  els.tabs.addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (b) switchView(b.dataset.view);
  });

  els.keySelect.addEventListener('change', () => {
    state.key = Number(els.keySelect.value);
    renderDegrees();
    renderDetail();
    renderProgressions('list', false);
    renderTheoryTable();
  });

  els.modeSelect.addEventListener('change', () => {
    state.mode = els.modeSelect.value;
    renderDegrees();
    renderDetail();
    renderProgressions('list', false);
    renderTheoryTable();
  });

  els.seventhSeg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.seventh = b.dataset.seventh === '1';
    renderKey();
    renderDegrees();
    renderDetail();
  });

  els.degreeGrid.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.selected = { kind: 'degree', deg: Number(b.dataset.deg) };
    renderDegrees();
    const info = renderDetail();
    playInfo(info);
  });

  els.qualTabs.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.libQuality = b.dataset.q;
    renderLibrary();
  });

  els.rootGrid.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.selected = { kind: 'lib', root: Number(b.dataset.root), qid: state.libQuality };
    renderDegrees();
    const info = renderDetail();
    playInfo(info);
  });

  els.btnPlayChord.addEventListener('click', () => playInfo(infoForSelected()));

  els.btnSendChord.addEventListener('click', () => {
    const info = infoForSelected();
    const data = {
      type: 'cige:chords', key: state.key, mode: state.mode, bpm: 120, bpb: 4,
      chords: [chordName(info.root, info.qid)], sections: [{ section: '' }]
    };
    try {
      localStorage.setItem('cige.chords.incoming', JSON.stringify({ ...data, at: Date.now() }));
    } catch (e) { /* ignore */ }
    if (window.opener && !window.opener.closed) window.opener.postMessage(data, '*');
    toast(`已发送 ${chordName(info.root, info.qid)} 到词格（按小节循环）`);
  });

  els.progList.addEventListener('click', e => {
    const card = e.target.closest('.prog-card');
    if (!card) return;
    playProgression(Number(card.dataset.prog));
  });

  els.theoryProgressions.addEventListener('click', e => {
    const card = e.target.closest('.prog-card');
    if (!card) return;
    playProgression(Number(card.dataset.prog));
  });

  els.theoryTable.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-deg]');
    if (!tr) return;
    state.selected = { kind: 'degree', deg: Number(tr.dataset.deg) };
    switchView('dict');
    renderDegrees();
    renderDetail();
  });

  els.earLevel.addEventListener('change', () => {
    state.earLevel = els.earLevel.value;
    els.earLevelLabel.textContent = earLabel(state.earLevel);
    newQuestion();
  });

  els.btnHear.addEventListener('click', playEar);
  els.btnNewQ.addEventListener('click', () => { newQuestion(); playEar(); });
  els.btnNext.addEventListener('click', () => { newQuestion(); playEar(); });

  els.earOptions.addEventListener('click', e => {
    const b = e.target.closest('.option');
    if (!b) return;
    answerEar(Number(b.dataset.i));
  });

  /* ── 初始化 ── */
  loadStats();
  renderStats();
  els.intervalTable.innerHTML = INTERVALS.map(([n, name]) =>
    `<div><b>${n}</b><span>${name}</span></div>`
  ).join('');
  renderAllDict();
  newQuestion();
  renderStats();
})();
