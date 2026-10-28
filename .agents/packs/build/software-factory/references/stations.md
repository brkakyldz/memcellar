# Why each station exists — evidence as of 2026-10

The sources behind the factory's stations, with what each showed. Re-check
the perishable lines before relying on them after 2027-04.

| Station | Why | Source |
|---|---|---|
| Intake verbatim + assumptions | Agents guess instead of asking; clarification raises resolve rates on underspecified tasks. With no questions allowed, the guess must be visible. | [Ask or Assume, 2026-06](https://www.alphaxiv.org/abs/2603.26233) |
| Spec with IDs, EARS | Spec-driven tools (Spec Kit, Kiro, OpenSpec) all put a requirements artefact with acceptance between intent and code; Kiro uses EARS. | [Spec Kit](https://github.com/github/spec-kit/blob/main/spec-driven.md), [Kiro](https://kiro.dev/docs/specs/feature-specs/), [OpenSpec](https://github.com/Fission-AI/OpenSpec) |
| Scenario author ≠ builder | Independently written tests caught 25% of faults vs 14% for tests written after the code. | [arXiv 2607.05139](https://arxiv.org/abs/2607.05139) |
| Held-out, composing features | Agents saturate visible suites and fail hidden composition tests; the gap grows with code size. | [SpecBench, 2026-05](https://arxiv.org/html/2605.21384v1) |
| Builder never edits scenarios | StrongDM moved to held-out scenarios after agents wrote `return true`; Pulumi keeps scenarios out of the generator's reach. | [StrongDM](https://factory.strongdm.ai/), [Pulumi, 2026-05](https://www.pulumi.com/blog/dark-factory-pattern-pulumi-autonomous-iac/) |
| Verify N×, 2/3, ≥ 90% | Pulumi's scenario rule for non-deterministic systems. | Pulumi, above |
| Verifier proves it ran | Reported incidents: a large verifier imported type-only that never ran; "Done" with no commit; silent empty success. | [incidents, 2026-10-08](https://dev.to/getpullrequest-hq/ai-can-run-the-software-factory-it-cant-turn-the-lights-off-yet-1cjj) |
| Independent review | Half of SWE-bench-passing agent patches would not be merged by maintainers. | [METR, 2026-03](https://metr.org/notes/2026-03-10-many-swe-bench-passing-prs-would-not-be-merged-into-main/) |
| Ship from a template, human at the irreversible step | No source shows reliable agent-driven repo-to-release; every account keeps a human at merge or publish. | [Ostrovsky, 2026-09](https://igoro.com/archive/software-factories/) |
| Metrics, not narration | Time to accepted work, review effort, repeated corrections, escaped defects, cost. | [Tessl, 2026-10-08](https://tessl.io/blog/engineering-a-context-driven-software-factory) |

Scenario authoring by an independent context from raw intent and contracts
has little published evidence yet. Each factory run records its first-try
held-out pass rate, so the owner's own runs accumulate it.
