---
name: note
description: Writes a note into my-notes/ — the owner's own notes folder, written only on their explicit request and in their own language. Use when the owner says "note this", "write this down properly", "add it to my-notes", the same in any language, or invokes /note.
---

# Note

Writes what the owner asked to be written down into `my-notes/`, the one
folder no automated pass touches. Folder contract and `kind:` table:
`my-notes/README.md`. Decisions: ADR 0037, amended by ADR 0040
(`docs/DECISIONS.md`).

## Trigger — explicit request only

Fires **only** on a direct instruction: "note this", "write this down
properly", "add it to my-notes", "take a note", `/note <content>` — or the
same in the owner's own language. An owner who always phrases it one way may
add that phrase to this description.

Never fires on inference. An interesting finding, a decision made in passing,
a fact worth remembering — none of those are triggers. Those are distilled
straight into `notes/` during the session. If it's ambiguous whether the owner
wants a note or is just talking, **ask in one line** rather than writing.

## What gets written

The scope is **what the owner just said**, not the surrounding session. If
they say "note that" after a long exchange, ask which part unless it is
obvious.

## Steps

1. **Pick the `kind:`.** `my-notes/` is flat — there is no folder to choose,
   only what the file *is*. One question decides it: *what you return to by
   name gets its own file; a thought goes to a topic note.*

   | If it is… | `kind:` |
   |---|---|
   | a person, company, place or tool — something returned to by name | `person`, `org`, `place`, `tool` |
   | the owner's own thinking about a live project | `project` |
   | a detailed named idea — one idea per file | `idea` |
   | course notes, a concept write-up, vocabulary | `course`, `concept`, `vocab` |
   | a personal decision or cost analysis | `decision` |
   | a goal, a habit, a to-do list | `goal`, `habit`, `todo` |

   If it fits nowhere, use the closest honest value and tell the owner in one
   line. Do **not** invent a new `kind:` — `AGENTS.md`'s growth control needs
   a real miss, and one note is not one. Do not create a subfolder either:
   ADR 0040 keeps this folder flat on purpose.

2. **Check for an existing file.**
   ```
   ls my-notes/
   ```
   Match on meaning, not string similarity.

   - *Entities and detailed named ideas:* one file per thing, named after the
     thing (`jane-doe.md`, `acme-corp.md`). A second note about the same
     person appends to that file.
   - *Everything else:* one file per topic, and a second note on the topic
     appends as a new dated `##` section.

3. **Guard the filename.** Filenames are unique vault-wide. Before creating,
   check the name is free everywhere, not just in `my-notes/`:
   ```
   ls notes/ my-notes/ | grep -i "<slug>"
   ```
   A personal project note must never take its `notes/` twin's name — two
   `search-agent.md` files break every `[[search-agent]]` link in the vault.
   Give it a free name (`search-agent-thoughts.md`) and link the twin in its
   first line.

4. **Append or create.**
   - *Existing file:* append at the end and bump `updated:`. For a topic note
     that is a new `## YYYY-MM-DD` section; for an entity it is a line under
     `## History` or a new subsection. Never rewrite the earlier sections.
   - *New file:* copy `.claude/templates/my-entity.md` for an entity, or
     `.claude/templates/my-note.md` for everything else, and fill it in.

5. **Link out instead of embedding.** If what the owner said is *about* a
   person, company or idea, it goes in that thing's own file. If it merely
   *mentions* one, link it when the file exists and leave the name as plain
   text when it doesn't. Names that will never be returned to individually —
   a staff roster, a list of attendees — stay as a table inside the org's
   file.

6. **Write it cleaned up, not reinterpreted.** Fix the sentences, add headings
   and bullets where the content has real structure. Do **not** add
   conclusions, implications, opinions, or a "what this means" section the
   owner didn't say. Keep it in the language the owner said it in — this
   folder is exempt from the English rule in `core/IDENTITY.md`. Field names
   stay English.

7. **Mark who wrote what.** In any file that carries both:
   - Research-derived content gets `source:` in the frontmatter and a date in
     the text, and is treated as perishable.
   - Anything only the owner can know — how close a relationship actually is,
     whether an idea still excites them — is written as a
     `> Owner, YYYY-MM-DD:` blockquote (or the owner's name) and is **never
     rewritten**, only appended to.

   For a person, never infer the relationship from public information. Ask.
   (In the reference instance a relationship inferred this way was wrong
   twice.)

8. **Frontmatter.** `type: my-note` (always — it means "the owner wrote it"),
   `kind` (from step 1), `created` (first write, never changed), `updated`
   (this write), `tags` (2–4, lowercase kebab-case), `related` (optional
   `[[wikilinks]]`). No `status:` — nothing here matures.
   Entity files may add `org`, `role`, `relationship`, `last_contact`,
   `source`, `aliases`. Aliases in the owner's language are encouraged on
   entities — a nickname or an honorific is how a query will actually be
   typed.
   The ≥1-outbound-wikilink rule does not apply; link only when a genuinely
   related note exists.

9. **Confirm in one line**, in the owner's language — the file and whether it
   was created or appended, e.g. "Created my-notes/jane-doe.md (kind: person)."

## Standing rules

- **Nothing else writes here.** `/curator` and `/audit` skip `my-notes/`.
  Files here are never distilled into `notes/`, never archived, never deleted
  by an agent.
- **Edits only on request.** Reading is free; changing an existing note here
  happens only when the owner asks for that specific change.
- **`MEMORY.md` is not updated from this.** A note landing here is not a
  durable-fact promotion — if a fact from it belongs in `MEMORY.md`, that goes
  through the normal corroboration gate in `AGENTS.md`.
