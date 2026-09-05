# Security Policy & Responsible Disclosure

We take the security of **Muslim Prayer Reminder MCP** and user privacy with extreme seriousness. As an edge-native service handling geographic coordinates and astronomical calculations, our design enforces data minimization and memory safety by default.

---

## Supported Versions

Only the latest release receive active security patches. We strongly advise all integrators and hosts to use the latest version or bind to the managed Cloudflare Workers endpoint.

| Version | Supported | Security Maintenance |
| :--- | :--- | :--- |
| **1.0.x** | :white_check_mark: | Active security updates and patch releases |
| **< 1.0.0** | :x: | Deprecated / End of Life |

---

## Reporting a Vulnerability

If you discover an actual or potential security vulnerability, please report it privately via GitHub:

* **Private Vulnerability Reporting**: [Submit via GitHub Security Advisory](https://github.com/tareq7/muslim-prayer-mcp/security/advisories/new)
* **Direct Email Contact**: 
ajetareqz@gmail.com (Subject: [SECURITY] muslim-prayer-mcp Vulnerability Report)

**Please do NOT disclose vulnerabilities in public GitHub issues, discussions, or pull requests until they have been reviewed and remediated.**

---

## Response Cadence & SLA

When a private report is submitted:

* **Initial Acknowledgement**: Within **24 hours**.
* **Triage & Impact Assessment**: Within **48 hours**.
* **Patch & Verification**: Target fix committed within **72 hours** for high-severity issues.
* **Public Disclosure**: Coordinated release with reporter attribution once patch is deployed.

---

## Privacy & Architectural Safeguards

1. **Strict Coordinate Truncation**: All latitude and longitude inputs are truncated to 2 decimal places (~1.1km radius) in isolate memory. High-precision street-level coordinates are immediately discarded and never recoverable.
2. **Zero Coordinate Leakage**: Raw coordinates are strictly barred from tool return values and never injected into the LLM context window.
3. **Isolated Solar Math**: Calculations run purely within the local V8 isolate without outbound WAN requests to third-party tracking APIs.
