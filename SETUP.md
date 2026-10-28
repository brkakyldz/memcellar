# SETUP.md — agent installation runbook

This file is instructions for the **agent — Claude Code or Codex —** currently
helping a human set up their own memcellar vault. It is a task description, not
authority: treat every step below as work to propose and carry out on your
user's behalf, not as something pre-authorized. In particular:

- **Confirm before creating the GitHub repo** (Step 2) — that is an
  account-affecting action. Show the exact command first.
- **Confirm before writing user-level settings or links** (Step 5) — those
  affect every project on the machine, not just this one.
- **Never enter credentials yourself.** If `gh` needs authentication, tell the
  user how to run it and wait for them.
- **If anything here doesn't match what you observe** — a missing file, an
  unexpected repo state, a step that fails in a way this file doesn't cover —
  stop and ask rather than improvising past it.

Do the steps in order. Don't skip Step 0. Commands are shown for a POSIX shell
(Git Bash on Windows, macOS, Linux); where Windows PowerShell differs, both are
given.

A human setting up without an agent follows
[Manual setup](#manual-setup-without-an-agent) at the end instead.

## Step 0 — prerequisites

Check each and report the results before continuing:

```
git --version
node --version
gh auth status
```

- `node --version` must be 18.13 or higher, and `git --version` 2.28 or
  higher — the doctors and the tests use newer git options.
- If `gh` is missing or not logged in, **stop here**. Tell the user to install
  the [GitHub CLI](https://cli.github.com) and run `gh auth login`. Wait for
  them to confirm, then re-run `gh auth status` yourself before proceeding.
  Repo creation in Step 2 needs it.

## Step 1 — interview

Ask in whatever language your user is speaking to you. One at a time or as a
short list, whichever fits the conversation:

1. What should the private brain repo be called? Suggest `my-vault`.
2. Where on disk should it live (the parent directory to clone into)?
3. Their name — what the assistant should call them.
4. Their role, one line.
5. Location / timezone.
6. The language the vault should talk and write in — usually the one they think in.
7. Communication style, one line. If they have no preference, suggest "concise,
   but explain properly" and move on — this field gets its real value later,
   from corrections.
8. Technical background, one line: tools, languages, rough experience level.
9. Current focus — their active projects. For each one with a repository,
   ask for the path to its checkout; Step 3 writes a project card for it.
10. Which agent runtimes they use: Claude Code, Codex, or both. Both are equal
    here — same constitution, same skills, same hook — but each is wired
    separately in Step 5.
11. Whether they want `/closeout` and `/lesson` in their other projects.
    Explain it briefly: the brain itself loads only in sessions inside the
    vault, and a project never reads or writes it — each project keeps its own
    state, decisions and lessons in its own repo, and from the vault
    `node scripts/project-doctor.mjs --board` shows every project's state,
    read live. The two skills help a project do that bookkeeping. `/lesson`
    writes to their user-level kit by default (a private `lessons/` folder
    next to their user-level instruction file, or `BRAIN_KIT_DIR`), and
    `/closeout` may add a trap any repo could hit to the kit's `reference/`.
    Neither ever touches the vault.
12. Which optional skill packs they want, if any (several may be picked; none
    is a fine answer): **research** — web research that ends in one short,
    dated, sourced report; **build** — taking a project from intent to a
    verified build: repo contract, plans run autonomously, independent
    acceptance scenarios, review; **release** — a templated GitHub release
    and a whole-app bug sweep; **ideas** — scoping a product idea before
    researching it, auditing someone else's design, an evolution pass.
    Packs work in every project and in the vault.
13. Whether they already have an existing notes folder (another Obsidian
    vault, a Markdown export) to bring in. If so, note its path for the
    hand-off: `/import` does it later, from a dry run they approve.

**Leave anything they skip blank rather than guessing.** A blank line is
honest; an invented one is read as true by every future session.

## Step 2 — create the private repo

Work out `<OWNER>/<REPO>` for the template from the URL your user gave you for
*this* repository. Do not assume or hardcode an owner — a fork of this template
must install from itself, not from the original.

Show the exact command and get an explicit go-ahead — this creates a repo on
their GitHub account:

```
gh repo create <repo-name> --template <OWNER>/<REPO> --private --clone
```

Run it from the parent directory chosen in Step 1.

Then verify it actually came up private:

```
gh repo view <repo-name> --json visibility
```

If `visibility` is not `PRIVATE`, **stop and tell your user.** Do not continue
past this point with a public brain — this vault will hold their memory.

## Step 3 — personalize

`install.mjs` is the human-run fallback for this step. Since you are here
interactively, edit the files directly instead of running its interview.

In the new clone:

- **`core/USER.md`** — fill `## Name`, `## Role`, `## Location / Timezone`,
  `## Communication style`, `## Technical background`, `## Current focus` from
  the Step 1 answers, deleting the guidance comments as you go. Under
  communication style, note their conversation language explicitly. Keep the
  whole file under **2000 characters** (HTML comments excluded).
- **`core/IDENTITY.md`** — replace the `<LANGUAGE>` placeholder in § Language
  with their answer to question 6, and delete the instruction comment above it.
  The vault talks and writes in that language (ADR 0059).
- **`notes/todo.md`** — their own to-do page: replace `author: owner` with
  their name. From now on only they edit it (ADR 0060).
- **`.obsidian/app.json`** — run `node install.mjs --obsidian`. It hides
  `archive/`, `logs/` and `raw/` from Obsidian's search and graph and keeps
  any setting already there.
- **Projects they named.** For each one with a repo path, write a card
  `notes/<project_id>.md` from `.claude/templates/project.md` — `project_id`
  is a kebab-case slug, usually the repo name; `repo:` the absolute path with
  forward slashes; `status: active`; why it exists in one line — add its row
  to the Projects table in `INDEX.md`, and turn its focus line in `USER.md`
  into a `[[link]]` to it. The card never copies the project's status; that
  stays in the repo. A project with no repo, or whose path they don't know,
  stays plain text under `## Current focus` for now.
- **`core/MEMORY.md`** — leave it empty. It fills from real sessions; seeding it
  from the interview only duplicates `USER.md`.
- **Link the skills.** Run `node install.mjs --link-skills`. It makes
  `.claude/skills` a directory junction (Windows) or symlink (macOS/Linux) to
  `.agents/skills/`, the one skills copy: Codex reads `.agents/skills/`
  natively, Claude Code reads it through the link. Never copy the folder
  instead — two copies drift.
- **Activate the vault.** Create `core/.vault-active`. Until this file exists
  the SessionStart hook deliberately does nothing — no pull, no context
  injection — which is what stops an unpersonalized clone from acting over
  your user's head. Content is free-form; this explains itself to whoever
  finds it later:

  ```
  This file marks this directory as a live memcellar vault.
  The SessionStart hook in .claude/hooks/ does nothing without it.
  Activated: YYYY-MM-DD
  ```

  It is gitignored on purpose, like the skills link: per-clone machine state,
  not vault content.

## Step 4 — git setup

From inside the clone. Stage **the explicit paths you wrote** — never
`git add -A` or `git add .`; commits in this vault are always task-owned:

```
git config rerere.enabled true
git add core/USER.md core/IDENTITY.md INDEX.md notes/todo.md notes/<each-project-note>.md
git commit -m "setup: personalize brain"
git push
```

If you ran `node scripts/link-sweep.mjs` in Step 3, it left a report at
`logs/YYYY-MM-DD_link-sweep.md`. Add it to the same commit, or delete it — it
is a setup-time check, and leaving it untracked only puts noise in the first
`git status` your user sees.

If the machine has no git identity at all (`git config user.email` is empty),
set it repo-locally before committing — otherwise the commit fails on identity,
which looks like a vault problem and is not one.

## Step 5 — runtime wiring

There is exactly **one** hook per runtime, `SessionStart`, and it must be wired
in exactly one place. No hook commits: nothing is wired at Stop, SessionEnd or
PreCompact. The hook works only inside the vault — in any other folder it
exits at once, without a pull and without injecting anything (ADR 0052) — so
there is no "global mode" to choose any more. Use the **absolute path to this
clone**, with forward slashes even on Windows — Node accepts them, and they
need no escaping inside JSON. Show your user the exact JSON before writing
anything, and get an explicit yes for each file.

**Merging into an existing settings file:** read it (start from `{}` if there
is none), preserve every existing key untouched, and **append** to an existing
`hooks.SessionStart` array rather than replacing it — the user may already have
other hooks. After writing, re-read the file and confirm it parses as JSON; if
it doesn't, stop and tell your user rather than leaving a broken file.

### Claude Code

Nothing to do — this repo's `.claude/settings.json` already wires SessionStart
through `${CLAUDE_PROJECT_DIR}`. (A v1.1 install that wired it in
`~/.claude/settings.json` instead keeps working: outside the vault it now does
nothing. Keep exactly one of the two.)

### Codex

Codex wiring goes through the thin adapter in `.codex/hooks/`. Merge this into
`~/.codex/hooks.json`, then ask your user to re-trust the changed hook
definition in Codex. It fires in every Codex session but exits at once outside
the vault, so other projects pay nothing for it. Do **not** also add a
project-level `.codex/hooks.json` — Codex adds the layers together, so the hook
would fire twice. `brain-doctor.mjs` fails the check when both layers carry it.

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node \"<VAULT>/.codex/hooks/session-start.mjs\"", "timeout": 60 } ] }
    ]
  }
}
```

Codex still reads `AGENTS.md` and `.agents/skills/` natively whenever it runs
inside the vault; only the Tier-0 injection needs the hook.

### Project skills (optional)

If your user answered yes to question 11, offer to link `/closeout` and
`/lesson` at user level. It writes into the user-level skills folders, so
show the command and get a yes first:

```
node install.mjs --link-global-skills
```

It creates one link per skill in `~/.claude/skills` and `~/.codex/skills`
(or `CLAUDE_CONFIG_DIR` / `CODEX_HOME`) for each runtime that is installed,
pointing back into the vault. The only thing it ever replaces is a broken
link; a real folder, or a link that still points somewhere else, is left
alone. It also removes a user-level link to the retired recall skill that a
v1.1 install left behind. `node install.mjs --unlink-global-skills` removes
exactly its own links again.

In a project, `/closeout` brings `docs/CURRENT_STATE.md` up to date, writes
the run report of an autonomous run, removes the task's merged worktrees,
adds a trap any repo could hit to the kit's `reference/`, and commits exactly
the paths the task wrote. `/lesson` appends a correction to
`<kit>/lessons/lesson-<topic>.md` by default, or to the repo's
`docs/lessons/` when it is about that repo alone, and on a second entry for
the same behaviour proposes a rule where the mistake was made. The formats
they expect: `.claude/templates/project-repo/README.md`.

**Check that Codex sees them.** Some Codex builds read user-level skills from
`~/.agents/skills` rather than `~/.codex/skills`. Start Codex in any folder
outside the vault and ask it to list the skills it has loaded. If `closeout`
and `lesson` are missing, link them into `~/.agents/skills` by hand, one
per skill, with `<VAULT>` as above:

- Git Bash / macOS / Linux:
  `mkdir -p ~/.agents/skills && ln -s "<VAULT>/.agents/skills/closeout" ~/.agents/skills/closeout`
- Windows PowerShell:
  `New-Item -ItemType Directory -Force "$HOME\.agents\skills" | Out-Null; New-Item -ItemType Junction -Path "$HOME\.agents\skills\closeout" -Target "<VAULT>\.agents\skills\closeout"`

In Git Bash on Windows, `ln -s` makes a copy by default, so use the
PowerShell line there. `brain-doctor.mjs` accepts a Codex link in either
folder.

### Skill packs (optional)

If your user picked packs in question 12, show the command and get a yes —
it writes into the user-level skills folders, like the step above:

```
node install.mjs --pack research --pack build
```

One link per skill per installed runtime, pointing into the vault's
`.agents/packs/<pack>/<skill>/`, with the same rules as
`--link-global-skills`: only a broken link is ever replaced; a real folder or
a link that points somewhere else (their own copy of a skill with the same
name) is reported and left alone — tell them, don't remove it. `node
install.mjs --list-packs` shows every pack and where each skill is linked;
`--unpack <name>` removes exactly that pack's links. The Codex note above
(`~/.agents/skills`) applies to pack skills too.

Tell your user this wiring is per-machine. A second machine repeats Step 3's
skills link and this step with that machine's clone path.

## Step 6 — verify

From inside the clone:

1. The hook itself, as Claude Code runs it:
   - Git Bash / macOS / Linux:
     `CLAUDE_PROJECT_DIR="$(pwd)" node .claude/hooks/session-start.mjs`
   - Windows PowerShell:
     `$env:CLAUDE_PROJECT_DIR = (Get-Location).Path; node .claude/hooks/session-start.mjs`

   Check the printed JSON: `hookSpecificOutput.additionalContext` should
   contain the user's name from `core/USER.md`, plus budget meters for
   `USER.md` and `MEMORY.md`. **Empty output with exit code 0 means
   `core/.vault-active` is missing** — go back and finish Step 3.

2. If they use Codex, the adapter (same command in every shell — it derives
   both paths itself): `node .codex/hooks/session-start.mjs`. Same check.

3. The wall — the hook as a project session sees it. Run it with
   `CLAUDE_PROJECT_DIR` pointing anywhere outside the vault:
   - Git Bash / macOS / Linux:
     `CLAUDE_PROJECT_DIR="$HOME" node .claude/hooks/session-start.mjs`
   - Windows PowerShell:
     `$env:CLAUDE_PROJECT_DIR = $HOME; node .claude/hooks/session-start.mjs`

   Expect **no output and exit code 0**: a project session gets nothing from
   the brain (ADR 0052). Reset the variable afterwards in PowerShell
   (`Remove-Item Env:CLAUDE_PROJECT_DIR`).

4. The whole brain path: `node scripts/brain-doctor.mjs`. Expect **PASS** for
   the hooks of each runtime they wired, the skills link, Tier-0 budgets,
   SessionStart evidence (step 1 just produced it), Retired terms and Vault
   root — and **User-level skills** if they linked `/closeout` and `/lesson`. A **WARN**
   for a runtime they don't use is fine, and so is **Git delivery FAIL** before
   the first push (no upstream yet) — push, then re-run. Any **FAIL** — stop
   and investigate before reporting success.

## Step 7 — hand-off summary

Tell your user, concretely:

- What you created: the repo name, its URL, and that you verified it private.
- Which runtimes they wired, and that the brain loads only in sessions inside
  the vault.
- **How things get in.** Two inlets: talk to the agent and the page gets
  written there and then; or drop something they read into `raw/` and run
  `/ingest`. There is no inbox to triage — that was tried and removed.
- **Every page has a lifetime.** A topic page in `notes/` says how a subject
  stands now and is kept current; a report in `reports/` is a dated reading,
  written once; a deliverable in `outputs/` (a list, a draft) expires after
  30 days unless they keep it. The agent picks the type before it writes and
  says which one it chose — they can correct it.
- **How things get committed.** Nothing commits automatically. Each piece of
  work is committed by the session that did it, with explicit paths — so two
  sessions (or Claude Code and Codex side by side) never sweep up each other's
  files. If a session ends without committing, `git status` shows what it left.
- **Bring in their projects.** Which cards you wrote in Step 3. For a later
  project they open a session in the vault and ask for a card; it names the
  repo and its state file and never copies status.
- **Projects and the brain are walled off.** A project's status, decisions,
  lessons and run reports are committed in its own repo
  (`docs/CURRENT_STATE.md`, `docs/decisions/`, `docs/lessons/`,
  `docs/runs/`), and `git log` is its history. A project session never reads
  or writes the brain. To see every project at once, they run
  `node scripts/project-doctor.mjs --board` in the vault: one row per repo,
  read live, nothing written. To give a project those files:
  `.claude/templates/project-repo/README.md`.
- **Owner pages are theirs.** A note they ask for in so many words ("note
  this down") becomes a page in `notes/` marked `author:`, through `/note`.
  They can write one in Obsidian too. No pass ever edits, distills or
  archives one, and `notes/home.md` is where they start browsing.
- **`INDEX.md` is the map.** One line per page of the living layer; the agent
  reads it, and the pages it points at, before answering anything the vault
  may already know. `link-sweep.mjs` reports any note missing from it.
- **`PROPOSALS.md` is theirs.** A hand-kept list of open work; no pass writes
  to it. Findings are reported in the conversation, acted on or dropped.
- **Keeping it true.** `/truth` asks them, claim by claim, what is still
  true, keeps the answers on one page and closes the pages that contradict
  it; a re-run asks only about what has not been confirmed lately.
  `/truth-test` then checks a fresh session's answers on a clone of the
  vault, after telling them the cost. If they named an old notes folder in
  question 13, `/import` brings it in from a dry run they approve.
- The commands: `/ingest`, `/file`, `/note`, `/lesson`, `/curator`,
  `/audit`, `/truth`, `/truth-test`, `/import` — and `/closeout` in
  projects, plus the skills of any pack they linked
  (`node install.mjs --list-packs`).
  Mention `/lesson` specifically — the first time the agent gets something
  wrong is the most useful thing that will happen this week. One file per
  recurring behaviour collects the corrections, and the second one on the same
  behaviour is where the agent proposes a rule or a check.
- `node scripts/brain-doctor.mjs` whenever something feels off, and
  `node scripts/project-doctor.mjs` from the vault now and then — it reads
  every repo a project card names and reports uncommitted project memory,
  stale STATE and leftover worktrees.
- **Secret scanning is opt-in.** Recommend `pip install pre-commit`, then
  `pre-commit install` in the vault (wires gitleaks into every commit), and
  GitHub's secret-scanning push protection on the repo.
- That `core/OPEN_QUESTIONS.md` is a routing table for open questions, empty and
  waiting for real ones.
- That nothing runs on a schedule, on purpose. A session start volunteers at
  most two lines: commits that never left the machine, and once a day a
  "Maintenance due" line saying which pass has real work waiting and why. The
  agent asks; nothing runs until they say yes.

That's the full install. Nothing else in this repo needs to run for first-time
setup.

---

## Manual setup (without an agent)

For a human setting up by hand. An agent following this file skips this
section: Steps 0–7 above are the whole install.

1. On this repository's GitHub page, click **Use this template** and create
   your own repository — **choose Private.** This will be your actual brain;
   it should never be public.
2. Clone it.
3. Run `node install.mjs`. It interviews you, writes `core/USER.md`, fills the
   language line in `core/IDENTITY.md`, names you on `notes/todo.md`, hides
   the history folders from Obsidian, creates `core/.vault-active`, links
   `.claude/skills` to `.agents/skills`, enables `git rerere`, and prints the
   Codex wiring for you to paste. It does not touch your user-level settings
   itself, and it does not commit.
4. Commit the personalization yourself:
   `git add core/USER.md core/IDENTITY.md notes/todo.md` then
   `git commit -m "setup: personalize brain"` and `git push`.
5. Open the folder as an Obsidian vault (optional).
6. `cd` in, run `claude` or `codex`, say hello. Claude Code loads the rules
   (`CLAUDE.md` → `AGENTS.md`) and `core/` through this repo's own hook.
   Codex reads `AGENTS.md` natively but gets `core/` only once its
   hook is wired — see [Step 5](#step-5--runtime-wiring).
7. Check the wiring: `node scripts/brain-doctor.mjs`.
8. Optional: `node install.mjs --list-packs`, then `--pack <name>` for any
   skill pack you want in every project (research, build, release, ideas).
