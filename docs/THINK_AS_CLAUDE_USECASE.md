# ThinkAsClaudeUseCase - Documentación Detallada

## 📋 Resumen Ejecutivo

`ThinkAsClaudeUseCase` es un caso de uso que integra el **Anthropic Claude Agent SDK** para realizar análisis profundo de código y proponer cambios de forma sistemática. Utiliza un **"virtual codebase"** en memoria donde los cambios se acumulan antes de aplicarlos, permitiendo razonamiento incremental.

---

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                    ThinkAsClaudeUseCase                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. Preparación                                           │  │
│  │     - Extrae pregunta/descripción del issue/PR            │  │
│  │     - Carga archivos del repositorio                      │  │
│  │     - Inicializa managers (Code, TODO)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  2. Agent SDK Execution                                  │  │
│  │     - Crea herramientas personalizadas (MCP)               │  │
│  │     - Ejecuta query() con Claude Agent SDK                │  │
│  │     - Procesa mensajes del AsyncGenerator                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  3. Procesamiento de Resultados                          │  │
│  │     - Extrae steps, cambios, análisis                    │  │
│  │     - Formatea comentario para GitHub                     │  │
│  │     - Publica comentario en issue/PR                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo Detallado Paso a Paso

### FASE 1: Preparación e Inicialización

```
┌─────────────────────────────────────────────────────────────┐
│ invoke(param: Execution)                                     │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Extracción de Contexto                                    │
│    - issue.isIssueComment → commentBody                      │
│    - pullRequest.isPullRequestReviewComment → commentBody    │
│    - issue.isIssue → description                             │
│    - singleAction.isThinkAction → commentBody o description  │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Validaciones                                               │
│    ✓ ¿Hay pregunta/prompt?                                   │
│    ✓ ¿Hay API key y modelo configurado?                      │
│    ✓ ¿El comentario menciona al bot? (@tokenUser)           │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Carga del Repositorio                                      │
│    fileRepository.getRepositoryContent()                      │
│    ├─ Carga todos los archivos del repositorio               │
│    ├─ Respeta .aiignore                                      │
│    └─ Retorna: Map<filePath, content>                        │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Inicialización de Managers                                 │
│    ├─ ThinkCodeManager                                        │
│    │  └─ Inicializa con archivos originales                  │
│    │     (crea virtual codebase en memoria)                  │
│    │                                                          │
│    ├─ ThinkTodoManager                                        │
│    │  └─ Inicializa lista vacía de TODOs                     │
│    │                                                          │
│    └─ FileSearchService                                       │
│       └─ Construye índice de búsqueda (muy rápido)           │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Construcción de Contexto Simple                           │
│    buildSimpleFileListContext()                              │
│    ├─ NO hace llamadas a AI (muy barato)                     │
│    ├─ Solo agrupa archivos por directorio                    │
│    └─ Retorna: string con lista de archivos                  │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ executeWithAgentSDK() │
        └───────────────────────┘
```

---

### FASE 2: Ejecución con Agent SDK

```
┌─────────────────────────────────────────────────────────────┐
│ executeWithAgentSDK()                                        │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Configuración del SDK                                      │
│    ├─ Extrae API key (ANTHROPIC_API_KEY o OpenRouter)        │
│    ├─ Extrae modelo (ej: "claude-3.5-sonnet")                │
│    └─ Valida que existan ambos                                │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Creación de Herramientas Personalizadas                   │
│    (customTools array)                                        │
│    │                                                          │
│    ├─ read_file                                               │
│    │  └─ Lee del virtual codebase (codeManager)               │
│    │     Muestra estado modificado si hay cambios             │
│    │                                                          │
│    ├─ search_files                                            │
│    │  └─ Busca archivos usando FileSearchService              │
│    │                                                          │
│    ├─ propose_change                                          │
│    │  └─ Aplica cambios al virtual codebase                   │
│    │     ├─ codeManager.applyChange()                         │
│    │     └─ todoManager.autoUpdateFromChanges()               │
│    │                                                          │
│    ├─ manage_todos                                            │
│    │  └─ Crea/actualiza TODOs                                │
│    │     └─ todoManager.createTodo() / updateTodo()          │
│    │                                                          │
│    └─ analyze_code                                            │
│       └─ Documenta hallazgos sobre archivos                   │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Conversión a MCP Tools (Zod Schemas)                      │
│    customTools.map() → mcpTools                               │
│    ├─ Convierte JSON Schema → Zod Schema                     │
│    ├─ Envuelve execute() en formato MCP                      │
│    └─ Crea createSdkMcpServer({ name, tools })               │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Construcción del System Prompt                            │
│    (Muy detallado, ~700 líneas)                               │
│    ├─ Explica VIRTUAL CODEBASE                                │
│    ├─ Explica TODO LIST SYSTEM                                │
│    ├─ Describe herramientas disponibles                       │
│    ├─ Workflow sistemático (4 fases)                          │
│    ├─ Best practices                                         │
│    └─ Quality standards                                       │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Ejecución del Query                                        │
│    query({                                                    │
│      prompt: userPrompt,                                      │
│      options: {                                               │
│        model: modelName,                                     │
│        systemPrompt: systemPrompt,                            │
│        maxTurns: 30,                                          │
│        mcpServers: { 'git-board-flow-tools': mcpServer },    │
│        cwd: process.cwd()                                     │
│      }                                                        │
│    })                                                         │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Procesamiento del AsyncGenerator                          │
│    for await (const message of queryResult) {                │
│      messages.push(message);                                  │
│      │                                                        │
│      if (message.type === 'result') {                        │
│        result = message;                                     │
│        finalMessage = message.result;                        │
│      }                                                        │
│      │                                                        │
│      if (message.type === 'assistant') {                    │
│        // Extrae texto del mensaje                            │
│        finalMessage = extractText(content);                  │
│      }                                                        │
│    }                                                          │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Extracción de Resultados                                  │
│    ├─ steps: trackedSteps (de las herramientas)              │
│    ├─ analyzedFiles: trackedAnalyzedFiles                    │
│    ├─ proposedChanges: trackedProposedChanges               │
│    └─ finalAnalysis: finalMessage o buildSummaryFromSteps()  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Componentes Clave

### 1. ThinkCodeManager (Virtual Codebase)

```
┌─────────────────────────────────────────────────────────────┐
│ ThinkCodeManager                                             │
│                                                               │
│  Estado Interno:                                             │
│  ├─ originalFiles: Map<path, content>  (inmutable)          │
│  ├─ virtualFiles: Map<path, content>   (modificable)        │
│  ├─ appliedChanges: Map<path, ProposedChange[]>             │
│  └─ allAppliedChanges: ProposedChange[]                     │
│                                                               │
│  Flujo de Cambios:                                           │
│                                                               │
│  1. initialize(originalFiles)                                │
│     └─ Copia originalFiles → virtualFiles                    │
│                                                               │
│  2. applyChange(change: ProposedChange)                       │
│     ├─ Lee virtualFiles[change.file_path]                    │
│     ├─ Aplica cambio según change_type:                      │
│     │  ├─ 'create' → Crea archivo nuevo                      │
│     │  ├─ 'modify' → Añade código con marcador               │
│     │  ├─ 'delete' → Marca para eliminación                  │
│     │  └─ 'refactor' → Reemplaza código                     │
│     ├─ Actualiza virtualFiles                                │
│     └─ Registra en appliedChanges                            │
│                                                               │
│  3. getFileContent(path)                                     │
│     └─ Retorna virtualFiles[path] (con cambios aplicados)   │
│                                                               │
│  Ventaja: Los cambios se acumulan en memoria,              │
│           permitiendo razonamiento incremental               │
└─────────────────────────────────────────────────────────────┘
```

**Ejemplo de Flujo Incremental:**

```
Paso 1: read_file("src/utils.ts")
  → Lee archivo original

Paso 2: propose_change({ 
    file_path: "src/utils.ts",
    change_type: "modify",
    suggested_code: "export function newHelper() { ... }"
  })
  → virtualFiles["src/utils.ts"] ahora contiene:
     [código original] + "\n\n// === AI Proposed Modification ===\nexport function newHelper() { ... }"

Paso 3: read_file("src/utils.ts")
  → Lee archivo MODIFICADO (ve el cambio del paso 2)

Paso 4: propose_change({ 
    file_path: "src/utils.ts",
    change_type: "modify",
    suggested_code: "export function anotherHelper() { ... }"
  })
  → virtualFiles["src/utils.ts"] ahora contiene:
     [código original] + [cambio paso 2] + [cambio paso 4]
```

### 2. ThinkTodoManager (Sistema de TODOs)

```
┌─────────────────────────────────────────────────────────────┐
│ ThinkTodoManager                                             │
│                                                               │
│  Estado Interno:                                             │
│  ├─ todos: Map<id, ThinkTodoItem>                           │
│  └─ nextId: number                                            │
│                                                               │
│  Operaciones:                                                │
│                                                               │
│  1. createTodo(content, status)                              │
│     └─ Crea nuevo TODO con ID único (todo_1, todo_2, ...)  │
│                                                               │
│  2. updateTodo(id, { status, notes, ... })                    │
│     └─ Actualiza TODO existente                              │
│                                                               │
│  3. autoUpdateFromChanges(changes)                            │
│     ├─ Busca TODOs activos relacionados con cambios          │
│     ├─ Si TODO está 'pending' → 'in_progress'                │
│     └─ Vincula cambios al TODO                               │
│                                                               │
│  4. getContextForAI()                                         │
│     └─ Genera string con estado de TODOs para el prompt      │
│                                                               │
│  Flujo Típico:                                               │
│                                                               │
│  Paso 1: manage_todos({ action: 'create', content: '...' }) │
│    → Crea TODO con status 'pending'                          │
│                                                               │
│  Paso 2-N: Realiza cambios relacionados                      │
│    → autoUpdateFromChanges() actualiza TODO a 'in_progress' │
│                                                               │
│  Paso Final: manage_todos({ action: 'update', status: 'completed' }) │
│    → Marca TODO como completado                              │
└─────────────────────────────────────────────────────────────┘
```

### 3. Herramientas Personalizadas (MCP Tools)

```
┌─────────────────────────────────────────────────────────────┐
│ Custom Tools → MCP Tools                                     │
│                                                               │
│  Cada herramienta tiene:                                     │
│  ├─ name: string                                             │
│  ├─ description: string                                      │
│  ├─ inputSchema: Zod Schema (convertido de JSON Schema)      │
│  └─ execute: async (args) => {                               │
│        // Lógica de la herramienta                           │
│        // Actualiza codeManager/todoManager                   │
│        // Registra en trackedSteps                            │
│        return result;                                        │
│      }                                                        │
│                                                               │
│  Herramientas:                                               │
│                                                               │
│  1. read_file                                                │
│     └─ codeManager.getFileContent()                           │
│        → Retorna contenido con cambios aplicados             │
│                                                               │
│  2. search_files                                             │
│     └─ fileSearchService.searchFiles()                       │
│        → Retorna lista de archivos que coinciden             │
│                                                               │
│  3. propose_change                                           │
│     ├─ codeManager.hasChangeBeenApplied() (evita duplicados) │
│     ├─ codeManager.applyChange()                             │
│     ├─ todoManager.autoUpdateFromChanges()                   │
│     └─ trackedProposedChanges.push()                         │
│                                                               │
│  4. manage_todos                                             │
│     ├─ create: todoManager.createTodo()                      │
│     └─ update: todoManager.updateTodo()                      │
│                                                               │
│  5. analyze_code                                             │
│     └─ trackedAnalyzedFiles.set()                            │
│        → Documenta hallazgos sobre archivos                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo Completo de Ejecución (Ejemplo)

```
Usuario: "@bot analiza el código y añade validación de email"

┌─────────────────────────────────────────────────────────────┐
│ 1. Preparación                                               │
│    ✓ Extrae: "analiza el código y añade validación de email"│
│    ✓ Carga 150 archivos del repositorio                      │
│    ✓ Inicializa codeManager con 150 archivos                │
│    ✓ Inicializa todoManager (vacío)                          │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Agent SDK Inicia                                          │
│    Claude recibe systemPrompt (instrucciones detalladas)     │
│    Claude recibe userPrompt (tarea del usuario)              │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Fase 1: Discovery & Planning                              │
│                                                               │
│    Claude → manage_todos({                                   │
│      action: 'create',                                       │
│      content: 'Buscar archivos relacionados con validación'   │
│    })                                                        │
│    → TODO creado: todo_1 (pending)                          │
│                                                               │
│    Claude → search_files({ query: 'validation' })            │
│    → Encuentra: ['src/utils/validation.ts', ...]             │
│                                                               │
│    Claude → read_file({ file_path: 'src/utils/validation.ts' })│
│    → Lee contenido original                                  │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Fase 2: Analysis                                          │
│                                                               │
│    Claude → analyze_code({                                   │
│      file_path: 'src/utils/validation.ts',                   │
│      key_findings: 'Contiene validaciones de otros tipos...',│
│      relevance: 'high'                                        │
│    })                                                        │
│    → Documentado en trackedAnalyzedFiles                     │
│                                                               │
│    Claude → read_file({ file_path: 'src/types/user.ts' })    │
│    → Lee para entender estructura de User                     │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Fase 3: Implementation                                    │
│                                                               │
│    Claude → manage_todos({                                   │
│      action: 'update',                                      │
│      todo_id: 'todo_1',                                     │
│      status: 'in_progress'                                   │
│    })                                                        │
│    → TODO actualizado                                        │
│                                                               │
│    Claude → propose_change({                                 │
│      file_path: 'src/utils/validation.ts',                  │
│      change_type: 'modify',                                  │
│      description: 'Añadir función validateEmail',          │
│      reasoning: 'Necesario para validar emails...',          │
│      suggested_code: 'export function validateEmail(...) {...}'│
│    })                                                        │
│    → codeManager.applyChange()                                │
│    → virtualFiles['src/utils/validation.ts'] modificado      │
│    → todoManager.autoUpdateFromChanges()                      │
│                                                               │
│    Claude → read_file({ file_path: 'src/utils/validation.ts' })│
│    → Lee archivo MODIFICADO (ve el cambio aplicado)          │
│                                                               │
│    Claude → propose_change({                                 │
│      file_path: 'src/utils/validation.ts',                  │
│      change_type: 'modify',                                  │
│      description: 'Añadir tests para validateEmail',         │
│      suggested_code: 'describe("validateEmail", ...)'        │
│    })                                                        │
│    → Cambio acumulado sobre el anterior                      │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Fase 4: Completion                                        │
│                                                               │
│    Claude → manage_todos({                                   │
│      action: 'update',                                      │
│      todo_id: 'todo_1',                                     │
│      status: 'completed'                                     │
│    })                                                        │
│    → TODO completado                                         │
│                                                               │
│    Claude genera análisis final                              │
│    → finalMessage = "He añadido validación de email..."     │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Procesamiento de Resultados                               │
│                                                               │
│    Extrae:                                                   │
│    ├─ steps: [                                                │
│    │    { action: 'manage_todos', ... },                     │
│    │    { action: 'search_files', ... },                     │
│    │    { action: 'read_file', ... },                        │
│    │    { action: 'analyze_code', ... },                     │
│    │    { action: 'propose_change', ... },                   │
│    │    ...                                                   │
│    │  ]                                                       │
│    ├─ analyzedFiles: Map {                                  │
│    │    'src/utils/validation.ts' => FileAnalysis           │
│    │  }                                                       │
│    ├─ proposedChanges: [                                     │
│    │    { file_path: 'src/utils/validation.ts', ... },      │
│    │    ...                                                   │
│    │  ]                                                       │
│    └─ finalAnalysis: "He añadido validación..."              │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Formateo y Publicación                                    │
│                                                               │
│    commentFormatter.formatReasoningComment()                  │
│    ├─ Formatea steps, analyzedFiles, proposedChanges        │
│    ├─ Incluye finalAnalysis                                  │
│    └─ Genera markdown para GitHub                            │
│                                                               │
│    issueRepository.addComment()                               │
│    └─ Publica comentario en issue/PR                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Conceptos Clave

### Virtual Codebase vs Sistema de Archivos Real

```
┌─────────────────────────────────────────────────────────────┐
│ Virtual Codebase (ThinkCodeManager)                          │
│                                                               │
│  ✅ Cambios en memoria                                        │
│  ✅ Acumulación incremental                                   │
│  ✅ Razonamiento sobre estado modificado                     │
│  ✅ No afecta archivos reales                                │
│  ✅ Permite "deshacer" mentalmente                            │
│                                                               │
│  Ejemplo:                                                     │
│  ┌─────────────────────────────────────────┐                │
│  │ virtualFiles["utils.ts"] =               │                │
│  │   [original] +                            │                │
│  │   "\n// === AI Proposed ===\n" +         │                │
│  │   [cambio 1] +                            │                │
│  │   "\n// === AI Proposed ===\n" +         │                │
│  │   [cambio 2]                              │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘

vs

┌─────────────────────────────────────────────────────────────┐
│ Sistema de Archivos Real (Agent SDK nativo)                  │
│                                                               │
│  ❌ Escribe directamente al disco                             │
│  ❌ No permite acumulación                                    │
│  ❌ Cada cambio es permanente                                 │
│  ❌ No permite razonamiento incremental                       │
│                                                               │
│  Ejemplo:                                                     │
│  ┌─────────────────────────────────────────┐                │
│  │ FileEdit({                                │                │
│  │   file_path: "utils.ts",                  │                │
│  │   old_string: "...",                      │                │
│  │   new_string: "..."                       │                │
│  │ })                                        │                │
│  │ → Escribe INMEDIATAMENTE al archivo      │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### Dos Niveles de Razonamiento

```
┌─────────────────────────────────────────────────────────────┐
│ Nivel Alto: TODO List (ThinkTodoManager)                    │
│                                                               │
│  "¿Qué tareas principales necesito hacer?"                    │
│                                                               │
│  todo_1: Buscar archivos relacionados                        │
│  todo_2: Analizar estructura de datos                        │
│  todo_3: Implementar validación                              │
│  todo_4: Añadir tests                                        │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Nivel Bajo: Reasoning Steps (trackedSteps)                  │
│                                                               │
│  "¿Cómo cumplo cada tarea?"                                  │
│                                                               │
│  Para todo_1:                                                │
│    step_1: search_files("validation")                        │
│    step_2: read_file("src/utils/validation.ts")              │
│                                                               │
│  Para todo_2:                                                │
│    step_3: read_file("src/types/user.ts")                    │
│    step_4: analyze_code(...)                                 │
│                                                               │
│  Para todo_3:                                                │
│    step_5: propose_change(...)                               │
│    step_6: read_file("src/utils/validation.ts") [ver cambio] │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Configuración y Dependencias

### Variables de Entorno

```bash
ANTHROPIC_API_KEY=sk-ant-...  # API key de Anthropic (opcional, puede usar OpenRouter)
```

### Dependencias Clave

```
@anthropic-ai/claude-agent-sdk  # Agent SDK principal
zod                            # Para schemas de herramientas (peer dependency)
```

### Managers Requeridos

```
ThinkCodeManager    # Virtual codebase
ThinkTodoManager    # Sistema de TODOs
FileSearchService   # Búsqueda de archivos
CommentFormatter    # Formateo de comentarios para GitHub
```

---

## 📊 Métricas y Logging

El caso de uso registra:

- **Inicialización**: Archivos cargados, managers inicializados
- **Herramientas**: Cada llamada a herramienta (read_file, propose_change, etc.)
- **Agent SDK**: Costo, tokens usados, número de turns
- **Resultados**: Steps, archivos analizados, cambios propuestos
- **Errores**: Errores de ejecución con stack traces

Ejemplo de logs:

```
📚 Loaded 150 files from repository
📦 Code manager initialized with 150 files
📋 TODO list initialized (empty)
🤖 Initializing Agent SDK with model: claude-3.5-sonnet
🚀 Starting Agent SDK execution with 5 custom tools...
📊 Repository: 150 files available
📖 [Tool] Reading file: src/utils/validation.ts (modified: false)
✏️ [Tool] Proposed change: modify to src/utils/validation.ts - Añadir función validateEmail
📋 [Tool] Created TODO: todo_1 - Buscar archivos relacionados
✅ Agent SDK execution completed. Steps: 12, Changes: 3
💰 Agent SDK Cost: $0.0234 USD
📊 Usage: 15234 input tokens, 3456 output tokens
📊 Agent SDK Summary: 8 turns, 12 tool calls, 3 changes proposed
✅ Posted reasoning comment to issue #42
```

---

## 🚨 Manejo de Errores

### Fallback Automático

Si el Agent SDK falla o no está disponible:

```
┌─────────────────────────────────────────────────────────────┐
│ Error en Agent SDK                                           │
│   ├─ API key no configurada                                 │
│   ├─ Modelo no válido                                        │
│   ├─ Error de conexión                                       │
│   └─ SDK no instalado                                        │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ useStandardLogicAsFallback()                                 │
│   ├─ Crea NonClaudeAiWrapper                                 │
│   │  └─ Cambia nombre de modelo para evitar detección       │
│   ├─ Llama a ThinkUseCase.invoke()                           │
│   └─ Usa lógica estándar (sin Agent SDK)                     │
└─────────────────────────────────────────────────────────────┘
```

### Validaciones

- ✅ Pregunta/prompt no vacío
- ✅ API key y modelo configurados
- ✅ Comentario menciona al bot
- ✅ Archivos del repositorio cargados correctamente

---

## 🎓 Mejores Prácticas Implementadas

1. **Virtual Codebase**: Permite razonamiento incremental sin afectar archivos reales
2. **Sistema de TODOs**: Organiza tareas de alto nivel
3. **Análisis On-Demand**: No hace análisis pre-costoso, solo cuando se necesita
4. **Tracking Completo**: Registra todos los pasos para transparencia
5. **Fallback Robusto**: Si Agent SDK falla, usa lógica estándar
6. **Formateo Consistente**: Comentarios en GitHub bien formateados
7. **Logging Detallado**: Facilita debugging y monitoreo

---

## 🔍 Puntos de Extensión

### Añadir Nueva Herramienta

```typescript
{
    name: 'nueva_herramienta',
    description: 'Descripción de la herramienta',
    inputSchema: {
        type: 'object',
        properties: {
            param1: { type: 'string' }
        },
        required: ['param1']
    },
    execute: async (args: { param1: string }) => {
        stepCounter++;
        // Lógica de la herramienta
        trackedSteps.push({ ... });
        return { success: true };
    }
}
```

### Modificar System Prompt

Editar la variable `systemPrompt` en `executeWithAgentSDK()` para cambiar el comportamiento del agente.

### Ajustar Configuración del SDK

Modificar `query()` options:
- `maxTurns`: Número máximo de iteraciones
- `maxBudgetUsd`: Presupuesto máximo
- `permissionMode`: Control de permisos
- `allowedTools` / `disallowedTools`: Restricción de herramientas

---

## 📝 Resumen Final

`ThinkAsClaudeUseCase` es un sistema sofisticado que:

1. **Prepara** el contexto (archivos, managers, índices)
2. **Ejecuta** el Agent SDK con herramientas personalizadas
3. **Rastrea** todos los pasos y cambios en un virtual codebase
4. **Procesa** resultados y genera análisis final
5. **Publica** comentario formateado en GitHub

La clave es el **virtual codebase** que permite razonamiento incremental sin afectar archivos reales, combinado con un **sistema de TODOs** que organiza el trabajo en tareas de alto nivel.

