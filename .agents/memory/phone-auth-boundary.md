---
name: Customer identity and optional phone verification
description: Email signup is current scope; phone verification must preserve the existing Clerk identity.
---

Keep phone verification separate from the canonical customer identity. A verified phone must link to the existing Clerk identity only after that account's ownership is independently established; matching an email string is not ownership proof.

Customers currently sign up or log in with email, not a phone number. Phone collection and verification are deferred.

**Why:** The user explicitly changed the onboarding scope to email now and phone later, while keeping the sign-in gate.

**How to apply:** Do not require Twilio SMS proof to enter the app or complete an email-verified customer account. Preserve existing verified phones without fabricating phone verification for email-only customers.

**Why:** Linea's billing and protected APIs already depend on Clerk customer identities. Creating a second identity for phone login would separate a customer from their existing account and wallet. Managed Clerk does not natively provide this app's Twilio SMS login, so changing authentication providers is not an acceptable shortcut.

**How to apply:** Preserve this boundary when extending signup, account recovery, or phone changes. A phone-code approval alone must never establish verified email or owner-admin status. Keep tokens out of unencrypted local storage even if a compatible secure-storage dependency is temporarily unavailable.
