# Revisión: Uso de OpenCode como backend de AI

El proyecto consume **OpenCode** como backend de AI. Este documento resume cómo se usa y qué capacidades ofrece OpenCode.

---

## Lo que OpenCode ofrece

El **servidor HTTP** de OpenCode permite enviar mensajes indicando **qué agente usar** (por ejemplo `agent: "plan"` o `agent: "build"`). El servidor ejecuta el agente (con tools si aplica) y devuelve la respuesta. En la respuesta, `parts` puede incluir texto, resultados de tools, diffs de archivos, etc.

**Documentación**: [OpenCode Server](https://open-code.ai/en/docs/server) — `POST /session/:id/message` con body que puede incluir `agent`, `model`, `parts`, etc.

---

## Cómo se usa OpenCode en el proyecto hoy

### AiRepository (`src/data/repository/ai_repository.ts`)

- **`ask(ai, prompt)`**  
  Una llamada por turno: crea sesión, envía mensaje con `model` + `parts`, devuelve solo el texto de la respuesta. Se usa para comprobar idioma en comentarios (issue/PR).

- **`askAgent(ai, agentId, prompt, options?)`**  
  Envía el mensaje con **`agent: agentId`** (p. ej. `OPENCODE_AGENT_PLAN`). El servidor OpenCode ejecuta el agente y devuelve la respuesta. Opcionalmente se puede pedir JSON (`expectJson`, `schema`).  
  Uso: descripción de PR, progreso de una issue, detección de errores, recomendación de pasos.

- **`copilotMessage(ai, prompt)`**  
  Usa el agente **build** (`OPENCODE_AGENT_BUILD`). El servidor puede leer y escribir archivos cuando se ejecuta desde el workspace (p. ej. `opencode serve`). Devuelve texto y `sessionId`; el CLI puede llamar a **`getSessionDiff(baseUrl, sessionId)`** para mostrar los cambios.

No existe orquestación propia de agentes: no hay `src/agent/`, ni `askJson`/`askThinkJson`, ni bucles de tools implementados en el repo. Toda la lógica de “agente” (Plan o Build) se delega en OpenCode.

---

## Uso por caso de uso

| Caso | Dónde | API |
|------|--------|-----|
| **Descripción de PR** | `UpdatePullRequestDescriptionUseCase` | `askAgent(ai, OPENCODE_AGENT_PLAN, prompt)` |
| **Comentarios (idioma)** | `CheckIssueCommentLanguageUseCase`, `CheckPullRequestCommentLanguageUseCase` | `ask(ai, prompt)` |
| **Progreso de una issue** | `CheckProgressUseCase` (single action `check_progress`) | `askAgent(ai, OPENCODE_AGENT_PLAN, prompt, { expectJson: true, schema })` |
| **Detección de errores** | `DetectErrorsUseCase` (single action `detect_errors`) | `askAgent(ai, OPENCODE_AGENT_PLAN, prompt)` |
| **Recomendar pasos** | `RecommendStepsUseCase` (single action `recommend_steps`) | `askAgent(ai, OPENCODE_AGENT_PLAN, prompt)` |
| **Copilot (CLI)** | `giik copilot` | `copilotMessage(ai, prompt)` → agente **build**; opcionalmente `getSessionDiff` para ver cambios. |

---

## Delegación al agente Plan

Se usa el **agente Plan de OpenCode** para análisis sin editar código:

- **Descripción de PR**: un único prompt con la descripción de la issue y los cambios genera la descripción de la PR.
- **Progreso**: prompt con descripción de la issue y ficheros/diffs; la respuesta se pide en JSON `{ progress, summary }`.
- **Detección de errores**: se pasa la rama y los cambios frente a la base; el agente devuelve un informe.
- **Recomendar pasos**: a partir de la descripción de la issue, el agente recomienda pasos.

Requisito: el servidor OpenCode debe estar ejecutándose. Las llamadas usan `POST /session/:id/message` con `agent: "plan"`.

### ¿Hay que pasar el diff desde la GitHub Action?

**Sí.** El agente Plan no calcula el diff por nosotros:

1. Plan por defecto no tiene bash: no puede ejecutar `git diff`.
2. No sabe cuál es la rama base (eso lo tiene la Action o la config).
3. En CI el clone puede ser shallow.

Por eso en los use cases **construimos el diff** (GitHub API, `PullRequestRepository.getPullRequestChanges`, `BranchRepository.getChanges`) y lo incluimos en el prompt. Es la opción más portable y segura.

---

## Estado del código

- **`src/agent/`**: **Eliminado.** No hay orquestación local de agentes ni módulos Copilot/ProgressDetector/ErrorDetector/IntentClassifier propios.
- **Comando `giik copilot`**: usa OpenCode con el agente **build** vía `AiRepository.copilotMessage()` y, opcionalmente, `getSessionDiff()` para mostrar cambios en archivos.
