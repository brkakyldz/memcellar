#!/usr/bin/env node
// Regression coverage for three SessionStart defects found by a 2026-10-06
// review of the reference instance:
//
//   1. a notice dropped by fitPayload was still recorded as shown, so every
//      later session that day suppressed a notice nobody had seen;
//   2. the Tier-0 budget counted `\r`, so a git-rewritten (CRLF) core file read
//      as over budget with identical content;
//   3. a rebase another task had left stopped with a clean tree was aborted by
//      the pull's failure path.
//
// Every case runs against a throwaway vault in the OS temp dir with a copy of
// the live hooks; the real vault is never touched.
//
// Run: node scripts/tests/session-start.test.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, cpSync, utimesSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HOOKS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude', 'hooks');
const results = [];
let failures = 0;
const check = (name, condition, detail) => {
  results.push({ name, ok: !!condition, detail });
  if (!condition) failures += 1;
};
const git = (cwd, args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const tmpRoots = [];
function makeVault({ memoryChars = 400, crlf = false, oldLogs = 0, withGit = true, activatedDaysAgo = 60 } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'session-start-test-'));
  tmpRoots.push(root);
  mkdirSync(path.join(root, '.claude'), { recursive: true });
  cpSync(HOOKS, path.join(root, '.claude', 'hooks'), { recursive: true });
  mkdirSync(path.join(root, 'core'));
  mkdirSync(path.join(root, 'logs'));
  mkdirSync(path.join(root, 'notes'));
  writeFileSync(path.join(root, 'core', '.vault-active'), '1\n');
  // The marker's date is when the vault went live; a pass that never ran is
  // due only once the vault is older than the pass's interval.
  const activated = new Date(Date.now() - activatedDaysAgo * 24 * 60 * 60 * 1000);
  utimesSync(path.join(root, 'core', '.vault-active'), activated, activated);
  let memory = '# Memory\n\n';
  while (memory.length < memoryChars) memory += '- Çalışma notu: öğrenilen şey ışığında güncellendi → [[x]]\n';
  const files = {
    'IDENTITY.md': '# Identity\n\nTest vault.\n',
    'USER.md': '# User\n\nA test user.\nSecond line.\n',
    'MEMORY.md': memory.slice(0, memoryChars),
    'OPEN_QUESTIONS.md': '# Open Questions\n',
  };
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(path.join(root, 'core', name), crlf ? text.replace(/\n/g, '\r\n') : text);
  }
  for (let i = 0; i < oldLogs; i++) {
    writeFileSync(path.join(root, 'logs', `2026-01-${String(10 + i).padStart(2, '0')}_0000.md`), '# log\n');
  }
  writeFileSync(path.join(root, '.gitignore'), '.claude/.maintenance.json\nlogs/.automation.log*\nscripts/.brain.lock\n');
  if (withGit) {
    git(root, ['init', '-q', '-b', 'main']);
    git(root, ['config', 'user.email', 'test@example.invalid']);
    git(root, ['config', 'user.name', 'test']);
    git(root, ['config', 'core.autocrlf', 'false']);
    git(root, ['add', '.']);
    git(root, ['commit', '-q', '-m', 'fixture']);
  }
  return root;
}

function runHook(root) {
  const out = execFileSync(process.execPath, [path.join(root, '.claude', 'hooks', 'session-start.mjs')], {
    cwd: root,
    input: '{}',
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, BRAIN_DIR: root, CLAUDE_PROJECT_DIR: root },
  });
  return JSON.parse(out).hookSpecificOutput.additionalContext;
}
const sidecarKeys = (root) => {
  const file = path.join(root, '.claude', '.maintenance.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).notices.keys : [];
};

try {
  // 1a. A notice that fits is delivered once and recorded once.
  {
    const root = makeVault({ oldLogs: 3 });
    const first = runHook(root);
    const second = runHook(root);
    check('fitting maintenance notice is delivered', first.includes('### Maintenance'));
    check('delivered notice is recorded', sidecarKeys(root).includes('maintenance-due'), JSON.stringify(sidecarKeys(root)));
    check('recorded notice is suppressed later the same day', !second.includes('### Maintenance'));
  }

  // 1a'. A vault activated today opens without a maintenance line: nothing
  // has had time to fall due, and "never run" is not outstanding work.
  {
    const root = makeVault({ activatedDaysAgo: 0 });
    const ctx = runHook(root);
    check('fresh vault shows no maintenance notice', !ctx.includes('### Maintenance'));
  }

  // 1b. A notice dropped for payload size is left unrecorded.
  {
    const root = makeVault({ oldLogs: 3, memoryChars: 9000 });
    const ctx = runHook(root);
    check('oversized payload drops the maintenance notice', !ctx.includes('### Maintenance'));
    check('dropped notice is not recorded as shown', !sidecarKeys(root).includes('maintenance-due'), JSON.stringify(sidecarKeys(root)));
  }

  // 2. CRLF and LF copies of the same core files count the same.
  {
    const lf = makeVault({ withGit: false });
    const crlf = makeVault({ crlf: true, withGit: false });
    const lib = await import(pathToFileURL(path.join(lf, '.claude', 'hooks', 'lib.mjs')).href);
    const a = lib.budgetUsage(lf).map((u) => `${u.file}:${u.count}`).join(',');
    const b = lib.budgetUsage(crlf).map((u) => `${u.file}:${u.count}`).join(',');
    check('budget count ignores line endings', a === b, `LF ${a} vs CRLF ${b}`);
  }

  // 3. A stopped rebase with a clean tree survives the hook.
  {
    const root = makeVault();
    const bare = mkdtempSync(path.join(os.tmpdir(), 'session-start-origin-'));
    tmpRoots.push(bare);
    git(bare, ['init', '-q', '--bare']);
    git(root, ['remote', 'add', 'origin', bare]);
    git(root, ['push', '-q', '-u', 'origin', 'main']);
    for (const n of ['c2', 'c3']) {
      writeFileSync(path.join(root, 'notes', `${n}.md`), `# ${n}\n`);
      git(root, ['add', '.']);
      git(root, ['commit', '-q', '-m', n]);
    }
    try {
      git(root, ['rebase', '--exec', 'false', 'HEAD~2']);
    } catch {
      // stops on the failing exec step, as intended
    }
    const marker = path.join(root, '.git', 'rebase-merge');
    check('fixture: a rebase is in progress', existsSync(marker));
    runHook(root);
    check("hook leaves another task's rebase in place", existsSync(marker));
    try {
      git(root, ['rebase', '--abort']);
    } catch {
      // cleanup only
    }
  }

  // 4. Outside the vault the hook is silent and touches nothing (ADR 0052).
  {
    const root = makeVault({ oldLogs: 3 });
    const project = mkdtempSync(path.join(os.tmpdir(), 'project-'));
    tmpRoots.push(project);
    const out = execFileSync(process.execPath, [path.join(root, '.claude', 'hooks', 'session-start.mjs')], {
      cwd: project,
      input: '{}',
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, BRAIN_DIR: root, CLAUDE_PROJECT_DIR: project },
    });
    check('outside the vault nothing is injected', out.trim() === '', out.slice(0, 120));
    check('outside the vault no notice is recorded', sidecarKeys(root).length === 0, JSON.stringify(sidecarKeys(root)));
    const inner = execFileSync(process.execPath, [path.join(root, '.claude', 'hooks', 'session-start.mjs')], {
      cwd: root,
      input: '{}',
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, BRAIN_DIR: root, CLAUDE_PROJECT_DIR: path.join(root, 'notes') },
    });
    check('a folder under the vault still gets Tier 0', inner.includes('### USER.md'));
  }
} finally {
  for (const r of tmpRoots) rmSync(r, { recursive: true, force: true });
}

for (const r of results) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`);
}
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures > 0 ? 1 : 0);
