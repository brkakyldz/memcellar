# reports/ — dated readings of the world

A report is a set of sourced claims as of one date: a research run, a
comparison, an audit, a reading of a market or a tool (ADR 0055). It is
written once and never kept current — that is what makes it trustworthy as
"what was known then".

- **Name:** `YYYY-MM-DD_<slug>.md`, flat, no subfolders.
- **Frontmatter:** `type: report`, `created:`, `confidence: low`, `source:`
  (every URL or file it rests on), `topic: "[[subject]]"` — the living page it
  feeds. Template: `.claude/templates/report.md`.
- **Write-once.** After its day, the only edit ever made is a first line
  `> **Superseded YYYY-MM-DD** by [[newer-report]]`. A subject may gather many
  reports; a newer one supersedes an older one, and both stay.
- **The topic page carries the conclusion.** The report's one or two lines
  that change what is true now go to its topic page in `notes/`, with a link
  here. A report nobody links is a finding for `/curator`.
- **Not in `INDEX.md`** row by row; the topic page lists its reports.
- Old reports are not archived for age — their date already says how old they
  are. They move to `archive/` only when their topic page is archived.
