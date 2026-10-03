## 📌 Summary of Changes

- What does this PR change?
- Why is this change necessary?

## 🕌 Theological & Astronomical Impact

- [ ] Astronomical calculations verified against local benchmark calendars.
- [ ] Calculation method / authority calibration preserved or documented.
- [ ] Fiqh compliance checked (Asr shadow ratios, high-latitude polar rules, DST transitions).

## 🔒 Privacy & Security Guardrails

- [ ] Coordinate truncation enforced (max 2 decimal places / ~1.1km precision).
- [ ] Zero coordinate leakage into LLM response context.
- [ ] Safe in-isolate execution (no external outbound HTTP tracking).

## 🧪 Verification & Testing

- [ ] pm test executed and 100% passing.
- [ ] Added automated tests for new edge cases or authorities.
- [ ] Verified JSON-RPC protocol conformance with Model Context Protocol specification.
