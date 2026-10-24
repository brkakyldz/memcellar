#!/usr/bin/env node
// SessionStart hook: pull latest vault state, then inject Tier-0 context.
// Fail-open by design (ADR 0004): every code path must exit 0.

import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  existsSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  budgetUsage,
  enterBrainLock,
  exitBrainLock,
  isVaultActive,
  logLine as libLogLine,
  backupNotice,
  maintenanceNotice,
  emitNotices,
} from './lib.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEADER = '## Second Brain — session context (auto-injected)';

// Brain-root resolution precedence (ADR 0008): BRAIN_DIR env → the script's
// own location. This file always lives at
// <vault>/.claude/hooks/session-start.mjs, so its location is always the
// vault root — this makes the same script correct when invoked from any cwd
// by a user-level hook as well as from inside the vault itself.
// CLAUDE_PROJECT_DIR is never the brain root here: it names the session's
// project (below).
function getRepoRoot() {
  const fromBrainDir = process.env.BRAIN_DIR;
  if (fromBrainDir && fromBrainDir.trim() !== '') {
    return fromBrainDir;
  }
  // script lives at <repoRoot>/.claude/hooks/session-start.mjs
  return path.resolve(__dirname, '../..');
}

// The session's own project dir — the cwd the runtime is actually working
// in for this session. Claude Code sets CLAUDE_PROJECT_DIR; the Codex adapter
// (.codex/hooks/session-start.mjs) sets it from its cwd. If the hook is wired
// at user level it fires in every project; outside the vault it does nothing
// at all (ADR 0052).
function getProjectDir() {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;
  if (fromEnv && fromEnv.trim() !== '') {
    return fromEnv;
  }
  return process.cwd();
}

// Read stdin without ever hanging: SessionStart hooks may receive a small
// JSON payload on stdin, or nothing at all (manual invocation, empty pipe).
function readStdin(timeoutMs = 200) {
  return new Promise((resolve) => {
    let data = '';
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(data);
    };
    try {
      if (process.stdin.isTTY) {
        // Interactive terminal with no piped input — nothing to read.
        finish();
        return;
      }
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        data += chunk;
      });
      process.stdin.on('end', finish);
      process.stdin.on('error', finish);
      const t = setTimeout(finish, timeoutMs);
      if (typeof t.unref === 'function') t.unref();
      process.stdin.resume();
    } catch {
      finish();
    }
  });
}

// Delegates to lib's writer so this hook gets the same log rotation and
// severity levels as the rest — it used to hand-roll an identical append and
// so was the one path that could grow .automation.log without bound.
function logLine(repoRoot, line, level) {
  libLogLine(repoRoot, 'SessionStart', line, level);
}

function summarizeError(err) {
  if (!err) return 'unknown error';
  if (err.killed || err.signal) {
    return `git command killed/timed out (${err.signal || 'timeout'})`;
  }
  const stderr = err.stderr ? String(err.stderr).trim() : '';
  const stdout = err.stdout ? String(err.stdout).trim() : '';
  const msg = stderr || stdout || err.message || 'unknown error';
  return msg.split('\n')[0].slice(0, 200);
}

function getGitDir(repoRoot) {
  try {
    const out = execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd: repoRoot,
      timeout: 10000,
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
    return path.isAbsolute(out) ? out : path.join(repoRoot, out);
  } catch {
    return null;
  }
}

// Runs `git pull --rebase` on a clean tree under the shared brain lock. Never
// throws. Returns { ok, skipped, warning }. On failure, checks for a
// stuck/conflicted rebase and aborts it so the tree is never left mid-rebase.
//
// The lock matters here: every Claude Code and Codex session on this machine
// runs this hook against the one vault repo, and two concurrent pulls both write
// .git/FETCH_HEAD, leaving it with several for-merge entries - which is what
// "fatal: Cannot rebase onto multiple branches" actually is. A skipped pull is
// harmless: the job holding the lock is pulling the same repo right now.
function runGitPull(repoRoot) {
  if (!enterBrainLock(repoRoot, 'SessionStart', 'SessionStart')) {
    return { ok: false, skipped: true, warning: null };
  }
  try {
    return pullUnderLock(repoRoot);
  } finally {
    exitBrainLock(repoRoot);
  }
}

// Tracked, uncommitted changes belong to a live task — possibly in the other
// runtime (ADR 0044). `--autostash` used to lift them off the disk for the
// pull and put them back; when the put-back failed they were stranded in a
// stash while their owner kept working (2026-09-22). So a dirty tree skips the
// pull outright: a stale session start is cheap, another task's files are not.
function trackedChanges(repoRoot) {
  try {
    return execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      cwd: repoRoot,
      timeout: 10000,
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
  } catch {
    return 'unknown';
  }
}

// A rebase, merge, cherry-pick or revert that another task left stopped can
// have a clean tree, so the dirty check passes it. Pulling on top of it fails,
// and the failure path below used to run `git rebase --abort` on that task's
// state (2026-10-06 review, fixture T6). Anything already in progress is
// someone else's, so the pull is skipped outright.
function operationInProgress(repoRoot) {
  const gitDir = getGitDir(repoRoot);
  if (!gitDir) return null;
  for (const marker of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) {
    if (existsSync(path.join(gitDir, marker))) return marker;
  }
  return null;
}

function pullUnderLock(repoRoot) {
  const inProgress = operationInProgress(repoRoot);
  if (inProgress) {
    logLine(repoRoot, `pull skipped: ${inProgress} present — another task's git operation is in progress`);
    return { ok: false, skipped: true, warning: null };
  }
  const dirty = trackedChanges(repoRoot);
  if (dirty) {
    const count = dirty === 'unknown' ? '?' : dirty.split(/\r?\n/).length;
    logLine(repoRoot, `pull skipped: ${count} tracked path(s) uncommitted — a live task owns them`);
    return { ok: false, skipped: true, warning: null };
  }
  try {
    execFileSync('git', ['pull', '--rebase'], {
      cwd: repoRoot,
      timeout: 25000,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
    });
    logLine(repoRoot, 'pull ok');
    return { ok: true, skipped: false, warning: null };
  } catch (err) {
    const reason = summarizeError(err);
    logLine(repoRoot, `pull failed: ${reason}`);

    try {
      const status = execFileSync('git', ['status', '--porcelain'], {
        cwd: repoRoot,
        timeout: 10000,
        encoding: 'utf8',
        windowsHide: true,
      });
      const hasConflictMarkerStatus = /^(UU|AA|DD|AU|UA|UD|DU) /m.test(status);
      const gitDir = getGitDir(repoRoot);
      const rebaseInProgress =
        gitDir &&
        (existsSync(path.join(gitDir, 'rebase-merge')) ||
          existsSync(path.join(gitDir, 'rebase-apply')));

      if (hasConflictMarkerStatus || rebaseInProgress) {
        try {
          execFileSync('git', ['rebase', '--abort'], {
            cwd: repoRoot,
            timeout: 10000,
            encoding: 'utf8',
            windowsHide: true,
          });
          logLine(repoRoot, 'conflict detected — rebase aborted, tree restored');
        } catch (abortErr) {
          logLine(repoRoot, `rebase --abort failed: ${summarizeError(abortErr)}`);
        }
      }
    } catch (statusErr) {
      logLine(repoRoot, `git status check failed: ${summarizeError(statusErr)}`);
    }

    return { ok: false, skipped: false, warning: reason };
  }
}

function readFileSafe(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

// The HTML comments at the head of MEMORY.md and USER.md are instructions to
// whoever *writes* those files — budgets, what does not belong there, which
// ADR decided it. They are not facts about the owner or the world, the budget
// counter already excludes them (`countBudgetChars`), and injecting them spent
// ~600 bytes of a payload measured against a threshold that turns Tier 0 off.
// Stripped here so what is counted and what is delivered are the same text.
function stripWriterComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "").replace(/\r\n?/g, "\n");
}

function normalizeForCompare(p) {
  return path.resolve(p).replace(/[\\/]+$/, '').toLowerCase();
}

// Inside means the vault root or a folder under it. A vault worktree elsewhere
// counts as outside, which is the safe side: it gets nothing injected.
function isInsideVault(projectDir, repoRoot) {
  const dir = normalizeForCompare(projectDir);
  const root = normalizeForCompare(repoRoot);
  return dir === root || dir.startsWith(root + path.sep) || dir.startsWith(root + '/');
}

function section(text, { label = 'section', optional = false } = {}) {
  return { text, label, optional };
}

function buildContext(repoRoot, pullResult) {
  const sections = [];

  let header = HEADER;
  // A skipped pull is not a failure worth a warning - the lock holder is
  // pulling the same repo. Only a real failure gets surfaced to the model.
  if (!pullResult.ok && !pullResult.skipped) {
    header += `\n⚠ git pull failed (${pullResult.warning}) — working from local state`;
  }
  // Sections carry a label and whether they may be dropped when the payload
  // is over the limit. Core content (the Tier-0 files) is never optional.
  sections.push(section(header, { label: 'header' }));

  // Payload budget: the harness persists hook output above ~10KB to a side
  // file and injects only a ~2KB preview — an oversized payload silently
  // un-loads Tier 0. OPEN_QUESTIONS is a pointer rather than inlined, to stay
  // under the threshold.
  const coreFiles = ['IDENTITY.md', 'USER.md', 'MEMORY.md'];
  // Each budgeted file is headed by its own usage, so the agent knows how much
  // room it has left *before* it writes (ADR 0030). A warning after the write
  // arrives after the damage; this arrives before it. Fail-open (ADR 0004):
  // a meter that cannot be computed costs a label, never the payload.
  let usage = [];
  try {
    usage = budgetUsage(repoRoot);
  } catch {
    usage = [];
  }
  for (const name of coreFiles) {
    const content = readFileSafe(path.join(repoRoot, 'core', name));
    if (content === null) continue;
    const b = usage.find((u) => u.file === name);
    const over = b && b.count > b.limit;
    const meter = b
      ? ` — ${b.count}/${b.limit} chars (${b.pct}%)` +
        (over ? ' ⚠ OVER BUDGET, consolidate before adding' : '')
      : '';
    sections.push(section(`### ${name}${meter}\n${stripWriterComments(content).trim()}`));
  }

  sections.push(
    section(
      `### OPEN_QUESTIONS.md\nNot inlined — read ${path.join(repoRoot, 'core', 'OPEN_QUESTIONS.md')} before planning vault work.`,
      { label: 'open-questions-pointer' }
    )
  );

  // Two things a session start volunteers, through the shared daily notice
  // budget. Backup failures are priority 0, because they are the one thing no
  // later session can recover. The maintenance-due line (ADR 0049) is
  // priority 3 and shown once a day: it says what is due and why, and the
  // agent asks the owner before running any of it.
  //
  // A notice is only recorded as shown once it is in the final payload. The
  // first pass asks which notices the daily budget allows without writing the
  // sidecar; fitPayload may then drop optional sections; only the survivors
  // are recorded. Recording first and fitting second marked a dropped notice
  // as shown, so every later session that day suppressed a notice nobody had
  // seen — precisely on the days core/ was near budget (2026-10-06 review).
  const candidates = [backupNotice(repoRoot), maintenanceNotice(repoRoot)];
  const allowed = emitNotices(repoRoot, candidates, { record: false, logTag: 'SessionStart' });
  const noticeLabel = (line) => (line.startsWith('Maintenance due') ? 'maintenance' : 'backup');
  for (const line of allowed) {
    const label = noticeLabel(line);
    const title = label === 'maintenance' ? 'Maintenance' : 'Backup';
    sections.push(section(`### ${title}\n${line}`, { label: `${label}-notice`, optional: true }));
  }

  const { payload, kept } = fitPayload(repoRoot, sections);
  const delivered = allowed.filter((line) => kept.includes(`${noticeLabel(line)}-notice`));
  if (delivered.length > 0) {
    const deliveredCandidates = candidates.filter((c) => c && delivered.includes(c.text));
    emitNotices(repoRoot, deliveredCandidates);
    for (const line of delivered) logLine(repoRoot, `${noticeLabel(line)} notice shown: ${line}`);
  }
  for (const line of allowed.filter((l) => !delivered.includes(l))) {
    logLine(repoRoot, `${noticeLabel(line)} notice not shown (dropped for payload size) — left unrecorded so a later session can deliver it`, 'warn');
  }

  return payload;
}

// Both harnesses now document the cap this guards (checked 2026-10-13).
// Claude Code: an `additionalContext`
// string over 10,000 characters is saved to a side file and the model sees only
// a 2,000-character preview, with no setting to raise it
// (code.claude.com/docs/en/hooks). Codex: about 2,500 tokens per hook message
// unless `additionalContextLimit` says otherwise (learn.chatgpt.com/docs/hooks).
// Over either cap Tier 0
// silently un-loads, so this measures the whole serialized hook output, JSON
// envelope included: always at least the character count Claude measures and
// the UTF-8 bytes Codex's estimate divides by four. It logs the figure on every
// run and never truncates anything silently.
//
// Over the limit, optional sections are dropped whole, newest first: the
// backup and maintenance notices lose their space before a Tier-0 file
// does. If only core content is left it is delivered oversized
// and loudly logged — half a MEMORY.md is worse than a payload the harness
// may or may not shorten.
const PAYLOAD_SOFT_LIMIT_BYTES = 9500;

function serializedSize(payload) {
  const envelope = {
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: payload },
  };
  return Buffer.byteLength(JSON.stringify(envelope), 'utf8');
}

function fitPayload(repoRoot, sections) {
  const kept = [...sections];
  const join = () => kept.map((x) => x.text).join(String.fromCharCode(10, 10));
  let size = serializedSize(join());
  const dropped = [];

  while (size > PAYLOAD_SOFT_LIMIT_BYTES && kept.some((x) => x.optional)) {
    let idx = -1;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (kept[i].optional) {
        idx = i;
        break;
      }
    }
    dropped.push(kept[idx].label);
    kept.splice(idx, 1);
    size = serializedSize(join());
  }

  logLine(repoRoot, `context payload ${size}B serialized (soft limit ${PAYLOAD_SOFT_LIMIT_BYTES}B under the documented 10,000-character cap)`);
  if (dropped.length > 0) {
    logLine(repoRoot, `payload over the limit — dropped optional section(s): ${dropped.join(', ')}`, 'warn');
  }
  if (size > PAYLOAD_SOFT_LIMIT_BYTES) {
    logLine(
      repoRoot,
      `context payload ${size}B is over the limit with only core content left — consolidate core/ rather than leaving it to the harness to decide what arrives`,
      'warn'
    );
  }
  return { payload: join(), kept: kept.map((x) => x.label) };
}

function emit(additionalContext) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext,
    },
  };
  process.stdout.write(JSON.stringify(output));
}

// The flush sweep that used to live here was removed with the flush mechanism
// itself (ADR 0038). SessionStart now pulls, injects
// Tier 0, and stops — nothing is spawned, and stdin is read only to satisfy
// the hook protocol.
async function main() {
  await readStdin();
  const repoRoot = getRepoRoot();
  const projectDir = getProjectDir();
  // Projects and the vault are walled off (ADR 0052): a session outside the
  // vault gets no pull, no context and no log line — the hook touches nothing.
  if (!isInsideVault(projectDir, repoRoot)) {
    process.exit(0);
  }
  logLine(repoRoot, 'run started');

  if (!isVaultActive(repoRoot)) {
    logLine(repoRoot, 'no core/.vault-active marker — inert, no pull and no context injected');
    process.exit(0);
  }

  const pullResult = runGitPull(repoRoot);
  const context = buildContext(repoRoot, pullResult);

  emit(context);
  process.exit(0);
}

main().catch((err) => {
  try {
    const repoRoot = getRepoRoot();
    logLine(
      repoRoot,
      `unexpected error: ${err && err.stack ? err.stack.split('\n')[0] : String(err)}`,
      'ERROR'
    );
  } catch {
    // ignore — logging must never throw
  }
  try {
    emit(`${HEADER}\n⚠ hook encountered an unexpected error — proceeding without full context.`);
  } catch {
    // last resort: still exit 0
  }
  process.exit(0);
});
