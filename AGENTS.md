# AGENTS.md — Contributor Guidelines for AI Agents & Automated Tools

This document provides machine-readable architecture rules, validation commands, and operational boundaries for AI coding agents (Antigravity, Claude Code, Codex, Cursor, Devin) contributing to `muslim-prayer-mcp`.

---

## 1. Quick Development Commands

| Task | Command | Expected Result |
| :--- | :--- | :--- |
| **Install Dependencies** | `npm install` | Dependencies installed |
| **Run Complete Test Suite** | `npm test` | All unit, integration and E2E tests pass |
| **Test Single File** | `node --experimental-strip-types --test test/calculator.test.ts` | Single test suite execution |
| **Local Stdio Run** | `node --experimental-strip-types src/stdio.ts` | Spawns JSON-RPC stdin/stdout server |
| **Deploy Worker** | `npx wrangler deploy` | Deploys worker to Cloudflare network |

---

## 2. Architectural Guardrails & Invariants

* **Astronomical Precision**:
  * Prayer times are calculated via `adhan` using solar depression angles in isolated memory.
  * Never replace astronomical math with third-party web scraping or unverified REST APIs.
  * Any modifications to `src/engine/calculator.ts` MUST pass all 10 benchmark cities in `test/calculator.test.ts`.
* **Privacy & Data Minimization**:
  * All incoming coordinates MUST be sanitized via `sanitizeCoordinate()` in `src/location/resolver.ts` (max 2 decimal places).
  * Never log or pass raw GPS coordinates to model output payloads.
* **Theological Authority Calibration**:
  * Automatic location calibration maps sovereign Awqaf authorities (Umm Al-Qura, Egyptian Awqaf, Diyanet, Karachi, ISNA, MWL).
  * Gaza and Palestinian territories MUST preserve Palestinian Awqaf offsets (`{ maghrib: +3, dhuhr: -1 }`).
* **Protocol Conformance**:
  * Model Context Protocol tools in `src/mcp/schemas.ts` and `src/mcp/server.ts` MUST define both `inputSchema` and `outputSchema` with Zod.
  * All tool outputs MUST include structured JSON in `structuredContent` and human-readable fallback in `content`.

---

## 3. Directory Layout

```
├── src/
│   ├── engine/          # Astronomical calculation, due windows, and reminder engine
│   ├── location/        # Layered resolver (explicit, KV, headers, verified end-user inputs)
│   ├── mcp/             # MCP server definitions, JSON-RPC handlers, and Zod schemas
│   ├── middleware/      # Deterministic host completion injection middleware
│   ├── storage/         # Cloudflare KV preference and deduplication store
│   ├── index.ts         # Cloudflare Worker entry point (Streamable HTTP + REST)
│   └── stdio.ts         # Local Stdio CLI entry point
├── test/                # Unit, integration, and E2E test suites (all tests)
├── assets/              # Branding, logos, icons, and hero banners
├── docs/                # GitHub Pages documentation portal and demo video
└── .github/             # Workflows, issue/PR templates, and governance files
```

---

## 4. Verification Checklist Before Yielding

- [ ] Ran `npm test` and verified the complete suite pass.
- [ ] Confirmed no git diff in untracked sensitive files.
- [ ] Preserved all existing comments and theological citations.

Public prayer queries require a supported city or complete end-user coordinates/timezone. Do not infer prayer location from server/connector IP or silently default to Makkah. Run `npm run docs:check` after schema changes; regenerate with `npm run docs:generate`.
