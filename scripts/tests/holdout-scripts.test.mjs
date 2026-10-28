#!/usr/bin/env node
// Tests for the build pack's held-out scripts (scenario-author/scripts):
// lock.mjs (the manifest lock), check-scenarios.mjs (the static pass before
// landing) and verify-holdout.mjs (N runs, the lock checked first).
//
// Run: node --test scripts/tests/holdout-scripts.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS = path.join(ROOT, '.agents', 'packs', 'build', 'scenario-author', 'scripts');
const { land, check } = await import(new URL(`file://${path.join(SCRIPTS, 'lock.mjs').replace(/\\/g, '/')}`));
const { checkScenarios } = await import(new URL(`file://${path.join(SCRIPTS, 'check-scenarios.mjs').replace(/\\/g, '/')}`));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'holdout-test-'));
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

// A pack that passes the static check.
function goodPack() {
  const pack = dir('pack');
  write(pack, 'H01_save.spec.ts', "import { test, expect } from '@playwright/test';\nimport { start } from './helpers/start';\ntest('H01 [M1-A1, M2-A1] @smoke saved note survives reload', async () => {});\n");
  write(pack, 'H02_refuse.spec.ts', "test('H02 [M1-A2] one representative refusal', async () => {});\n");
  write(pack, 'helpers/start.ts', 'export const start = () => {};\n');
  write(pack, 'playwright.config.ts', 'export default { retries: 0, timeout: 30_000 };\n');
  write(pack, 'verify.json', JSON.stringify({ command: 'npx playwright test', format: 'junit', report: 'test-results/holdout.xml', expected: ['H01', 'H02'] }));
  write(pack, 'COVERAGE.md', '| ID | Scenarios |\n|---|---|\n| M1-A1 | H01 |\n');
  return pack;
}

test('check-scenarios passes a clean pack', () => {
  const r = checkScenarios(goodPack());
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.ids, ['H01', 'H02']);
});

test('check-scenarios catches sleeps, imports from product source, retries, id drift and a report inside the lock', () => {
  const pack = goodPack();
  write(pack, 'H03_slow.spec.ts', "import { save } from '../../../src/store';\ntest('H03 [M3-A1] waits', async ({ page }) => { await page.waitForTimeout(500); });\n");
  write(pack, 'H04_bad.spec.ts', "test('H05 [M4-A1] wrong id in title', async () => {});\n");
  write(pack, 'playwright.config.ts', 'export default { retries: 2 };\n');
  write(pack, 'verify.json', JSON.stringify({ command: 'x', report: 'tests/acceptance/holdout/out.xml', expected: ['H01', 'H02', 'H09'] }));
  const { errors } = checkScenarios(pack);
  const all = errors.join('\n');
  assert.match(all, /H03_slow\.spec\.ts:2: fixed wait/);
  assert.match(all, /H03_slow\.spec\.ts:1: imports \.\.\/\.\.\/\.\.\/src\/store, outside the held-out folder/);
  assert.match(all, /retries 2/);
  assert.match(all, /title id H05 does not match the file's H04/);
  assert.match(all, /"expected" lacks H03, H04/);
  assert.match(all, /names H09, which no scenario file has/);
  assert.match(all, /inside the held-out folder/);
});

test('check-scenarios enforces the budget and the @smoke cap', () => {
  const pack = goodPack();
  const ids = ['H01', 'H02'];
  for (let i = 3; i <= 12; i++) {
    const id = `H${String(i).padStart(2, '0')}`;
    ids.push(id);
    write(pack, `${id}_x.spec.ts`, `test('${id} [M1-A1] @smoke journey', async () => {});\n`);
  }
  write(pack, 'verify.json', JSON.stringify({ command: 'x', report: 'out.xml', expected: ids }));
  const { errors } = checkScenarios(pack, { budget: 10 });
  assert.ok(errors.some((e) => /12 scenarios, budget 10/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /11 scenarios tagged @smoke, at most 8/.test(e)), errors.join('\n'));
});

test('lock.mjs land copies the pack exactly and check sees any change', () => {
  const pack = goodPack();
  const repo = dir('repo');
  const r = land({ pack, root: repo, author: 'fresh subagent, capable tier', spec: 'abc123' });
  assert.equal(r.copied, 6);
  assert.equal(check(repo).ok, true);
  const holdout = path.join(repo, 'tests', 'acceptance', 'holdout');
  // CRLF line endings are not tampering.
  const f = path.join(holdout, 'H02_refuse.spec.ts');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\n/g, '\r\n'));
  assert.equal(check(repo).ok, true);
  // A weakened assertion is.
  fs.appendFileSync(f, '// expect removed\n');
  write(holdout, 'H99_extra.spec.ts', 'x');
  fs.rmSync(path.join(holdout, 'COVERAGE.md'));
  const c = check(repo);
  assert.equal(c.ok, false);
  assert.deepEqual(c.changed, ['H02_refuse.spec.ts']);
  assert.deepEqual(c.added, ['H99_extra.spec.ts']);
  assert.deepEqual(c.removed, ['COVERAGE.md']);
});

test('a trim lands by removing the files the pack no longer has', () => {
  const pack = goodPack();
  const repo = dir('repo');
  land({ pack, root: repo, author: 'a' });
  fs.rmSync(path.join(pack, 'H02_refuse.spec.ts'));
  const r = land({ pack, root: repo, author: 'a' });
  assert.deepEqual(r.removed, ['H02_refuse.spec.ts']);
  assert.equal(check(repo).ok, true);
  assert.equal(check(dir('empty')).missingLock, true);
  assert.throws(() => land({ pack, root: repo }), /--author is required/);
});

// verify-holdout with a fake suite: the command is a node one-liner that
// writes a JUnit report, so no test framework is needed.
function verifyRepo(cases) {
  const repo = dir('verify');
  const xml = `<testsuite>${cases.map(([name, ok]) => `<testcase classname="holdout" name="${name}">${ok ? '' : '<failure/>'}</testcase>`).join('')}</testsuite>`;
  const writer = path.join(repo, 'write-report.cjs');
  fs.writeFileSync(writer, `require('fs').mkdirSync('out',{recursive:true});require('fs').writeFileSync('out/report.xml', ${JSON.stringify(xml)});`);
  const pack = dir('vpack');
  write(pack, 'verify.json', JSON.stringify({ command: `node write-report.cjs`, format: 'junit', report: 'out/report.xml', expected: ['H01', 'H02'], runs: 2, perScenario: 2, overall: 0.9 }));
  land({ pack, root: repo, author: 'a' });
  return repo;
}
const verify = (repo, ...args) => spawnSync(process.execPath, [path.join(SCRIPTS, 'verify-holdout.mjs'), '--root', repo, ...args], { encoding: 'utf8', windowsHide: true });

test('verify-holdout: VERIFIED only when every expected scenario ran and passed, and the lock holds', () => {
  let r = verify(verifyRepo([['H01 [M1-A1] a', true], ['H02 [M1-A2] b', true]]));
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /VERIFIED 2\/2 scenarios/);

  r = verify(verifyRepo([['H01 [M1-A1] a', true], ['H02 [M1-A2] b', false]]));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /NOT VERIFIED: below 2\/2: H02/);

  r = verify(verifyRepo([['H01 [M1-A1] a', true]]));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /not executed: H02/);

  const repo = verifyRepo([['H01 a', true], ['H02 b', true]]);
  fs.appendFileSync(path.join(repo, 'tests', 'acceptance', 'holdout', 'verify.json'), ' ');
  r = verify(repo);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /held-out files differ from LOCK\.json \(changed: verify\.json/);

  fs.rmSync(path.join(repo, 'tests', 'acceptance', 'holdout', 'LOCK.json'));
  r = verify(repo);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /LOCK\.json is missing/);
  r = verify(repo, '--no-lock');
  assert.equal(r.status, 0, r.stdout);
});
