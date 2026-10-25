---
name: note
description: Writes an owner page — a page in notes/ marked author:, written only on the owner's explicit request, in their own words, and never edited by the agent afterwards unless they ask. Use when the owner says "note this", "write this down properly", "add it to my notes", the same in any language, or invokes /note.
---

# Note

Writes what the owner asked to be written down into an **owner page**: a page
in `notes/` whose frontmatter carries `author:`. Owner pages sit next to the
topic pages, and no pass ever rewrites them. Decision: ADR 0060
(`docs/DECISIONS.md`); template: `.claude/templates/owner-page.md`.

## Trigger — explicit request only

Fires **only** on a direct instruction: "note this", "write this down
properly", "add it to my notes", "take a note", `/note <content>` — or the
same in the owner's own language. An owner who always phrases it one way may
add that phrase to this description.

Never fires on inference. An interesting finding, a decision made in passing,
a fact worth remembering — none of those are triggers. Those go through the
write gate (`.agents/write-gate.md`) into a topic page, a report or a
deliverable. If it's ambiguous whether the owner wants a note or is just
talking, **ask in one line** rather than writing.

## What gets written

The scope is **what the owner just said**, not the surrounding session. If
they say "note that" after a long exchange, ask which part unless it is
obvious.

## Steps

1. **Pick the `kind:`.** There is no folder to choose, only what the page
   *is*. One question decides it: *what you return to by name gets its own
   page; a thought goes to a topic page of the owner's.*

   | If it is… | `kind:` |
   |---|---|
   | a person, company, place or tool — something returned to by name | `person`, `org`, `place`, `tool` |
   | the owner's own thinking about a live project | `project` |
   | a detailed named idea — one idea per page | `idea` |
   | course notes, a concept write-up, vocabulary | `course`, `concept`, `vocab` |
   | a personal decision or cost analysis | `decision` |
   | a goal, a habit, a to-do list | `goal`, `habit`, `todo` |

   If it fits nowhere, use the closest honest value and tell the owner in one
   line. Do **not** invent a new `kind:` — `AGENTS.md`'s growth control needs
   a real miss, and one note is not one.

   A to-do or an idea for "some day" goes on the owner's to-do page (the one
   the home page links), under "To do" or "Ideas" — not on a page of its own.

2. **Find an existing owner page.**
   ```
   grep -l "^author:" notes/*.md
   ```
   Match on meaning, not string similarity.

   - *Entities and detailed named ideas:* one page per thing, named after the
     thing (`jane-doe.md`, `acme-corp.md`). A second note about the same
     person appends to that page.
   - *Everything else:* one page per topic, and a second note on the topic
     appends as a new dated `##` section.

3. **Guard the filename.** Filenames are unique vault-wide:
   ```
   ls notes/ reports/ outputs/ | grep -i "<slug>"
   ```
   An owner page must never take a topic page's name — two `search-agent.md`
   files break every `[[search-agent]]` link. Give it a free name
   (`search-agent-thoughts.md`) and link the topic page in its first line.

4. **Append or create.**
   - *Existing page:* append at the end and bump `updated:`. For a topic page
     of the owner's that is a new `## YYYY-MM-DD` section; for an entity it
     is a line under `## History` or a new subsection. Never rewrite the
     earlier sections. This is the one edit to an owner page the agent may
     make, because the owner just asked for it.
   - *New page:* copy `.claude/templates/owner-page.md` and fill it in.

5. **Link out instead of embedding.** If what the owner said is *about* a
   person, company or idea, it goes in that thing's own page. If it merely
   *mentions* one, link it when the page exists and leave the name as plain
   text when it doesn't. Names that will never be returned to individually —
   a staff roster, a list of attendees — stay as a table inside the org's
   page.

6. **Write it cleaned up, not reinterpreted.** Fix the sentences, add headings
   and bullets where the content has real structure. Do **not** add
   conclusions, implications, opinions, or a "what this means" section the
   owner didn't say. Keep it in the language the owner said it in.

7. **Mark who wrote what.** In any page that carries both:
   - Research-derived content gets `source:` in the frontmatter and a date in
     the text, and is treated as perishable.
   - Anything only the owner can know — how close a relationship actually is,
     whether an idea still excites them — is written as a
     `> Owner, YYYY-MM-DD:` blockquote (or the owner's name) and is **never
     rewritten**, only appended to.

   For a person, never infer the relationship from public information. Ask.
   (In the reference instance a relationship inferred this way was wrong
   twice.)

8. **Frontmatter.** `author:` (the owner's name — always; it is what makes
   the page the owner's), `kind` (from step 1), `created` (first write, never
   changed), `updated` (this write), `tags` (2–4, lowercase kebab-case),
   `related` (optional `[[wikilinks]]`). No `type:` and no `status:` — the
   agent keeps neither current here.
   Entity pages may add `org`, `role`, `relationship`, `last_contact`,
   `source`, `aliases`. Aliases are encouraged on entities — a nickname or an
   honorific is how a query will actually be typed.
   The ≥1-outbound-wikilink rule does not apply; link only when a genuinely
   related page exists.

9. **Run the checks before the commit.** `node .claude/hooks/checks.mjs`
   reports `owner-page-edited` for the page you appended to. That finding is
   expected here, because the owner asked; any other owner page in the list
   is an edit no one asked for, so undo it.

10. **Confirm in one line**, in the owner's language — the page and whether it
    was created or appended, e.g. "Created notes/jane-doe.md (kind: person)."

## Standing rules

- **Nothing else writes an owner page.** `/curator`, `/audit`, `/file`,
  `/ingest` and the write gate read them and never edit, move, archive or
  delete one. A write that makes one stale says so in its own page and tells
  the owner.
- **Edits only on request.** Reading is free; changing an existing owner page
  happens only when the owner asks for that specific change.
- **`MEMORY.md` is not updated from this.** An owner page is not a
  durable-fact promotion — if a fact from it belongs in `MEMORY.md`, that goes
  through the normal corroboration gate in `AGENTS.md`.
