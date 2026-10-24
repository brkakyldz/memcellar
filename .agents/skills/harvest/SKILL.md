---
name: harvest
description: Reads one project repo read-only from a vault session and brings what it learned into the vault — its project card, its lessons, the decisions that matter beyond it — since the last harvest. Use when the owner says "harvest <project>", "bring that project into the vault", "pull what we learned in <repo>", the same in any language, or invokes /harvest <project>. Vault sessions only; it never writes into the project.
---

# Harvest

Projects and the vault are walled off (ADR 0052): a project session never reads
or writes the vault, and keeps its own state, decisions and lessons. This skill
is the one bridge, and it runs in one direction — the vault reads a project,
on the owner's request, and never writes into it. Project cards are written
only by this skill.

Contracts: `AGENTS.md` § Distillation, § Memory rules and § Note conventions.
Everything taken from a repo is distilled under those rules, like any source.

## Read-only, always

In the project repo you may read files and run `git log`, `git show`,
`git diff` and `git rev-parse`. Nothing else: no checkout, no build, no test
run, no edit, no commit, no file created — not even a marker. The harvest
point is recorded on the vault side.

## Steps

1. **Resolve the project.** The argument is a card id or a repo path. Find the
   card: `rg -l "^project_id: <id>$" notes` or `rg -l -F "repo: <path>" notes`
   (`grep -rl` where `rg` is missing). No card: read the repo's `README.md`
   and `docs/CURRENT_STATE.md` (its `project_id:` is the id to use), draft a
   card from `.claude/templates/project.md` and create it only on the owner's
   yes.

2. **Find the range.** The card's `harvested_at:` is the last sha read.
   `git -C <repo> rev-parse HEAD` is the new one. No `harvested_at` yet means
   a first harvest: read the current files below, not the whole history.
   Equal shas → say "nothing new since <harvested_on>" and stop.

3. **Read what changed in the range**, and only that:
   - `git -C <repo> log --oneline <harvested_at>..HEAD`, the history in brief;
   - `docs/lessons/lesson-*.md`, new entries (entries are append-only, so a
     `git -C <repo> diff <harvested_at>..HEAD -- docs/lessons/` shows exactly
     the new ones);
   - `docs/decisions/`, new or superseded ADRs;
   - `docs/CURRENT_STATE.md`, only to set the card's `status:`
     (`active | paused | done`);
   - `reports/research/` (or wherever the repo keeps research), new reports,
     by title.

4. **Decide per item — ADD / MERGE / SUPERSEDE / NARROW / NOOP**, against what
   the vault already believes. Most items are NOOP: project progress,
   milestones and fixes stay in the repo, and the card points there.
   - **A lesson about how the owner wants work done** (it would apply to a
     different project) → append it as an entry to the matching vault
     `notes/lesson-<topic>.md`, or open a topic from
     `.claude/templates/lesson.md`. Copy the correction and artifact verbatim
     and head the entry with `source: <repo>/docs/lessons/<file>@<sha>`.
     Project lesson entries are never edited, so the copy cannot drift. A
     lesson about this repo only stays there; the card links it.
   - **A decision that matters beyond the repo** (a library, a pattern, a
     verdict on a tool) → a line in the card's "What it taught", pointing at
     the ADR path, or a `notes/` memory or knowledge note with `source:` and
     `confidence: low` when it is a fact other work will need.
   - **Research a later project will want** → a pointer in the card; ingest it
     into `notes/` only if the owner asks.
   - Nothing from a repo goes into `core/` in this pass. A candidate for
     `MEMORY.md` or `USER.md` is named in the summary for the owner to decide;
     the corroboration gate still applies.

5. **Update the card**: `status:`, the "What it taught" lines, and
   `harvested_at: <new sha>`, `harvested_on: <YYYY-MM-DD>` in the frontmatter.
   Never copy live status (milestones, gates, the next action) into it.

6. **Log and commit.** One session log per the session-log rule, with
   `project: <card id>`, `runtime:`, under ten body lines, and the closing
   `outcome |` line (`AGENTS.md` § Session-log rule). New notes get their
   `INDEX.md` rows. Commit the paths this pass wrote by name —
   `git commit -m "harvest: <project> (<old>..<new>)" -- <paths>`. Never push.

7. **Summarise**, a few lines in the language the owner converses in: what
   came in, what was left in the repo and why, and any `core/` candidate
   waiting for the owner.

## Card format

```yaml
---
type: project
created: YYYY-MM-DD
tags: [...]
status: active | paused | done
project_id: <must equal the filename without .md>
repo: /absolute/path/to/checkout   # forward slashes; the primary checkout
remote: https://example.com/you/repo.git | none
state_file: docs/CURRENT_STATE.md | none   # relative to repo
project_aliases: [older ids seen in logs]
harvested_at: <sha> | none
harvested_on: YYYY-MM-DD | none
related: ["[[...]]"]
---
```

Body ≤ 25 lines: why it exists (one line); where it lives; a sentence that
live status is in the repo's state file and is never copied here; what it
taught (links to lessons, knowledge notes, repo ADR paths); lineage. Needs ≥1
outbound wikilink and an `INDEX.md` row, like any vault note.
