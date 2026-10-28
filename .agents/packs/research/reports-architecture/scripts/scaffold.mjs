#!/usr/bin/env node
// Scaffolds the reports/ research store into a project repo. Idempotent: it
// never overwrites an existing file, and it refuses to run in a Second Brain
// OS vault, whose reports/ folder has a contract of its own.
// Usage: node scaffold.mjs [project-root]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const README = `# reports/

The project's **research store** — where research and context-gathering output
lands so a future session reads it back instead of searching again. Created by
the \`reports-architecture\` skill.

| Folder | Contents | Written by |
|---|---|---|
| \`research/\` | Dated research reports, \`YYYY-MM-DD_<slug>.md\` | the \`research\` skill |

That is the entire architecture. This folder is not a working record.

## What does *not* go here

- Where the project stands → \`docs/CURRENT_STATE.md\`.
- Decisions that are expensive to reverse → \`docs/decisions/\`.
- Corrections to how the agent works → \`docs/lessons/\`.
- History → \`git log\`.

## Rules

- One file per research run. Sources linked inline, a date next to anything
  perishable.
- Reports are **immutable** — a report is what was believed on that date. A
  correction is a newer report that references the old one, never an edit.

---

## Snippet for AGENTS.md

\`\`\`markdown
## Research

Research output goes to \`reports/research/\` as \`YYYY-MM-DD_<slug>.md\`
(the \`research\` skill). Read what is already there before researching a
topic again. Reports are immutable — correct one with a newer report that
references it.
\`\`\`
`;

const RESEARCH_README = '# research\n\nResearch reports. Naming: `YYYY-MM-DD_<slug>.md`. Sources linked inline.\n';

export function isVault(root) {
  return fs.existsSync(path.join(root, 'core', 'IDENTITY.md'))
    && fs.existsSync(path.join(root, '.agents', 'write-gate.md'));
}

// Returns { created: [...relative paths], skipped: [...] }; throws in a vault.
export function scaffold(root, now = new Date()) {
  if (isVault(root)) {
    throw new Error(`${root} is a Second Brain OS vault — its reports/ folder has its own contract; nothing written`);
  }
  const created = [];
  const skipped = [];
  const write = (rel, content) => {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) {
      skipped.push(rel);
      return;
    }
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
    created.push(rel);
  };
  write(path.join('reports', 'research', 'README.md'), RESEARCH_README);
  write(path.join('reports', '.reports-architecture'), `v2 research-store\ncreated: ${now.toISOString().slice(0, 10)}\n`);
  write(path.join('reports', 'README.md'), README);
  return { created, skipped };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || process.cwd());
  try {
    const { created, skipped } = scaffold(root);
    console.log(`reports/ research store ready → ${path.join(root, 'reports')}`);
    console.log(`  created: ${created.length} file(s), skipped (already present): ${skipped.length}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
