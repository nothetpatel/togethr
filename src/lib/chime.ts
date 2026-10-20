// A soft two-note chime made with Web Audio, so there's no sound file to ship.
// Browsers only allow sound after the person has interacted with the page,
// which they will have (tapping to walk, typing a task...).

let ctx: AudioContext | null = null;

const MUTED_KEY = 'togethr.muted';
let muted = (() => {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
})();

/** Whether this browser has the chime turned off (remembered between visits). */
export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    if (value) localStorage.setItem(MUTED_KEY, '1');
    else localStorage.removeItem(MUTED_KEY);
  } catch {
    // storage blocked; the choice lasts until the page reloads
  }
}

export function chime(): void {
  if (isMuted()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const start = ctx.currentTime + 0.02;
    [1046.5, 1318.5].forEach((freq, i) => {
      const t = start + i * 0.18;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 1);
    });
  } catch {
    // No audio available; the timer still works silently.
  }
}
