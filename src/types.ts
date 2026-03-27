export type ReviewMode = 'session' | 'uncommitted' | 'base' | 'commit';

export interface SessionState {
  repoRoot: string;
  baselineCommitSha: string;
  baselineBranch: string;
  createdAt: string;
  dirtyAtStart: boolean;
  lastReviewAt?: string;
}

export interface CodexPlanInput {
  cwd: string;
  task: string;
  contextPaths?: string[];
  instructions?: string;
  model?: string;
  profile?: string;
}

export interface CodexReviewInput {
  cwd: string;
  mode: ReviewMode;
  instructions?: string;
  base?: string;
  commit?: string;
  paths?: string[];
  model?: string;
  profile?: string;
}

export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  lastMessage?: string;
}

export interface ToolPayload {
  ok: boolean;
  mode: string;
  content: string;
  elapsedMs: number;
  error?: string;
}

export interface RepoStatus {
  repoRoot: string;
  branch: string;
  headSha: string;
  isDirty: boolean;
}
