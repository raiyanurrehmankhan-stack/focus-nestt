// Generates a short, gentle, royalty-free chime (public/sounds/alarm.wav).
// Pure Node, no dependencies. Run with: node scripts/generate-sound.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
const rate = 22050, seconds = 2.4, n = Math.floor(rate * seconds);
const notes = [ // [start s, frequency Hz] — a soft rising C-major arpeggio
  [0.0, 523.25], [0.32, 659.25], [0.64, 783.99], [1.1, 1046.5],
];
const samples = new Float32Array(n);
for (const [start, f] of notes) {
  const s0 = Math.floor(start * rate);
  for (let i = s0; i < n; i++) {
    const t = (i - s0) / rate;
    const env = Math.min(1, t / 0.015) * Math.exp(-t * 2.6);
    samples[i] += env * (0.6 * Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t) + 0.08 * Math.sin(2 * Math.PI * f * 3 * t));
  }
}
let peak = 0; for (const v of samples) peak = Math.max(peak, Math.abs(v));
const buf = Buffer.alloc(44 + n * 2);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round((samples[i] / peak) * 0.7 * 32767), 44 + i * 2);
mkdirSync('public/sounds', { recursive: true });
writeFileSync('public/sounds/alarm.wav', buf);
console.log('public/sounds/alarm.wav', buf.length, 'bytes');
