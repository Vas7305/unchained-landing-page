/**
 * The product's bell and victory arpeggio (frontend/src/lib/sound.ts),
 * synthesised on the spot: no audio file, nothing fetched.
 *
 * One context for the page rather than one per sound, because browsers cap
 * how many a page may open. It is created on first use, and a browser that
 * has not yet seen a gesture on the page keeps it silent, as it should.
 */

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  context ??= new AudioContext();
  return context;
}

function tone(ctx: AudioContext, freq: number, start: number, dur: number, peak = 0.2) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

export function chime() {
  try {
    const ctx = audio();
    if (ctx) tone(ctx, 880, 0, 0.6);
  } catch {
    /* no audio */
  }
}

export function victoryChime() {
  try {
    const ctx = audio();
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ctx, f, i * 0.16, 0.7, 0.22));
    tone(ctx, 261.63, 0, 1.4, 0.12);
    tone(ctx, 1567.98, 0.64, 0.9, 0.1);
  } catch {
    /* no audio */
  }
}
