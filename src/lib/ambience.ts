import { audioContext } from './audio';

// Soft background sound to study to: rain, waves or a crackling fire. Made
// from shaped noise with Web Audio, so there are no audio files to ship or
// license. The choice is remembered per browser.

export type Ambience = 'rain' | 'waves' | 'fire';
export const AMBIENCES: { kind: Ambience; emoji: string; label: string }[] = [
  { kind: 'rain', emoji: '🌧️', label: 'Rain' },
  { kind: 'waves', emoji: '🌊', label: 'Waves' },
  { kind: 'fire', emoji: '🔥', label: 'Fireplace' },
];

const KEY = 'togethr.ambience';
const VOLUME = 0.5;

let current: { kind: Ambience; stop: () => void } | null = null;

export function savedAmbience(): Ambience | null {
  try {
    const v = localStorage.getItem(KEY);
    return AMBIENCES.some((a) => a.kind === v) ? (v as Ambience) : null;
  } catch {
    return null;
  }
}

/** Two seconds of noise: white, or "brown" (deeper, like surf or wind). */
function noiseBuffer(ac: AudioContext, brown: boolean): AudioBuffer {
  const buffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function loop(ac: AudioContext, brown: boolean): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, brown);
  src.loop = true;
  return src;
}

function filter(ac: AudioContext, type: BiquadFilterType, frequency: number): BiquadFilterNode {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  return f;
}

/** Builds a sound into `out`; returns its sources/timers so it can be stopped. */
function build(ac: AudioContext, kind: Ambience, out: GainNode): () => void {
  const sources: AudioScheduledSourceNode[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  if (kind === 'rain') {
    // Hiss of rain: white noise without the harsh highs or the rumble.
    const src = loop(ac, false);
    const g = ac.createGain();
    g.gain.value = 0.18;
    src.connect(filter(ac, 'highpass', 400)).connect(filter(ac, 'lowpass', 6000)).connect(g).connect(out);
    sources.push(src);
  } else if (kind === 'waves') {
    // Surf: deep noise that swells and fades every ~8 seconds.
    const src = loop(ac, true);
    const g = ac.createGain();
    g.gain.value = 0.35;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.12;
    const depth = ac.createGain();
    depth.gain.value = 0.25;
    lfo.connect(depth).connect(g.gain);
    src.connect(filter(ac, 'lowpass', 900)).connect(g).connect(out);
    sources.push(src, lfo);
  } else {
    // Fire: a low roar plus random crackles.
    const src = loop(ac, true);
    const g = ac.createGain();
    g.gain.value = 0.3;
    src.connect(filter(ac, 'lowpass', 500)).connect(g).connect(out);
    sources.push(src);
    const crackle = noiseBuffer(ac, false);
    timer = setInterval(() => {
      if (Math.random() > 0.55) return;
      const c = ac.createBufferSource();
      c.buffer = crackle;
      const cg = ac.createGain();
      const t = ac.currentTime + Math.random() * 0.2;
      cg.gain.setValueAtTime(0.25 + Math.random() * 0.3, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03 + Math.random() * 0.05);
      c.connect(filter(ac, 'highpass', 1500)).connect(cg).connect(out);
      c.start(t, Math.random() * 1.5, 0.1);
    }, 120);
  }

  sources.forEach((s) => s.start());
  return () => {
    if (timer) clearInterval(timer);
    sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    });
  };
}

/** Plays a sound (fading in), or stops it with null (fading out). Remembers the choice. */
export function setAmbience(kind: Ambience | null): void {
  try {
    if (kind) localStorage.setItem(KEY, kind);
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked; the choice lasts until reload
  }
  play(kind);
}

/** Stops the sound without forgetting the choice (e.g. when leaving a room). */
export function pauseAmbience(): void {
  play(null);
}

function play(kind: Ambience | null): void {
  if (current?.kind === kind) return;
  current?.stop();
  current = null;
  if (!kind) return;

  const ac = audioContext();
  if (!ac) return;
  const out = ac.createGain();
  out.gain.setValueAtTime(0, ac.currentTime);
  out.gain.linearRampToValueAtTime(VOLUME, ac.currentTime + 1.5);
  out.connect(ac.destination);
  const stopSound = build(ac, kind, out);
  current = {
    kind,
    stop: () => {
      out.gain.cancelScheduledValues(ac.currentTime);
      out.gain.setValueAtTime(out.gain.value, ac.currentTime);
      out.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8);
      setTimeout(() => {
        stopSound();
        out.disconnect();
      }, 900);
    },
  };
}
