#!/usr/bin/env node
/**
 * ship — release a finished repository to GitHub (see ../SKILL.md).
 *
 * Usage:
 *   node ship.mjs --repo <owner>/<name> --version <x.y.z>
 *                 [--description "..."] [--branch main] [--root DIR] [--dry-run]
 *
 * Order, stopping at the first failing stage:
 *   1. preflight  — branch, clean tree, README/LICENSE/CHANGELOG/CI present,
 *                   CHANGELOG has the version, tag absent, secret scan of tracked files
 *   2. repository — create a PRIVATE repo with gh only if it does not exist;
 *                   refuse a repo that exists but is not this checkout's origin
 *   3. push       — never --force
 *   4. tag + release — annotated tag, gh release with the CHANGELOG section
 *   5. report     — print the visibility-flip command, never run it
 *
 * --dry-run runs the preflight and prints the plan. It never calls gh or
 * git push, and needs no network.
 *
 * The pure parts (argument checks, CHANGELOG extraction, secret scan,
 * preflight) are exported so they can be tested without GitHub.
 */
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REQUIRED_FILES = ["README.md", "LICENSE", "CHANGELOG.md", ".github/workflows/ci.yml"];

// A small, deliberately conservative set: each pattern names one credential
// format whose accidental commit is a real leak. A line carrying the marker
// `ship-scan: allow` is skipped (for a documented false positive).
export const SECRET_PATTERNS = [
  [/-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/, "private key block"],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, "AWS access key id"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, "GitHub token"],
  [/\bgithub_pat_[A-Za-z0-9_]{40,}\b/, "GitHub fine-grained token"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, "Anthropic-style API key"],
  [/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/, "sk- style API key"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, "Google API key"],
  [/(?:api[_-]?key|secret|token|passw(?:or)?d|access[_-]?key)["']?\s*[:=]\s*["']?[A-Za-z0-9_\-+/=.]{24,}/i, "credential assignment"],
];
const ALLOW_MARKER = "ship-scan: allow";

/** True for a tracked env file that may hold real values (.env, .env.local, ...), false for examples. */
export function isEnvFile(path) {
  const p = path.replace(/\\/g, "/");
  if (!/(^|\/)\.env(\.[^/]*)?$/.test(p)) return false;
  return !/\.(example|sample|template|dist)$/.test(p);
}

/** Scan one text; returns [{ what, line }] for every line that matches a secret pattern. */
export function scanText(text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    for (const [re, what] of SECRET_PATTERNS) if (re.test(line)) hits.push({ what, line: i + 1 });
  });
  return hits;
}

/** Scan tracked files under root; returns ["path:line: what", ...]. Binary and very large files are skipped. */
export function secretScan(root, files) {
  const hits = [];
  for (const f of files) {
    if (isEnvFile(f)) { hits.push(`${f}: env file is tracked`); continue; }
    let buf;
    try { buf = readFileSync(join(root, f)); } catch { continue; }
    if (buf.length > 2_000_000 || buf.includes(0)) continue;
    for (const h of scanText(buf.toString("utf8"))) hits.push(`${f}:${h.line}: ${h.what}`);
  }
  return hits;
}

/** The body of the "## [<version>]" section of a Keep-a-Changelog file, or null when absent or empty. */
export function extractChangelogSection(changelog, version) {
  const text = changelog.replace(/\r\n/g, "\n");
  const esc = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const head = new RegExp(`^## \\[${esc}\\][^\\n]*$`, "m").exec(text);
  if (!head) return null;
  const rest = text.slice(head.index + head[0].length);
  const next = /^## /m.exec(rest);
  const body = (next ? rest.slice(0, next.index) : rest).trim();
  return body || null;
}

/** Returns an error string for bad --repo / --version, or null. */
export function validateArgs({ repo, version }) {
  if (!repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return "--repo <owner>/<name> is required";
  if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) return "--version <x.y.z> is required";
  return null;
}

/** "owner/name" from a GitHub remote URL (https or ssh), or null. */
export function repoFromRemote(url) {
  if (!url) return null;
  const m = /github\.com[:/]+([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? m[1] : null;
}

function sh(root, cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { ok: false, out: "", err: `${cmd} could not start: ${r.error.message}` };
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

/**
 * Every preflight check, collected rather than stopping at the first, so one
 * run shows everything to fix. Local git only — no network.
 * Returns { errors, files, head, section, tag }.
 */
export function preflight({ root, version, branch = "main" }) {
  const errors = [];
  const tag = `v${version}`;
  const inside = sh(root, "git", ["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok) return { errors: [`${root} is not a git repository`], files: [], head: null, section: null, tag };

  const current = sh(root, "git", ["rev-parse", "--abbrev-ref", "HEAD"]).out;
  if (current !== branch) errors.push(`on branch ${current}, expected ${branch}`);

  const dirty = sh(root, "git", ["status", "--porcelain"]).out;
  if (dirty) errors.push(`working tree not clean:\n${dirty}`);

  for (const f of REQUIRED_FILES) if (!existsSync(join(root, f))) errors.push(`missing ${f}`);

  let section = null;
  if (existsSync(join(root, "CHANGELOG.md"))) {
    section = extractChangelogSection(readFileSync(join(root, "CHANGELOG.md"), "utf8"), version);
    if (!section) errors.push(`CHANGELOG.md has no non-empty "## [${version}]" section`);
  }

  if (sh(root, "git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]).ok) errors.push(`tag ${tag} already exists`);

  const files = sh(root, "git", ["ls-files", "-z"]).out.split("\0").filter(Boolean);
  const hits = secretScan(root, files);
  if (hits.length) errors.push(`secret scan:\n${[...new Set(hits)].join("\n")}`);

  const head = sh(root, "git", ["rev-parse", "HEAD"]);
  if (!head.ok) errors.push("no commit yet");
  return { errors, files, head: head.ok ? head.out : null, section, tag };
}

function parseArgv(argv) {
  const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
  return {
    root: resolve(opt("root", process.cwd())),
    repo: opt("repo"),
    version: opt("version"),
    branch: opt("branch", "main"),
    description: opt("description", ""),
    dry: argv.includes("--dry-run"),
  };
}

function main(argv) {
  const a = parseArgv(argv);
  const fail = (msg) => { console.log(`SHIP STOPPED: ${msg}`); process.exit(1); };
  // In a dry run nothing may reach GitHub: gh and git push are refused here, not just skipped.
  const run = (cmd, args, { allowFail = false } = {}) => {
    if (a.dry && (cmd === "gh" || (cmd === "git" && args[0] === "push"))) fail(`internal: dry run tried to call ${cmd} ${args[0]}`);
    const r = sh(a.root, cmd, args);
    if (!r.ok && !allowFail) fail(`${cmd} ${args.join(" ")} failed\n${r.err || r.out}`);
    return r;
  };

  const bad = validateArgs(a);
  if (bad) fail(bad);

  // 1. Preflight
  const pf = preflight(a);
  if (pf.errors.length) fail(`preflight:\n- ${pf.errors.join("\n- ")}`);
  const { tag, head, section, files } = pf;
  console.log(`preflight ok: ${files.length} tracked files, secret scan clean, ${a.branch}@${head.slice(0, 7)}, ${tag} new`);

  // 2. Repository
  const origin = run("git", ["remote", "get-url", "origin"], { allowFail: true });
  const originRepo = origin.ok ? repoFromRemote(origin.out) : null;
  if (origin.ok && originRepo?.toLowerCase() !== a.repo.toLowerCase()) {
    fail(`origin points at ${origin.out}, not ${a.repo}; refusing to push anywhere else`);
  }
  if (a.dry) {
    console.log(originRepo
      ? `would use origin ${a.repo} (gh repo view not run in a dry run)`
      : `would check GitHub for ${a.repo}: if absent, create it PRIVATE and set it as origin; if present, stop (not this checkout's origin)`);
    console.log(`would push ${a.branch} (no force), create annotated tag ${tag}, and release ${tag} with notes:\n\n${section}\n`);
    console.log("DRY RUN: nothing was sent to GitHub.");
    return;
  }

  let created = false;
  const view = run("gh", ["repo", "view", a.repo, "--json", "url,visibility"], { allowFail: true });
  if (view.ok) {
    if (!originRepo) fail(`${a.repo} already exists on GitHub and is not this checkout's origin; refusing to push into it`);
    const v = JSON.parse(view.out);
    console.log(`repo exists: ${v.url} (${v.visibility})`);
  } else {
    if (origin.ok) fail(`origin is set to ${origin.out} but gh cannot see ${a.repo}: ${view.err}`);
    const args = ["repo", "create", a.repo, "--private", "--source", ".", "--remote", "origin"];
    if (a.description) args.push("--description", a.description);
    run("gh", args);
    created = true;
    console.log(`created PRIVATE repo ${a.repo}`);
  }

  // 3. Push — never force
  run("git", ["push", "-u", "origin", a.branch]);
  console.log(`pushed ${a.branch}`);

  // 4. Tag + release
  run("git", ["tag", "-a", tag, "-m", tag]);
  run("git", ["push", "origin", tag]);
  const notesDir = mkdtempSync(join(tmpdir(), "ship-"));
  const notesFile = join(notesDir, "notes.md");
  writeFileSync(notesFile, section + "\n");
  const rel = run("gh", ["release", "create", tag, "--repo", a.repo, "--title", tag, "--notes-file", notesFile, "--verify-tag"]);
  rmSync(notesDir, { recursive: true, force: true });

  // 5. Report
  const url = JSON.parse(run("gh", ["repo", "view", a.repo, "--json", "url"]).out).url;
  const ci = run("gh", ["run", "list", "--repo", a.repo, "--commit", head, "--json", "url", "--limit", "1"], { allowFail: true });
  const ciUrl = ci.ok && ci.out && ci.out !== "[]" ? JSON.parse(ci.out)[0]?.url : null;
  console.log(`\nSHIPPED ${a.repo} ${tag}${created ? " (new, private)" : ""}`);
  console.log(`commit:  ${head}`);
  console.log(`repo:    ${url}`);
  console.log(`release: ${rel.out}`);
  console.log(`ci:      ${ciUrl ?? `not started yet; check: gh run list --repo ${a.repo} --commit ${head.slice(0, 7)}`}`);
  const visibility = run("gh", ["repo", "view", a.repo, "--json", "visibility", "--jq", ".visibility"], { allowFail: true }).out;
  if (visibility !== "PUBLIC") {
    console.log(`\nVISIBILITY FLIP (not run; only on the owner's explicit yes in chat):\n  gh repo edit ${a.repo} --visibility public --accept-visibility-change-consequences`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
