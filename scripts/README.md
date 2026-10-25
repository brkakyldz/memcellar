# scripts/ — hand-run and skill-run tooling

Deterministic work lives here as plain Node scripts — stdlib only, no npm
install, identical on Windows, macOS and Linux. LLM spend is reserved for
judgment calls (`/curator`, `/audit`); see `AGENTS.md` and
[[self-evolution-policy]] for the policy these scripts implement.

**Nothing here is scheduled.** Unattended maintenance was built, run and
retired in the reference instance (ADR 0033): a job that runs with nobody
watching produces work nobody reads, and every defect it hit lived in the
supervision layer that only exists because nobody is watching. Every script
below is run by hand or by a skill, in a session someone is sitting in front
of. Since v1.2 the session start may *say* that upkeep is due — once a day,
computed from state — and the agent asks before anything runs
(`maintenance.mjs` below, ADR 0049).

Every script carries a **kill criterion**: a job with no defined way to fail is
one nobody turns off. The numbering (B2, B11, …) is the reference instance's
roster, kept so the ADRs that cite it still resolve; gaps are jobs that were
retired.

## B2 — `link-sweep.mjs`

- **What:** scans every vault-content `.md` file (`.git/`, `.claude/`,
  `.codex/`, `.agents/`, `.obsidian/` are not walked; `archive/` is indexed as
  a link target but not scanned as a source) for broken `[[wikilinks]]` (by
  filename or `aliases:`), orphan notes (no inbound *and* no outbound links —
  `logs/`, `archive/`, `raw/`, `core/`, `docs/`, `scripts/` and the root docs
  are never reported), dangling pointer lines in `core/MEMORY.md`, duplicate
  basenames (which make `[[name]]` ambiguous and fail silently), and notes in
  `notes/` with no row in `INDEX.md`.
- **When:** by hand, or from a `/curator` session — `node scripts/link-sweep.mjs`.
  It sweeps `BRAIN_DIR` when that is set, else the folder above the script;
  `--help` prints the usage and writes nothing.
- **Output:** a report at `logs/YYYY-MM-DD_link-sweep.md` (a second run the
  same day overwrites it). It writes that one file and nothing else; commit it
  or delete it like any other log.
- **Kill criterion:** orphan count flat for a month — simplify or drop it.

## B4 — gitleaks pre-commit hook · **opt-in**

`.pre-commit-config.yaml` declares `gitleaks` (pinned at `v8.30.1`;
`pre-commit autoupdate` moves the pin). **Since
v1.1 it is the only secret scan, and only once you install it:** the Node
scanner in `.claude/hooks/lib.mjs` (`scanStagedForSecrets`) ran inside every
checkpoint commit, and the checkpoint was retired with whole-tree commits (ADR
0042, 0044). Nothing scans a commit unless you enable this: `pip install
pre-commit`, then `pre-commit install` inside the vault.

- **Recommended, by hand:** turn on GitHub's secret-scanning **push
  protection** for your vault repo (Settings → Code security). It is a repo
  setting, not something a script can do.
- **Kill criterion:** none — keep it as long as the vault has a remote.

## B8 — acceptance logging, by hand

A decision worth recording about an agent suggestion (a link, a merge, an
archive) may get one `acceptance` or `rejection` line in the signal ledger,
carrying `feature:` and `ref:`:

```
node .claude/hooks/append-signal.mjs acceptance feature:link-suggestion ref:"[[x]] <-> [[y]]"
```

This used to be the input of a computed acceptance rate fed by a proposals
sweep; both were retired with proposal production (ADR 0038). The line
survives as a convention for the skills and feeds nothing that scores them.

## `note-neighbours.mjs` — the neighbour step of the write gate (ADR 0055)

- **What:** before a page is written, lists the pages already on the same
  subject in `notes/`, `reports/` and `outputs/` (top level, `.md` only;
  `archive/` is never a neighbour). A page scores on title words against its
  filename, first heading and aliases, plus a bonus for shared tags; with
  `--slug <page>` also every page that links to it or that it links to. A
  page whose name differs from another only by a `-v2`-style or date suffix
  is flagged as a version; reports are never flagged, because a topic page
  and its dated reports sharing a name is the normal shape. No embeddings,
  no index: it reads the files each time.
- **When:** step 3 of `.agents/write-gate.md`, run by `/file`, `/ingest` and
  `/curator`, or by hand:
  `node scripts/note-neighbours.mjs "<subject words>" [--tags a,b] [--slug name] [--min 0.3] [--json]`.
  Run it in the owner's language, and once more in the language older pages
  are written in while the vault holds both (ADR 0059). Turkish letters are
  folded to ASCII on both sides, and another language with its own case
  rules adapts `lower()` and `STOP` in the script.
- **Output:** a Markdown table on stdout (score, page, type, status, date,
  why, flags), at most 15 rows; an owner page shows as read only. Read-only.
- **Failure that demanded it:** in the reference instance, versions of the
  same list were all live and nothing said which was current, and pages
  describing an old decision kept saying it after it changed (ADR 0055).
- **Kill criterion:** if writers stop opening what it lists, or `-v2` pages
  keep appearing beside it, the step is ceremony — fold it back into a
  `grep` in the write gate.

## B15 — `brain-doctor.mjs`

- **What:** one read-only table over the brain path of both runtimes: exactly
  one SessionStart per runtime, no retired v1.0 git-writing hook still wired,
  the `.claude/skills` link, and — if you linked them — the user-level
  `closeout`/`lesson` links (any other vault skill linked at user level warns,
  ADR 0052); Tier-0 budgets; **Tier-0 integrity** (invisible or bidirectional
  control characters in `core/*.md` fail, uncommitted changes under `core/` or
  the hook folders warn); **provenance** (a `confidence: low` note linked from
  `MEMORY.md` fails the corroboration gate; `source:` notes without
  `confidence:` and undated `MEMORY.md` bullets warn); the last recorded
  session-start payload; **retired terms** (references in skill and hook
  files to machinery that no longer exists, from the list at the top of the
  script — since v1.3 that includes `retrieval-eval`, `golden-set`, the
  recall and harvest skills and `harvested_at`); top-level entries against
  the `AGENTS.md` folder map, which now includes `reports/` and `outputs/`;
  and Git delivery state.
- **When:** after setup, after changing hook wiring, after upgrading, or when
  memory loading is suspected: `node scripts/brain-doctor.mjs`. `--json` for
  tooling, `--strict` to exit 1 on any failure.
- **Output:** stdout only. It never repairs, stages, commits, writes a report,
  or updates a sidecar.
- **Kill criterion:** if two runtime investigations in a row still have to open
  the underlying files because this table cannot localize the fault, remove it
  rather than grow it into a dashboard.

## B16 — `project-doctor.mjs`

- **What:** a read-only view of project memory across every repo a project
  card names (`type: project` + `repo:`, ADR 0045): git present, a remote
  present (`remote: none` on the card makes that a warning, not a flag),
  untracked or modified project memory (plans, ADRs, docs, lessons,
  research), unpushed commits, `docs/CURRENT_STATE.md` freshness, an
  interrupted `active_run`, leftover worktrees, status lines outside the state
  file, log `project:` ids that resolve to no card, `USER.md` focus pointing
  at a paused or done card, and drifted copies of the same skill across every
  skills folder that exists — the vault's and each project's
  `.agents/skills`, `~/.agents/skills`, and the user-level folders of both
  runtimes (`CLAUDE_CONFIG_DIR` / `CODEX_HOME` respected).
- **`--board`:** the cross-project view that replaced the harvest skill (ADR
  0056). One row per repo, newest commit first: the card's status, the last
  commit's date and subject, STATE's `active_milestone`, the first line of
  its `## Next` section, and a note when the card and the repo disagree (a
  card `active` with no commit for 30 days, a card `paused` or `done` with a
  commit in the last 7, or no state file). `--board --json` for tooling.
  Nothing is copied into a card. `maintenance.mjs run` prints it too.
- **When:** from a vault session, before `/curator` or whenever you want the
  cross-project view — a project session never runs it, because projects and
  the vault are walled off (ADR 0052): `node scripts/project-doctor.mjs`.
  `--repo <path>` adds a repo with
  no card yet; `--kit <dir>` (or `BRAIN_KIT_DIR`) adds a separate skills kit
  to the drift scan, if you keep one; `--since YYYY-MM-DD` moves the date
  from which a log `project:` id with no card is a FLAG rather than legacy
  (default: the day ADR 0045 introduced cards, documented at the top of the
  script); `--json`; `--strict` exits 1 on any FLAG.
- **Output:** stdout only. Every git call uses `--no-optional-locks`, so it
  never contends with a session committing in the same repo, and values read
  from a STATE file are never passed to git as options.
- **Failure that demanded it:** in the reference instance, a survey of its
  project repos found project memory untracked in several of them, one project
  that was never a git repo, one with no remote while an automation ran from
  its uncommitted code, and merged worktrees piling up — none of it visible
  from the vault.
- **Kill criterion:** if three consecutive runs report the same FLAGs and none
  gets fixed, the report is noise — cut it to the checks that did get acted on.

## `maintenance.mjs` — upkeep, on the owner's yes (ADR 0049)

- **What:** `node scripts/maintenance.mjs` lists what upkeep is due and why —
  the same list the session-start "Maintenance due" line shows: `/curator`
  when 10 or more logs are past 30 days, `/audit` after 30 days without an
  audit log or when a note is past `review_by`, the link sweep after 7 days,
  lesson topics waiting to be routed, and — added to the `/curator` item, or
  raised on its own — the counts of what time made stale
  (`lifetimeFindings` in `lib.mjs`: expired deliverables, unlinked reports,
  topic pages behind their reports, and the rest the `lifetime-sweep` check
  lists). `node scripts/maintenance.mjs run` does the deterministic half:
  link sweep, compiled checks over every page in `notes/`, `reports/`,
  `outputs/` and `core/`, brain doctor, project board. Last-run dates come
  from the logs the passes already write, so there is no stamp file to keep.
- **When:** after the owner says yes to the notice, or by hand. Never
  scheduled, never run unasked.
- **Output:** `logs/YYYY-MM-DD_link-sweep.md`, `check-fire` ledger lines, the
  rest on stdout. `/curator` and `/audit` stay skills and are only named here.
- **Kill criterion:** if the owner says no to the notice three times in a row
  without running the pass later, the thresholds are wrong — raise them or
  drop the pass from the list.

## `vault-metrics.mjs`

- **What:** deterministic counts from the signal ledger and `notes/` — check
  fires by month, correction recurrence by class, and lesson and check
  survival. It counts and dates; it draws no conclusions.
  Named `flywheel-metrics.mjs` until the reference instance retired the
  sections that scored suggestions and note re-use (ADR 0038, 0039).
- **When:** from `/audit`, or ad hoc: `node scripts/vault-metrics.mjs`.
- **Check fires** accrue only through `checks.mjs --record` (below), which
  `maintenance.mjs run` calls; a zero means nothing was recorded, not that
  the vault is clean.
- **Kill criterion:** if an audit stops reading it, drop it.

## `.claude/hooks/checks.mjs` — the compiled checks

- **What:** the rules that are checked as code — wikilink short form (in
  `notes/`, `core/`, `reports/` and `outputs/`), note frontmatter, `INDEX.md`
  coverage (ADR 0019, 0022, 0035), two lifetime checks (ADR 0055) and the
  owner-page guard (ADR 0060). `owner-pages` fires when a page carrying
  `author:` differs from its committed copy, lost the field, or was deleted
  or moved; the other checks and the lifetime findings skip owner pages.
  `note-lifetime` checks each type in its home: a topic page carries
  `updated:`; a report in `reports/` is named `YYYY-MM-DD_<slug>.md` and
  carries `type: report`, `topic:`, `source:` and `confidence:`; a
  deliverable in `outputs/` is named `YYYY-MM-DD_<slug>.<ext>` and carries
  `expires:`; a report or deliverable inside `notes/` fires; and a changed
  `notes/` page that still says `knowledge` or `memory` fires `legacy-type`
  (lesson files excepted). `lifetime-sweep` lists what time made stale, for
  the files it is handed. It lives beside the
  hook because the Stop checkpoint ran it until v1.1. Since v1.2
  `maintenance.mjs run` is its caller again (ADR 0049).
- **When:** before a commit — `node .claude/hooks/checks.mjs` for the working
  tree's changes, `--staged` for what is staged, `--all` for the whole vault.
  `/audit` runs `--all`. Wiring `--staged` into a git pre-commit hook turns
  the warning into a gate; the template leaves that choice to you.
- **Output:** every finding on stdout; exit 0 clean, 1 on a finding, 2 on bad
  arguments. Read-only unless `--record`, which appends new fires to
  `logs/signals/YYYY-MM.md`, once per check, file and finding per month.
- **Kill criterion:** per check — one that false-positives twice goes back to
  prose (ADR 0019).

## `tests/`

Each test builds its fixtures in the system temp directory and never reads
your real home folder or the machine's system git config. Run any of them
with `node scripts/tests/<name>.test.mjs`; each exits 1 on a failure.

- `index-coverage.test.mjs` — the two INDEX-coverage instruments (the
  `index-coverage` check in `checks.mjs` and the git-blind sweep in
  `link-sweep.mjs`) and their command lines (`checks.mjs` exit codes,
  `--staged`, `--all`, `--record`; link-sweep's `BRAIN_DIR` and `--help`).
- `project-doctor.test.mjs` — `project-doctor.mjs` on fixture vaults, repos
  and home folders, including `--board`.
- `brain-doctor.test.mjs` — the Tier-0 integrity, provenance, retired-term
  and user-level skill checks.
- `note-lifetime.test.mjs` — the `note-lifetime` check: each type in its
  home, with the fields its lifetime needs.
- `lifetime-sweep.test.mjs` — `lifetimeFindings`, the `lifetime-sweep` check
  and the maintenance notice that counts them.
- `owner-pages.test.mjs` — ADR 0060: the `owner-pages` check (edited, unmarked,
  deleted and moved owner pages), the lifetime findings skipping them, and
  `install.mjs --obsidian`.
- `note-neighbours.test.mjs` — the neighbour finder: versions, aliases in
  another language, links in either direction.
- `session-start.test.mjs` — the SessionStart hook: inert outside the vault,
  notices recorded only once delivered, the pull skipped while another task's
  rebase or merge is in progress.

## Retired — kept here so nobody re-adds them by accident

| Job | Retired | Why |
|---|---|---|
| Stop / SessionEnd / PreCompact checkpoint commit (`checkpoint.mjs`, `session-end.mjs`) | v1.1 | A whole-tree `git add -A` takes another task's half-written files with it once two sessions share a checkout (ADR 0042, 0044) |
| Session flush (`flush.mjs`) | v1.1 | Reconstructed a missing session log from the transcript; in the reference instance it failed 779 times in a row unnoticed (ADR 0038) |
| Reuse telemetry (`reuse-telemetry.mjs`, `--rollup`) | v1.1 | Counted that a note was opened, never that opening it helped; informed no decision (ADR 0039) |
| Proposals sweep (`proposals.mjs`), `/flywheel`, the acceptance rate | v1.1 | The queue aged instead of being answered (ADR 0038) |
| Maintenance due line (`maintenance-stamp.mjs`) | v1.1 | Measured staleness against a schedule nothing ran (ADR 0038). v1.2's `maintenance.mjs` is a different design: due is computed from outstanding work, with no stamp, and nothing runs without a yes (ADR 0049) |
| Global-mode injection into project sessions | v1.2 | Project sessions received the vault's `USER.md` and `MEMORY.md`, mostly noise for the work at hand (ADR 0052) |
| Retrieval-eval arms `bm25`, `alias-addonly`, `prefix5` | v1.2 | Each failed the sign-test gate on the reference instance; the rest of the eval went in v1.3 |
| Retrieval eval (`retrieval-eval.mjs`), its golden, real-prompt and expansion sets, the recall skill and the retrieval-failure signal | v1.3 | Real sessions almost never called the ranker; fresh sessions answered with plain grep and reads, and the one wrong answer was not a search miss. Quality is now judged by answers (ADR 0057) |
| The harvest skill and the cards' `harvested_at` / `harvested_on` | v1.3 | It never ran in the reference instance; lessons now go to their home at capture, cross-project traps to the kit at closeout, and project status is read live by `project-doctor.mjs --board` (ADR 0056) |
| Scheduled maintenance, off-site bundle, daily resurfacer | before v1.0 — the code was never in the v1.0 tree, though its `scripts/README.md` still described it | ADRs 0021, 0032, 0033 |
