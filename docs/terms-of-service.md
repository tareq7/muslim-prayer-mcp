---
layout: default
permalink: /terms-of-service/
---

# Terms of Service

Last updated: 2026-09-04

**Muslim Prayer Reminder MCP** is provided as free, open-source software under the [MIT License](https://github.com/tareq7/muslim-prayer-mcp/blob/main/LICENSE).

## 1. Scope & Functionality

Muslim Prayer Reminder MCP is an integration service and Model Context Protocol (MCP) tool designed to calculate Islamic prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha) and provide timely notification cues within AI agent environments (such as Claude Desktop, ChatGPT, Cursor, Windsurf, and VS Code).

It is not an ecclesiastical authority, religious ruling body, or legal entity.

## 2. Accuracy of Calculations

Prayer times are computed using recognized astronomical calculation models provided by the open-source [Adhan](https://github.com/batoulapps/adhan-js) library across established conventions (including Muslim World League, Umm Al-Qura, Egyptian General Authority of Survey, Karachi, and North America).

Due to atmospheric refraction, geographical topography, local daylight saving time adjustments, and varying fiqh jurisdictions, users should verify calculated schedules with their local mosque or Islamic religious authority for exact regional adherence.

## 3. Availability & Hosting

The public Cloudflare Workers endpoint is provided on a best-effort, free-tier availability basis without express service-level agreements (SLA) or guarantees of uninterrupted operation.

Users and developers are encouraged to self-host their own instances via the provided Cloudflare Wrangler configuration or run locally using `npx -y muslim-prayer-mcp`.

## 4. Limitation of Liability

Under the terms of the MIT License, the software and associated endpoints are provided "AS IS", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability.

## 5. Trademarks

Model Context Protocol (MCP), Anthropic, Claude, OpenAI, ChatGPT, Microsoft, Cursor, and Cloudflare are trademarks of their respective owners. This project is an independent open-source tool and is not officially affiliated with or endorsed by them.

## 6. Contact & Issues

For questions, security concerns, or bug reports, please open an issue in the official [GitHub Repository](https://github.com/tareq7/muslim-prayer-mcp/issues).
