/**
 * Types and interfaces for Error Detector
 */
import { AgentResult } from '../../types';
/**
 * Standard issue types for code analysis
 * Based on common industry standards (SonarQube, ESLint, PMD, CWE, OWASP)
 */
export declare enum IssueType {
    BUG = "bug",
    LOGIC_ERROR = "logic-error",
    RUNTIME_ERROR = "runtime-error",
    NULL_POINTER = "null-pointer",
    ARRAY_BOUNDS = "array-bounds",
    DIVISION_BY_ZERO = "division-by-zero",
    TYPE_ERROR = "type-error",
    TYPE_MISMATCH = "type-mismatch",
    SECURITY_VULNERABILITY = "security-vulnerability",
    SQL_INJECTION = "sql-injection",
    COMMAND_INJECTION = "command-injection",
    XSS = "xss",
    CSRF = "csrf",
    AUTHENTICATION_BYPASS = "authentication-bypass",
    AUTHORIZATION_BYPASS = "authorization-bypass",
    SENSITIVE_DATA_EXPOSURE = "sensitive-data-exposure",
    INSECURE_DESERIALIZATION = "insecure-deserialization",
    SSRF = "ssrf",
    BUFFER_OVERFLOW = "buffer-overflow",
    INSECURE_CRYPTO = "insecure-crypto",
    WEAK_RANDOM = "weak-random",
    HARDCODED_SECRET = "hardcoded-secret",
    INSECURE_DEPENDENCY = "insecure-dependency",
    PERFORMANCE_ISSUE = "performance-issue",
    MEMORY_LEAK = "memory-leak",
    RESOURCE_LEAK = "resource-leak",
    INEFFICIENT_ALGORITHM = "inefficient-algorithm",
    UNNECESSARY_COMPUTATION = "unnecessary-computation",
    BLOCKING_OPERATION = "blocking-operation",
    CODE_SMELL = "code-smell",
    DEAD_CODE = "dead-code",
    DUPLICATE_CODE = "duplicate-code",
    HIGH_COMPLEXITY = "high-complexity",
    CYCLOMATIC_COMPLEXITY = "cyclomatic-complexity",
    LONG_METHOD = "long-method",
    LONG_PARAMETER_LIST = "long-parameter-list",
    GOD_CLASS = "god-class",
    MAGIC_NUMBER = "magic-number",
    MISSING_ERROR_HANDLING = "missing-error-handling",
    EMPTY_CATCH_BLOCK = "empty-catch-block",
    CONFIGURATION_ERROR = "configuration-error",
    MISCONFIGURATION = "misconfiguration",
    MISSING_CONFIGURATION = "missing-configuration",
    INVALID_CONFIGURATION = "invalid-configuration",
    EXPOSED_CREDENTIALS = "exposed-credentials",
    INSECURE_PERMISSIONS = "insecure-permissions",
    RACE_CONDITION = "race-condition",
    DEADLOCK = "deadlock",
    THREAD_SAFETY = "thread-safety",
    UNSAFE_CONCURRENCY = "unsafe-concurrency",
    DEPRECATED_API = "deprecated-api",
    UNUSED_CODE = "unused-code",
    UNUSED_IMPORT = "unused-import",
    UNUSED_VARIABLE = "unused-variable",
    UNUSED_PARAMETER = "unused-parameter",
    BEST_PRACTICE_VIOLATION = "best-practice-violation",
    CODING_STANDARD_VIOLATION = "coding-standard-violation",
    NAMING_CONVENTION = "naming-convention",
    CODE_STYLE = "code-style",
    CODE_ISSUE = "code-issue"
}
/**
 * Severity levels for detected errors
 */
export declare enum SeverityLevel {
    CRITICAL = "critical",
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low"
}
export interface ErrorDetectionOptions {
    model?: string;
    serverUrl: string;
    personalAccessToken?: string;
    maxTurns?: number;
    repositoryOwner?: string;
    repositoryName?: string;
    repositoryBranch?: string;
    focusAreas?: string[];
    errorTypes?: IssueType[];
    useSubAgents?: boolean;
    maxConcurrentSubAgents?: number;
    targetFile?: string;
    analyzeOnlyTargetFile?: boolean;
    includeDependencies?: boolean;
}
export interface DetectedError {
    file: string;
    line?: number;
    type: IssueType;
    severity: SeverityLevel;
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
