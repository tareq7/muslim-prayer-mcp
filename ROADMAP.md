# 🗺️ Product Roadmap

This roadmap outlines the planned enhancements and future directions for **Muslim Prayer Reminder MCP**.

---

## Current Release (v1.1.2) :white_check_mark:

- [x] Streamable HTTP MCP server on Cloudflare Workers.
- [x] Local Stdio CLI runner via `npx muslim-prayer-mcp`.
- [x] In-isolate astronomical solar solver (`adhan`).
- [x] Autonomous authority calibration across 7 sovereign Islamic jurisdictions.
- [x] Verified location resolution from explicit coordinates or supported city, stored fixed settings, and trusted end-user host headers. Missing location returns `location_required`.
- [x] Deterministic Host Completion Middleware for Vercel AI SDK and LangChain.
- [x] Full Zod input and output schema contracts with `structuredContent` across all 5 tools.
- [x] Automated unit, integration and E2E tests, including worldwide benchmark cities.

---

## Q4 2026 :hourglass_flowing_sand:

- [ ] **`get_qibla_direction` Tool**: Spherical Great-Circle trigonometric compass solver calculating exact Qibla heading, true north bearing, and distance in km to the Kaaba.
- [ ] **Hijri Calendar Conversion Tool**: Dual Umm al-Qura and standard astronomical lunar calendar converter with moon sighting adjustment offsets.
- [ ] **Audio Azan Stream Resource**: MCP Resource exposing authenticated audio streaming URLs for regional Adhan recitations.

---

## 2027 Long-Term Vision :telescope:

- [ ] Native Swift & Kotlin mobile bridges for iOS Shortcuts and Android Quick Settings.
- [ ] WearOS and Apple Watch live activity complications integration.
- [ ] Decentralized mesh synchronization for offline edge gateways.

---

## Feedback & Feature Proposals

Have a feature request? Open a proposal via [GitHub Issues](https://github.com/tareq7/muslim-prayer-mcp/issues).
