#!/usr/bin/env node
// Tests for the release pack's ship script (.agents/packs/release/ship/scripts/ship.mjs).
//
// No network and no gh: every test builds its own git repo under the system
// temp directory and runs only the preflight, either through the exported
// functions or through `--dry-run`, which refuses to call gh or git push.
// Fake credentials are assembled at run time so this file never holds one.
//
// Run: node --test scripts/tests/ship.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test, { after } from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const shipPath = path.resolve(here, '..', '..', '.agents', 'packs', 'release', 'ship', 'scripts', 'ship.mjs');
const ship = await import(pathToFileURL(shipPath).href);

const fixtureHome = mkdtempSync(path.join(os.tmpdir(), 'ship-test-home-'));
const roots = [fixtureHome];
after(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });
const env = { ...process.env, HOME: fixtureHome, USERPROFILE: fixtureHome, GIT_CONFIG_NOSYSTEM: '1' };

function git(repo, ...args) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true, env });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function put(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

const CHANGELOG = `# Changelog

## [1.0.0] - 2026-01-01

### Added
- The first release.

## [0.9.0] - 2025-12-01

### Added
- A preview.
`;

// A committed repo on main with the four files the release needs.
function readyRepo() {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'ship-test-repo-'));
  roots.push(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.name', 'Ship Test');
  git(repo, 'config', 'user.email', 'ship@example.invalid');
  git(repo, 'config', 'commit.gpgsign', 'false');
  put(path.join(repo, 'README.md'), '# Demo\n');
  put(path.join(repo, 'LICENSE'), 'MIT License\n');
  put(path.join(repo, 'CHANGELOG.md'), CHANGELOG);
  put(path.join(repo, '.github', 'workflows', 'ci.yml'), 'name: ci\n');
  put(path.join(repo, 'src', 'index.js'), 'export const answer = 42;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  return repo;
}
function dryRun(repo, version = '1.0.0') {
  return spawnSync(process.execPath, [shipPath, '--repo', 'someone/demo', '--version', version, '--root', repo, '--dry-run'],
    { encoding: 'utf8', windowsHide: true, env });
}

test('dry run passes on a ready repo and sends nothing to GitHub', () => {
  const repo = readyRepo();
  const r = dryRun(repo);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /preflight ok/);
  assert.match(r.stdout, /create it PRIVATE/);
  assert.match(r.stdout, /The first release\./);
  assert.doesNotMatch(r.stdout, /A preview\./, 'notes must stop at the next version heading');
  assert.match(r.stdout, /DRY RUN: nothing was sent to GitHub/);
  assert.equal(ship.preflight({ root: repo, version: '1.0.0' }).errors.length, 0);
});

test('preflight fails when the CHANGELOG lacks the version', () => {
  const repo = readyRepo();
  const pf = ship.preflight({ root: repo, version: '2.0.0' });
  assert.ok(pf.errors.some((e) => /CHANGELOG\.md has no .*2\.0\.0/.test(e)), pf.errors.join('\n'));
  const r = dryRun(repo, '2.0.0');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /SHIP STOPPED/);
});

test('preflight fails on a dirty tree', () => {
  const repo = readyRepo();
  put(path.join(repo, 'src', 'index.js'), 'export const answer = 43;\n');
  const pf = ship.preflight({ root: repo, version: '1.0.0' });
  assert.ok(pf.errors.some((e) => /working tree not clean/.test(e)), pf.errors.join('\n'));
  assert.equal(dryRun(repo).status, 1);
});

test('preflight fails when a required file is missing or the tag exists', () => {
  const repo = readyRepo();
  git(repo, 'rm', '-q', 'LICENSE');
  git(repo, 'commit', '-q', '-m', 'drop license');
  git(repo, 'tag', 'v1.0.0');
  const errors = ship.preflight({ root: repo, version: '1.0.0' }).errors.join('\n');
  assert.match(errors, /missing LICENSE/);
  assert.match(errors, /tag v1\.0\.0 already exists/);
});

test('secret scan flags a planted fake key and passes a clean file', () => {
  const fakeAws = 'AKIA' + 'Z7QXEXAMPLEKEY12';
  const fakeGh = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8';
  assert.deepEqual(ship.scanText('const x = 1;\nexport default x;\n'), []);
  assert.equal(ship.scanText(`aws_key = "${fakeAws}"\n`)[0]?.what, 'AWS access key id');
  assert.equal(ship.scanText(`one\ntwo ${fakeGh}\n`)[0]?.line, 2);
  assert.deepEqual(ship.scanText(`token = "${fakeGh}" # ship-scan: allow\n`), [], 'the allow marker skips a line');

  const repo = readyRepo();
  put(path.join(repo, 'src', 'config.js'), `export const key = "${fakeAws}";\n`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'config');
  const pf = ship.preflight({ root: repo, version: '1.0.0' });
  assert.ok(pf.errors.some((e) => /secret scan:[\s\S]*src\/config\.js:1: AWS access key id/.test(e)), pf.errors.join('\n'));
  assert.ok(!pf.errors.some((e) => /index\.js/.test(e)), 'the clean file is not flagged');
  assert.equal(dryRun(repo).status, 1);
});

test('a tracked env file is flagged, an example is not', () => {
  assert.equal(ship.isEnvFile('.env'), true);
  assert.equal(ship.isEnvFile('app/.env.local'), true);
  assert.equal(ship.isEnvFile('.env.example'), false);
  assert.equal(ship.isEnvFile('src/environment.js'), false);
});

test('changelog extraction and argument checks', () => {
  assert.equal(ship.extractChangelogSection(CHANGELOG, '0.9.0'), '### Added\n- A preview.');
  assert.equal(ship.extractChangelogSection(CHANGELOG, '1.0'), null);
  assert.equal(ship.validateArgs({ repo: 'o/n', version: '1.2.3' }), null);
  assert.match(ship.validateArgs({ repo: 'nope', version: '1.2.3' }), /--repo/);
  assert.match(ship.validateArgs({ repo: 'o/n', version: 'v1' }), /--version/);
  assert.equal(ship.repoFromRemote('git@github.com:o/n.git'), 'o/n');
  assert.equal(ship.repoFromRemote('https://github.com/o/n'), 'o/n');
});
