---
id: 0058
title: The template is built first and tested on the reference instance; the two-week bar is retired
date: 2026-10-24
status: accepted
amends: [0015, 0029, 0036, 0046]
related: [0055, 0056, 0057]
---

# 0058 — Template first, no two-week bar

## Context

ADR 0015 made the reference instance lead. A change lived there first, and
the template took it in batches only after it had survived two weeks of use.
ADRs 0036 and 0046 then waived the bar for two releases in a row because the
owner asked for the system as it ran that day. A rule waived every time it
applies is no longer a rule.

The v1.3 change set inverted the flow in practice. It was designed and built
in the template, on its own branch. It was tested against a copy of the
reference instance: a dry run of the new types on every note, and an answer
test on a clone. Only then did it move to the live vault, behind a git tag.
This kept the owner's working vault untouched while the design was still
moving, and git made the fallback one command.

## Decision

1. **New machinery is built in the template, on a branch.** The reference
   instance is the test bed. Checks run against a copy or a clone, never
   against the live vault.
2. **It moves to the live vault right after its checks pass**, behind a tag
   (`pre-<change>-<date>`). The live vault never waits two weeks.
3. **Content stays private.** What the template ships is machinery, contracts
   and generalized records; the instance's notes, figures and names never
   enter it (ADR 0006 stands).

## Rationale

- The bar was meant to catch changes that looked good and failed in use.
  The checks catch that earlier: a dry run over real notes, tests written
  from failures seen in real use, an answer test before and after.
- Building in the template keeps the experiment away from the files the owner
  works in every day.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep the bar, keep waiving it | A rule waived on every release only adds an ADR per release |
| Build in the live vault, back-port later | It mixes half-built machinery into the working vault, and back-porting it is work done twice |

## Consequences

- `docs/UPGRADING.md` stops describing releases as "younger than the bar".
- A change that fails in use after it moved is reverted with the tag, and the
  failure becomes a test.
- Cost to reverse: low. It changes the order of work; nothing depends on it.
