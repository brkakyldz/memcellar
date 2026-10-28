---
id: 0061
title: The next public release is v2.0 — v1.2, the v1.3 change set, skill packs and three new skills ship together
date: 2026-10-28
status: accepted
amends: [0058]
related: [0036, 0046, 0055, 0056, 0057, 0058, 0059, 0060]
---

# 0061 — The next release is v2.0

## Context

The last published release is v1.1. Since then two change sets were built
and never published: v1.2 (lessons as topic files, maintenance on yes, one
fact one home, projects walled off) and the v1.3 set of ADRs 0055–0060 (page
types and the write gate, three homes, the retrieval machinery retired, the
owner's language, owner pages). Both were tested on a copy of the reference
instance and moved into it.

While v1.3 was being prepared for release, the owner chose to widen it:
skills that the reference instance uses in every kind of project — research,
the build and review chain, release, idea scoping — are to ship with the
template as optional packs, generalized for any user, together with three new
skills drawn from the instance's own cleanup.

Publishing v1.3 first and the packs later would make every user upgrade twice
and keep upgrade instructions for two versions nobody ran. Together the
change set is also larger than a minor version: folders, page types, the
lookup path and the default skill set all change.

## Decision

1. **The next public release is v2.0.** No v1.2 or v1.3 is published. Work
   stays on its branch until the whole v2 set is built and tested, then ships
   in one release.
2. **v2 contains:**
   - v1.2 and the v1.3 change set (ADRs 0055–0060);
   - **optional skill packs**, installed only on request
     (`node install.mjs --pack <name>`), each linked into the user-level skills
     folder like `--link-global-skills`: `research`, `build`, `release`,
     `ideas`;
   - **three new skills**: `/truth` (collect what is true now from the owner
     with selectable options and close the pages that contradict it),
     `/truth-test` (an answer key run on a clone of the vault), `/import`
     (bring an existing notes folder in through the write gate).
3. **A pack skill is written for any user.** No owner names, no machine
   paths, no model names (a capable tier and a cheap tier instead), the
   owner's language, both runtimes. A pack skill has one source, this
   template; a user who keeps their own kit links it there, never copies it.
4. **Version references move at release time, in one step.** Until then the
   docs may say v1.3; the release commit renames them to v2 and rewrites
   `docs/UPGRADING.md` as one path, "Upgrading from v1.1 to v2", because
   nobody ran v1.2 or v1.3.

## Rationale

- One upgrade instead of two, and an upgrade guide that only describes
  versions someone actually ran.
- A user who installs the template gets the system the reference instance
  works with, not a vault without the tools that fill it.
- Optional packs keep the default install as small as before.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Publish v1.3 now, packs as v1.4 | Two upgrades, and two upgrade guides, for one design |
| Ship the packs in the default install | A user who only wants the vault gets a project toolchain they did not ask for |
| Point users at the owner's own kit | It is private and written for one person |

## Consequences

- The local `v1.2` tag is dropped; the tags that ship are `v2.0` and the
  existing `v1.0`, `v1.1`.
- Release work at the end: rename v1.3 references, one upgrade path from v1.1,
  README, tag `v2.0`, fast-forward `main`, push — on the owner's approval.
- Cost to reverse: low until publishing. Afterwards a version number cannot be
  taken back.
