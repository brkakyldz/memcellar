---
name: bug-sweep
description: Runs a whole-app bug hunt with parallel agents, files the verified findings as GitHub issues without duplicates (after the owner approves the filing), then fixes them in parallel PRs that never share a file and merges them one at a time. Use when the owner asks for a general bug or logic-error sweep of an app ("sweep the app for bugs", "have agents test it and open issues"), or to fix and merge a batch of sweep issues ("fix them all in PRs", "merge them one by one"), or the same request in the owner's language. Not for one known bug or for reviewing a single commit (slice-reviewer, when the build pack is installed).
---

# Bug sweep

Four phases, each with a gate. The gates exist because checks done once at
the start go stale while the sweep runs: in the reference instance a sweep of
35 issues lost two of them — one duplicated an issue opened during the sweep,
and one fix PR collided with feature work running at the same time. Each gate
re-checks the world right before the step that depends on it.

Agents: Claude Code fans out with subagents (the Agent tool); a runtime
without them runs the areas one after another in the same session, with the
same rules. Every hunter runs on the capable tier — the session's own model
or the strongest the runtime offers (Claude Code: leave the subagent's
`model` option at the session's; Codex: its default profile). Finding a
logic error is judgment, not a lookup, and a cheap hunter's false positives
cost more verification than they save.

## 1. Hunt

- **Snapshot.** Before fanning out, record the time `T0` and the
  `origin/main` SHA. Read `gh issue list --state all` and `gh pr list` once,
  so the agents can skip known items.
- **Split by area**, one agent per area, chosen from the app's own shape —
  for example core logic, data and storage, the server API and its
  security, background jobs, the UI end to end, the CLI and docs. Give each
  agent its own scratch folder outside the repo, its own data directory and
  its own **port**: a port collision makes one agent kill another's server.
- **Rules for every agent:**
  - read-only on the repo;
  - no paid or live external call (model APIs, payment, email) — stub it,
    or skip that path and say so;
  - report only bugs it reproduced, or that the code makes certain, each
    with file, line and a reproduction;
  - **never file issues** — the coordinator dedupes and files them.
- **Verify every finding** against the code at the current `origin/main`, not
  the local checkout. Another session may have switched branches under the
  agents.

## 2. File — the dedupe gate (right before filing, not at T0)

1. `git fetch`. Re-check that each finding still holds on the new
   `origin/main` (`git diff --stat <T0-sha> origin/main -- <files>`).
2. Re-read what appeared since T0:
   - issues: `gh issue list --state all --search "created:>=<T0>"`;
   - PRs: `gh pr list --state all --search "created:>=<T0>"`;
   - branch names: `git branch -a --sort=-committerdate | head`. A branch
     named after a bug is a fix in progress.

   Drop or merge any finding that matches. Search a key term of each finding
   too (`gh issue list --search "<term>" --state all`).
3. **Check issue automation.** Look in `.github/workflows/` for `issues:`
   triggers (labelers, triage bots, agents that act on new issues). Count
   the runs filing will start.
4. **Ask the owner before filing**, with selectable options (AskUserQuestion
   in Claude Code; a numbered list elsewhere): how many issues, whether the
   repo is public, and how many automated runs they will trigger. In a
   public repo, or anyone else's, an issue is a public post — file nothing
   without a clear yes. The owner may cut the list.
5. File in the repo's issue style. A public repo's issues carry no local
   paths, no private file names and no secrets from a reproduction.

## 3. Fix — the collision gate (before splitting into parallel PRs)

1. **List the work already in flight on the same files:**
   - open PRs: `gh pr list --json number,headRefName,files`;
   - branches pushed since T0;
   - other sessions' uncommitted work in the primary checkout (`git status`
     there; never touch it).
2. **Build a file-ownership map:** each fix group owns its files, and no two
   groups share one. Move an issue to the group that owns its file, or split
   it by file ("Closes" in one PR, "Refs" in the other).
3. **A group whose files overlap in-flight work does not start in parallel.**
   It waits for that work to merge, or starts from its branch. Say which, and
   why, in its brief.
4. Each group works in its own git worktree, syncs to `origin/main` first,
   writes a failing test per issue, makes it pass, and opens one PR with one
   `Closes #N` line per issue. It never merges.

Opening PRs in the owner's own repo needs no extra approval once filing was
approved; PRs to anyone else's repo do.

## 4. Merge — one at a time

Follow `references/merge-train.md`. In short: merge one PR; update the next
with `main` and **confirm the update happened** (new head SHA); wait for CI
on that SHA; squash-merge; repeat. Before each merge, look at `git log` on
`main` for merges that did not come from the train. Stop and tell the owner
on a conflict, a red CI, or such a merge.

## Report

End with the issue range, which PR closed which issues, anything left open
and why, and the dropped duplicates with the issue each one duplicated. In a
repo that keeps `docs/CURRENT_STATE.md`, open bugs that block a milestone go
there as gates, not into a separate list.
