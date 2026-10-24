#!/usr/bin/env node
// maintenance.mjs — what vault upkeep is due, and the deterministic half of
// running it (ADR 0049).
//
//   node scripts/maintenance.mjs          list what is due and why (read-only)
//   node scripts/maintenance.mjs run      run the deterministic sweep
//
// The session-start hook shows the same list once a day and the agent asks
// the owner before anything runs. `run` is what the agent executes after a yes for
// the "sweep" item: the link sweep (writes logs/YYYY-MM-DD_link-sweep.md), the
// compiled checks over every note (writes check-fire ledger lines), the
// retrieval eval and the brain doctor (both read-only). `/curator`, `/audit`
// and lesson routing are judgment passes, so they stay skills; this script
// only names them.
//
// Nothing here is scheduled and nothing here commits. Exit code is always 0
// unless the arguments are wrong.

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { maintenanceDue } from '../.claude/hooks/lib.mjs';
import { runChecks } from '../.claude/hooks/checks.mjs';

// Same precedence as every other script: BRAIN_DIR env → the script's own
// location (scripts/ sits directly under the vault root).
const repoRoot = process.env.BRAIN_DIR?.trim() || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mode = args[0] || 'due';

const USAGE = [
  'Usage: node scripts/maintenance.mjs [due|run|--help]',
  '',
  'due  list what is due and why (the default; read-only)',
  'run  the deterministic sweep: link sweep (writes logs/YYYY-MM-DD_link-sweep.md),',
  '     compiled checks over every note (records new check-fire lines in',
  '     logs/signals/), retrieval eval and brain doctor (both read-only).',
  '     Commits nothing.',
].join('\n');

if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
if (!['due', 'run'].includes(mode) || args.length > 1) {
  console.error(`Unknown argument: ${args.join(' ')}\n\n${USAGE}`);
  process.exit(2);
}

function printDue() {
  const items = maintenanceDue(repoRoot);
  console.log('# Maintenance due\n');
  if (items.length === 0) {
    console.log('Nothing is due.');
    return;
  }
  for (const item of items) console.log(`- **${item.id}** → \`${item.run}\` — ${item.why}`);
}

function runNode(label, args) {
  console.log(`\n## ${label}\n`);
  try {
    const out = execFileSync(process.execPath, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 120000,
      windowsHide: true,
    });
    console.log(out.trim());
  } catch (err) {
    console.log(`failed: ${String(err.stderr || err.message).trim().split('\n')[0]}`);
  }
}

if (mode === 'due') {
  printDue();
  process.exit(0);
}

console.log('# Maintenance run');
runNode('Link sweep', [path.join('scripts', 'link-sweep.mjs')]);

console.log('\n## Compiled checks (every note)\n');
try {
  const files = readdirSync(path.join(repoRoot, 'notes'))
    .filter((n) => n.endsWith('.md'))
    .map((n) => `notes/${n}`);
  const { fired } = runChecks(repoRoot, { logTag: 'maintenance', changedFiles: files });
  if (fired.length === 0) {
    console.log(`No new findings across ${files.length} notes (repeats this month are not re-reported).`);
  } else {
    for (const f of fired) console.log(`- ${f.check}: ${f.file} — ${f.detail}`);
  }
} catch (err) {
  console.log(`failed: ${err.message}`);
}

runNode('Retrieval eval', [path.join('scripts', 'retrieval-eval.mjs')]);
runNode('Brain doctor', [path.join('scripts', 'brain-doctor.mjs')]);

console.log('');
printDue();
