# Launch prompt

PREPARE emits this with every `<slot>` resolved; a leftover slot becomes a
question, and a run that asks never starts. Keep the capitals and "do not
ask": runs launched without them stopped to ask anyway. Write the prompt in
English or in the owner's language — the agent reads either — but keep the
slots' values exact (paths, IDs, commands).

`<write scope>` is the run's fence: the paths the run may change, usually
"everything in <worktree path> except tests/acceptance/holdout/", narrower when
the plan names the milestone's paths. `<live allowance>` is `none` unless the
owner approved a bucket, with its cost, for this run.

```text
This is an UNATTENDED MULTI-MILESTONE RUN of <plan path>: <M_a … M_b>, all of
them, in order, in this one session, in <worktree path> on branch run/<slug>.
I am not at the keyboard and will not answer anything. Do not ask questions.
Do not stop between milestones.

Use the unattended-run skill, phase RUN. Read AGENTS.md, docs/CURRENT_STATE.md,
git log --oneline -15 and <plan section> first. Do not report back before
<M_b> is committed or a stop condition holds.

Per milestone: re-anchor → refresh its plan section against the code (the
how only, never the acceptance) → implement → focused check → full offline
gate → <acceptance command> → self-review → before the commit, the full
offline gate green, the held-out lock check passing and the fence holding →
one commit with code, STATE and the run report, its subject
"<M> PASS: <result>" → slice-reviewer on it → next milestone. Never record a
check you did not run.

Write scope (the fence): <write scope>. Nothing outside it is changed or
committed; before each commit, `git diff --cached --name-only` must stay
inside it.

tests/acceptance/holdout/ was written by an independent author: run it, read
it, never edit it; a failing scenario is fixed in the product, a wrong one is
an Open gate (unreliable-oracle). Live checks: <live allowance>. No paid call
beyond that allowance, ever.

Stop only for: a failed check you cannot fix; a blocker whose dependents block
every remaining milestone; a contract change; or the plan's stop after <M_b>:
"<quoted sentence>". Anything else — a missing input, an owner judgement
(<IDs>), a live check without budget — becomes an assumption, an Open gate or
BLOCKED(<type>), and you keep building. A gate only I can close is OPEN_GATE.

Never push, never merge, never write outside <worktree path>. End with
/closeout. Your last message, in <owner's language>, comes from the run
report: what was built, what <most consequential check> actually found, every
assumption, every open gate. Then stop — do not start <next milestone>.
```
