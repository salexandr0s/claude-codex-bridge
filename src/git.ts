import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { RepoStatus, SessionState } from './types.js';

const execFileAsync = promisify(execFile);

const SENSITIVE_PATH_PATTERNS = [/^\.env(\..+)?$/, /\.pem$/, /\.key$/, /(^|\/)secrets?(\/|$)/i, /credentials?/i];

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

export async function resolveRepoRoot(cwd: string): Promise<string> {
  return runGit(cwd, ['rev-parse', '--show-toplevel']);
}

export async function getRepoStatus(cwd: string): Promise<RepoStatus> {
  const repoRoot = await resolveRepoRoot(cwd);
  const [branch, headSha, status] = await Promise.all([
    runGit(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']),
    runGit(repoRoot, ['rev-parse', 'HEAD']),
    runGit(repoRoot, ['status', '--porcelain']),
  ]);

  return {
    repoRoot,
    branch,
    headSha,
    isDirty: status.length > 0,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export async function getSessionChangedFiles(repoRoot: string, baselineCommitSha: string): Promise<string[]> {
  const committedRaw = await runGit(repoRoot, ['diff', '--name-only', `${baselineCommitSha}..HEAD`]);
  const workingTreeRaw = await runGit(repoRoot, ['diff', '--name-only', 'HEAD']);
  const untrackedRaw = await runGit(repoRoot, ['ls-files', '--others', '--exclude-standard']);

  return unique([...committedRaw.split('\n'), ...workingTreeRaw.split('\n'), ...untrackedRaw.split('\n')]).filter(
    (path) => path && !isSensitivePath(path),
  );
}

export async function getSessionDiffSummary(repoRoot: string, baselineCommitSha: string): Promise<string> {
  const committed = await runGit(repoRoot, ['diff', '--stat', `${baselineCommitSha}..HEAD`]);
  const working = await runGit(repoRoot, ['diff', '--stat', 'HEAD']);
  const parts = [
    committed ? `Committed changes since baseline:\n${committed}` : 'Committed changes since baseline:\n(none)',
    working ? `\nWorking tree changes:\n${working}` : '\nWorking tree changes:\n(none)',
  ];

  return parts.join('\n');
}

export async function describeSessionScope(status: RepoStatus, state: SessionState): Promise<string> {
  const files = await getSessionChangedFiles(status.repoRoot, state.baselineCommitSha);
  const summary = await getSessionDiffSummary(status.repoRoot, state.baselineCommitSha);
  const filesSection = files.length > 0 ? files.map((file) => `- ${file}`).join('\n') : '- (none)';

  return [
    `Repo root: ${status.repoRoot}`,
    `Baseline branch: ${state.baselineBranch}`,
    `Baseline commit: ${state.baselineCommitSha}`,
    `Current branch: ${status.branch}`,
    `Current HEAD: ${status.headSha}`,
    `Baseline created at: ${state.createdAt}`,
    '',
    'Changed files in session scope:',
    filesSection,
    '',
    summary,
  ].join('\n');
}
