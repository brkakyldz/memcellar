#!/usr/bin/env node
/**
 * check-scenarios — the static pass on an author's pack, before landing.
 *
 *   node check-scenarios.mjs <holdout-dir> [--budget 40]
 *
 * It catches what the reference instance only found by running the suite, in
 * the order those defects cost the most: a suite past its budget, scenarios
 * whose ids and titles do not match verify.json, sleeps and fixed waits,
 * reaches into product source, retries that hide flakes, too many @smoke
 * journeys, timeouts far beyond what a journey needs.
 *
 * A scenario file is any file whose name starts with H<digits> (H01_x.spec.ts,
 * H01_x_test.py). Its titles must carry `H<nn> [<ID>, ...]`.
 * Exit 0 = no errors (warnings allowed), 1 = errors, 2 = cannot run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCENARIO_FILE = /^(H\d+)[^/\\]*\.(m?[jt]sx?|py|rb|go|java|kt|cs|feature)$/;
const TITLE = /\b(H\d+)\s*\[([^\]]+)\]/g;

const FORBIDDEN = [
  { re: /\bwaitForTimeout\s*\(/, what: 'fixed wait (waitForTimeout)' },
  { re: /\btime\.sleep\s*\(|\basyncio\.sleep\s*\(|\bThread\.sleep\s*\(/, what: 'sleep' },
  { re: /\bsleep\s*\(\s*\d/, what: 'sleep' },
  { re: /new Promise\s*\(\s*\(?\s*\w*\s*\)?\s*=>\s*setTimeout\s*\(/, what: 'sleep via setTimeout' },
  { re: /\bsys\.path\.(insert|append)\s*\(/, what: 'sys.path change (reaching into product source)' },
];

// Relative imports that climb out of the held-out folder reach product code.
const IMPORT = /(?:from\s+['"]|require\s*\(\s*['"]|import\s*\(\s*['"]|import\s+['"])(\.{1,2}\/[^'"]+)['"]/g;

export function checkScenarios(dir, { budget = 40 } = {}) {
  const errors = [];
  const warnings = [];
  if (!fs.existsSync(dir)) return { errors: [`no folder at ${dir}`], warnings, ids: [] };
  const all = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else all.push(p);
    }
  };
  walk(dir);
  const scenarioFiles = all.filter((p) => SCENARIO_FILE.test(path.basename(p)));
  const ids = new Map(); // id -> file
  let smoke = 0;

  for (const file of scenarioFiles) {
    const rel = path.relative(dir, file).split(path.sep).join('/');
    const fileId = SCENARIO_FILE.exec(path.basename(file))[1];
    const text = fs.readFileSync(file, 'utf8');
    const titled = [...text.matchAll(TITLE)];
    if (!titled.length) errors.push(`${rel}: no title carries "${fileId} [<requirement IDs>]"`);
    for (const m of titled) {
      if (m[1] !== fileId) errors.push(`${rel}: title id ${m[1]} does not match the file's ${fileId}`);
    }
    if (ids.has(fileId)) errors.push(`${rel}: id ${fileId} is also used by ${ids.get(fileId)}`);
    else ids.set(fileId, rel);
    smoke += (text.match(/@smoke\b/g) ?? []).length ? 1 : 0;

    text.split(/\r?\n/).forEach((line, i) => {
      for (const f of FORBIDDEN) if (f.re.test(line)) errors.push(`${rel}:${i + 1}: ${f.what} — wait on a named state instead`);
      for (const m of line.matchAll(IMPORT)) {
        const target = path.resolve(path.dirname(file), m[1]);
        if (path.relative(dir, target).startsWith('..')) {
          errors.push(`${rel}:${i + 1}: imports ${m[1]}, outside the held-out folder — scenarios drive the product only through its contracted surfaces`);
        }
      }
      const t = /\btimeout\s*[:=]\s*(\d[\d_]*)/.exec(line);
      if (t && Number(t[1].replaceAll('_', '')) > 120000) warnings.push(`${rel}:${i + 1}: timeout ${t[1]} ms — cap a scenario at about 4× its passing time`);
    });
  }

  if (!scenarioFiles.length) errors.push('no scenario files (names starting with H<digits>)');
  if (scenarioFiles.length > budget) errors.push(`${scenarioFiles.length} scenarios, budget ${budget} — run the trim brief first`);
  if (smoke > 8) errors.push(`${smoke} scenarios tagged @smoke, at most 8`);

  for (const file of all) {
    const base = path.basename(file);
    if (SCENARIO_FILE.test(base)) continue;
    if (/\.(m?[jt]s|json|toml|ini|cfg|ya?ml)$/.test(base)) {
      const text = fs.readFileSync(file, 'utf8');
      const r = /\bretries\s*[:=]\s*([1-9])/.exec(text) || /--reruns[=\s]+([1-9])/.exec(text);
      if (r) errors.push(`${path.relative(dir, file)}: retries ${r[1]} — retries stay 0; a retry hides a flake`);
    }
  }

  const verifyPath = path.join(dir, 'verify.json');
  if (!fs.existsSync(verifyPath)) {
    errors.push('verify.json is missing');
  } else {
    let cfg = null;
    try {
      cfg = JSON.parse(fs.readFileSync(verifyPath, 'utf8'));
    } catch (err) {
      errors.push(`verify.json does not parse: ${err.message}`);
    }
    if (cfg) {
      for (const k of ['command', 'report', 'expected']) if (!cfg[k]) errors.push(`verify.json has no "${k}"`);
      if (typeof cfg.report === 'string' && /(^|[\\/])tests[\\/]acceptance[\\/]holdout([\\/]|$)/.test(cfg.report)) {
        errors.push(`verify.json "report" (${cfg.report}) is inside the held-out folder — every run would break the lock; write it elsewhere`);
      }
      const expected = new Set(Array.isArray(cfg.expected) ? cfg.expected : []);
      const missing = [...ids.keys()].filter((id) => !expected.has(id));
      const extra = [...expected].filter((id) => !ids.has(id));
      if (missing.length) errors.push(`verify.json "expected" lacks ${missing.join(', ')}`);
      if (extra.length) errors.push(`verify.json "expected" names ${extra.join(', ')}, which no scenario file has`);
    }
  }
  if (!fs.existsSync(path.join(dir, 'COVERAGE.md'))) errors.push('COVERAGE.md is missing (requirement ID → scenario ids)');

  return { errors, warnings, ids: [...ids.keys()].sort() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  const bi = args.indexOf('--budget');
  const budget = bi >= 0 ? Number(args[bi + 1]) : 40;
  if (!dir) {
    console.log('usage: check-scenarios.mjs <holdout-dir> [--budget 40]');
    process.exit(2);
  }
  const r = checkScenarios(path.resolve(dir), { budget });
  for (const e of r.errors) console.log(`ERROR  ${e}`);
  for (const w of r.warnings) console.log(`WARN   ${w}`);
  console.log(`\n${r.ids.length} scenario(s), ${r.errors.length} error(s), ${r.warnings.length} warning(s)`);
  process.exit(r.errors.length ? 1 : 0);
}
