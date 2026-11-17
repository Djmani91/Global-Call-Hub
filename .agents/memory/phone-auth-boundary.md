---
name: Phone-first identity boundary
description: Why Twilio phone verification must preserve the existing Clerk customer identity.
---

Keep phone verification separate from the canonical customer identity. A verified phone must link to the existing Clerk identity only after that account's ownership is independently established; matching an email string is not ownership proof.

**Why:** Linea's billing and protected APIs already depend on Clerk customer identities. Creating a second identity for phone login would separate a customer from their existing account and wallet. Managed Clerk does not natively provide this app's Twilio SMS login, so changing authentication providers is not an acceptable shortcut.

**How to apply:** Preserve this boundary when extending signup, account recovery, or phone changes. A phone-code approval alone must never establish verified email or owner-admin status. Keep tokens out of unencrypted local storage even if a compatible secure-storage dependency is temporarily unavailable.
