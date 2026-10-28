---
name: import
description: "Brings an existing notes folder — another Obsidian vault, a Markdown or text export from a notes app — into this vault through the write gate. A dry run first (a table: source file → page type → destination → reason, unclear ones flagged), the owner approves group by group, then it applies; the source folder is never modified, and originals kept verbatim go to raw/. Use when the owner says \"import my old vault\", \"bring my notes in\", \"migrate my Obsidian notes\", the same in their language, or invokes /import. Not for one document (that is /ingest) and not for evaluating someone else's system design."
argument-hint: "<source folder>"
---

# Import

An old notes folder is worth bringing in for what it knows, and dangerous
for the same reason: copied wholesale, every stale page in it becomes a
page a fresh session reads as current. So an import is not a copy. Each
file is typed by its lifetime and written through the same gate as anything
else (`.agents/write-gate.md`, ADR 0055), on lists the owner approves.

`<skill-dir>` below is the folder this SKILL.md was loaded from. Talk to the
owner, and write pages, in the vault's language (ADR 0059); a source in
another language is rewritten, not translated line by line.

## Ground rules

- **The source is read-only.** Never edit, move, rename or delete anything
  in it — not even its `.obsidian/` settings. If the source is inside this
  vault, stop: it must be a separate folder.
- **Verbatim lives only in `raw/`.** An original kept as it is (a long
  essay, a transcript, an exported article, an attachment that pages refer
  to) is copied to `raw/YYYY-MM-DD_<slug>.<ext>` — the date the file was
  written if the name or frontmatter says, otherwise its modified date — and
  any page drawn from it carries `source: raw/<file>`. Copying into `raw/` is
  the one write there, and it happens because the owner asked for this
  import.
- **Old notes are not current truth.** A claim distilled from the source
  enters a topic page as what the note said, dated, not as fact about now;
  claims about the owner's life, work or projects are confirmed with
  `/truth` after the import, never written into `core/USER.md` or
  `core/MEMORY.md` from the import itself.
- **One subject, one page.** When the vault already has a page on the
  subject, the import merges into it (or closes it, if the import is newer
  and the owner confirms) — never a second page.

## 1. Inventory — read only

```bash
git tag pre-import-<YYYY-MM-DD>
node <skill-dir>/scripts/inventory.mjs "<source>" --out <scratch>/inventory.json
```

`<scratch>` is a folder outside the vault (the runtime's scratch or temp
directory) — nothing of the dry run lands in the vault. The inventory lists
every note and attachment (words, dates, tags, links, embeds) and flags
empty files, ambiguous names and dead links. Tool state (`.obsidian`,
`.git`, `.trash`) is skipped. For a few hundred notes, read them in batches;
for more, read every title and first paragraph, and read in full only what
the table cannot type from that.

## 2. Dry run — the table

For every source file, one row:

| Source file | Type | Destination | Reason |
|---|---|---|---|
| `Projects/Garden.md` | topic (merge) | `notes/garden.md` | the vault already has the subject; adds the soil test results |
| `Daily/2024-03-02.md` | NOOP | — | a day log; nothing still true or worth keeping |
| `Reading/Deep Work.md` | report + raw | `reports/2024-05-10_deep-work-notes.md`, original to `raw/` | dated notes on a book |
| `Ideas/app ideas.md` | owner page? | `notes/app-ideas.md` | the owner's own list — **flag: keep as theirs, or distill?** |

Types follow the gate, in order: something to act on and then done with →
**deliverable** (`outputs/`, usually NOOP for old ones — their moment passed);
a dated reading of the world → **report** (`reports/`); what is true now on a
subject → **topic** (create or merge); a choice and its reasons →
**decision**; a repeatable procedure → **playbook** only if it was used
twice, otherwise a topic; a project → a thin **project** card only if the
project is live, otherwise a line on a topic page or NOOP; the owner's own
voice they want kept as theirs (a journal, a list) → **owner page** (`author:`,
ADR 0060), only when the owner chooses that for the group. **raw only** for
an original kept for reference with no page drawn from it; **NOOP** for
empty, duplicate, template and tool files.

**Flag** every row you cannot type with confidence, every subject that
already has a vault page (run `node scripts/note-neighbours.mjs "<subject>"`
for each candidate topic), every file over ~3,000 words, and every row that
would put a claim about the owner's current life into a page.

Group the rows — by source folder, or by type when folders are mixed —
and show the summary first: counts per type and destination, the flags, the
number of new `notes/` pages (each one is an `INDEX.md` row and must earn
it). Then the table, group by group.

## 3. Approve, group by group

Ask with selectable options per group (the question tool in Claude Code, a
numbered list elsewhere): **apply as proposed**, **apply with changes** (the
owner names rows), **skip this group**. Ask the flags as their own
questions. Ask everything for a group at once, not row by row.

## 4. Apply, group by group

For each approved group:

1. Copy the originals marked raw into `raw/` (byte-for-byte, renamed to the
   raw naming). Attachments go only when a written page embeds them.
2. Write the pages through the write gate: flat YAML frontmatter, a
   `[[wikilink]]` out, `source:` on everything drawn from the source,
   `confidence: low` on reports, nothing verbatim outside `raw/` beyond a
   quoted line where the wording is the point. Rewrite the source's links to
   the new page names; a link to a page not imported becomes plain text.
3. Merge into existing pages instead of creating parallels, and close (gate
   § 4) any vault page the import makes stale — only for claims the owner
   confirmed newer in step 3.
4. `INDEX.md` rows for new `notes/` pages; topic pages list their new
   reports.
5. `node .claude/hooks/checks.mjs`, fix what it reports, then commit the
   group's explicit paths: `import: <group> — <n> pages, <n> merged, <n> raw`.

## 5. Finish

- `node scripts/brain-doctor.mjs` and `node scripts/link-sweep.mjs` (it changes
  no page; its report goes to `logs/`); fix dead links this import made.
- Report: per type, how many files went where; what was NOOP and why in one
  line per reason; the flags the owner decided; the tag to diff against.
- Offer `/truth` — the import added claims nobody has confirmed — and then
  `/truth-test`.
- Session log entry with an `outcome` line (`verification: agent-claimed`
  until the owner has looked at the result).
