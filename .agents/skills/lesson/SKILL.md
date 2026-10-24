---
name: lesson
description: Captures a correction verbatim under the recurring behaviour it belongs to — in the owner's user-level kit by default, so corrections from every project meet in one file; in the repo's docs/lessons/ when it is tied to that repo; in the vault's notes/ only when it is about running the vault — and proposes a rule change once that behaviour has been corrected twice. Use when the owner corrects how the agent works — not when they give feedback on one deliverable — when /closeout finds an uncaptured correction, or on /lesson.
---

# Lesson

A lesson exists to change how the agent works next time. The correction is
captured verbatim the moment it is made — before the agent can talk itself
into a fluent-but-false story about what went wrong — filed under the
behaviour it is about, and when the same behaviour is corrected a second time
it is routed into a rule where the work happens. Mechanics: ADR 0048 (amends
0019 and 0038); stores: ADR 0056 (amends 0052; the template's
`docs/DECISIONS.md` indexes all three).

## Where the lesson goes — one question decides

**Would this correction recur in a different repository?** Almost always it
would, because it is about how the owner wants work done: asking first,
stopping when told, the scope of a search, the model to use. So the default
is the kit, where entries from every project meet in one file and the second
one can trigger routing.

| The correction is about | Store | Template |
|---|---|---|
| how the owner wants work done — the default | `<kit>/lessons/lesson-<topic>.md` | `templates/lesson.md` next to this skill |
| this repository's code or domain, and nothing else | the repo's `docs/lessons/lesson-<topic>.md` | `templates/lesson.md` next to this skill |
| running the vault itself: its notes, passes, own skills (vault sessions only) | `notes/lesson-<topic>.md` | `.claude/templates/lesson.md` in the vault |

`<kit>` is the owner's user-level kit: `$BRAIN_KIT_DIR` if it is set,
otherwise a `lessons/` folder next to the user-level instruction file
(`~/.claude/lessons/` for Claude Code). It must be private: entries quote the
owner verbatim. A repo lesson needs a stated reason that ties it to that
repository; "it happened here" is not one. A project session still never
reads or writes the vault (ADR 0052).

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

- Write the correction **exactly as given** and the shortest excerpt of the
  artifact that shows the mistake (the diff, error message, or wrong output) —
  unchanged, no cleanup, but never a whole pasted deliverable.
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

2. **Append the entry** under `## Entries`: date, the repository or folder the
   session was in, the correction verbatim, the artifact excerpt verbatim, the
   session id. Never edit an existing entry — an append-only file is what
   lets the entry count mean something.

3. **Vault only:** a new topic file gets a row in the Lessons table of
   `INDEX.md` (replacing the `_(none yet …)_` placeholder row if it is still
   there) and one outbound wikilink in `related:` if an obviously related note
   exists — never a forced one. Then append the signal line:
   ```
   node .claude/hooks/append-signal.mjs correction class:<slug> note:lesson-<topic>.md "<verbatim excerpt, <=80 chars>" --sid <session id if known>
   ```
   The kit and a project repo have neither — skip this step.

4. **Route when the topic has two entries from different tasks.**
   - Read every entry in the file, including the ones that disagree with each
     other, and write one concrete change that would have prevented them —
     a diff to the place that produced the mistake. For a kit lesson that is
     the user-level instruction file, or the kit skill that was running. For
     a repo lesson it is the repo's `AGENTS.md` / `CLAUDE.md`, its skill, or a
     check or test. For a vault lesson it is a vault skill or a check in
     `.claude/hooks/checks.mjs`. Prefer the narrowest target that would have
     been in front of the agent when it made the mistake. A rule stated once
     in the user-level file binds every kit skill that touches the same choice
     (ADR 0056): check that none of them still offers the forbidden option.
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

5. **Commit** the paths this step wrote, by name, in the repository that holds
   the store — the kit, the project or the vault:
   ```
   git -C <store repo> commit -m "lesson: <topic>" -- <lesson file> [<routed rule file>]
   ```
   A kit that is not a git repository is just saved. Other sessions may write
   into the kit too, so stage nothing but your own paths.
   In the vault, add `INDEX.md` when you changed it, and the signals file only
   if `git diff -- logs/signals/<YYYY-MM>.md` shows your line alone or the file
   is new this month; otherwise leave the signal line uncommitted and say so.
   Other uncommitted changes belong to another task. Never push.

6. **Confirm in one line**, e.g. "Captured under `stopping-when-told` (2nd
   entry) — proposed a rule for the closeout skill, waiting for your yes."
