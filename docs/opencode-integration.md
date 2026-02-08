# OpenCode Integration

Git Board Flow uses **OpenCode** for all AI-backed features: code analysis, progress detection, error detection, PR descriptions, and the copilot agent. OpenRouter has been removed in favor of OpenCode.

## Why OpenCode

- **Multi-provider**: OpenCode supports 75+ LLM providers (Anthropic, OpenAI, Gemini, local models via Ollama, etc.), so you can switch between paid and free models without changing code.
- **Single backend**: One server (OpenCode) handles API keys and model routing; this action only needs the server URL and model name.
- **Consistent API**: The same configuration works for GitHub Actions and local CLI.

## Requirements

1. **OpenCode server** must be running and reachable (e.g. `http://localhost:4096` or your deployed URL).
2. **Model** in `provider/model` format (e.g. `openai/gpt-4o-mini`, `anthropic/claude-3-5-sonnet`).
3. **API keys** are configured on the OpenCode server (not in this action). Use OpenCode’s auth/config to add provider keys.

## Configuration

### GitHub Action inputs

| Input | Description | Default |
|-------|-------------|--------|
| `opencode-server-url` | OpenCode server URL | `http://localhost:4096` |
| `opencode-model` | Model in `provider/model` format | `openai/gpt-4o-mini` |

Example:

```yaml
- uses: landamessenger/git-board-flow@master
  with:
    opencode-server-url: 'http://your-opencode-host:4096'
    opencode-model: 'anthropic/claude-3-5-sonnet'
    # ... other inputs
```

### Environment variables (CLI / local)

- `OPENCODE_SERVER_URL` – OpenCode server URL.
- `OPENCODE_MODEL` – Model in `provider/model` format.

### CLI options

- `--opencode-server-url <url>` – Override OpenCode server URL.
- `--opencode-model <model>` – Override model.

## Running OpenCode

1. **Local / self-hosted**: Install OpenCode and run the server, e.g.:
   ```bash
   npx opencode-ai serve
   # or
   opencode serve --port 4096
   ```
2. **CI (e.g. GitHub Actions)**: Either:
   - Run OpenCode in a job (e.g. in a container or as a service), or
   - Point `opencode-server-url` to a shared OpenCode instance your org hosts.

## Features using OpenCode

- **AI pull request description** – Generates PR descriptions from issue and diff.
- **Think / reasoning** – Deep code analysis and change proposals.
- **Check progress** – Progress detection from branch vs issue description.
- **Vector / AI knowledge** – Codebase analysis and indexing.
- **Copilot** – Code analysis and manipulation agent.
- **Error detection** – Potential bugs and issues in the codebase.

All of these use the same OpenCode server and model configuration.

## Model format

Use `provider/model` as in OpenCode’s config, for example:

- `openai/gpt-4o-mini`
- `openai/gpt-4o`
- `anthropic/claude-3-5-sonnet-20241022`
- `google/gemini-2.0-flash`

Check OpenCode’s docs or `/config/providers` on your server for the exact model IDs.

## Troubleshooting

- **“Missing required AI configuration”**: Set `opencode-server-url` and `opencode-model` (or env vars).
- **Connection errors**: Ensure the OpenCode server is running and reachable from the runner (network/firewall, correct URL and port).
- **Auth errors**: Configure provider API keys in OpenCode (e.g. via OpenCode UI or config), not in this action.
