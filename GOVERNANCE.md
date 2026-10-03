# Project Governance

This document describes how decisions are made in the **Muslim Prayer Reminder MCP** project.

---

## 1. Decision-Making Model

This project operates as a maintainer-led open-source project. Technical and architectural decisions are made by consensus among active maintainers, with the Lead Maintainer having final authority when consensus cannot be reached.

---

## 2. Astronomical & Fiqh Invariants

To prevent theological fragmentation, PRs affecting prayer times or regional calculation rules MUST:
1. Cite official governmental Awqaf regulations or peer-reviewed astronomical ephemerides.
2. Maintain backward-compatible calculation defaults for existing cities.
3. Pass the automated 44-benchmark test suite.

---

## 3. Releases & Deprecations

* Releases follow Semantic Versioning (SemVer).
* Any breaking changes to MCP JSON-RPC tool schemas require a minor version bump during 0.x and a major bump post-1.0.
