---
type: playbook
created: 2026-09-02
tags: [lifecycle, curation, memory]
status: active
aliases: [corroboration gate, archiving rules, contradictions, pinning, staleness]
description: What happens to a note or a fact, with rationale — tiers, distillation, maturity, staleness, archive-vs-delete, consolidation and anti-poisoning. How the system changes itself is self-evolution-policy; binding rules live in AGENTS.md.
related: ["[[MEMORY]]", "[[self-evolution-policy]]"]
---

# Lifecycle Policy

Binding rules live in `AGENTS.md`; this playbook holds the *why*. **Scope: what
happens to a note or a fact.** How the *system* changes itself — the
maintenance loop, growth control, the noise budget — is
[[self-evolution-policy]]; the machine they run on is `docs/ARCHITECTURE.md`.
None of the three restates a rule from another. Synthesized from PKM literature
(Ahrens, Matuschak, Forte/PARA, Appleton) and agent-memory research
(MemGPT/Letta, mem0, A-MEM, CoALA), then corrected against the reference
instance actually running it.

## 1. Memory tiers

- **Tier 0 — always loaded**: `IDENTITY.md` + `USER.md` + `MEMORY.md` in a
  vault session only (ADR 0052). Budgets (ADR 0030): `USER.md` 2000
  characters, `MEMORY.md` 4000; `IDENTITY.md` is a 40-line convention.
  Pointers, never detail. The budget protects loading itself — past roughly
  10KB of payload the harness is *believed* to stop inlining Tier 0, a
  hypothesis the hook logs its measured size against on every run.
- **Tier 1 — on demand**: `notes/` and `reports/`, through `INDEX.md`,
  pointers and `grep`; a ranker was tried and dropped, unused (ADR 0057).
- **Tier 2 — episodic**: `logs/`, append-only, distilled upward then archived.

## 2. Cognitive types, different lifecycles

| Type | Lives in | Write mode | End of life |
|---|---|---|---|
| Episodic (what happened) | `logs/` | append-only | distill → archive |
| Semantic (what is true now) | `MEMORY.md`, `notes/` (`topic`, `decision`, `project`) | reconcile on write | supersede, then archive |
| Semantic, dated (what was known then) | `reports/` | write-once | ages by its date; archived with its topic page |
| Deliverable (to act on, then done) | `outputs/` | written for one task | `expires:`, then archive |
| Procedural (how we work) | `notes/` (`playbook`), skills | deliberate revision only | replace whole sections, never casual append |

- Logs older than 30 days: distill durable facts into notes, then move the
  original to `archive/` — flat, no subfolder (ADR 0028). Curator step.
- Playbooks are capped at ~150 lines each; if one outgrows that, split it.
- **Why a page is typed by its lifetime** (ADR 0055): with one type, one-day
  lists and dated research kept answering weeks after they stopped being
  true. Now only the topic page claims to be current.
- **The playbook gate runs both ways.** Promotion takes ≥2 verified successful
  uses (`AGENTS.md`). Two recorded failed or abandoned uses since the last
  success send a playbook back: demote it to `type: topic` with `updated:`,
  `status: growing`, leave the file where it is, and log the demotion.

## 3. Distillation

There is no capture queue, on purpose. Two paths lead into the memory store and
both end in distillation: **live distillation inside a session** — something is
said, the note is written then and there — and **`/ingest` of a source** the
owner saved into `raw/` (ADR 0035). Nothing is queued for a later pass that
never comes. Two rules are load-bearing:

- **Nothing enters `notes/` verbatim.** A thought is rewritten in original
  wording, merged into an existing note, or linked into the graph. Unprocessed
  clips are the collector's fallacy, however they arrive.
- **Every write passes the write gate** (`.agents/write-gate.md`). It closes
  stale neighbours in the same commit because only the writer knows, at that
  moment, what changed; a later pass sees a pile.

## 4. Topic-page maturity

- `status` ladder: `seedling → growing → evergreen`, promoted **only when a
  human or a pass actually rewrites the note** — never on a timer, and never
  from an access count. Being read is not maturing, and nothing here counts
  reads any more (ADR 0039).
- Every new note gets **≥1 outbound wikilink before it is closed** — the
  highest-leverage rule against orphan graveyards. **One exception, at capture
  time only:** a `notes/lesson-*.md` links only when an obviously-related note
  already exists (`/lesson`, ADR 0048). Choosing what a fresh mistake relates
  to is interpretation, and ADR 0019 keeps interpretation out of capture; the
  link arrives with corroboration or not at all.
- Atomicity gate for `evergreen`: one idea, cleanly nameable, understandable
  with zero context, nothing removable. Split a note that fails it.
- Orphans are structural waste, but the audit only **reports** them. Never
  manufacture a link to clear the count — a forced link is the documented PKM
  anti-pattern.

## 5. Staleness — domain-dependent, not universal

- **Verify before relying, whatever the date.** A claim about a tool, version,
  API, price or product behaviour is checked against its source at the moment
  something depends on it. Twelve months was never a freshness guarantee — an
  API can move in a week — and a `review_by` a year out mostly reassures.
- `review_by:` stays optional, for decay that is genuinely predictable.
  Nothing schedules a review: an overdue date is something a reader notices.
- The type carries most of the staleness signal: expired deliverables, topic
  pages behind their reports or untouched for 90 days, and unlinked reports
  are counted at session start and closed by `/curator` on the owner's yes.
- Stable content (concepts, principles, reflection): no trigger at all.
- Correction memories are re-challenged after ~90 days; corrections that stack
  without expiry end up contradicting each other.

## 6. Archive vs delete

- **Archive is the default** — searchable, out of active views; git keeps the
  record either way.
- Deletion is allowed in exactly two cases: exact duplicates within one file,
  and a note that is simultaneously unlinked, fully superseded, and not
  load-bearing anywhere — proposed by the curator, executed only after the
  owner approves.
- Rationale: "never delete" is unbounded noise, free deletion loses
  load-bearing context; the conditions plus approval are the middle.

## 7. Consolidation contract (curator)

- **Runs when the owner starts it** (ADR 0033), never on every write and never
  on a clock. The session start may say it is due (ADR 0049); it still runs
  only on the owner's yes.
- Per candidate fact, exactly one decision: **ADD / MERGE / SUPERSEDE / NARROW
  / NOOP**, never blind append; before ADD, list the neighbours. NARROW
  shrinks a fact to what its source actually supports — a hedge or a date
  the rewrite lost, or a claim stated more firmly than its evidence.
- On contradiction **newer evidence wins and the override is logged** in the
  surviving note or session log — supersession is visible, never silent.
- **A reversal rewrites the head.** When a correction reverses a note's stance,
  rewrite its TL;DR or top line to the new view and move the old one under a
  visible "Superseded" heading. A correct body under a stale TL;DR gave a wrong
  end-to-end answer in the reference instance.
- Safe operations (merge duplicates, fix pointers, distill logs) are applied
  directly; destructive or structural ones are reported in the conversation and
  left to the owner. No queue is opened for them (ADR 0038).

## 8. Anti-poisoning guardrails

- Provenance: facts from untrusted external content carry `source:` forever,
  through every merge and move, and never enter `USER.md` or `IDENTITY.md`.
  A merge preserves each fact's source, date, scope and uncertainty; a newer
  line does not outrank an older one merely for being newer.
- Corroboration gate: a fact seen once enters the vault in a report at
  `confidence: low` and reaches `MEMORY.md` only on a **second independent
  source** — independence being a property of the source, not a count of
  sessions. Re-reading one summary is one observation seen twice (ADR 0038).
- Protected files: `IDENTITY.md` and `AGENTS.md` are never edited by an
  automated pass — agents propose a diff, the owner applies it. **A
  convention, not a security boundary**: the clients carry no path deny-rule
  for either, and a shell command writes any file whatever the Write/Edit
  permissions say. It holds because the agent follows `AGENTS.md`.
- Pinning: `pinned: true` exempts a fact from demotion, capped at 10
  vault-wide. The quarterly re-justification went with the calendar (ADR
  0033); the cap stays in case pins start being used.
