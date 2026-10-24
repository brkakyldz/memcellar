#!/usr/bin/env node
// retrieval-eval.mjs — ranked lexical lookup plus recall@k over the frozen
// `.claude/eval/golden-set.md`.
//
// The vault's most consequential frozen decision is "lexical search only"
// (ADR 0018). This script is what makes that decision falsifiable instead of
// ideological: a fixed set of `query → expected note` pairs, reported as
// recall@1/@3/@5. A drop is evidence; an argument is not.
//
// **What it does not measure.** Not memory quality, and not whether a session
// answered anything correctly — only whether a simulated lexical ranker puts
// the expected file near the top. Two consequences worth knowing before
// reading any number it prints:
//
//   - Recall falls as the vault grows even when nothing degrades: more notes
//     means more files matching the same terms. In the reference instance the
//     corpus went from 14 documents to 33 in twelve days and recall@3 moved
//     79% -> 73%. That is competition, not rot.
//   - A miss is fixed with an `aliases:` line or a clearer title — but never
//     before the query has been scored. Tuning the vault to a query you have
//     already read is how a benchmark stops measuring anything.
//
// The ranker deliberately mimics what the `/recall` skill actually does —
// case-folded substring matching of query terms over `notes/` and `core/`,
// scored by how many distinct terms a file matches. Anything cleverer would
// measure a retrieval path the agent doesn't use. `/recall` calls this
// script's `--query` mode, so the default ranker — `fielded` since 2026-10-06
// (IDF, x4 for filename/title/aliases/tags hits) — is the path it uses.
//
// **Experimental rankers and the gate.** `expand` is the one candidate that
// passed the gate (used by `/recall`); it is not the default. `--compare
// <baseline>,<candidate>` scores two rankers query by query and runs an exact
// two-sided sign test on the disagreements, so a change is adopted only when it
// beats the default by more than noise (verdict line: "passes the gate" or
// "does not pass"). The optional `--set real` / `--set both` scores the
// held-out `.claude/eval/real-prompts.md` as well. None of this touches the
// default run: with no flags the output is the fielded table `brain-doctor`
// parses.
//
// Node stdlib only. Never throws: a missing golden set or empty vault prints
// an empty report and exits 0.

import { readdirSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getRepoRoot() {
  const fromBrainDir = process.env.BRAIN_DIR;
  if (fromBrainDir && fromBrainDir.trim() !== '') return fromBrainDir;
  return path.resolve(__dirname, '..');
}

const REPO_ROOT = getRepoRoot();
const SEARCH_DIRS = ['notes', 'core'];
const KS = [1, 3, 5];

const HELP = [
  'Usage: node scripts/retrieval-eval.mjs [--verbose] [--ranker NAME|compare] [--set golden|real|both] [--help]',
  '       node scripts/retrieval-eval.mjs --compare BASELINE,CANDIDATE [--set golden|real|both] [--verbose]',
  '       node scripts/retrieval-eval.mjs --query "terms" [--limit N] [--ranker NAME] [--variant "text"]...',
  '',
  'Re-runs the query → note pairs in .claude/eval/golden-set.md against',
  'notes/ and core/, and prints recall@1/@3/@5 plus every miss.',
  '',
  '--verbose  also print the top hits for each query, not just misses.',
  '--ranker   legacy preserves the oldest scorer; frequency-free uses',
  '           unique normalized token overlap; fielded (the default) weights',
  '           each matched token by IDF, x4 when it is in the filename, # title,',
  '           aliases or tags; compare prints legacy, frequency-free and fielded',
  '           and the promotion gate (fielded against frequency-free).',
  '           Experimental: expand (RRF of fielded over the query and its',
  '           variants from .claude/eval/expansions.md, or --variant in query',
  '           mode).',
  '--compare  BASELINE,CANDIDATE: per-query paired comparison with an exact',
  '           two-sided sign test at @1/@3/@5 and a gate verdict (candidate',
  '           must win more than it loses at @3 with p < 0.05, and lose no',
  '           more than it wins at @1).',
  '--set      golden (default) scores golden-set.md; real scores the held-out',
  '           .claude/eval/real-prompts.md (rows whose expected is — are',
  '           abstain rows and are counted, not scored); both scores the union.',
  '--query    return ranked notes/core candidates instead of running the',
  '           frozen evaluation. The default ranker is fielded.',
  '',
  'Run by hand or from /audit; nothing schedules it. Exits 0 always — a',
  'failing row is a finding to read, not a build to break. A missing or empty',
  'golden set, real-prompt set or expansions file prints an empty report.',
].join('\n');

const BASE_RANKERS = ['legacy', 'frequency-free', 'fielded'];
const EXPERIMENTAL_RANKERS = ['expand'];
const RANKERS = [...BASE_RANKERS, ...EXPERIMENTAL_RANKERS];
const SETS = ['golden', 'real', 'both'];
// Promoted 2026-10-06 in the reference instance, after passing the compare
// gate against frequency-free on its 63-row golden set.
const DEFAULT_RANKER = 'fielded';

function readFileSafe(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

// `--name=value` wins over `--name value`; null when the flag is absent and
// undefined when it is the last argument and has no value.
function argValue(argv, name) {
  const withEquals = argv.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) return withEquals.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index !== -1 ? argv[index + 1] : null;
}

function argValues(argv, name) {
  const values = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith(`${name}=`)) values.push(argv[i].slice(name.length + 1));
    else if (argv[i] === name && argv[i + 1] !== undefined) values.push(argv[++i]);
  }
  return values;
}

// --- The golden set -------------------------------------------------------
// Table rows only: `| id | query | expected |`. The header, the separator and
// all the prose around them are skipped, so the file stays readable.

function loadGoldenSet() {
  const file = path.join(REPO_ROOT, '.claude', 'eval', 'golden-set.md');
  const text = readFileSafe(file);
  if (text === null) return { file, rows: [] };
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    const [id, query, expected] = cells;
    if (!/^G-\d+$/.test(id)) continue; // header + separator fall out here
    if (query === '' || expected === '') continue;
    rows.push({ id, query, expected: expected.replace(/\\/g, '/') });
  }
  return { file, rows };
}

function tableCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  return trimmed.split('|').slice(1, -1).map((c) => c.trim());
}

// The held-out set: `| R-NN | query | expected | flag |`. `expected` is a
// repo-relative note path, or `—` when the prompt needed no memory at all.
// Those abstain rows are counted and listed but never scored.
export function parseRealPrompts(text) {
  const rows = [];
  const abstain = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const cells = tableCells(line);
    if (!cells || cells.length < 3) continue;
    const [id, query, rawExpected, flag = ''] = cells;
    if (!/^R-\d+$/.test(id) || query === '') continue; // header + separator fall out here
    const expected = rawExpected.replace(/^`+|`+$/g, '').trim();
    if (expected === '' || /^[—–-]$/.test(expected)) {
      abstain.push({ id, query, flag });
      continue;
    }
    rows.push({ id, query, expected: expected.replace(/\\/g, '/'), flag });
  }
  return { rows, abstain };
}

function loadRealPrompts() {
  const file = path.join(REPO_ROOT, '.claude', 'eval', 'real-prompts.md');
  const text = readFileSafe(file);
  if (text === null) return { file, exists: false, rows: [], abstain: [] };
  return { file, exists: true, ...parseRealPrompts(text) };
}

// The query-expansion table for the `expand` ranker: `| id | variants |`,
// variants being keyword strings separated by ` ; `. Ids are G-NN or R-NN.
export function parseExpansions(text) {
  const expansions = new Map();
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const cells = tableCells(line);
    if (!cells || cells.length < 2) continue;
    const [id, rawVariants] = cells;
    if (!/^[A-Za-z]+-\d+$/.test(id)) continue; // header + separator fall out here
    const variants = rawVariants.split(/\s*;\s*/).map((v) => v.trim()).filter((v) => v !== '');
    if (variants.length > 0) expansions.set(id, variants);
  }
  return expansions;
}

function loadExpansions() {
  const file = path.join(REPO_ROOT, '.claude', 'eval', 'expansions.md');
  const text = readFileSafe(file);
  if (text === null) return { file, exists: false, map: new Map() };
  return { file, exists: true, map: parseExpansions(text) };
}

// --- The corpus -----------------------------------------------------------

function listMarkdown(dir) {
  const abs = path.join(REPO_ROOT, dir);
  if (!existsSync(abs)) return [];
  let entries;
  try {
    entries = readdirSync(abs, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => `${dir}/${e.name}`);
}

// Case- and accent-folding. The Turkish locale plus the dotless-i fold makes
// I/İ/ı/i all compare equal — harmless for English, and it is what an
// agglutinative, dotted-i language needs; the NFKD strip then removes every
// other diacritic. If your queries are in another language with its own case
// rules, this is the one function to adapt.
function normalizeText(text) {
  return String(text)
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '');
}

// The fields a person scans first: the filename, the `# title`, and the
// `aliases:` / `tags:` frontmatter lines. A query term found here says far more
// about what the note is *about* than the same term buried in its body.
function fieldText(rel, text) {
  const parts = [path.basename(rel, '.md')];
  const lines = text.split(/\r?\n/);
  let inFrontmatter = lines[0] === '---';
  for (let i = inFrontmatter ? 1 : 0; i < lines.length; i++) {
    const line = lines[i];
    if (inFrontmatter) {
      if (line === '---') { inFrontmatter = false; continue; }
      if (/^(aliases|tags):/.test(line)) parts.push(line.replace(/^(aliases|tags):/, ''));
      continue;
    }
    if (line.startsWith('# ')) { parts.push(line.slice(2)); break; }
  }
  return parts.join(' ');
}

function loadCorpus() {
  const docs = [];
  for (const dir of SEARCH_DIRS) {
    for (const rel of listMarkdown(dir)) {
      const text = readFileSafe(path.join(REPO_ROOT, rel));
      if (text === null) continue;
      // The filename is part of what grep-with-your-eyes matches on, and
      // wikilinks are filenames — so it counts as searchable text.
      const source = `${rel}\n${text}`;
      docs.push({
        rel,
        text,
        haystack: source.toLowerCase(),
        normalizedTokens: new Set(normalizeText(source).match(/[a-z0-9]+/g) || []),
        fieldTokens: new Set(normalizeText(fieldText(rel, text)).match(/[a-z0-9]+/g) || []),
      });
    }
  }
  return docs;
}

// --- Ranking --------------------------------------------------------------

// Short function words carry no retrieval signal in either language and would
// otherwise let every long note match every query.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'were', 'how', 'what', 'why', 'who', 'does',
  'did', 'do', 'is', 'in', 'on', 'of', 'to', 'a', 'an', 'it', 'its', 'that',
  'this', 'with', 'from', 'i', 'we', 'my', 'our', 'you', 'your', 'still', 'get',
  've', 'ile', 'için', 'icin', 'ne', 'mi', 'mı', 'nasıl', 'nasil', 'bir', 'bu',
]);

function legacyTerms(query) {
  return [...new Set(
    query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
  )];
}

const NORMALIZED_STOPWORDS = new Set(
  [...STOPWORDS].flatMap((word) => normalizeText(word).match(/[a-z0-9]+/g) || [])
);

function normalizedTerms(query) {
  return [...new Set(normalizeText(query).match(/[a-z0-9]+/g) || [])]
    .filter((term) => term.length >= 3 && !NORMALIZED_STOPWORDS.has(term));
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

const idfCache = new WeakMap();

function idfFor(docs) {
  if (idfCache.has(docs)) return idfCache.get(docs);
  const df = new Map();
  for (const doc of docs) {
    for (const token of doc.normalizedTokens) df.set(token, (df.get(token) || 0) + 1);
  }
  const idf = (term) => Math.log(1 + docs.length / (df.get(term) || 1));
  idfCache.set(docs, idf);
  return idf;
}

const FIELD_WEIGHT = 4;

const SCORED_ORDER = (a, b) => b.score - a.score || b.distinct - a.distinct || a.rel.localeCompare(b.rel);

// The `fielded` scorer over already-normalized query terms and any docs that
// carry `normalizedTokens` / `fieldTokens` — `expand` reuses it per query variant.
function rankFielded(ts, docs) {
  const idf = idfFor(docs);
  const scored = [];
  for (const doc of docs) {
    let distinct = 0;
    let score = 0;
    for (const term of ts) {
      if (!doc.normalizedTokens.has(term)) continue;
      distinct += 1;
      score += idf(term) * (doc.fieldTokens.has(term) ? FIELD_WEIGHT : 1);
    }
    if (distinct > 0) scored.push({ rel: doc.rel, distinct, total: Math.round(score * 10) / 10, score });
  }
  scored.sort(SCORED_ORDER);
  return scored;
}

// --- expand ---------------------------------------------------------------
// `fielded` on the original query and on each English variant, fused by
// reciprocal rank fusion. Variants come from expansions.md (eval rows) or
// repeated --variant arguments (query mode); none means plain `fielded`.

const RRF_K = 60;

function rankExpand(query, docs, variants = []) {
  const original = rankFielded(normalizedTerms(query), docs);
  if (variants.length === 0) return original;
  const lists = [original, ...variants.map((variant) => rankFielded(normalizedTerms(variant), docs))];
  const fused = new Map();
  for (const list of lists) {
    for (const [index, result] of list.entries()) {
      const entry = fused.get(result.rel) || { rel: result.rel, distinct: result.distinct, score: 0 };
      entry.score += 1 / (RRF_K + index + 1);
      fused.set(result.rel, entry);
    }
  }
  return [...fused.values()]
    .map((entry) => ({ ...entry, total: Math.round(entry.score * 1000) / 1000 }))
    .sort(SCORED_ORDER);
}

function rank(query, docs, ranker = 'legacy', options = {}) {
  // Removed arms: bm25, alias-addonly and prefix5 were tried in the reference
  // instance on 2026-10-21 and failed the gate, so they are not shipped.
  if (ranker === 'fielded') return rankFielded(normalizedTerms(query), docs);
  if (ranker === 'expand') return rankExpand(query, docs, options.variants || []);

  if (ranker === 'frequency-free') {
    const ts = normalizedTerms(query);
    const scored = [];
    for (const doc of docs) {
      const distinct = ts.reduce(
        (count, term) => count + (doc.normalizedTokens.has(term) ? 1 : 0),
        0
      );
      if (distinct > 0) scored.push({ rel: doc.rel, distinct, total: distinct });
    }
    scored.sort((a, b) => b.distinct - a.distinct || a.rel.localeCompare(b.rel));
    return scored;
  }

  const ts = legacyTerms(query);
  const scored = [];
  for (const doc of docs) {
    let distinct = 0;
    let total = 0;
    for (const t of ts) {
      const c = countOccurrences(doc.haystack, t);
      if (c > 0) {
        distinct += 1;
        total += c;
      }
    }
    if (distinct === 0) continue;
    scored.push({ rel: doc.rel, distinct, total });
  }
  // Distinct terms first (breadth beats repetition — a note that mentions
  // every term once is a better answer than one that repeats a single term),
  // then raw frequency, then path for a stable, reproducible order.
  scored.sort(
    (a, b) => b.distinct - a.distinct || b.total - a.total || a.rel.localeCompare(b.rel)
  );
  return scored;
}

function evaluate(rows, docs, ranker, expansions = null) {
  const hitsAt = new Map(KS.map((k) => [k, 0]));
  const misses = [];
  const details = [];
  const positions = new Map();

  for (const row of rows) {
    const ranked = rank(row.query, docs, ranker, { variants: expansions?.get(row.id) || [] });
    const position = ranked.findIndex((result) => result.rel === row.expected);
    positions.set(row.id, position);
    for (const k of KS) {
      if (position !== -1 && position < k) hitsAt.set(k, hitsAt.get(k) + 1);
    }
    const top = ranked.slice(0, 3).map((result) => `${result.rel}(${result.distinct}/${result.total})`).join(', ');
    if (position === -1 || position >= Math.max(...KS)) {
      misses.push({ ...row, position, top: top || '—' });
    }
    details.push(
      `- ${row.id} — \`${row.query}\` → ${row.expected} @ ${position === -1 ? 'miss' : position + 1}${
        top ? ` · top: ${top}` : ''
      }`
    );
  }

  return { ranker, hitsAt, misses, details, positions };
}

function scoreCell(result, k, total) {
  const hits = result.hitsAt.get(k);
  return `${Math.round((hits / total) * 100)}% (${hits}/${total})`;
}

// --- Paired comparison ----------------------------------------------------

// Exact two-sided sign test: p = min(1, 2 x P(X <= min(w, l))) for
// X ~ Binomial(n = w + l, 1/2). Ties are dropped before this is called. BigInt
// keeps C(n, i) exact for any n a golden set can reach.
export function signTestP(wins, losses) {
  const n = wins + losses;
  if (n === 0) return 1;
  const smaller = Math.min(wins, losses);
  let choose = 1n;
  let tail = 0n;
  for (let i = 0; i <= smaller; i++) {
    tail += choose;
    choose = (choose * BigInt(n - i)) / BigInt(i + 1);
  }
  const SCALE = 10n ** 15n;
  const p = Number((2n * tail * SCALE) / (1n << BigInt(n))) / 1e15;
  return Math.min(1, p);
}

function hitsAtK(position, k) {
  return position !== -1 && position < k;
}

// Per k: how many rows each ranker hits, and the discordant rows. A "win" is a
// row the candidate hits and the baseline misses; a "loss" is the reverse.
export function comparePaired(rows, baselinePositions, candidatePositions, ks = KS) {
  return ks.map((k) => {
    let baselineHits = 0;
    let candidateHits = 0;
    const winIds = [];
    const lossIds = [];
    for (const row of rows) {
      const base = hitsAtK(baselinePositions.get(row.id), k);
      const cand = hitsAtK(candidatePositions.get(row.id), k);
      if (base) baselineHits += 1;
      if (cand) candidateHits += 1;
      if (cand && !base) winIds.push(row.id);
      if (base && !cand) lossIds.push(row.id);
    }
    return {
      k,
      total: rows.length,
      baselineHits,
      candidateHits,
      wins: winIds.length,
      losses: lossIds.length,
      winIds,
      lossIds,
      p: signTestP(winIds.length, lossIds.length),
    };
  });
}

function formatP(p) {
  return p < 0.001 ? '<0.001' : p.toFixed(3);
}

// The adoption gate: at @3 the candidate must win more than it loses with
// p < 0.05, and at @1 it must not lose more than it wins.
export function gateVerdict(stats) {
  const at1 = stats.find((s) => s.k === 1);
  const at3 = stats.find((s) => s.k === 3);
  const reasons = [];
  if (!at3 || !(at3.wins > at3.losses)) {
    reasons.push(`at @3 wins do not exceed losses (${at3 ? `${at3.wins}:${at3.losses}` : 'no data'})`);
  } else if (!(at3.p < 0.05)) {
    reasons.push(`at @3 wins ${at3.wins} vs losses ${at3.losses} is within noise (p = ${formatP(at3.p)}, needs < 0.05)`);
  }
  if (!at1 || at1.losses > at1.wins) {
    reasons.push(`at @1 losses exceed wins (${at1 ? `${at1.wins}:${at1.losses}` : 'no data'})`);
  }
  return { pass: reasons.length === 0, reasons };
}

function positionLabel(position) {
  return position === -1 || position === undefined ? 'miss' : String(position + 1);
}

function pairedComparisonLines(baseline, candidate, stats) {
  const lines = [];
  lines.push(`## Paired comparison — \`${baseline.ranker}\` (baseline) vs \`${candidate.ranker}\` (candidate)`, '');
  lines.push('| k | baseline % | candidate % | wins | losses | p |');
  lines.push('|---|---|---|---|---|---|');
  for (const s of stats) {
    const cell = (hits) => `${Math.round((hits / s.total) * 100)}% (${hits}/${s.total})`;
    lines.push(`| @${s.k} | ${cell(s.baselineHits)} | ${cell(s.candidateHits)} | ${s.wins} | ${s.losses} | ${formatP(s.p)} |`);
  }
  lines.push('');
  lines.push(
    'Wins: candidate hits and baseline misses. Losses: the reverse. Ties are dropped; p is an exact two-sided sign test.',
    ''
  );
  const verdict = gateVerdict(stats);
  lines.push(
    verdict.pass
      ? 'Verdict: **passes the gate** — wins exceed losses at @3 with p < 0.05 and @1 does not lose more than it wins.'
      : `Verdict: **does not pass the gate** — ${verdict.reasons.join('; ')}.`,
    ''
  );
  for (const k of [1, 3]) {
    const s = stats.find((entry) => entry.k === k);
    const described = s.lossIds.map(
      (id) => `${id} (${positionLabel(baseline.positions.get(id))} → ${positionLabel(candidate.positions.get(id))})`
    );
    lines.push(`Losses at @${k} (baseline hit, candidate miss): ${described.length > 0 ? described.join(', ') : 'none'}`);
  }
  lines.push('');
  return lines;
}

function changedRankLines(rows, before, after) {
  const lines = ['## Changed ranks', ''];
  for (const row of rows) {
    const was = before.positions.get(row.id);
    const now = after.positions.get(row.id);
    if (was === now) continue;
    lines.push(`- ${row.id}: ${was === -1 ? 'miss' : was + 1} → ${now === -1 ? 'miss' : now + 1}`);
  }
  lines.push('');
  return lines;
}

// --- Run ------------------------------------------------------------------

function main() {
  const argv = process.argv;

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  const VERBOSE = argv.includes('--verbose');
  const queryValue = argValue(argv, '--query');
  const QUERY = queryValue === null ? null : (queryValue ?? '');
  const limitValue = argValue(argv, '--limit');
  const LIMIT = Number.parseInt(limitValue === null ? '10' : limitValue, 10);
  const rankerValue = argValue(argv, '--ranker');
  const RANKER = rankerValue === null ? DEFAULT_RANKER : rankerValue;
  const compareValue = argValue(argv, '--compare');
  const setValue = argValue(argv, '--set');
  const SET = setValue === null ? 'golden' : setValue;
  const VARIANTS = argValues(argv, '--variant');

  if (![...RANKERS, 'compare'].includes(RANKER)) {
    console.error(`Unknown ranker: ${RANKER}`);
    process.exit(2);
  }
  if (!SETS.includes(SET)) {
    console.error(`Unknown set: ${SET}. Use golden, real or both.`);
    process.exit(2);
  }
  let COMPARE = null;
  if (compareValue !== null) {
    COMPARE = String(compareValue ?? '').split(',').map((name) => name.trim());
    if (COMPARE.length !== 2 || !COMPARE.every((name) => RANKERS.includes(name))) {
      console.error(`--compare takes two ranker names, BASELINE,CANDIDATE, from: ${RANKERS.join(', ')}.`);
      process.exit(2);
    }
  }
  if (QUERY !== null && (QUERY.trim() === '' || !Number.isInteger(LIMIT) || LIMIT < 1 || LIMIT > 100)) {
    console.error('Query must be non-empty and limit must be an integer from 1 to 100.');
    process.exit(2);
  }
  if (QUERY !== null && RANKER === 'compare') {
    console.error('Query mode accepts one ranker (legacy, frequency-free, fielded or expand), not compare.');
    process.exit(2);
  }
  if (QUERY !== null && COMPARE !== null) {
    console.error('Query mode does not accept --compare.');
    process.exit(2);
  }
  if (VARIANTS.length > 0 && !(QUERY !== null && RANKER === 'expand')) {
    console.error('--variant only applies to --query with --ranker expand.');
    process.exit(2);
  }

  const golden = loadGoldenSet();
  const goldenFile = golden.file;
  const docs = loadCorpus();
  const out = ['# Retrieval eval', ''];

  if (QUERY !== null) {
    const ranked = rank(QUERY, docs, RANKER, { variants: VARIANTS }).slice(0, LIMIT);
    const variantLine = RANKER === 'expand' && VARIANTS.length > 0
      ? `  \nVariants: ${VARIANTS.map((variant) => `\`${variant}\``).join(', ')}`
      : '';
    console.log(`# Retrieval search\n\nQuery: \`${QUERY}\`  \nRanker: \`${RANKER}\`${variantLine}\n`);
    if (ranked.length === 0) {
      console.log('No matching documents.');
    } else {
      for (const [index, result] of ranked.entries()) {
        console.log(`${index + 1}. \`${result.rel}\` — ${result.distinct} distinct query token(s)`);
      }
    }
    process.exit(0);
  }

  // Which rows get scored. The golden set is the default; the held-out real
  // prompts add `real` / `both`. Abstain rows (expected `—`) are never scored.
  let rows = golden.rows;
  const setNotes = [];
  if (SET !== 'golden') {
    const real = loadRealPrompts();
    rows = SET === 'real' ? real.rows : [...golden.rows, ...real.rows];
    const realPath = path.relative(REPO_ROOT, real.file).replace(/\\/g, '/');
    if (!real.exists) {
      setNotes.push(`\`${realPath}\` not found — the real set is empty, nothing is scored from it.`, '');
    } else {
      const scored = SET === 'real'
        ? `${real.rows.length} scored`
        : `${golden.rows.length} golden + ${real.rows.length} real scored`;
      setNotes.push(`Set \`${SET}\`: ${scored}; ${real.abstain.length} abstain rows (not scored).`, '');
    }
  }

  const involved = COMPARE !== null ? COMPARE : [RANKER];
  const expansions = involved.includes('expand') ? loadExpansions() : null;
  const expansionNotes = [];
  if (expansions) {
    const expansionPath = path.relative(REPO_ROOT, expansions.file).replace(/\\/g, '/');
    if (!expansions.exists) {
      expansionNotes.push(`\`${expansionPath}\` not found — \`expand\` falls back to \`fielded\` for every query.`, '');
    } else {
      const covered = rows.filter((row) => expansions.map.has(row.id)).length;
      expansionNotes.push(`Expansions: \`${expansionPath}\` has variants for ${covered} of ${rows.length} scored rows.`, '');
    }
  }

  if (rows.length === 0) {
    if (SET === 'golden') {
      out.push(`No golden-set rows found in \`${path.relative(REPO_ROOT, goldenFile).replace(/\\/g, '/')}\`.`, '');
    } else {
      out.push(...setNotes, 'No scored rows in the selected set.', '');
    }
  } else if (docs.length === 0) {
    out.push('No searchable documents under `notes/` or `core/`.', '');
  } else {
    out.push(`${rows.length} queries over ${docs.length} documents (\`notes/\` + \`core/\`).`, '');
    out.push(...setNotes, ...expansionNotes);

    if (COMPARE !== null) {
      const [baselineName, candidateName] = COMPARE;
      const baseline = evaluate(rows, docs, baselineName, expansions?.map);
      const candidate = evaluate(rows, docs, candidateName, expansions?.map);
      out.push(...pairedComparisonLines(baseline, candidate, comparePaired(rows, baseline.positions, candidate.positions)));
      if (VERBOSE) out.push(...changedRankLines(rows, baseline, candidate));
    } else {
      const selectedRanker = RANKER === 'compare' ? 'frequency-free' : RANKER;
      const selected = evaluate(rows, docs, selectedRanker, expansions?.map);

      if (RANKER === 'compare') {
        const legacy = evaluate(rows, docs, 'legacy');
        const candidate = evaluate(rows, docs, 'fielded');
        const header = ['ranker', ...KS.map((k) => `recall@${k}`)];
        out.push('## Ranker comparison', '');
        out.push(`| ${header.join(' | ')} |`);
        out.push(`|${header.map(() => '---').join('|')}|`);
        for (const result of [legacy, selected, candidate]) {
          out.push(`| ${[result.ranker, ...KS.map((k) => scoreCell(result, k, rows.length))].join(' | ')} |`);
        }
        out.push('');
        const notWorse = KS.every((k) => candidate.hitsAt.get(k) >= selected.hitsAt.get(k));
        const better = KS.some((k) => candidate.hitsAt.get(k) > selected.hitsAt.get(k));
        out.push(
          `Promotion gate: **${notWorse && better ? 'PASS' : 'FAIL'}** — candidate must be non-negative at every k and improve at least one.`,
          ''
        );
        if (VERBOSE) out.push(...changedRankLines(rows, selected, candidate));
      } else {
        const header = KS.map((k) => `recall@${k}`);
        out.push(`Ranker: \`${selectedRanker}\`.`, '');
        out.push(`| ${header.join(' | ')} |`);
        out.push(`|${header.map(() => '---').join('|')}|`);
        out.push(`| ${KS.map((k) => scoreCell(selected, k, rows.length)).join(' | ')} |`, '');
      }

      out.push('## Misses', '');
      if (selected.misses.length === 0) {
        out.push('none', '');
      } else {
        for (const m of selected.misses) {
          out.push(
            `- **${m.id}** \`${m.query}\` — expected \`${m.expected}\`, ` +
              `${m.position === -1 ? 'not matched at all' : `ranked ${m.position + 1}`}. Top: ${m.top}`
          );
        }
        out.push(
          '',
          'A miss is a finding, not a failure: fix it with an `aliases:` entry or a',
          'clearer note title — after scoring, never before — and log a',
          '`retrieval-failure` line with the `cause:` that applies (`/recall`). A',
          'cluster of `paraphrase-miss` causes is the only evidence that reopens',
          'ADR 0018.',
          '',
          'These numbers rank files with a simulated lexical scorer. They say nothing',
          'about whether a session answered a question correctly, and they drift down',
          'as the corpus grows, because more notes match the same terms.',
          ''
        );
      }

      if (VERBOSE) {
        out.push(`## All queries — ${selected.ranker}`, '', ...selected.details, '');
      }
    }
  }

  out.push('Generated by scripts/retrieval-eval.mjs — deterministic, no LLM.');
  console.log(out.join('\n'));
}

// Run only as a script. Importing this file (the tests do) exposes the pure
// helpers without evaluating anything. The check fails loudly rather than
// silently: if it ever misjudged, brain-doctor's "Retrieval eval" row would go
// FAIL for want of a score table.
function isEntryPoint() {
  try {
    const normalize = (p) => {
      const real = realpathSync(p);
      return process.platform === 'win32' ? real.toLowerCase() : real;
    };
    return Boolean(process.argv[1]) && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) main();
