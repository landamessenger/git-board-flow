# TEC (TypeScript Error Checker) - Error Detector

## Descripción

El **Error Detector** es un sistema de razonamiento y acción que utiliza nuestro Agent SDK para analizar el código y detectar errores potenciales de forma autónoma. Funciona de manera similar a cómo funciona el chat de Cursor, analizando el código, razonando sobre posibles problemas, y proponiendo soluciones.

## Características

- 🔍 **Análisis autónomo**: El agente explora el código de forma independiente
- 🎯 **Detección inteligente**: Identifica múltiples tipos de errores:
  - Errores de tipo (TypeScript/JavaScript)
  - Errores lógicos
  - Problemas de seguridad
  - Problemas de rendimiento
  - Violaciones de mejores prácticas
  - Errores potenciales en tiempo de ejecución
- 📊 **Clasificación por severidad**: Critical, High, Medium, Low
- 🔧 **Sugerencias de corrección**: Propone cambios para errores críticos y de alta severidad
- 📋 **Tracking con TODOs**: Usa el sistema de TODOs para rastrear hallazgos

## Comandos CLI

### `tec:detect-errors`

Análisis completo de errores en el proyecto.

```bash
node build/cli/index.js tec:detect-errors [options]
```

**Opciones:**
- `-p, --prompt <prompt>`: Prompt de detección (default: "Busca potenciales errores en todo el proyecto")
- `-m, --model <model>`: Modelo de OpenRouter (default: "openai/gpt-4o-mini")
- `-k, --api-key <key>`: API key de OpenRouter
- `--max-turns <number>`: Máximo de turnos (default: 30)
- `--focus <areas...>`: Áreas específicas a analizar (ej: `src/agent src/utils`)
- `--error-types <types...>`: Tipos de errores a buscar
- `--owner <owner>`: Owner del repositorio GitHub (auto-detectado si no se proporciona)
- `--repo <repo>`: Nombre del repositorio GitHub (auto-detectado si no se proporciona)
- `--output <format>`: Formato de salida (`text` o `json`, default: `text`)

**Ejemplos:**

```bash
# Análisis completo
node build/cli/index.js tec:detect-errors

# Análisis enfocado en un área específica
node build/cli/index.js tec:detect-errors --focus src/agent src/utils

# Buscar solo errores de tipo y seguridad
node build/cli/index.js tec:detect-errors --error-types type-errors security-issues

# Salida en JSON
node build/cli/index.js tec:detect-errors --output json
```

### `tec:quick-check`

Revisión rápida buscando solo errores críticos y de alta severidad.

```bash
node build/cli/index.js tec:quick-check [options]
```

**Opciones:**
- `-m, --model <model>`: Modelo de OpenRouter
- `-k, --api-key <key>`: API key de OpenRouter
- `--focus <areas...>`: Áreas específicas a analizar

**Ejemplo:**

```bash
node build/cli/index.js tec:quick-check
```

## Cómo Funciona

1. **Inicialización**: 
   - Carga los archivos del repositorio (si está configurado)
   - Crea herramientas (read_file, search_files, propose_change, manage_todos)
   - Configura el agente con un prompt del sistema especializado

2. **Análisis**:
   - El agente explora el código usando `search_files`
   - Lee archivos relevantes con `read_file`
   - Analiza el código buscando errores potenciales
   - Crea TODOs para cada error encontrado
   - Propone cambios para errores críticos/altos

3. **Resultados**:
   - Extrae errores de las respuestas del agente
   - Clasifica por severidad y tipo
   - Genera un resumen estadístico
   - Muestra sugerencias de corrección

## Niveles de Severidad

- **🔴 Critical**: Causará fallo del sistema o pérdida de datos
- **🟠 High**: Causará problemas significativos o vulnerabilidades de seguridad
- **🟡 Medium**: Puede causar problemas en ciertas condiciones
- **🟢 Low**: Problemas menores o mejoras de calidad de código

## Tipos de Errores Detectados

- `type-errors`: Errores de tipo (TypeScript/JavaScript)
- `logic-errors`: Errores lógicos (condiciones incorrectas, cálculos erróneos)
- `security-issues`: Problemas de seguridad (SQL injection, XSS, dependencias inseguras)
- `performance-problems`: Problemas de rendimiento (algoritmos ineficientes, memory leaks)
- `best-practices`: Violaciones de mejores prácticas
- `runtime-errors`: Errores potenciales en tiempo de ejecución (null/undefined access, array bounds)
- `race-conditions`: Condiciones de carrera
- `resource-leaks`: Fugas de recursos

## Ejemplo de Uso

```bash
# Análisis completo del proyecto
node build/cli/index.js tec:detect-errors \
  -p "Busca potenciales errores en todo el proyecto" \
  --max-turns 30

# Revisión rápida
node build/cli/index.js tec:quick-check

# Análisis enfocado
node build/cli/index.js tec:detect-errors \
  --focus src/agent/core \
  --error-types type-errors logic-errors
```

## Requisitos

- `OPENROUTER_API_KEY`: API key de OpenRouter (o usar `-k`)
- `GITHUB_TOKEN`: Token de GitHub para cargar archivos del repositorio (opcional, solo si se especifica owner/repo)

## Arquitectura

El sistema está compuesto por:

- **ErrorDetector**: Clase principal que orquesta el análisis
- **Agent SDK**: Motor de razonamiento
- **Tools**: read_file, search_files, propose_change, manage_todos
- **FileRepository**: Carga archivos del repositorio GitHub
- **ThinkTodoManager**: Gestiona los TODOs de errores encontrados

## Integración con Agent SDK

El Error Detector utiliza todas las capacidades del Agent SDK:
- ✅ Reasoning loop completo
- ✅ Tool calling
- ✅ Context management
- ✅ TODO tracking
- ✅ Change proposals

Esto permite que el agente:
- Razonar sobre el código de forma autónoma
- Explorar el proyecto de forma inteligente
- Detectar errores complejos que requieren análisis profundo
- Proponer soluciones contextualizadas

