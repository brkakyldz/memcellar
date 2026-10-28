#!/usr/bin/env node
/**
 * lock — the held-out lock as a manifest, not a hook.
 *
 *   node lock.mjs land  --pack <pack>/holdout [--root DIR] --author "<who>" [--spec <sha>]
 *       Makes tests/acceptance/holdout/ an exact copy of the pack's holdout/
 *       folder (files the pack no longer has are removed: a trim retires them),
 *       then writes LOCK.json — sha256 of every file, author, date, spec commit.
 *       The script does the copy so no hand touches the oracle on the way in.
 *   node lock.mjs check [--root DIR]
 *       Exit 0 when every file matches LOCK.json, 1 when any file was changed,
 *       added or removed, 2 when there is no LOCK.json.
 *
 * Line endings are normalized before hashing (text files only), so a checkout
 * that converts LF to CRLF is not reported as tampering.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOLDOUT = path.join('tests', 'acceptance', 'holdout');
export const LOCK_FILE = 'LOCK.json';

export function hashFile(file) {
  let buf = fs.readFileSync(file);
  if (!buf.includes(0)) buf = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  return createHash('sha256').update(buf).digest('hex');
}

// Every file under dir, relative, with forward slashes, LOCK.json excluded.
export function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        walk(p);
      } else if (e.isFile()) {
        const rel = path.relative(dir, p).split(path.sep).join('/');
        if (rel !== LOCK_FILE) out.push(rel);
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort();
}

export function manifest(dir) {
  return Object.fromEntries(listFiles(dir).map((rel) => [rel, hashFile(path.join(dir, rel))]));
}

export function land({ pack, root, author, spec = '', date = new Date().toISOString().slice(0, 10) }) {
  if (!author) throw new Error('--author is required: the lock records who wrote the scenarios');
  if (!fs.existsSync(pack) || !fs.statSync(pack).isDirectory()) throw new Error(`no pack folder at ${pack}`);
  const files = listFiles(pack);
  if (!files.length) throw new Error(`pack folder ${pack} is empty`);
  const dest = path.join(root, HOLDOUT);
  const removed = listFiles(dest).filter((rel) => !files.includes(rel));
  for (const rel of removed) fs.rmSync(path.join(dest, rel));
  for (const rel of files) {
    const to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(pack, rel), to);
  }
  const lock = { author, date, spec, files: manifest(dest) };
  fs.writeFileSync(path.join(dest, LOCK_FILE), `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return { copied: files.length, removed, lock };
}

// { ok, missingLock, changed, added, removed }
export function check(root) {
  const dest = path.join(root, HOLDOUT);
  const lockPath = path.join(dest, LOCK_FILE);
  if (!fs.existsSync(lockPath)) return { ok: false, missingLock: true, changed: [], added: [], removed: [] };
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const want = lock.files ?? {};
  const have = manifest(dest);
  const changed = Object.keys(want).filter((f) => f in have && have[f] !== want[f]);
  const removed = Object.keys(want).filter((f) => !(f in have));
  const added = Object.keys(have).filter((f) => !(f in want));
  return { ok: !changed.length && !removed.length && !added.length, missingLock: false, changed, added, removed, lock };
}

// True when this file is the script node was asked to run. Compared as real
// paths: called through a skill link (a junction or symlink), argv[1] is the
// link's path while import.meta.url is the target's, and a plain comparison
// would make the script exit silently.
function isMain() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (name, dflt = '') => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 && rest[i + 1] ? rest[i + 1] : dflt;
  };
  const root = path.resolve(opt('root', process.cwd()));
  try {
    if (cmd === 'land') {
      const r = land({ pack: path.resolve(opt('pack')), root, author: opt('author'), spec: opt('spec') });
      console.log(`landed ${r.copied} file(s) in ${HOLDOUT}${r.removed.length ? `, retired ${r.removed.join(', ')}` : ''}; LOCK.json written`);
      console.log(`commit it on its own: git add ${HOLDOUT.split(path.sep).join('/')} && git commit -m "holdout: <n> scenarios by <author> from spec@<sha>"`);
    } else if (cmd === 'check') {
      const r = check(root);
      if (r.missingLock) {
        console.log(`NO LOCK: ${HOLDOUT}/${LOCK_FILE} is missing — land the scenarios with \`lock.mjs land\``);
        process.exit(2);
      }
      if (r.ok) {
        console.log(`LOCK OK: ${Object.keys(r.lock.files).length} file(s) match LOCK.json (author: ${r.lock.author}, ${r.lock.date})`);
      } else {
        const parts = [];
        if (r.changed.length) parts.push(`changed: ${r.changed.join(', ')}`);
        if (r.added.length) parts.push(`added: ${r.added.join(', ')}`);
        if (r.removed.length) parts.push(`removed: ${r.removed.join(', ')}`);
        console.log(`LOCK BROKEN: ${parts.join('; ')} — only a scenario-author round may change held-out files`);
        process.exit(1);
      }
    } else {
      console.log('usage: lock.mjs land --pack <dir> --author "<who>" [--spec <sha>] [--root DIR] | lock.mjs check [--root DIR]');
      process.exit(2);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}
