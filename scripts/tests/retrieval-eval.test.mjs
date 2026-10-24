// Tests for scripts/retrieval-eval.mjs: the paired sign test, the table
// parsers, and — through the CLI against a throwaway vault — the `expand`
// ranker, the held-out set and the gate verdict. The default
// output contract (brain-doctor parses its one three-cell percentage row) is
// pinned here too, so a ranker experiment cannot break it unnoticed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  comparePaired,
  gateVerdict,
  parseExpansions,
  parseRealPrompts,
  signTestP,
} from '../retrieval-eval.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'retrieval-eval.mjs');

function put(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function note(vault, name, { aliases, tags, title, body = '' } = {}) {
  const front = ['---', 'type: knowledge'];
  if (aliases) front.push(`aliases: [${aliases}]`);
  if (tags) front.push(`tags: [${tags}]`);
  front.push('---');
  put(path.join(vault, 'notes', `${name}.md`), `${front.join('\n')}\n# ${title || name}\n\n${body}\n`);
}

function table(header, rows) {
  return [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function makeVault(t) {
  const vault = mkdtempSync(path.join(os.tmpdir(), 'retrieval-eval-'));
  t.after(() => rmSync(vault, { recursive: true, force: true }));
  mkdirSync(path.join(vault, 'notes'), { recursive: true });
  mkdirSync(path.join(vault, '.claude', 'eval'), { recursive: true });
  return vault;
}

function writeEval(vault, name, text) {
  put(path.join(vault, '.claude', 'eval', name), text);
}

function run(vault, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, BRAIN_DIR: vault },
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}

function ranking(stdout) {
  return [...stdout.matchAll(/^\d+\. `([^`]+)`/gm)].map((m) => m[1]);
}

// --- sign test --------------------------------------------------------------

test('signTestP reproduces the textbook two-sided sign test values', () => {
  assert.equal(signTestP(6, 0).toFixed(3), '0.031'); // 2 / 2^6
  assert.ok(Math.abs(signTestP(6, 0) - 0.03125) < 1e-12);
  assert.equal(signTestP(8, 1).toFixed(3), '0.039'); // 2 * (1 + 9) / 2^9
  assert.ok(Math.abs(signTestP(8, 1) - 0.0390625) < 1e-12);
  assert.ok(Math.abs(signTestP(5, 0) - 0.0625) < 1e-12);
});

test('signTestP: the smallest significant splits are significant, the next ones are not', () => {
  for (const [w, l] of [[6, 0], [8, 1], [10, 2], [12, 3], [15, 5]]) {
    assert.ok(signTestP(w, l) < 0.05, `${w}:${l} should be significant`);
  }
  for (const [w, l] of [[5, 0], [7, 1], [9, 2], [11, 3], [14, 5]]) {
    assert.ok(signTestP(w, l) >= 0.05, `${w}:${l} should not be significant`);
  }
});

test('signTestP is symmetric, capped at 1, and exact for large n', () => {
  assert.equal(signTestP(0, 6), signTestP(6, 0));
  assert.equal(signTestP(0, 0), 1);
  assert.equal(signTestP(3, 3), 1); // 2 * P(X <= 3) over n = 6 exceeds 1
  assert.equal(signTestP(50, 50), 1);
  const p = signTestP(200, 150);
  assert.ok(Number.isFinite(p) && p > 0 && p < 0.05);
  assert.equal(signTestP(1500, 0), 0); // below the 1e-15 resolution, and no overflow past n = 1023
});

// --- parsers ----------------------------------------------------------------

test('parseRealPrompts keeps scored rows and counts abstain rows separately', () => {
  const text = [
    '# Real prompts',
    '',
    'Prose with a | pipe that is not a row.',
    '',
    table(['id', 'query', 'expected', 'flag'], [
      ['R-01', 'where is the backup job described', 'notes/automation-roster.md', ''],
      ['R-02', 'bir şey sormadan merhaba de', '—', 'chitchat'],
      ['R-03', 'windows path style', 'notes\\source-roots.md', 'tr'],
      ['R-04', 'path in backticks', '`core/USER.md`', ''],
      ['R-05', 'ASCII dash abstains too', '-', ''],
      ['X-09', 'wrong id prefix is ignored', 'notes/x.md', ''],
      ['R-06', '', 'notes/empty-query.md', ''],
    ]),
    '',
  ].join('\n');
  const { rows, abstain } = parseRealPrompts(text);
  assert.deepEqual(rows.map((r) => r.id), ['R-01', 'R-03', 'R-04']);
  assert.equal(rows[0].expected, 'notes/automation-roster.md');
  assert.equal(rows[1].expected, 'notes/source-roots.md');
  assert.equal(rows[2].expected, 'core/USER.md');
  assert.equal(rows[1].flag, 'tr');
  assert.deepEqual(abstain.map((r) => r.id), ['R-02', 'R-05']);
});

test('parseRealPrompts accepts a three-column row and never throws on junk', () => {
  assert.deepEqual(parseRealPrompts('| R-01 | q | notes/a.md |').rows, [
    { id: 'R-01', query: 'q', expected: 'notes/a.md', flag: '' },
  ]);
  for (const junk of ['', undefined, null, '|', '| R-01 |', 'no table at all']) {
    assert.deepEqual(parseRealPrompts(junk), { rows: [], abstain: [] });
  }
});

test('parseExpansions splits variants on semicolons and keys them by row id', () => {
  const text = [
    'Written by a model that never saw the notes.',
    '',
    table(['id', 'variants'], [
      ['G-03', 'scheduled tasks ; cron jobs;  automation roster '],
      ['R-12', 'github bio headline'],
      ['G-07', ' ;  ; '],
      ['not-an-id', 'ignored'],
    ]),
  ].join('\n');
  const map = parseExpansions(text);
  assert.deepEqual([...map.keys()], ['G-03', 'R-12']);
  assert.deepEqual(map.get('G-03'), ['scheduled tasks', 'cron jobs', 'automation roster']);
  assert.deepEqual(map.get('R-12'), ['github bio headline']);
  assert.equal(parseExpansions(undefined).size, 0);
});

// --- paired comparison and the gate ----------------------------------------

function positions(entries) {
  return new Map(Object.entries(entries));
}

test('comparePaired counts wins and losses per k, drops ties and lists loss ids', () => {
  const rows = ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id }));
  const baseline = positions({ A: 0, B: 2, C: 4, D: -1, E: 0 });
  const candidate = positions({ A: 1, B: 0, C: 0, D: -1, E: 0 });
  const [at1, at3, at5] = comparePaired(rows, baseline, candidate);
  assert.deepEqual([at1.baselineHits, at1.candidateHits, at1.wins, at1.losses], [2, 3, 2, 1]);
  assert.deepEqual(at1.lossIds, ['A']);
  assert.deepEqual(at1.winIds, ['B', 'C']);
  assert.deepEqual([at3.baselineHits, at3.candidateHits, at3.wins, at3.losses], [3, 4, 1, 0]);
  assert.deepEqual(at3.lossIds, []);
  assert.deepEqual([at5.wins, at5.losses, at5.p], [0, 0, 1]);
});

function fakeStats({ w1, l1, w3, l3 }) {
  return [
    { k: 1, wins: w1, losses: l1, p: signTestP(w1, l1) },
    { k: 3, wins: w3, losses: l3, p: signTestP(w3, l3) },
    { k: 5, wins: 0, losses: 0, p: 1 },
  ];
}

test('gateVerdict passes only on a significant @3 win with no net loss at @1', () => {
  assert.equal(gateVerdict(fakeStats({ w1: 2, l1: 2, w3: 6, l3: 0 })).pass, true);
  assert.equal(gateVerdict(fakeStats({ w1: 0, l1: 0, w3: 8, l3: 1 })).pass, true);

  const noisy = gateVerdict(fakeStats({ w1: 1, l1: 0, w3: 5, l3: 0 }));
  assert.equal(noisy.pass, false);
  assert.match(noisy.reasons.join(' '), /within noise \(p = 0\.063/);

  const flat = gateVerdict(fakeStats({ w1: 0, l1: 0, w3: 3, l3: 3 }));
  assert.equal(flat.pass, false);
  assert.match(flat.reasons.join(' '), /wins do not exceed losses \(3:3\)/);

  const hurtsTop = gateVerdict(fakeStats({ w1: 0, l1: 1, w3: 6, l3: 0 }));
  assert.equal(hurtsTop.pass, false);
  assert.match(hurtsTop.reasons.join(' '), /@1 losses exceed wins \(0:1\)/);
});

// --- CLI: default output contract -------------------------------------------

function baseVault(t) {
  const vault = makeVault(t);
  note(vault, 'backup-job', { aliases: 'yedek görevi', tags: 'ops', body: 'The nightly job verifies the vault backup.' });
  note(vault, 'retrieval-notes', { body: 'Retrieval quality is measured with recall at k. Retrieval retrieval.' });
  note(vault, 'filler-one', { body: 'Nothing relevant here at all.' });
  note(vault, 'filler-two', { body: 'Another unrelated paragraph about gardening.' });
  writeEval(
    vault,
    'golden-set.md',
    table(['id', 'query', 'expected'], [
      ['G-01', 'which job verifies the backup', 'notes/backup-job.md'],
      ['G-02', 'retrieval recall measurement', 'notes/retrieval-notes.md'],
    ])
  );
  return vault;
}

test('default run prints the fielded table in the shape brain-doctor parses', (t) => {
  const vault = baseVault(t);
  const { status, stdout } = run(vault);
  assert.equal(status, 0);
  assert.match(stdout, /^# Retrieval eval\n\n2 queries over 4 documents \(`notes\/` \+ `core\/`\)\.\n\nRanker: `fielded`\.\n\n/);
  // brain-doctor's parseRecallScores: the first row of exactly three "NN% (h/t)" cells.
  const row = stdout.split(/\r?\n/).find((line) => {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    return cells.length === 3 && cells.every((c) => /^\d+% \(\d+\/\d+\)$/.test(c));
  });
  assert.equal(row, '| 100% (2/2) | 100% (2/2) | 100% (2/2) |');
  assert.doesNotMatch(stdout, /Set `|abstain|not found/);
});

test('unknown ranker, set and malformed --compare exit 2 without a stack trace', (t) => {
  const vault = baseVault(t);
  for (const args of [['--ranker', 'nope'], ['--set', 'nope'], ['--compare', 'fielded'], ['--compare', 'fielded,nope'], ['--query', 'x', '--compare', 'fielded,expand'], ['--variant', 'x'], ['--ranker', 'bm25'], ['--compare', 'fielded,prefix5']]) {
    const result = run(vault, ...args);
    assert.equal(result.status, 2, args.join(' '));
    assert.doesNotMatch(result.stderr, /at .*retrieval-eval\.mjs/);
  }
});

// --- CLI: the experimental rankers ------------------------------------------

test('expand fuses fielded rankings of the query and its --variant texts with RRF', (t) => {
  const vault = makeVault(t);
  note(vault, 'target-note', { body: 'schedule verification of the archive.' });
  note(vault, 'other-note', { body: 'archive archive archive and more words.' });
  note(vault, 'filler', { body: 'nothing.' });
  const plain = ranking(run(vault, '--query', 'zamanlanmis gorev', '--ranker', 'expand').stdout);
  assert.deepEqual(plain, [], 'no variants and no match: same as fielded');
  const { stdout } = run(vault, '--query', 'zamanlanmis gorev', '--ranker', 'expand', '--variant', 'schedule verification', '--variant=archive');
  const fused = ranking(stdout);
  assert.deepEqual(fused, ['notes/target-note.md', 'notes/other-note.md']);
  assert.match(stdout, /Variants: `schedule verification`, `archive`/);
});

// --- CLI: sets and the paired gate ------------------------------------------

test('--set real scores only rows with a path, reports abstain rows, and survives a missing file', (t) => {
  const vault = baseVault(t);
  const missing = run(vault, '--set', 'real');
  assert.equal(missing.status, 0);
  assert.match(missing.stdout, /`\.claude\/eval\/real-prompts\.md` not found/);
  assert.match(missing.stdout, /No scored rows in the selected set\./);

  writeEval(
    vault,
    'real-prompts.md',
    table(['id', 'query', 'expected', 'flag'], [
      ['R-01', 'which job verifies the backup', 'notes/backup-job.md', ''],
      ['R-02', 'retrieval recall measurement', 'notes/filler-one.md', ''],
      ['R-03', 'just say hello', '—', 'chitchat'],
      ['R-04', 'what is two plus two', '—', ''],
    ])
  );
  const real = run(vault, '--set', 'real');
  assert.match(real.stdout, /^2 queries over 4 documents/m);
  assert.match(real.stdout, /Set `real`: 2 scored; 2 abstain rows \(not scored\)\./);
  assert.match(real.stdout, /\| 50% \(1\/2\) \| 50% \(1\/2\) \| 50% \(1\/2\) \|/);
  assert.match(real.stdout, /\*\*R-02\*\*/);

  const both = run(vault, '--set', 'both');
  assert.match(both.stdout, /^4 queries over 4 documents/m);
  assert.match(both.stdout, /Set `both`: 2 golden \+ 2 real scored; 2 abstain rows \(not scored\)\./);
  assert.match(both.stdout, /\| 75% \(3\/4\) \| 75% \(3\/4\) \| 75% \(3\/4\) \|/);

  const golden = run(vault, '--set', 'golden');
  assert.doesNotMatch(golden.stdout, /abstain/);
});

// Six golden rows the fielded ranker cannot answer (the query shares no token
// with any note) and the expansion table can: the candidate wins 6:0.
function expansionVault(t, { rows = 6, expanded = 6 } = {}) {
  const vault = makeVault(t);
  const golden = [];
  const expansions = [];
  for (let i = 1; i <= rows; i++) {
    note(vault, `topic-${i}`, { body: `This note covers marker${i} in detail.` });
    golden.push([`G-0${i}`, `zzq${i}`, `notes/topic-${i}.md`]);
    if (i <= expanded) expansions.push([`G-0${i}`, `marker${i} ; unrelatedword${i}`]);
  }
  note(vault, 'filler', { body: 'nothing relevant.' });
  writeEval(vault, 'golden-set.md', table(['id', 'query', 'expected'], golden));
  writeEval(vault, 'expansions.md', table(['id', 'variants'], expansions));
  return vault;
}

test('--compare fielded,expand: a 6:0 split passes the gate with p = 0.031', (t) => {
  const vault = expansionVault(t);
  const { status, stdout } = run(vault, '--compare', 'fielded,expand');
  assert.equal(status, 0);
  assert.match(stdout, /\| k \| baseline % \| candidate % \| wins \| losses \| p \|/);
  assert.match(stdout, /\| @1 \| 0% \(0\/6\) \| 100% \(6\/6\) \| 6 \| 0 \| 0\.031 \|/);
  assert.match(stdout, /\| @3 \| 0% \(0\/6\) \| 100% \(6\/6\) \| 6 \| 0 \| 0\.031 \|/);
  assert.match(stdout, /Verdict: \*\*passes the gate\*\*/);
  assert.match(stdout, /Losses at @1 \(baseline hit, candidate miss\): none/);
  assert.match(stdout, /Expansions: `\.claude\/eval\/expansions\.md` has variants for 6 of 6 scored rows\./);
});

test('--compare fielded,expand: a 5:0 split is within noise and does not pass', (t) => {
  const vault = expansionVault(t, { rows: 6, expanded: 5 });
  const { stdout } = run(vault, '--compare=fielded,expand');
  assert.match(stdout, /\| @3 \| 0% \(0\/6\) \| 83% \(5\/6\) \| 5 \| 0 \| 0\.063 \|/);
  assert.match(stdout, /Verdict: \*\*does not pass the gate\*\* — at @3 wins 5 vs losses 0 is within noise \(p = 0\.063, needs < 0\.05\)/);
  assert.doesNotMatch(stdout, /passes the gate/);
});

test('--compare reversed lists the candidate losses so a human can inspect them', (t) => {
  const vault = expansionVault(t);
  const { stdout } = run(vault, '--compare', 'expand,fielded');
  assert.match(stdout, /Verdict: \*\*does not pass the gate\*\* — at @3 wins do not exceed losses \(0:6\); at @1 losses exceed wins \(0:6\)/);
  assert.match(stdout, /Losses at @1 \(baseline hit, candidate miss\): G-01 \(1 → miss\), G-02 \(1 → miss\)/);
  assert.match(stdout, /Losses at @3 \(baseline hit, candidate miss\): G-01/);
});

test('expand without expansions.md falls back to fielded and says so', (t) => {
  const vault = baseVault(t);
  const { status, stdout } = run(vault, '--ranker', 'expand');
  assert.equal(status, 0);
  assert.match(stdout, /`\.claude\/eval\/expansions\.md` not found — `expand` falls back to `fielded`/);
  assert.match(stdout, /\| 100% \(2\/2\) \| 100% \(2\/2\) \| 100% \(2\/2\) \|/);
});

test('every ranker runs in both modes without throwing on an empty vault', (t) => {
  const vault = makeVault(t);
  for (const ranker of ['legacy', 'frequency-free', 'fielded', 'expand']) {
    assert.equal(run(vault, '--ranker', ranker).status, 0, ranker);
    const query = run(vault, '--query', 'anything', '--ranker', ranker);
    assert.equal(query.status, 0, ranker);
    assert.match(query.stdout, /No matching documents\./);
  }
  assert.equal(run(vault, '--compare', 'fielded,expand', '--set', 'both').status, 0);
});
