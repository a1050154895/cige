/* 词格 · 本地和弦识别（无服务端）
 * 思路：下混单声道 → 抗混叠降采样到 8kHz → 每小节取 3 个 Hann 窗做 FFT
 *      → 60~1200Hz 频谱折叠到 12 音级 chroma → 与三和弦/七和弦模板做余弦匹配。
 * 输出按小节的和弦名，如 C / Am / G7。
 */
(function (root) {
  'use strict';

  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // 模板：0=大三，1=小三，2=属七，3=小七，4=大七，5=sus4，6=减三
  const TEMPLATES = [
    { suffix: '', intervals: [0, 4, 7], extra: 0 },
    { suffix: 'm', intervals: [0, 3, 7], extra: 0 },
    { suffix: '7', intervals: [0, 4, 7, 10], extra: 1 },
    { suffix: 'm7', intervals: [0, 3, 7, 10], extra: 1 },
    { suffix: 'maj7', intervals: [0, 4, 7, 11], extra: 1 },
    { suffix: 'sus4', intervals: [0, 5, 7], extra: 0 },
    { suffix: 'dim', intervals: [0, 3, 6], extra: 0 }
  ];

  function fft(re, im) {
    const n = re.length;
    // 位反转
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wRe = Math.cos(ang), wIm = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let curRe = 1, curIm = 0;
        for (let k = 0; k < len / 2; k++) {
          const aRe = re[i + k], aIm = im[i + k];
          const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
          const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
          re[i + k] = aRe + bRe; im[i + k] = aIm + bIm;
          re[i + k + len / 2] = aRe - bRe; im[i + k + len / 2] = aIm - bIm;
          const nextRe = curRe * wRe - curIm * wIm;
          curIm = curRe * wIm + curIm * wRe;
          curRe = nextRe;
        }
      }
    }
  }

  function mono(buffer) {
    const ch0 = buffer.getChannelData(0);
    if (buffer.numberOfChannels === 1) return ch0;
    const ch1 = buffer.getChannelData(1);
    const out = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) out[i] = (ch0[i] + ch1[i]) * 0.5;
    return out;
  }

  // 抗混叠：先按 D 点平均（低通），再抽取；最后做一次邻域平滑
  function downsample(sig, D) {
    if (D <= 1) return sig;
    const n = Math.floor(sig.length / D);
    const tmp = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < D; j++) s += sig[i * D + j] || 0;
      tmp[i] = s / D;
    }
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let j = -2; j <= 2; j++) {
        const k = i + j;
        if (k >= 0 && k < n) { s += tmp[k]; c++; }
      }
      out[i] = s / c;
    }
    return out;
  }

  function hann(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    return w;
  }

  // 返回 12 维 chroma 与能量
  function chromaOf(data, start, size, sr, win) {
    const re = new Float32Array(size);
    const im = new Float32Array(size);
    const from = Math.max(0, Math.min(start, data.length - size));
    for (let i = 0; i < size; i++) re[i] = (data[from + i] || 0) * win[i];
    fft(re, im);

    const chroma = new Float32Array(12);
    let energy = 0;
    const binHz = sr / size;
    const lo = 2, hi = Math.min(size / 2 - 1, Math.floor(1200 / binHz));
    for (let k = lo; k <= hi; k++) {
      const hz = k * binHz;
      if (hz < 55) continue;
      const mag = Math.hypot(re[k], im[k]);
      energy += mag * mag;
      if (mag < 1e-6) continue;
      const midi = Math.round(69 + 12 * Math.log2(hz / 440));
      const pc = ((midi % 12) + 12) % 12;
      // 低频给一点抑制，避免贝斯/鼓的低频把 chroma 带偏
      const wgt = hz < 110 ? 0.5 : hz < 220 ? 0.8 : 1;
      chroma[pc] += Math.sqrt(mag) * wgt;
    }
    return { chroma, energy };
  }

  function norm(v) {
    let s = 0;
    for (let i = 0; i < v.length; i++) s += v[i] * v[i];
    return Math.sqrt(s) || 1;
  }

  function match(chroma) {
    const n = norm(chroma);
    let best = { name: '', score: -1 }, second = -1;
    for (let root = 0; root < 12; root++) {
      for (let t = 0; t < TEMPLATES.length; t++) {
        const tp = TEMPLATES[t];
        let dot = 0, tn = 0;
        for (const iv of tp.intervals) {
          dot += chroma[(root + iv) % 12];
          tn += 1;
        }
        const score = dot / (n * Math.sqrt(tn)) - tp.extra * 0.015;
        if (score > best.score) {
          second = best.score;
          best = { name: NOTES[root] + tp.suffix, score };
        } else if (score > second) {
          second = score;
        }
      }
    }
    return { name: best.name, score: best.score, gap: best.score - second };
  }

  function detectChords(buffer, opts) {
    const bpm = opts.bpm, firstBeat = opts.firstBeat, bpb = opts.beatsPerBar;
    const duration = buffer.duration;
    if (!(bpm > 0) || duration <= 0) return [];

    const D = Math.max(1, Math.round(buffer.sampleRate / 8000));
    const ds = downsample(mono(buffer), D);
    const sr = buffer.sampleRate / D;
    const size = 2048;
    const win = hann(size);

    const barDur = (60 / bpm) * bpb;
    const bars = Math.max(0, Math.floor((duration - firstBeat) / barDur) + 1);
    const out = new Array(bars).fill('');

    // 先估一遍整体能量，用于静音判定
    const windowsPerBar = 3;
    const chromas = new Array(bars);
    let globalEnergy = 0, cnt = 0;
    for (let b = 0; b < bars; b++) {
      const start = firstBeat + b * barDur;
      const set = [];
      for (let w = 0; w < windowsPerBar; w++) {
        const t = start + barDur * (0.2 + 0.3 * w);
        if (t <= 0 || t >= duration - 0.05) continue;
        const r = chromaOf(ds, Math.round(t * sr), size, sr, win);
        set.push(r);
        globalEnergy += r.energy; cnt++;
      }
      chromas[b] = set;
    }
    const meanEnergy = cnt ? globalEnergy / cnt : 0;

    for (let b = 0; b < bars; b++) {
      let sum = new Float32Array(12), energy = 0, ok = false;
      for (const r of chromas[b]) {
        if (r.energy < meanEnergy * 0.03) continue;
        for (let i = 0; i < 12; i++) sum[i] += r.chroma[i];
        energy += r.energy; ok = true;
      }
      if (!ok) continue;
      const m = match(sum);
      if (m.gap > 0.004 && m.score > 0.25) out[b] = m.name;
    }
    return out;
  }

  const api = { detectChords, NOTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ChordDetector = api;
})(typeof window !== 'undefined' ? window : globalThis);
