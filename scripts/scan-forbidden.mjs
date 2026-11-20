import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['node_modules', 'dist', 'coverage', '.git']);
const forbidden = [
  ['Site', 'Doc'],
  ['AT', 'LAS'],
  ['SKY', 'LINE'],
  ['LE', 'NS'],
  ['Ops', 'Center'],
  ['One', 'Web'],
  ['Eutel', 'sat'],
  ['Be', 'am'],
  ['git.', 'via', 'sat.com'],
  ['@via', 'sat.com'],
  ['cé', 'dula'],
].map((parts) => parts.join(''));
const phonePattern =
  /(?:\+\s?\d{1,3}[\s()-]*)?(?<![\w.])(?:\d{3}[\s()-]+\d{3}[\s()-]+\d{4}|\d{7,15})(?![\w.])/u;
const findings = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    else {
      const content = await readFile(target, 'utf8');
      const lower = content.toLowerCase();
      for (const term of forbidden)
        if (lower.includes(term.toLowerCase()))
          findings.push(`${path.relative(root, target)}: prohibited content`);
      if (phonePattern.test(content))
        findings.push(`${path.relative(root, target)}: phone-like number`);
    }
  }
}
await walk(root);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else console.log('Forbidden-content scan passed.');
