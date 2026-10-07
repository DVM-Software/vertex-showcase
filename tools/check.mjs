#!/usr/bin/env node
/* Checks the screenshots in shots/ and the team photos in team/, and writes
   team/team.js, the list of team photos the built film reads.

   Needs only Node, no npm install:

     node tools/check.mjs

   Run it after adding, removing or renaming any file in shots/ or team/.
   It prints what each scene will show and anything that needs fixing, and
   exits with code 1 if there is something to fix. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SCENES, CONFIG } from '../src/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG = /\.(png|jpe?g|webp)$/i;
const list = dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter(f => IMG.test(f)).sort() : [];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const placeholders = new Set(JSON.parse(fs.readFileSync(path.join(root, 'tools/placeholders.json'), 'utf8')));
let problems = 0;
const warn = msg => { problems++; console.log('  ! ' + msg); };

/* ---------- screenshots ---------- */
console.log('\nScreenshots in shots/');
const ids = SCENES.map(s => s.id), byScene = {};
for (const f of list('shots')) {
  const m = /^([a-z]+)([1-9]\d*)?\.(png|jpg|jpeg|webp)$/.exec(f);
  if (!m) { warn(`${f}: will not be found. Use the scene id in lower case, then 1, 2, 3 ... and a lower-case extension, e.g. acquire1.png`); continue; }
  if (!ids.includes(m[1])) { warn(`${f}: there is no scene called "${m[1]}". Scene ids: ${ids.join(', ')}`); continue; }
  (byScene[m[1]] = byScene[m[1]] || []).push({ f, n: m[2] ? +m[2] : 0 });
  if (placeholders.has(sha(path.join(root, 'shots', f)))) warn(`${f}: still the test placeholder. Replace it with the real screenshot or delete it`);
}
for (const sc of SCENES) {
  const files = byScene[sc.id] || [], shown = [];
  /* the film takes <id>.ext, then <id>1, <id>2 ... and stops at the first gap */
  const at = n => files.filter(x => x.n === n);
  if (at(0).length) shown.push(at(0)[0].f);
  let n = 1;
  for (; at(n).length; n++) shown.push(at(n)[0].f);
  files.filter(x => x.n > n).forEach(x => warn(`${x.f}: skipped, because ${sc.id}${n} is missing. Number the files 1, 2, 3 ... with no gaps`));
  files.filter(x => at(x.n).length > 1 && at(x.n)[0] !== x).forEach(x => warn(`${x.f}: skipped, because ${at(x.n)[0].f} has the same number`));
  if (!shown.length) continue;
  const secs = (CONFIG.shots.to - CONFIG.shots.from) * sc.dur / shown.length;
  console.log(`  ${sc.id.padEnd(12)} ${shown.length > 1 ? shown.length + ' shots, ' + secs.toFixed(1) + ' s each' : '1 shot, ' + secs.toFixed(1) + ' s'}: ${shown.join(', ')}`);
}
const without = SCENES.filter(sc => sc.stage && !byScene[sc.id]).map(sc => sc.id);
if (without.length) console.log(`  (no screenshots for: ${without.join(', ')})`);

/* ---------- team ---------- */
console.log('\nTeam photos in team/ (First_Last_Role_N_lL.png)');
const team = [];
for (const f of list('team')) {
  const parts = f.replace(IMG, '').split('_');
  if (parts.length < 5 || !/^l\d+$/i.test(parts[parts.length - 1]) || !/^\d+$/.test(parts[parts.length - 2])) {
    warn(`${f}: name not understood. Use First_Last_Role_N_lL, e.g. Jane_Doe_Data_Engineer_2_l3.png`); continue;
  }
  team.push({ f, name: parts[0] + ' ' + parts[1], role: parts.slice(2, -2).join(' '), n: +parts[parts.length - 2], level: +parts[parts.length - 1].slice(1) });
  if (placeholders.has(sha(path.join(root, 'team', f)))) warn(`${f}: still a test placeholder. Delete it`);
}
team.sort((a, b) => a.level - b.level || a.n - b.n);
const levels = [...new Set(team.map(m => m.level))];
for (const l of levels) {
  const row = team.filter(m => m.level === l);
  console.log(`  level ${l}: ${row.map(m => `${m.n}. ${m.name} (${m.role})`).join(', ')}`);
  row.forEach((m, k) => { if (k && row[k - 1].n === m.n) warn(`${m.f}: same number as ${row[k - 1].f} on level ${l}; their order is not fixed`); });
}
if (levels.length && levels[0] !== 1) warn(`there is no level 1. The top row will be level ${levels[0]}`);
if (!team.length) console.log('  (none: the team scene plays as a plain title card)');

const out = path.join(root, 'team/team.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, '/* Written by tools/check.mjs: the team photos the film shows, top row first.\n' +
  '   Run node tools/check.mjs again after changing anything in this folder. */\n' +
  'window.VERTEX_TEAM = ' + JSON.stringify(team.map(m => m.f), null, 2) + ';\n');
console.log(`\nWrote team/team.js with ${team.length} people.`);
console.log(problems ? `${problems} thing${problems > 1 ? 's' : ''} to fix, listed with ! above.` : 'Everything looks right.');
process.exitCode = problems ? 1 : 0;
