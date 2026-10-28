# Brief templates — fill the <slots>, save as BRIEF.md in the pack

Three briefs: **main** (a first or further batch), **trim** (the batch would
pass the budget, or requirements were removed or changed), **revision**
(named scenarios reported as wrong oracles). The rules block is shared; it is
`test-discipline.md` in the author's terms. `<budget>` is 40 (or the owner's
number) minus the scenarios already landed.

## Main brief

```text
You are the INDEPENDENT ACCEPTANCE AUTHOR for <product>. You have never seen its
code and must not try to: this directory holds only the specification, the
contracts, the list of requirements built so far, and the NAMES of the tests
that already exist. Another agent is building the product; your tests decide
whether its work is accepted. Do not ask questions; write the files.

Read: <spec.md | the intent document and acceptance.md (acceptance IDs for
<milestone range>)>, contracts/ (all files — testing.md says which values are
EXACT and which are DESCRIPTIVE), built.md, existing-tests.txt.
The harness is <harness and version>; <how the system is started — e.g. each
file starts `npm start` on its own port with its own DATA_DIR, as
contracts/testing.md specifies>.

Write, under holdout/ in this directory:
1. At most <budget> scenario files `H<nn>_<slug>.<ext>`, numbering from
   H<next>. Fewer is better when fewer cover the requirements. Each scenario
   is ONE realistic user journey that composes at least two requirements,
   drives the product only through the surfaces the contracts name, and
   asserts what a user would observe plus at least one thing that must NOT
   have happened. Title: `H03 [EDT-2, PER-1] renamed node survives reload`.
   A scenario that needs a requirement not in built.md adds `@needs-<ID>` to
   its title. Tag at most 8 of the most important journeys `@smoke`.
2. <harness config>, writing a machine report to <report path, OUTSIDE
   holdout/> (<playwright-json|junit>), retries 0. Each file starts its own
   instance of the product, so files run in parallel and in any order.
3. verify.json:
   {"command": "<command>", "format": "<playwright-json|junit>", "report": "<path>",
    "expected": ["H01", …every scenario id…], "runs": 3, "perScenario": 2, "overall": 0.9}
4. COVERAGE.md: requirement ID → scenario ids; every requirement you could not
   test from the contracts, and why (that is a contract gap — say so).
5. README.md: who wrote these (you: "<runtime / fresh subagent>"), the date,
   and the rules below in one paragraph.

<RULES>
```

## Trim brief

```text
You are the INDEPENDENT ACCEPTANCE AUTHOR for <product>. holdout/ holds your
earlier scenarios; spec.md, contracts/ and built.md are current; changes.md
lists the requirement IDs removed or changed since. Rewrite holdout/ so it
holds at most <40 or the owner's number> scenarios and still covers every
requirement in built.md:
- retire every scenario whose requirements were removed; rewrite those whose
  requirements changed;
- merge scenarios that walk the same journey;
- move rule-by-rule checks out — list them in RETIRED.md as "unit-test work"
  so the builder can confirm a unit test holds each (existing-tests.txt shows
  the names that exist);
- apply the rules below to every scenario you keep.
Write RETIRED.md (each retired or merged id, the reason, the id or unit test
that now covers it), and rewrite verify.json and COVERAGE.md.

<RULES>
```

## Revision brief

```text
You are the INDEPENDENT ACCEPTANCE AUTHOR for <product>. holdout/ holds your
scenarios. The builder reports these as contradicting the contracts:
<id — line — the contract clause it cites, one per line>.
For each: if the scenario is wrong, fix it; if the contract supports your
scenario, leave it and say why in REVISION.md. Change nothing else. Keep the
ids. Apply the rules below.

<RULES>
```

## RULES (paste in place of <RULES>)

```text
Rules:
- No import from the product's source; no mocks of the product; only the
  stand-ins the contracts define.
- Assert outcomes: an error is shown, a record is saved, parts do not
  overlap. Assert a string, size or colour literally ONLY where
  contracts/testing.md marks it exact; otherwise a regex on its key words, a
  relation, or a tolerance (measured text and geometry: 1 px).
- A list of rules (each validation rule, each limit) is unit-test work:
  check one representative refusal, never each rule in turn. Do not re-test
  what existing-tests.txt shows a unit test already holds.
- Fixtures obey the contracts' own limits and create everything the
  scenario later uses (folders, files, records).
- No sleeps, fixed waits or elapsed-time assertions. Wait on contract-named
  states with auto-retrying assertions, and read a list only after the state
  that says it has loaded. A timeout scenario sets the deadline through the
  configuration the contract names and asserts the outcome, not the time.
  Give each scenario a timeout of about 4x what it should take, not minutes.
- Compare paths after resolving them. A check that holds on one operating
  system only is tagged with that system's name.
- Requirement IDs in a title are exactly the ones its assertions observe —
  no more, no fewer.
- Each file is self-contained: it runs alone and in any order.
```
