# Plan de acción: tests unitarios

Objetivo: tests unitarios donde tengan sentido. Convención: `src/**/__tests__/**/*.test.ts`, Jest.

---

## Plan de acción (checklist)

| # | Tarea | Estado |
|---|--------|--------|
| 1 | **GetHotfixVersionUseCase** – mock `IssueRepository.getDescription`; éxito con Base Version + Hotfix Version; fallos: description undefined, issue number no determinado, baseVersion/hotfixVersion no encontrados | ✅ Hecho |
| 2 | **GetReleaseVersionUseCase** / **GetReleaseTypeUseCase** – ya implementados | ✅ Hecho |
| 3 | **ThinkUseCase** (opcional) – tests de salidas tempranas: sin URL/modelo OpenCode, pregunta vacía, comentario sin @user (mocks: IssueRepository, ReasoningVisualizer) | Pendiente |
| 4 | **UpdateTitleUseCase** (opcional) – tests con mocks de IssueRepository (getTitle, updateTitleIssueFormat, updateTitlePullRequestFormat); casos: no issue/PR, emojiLabeledTitle false | Pendiente |
| 5 | **Excluidos** – logger, queue_utils, repositories (HTTP), actions, cli → E2E o sin tests unitarios | N/A |

---

## Estado actual de tests (implementados)

| Área | Archivo | Qué cubre |
|------|---------|-----------|
| **Utils** | `version_utils.test.ts` | `incrementVersion`, `getLatestVersion` |
| | `content_utils.test.ts` | `extractVersion`, `extractReleaseType`, `injectJsonAsMarkdownBlock` |
| | `title_utils.test.ts` | `extractIssueNumberFromBranch`, `extractIssueNumberFromPush`, `extractVersionFromBranch` |
| | `label_utils.test.ts` | `branchesForManagement`, `typesForIssue` |
| | `list_utils.test.ts` | `getRandomElement` |
| | `yml_utils.test.ts` | `loadActionYaml`, `getActionInputs`, `getActionInputsWithDefaults` (mock fs) |
| | `reasoning_visualizer.test.ts` | `initialize`, `updateIteration`, `showHeader`, `showCompletion`, `showActionResult` (mock chalk + logger) |
| **Modelos** | `result.test.ts` | Constructor `Result` (defaults y asignación) |
| | `config.test.ts` | Constructor `Config` (vacío, branches, branchConfiguration) |
| | `branch_configuration.test.ts` | Constructor `BranchConfiguration` (recursivo) |
| **Use cases** | `get_release_version_use_case.test.ts` | GetReleaseVersionUseCase con mock de IssueRepository |
| | `get_release_type_use_case.test.ts` | GetReleaseTypeUseCase con mock de IssueRepository |
| | `get_hotfix_version_use_case.test.ts` | GetHotfixVersionUseCase con mock de IssueRepository (Base Version + Hotfix Version) |

---

## Detalle excluidos y opcionales

1. **Opcionales** (ver checklist arriba): ThinkUseCase (salidas tempranas), UpdateTitleUseCase (mocks costosos).

2. **Excluidos** (sin tests unitarios o solo E2E)  
   - **logger.ts**: wrappers de console.  
   - **queue_utils**: timeouts + `WorkflowRepository`; integración/E2E.  
   - **Repositories** (ai, branch, file, issue, project, pull_request, workflow): llamadas HTTP/GitHub; tests con mocks posibles pero costosos.  
   - **Actions** (github_action, local_action, common_action): orquestación y contexto GitHub; E2E.  
   - **cli.ts**: entrada/salida y commander; E2E.

3. **Convenciones**  
   - Ubicación: `src/<módulo>/__tests__/<nombre>.test.ts`.  
   - Mocks: `jest.mock()` para logger, fs, fetch cuando aplique.  
   - Priorizar regresiones y casos límite; no obsesionarse con 100% cobertura.

---

## Limpieza realizada (referencia)

- Eliminación de `/src/agent` y código asociado: think_code_manager, think_todo_manager, comment_formatter, file_import_analyzer, file_search_service, think_response.ts.  
- Código muerto adicional: ai_response.ts, ai_responses.ts, add_project_item_response.ts, getIssueDescription en think_use_case.  
- Sistema AI obsoleto: ai_response_schema, think_response_schema, askJson, askThinkJson.  
- AiRepository: `OpenCodeAgentMessageResult` dejó de exportarse (solo uso interno).
