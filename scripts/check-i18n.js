/* global __dirname */
// Fails when locale files don't share exactly the same key set.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const keys = Object.fromEntries(
  files.map((f) => [f, new Set(flatten(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))))]),
);
const reference = keys['en.json'];
let failed = false;
for (const [file, set] of Object.entries(keys)) {
  if (file === 'en.json') continue;
  const missing = [...reference].filter((k) => !set.has(k));
  const extra = [...set].filter((k) => !reference.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`${file}: ${missing.length} missing, ${extra.length} extra`);
    missing.forEach((k) => console.error(`  - missing ${k}`));
    extra.forEach((k) => console.error(`  + extra   ${k}`));
  }
}
if (failed) process.exit(1);
console.log(`i18n OK: ${files.length} locales, ${reference.size} keys each`);
