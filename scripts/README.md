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

## B11 — `retrieval-eval.mjs`

- **What:** ranks `notes/` + `core/` and re-runs the `query → expected
  note` pairs in `.claude/eval/golden-set.md`, reporting recall@1/@3/@5 plus
  every miss. The default ranker, `fielded`, weights each matched token by
  IDF, four times over when it is in the filename, title, aliases or tags;
  `legacy` and `frequency-free` keep the older scorers. `expand` fuses the
  rankings of the query and its keyword variants (from
  `.claude/eval/expansions.md`, or `--variant` in query mode) — the arm
  `/recall` uses, after it passed the gate in the reference instance.
  `--query "<terms>"` is the ranked lookup `/recall` runs.
  `--compare BASELINE,CANDIDATE` runs an exact sign test per query and a gate
  verdict, and `--set golden|real|both` adds the held-out
  `.claude/eval/real-prompts.md` — real questions, written down before
  anyone tuned a ranker on them. A new ranker becomes the default only
  through that gate.
- **When:** from `/audit`, and ad hoc:
  `node scripts/retrieval-eval.mjs [--verbose]`.
- **Output:** Markdown on stdout. Exits 0 always — a failing row is a finding,
  not a broken build.
- **Language:** folding and stopwords are built for English and Turkish — a
  Turkish-locale lowercase with a dotless-i fold, then an accent strip, and a
  short stopword list in both. Another query language with its own case rules
  adapts `normalizeText` and `STOPWORDS` in the script.
- **What it does not measure:** whether a session answered anything correctly.
  Recall also drifts down as the corpus grows, because more notes match the
  same terms — competition, not rot.
- **Kill criterion:** if every miss for two consecutive months is fixed by an
  `aliases:` entry, the golden set is measuring vocabulary, not retrieval —
  shrink it. If misses cluster on `paraphrase-miss`, that is the evidence ADR
  0018 asked for.

## B15 — `brain-doctor.mjs`

- **What:** one read-only table over the brain path of both runtimes: exactly
  one SessionStart per runtime, no retired v1.0 git-writing hook still wired,
  the `.claude/skills` link, and — if you linked them — the user-level
  `closeout`/`lesson` links (and no user-level `recall` link left from v1.1,
  ADR 0052); Tier-0 budgets; **Tier-0 integrity** (invisible or bidirectional
  control characters in `core/*.md` fail, uncommitted changes under `core/` or
  the hook folders warn); **provenance** (a `confidence: low` note linked from
  `MEMORY.md` fails the corroboration gate; `source:` notes without
  `confidence:` and undated `MEMORY.md` bullets warn); the last recorded
  session-start payload; the `/recall` contract (the vault skill and the
  resources it names); **retired terms** (references in skill and hook files
  to machinery that no longer exists, from the list at the top of the script);
  the current retrieval score; top-level entries against the `AGENTS.md`
  folder map; and Git delivery state.
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
- **When:** from a vault session, before `/curator` or `/harvest` — a project
  session never runs it, because projects and the vault are walled off (ADR
  0052): `node scripts/project-doctor.mjs`. `--repo <path>` adds a repo with
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
  and lesson topics waiting to be routed. `node scripts/maintenance.mjs run`
  does the deterministic half: link sweep, compiled checks over every note,
  retrieval eval, brain doctor. Last-run dates come from the logs the passes
  already write, so there is no stamp file to keep.
- **When:** after the owner says yes to the notice, or by hand. Never
  scheduled, never run unasked.
- **Output:** `logs/YYYY-MM-DD_link-sweep.md`, `check-fire` ledger lines, the
  rest on stdout. `/curator` and `/audit` stay skills and are only named here.
- **Kill criterion:** if the owner says no to the notice three times in a row
  without running the pass later, the thresholds are wrong — raise them or
  drop the pass from the list.

## `vault-metrics.mjs`

- **What:** deterministic counts from the signal ledger and `notes/` — check
  fires by month, correction recurrence by class, retrieval failures by cause,
  and lesson and check survival. It counts and dates; it draws no conclusions.
  Named `flywheel-metrics.mjs` until the reference instance retired the
  sections that scored suggestions and note re-use (ADR 0038, 0039).
- **When:** from `/audit`, or ad hoc: `node scripts/vault-metrics.mjs`.
- **Check fires** accrue only through `checks.mjs --record` (below), which
  `maintenance.mjs run` calls; a zero means nothing was recorded, not that
  the vault is clean.
- **Kill criterion:** if an audit stops reading it, drop it.

## `.claude/hooks/checks.mjs` — the compiled checks

- **What:** the rules that are checked as code — wikilink short form, note
  frontmatter, `INDEX.md` coverage (ADR 0019, 0022, 0035). It lives beside the
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
  and home folders.
- `brain-doctor.test.mjs` — the Tier-0 integrity, provenance, `/recall`
  contract and retired-term checks.
- `retrieval-eval.test.mjs` — the scorer, the expansion variants and the
  sign-test gate.
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
| Retrieval-eval arms `bm25`, `alias-addonly`, `prefix5` | v1.2 | Each failed the sign-test gate on the reference instance; `expand` passed and is kept |
| Scheduled maintenance, off-site bundle, daily resurfacer | before v1.0 — the code was never in the v1.0 tree, though its `scripts/README.md` still described it | ADRs 0021, 0032, 0033 |
