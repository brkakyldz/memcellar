---
name: ship
description: Releases a finished, verified repository to GitHub from a template — the agent fills README, LICENSE, CHANGELOG and a CI workflow, then a script runs the preflight (branch, clean tree, the four files, the CHANGELOG entry, tag absent, secret scan), creates a PRIVATE repo with gh only if none exists, pushes without force, tags and publishes the release. Making the repo public happens only on the owner's explicit yes. Use when the owner says "ship it", "put this on GitHub", "cut a release", "release v1.2.0", or the same request in the owner's language. Not for opening a PR on an existing shared repo.
---

# Ship

An agent judging its own way to a release skips steps, and the irreversible
ones — a public repo, a force-push, a tag on the wrong commit — cannot be
taken back. So a release is a script with slots: the agent writes the
content, the script checks it and does the GitHub steps in a fixed order, and
the one step that exposes the work to the world, public visibility, is left
to the owner.

`<skill-dir>` below is the folder this SKILL.md was loaded from.

## 1. What the agent fills

The script refuses to run without these four, committed:

- `README.md` — what it is, a screenshot or diagram when it has a UI, install
  and run from a fresh clone, how it works, configuration, how to run the
  tests, licence. Written for a stranger; links into `docs/` instead of
  repeating it. No status line (status lives in `docs/CURRENT_STATE.md`
  when the repo keeps one, ADR 0045).
- `LICENSE` — MIT from `templates/LICENSE-MIT` unless the project or the
  owner says otherwise. Fill `<year>` and `<copyright holder>` with what the
  owner gives you; never guess a legal name. Copyleft dependencies get their
  notices in `NOTICE`.
- `CHANGELOG.md` — from `templates/CHANGELOG.md`: a
  `## [<version>] - <YYYY-MM-DD>` section with what a user gets. Its body
  becomes the release notes.
- `.github/workflows/ci.yml` — from `templates/ci-node.yml` or
  `templates/ci-python.yml`, with the repo's offline test commands only.
  CI has no secrets: never a paid or live call in it.

Commit them by path with the rest of the release work. The tree must be clean
before the script runs.

## 2. The script

```bash
node <skill-dir>/scripts/ship.mjs --repo <owner>/<name> --version <x.y.z> \
  [--description "..."] [--branch main] [--dry-run]
```

Run it with `--dry-run` first: it does the whole preflight and prints the
plan and the release notes, without calling `gh` or `git push` and without
network. Then run it for real. In order, stopping at the first failure:

1. **Preflight** (every failure listed at once): on `main` or `--branch`;
   tree clean; the four files present; CHANGELOG has a non-empty section
   for the version; tag `v<version>` does not exist; tracked files pass the
   secret scan (private key blocks, cloud and service tokens, `sk-` style
   API keys, long `api_key=` / `secret=` / `token=` values, and any tracked
   `.env` file other than an example).
2. **Repository.** If `origin` points at another repo, stop. If the GitHub
   repo exists and is not this checkout's `origin`, stop — the script never
   pushes into a repo it did not create or that is not already configured.
   If it does not exist: `gh repo create --private --source . --remote origin`.
3. **Push** the branch — never `--force`.
4. **Tag and release.** Annotated tag `v<version>`, pushed; `gh release
   create` with the CHANGELOG section as notes.
5. **Report.** Commit, repo URL, release URL, CI run URL, and — while the
   repo is not public — the visibility-flip command, printed and never run.

A secret-scan hit is fixed at the source: remove the value, rotate it if it
was ever pushed anywhere, and rewrite nothing in history without the owner's
yes. A documented false positive may carry `ship-scan: allow` on its line.

## 3. After the script

Check CI once on the pushed commit (`gh run list --commit <sha>`). A red CI is
fixed with a normal commit and push, never by weakening the workflow. Record
the repo URL, visibility, tag, release URL, CI result and any open owner step
where the repo keeps such things (its STATE or run report), not in chat only.

## 4. What only the owner decides

Ask for each separately, and act only on a clear yes in chat:

- **Making the repo public.** Show the command the script printed and what
  becomes visible (the whole history, every issue). Run it only on the
  owner's yes; otherwise leave it as their step.
- **Any history rewrite** (a leaked secret already committed) — while the
  repo is still private, and with the owner's yes for its force-push.

These stay owner actions — write the command, never run it: renaming,
transferring or deleting a repo or a release, any rewrite or force-push once
the repo is public, and the social preview image (GitHub has no API for it).
A paid plan, a domain or any other spend the release seems to need is stated
with its cost and waits for approval.
