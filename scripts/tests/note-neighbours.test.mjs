// Tests for scripts/note-neighbours.mjs, the neighbour step of the write gate
// (ADR 0055). Each case writes a throwaway vault in the OS temp dir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadPages, neighbours, parseArgs, tokens } from '../note-neighbours.mjs';

function vault(t, files) {
  const root = mkdtempSync(path.join(tmpdir(), 'neighbours-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  return root;
}
const page = (type, extra = '', body = '') => `---\ntype: ${type}\ncreated: 2026-10-01\n${extra}---\n\n${body}\n`;
const run = (root, argv) => neighbours(loadPages(root), parseArgs(argv));

test('a second list for the same subject is found and flagged as a version', (t) => {
  const root = vault(t, {
    'notes/job-target-list.md': page('topic', 'tags: [career]\n'),
    'notes/job-target-list-v2.md': page('topic', 'tags: [career]\n'),
    'notes/hotel-platforms.md': page('topic'),
  });
  const found = run(root, ['job target list']);
  assert.deepEqual(found.map((r) => r.slug).sort(), ['job-target-list', 'job-target-list-v2']);
  const v2 = found.find((r) => r.slug === 'job-target-list-v2');
  assert.match(v2.flags.join(' '), /version of job-target-list/);
});

test('reports on one subject are never flagged as versions', (t) => {
  const root = vault(t, {
    'reports/2026-09-01_model-pricing.md': page('report'),
    'reports/2026-10-01_model-pricing.md': page('report'),
  });
  const found = run(root, ['model pricing']);
  assert.equal(found.length, 2);
  assert.ok(found.every((r) => !r.flags), JSON.stringify(found.map((r) => r.flags)));
});

test('an alias in the owner\'s language finds an English page', (t) => {
  const root = vault(t, {
    'notes/job-search.md': page('topic', 'aliases: [iş arama, İş ilanları]\n'),
  });
  const found = run(root, ['iş ilanları']);
  assert.equal(found[0]?.slug, 'job-search');
  assert.deepEqual(tokens('İŞ İLANLARI'), ['iş', 'ilanlari']);
});

test('--slug adds pages linked in either direction, even with no title overlap', (t) => {
  const root = vault(t, {
    'notes/codex-routing.md': page('topic', '', 'Workers per [[runtime-policy]].'),
    'notes/runtime-policy.md': page('decision', '', 'See [[model-choice]].'),
    'notes/model-choice.md': page('topic'),
    'notes/unrelated.md': page('topic'),
  });
  const found = run(root, ['--slug', 'runtime-policy']);
  assert.deepEqual(found.map((r) => r.slug).sort(), ['codex-routing', 'model-choice']);
});

test('one shared word in a long title is not a neighbour; archive/ is never scanned', (t) => {
  const root = vault(t, {
    'notes/linkedin-brand-strategy-for-agent-builders.md': page('topic'),
    'archive/job-search.md': page('topic'),
  });
  assert.equal(run(root, ['job search']).length, 0);
});

test('arguments: words or --slug are required; unknown flags fail', () => {
  assert.throws(() => parseArgs([]), /subject words or --slug/);
  assert.throws(() => parseArgs(['x', '--bogus']), /unknown argument --bogus/);
  assert.deepEqual(parseArgs(['a', 'b', '--tags', 'X, y']).tags, ['x', 'y']);
});
