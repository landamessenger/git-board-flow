import { RecommendStepsUseCase } from '../recommend_steps_use_case';
import { Ai } from '../../../data/model/ai';
import type { Execution } from '../../../data/model/execution';

jest.mock('../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('../../../utils/task_emoji', () => ({
  getTaskEmoji: jest.fn(() => '💡'),
}));

const mockGetDescription = jest.fn();
jest.mock('../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({
    getDescription: mockGetDescription,
  })),
}));

const mockAskAgent = jest.fn();
jest.mock('../../../data/repository/ai_repository', () => ({
  AiRepository: jest.fn().mockImplementation(() => ({
    askAgent: mockAskAgent,
  })),
  OPENCODE_AGENT_PLAN: 'plan',
}));

function baseParam(overrides: Record<string, unknown> = {}): Execution {
  return {
    owner: 'owner',
    repo: 'repo',
    issueNumber: 42,
    tokens: { token: 'token' },
    ai: new Ai('http://localhost:4096', 'opencode/model', false, false, [], false, 'low', 20),
    ...overrides,
  } as unknown as Execution;
}

describe('RecommendStepsUseCase', () => {
  let useCase: RecommendStepsUseCase;

  beforeEach(() => {
    useCase = new RecommendStepsUseCase();
    mockGetDescription.mockReset();
    mockAskAgent.mockReset();
  });

  it('returns failure when ai has no opencode model or server URL', async () => {
    const param = baseParam({ ai: new Ai('', '', false, false, [], false, 'low', 20) });
    const results = await useCase.invoke(param);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].errors).toContain('Missing OPENCODE_SERVER_URL and OPENCODE_MODEL.');
  });

  it('returns failure when issueNumber is -1', async () => {
    const param = baseParam({ issueNumber: -1 });
    const results = await useCase.invoke(param);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].errors).toContain('Issue number not found.');
  });

  it('returns failure when issue description is empty or missing', async () => {
    mockGetDescription.mockResolvedValue('');
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].errors?.some((e) => String(e).includes('No description found'))).toBe(true);
  });

  it('returns success with recommended steps when AI returns string', async () => {
    mockGetDescription.mockResolvedValue('Implement login feature.');
    mockAskAgent.mockResolvedValue('1. Add auth module\n2. Add tests');
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].steps).toBeDefined();
    expect(results[0].payload?.recommendedSteps).toContain('1. Add auth module');
  });

  it('returns success when AI returns object with steps', async () => {
    mockGetDescription.mockResolvedValue('Fix bug.');
    mockAskAgent.mockResolvedValue({ steps: '1. Reproduce\n2. Fix' });
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(results[0].success).toBe(true);
    expect(results[0].payload?.recommendedSteps).toContain('1. Reproduce');
  });

  it('returns failure when askAgent throws', async () => {
    mockGetDescription.mockResolvedValue('Do something');
    mockAskAgent.mockRejectedValue(new Error('AI error'));
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(results[0].success).toBe(false);
    expect(results[0].errors?.length).toBeGreaterThan(0);
  });
});
