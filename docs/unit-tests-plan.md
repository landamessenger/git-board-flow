# Plan de acción: tests unitarios

Objetivo: añadir todos los tests unitarios que tengan sentido, siguiendo la convención del proyecto (`src/**/__tests__/**/*.test.ts`, Jest).

---

## Limpieza post-eliminación de `/src/agent`

Tras eliminar el directorio del agent, se identificó y eliminó código que ya no tenía referencias en producción:

| Eliminado | Motivo |
|-----------|--------|
| **think_code_manager.ts** | No importado en ningún sitio. |
| **think_todo_manager.ts** | Solo usado por CommentFormatter (eliminado). |
| **comment_formatter.ts** | Solo usado en tests; el flujo think que lo usaba estaba en el agent. |
| **file_import_analyzer.ts** | Solo usado en tests; el flujo think lo usaba en el agent. |
| **file_search_service.ts** | Solo usado en tests; el flujo think lo usaba en el agent. |
| **think_response.ts** (modelo) | Solo usado por los archivos anteriores. Se mantiene **think_response_schema.ts** (usado por ai_repository). |
| Tests de comment_formatter, file_import_analyzer, file_search_service | Eliminados al borrar las clases. |

**Segunda revisión (código muerto adicional):**

| Eliminado | Motivo |
|-----------|--------|
| **ai_response.ts** (modelo) | Interfaz `AiResponse` no importada en ningún sitio; solo se usa `ai_response_schema`. |
| **ai_responses.ts** (graph) | Interfaz `PatchSummary` no usada. |
| **add_project_item_response.ts** (graph) | Interfaz `AddProjectItemResponse` no importada; `project_repository` usa tipo inline. |
| **think_use_case.getIssueDescription** | Método privado nunca llamado. |

**Sistema clásico del agent eliminado (AI + Think JSON):**

| Eliminado | Motivo |
|-----------|--------|
| **ai_response_schema.ts** | Solo lo usaba `askJson`; `askJson` no se llamaba. Eliminado. |
| **askJson** en ai_repository | Obsoleto; eliminado. |
| **think_response_schema.ts** | Solo lo usaba `askThinkJson`; `askThinkJson` no se llama en ningún sitio (era el loop think del agent). Eliminado. |
| **askThinkJson** en ai_repository | Obsoleto; eliminado. |
| **ai_response_schema.test.ts**, **think_response_schema.test.ts** | Eliminados al borrar los schemas. |

---

## 1. Utilidades puras (prioridad alta)

| Módulo | Funciones / comportamiento | Notas |
|--------|----------------------------|--------|
| **version_utils** | `incrementVersion`, `getLatestVersion` | Lógica pura. Casos: Major/Minor/Patch, formato inválido, lista vacía. |
| **content_utils** | `extractVersion`, `extractReleaseType`, `injectJsonAsMarkdownBlock` | Regex y formateo. Sin dependencias. |
| **title_utils** | `extractIssueNumberFromBranch`, `extractIssueNumberFromPush`, `extractVersionFromBranch` | Mockear `logger` para evitar salida en tests. |
| **label_utils** | `branchesForManagement`, `typesForIssue` | Crear `Execution` mínimo con `branches` y llamar con distintos `labels`. |
| **list_utils** | `getRandomElement` | Comprobar que retorna elemento de la lista, `undefined` para `[]`, y que con 1 elemento retorna ese. |

---

## 2. Utilidades con I/O o dependencias (prioridad media)

| Módulo | Qué testear | Notas |
|--------|-------------|--------|
| **yml_utils** | `loadActionYaml`, `getActionInputs`, `getActionInputsWithDefaults` | Mock de `fs.readFileSync` y `path.join` o usar `action.yml` real en repo. |
| **queue_utils** | `waitForPreviousRuns` | Depende de `WorkflowRepository` y timeouts; opcional o test de integración. |

---

## 3. Servicios (lógica aislada)

*(FileImportAnalyzer, FileSearchService y CommentFormatter se eliminaron como código muerto tras quitar `/src/agent`.)*

---

## 4. Manager / Visualización

| Módulo | Qué testear | Notas |
|--------|-------------|--------|
| **ReasoningVisualizer** | `initialize`, `updateIteration`, `createProgressBar` (si se expone o se comprueba vía salida), `getActionEmoji` | Mock de `logger` (logInfo, logSingleLine). |
| **ConfigurationHandler** / markdown handlers | Si tienen lógica de parsing/transformación pura | Revisar si hay funciones puras testeables. |

---

## 5. Use cases (con mocks de repositorios)

| Use case | Estrategia |
|----------|------------|
| **GetReleaseVersionUseCase** | Mock `IssueRepository.getDescription`; comprobar que con descripción válida se usa `extractVersion` y el resultado tiene `releaseVersion`. |
| **GetHotfixVersionUseCase** | Igual con `extractVersion` para Base Version y Hotfix Version. |
| **GetReleaseTypeUseCase** | Mock descripción; comprobar que se usa `extractReleaseType` y el payload tiene `releaseType`. |
| Otros use cases | Valorar según complejidad y dependencias (repositorios, GitHub context). *(ThinkTodoManager se eliminó como código muerto.)* |

---

## 6. Modelos

| Módulo | Qué testear |
|--------|-------------|
| **Result** | Constructor con datos vacíos (defaults) y con campos asignados. ✅ |
| **Config** | Constructor con datos vacíos, con branches, con `branchConfiguration`. ✅ |
| **BranchConfiguration** | Constructor y children recursivos. ✅ |
| *(AI_RESPONSE_JSON_SCHEMA y THINK_RESPONSE_JSON_SCHEMA eliminados como obsoletos; no hay flujo que los use.)* |
| **Branches** | Getter `defaultBranch` con `github.context` mockeado (opcional). |
| Resto de modelos | Principalmente DTOs/interfaces; sin lógica no añadir tests. |

---

## 7. Excluidos (sin tests unitarios o solo E2E)

- **logger.ts**: wrappers de `console`.
- **opencode_server.ts**: HTTP/axios; mejor E2E o tests de integración.
- **queue_utils** (opcional): timeouts y `WorkflowRepository`.
- **Repositories** (ai, branch, file, issue, project, pull_request, workflow): llamadas a GitHub API; tests con mocks de axios son posibles pero más costosos; prioridad baja.
- **Actions** (`github_action`, `local_action`, `common_action`): orquestación y contexto GitHub; E2E o integración.
- **cli.ts**: entrada/salida y commander; E2E.

---

## Orden de implementación

1. **Fase 1**: `version_utils`, `content_utils`, `title_utils` (utils puras + mock logger).
2. **Fase 2**: `label_utils`, `list_utils`.
3. **Fase 3**: `FileImportAnalyzer`, `FileSearchService`.
4. **Fase 4**: *(CommentFormatter eliminado.)*
5. **Fase 5**: `yml_utils` (mock fs), `ReasoningVisualizer` (mock logger).
6. **Fase 6**: Si aplica, 1–2 use cases con mocks (GetReleaseVersion, GetReleaseType, GetHotfixVersion). *(ThinkTodoManager eliminado.)*

---

## Convenciones

- Ubicación: `src/<módulo>/__tests__/<nombre>.test.ts` o junto al archivo en `__tests__`.
- Nombres: `describe` por módulo/función, `it` descriptivo.
- Mocks: Jest `jest.mock()` para logger, fs, repositorios.
- Cobertura: no obsesionarse con 100%; priorizar regresiones y casos límite.
