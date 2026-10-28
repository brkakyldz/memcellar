# Merge train

Merge a batch of PRs that branched from the same `main`, so that each one is
tested together with everything merged before it. Branch protection that does
not require branches to be up to date (`strict: false`) lets a stale PR merge
green; the train is what guards against that.

## Order

Start with the PR whose files the fewest other PRs touch, and end with the
riskiest. Preview conflicts before you start:

```bash
git fetch origin
git merge-tree --write-tree --name-only origin/main origin/<pr-branch>
```

A non-empty conflict list means the PR needs its own session to merge `main`
in first. Never rebase or force-push someone else's branch.

## Per PR

1. **Up to date?**
   `gh api repos/<owner>/<repo>/compare/main...<branch> --jq .behind_by`.
   If `0` and CI is green on the head SHA, go to step 4.
2. **Update.** Run `gh pr update-branch <n>`, then check that it
   **succeeded** and that the head SHA changed:
   `gh pr view <n> --json headRefOid,mergeStateStatus`.
   - On "Cannot update PR branch due to conflicts" (or `DIRTY`): stop.
   - Do not trust `gh pr checks --watch` after a failed update: it returns at
     once on the old head's green checks. In the reference instance this
     waved a stale PR through.
3. **Wait for CI on the new head.** Run `gh pr checks <n> --watch --required`
   (in the background where the runtime allows), then confirm the checks
   belong to the new head SHA.
4. **Look at `main` first.**
   `git log --oneline <last-merged-sha>..origin/main`. A commit you did not
   merge means someone else is merging: stop and tell the owner.
5. **Squash-merge.** The PR title plus ` (#<n>)` as subject, the PR body as
   body. If the repo forbids AI attribution, grep the body for attribution
   trailers first.
6. Note the merge SHA.

## Stop conditions

Stop and report on any of these:

- a conflict;
- a red CI (a flaky test is not waved through: re-run once, then name it);
- a merge on `main` that did not come from the train;
- a `Closes` line for an issue already closed.

Resume only on the owner's word.
