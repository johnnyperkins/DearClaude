// Run a list of commands (one per line, from a file or stdin) and print the transcript.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const P = createRequire(import.meta.url)('../proof.js');
const lines = fs.readFileSync(process.argv[2] || 0, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const s = P.fresh();
console.log(P.INTRO + '\n\n' + P.look(s));
for (const l of lines) {
  const out = P.command(s, l);
  const st = P.status(s);
  console.log(`\n[${st.room} | ${st.time} | ${st.points}/${st.max}]\n> ${l}\n${out}`);
  if (s.ended) break;
}
