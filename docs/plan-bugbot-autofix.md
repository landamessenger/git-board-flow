# Plan de acción: Bugbot Autofix (corregir vulnerabilidades bajo petición)

Este documento describe el plan para añadir la funcionalidad de **autofix** al bugbot: que el usuario pueda pedir desde una issue o un pull request que se corrijan una o varias vulnerabilidades ya detectadas, y que el bugbot (vía OpenCode) aplique los cambios, ejecute checks (build, test, lint) y, si todo pasa, la GitHub Action haga commit y push de los cambios.

---

## 1. Resumen de requisitos

| Origen | Escenario | Comportamiento esperado |
|--------|-----------|-------------------------|
| **Issue** | Comentario general (ej. "arréglalo", "arregla las vulnerabilidades") | OpenCode interpreta qué vulnerabilidades abiertas debe solucionar. |
| **PR** | Respuesta en el **mismo hilo** del comentario de una vulnerabilidad | El bugbot soluciona **solo** el problema de ese comentario (finding_id del marcador). |
| **PR** | Comentario nuevo mencionando al bot (ej. "arregla X", "arregla todas") | OpenCode interpreta qué vulnerabilidad(es) corregir. |

Restricciones:

- Solo actuar **bajo petición explícita** del usuario; no exceder ese scope.
- Centrarse en uno o varios problemas **detectados** (findings existentes); como máximo añadir tests para validar.
- Tras las correcciones: ejecutar comandos de compilación, test y linter (los que el usuario haya configurado, por ejemplo en rules de AI en el proyecto); si todos pasan, la Action hace **commit y push** de los cambios.

---

## 2. Arquitectura actual relevante

- **Bugbot (detección):** `DetectPotentialProblemsUseCase` → `loadBugbotContext`, `buildBugbotPrompt`, OpenCode agente `plan` → publica findings en issue y/o PR con marcador `<!-- copilot-bugbot finding_id:"id" resolved:true|false -->`.
- **Issue comment:** `IssueCommentUseCase` → `CheckIssueCommentLanguageUseCase`, `ThinkUseCase`. El cuerpo del comentario está en `param.issue.commentBody`.
- **PR review comment:** `PullRequestReviewCommentUseCase` → `CheckPullRequestCommentLanguageUseCase`. El cuerpo en `param.pullRequest.commentBody`; existe `param.pullRequest.commentId` (y en payload de GitHub puede existir `in_reply_to_id` para saber el hilo).
- **OpenCode:** `AiRepository.askAgent` (agente `plan`, solo análisis) y `AiRepository.copilotMessage` (agente `build`, puede editar y ejecutar comandos). OpenCode aplica los cambios **directamente** en su workspace (mismo cwd que el runner cuando el servidor se arranca desde el repo); no se usa lógica de diffs.
- **Workflows:** `copilot_issue_comment.yml` (issue_comment created/edited), `copilot_pull_request_comment.yml` (pull_request_review_comment created/edited).

---

## 3. Plan de tareas (orden sugerido)

### Fase 1: Detección de intención “arreglar” y contexto de findings

1. **Definir “petición de fix”**
   - Crear utilidad (ej. `src/usecase/steps/commit/bugbot/parse_fix_request.ts` o dentro de un nuevo step):
     - Entrada: texto del comentario (`commentBody`).
     - Salida: `{ isFixRequest: boolean; intent?: 'fix_one' | 'fix_some' | 'fix_all'; findingId?: string }`.
   - Considerar frases en español/inglés: "arréglalo", "arregla", "fix it", "fix this", "fix vulnerability X", "fix all", "corrige", etc., y opcionalmente mención al bot (e.g. @copilot).

2. **Exponer comentario y tipo de evento en Execution**
   - Ya existe: `param.issue.commentBody` (issue_comment), `param.pullRequest.commentBody` (pull_request_review_comment).
   - Asegurar que en `github_action.ts` / `local_action.ts` el payload de `issue_comment` y `pull_request_review_comment` se pasa correctamente para que `Issue`/`PullRequest` tengan `commentBody` y `commentId`.

3. **En PR: obtener finding_id cuando el comentario es respuesta en un hilo**
   - Añadir en modelo/repositorio lo necesario para saber “comentario padre” en PR:
     - GitHub REST para review comment incluye `in_reply_to_id`. Añadir en `PullRequest` (o en el payload que construye la action) el campo `commentInReplyToId` (o leerlo de `github.context.payload.pull_request_review_comment?.in_reply_to_id` o equivalente).
   - En `PullRequestRepository`: método para obtener un review comment por id (o listar y filtrar por id). Con el id del comentario padre, obtener su `body` y extraer `finding_id` con `parseMarker(body)` (de `bugbot/marker.ts`). Así, si el usuario responde en el mismo hilo, tenemos el `finding_id` sin ambigüedad.
   - Si `commentInReplyToId` existe y el padre tiene marcador bugbot → `intent = 'fix_one'` y `findingId = <id del marcador>`.

4. **Integrar detección en flujos de comentarios**
   - **Issue comment:** al inicio de `IssueCommentUseCase`, si `isFixRequest(commentBody)` y hay issue number:
     - Cargar `loadBugbotContext(param)` para tener `existingByFindingId` y lista de findings no resueltos.
     - Si intent es “fix_one” y se proporciona findingId (ej. por referencia en el texto), usar ese id; si es “fix_some”/“fix_all”, OpenCode decidirá más adelante qué ids abordar.
   - **PR review comment:** igual en `PullRequestReviewCommentUseCase`: si es fix request, cargar bugbot context; si es respuesta en hilo con padre con marcador, fijar `findingId` único.

5. **Comprobar que el comentario es del usuario correcto**
   - Solo reaccionar a comentarios de usuarios autorizados (misma lógica que en otros use cases: token user, permisos, o “solo miembros”). No ejecutar autofix si el comentario es del propio bot.

---

### Fase 2: Nuevo caso de uso “Bugbot Autofix”

6. **Crear `BugbotAutofixUseCase` (o `FixBugbotFindingsUseCase`)**
   - Ubicación sugerida: `src/usecase/steps/commit/bugbot/fix_findings_use_case.ts` (o `src/usecase/actions/bugbot_autofix_use_case.ts` si se considera single action).
   - Entradas (derivadas de Execution + resultado de “parse fix request”):
     - `param: Execution`
     - `targetFindingIds: string[]` (ids a corregir; puede ser uno o varios; si “fix_all”, todos los no resueltos de `loadBugbotContext`).
     - Opcional: comandos de verificación (build, test, lint) — ver Fase 3.
   - Flujo alto nivel:
     1. Cargar `loadBugbotContext(param)` si no se hizo antes.
     2. Filtrar findings a corregir por `targetFindingIds` (y que existan en `existingByFindingId` y no estén ya resueltos).
     3. Construir **prompt para el agente build** de OpenCode con:
        - Repo, branch, issue number, PR number (si aplica).
        - Lista de findings a corregir (id, title, description, file, line, severity, suggestion).
        - Instrucciones estrictas: solo tocar lo necesario para esos findings; como máximo añadir tests que validen el arreglo; no cambiar código fuera de ese scope.
        - Especificar que debe ejecutar los comandos de verificación (build, test, lint) que se le pasen y solo considerar el fix exitoso si todos pasan.
     4. Llamar a `AiRepository.copilotMessage(param.ai, prompt)` (agente **build**). OpenCode aplica los cambios directamente en el workspace.
     5. Si la respuesta indica éxito: los cambios ya están en disco. Devolver resultado “listo para commit” (los archivos modificados se detectan después con `git status` / `git diff --name-only` en el step de commit).
     6. No se usa `getSessionDiff` ni ninguna lógica de diffs.

7. **Construcción del prompt de autofix**
   - Nuevo módulo o función: `buildBugbotFixPrompt(param, context, targetFindingIds, verifyCommands)`.
   - Incluir en el prompt:
     - Los findings seleccionados (id, title, description, file, line, suggestion).
     - Repo, branch, issue, PR.
     - Reglas: solo corregir esos problemas; permitir solo tests adicionales para validar; **ejecutar en el workspace** los comandos de verificación (build, test, lint) que se le pasen y solo considerar el fix exitoso si todos pasan.
   - OpenCode build agent ejecuta build/test/lint en su entorno; tras su ejecución, el runner puede opcionalmente re-ejecutar los mismos comandos como verificación antes de commit.

---

### Fase 3: Comandos de verificación (build, test, lint)

8. **Inputs de configuración**
   - Añadir en `action.yml` (y `constants.ts`, `github_action.ts`, opcionalmente CLI):
     - `bugbot-fix-verify-commands`: string (ej. lista separada por comas o newline: `npm run build`, `npm test`, `npm run lint`). Por defecto puede ser vacío o un valor por defecto razonable.
   - Esos comandos se incluyen en el **prompt** de OpenCode para que el agente build los ejecute en su workspace. Opcionalmente el runner puede volver a ejecutarlos tras OpenCode como verificación adicional antes de commit.

9. **Ejecución de checks**
   - OpenCode (agente build) ejecuta build/test/lint según el prompt. Si fallan, OpenCode puede indicarlo en la respuesta.
   - Opcionalmente, el runner ejecuta en orden los mismos comandos configurados después de que OpenCode termine (los cambios ya están en disco).
   - Si alguno falla: no hacer commit; reportar en comentario (issue o PR) que el fix no pasó los checks.
   - Si todos pasan: proceder a commit y push.

---

### Fase 4: Commit y push (OpenCode aplica siempre en disco)

**Enfoque:** OpenCode aplica los cambios **siempre directamente** en su workspace (el servidor debe arrancarse desde el directorio del repo, p. ej. `opencode-start-server: true` con `cwd: process.cwd()`). No se usa en ningún caso la API de diffs (`getSessionDiff`) ni lógica para aplicar parches en el runner.

10. **Flujo en el runner**
    - Checkout del repo y, si aplica, arranque de OpenCode con `cwd: process.cwd()`.
    - Tras `copilotMessage` (build agent), los cambios **ya están** en el árbol de trabajo.
    - Ejecutar los comandos de verificación (Fase 3) si se configuraron; si fallan, no hacer commit.
    - Para saber qué archivos commitear: usar **git** (`git status --short`, `git diff --name-only`, etc.), no la API de OpenCode.

11. **Commit y push**
    - Tras verificar que los checks pasan:
      - `git add` de los archivos modificados (según salida de git).
      - `git commit` con mensaje según convenio (ej. prefijo de branch + “fix: resolve bugbot findings …”).
      - `git push` al mismo branch.
    - Si no hay cambios (git no muestra archivos modificados), no hacer commit.

12. **Manejo de errores**
    - Si build/test/lint fallan: no commit; comentar en issue/PR con el log.
    - Si push falla (ej. conflicto): comentar y reportar al usuario.

---

### Fase 5: Integración en los flujos Issue Comment y PR Review Comment

14. **IssueCommentUseCase**
    - Después de los steps actuales (idioma, think), o como step condicional al inicio:
      - Si el comentario es de tipo “fix request” y OpenCode está configurado y hay issue number:
        - Resolver `targetFindingIds` (uno, varios o todos desde `loadBugbotContext`).
        - Invocar `BugbotAutofixUseCase` (o el nombre elegido) con `param` y `targetFindingIds`.
        - Si el use case devuelve “éxito y cambios listos”, ejecutar verify commands (si aplica), luego commit y push (los cambios ya están en disco).
        - Opcional: postear comentario en la issue resumiendo qué se corrigió y que se hizo commit.

15. **PullRequestReviewCommentUseCase**
    - Igual que arriba, pero:
      - Si el comentario es respuesta en un hilo cuyo padre tiene marcador bugbot, usar ese `finding_id` como único target (no interpretar “todas” a menos que sea un comentario de nivel PR, no respuesta).
      - Tras commit/push, opcionalmente marcar el hilo de revisión como resuelto (`resolvePullRequestReviewThread`) y/o actualizar el comentario del finding a `resolved: true` (reutilizar lógica de `markFindingsResolved`).

16. **Marcar findings como resueltos tras autofix**
    - Después de un commit exitoso de autofix, llamar a `markFindingsResolved` con los `targetFindingIds` que se corrigieron (y el mismo `context` actualizado si hace falta recargar), para que los comentarios en issue y PR pasen a `resolved: true`.

---

### Fase 6: Configuración, documentación y pruebas

17. **Constantes y action.yml**
    - `INPUT_KEYS.BUGBOT_FIX_VERIFY_COMMANDS` (o nombre elegido).
    - `action.yml`: descripción del nuevo input y default.
    - Si se añade un single action explícito “bugbot_autofix”, registrar en `ACTIONS` y en `SingleAction`; en ese caso el flujo también podría dispararse por workflow con `single-action: bugbot_autofix`. No es estrictamente necesario si el autofix solo se dispara por comentarios.

18. **Documentación**
    - Actualizar `docs/features.mdx` (o equivalente) con:
      - Cómo pedir un fix en una issue (ej. “arréglalo”, “arregla la vulnerabilidad X”).
      - Cómo pedirlo en un PR: respondiendo en el hilo de un finding vs. comentario nuevo.
      - Configuración de `bugbot-fix-verify-commands`.
    - Añadir en `docs/troubleshooting.mdx` casos típicos: “el bot no reaccionó” (¿es fix request?, ¿OpenCode configurado?), “el commit no se hizo” (checks fallaron, conflictos).

19. **Tests**
    - Unit tests para:
      - `parseFixRequest(commentBody)`: distintos textos (español/inglés, fix one/all, sin intención).
      - `buildBugbotFixPrompt`: que incluya los findings y las restricciones de scope.
      - Lógica de “obtener finding_id del comentario padre” en PR (mock de repo).
    - Tests de integración o E2E opcionales: comentar en issue/PR y verificar que no se rompe el flujo; con mocks de OpenCode y de git.

20. **Límites y seguridad**
    - No ejecutar autofix si no hay findings objetivo (lista vacía tras filtrar).
    - Respetar `ai-members-only` / permisos existentes para comentarios.
    - Timeout: el agente build puede tardar; mantener `OPENCODE_REQUEST_TIMEOUT_MS` o un valor específico para autofix si se quiere mayor margen.
    - Rate limiting: si hay muchos comentarios “arréglalo” en poco tiempo, considerar no encolar múltiples autofix seguidos (o dejarlo para una iteración posterior).

---

## 4. Orden de implementación sugerido (resumen)

1. Utilidad de detección de “fix request” y tests.
2. Soporte en PR para “comentario padre” y extracción de `finding_id` del hilo.
3. Inputs y configuración de comandos de verificación.
4. `BugbotAutofixUseCase`: prompt, llamada a `copilotMessage` (OpenCode aplica cambios en disco).
5. Lógica de commit y push (detectar cambios con git, ejecutar verify commands, luego commit/push).
6. Integración en `IssueCommentUseCase` y `PullRequestReviewCommentUseCase`.
7. Marcar findings como resueltos tras autofix exitoso.
8. Documentación y ajustes en workflows (permisos de push en el job).
9. Revisión de límites, permisos y mensajes al usuario.

---

## 5. Archivos clave a tocar (referencia)

| Área | Archivos |
|------|----------|
| Detección fix request | Nuevo: `src/usecase/steps/commit/bugbot/parse_fix_request.ts` (o similar) |
| Contexto PR (reply) | `src/data/model/pull_request.ts`, `src/actions/github_action.ts`, `src/data/repository/pull_request_repository.ts` |
| Autofix use case | Nuevo: `src/usecase/steps/commit/bugbot/fix_findings_use_case.ts` (o en `usecase/actions/`) |
| Prompt fix | Nuevo: `src/usecase/steps/commit/bugbot/build_bugbot_fix_prompt.ts` |
| Commit/push | Nuevo step o helper: detectar cambios con git, ejecutar verify commands, luego git add/commit/push |
| Config | `action.yml`, `src/utils/constants.ts`, `src/actions/github_action.ts`, `src/data/model/ai.ts` (si se guardan comandos de verify en Ai) |
| Integración | `src/usecase/issue_comment_use_case.ts`, `src/usecase/pull_request_review_comment_use_case.ts` |
| Resolver hilo / marcar resueltos | `mark_findings_resolved_use_case.ts`, `pull_request_repository.resolvePullRequestReviewThread` |
| Docs | `docs/features.mdx`, `docs/troubleshooting.mdx` |

---

## 6. Notas

- **OpenCode aplica siempre en disco:** el servidor debe ejecutarse desde el directorio del repo (p. ej. `opencode-start-server: true`). No se usa `getSessionDiff` ni lógica de diffs en ningún flujo (incluido el comando `copilot do`).
- **OpenCode build agent:** edita archivos y ejecuta build/test/lint en su workspace según el prompt; tras su ejecución, el runner solo comprueba con git qué cambió, opcionalmente re-ejecuta verify commands y hace commit/push.
- **Branch en el runner:** en issue_comment el branch puede no estar claro; puede ser necesario obtener el branch asociado a la issue (convención de nombre o API de GitHub) para hacer checkout y push.
- **Permisos del job:** el job que hace push debe tener permisos de escritura (e.g. `contents: write` en el workflow).

Con este plan se cubre la detección de la petición, el scope (uno/varios/todos), la ejecución de OpenCode (cambios directos en disco), la verificación con build/test/lint y el commit/push por la Action, sin exceder el scope definido por el usuario.
