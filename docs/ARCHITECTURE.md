# Architecture

A file-native agent memory system: plain Markdown as the substrate, git as the
database, Claude Code and Codex as two equal runtimes over the same files, and
an explicit lifecycle policy as the thing that keeps it from rotting. Each
durable piece has one source that both runtimes point at (ADR 0044). No index
server, no vector store, no tool-internal format.

**Scope of this document: mechanism.** What the parts are and how they fit. The
*policy* they enforce is `notes/lifecycle-policy.md` (what happens to a note)
and `notes/self-evolution-policy.md` (how the system changes itself); the
*binding rules* are `AGENTS.md`; the *decisions* behind all of them are indexed
in `DECISIONS.md`. Those have non-overlapping charters on purpose — a rule
stated in two places is a contradiction waiting for one of them to be edited.

## 1. Design premises

Four constraints drive every other decision:

1. **Human-readable substrate.** Everything must be openable in Obsidian and
   editable by hand. Markdown + flat YAML frontmatter + `[[wikilinks]]` is the
   single source of truth. If an agent's memory can only be read by the agent,
   the human loses the ability to audit or correct it.
2. **Git is the only database.** Every change is a commit, `git log` is the
   audit trail, `git revert` is undo. That buys versioning, sync, conflict
   handling and backup from one mechanism instead of four.
3. **Context is a finite budget, not storage.** Reading is tiered and
   pointer-based; the always-loaded surface is capped in characters.
4. **Fail-open automation.** No hook or script may block a working session.
   Every hook path exits 0.

Two more were added by what went wrong:

5. **Machine state does not live on the tracked tree** (ADR 0032). In the
   reference instance the first four let ~5,400 lines of machinery accumulate
   around 17 notes; a counter a
   hook ticks every turn is not evidence. Derived, rebuild-tolerant state goes
   in a gitignored sidecar.
6. **Commits belong to the task that wrote the files** (ADR 0042, 0044). Two
   runtimes — or two sessions of one — can work in one checkout at the same
   time, and a hook cannot know which dirty file belongs to which task. So no
   hook commits, and nothing ever stages the whole tree.

## 2. Layers

```
  Obsidian (human read/write)  ---+
                                  +-- plain .md files -- git -- remote
  Claude Code / Codex (agents) ---+       (substrate)    (db)   (sync)
        |
        +-- AGENTS.md   the constitution; CLAUDE.md only imports it
        +-- .agents/    judgment procedures (/ingest, /curator, /lesson …) — the
        |               one skills copy; .claude/skills is a link to it —
        |               and write-gate.md, the procedure every writer runs
        +-- .claude/    shared hook implementation, compiled checks, page and
        |               project-repo templates
        +-- .codex/     thin Codex SessionStart adapter
        +-- scripts/    deterministic maintenance (by hand or from a skill)
```

The split between skills, hooks and scripts is the core engineering rule:
**deterministic work is a script, judgment work is an LLM call.** Link checking
and metric counts are scripts because they have a correct answer. Deciding
whether two facts are the same fact is a skill because it does not.

**One source per piece.** Codex cannot import a file and reads `AGENTS.md` and
`.agents/skills/` natively; Claude Code reads `CLAUDE.md` (which is one
`@AGENTS.md` import plus Claude-only lines) and `.claude/skills`, which
`install.mjs` makes a directory junction (Windows) or symlink (macOS/Linux) to
`.agents/skills/`. The link is gitignored machine state — a copy would be two
live implementations, and in the reference instance two copies drifted both
ways within a week.

## 3. Storage model

| Folder | Cognitive type | Write mode | End of life |
|---|---|---|---|
| `logs/` | Episodic — what happened | append-only | distill → `archive/` |
| `core/MEMORY.md`, `notes/` (`topic`, `decision`, `project`) | Semantic — what is true now | reconcile on write | supersede → archive |
| `reports/` | Semantic, dated — what was known on one day | write-once | never archived for age; its date says how old it is |
| `outputs/` | Deliverables — something to act on, then done with | written for one task | `expires:` → `archive/` |
| `notes/` (`playbook`), `.agents/skills/` | Procedural — how we work | deliberate revision | replace whole sections |
| `raw/` | Evidence — what a source said | write-once, by the human | never; a source is permanent |
| `.claude/*.json` sidecars | Derived machine state | overwrite, lock-free | discarded; never committed |

Mixing these is the classic failure of "one notes folder": episodic content
grows without bound, semantic content gets appended to instead of reconciled,
procedural content drifts because nobody owns it, and a one-day answer keeps
answering questions weeks after it stopped being true.

`raw/` is separate for a different reason. It is the only place verbatim
external content may live, which is what makes "nothing enters `notes/`
verbatim" enforceable rather than aspirational — without a legal home, a quoted
paragraph either gets paraphrased into a note (losing the fidelity that made it
worth keeping) or is lost.

### Page types and the write gate

Every page gets its type before it is written, and the type is decided by how
long the page stays true (ADR 0055). `notes/` holds the living layer: `topic`
pages (how one subject stands now, with `updated:`), `decision`, `project`
and `playbook`. A `report` goes to `reports/YYYY-MM-DD_<slug>.md` and names
its topic page in `topic:`. A `deliverable` goes to
`outputs/YYYY-MM-DD_<slug>.<ext>` with an `expires:` date. Each type has a
template in `.claude/templates/`. `knowledge` and `memory` are no longer
written; pages from before ADR 0055 keep them until someone reclassifies them,
and the vault's own lesson files keep `type: memory` from their template.

The write gate is one procedure, `.agents/write-gate.md`, run by `/file`,
`/ingest`, `/curator` and any outside skill that writes into the vault:

1. **NOOP first.** Nothing is written when it is already written somewhere,
   or can be derived from a file that exists, or is "what happened, when"
   (that is `git log`).
2. **Type it** by three questions, in order: something to act on and then be
   done with is a deliverable; sourced claims as of one date that nobody will
   keep current are a report; anything else updates the subject's topic page.
3. **Find the neighbours** with `node scripts/note-neighbours.mjs`, which
   lists the pages in `notes/`, `reports/` and `outputs/` whose titles,
   aliases, tags or links say they are on the same subject, and flags a
   `-v2`-style name.
4. **Close what the write made stale**, in the same commit: `valid_to`,
   `superseded_by` and a visible first line on every neighbour that still
   says the old thing.

A report or a deliverable still adds a line and a link to its topic page, so
`INDEX.md` lists only the living layer and gives `reports/` and `outputs/` one
row each, as folders. The two folders' contracts are `reports/README.md` and
`outputs/README.md`.

### Owner pages

The owner's own pages live in `notes/` too, next to the topic pages on the
same subjects (ADR 0060). A page whose frontmatter carries `author:` belongs
to the owner. It has `kind:` instead of `type:`, the shape checks and the
lifetime findings skip it, and the agent never edits, moves, archives or
deletes it unless the owner asks for that change. `/note` writes one when the
owner asks, from `.claude/templates/owner-page.md`, and the owner can write one
in Obsidian. The vault can't tell an asked-for edit from an unasked one, so
the `owner-pages` check fires on every change to an owner page against its
committed copy, and on a lost `author:`, a delete or a move. When the owner
made the change, they ignore it; when the agent did, it sees it before the
commit.

The owner's to-do page (`notes/todo.md`, "To do" and "Ideas") is one such
page. `notes/home.md` is the front page for browsing in Obsidian: it links the
topic hubs and the to-do page. Setup merges `archive/`, `logs/` and `raw/`
into Obsidian's ignore filters (`node install.mjs --obsidian`), so search and
the graph show the current view. Pages are written in the owner's language
(ADR 0059); field names stay English for the checks.

## 4. Reading: tiers, not search

- **Tier 0 — always loaded in a vault session.** `IDENTITY.md` (40 lines),
  `USER.md` (2000 chars), `MEMORY.md` (4000 chars); a session in any other
  project gets none of it (ADR 0052). Injected by the SessionStart hook, which heads each file
  with its usage against its budget so the agent sees its remaining room
  *before* writing. `MEMORY.md` holds **pointers, never detail**: one fact per
  line, ending in a `[[wikilink]]`. `OPEN_QUESTIONS.md` gets a pointer, not
  its content.
- **Tier 1 — the catalog, then the page.** `INDEX.md` lists every page of the
  living layer in one line each, and each topic page lists its reports. Read
  it, pick the two or three pages that matter, open those. When the catalog
  is not enough, `grep` over `notes/`, `reports/` and `core/`, in the
  language the question was asked in, and in the language older pages are
  written in while the vault holds both (ADR 0059). This is a rule in `AGENTS.md`,
  not a skill (ADR 0057): before answering a question the vault may already
  answer, read, then cite the page.
- **Tier 2 — the episodic stream.** `logs/`, when the first two don't answer.
- **`archive/` is not a tier below these** — it is live evidence at Tier 1
  depth. Superseded decisions are meant to be read before an expensive new one.

The budgets are mechanism, not decoration: past roughly 10KB of session-start
payload the harness is believed to stop inlining Tier 0 at all, so a budget
overrun does not degrade attention gracefully — it turns the always-loaded tier
off. That threshold is a hypothesis, so the hook logs its measured payload size
on every run and, over the limit, drops optional sections whole before any
Tier-0 content. Over budget, the rule is **consolidate, never silently
truncate**. Writer-only HTML comments are stripped before injection, so the
text that is counted and the text that is delivered are the same text.

Why there is no vector index, and no ranker either: both were measured. A set
of test queries against the reference instance found no paraphrase misses;
every miss was a vocabulary mismatch (another word, or another language's
inflection), which an `aliases:` line fixes. A ranker and a query-rewriting
skill were then built and tested, and real sessions almost never called them.
Fresh sessions given questions whose answers had recently changed found them
with plain `grep` and `Read`, and the one wrong answer came from a rule kept
in the wrong place, not from a search miss (ADR 0057). At a few hundred pages
an agent with an index and `grep` finds what is there. What it cannot do is
tell a current page from a stale one, and the page types above address that
at write time.

Quality is measured by answers, not by a ranker. If you keep an eval, it is a
short list of questions whose right answer you have confirmed, kept in
`.claude/eval/` so the vault can never read its own answer key. Each question
is asked in a fresh session, and you record whether the answer was right and
which pages were read. The template ships no eval set; `/truth` offers to
write one from the truth you confirmed, marking as traps the questions stale
pages used to answer wrongly. `/truth-test` runs it: it clones the vault's
committed state to a scratch folder, deletes the key from the clone, asks
each question in a fresh headless session with read-only tools, scores the
answers correct, stale or wrong, and names the pages behind each stale one —
after telling you the cost and waiting for a yes. `/audit` names the latest
result.

## 5. Runtime: two runtimes, one hook each

Claude Code and Codex are equal (ADR 0044). Each has exactly one brain
SessionStart, and both land in the same implementation:

- **Claude Code:** `.claude/settings.json` (project scope, the default) or
  `~/.claude/settings.json` (a v1.1 global-mode install) →
  `.claude/hooks/session-start.mjs` directly; Claude supplies
  `CLAUDE_PROJECT_DIR`. Never both, or it fires twice.
- **Codex:** `~/.codex/hooks.json` → `.codex/hooks/session-start.mjs`, which sets
  `BRAIN_DIR` and `CLAUDE_PROJECT_DIR` and imports the same file. Not also in a
  project-level `.codex/hooks.json`: Codex adds hook layers together.

Every script resolves the vault root from its own location (or `BRAIN_DIR`), so
the same file is correct from any working directory, in any clone.

| Event | Job (both runtimes) |
|---|---|
| `SessionStart` | Skip if `core/.vault-active` is missing. Otherwise `git pull --rebase` — skipped when tracked changes exist, because they belong to a live task — then inject Tier 0 with budget meters and, through the daily notice budget, at most a notice about unpushed commits and a once-a-day "Maintenance due" line (ADR 0049). Outside the vault it does nothing at all — no pull, no injection, no log line (ADR 0052, §10) |
| `Stop` / `SessionEnd` / `PreCompact` | Nothing. The task stages and commits only its own explicit paths |

Design notes worth keeping:

- **Task-owned commits are the backbone.** A task stages exact paths and
  commits one coherent change; no hook infers ownership. The price is stated
  plainly: a session that dies before committing leaves its files uncommitted
  until someone picks them up, and there is no one-turn checkpoint any more.
- **No autostash.** The pull used to lift uncommitted changes off the disk and
  put them back; when the put-back failed, another task's files were stranded
  in a stash while their owner kept working. A skipped pull costs one stale
  session start; the vault still loads from disk.
- **Push failure is non-fatal.** The commit stays local; the next session start
  says so once a backlog is over a day old.
- **A stuck rebase is aborted, not left half-applied** — but only one this
  pull started. A rebase, merge, cherry-pick or revert another task left in
  progress makes the hook skip its pull and leave that state alone.
- **A notice counts as shown only once it is delivered.** The hook asks the
  budget which notices may go out, fits the payload, and records only the
  survivors, so a notice dropped for size is offered again later that day.
- **One sidecar, gitignored and lock-free:** `.claude/.maintenance.json`, the
  shared daily notice counter. The session-trace and access sidecars went with
  the flush and telemetry hooks (ADR 0038, 0039).

## 6. What the runtime enforces

Only the parts of the policy that exist as running code belong here.

- **SessionStart** enforces the activation marker, attempts the pull, measures
  Tier-0 budgets and injects the bounded context.
- **The daily notice budget** — three proactive items across every surface, one
  shared counter (`emitNotices` in `lib.mjs`); a backup failure outranks
  everything in it, then the maintenance-due line.
- **The maintenance-due line** (`maintenanceDue` in `lib.mjs`, ADR 0049) —
  computed from the logs the passes already write: `/curator` when ten or more
  logs are past thirty days, `/audit` after thirty days without one or when a
  note is past `review_by`, the link sweep after seven days, and lesson topics
  waiting to be routed. It also counts what time has made stale
  (`lifetimeFindings` in `lib.mjs`, ADR 0055): a deliverable past `expires:`,
  a report no page in `notes/` links, a topic page older than its newest
  report or untouched for 90 days, a `valid_to` that passed with nothing
  superseding it, a `-v2`-style page beside its original, and, in
  `core/USER.md`, `core/MEMORY.md`, topic pages and project cards, an
  "until <date>" that has passed or a cited ADR range that newer ADRs have
  outrun. Those counts ride on the `/curator` item. It announces;
  `scripts/maintenance.mjs run` acts, and only after the owner's yes.
- **`brain-doctor.mjs`** reports, read-only, whether each runtime has exactly
  one SessionStart and no retired git-writing hook, whether the skills link
  resolves, whether the optional user-level `/closeout` and `/lesson` links
  resolve (and no other vault skill is linked at user level), whether the budgets hold,
  whether `core/` carries invisible control characters, whether a
  `confidence: low` note is linked from `MEMORY.md` (the corroboration gate),
  and whether a skill or hook still names retired machinery.

Written as code but **not run automatically** since v1.1:

- **Compiled checks** (`.claude/hooks/checks.mjs`) — wikilink short form, note
  frontmatter, `INDEX.md` coverage, `note-lifetime` (each type in its folder
  with the fields its lifetime needs: `updated:` on a topic page, `topic:`,
  `source:` and `confidence:` on a report, `expires:` on a deliverable; a
  changed page in `notes/` that still says `knowledge` or `memory` fires
  `legacy-type`, lesson files excepted) and
  `lifetime-sweep` (the stale findings above, for the files it is handed;
  under `--all` that is the whole vault). They ran from the Stop checkpoint until
  v1.1. Now they run when someone runs them — `scripts/maintenance.mjs run`
  after a yes to the maintenance line (ADR 0049), or by hand:
  `node .claude/hooks/checks.mjs [--staged | --all] [--record]` prints every
  finding and exits 1 when there is one — by hand before a commit, or from a
  git pre-commit hook if the owner wants the warning to become a gate (the
  template wires none; that is a policy call). It is read-only unless
  `--record` appends new fires to the Signal Ledger, which is the only way
  `vault-metrics.mjs` gets fires to count. `link-sweep.mjs` carries a
  git-blind twin of the index-coverage check, `/audit` runs the checks
  read-only, and `scripts/tests/index-coverage.test.mjs` covers both.
- **The secret scanner** (`scanStagedForSecrets` in `lib.mjs`). The scan that
  runs, once you install it, is gitleaks via `.pre-commit-config.yaml`.

Everything else — the corroboration gate, bi-temporal supersession, the maturity
ladder, archive-vs-delete, the protected files — is enforced by convention and
by the passes the owner runs. **Protected files are a convention, not a
security boundary**: nothing stops a shell command from writing `AGENTS.md`. That
distinction is worth keeping honest, and there is a measurement behind it:
TRACE (arXiv 2606.13174) found prose corrections re-violated **57.5%** of the
time against 2–38% for a compiled check. Telling a model its mistake in writing
does not stick — which is why the checks are kept as code even while nothing
runs them on every turn.

## 7. The ingestion paths

Two inlets, one destination. This is the shape of the whole system rather than
a rule, which is why it is drawn rather than described.

```
  something you said                    something you read
  in any session                        (a paper, an article, an export)
        |                                       |
        | standing instruction,                 | you save it, deliberately
        | model-driven — not a hook             v
        v                                 raw/YYYY-MM-DD_<slug>.<ext>
  logs/YYYY-MM-DD_HHMM.md                       |  immutable; never edited
        | episodic, append-only, tagged         |
        | decision|bugfix|feature|…             |  /ingest — read it, discuss it,
        |                                       |  then distill and reconcile
        | /curator, at 30 days: extract         v
        | durable facts, archive the      reports/YYYY-MM-DD_<slug>.md
        | original                              |  dated, write-once,
        |                                       |  confidence: low, source:
        |                                       |  the one or two lines that
        v                                       v  change what is true now
  notes/<topic>.md  <-------------------------- +
        |   the topic page, kept current; every write passes the write gate
        |
        |  corroboration gate: a second independent source confirms it
        v
  core/MEMORY.md          one pointer line, Tier 0, 4000 chars
```

What you work out in conversation follows the same gate through `/file`: an
update to a topic page, a dated report, or a deliverable in `outputs/` that
expires.

Two more paths use the same gate. `/import` brings a whole notes folder in —
an old Obsidian vault, an export — from a read-only inventory and a dry-run
table (source file → page type → destination → reason) that the owner
approves group by group; originals kept verbatim go to `raw/`, and the source
folder is never touched. `/truth` runs the other way: it collects every
"true now" claim the vault holds, asks the owner about each with selectable
options, writes the answers to `notes/current-truth.md` with a `confirmed:`
date per section, then closes (`valid_to`, `superseded_by`, a visible first
line), fixes or archives the pages that contradict it and rebuilds `USER.md`,
`MEMORY.md` and `INDEX.md` from it — every list on the owner's approval,
owner pages untouched. In the reference instance one such run took the vault
from 146 notes to 74 and a fresh session from stale answers to 15 of 15
right. A re-run asks only about sections whose `confirmed:` date is old.

Three properties are deliberate:

- **Only distillate travels upward.** The vault stores summaries, decisions and
  their reasons, never raw transcripts — those stay in the runtime's own
  session storage. `raw/` is the exception that proves it: sources stay
  verbatim *because* they are outside the wiki.
- **Promotion is asynchronous.** A session writes episodic content immediately,
  but a fact becomes always-loaded memory only after a curator pass and a
  second, independent confirmation — independence being a property of the
  source, not a count of sessions.
- **A source is never memory on its own.** Anything from `raw/` carries
  `source:`, enters at `confidence: low`, and is closed out of `USER.md` and
  `IDENTITY.md` entirely. One document asserting something is not the vault
  believing it.

## 8. Known trade-offs

- **No semantic search.** Reading is catalog + pointers + grep + wikilinks.
  Fine at single-vault scale and it keeps the substrate portable; revisit when
  answers go wrong because a page that existed was not found, not before.
- **Task-owned commits trade automatic recovery for ownership.** An interrupted
  task may leave a dirty tree until it resumes; the gain is that concurrent
  tasks cannot be swept into one another's commits. The session-log rule is
  the agent's to follow — no hook reconstructs a log it forgot to write.
- **Single-writer assumption for scripts.** The lockfile
  (`scripts/.brain.lock`, stale after 2h) serializes the pull and ledger
  appends; real multi-device concurrent editing would need more than that.
- **The Windows skills junction stores an absolute path.** Move the vault
  folder and the link breaks; `node install.mjs --link-skills` repairs it and
  `brain-doctor.mjs` reports it. The optional user-level links from
  `--link-global-skills` behave the same way, and rerunning that flag repairs
  them.
- **The policy is only as good as its enforcement.** Anything enforced only by
  prose will drift; §6 lists what is code and what is not.
- **The machinery can outgrow the content.** Measured once, in the reference
  instance, at ~5,400 lines of hooks and scripts against 17 notes. A new
  hook or script now needs a failure that demanded it, the same gate a new
  folder faces.
- **`raw/` can become a graveyard.** Files land, nothing ingests them. The
  symptom is visible (an un-ingested file appears in no index and no note) and
  the response is written down in advance: three weeks of that means the inlet
  isn't wanted, and it gets removed rather than nagged about.
- **Every project repo has to commit its memory** (§10) — plans and research
  included. A public project either publishes them or stays private while it
  is being built.

## 9. From correction to check

Capture → corroborate → enforce-or-retire (ADR 0019, amended by 0038 and 0048).

`/lesson` captures a correction verbatim, with **no interpretation of a single
correction** — agents confabulate their own failure stories. It first asks
whether the correction is about a behaviour that will recur on a different
task; feedback on one deliverable is applied there and goes no further. A
lesson is one file per recurring behaviour (`lesson-<topic>.md`), entries
appended and never edited. Where the file lives is decided at capture by one
question, would this correction recur in a different repository (ADR 0056)?
Usually it would, so the default is the owner's user-level kit
(`<kit>/lessons/`), where corrections from every project meet and the second
one can be counted. A lesson tied to one repository's code or domain goes to
that repo's `docs/lessons/`; one about running the vault itself goes to the
vault's `notes/`.

The corroborate-and-route half used to be a `/flywheel` pass that mined the
ledger and proposed checks into an approval queue. It was retired with proposal
production (ADR 0038), and for a month nothing routed anything. Since ADR 0048
routing happens at capture: when a topic gets a second entry from a different
task, the capturing agent proposes one concrete change to the place that
produced the mistake — for a kit lesson the user-level instruction file or
the kit skill that ran, for a repo lesson that repo's `AGENTS.md`, skill or
check, for a vault lesson a vault skill or a check — and the owner approves
or refuses it. The answer is kept in the file (`routing:`). A
new entry on a routed topic means the rule failed, and the next proposal moves
it closer to the work. `scripts/vault-metrics.mjs`
is the deterministic count that informs that decision — check fires,
correction recurrence by class, lesson and check survival — with no LLM call
anywhere in it. It reads the vault's ledger only, so it counts the vault's
own lessons, not the kit's or a repo's.

The seed checks were bootstrapped from standing constitution rules rather than
waiting for organic corroboration. That shortcut has a cost worth knowing: a
check that never fires cannot be distinguished from a check that *cannot* fire,
so a check earns its place by catching a synthetic offender, not by staying
quiet.

## 10. Project work: the repo, the kit and the vault

Three homes, split by what the record is for (ADR 0045, 0056), with the vault
walled off from projects (ADR 0052). Each fact has one home (ADR 0050).

- **Each project repo holds its own execution state and memory, committed:**
  `AGENTS.md` (the contract — timeless, no status), `docs/CURRENT_STATE.md`
  (the only file that states status), `docs/decisions/` (why),
  `docs/lessons/` (lessons tied to that repo), `docs/runs/` (what an
  autonomous run checked), and its plans, research and evidence. `git log` is
  its history; there is no WORKLOG any more.
- **The owner's user-level kit holds what every project needs**, and is
  optional: the working rules in the user-level instruction file, which every
  session loads; owner-wide lessons in `<kit>/lessons/`; and traps that would
  hit any repository (a library, tool or machine that behaves unexpectedly)
  in `<kit>/reference/<topic>.md`, each with one trigger line in the
  user-level file so its body loads only when the work matches. `<kit>` is
  `$BRAIN_KIT_DIR`, or folders next to the user-level instruction file. It
  must be private, because lessons quote the owner verbatim.
- **The vault holds the owner's own life and knowledge:** topic pages,
  reports, decisions that cross projects, the vault's own lessons, and one
  thin card per project (`notes/<project_id>.md` — why it exists, where it
  lives, what it taught).

A trap goes to the kit on first sight, because it will hit any repository
that uses the same thing. A design pattern read off one repository stays in
that repository's docs until a second repository uses it. A rule for one
project only lives in that project's `AGENTS.md`.

The lifecycle of one piece of project work:

```
  repo: AGENTS.md, docs/CURRENT_STATE.md, git log --oneline -15
        |                          read first; the vault is never read
        v
  work in the repo                 code and its STATE update committed together
        |
        v
  /closeout                        STATE, the run report of an autonomous run,
        |                          this task's worktrees, one commit of exactly
        |                          the paths it wrote — never the vault;
        |                          a lesson goes to the kit or the repo, a
        |                          trap any repo could hit to <kit>/reference/
        :
        :  later, when the owner wants the cross-project view, from a vault session
        v
  project-doctor.mjs --board       one row per card's repo, read live: last
                                   commit, active milestone, STATE's Next
                                   line, and where the card's status and the
                                   repo disagree; writes nothing anywhere
```

Why the split runs this way: in the reference instance, the one project that
carried a multi-milestone plan to its final gates unattended did it on a
single living state file in its own repo; status rotted everywhere else (plans
still "ready to execute" after shipping, READMEs a version behind);
completion reports went to chat and were lost; and no coding session ever
resumed from a vault note. A record earns its keep by being read at the moment
it matters. Status is read at resume time, inside the repo; knowledge that
should carry into the *next* project has to survive the repo being closed.

Why the kit: in the reference instance, the wall's one door back, a manual
harvest pass, never ran. Projects captured no lessons, the cross-project
traps they needed most sat in the vault out of their reach, and a behaviour
corrected once in each of two repos never counted as a second correction.
The kit is already loaded in every session, so rules and traps reach projects
without a project ever opening the vault, and each home is written by the
session that holds the knowledge, at the moment it has it (ADR 0056).

Why the wall: until v2 a project session received the vault's `USER.md`,
the whole of `MEMORY.md` and a block of standing rules, and wrote a short log
back. Read on the day it was questioned, almost none of that `MEMORY.md` had
anything to do with the repo being worked on, and the agent treated all of it
as context it was meant to use. A context block earns its place by being
relevant; Tier 0 is budgeted for the vault's own sessions.

How the pieces meet:

- **The formats** ship in `.claude/templates/project-repo/` (`AGENTS`
  contract, `CLAUDE` shim, STATE, run report — with a README on adopting
  them) and `.claude/templates/project.md` (the card). Copied into a
  project, they live there; the vault never reads them back.
- **Two skills may cross into projects** — `/closeout` and `/lesson`, and
  both write only into the repo the session is in or the owner's kit, never
  the vault. `node install.mjs --link-global-skills` links them into each
  runtime's user-level skills folder, opt-in and reversible. Everything else
  in `.agents/skills/` works on the vault and stays vault-scoped.
- **Optional skill packs cross too, on request** (ADR 0062). Four packs live
  in `.agents/packs/`: `research` (research, reports-architecture), `build`
  (repo-bootstrap through software-factory: the contract, the coordinator
  and its lanes, unattended runs, held-out scenarios, review, ADRs),
  `release` (ship, bug-sweep) and `ideas` (product-idea-research,
  idea-import, evolve). `node install.mjs --pack <name>` links a pack's
  skills into each runtime's user-level folder by the same rules as above;
  `--unpack` removes them, `--list-packs` shows where each is linked. They
  run in any project and in the vault: in a project they write only into
  that repo, in the vault through the write gate. Each is written for any
  user and names only skills that ship; one that leans on another pack says
  what it does when that pack is not linked.
- **The vault reads a project, and never writes one.** From a vault session,
  `node scripts/project-doctor.mjs --board` shows every project at once, read
  live from each repo. A vault session may also read a repo to answer a
  cross-project question; what it records is the cross-project conclusion
  ("finish A before B"), never the project's own detail. A card is written
  from a vault session when the owner asks for one, from
  `.claude/templates/project.md`, and its `status:` is the owner's call; the
  board says when the repo disagrees.
- **An interrupted run is visible from files alone:** STATE names an
  `active_run` whose report is missing or has no `status:`. The next session
  trusts git, the diff and a fresh test run over what is written down, then
  corrects STATE.
- **`scripts/project-doctor.mjs` reports where the split is not holding**,
  from a vault session, read-only, across every repo a card names: project memory that is not
  committed, no remote, a stale or missing STATE, an interrupted run, leftover
  worktrees, status claimed outside STATE, log ids that resolve to no card,
  and drifted copies of one skill. With `--board` it prints the one-row-per-
  project view instead.

Deliberately not shipped: the reference instance also has commit-gate,
holdout-lock and test-gate hooks for its project repos. They are runtime hooks
with their own configs, and a template user adds one when they see the failure
it prevents. The project-repo README describes them. The build pack runs the
same checks without them: each is a command the agent runs and records in the
run report, and held-out scenarios are guarded by a `LOCK.json` of file
hashes that the held-out verification refuses to pass when anything changed.
