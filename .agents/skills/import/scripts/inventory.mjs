#!/usr/bin/env node
/**
 * inventory — a read-only list of everything in a notes folder to import.
 *
 *   node inventory.mjs <source-folder> [--out <file.json>]
 *
 * Opens files for reading only; never writes into the source. Skips tool
 * state (.obsidian, .git, .trash, node_modules). Prints a Markdown table with
 * empty Type / Destination / Reason columns for the dry run to fill, and with
 * --out writes the same data as JSON. Exit 2 when the folder is missing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set(['.obsidian', '.git', '.trash', 'node_modules', '.DS_Store']);
const NOTE_EXT = new Set(['.md', '.markdown', '.txt']);

export function readFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { keys: [], tags: [], body: text };
  const keys = [];
  const tags = [];
  let inTags = false;
  for (const line of m[1].split(/\r?\n/)) {
    const k = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (k) {
      keys.push(k[1]);
      inTags = k[1] === 'tags';
      if (inTags && k[2].trim()) {
        tags.push(...k[2].replace(/[[\]]/g, '').split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean));
      }
    } else if (inTags) {
      const item = /^\s*-\s*(.+)$/.exec(line);
      if (item) tags.push(item[1].trim().replace(/^#/, ''));
    }
  }
  return { keys, tags, body: text.slice(m[0].length) };
}

export function describeNote(text, rel) {
  const { keys, tags, body } = readFrontmatter(text);
  const inlineTags = [...body.matchAll(/(?:^|\s)#([A-Za-z][\w/-]*)/g)].map((m) => m[1]);
  const links = [...body.matchAll(/(!?)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)];
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
  const base = path.basename(rel).replace(/\.[^.]+$/, '');
  return {
    title: heading || base,
    words: (body.match(/\S+/g) ?? []).length,
    frontmatter: keys,
    tags: [...new Set([...tags, ...inlineTags])],
    links: [...new Set(links.filter((m) => !m[1]).map((m) => m[2].trim()))],
    embeds: [...new Set(links.filter((m) => m[1]).map((m) => m[2].trim()))],
    dateInName: /(\d{4}-\d{2}-\d{2})/.exec(base)?.[1] ?? null,
  };
}

export function inventory(source) {
  const items = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p);
        continue;
      }
      if (!e.isFile()) continue;
      const rel = path.relative(source, p).split(path.sep).join('/');
      const st = fs.statSync(p);
      const ext = path.extname(e.name).toLowerCase();
      const item = { path: rel, ext, bytes: st.size, modified: st.mtime.toISOString().slice(0, 10), kind: NOTE_EXT.has(ext) ? 'note' : 'attachment' };
      if (item.kind === 'note') Object.assign(item, describeNote(fs.readFileSync(p, 'utf8'), rel));
      items.push(item);
    }
  };
  walk(source);
  items.sort((a, b) => a.path.localeCompare(b.path));

  const flags = [];
  const byBase = new Map();
  for (const it of items.filter((i) => i.kind === 'note')) {
    const base = path.basename(it.path).replace(/\.[^.]+$/, '').toLowerCase();
    byBase.set(base, [...(byBase.get(base) ?? []), it.path]);
    if (it.words === 0) flags.push(`${it.path}: empty`);
  }
  for (const [base, paths] of byBase) if (paths.length > 1) flags.push(`same name "${base}" in ${paths.join(', ')} — [[${base}]] links are ambiguous`);
  const known = new Set([...byBase.keys()]);
  const attachments = new Set(items.filter((i) => i.kind === 'attachment').map((i) => path.basename(i.path).toLowerCase()));
  for (const it of items.filter((i) => i.kind === 'note')) {
    const dead = it.links.filter((l) => !known.has(path.basename(l).toLowerCase().replace(/\.md$/, '')));
    if (dead.length) flags.push(`${it.path}: links to missing ${dead.slice(0, 5).join(', ')}${dead.length > 5 ? ', …' : ''}`);
    const missing = it.embeds.filter((x) => !attachments.has(path.basename(x).toLowerCase()) && !known.has(path.basename(x).toLowerCase().replace(/\.md$/, '')));
    if (missing.length) flags.push(`${it.path}: embeds missing ${missing.slice(0, 5).join(', ')}`);
  }
  const notes = items.filter((i) => i.kind === 'note');
  return {
    source,
    counts: { notes: notes.length, attachments: items.length - notes.length, words: notes.reduce((s, n) => s + n.words, 0) },
    items,
    flags,
  };
}

export function table(inv) {
  const rows = ['| Source file | Words | Modified | Tags | Type | Destination | Reason |', '|---|---|---|---|---|---|---|'];
  for (const it of inv.items) {
    const tags = it.kind === 'note' ? it.tags.slice(0, 4).join(' ') : it.ext;
    rows.push(`| ${it.path} | ${it.kind === 'note' ? it.words : '—'} | ${it.modified} | ${tags} |  |  |  |`);
  }
  return rows.join('\n');
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
  const args = process.argv.slice(2);
  const src = args.find((a) => !a.startsWith('--'));
  if (!src || !fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    console.error('usage: inventory.mjs <source-folder> [--out <file.json>]  (the folder must exist)');
    process.exit(2);
  }
  const inv = inventory(path.resolve(src));
  const oi = args.indexOf('--out');
  if (oi >= 0 && args[oi + 1]) fs.writeFileSync(path.resolve(args[oi + 1]), `${JSON.stringify(inv, null, 2)}\n`);
  console.log(`# Inventory of ${inv.source}\n`);
  console.log(`${inv.counts.notes} note(s), ${inv.counts.attachments} attachment(s), ${inv.counts.words} words\n`);
  console.log(table(inv));
  if (inv.flags.length) console.log(`\n## Flags\n\n${inv.flags.map((f) => `- ${f}`).join('\n')}`);
}
