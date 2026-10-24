# Decision index

The hooks, skills and scripts in this repo carry `ADR NNNN` references in their
comments. This is what those numbers mean.

They are real decisions from the reference instance — the private vault this
template is derived from — kept as-is rather than scrubbed, because a comment
that says *why* a line exists is worth more than a tidy one that doesn't. Where
a decision was later reversed, the reversal is in this table too; that is the
point of keeping the numbers.

**Where the full records live.** For 0001–0044 this table is the whole of what
ships: the full records stay in the reference instance. From 0045 on, the full
record of every decision that shapes the template ships beside this index as
`docs/decisions/NNNN-<slug>.md` (rows marked *reference instance only* have
none),
generalized — the reasoning is kept, the names and figures of the reference
instance's projects are not. The status column carries the relations the
records themselves declare: `superseded by` for a row replaced outright,
`amended by` for every later decision that names it in its `amends:` list.
An annotation in *italics* says what a later decision changed without
recording it as an amendment, or where the template differs from the
reference instance.

You inherit the outcomes, not the obligations. Nothing here binds your vault —
but if you're about to change something a number is attached to, this table
tells you what it was protecting.

| # | status | decision |
|---|---|---|
| 0001 | amended by 0010 | Git is the only database — no SQLite, no vector store, no server |
| 0002 | amended by 0035 | Vault-native Markdown is canonical memory; the assistant's built-in auto-memory stays local scratch |
| 0003 | amended by 0030 | Five-way memory split with hard size budgets that fail loudly |
| 0004 | amended by 0011, 0027 | Automation via SessionStart/Stop/SessionEnd/PreCompact hooks, in fail-open Node scripts *(since 0042 and 0044 only SessionStart remains)* |
| 0005 | superseded by 0034 | Mobile is read + quick-capture only; no mobile git write parity |
| 0006 | accepted | Two repositories — public template, private personal brain. Personal data never enters the public one |
| 0007 | amended by 0029 | Agent-first installation — the agent installs the brain from the repo link |
| 0008 | superseded by 0042 | Global brain mode — hooks live at user level, the brain follows you into every project *(the global SessionStart survived in 0042/0044; since 0052 it does nothing outside the vault)* |
| 0009 | amended by 0029 | The installer offers global mode as the recommended choice *(no longer offered since 0052)* |
| 0010 | superseded by 0018 | Hybrid retrieval as a derived index — lexical first, vectors on a named trigger |
| 0011 | amended by 0019, 0024, 0039 | Enforcement-first memory gates — scoped PreToolUse denial alongside fail-open automation *(the template wires no PreToolUse gate; see 0023)* |
| 0012 | amended by 0019 | A write rubric, independent corroboration, delta-only curation |
| 0013 | amended by 0019 | Self-improvement flywheel on manufactured feedback; survival replaces acceptance as the outcome anchor *(the `/flywheel` pass itself was retired by 0038)* |
| 0014 | amended by 0042 | Hooks are gated on an explicit vault activation marker — a fresh clone is inert |
| 0015 | amended by 0029, 0036, 0046 | The vault is a personal tool first; this template is updated in batches, behind a two-week bar |
| 0016 | amended by 0028 | The working record lives in the private vault, not the template |
| 0017 | amended by 0028 | The reporting contract is a global standard, not a vault-local habit *(reference instance only — the template ships no reporting contract)* |
| 0018 | amended by 0024 | Retrieval is lexical + links + conventions; a retrieval-failure ledger is the only trigger to revisit it |
| 0019 | amended by 0022, 0023, 0026, 0038, 0048 | The flywheel is capture → corroborate → enforce-or-retire; the escalation ladder is the mechanism |
| 0020 | amended by 0024, 0025, 0026, 0027, 0032 | One append-only signal ledger plus a machine-written session trace *(the session trace went with 0038; the ledger stays)* |
| 0021 | amended by 0033 | No off-site git bundle job — the local clone plus the remote are the backup |
| 0022 | accepted | Seed checks compile standing conventions into enforced rules *(since 0042 no hook runs them; `node .claude/hooks/checks.mjs` runs them by hand, and `scripts/maintenance.mjs run` on the owner's yes since 0049)* |
| 0023 | accepted | The PreToolUse write gate is reinstated, scoped to vault paths and the control plane *(no PreToolUse gate is wired since v1.1 — protected files are a convention, `notes/lifecycle-policy.md` §8)* |
| 0024 | amended by 0032, 0038, 0039 | Instrument what the policy claims to measure — reuse sidecar, rollup, caused retrieval failures, computed acceptance rate *(of these, only the retrieval-failure ledger remains)* |
| 0025 | superseded by 0038 | The session log gets a mechanism — transcript flush on SessionEnd, swept at SessionStart |
| 0026 | amended by 0032 | One approval surface (`PROPOSALS.md`); resurfacing is question-framed and inbound-poor *(proposal production was retired by 0038; `PROPOSALS.md` is kept by hand)* |
| 0027 | superseded by 0042 | Stop checkpoints skip trace-only commits and debounce the push |
| 0028 | accepted | The archive is flat — no subtree structure inside `archive/` |
| 0029 | amended by 0036 | This template is re-derived from the vault; the old `_brain/` layout is retired |
| 0030 | accepted | Tier-0 budgets are counted in characters and shown to the agent up front |
| 0032 | amended by 0033, 0039 | Machine state leaves the tracked tree; the reuse metric gets a trigger that actually runs *(the reuse metric was retired by 0039)* |
| 0033 | amended by 0034, 0038, 0042, 0049 | Unattended scheduled maintenance retired — the trigger becomes session start |
| 0034 | amended by 0035 | The capture inbox and every mobile-capture plan are removed |
| 0035 | amended by 0038, 0041, 0043 | A `raw/` source layer, `/ingest` to read a source into the wiki, `/file` to keep an answer, and `INDEX.md` as the page catalog (amends 0002 and 0034) |
| 0036 | amended by 0046 | Template v1.0 published ahead of the two-week bar; the bar governs additions, never removals |
| 0037 | amended by 0040 | The owner's own-notes folder is structured into kind folders *(the folder ships since v1.2 as `my-notes/`, flat — see 0040)* |
| 0038 | amended by 0039, 0048, 0049 | The flush mechanism and proposal production are removed; delivery, notices and measurement are made truthful (supersedes 0025) |
| 0039 | accepted | The notes earn their keep, the instrumentation does not — reuse telemetry is retired |
| 0040 | accepted | The own-notes folder goes flat again; `kind:` is the only classifier *(ships since v1.2 as `my-notes/` with `/note`)* |
| 0041 | accepted | `raw/` admits one named automatic writer, a video-transcript pipeline *(reference instance only — here `raw/` has no automatic writer)* |
| 0042 | amended by 0044 | Vault commits are task-owned: no hook stages or commits the whole tree; one user-level SessionStart per runtime (supersedes 0008, 0027) |
| 0043 | accepted | A research report that crowds out retrieval is kept as an archived snapshot plus a short live distillation (amends 0035) |
| 0044 | amended by 0051 | Claude Code and Codex are equal runtimes over one kit — `AGENTS.md` is the constitution, `.agents/skills/` the one skills copy (amends 0042) |
| 0045 | amended by 0050, 0052 | Project execution state lives in the project repo (contract, `CURRENT_STATE`, run reports — `WORKLOG` until 0050); the vault keeps what outlives a project — [full record](decisions/0045-project-execution-state-lives-in-the-repo.md) |
| 0046 | accepted | Template v1.1 published ahead of the two-week bar at the owner's request; an override for one batch, not a new rule (amends 0015, 0036) — [full record](decisions/0046-template-v1-1-published-ahead-of-the-bar.md) |
| 0047 | reversed | A weekly social-media writing routine runs as two read-only scheduled tasks *(reference instance only, reversed after three weeks; the template schedules nothing)* |
| 0048 | amended by 0052 | Lessons are one file per recurring behaviour, entries appended verbatim, routed to a rule when a second correction lands (amends 0019, 0038) — [full record](decisions/0048-lessons-are-topic-files-routed-at-capture.md) |
| 0049 | accepted | Session start says once a day what maintenance is due, computed from state; nothing runs until the owner says yes (amends 0033, 0038) — [full record](decisions/0049-maintenance-due-notice-runs-on-yes.md) |
| 0050 | accepted | One fact, one home: `docs/WORKLOG.md` is retired and `git log` is the project history (amends 0045) — [full record](decisions/0050-one-fact-one-home-worklog-retired.md) |
| 0051 | accepted | The reference instance pauses one runtime behind a single switch, deleting nothing (amends 0044) *(reference instance only — the template keeps Claude Code and Codex as equals)* |
| 0052 | accepted | Projects and the vault are walled off: the hook does nothing outside the vault, a project keeps its own lessons, `/harvest` reads a project on request, `/recall` is vault-only (amends 0045, 0048) — [full record](decisions/0052-projects-and-the-vault-are-walled-off.md) |
| 0053 | amended by 0054 | A project that goes public stays one public repo with its private material kept apart *(reference instance only — project publishing lives in its separate skills kit)* |
| 0054 | accepted | A new project repo is chosen public-ready or private when it is created; a public-ready repo pairs with a private sibling repo *(reference instance only)* |

There is no 0031: the number was allocated to a decision that was abandoned
before it was written. Gaps are left in place rather than renumbered — a
decision log you can renumber is one you can quietly rewrite.

## Recording your own

Once your vault is running, keep doing this. A choice that is expensive to
reverse — a folder architecture, a retrieval strategy, a rule about what the
agent may delete — gets a dated record: the context that forced it, the
decision, the outcome you expect, the alternatives you rejected, and a
pre-mortem, with the actual outcome filled in at `review_by`. Its `status:`
is what later decisions flip — `superseded` or `reversed`, with
`superseded_by` pointing forward. The value is not the writing; it is that
the next contradiction is visible instead of silent.

**Your decisions have one home.** A decision is a note: `type: decision`,
created from `.claude/templates/decision.md`, kept in `notes/` (with an
`INDEX.md` row, like any note) while it is live and moved to `archive/` once
it is superseded or reversed (the reference instance files its ADRs straight
into `archive/`). `/audit` reads them in both places. `docs/decisions/`
stays the template's own record, so taking a newer template version never
touches yours.
