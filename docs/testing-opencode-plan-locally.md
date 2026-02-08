# Probar localmente los flujos con OpenCode Plan

Guía para ejecutar en local las acciones que usan el agente **Plan** de OpenCode (progreso, detección de errores, recomendación de pasos). La **descripción de PR** se ejecuta en la GitHub Action al abrir/actualizar un PR; aquí se indica cómo simular el resto.

## Requisitos previos

1. **Node 20**  
   ```bash
   nvm use 20
   ```

2. **Build del proyecto**  
   ```bash
   npm install
   npm run build
   ```

3. **Repositorio Git con remote en GitHub**  
   Los comandos leen `git remote origin` para obtener `owner/repo`. Debes estar en un clone cuyo `origin` apunte a GitHub (ej. `https://github.com/owner/repo.git`).

4. **Token de GitHub (PAT)**  
   Necesario para que la CLI llame a la API (descripción de issues, lista de ramas, diff entre ramas).  
   - Crear un PAT con al menos `repo` (o el scope que use tu proyecto).  
   - Exportar o pasar por opción:
   ```bash
   export PERSONAL_ACCESS_TOKEN=ghp_...
   # o usar -t / --token en cada comando
   ```

5. **Servidor OpenCode en marcha**  
   El agente Plan se invoca contra el servidor HTTP de OpenCode. Debe estar levantado en la misma máquina (o accesible por URL).

---

## Arrancar OpenCode

En **otra terminal**, desde la raíz del repo (o desde el directorio sobre el que quieras que OpenCode tenga contexto):

```bash
npx -y opencode-ai serve
```

El flag **`-y`** (o `--yes`) hace que npx instale y ejecute el paquete **sin preguntar** "Ok to proceed?". Sin `-y`, npx pediría confirmación la primera vez. Por defecto el servidor escucha en `http://localhost:4096`. Si usas otro puerto u host, pásalo con las opciones del CLI (ver abajo).

Comprueba que responde (si con `localhost` falla, usa `127.0.0.1` y pásalo también al CLI):

```bash
curl -s http://127.0.0.1:4096/global/health
# Esperado: {"healthy":true,"version":"..."}
```

---

## Variables de entorno (opcional)

Puedes fijar valores por defecto para no repetirlos en cada comando:

```bash
export PERSONAL_ACCESS_TOKEN=ghp_tu_token
export OPENCODE_SERVER_URL=http://localhost:4096
export OPENCODE_MODEL=opencode/kimi-k2.5
```

Si no defines `OPENCODE_SERVER_URL`, la CLI usa `http://localhost:4096`. Si no defines `OPENCODE_MODEL`, se usa `opencode/kimi-k2.5` (Kimi K2.5 free).

---

## Comandos disponibles

Ejecutar desde la **raíz del repo** (donde está el `package.json`). Puedes usar el binario generado o `node build/cli/index.js`:

```bash
# Usando el binario (si está en el PATH tras npm run build)
node build/cli/index.js <comando> [opciones]

# O con npx desde la raíz del proyecto
npx ts-node src/cli.ts <comando> [opciones]   # si tienes ts-node; si no, usar build
```

### 1. Progreso de una issue (`check-progress`)

Calcula el progreso de una issue según la descripción de la issue y los cambios de la rama asociada frente a la rama de desarrollo.

```bash
node build/cli/index.js check-progress -i 123
```

Opciones útiles:

- `-i, --issue <number>` — Número de issue (obligatorio).
- `-b, --branch <name>` — Rama a usar (opcional; si no se pasa, se intenta inferir por convención `feature/123-*`, `bugfix/123-*`, etc.).
- `-t, --token <token>` — PAT (si no está en `PERSONAL_ACCESS_TOKEN`).
- `--opencode-server-url <url>` — URL del servidor OpenCode (default: `http://localhost:4096`).
- `--opencode-model <model>` — Modelo OpenCode (ej. `opencode/kimi-k2.5`, `openai/gpt-4o-mini`).
- `-d, --debug` — Modo debug.

Ejemplo con opciones explícitas:

```bash
node build/cli/index.js check-progress -i 279 -t "$PERSONAL_ACCESS_TOKEN" --opencode-server-url http://localhost:4096 --opencode-model opencode/kimi-k2.5
```

---

### 2. Detección de errores (`detect-errors`)

Revisa los cambios de la rama de la issue frente a la rama base e identifica posibles errores o problemas.

```bash
node build/cli/index.js detect-errors -i 123
```

Mismas opciones que arriba (`-i`, `-t`, `--opencode-server-url`, `--opencode-model`, `-d`). La rama se resuelve igual que en `check-progress` (por convención de nombre).

---

### 3. Recomendar pasos (`recommend-steps`)

A partir de la descripción de la issue, sugiere pasos para implementarla.

```bash
node build/cli/index.js recommend-steps -i 123
```

Opciones: `-i`, `-t`, `--opencode-server-url`, `--opencode-model`, `-d`.

---

### 4. Copilot (agente build)

El comando **copilot** usa el agente **build** de OpenCode (no el Plan). El build agent puede leer y **escribir** archivos cuando el servidor OpenCode se ejecuta desde el directorio del proyecto (p. ej. `npx -y opencode-ai serve` desde la raíz del repo). Los cambios se aplican en el workspace del servidor.

```bash
node build/cli/index.js copilot -p "Añade un test para la función parseUrl"
```

Opciones: `-p, --prompt <prompt...>` (obligatorio), `--opencode-server-url`, `--opencode-model`, `--output (text|json)`, `-d, --debug`. No requiere token de GitHub ni issue: solo servidor OpenCode y modelo. Tras la respuesta, la CLI muestra la lista de ficheros modificados en la sesión (vía `GET /session/:id/diff`).

---

## Descripción de PR

La **actualización de la descripción de la PR** con el agente Plan se lanza desde la **GitHub Action** cuando se abre o actualiza un PR (flujo de Pull Request), no desde la CLI.

Para probarla en local tendrías que:

1. Ejecutar la action en un workflow de prueba (por ejemplo con `workflow_dispatch` y un PR de prueba), o  
2. Simular una `Execution` con los datos del PR (owner, repo, número de PR, issue, token) y llamar a `UpdatePullRequestDescriptionUseCase` desde un script o test (por ejemplo en un test de integración o un script bajo `scripts/`).

No hay un comando tipo `update-pr-description -i <issue> -p <pr-number>` en la CLI actual.

---

## Resolución de problemas

- **"TypeError: fetch failed" / "Error querying OpenCode agent plan"**  
  La conexión al servidor OpenCode no se está estableciendo. Prueba:
  1. Comprobar que el servidor responde: `curl -s http://127.0.0.1:4096/global/health` (debe devolver `{"healthy":true,...}`).
  2. Usar **`127.0.0.1`** en lugar de `localhost`: a veces `localhost` se resuelve a IPv6 (`::1`) y el servidor solo escucha en IPv4 (`127.0.0.1`). Ejemplo: `giik check-progress -i 279 --opencode-server-url http://127.0.0.1:4096`.
  3. Si usas otra máquina o túnel, asegúrate de que la URL sea accesible desde donde ejecutas la CLI.

- **"Unexpected end of JSON input" / "empty response body" / "invalid JSON"**  
  El servidor OpenCode ha respondido con cuerpo vacío o que no es JSON válido (p. ej. la API del agente puede devolver algo inesperado o cerrar la conexión antes de enviar el JSON completo). La CLI ahora muestra un mensaje más claro indicando en qué llamada falló (session.create o message) y un fragmento del cuerpo. Comprueba la versión del servidor OpenCode y que el endpoint `/session` y `/session/:id/message` devuelvan JSON. Si el servidor hace streaming, puede que no sea compatible con la forma en que la CLI espera la respuesta.

- **"OpenCode session create failed" / "OpenCode message failed"**  
  Comprueba que el servidor esté levantado (`curl http://127.0.0.1:4096/global/health`) y que `OPENCODE_SERVER_URL` (o `--opencode-server-url`) apunte a esa URL. Revisa que el modelo esté bien configurado en OpenCode y que `OPENCODE_MODEL` coincida (ej. `opencode/kimi-k2.5`).

- **"Git repository not found"**  
  Debes estar en un directorio que sea un repo Git con `remote.origin.url` de GitHub (ej. `https://github.com/owner/repo` o `git@github.com:owner/repo.git`).

- **Errores 401/403 al llamar a la API de GitHub**  
  Revisa que `PERSONAL_ACCESS_TOKEN` (o `-t`) sea un PAT válido con los scopes necesarios (p. ej. `repo`).

- **"Could not find branch for issue #X"**  
  Para `check-progress` y `detect-errors` se busca una rama cuyo nombre empiece por `feature/N-`, `bugfix/N-`, `docs/N-`, `chore/N-`, etc. Asegúrate de tener una rama así para esa issue o pasa la rama con `-b`.

- **El agente tarda mucho o no responde**  
  El Plan agent puede hacer varias iteraciones. Si el modelo es lento o el contexto muy grande, puede tardar. Usar `-d` para ver logs y comprobar que la petición llega al servidor OpenCode.
