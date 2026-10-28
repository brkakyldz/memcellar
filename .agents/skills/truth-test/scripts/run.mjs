#!/usr/bin/env node
/**
 * truth-test runner — asks the answer key's questions on a CLONE of the vault.
 *
 *   node run.mjs [--vault DIR] [--key FILE] [--out DIR] [--runtime claude|codex]
 *                [--model NAME] [--only Q1,Q4] [--dry-run]
 *
 * 1. Reads the key (default <vault>/.claude/eval/truth-questions.md).
 * 2. Clones the vault's committed state into <out>/vault, deletes .claude/eval/
 *    from the clone and commits that, so no session there can read the key.
 *    The live vault is only read (git clone), never written.
 * 3. Asks each question in a fresh headless session in the clone, with
 *    read-only tools only, and saves the answer, the files it read and the
 *    cost the runtime reports, to <out>/answers.json and <out>/answers.md.
 *
 * Scoring is not done here: the /truth-test skill compares each answer with
 * the key. --dry-run prints the plan and a cost estimate and runs nothing.
 * Exit 0 = all questions asked, 1 = some failed to run, 2 = cannot start.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_VAULT = path.resolve(HERE, '..', '..', '..', '..');

// ## Q3 — label
// - question: ...
// - expected: ...
// - trap: yes — what stale pages said     (optional)
export function parseKey(text) {
  const out = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const h = /^##\s+(Q\d+)\b\s*[—–-]?\s*(.*)$/.exec(line);
    if (h) {
      cur = { id: h[1], label: h[2].trim(), question: '', expected: '', trap: false, trapNote: '' };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    const f = /^\s*[-*]\s*(question|expected|trap)\s*:\s*(.*)$/i.exec(line);
    if (f) {
      const key = f[1].toLowerCase();
      if (key === 'trap') {
        cur.trap = /^(yes|true|y)\b/i.test(f[2].trim());
        cur.trapNote = f[2].replace(/^(yes|true|y)\b\s*[—–-]?\s*/i, '').trim();
        cur.lastKey = 'trapNote';
      } else {
        cur[key] = f[2].trim();
        cur.lastKey = key;
      }
    } else if (/^\s{2,}\S/.test(line) && cur.lastKey) {
      cur[cur.lastKey] = `${cur[cur.lastKey]} ${line.trim()}`.trim();
    } else if (line.trim() === '') {
      cur.lastKey = null;
    }
  }
  for (const q of out) delete q.lastKey;
  return out.filter((q) => q.question);
}

// Claude Code --output-format stream-json --verbose: one JSON event per line.
export function parseClaudeStream(text) {
  const files = new Set();
  const searches = [];
  let answer = '';
  let cost = null;
  let turns = null;
  let ok = false;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    if (ev.type === 'assistant' && Array.isArray(ev.message?.content)) {
      for (const c of ev.message.content) {
        if (c.type !== 'tool_use') continue;
        if (c.name === 'Read' && c.input?.file_path) files.add(c.input.file_path);
        if ((c.name === 'Grep' || c.name === 'Glob') && c.input) searches.push(`${c.name} ${c.input.pattern ?? ''}${c.input.path ? ` in ${c.input.path}` : ''}`.trim());
      }
    }
    if (ev.type === 'result') {
      answer = typeof ev.result === 'string' ? ev.result : '';
      cost = typeof ev.total_cost_usd === 'number' ? ev.total_cost_usd : null;
      turns = ev.num_turns ?? null;
      ok = ev.subtype === 'success' && !ev.is_error;
    }
  }
  return { ok, answer, files: [...files], searches, cost, turns };
}

// Paths read in the clone, made relative to it (the report names vault pages).
export function relativeTo(root, files) {
  const norm = (p) => path.resolve(p).replace(/\\/g, '/').toLowerCase();
  const base = `${norm(root)}/`;
  return files.map((f) => {
    const n = path.resolve(root, f).replace(/\\/g, '/');
    return n.toLowerCase().startsWith(base) ? n.slice(base.length) : f;
  });
}

// Mean cost per question of the latest results file, if any — the estimate.
export function estimate(questions, previousAnswers) {
  const costs = (previousAnswers ?? []).map((a) => a.cost).filter((c) => typeof c === 'number');
  const mean = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null;
  return { questions: questions.length, perQuestion: mean, total: mean === null ? null : mean * questions.length, basis: costs.length ? `mean of ${costs.length} earlier answer(s)` : 'no earlier run' };
}

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').trim()}`);
  return r.stdout;
}

export function prepareClone(vault, out) {
  const clone = path.join(out, 'vault');
  if (fs.existsSync(clone)) throw new Error(`${clone} already exists — pick an empty --out`);
  fs.mkdirSync(out, { recursive: true });
  git(out, 'clone', '--quiet', '--no-hardlinks', vault, clone);
  const evalDir = path.join(clone, '.claude', 'eval');
  if (fs.existsSync(evalDir)) {
    fs.rmSync(evalDir, { recursive: true, force: true });
    git(clone, '-c', 'user.name=truth-test', '-c', 'user.email=truth-test@localhost', 'commit', '--quiet', '-am', 'truth-test: answer key removed from this clone');
  }
  // Sessions in the clone should start like the owner's: the SessionStart hook
  // injects Tier 0 only when this per-clone marker exists.
  const marker = path.join(vault, 'core', '.vault-active');
  if (fs.existsSync(marker)) fs.copyFileSync(marker, path.join(clone, 'core', '.vault-active'));
  return clone;
}

const READ_ONLY = { claude: ['Read', 'Grep', 'Glob'] };

export function askCommand(runtime, question, { model } = {}) {
  if (runtime === 'codex') {
    // Follows `codex exec` as documented; not exercised in the reference instance.
    return { exe: 'codex', args: ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', ...(model ? ['-m', model] : []), question] };
  }
  return {
    exe: 'claude',
    args: ['-p', question, '--output-format', 'stream-json', '--verbose', '--allowedTools', ...READ_ONLY.claude,
      '--disallowedTools', 'Bash', 'Edit', 'Write', 'NotebookEdit', 'WebFetch', 'WebSearch',
      '--strict-mcp-config', '--no-session-persistence', ...(model ? ['--model', model] : [])],
  };
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name, dflt = '') => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
  };
  const vault = path.resolve(opt('vault', DEFAULT_VAULT));
  const keyPath = path.resolve(vault, opt('key', path.join('.claude', 'eval', 'truth-questions.md')));
  const runtime = opt('runtime', 'claude');
  const model = opt('model');
  const today = new Date().toISOString().slice(0, 10);
  const out = path.resolve(opt('out', path.join(os.tmpdir(), `truth-test-${today}-${process.pid}`)));
  const only = opt('only').split(',').map((s) => s.trim()).filter(Boolean);

  if (!['claude', 'codex'].includes(runtime)) return fail(`--runtime must be claude or codex, not ${runtime}`);
  if (!fs.existsSync(keyPath)) return fail(`no answer key at ${keyPath} — write one first (see the /truth-test skill)`);
  let questions = parseKey(fs.readFileSync(keyPath, 'utf8'));
  if (only.length) questions = questions.filter((q) => only.includes(q.id));
  if (!questions.length) return fail('the key holds no question (## Q<n> headings with a "- question:" line)');

  const resultsDir = path.join(vault, '.claude', 'eval', 'results');
  let previous = null;
  if (fs.existsSync(resultsDir)) {
    const last = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json')).sort().pop();
    if (last) previous = JSON.parse(fs.readFileSync(path.join(resultsDir, last), 'utf8')).answers;
  }
  const est = estimate(questions, previous);
  const dirty = spawnSync('git', ['status', '--porcelain', '--', 'notes', 'core', 'INDEX.md', 'reports'], { cwd: vault, encoding: 'utf8' }).stdout?.trim();
  console.log(`truth-test: ${questions.length} question(s) (${questions.filter((q) => q.trap).length} trap), runtime ${runtime}${model ? `, model ${model}` : ', its default model'}`);
  console.log(`vault: ${vault}  →  clone in ${out}`);
  console.log(`cost estimate: ${est.total === null ? 'unknown (no earlier run to measure from)' : `about $${est.total.toFixed(2)} ($${est.perQuestion.toFixed(3)} per question, ${est.basis})`}`);
  if (dirty) console.log('note: uncommitted changes in notes/, core/, reports/ or INDEX.md are NOT in the clone — commit first to test them');
  if (args.includes('--dry-run')) {
    for (const q of questions) console.log(`  ${q.id}${q.trap ? ' (trap)' : ''}: ${q.question}`);
    console.log('dry run: nothing cloned, nothing asked');
    return 0;
  }

  let clone;
  try {
    clone = prepareClone(vault, out);
  } catch (err) {
    return fail(err.message);
  }
  const answers = [];
  let failed = 0;
  for (const q of questions) {
    const { exe, args: a } = askCommand(runtime, q.question, { model });
    const started = Date.now();
    const r = spawnSync(exe, a, { cwd: clone, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
    const ms = Date.now() - started;
    let parsed;
    if (r.error) parsed = { ok: false, answer: '', files: [], searches: [], cost: null, turns: null, error: r.error.message };
    else if (runtime === 'claude') parsed = parseClaudeStream(r.stdout ?? '');
    else parsed = { ok: r.status === 0, answer: (r.stdout ?? '').trim(), files: [], searches: [], cost: null, turns: null };
    if (!parsed.ok) {
      failed++;
      parsed.error ??= `exit ${r.status}: ${(r.stderr ?? '').trim().split('\n').slice(-3).join(' | ')}`;
    }
    parsed.files = relativeTo(clone, parsed.files);
    answers.push({ id: q.id, question: q.question, expected: q.expected, trap: q.trap, trapNote: q.trapNote, ...parsed, ms });
    console.log(`${q.id}: ${parsed.ok ? 'answered' : 'FAILED'} in ${(ms / 1000).toFixed(0)}s, ${parsed.files.length} file(s) read${parsed.cost !== null ? `, $${parsed.cost.toFixed(3)}` : ''}`);
  }
  const total = answers.reduce((s, x) => s + (x.cost ?? 0), 0);
  const record = { date: today, runtime, model: model || 'default', vaultHead: git(vault, 'rev-parse', '--short', 'HEAD').trim(), clone, totalCost: total, answers };
  fs.writeFileSync(path.join(out, 'answers.json'), `${JSON.stringify(record, null, 2)}\n`);
  const md = [`# truth-test answers — ${today}`, '', `vault ${record.vaultHead}, runtime ${runtime}, total cost $${total.toFixed(2)}`, ''];
  for (const x of answers) {
    md.push(`## ${x.id}${x.trap ? ' (trap)' : ''}`, '', `**Question:** ${x.question}`, '', `**Expected:** ${x.expected}`, '', `**Answer:** ${x.ok ? x.answer : `FAILED — ${x.error}`}`, '', `**Read:** ${x.files.join(', ') || '—'}`, '');
  }
  fs.writeFileSync(path.join(out, 'answers.md'), md.join('\n'));
  console.log(`\nanswers → ${path.join(out, 'answers.md')} (and answers.json); total cost $${total.toFixed(2)}`);
  return failed ? 1 : 0;
}

function fail(msg) {
  console.error(msg);
  return 2;
}

// True when this file is the script node was asked to run. Compared as real
// paths: called through a skill link (a junction or symlink), argv[1] is the
// link's path while import.meta.url is the target's, and a plain comparison
// would make the script exit silently.
function isMain() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  process.exitCode = main();
}
