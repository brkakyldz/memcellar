// Coverage for lifetimeFindings in .claude/hooks/lib.mjs and its two readers
// (ADR 0055): the `lifetime-sweep` check and the maintenance notice. The
// fixture rebuilds the failures the reference instance found on 2026-10-24 —
// each one had been sitting in an always-loaded file or a live page for days.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lifetimeFindings, maintenanceDue } from '../../.claude/hooks/lib.mjs';
import { CHECKS } from '../../.claude/hooks/checks.mjs';

const NOW = new Date('2026-10-24T12:00:00');

function vault(t, files) {
  const root = mkdtempSync(path.join(tmpdir(), 'lifetime-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  return root;
}
const fm = (fields, body = '') => `---\n${fields}\n---\n\n${body}\n`;
const keys = (found) => found.map((f) => `${f.file} ${f.detail}`).sort();

const STALE = {
  'core/USER.md': '# User\n\n## Current focus\n- **Until 10-18: focus week**\n<!-- 2026-09-02: until 09-10 nothing — a comment, not a fact -->\n',
  'core/MEMORY.md': '# Memory\n\n- Every ADR (0001–0051) lives in archive/.\n',
  'docs/decisions/0054-latest.md': '# 0054\n',
  'outputs/2026-10-04_weekly-digest.md': fm('type: deliverable\ncreated: 2026-10-04\nexpires: 2026-10-18'),
  'reports/2026-10-20_model-prices.md': fm('type: report\ncreated: 2026-10-20\ntopic: "[[models]]"'),
  'reports/2026-09-01_orphan.md': fm('type: report\ncreated: 2026-09-01\ntopic: "[[nobody]]"'),
  'notes/models.md': fm('type: topic\ncreated: 2026-09-01\nupdated: 2026-10-01', 'See [[2026-10-20_model-prices]].'),
  'notes/focus-week.md': fm('type: memory\ncreated: 2026-10-11\nvalid_to: 2026-10-18\nstatus: seedling'),
  'notes/target-list.md': fm('type: topic\ncreated: 2026-09-29\nupdated: 2026-10-01'),
  'notes/target-list-v2.md': fm('type: topic\ncreated: 2026-10-10\nupdated: 2026-10-10'),
  'notes/project-x.md': fm('type: project\ncreated: 2026-08-18\nstatus: active', 'Every ADR (0001-0049) lives in `archive/`.'),
};

test('every failure the 2026-10-24 cleanup found by hand is found', (t) => {
  const root = vault(t, STALE);
  assert.deepEqual(keys(lifetimeFindings(root, { now: NOW })), [
    'core/MEMORY.md adr-range-stale',
    'core/USER.md date-passed',
    'notes/focus-week.md valid-to-passed',
    'notes/models.md topic-behind-report',
    'notes/project-x.md adr-range-stale',
    'notes/target-list-v2.md version-name',
    'notes/target-list.md version-name',
    'outputs/2026-10-04_weekly-digest.md deliverable-expired',
    'reports/2026-09-01_orphan.md report-unlinked',
  ]);
});

test('the same vault after the fixes is quiet', (t) => {
  const root = vault(t, {
    'core/USER.md': '# User\n\n## Current focus\n- Project X\n- The focus week (2026-10-11 → 10-18) is over.\n',
    'core/MEMORY.md': '# Memory\n\n- Every ADR (0001–0054) lives in archive/.\n',
    'docs/decisions/0054-latest.md': '# 0054\n',
    'outputs/2026-10-20_weekly-digest.md': fm('type: deliverable\ncreated: 2026-10-20\nexpires: 2026-11-19'),
    'reports/2026-10-20_model-prices.md': fm('type: report\ncreated: 2026-10-20\ntopic: "[[models]]"'),
    'notes/models.md': fm('type: topic\ncreated: 2026-09-01\nupdated: 2026-10-20', '| [[2026-10-20_model-prices\\|prices]] |'),
    'notes/focus-week.md': fm('type: memory\ncreated: 2026-10-11\nvalid_to: 2026-10-18\nsuperseded_by: "[[current-truth]]"'),
    'notes/target-list.md': fm('type: topic\ncreated: 2026-09-29\nupdated: 2026-10-12'),
    'notes/lesson-asking.md': fm('type: memory\ncreated: 2026-10-02'),
    'notes/lesson-asking-v2.md': fm('type: memory\ncreated: 2026-10-08'),
  });
  assert.deepEqual(keys(lifetimeFindings(root, { now: NOW })), []);
});

test('a topic page untouched for over 90 days is reported', (t) => {
  const root = vault(t, { 'notes/old.md': fm('type: topic\ncreated: 2026-01-01\nupdated: 2026-07-01') });
  assert.deepEqual(keys(lifetimeFindings(root, { now: NOW })), ['notes/old.md topic-untouched']);
});

test('the maintenance notice raises /curator with the counts', (t) => {
  const root = vault(t, { ...STALE, 'core/.vault-active': '' });
  const curator = maintenanceDue(root, { now: NOW }).find((i) => i.id === 'curator');
  assert.ok(curator, 'curator item present');
  assert.match(curator.why, /stale: .*1 deliverable-expired/);
  assert.match(curator.why, /2 adr-range-stale/);
});

test('the lifetime-sweep check lists only the files it was handed', (t) => {
  const root = vault(t, STALE);
  const check = CHECKS.find((c) => c.id === 'lifetime-sweep');
  const fired = check.run({ repoRoot: root, changedFiles: ['core/USER.md', 'notes/unrelated.md'] });
  assert.deepEqual(fired.map((f) => `${f.file} ${f.detail}`), ['core/USER.md date-passed']);
  assert.match(fired[0].message, /Until 10-18/);
});
