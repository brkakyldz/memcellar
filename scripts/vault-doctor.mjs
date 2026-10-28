#!/usr/bin/env node
// vault-doctor.mjs — read-only operational diagnosis for the vault path of
// both runtimes, Claude Code and Codex (ADR 0044). It composes existing
// evidence; it never repairs, stages, commits, writes a report, or updates a
// sidecar.
//
// The failure that demanded it, in the reference instance: after a runtime
// migration, Tier-0 delivery was configured but unverified, a retired
// whole-tree commit hook was still wired at user level, and the facts sat in
// separate audits with no one command that could tell "configured" from
// "observed". Kill criterion: if two runtime investigations in a row still have
// to open the underlying files because this table cannot localize the fault,
// remove it rather than grow it into a dashboard.
//
// Checks, in output order: Claude Code and Codex hook topology, the
// .claude/skills link, user-level skill links (only closeout and lesson may be
// linked there; every other vault skill is vault-only, ADR 0052), Tier-0
// budgets, Tier-0 integrity (invisible or bidirectional control characters in
// core/*.md; uncommitted changes under the hook and core folders), Provenance
// (the corroboration gate: no `confidence: low` note linked from MEMORY.md,
// `source:` notes carry a confidence, MEMORY bullets are dated or pointers),
// recent SessionStart evidence, Retired terms (stale references in skill and
// hook files), top-level entries against the folder map, and Git delivery
// state.
//
// Paths are derived, never hard-coded: the vault is this script's own location
// (or BRAIN_DIR, which the tests use for fixture vaults); the user-level
// folders follow CLAUDE_CONFIG_DIR / CODEX_HOME / the home directory; a
// separate skills kit is scanned only when named with --kit DIR or
// BRAIN_KIT_DIR.

import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { budgetUsage } from '../.claude/hooks/lib.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.BRAIN_DIR?.trim() || path.resolve(scriptDir, '..');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const jsonMode = args.includes('--json');
const help = args.includes('--help') || args.includes('-h');

// A separate skills kit is read only when named. Each kit contributes its
// skills (DIR/skills if it exists, else DIR itself) and its DIR/hooks folder.
const kitDirs = [];
const unknownArgs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--kit' && args[i + 1]) kitDirs.push(args[++i]);
  else if (!['--strict', '--json', '--help', '-h'].includes(args[i])) unknownArgs.push(args[i]);
}
if (process.env.BRAIN_KIT_DIR?.trim()) kitDirs.push(process.env.BRAIN_KIT_DIR.trim());
const kits = kitDirs.map((dir) => ({
  name: path.basename(path.resolve(dir)),
  root: path.resolve(dir),
  skills: existsSync(path.join(dir, 'skills')) ? path.join(dir, 'skills') : dir,
}));

// ---------------------------------------------------------------------------
// RETIRED_TERMS — edit by hand. One entry per thing that was retired and must
// not be referenced as live any more; the "Retired terms" check greps for it.
//   term       string, or array of spellings (any one matching is a hit)
//   why        what retired it — shown nowhere in the table, kept for the next
//              person who wonders whether the entry is still right
//   scope      'all' = every scanned file; 'kit' = only a named kit's skills
//              (<kit>/skills/*/SKILL.md, see --kit)
//   allow      path suffixes (forward slashes) whose hits are legitimate, e.g.
//              a skill that explains the retirement: ['recall/SKILL.md']
//   ignoreCase optional, default false
// Scanned: vault skills (.agents/skills/*/SKILL.md, scope all), *.mjs directly
// in the vault's .claude/hooks/ (scope all), and — only when a kit is named —
// that kit's skills (scope kit and all) and hooks/ (scope all). Nothing else is
// read.
// ---------------------------------------------------------------------------
const RETIRED_TERMS = [
  { term: '.access.json', why: 'access telemetry retired (ADR 0039)', scope: 'all', allow: [] },
  { term: 'retrieval-rollup', why: 'access telemetry retired (ADR 0039)', scope: 'all', allow: ['.claude/hooks/lib.mjs'] }, // lib.mjs keeps the type so old ledger lines still parse
  // logs/signals/ is not retired: /lesson still appends correction lines through
  // append-signal.mjs. The acceptance ledger and retrieval-failure lines went.
  { term: 'retrieval-eval', why: 'retrieval machinery retired (ADR 0057)', scope: 'all', allow: [] },
  { term: 'golden-set', why: 'retrieval machinery retired (ADR 0057)', scope: 'all', allow: [] },
  { term: '/recall', why: 'retrieval machinery retired (ADR 0057)', scope: 'all', allow: [] },
  { term: ['/harvest', 'harvested_at'], why: 'harvest retired for the project board (ADR 0056)', scope: 'all', allow: [] },
  { term: ['my-notes/', 'type: my-note'], why: 'owner pages live in notes/ with author: (ADR 0060)', scope: 'all', allow: [] },
  { term: '/flywheel', why: 'deleted 2026-09-06', scope: 'all', allow: [] },
  { term: 'acceptance rate', why: 'suggestion ledger and its rate retired (ADR 0039)', scope: 'all', allow: [], ignoreCase: true },
  { term: 'scripts/proposals.mjs', why: 'deleted 2026-09-06', scope: 'all', allow: [] },
  // The wall (ADR 0052): no kit skill points a project session at this vault.
  // The term is the vault's own path, in each spelling a file might carry it.
  { term: vaultPathSpellings(repoRoot), why: 'projects are walled off from the vault (ADR 0052)', scope: 'kit',
    ignoreCase: process.platform === 'win32' || process.platform === 'darwin',
    // closeout and lesson write into the current project, never the vault, and
    // may say so by naming it.
    allow: ['skills/closeout/SKILL.md', 'skills/lesson/SKILL.md'] },
];

function vaultPathSpellings(root) {
  const forward = path.resolve(root).replaceAll('\\', '/').replace(/\/+$/, '');
  return [...new Set([forward, forward.replaceAll('/', '\\'), forward.replaceAll('/', '\\\\')])];
}

const USAGE_LINE = 'Usage: node scripts/vault-doctor.mjs [--kit DIR ...] [--json] [--strict] [--help]';
if (unknownArgs.length > 0 && !help) {
  console.error(`vault-doctor: unknown argument ${unknownArgs.join(' ')}\n${USAGE_LINE}`);
  process.exit(2);
}
if (help) {
  console.log([
    USAGE_LINE,
    '',
    'Read-only checks: Claude Code and Codex hook topology (exactly one',
    'SessionStart per runtime, no retired git-writing hook), the .claude/skills',
    'link, user-level skill links (closeout and lesson only; the other vault',
    'skills are vault-only), Tier-0 budgets, Tier-0 integrity (invisible control',
    'characters in core/, uncommitted core and hook changes), Provenance',
    '(low-confidence notes in MEMORY.md, source notes without confidence,',
    'undated MEMORY bullets), recent SessionStart evidence, retired terms in',
    'skill and hook files (RETIRED_TERMS), top-level entries against the',
    'folder map, and Git delivery state.',
    '--kit DIR  also scan a separate skills kit (DIR/skills if it exists, else',
    '           DIR itself, plus DIR/hooks) for retired terms and uncommitted',
    '           hooks; BRAIN_KIT_DIR does the same',
    '--strict exits 1 when any check fails; warnings do not fail it.',
  ].join('\n'));
  process.exit(0);
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

// Missing is not broken: a machine that never wired a user-level hook has no
// user-level file at all. Only a file that exists and does not parse is bad.
function readJson(file) {
  const text = readText(file);
  if (text === null) return { missing: true, data: null };
  try {
    return { missing: false, data: JSON.parse(text) };
  } catch {
    return { missing: false, data: null, invalid: true };
  }
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function add(results, area, status, detail) {
  results.push({ area, status, detail });
}

const caseInsensitive = process.platform === 'win32' || process.platform === 'darwin';
function norm(p) {
  const s = String(p).replaceAll('\\', '/').replace(/\/+$/, '');
  return caseInsensitive ? s.toLowerCase() : s;
}

function commandHooks(config, event) {
  const groups = config?.hooks?.[event];
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((group) => (Array.isArray(group?.hooks) ? group.hooks : []))
    .filter((hook) => hook?.type === 'command' && typeof hook.command === 'string');
}

function allCommandHooks(config) {
  return Object.keys(config?.hooks || {}).flatMap((event) =>
    commandHooks(config, event).map((hook) => ({ event, command: hook.command })));
}

const vaultNeedle = norm(repoRoot);
// v1.0 wired these; v1.1 deleted them. A user-level entry left behind runs a
// file that no longer exists — or, worse, an old copy that ran `git add -A`.
const RETIRED_HOOKS = /(checkpoint|session-end|flush|reuse-telemetry|maintenance-stamp)\.mjs/i;

// Flat YAML frontmatter as { key: value } (values trimmed, surrounding quotes
// dropped); null when the note has no frontmatter block.
function frontmatter(text) {
  const match = text?.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z_][\w-]*):\s*(.*?)\s*$/);
    if (pair) fields[pair[1]] = pair[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  return fields;
}

function noteFiles(dir) {
  try {
    return readdirSync(dir).filter((name) => name.endsWith('.md')).sort();
  } catch {
    return [];
  }
}

const stripComments = (text) => text.replace(/<!--[\s\S]*?-->/g, '');
const squash = (text) => text.replace(/\s+/g, ' ').trim();

// A MEMORY.md bullet is a `- ` line plus its continuation lines, up to the next
// bullet, a blank line or a heading.
function memoryBullets(text) {
  const bullets = [];
  let current = null;
  for (const line of stripComments(text).split(/\r?\n/)) {
    if (line.startsWith('- ')) {
      if (current) bullets.push(current);
      current = line.slice(2);
    } else if (current !== null && line.trim() !== '' && !/^#/.test(line)) {
      current += ` ${line.trim()}`;
    } else if (current !== null) {
      bullets.push(current);
      current = null;
    }
  }
  if (current) bullets.push(current);
  return bullets.map(squash);
}

// Dated, or a pointer to a live source — the two kinds of fact MEMORY.md may hold.
function isDatedOrPointer(bullet) {
  return /\d{4}-\d{2}-\d{2}/.test(bullet)
    || /\[\[[^\]]+\]\]/.test(bullet)
    || /`[^`]*(?:\/|\.md|\.mjs)[^`]*`/.test(bullet)
    || /\bADR\b/.test(bullet);
}

// Files the retired-terms check reads: { file, kind } with kind 'kit' | 'vault' | 'hook'.
function scanTargets() {
  const targets = [];
  const skillFiles = (root, kind) => {
    let names = [];
    try {
      names = readdirSync(root).sort();
    } catch {
      return;
    }
    for (const name of names) {
      const file = path.join(root, name, 'SKILL.md');
      if (existsSync(file)) targets.push({ file, kind });
    }
  };
  const hookFiles = (root) => {
    try {
      for (const name of readdirSync(root).sort()) {
        const file = path.join(root, name);
        if (name.endsWith('.mjs') && statSync(file).isFile()) targets.push({ file, kind: 'hook' });
      }
    } catch {
      // a missing hooks folder is simply not scanned
    }
  };
  for (const kit of kits) skillFiles(kit.skills, 'kit');
  skillFiles(path.join(repoRoot, '.agents', 'skills'), 'vault');
  hookFiles(path.join(repoRoot, '.claude', 'hooks'));
  for (const kit of kits) hookFiles(path.join(kit.root, 'hooks'));
  return targets;
}

// Path relative to the skills/ or hooks/ folder it sits in, for the table cell.
function shortPath(file) {
  const normal = file.replaceAll('\\', '/');
  const cut = Math.max(normal.lastIndexOf('/skills/'), normal.lastIndexOf('/hooks/'));
  return cut === -1 ? normal : normal.slice(normal.indexOf('/', cut + 1) + 1);
}

function retiredTermHits() {
  const hits = [];
  for (const { file, kind } of scanTargets()) {
    const text = readText(file);
    if (text === null) continue;
    const normal = file.replaceAll('\\', '/');
    const rules = RETIRED_TERMS.filter((rule) =>
      (rule.scope === 'all' || (rule.scope === 'kit' && kind === 'kit'))
      && !(rule.allow || []).some((suffix) => normal.endsWith(suffix)));
    if (rules.length === 0) continue;
    text.split(/\r?\n/).forEach((line, index) => {
      for (const rule of rules) {
        const haystack = rule.ignoreCase ? line.toLowerCase() : line;
        const spelling = [].concat(rule.term).find((variant) =>
          haystack.includes(rule.ignoreCase ? variant.toLowerCase() : variant));
        if (spelling !== undefined) hits.push(`${shortPath(file)}:${index + 1} ${spelling}`);
      }
    });
  }
  return hits;
}

// Invisible or bidirectional control characters — the ones that let text read
// one way and mean another in a file every session loads. A BOM is fine only
// as the very first character.
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿\u{E0000}-\u{E007F}]/gu;

function invisibleCharacters(dir) {
  const found = [];
  for (const name of noteFiles(dir)) {
    const text = readText(path.join(dir, name));
    if (text === null) continue;
    const seen = new Set();
    for (const match of text.matchAll(INVISIBLE)) {
      const code = match[0].codePointAt(0);
      if (code === 0xFEFF && match.index === 0) continue;
      seen.add(code);
    }
    for (const code of seen) found.push(`${name} U+${code.toString(16).toUpperCase().padStart(4, '0')}`);
  }
  return found;
}

// `git status --porcelain` lines for paths under dir; null when git cannot say.
function dirtyPaths(dir, paths) {
  const status = run('git', ['--no-optional-locks', '-C', dir, 'status', '--porcelain', '--', ...paths]);
  if (status.error || status.status !== 0) return null;
  return status.stdout.split(/\r?\n/).filter(Boolean);
}

const results = [];

// --- Claude Code: exactly one SessionStart, in project scope or at user level.
// A user-level hook fires in every project and does nothing outside the vault
// (ADR 0052); project scope fires only here. Either is fine, both is a double.
const claudeRoot = process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(os.homedir(), '.claude');
const claudeUserPath = path.join(claudeRoot, 'settings.json');
const claudeProjectPath = path.join(repoRoot, '.claude', 'settings.json');
const claudeUser = readJson(claudeUserPath);
const claudeProject = readJson(claudeProjectPath);
const isVaultClaudeStart = (cmd, scope) => {
  const c = norm(cmd);
  if (!c.includes('.claude/hooks/session-start.mjs')) return false;
  return scope === 'project' ? true : c.includes(vaultNeedle);
};
const claudeStarts = [
  ...commandHooks(claudeUser.data, 'SessionStart').filter((h) => isVaultClaudeStart(h.command, 'user')).map(() => 'user'),
  ...commandHooks(claudeProject.data, 'SessionStart').filter((h) => isVaultClaudeStart(h.command, 'project')).map(() => 'project'),
];
const claudeRetired = [
  ...allCommandHooks(claudeUser.data).filter((h) => RETIRED_HOOKS.test(h.command) && norm(h.command).includes(vaultNeedle)).map((h) => `user ${h.event}`),
  ...allCommandHooks(claudeProject.data).filter((h) => RETIRED_HOOKS.test(h.command)).map((h) => `project ${h.event}`),
];
if (claudeUser.invalid || claudeProject.invalid) {
  add(results, 'Claude hooks', 'FAIL', `unparseable settings: ${[claudeUser.invalid && claudeUserPath, claudeProject.invalid && claudeProjectPath].filter(Boolean).join(', ')}`);
} else if (claudeRetired.length > 0) {
  add(results, 'Claude hooks', 'FAIL', `retired v1.0 hook still wired (${claudeRetired.join(', ')}) — remove it; only SessionStart remains`);
} else if (claudeStarts.length > 1) {
  add(results, 'Claude hooks', 'FAIL', `${claudeStarts.length} vault SessionStart handlers (${claudeStarts.join(' + ')}) — it fires twice; keep one`);
} else if (claudeStarts.length === 0) {
  add(results, 'Claude hooks', 'WARN', 'no vault SessionStart wired for Claude Code (fine if you only use Codex)');
} else {
  add(results, 'Claude hooks', 'PASS', `exactly one vault SessionStart (${claudeStarts[0] === 'user' ? 'user level' : 'project scope'}); no git-writing hook`);
}

// --- Codex: one user-level SessionStart through the adapter, no project copy.
const codexRoot = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), '.codex');
const codexUserPath = path.join(codexRoot, 'hooks.json');
const codexProjectPath = path.join(repoRoot, '.codex', 'hooks.json');
const codexUser = readJson(codexUserPath);
const codexProject = readJson(codexProjectPath);
const adapter = path.join(repoRoot, '.codex', 'hooks', 'session-start.mjs');
const adapterNeedle = norm(adapter);
const codexGlobalStarts = commandHooks(codexUser.data, 'SessionStart').filter((h) => norm(h.command).includes(adapterNeedle));
const codexProjectStarts = commandHooks(codexProject.data, 'SessionStart').filter((h) => norm(h.command).includes('session-start'));
const codexRetired = [
  ...allCommandHooks(codexUser.data).filter((h) => RETIRED_HOOKS.test(h.command) && norm(h.command).includes(vaultNeedle)).map((h) => `user ${h.event}`),
  ...allCommandHooks(codexProject.data).filter((h) => RETIRED_HOOKS.test(h.command)).map((h) => `project ${h.event}`),
];
if (codexUser.invalid || codexProject.invalid) {
  add(results, 'Codex hooks', 'FAIL', `unparseable hooks file: ${[codexUser.invalid && codexUserPath, codexProject.invalid && codexProjectPath].filter(Boolean).join(', ')}`);
} else if (!existsSync(adapter)) {
  add(results, 'Codex hooks', 'FAIL', `adapter missing: ${adapter}`);
} else if (codexRetired.length > 0) {
  add(results, 'Codex hooks', 'FAIL', `retired hook still wired (${codexRetired.join(', ')}) — remove it`);
} else if (codexGlobalStarts.length + codexProjectStarts.length > 1) {
  add(results, 'Codex hooks', 'FAIL', `${codexGlobalStarts.length} global and ${codexProjectStarts.length} project vault SessionStart handler(s) — Codex adds the layers, so it fires twice`);
} else if (codexGlobalStarts.length === 0 && codexProjectStarts.length === 0) {
  add(results, 'Codex hooks', 'WARN', codexUser.missing
    ? `no ${codexUserPath} (fine if you do not use Codex)`
    : 'no vault SessionStart wired for Codex (fine if you do not use Codex)');
} else {
  add(results, 'Codex hooks', 'PASS', 'exactly one vault SessionStart through the adapter');
}

// --- One skills copy: .claude/skills must be a link to .agents/skills.
const skillsTarget = path.join(repoRoot, '.agents', 'skills');
const skillsLink = path.join(repoRoot, '.claude', 'skills');
let linkStat = null;
try {
  linkStat = lstatSync(skillsLink);
} catch {
  linkStat = null;
}
if (!existsSync(skillsTarget)) {
  add(results, 'Skills link', 'FAIL', 'missing .agents/skills/ — the one skills copy');
} else if (!linkStat) {
  add(results, 'Skills link', 'FAIL', '.claude/skills missing — Claude Code sees no vault skills; run `node install.mjs --link-skills`');
} else if (!linkStat.isSymbolicLink()) {
  add(results, 'Skills link', 'FAIL', '.claude/skills is a real directory, not a link — a copy drifts; move it aside and run `node install.mjs --link-skills`');
} else {
  let real = null;
  try {
    real = realpathSync(skillsLink);
  } catch {
    real = null;
  }
  if (real && norm(real) === norm(realpathSync(skillsTarget))) {
    add(results, 'Skills link', 'PASS', '.claude/skills resolves to .agents/skills');
  } else {
    add(results, 'Skills link', 'FAIL', `.claude/skills points at ${real ?? 'nothing (broken link)'} — run \`node install.mjs --link-skills\``);
  }
}

// --- User-level skill links (ADR 0052). closeout and lesson write into the
// current project's repo, never the vault, so linking them at user level is an
// optional convenience. Every other vault skill — /ingest and /curator among them — reads
// or writes the vault and runs only in a vault session; a link at
// user level would hand it to every project session, which is the wall broken.
// Claude Code reads CLAUDE_CONFIG_DIR/skills; Codex builds differ in the
// folder they read (CODEX_HOME/skills or ~/.agents/skills), so all three count.
const USER_LEVEL_OK = new Set(['closeout', 'lesson']);
const userSkillHomes = [
  { runtime: 'Claude Code', dir: path.join(claudeRoot, 'skills') },
  { runtime: 'Codex', dir: path.join(codexRoot, 'skills') },
  { runtime: 'Codex', dir: path.join(os.homedir(), '.agents', 'skills') },
];
function realOrNull(file) {
  try {
    return norm(realpathSync(file));
  } catch {
    return null;
  }
}
const vaultSkills = new Map(); // real path -> skill name
try {
  for (const name of readdirSync(skillsTarget)) {
    const real = realOrNull(path.join(skillsTarget, name));
    if (real && existsSync(path.join(skillsTarget, name, 'SKILL.md'))) vaultSkills.set(real, name);
  }
} catch {
  // no .agents/skills — the Skills link row already failed
}
const linkedOk = new Set();
const linkedWrong = [];
const seenHomes = new Set();
for (const { runtime, dir } of userSkillHomes) {
  const key = norm(dir);
  if (seenHomes.has(key)) continue; // CODEX_HOME may point at ~/.agents
  seenHomes.add(key);
  let names = [];
  try {
    names = readdirSync(dir).sort();
  } catch {
    continue; // no such folder: nothing linked there
  }
  for (const name of names) {
    const skill = vaultSkills.get(realOrNull(path.join(dir, name)));
    if (!skill) continue; // not one of this vault's skills
    if (USER_LEVEL_OK.has(skill)) linkedOk.add(`${runtime} ${skill}`);
    else linkedWrong.push(`${runtime} ${skill}`);
  }
}
if (linkedWrong.length > 0) {
  add(results, 'User-level skills', 'WARN',
    `vault-only skill linked at user level: ${linkedWrong.join(', ')} — remove the link; only closeout and lesson may load outside the vault (ADR 0052)`);
} else {
  add(results, 'User-level skills', 'PASS', linkedOk.size
    ? `only closeout/lesson linked at user level (${[...linkedOk].join(', ')})`
    : 'no vault skill linked at user level (closeout and lesson may be, optionally)');
}

// Tier-0 delivery can fail silently once the payload grows; budgets are the
// earliest deterministic signal available without starting a fresh session.
const budgets = budgetUsage(repoRoot);
const over = budgets.filter((row) => row.count > row.limit);
if (budgets.length === 0) {
  add(results, 'Tier-0 budgets', 'FAIL', 'no budgeted core files found');
} else if (over.length > 0) {
  add(results, 'Tier-0 budgets', 'FAIL', over.map((row) => `${row.file} ${row.count}/${row.limit}`).join(', '));
} else {
  add(results, 'Tier-0 budgets', 'PASS', budgets.map((row) => `${row.file} ${row.count}/${row.limit}`).join(', '));
}

// core/ is injected into every session, so a hidden or direction-flipping
// character in it, or an edit nobody committed, is a prompt-injection surface.
const invisible = invisibleCharacters(path.join(repoRoot, 'core'));
const tier0Dirty = [
  ['vault', dirtyPaths(repoRoot, ['core', '.claude/hooks', '.codex/hooks'])],
  ...kits.map((kit) => [`kit hooks ${kit.name}`, dirtyPaths(kit.root, ['hooks'])]),
];
const tier0Uncommitted = tier0Dirty.filter(([, lines]) => lines?.length).map(([label, lines]) => `${lines.length} in ${label}`);
const tier0Unreadable = tier0Dirty.filter(([, lines]) => lines === null).map(([label]) => label);
if (invisible.length > 0) {
  add(results, 'Tier-0 integrity', 'FAIL', `invisible or bidi control character: ${invisible.slice(0, 5).join(', ')}${invisible.length > 5 ? `, +${invisible.length - 5} more` : ''}`);
} else if (tier0Uncommitted.length > 0) {
  add(results, 'Tier-0 integrity', 'WARN', `uncommitted change(s) under core/ or hook folders: ${tier0Uncommitted.join(', ')}`);
} else {
  add(results, 'Tier-0 integrity', 'PASS',
    `no invisible control characters in core/*.md; hook folders committed${tier0Unreadable.length ? ` (git unreadable for ${tier0Unreadable.join(', ')})` : ''}`);
}

// Corroboration gate (AGENTS.md): a once-seen fact, `confidence: low`, may not
// sit in MEMORY.md; and everything in MEMORY.md is dated or a pointer.
const memoryText = readText(path.join(repoRoot, 'core', 'MEMORY.md'));
if (memoryText === null) {
  add(results, 'Provenance', 'WARN', 'core/MEMORY.md unreadable');
} else {
  const notesDir = path.join(repoRoot, 'notes');
  const linked = [...new Set([...stripComments(memoryText).matchAll(/\[\[([^\]]+)\]\]/g)]
    .map((match) => match[1].split('|')[0].split('#')[0].trim())
    .filter((name) => name && !/[\\/]/.test(name)))];
  const lowLinked = linked.filter((name) => {
    const note = readText(path.join(notesDir, `${name}.md`));
    return note !== null && frontmatter(note)?.confidence?.toLowerCase() === 'low';
  });
  // An owner page (`author:`, ADR 0060) may cite a source without rating it:
  // it is the owner's, not a once-seen fact on its way to MEMORY.md.
  const unrated = noteFiles(notesDir).filter((name) => {
    const fields = frontmatter(readText(path.join(notesDir, name)));
    return fields && 'source' in fields && !('confidence' in fields) && !('author' in fields);
  });
  const loose = memoryBullets(memoryText).filter((bullet) => !isDatedOrPointer(bullet));
  const parts = [
    lowLinked.length
      ? `MEMORY.md links confidence: low: ${lowLinked.join(', ')}`
      : 'no low-confidence note in MEMORY.md',
    unrated.length
      ? `${unrated.length} source: note(s) without confidence: ${unrated.slice(0, 5).join(', ')}${unrated.length > 5 ? ', ...' : ''}`
      : 'every source: note has a confidence',
    loose.length
      ? `${loose.length} MEMORY bullet(s) neither dated nor pointer: ${loose.slice(0, 3).map((bullet) => `"${bullet.slice(0, 60)}"`).join(', ')}${loose.length > 3 ? ', ...' : ''}`
      : 'every MEMORY bullet is dated or a pointer',
  ];
  add(results, 'Provenance', lowLinked.length ? 'FAIL' : unrated.length || loose.length ? 'WARN' : 'PASS', parts.join('; '));
}

function latestAutomationEvidence(logText) {
  if (!logText) return null;
  let latest = null;
  for (const line of logText.split(/\r?\n/)) {
    const match = line.match(/^\[([^\]]+)\] SessionStart: context payload (\d+)B/);
    if (!match) continue;
    const at = new Date(match[1]);
    if (!Number.isNaN(at.getTime())) latest = { at, bytes: Number(match[2]) };
  }
  return latest;
}

const evidence = latestAutomationEvidence(readText(path.join(repoRoot, 'logs', '.automation.log')));
if (!evidence) {
  add(results, 'SessionStart evidence', 'FAIL', 'no recorded context payload — the hook has never run here (is core/.vault-active present?)');
} else {
  const ageDays = Math.floor((Date.now() - evidence.at.getTime()) / 86400000);
  add(
    results,
    'SessionStart evidence',
    ageDays > 7 ? 'WARN' : 'PASS',
    `${evidence.at.toISOString()} · ${evidence.bytes}B · ${ageDays}d old`
  );
}

// Stale references: skill and hook files that still name something retired.
// RETIRED_TERMS at the top of the file is the list.
const staleHits = retiredTermHits();
const missingKits = kits.filter((kit) => !existsSync(kit.root)).map((kit) => kit.root);
if (missingKits.length > 0) {
  add(results, 'Retired terms', 'WARN', `skills kit not found: ${missingKits.join(', ')}${staleHits.length ? `; ${staleHits.length} hit(s) elsewhere: ${staleHits.slice(0, 5).join('; ')}` : ''}`);
} else if (staleHits.length === 0) {
  const scope = kits.length ? ` and ${kits.length} kit(s)` : '';
  add(results, 'Retired terms', 'PASS', `no retired term in vault skill or hook files${scope} (${RETIRED_TERMS.length} rules)`);
} else {
  add(results, 'Retired terms', 'WARN',
    `${staleHits.length} hit(s): ${staleHits.slice(0, 5).join('; ')}${staleHits.length > 5 ? '; ...' : ''}`);
}

// The folder map in AGENTS.md is prose, and prose did not stop sessions in the
// reference instance from inventing new top-level folders for project output.
// This list mirrors that map; a new top-level entry must be argued into
// AGENTS.md first, then added here.
const ROOT_ALLOWED = new Set([
  // vault content, one folder per lifecycle
  'core', 'notes', 'reports', 'outputs', 'logs', 'raw', 'archive',
  // root documents
  'AGENTS.md', 'CLAUDE.md', 'INDEX.md', 'PROPOSALS.md', 'README.md', 'SETUP.md',
  'LICENSE', 'install.mjs', 'docs',
  // machinery and tool state
  '.agents', '.claude', '.codex', 'scripts', '.obsidian', '.trash', '.git',
  '.gitattributes', '.gitignore', '.pre-commit-config.yaml',
  // OS clutter, already gitignored
  'desktop.ini', 'Thumbs.db', '.DS_Store',
]);
let rootEntries = null;
try {
  rootEntries = readdirSync(repoRoot);
} catch {
  add(results, 'Vault root', 'FAIL', `cannot list ${repoRoot}`);
}
if (rootEntries) {
  const stray = rootEntries.filter((name) => !ROOT_ALLOWED.has(name)).sort();
  add(
    results,
    'Vault root',
    stray.length ? 'WARN' : 'PASS',
    stray.length
      ? `not in the AGENTS.md folder map: ${stray.join(', ')} — project output belongs in its own repo`
      : 'only folder-map entries at the top level'
  );
}

const status = run('git', ['status', '--short']);
const ahead = run('git', ['rev-list', '--count', '@{upstream}..HEAD']);
if (status.status !== 0 || ahead.status !== 0) {
  const blocked = status.error?.code === 'EPERM' || ahead.error?.code === 'EPERM';
  add(results, 'Git delivery', blocked ? 'WARN' : 'FAIL', blocked ? 'git subprocess blocked by current sandbox' : 'cannot read worktree or upstream state (no upstream branch?)');
} else {
  const dirty = status.stdout.split(/\r?\n/).filter(Boolean).length;
  const aheadCount = Number.parseInt(ahead.stdout.trim(), 10) || 0;
  add(
    results,
    'Git delivery',
    dirty || aheadCount ? 'WARN' : 'PASS',
    `${dirty} dirty path(s), ${aheadCount} unpushed commit(s)`
  );
}

const summary = {
  pass: results.filter((row) => row.status === 'PASS').length,
  warn: results.filter((row) => row.status === 'WARN').length,
  fail: results.filter((row) => row.status === 'FAIL').length,
};

if (jsonMode) {
  console.log(JSON.stringify({ repoRoot, summary, results }, null, 2));
} else {
  console.log('# Vault doctor\n');
  console.log('| Area | Status | Detail |');
  console.log('|---|---|---|');
  for (const row of results) {
    console.log(`| ${row.area} | **${row.status}** | ${row.detail.replaceAll('|', '\\|')} |`);
  }
  console.log(`\nSummary: ${summary.pass} pass, ${summary.warn} warning, ${summary.fail} failure.`);
  console.log('Read-only: no repair or write was attempted.');
}

if (strict && summary.fail > 0) process.exitCode = 1;
