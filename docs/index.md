---
layout: default
---

<p align="center">
  <img src="assets/icon.png" width="140" height="140" alt="Muslim Prayer Reminder MCP Logo" />
</p>

# Muslim Prayer Reminder MCP

A production-ready Islamic prayer reminder system exposing both a **Streamable HTTP Model Context Protocol (MCP)** server on Cloudflare Workers and a local CLI runner for AI agents.

[Terms of Service](/muslim-prayer-mcp/terms-of-service/) | [Privacy Policy](/muslim-prayer-mcp/privacy-policy/) | [GitHub Repository](https://github.com/tareq7/muslim-prayer-mcp) | [NPM Package](https://www.npmjs.com/package/muslim-prayer-mcp)

---

## Quickstart

### Option 1: Local NPX Runner (Claude Desktop, Cursor, VS Code, Windsurf)
Add to your client configuration:

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

### Option 2: Remote Streamable HTTP (Cloudflare Workers Edge)
```json
{
  "mcpServers": {
    "muslim-prayer": {
      "url": "https://muslim-prayer-mcp.najetareqz.workers.dev/mcp"
    }
  }
}
```

---

## Key Capabilities

* **Astronomical Precision**: Calculates Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha with sub-minute accuracy via the open-source Adhan engine.
* **Deterministic Host Middleware**: Zero-latency check that intercepts AI responses to append active prayer alerts without relying on model hallucination.
* **Privacy-First**: Ephemeral V8 isolate execution, 2-decimal fuzzy coordinate truncation, zero tracking, and no external WAN dependencies.
