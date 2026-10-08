# Security Policy & Responsible Disclosure

We take the security of **Muslim Prayer Reminder MCP** and user privacy with extreme seriousness. As an edge-native service handling geographic coordinates and astronomical calculations, our design enforces data minimization and memory safety by default.

---

## Supported Versions

Only the latest release receives active security patches. We strongly advise all integrators and hosts to use the latest version or bind to the managed Cloudflare Workers endpoint.

| Version | Supported | Security Maintenance |
| :--- | :--- | :--- |
| **1.1.2 (latest)** | :white_check_mark: | Active security updates and patch releases |
| **Earlier versions** | :x: | Deprecated / End of Life |

---

## Reporting a Vulnerability

If you discover an actual or potential security vulnerability, please report it privately via GitHub:

* **Private Vulnerability Reporting**: [Submit via GitHub Security Advisory](https://github.com/tareq7/muslim-prayer-mcp/security/advisories/new)
* **Direct Email Contact**: najetareqz@gmail.com (Subject: [SECURITY] muslim-prayer-mcp Vulnerability Report)

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

## Host access boundary

The public deployment supports anonymous prayer calculations. A `userId` selects a caller-supplied preference namespace; it does not authenticate an account. Hosts that expose saved preferences must authorize the caller, use opaque per-user identifiers, and prevent callers from choosing another user's namespace. Set the Worker secret `AUTH_TOKEN` to require a bearer token on `/api/*` and `/mcp`; this protects the service as a whole and does not create per-user authorization. Do not expose a shared service token in browser code.

POST request bodies are limited to 64 KiB. Fixed coordinates are rounded before storage. Status reads and preference updates are serialized per user within a Worker isolate; Cloudflare KV provides no global atomic read/write transaction, so cross-region deduplication and concurrent preference updates remain best effort.

### Verified location and calculation disclosures (v1.1.0)

Prayer tools accept a supported `city`, coordinates with `timezone`, or complete stored fixed settings. Missing location returns `location_required`; connector/IP geolocation and automatic Makkah fallback are not used. Explicit per-call inputs override fixed preferences. Host headers must represent the end user.

`highLatitudeAdjustment` discloses twilight substitutions and polar clamping; `effectiveLatitude` is present only for the +/-48-degree substitute and never echoes the original coordinate. `calculationDetails` reports location basis and regional, user, and method offsets. Invalid offsets that reverse prayer windows return `invalid_calculation`. Preferences expose `fixedCoordinatesConfigured` and `fixedCityConfigured` while redacting coordinates.

Analytics is pseudonymous and approximate: daily buckets 60 days, subject hashes 90 days, sessions 7 days, aggregate counters without expiry. Counts are not global atomic delivery metrics. Both dashboard aliases honor configured service authentication. See the privacy policy for the full retention and trust boundaries.
