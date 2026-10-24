---
name: lesson
description: Captures a correction verbatim into the current repo's own lesson store (docs/lessons/ in a project, notes/ inside the vault) under the recurring behaviour it belongs to, and proposes a rule change in that repo once that behaviour has been corrected twice. Use when the owner corrects how the agent works — not when they give feedback on one deliverable — when /closeout finds an uncaptured correction, or on /lesson.
---

# Lesson

A lesson exists to change how the agent works next time. The correction is
captured verbatim the moment it is made — before the agent can talk itself
into a fluent-but-false story about what went wrong — filed under the
behaviour it is about, and when the same behaviour is corrected a second time
it is routed into a rule where the work happens. Mechanics: ADR 0048 (amends
0019 and 0038); store: ADR 0052 (the template's `docs/DECISIONS.md` indexes both).

## Writes land in the current repo

A project keeps its own lessons, and a project session never reads or writes
the vault (ADR 0052). Where the session is decides the store:

| Session in | Lesson file | Template |
|---|---|---|
| a project repo | `docs/lessons/lesson-<topic>.md` | `templates/lesson.md` next to this skill |
| the vault | `notes/lesson-<topic>.md` | `.claude/templates/lesson.md` in the vault |

The vault reads project lessons later, when the owner runs `/harvest` there.
Never write a project's lesson into the vault, or a vault lesson into a
project.

## Gate — is this a lesson?

Ask one question: **would this correction apply to a different task next
week?**

- **Yes** → a lesson. Examples: not stopping when told to stop, proposing
  ideas the owner already has, skipping the clarifying questions, doing a
  narrower search than asked, not using a skill that was written for the job.
- **No, it is about this artifact** ("remove the colours from this CV", "this
  paragraph is too long") → apply it now. If the project should remember it,
  write it into that project's own rules (its skill, style guide or `docs/`)
  and say so in one line. Not a lesson.
- **A fact about the owner was wrong** ("I'm not an engineer") → in the vault,
  fix it through the memory path (`USER.md` or a `notes/` memory note, with
  their yes). In a project, fix it where the project states it, and tell the
  owner the vault may need the same fix in a vault session. Not a lesson.

Several corrections of one deliverable in one session are one task. If they
show a behaviour (e.g. "keeps making the CV fancier when asked for a standard
one"), capture that once.

## Standing rule — verbatim evidence, no single-point interpretation

- Write the correction **exactly as given** and the artifact it corrects (the
  diff, error message, or wrong output) — unchanged, no cleanup.
- A correction **stays in the language it was given in**. Translation, if it
  happens at all, happens later — never here. A lesson's whole value is the
  correction verbatim.
- One correction is evidence, not a rule. Do not write "lesson learned" prose
  under an entry. The confabulation risk (ADR 0019, arXiv:2605.29463) is that
  a plausible narrative is worse than no narrative; interpretation starts only
  at routing (step 4), with two entries in front of you and the owner
  approving the result.
- Entries are never edited after capture. A better understanding is a new
  entry or a routed rule — never a rewrite of an earlier entry.

## Steps

1. **Find the topic.** List the store's `lesson-*.md` files and read their
   titles and `topic:` lines. If the correction is the same behaviour as an
   existing topic, append to it. Otherwise create `lesson-<topic>.md` from the
   template in the table above (create `docs/lessons/` if it is missing). Name
   the topic after the behaviour (`lesson-stopping-when-told`), never after a
   date. Set `class:` to the closest of
   `wrong-memory | no-memory | unused-memory | wrong-procedure | style | scope`
   — a grouping key, not analysis; don't reach past these six unless none fit.

2. **Append the entry** under `## Entries`: date, the correction verbatim, the
   artifact verbatim, the session id. Never edit an existing entry — the vault
   copies entries on `/harvest`, and an append-only file is what keeps that
   copy true.

3. **Vault only:** a new topic file gets a row in the Lessons table of
   `INDEX.md` (replacing the `_(none yet …)_` placeholder row if it is still
   there) and one outbound wikilink in `related:` if an obviously related note
   exists — never a forced one. Then append the signal line:
   ```
   node .claude/hooks/append-signal.mjs correction class:<slug> note:lesson-<topic>.md "<verbatim excerpt, <=80 chars>" --sid <session id if known>
   ```
   A project repo has neither — skip this step.

4. **Route when the topic has two entries from different tasks.**
   - Read every entry in the file, including the ones that disagree with each
     other, and write one concrete change that would have prevented them —
     a diff to the place that produced the mistake, inside this repo: the
     skill that was running, the repo's `AGENTS.md` / `CLAUDE.md`, or a check
     or test when the rule is mechanical (in the vault, a check in
     `.claude/hooks/checks.mjs`). Prefer the narrowest target. A rule for
     every project (a user-level instructions file) is proposed only when the
     owner asks for it.
   - **The topic is already `routing: routed`** → the rule failed. Do not
     strengthen the wording in the same place; propose moving it closer to
     the work (into the skill, or a check). A firmer sentence in the same
     place is not a fix.
   - Show the owner the proposal in a few lines — the target, the diff, the
     entries it rests on — and ask. If they say yes, apply it and set
     `routing: routed`. If they say no, set `routing: refused`. Either way add
     a dated line under `## Routing`.
   - Mid-task and the owner is busy → set `routing: pending` and say so in one
     line. `/closeout` surfaces pending topics in a project; in the vault,
     `/curator` lists them and the session-start maintenance notice counts
     them (ADR 0049). A proposal counts toward the three-a-day proactive
     budget.

5. **Commit** the paths this step wrote, by name, in the current repo:
   ```
   git commit -m "lesson: <topic>" -- <lesson file> [<routed rule file>]
   ```
   In the vault, add `INDEX.md` when you changed it, and the signals file only
   if `git diff -- logs/signals/<YYYY-MM>.md` shows your line alone or the file
   is new this month; otherwise leave the signal line uncommitted and say so.
   Other uncommitted changes belong to another task. Never push.

6. **Confirm in one line**, e.g. "Captured under `stopping-when-told` (2nd
   entry) — proposed a rule for the closeout skill, waiting for your yes."
