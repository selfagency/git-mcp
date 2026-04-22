#!/usr/bin/env zx

import { Octokit } from '@octokit/rest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ora from 'ora';

$.verbose = false;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cd(ROOT);

// ---------------------------------------------------------------------------
// Argument validation
// ---------------------------------------------------------------------------

const version = argv._[0];
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: pnpm release <version>   (e.g. pnpm release 1.0.5)');
  process.exit(1);
}

const tag = `v${version}`;

// ---------------------------------------------------------------------------
// Rollback state
//   commitLocal           — release commit exists locally but has not been pushed
//   commitPushed          — release commit has been pushed to origin/main
//   tagPushed             — tag has been pushed and should be deleted on failure
//   releaseWorkflowDone   — GitHub release workflow succeeded for the tag
//   npmPublishDone        — npm publish succeeded; release is fully complete
// ---------------------------------------------------------------------------

let commitLocal = false;
let commitPushed = false;
let tagPushed = false;
let releaseWorkflowDone = false;
let npmPublishDone = false;
let gitCmd = 'git';
let tempNpmConfigDir = '';

/**
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptions & { cwd?: string, encoding?: BufferEncoding }} [options]
 */
function runGit(args, options = {}) {
  const result = spawnSync(gitCmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const details = stderr || stdout || `git ${args.join(' ')} failed with exit code ${result.status}`;
    throw new Error(details);
  }

  return result;
}

/**
 * Run a subprocess attached to the caller's terminal so interactive auth flows
 * like npm OTP or browser-based login handoffs can complete successfully.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptions} [options]
 */
function runInteractive(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    env: process.env,
    ...options,
  });

  if (result.error) {
    throw new Error(`${command} ${args.join(' ')} failed to spawn: ${result.error.message}`);
  }

  if (result.signal) {
    throw new Error(`${command} ${args.join(' ')} was terminated by signal ${result.signal}`);
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function cleanupTempNpmConfig() {
  if (!tempNpmConfigDir) {
    return;
  }

  rmSync(tempNpmConfigDir, { recursive: true, force: true });
  tempNpmConfigDir = '';
}

process.on('exit', () => {
  try {
    cleanupTempNpmConfig();
  } catch {
    // Best-effort cleanup; ignore errors on process exit.
  }
});

/**
 * @param {string} registry
 */
function configureNpmAuth(registry) {
  const defaultUserConfig = resolve(homedir(), '.npmrc');
  const configuredUserConfig = process.env.NPM_CONFIG_USERCONFIG || defaultUserConfig;
  process.env.NPM_CONFIG_USERCONFIG = configuredUserConfig;

  const npmToken = process.env.NPM_TOKEN?.trim();
  if (!npmToken) {
    return;
  }

  let existingConfig = '';
  try {
    existingConfig = readFileSync(configuredUserConfig, 'utf8');
  } catch {
    existingConfig = '';
  }

  process.env.NODE_AUTH_TOKEN ||= npmToken;

  const normalizedRegistry = registry.replace(/\/+$/, '/');
  const registryKey = normalizedRegistry.replace(/^https?:/, '');

  if (existingConfig.includes(`${registryKey}:_authToken=`)) {
    return;
  }

  const authLine = `${registryKey}:_authToken=${npmToken}`;
  tempNpmConfigDir = mkdtempSync(resolve(tmpdir(), 'git-mcp-release-'));

  const tempUserConfig = resolve(tempNpmConfigDir, '.npmrc');
  const prefix = existingConfig.trimEnd();
  writeFileSync(tempUserConfig, `${prefix}${prefix ? '\n' : ''}${authLine}\nalways-auth=true\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  process.env.NPM_CONFIG_USERCONFIG = tempUserConfig;
}

function resolveGitExecutable() {
  const direct = spawnSync('git', ['--version'], { stdio: 'ignore', shell: false });
  if (direct.status === 0) {
    return 'git';
  }

  const locatorCommand = process.platform === 'win32' ? 'where' : 'which';
  const located = spawnSync(locatorCommand, ['git'], { encoding: 'utf8', shell: false });
  if (located.status === 0) {
    const candidate = located.stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(Boolean);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function rollback() {
  if (npmPublishDone) {
    cleanupTempNpmConfig();
    return;
  }
  $.verbose = false;
  try {
    if (tagPushed) {
      rollbackTag();
    }
    if (commitPushed) {
      rollbackPushedCommit();
    } else if (commitLocal) {
      rollbackLocalCommit();
    }
  } catch {
    /* best effort */
  } finally {
    cleanupTempNpmConfig();
  }
}

function rollbackTag() {
  console.log(`\n⚠️  Release failed after tagging. Deleting tag ${tag} from origin and local repo...`);

  const remoteDeleted = tryDeleteRemoteTag();
  const localDeleted = tryDeleteLocalTag();

  if (remoteDeleted || localDeleted) {
    const suffix = releaseWorkflowDone ? ' (GitHub release metadata may still need manual follow-up).' : '.';
    console.log(`↩️  Tag ${tag} rollback complete${suffix}`);
  }
}

function tryDeleteRemoteTag() {
  try {
    runGit(['push', 'origin', '--delete', tag]);
    return true;
  } catch {
    console.error(`❌ Could not delete remote tag ${tag}. Manually run:`);
    console.error(`   git push origin --delete ${tag}`);
    return false;
  }
}

function tryDeleteLocalTag() {
  try {
    runGit(['tag', '-d', tag]);
    return true;
  } catch {
    console.error(`❌ Could not delete local tag ${tag}. Manually run:`);
    console.error(`   git tag -d ${tag}`);
    return false;
  }
}

function rollbackPushedCommit() {
  console.log('\n⚠️  Reverting release commit on origin/main...');
  try {
    runGit(['revert', '--no-edit', 'HEAD']);
    runGit(['push', 'origin', 'main']);
    console.log('↩️  Release commit reverted and pushed. Working tree is clean.');
  } catch {
    console.error('❌ Automatic revert failed. Manually run:');
    console.error('   git revert HEAD && git push origin main');
  }
}

function rollbackLocalCommit() {
  console.log('\n⚠️  Release aborted before push. Resetting local release commit...');
  try {
    runGit(['reset', '--hard', 'HEAD~1']);
    console.log('↩️  Local release commit removed. Working tree restored.');
  } catch {
    console.error('❌ Reset failed. Manually run: git reset --hard HEAD~1');
  }
}

process.on('SIGINT', async () => {
  await rollback();
  process.exit(130);
});
process.on('SIGTERM', async () => {
  await rollback();
  process.exit(143);
});

// ---------------------------------------------------------------------------
// Main — wrapped so any unhandled error triggers rollback
// ---------------------------------------------------------------------------

async function main() {
  const NPM_REGISTRY = process.env.NPM_CONFIG_REGISTRY || 'https://registry.npmjs.org/';
  ensureGitAvailable();
  configureNpmAuth(NPM_REGISTRY);
  await ensureNpmCredentials(NPM_REGISTRY);
  const githubToken = await resolveGithubToken();
  const octokit = new Octokit({ auth: githubToken });
  ensureCleanMainAndSync();
  const { owner, repo } = resolveOwnerRepo();
  await ensureTagIsAvailable(octokit, owner, repo);
  const previousTag = await findPreviousTag(octokit, owner, repo);
  const releaseNotes = await generateReleaseNotes(octokit, owner, repo, previousTag);
  updateReleaseFiles(releaseNotes, previousTag);
  commitAndPushReleaseMetadata();

  const headSha = runGit(['rev-parse', 'HEAD']).stdout.trim();

  // --- Wait for CI workflow -------------------------------------------------

  const shortSha = headSha.slice(0, 7);
  console.log(`🔎 Waiting for CI on ${shortSha}...`);
  // Give GitHub a moment to register the push before we start polling.
  await sleep(10_000);

  const spinner = ora({ text: 'CI: queued' }).start();
  await waitForWorkflow(octokit, 'CI', owner, repo, headSha, spinner);

  // --- Tag + publish --------------------------------------------------------

  console.log(`🏷️  Creating annotated tag ${tag} at ${headSha}...`);

  const tagMessage = [
    `Release ${tag}`,
    releaseNotes,
    previousTag ? `Source: changes from ${previousTag} to ${tag}.` : '',
    `Target commit: ${headSha}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  runGit(['tag', '-a', tag, headSha, '-m', tagMessage]);

  console.log(`🚀 Pushing tag ${tag}...`);
  runGit(['push', 'origin', tag]);
  tagPushed = true;

  // --- Watch the Release workflow ------------------------------------------

  spinner.text = 'Release: waiting for workflow to trigger...';
  spinner.start();
  await waitForWorkflow(octokit, 'Release', owner, repo, headSha, spinner, {
    autoDispatch: false,
    branch: null,
  });

  releaseWorkflowDone = true;
  console.log(`✅ GitHub release complete: ${tag} → ${headSha}`);

  // --- npm publish ----------------------------------------------------------

  console.log('📦 Building package...');
  $.verbose = true;
  await $`pnpm build`;
  $.verbose = false;

  const distTag = version.includes('-') ? 'next' : 'latest';
  console.log(`🚀 Publishing ${tag} to npm (dist-tag: ${distTag})...`);
  // For scoped public packages, --access public is required on first publish; harmless on subsequent publishes.
  const accessFlag = (JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).name || '').startsWith('@')
    ? ['--access', 'public']
    : [];
  runInteractive('npm', ['publish', './dist', '--tag', distTag, '--registry', NPM_REGISTRY, ...accessFlag]);
  npmPublishDone = true;
  cleanupTempNpmConfig();
  console.log(`✅ Published ${tag} to npm.`);
}

function ensureGitAvailable() {
  const resolvedGit = resolveGitExecutable();
  if (!resolvedGit) {
    throw new Error("'git' is required but not found in PATH.");
  }
  gitCmd = resolvedGit;
}

async function ensureNpmCredentials(registry) {
  try {
    await $`npm whoami --registry=${registry}`;
  } catch {
    console.error(`❌ Not logged in to npm (registry: ${registry}).`);
    console.error('   Tips:');
    console.error(`   - Ensure your token is in ${process.env.NPM_CONFIG_USERCONFIG}`);
    console.error('   - File should contain a line like: //registry.npmjs.org/:_authToken=<YOUR_TOKEN>');
    console.error('   - Or export NPM_TOKEN in your environment before running the release script');
    console.error('   - To log in interactively: npm login --registry=https://registry.npmjs.org/');
    throw new Error('npm authentication check failed');
  }
}

async function resolveGithubToken() {
  const envToken = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '';
  if (envToken) {
    return envToken;
  }

  try {
    return (await $`gh auth token`).stdout.trim();
  } catch {
    throw new Error('No GitHub token found. Set GH_TOKEN/GITHUB_TOKEN or run: gh auth login');
  }
}

function ensureCleanMainAndSync() {
  const dirty = runGit(['status', '--porcelain']).stdout.trim();
  if (dirty) {
    throw new Error('Working tree is not clean. Commit or stash changes first.');
  }

  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  if (branch !== 'main') {
    throw new Error(`Must run from 'main'. Current branch: ${branch}`);
  }

  console.log('🔄 Fetching latest refs...');
  runGit(['fetch', 'origin', 'main']);
  runGit(['pull', '--ff-only', 'origin', 'main']);
}

function resolveOwnerRepo() {
  const remoteUrl = runGit(['remote', 'get-url', 'origin']).stdout.trim();
  const repoMatch = remoteUrl.match(/[:/]([^/]+)\/([^/.]+?)(\.git)?$/);
  if (!repoMatch) {
    throw new Error(`Cannot parse owner/repo from remote URL: ${remoteUrl}`);
  }

  const [, owner, repo] = repoMatch;
  return { owner, repo };
}

async function ensureTagIsAvailable(octokit, owner, repo) {
  const localTag = runGit(['tag', '-l', tag]).stdout.trim();
  if (localTag) {
    throw new Error(`Local tag ${tag} already exists.`);
  }

  try {
    await octokit.git.getRef({ owner, repo, ref: `tags/${tag}` });
    throw new Error(`Remote tag ${tag} already exists.`);
  } catch (err) {
    if (err?.status !== 404) {
      throw err;
    }
  }
}

async function findPreviousTag(octokit, owner, repo) {
  const tagsResp = await octokit.paginate(octokit.git.listMatchingRefs, {
    owner,
    repo,
    ref: 'tags/v',
    per_page: 100,
  });

  return (
    tagsResp
      .map(r => r.ref.replace('refs/tags/', ''))
      .filter(t => t !== tag)
      .sort((a, b) => compareSemverTag(a, b))
      .at(-1) ?? ''
  );
}

function compareSemverTag(leftTag, rightTag) {
  const parse = value => value.replace(/^v/, '').split('.').map(Number);
  const [leftMajor, leftMinor, leftPatch] = parse(leftTag);
  const [rightMajor, rightMinor, rightPatch] = parse(rightTag);
  return leftMajor - rightMajor || leftMinor - rightMinor || leftPatch - rightPatch;
}

async function generateReleaseNotes(octokit, owner, repo, previousTag) {
  console.log(`📝 Generating release notes for ${tag}...`);
  const notesResp = await octokit.repos.generateReleaseNotes({
    owner,
    repo,
    tag_name: tag,
    target_commitish: 'main',
    ...(previousTag ? { previous_tag_name: previousTag } : {}),
  });
  return notesResp.data.body?.trim() || '- No notable changes.';
}

function updateReleaseFiles(releaseNotes, previousTag) {
  console.log(`🧩 Updating package.json to ${version}...`);
  const pkgPath = resolve(ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  console.log('🧩 Updating server.json to ${version}...');
  const serverJsonPath = resolve(ROOT, 'server.json');
  const serverJson = JSON.parse(readFileSync(serverJsonPath, 'utf8'));
  serverJson.version = version;
  serverJson.packages[0].version = version;
  writeFileSync(serverJsonPath, JSON.stringify(serverJson, null, 2) + '\n');

  console.log('🧩 Updating CHANGELOG.md...');
  const changelogPath = resolve(ROOT, 'CHANGELOG.md');
  const date = new Date().toISOString().slice(0, 10);
  const heading = `## [${version}] - ${date}`;
  const sourceLine = previousTag ? `\n\n_Source: changes from ${previousTag} to ${tag}._` : '';
  const section = `\n${heading}\n\n${releaseNotes}${sourceLine}\n`;

  const original = readChangelog(changelogPath);
  if (original.includes(heading)) {
    console.log('ℹ️  CHANGELOG already contains this release heading; skipping.');
    return;
  }

  const marker = '## [Unreleased]';
  const markerIndex = original.indexOf(marker);
  const updated =
    markerIndex >= 0
      ? `${original.slice(0, markerIndex + marker.length)}\n${section}${original.slice(markerIndex + marker.length)}`
      : `${original}\n${section}`;
  writeFileSync(changelogPath, updated);
}

function readChangelog(changelogPath) {
  try {
    return readFileSync(changelogPath, 'utf8');
  } catch {
    return '# Change Log\n\n## [Unreleased]\n';
  }
}

function commitAndPushReleaseMetadata() {
  const hasChanges = runGit(['diff', '--name-only', '--', 'package.json', 'server.json', 'CHANGELOG.md']).stdout.trim();
  if (hasChanges) {
    console.log('📦 Committing release metadata changes...');
    runGit(['add', 'package.json', 'server.json', 'CHANGELOG.md']);
    runGit(['commit', '-m', `chore(release): update version and changelog for ${tag}`]);
    commitLocal = true;
  } else {
    console.log('ℹ️  No version/changelog changes detected; nothing to commit.');
  }

  console.log('🚀 Pushing main...');
  runGit(['push', 'origin', 'main']);
  commitPushed = true;
  commitLocal = false;
}

// ---------------------------------------------------------------------------
// Workflow polling
// ---------------------------------------------------------------------------

async function waitForWorkflow(
  octokit,
  name,
  owner,
  repo,
  headSha,
  spinner,
  { timeoutMs = 3_600_000, pollMs = 15_000, autoDispatch = true, branch = 'main' } = {},
) {
  // Resolve the workflow ID by name.
  const workflowsResp = await octokit.actions.listRepoWorkflows({ owner, repo, per_page: 100 });
  const workflow = workflowsResp.data.workflows.find(w => w.name === name);
  if (!workflow) {
    spinner.fail(`${name}: workflow not found in ${owner}/${repo}`);
    throw new Error(`[${name}] workflow not found in ${owner}/${repo}`);
  }

  const deadline = Date.now() + timeoutMs;
  let triggered = false;
  // Track cancelled run IDs so we skip them on subsequent polls.
  const cancelledRunIds = new Set();

  while (Date.now() < deadline) {
    const runsResp = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflow.id,
      ...(branch ? { branch } : {}),
      head_sha: headSha,
      per_page: 10,
    });

    const run = runsResp.data.workflow_runs.find(r => !cancelledRunIds.has(r.id));

    if (!run) {
      if (autoDispatch && !triggered) {
        spinner.text = `${name}: no run found — triggering workflow_dispatch...`;
        await octokit.actions.createWorkflowDispatch({ owner, repo, workflow_id: workflow.id, ref: 'main' });
        triggered = true;
        spinner.text = `${name}: waiting for run to appear...`;
      } else {
        spinner.text = `${name}: waiting for run to appear...`;
      }
    } else if (run.status !== 'completed') {
      const elapsed = Math.round((Date.now() - new Date(run.created_at).getTime()) / 1000);
      spinner.text = `${name}: ${run.status} (${elapsed}s elapsed)`;
    } else if (run.conclusion === 'success') {
      spinner.succeed(`${name}: passed`);
      return;
    } else if (run.conclusion === 'cancelled') {
      cancelledRunIds.add(run.id);
      spinner.text = `${name}: run was cancelled — re-dispatching...`;
      triggered = false;
    } else {
      spinner.fail(`${name}: ${run.conclusion}`);
      throw new Error(`[${name}] conclusion=${run.conclusion}\n   Run: ${run.html_url}`);
    }

    await sleep(pollMs);
  }

  spinner.fail(`${name}: timed out`);
  throw new Error(`[${name}] timed out after ${timeoutMs / 1000}s`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

try {
  await main();
} catch (err) {
  const msg = err?.message ?? String(err);
  if (err instanceof ProcessOutput) {
    await rollback();
    process.exit(err?.exitCode ?? 1);
  } else {
    console.error(`❌ ${msg}`);
  }
  await rollback();
  process.exit(err?.exitCode ?? 1);
}
