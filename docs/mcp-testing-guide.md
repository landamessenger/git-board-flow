# Guía de Testing MCP

## Comandos CLI Disponibles

### 1. `agent:test-mcp-config`
Test MCP con archivo de configuración `.mcp.json`

```bash
node build/cli/index.js agent:test-mcp-config
```

**Opciones:**
- `-c, --config <path>`: Ruta al archivo de configuración MCP (default: `.mcp.json`)
- `-p, --prompt <prompt>`: Prompt de prueba (default: "List available tools")
- `-m, --model <model>`: Modelo de OpenRouter
- `-k, --api-key <key>`: API key de OpenRouter

**Ejemplo:**
```bash
node build/cli/index.js agent:test-mcp-config -c .mcp.json -p "List all available tools"
```

### 2. `agent:test-mcp-stdio`
Test conexión MCP vía stdio transport

```bash
node build/cli/index.js agent:test-mcp-stdio
```

**Opciones:**
- `-c, --command <command>`: Comando del servidor MCP (default: `node`)
- `-a, --args <args...>`: Argumentos del comando
- `-p, --prompt <prompt>`: Prompt de prueba

**Ejemplo con servidor MCP real:**
```bash
node build/cli/index.js agent:test-mcp-stdio \
  -c "npx" \
  -a "@modelcontextprotocol/server-postgres" \
  -p "List database tables"
```

### 3. `agent:test-mcp-http`
Test conexión MCP vía HTTP transport

```bash
node build/cli/index.js agent:test-mcp-http
```

**Opciones:**
- `-u, --url <url>`: URL del servidor MCP HTTP
- `-p, --prompt <prompt>`: Prompt de prueba

**Ejemplo:**
```bash
node build/cli/index.js agent:test-mcp-http \
  -u "https://mcp-server.example.com" \
  -p "List available tools"
```

### 4. `agent:test-mcp-tool`
Test ejecución directa de una herramienta MCP

```bash
node build/cli/index.js agent:test-mcp-tool
```

**Opciones:**
- `-s, --server <name>`: Nombre del servidor MCP
- `-t, --tool <name>`: Nombre de la herramienta a ejecutar
- `-i, --input <json>`: Input JSON para la herramienta (default: `{}`)

**Ejemplo:**
```bash
node build/cli/index.js agent:test-mcp-tool \
  -s "postgres-server" \
  -t "query" \
  -i '{"query": "SELECT * FROM users LIMIT 10"}'
```

## Configuración de .mcp.json

Crea un archivo `.mcp.json` en la raíz del proyecto:

```json
{
  "mcpServers": {
    "postgres": {
      "name": "postgres",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/dbname"
      },
      "transport": "stdio"
    },
    "github": {
      "name": "github",
      "url": "https://mcp-github.example.com",
      "headers": {
        "Authorization": "Bearer your-github-token"
      },
      "transport": "http"
    }
  }
}
```

## Servidores MCP Disponibles

### Servidores Oficiales de la Comunidad

1. **PostgreSQL**: `@modelcontextprotocol/server-postgres`
   ```bash
   npx @modelcontextprotocol/server-postgres
   ```

2. **GitHub**: `@modelcontextprotocol/server-github`
   ```bash
   npx @modelcontextprotocol/server-github
   ```

3. **Filesystem**: `@modelcontextprotocol/server-filesystem`
   ```bash
   npx @modelcontextprotocol/server-filesystem
   ```

## Notas

- Los servidores MCP deben estar instalados y ejecutándose
- Para stdio, el servidor debe comunicarse vía JSON-RPC sobre stdin/stdout
- Para HTTP, el servidor debe exponer un endpoint HTTP/HTTPS
- Las herramientas MCP se registran automáticamente en el Agent SDK
- Puedes ver las herramientas disponibles con `agent.getAvailableTools()`

## Troubleshooting

### Error: "MCP server not connected"
- Verifica que el servidor MCP esté ejecutándose
- Revisa la configuración en `.mcp.json`
- Comprueba que el comando/URL sea correcto

### Error: "Tool not found"
- Lista las herramientas disponibles: `agent.getAvailableTools()`
- Verifica que el servidor MCP exponga la herramienta
- Revisa el nombre de la herramienta (debe incluir el prefijo del servidor)

### Error: "Invalid JSON"
- El servidor MCP debe comunicarse vía JSON-RPC
- Verifica que el servidor esté respondiendo correctamente
- Revisa los logs del servidor MCP

