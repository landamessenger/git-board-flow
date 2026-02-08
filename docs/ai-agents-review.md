# Revisión: Agentes, subagentes y tools de AI

Revisión de la arquitectura de agentes, subagentes y herramientas para comprobar si son necesarios o generan sobreingeniería, dado que el proyecto consume **OpenCode** como backend de AI.

## Lo que OpenCode sí ofrece (y no estamos usando)

Cuando usas OpenCode por **CLI o interfaz gráfica**, pasa exactamente lo que describes: haces una pregunta sobre el código y OpenCode **responde o aplica los cambios** (igual que un asistente en un chat). Eso es posible porque OpenCode tiene **agentes** (Build, Plan, etc.) con **tools** (editar archivos, bash, etc.) y un bucle que ejecuta el modelo, las tools y vuelve a llamar al modelo hasta tener la respuesta final.

El **servidor HTTP** de OpenCode expone esa misma capacidad. Según la [documentación del Server](https://open-code.ai/en/docs/server):

- **`POST /session/:id/message`** — *"Send a message and wait for response"*
- El body puede incluir: **`agent?`**, `model?`, `noReply?`, `system?`, `tools?`, `parts`.

Es decir: puedes enviar un mensaje **indicando qué agente usar** (por ejemplo `agent: "build"`) y el servidor **espera a que el agente termine** (usando tools, aplicando cambios si hace falta) y te devuelve la respuesta completa. En la respuesta, `parts` puede incluir no solo texto sino también resultados de tools, diffs de archivos, etc.

**Qué hacemos nosotros hoy:** en `ai_repository.ts` solo enviamos `{ model: { providerID, modelID }, parts: [{ type: 'text', text: prompt }] }`. **No** pasamos `agent`. Además, de la respuesta solo extraemos el **texto** (`extractTextFromParts`), ignorando cualquier parte de tipo tool/diff. Resultado: estamos usando OpenCode como **un solo turno de LLM** (prompt → texto), no como el agente completo que usas en la CLI/UI. Toda la orquestación (bucle agente + tools, subagents, etc.) la hemos implementado nosotros por encima.

**Conclusión:** OpenCode **sí** puede actuar “como en la CLI”: pregunta → responde o aplica cambios. Nosotros **no** estamos usando esa vía; por eso da la impresión de que “OpenCode no gestiona los agentes”. La siguiente sección resume el estado actual y las opciones.

---

## Resumen ejecutivo

- **OpenCode** se usa en el proyecto solo como **una llamada LLM** (crear sesión → enviar mensaje con model+parts → leer solo texto de la respuesta). **No** se usa el parámetro `agent` ni se consumen las parts de tipo tool/diff.
- Toda la orquestación (agentes, tools, subagents, reasoning loop) es **propia**: la implementamos nosotros y OpenCode solo responde a cada prompt como modelo.
- Hay **dos patrones** en el código: **(1) simple** (AiRepository directo) y **(2) completo** (Agent + ReasoningLoop + tools ± subagents). Varios casos podrían simplificarse del (2) al (1). Y, en paralelo, **podría explorarse** usar la API de OpenCode con `agent` para que el servidor ejecute el agente completo y así simplificar o sustituir parte de nuestra capa Copilot/Agent.

---

## 1. Cómo se usa OpenCode hoy

### 1.1 AiRepository (capa fina)

- **Ubicación**: `src/data/repository/ai_repository.ts`
- **API**: `ask(ai, prompt)`, `askJson(ai, prompt, schema, ...)`, `askThinkJson(ai, messagesOrPrompt)`
- **Implementación**: HTTP a OpenCode: `POST /session` → `POST /session/:id/message` con `{ model, parts: [{ type: 'text', text: prompt }] }`; se extrae texto de la respuesta.
- **Uso**: Una sola llamada por tarea, sin agentes ni tools.

### 1.2 Agent + ReasoningLoop (nuestra orquestación)

- **Ubicación**: `src/agent/core/` (agent.ts, reasoning_loop.ts, …)
- **Flujo**: Se construye un prompt con historial de mensajes + definiciones de tools; se llama a **AiRepository.askJson** con `AGENT_RESPONSE_SCHEMA` (response + tool_calls); si el modelo devuelve tool_calls, se ejecutan con `ToolExecutor` y se vuelve a llamar al modelo (bucle hasta respuesta final o maxTurns).
- **Conclusión**: OpenCode **no** gestiona agentes ni tools por nosotros; nosotros implementamos el bucle agente–tools y usamos OpenCode solo como modelo.

---

## 2. Uso por caso de uso

| Caso | Dónde se usa | Qué usa | ¿Necesita Agent + tools? |
|------|----------------|---------|---------------------------|
| **Descripción de PR** | `UpdatePullRequestDescriptionUseCase` | **AiRepository.ask()** (y ask en processFile para cada cambio) | No. Ya está bien simplificado. |
| **Comentarios (idioma)** | `CheckIssueCommentLanguageUseCase`, `CheckPullRequestCommentLanguageUseCase` | **AiRepository.ask()** | No. |
| **Progreso de una issue** | `CheckProgressUseCase` (single action `check_progress`) | **ProgressDetector** → Agent + report_progress_tool ± SubagentHandler | Solo si queremos repartir muchos ficheros entre subagents; para pocos ficheros podría ser un solo `askJson`. |
| **Posibles errores en rama** | Solo **tec_tester_commands** (CLI de pruebas) | **ErrorDetector** → Agent + report_errors_tool ± SubagentHandler | No está en el flujo principal. Si se integra, igual que progreso: askJson simple o Agent según tamaño. |
| **Copilot (preguntas / editar código)** | CLI (`copilot`) | **Copilot** → Agent + muchas tools + IntentClassifier + SubagentHandler | Aquí sí tiene sentido Agent + tools (leer/editar archivos, ejecutar comandos, etc.). |
| **Intent “¿aplicar cambios?”** | Solo dentro de **Copilot** | **IntentClassifier** → Agent + report_intent_tool | **Overkill**: es una decisión binaria (apply sí/no + razón). Puede ser un único **askJson** con schema `{ shouldApplyChanges, reasoning, confidence }`. |

---

## 3. Dónde hay posible sobreingeniería o ruido

### 3.1 IntentClassifier

- **Situación**: Un Agent completo (inicialización, system prompt, ReasoningLoop, report_intent_tool, IntentParser) para clasificar si el prompt del usuario pide “aplicar cambios” o no.
- **Propuesta**: Sustituir por **una llamada AiRepository.askJson** con un prompt claro y un schema fijo, por ejemplo:
  - `{ "shouldApplyChanges": boolean, "reasoning": string, "confidence": "low"|"medium"|"high" }`
- **Beneficio**: Se elimina dependencia de Agent, report_intent_tool, IntentParser y AgentInitializer del intent classifier; menos código y menos superficie de fallos.

### 3.2 ProgressDetector (caso sin subagents)

- **Situación**: Siempre se usa un Agent con report_progress_tool. Cuando `useSubAgents === false` o hay pocos ficheros, el agente hace una sola “vuelta” y llama a report_progress.
- **Propuesta (opcional)**: Para el caso “pocos ficheros / sin subagents”, un flujo alternativo: construir un único prompt (issue + lista de cambios/archivos) y **AiRepository.askJson** con schema `{ progress: number, summary: string }`. Mantener Agent + SubagentHandler cuando `useSubAgents` y muchos ficheros.
- **Beneficio**: Menos componentes en el camino crítico del single action “check progress” cuando no hace falta paralelizar.

### 3.3 ErrorDetector

- **Situación**: Solo usado en `tec_tester_commands.ts` (CLI de test), no en la GitHub Action ni en use cases.
- **Propuesta**: Si en el futuro se integra “detectar errores en rama” en el flujo principal, valorar el mismo criterio: para pocos ficheros, **askJson** con schema de lista de errores; para muchos, mantener Agent + subagents.
- **Ruido actual**: Poca (no está en el flujo principal), pero el código existe y debe mantenerse.

### 3.4 PR description y comentarios

- **Situación**: Ya usan solo AiRepository (ask / processFile con ask). No usan Agent ni tools.
- **Conclusión**: Sin cambios; ya están en el nivel adecuado de complejidad.

### 3.5 Copilot

- **Situación**: Muchas tools (read_file, search_files, propose_change, apply_changes, execute_command, etc.), opcionalmente IntentClassifier y SubagentHandler para repartir archivos.
- **Conclusión**: Aquí la complejidad está justificada (asistente que puede leer, buscar, proponer y aplicar cambios). La única simplificación recomendada es **sustituir IntentClassifier por askJson** (ver 3.1).

---

## 4. Estructura actual de “agentes” y herramientas

### 4.1 Módulos de reasoning (cada uno con bastante superficie)

- **Copilot**: agent_initializer, copilot, file_partitioner, subagent_handler, system_prompt_builder, types.
- **ErrorDetector**: agent_initializer, error_detector, error_parser, file_partitioner, file_relationship_analyzer, subagent_handler, summary_generator, system_prompt_builder, types.
- **ProgressDetector**: agent_initializer, file_partitioner, progress_detector, progress_parser, subagent_handler, system_prompt_builder, types.
- **IntentClassifier**: agent_initializer, intent_classifier, intent_parser, system_prompt_builder, types.

Todos siguen el mismo patrón: Agent + system prompt + tools + (opcional) subagents + parser del resultado. Para IntentClassifier ese patrón es desproporcionado.

### 4.2 Builtin tools

- **report_intent_tool**: Solo lo usa IntentClassifier → candidato a eliminar si IntentClassifier pasa a askJson.
- **report_progress_tool**: Lo usa ProgressDetector; necesario mientras Progress use Agent.
- **report_errors_tool**: Lo usa ErrorDetector; necesario mientras ErrorDetector use Agent.
- **read_file_tool, search_files_tool, propose_change_tool, apply_changes_tool, execute_command_tool, manage_todos_tool**: Usados por Copilot (y en algunos casos por Progress/Error/Intent). Mantener.

### 4.3 Core (agent, reasoning_loop, subagent_manager, …)

- **Necesario** para Copilot y, si se mantienen, para ProgressDetector y ErrorDetector con Agent.
- **SubAgentManager** (core): usado por la orquestación de subagents en Copilot, Progress y Error. Si se simplifican Progress/Error en el caso “sin subagents”, se sigue usando en Copilot y en los casos “con subagents”.

---

## 5. Recomendaciones concretas

1. **IntentClassifier → askJson**  
   - Implementar un `classifyIntent(prompt: string)` que use solo `AiRepository.askJson` con un schema fijo.  
   - Eliminar: Agent + report_intent_tool + IntentParser + AgentInitializer del intent classifier (y tests asociados).  
   - Mantener el fallback heurístico actual como respaldo si la llamada falla.

2. **Mantener PR description y comentarios** como están (solo AiRepository).

3. **ProgressDetector**  
   - Opción A: Mantener como está.  
   - Opción B: Para el camino “sin subagents”, ofrecer un modo “simple” con askJson(progress, summary) y usar Agent + subagents solo cuando se active useSubAgents o haya muchos ficheros.

4. **ErrorDetector**  
   - Dejar como está hasta que se integre en el flujo principal; entonces decidir si hace falta solo askJson o Agent + subagents según tamaño del repo/rama.

5. **Copilot**  
   - No reducir herramientas ni subagents; solo reemplazar IntentClassifier por la versión askJson (recomendación 1).

6. **Documentación**  
   - Dejar claro que hoy OpenCode se usa como LLM (una llamada por turno) y que la orquestación es propia del proyecto.

7. **Explorar el agente de OpenCode**  
   - Para el flujo Copilot (pregunta → responde o aplica cambios), probar la API con `agent: "build"` en POST /session/:id/message. El servidor ejecutaría el bucle agente + tools y devolvería la respuesta completa. Habría que interpretar todas las parts (no solo texto) para aplicar cambios en disco. Si funciona, se podría simplificar mucho la capa Copilot delegando en el agente de OpenCode.

---

## 6. Conclusión

- **OpenCode** en CLI/UI sí actúa como pregunta → responde o aplica cambios. Esa capacidad existe en el servidor HTTP (mensaje con `agent`). Nosotros no la usamos: solo enviamos model+parts y leemos texto. Toda la lógica de agentes, tools y subagents es nuestra.
- **Sí hay sobreingeniería** en **IntentClassifier**: un agente completo para una decisión binaria; se puede sustituir por una llamada askJson.
- **El resto** (Progress, Error, Copilot) puede mantenerse, con la opción de simplificar Progress (y en su día Error) en el caso “pocos ficheros / sin subagents” usando askJson en lugar de Agent para ese camino.
- **Descripción de PR y comprobación de idioma** ya están en el nivel adecuado (solo AiRepository).

Próximos pasos posibles: **(1)** Sustituir IntentClassifier por askJson. **(2)** Spike: en Copilot (o un comando de prueba), llamar a OpenCode con `agent: "build"`, pasar el prompt del usuario, y tratar todas las parts de la respuesta para ver si podemos delegar ahí el responde o aplica cambios y simplificar nuestro código.

---

## 7. Delegación al agente Plan (implementado)

Se ha implementado el uso del **agente Plan de OpenCode** para delegar toda la lógica de análisis (sin editar código):

- **Descripción de PR**: `UpdatePullRequestDescriptionUseCase` usa `AiRepository.askAgent(ai, OPENCODE_AGENT_PLAN, prompt)`. Un único prompt con la descripción de la issue y los cambios (patches) genera la descripción de la PR.
- **Progreso de una issue**: `CheckProgressUseCase` usa el agente Plan con un prompt que incluye la descripción de la issue y los ficheros/diffs cambiados; la respuesta se pide en JSON `{ progress, summary }`.
- **Detección de errores**: Nueva single action `detect_errors_action` y `DetectErrorsUseCase`: se pasa la rama de la issue y los cambios frente a la rama base; el agente Plan devuelve un informe de posibles errores. CLI: `detect-errors -i <issue>`.
- **Recomendar pasos al crear una issue**: Nueva single action `recommend_steps_action` y `RecommendStepsUseCase`: a partir de la descripción de la issue, el agente Plan recomienda pasos a seguir. CLI: `recommend-steps -i <issue>`.

Requisito: el servidor OpenCode debe estar ejecutándose y ser capaz de trabajar sobre el path del proyecto (mismo proyecto o acceso al repo) para que el agente tenga contexto. Las llamadas usan `POST /session/:id/message` con `agent: "plan"`.
