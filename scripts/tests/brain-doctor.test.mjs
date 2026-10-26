// Coverage for the brain-doctor checks added with the provenance work:
// Provenance (the corroboration gate), Retired terms, Tier-0 integrity, and
// User-level skills (only closeout and lesson may be linked outside the vault).
//
// Every case builds a throwaway vault and kit in the OS temp dir and points the
// doctor at them with BRAIN_DIR / BRAIN_KIT_DIR, with the runtime homes
// (CLAUDE_CONFIG_DIR, CODEX_HOME, the home directory) inside the fixture too,
// then reads the markdown table it prints; no real vault, kit or home is
// touched.
//
// Run: node --test scripts/tests/brain-doctor.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const doctor = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'brain-doctor.mjs');

function put(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function git(repo, ...args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function commitAll(repo) {
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.name', 'Doctor Test');
  git(repo, 'config', 'user.email', 'doctor@example.invalid');
  git(repo, 'config', 'core.autocrlf', 'false');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'fixture');
}

const NOTE = (fields = '') => `---\ntype: knowledge\nstatus: growing\n${fields}---\n\n# Note\n`;

// A vault and a kit that are clean on every rule the new checks apply, both
// committed so the dirty-tree rule has something to compare against.
function fixture(t, { memory, notes = {}, core = {}, vaultFiles = {}, kitFiles = {}, git: useGit = true } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'brain-doctor-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const vault = path.join(root, 'vault');
  const kit = path.join(root, 'kit');
  const home = path.join(root, 'home');
  mkdirSync(home, { recursive: true });
  // {{VAULT}} in a fixture file is the vault's own path; {{VAULT_BS}} the same
  // with backslashes, {{VAULT_DBS}} with doubled backslashes (a JSON string).
  const forward = vault.replaceAll('\\', '/');
  const fill = (text) => text
    .replaceAll('{{VAULT_DBS}}', forward.replaceAll('/', '\\\\'))
    .replaceAll('{{VAULT_BS}}', forward.replaceAll('/', '\\'))
    .replaceAll('{{VAULT}}', forward);
  const coreFiles = {
    'IDENTITY.md': '# Identity\n',
    'USER.md': '# User\n',
    'MEMORY.md': memory ?? '# Memory\n\n- Layout is one folder per lifecycle → [[kept]]\n',
    'OPEN_QUESTIONS.md': '# Open Questions\n',
    ...core,
  };
  for (const [name, text] of Object.entries(coreFiles)) put(path.join(vault, 'core', name), text);
  put(path.join(vault, 'notes', 'kept.md'), NOTE('confidence: medium\nsource: raw/x.md\n'));
  for (const [name, text] of Object.entries(notes)) put(path.join(vault, 'notes', `${name}.md`), text);
  for (const [name, text] of Object.entries(vaultFiles)) put(path.join(vault, name), fill(text));
  put(path.join(kit, 'hooks', 'guard.mjs'), '// clean\n');
  for (const [name, text] of Object.entries(kitFiles)) put(path.join(kit, name), fill(text));
  if (useGit) {
    commitAll(vault);
    commitAll(kit);
  }
  return { vault, kit, home };
}

function doctorEnv({ vault, kit, home }) {
  const env = { ...process.env, BRAIN_DIR: vault };
  delete env.BRAIN_KIT_DIR;
  if (kit) env.BRAIN_KIT_DIR = kit;
  if (home) {
    env.CLAUDE_CONFIG_DIR = path.join(home, '.claude');
    env.CODEX_HOME = path.join(home, '.codex');
    env.HOME = home;
    env.USERPROFILE = home;
  }
  return env;
}

// Runs the doctor as a child process and returns { rows: { area: {status, detail} }, summary, stdout }.
function diagnose(fx, ...args) {
  const result = spawnSync(process.execPath, [doctor, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    env: doctorEnv(fx),
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.ok(result.stdout.startsWith('# Brain doctor'), result.stderr || result.stdout);
  const rows = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^\| (.+?) \| \*\*(PASS|WARN|FAIL)\*\* \| (.*) \|$/);
    if (match) rows[match[1]] = { status: match[2], detail: match[3].replaceAll('\\|', '|') };
  }
  return { rows, stdout: result.stdout, code: result.status };
}

const verdict = (run, area) => `${area}: ${run.rows[area]?.status} ${run.rows[area]?.detail}`;

test('a clean vault and kit pass Provenance, Tier-0 integrity and Retired terms', (t) => {
  const fx = fixture(t, {
    vaultFiles: {
      '.agents/skills/ingest/SKILL.md': '---\nname: ingest\n---\nRead the source, then write the page.\n',
      '.claude/hooks/append-signal.mjs': '// logger\n',
    },
    kitFiles: { 'skills/adr/SKILL.md': '---\nname: adr\n---\nNothing retired here.\n' },
  });
  const run = diagnose(fx);
  for (const area of ['Provenance', 'Tier-0 integrity', 'Retired terms']) {
    assert.equal(run.rows[area]?.status, 'PASS', verdict(run, area));
  }
  assert.match(run.stdout, /Read-only: no repair or write was attempted\./);
  assert.equal(git(fx.vault, 'status', '--porcelain'), '', 'the doctor must not write into the vault');
  assert.equal(git(fx.kit, 'status', '--porcelain'), '', 'the doctor must not write into the kit');
});

test('Provenance FAILs when MEMORY.md links a confidence: low note', (t) => {
  const fx = fixture(t, {
    memory: '# Memory\n\n- Seen once, still low → [[once-seen]]\n- Fine → [[kept]]\n',
    notes: { 'once-seen': NOTE('confidence: low\nsource: raw/x.md\n') },
  });
  const run = diagnose(fx);
  assert.equal(run.rows.Provenance.status, 'FAIL', verdict(run, 'Provenance'));
  assert.match(run.rows.Provenance.detail, /once-seen/);
  assert.doesNotMatch(run.rows.Provenance.detail, /MEMORY\.md links confidence: low: [^;]*kept/);
});

test('Provenance ignores the alias part, comments, and links that are not notes', (t) => {
  const aliased = fixture(t, {
    memory: '# Memory\n\n- Seen once → [[once-seen|the alias]]\n',
    notes: { 'once-seen': NOTE('confidence: low\nsource: raw/x.md\n') },
  });
  assert.equal(diagnose(aliased).rows.Provenance.status, 'FAIL', 'an aliased link still resolves');

  const quiet = fixture(t, {
    memory: [
      '<!-- never link [[once-seen]] from here -->',
      '# Memory',
      '',
      '- Pointer into the archive → [[0044-some-adr]] and [[not-a-note]]',
      '- A path-shaped link is not a notes/ name → [[archive/once-seen]]',
      '',
    ].join('\n'),
    notes: { 'once-seen': NOTE('confidence: low\nsource: raw/x.md\n') },
    vaultFiles: { 'archive/0044-some-adr.md': NOTE('confidence: low\n') },
  });
  const run = diagnose(quiet);
  assert.equal(run.rows.Provenance.status, 'PASS', verdict(run, 'Provenance'));
});

test('Provenance WARNs on source: notes without confidence, listing a count and five names', (t) => {
  const notes = {};
  for (let i = 1; i <= 7; i++) notes[`unrated-${i}`] = NOTE('source: raw/x.md\n');
  notes['rated'] = NOTE('source: raw/x.md\nconfidence: high\n');
  notes['no-source'] = NOTE('');
  notes['body-only'] = '---\ntype: knowledge\n---\n\nsource: raw/x.md appears in the body only\n';
  const run = diagnose(fixture(t, { notes }));
  const { status, detail } = run.rows.Provenance;
  assert.equal(status, 'WARN', verdict(run, 'Provenance'));
  assert.match(detail, /7 source: note\(s\) without confidence/);
  for (let i = 1; i <= 5; i++) assert.ok(detail.includes(`unrated-${i}.md`), detail);
  assert.ok(!detail.includes('unrated-6.md') && !detail.includes('unrated-7.md'), 'only the first five are named');
  for (const name of ['rated.md', 'no-source.md', 'body-only.md']) assert.ok(!detail.includes(name), `${name} is not a finding`);
});

test('Provenance leaves an owner page with source: and no confidence alone (ADR 0060)', (t) => {
  const notes = { 'jane-doe': '---\nauthor: owner\nkind: person\nsource: https://example.com\n---\n\n# Jane\n' };
  const run = diagnose(fixture(t, { notes }));
  assert.equal(run.rows.Provenance.status, 'PASS', verdict(run, 'Provenance'));
});

test('Provenance WARNs on MEMORY bullets that are neither dated nor pointers', (t) => {
  const long = `Vague claim number five ${'x'.repeat(80)}`;
  const memory = [
    '<!-- a comment bullet-like line',
    '- inside a comment, ignored',
    '-->',
    '# Memory',
    '',
    '- Vague claim one',
    '- Vague claim two',
    '  with a continuation line and no date',
    '- Vague claim three',
    `- ${long}`,
    '- Dated on 2026-10-21, so fine',
    '- Wrapped pointer that only names its source',
    '  on the next line → [[kept]]',
    '- Names the script `scripts/brain-doctor.mjs` so fine',
    '- Names a note file `INDEX.md` so fine',
    '- A bare `word` in backticks is not a pointer',
    '- Decided in ADR 0052 so fine',
    '',
    '## Heading ends a bullet',
    '- Vague claim after the heading',
    '',
  ].join('\n');
  const run = diagnose(fixture(t, { memory }));
  const { status, detail } = run.rows.Provenance;
  assert.equal(status, 'WARN', verdict(run, 'Provenance'));
  assert.match(detail, /6 MEMORY bullet\(s\) neither dated nor pointer/);
  assert.ok(detail.includes('"Vague claim one"') && detail.includes('"Vague claim two with a continuation line and no date"'), detail);
  assert.ok(!detail.includes('five'), 'only the first three are shown');
  assert.ok(!detail.includes('inside a comment'), 'comments are stripped first');
  const truncated = diagnose(fixture(t, { memory: `# Memory\n\n- ${long}\n` })).rows.Provenance.detail;
  assert.ok(truncated.includes(`"${long.slice(0, 60)}"`) && !truncated.includes(long.slice(0, 61)), truncated);
});

test('Provenance: the low-confidence link outranks the warnings', (t) => {
  const run = diagnose(fixture(t, {
    memory: '# Memory\n\n- Undated claim [[once-seen]]\n- Another undated claim\n',
    notes: { 'once-seen': NOTE('confidence: low\nsource: raw/x.md\n'), 'unrated': NOTE('source: raw/x.md\n') },
  }));
  assert.equal(run.rows.Provenance.status, 'FAIL', verdict(run, 'Provenance'));
  assert.match(run.rows.Provenance.detail, /once-seen/);
  assert.match(run.rows.Provenance.detail, /unrated\.md/);
  assert.match(run.rows.Provenance.detail, /Another undated claim/);
});

test('Tier-0 integrity FAILs on a right-to-left override in a core file', (t) => {
  const run = diagnose(fixture(t, { core: { 'MEMORY.md': `# Memory\n\n- Looks fine \u202E but is not → [[kept]]\n` } }));
  assert.equal(run.rows['Tier-0 integrity'].status, 'FAIL', verdict(run, 'Tier-0 integrity'));
  assert.match(run.rows['Tier-0 integrity'].detail, /MEMORY\.md U\+202E/);
  assert.equal(run.rows.Provenance.status, 'PASS', 'the rest of the file is still readable');
});

test('Tier-0 integrity names every kind of invisible character, but lets a leading BOM through', (t) => {
  const cases = [
    ['USER.md', '\u200B', 'U+200B'],
    ['IDENTITY.md', '\u2066', 'U+2066'],
    ['OPEN_QUESTIONS.md', String.fromCodePoint(0xE0041), 'U+E0041'],
    ['MEMORY.md', '\uFEFF', 'U+FEFF'],
  ];
  const core = Object.fromEntries(cases.map(([name, ch]) => [name, `# ${name}\n\ntext ${ch} text\n`]));
  const run = diagnose(fixture(t, { core }));
  assert.equal(run.rows['Tier-0 integrity'].status, 'FAIL');
  for (const [name, , code] of cases) assert.ok(run.rows['Tier-0 integrity'].detail.includes(`${name} ${code}`), run.rows['Tier-0 integrity'].detail);

  const bom = diagnose(fixture(t, { core: { 'USER.md': '\uFEFF# User\n' } }));
  assert.equal(bom.rows['Tier-0 integrity'].status, 'PASS', verdict(bom, 'Tier-0 integrity'));
});

test('Tier-0 integrity WARNs on uncommitted changes under core/ and in the kit hooks', (t) => {
  const vaultDirty = fixture(t);
  writeFileSync(path.join(vaultDirty.vault, 'core', 'USER.md'), '# User\n\nedited, not committed\n');
  const a = diagnose(vaultDirty);
  assert.equal(a.rows['Tier-0 integrity'].status, 'WARN', verdict(a, 'Tier-0 integrity'));
  assert.match(a.rows['Tier-0 integrity'].detail, /1 in vault/);

  const hookDirty = fixture(t);
  put(path.join(hookDirty.vault, '.claude', 'hooks', 'new.mjs'), '// untracked\n');
  const b = diagnose(hookDirty);
  assert.equal(b.rows['Tier-0 integrity'].status, 'WARN', verdict(b, 'Tier-0 integrity'));

  const kitDirty = fixture(t);
  writeFileSync(path.join(kitDirty.kit, 'hooks', 'guard.mjs'), '// edited\n');
  const c = diagnose(kitDirty);
  assert.equal(c.rows['Tier-0 integrity'].status, 'WARN', verdict(c, 'Tier-0 integrity'));
  assert.match(c.rows['Tier-0 integrity'].detail, /1 in kit hooks/);

  const elsewhere = fixture(t);
  writeFileSync(path.join(elsewhere.vault, 'notes', 'kept.md'), NOTE('confidence: medium\nsource: raw/x.md\n') + 'edited\n');
  assert.equal(diagnose(elsewhere).rows['Tier-0 integrity'].status, 'PASS', 'a dirty note is not Tier-0');
});

test('Tier-0 integrity still passes when git cannot read the folders, and says so', (t) => {
  const run = diagnose(fixture(t, { git: false }));
  assert.equal(run.rows['Tier-0 integrity'].status, 'PASS', verdict(run, 'Tier-0 integrity'));
  assert.match(run.rows['Tier-0 integrity'].detail, /git unreadable/);
});

test('Retired terms WARNs on stale references and reports path:line term', (t) => {
  const fx = fixture(t, {
    kitFiles: {
      'skills/usage-report/SKILL.md': '---\nname: x\n---\nreads `.claude/.access.json` today\n',
      'skills/lesson/SKILL.md': 'fine\nthe Acceptance Rate of proposals\n',
      'skills/handoff/SKILL.md': 'never read `{{VAULT}}` and not {{VAULT_BS}} either\n',
      'skills/closeout/SKILL.md': 'closeout may say it never touches {{VAULT}}\n',
      'skills/digest/SKILL.md': 'replaces the old /flywheel pass\n',
      'hooks/stale.mjs': "// run scripts/proposals.mjs\n",
      'hooks/tests/nested.mjs': '// .access.json in a subfolder is not scanned\n',
    },
    vaultFiles: {
      '.agents/skills/ingest/SKILL.md': 'searches the vault at {{VAULT}}\n',
      '.claude/hooks/lib.mjs': '// retrieval-rollup lines stay in logs/signals/ as history\n// the old /flywheel pass\n',
    },
  });
  const run = diagnose(fx);
  const { status, detail } = run.rows['Retired terms'];
  assert.equal(status, 'WARN', verdict(run, 'Retired terms'));
  // 1 access.json + 1 acceptance rate + 1 wall (one line, two spellings = one hit)
  // + 1 /flywheel in a kit skill + 1 proposals.mjs + 1 /flywheel in lib.mjs = 6.
  // Not counted: retrieval-rollup in lib.mjs (allowed), logs/signals/ (still
  // live), closeout (allowed by the wall rule), the vault skill naming the
  // vault (outside the kit wall rule) and the nested hook (out of scope).
  assert.match(detail, /^6 hit\(s\): /);
  assert.doesNotMatch(detail, /closeout|retrieval-rollup|logs\/signals/);
  assert.equal(detail.match(/:\d+ /g).length, 5, 'only the first five hits are listed');
  assert.ok(detail.endsWith('; ...'), detail);
  const all = diagnose(fixture(t, { kitFiles: { 'skills/usage-report/SKILL.md': 'x\ny\nreads `.claude/.access.json` today\n' } }));
  assert.match(all.rows['Retired terms'].detail, /1 hit\(s\): usage-report\/SKILL\.md:3 \.access\.json/);
});

test('Retired terms: scope, case and folders', (t) => {
  const wall = diagnose(fixture(t, { kitFiles: { 'skills/handoff/SKILL.md': 'x\nreads {{VAULT_DBS}}\n' } }));
  assert.equal(wall.rows['Retired terms'].status, 'WARN', verdict(wall, 'Retired terms'));
  assert.match(wall.rows['Retired terms'].detail, /^1 hit\(s\): handoff\/SKILL\.md:2 /);

  const allowed = diagnose(fixture(t, { kitFiles: { 'skills/closeout/SKILL.md': 'x\nnever touches {{VAULT}}\n' } }));
  assert.equal(allowed.rows['Retired terms'].status, 'PASS', 'allow-listed kit files may name the vault');

  const vaultOnly = diagnose(fixture(t, { vaultFiles: { '.agents/skills/ingest/SKILL.md': 'reads {{VAULT}}\n' } }));
  assert.equal(vaultOnly.rows['Retired terms'].status, 'PASS', 'the wall rule is for kit skills only');

  const caseless = diagnose(fixture(t, { vaultFiles: { '.agents/skills/audit/SKILL.md': 'The ACCEPTANCE RATE fell\n' } }));
  assert.match(caseless.rows['Retired terms'].detail, /audit\/SKILL\.md:1 acceptance rate/);

  const caseSensitive = diagnose(fixture(t, { vaultFiles: { '.agents/skills/audit/SKILL.md': 'See /FLYWHEEL\n' } }));
  assert.equal(caseSensitive.rows['Retired terms'].status, 'PASS', 'only acceptance rate ignores case');

  const missingKit = diagnose({ ...fixture(t), kit: path.join(os.tmpdir(), 'brain-doctor-no-such-kit') });
  assert.equal(missingKit.rows['Retired terms'].status, 'WARN', 'a named kit that does not exist is a warning');
  assert.match(missingKit.rows['Retired terms'].detail, /skills kit not found/);
});

test('a kit is scanned only when named, by BRAIN_KIT_DIR or --kit', (t) => {
  const fx = fixture(t, { kitFiles: { 'skills/usage-report/SKILL.md': 'reads `.claude/.access.json`\n' } });
  const unnamed = diagnose({ ...fx, kit: null });
  assert.equal(unnamed.rows['Retired terms'].status, 'PASS', verdict(unnamed, 'Retired terms'));
  const byFlag = diagnose({ ...fx, kit: null }, '--kit', fx.kit);
  assert.match(byFlag.rows['Retired terms'].detail, /^1 hit\(s\): usage-report\/SKILL\.md:1 \.access\.json/);
  const byEnv = diagnose(fx);
  assert.equal(byEnv.rows['Retired terms'].detail, byFlag.rows['Retired terms'].detail);
});

test('an unknown argument exits 2 with the usage line', (t) => {
  const fx = fixture(t, { git: false });
  const result = spawnSync(process.execPath, [doctor, '--bogus'], { encoding: 'utf8', windowsHide: true, env: doctorEnv(fx) });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown argument --bogus/);
  assert.match(result.stderr, /Usage: node scripts\/brain-doctor\.mjs/);
});

test('User-level skills: closeout and lesson may be linked; note and ingest may not (ADR 0052)', (t) => {
  const skill = (name) => `---\nname: ${name}\n---\n`;
  const vaultFiles = Object.fromEntries(['closeout', 'lesson', 'note', 'ingest']
    .map((name) => [`.agents/skills/${name}/SKILL.md`, skill(name)]));
  const link = (fx, dir, name) => {
    mkdirSync(dir, { recursive: true });
    symlinkSync(path.join(fx.vault, '.agents', 'skills', name), path.join(dir, name), 'junction');
  };

  const none = diagnose(fixture(t, { vaultFiles, git: false }));
  assert.equal(none.rows['User-level skills'].status, 'PASS', verdict(none, 'User-level skills'));
  assert.match(none.rows['User-level skills'].detail, /no vault skill linked at user level/);

  const ok = fixture(t, { vaultFiles, git: false });
  link(ok, path.join(ok.home, '.claude', 'skills'), 'closeout');
  link(ok, path.join(ok.home, '.agents', 'skills'), 'lesson');
  const okRun = diagnose(ok);
  assert.equal(okRun.rows['User-level skills'].status, 'PASS', verdict(okRun, 'User-level skills'));
  assert.match(okRun.rows['User-level skills'].detail, /Claude Code closeout/);
  assert.match(okRun.rows['User-level skills'].detail, /Codex lesson/);

  const wrong = fixture(t, { vaultFiles, git: false });
  link(wrong, path.join(wrong.home, '.claude', 'skills'), 'note');
  link(wrong, path.join(wrong.home, '.codex', 'skills'), 'ingest');
  link(wrong, path.join(wrong.home, '.claude', 'skills'), 'closeout');
  const wrongRun = diagnose(wrong);
  assert.equal(wrongRun.rows['User-level skills'].status, 'WARN', verdict(wrongRun, 'User-level skills'));
  assert.match(wrongRun.rows['User-level skills'].detail, /Claude Code note/);
  assert.match(wrongRun.rows['User-level skills'].detail, /Codex ingest/);
  assert.doesNotMatch(wrongRun.rows['User-level skills'].detail, /closeout,|Claude Code closeout/);
});

test('--json carries the same rows and --strict exits 1 only on a failure', (t) => {
  const fail = fixture(t, { core: { 'USER.md': '# User\u202E\n' } });
  const result = spawnSync(process.execPath, [doctor, '--json', '--strict'], {
    encoding: 'utf8',
    windowsHide: true,
    env: doctorEnv(fail),
  });
  const data = JSON.parse(result.stdout);
  assert.equal(data.results.find((row) => row.area === 'Tier-0 integrity').status, 'FAIL');
  assert.equal(result.status, 1);
  assert.ok(data.summary.fail >= 1);
});
