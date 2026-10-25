---
id: 0060
title: The owner's own pages live in notes/, marked by author:; my-notes/ is retired; Obsidian opens on a home page and hides the history folders
date: 2026-10-25
status: accepted
supersedes: [0037, 0040]
amends: [0055]
related: [0059]
---

# 0060 — The owner's pages live in notes/

## Context

ADR 0037 gave the owner's own notes a folder of their own, and ADR 0040
flattened it into `my-notes/`. The folder did two jobs. It kept the agent's
passes away from what the owner wrote, and it exempted those notes from the
English rule.

Both jobs moved. ADR 0059 retired the English rule, so language no longer
separates the two kinds of page. And the folder boundary protected less than
it seemed: the owner's own pages were missing from every place a reader
looks for a subject, so a topic lived in two places with no link between
them. Meanwhile the owner browses the vault in Obsidian. There, `logs/`,
`archive/` and `raw/` fill search results and the graph with pages that are
history, not the current view.

## Decision

1. **The owner's pages live in `notes/` and carry `author: <owner>`** in
   their frontmatter. The value is the owner's name; the field's presence is
   what marks the page. `type: my-note` is retired; an owner page keeps
   `kind:` and needs no `type:`.
2. **The agent never edits, moves, archives or deletes an owner page** unless
   the owner asks for that change. It reads them freely. `/note` creates or
   appends one when the owner asks. No pass rewrites, distills or closes
   one. The write gate lists one as a neighbour and leaves it alone: a write
   that makes an owner page stale says so in its own page and tells the owner.
3. **A check holds the line.** `owner-pages` (`.claude/hooks/checks.mjs`)
   fires when a changed owner page differs from its committed copy, lost its
   `author:`, or was deleted or moved. When the owner made the edit, the
   finding is noise and they ignore it. When the agent made it, the finding
   catches an edit no one asked for.
4. **Open work has three lists.** The owner's own to-do page, an owner page
   with two sections, "To do" (decided) and "Ideas" (maybe some day), is
   written by the owner only. `PROPOSALS.md` stays the vault's own system
   work. A project's work lives in its repo (ADR 0056).
5. **Obsidian is the owner's browser.** Setup merges `archive/`, `logs/` and
   `raw/` into `userIgnoreFilters` in `.obsidian/app.json`, keeping every
   other setting. One home page in `notes/` links the topic hubs and the
   owner's to-do page. There are no subject folders: folders stay one per
   lifecycle (ADR 0055).

## Rationale

- The boundary that matters is who may write a page, and that is a property
  of the page. A field puts the property where a check can read it. A folder
  only hints at it.
- One subject, one place: an owner page sits next to the topic pages a
  reader already searches.
- History folders are where they belong, but they should not stand between
  the owner and the current view.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep `my-notes/` | Its second reason (language) is gone, and its first is served better by a field and a check |
| Owner pages as `type: topic` | A topic page is the agent's to keep current; an owner page is never kept by the agent |
| Subject folders for Obsidian browsing | Folders by subject are the taxonomy ADR 0055 replaced; a home page gives the same view without moving files |

## Consequences

- `my-notes/`, its README and the `my-note` / `my-entity` templates are
  removed; `.claude/templates/owner-page.md` replaces them.
- `/curator`, `/audit`, the link sweep, the index check and the lifetime
  findings all skip pages with `author:`.
- Upgrading moves every `my-notes/` file into `notes/`, swaps `type: my-note`
  for `author:`, and renames on a filename clash. Tools outside the vault
  that read `my-notes/` paths break. That is the owner's call.
- Cost to reverse: moderate. The move is a `git mv` per file and a
  frontmatter line, scripted either way.
