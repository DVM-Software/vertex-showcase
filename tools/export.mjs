#!/usr/bin/env node
/* Frame-exact export of the film to MP4.

   Every frame is rendered at an exact timestamp and piped to ffmpeg, so the
   video is perfectly smooth however fast or slow the machine is.

   Needs Google Chrome and ffmpeg (brew install ffmpeg).

     npm run build                       # refresh docs/vertex-showcase.html
     npm run export                      # 1920x1080, 60 fps -> out/vertex-showcase.mp4
     npm run export -- --scale 2         # 3840x2160
     npm run export -- --fps 30 --from 20 --to 31 --out out/acquire.mp4
*/
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = +arg('width', 1920), H = +arg('height', 1080), FPS = +arg('fps', 60), SCALE = +arg('scale', 1);
const page = path.resolve(arg('page', path.join(root, 'docs/vertex-showcase.html')));
const out = path.resolve(arg('out', path.join(root, 'out/vertex-showcase.mp4')));
fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await chromium.launch({
  channel: arg('channel', 'chrome'),
  args: ['--ignore-gpu-blocklist', ...(process.env.CHROME_ARGS || '').split(' ').filter(Boolean)],
});
const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
pg.on('pageerror', e => console.error('page error:', e.message));
await pg.goto(pathToFileURL(page).href + '?capture');
await pg.evaluate(() => document.fonts.ready.then(() => true));
const media = await pg.evaluate(() => window.__vertex.ready);
console.log('Screenshots per scene:', JSON.stringify(media.shots), 'Team photos:', media.team);
const total = await pg.evaluate(() => window.__vertex.total);
const from = +arg('from', 0), to = +arg('to', total);
const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS);

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', arg('crf', '18'), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
ff.on('error', () => { console.error('ffmpeg was not found. Install it with: brew install ffmpeg'); process.exit(1); });

/* Advance the film and every CSS transition by exactly one frame. */
const step = ([f0, f1, fps, draw]) => {
  for (let f = f0; f < f1; f++) {
    window.__vertex.renderAt(f / fps, 1 / fps, !draw);
    for (const a of document.getAnimations()) {
      if (!a.__c) { a.__c = 1; a.pause(); }
      a.currentTime = (a.currentTime || 0) + 1000 / fps;
    }
  }
};
if (n0 > 0) await pg.evaluate(step, [0, n0, FPS, false]);   // replay the lead-in without drawing

const cdp = await pg.context().newCDPSession(pg);
const started = Date.now();
for (let f = n0; f < n1; f++) {
  await pg.evaluate(step, [f, f + 1, FPS, true]);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 96 });
  if (!ff.stdin.write(Buffer.from(shot.data, 'base64'))) await once(ff.stdin, 'drain');
  if ((f - n0) % FPS === FPS - 1) process.stdout.write(`\r${((f + 1) / FPS).toFixed(0)} s of ${to} s rendered`);
}
ff.stdin.end();
await once(ff, 'close');
await browser.close();
console.log(`\nSaved ${out} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
