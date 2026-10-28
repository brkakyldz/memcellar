# The agent runtime as the runtime — the zero-cost path

The owner already pays for an agent runtime (a Claude Code or Codex
subscription). For a portfolio piece, a tool for their own use or a demo, that
runtime can be the product's engine at no extra cost. This file says what to
check; it holds no flags or limits, because they change. **Check the runtime's
current docs before relying on a flag**, and cite the page and the date you
read it in the report.

## What it usually gives at no extra cost

- **Headless runs.** A non-interactive call on the logged-in subscription —
  `claude -p "<prompt>"` in Claude Code, `codex exec "<prompt>"` in Codex.
  Check which modes bill the subscription and which need an API key: some
  "bare" or CI modes skip the subscription login and bill an API key instead,
  which defeats the point.
- **Structured output.** Both runtimes can return JSON, some against a
  schema. Check the field that carries the result exists before using it; it
  is absent when the run declined or failed.
- **Skills and subagents.** A skill can be invoked from a headless run, and
  a subagent or profile can pin the cheap tier for bulk extraction while the
  session's own model judges.
- **Permissions for batch runs.** An allow-list of tools or a non-interactive
  permission mode, so an unattended run neither stalls on a prompt nor gets
  more access than it needs.
- **Deterministic gates.** A hook or a wrapper script can check a result (a
  quote really appears in the source, a value parses) before it is written,
  so the model cannot pass unverifiable output.
- **Built-in web search** for discovery.

## What it cannot do

- **A fetch tool's output is not evidence.** A runtime's page-fetch tool
  often returns a model's summary of the page, not the page. For anything
  quoted or verified, fetch the page with a local script (an HTTP client plus
  a text extractor; a headless browser for JavaScript pages) and keep the raw
  text.
- **Volume.** Subscription usage limits cap throughput: fine for a demo or
  an eval set of a few hundred items, not for thousands a day. Estimate
  tokens per item and say what that means against the owner's plan.
- **Serving other people.** A tool others use, or a hosted service, runs on
  a paid API, not the owner's subscription, which is usually licensed for the
  subscriber's own use (check its terms). Design so the model call sits behind one function and the
  prompts and schemas live in files, so the move is one change.

## Usual free companions

Open official data (public registries, statistics offices, government open
data portals, open knowledge bases such as Wikidata), open-source fetch and
extraction libraries, SQLite for storage, and CSV in and out before any web
UI. Check each source's terms before storing what it returns.
