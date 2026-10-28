# Project-repo formats

The repo half of ADR 0045 (`docs/decisions/0045-project-execution-state-lives-in-the-repo.md`):
a project's execution state lives in the project's own repo, committed. Since
v1.2 the project also keeps the lessons tied to it, and a project session neither
reads nor writes the brain (ADR 0052); a vault session reads the repo
read-only when you want the cross-project view (`scripts/project-doctor.mjs --board`,
ADR 0056). These files are the formats
for that repo half. Nothing in the brain reads them from here — you copy them
into a project repo and they live there.

| File here | Becomes, in the project repo | What it holds |
|---|---|---|
| `AGENTS.template.md` | `AGENTS.md` | the contract: ownership map, commands, invariants, autonomy and blocker rules. Timeless — no status, no dated paragraphs |
| `CLAUDE.template.md` | `CLAUDE.md` | the shim: `@AGENTS.md` plus Claude-only lines |
| `docs/CURRENT_STATE.md` | `docs/CURRENT_STATE.md` | **the only file that states status** — milestones, open gates, blockers, the next action. At most 80 lines |
| `docs/runs/TEMPLATE.md` | `docs/runs/TEMPLATE.md` | the shape of a run report — one `docs/runs/YYYY-MM-DD_<slug>.md` per autonomous run: checks, evidence, assumptions, cost, nothing git or STATE already holds |
| — | `docs/lessons/lesson-<topic>.md` | created by `/lesson` on the first correction that is tied to this repo's code or domain: one file per recurring behaviour, entries appended verbatim. Corrections about how the owner wants work done in general go to the owner's user-level kit instead (ADR 0056) |

There is no WORKLOG any more (ADR 0050). Its lines restated commit subjects
and STATE rows; **`git log` is the project's history** — a commit subject says
what changed, a milestone commit says its result (`M3 PASS: …`). An existing
`docs/WORKLOG.md` is frozen history: keep it, never append to it.

The contract files carry a `.template.md` suffix so that an agent working
inside the brain never loads them as its own instructions.

Plans, ADRs, lessons, research and evidence belong in the same repo, committed.
Untracked memory is not memory.

## Adopting the formats in a project repo

The easy way: open a session in the project repo and ask the agent to adopt
the formats from this README. By hand, from the project repo's root:

```bash
# bash / zsh (macOS, Linux, Git Bash)
BRAIN="/path/to/your/brain"
T="$BRAIN/.claude/templates/project-repo"
mkdir -p docs/runs
[ -e AGENTS.md ] || cp "$T/AGENTS.template.md" AGENTS.md
[ -e CLAUDE.md ] || cp "$T/CLAUDE.template.md" CLAUDE.md
for f in docs/CURRENT_STATE.md docs/runs/TEMPLATE.md; do
  [ -e "$f" ] || cp "$T/$f" "$f"
done
```

```powershell
# PowerShell (Windows)
$BRAIN = '<path to your brain>'
$T = Join-Path $BRAIN '.claude/templates/project-repo'
New-Item -ItemType Directory -Force docs/runs | Out-Null
if (-not (Test-Path AGENTS.md)) { Copy-Item "$T/AGENTS.template.md" AGENTS.md }
if (-not (Test-Path CLAUDE.md)) { Copy-Item "$T/CLAUDE.template.md" CLAUDE.md }
foreach ($f in 'docs/CURRENT_STATE.md', 'docs/runs/TEMPLATE.md') {
  if (-not (Test-Path $f)) { Copy-Item "$T/$f" $f }
}
```

Then:

1. **Fill the slots** in `AGENTS.md` from the repo as it is — only commands
   that actually ran green, the real plan path — and delete the rows and
   sections that do not apply. Keep the wording of the autonomy, blocker and
   status sections: rewording them per project is how two repos end up with
   two meanings of PASS.
2. **Fill STATE's frontmatter:** `project_id` (a kebab-case slug, usually
   the repo name — the vault's card uses it as its filename), `implementation_agent` (`claude-code` or `codex`), `branch`,
   `as_of` (the short sha of HEAD), and one `PLANNED` row per milestone.
3. **Commit all of it**, by explicit path, under a subject that reads as
   history, e.g. `Execution layer adopted, implementation agent claude-code`.
4. **When you want the brain to know the project**, open a vault session and
   ask for a card for it: `notes/<project_id>.md` from
   `.claude/templates/project.md`, with its `INDEX.md` row. The card names
   the repo and its state file and never copies status;
   `node scripts/project-doctor.mjs --board` reads the status live.

A repo that already has instructions gains only what is missing. An existing
`AGENTS.md` gets the missing sections, not a rewrite. An existing `CLAUDE.md`
with content and no `AGENTS.md` stays the one file with content — never a
second copy beside it. A repo that already states status in several places (a
long state file with history, "Status:" lines in plans, ticked checklists):
list them all and consolidate into one STATE only when the owner asks.

## Read-first order

Every session in the repo — either runtime, interactive or autonomous —
resumes in this order and reads everything else on demand:

1. `AGENTS.md`
2. `docs/CURRENT_STATE.md`
3. `git log --oneline -15`
4. the active milestone's section of the plan

Never resume from a chat or compaction summary. Re-anchor from STATE,
`git log --oneline <as_of>..HEAD`, `git status` and the diff.

## Status lives only in STATE

A plan defines acceptance and never ticks it. A README or architecture doc
carries no "Status:" line. The vault card points at STATE and never restates
it. A status written twice is right for a day and wrong afterwards, and
nothing says which day.

Vocabulary: `PLANNED | IN_PROGRESS | PASS | FAIL | BLOCKED(<type>) | ABANDONED | OPEN_GATE`.
"Not run" is never PASS.

STATE is **fresh** when no commit after the latest commit to
`docs/CURRENT_STATE.md` touches anything but that file and `docs/runs/` (or a
frozen `docs/WORKLOG.md`). Code and its STATE update in one commit is the preferred shape; a
docs-only follow-up commit is fresh too. `as_of` is information — the sha the
checks ran against — not the freshness key. To check by hand (empty output
means fresh):

```bash
last=$(git log -1 --format=%H -- docs/CURRENT_STATE.md)
git log --format= --name-only "$last..HEAD" -- . ':!docs/CURRENT_STATE.md' ':!docs/WORKLOG.md' ':!docs/runs'
```

```powershell
$last = git log -1 --format=%H -- docs/CURRENT_STATE.md
git log --format= --name-only "$last..HEAD" -- . ':!docs/CURRENT_STATE.md' ':!docs/WORKLOG.md' ':!docs/runs'
```

From a vault session, `node scripts/project-doctor.mjs` runs the same check —
and the rest of this contract — for every repo a brain card names, read-only.

## Interrupted runs

An autonomous run sets STATE `active_run: docs/runs/<file>.md` when it starts
and leaves the report's `status:` empty until it ends. So if STATE names an
`active_run` whose report is missing or has no `status:`, that run died
mid-way. Before any new work:

1. read `git log <base_sha or as_of>..HEAD` and `git diff` for what actually
   landed;
2. re-run the checks the run owed, assuming nothing passed;
3. correct STATE to what is true;
4. finish the run, or write its report with `status: ABANDONED`, and set
   `active_run: none`.

What is written down loses to git, the diff and a fresh test run.
`/closeout` runs this protocol first whenever it finds one.

## Ending work: `/closeout`

`/closeout` (in the brain's `.agents/skills/closeout/`) is the last step of
project work: STATE brought up to date, the run report of an autonomous run,
this task's merged worktrees removed, and one commit of exactly the paths the
task wrote. It never touches the brain (ADR 0052). It also asks whether the
task hit a trap any repository could hit — a library, tool or machine that
behaves unexpectedly — and if so appends it to the owner's kit, in
`reference/` (ADR 0056). `/lesson` is its partner: a correction to how the
agent works goes to the kit's `lessons/` by default, or to this repo's
`docs/lessons/` when it is tied to this repo, and after a second entry on
the same behaviour it proposes a rule where the mistake was made — for a
repo lesson this repo's `AGENTS.md`, a skill or a check (ADR 0048).
`node install.mjs --link-global-skills` in the brain makes both loadable in
any project.

## Optional gates — not shipped

The reference instance also turns some of these sentences into hooks. They
are not part of this template: each is a runtime hook with its own config, and
this system adds machinery only when a failure demands it. Add one when you
see the failure it prevents.

- **Commit gate** — a `PreToolUse` hook on shell commands that runs the full
  offline suite before a `git commit` is allowed, and warns when code is
  committed without a STATE update.
- **Holdout lock** — a `PreToolUse` hook that refuses agent edits under
  `tests/acceptance/holdout/`, so the independently written acceptance
  scenarios cannot be "fixed" by the agent that has to pass them. Without
  it, the build pack's `scenario-author` still detects any change: it lands
  the scenarios with a `LOCK.json` of file hashes, and its `lock.mjs check`
  and `verify-holdout.mjs` refuse to pass a folder that differs from it.
- **Test gate** — a `Stop` hook that runs the fast offline suite before a
  session may end.

Whatever you add, commit its config: a worktree holds only tracked files, so
an untracked gate config silently disables the gate in every run worktree.
