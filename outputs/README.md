# outputs/ — deliverables, kept for as long as they are used

A deliverable is something made for the owner to act on and then be done
with: a list of listings, a set of candidate ideas, a draft, an inventory, a
study plan for one week (ADR 0055). Its value is in its form, and it stops
being useful when the task is over. It is not memory.

- **Name:** `YYYY-MM-DD_<slug>.<ext>`, flat. Any format — Markdown, CSV, HTML.
- **Frontmatter (Markdown only):** `type: deliverable`, `created:`,
  `expires:` (30 days after `created:` unless the owner wants it longer),
  `for:` (what it is used for), `topic: "[[subject]]"`.
  Template: `.claude/templates/deliverable.md`.
- **What survives goes up, not here.** A fact inside a deliverable that will
  still matter after it expires is written as a line on its topic page.
- **Expiry.** Past `expires:`, `/curator` proposes moving it to `archive/`; the
  owner may extend it instead. Nothing here is deleted.
- **Not in `INDEX.md`**, and never a source for `MEMORY.md`.
