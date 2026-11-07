/* 词格 · 自研 WebAudio 音色引擎（不依赖任何云端音源） */
(function (global) {
  'use strict';

  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* 谐波序列：imag[1..n] 决定音色；数值仅为相对幅度 */
  const INSTRUMENTS = [
    {
      id: 'piano', name: '钢琴', group: '键盘', kind: 'tonal',
      harm: [0, 1, .46, .33, .24, .17, .12, .085, .06, .042, .028, .018],
      peak: .5, attack: .008, cutoff: 9000, decay: 'exp'
    },
    {
      id: 'epiano', name: '电钢琴', group: '键盘', kind: 'tonal',
      harm: [0, 1, .18, .62, .12, .34, .08, .2, .05, .11], peak: .46, attack: .012, cutoff: 7000, decay: 'exp'
    },
    {
      id: 'organ', name: '管风琴', group: '键盘', kind: 'tonal',
      harm: [0, 1, .72, .5, .4, .28, .2, .14, .1, .07], peak: .38, attack: .02, cutoff: 6000, sustain: .8, release: .05
    },
    {
      id: 'guitar', name: '木吉他', group: '弦乐', kind: 'tonal',
      harm: [0, 1, .62, .42, .27, .18, .12, .08, .05], peak: .44, attack: .006, cutoff: 6500, decay: 'exp'
    },
    {
      id: 'eguitar', name: '电吉他', group: '弦乐', kind: 'tonal',
      harm: [0, 1, .55, .4, .3, .2, .14, .1, .07, .05], peak: .42, attack: .004, cutoff: 5200, decay: 'exp'
    },
    {
      id: 'bass', name: '贝斯', group: '低音', kind: 'tonal',
      harm: [0, 1, .34, .18, .1, .06], peak: .55, attack: .008, cutoff: 2200, decay: 'exp'
    },
    {
      id: 'synthbass', name: '合成贝斯', group: '低音', kind: 'tonal',
      harm: [0, 1, .45, .3, .2, .13, .08], peak: .5, attack: .006, cutoff: 3000, decay: 'exp'
    },
    {
      id: 'pad', name: '合成 Pad', group: '合成', kind: 'tonal',
      harm: [0, .8, .52, .36, .26, .19, .14, .1, .07, .05], peak: .35, attack: .28, cutoff: 5000, sustain: .85, release: .18
    },
    {
      id: 'strings', name: '弦乐', group: '弦乐', kind: 'tonal',
      harm: [0, .9, .58, .4, .28, .2, .14, .1, .07], peak: .34, attack: .22, cutoff: 4200, sustain: .82, release: .2
    },
    {
      id: 'pluck', name: '拨弦', group: '合成', kind: 'tonal',
      harm: [0, 1, .3, .5, .15, .22, .1, .08], peak: .42, attack: .004, cutoff: 7000, decay: 'exp'
    },
    {
      id: 'lead', name: '合成主音', group: '合成', kind: 'tonal',
      harm: [0, 1, .4, .5, .22, .26, .12, .14, .08], peak: .38, attack: .02, cutoff: 6000, sustain: .7, release: .06
    },
    {
      id: 'drums', name: '鼓组', group: '打击', kind: 'drum',
      harm: [], peak: 1, attack: .002, decay: 'exp'
    }
  ];

  const BY_ID = {};
  for (const it of INSTRUMENTS) BY_ID[it.id] = it;

  /* 每个 AudioContext 缓存一次周期波与噪声缓冲 */
  const waveCache = new WeakMap();
  function periodic(ctx, harm) {
    let cache = waveCache.get(ctx);
    if (!cache) { cache = new Map(); waveCache.set(ctx, cache); }
    const key = harm.join(',');
    let w = cache.get(key);
    if (w) return w;
    const real = new Float32Array(harm.length);
    const imag = new Float32Array(harm.length);
    for (let i = 1; i < harm.length; i++) imag[i] = harm[i];
    try {
      w = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    } catch (e) {
      w = ctx.createPeriodicWave(real, imag);
    }
    cache.set(key, w);
    return w;
  }

  function noiseBuffer(ctx) {
    if (ctx.__cigeNoise) return ctx.__cigeNoise;
    const len = Math.floor(ctx.sampleRate * 1.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 0x2545f491;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      data[i] = ((seed >>> 16) & 0xffff) / 32768 - 1;
    }
    ctx.__cigeNoise = buf;
    return buf;
  }

  function panner(ctx, node, pan, master) {
    if (!pan) { node.connect(master); return; }
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      node.connect(p).connect(master);
    } else {
      node.connect(master);
    }
  }

  function envelope(ctx, at, dur, def) {
    const g = ctx.createGain();
    const peak = def.peak;
    const attack = Math.min(def.attack || .01, Math.max(.002, dur * .4));
    g.gain.setValueAtTime(.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    if (def.sustain) {
      const hold = peak * def.sustain;
      const settle = at + attack + Math.min(.2, dur * .35);
      g.gain.linearRampToValueAtTime(hold, Math.max(settle, at + attack + .001));
      const rel = Math.min(def.release || .1, dur * .5);
      g.gain.setValueAtTime(hold, Math.max(settle, at + dur - rel));
      g.gain.linearRampToValueAtTime(.0001, at + dur);
    } else {
      g.gain.exponentialRampToValueAtTime(.0001, at + Math.max(dur, attack + .01));
    }
    return g;
  }

  function createEngine(opts) {
    opts = opts || {};
    const AC = global.AudioContext || global.webkitAudioContext;
    const Offline = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    const isOffline = !!(Offline && opts.ctx && opts.ctx instanceof Offline);
    if (!opts.ctx && !AC) throw new Error('当前浏览器不支持 WebAudio');
    const ctx = opts.ctx || new AC();
    const master = ctx.createGain();
    master.gain.value = opts.master == null ? .35 : opts.master;
    master.connect(ctx.destination);

    function resume() {
      if (isOffline) return Promise.resolve();
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        return ctx.resume().catch(() => {});
      }
      return Promise.resolve();
    }

    function note(instId, midi, at, dur, o) {
      const def = BY_ID[instId] || BY_ID.piano;
      if (def.kind === 'drum') return drum('kick', at, o);
      o = o || {};
      const gain = o.gain == null ? 1 : o.gain;
      const when = Math.max(at, ctx.currentTime);
      const len = Math.max(.05, dur);
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(periodic(ctx, def.harm));
      osc.frequency.value = midiHz(midi);
      const g = envelope(ctx, when, len, def);
      let out = g;
      if (def.cutoff) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = def.cutoff;
        f.Q.value = .8;
        g.connect(f);
        out = f;
      }
      if (gain !== 1) {
        const trim = ctx.createGain();
        trim.gain.value = gain;
        out.connect(trim);
        out = trim;
      }
      panner(ctx, out, o.pan || 0, master);
      osc.connect(g);
      osc.start(when);
      osc.stop(when + len + .02);
      return { stop: when + len };
    }

    function drum(kind, at, o) {
      o = o || {};
      const gain = o.gain == null ? 1 : o.gain;
      const when = Math.max(at, ctx.currentTime);
      const pan = o.pan || 0;
      if (kind === 'kick') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(165, when);
        osc.frequency.exponentialRampToValueAtTime(48, when + .13);
        g.gain.setValueAtTime(.0001, when);
        g.gain.linearRampToValueAtTime(.95 * gain, when + .005);
        g.gain.exponentialRampToValueAtTime(.0001, when + .22);
        osc.connect(g);
        panner(ctx, g, pan, master);
        osc.start(when); osc.stop(when + .26);
        return;
      }
      if (kind === 'snare') {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = .9;
        const g = ctx.createGain();
        g.gain.setValueAtTime(.0001, when);
        g.gain.linearRampToValueAtTime(.6 * gain, when + .004);
        g.gain.exponentialRampToValueAtTime(.0001, when + .19);
        src.connect(bp).connect(g);
        panner(ctx, g, pan, master);
        src.start(when); src.stop(when + .24);
        const tone = ctx.createOscillator();
        const tg = ctx.createGain();
        tone.type = 'triangle'; tone.frequency.value = 220;
        tg.gain.setValueAtTime(.0001, when);
        tg.gain.linearRampToValueAtTime(.22 * gain, when + .004);
        tg.gain.exponentialRampToValueAtTime(.0001, when + .08);
        tone.connect(tg);
        panner(ctx, tg, pan, master);
        tone.start(when); tone.stop(when + .1);
        return;
      }
      if (kind === 'hat' || kind === 'openhat') {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 6800;
        const g = ctx.createGain();
        const len = kind === 'openhat' ? .16 : .055;
        g.gain.setValueAtTime(.0001, when);
        g.gain.linearRampToValueAtTime((kind === 'openhat' ? .32 : .28) * gain, when + .003);
        g.gain.exponentialRampToValueAtTime(.0001, when + len);
        src.connect(hp).connect(g);
        panner(ctx, g, pan, master);
        src.start(when); src.stop(when + len + .02);
        return;
      }
      if (kind === 'clap') {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(.0001, when);
        for (let i = 0; i < 3; i++) {
          g.gain.linearRampToValueAtTime(.45 * gain, when + .003 + i * .018);
          g.gain.exponentialRampToValueAtTime(.12 * gain, when + .014 + i * .018);
        }
        g.gain.exponentialRampToValueAtTime(.0001, when + .2);
        src.connect(bp).connect(g);
        panner(ctx, g, pan, master);
        src.start(when); src.stop(when + .24);
        return;
      }
      // rim
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 1250;
      g.gain.setValueAtTime(.0001, when);
      g.gain.linearRampToValueAtTime(.35 * gain, when + .004);
      g.gain.exponentialRampToValueAtTime(.0001, when + .07);
      osc.connect(g);
      panner(ctx, g, pan, master);
      osc.start(when); osc.stop(when + .09);
    }

    function chord(instId, rootMidi, intervals, at, dur, o) {
      o = o || {};
      const spread = o.spread || 1.5;
      intervals.forEach((iv, i) => {
        const when = at + i * (o.stagger || 0);
        note(instId, rootMidi + iv, when, dur, {
          gain: (o.gain == null ? .55 : o.gain) / Math.max(1, Math.sqrt(intervals.length)),
          pan: o.pan || 0
        });
      });
      return spread;
    }

    function previewChord(instId, rootMidi, intervals, dur, o) {
      resume();
      const start = ctx.currentTime + .03;
      chord(instId, rootMidi, intervals, start, dur || 1.1, o);
    }

    function previewNote(instId, midi, dur) {
      resume();
      note(instId, midi, ctx.currentTime + .02, dur || .5, { gain: .8 });
    }

    return {
      ctx, master, resume, playNote: note, playDrum: drum, playChord: chord,
      previewChord, previewNote,
      setMaster(v) { master.gain.value = clamp(v, 0, 1); },
      now() { return ctx.currentTime; }
    };
  }

  global.CigeSynth = {
    INSTRUMENTS,
    get(id) { return BY_ID[id] || null; },
    createEngine,
    midiHz
  };
})(window);
