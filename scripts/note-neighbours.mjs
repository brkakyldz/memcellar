#!/usr/bin/env node
// note-neighbours.mjs — the neighbour step of the write gate (ADR 0055).
// Before a page is written, list the pages already on the same subject, so
// the writer decides ADD / MERGE / SUPERSEDE / NARROW / NOOP against them
// instead of opening a second page. Read-only, deterministic, stdlib only.
//
// A neighbour is found three ways, no embeddings (ADR 0057):
//   1. title similarity: the query's words against each page's filename,
//      first heading and aliases (token Jaccard, or containment when the
//      shorter side is fully inside the longer), with a bonus for shared tags;
//   2. links: with --slug, every page that links to [[slug]] and every page
//      that slug links to;
//   3. versions: a page whose name differs from another only by a -v2-style
//      or date suffix is flagged, because ADR 0055 calls that a smell.
// Scanned: notes/, reports/, outputs/ (top level, .md only). archive/ is
// history and is never a neighbour.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = `Usage: node scripts/note-neighbours.mjs "<subject words>" [--tags a,b] [--slug name] [--min 0.3] [--json]

Lists pages in notes/, reports/ and outputs/ that look like the same subject:
by title words, aliases and shared tags, and (with --slug) by wikilinks in
either direction. Prints score, path, type, status, last date and flags.
Read-only. Use the owner's-language words, and while older pages are in
another language run it once in that one too (ADR 0059). An owner page
(author:) is listed as read only. The vault is BRAIN_DIR if set, else the folder
above this script.
`;

const SCAN_DIRS = ['notes', 'reports', 'outputs'];
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'from', 'vs',
  've', 'ile', 'bir', 'bu', 'icin', 'de', 'da', 'mi', 'ne']);
// A trailing version or date: -v2, -v3, -2026-10, -2026-10-04, _2026-10-04.
const VERSION_RE = /([-_]v\d+|[-_]\d{4}-\d{2}(-\d{2})?)$/;

export function parseArgs(argv) {
  const opts = { query: '', tags: [], slug: null, min: 0.3, json: false };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--tags') opts.tags = (argv[++i] ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    else if (a === '--slug') opts.slug = argv[++i] ?? null;
    else if (a === '--min') opts.min = Number(argv[++i]);
    else if (a.startsWith('--')) throw new Error(`unknown argument ${a}`);
    else rest.push(a);
  }
  opts.query = rest.join(' ');
  if (!opts.help && !opts.query && !opts.slug && !opts.tags.length) throw new Error('give subject words, --tags or --slug');
  if (Number.isNaN(opts.min)) throw new Error('--min needs a number');
  return opts;
}

// Lowercase without the Turkish dotted-I trap ('İ'.toLowerCase() is 'i̇', i
// plus a combining dot, which then matches nothing), then fold the Turkish
// letters to ASCII on both sides, so "kisa sehir gezisi" typed on an English
// keyboard still meets an alias written "kısa şehir gezisi".
const FOLD = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
function lower(s) {
  return s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase().replace(/[çğıöşü]/g, (c) => FOLD[c]);
}

export function tokens(s) {
  return lower(s)
    .replace(/\.md$/, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t) && !/^v\d+$/.test(t));
}

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fields = {};
  if (!m) return fields;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

function listField(value) {
  if (!value) return [];
  return value.replace(/^\[|\]$/g, '').split(',').map((v) => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

function similarity(a, b) {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let shared = 0;
  for (const t of A) if (B.has(t)) shared += 1;
  const jaccard = shared / (A.size + B.size - shared);
  const containment = shared / Math.min(A.size, B.size);
  // Containment only counts when the shorter side has two or more words,
  // so a one-word query does not match every page that uses the word.
  return Math.max(jaccard, Math.min(A.size, B.size) >= 2 ? containment * 0.9 : 0);
}

export function loadPages(root) {
  const pages = [];
  for (const dir of SCAN_DIRS) {
    const abs = path.join(root, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (!name.endsWith('.md') || name === 'README.md') continue;
      const rel = `${dir}/${name}`;
      let text = '';
      try { text = readFileSync(path.join(abs, name), 'utf8'); } catch { continue; }
      const fm = frontmatter(text);
      const heading = (text.match(/^#\s+(.+)$/m) || [])[1] || '';
      const slug = name.replace(/\.md$/, '');
      const links = new Set();
      // `[[x\|y]]` is the escaped-pipe form inside Markdown tables; the
      // backslash belongs to the table, not to the target.
      for (const m of text.matchAll(/\[\[([^\]|#]+)/g)) links.add(m[1].trim().replace(/\\$/, ''));
      pages.push({
        rel, slug, fm, links,
        nameTokens: tokens(slug.replace(/^\d{4}-\d{2}-\d{2}_/, '')),
        headTokens: tokens(heading),
        aliasTokens: listField(fm.aliases).map(tokens),
        tags: listField(fm.tags).map((t) => t.toLowerCase()),
      });
    }
  }
  return pages;
}

export function neighbours(pages, opts) {
  const q = tokens(opts.query || '');
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const target = opts.slug ? bySlug.get(opts.slug) : null;
  const out = [];
  for (const p of pages) {
    if (opts.slug && p.slug === opts.slug) continue;
    const reasons = [];
    let score = 0;
    if (q.length) {
      const title = Math.max(similarity(q, p.nameTokens), similarity(q, p.headTokens));
      const alias = Math.max(0, ...p.aliasTokens.map((a) => similarity(q, a)));
      const best = Math.max(title, alias);
      if (best > 0) { score += 0.75 * best; reasons.push(alias > title ? 'alias' : 'title'); }
    }
    const sharedTags = opts.tags.filter((t) => p.tags.includes(t)).length;
    if (sharedTags) { score += Math.min(0.15, 0.05 * sharedTags); reasons.push(`${sharedTags} tag`); }
    if (opts.slug) {
      if (p.links.has(opts.slug)) { score += 0.3; reasons.push('links here'); }
      if (target?.links.has(p.slug)) { score += 0.3; reasons.push('linked from it'); }
    }
    if (score >= opts.min) out.push({ ...p, score: Math.min(1, score), reasons });
  }
  // Version flag: two pages of the living layer whose names differ only by a
  // version or date suffix, where at least one of them is in the result.
  // Reports are left out on both sides: a topic page and its dated reports
  // sharing a slug is the normal ADR 0055 shape, not a second version.
  const stems = new Map();
  for (const p of pages) {
    if (p.fm.type === 'report' || p.rel.startsWith('reports/')) continue;
    const stem = p.slug.replace(/^\d{4}-\d{2}-\d{2}_/, '').replace(VERSION_RE, '');
    if (!stems.has(stem)) stems.set(stem, []);
    stems.get(stem).push(p.slug);
  }
  for (const r of out) {
    if (r.fm.type === 'report' || r.rel.startsWith('reports/')) continue;
    const stem = r.slug.replace(/^\d{4}-\d{2}-\d{2}_/, '').replace(VERSION_RE, '');
    const siblings = (stems.get(stem) ?? []).filter((s) => s !== r.slug);
    if (siblings.length) r.flags = [`version of ${siblings.join(', ')}`];
  }
  if (opts.slug && !target) out.warning = `--slug ${opts.slug} names no page in notes/, reports/ or outputs/`;
  const sorted = out.sort((a, b) => b.score - a.score || a.rel.localeCompare(b.rel)).slice(0, 15);
  if (out.warning) sorted.warning = out.warning;
  return sorted;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (opts.help) { process.stdout.write(USAGE); return; }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = process.env.BRAIN_DIR?.trim() || path.resolve(here, '..');
  const found = neighbours(loadPages(root), opts);
  if (found.warning) process.stderr.write(`warning: ${found.warning}\n`);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(found.map((r) => ({ path: r.rel, score: Number(r.score.toFixed(2)), type: r.fm.type ?? '', status: r.fm.status ?? '', updated: r.fm.updated || r.fm.created || '', reasons: r.reasons, flags: r.flags ?? [] })), null, 2)}\n`);
    return;
  }
  if (!found.length) {
    console.log('No neighbours above the threshold. A new page is fine if the subject is new; say so in the commit.');
    return;
  }
  console.log('| score | page | type | status | date | why | flags |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of found) {
    console.log(`| ${r.score.toFixed(2)} | ${r.rel} | ${r.fm.author ? 'owner page — read only' : (r.fm.type ?? '')} | ${r.fm.status ?? ''} | ${r.fm.updated || r.fm.created || ''} | ${r.reasons.join(', ')} | ${(r.flags ?? []).join('; ')} |`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
