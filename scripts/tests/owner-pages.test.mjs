// Coverage for ADR 0060: the `owner-pages` check in .claude/hooks/checks.mjs,
// the owner-page exemptions in the other checks and the lifetime findings,
// and `install.mjs --obsidian`. Every case runs in a throwaway git repo or
// folder in the OS temp dir, never in a real vault.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKS } from '../../.claude/hooks/checks.mjs';
import { lifetimeFindings } from '../../.claude/hooks/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ownerPages = CHECKS.find((c) => c.id === 'owner-pages');
const OWNER = '---\nauthor: owner\nkind: todo\ncreated: 2026-10-25\nupdated: 2026-10-25\n---\n\n# To do\n\n- one\n';
const TOPIC = '---\ntype: topic\ncreated: 2026-10-25\nupdated: 2026-10-25\n---\n\n# Topic\n\n[[todo]]\n';

function vault(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'owner-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Owner Test');
  git('config', 'core.autocrlf', 'false');
  mkdirSync(path.join(root, 'notes'));
  writeFileSync(path.join(root, 'notes', 'todo.md'), OWNER);
  writeFileSync(path.join(root, 'notes', 'topic.md'), TOPIC);
  git('add', '--', 'notes');
  git('commit', '-q', '-m', 'seed');
  return { root, git };
}
const fire = (root, changed) =>
  ownerPages.run({ repoRoot: root, changedFiles: changed }).map((f) => `${f.file} ${f.detail}`);

test('canary: an edited owner page fires, a clean one does not', (t) => {
  const { root } = vault(t);
  assert.deepEqual(fire(root, ['notes/todo.md']), []);
  writeFileSync(path.join(root, 'notes', 'todo.md'), OWNER + '- two\n');
  assert.deepEqual(fire(root, ['notes/todo.md']), ['notes/todo.md owner-page-edited']);
});

test('setup naming the owner is not an edit, anything more still is', (t) => {
  const { root } = vault(t);
  const named = OWNER.replace('author: owner', 'author: Deniz');
  writeFileSync(path.join(root, 'notes', 'todo.md'), named);
  assert.deepEqual(fire(root, ['notes/todo.md']), []);
  writeFileSync(path.join(root, 'notes', 'todo.md'), named + '- two\n');
  assert.deepEqual(fire(root, ['notes/todo.md']), ['notes/todo.md owner-page-edited']);
});

test('dropping author: is its own finding', (t) => {
  const { root } = vault(t);
  writeFileSync(path.join(root, 'notes', 'todo.md'), OWNER.replace('author: owner\n', ''));
  assert.deepEqual(fire(root, ['notes/todo.md']), ['notes/todo.md owner-mark-removed']);
});

test('a deleted or moved owner page fires', (t) => {
  const { root, git } = vault(t);
  rmSync(path.join(root, 'notes', 'todo.md'));
  assert.deepEqual(fire(root, []), ['notes/todo.md owner-page-removed']);
  git('checkout', '-q', '--', 'notes/todo.md');
  mkdirSync(path.join(root, 'archive'));
  git('mv', 'notes/todo.md', 'archive/todo.md');
  assert.deepEqual(fire(root, ['archive/todo.md']), ['notes/todo.md owner-page-moved']);
});

test('near miss: an edited agent page and a new owner page do not fire', (t) => {
  const { root } = vault(t);
  writeFileSync(path.join(root, 'notes', 'topic.md'), TOPIC + '\nmore\n');
  writeFileSync(path.join(root, 'notes', 'new-idea.md'), OWNER);
  assert.deepEqual(fire(root, ['notes/topic.md', 'notes/new-idea.md']), []);
});

test('the lifetime findings leave an owner page alone', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'owner-life-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'notes'));
  // A topic page this old fires topic-untouched; the same dates on an owner page must not.
  writeFileSync(path.join(root, 'notes', 'old-topic.md'), '---\ntype: topic\ncreated: 2020-01-01\nupdated: 2020-01-01\n---\n\n# x\n');
  writeFileSync(path.join(root, 'notes', 'old-mine.md'), '---\nauthor: owner\ntype: topic\ncreated: 2020-01-01\nupdated: 2020-01-01\nvalid_to: 2020-02-01\n---\n\n# x\n');
  const files = lifetimeFindings(root, { now: new Date('2026-10-25T12:00:00Z') }).map((f) => f.file);
  assert.ok(files.includes('notes/old-topic.md'), JSON.stringify(files));
  assert.ok(!files.includes('notes/old-mine.md'), JSON.stringify(files));
});

test('install.mjs --obsidian creates app.json, then merges into an existing one', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'owner-obs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(path.join(ROOT, 'install.mjs'), path.join(root, 'install.mjs'));
  const run = () => spawnSync(process.execPath, ['install.mjs', '--obsidian'], { cwd: root, encoding: 'utf8', windowsHide: true });
  const app = () => JSON.parse(readFileSync(path.join(root, '.obsidian', 'app.json'), 'utf8'));

  assert.equal(run().status, 0);
  assert.deepEqual(app().userIgnoreFilters, ['archive/', 'logs/', 'raw/']);

  writeFileSync(path.join(root, '.obsidian', 'app.json'), JSON.stringify({ alwaysUpdateLinks: true, userIgnoreFilters: ['raw/', 'tmp/'] }));
  assert.equal(run().status, 0);
  assert.deepEqual(app(), { alwaysUpdateLinks: true, userIgnoreFilters: ['raw/', 'tmp/', 'archive/', 'logs/'] });

  writeFileSync(path.join(root, '.obsidian', 'app.json'), '{ not json');
  assert.equal(run().status, 1);
  assert.equal(readFileSync(path.join(root, '.obsidian', 'app.json'), 'utf8'), '{ not json');
});
