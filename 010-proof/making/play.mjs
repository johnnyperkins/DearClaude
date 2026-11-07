// Play proof from a terminal, one command per run, so a game can go on across many calls.
// usage: node play.mjs <savefile> [command...]    (no command: start a new game)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const P = createRequire(import.meta.url)('../proof.js');
const [file, ...rest] = process.argv.slice(2);
const cmd = rest.join(' ').trim();
let save = null;
if (cmd && fs.existsSync(file)) save = JSON.parse(fs.readFileSync(file, 'utf8'));
let out;
if (!save) {
  save = { s: P.fresh(), undo: [] };
  out = P.INTRO + '\n\n' + P.look(save.s);
} else if (/^(undo|oops)$/i.test(cmd)) {
  if (save.undo.length) { save.s = JSON.parse(save.undo.pop()); out = '(Taken back.)\n\n' + P.look(save.s); }
  else out = 'There\'s nothing to undo.';
} else if (/^restart$/i.test(cmd)) {
  save = { s: P.fresh(), undo: [] };
  out = P.INTRO + '\n\n' + P.look(save.s);
} else {
  save.undo.push(JSON.stringify(save.s));
  if (save.undo.length > 50) save.undo.shift();
  out = P.command(save.s, cmd);
}
fs.writeFileSync(file, JSON.stringify(save));
const st = P.status(save.s);
console.log(`[${st.room} | ${st.time}]\n` + (cmd ? '> ' + cmd + '\n' : '') + out);
