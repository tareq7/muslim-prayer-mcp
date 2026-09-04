# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-04

### Added
- Cloudflare Workers Streamable HTTP MCP server (`POST /mcp`).
- Local stdio runner packaged as `npx muslim-prayer-mcp`.
- Astronomical calculation engine based on `adhan` library with sub-minute precision.
- Support for 12 global calculation methods (Umm Al-Qura, MWL, Egyptian, Karachi, Dubai, etc.).
- High-latitude polar day/night mitigation rules.
- Deterministic response middleware (`<5ms` latency) with fail-open guarantee.
- Layered location resolver with 2-decimal privacy truncation.
- Cloudflare KV user preference storage and 24-hour deduplication sentinels.
- Official branding suite with transparent squircle iconography.
- Manifests for Official MCP Registry, Gemini CLI, Cursor, Claude, and Copilot.
- Full automated test suite (40 passing unit and end-to-end tests).
