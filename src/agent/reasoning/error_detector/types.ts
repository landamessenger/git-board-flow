/**
 * Types and interfaces for Error Detector
 */

import { AgentResult } from '../../types';

/**
 * Standard issue types for code analysis
 * Based on common industry standards (SonarQube, ESLint, PMD, CWE, OWASP)
 */
export enum IssueType {
  // Bugs and Logic Errors
  BUG = 'bug',
  LOGIC_ERROR = 'logic-error',
  RUNTIME_ERROR = 'runtime-error',
  NULL_POINTER = 'null-pointer',
  ARRAY_BOUNDS = 'array-bounds',
  DIVISION_BY_ZERO = 'division-by-zero',
  TYPE_ERROR = 'type-error',
  TYPE_MISMATCH = 'type-mismatch',
  
  // Security Issues
  SECURITY_VULNERABILITY = 'security-vulnerability',
  SQL_INJECTION = 'sql-injection',
  COMMAND_INJECTION = 'command-injection',
  XSS = 'xss',
  CSRF = 'csrf',
  AUTHENTICATION_BYPASS = 'authentication-bypass',
  AUTHORIZATION_BYPASS = 'authorization-bypass',
  SENSITIVE_DATA_EXPOSURE = 'sensitive-data-exposure',
  INSECURE_DESERIALIZATION = 'insecure-deserialization',
  SSRF = 'ssrf',
  BUFFER_OVERFLOW = 'buffer-overflow',
  INSECURE_CRYPTO = 'insecure-crypto',
  WEAK_RANDOM = 'weak-random',
  HARDCODED_SECRET = 'hardcoded-secret',
  INSECURE_DEPENDENCY = 'insecure-dependency',
  
  // Performance Issues
  PERFORMANCE_ISSUE = 'performance-issue',
  MEMORY_LEAK = 'memory-leak',
  RESOURCE_LEAK = 'resource-leak',
  INEFFICIENT_ALGORITHM = 'inefficient-algorithm',
  UNNECESSARY_COMPUTATION = 'unnecessary-computation',
  BLOCKING_OPERATION = 'blocking-operation',
  
  // Code Quality Issues
  CODE_SMELL = 'code-smell',
  DEAD_CODE = 'dead-code',
  DUPLICATE_CODE = 'duplicate-code',
  HIGH_COMPLEXITY = 'high-complexity',
  CYCLOMATIC_COMPLEXITY = 'cyclomatic-complexity',
  LONG_METHOD = 'long-method',
  LONG_PARAMETER_LIST = 'long-parameter-list',
  GOD_CLASS = 'god-class',
  MAGIC_NUMBER = 'magic-number',
  MISSING_ERROR_HANDLING = 'missing-error-handling',
  EMPTY_CATCH_BLOCK = 'empty-catch-block',
  
  // Configuration Issues
  CONFIGURATION_ERROR = 'configuration-error',
  MISCONFIGURATION = 'misconfiguration',
  MISSING_CONFIGURATION = 'missing-configuration',
  INVALID_CONFIGURATION = 'invalid-configuration',
  EXPOSED_CREDENTIALS = 'exposed-credentials',
  INSECURE_PERMISSIONS = 'insecure-permissions',
  
  // Concurrency Issues
  RACE_CONDITION = 'race-condition',
  DEADLOCK = 'deadlock',
  THREAD_SAFETY = 'thread-safety',
  UNSAFE_CONCURRENCY = 'unsafe-concurrency',
  
  // Deprecated and Maintenance
  DEPRECATED_API = 'deprecated-api',
  UNUSED_CODE = 'unused-code',
  UNUSED_IMPORT = 'unused-import',
  UNUSED_VARIABLE = 'unused-variable',
  UNUSED_PARAMETER = 'unused-parameter',
  
  // Best Practices
  BEST_PRACTICE_VIOLATION = 'best-practice-violation',
  CODING_STANDARD_VIOLATION = 'coding-standard-violation',
  NAMING_CONVENTION = 'naming-convention',
  CODE_STYLE = 'code-style',
  
  // Generic fallback
  CODE_ISSUE = 'code-issue'
}

export interface ErrorDetectionOptions {
  model?: string;
  apiKey: string;
  maxTurns?: number;
  repositoryOwner?: string;
  repositoryName?: string;
  repositoryBranch?: string; // Branch to analyze (default: will be detected)
  focusAreas?: string[]; // Specific areas to focus on (e.g., ['src/agent', 'src/utils'])
  errorTypes?: IssueType[]; // Types of errors to look for (default: all)
  useSubAgents?: boolean; // Use subagents to parallelize file reading (default: false)
  maxConcurrentSubAgents?: number; // Maximum number of subagents to run in parallel (default: 5)
  targetFile?: string; // Specific file to analyze
  analyzeOnlyTargetFile?: boolean; // If true, analyze only the target file (ignore consumers/dependencies). If false and targetFile is set, analyze target + consumers (default: false)
  includeDependencies?: boolean; // If true, also analyze files that the targetFile depends on (only used if analyzeOnlyTargetFile is false, default: false)
}

export interface DetectedError {
  file: string;
  line?: number;
  type: IssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion?: string;
}

export interface ErrorDetectionResult {
  errors: DetectedError[];
  summary: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byType: Record<string, number>;
  };
  agentResult: AgentResult;
}

