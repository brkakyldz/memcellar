# Second Brain OS

**A memory for your coding agents that you can read, correct and undo.**
It is an Obsidian vault that Claude Code and Codex share as equals, and a Git
repository, at once — Git is the only database. Your assistant knows who you
are and what you're working on the moment a session in the vault starts, in
either runtime, and writes down what it learned as ordinary files you commit.

<p>
  <a href="docs/UPGRADING.md"><img alt="version v1.3" src="https://img.shields.io/badge/version-v1.3-1c3d63"></a>
  <a href="LICENSE"><img alt="license MIT" src="https://img.shields.io/badge/license-MIT-5b7150"></a>
  <a href="docs/ARCHITECTURE.md#5-runtime-two-runtimes-one-hook-each"><img alt="runtimes: Claude Code and Codex" src="https://img.shields.io/badge/runtimes-Claude%20Code%20%C2%B7%20Codex-b0573a"></a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/how-it-works-dark.svg">
    <img src="docs/assets/how-it-works-light.svg" width="520" alt="How it works. Claude Code and Codex sessions sit above a dashed line; below it there is no model. Both run one SessionStart hook, which pulls the vault and injects core/ at the start of every vault session and never commits, and both share one set of rules and skills. Under them, the vault in tiers: core/ with IDENTITY, USER and MEMORY; notes/ read on demand through INDEX.md; logs/ searched last; raw/ for the sources you saved. Git sits underneath as the only database: a skill writes a note or a log, and the task commits exactly its own paths.">
  </picture>
</p>

## Why

- **A session starts from what you already told it.** Who you are, how the
  assistant should work with you and the facts that matter are injected at
  every start; everything else is read when a question needs it.
- **You can see and fix what your agent remembers.** Plain Markdown with YAML
  frontmatter and `[[wikilinks]]`, open in Obsidian or any editor. `git log`
  is the audit trail, `git revert` is undo.
- **Nothing to run or keep in sync.** No SQLite, no vector store, no server,
  no plugin dependency chain: Markdown, JSON and Node, with no build step and
  no dependency beyond Node itself, on Windows, macOS and Linux.
- **Project status stays true.** It lives in each project's own repo,
  committed with the code, and a project session never sees the vault's
  personal context. From the vault you can read every project's state live,
  and nothing is copied over.
- **Old answers don't pose as current ones.** Every page gets a type when it
  is written, and the type says how long the page stays true: a topic page is
  kept current, a research report is dated, a one-off list expires.

This is the generic projection of a vault that has been running daily since
2026-08-18. Everything here is in use somewhere, and the parts that were tried
and removed are listed as removed rather than quietly dropped — see
[`docs/DECISIONS.md`](docs/DECISIONS.md).

## How it works

Above the dashed line a model reads and decides. Below it there is no model —
only plain files, Node and Git.

- **One hook, and it never commits.** Both runtimes run the same
  `SessionStart` hook: inside the vault it pulls and injects `core/`, and
  once a day it may say which upkeep pass has real work waiting — it asks,
  it never runs one. Outside the vault it does nothing. That is all the
  automation there is.
- **Reading is a rule.** `core/` arrives at every start. Before answering
  anything the vault may already know, the agent reads `INDEX.md` and the
  pages it points at, greps `notes/`, `reports/` and `core/` in English and in
  the language you asked in, and cites the page. `logs/` comes last.
- **You talk, the agent distills.** Something worth keeping is written on the
  spot; a source you drop in `raw/` is read through `/ingest`. Nothing waits
  in a queue. Before any page is written, the agent runs a short write gate
  (`.agents/write-gate.md`): write nothing if the fact is already written
  somewhere, pick the page's type, list the pages on the same subject, and
  close the ones the new page makes stale, in the same commit. What you dictate word for word goes
  to `my-notes/`, which no agent pass ever rewrites.
- **Commits belong to the task.** Each task commits the files it wrote, by
  name — never `git add -A` — so two sessions, or both runtimes, can share one
  checkout.
- **One copy of everything.** `AGENTS.md` is the only rulebook (`CLAUDE.md`
  just imports it) and `.agents/skills/` the only skills folder, for Claude
  Code and Codex alike.

Tiers, budgets and the reasoning behind each part:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

<details>
<summary><b>What's in the repo</b></summary>

```
core/         Tier 0: IDENTITY, USER, MEMORY inlined; OPEN_QUESTIONS by pointer
notes/        the living layer — topic pages, decisions, playbooks, project
              cards; flat, wikilinked, told apart by type:
reports/      dated research and comparisons, written once
outputs/      lists, drafts and other deliverables, each with an expiry date
my-notes/     your own notes, written only when you ask, in your language
raw/          immutable sources you put there; the agent reads, never writes
logs/         append-only session logs + logs/signals/, the event ledger
archive/      closed and superseded content — never deleted, always moved here
scripts/      link sweep, neighbour finder, brain and project doctors,
              maintenance, metrics
.agents/      skills and the write gate — the one copy both runtimes load
.claude/      the shared SessionStart hook, the compiled checks, page and
              project-repo templates
.codex/       the thin Codex adapter into that same hook
AGENTS.md     the constitution — the rules you and both agents work under
CLAUDE.md     one line that imports AGENTS.md, plus Claude-only notes
INDEX.md      the page catalog — read this first when answering a question
PROPOSALS.md  open work you keep by hand; no pass writes to it
SETUP.md      agent-run installation runbook, with a manual appendix
install.mjs   one-time interactive personalization (manual path)
docs/         architecture guide, decision index and full records from 0045,
              FAQ, upgrade guide, the README's figures
```

</details>

## What goes where

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/where-things-live-dark.svg">
    <img src="docs/assets/where-things-live-light.svg" width="520" alt="Where things live. A session in a project sits above the dashed line and is walled off from the vault. Below the line, the vault keeps what outlives a project: knowledge in notes/, one card per project, the vault's own lessons, and short harvest logs. Each project's repo keeps its execution state and memory: AGENTS.md, docs/CURRENT_STATE.md as the only status, docs/lessons/ and docs/runs/; git log is its history. The card points at the state file, /harvest run from a vault session reads the repo, and a crossed path marks live status copied into the vault, which never happens.">
  </picture>
</p>

**Inside the vault, a page's type says how long it stays true**
([ADR 0055](docs/decisions/0055-notes-are-typed-by-lifetime-at-write-time.md)):

| Type | Example | Lives in | How it ages |
|---|---|---|---|
| `topic` | how your job search stands, what you know about a tool | `notes/<subject>.md` | kept current in place; carries `updated:` |
| `report` | a research run, a comparison of three libraries | `reports/YYYY-MM-DD_<slug>.md` | written once; its date says how old it is |
| `deliverable` | a list of listings to pick from, a draft, a one-week plan | `outputs/YYYY-MM-DD_<slug>.<ext>` | expires (30 days unless you set it), then archived |
| `decision`, `playbook`, `project` | a choice and its reasons, steps proven by use, a project card | `notes/` | a decision is superseded, never edited; a playbook is revised on purpose; a card is updated in place |

One subject has one topic page. A report or a deliverable adds a line and a
link to its topic page, so `INDEX.md` lists only the living layer.

**Outside the vault, there are three homes**
([ADR 0056](docs/decisions/0056-three-homes-repo-user-kit-vault.md)):

| The vault | Each project's repo | Your user-level kit (optional) |
|---|---|---|
| topic pages, decisions, reports, deliverables, the vault's own lessons | `AGENTS.md` — the contract: timeless, no status | your working rules, in the user-level instruction file every session loads |
| one thin card per project, `notes/<project_id>.md`: why it exists, where it lives, what it taught | `docs/CURRENT_STATE.md` — the only file that states status | lessons about how you want work done, from every project, in `lessons/` |
| | `docs/lessons/` for lessons tied to that repo; `docs/runs/` — one report per autonomous run; `git log` — the history | traps that would hit any repo (a tool quirk, a library surprise), in `reference/` |

The kit is a private folder or repo next to your user-level instruction file
(or wherever `BRAIN_KIT_DIR` points). If you have none, `/lesson` and
`/closeout` use plain `lessons/` and `reference/` folders next to that file.
Keep it private: lessons quote you word for word.

**Projects and the vault are walled off.** A session in a project neither
reads nor writes the vault: the hook does nothing there, and the project keeps
its own state, decisions and lessons. To see every project at once, run
`node scripts/project-doctor.mjs --board` from the vault: one row per repo,
read live, with the last commit, the active milestone and the state file's
Next line. It writes nothing. Optionally, `/closeout` and `/lesson` can be
linked into every project to do the repo-side bookkeeping. Formats and
adoption steps:
[`.claude/templates/project-repo/`](.claude/templates/project-repo/README.md);
the decisions: [ADR 0045](docs/decisions/0045-project-execution-state-lives-in-the-repo.md),
[ADR 0052](docs/decisions/0052-projects-and-the-vault-are-walled-off.md)
and [ADR 0056](docs/decisions/0056-three-homes-repo-user-kit-vault.md).

## Quickstart

**You need** git 2.28+, Node.js 18.13+, a GitHub account — plus the
[GitHub CLI](https://cli.github.com) (`gh`, logged in) for the agent-run
setup, which creates your repo with it — and
[Claude Code](https://claude.com/product/claude-code) or
[Codex](https://openai.com/codex) — or both. Obsidian is optional but
recommended; the vault is plain Markdown either way.

1. **Hand the setup to your agent.** Open Claude Code or Codex and paste this
   in, with this repository's URL in place of the placeholder:

   ```text
   Read SETUP.md from this repository and set up my second brain:
   <this repo's URL>/blob/main/SETUP.md
   ```

2. **Answer its questions.** It creates your repo from this template and checks
   that it is private, interviews you, personalizes the core files, links the
   skills and verifies the hook fires. It asks before creating the repo and
   before writing user-level settings.
3. **Check the wiring:** `node scripts/brain-doctor.mjs`.
4. **Work normally.** Talk to your agent inside the vault about anything — plan
   a project, think a problem through, ask what you decided last month. It
   reads and writes the same Markdown you see in Obsidian, and when a piece of
   work is done, it commits exactly the files that work touched.

Prefer to do it by hand? [Manual setup](SETUP.md#manual-setup-without-an-agent)
runs `node install.mjs`, which interviews you and prints the wiring without
touching your user-level settings or committing anything.

**Wiring, in short.** Claude Code needs nothing beyond this repo's own
`.claude/settings.json`. Codex gets `core/` once its `SessionStart` entry is
wired in `~/.codex/hooks.json` — and not also in a project-level
`.codex/hooks.json`, because Codex adds the layers together. The full steps:
[`SETUP.md`, Step 5](SETUP.md#step-5--runtime-wiring).

For `/closeout` and `/lesson` to load in your other projects, link them at
user level: `node install.mjs --link-global-skills` (opt-in;
`--unlink-global-skills` undoes it). They write into the project or your
user-level kit, never into the vault.

## Everyday commands

| Command | What it does |
|---|---|
| `/file` | keep an analysis produced in conversation as the right kind of page — an update to a topic page, a dated report or an expiring deliverable — instead of losing it to the transcript |
| `/ingest` | read a source in `raw/` into a dated report, plus the lines it changes on its topic page — discuss, distill, reconcile, catalog |
| `/note` | write what you dictate into `my-notes/`, your own notes, in your language |
| `/lesson` | capture a correction verbatim into one file per recurring behaviour — in your kit by default, in a repo only when it is about that repo; the second correction on the same behaviour proposes a rule or a check |
| `/closeout` | in a project: STATE up to date, the run report of an autonomous run, a trap any repo could hit added to your kit, one commit of exactly the task's paths; never touches the vault |
| `/curator` | consolidate memory, close what time and new decisions made stale (expired deliverables, unlinked reports, topic pages behind their reports), keep the core files inside budget |
| `/audit` | structural and semantic report — budgets, orphans, contradictions, tag sprawl; reports only, never fixes |

Plus a few scripts you run when you want them — nothing runs on a schedule:
`node scripts/maintenance.mjs` (what upkeep is due; `run` does the mechanical
half after you say yes), `node scripts/brain-doctor.mjs` (is the setup healthy),
`node scripts/project-doctor.mjs` (is each project's memory committed and its
state fresh; `--board` for one row per project), `node scripts/note-neighbours.mjs
"<subject>"` (the pages already on a subject, before you write a new one),
`node scripts/link-sweep.mjs` (broken links, orphans — writes one report) and
`node .claude/hooks/checks.mjs --staged` before a commit (link form,
frontmatter, page types and lifetimes, catalog). All of them:
[`scripts/README.md`](scripts/README.md).

## What's new in v1.3

**Every page is typed by how long it stays true, lessons and traps from all
your projects meet in one kit, and the search machinery is gone.**

- Three page types replace `knowledge` and `memory`: `topic` pages in
  `notes/`, kept current; `report`s in the new `reports/` folder, dated and
  written once; `deliverable`s in the new `outputs/` folder, which expire.
- A write gate (`.agents/write-gate.md`) that `/file`, `/ingest` and
  `/curator` run before they write: skip what is already written, pick the
  type, find the neighbours with `scripts/note-neighbours.mjs`, close what
  the write made stale in the same commit.
- New checks: `note-lifetime` catches a page of the wrong type or in the
  wrong folder; `lifetime-sweep` finds expired deliverables, unlinked
  reports, topic pages older than their newest report, and `-v2` pages. The
  "Maintenance due" line counts these, and `/curator` works through them.
- `/lesson` writes to your user-level kit by default, so a correction made in
  two different repos counts as a second entry. `/closeout` adds a trap any
  repo could hit to the kit's `reference/`.
- `/harvest` is retired. `node scripts/project-doctor.mjs --board` shows every
  project's state, read live from its repo.
- The retrieval machinery is retired: `/recall`, `scripts/retrieval-eval.mjs`,
  the golden set and the retrieval-failure signal. The agent reads `INDEX.md`
  and greps the notes; quality is judged by whether answers are right.

It was built in the template first and tested on a copy of a working vault
before it shipped (ADR 0058). The complete list and the step-by-step upgrade
from v1.2:
[`docs/UPGRADING.md`](docs/UPGRADING.md).

## Safety

- **Keep your clone private.** This template holds no personal data; your
  vault will hold your actual notes.
- **Turn on secret scanning** — opt-in since v1.1: `pip install pre-commit`,
  then `pre-commit install` inside the vault wires gitleaks into every commit;
  on GitHub, also enable secret-scanning push protection.
- **Nothing is deleted automatically, and nothing runs before you activate
  it.** Stale content moves to `archive/`, and the hook is inert until
  `core/.vault-active` exists. `AGENTS.md` and `core/IDENTITY.md` are protected
  by convention, not by a lock.

The details are in [`docs/FAQ.md`](docs/FAQ.md#safety).

## Learn more

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the full design: principles,
  the memory model, the two runtimes, how the agent reads, and the reasoning
  behind each.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — the decision index, including what
  was reversed and why.
- [`SETUP.md`](SETUP.md) — the installation runbook your agent follows, and the
  manual path.
- [`docs/FAQ.md`](docs/FAQ.md) — safety notes, and why there is no vector
  database, no schedule and no automatic commit.
- [`docs/UPGRADING.md`](docs/UPGRADING.md) — everything v1.3, v1.2 and v1.1
  changed, and how to upgrade an older vault.
- [`scripts/README.md`](scripts/README.md) — what each script checks and when
  to run it.

## License

MIT. See [`LICENSE`](LICENSE). The vendored `obsidian-markdown` skill keeps its
own license — see `.agents/skills/THIRD_PARTY_LICENSES.md`.
