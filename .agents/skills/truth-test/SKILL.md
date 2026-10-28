---
name: truth-test
description: Checks whether a fresh session answers from what is true now — asks the questions of an answer key kept outside notes/ (.claude/eval/truth-questions.md) on a scratch clone of the vault with the key removed, each in a fresh headless session with read-only tools, then scores every answer as correct, stale or wrong and names the pages behind each stale answer. Never runs against the live vault; shows its cost and waits for a yes before running. Use after /truth, after a large cleanup or import, when the owner says "test the vault", "does it still answer right", "run the answer test", the same in their language, or invokes /truth-test.
argument-hint: "[--only Q1,Q4] [--runtime claude|codex]"
---

# Truth test

Whether the vault works is a question about answers, not about pages: a
fresh session, asked something whose answer the owner has confirmed, either
says what is true now or says what used to be. This skill measures that, and
its most useful output is the list of pages that made an answer stale.

`<skill-dir>` below is the folder this SKILL.md was loaded from. Talk to the
owner in the vault's language.

## The answer key

`.claude/eval/truth-questions.md` — outside `notes/`, so no session in the
vault ever reads its own answer key (`docs/ARCHITECTURE.md` § 4). `/truth`
offers to write it; the owner can write or edit it by hand. Format:

```markdown
# Truth questions

## Q1 — current role
- question: What does the owner do for work right now?
- expected: <the confirmed answer, short>
- trap: yes — old career pages say <the stale answer>

## Q2 — main project
- question: Which project is the owner focused on this month?
- expected: <...>
```

- Ask the way the owner would ask a fresh session — natural wording, no page
  names, no hint at the answer.
- `expected` is the confirmed fact, with the detail that separates right
  from stale (the new employer, not just "a job").
- **trap** marks a question that stale pages used to answer wrongly, with
  what they said. Traps are the point: a test that only asks what was never
  wrong measures nothing.
- 10–20 questions. Change the key only from a confirmed truth (`/truth`, or
  the owner saying so) — never to make a failing answer pass.

## Steps

1. **Plan and cost — before anything runs.**
   `node <skill-dir>/scripts/run.mjs --dry-run` lists the questions and
   estimates the cost from the last run's measured cost per question (or says
   it is unknown on a first run). Tell the owner: the number of questions,
   that each is one fresh headless session on the runtime's default model
   reading the vault, the estimate — and that on a subscription it counts
   against usage limits rather than money. A first run with no measurement:
   give a range from the runtime's pricing and run one question first
   (`--only Q1`) to measure. **Run only after the owner says yes.**
2. **Run.** `node <skill-dir>/scripts/run.mjs` (add `--runtime codex` to ask
   through Codex; `--model <name>` only if the owner wants a model other than
   their default). It clones the vault's **committed** state into a scratch
   folder, deletes `.claude/eval/` from the clone, and asks each question in a
   fresh session in the clone with read-only tools (read, search) and no MCP
   servers. Answers, the files each session read, and the cost the runtime
   reported land in `<out>/answers.md` and `answers.json`. The live vault is
   only read. Uncommitted changes are not tested — the script says so; commit
   first if they matter.
3. **Score** each answer against `expected`, one of:
   - **correct** — states the confirmed fact (wording may differ);
   - **stale** — states what used to be true (the trap answer, or any older
     state the vault once held);
   - **wrong** — states something that was never true, or "I don't know"
     when the vault holds the answer.
   Judge the claim, not the style. An answer that gives the current fact and
   also mentions the old one *as old* is correct; one that hedges between
   them is stale.
4. **Trace every stale or wrong answer** to the pages that caused it: of the
   files that session read, which ones state the old fact? Open them and
   quote the line. A page that is the cause gets a recommendation — close it
   (`valid_to` + `superseded_by` + a visible first line, per
   `.agents/write-gate.md` § 4), fix it, archive it, or fix a pointer line in
   `core/MEMORY.md`. Owner pages (`author:`) are reported, never changed.
   Nothing is changed in this skill; the fixes are the owner's to approve,
   then done in a normal session (or a `/truth` re-run).
5. **Record** the result in `.claude/eval/results/YYYY-MM-DD.json` (copy
   `answers.json` and add each answer's `score` and `cause` pages) and
   `YYYY-MM-DD.md`: the score line (`12/15 correct, 2 stale, 1 wrong; traps
   9/11`), one row per question, and the cause-page list. The JSON keeps the
   cost per question that the next dry run estimates from. Commit those two
   files only. `/audit` names the latest result.
6. **Report** in chat: the score, every stale answer with its cause pages,
   the recommended fixes, and the scratch folder (the owner may delete it).

## Rules

- Never run against the live vault, never let a test session write anywhere,
  never put the key inside `notes/`.
- No run without the owner's yes to the cost.
- A failed session (error, timeout) is counted as **not run**, never as
  wrong or correct; say how many.
- The Claude Code path reports cost and files read. The Codex path follows
  `codex exec`'s documented flags, reports the answer only, and was not
  exercised in the reference instance — say so when it is used.
