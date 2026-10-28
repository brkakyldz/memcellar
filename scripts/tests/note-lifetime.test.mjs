// Coverage for the `note-lifetime` check in .claude/hooks/checks.mjs
// (ADR 0055): each type in its home, with the fields its lifetime needs.
// Every case writes a throwaway vault in the OS temp dir and hands the check
// an explicit list of changed files, so git is never involved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHECKS } from '../../.claude/hooks/checks.mjs';

const check = CHECKS.find((c) => c.id === 'note-lifetime');

function fire(t, files) {
  const root = mkdtempSync(path.join(tmpdir(), 'lifetime-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  return check.run({ repoRoot: root, changedFiles: Object.keys(files) }).map((f) => `${f.file} ${f.detail}`);
}
const fm = (fields) => `---\n${fields}\n---\n\n# x\n`;

test('canary: a knowledge page fires, the same page as a topic does not', (t) => {
  assert.deepEqual(fire(t, { 'notes/x.md': fm('type: knowledge\ncreated: 2026-10-24') }), ['notes/x.md legacy-type']);
  assert.deepEqual(fire(t, { 'notes/x.md': fm('type: topic\ncreated: 2026-10-24\nupdated: 2026-10-24') }), []);
});

test('near miss: a lesson topic file keeps type memory without firing', (t) => {
  assert.deepEqual(fire(t, { 'notes/lesson-asking.md': fm('type: memory\ncreated: 2026-10-24') }), []);
});

test('a topic page needs updated:, and reports and deliverables do not belong in notes/', (t) => {
  assert.deepEqual(fire(t, {
    'notes/a.md': fm('type: topic\ncreated: 2026-10-24'),
    'notes/b.md': fm('type: report\ncreated: 2026-10-24'),
    'notes/c.md': fm('type: deliverable\ncreated: 2026-10-24'),
  }), ['notes/a.md topic-updated-missing', 'notes/b.md report-in-notes', 'notes/c.md deliverable-in-notes']);
});

test('a report is dated, typed and points at its topic page', (t) => {
  assert.deepEqual(fire(t, {
    'reports/2026-10-24_model-pricing.md': fm('type: report\ncreated: 2026-10-24\nconfidence: low\nsource:\n  - https://example.com/prices\ntopic: "[[models]]"'),
    'reports/2026-10-25_model-pricing.md': fm('type: report\ncreated: "2026-10-25"\nconfidence: low\nsource: [https://example.com]\ntopic: "[[models]]"'),
    'reports/.gitkeep': '',
  }), []);
  assert.deepEqual(fire(t, {
    'reports/model-pricing.md': fm('type: knowledge'),
  }), ['reports/model-pricing.md report-filename', 'reports/model-pricing.md report-type',
    'reports/model-pricing.md report-topic-missing', 'reports/model-pricing.md report-source-missing',
    'reports/model-pricing.md report-confidence-missing', 'reports/model-pricing.md created-missing']);
});

test('a deliverable is dated and carries expires:; non-Markdown outputs need only the name', (t) => {
  assert.deepEqual(fire(t, {
    'outputs/2026-10-24_weekly-digest.md': fm('type: deliverable\ncreated: 2026-10-24\nexpires: 2026-11-23'),
    'outputs/2026-10-24_weekly-digest.csv': 'a,b\n',
    'outputs/2026-10-24_board.PNG': '',
    'outputs/README.md': '# contract\n',
  }), []);
  assert.deepEqual(fire(t, {
    'outputs/listings.md': fm('type: deliverable'),
  }), ['outputs/listings.md deliverable-filename', 'outputs/listings.md deliverable-expires-missing', 'outputs/listings.md created-missing']);
});
