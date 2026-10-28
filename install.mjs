#!/usr/bin/env node
// memcellar — one-time personalization for a fresh clone.
//
// What it does, and nothing more:
//   1. asks a short interview,
//   2. writes core/USER.md and the language line in core/IDENTITY.md,
//   3. creates core/.vault-active — the marker the SessionStart hook is gated on,
//   4. links .claude/skills to .agents/skills, the one skills copy both
//      runtimes load (a junction on Windows, a symlink elsewhere — ADR 0044),
//   5. turns on git rerere, names you as the author of notes/todo.md and
//      hides the history folders from Obsidian (.obsidian/app.json, merged),
//   6. prints the Codex wiring for you to paste, and does NOT write it
//      (Claude Code needs none: this repo's .claude/settings.json wires it).
//
// Step 6 is deliberate: user-level settings are outside this repo, they affect
// every project on the machine, and an installer that edits them without you
// watching is exactly the kind of thing this system's rules forbid.
//
// `node install.mjs --link-skills` does step 4 alone and exits — for a second
// machine, a moved folder (a Windows junction stores an absolute path), or a
// clone upgraded from v1.0, where the skills still lived in .claude/skills.
//
// `node install.mjs --link-global-skills` is a separate, opt-in step: it links
// /closeout and /lesson into the user-level skills folder of each runtime
// whose home exists (~/.claude/skills, ~/.codex/skills, or CLAUDE_CONFIG_DIR /
// CODEX_HOME), so a session in any project can reach them. Both write into
// the project the session is in, never into this vault (ADR 0052). A /recall
// link left by v1.1 is removed: recall works on the vault, so it is a
// vault-only skill now. It creates only links that point back into this vault, never
// replaces anything but a broken link, and `--unlink-global-skills` removes
// exactly those links again. That is why it may touch user-level folders when
// step 6 may not: you ask for it by name, it changes nothing but its own
// links, and it reverses cleanly — a settings file merge is none of those.
//
// `node install.mjs --pack <name>` links one optional skill pack — the skills in
// .agents/packs/<name>/ — into the same user-level folders, with the same
// rules: one link per skill per runtime, only a broken link is ever replaced,
// a real folder or a link elsewhere (your own kit's copy, say) is reported and
// left alone. `--unpack <name>` removes exactly those links; `--list-packs`
// shows every pack, its skills and where each is linked. Pack skills work in
// any project and in the vault; the template is their one source, so a user
// with their own kit links them, never copies them (ADR 0061, 0062).
//
// `node install.mjs --obsidian` merges the history folders (archive/, logs/,
// raw/) into Obsidian's ignore filters in .obsidian/app.json and exits; the
// interview does the same. Every other Obsidian setting is kept (ADR 0060).
//
// `node install.mjs --help` prints the usage and touches nothing.
//
// Safe to abort at any prompt (Ctrl-C) — nothing is written until the summary
// is confirmed.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.join(ROOT, 'core');
const MARKER = path.join(CORE, '.vault-active');
const SKILLS_TARGET = path.join(ROOT, '.agents', 'skills');
const SKILLS_LINK = path.join(ROOT, '.claude', 'skills');

function samePath(a, b) {
  const norm = (p) => path.resolve(p).replace(/[\\/]+$/, '');
  return process.platform === 'win32' || process.platform === 'darwin'
    ? norm(a).toLowerCase() === norm(b).toLowerCase()
    : norm(a) === norm(b);
}

// The skills a project session may use (ADR 0045, 0052). They write into the
// project repo the session is in, never into the vault. Everything else in
// .agents/skills works on the vault itself and stays vault-scoped.
const GLOBAL_SKILLS = ['closeout', 'lesson'];
// Linked at user level by v1.1 and vault-only since v2. Both
// --link-global-skills and --unlink-global-skills remove such a link, and
// only when it points into this vault.
const RETIRED_GLOBAL_SKILLS = ['recall'];

// Optional packs (ADR 0062): .agents/packs/<pack>/<skill>/SKILL.md. Discovered,
// not listed here, so a pack is added by adding its folder.
const PACKS_DIR = path.join(ROOT, '.agents', 'packs');

function listPacks() {
  if (!fs.existsSync(PACKS_DIR)) return [];
  return fs.readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({
      name: e.name,
      skills: fs.readdirSync(path.join(PACKS_DIR, e.name), { withFileTypes: true })
        .filter((s) => s.isDirectory() && fs.existsSync(path.join(PACKS_DIR, e.name, s.name, 'SKILL.md')))
        .map((s) => s.name)
        .sort(),
    }))
    .filter((p) => p.skills.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function userSkillDirs() {
  const home = os.homedir();
  return [
    { runtime: 'Claude Code', home: process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(home, '.claude') },
    { runtime: 'Codex', home: process.env.CODEX_HOME?.trim() || path.join(home, '.codex') },
  ].map((r) => ({ ...r, dir: path.join(r.home, 'skills') }));
}

function makeDirLink(target, link) {
  fs.mkdirSync(path.dirname(link), { recursive: true });
  if (process.platform === 'win32') {
    // A junction needs no admin rights or Developer Mode; a symlink does.
    fs.symlinkSync(target, link, 'junction');
  } else {
    fs.symlinkSync(path.relative(path.dirname(link), target), link, 'dir');
  }
}

// Where a link points, whether or not the target still exists.
function linkTarget(link) {
  try {
    return path.resolve(path.dirname(link), fs.readlinkSync(link));
  } catch {
    return null;
  }
}

// Creates or repairs the .claude/skills link. Never deletes anything that is
// not itself a link: a real directory there is a copy, and a copy is the drift
// this layout exists to prevent — so it is reported, not overwritten.
function linkSkills() {
  if (!fs.existsSync(SKILLS_TARGET)) {
    return { ok: false, note: '.agents/skills/ is missing — is this a memcellar clone?' };
  }
  let st = null;
  try {
    st = fs.lstatSync(SKILLS_LINK);
  } catch {
    st = null;
  }
  if (st && !st.isSymbolicLink()) {
    return {
      ok: false,
      note:
        '.claude/skills exists as a real directory, not a link. Move it aside ' +
        '(anything in it that is not already in .agents/skills/ belongs there) ' +
        'and re-run `node install.mjs --link-skills`.',
    };
  }
  if (st) {
    let real = null;
    try {
      real = fs.realpathSync(SKILLS_LINK);
    } catch {
      real = null; // broken link, e.g. the vault folder was moved
    }
    if (real && samePath(real, fs.realpathSync(SKILLS_TARGET))) {
      return { ok: true, note: 'already linked' };
    }
    try {
      // Removes the link itself, never what it points at.
      fs.rmSync(SKILLS_LINK, { recursive: false, force: true });
    } catch (err) {
      return { ok: false, note: `could not replace the stale link: ${err.message}` };
    }
  }
  try {
    makeDirLink(SKILLS_TARGET, SKILLS_LINK);
    return { ok: true, note: st ? 'repaired' : 'created' };
  } catch (err) {
    return { ok: false, note: err.message };
  }
}

// One user-level link per skill per runtime. The only thing it replaces is a
// broken link (a moved vault leaves one behind); a real folder, or a link that
// resolves somewhere else, is someone's own setup and is reported instead.
function linkGlobalSkill(dir, name, source = SKILLS_TARGET) {
  const target = path.join(source, name);
  const link = path.join(dir, name);
  if (!fs.existsSync(path.join(target, 'SKILL.md'))) {
    return { ok: false, note: `${path.relative(ROOT, target).split(path.sep).join('/')} is missing` };
  }
  let st = null;
  try {
    st = fs.lstatSync(link);
  } catch {
    st = null;
  }
  if (st && !st.isSymbolicLink()) {
    return { ok: false, note: 'a real folder is already there — left alone' };
  }
  if (st) {
    let real = null;
    try {
      real = fs.realpathSync(link);
    } catch {
      real = null; // broken link
    }
    if (real && samePath(real, fs.realpathSync(target))) return { ok: true, note: 'already linked' };
    if (real) {
      return { ok: false, note: `already links to ${real} — left alone; remove that link yourself to switch` };
    }
    try {
      fs.rmSync(link, { recursive: false, force: true }); // the dead link only
    } catch (err) {
      return { ok: false, note: `could not replace the broken link: ${err.message}` };
    }
  }
  try {
    makeDirLink(target, link);
    return { ok: true, note: st ? 'repaired' : 'linked' };
  } catch (err) {
    return { ok: false, note: err.message };
  }
}

// Removes only links that point into this vault's .agents/skills — anything
// else in the user-level folder is not this installer's to touch.
function unlinkGlobalSkill(dir, name, source = SKILLS_TARGET) {
  const link = path.join(dir, name);
  let st = null;
  try {
    st = fs.lstatSync(link);
  } catch {
    return { ok: true, note: 'not linked' };
  }
  if (!st.isSymbolicLink()) return { ok: true, note: 'a real folder, not a link from here — left alone' };
  const to = linkTarget(link);
  const ours = path.join(source, name);
  let real = null;
  try {
    real = fs.realpathSync(link);
  } catch {
    real = null; // broken — only the recorded target can prove it is ours
  }
  const isOurs = (to && samePath(to, ours)) || (real && fs.existsSync(ours) && samePath(real, fs.realpathSync(ours)));
  if (!isOurs) {
    return { ok: true, note: `links to ${to ?? 'an unreadable target'}, not this vault — left alone` };
  }
  try {
    fs.rmSync(link, { recursive: false, force: true }); // the link, never its target
    return { ok: true, note: 'removed' };
  } catch (err) {
    return { ok: false, note: err.message };
  }
}

function globalSkills(remove) {
  let ok = true;
  for (const { runtime, home, dir } of userSkillDirs()) {
    if (!fs.existsSync(home)) {
      stdout.write(`${runtime}: ${home} not found — skipped\n`);
      continue;
    }
    for (const name of GLOBAL_SKILLS) {
      const r = remove ? unlinkGlobalSkill(dir, name) : linkGlobalSkill(dir, name);
      if (!r.ok) ok = false;
      stdout.write(`${runtime}: ${path.join(dir, name)} — ${r.ok ? r.note : `FAILED: ${r.note}`}\n`);
    }
    for (const name of RETIRED_GLOBAL_SKILLS) {
      const r = unlinkGlobalSkill(dir, name);
      if (!r.ok) ok = false;
      if (r.note !== 'not linked') {
        stdout.write(`${runtime}: ${path.join(dir, name)} (vault-only since v2) — ${r.ok ? r.note : `FAILED: ${r.note}`}\n`);
      }
    }
  }
  return ok;
}

// Where a user-level skill link stands, for --list-packs: 'linked' (to this
// vault's copy), 'elsewhere', 'real folder', 'broken' or '-'.
function linkState(dir, name, source) {
  const link = path.join(dir, name);
  let st = null;
  try {
    st = fs.lstatSync(link);
  } catch {
    return '-';
  }
  if (!st.isSymbolicLink()) return 'real folder';
  let real = null;
  try {
    real = fs.realpathSync(link);
  } catch {
    return 'broken';
  }
  const ours = path.join(source, name);
  return fs.existsSync(ours) && samePath(real, fs.realpathSync(ours)) ? 'linked' : 'elsewhere';
}

function packCommand(names, remove) {
  const packs = listPacks();
  const unknown = names.filter((n) => !packs.some((p) => p.name === n));
  if (unknown.length) {
    process.stderr.write(`Unknown pack: ${unknown.join(', ')}. Available: ${packs.map((p) => p.name).join(', ') || 'none'}\n`);
    return 2;
  }
  let ok = true;
  let anyHome = false;
  for (const { runtime, home, dir } of userSkillDirs()) {
    if (!fs.existsSync(home)) {
      stdout.write(`${runtime}: ${home} not found — skipped\n`);
      continue;
    }
    anyHome = true;
    for (const pack of packs.filter((p) => names.includes(p.name))) {
      const source = path.join(PACKS_DIR, pack.name);
      for (const skill of pack.skills) {
        const r = remove ? unlinkGlobalSkill(dir, skill, source) : linkGlobalSkill(dir, skill, source);
        if (!r.ok) ok = false;
        stdout.write(`${runtime}: ${path.join(dir, skill)} [${pack.name}] — ${r.ok ? r.note : `FAILED: ${r.note}`}\n`);
      }
    }
  }
  if (!anyHome) {
    stdout.write('No runtime home found (Claude Code or Codex) — nothing linked.\n');
    return 1;
  }
  return ok ? 0 : 1;
}

function listPacksCommand() {
  const packs = listPacks();
  if (!packs.length) {
    stdout.write('No packs in .agents/packs/.\n');
    return 0;
  }
  const homes = userSkillDirs().filter((r) => fs.existsSync(r.home));
  stdout.write(`Optional skill packs (link one with: node install.mjs --pack <name>)\n\n`);
  for (const pack of packs) {
    stdout.write(`${pack.name}\n`);
    const source = path.join(PACKS_DIR, pack.name);
    for (const skill of pack.skills) {
      const where = homes.map((h) => `${h.runtime}: ${linkState(h.dir, skill, source)}`).join(', ');
      stdout.write(`  ${skill.padEnd(28)} ${where || 'no runtime home found'}\n`);
    }
  }
  return 0;
}

// Obsidian is how the owner browses the vault (ADR 0060). The history folders
// stay where they are but leave search, the graph and quick switcher. A
// missing app.json is created; an existing one is merged, never replaced, and
// one that does not parse is left alone and reported.
const OBSIDIAN_HIDDEN = ['archive/', 'logs/', 'raw/'];

function obsidianIgnore() {
  const file = path.join(ROOT, '.obsidian', 'app.json');
  let app = {};
  if (fs.existsSync(file)) {
    try {
      app = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      return { ok: false, note: `.obsidian/app.json does not parse (${err.message}); left as it is` };
    }
    if (app === null || typeof app !== 'object' || Array.isArray(app)) {
      return { ok: false, note: '.obsidian/app.json is not a JSON object; left as it is' };
    }
  }
  const filters = Array.isArray(app.userIgnoreFilters) ? app.userIgnoreFilters : [];
  const missing = OBSIDIAN_HIDDEN.filter((f) => !filters.includes(f));
  if (missing.length === 0) return { ok: true, note: 'already hides archive/, logs/, raw/' };
  app.userIgnoreFilters = [...filters, ...missing];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(app, null, 2)}\n`, 'utf8');
  return { ok: true, note: `now hides ${missing.join(', ')}` };
}

const USAGE = `memcellar — install.mjs

  node install.mjs                         one-time setup: interview, core/USER.md,
                                           core/.vault-active, skills link, rerere;
                                           prints the Codex wiring, writes none of it
  node install.mjs --link-skills           create or repair only .claude/skills -> .agents/skills
  node install.mjs --link-global-skills    link /closeout and /lesson into the user-level
                                           skills folder of each installed runtime, so
                                           every project can use them (they write into
                                           the project or your kit, never the vault)
  node install.mjs --unlink-global-skills  remove exactly those links again
  node install.mjs --list-packs            show the optional skill packs, their skills
                                           and where each is linked
  node install.mjs --pack <name>           link one pack's skills into the user-level
                                           skills folder of each installed runtime
                                           (repeat --pack, or name,name, for several)
  node install.mjs --unpack <name>         remove exactly that pack's links again
  node install.mjs --obsidian              hide archive/, logs/, raw/ from Obsidian's
                                           search and graph, keeping your other settings
  node install.mjs --help                  this text

Nothing here commits, and the interview writes nothing until you confirm it.
`;

const KNOWN_ARGS = ['--link-skills', '--link-global-skills', '--unlink-global-skills', '--obsidian', '--list-packs', '--help', '-h'];
const VALUE_ARGS = ['--pack', '--unpack'];
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  stdout.write(USAGE);
  process.exit(0);
}
const packArgs = { '--pack': [], '--unpack': [] };
const unknown = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const eq = VALUE_ARGS.find((v) => a.startsWith(`${v}=`));
  if (eq) {
    packArgs[eq].push(...a.slice(eq.length + 1).split(','));
  } else if (VALUE_ARGS.includes(a)) {
    const v = args[i + 1];
    if (!v || v.startsWith('--')) {
      process.stderr.write(`${a} needs a pack name (see --list-packs)\n`);
      process.exit(2);
    }
    packArgs[a].push(...v.split(','));
    i++;
  } else if (!KNOWN_ARGS.includes(a)) {
    unknown.push(a);
  }
}
if (unknown.length) {
  process.stderr.write(`Unknown argument: ${unknown.join(' ')}\n\n${USAGE}`);
  process.exit(2);
}

if (args.includes('--list-packs')) process.exit(listPacksCommand());
if (packArgs['--pack'].length || packArgs['--unpack'].length) {
  if (packArgs['--pack'].length && packArgs['--unpack'].length) {
    process.stderr.write('Use --pack or --unpack, not both at once.\n');
    process.exit(2);
  }
  const remove = packArgs['--unpack'].length > 0;
  const names = [...new Set((remove ? packArgs['--unpack'] : packArgs['--pack']).map((n) => n.trim()).filter(Boolean))];
  process.exit(packCommand(names, remove));
}

if (process.argv.includes('--link-skills')) {
  const r = linkSkills();
  stdout.write(`.claude/skills -> .agents/skills: ${r.ok ? r.note : `FAILED — ${r.note}`}\n`);
  process.exit(r.ok ? 0 : 1);
}

if (process.argv.includes('--obsidian')) {
  const r = obsidianIgnore();
  stdout.write(`.obsidian/app.json: ${r.note}\n`);
  process.exit(r.ok ? 0 : 1);
}

if (process.argv.includes('--link-global-skills') || process.argv.includes('--unlink-global-skills')) {
  process.exit(globalSkills(process.argv.includes('--unlink-global-skills')) ? 0 : 1);
}

const rl = readline.createInterface({ input: stdin, output: stdout });

// Lines are queued rather than awaited one at a time. With a real terminal the
// two are identical, but with piped input readline delivers a whole buffered
// chunk at once and every line after the first is dropped on the floor — which
// makes the installer impossible to smoke-test and silently truncates anyone's
// scripted run. Queue first, hand out one line per question.
const pending = [];
const waiting = [];
let closed = false;
rl.on('line', (line) => {
  const next = waiting.shift();
  if (next) next(line);
  else pending.push(line);
});
rl.on('close', () => {
  closed = true;
  while (waiting.length) waiting.shift()(null);
});

function nextLine() {
  if (pending.length) return Promise.resolve(pending.shift());
  if (closed) return Promise.resolve(null);
  return new Promise((resolve) => waiting.push(resolve));
}

const ask = async (q, fallback = '') => {
  stdout.write(q);
  const line = await nextLine();
  if (line === null) return fallback; // input ended — take the default
  const a = line.trim();
  return a === '' ? fallback : a;
};

function bail(msg) {
  stdout.write(`\n${msg}\n`);
  rl.close();
  process.exit(1);
}

if (!fs.existsSync(CORE)) {
  bail('No core/ directory here. Run this from the root of your brain clone.');
}

if (fs.existsSync(MARKER)) {
  const again = await ask(
    'core/.vault-active already exists — this vault looks personalized.\n' +
      'Re-run setup and overwrite core/USER.md? [y/N] ',
    'n',
  );
  if (!/^y(es)?$/i.test(again)) {
    bail('Nothing changed. (To repair only the skills link: node install.mjs --link-skills)');
  }
}

stdout.write(`
memcellar — setup
-----------------------
Answer what you can. Leave anything blank rather than guessing: a blank line
is honest, an invented one is read as true by every future session.

`);

const name = await ask('Your name (what should the assistant call you?): ');
const role = await ask('Your role, one line: ');
const where = await ask('Location / timezone: ');
const lang = await ask('Language the vault talks and writes in [English]: ', 'English');
const style = await ask('Communication style, one line [concise, explain properly]: ',
  'concise, but explain properly — a summary that needs a follow-up failed');
const background = await ask('Technical background, one line: ');
const focusRaw = await ask('Current focus — active projects, comma-separated: ');
const focus = focusRaw.split(',').map((s) => s.trim()).filter(Boolean);

const today = new Date().toISOString().slice(0, 10);

const userMd = `# User

## Name
${name || '<!-- unanswered -->'}${name ? `. Address as "${name}".` : ''}

## Role
${role || '<!-- unanswered -->'}

## Location / Timezone
${where || '<!-- unanswered -->'}

## Communication style
- Talks and writes in **${lang}** (\`IDENTITY.md\`, ADR 0059).
- ${style}

## Technical background
- ${background || '<!-- unanswered -->'}

## Current focus
${focus.length
    ? focus.map((f) => `- **${f}** — <!-- one line on what it is; link its card once it has one -->`).join('\n')
    : '<!-- unanswered -->'}

<!-- Filled ${today} by install.mjs from a setup interview.
     Correct it rather than growing it: when a line here turns out to be wrong,
     the fix is an edit plus a dated comment, not a second line saying otherwise.
     Budget: 2000 characters, HTML comments excluded. -->
`;

stdout.write(`
About to write:

  core/USER.md          (${userMd.length} chars)
  core/IDENTITY.md      (language line only)
  notes/todo.md         (your name as its author, if you gave one)
  .obsidian/app.json    (hide archive/, logs/, raw/; other settings kept)
  core/.vault-active    (switches the SessionStart hook on)
  .claude/skills        (link to .agents/skills — the one skills copy)
  git config rerere.enabled true

`);

const go = await ask('Write these? [Y/n] ', 'y');
if (!/^y(es)?$/i.test(go)) bail('Nothing changed.');

fs.writeFileSync(path.join(CORE, 'USER.md'), userMd, 'utf8');

// IDENTITY.md keeps its own wording; only the placeholder is filled.
const idPath = path.join(CORE, 'IDENTITY.md');
if (fs.existsSync(idPath)) {
  const id = fs.readFileSync(idPath, 'utf8');
  const filled = id.replaceAll('<LANGUAGE>', lang);
  if (filled !== id) fs.writeFileSync(idPath, filled, 'utf8');
}

// The to-do page is the owner's (ADR 0060); it ships with a placeholder author.
const todoPath = path.join(ROOT, 'notes', 'todo.md');
if (name && fs.existsSync(todoPath)) {
  const todo = fs.readFileSync(todoPath, 'utf8');
  const named = todo.replace(/^author: owner$/m, `author: ${name}`);
  if (named !== todo) fs.writeFileSync(todoPath, named, 'utf8');
}

const obsidian = obsidianIgnore();
stdout.write(`  .obsidian/app.json: ${obsidian.ok ? obsidian.note : `SKIPPED — ${obsidian.note}`}\n`);

fs.writeFileSync(
  MARKER,
  `# This file switches the SessionStart hook on. It is gitignored on purpose:
# a fresh clone of the template must never inject context or pull over your
# head.
# Created ${today} by install.mjs.
`,
  'utf8',
);

const link = linkSkills();
stdout.write(`  .claude/skills -> .agents/skills: ${link.ok ? link.note : `FAILED — ${link.note}`}\n`);

try {
  execFileSync('git', ['config', 'rerere.enabled', 'true'], { cwd: ROOT, stdio: 'ignore' });
} catch {
  stdout.write('  (git config rerere failed — harmless, set it by hand if you want it)\n');
}

const abs = ROOT.replace(/\\/g, '/');
const codexBlock = JSON.stringify(
  {
    hooks: {
      SessionStart: [
        { hooks: [{ type: 'command', command: `node "${abs}/.codex/hooks/session-start.mjs"`, timeout: 60 }] },
      ],
    },
  },
  null,
  2,
);
const indent = (s) => s.split('\n').map((l) => `    ${l}`).join('\n');

stdout.write(`
Done. Your brain is live in this folder.

Commit the personalization yourself, with explicit paths — nothing here commits
for you, and nothing ever stages the whole tree:

    git add core/USER.md core/IDENTITY.md notes/todo.md
    git commit -m "setup: personalize brain"
${focus.length ? `
Your current-focus projects have no card in notes/ yet. Open a session in
this folder and ask for a card for each (.claude/templates/project.md), then
link it from USER.md. \`node scripts/project-doctor.mjs --board\` shows them all live.
` : ''}
How the brain is wired
----------------------
There is exactly one hook per runtime: SessionStart. Nothing commits at Stop,
SessionEnd or PreCompact — commits are made by the task that wrote the files.
The hook works only inside this folder: in any other project it exits at once,
without a pull and without injecting anything (ADR 0052). A project keeps its
own state, decisions and lessons in its own repo; lessons about how you work
and traps any project could hit go to your user-level kit (ADR 0056). To see
every project at once, run node scripts/project-doctor.mjs --board here.

Claude Code — nothing to do. This repo's .claude/settings.json wires the hook.

Codex — merge this into ~/.codex/hooks.json (append to any existing "hooks"
arrays, never replace them), then re-trust the changed hook definition in
Codex. Outside this folder it does nothing, so wiring it at user level costs
other projects nothing. Do not also add it to a project-level
.codex/hooks.json: Codex adds the layers together, so it would fire twice.

${indent(codexBlock)}

The scripts resolve the brain root themselves (their own location, or BRAIN_DIR
if you set it), so they are correct from any working directory.

Optional — /closeout and /lesson in your other projects. /closeout ends project
work (state file, run report, one commit of exactly the task's paths) and
/lesson keeps a correction in your user-level kit, or in that project's
docs/lessons/ when it is tied to the project's code (ADR 0056). Neither touches
the brain. To make them loadable everywhere — opt-in, and undone by
--unlink-global-skills:

    node install.mjs --link-global-skills

Optional — skill packs. Research, a build-and-review chain, release and idea
scoping ship as packs you link only if you want them; they work in any
project and in this vault:

    node install.mjs --list-packs
    node install.mjs --pack research

Check the wiring any time with:  node scripts/brain-doctor.mjs

Now open this folder as an Obsidian vault (optional), start \`claude\` or
\`codex\` in it, and say hello. Claude Code reads AGENTS.md through CLAUDE.md
and gets core/ from this repo's own hook; Codex reads AGENTS.md natively and
gets core/ only once its hook (above) is wired.
`);

rl.close();
