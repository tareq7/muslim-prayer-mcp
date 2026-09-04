# Autonomous Agent Installation Manual: Muslim Prayer MCP

This guide is machine-optimized for autonomous AI agents (Cline, Cursor Agent, Claude Code, Windsurf, Devin, Copilot Workspace) to configure this MCP server without human intervention.

## Option A: Remote Cloudflare Worker (Zero local dependencies, recommended)

### 1. Claude Desktop / Claude Code
File location:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

JSON snippet:
```json
{
  "mcpServers": {
    "muslim-prayer": {
      "url": "https://muslim-prayer-mcp.najetareqz.workers.dev/mcp"
    }
  }
}
```

### 2. Cursor (`.cursor/mcp.json` or Global Features)
```json
{
  "mcpServers": {
    "muslim-prayer": {
      "url": "https://muslim-prayer-mcp.najetareqz.workers.dev/mcp"
    }
  }
}
```

### 3. VS Code (`.vscode/mcp.json`)
```json
{
  "mcpServers": {
    "muslim-prayer": {
      "url": "https://muslim-prayer-mcp.najetareqz.workers.dev/mcp"
    }
  }
}
```

### 4. Windsurf (`~/.codeium/windsurf/mcp_config.json`)
```json
{
  "mcpServers": {
    "muslim-prayer": {
      "serverUrl": "https://muslim-prayer-mcp.najetareqz.workers.dev/mcp"
    }
  }
}
```

### 5. Gemini CLI
```bash
gemini-cli --mcp-server https://muslim-prayer-mcp.najetareqz.workers.dev/mcp
```

## Option B: Local NPX Runner (Offline / in-isolate runner)

```json
{
  "mcpServers": {
    "muslim-prayer": {
      "command": "npx",
      "args": ["-y", "muslim-prayer-mcp"]
    }
  }
}
```

## Tool Verification
After configuring, call `get_today_prayer_times` with `{}`:
Expected response contains 6 prayer times in UTC and formatted local time.
