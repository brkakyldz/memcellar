# Intake question bank

One round, at most four questions, each with 2–4 options, the recommended
option first with "(Recommended)" in its label (AskUserQuestion in Claude
Code; a numbered list of options elsewhere). The wording below is English;
ask in the owner's language. Drop any question their message already answers.

## Core four

| Header | Question | Options (recommended first) |
|---|---|---|
| Purpose | What is this project for? | Portfolio · My own use · A product others will use · Client work |
| Budget | How much are you willing to spend? | Zero — the runtime I have + free sources · A small monthly amount · Paid is fine if clearly better, ask me per spend |
| Focus | How broad should it be? | One narrow, measurable piece · A medium slice · A broad platform |
| Deliverable | What should this round produce? | A few short ideas · A research report · Stack + plan · Go straight to spikes |

Recommend from context: a learning or job-hunting project → portfolio, zero
budget, narrow focus. The recommendation goes first; it is not a default to
act on without the answer.

## Ask only when it changes the answer

| Header | Question | Options |
|---|---|---|
| Market | Which market and language? | The owner's country · A region (e.g. EU) · Global / English · Doesn't matter |
| Scale | How much data will it handle? | Tens of records (demo) · Hundreds a day · Thousands a day |
| Data | Where can the data come from? | Open / official sources only · Data I already have · A paid provider is possible |
| Process | Do you know how this domain works today? | Give me a short primer first · I know it, skip |

Market changes the data sources and the law that applies (data-protection
rules, which public registries exist). Scale decides whether a subscription
runtime's limits are enough. A "primer first" answer means a primer before
any idea.

## Constraints block

Write it in chat once, then paste it at the top of the research brief:

```
Constraints (from intake, YYYY-MM-DD)
- Purpose: portfolio
- Budget: zero — existing agent runtime + free sources; any spend asked first
- Focus: one narrow, measurable piece
- Deliverable: research report, then stack
- Market: global, English data
- Not asked / assumed: scale ≈ demo (tens to hundreds of records)
```

Anything assumed instead of asked goes under "Not asked / assumed" so the
owner can overturn it.
