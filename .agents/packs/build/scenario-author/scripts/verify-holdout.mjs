#!/usr/bin/env node
/**
 * verify-holdout — the held-out verification: the final milestone, a release,
 * or the software factory's verify station.
 *
 * Runs the held-out acceptance command N times and decides VERIFIED only when
 * every expected scenario actually executed in every run, each scenario passed
 * in at least `perScenario` of the runs, and the overall pass rate across all
 * scenario-runs reached `overall`. A run that executed zero tests, or that is
 * missing an expected scenario, is a failure — the incident class this exists
 * for is the verifier that never ran.
 *
 * Before the first run it checks the held-out lock (LOCK.json, see lock.mjs):
 * a held-out file that differs from the lock is NOT VERIFIED, whatever the
 * runs would say. --no-lock skips that, only in a repo whose owner waived it.
 *
 * Config: `tests/acceptance/holdout/verify.json` (inside the lock, so the
 * scenario author owns it, not the builder):
 *   {
 *     "command": "npx playwright test -c tests/acceptance/holdout",   // string, run through the shell
 *     "format": "playwright-json" | "junit",
 *     "report": "path/to/report.json|xml",     // file the command writes (relative to root)
 *     "expected": ["H01", "H02"],             // scenario ids; a test belongs to the id its title contains
 *     "runs": 3, "perScenario": 2, "overall": 0.9,
 *     "timeoutMs": 900000
 *   }
 *
 * Usage: node verify-holdout.mjs [--root DIR] [--runs N] [--evidence FILE] [--no-lock]
 * Exit 0 = VERIFIED, 1 = NOT VERIFIED, 2 = could not run (config/command error).
 */
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { check as checkLock } from "./lock.mjs";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const root = resolve(opt("root", process.cwd()));
const configPath = join(root, "tests", "acceptance", "holdout", "verify.json");

const die = (code, msg) => { console.log(msg); process.exit(code); };

if (!args.includes("--no-lock")) {
  const lock = checkLock(root);
  if (lock.missingLock) die(2, "NOT RUN: tests/acceptance/holdout/LOCK.json is missing — land the scenarios with lock.mjs");
  if (!lock.ok) die(1, `NOT VERIFIED: held-out files differ from LOCK.json (changed: ${lock.changed.join(", ") || "-"}; added: ${lock.added.join(", ") || "-"}; removed: ${lock.removed.join(", ") || "-"})`);
}
if (!existsSync(configPath)) die(2, `NOT RUN: no config at ${configPath}`);
let cfg;
try { cfg = JSON.parse(readFileSync(configPath, "utf8")); } catch (e) { die(2, `NOT RUN: bad config — ${e.message}`); }
const runs = Number(opt("runs", cfg.runs ?? 3));
const perScenario = Number(cfg.perScenario ?? Math.ceil((runs * 2) / 3));
const overall = Number(cfg.overall ?? 0.9);
const expected = Array.isArray(cfg.expected) ? cfg.expected : [];
if (!cfg.command || !cfg.report || !expected.length) die(2, "NOT RUN: config needs command, report and a non-empty expected list");
const reportPath = resolve(root, cfg.report);

/** Flatten a report into [{title, ok}] — one entry per executed test. */
function parsePlaywright(json) {
  const out = [];
  const walk = (suite, prefix) => {
    const here = [prefix, suite.title].filter(Boolean).join(" › ");
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const results = t.results ?? [];
        if (!results.length || results.every((r) => r.status === "skipped")) continue;
        const last = results[results.length - 1];
        out.push({ title: `${here} › ${spec.title}`, ok: last.status === "passed" });
      }
    }
    for (const s of suite.suites ?? []) walk(s, here);
  };
  for (const s of json.suites ?? []) walk(s, "");
  return out;
}

function parseJunit(xml) {
  const out = [];
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const body = m[3] ?? "";
    const name = /\bname="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const cls = /\bclassname="([^"]*)"/.exec(attrs)?.[1] ?? "";
    if (/<skipped\b/.test(body)) continue;
    out.push({ title: `${cls} › ${name}`, ok: !/<(failure|error)\b/.test(body) });
  }
  return out;
}

const idOf = (title) => expected.find((id) => new RegExp(`(^|[^A-Za-z0-9])${id}([^A-Za-z0-9]|$)`).test(title));

const perRun = [];
for (let i = 1; i <= runs; i++) {
  if (existsSync(reportPath)) rmSync(reportPath, { force: true });
  const started = Date.now();
  const r = spawnSync(cfg.command, {
    cwd: root, shell: true, encoding: "utf8", timeout: cfg.timeoutMs ?? 900_000,
    maxBuffer: 256 * 1024 * 1024, env: { ...process.env, CI: "1" },
  });
  const ms = Date.now() - started;
  if (r.error) die(2, `NOT RUN: run ${i} could not start — ${r.error.message}`);
  if (!existsSync(reportPath)) {
    const tail = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim().split("\n").slice(-20).join("\n");
    die(1, `NOT VERIFIED: run ${i} wrote no report at ${cfg.report} (exit ${r.status}).\n${tail}`);
  }
  const raw = readFileSync(reportPath, "utf8");
  let tests;
  try { tests = cfg.format === "junit" ? parseJunit(raw) : parsePlaywright(JSON.parse(raw)); }
  catch (e) { die(2, `NOT RUN: run ${i} report unreadable — ${e.message}`); }
  const byId = {};
  const unmapped = [];
  for (const t of tests) {
    const id = idOf(t.title);
    if (!id) { unmapped.push(t.title); continue; }
    byId[id] ??= { tests: 0, failed: 0 };
    byId[id].tests++;
    if (!t.ok) byId[id].failed++;
  }
  perRun.push({ run: i, exit: r.status, ms, executed: tests.length, byId, unmapped });
  console.log(`run ${i}/${runs}: exit ${r.status}, ${tests.length} tests executed, ${(ms / 1000).toFixed(1)}s`);
}

const rows = expected.map((id) => {
  const passes = perRun.filter((p) => p.byId[id] && p.byId[id].tests > 0 && p.byId[id].failed === 0).length;
  const missing = perRun.filter((p) => !p.byId[id] || p.byId[id].tests === 0).map((p) => p.run);
  return { id, passes, missing, ok: missing.length === 0 && passes >= perScenario };
});
const cells = rows.length * runs;
const passedCells = rows.reduce((n, r) => n + r.passes, 0);
const rate = cells ? passedCells / cells : 0;
const executedEver = perRun.every((p) => p.executed > 0);

console.log("\nscenario  passes  missing-in-runs");
for (const r of rows) console.log(`${r.id.padEnd(9)} ${String(r.passes).padStart(2)}/${runs}   ${r.missing.length ? r.missing.join(",") : "-"}${r.ok ? "" : "   ✗"}`);
const unmapped = [...new Set(perRun.flatMap((p) => p.unmapped))];
if (unmapped.length) console.log(`\n${unmapped.length} executed test(s) carry no expected id (not counted): ${unmapped.slice(0, 5).join(" | ")}`);

const reasons = [];
if (!executedEver) reasons.push("a run executed zero tests");
const missingAny = rows.filter((r) => r.missing.length);
if (missingAny.length) reasons.push(`not executed: ${missingAny.map((r) => r.id).join(", ")}`);
const below = rows.filter((r) => !r.missing.length && r.passes < perScenario);
if (below.length) reasons.push(`below ${perScenario}/${runs}: ${below.map((r) => r.id).join(", ")}`);
if (rate < overall) reasons.push(`overall ${(rate * 100).toFixed(1)}% < ${(overall * 100).toFixed(0)}%`);

const verdict = reasons.length
  ? `NOT VERIFIED: ${reasons.join("; ")}`
  : `VERIFIED ${rows.filter((r) => r.ok).length}/${rows.length} scenarios, ${(rate * 100).toFixed(1)}% of ${cells} scenario-runs (rule ${perScenario}/${runs}, overall ≥ ${(overall * 100).toFixed(0)}%)`;
console.log(`\n${verdict}`);

const evidence = opt("evidence", "");
if (evidence) {
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).stdout?.trim();
  const dirty = (spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout ?? "").trim().length > 0;
  const file = resolve(root, evidence);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ verdict, revision: head, dirty, at: new Date().toISOString(), runs, perScenario, overall, rows, perRun }, null, 2) + "\n");
  console.log(`evidence → ${evidence}`);
}
process.exit(reasons.length ? 1 : 0);
