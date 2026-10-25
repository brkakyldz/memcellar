# Upgrading

What each release changed, and how to bring a vault made from an earlier one
up to date. The README keeps the short version.

## What changed in v1.3

The one-line version: **every page is typed by how long it stays true,
lessons and traps from all your projects meet in one user-level kit, the
search machinery is gone, the vault is written in your language, and your own
pages move into `notes/`.** It was built in the template and tested on a copy
of a working vault before release; there is no two-week bar any more
(ADR 0058). The decisions are recorded in full in `docs/decisions/` (0055,
0056, 0057, 0058, 0059, 0060).

**Removed**

- The retrieval machinery (ADR 0057): the `/recall` skill,
  `scripts/retrieval-eval.mjs` and its test, `.claude/eval/golden-set.md`,
  `real-prompts.md` and `expansions.md`, the `retrieval-failure` signal type
  as something anything writes, the brain doctor's recall-contract and
  retrieval-score rows, the eval step of `maintenance.mjs run`, and the
  retrieval-failure section of `vault-metrics.mjs`. Old `retrieval-failure`
  lines in your ledger still parse.
- `/harvest` and the project-card fields `harvested_at` and `harvested_on`
  (ADR 0056). Harvest logs already in `logs/` stay as history.
- `.claude/templates/knowledge.md`, and `knowledge` and `memory` as types to
  write (ADR 0055). Pages that already carry them still parse; the vault's
  lesson files keep `type: memory` from their template.
- `my-notes/`, its README, `type: my-note` and the templates `my-note.md` and
  `my-entity.md` (ADR 0060). Your pages move into `notes/`, step 8.
- The English rule (ADR 0059). The vault writes in the language in
  `core/IDENTITY.md`; nothing already written is translated in bulk.

**Added**

- Three page types, each with a home and a lifetime (ADR 0055): `topic`
  pages in `notes/`, updated in place with `updated:`; `report`s in the new
  `reports/` folder, dated `YYYY-MM-DD_<slug>.md` and written once;
  `deliverable`s in the new `outputs/` folder, with an `expires:` date
  (30 days unless set). Templates `topic.md`, `report.md`, `deliverable.md`;
  contracts `reports/README.md` and `outputs/README.md`.
- The write gate, `.agents/write-gate.md`: NOOP first, type the page by three
  questions, find its neighbours, close what the write made stale in the same
  commit. `/file`, `/ingest` and `/curator` run it.
- `scripts/note-neighbours.mjs` — lists the pages already on a subject, by
  title words, aliases, tags and links, and flags `-v2`-style names.
- Two compiled checks. `note-lifetime`: each type in its folder with the
  fields its lifetime needs, and `legacy-type` on a changed page that still
  says `knowledge` or `memory`. `lifetime-sweep`: expired deliverables,
  reports no page links, topic pages older than their newest report or
  untouched for 90 days, a passed `valid_to` with nothing superseding it,
  `-v2` pages, and passed "until <date>" lines in `core/` and on topic pages
  and cards. The "Maintenance due" line counts these under `/curator`.
- `/curator` step 3a, which works through those findings and through pages
  that a decision from the last 30 days made stale.
- `node scripts/project-doctor.mjs --board` — one row per project, read live:
  card status, last commit, active milestone, the state file's Next line,
  and a note where the card and the repo disagree. `maintenance.mjs run`
  prints it too.
- `/closeout` step 6: a trap any repository could hit is appended to the
  kit's `reference/` and committed there.
- The brain doctor flags skills and hooks that still name `retrieval-eval`,
  `golden-set`, the recall skill, the harvest skill or `harvested_at`, and
  accepts `reports/` and `outputs/` at the top level.
- Owner pages (ADR 0060): a page in `notes/` with `author:` is yours. The
  agent never edits, moves, archives or deletes one unless you ask, and the
  `owner-pages` check fires when one changed, lost `author:`, or was deleted
  or moved. `/note` writes one from `.claude/templates/owner-page.md`.
- `notes/home.md`, the front page for browsing in Obsidian, and
  `notes/todo.md`, your own to-do and ideas page. `node install.mjs
  --obsidian` hides `archive/`, `logs/` and `raw/` from Obsidian's search and
  graph, merging into your `.obsidian/app.json`.
- Tests for the neighbour finder, the new checks, the owner-page guard and
  the board.

**Changed**

- `/lesson` picks its store with one question — would this recur in a
  different repository? — and defaults to your user-level kit
  (`$BRAIN_KIT_DIR`, else `lessons/` next to your user-level instruction
  file). A repo lesson needs a reason tied to that repo; the vault keeps only
  lessons about running the vault. Each entry names the repository it came
  from and keeps only the shortest excerpt of the artifact (ADR 0056).
- `/file` writes a topic-page update, a report or a deliverable, and says
  which and why. `/ingest` writes a report plus the lines it changes on its
  topic page.
- `INDEX.md` lists only the living layer — topic, decision, project and
  playbook pages. Its "Knowledge" headings are "Topics", it gains a
  "Folders, not pages" table for `reports/` and `outputs/`, and the Ingested
  sources table names the report and the topic page each source fed.
- `/audit` names the latest result of your answer eval, if you keep one in
  `.claude/eval/`, instead of running a ranker.
- Project cards are written from a vault session when you ask; their
  `status:` is your call, and the board says when the repo disagrees.
- The compiled checks treat a quoted date (`updated: "2026-10-24"`) the same
  as an unquoted one, and the link-form check covers `reports/` and
  `outputs/`.

## Upgrading from v1.2

As before, there is no shared history to pull: you fetch v1.3 and take its
machinery path by path. Your content is never overwritten. Start from a clean
tree, in the vault's root. The reclassification in step 6 is judgment work;
do it in a session with the agent, page by page.

1. **Fetch v1.3:** `git fetch template --tags`.
2. **Note your own edits first:** `git diff --stat v1.2 HEAD`. Any file in
   step 4's list is about to be replaced; save your changes to `AGENTS.md`
   and re-apply them afterwards.
3. **Read your retrieval files before anything deletes them.** If you added
   rows to `.claude/eval/golden-set.md` or `real-prompts.md`, or wrote your
   own `expansions.md`, read them first. A query whose right answer you know
   can become a question in your answer eval: keep it in `.claude/eval/` as
   the question plus the answer you confirmed. Words you added as expansions
   belong in `aliases:` on the page they were meant to find. Everything else
   in those files can go.
4. **Take the machinery:**

   ```
   git checkout v1.3 -- .agents .claude/hooks .claude/templates .claude/settings.json .codex scripts docs reports/README.md outputs/README.md AGENTS.md CLAUDE.md README.md SETUP.md install.mjs .gitignore .gitattributes notes/lifecycle-policy.md notes/self-evolution-policy.md notes/home.md logs/signals/README.md raw/README.md
   ```

   `notes/source-roots.md` is left out because it holds your rows. Change
   its `type:` to `topic` and add `updated: <today>` by hand. So is
   `core/IDENTITY.md`, which is yours: replace its § Language with the one
   line from `git show v1.3:core/IDENTITY.md`, in your language.
5. **Remove what v1.3 deleted** — `git checkout` adds and replaces files but
   never removes them:

   ```
   git rm -r -q .agents/skills/recall .agents/skills/harvest scripts/retrieval-eval.mjs scripts/tests/retrieval-eval.test.mjs .claude/templates/knowledge.md .claude/templates/my-note.md .claude/templates/my-entity.md
   git rm -q --ignore-unmatch .claude/eval/golden-set.md .claude/eval/real-prompts.md .claude/eval/expansions.md
   ```

   Skip a path in the second line if step 3 turned it into your answer eval.
6. **Reclassify your pages.** `node .claude/hooks/checks.mjs --all` lists
   every page in `notes/` that still says `knowledge` or `memory` as
   `legacy-type` (lesson files are exempt). For each one, ask the three
   questions in `.agents/write-gate.md` step 2:
   - **Something to act on, then done with** (a list of listings, a set of
     ideas, a one-day inventory): a deliverable.
     `git mv notes/x.md outputs/YYYY-MM-DD_x.md`, with the date it was
     written; set `type: deliverable`, `expires:`, `for:` and
     `topic: "[[subject]]"`. Already past its use? Move it to `archive/`
     instead.
   - **Sourced claims as of one date** (a research run, a comparison): a
     report. `git mv notes/x.md reports/YYYY-MM-DD_x.md`; set
     `type: report`, `confidence: low`, `source:` and `topic:`. From here on
     it is never edited.
   - **How a subject stands now**: a topic page. Keep it in `notes/`, set
     `type: topic` and `updated:` to the day it was last confirmed true.

   A page holding two lifetimes is split: research that ended in a choice
   becomes a report plus a decision, and a section written for one-time use
   becomes a deliverable. Pages named `-v2`, `-v3` merge into one topic page;
   archive the rest. A plan you are still following is a topic page; when
   only you can tell, the agent asks you once. Each report and deliverable
   you moved gets a line and a link on its topic page (create the topic page
   if the subject has none), and its row leaves `INDEX.md`.
7. **Repoint links and the catalog.** Renaming a page breaks `[[x]]` links
   to it: `node scripts/link-sweep.mjs` lists them. Take `INDEX.md`'s new
   headings and the "Folders, not pages" table from
   `git diff HEAD v1.3 -- INDEX.md`.
8. **Your own pages move into `notes/`** (ADR 0060). For each file in
   `my-notes/` except the README: check its name is free in `notes/` (on a
   clash, give yours a free name and link the other page in its first line),
   `git mv my-notes/x.md notes/x.md`, and replace `type: my-note` with
   `author: <your name>`, keeping `kind:`. Your to-do and ideas files merge
   into `notes/todo.md` (take it with `git show v1.3:notes/todo.md`), under
   "To do" and "Ideas". Then `git rm my-notes/README.md`. Anything outside
   the vault that reads `my-notes/` paths needs its paths changed.
9. **Obsidian and the home page.** `node install.mjs --obsidian`, then link
   your topic hubs from `notes/home.md` and add its row to `INDEX.md`
   (§ Start here, in `git diff HEAD v1.3 -- INDEX.md`).
10. **Project cards.** Delete the `harvested_at:` and `harvested_on:` lines
   from every `type: project` card in `notes/`.
11. **Lessons, optionally.** Vault lesson topics about how you want work done
   in general, not about running the vault, can move to your kit's
   `lessons/`. Head each moved copy with where it came from and the commit it
   was copied at, and move the vault original to `archive/`.
12. **Relink.** `node install.mjs --link-skills`, and
    `node install.mjs --link-global-skills` again if you use it.
13. **Commit the upgrade** by explicit path:
    `git commit -m "upgrade: Second Brain OS v1.3"`.
14. **Check it:** `node scripts/brain-doctor.mjs` (Retired terms lists any
    skill of your own that still names the recall or harvest skills, or
    `my-notes/`),
    `node .claude/hooks/checks.mjs --all`, then `node scripts/maintenance.mjs`
    to see what is due.

In your projects nothing has to change. A repo with `docs/lessons/` keeps
them; new owner-wide lessons start landing in the kit.

## What changed in v1.2

v1.2 brings the template in line with the reference instance again, four
weeks after v1.1. The one-line version: **projects and the vault are walled
off, lessons become one file per behaviour, and the session start says when
upkeep is due.** As with v1.1, several of these are younger than the usual
two-week bar; the owner asked for the release as the system runs today, and
the decisions are recorded in full in `docs/decisions/` (0048, 0049, 0050,
0052).

**Removed**

- Global mode's injection. The SessionStart hook does nothing outside the
  vault — no pull, no `USER.md` or `MEMORY.md`, no standing rules (ADR 0052).
  A user-level hook from a v1.1 global install keeps working: it now exits at
  once in other projects.
- The vault log a project session wrote at `/closeout`, and `/closeout`'s
  `MEMORY.md` step. `/closeout` ends with the repo's own commit.
- `docs/WORKLOG.md` from the project-repo formats, and *Commits*, *Open gates*
  and *Next* from the run-report template (ADR 0050). An existing WORKLOG is
  frozen history: keep it, never append to it.
- `/recall` from the user-level links. It is vault-only now; rerunning
  `--link-global-skills` removes the old link.
- The `bm25`, `alias-addonly` and `prefix5` arms of `retrieval-eval.mjs`,
  which failed the sign-test gate in the reference instance.

**Added**

- `/harvest <project>` — from a vault session, read one project repo
  read-only and bring what it learned into the vault: the card, lessons that
  matter beyond it, its decisions. Project cards are written only this way.
- Project lessons in the project: `/lesson` writes `docs/lessons/` in a repo
  and `notes/` in the vault (ADR 0052).
- Lessons as topic files: one file per recurring behaviour, entries appended
  verbatim, and on a second entry from a different task the agent proposes a
  rule, which you approve or refuse (`routing:`, ADR 0048).
- The once-a-day "Maintenance due" line and `scripts/maintenance.mjs`, which
  lists what is due and, with `run`, does the mechanical half after your yes
  (ADR 0049). `checks.mjs` has a caller again.
- `my-notes/` and `/note` — your own notes, written only when you ask, in your
  own language, never touched by a pass. Templates `my-note.md` and
  `my-entity.md`.
- `/recall` query expansion: the question is rewritten into keyword variants
  and the rankings are fused (`retrieval-eval.mjs --ranker expand`). The eval
  gained an optional held-out set (`.claude/eval/real-prompts.md`), an
  expansions file (`.claude/eval/expansions.md`) and a sign-test gate.
- `brain-doctor.mjs`: Tier-0 integrity, provenance (the corroboration gate),
  the `/recall` contract and stale references to retired machinery.
- Tests for the brain doctor, the retrieval eval and the SessionStart hook.

**Changed**

- `/curator` gains a NARROW verdict (shrink a fact to what its source
  supports), keeps the source's doubt and dates, logs where every removed
  `MEMORY.md` line went, and lists lesson topics waiting to be routed.
- `/curator` and `/audit` may be started by the agent in Claude Code, but
  only after you type the command or say yes to the maintenance line. In
  Codex their `agents/openai.yaml` keeps implicit invocation off, so there you
  type the command yourself.
- The SessionStart hook skips its pull while another task's rebase, merge,
  cherry-pick or revert is in progress, instead of aborting it; a notice is
  recorded as shown only once it is actually delivered.
- The session-log rule has a write-time gate: a bullet goes in only if a
  future session would decide worse without it.
- A playbook with two recorded failed uses since its last success is demoted
  back to knowledge.
- The figures in the README show the wall and `/harvest`.

## Upgrading from v1.1

From v1.1, go to v1.2 first with the steps below, then follow *Upgrading from
v1.2* above. Several files these steps name were removed in v1.3.

As with v1.0 → v1.1, there is no shared history to pull: you fetch v1.2 and
take its machinery path by path. Your content — `core/`, `notes/`, `logs/`,
`raw/`, `archive/`, `INDEX.md`, `PROPOSALS.md` — is never overwritten. Start
from a clean tree, in the vault's root.

1. **Fetch v1.2:** `git fetch template --tags` (add the remote first, as in
   the v1.0 steps below, if this clone has none).
2. **Note your own edits first:** `git diff --stat v1.1 HEAD` — any file in
   step 3's list is about to be replaced; save your changes to `AGENTS.md`
   and re-apply them afterwards.
3. **Take the machinery:**

   ```
   git checkout v1.2 -- .agents .claude/hooks .claude/templates .claude/settings.json .claude/eval/expansions.md .claude/eval/real-prompts.md .codex scripts docs my-notes/README.md AGENTS.md CLAUDE.md README.md SETUP.md install.mjs .gitignore .gitattributes notes/lifecycle-policy.md notes/self-evolution-policy.md notes/source-roots.md logs/signals/README.md raw/README.md
   ```

   `.claude/eval/golden-set.md` is yours once you have added your own rows —
   compare it with `git diff HEAD v1.2 -- .claude/eval/golden-set.md` rather
   than taking it.
4. **Remove what v1.2 deleted:** `git rm -q .claude/templates/project-repo/docs/WORKLOG.md`.
5. **One hook, one place.** Step 3 restored the SessionStart entry in the
   vault's `.claude/settings.json`. If you ran v1.1 in global mode, delete the
   SessionStart entry that points at this vault from `~/.claude/settings.json`
   — the project-level one is now the default, and a user-level one would do
   nothing outside the vault anyway. Keep exactly one; `brain-doctor.mjs`
   fails when both are wired. Codex keeps its user-level entry.
6. **Relink.** `node install.mjs --link-skills`, and — if you linked skills at
   user level in v1.1 — `node install.mjs --link-global-skills` again: it links
   `/closeout` and `/lesson` and removes the old `/recall` link.
7. **Old lessons.** Per-correction `notes/lesson-*.md` files from v1.1 keep
   working as notes. When you have a few minutes, group them by behaviour
   into topic files (`.claude/templates/lesson.md`), move the originals to
   `archive/`, and give each topic file an `INDEX.md` row. Take the new
   heading of `INDEX.md`'s Lessons section from
   `git diff HEAD v1.2 -- INDEX.md` while you are there.
8. **Commit the upgrade** by explicit path:
   `git commit -m "upgrade: Second Brain OS v1.2"`.
9. **Check it:** `node scripts/brain-doctor.mjs`, then
   `node scripts/maintenance.mjs` to see what is due.

In your projects, nothing has to change at once: a repo with a WORKLOG keeps
it as frozen history, and `/closeout` simply stops appending to it.

## What changed in v1.1

v1.1 (2026-09-25) brings the template in line with the reference instance as
it runs today. The one-line version: **one hook that never commits, two equal
runtimes, and project state that lives in the project's own repo.** Several of
these additions are younger than the usual two-week bar; the owner lifted it
for this release and
[ADR 0046](decisions/0046-template-v1-1-published-ahead-of-the-bar.md) says
which ones.

**Removed**

- The Stop / SessionEnd / PreCompact checkpoint that committed and pushed the
  whole tree (`checkpoint.mjs`, `session-end.mjs`). Commits are task-owned:
  each task stages its own explicit paths (ADR 0042, 0044).
- The session flush (`flush.mjs`), reuse telemetry (`reuse-telemetry.mjs`),
  the proposals sweep (`proposals.mjs`), `/flywheel` and the maintenance due
  line (`maintenance-stamp.mjs`) (ADR 0038, 0039).
- The Node secret scan inside hook commits — there are no hook commits left.

**Added**

- Codex as an equal runtime: `AGENTS.md` is the constitution (`CLAUDE.md`
  imports it), `.agents/skills/` is the one skills copy (`.claude/skills` is
  a link to it), `.codex/hooks/session-start.mjs` is the Codex adapter.
- Project work in the project's repo (ADR 0045): the repo-side formats in
  `.claude/templates/project-repo/`, thin project cards, `/closeout`, and
  `node install.mjs --link-global-skills` to reach it from any project.
- `scripts/brain-doctor.mjs` and `scripts/project-doctor.mjs`, both
  read-only; the ranked lookup `retrieval-eval.mjs --query`;
  `notes/self-evolution-policy.md`, split out of the lifecycle policy.
- A command line for the compiled checks,
  `node .claude/hooks/checks.mjs [--staged | --all] [--record]`, now that no
  hook runs them; `--help` on `install.mjs` and `link-sweep.mjs`, and
  `BRAIN_DIR` honoured by the link sweep like every other script.

**Changed**

- `SessionStart` skips its pull when the vault has uncommitted changes to
  tracked files, instead of stashing another task's files (no more autostash).
- Secret scanning is opt-in: gitleaks through `.pre-commit-config.yaml`.
- `PROPOSALS.md` is a list you keep by hand; `/curator` and `/audit` report
  in the conversation and their own log instead of appending to it.
- `flywheel-metrics.mjs` is `vault-metrics.mjs`, counting without scoring.
- Project notes are thin cards; their live status moves into each project's
  `docs/CURRENT_STATE.md`.

## Upgrading from v1.0

From v1.0, go to v1.1 first with the steps below, then follow *Upgrading from
v1.1* above.


A vault made with **Use this template** shares no git history with this
repository, so there is nothing to pull: you fetch v1.1 and take its machinery
path by path. Your content — `core/`, `notes/`, `logs/`, `raw/`,
`archive/`, `INDEX.md`, `PROPOSALS.md` — is never overwritten. Start from a
clean tree (`git status` shows nothing), in the vault's root. The commands are
the same in bash and PowerShell.

1. **Fetch v1.1** — with this repository's URL:

   ```
   git remote add template <this repo's URL>
   git fetch template --tags
   ```

2. **Note your own edits first.** `git diff --stat v1.0 HEAD` lists every file
   you changed since setup. Any of them in step 3's list is about to be
   replaced — above all `CLAUDE.md`, which was the constitution in v1.0; save
   `git diff v1.0 HEAD -- CLAUDE.md` somewhere and re-apply it to `AGENTS.md`
   afterwards.

3. **Take the machinery:**

   ```
   git checkout v1.1 -- .agents .claude/hooks .claude/templates .claude/settings.json .codex scripts docs AGENTS.md CLAUDE.md README.md SETUP.md install.mjs .gitignore .gitattributes .pre-commit-config.yaml notes/lifecycle-policy.md notes/self-evolution-policy.md logs/signals/README.md raw/README.md
   ```

4. **Move your own skills** out of `.claude/skills/`, if you added any —
   `git mv .claude/skills/<name> .agents/skills/<name>` for each — then
   **remove what v1.1 deleted:**

   ```
   git rm -r -q .claude/skills .claude/hooks/checkpoint.mjs .claude/hooks/flush.mjs .claude/hooks/maintenance-stamp.mjs .claude/hooks/reuse-telemetry.mjs .claude/hooks/session-end.mjs scripts/flywheel-metrics.mjs scripts/proposals.mjs
   ```

5. **Link the skills and review the rest.** Run
   `node install.mjs --link-skills`. Re-add any lines of your own that
   `git diff --cached -- .gitignore` shows as removed. Compare the files that
   are yours to merge by hand — `git diff HEAD v1.1 -- INDEX.md PROPOSALS.md core/IDENTITY.md`
   — and at least add the `[[self-evolution-policy]]` row to `INDEX.md`.
   In global mode, empty the `hooks` block of `.claude/settings.json` again
   (keep `permissions`).

6. **Commit the upgrade.** Stage what you edited in step 5 by name —
   `git add -- .gitignore INDEX.md .claude/settings.json`, whichever you
   touched — then `git commit -m "upgrade: Second Brain OS v1.1"`. The index
   holds exactly the upgrade, because the tree was clean when you started.

7. **Unwire the retired hooks at user level.** In global mode, delete every
   entry in `~/.claude/settings.json` that points at `checkpoint.mjs`,
   `session-end.mjs` or `reuse-telemetry.mjs` in your vault; keep the one
   `SessionStart` entry. For Codex, add its entry as in
   [`SETUP.md`, Step 5](../SETUP.md#codex).

8. **Check it:** `node scripts/brain-doctor.mjs` fails loudly on a retired
   hook still wired, a duplicate SessionStart or a missing skills link. Then,
   optionally, `node install.mjs --link-global-skills`, and turn your project
   notes into cards (`.claude/templates/project.md`).

From here on, nothing commits for you: each task commits its own explicit
paths.
