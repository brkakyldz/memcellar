#!/usr/bin/env node
// Tests for the scripts behind /truth-test (truth-test/scripts/run.mjs),
// /import (import/scripts/inventory.mjs) and the research pack's
// reports-architecture scaffold. Nothing here starts an agent session: the
// runner's parsing, cloning and dry run are tested, not a paid question.
//
// Run: node --test scripts/tests/skill-scripts.test.mjs

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = (p) => new URL(`file://${path.join(ROOT, p).replace(/\\/g, '/')}`);
const RUN = path.join(ROOT, '.agents', 'skills', 'truth-test', 'scripts', 'run.mjs');
const runMod = await import(url('.agents/skills/truth-test/scripts/run.mjs'));
const inv = await import(url('.agents/skills/import/scripts/inventory.mjs'));
const scaffoldMod = await import(url('.agents/packs/research/reports-architecture/scripts/scaffold.mjs'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-scripts-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const dir = (name) => {
  const d = path.join(tmp, `${name}-${n++}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
};
const write = (base, rel, text) => {
  const p = path.join(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@localhost', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@localhost' };
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env, windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

const KEY = `# Truth questions

## Q1 — role
- question: What does the owner do for work?
- expected: Runs a bakery since
  March.
- trap: yes — old pages say accountant

## Q2 — focus
- question: What is the main project?
- expected: The garden log.
`;

test('truth-test: the answer key parses, with continuation lines and traps', () => {
  const qs = runMod.parseKey(KEY);
  assert.equal(qs.length, 2);
  assert.deepEqual(qs[0], { id: 'Q1', label: 'role', question: 'What does the owner do for work?', expected: 'Runs a bakery since March.', trap: true, trapNote: 'old pages say accountant' });
  assert.equal(qs[1].trap, false);
});

test('truth-test: a Claude Code stream yields the answer, files read, searches and cost', () => {
  const lines = [
    { type: 'system', subtype: 'init' },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/v/INDEX.md' } }] } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Grep', input: { pattern: 'bakery', path: 'notes' } }, { type: 'tool_use', name: 'Read', input: { file_path: '/v/notes/work.md' } }] } },
    { type: 'result', subtype: 'success', is_error: false, result: 'A bakery.', total_cost_usd: 0.042, num_turns: 4 },
  ].map((x) => JSON.stringify(x)).join('\n');
  const r = runMod.parseClaudeStream(`${lines}\nnot json\n`);
  assert.equal(r.ok, true);
  assert.equal(r.answer, 'A bakery.');
  assert.deepEqual(r.files, ['/v/INDEX.md', '/v/notes/work.md']);
  assert.deepEqual(r.searches, ['Grep bakery in notes']);
  assert.equal(r.cost, 0.042);
  assert.deepEqual(runMod.relativeTo('/v', r.files), ['INDEX.md', 'notes/work.md']);
  assert.equal(runMod.parseClaudeStream('{"type":"result","subtype":"error_max_turns","is_error":true}').ok, false);
});

test('truth-test: the estimate comes from the last measured run', () => {
  const qs = runMod.parseKey(KEY);
  assert.equal(runMod.estimate(qs, null).total, null);
  const e = runMod.estimate(qs, [{ cost: 0.1 }, { cost: 0.3 }, { cost: null }]);
  assert.ok(Math.abs(e.total - 0.4) < 1e-9);
});

test('truth-test: the question runs with read-only tools and no MCP servers', () => {
  const { exe, args } = runMod.askCommand('claude', 'Q?');
  assert.equal(exe, 'claude');
  const allowed = args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--disallowedTools'));
  assert.deepEqual(allowed, ['Read', 'Grep', 'Glob']);
  for (const t of ['Bash', 'Edit', 'Write', 'WebFetch']) assert.ok(args.includes(t));
  assert.ok(args.includes('--strict-mcp-config'));
  assert.ok(!args.includes('--model'));
  assert.ok(runMod.askCommand('codex', 'Q?').args.includes('read-only'));
});

function fixtureVault() {
  const v = dir('vault');
  git(v, 'init', '-q');
  write(v, 'notes/work.md', '---\ntype: topic\n---\n# Work\n');
  write(v, '.claude/eval/truth-questions.md', KEY);
  write(v, 'core/IDENTITY.md', '# Identity\n');
  write(v, '.gitignore', 'core/.vault-active\n');
  git(v, 'add', '.');
  git(v, 'commit', '-qm', 'fixture');
  write(v, 'core/.vault-active', 'marker\n');
  return v;
}

test('truth-test: the clone has no answer key, keeps the vault marker, and the vault is untouched', () => {
  const v = fixtureVault();
  const head = git(v, 'rev-parse', 'HEAD');
  const clone = runMod.prepareClone(v, path.join(dir('out'), 'run'));
  assert.ok(!fs.existsSync(path.join(clone, '.claude', 'eval')));
  assert.ok(fs.existsSync(path.join(clone, 'notes', 'work.md')));
  assert.ok(fs.existsSync(path.join(clone, 'core', '.vault-active')));
  // prepareClone runs git with the caller's own config, so check with the same
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: clone, encoding: 'utf8', windowsHide: true });
  assert.equal(status.stdout.trim(), '');
  assert.ok(fs.existsSync(path.join(v, '.claude', 'eval', 'truth-questions.md')));
  assert.equal(git(v, 'rev-parse', 'HEAD'), head);
});

test('truth-test: --dry-run lists the questions and runs nothing', () => {
  const v = fixtureVault();
  const out = path.join(dir('out'), 'run');
  const r = spawnSync(process.execPath, [RUN, '--vault', v, '--out', out, '--dry-run'], { encoding: 'utf8', env, windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /2 question\(s\) \(1 trap\)/);
  assert.match(r.stdout, /cost estimate: unknown/);
  assert.match(r.stdout, /Q1 \(trap\): What does the owner do for work\?/);
  assert.ok(!fs.existsSync(out));
  const missing = spawnSync(process.execPath, [RUN, '--vault', dir('empty'), '--dry-run'], { encoding: 'utf8', windowsHide: true });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /no answer key/);
});

const tree = (d) => {
  const h = createHash('sha256');
  const walk = (x) => {
    for (const e of fs.readdirSync(x, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(x, e.name);
      h.update(p);
      if (e.isDirectory()) walk(p);
      else h.update(fs.readFileSync(p));
    }
  };
  walk(d);
  return h.digest('hex');
};

test('import inventory: reads notes and attachments, flags problems, never writes into the source', () => {
  const src = dir('old-vault');
  write(src, '.obsidian/app.json', '{}');
  write(src, 'Projects/Garden.md', '---\ntags: [garden, home]\n---\n# Garden plan\nSoil test came back. See [[Compost]] and [[Missing page]]. #outdoor\n![[soil.png]]\n');
  write(src, 'Projects/Compost.md', 'Compost notes.\n');
  write(src, 'Archive/Compost.md', 'Older compost notes.\n');
  write(src, 'Daily/2024-03-02.md', '');
  write(src, 'soil.png', 'png');
  const before = tree(src);
  const r = inv.inventory(src);
  assert.equal(tree(src), before);
  assert.equal(r.counts.notes, 4);
  assert.equal(r.counts.attachments, 1);
  assert.ok(!r.items.some((i) => i.path.startsWith('.obsidian')));
  const garden = r.items.find((i) => i.path === 'Projects/Garden.md');
  assert.equal(garden.title, 'Garden plan');
  assert.deepEqual(garden.tags.sort(), ['garden', 'home', 'outdoor']);
  assert.deepEqual(garden.links, ['Compost', 'Missing page']);
  assert.deepEqual(garden.embeds, ['soil.png']);
  assert.equal(r.items.find((i) => i.path === 'Daily/2024-03-02.md').dateInName, '2024-03-02');
  const flags = r.flags.join('\n');
  assert.match(flags, /Daily\/2024-03-02\.md: empty/);
  assert.match(flags, /same name "compost"/);
  assert.match(flags, /links to missing Missing page/);
  assert.match(inv.table(r), /\| Projects\/Garden\.md \| \d+ \|/);
});

test('reports-architecture scaffold: idempotent in a project, refuses a vault', () => {
  const repo = dir('project');
  const first = scaffoldMod.scaffold(repo);
  assert.equal(first.created.length, 3);
  assert.ok(fs.existsSync(path.join(repo, 'reports', '.reports-architecture')));
  write(repo, 'reports/README.md', 'my own');
  const second = scaffoldMod.scaffold(repo);
  assert.equal(second.created.length, 0);
  assert.equal(fs.readFileSync(path.join(repo, 'reports', 'README.md'), 'utf8'), 'my own');
  const vault = dir('vault');
  write(vault, 'core/IDENTITY.md', '#');
  write(vault, '.agents/write-gate.md', '#');
  assert.throws(() => scaffoldMod.scaffold(vault), /Second Brain OS vault/);
  assert.ok(!fs.existsSync(path.join(vault, 'reports')));
});
