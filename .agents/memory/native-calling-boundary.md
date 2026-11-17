---
name: Native calling boundary
description: Preserve the preview and distinguish preparation from verified installed mobile calling.
---

Preserve Linea's Expo Go preview. Native calling preparation is not permission to generate native projects, run EAS commands, downgrade Expo, spend money, place test calls, publish, or change Twilio account routing.

**Why:** The user explicitly scoped preparation separately from a native calling release and required approval for external account changes or billable tests.

**How to apply:** Recheck current official SDK compatibility and the project's supported build boundary before native work. A provider's Expo plugin is not proof that the project's installed SDK or managed build route is verified. API tests, JavaScript exports and screenshots never prove background incoming-call delivery; report real-device gaps as blocked.

Do not assume an existing Twilio key can inspect all account resources or sign Voice Access Tokens merely because number inventory works.

**Why:** Read-only readiness inspection succeeded for owned numbers while account details, applications and verified callers were permission-denied. Twilio documents separate signing-key restrictions.

**How to apply:** Report permission-denied checks as unknown, not absent. Verify account type, signing key class and platform push configuration independently before enabling calls; never repoint an existing number automatically.
