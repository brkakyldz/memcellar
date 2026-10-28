# AGENTS.md — this vault's constitution

## What this repo is

This is an Obsidian vault, the shared memory store of two equal agent runtimes
(Claude Code and Codex), and a git-synced personal second brain, all at once.
**The vault is the brain.** There is no database and no tool-internal format —
plain Markdown + flat YAML frontmatter + `[[wikilinks]]` is the single source
of truth, readable by a human in Obsidian and by an agent with file tools alike.

**Git is the only database.** Every change is a commit. `git log` is the audit
trail. `git revert` is undo. The remote is sync and backup — nothing more.

## Folder map

One folder per **lifecycle**, not per category. What a note *is* lives in its
frontmatter `type:`; how it is written and retired decides which folder holds
it. A note's maturity changes its `status:`, never its path — so a link never
breaks because a thought grew up.

- `core/` — Tier 0, injected by the SessionStart hook in a vault session (and
  only there — ADR 0052). Four files: the first three are inlined with their
  budgets and `OPEN_QUESTIONS.md` arrives as a pointer.
  - `IDENTITY.md` — the assistant's persona and rules of engagement in this vault.
  - `USER.md` — who the owner is: role, preferences, working style.
  - `MEMORY.md` — index of durable facts, one line each, pointing into `notes/`.
  - `OPEN_QUESTIONS.md` — the live question ledger.
- `notes/` — the living layer, flat: every page that says what is true now.
  Topic pages, decisions, project cards and playbooks sit side by side and
  are told apart by `type: topic | decision | project | playbook`, never by
  folder. Everything here is wikilinked, has frontmatter, and earned its
  place. One subject has one topic page.
  **Owner pages** sit here too: a page whose frontmatter carries `author:` is
  the owner's own (ADR 0060). It is written by the owner, or by `/note` when
  they ask, and the agent never edits, moves, archives or deletes one unless
  they ask for that change; the `owner-pages` check catches one that changed.
  The owner's to-do page is one ("To do" and "Ideas"), and the home page
  links it with the topic hubs.
  A `type: project` note is a thin card: it names the repo and its state file
  and never copies live status — execution state lives in the repo (ADR 0045).
  A card is written from a vault session when the owner asks for one.
- `reports/` — dated readings of the world, flat, `YYYY-MM-DD_<slug>.md`:
  research runs, comparisons, audits. Written once; after its day the only
  edit is a supersession line. Each names its topic page in `topic:`.
  Contract: `reports/README.md`.
- `outputs/` — deliverables, flat, `YYYY-MM-DD_<slug>.<ext>`: lists, drafts,
  inventories, made to be acted on and then done with. Each carries
  `expires:` and is archived after it. Never a source for `MEMORY.md`.
  Contract: `outputs/README.md`.
- `raw/` — the source store: immutable documents the owner put there.
  Articles, papers, transcripts, exports, images. **The agent reads and never
  writes** — no edit, rename, move or delete; the one exception is fetching a
  source in when the owner asks for that specific fetch. Flat,
  `YYYY-MM-DD_<slug>.<ext>`. This is the only place verbatim external content
  may live, which is what keeps it out of `notes/`. Full is the healthy state.
  Contract: `raw/README.md`.
- `logs/` — append-only session logs, `YYYY-MM-DD_HHMM.md` or
  `YYYY-MM-DD_HHMM-<slug>.md`; a pass report names its pass instead
  (`YYYY-MM-DD_link-sweep.md`, `YYYY-MM-DD_audit.md`,
  `YYYY-MM-DD_HHMM_curator.md`; the maintenance line reads these suffixes) —
  the date prefix is
  the part that never varies. Plus the signal ledger in `logs/signals/`.
  Written as evidence — read it, never rewrite it.
- `archive/` — closed projects, stale content, and the historical working
  record. Never deleted, always moved here.
- `.agents/skills/` — the vault's skills, the one canonical copy both runtimes
  load. Codex reads it natively; `.claude/skills` is a gitignored junction
  (Windows) or symlink (macOS/Linux) to it, created by `node install.mjs`.
  There is only one copy — an edit through either path is an edit to it.
  Every skill works on the vault and loads only in a vault session, except
  `/closeout` and `/lesson`, which a project session may also use if the
  owner links them at user level (`node install.mjs --link-global-skills`):
  they write into the repo the session is in or the owner's user-level kit,
  never into the vault. `.agents/write-gate.md` is the procedure every vault
  writer runs (§ Distillation).
- `.agents/packs/` — optional skill packs, `<pack>/<skill>/` (`research`,
  `build`, `release`, `ideas`). Nothing here loads on its own: `node
  install.mjs --pack <name>` links a pack's skills at user level, where they
  work in any project and in the vault, and `--unpack` removes the links
  (ADR 0062). This folder is their one source; a pack skill run in a
  project never touches the vault, and one run here writes through the
  write gate.
- `.claude/` — the shared machinery both runtimes call: `hooks/`,
  `templates/`, and `eval/` when the owner keeps an answer eval
  (`/truth-test`'s key and results; never read by a vault session). The name is
  historical, not ownership. `.codex/` holds only the thin Codex SessionStart
  adapter. Not vault content; this is how the agent runs, not what it knows
  about the world.
- `scripts/` — helper jobs (link sweep, neighbour finder, metrics,
  maintenance, vault doctor, project doctor), each invoked by hand or by a
  skill. Nothing here runs on a clock: unattended scheduling was retired
  (ADR 0033).
- `docs/` — documentation about the vault, not vault content: the
  architecture guide, the decision index (`DECISIONS.md`), the template's
  full decision records (`docs/decisions/`), the FAQ, the upgrade guide and
  the README's figures (`docs/assets/`). Your own decisions are
  `type: decision` notes in `notes/`, archived once superseded — one home,
  described in `DECISIONS.md` § Recording your own.
- Root files: `INDEX.md` is the page catalog — every page of the living
  layer, one line each, with `reports/` and `outputs/` as one row each; the
  first thing to read when answering a question. `PROPOSALS.md` is a list of
  open work the owner keeps by hand — no pass writes it. `README.md` is the
  vault's front door; `SETUP.md` and `install.mjs` are the agent-run and the
  manual installer. `CLAUDE.md` only imports this file (`@AGENTS.md`) plus
  any Claude-only lines — one constitution, never two copies (ADR 0044).
  `LICENSE` is the template's MIT license; `.gitignore`, `.gitattributes`
  and `.pre-commit-config.yaml` are git plumbing (the last one opt-in).

## Reading

Before answering a question the vault may already answer — a past decision, a
person, a project, what is true now — read `INDEX.md` and the pages it points
to. Then `grep` over `notes/`, `reports/` and `core/`, in the language the
owner asked in and, while older pages are written in another one, in that
language too (ADR 0059). Cite the page the answer came from. A report
answers "as of" its date; when it disagrees with its topic page, the topic
page is the current view.

## Distillation

There are two paths into the memory store, and both end in distillation.

**Live distillation inside a session** — the owner says something, the page
gets written, nothing is ever queued. There is no capture inbox on purpose: a
queue with no producer is a folder that fills up with guilt.

**Ingest of a source** — `/ingest` reads a document in `raw/` or a registered
root, discusses it with the owner, and distills it into a report in
`reports/` with a `source:` marker, plus the lines it changes on its topic
page. The source is read once and stays read; the vault then answers from the
distillation, never by re-reading. `raw/` has a producer by design — the
owner saving what they are reading — which is the property an inbox lacks.
`/import` does the same for a whole notes folder the owner brings in: a dry
run table first, approved group by group, the source folder never modified.

**What is true now is the owner's to say.** `/truth` asks the owner, claim
by claim, keeps the answers in `notes/current-truth.md` with a `confirmed:`
date per section, closes the pages that contradict it and rebuilds Tier 0
from it; `/truth-test` asks a fresh session the questions in
`.claude/eval/truth-questions.md` on a clone of the vault and names the pages
behind every stale answer.

**Every write passes the write gate** (`.agents/write-gate.md`, ADR 0055),
except `/note` into an owner page and `/lesson`, which follow their own
contracts:

1. **NOOP first.** Write nothing when it is already written in the vault,
   the repo or the user-level rules, when it can be derived from a file that
   exists, or when it is "what happened, when" (`git log`).
2. **Type it by its lifetime**, three questions in order: something to act
   on and then done with → a `deliverable` in `outputs/`; sourced claims as
   of one date that no one will keep current → a `report` in `reports/`;
   otherwise it changes what is true now → update the subject's `topic` page
   in `notes/`, or create it. One page holds one type; a page holding two is
   split. A report or a deliverable adds a line and a link to its topic page.
3. **Find the neighbours** (`node scripts/note-neighbours.mjs`) and decide
   ADD / MERGE / SUPERSEDE / NARROW / NOOP for each. A `-v2` is never the
   answer: update the first page.
4. **Close what the write made stale, in the same commit:** `valid_to`,
   `superseded_by` and a visible first line on every neighbour that still
   says the old thing. A note that it "may be stale" is not a close.

- **Nothing enters `notes/` verbatim.** A thought is rewritten in original
  wording, merged into an existing note, or linked from one. A copy that
  survives in two places is two sources of truth.
  The one legal home for verbatim external content is `raw/`, and a note points
  back at it rather than reproducing it. Quote only where the exact phrasing is
  the point — a line or two, in quotes, attributed.
- **A source is never memory on its own.** Anything derived from `raw/` or a
  registered root carries `source:`, enters as `confidence: low`, and reaches
  `MEMORY.md` only through the corroboration gate. `USER.md` and
  `core/IDENTITY.md` are closed to external content outright.
- **Maturity is frontmatter, not location.** A topic page that grows from
  `seedling` to `evergreen` never moves. Exactly one transition moves a file:
  anything → `archive/` (it closed, or a deliverable expired).

## Memory rules

- `MEMORY.md`: one fact per line. When detail exists, end the line with a
  pointer, e.g. `- Project X uses trunk-based dev → [[project-x]]`.
  Budget: **4000 characters max**. `USER.md` budget: **2000 characters max**.
  HTML comments don't count — they are instructions to the writer, not facts.
  The unit is characters, not lines, because a line cap silently varies 2× with
  how long your lines happen to run. The session-start header shows each file's
  usage, so check it *before* writing, not after.
- **Two things are never `MEMORY.md` entries.** The vault's own construction
  history goes in a note of its own; open work items go to `PROPOSALS.md`.
- **Never silently truncate.** When a file is over budget, consolidate (merge
  duplicates, archive stale entries) before adding anything new.
- Every stored fact must be **timeless, dated, or a pointer to a live source**.
  Anything else is a staleness bug waiting to happen.
- Facts derived from untrusted external content (web pages, tool output) carry
  a `source:` marker and are **never** written into `USER.md` or `IDENTITY.md`.
- **The vault is written in the owner's language** (`core/IDENTITY.md`,
  ADR 0059). A lesson quotes the correction verbatim in whatever language it
  was given in.
- Owner pages are exempt from the ≥1-outbound-wikilink rule. A fact on an
  owner page or in a lesson is not promoted to `MEMORY.md` — it still goes
  through the corroboration gate.
- **Archive-first.** Stale or closed content moves to `archive/`, never into
  the void. Deletion is allowed only in the narrow cases defined in
  [[lifecycle-policy]] §6 — and the second (a superseded, unlinked,
  non-load-bearing note) only with the owner's explicit approval.

## Lifecycle & self-evolution

Full policy with rationale: [[lifecycle-policy]] (what happens to a note or a
fact) and [[self-evolution-policy]] (how the system changes itself). The
binding rules:

- **Tiers.** Tier 0 (`IDENTITY.md` 40 lines / `USER.md` 2000 chars /
  `MEMORY.md` 4000 chars) is always loaded and holds pointers, not detail.
  Everything else is reached on demand via pointers and search — never
  preloaded. Past ~10KB of session-start payload the harness stops inlining
  Tier 0 at all, so the budgets protect loading itself, not just attention.
- **Different lifecycles per memory type.** Episodic (`logs/`) is append-only
  and gets distilled then archived (logs at 30 days). Semantic (`MEMORY.md`,
  `notes/` with `type: topic | decision | project`) is reconciled on write:
  per new fact, decide ADD / MERGE / SUPERSEDE / NARROW / NOOP — never blind
  append. Reports are write-once and age by their date; deliverables are
  archived once past `expires:`, unless the owner extends them. Procedural
  (`type: playbook`, skills) changes only by deliberate revision, ≤150 lines
  per playbook.
- **Maturity through reuse.** `seedling → growing → evergreen` promotion only
  when someone reworks the note in new work — never on a timer, never from an
  access count. Every new
  note gets ≥1 outbound wikilink before it is closed. **Evergreen gate:**
  `status: evergreen` additionally requires a 1–2 sentence top-line
  distillation at the head of the note. If the idea can't be stated that
  briefly, it hasn't matured yet — leave it `growing`.
- **Domain-dependent staleness.** A claim about a tool, version, API or price
  is checked against its source whenever something depends on it, whatever its
  date. `review_by:` is optional, for decay that is genuinely predictable;
  stable concepts get none. Correction memories are re-challenged after ~90
  days. An overdue `review_by` is reported by the audit, never auto-deleted.
- **Contradictions:** newer evidence wins, but the override is logged —
  supersession is visible, never silent. Mechanically: close the old fact's
  window and point it forward (bi-temporal keys, § Note conventions).
- **Corroboration gate:** a once-seen fact enters the vault in a report,
  `confidence: low`; it reaches `MEMORY.md` only after a second independent
  source confirms it. Independence belongs to the source, not the session
  count: two sessions repeating the same page or the same claim are one source
  ([[lifecycle-policy]] §8).
- **Playbook gate:** a note is promoted to `type: playbook` only after
  **≥2 verified successful uses**. A workflow that just worked may be drafted
  as a playbook in the same session, marked `uses: 1`, and stays there until
  a second use corroborates it. Every playbook carries a one-line frontmatter
  `description:` — good enough to judge relevance without opening the file.
- **Protected files:** `IDENTITY.md` and this file are never edited by an
  automated pass — agents propose a diff, the owner applies it.
- **Pins:** `pinned: true` exempts from demotion; max 10 vault-wide,
  re-justified when the audit says they need it.
- **The loop:** the trigger is the owner opening a session, never a clock
  (ADR 0033). A once-a-day "Maintenance due" line at session start says what
  is due and why (ADR 0049); the agent mentions it in one line and runs
  `/curator`, `/audit` or `node scripts/maintenance.mjs run` only after the
  owner says yes. Nothing runs unasked. Lesson topics are routed by `/lesson`
  when a second correction lands (ADR 0048), not by a separate pass. The
  structural audit stays report-only — budgets, orphans, overdue reviews, tag
  sprawl — and audit and consolidation stay separate passes. What time made
  stale (expired deliverables, unlinked reports, topic pages behind their
  reports) is counted in the same line and closed by `/curator` on the
  owner's yes. Pins and policy
  get re-justified when the audit says they need it, not on a calendar.
- **Notification budget:** hard cap **3 proactive items per day**, counted
  across *all* surfaces together (session start, pass reports, anything else
  that speaks up unasked).
  Everything past the cap becomes a pull artifact — a file the owner opens when
  they want it, never a push. False positives kill a review queue permanently.
- **Suggestions are acted on or dropped, not queued.** A pass reports its
  findings in the conversation and its own log; nothing appends to an approval
  queue (ADR 0038). A suggestion feature that is not acted on gets removed, not
  tuned forever. A decision worth recording may still be logged by hand as an
  `acceptance` / `rejection` line in the signal ledger.
- **Growth control:** no new folder/tag/taxonomy without an actual failure
  that demands it. Vault health is judged, not counted: whether notes
  get reworked and relied on in new work, never how many were captured or
  opened (the re-use count was retired with the telemetry, ADR 0039). **No new
  hook or script without an actual failure that demands it either** — the same gate folders and tags already pass. Machinery
  is harder to remove than a folder, because it acquires callers.

## Session-log rule (standing instruction to the agent)

After completing substantial work in a session, append an entry to
`logs/YYYY-MM-DD_HHMM.md` covering what happened, what was decided, and what
was learned. Tag each item with one of: `decision | bugfix | feature |
discovery | preference | change`. If a durable fact emerged, also update
`MEMORY.md` (respecting its budget and consolidation rule above).

**Write-time gate.** A bullet goes in only if a future session that never read
this log would decide worse or slower without it. A note written in the same
session is cited by its wikilink, not restated. Step-by-step narration belongs
in the commit message. One log per session — append to it rather than opening
a second. (In the reference instance, close to half of all log bullets turned
out to be duplicates or narration before this gate existed.)

End every substantial-work log with exactly one `outcome` line:
`outcome | claim:<what is now true> | verification:<verified|agent-claimed|partial> | refs:<paths, commits or [[wikilinks]]>`.
`verified` requires a test, readback, external result, or the owner's
acceptance; a file existing or an agent saying "done" is only
`agent-claimed`. Use `partial` when the implementation landed but an external
or fresh-session check remains. The line indexes existing evidence; it never
copies tool output.

**Three homes, and projects are walled off (ADR 0052, 0056).**

- **The repo** holds a project's state, decisions and the lessons tied to its
  code or domain: `docs/CURRENT_STATE.md`, `docs/decisions/`,
  `docs/lessons/`. A rule for one project only goes in that repo's
  `AGENTS.md`.
- **The owner's user-level kit** holds what every project needs: the working
  rules, in the user-level instruction file; owner-wide lessons in
  `<kit>/lessons/`; and traps that would hit any repository in
  `<kit>/reference/`, each with one trigger line in the user-level file.
  `<kit>` is `$BRAIN_KIT_DIR`, or folders next to the user-level instruction
  file. It is private. A working rule is stated once, where it is enforced;
  the vault may point at it, never restate it.
- **The vault** holds the owner's life, work and current truth, and one card
  per project.

A session in a project repo neither reads nor writes this vault: the
SessionStart hook does nothing outside it. Project progress gets no vault
log. A vault session may read a repo, read-only, to answer a cross-project
question, and records only the cross-project conclusion, never the project's
own detail. `node scripts/project-doctor.mjs --board` shows every project's
state, read live; nothing is copied into a card. A vault log about a project
carries `project: <card id>` — the filename of a `notes/<project_id>.md`
card; older values resolve through the card's `project_aliases` — and
`runtime: claude-code | codex`.

## Note conventions

- Filenames: `kebab-case.md`. Filenames are vault-unique, which is what lets
  links stay short.
- Internal links: `[[wikilinks]]`, **short form — the filename without a path
  or extension** (`[[project-x]]`, never `[[notes/project-x]]`). Used with
  surrounding sentence context, not as bare link lists.
- Frontmatter: flat YAML, this schema —
  - `type`: `topic | report | deliverable | decision | project | playbook |
    log`, chosen by the write gate before the page is written. `report` is
    valid only in `reports/`, `deliverable` only in `outputs/`. An owner page
    carries `author:` and `kind:` instead, and no `type:`
    (`.claude/templates/owner-page.md`). `knowledge` and `memory` are not written
    any more; older pages keep them until reclassified, and the vault's
    lesson files keep `type: memory` from their template. The live list for
    `notes/` is `ALLOWED_TYPES` in `.claude/hooks/checks.mjs`; when the two
    disagree, the check is the newer of the pair.
  - `created`: `YYYY-MM-DD`
  - `updated`: `YYYY-MM-DD`, required on a topic page — the day it was last
    confirmed true.
  - `expires`: `YYYY-MM-DD`, required on a deliverable — 30 days after
    `created` unless the owner sets it.
  - `topic`: a `[[wikilink]]` to the topic page a report or a deliverable
    feeds; required on a report. A report also carries `source:` and
    `confidence:`.
  - `tags`: list
  - `status`: topics → `seedling | growing | evergreen`; projects →
    `active | paused | done`; decisions → `accepted | superseded | reversed`;
    playbooks → `active | superseded`. Reports and deliverables carry none.
  - `source`: optional, required for anything derived from untrusted content
  - `related`: optional list of `[[wikilinks]]`
  - Project cards add `project_id` (= filename), `repo`, `remote`,
    `state_file` and `project_aliases`; project logs add `project` and
    `runtime`. `scripts/project-doctor.mjs` reports ids that resolve to no
    card.
  - `aliases`: optional. Its job is to catch the query that would otherwise
    miss the note: another name, a nickname, an abbreviation. Search here is
    `grep`.
- Dates are always `YYYY-MM-DD`.
- **Bi-temporal keys** — optional, for durable facts whose truth has a window:
  `valid_from` (when the fact became true), `valid_to` (when it stopped),
  `recorded_at` (when we learned it), `superseded_by` (`[[wikilink]]` to what
  replaced it). Knowledge time and event time are different things; keeping
  both is what lets a future session answer "what did we believe, and when".
- **A contradiction closes a window, it never overwrites one.** Set `valid_to`
  and `superseded_by` on the old fact, then write the new fact as a *new*
  entry or note. Never edit a superseded fact in place, never delete it — the
  old belief and the date it died are themselves data.

## Sync rules

- Pull before you write.
- **Commits are task-owned (ADR 0042, 0044).** Claude Code and Codex may work
  in this checkout at the same time, so no hook commits for you and no task
  stages the whole tree. Stage the explicit paths your task wrote, commit once
  with a message that names the work, and leave every other dirty file alone —
  it belongs to whoever created it. `git add -A` / `git add .` are never part of
  the protocol.
- Never run a second sync mechanism (iCloud, Google Drive, Syncthing) over
  this folder — one sync mechanism per vault, ever.
- Push failures are non-fatal: the commit stays local and syncs on the next
  successful push. Never block a work session on a failed push.
