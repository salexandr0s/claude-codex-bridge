import type { CodexPlanInput, CodexReviewInput } from './types.js';

function buildPathScopeBlock(paths?: string[]): string {
  if (!paths || paths.length === 0) {
    return '';
  }

  return `Focus paths:\n${paths.map((path) => `- ${path}`).join('\n')}`;
}

export function buildPlanPrompt(input: CodexPlanInput): string {
  const contextBlock = input.contextPaths && input.contextPaths.length > 0
    ? `Priority context paths:\n${input.contextPaths.map((path) => `- ${path}`).join('\n')}`
    : 'Priority context paths:\n- (none specified)';

  const extraInstructions = input.instructions?.trim() ? `Additional instructions:\n${input.instructions.trim()}` : '';

  return [
    'You are Codex acting as a planning specialist for Claude Code.',
    'Create a concise but decision-complete implementation plan for the request below.',
    'Read the repository as needed, but do not modify files or propose write actions.',
    'Ignore sensitive files such as .env*, *.pem, *.key, and obvious secrets paths unless the user explicitly asks for them.',
    '',
    `Task:\n${input.task.trim()}`,
    '',
    contextBlock,
    extraInstructions,
    '',
    'Output format:',
    '- Summary',
    '- Implementation changes',
    '- Tests',
    '- Risks / assumptions',
    '- Keep it in Markdown',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildSessionReviewPrompt(input: CodexReviewInput, scopeDescription: string): string {
  const extraInstructions = input.instructions?.trim() ? `Additional instructions:\n${input.instructions.trim()}` : '';
  const pathScope = buildPathScopeBlock(input.paths);

  return [
    'You are Codex acting as an independent code reviewer for Claude Code.',
    'Review only the work that belongs to the current repo session scope described below.',
    'Use the repository to inspect relevant files and diffs, but do not modify anything.',
    'Do not review unrelated historical changes outside the described baseline.',
    'Ignore sensitive files such as .env*, *.pem, *.key, and obvious secrets paths unless explicitly requested.',
    '',
    'Session scope:',
    scopeDescription,
    '',
    pathScope,
    '',
    extraInstructions,
    '',
    'Output format:',
    '- Verdict',
    '- Findings by severity',
    '- Missing tests / regressions',
    '- Recommended next actions',
    '- Keep it in Markdown',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildScopedReviewPrompt(input: CodexReviewInput): string {
  const extraInstructions = input.instructions?.trim() ? `Additional instructions:\n${input.instructions.trim()}` : '';
  const pathScope = buildPathScopeBlock(input.paths);

  const scopeDescription =
    input.mode === 'uncommitted'
      ? 'Review only staged, unstaged, and untracked changes in the current working tree.'
      : input.mode === 'base'
        ? `Review only the changes in the current repository against base ref: ${input.base ?? '(missing ref)'}.`
        : `Review only the changes introduced by commit: ${input.commit ?? '(missing sha)'}.`;

  return [
    'You are Codex acting as an independent code reviewer for Claude Code.',
    'Use the repository and git metadata as needed, but do not modify anything.',
    'Ignore unrelated changes outside the requested review scope.',
    'Ignore sensitive files such as .env*, *.pem, *.key, and obvious secrets paths unless explicitly requested.',
    '',
    'Review scope:',
    scopeDescription,
    '',
    pathScope,
    '',
    extraInstructions,
    '',
    'Output format:',
    '- Verdict',
    '- Findings by severity',
    '- Missing tests / regressions',
    '- Recommended next actions',
    '- Keep it in Markdown',
  ]
    .filter(Boolean)
    .join('\n');
}
