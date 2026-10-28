# M0 spike — prove the outside world before planning it

Loaded between SEED and research, and again whenever research or a design
choice adds a dependency. A plan rests on facts about things the project does
not control: an LLM route, a library feature, an external API. Those facts are
cheap to test and expensive to discover late, so they are tested first.

Why: in the reference instance the order was intent → research → plan →
three review rounds → spike → plan rewritten → a fourth review round. The
spike sent six requests and found three facts that reshaped the plan — an LLM
route that rejected a system message, a library's structured-output parse that
came back empty under streaming, and an API that refused the planned auth
mode. No review round caught them, because no reviewer had run anything. Known
before the plan, the plan is written once.

## What gets a spike

One script per external dependency the work will touch, testing **the exact
combination the plan will use** — same auth mode, same streaming setting, same
message shape, same library version. "The provider supports JSON" is not the
assumption; "structured output works over this auth route while streaming" is.

- every LLM route: provider × auth mode × the features leaned on (system
  message, tool calls, structured output, streaming);
- every library feature the design depends on, not the library in general;
- every external API, with the credential type the product will actually hold.

Dependencies named in the intent are spiked before research. One that research
or a later design choice adds is spiked before the plan names it. The rule is
the invariant, not the timing: **no dependency enters the plan untested.**

## How

- 10–20 lines per script, in a scratch folder outside the repo (the runtime's
  scratch or temp directory), named `YYYY-MM-DD_<slug>-spike/`. Never in the
  repo: scratch that lands in a repo becomes untracked clutter or, worse, a
  committed file nobody owns.
- A handful of requests in total. A spike that costs money is stated with its
  cost and run only on the owner's yes; in a run that cannot ask, or past what
  the owner allowed, its row says `UNTESTED — needs allowance` and becomes an
  Open gate.
- Record what the system answered, not what you concluded: the status code,
  the error line, the empty field. Scratch is not kept, so the row must stand
  on its own.

## The table

The spike opens `docs/plan.md` with this section, before any plan text exists;
the plan is later written below it. It is the one part of the plan that holds
results, because these are inputs the plan is built on, not progress through
it.

```markdown
## Verified assumptions

| ID | Assumption | How tested | Result |
|---|---|---|---|
| V-1 | Structured output works on the chosen route while streaming | `json_stream.py` | ✅ |
| V-2 | The search API accepts the token type the product will hold | `search_auth.py` | ❌ 401 — plan uses the API-key route |
| V-3 | The route accepts a system message | `system_msg.py` | ❌ 400 — instructions moved into the user turn |
```

`How tested` is the script's path relative to the spike folder. A ❌ row says
in one clause how the plan routes around it. A milestone that depends on a row
cites its ID (`relies on V-1`).

## What FINALIZE checks

Every external dependency the plan uses has a row. A row that is `UNTESTED`,
or a dependency with no row, leaves the repo `BOOTSTRAP_INCOMPLETE` naming it.
A ❌ row with no route-around is the same.
