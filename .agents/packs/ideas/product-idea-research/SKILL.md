---
name: product-idea-research
description: Scopes a new product or project idea with the owner BEFORE any research — one round of selectable questions on purpose, budget, focus and deliverable — then runs research bounded by those answers and recommends the option that fits them, with the zero-cost path (the owner's existing agent runtime as the runtime) always on the table. Use when the owner brings a product or project idea and wants it researched, evaluated or turned into a stack — "I want to build something like this", "research this idea", "how would we build this", "which technologies should we use", "give me project ideas" — or the same request in the owner's language, even when they don't ask for questions. Not for a pure topic lookup (research), a no-questions build (software-factory) or auditing an external system against the current one (idea-import).
---

# Product idea research

Research answers only the questions it was given. When the questions are set
before the owner's constraints are known, the report is correct and still
wrong for them. In the reference instance a portfolio project came back with
a paid-API production stack — a hosted model API, two paid search APIs, a
scraping service and a web server — because budget and "who runs it" were
never asked; the free option, the agent runtime the owner already pays for,
surfaced only when the owner named it. This skill puts the questions first
and makes the answers the frame of every later step.

## 1. Intake — ask once, at the start, with options

Before any search, any file read beyond what the question needs, or any
proposal: one round of at most four questions, each with selectable options,
the recommended option first (AskUserQuestion in Claude Code; a numbered list
of options elsewhere). Ask in the owner's language. Skip a question their
message already answers; never re-ask it later. The bank and option wording:
`references/intake.md`.

The four that almost always apply:

1. **Purpose** — portfolio · own use · a product others will use · client work
2. **Budget** — zero (the existing runtime + free sources) · a small monthly
   spend · paid is fine when it is clearly better (each spend still approved)
3. **Focus** — one narrow, measurable piece · a medium slice · a broad platform
4. **Deliverable** — a few short ideas · a research report · stack + plan ·
   start the spikes

Ask a market, scale or data-source question only when it changes the answer
and the four leave it open. Write the answers as a **Constraints** block
(`references/intake.md` § Constraints block) and carry it into every later
step and into the research brief.

If the owner does not know how the domain works today, offer a short primer
first: what people do today, what inputs they give, what they can choose,
what comes out, where it breaks. Ideas built on a process the owner can't
picture get rejected for the wrong reasons.

## 2. Ideas come from outside the owner's notes

When the ask is for ideas, the owner's own notes (the vault in a vault
session, the repo's docs in a project) are read for two things only: what was
already proposed, so it isn't proposed again, and the live context — what
they are building, who for, what they can ship. They are never the source of
candidates: drawing ideas from notes hands the owner's past work back as if
it were new. Candidates come from current outside research and your own
thinking, and must fit the live context. Brief every candidate-generating
leg not to read local files. A candidate that does come from an earlier note
says so next to it.

## 3. Research bounded by the constraints

If the research pack is installed, run `research` with the Constraints block
at the top of the brief; otherwise run the searches directly and write the
same report shape (question, constraints, findings with inline sources and
dates, recommendation). The brief's sub-questions are the ceiling, so these
legs are mandatory whatever the topic:

- **Zero-cost path.** Can this run on the agent runtime the owner already
  has — headless runs on their subscription, its built-in search,
  subagents on the cheap tier, deterministic checks as gates — plus free
  official data and open-source libraries? And what that path cannot do.
  `references/agent-runtime.md`.
- **Paid options only as comparison,** each with a price per unit and per
  month, labelled as a spend, with the date the price was read.
- **Every data source:** its terms (scraping, storing results,
  benchmarking) and whether it can serve as stored evidence or only as
  discovery.
- **How "correct" will be measured:** a ground-truth source or an eval set.

## 4. Recommend inside the constraints

- Lead with the option that fits the Constraints block, and name the
  constraint that decided it. With a zero budget, or for portfolio or own
  use, the default runtime is the owner's existing agent runtime; say when
  the design would have to move to a paid API (serving other people, volume
  beyond subscription limits) and keep the model call behind one function so
  that move touches one file.
- Propose the narrowest version that can be verified first; widen only on
  the owner's word.
- Any spend: state its cost and let the owner choose. They may well prefer
  the better paid option — it is their call, never the default.
- Match the length asked for: "short" means a few lines per idea.
- In a vault session, the report goes through `.agents/write-gate.md` (a
  `report` in `reports/` with `source:`, `confidence: low` and `topic:`). In
  a project, it goes to the repo's research store or `docs/`, never into the
  vault (ADR 0052). The recommendation goes in chat. End with one decision
  for the owner, not a menu.

## Anti-patterns (each one happened)

- Researching first and asking about budget after the stack is written.
- Briefing research legs only on paid APIs, so the free path can't appear.
- A production-grade service stack for a portfolio project nobody asked to
  serve.
- Treating a fetch tool's page summary as evidence: it is a model's answer
  about the page, not the page.
- Offering a broad multi-field system when the owner asked for one narrow,
  checkable piece.
