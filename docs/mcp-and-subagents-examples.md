# Ejemplos Prácticos: MCP y Subagentes

## 1. MCP - Ejemplos de Implementación

### Escenario: Conectar con PostgreSQL

**Sin MCP (Actual):**
```typescript
// Necesitamos crear una herramienta personalizada
class PostgresTool extends BaseTool {
  private db: Database;
  
  constructor() {
    super();
    this.db = new Database(process.env.DATABASE_URL);
  }
  
  getName() { return 'postgres_query'; }
  
  async execute(input: { query: string }) {
    return await this.db.query(input.query);
  }
}

// Registrar manualmente
agent.registerTool(new PostgresTool());
```

**Con MCP:**
```typescript
// Configuración en .mcp.json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres"],
      "env": { "DATABASE_URL": "postgresql://..." }
    }
  }
}

// El agente automáticamente tiene acceso a:
// - postgres:query
// - postgres:list_tables
// - postgres:describe_table
// Sin código adicional!
```

### Cambios Necesarios en el Código:

```typescript
// src/agent/mcp/mcp_client.ts
export class MCPClient {
  private servers: Map<string, MCPServer> = new Map();
  
  async connect(serverConfig: MCPServerConfig) {
    // Conectar a servidor MCP (stdio, HTTP, o SSE)
    const server = await this.createConnection(serverConfig);
    this.servers.set(serverConfig.name, server);
  }
  
  async listTools(serverName: string): Promise<ToolDefinition[]> {
    // Obtener herramientas expuestas por el servidor MCP
    return await this.servers.get(serverName)?.listTools();
  }
  
  async callTool(serverName: string, toolName: string, input: any) {
    // Ejecutar herramienta MCP
    return await this.servers.get(serverName)?.callTool(toolName, input);
  }
}

// src/agent/core/agent.ts - Modificaciones
export class Agent {
  private mcpClient?: MCPClient;
  
  async initializeMCP(configPath: string) {
    this.mcpClient = new MCPClient();
    const config = await loadMCPConfig(configPath);
    
    for (const serverConfig of config.mcpServers) {
      await this.mcpClient.connect(serverConfig);
      
      // Registrar herramientas MCP como herramientas normales
      const tools = await this.mcpClient.listTools(serverConfig.name);
      for (const toolDef of tools) {
        this.registerTool(new MCPTool(this.mcpClient, serverConfig.name, toolDef));
      }
    }
  }
}
```

**Impacto:**
- ✅ **Nuevos archivos**: `mcp_client.ts`, `mcp_server.ts`, `mcp_tool.ts`
- ✅ **Modificaciones**: `agent.ts` (método `initializeMCP`)
- ✅ **Configuración**: `.mcp.json` (nuevo archivo)
- ✅ **Complejidad**: Media-Alta (protocolo JSON-RPC)

---

## 2. Subagentes - Ejemplos de Implementación

### Escenario: Análisis Complejo de Código

**Sin Subagentes (Actual):**
```typescript
// Todo secuencial en un solo agente
const agent = new Agent({...});

// Paso 1: Analizar código
const analysis = await agent.query("Analiza la estructura del código");

// Paso 2: Escribir tests (espera a que termine análisis)
const tests = await agent.query("Escribe tests unitarios");

// Paso 3: Documentar (espera a que terminen tests)
const docs = await agent.query("Escribe documentación");

// Total: ~3 minutos (secuencial)
```

**Con Subagentes:**
```typescript
const mainAgent = new Agent({...});

// Crear 3 subagentes especializados
const analysisAgent = mainAgent.createSubAgent({
  name: "analyzer",
  systemPrompt: "Eres un analizador de código experto",
  tools: [readFileTool, searchFilesTool]
});

const testAgent = mainAgent.createSubAgent({
  name: "tester",
  systemPrompt: "Eres un experto en testing",
  tools: [readFileTool, proposeChangeTool]
});

const docsAgent = mainAgent.createSubAgent({
  name: "documenter",
  systemPrompt: "Eres un experto en documentación",
  tools: [readFileTool, proposeChangeTool]
});

// Ejecutar en paralelo
const [analysis, tests, docs] = await Promise.all([
  analysisAgent.query("Analiza la estructura del código"),
  testAgent.query("Escribe tests unitarios"),
  docsAgent.query("Escribe documentación")
]);

// Total: ~1 minuto (paralelo)
```

### Cambios Necesarios en el Código:

```typescript
// src/agent/core/subagent_manager.ts
export class SubAgentManager {
  private subAgents: Map<string, Agent> = new Map();
  private sharedContext: Context = new Context();
  
  createSubAgent(
    parentAgent: Agent,
    options: SubAgentOptions
  ): Agent {
    const subAgent = new Agent({
      ...parentAgent.options,
      ...options,
      // Compartir contexto con agente padre
      sharedContext: this.sharedContext
    });
    
    this.subAgents.set(options.name, subAgent);
    return subAgent;
  }
  
  async coordinateAgents(
    tasks: Array<{ agent: Agent; task: string }>
  ): Promise<AgentResult[]> {
    // Ejecutar todos los agentes en paralelo
    const results = await Promise.all(
      tasks.map(({ agent, task }) => agent.query(task))
    );
    
    return results;
  }
  
  shareContext(fromAgent: Agent, toAgent: Agent) {
    // Compartir mensajes relevantes entre agentes
    const relevantMessages = this.extractRelevantMessages(fromAgent);
    toAgent.messageManager.addMessages(relevantMessages);
  }
}

// src/agent/core/agent.ts - Modificaciones
export class Agent {
  private subAgentManager?: SubAgentManager;
  
  createSubAgent(options: SubAgentOptions): Agent {
    if (!this.subAgentManager) {
      this.subAgentManager = new SubAgentManager();
    }
    
    return this.subAgentManager.createSubAgent(this, options);
  }
  
  async executeParallel(tasks: Task[]): Promise<AgentResult[]> {
    if (!this.subAgentManager) {
      throw new Error("SubAgentManager not initialized");
    }
    
    const agents = tasks.map(task => 
      this.createSubAgent({
        name: task.name,
        systemPrompt: task.systemPrompt,
        tools: task.tools
      })
    );
    
    return await this.subAgentManager.coordinateAgents(
      agents.map((agent, i) => ({
        agent,
        task: tasks[i].prompt
      }))
    );
  }
}
```

**Impacto:**
- ✅ **Nuevos archivos**: `subagent_manager.ts`, `context_sharing.ts`
- ✅ **Modificaciones**: `agent.ts` (métodos `createSubAgent`, `executeParallel`)
- ✅ **Nuevos tipos**: `SubAgentOptions`, `Task`, `Context`
- ✅ **Complejidad**: Alta (coordinación, compartir contexto)

---

## Comparación de Complejidad

### MCP

**Líneas de código estimadas:**
- `mcp_client.ts`: ~500 líneas
- `mcp_server.ts`: ~300 líneas
- `mcp_tool.ts`: ~200 líneas
- Modificaciones `agent.ts`: ~100 líneas
- **Total: ~1,100 líneas**

**Tiempo de desarrollo:**
- Implementación básica: 1-2 semanas
- Testing y refinamiento: 1 semana
- **Total: 2-3 semanas**

### Subagentes

**Líneas de código estimadas:**
- `subagent_manager.ts`: ~400 líneas
- `context_sharing.ts`: ~300 líneas
- Modificaciones `agent.ts`: ~200 líneas
- **Total: ~900 líneas**

**Tiempo de desarrollo:**
- Implementación básica: 1 semana
- Testing y refinamiento: 1 semana
- **Total: 2 semanas**

---

## Casos de Uso Reales

### MCP - Cuándo lo necesitarías:

1. **Conexión a múltiples bases de datos**
   ```typescript
   // Sin MCP: 3 herramientas custom (PostgresTool, MySQLTool, MongoTool)
   // Con MCP: 3 servidores MCP, sin código adicional
   ```

2. **Integración con APIs externas**
   ```typescript
   // Sin MCP: GitHubTool, SlackTool, JiraTool, etc.
   // Con MCP: Servidores MCP de la comunidad
   ```

3. **Acceso a servicios cloud**
   ```typescript
   // Sin MCP: AWS SDK, GCP SDK, Azure SDK en herramientas custom
   // Con MCP: Servidores MCP oficiales
   ```

### Subagentes - Cuándo lo necesitarías:

1. **Análisis de código grande**
   ```typescript
   // Dividir código en módulos, analizar cada uno en paralelo
   const modules = ['auth', 'api', 'ui', 'db'];
   const agents = modules.map(m => createSubAgent({ task: `Analizar ${m}` }));
   await Promise.all(agents.map(a => a.query(`Analiza módulo`)));
   ```

2. **Generación de múltiples artefactos**
   ```typescript
   // Generar tests, docs, y código en paralelo
   const [tests, docs, code] = await Promise.all([
     testAgent.query("Genera tests"),
     docsAgent.query("Genera docs"),
     codeAgent.query("Genera código")
   ]);
   ```

3. **Tareas independientes**
   ```typescript
   // Múltiples tareas que no dependen entre sí
   const tasks = [
     "Analizar seguridad",
     "Revisar performance",
     "Verificar accesibilidad"
   ];
   await executeParallel(tasks);
   ```

---

## Recomendación Final

### MCP: **Implementar si...**
- ✅ Necesitas conectar con 3+ servicios externos
- ✅ Quieres usar servidores MCP de la comunidad
- ✅ Prefieres estándares sobre soluciones custom
- ✅ Tienes tiempo para implementar (2-3 semanas)

### Subagentes: **Implementar si...**
- ✅ Tareas complejas que se benefician de paralelización
- ✅ Necesitas coordinación automática
- ✅ El agente debe decidir qué delegar
- ✅ Tienes tiempo para implementar (2 semanas)

### Alternativa Actual (Suficiente si...)
- ✅ Solo necesitas herramientas internas
- ✅ Puedes crear herramientas custom cuando lo necesites
- ✅ Las tareas son simples o secuenciales
- ✅ Prefieres simplicidad sobre automatización

---

## Conclusión

Ambas características son **mejoras opcionales** que añaden complejidad pero también capacidades avanzadas. 

**Para la mayoría de casos de uso, el SDK actual es suficiente.** Implementar MCP o Subagentes solo tiene sentido si realmente necesitas estas capacidades específicas.

