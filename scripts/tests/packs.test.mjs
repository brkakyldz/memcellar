#!/usr/bin/env node
// Tests for the optional skill packs (ADR 0062): install.mjs --list-packs,
// --pack, --unpack, and the shape every pack skill must have.
//
// install.mjs runs with CLAUDE_CONFIG_DIR / CODEX_HOME pointed at a fixture
// home, so no assertion touches the real user-level skills folders.
//
// Run: node --test scripts/tests/packs.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INSTALL = path.join(ROOT, 'install.mjs');
const PACKS = path.join(ROOT, '.agents', 'packs');
const DEFAULT_SKILLS = path.join(ROOT, '.agents', 'skills');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'packs-test-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function home(name, { codex = true } = {}) {
  const h = path.join(tmp, name);
  fs.mkdirSync(path.join(h, '.claude'), { recursive: true });
  if (codex) fs.mkdirSync(path.join(h, '.codex'), { recursive: true });
  return h;
}

function install(h, ...args) {
  return spawnSync(process.execPath, [INSTALL, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(h, '.claude'), CODEX_HOME: path.join(h, '.codex'), HOME: h, USERPROFILE: h },
  });
}

const real = (p) => fs.realpathSync(p);
const packs = () => fs.readdirSync(PACKS).filter((p) => fs.statSync(path.join(PACKS, p)).isDirectory()).sort();
const skillsOf = (pack) => fs.readdirSync(path.join(PACKS, pack)).filter((s) => fs.existsSync(path.join(PACKS, pack, s, 'SKILL.md'))).sort();

test('the four packs ship with the skills ADR 0061 names', () => {
  assert.deepEqual(packs(), ['build', 'ideas', 'release', 'research']);
  assert.deepEqual(skillsOf('research'), ['reports-architecture', 'research']);
  assert.deepEqual(skillsOf('release'), ['bug-sweep', 'ship']);
  assert.deepEqual(skillsOf('ideas'), ['evolve', 'idea-import', 'product-idea-research']);
  assert.deepEqual(skillsOf('build'), ['adr', 'implementation-coordinator', 'integration-gate', 'parallel-lane-runner',
    'repo-bootstrap', 'scenario-author', 'slice-reviewer', 'software-factory', 'unattended-run']);
});

test('every pack skill has a matching name, a description and a Codex policy file', () => {
  for (const pack of packs()) {
    for (const skill of skillsOf(pack)) {
      const text = fs.readFileSync(path.join(PACKS, pack, skill, 'SKILL.md'), 'utf8');
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
      assert.match(fm, new RegExp(`^name: ${skill}$`, 'm'), `${pack}/${skill}: frontmatter name`);
      assert.match(fm, /^description: .{40,}/m, `${pack}/${skill}: description`);
      const yaml = path.join(PACKS, pack, skill, 'agents', 'openai.yaml');
      assert.ok(fs.existsSync(yaml), `${pack}/${skill}: agents/openai.yaml`);
      assert.match(fs.readFileSync(yaml, 'utf8'), /allow_implicit_invocation: false/);
    }
  }
});

// An unquoted value holding ": " is not valid YAML, and a runtime that cannot
// parse the frontmatter drops the skill without a word — seven build skills
// were silently missing from a test session until their descriptions were
// quoted.
test('every skill frontmatter value with ": " in it is quoted', () => {
  const files = [];
  for (const pack of packs()) for (const s of skillsOf(pack)) files.push(path.join(PACKS, pack, s, 'SKILL.md'));
  for (const s of fs.readdirSync(DEFAULT_SKILLS)) if (fs.existsSync(path.join(DEFAULT_SKILLS, s, 'SKILL.md'))) files.push(path.join(DEFAULT_SKILLS, s, 'SKILL.md'));
  const bad = [];
  for (const f of files) {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(f, 'utf8'))?.[1] ?? '';
    for (const line of fm.split(/\r?\n/)) {
      const m = /^([\w-]+):\s+(.*)$/.exec(line);
      if (m && !/^["'[{|>]/.test(m[2]) && /: /.test(m[2])) bad.push(`${path.relative(ROOT, f)}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('no skill name is used twice across packs and the default set', () => {
  const seen = new Map();
  for (const s of fs.readdirSync(DEFAULT_SKILLS)) if (fs.existsSync(path.join(DEFAULT_SKILLS, s, 'SKILL.md'))) seen.set(s, 'default');
  for (const pack of packs()) {
    for (const skill of skillsOf(pack)) {
      assert.ok(!seen.has(skill), `${skill} is in ${pack} and in ${seen.get(skill)}`);
      seen.set(skill, pack);
    }
  }
});

// Pack skills and the new default skills are written for any user (ADR 0061 §3).
test('no owner-specific leftovers in packs or the new default skills', () => {
  const LEFTOVER = /berke|C:[\\/]|my-brain|berke-skills|\bopus\b|\bsonnet\b|\bhaiku\b|\bfable\b|gpt-\d|archdrawer|architecture-drawer|spanflow|issuepilot|codex-runtime|runtimes\.json|public-writing|leak-scan|commit-gate|holdout-lock|test-gate|run-fence|\.publish\.json|vault ADR/i;
  const roots = [PACKS, ...['truth', 'truth-test', 'import'].map((s) => path.join(DEFAULT_SKILLS, s))];
  const hits = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
        if (LEFTOVER.test(line)) hits.push(`${path.relative(ROOT, p)}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
  };
  roots.forEach(walk);
  assert.deepEqual(hits, []);
});

test('a pack skill names only skills that ship', () => {
  const shipped = new Set(fs.readdirSync(DEFAULT_SKILLS));
  for (const pack of packs()) for (const s of skillsOf(pack)) shipped.add(s);
  const PERSONAL = ['backport', 'coplan', 'astra-researcher', 'arch-diagram', 'demo-video', 'orchestrator', 'hook-doctor', 'system-audit'];
  for (const pack of packs()) {
    for (const skill of skillsOf(pack)) {
      const text = fs.readFileSync(path.join(PACKS, pack, skill, 'SKILL.md'), 'utf8');
      for (const p of PERSONAL) assert.ok(!new RegExp(`\`/?${p}\``).test(text), `${pack}/${skill} names ${p}, which does not ship`);
    }
  }
});

test('--list-packs lists every pack and touches nothing', () => {
  const h = home('list');
  const r = install(h, '--list-packs');
  assert.equal(r.status, 0, r.stderr);
  for (const p of packs()) assert.match(r.stdout, new RegExp(`^${p}$`, 'm'));
  assert.match(r.stdout, /research\s+Claude Code: -, Codex: -/);
  assert.deepEqual(fs.readdirSync(path.join(h, '.claude')), []);
});

test('--pack links each skill into both runtimes, --unpack removes exactly those links', () => {
  const h = home('link');
  let r = install(h, '--pack', 'research');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const runtime of ['.claude', '.codex']) {
    for (const s of skillsOf('research')) {
      const link = path.join(h, runtime, 'skills', s);
      assert.ok(fs.lstatSync(link).isSymbolicLink(), `${runtime}/${s} is a link`);
      assert.equal(real(link), real(path.join(PACKS, 'research', s)));
    }
  }
  r = install(h, '--pack', 'research');
  assert.match(r.stdout, /already linked/);
  r = install(h, '--list-packs');
  assert.match(r.stdout, /research\s+Claude Code: linked, Codex: linked/);
  r = install(h, '--unpack', 'research');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(fs.readdirSync(path.join(h, '.claude', 'skills')), []);
  assert.deepEqual(fs.readdirSync(path.join(h, '.codex', 'skills')), []);
});

test('several packs at once, comma-separated or repeated', () => {
  const h = home('several', { codex: false });
  let r = install(h, '--pack', 'release,ideas');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  r = install(h, '--pack=research', '--pack', 'build');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const linked = fs.readdirSync(path.join(h, '.claude', 'skills')).sort();
  const all = packs().flatMap(skillsOf).sort();
  assert.deepEqual(linked, all);
  assert.match(r.stdout, /Codex: .* not found — skipped/);
});

test('a real folder or a link elsewhere is left alone and reported; a broken link is repaired', () => {
  const h = home('conflict', { codex: false });
  const dir = path.join(h, '.claude', 'skills');
  fs.mkdirSync(path.join(dir, 'research'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'research', 'SKILL.md'), 'my own copy');
  const elsewhere = path.join(tmp, 'elsewhere-skill');
  fs.mkdirSync(elsewhere, { recursive: true });
  fs.symlinkSync(elsewhere, path.join(dir, 'ship'), process.platform === 'win32' ? 'junction' : 'dir');
  const gone = path.join(tmp, 'gone-skill');
  fs.mkdirSync(gone);
  fs.symlinkSync(gone, path.join(dir, 'bug-sweep'), process.platform === 'win32' ? 'junction' : 'dir');
  fs.rmSync(gone, { recursive: true });

  let r = install(h, '--pack', 'research');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /research \[research\] — FAILED: a real folder is already there — left alone/);
  assert.equal(fs.readFileSync(path.join(dir, 'research', 'SKILL.md'), 'utf8'), 'my own copy');

  r = install(h, '--pack', 'release');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /ship \[release\] — FAILED: already links to/);
  assert.equal(real(path.join(dir, 'ship')), real(elsewhere));
  assert.match(r.stdout, /bug-sweep \[release\] — repaired/);

  r = install(h, '--unpack', 'release');
  assert.match(r.stdout, /ship \[release\] — links to .*not this vault — left alone/);
  assert.ok(fs.existsSync(path.join(dir, 'ship')));
});

test('unknown pack, missing name and --pack with --unpack are refused without writing', () => {
  const h = home('refuse');
  let r = install(h, '--pack', 'nope');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown pack: nope\. Available: build, ideas, release, research/);
  r = install(h, '--pack');
  assert.equal(r.status, 2);
  r = install(h, '--pack', 'research', '--unpack', 'build');
  assert.equal(r.status, 2);
  assert.deepEqual(fs.readdirSync(path.join(h, '.claude')), []);
});

test('--link-global-skills still links only closeout and lesson', () => {
  const h = home('global', { codex: false });
  const r = install(h, '--link-global-skills');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(fs.readdirSync(path.join(h, '.claude', 'skills')).sort(), ['closeout', 'lesson']);
});
