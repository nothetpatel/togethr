// One shared Web Audio context for the chime and ambient sounds. Browsers only
// start audio after the person has interacted with the page, so callers make
// sure that's happened (or resume it on the next tap).

let ctx: AudioContext | null = null;

export function audioContext(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null; // no audio available; everything still works silently
  }
}
