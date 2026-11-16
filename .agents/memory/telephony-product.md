---
name: Telephony product scope
description: User's intended telephony provider and reference-app scope.
---

The user wants a mobile app similar to the supplied reference screenshots, allowing customers to message phone numbers, call internationally, and buy numbers from different countries through Twilio.

**Why:** The user explicitly selected Twilio and said they will provide access later.

**How to apply:** Keep any pre-connection experience explicitly labelled as a demo. Do not imply that calls, SMS delivery, available inventory, credit purchases, or worldwide coverage work before Twilio and applicable billing/regulatory requirements are configured. Never place provider secrets in the mobile client.

The user wants outgoing and incoming calls inside the installed app on both Android and iPhone, not browser calling as the initial calling product.

**Why:** The user explicitly selected installed mobile calling and both platforms.

**How to apply:** Scope calling for both platforms, including native incoming-call delivery. Do not substitute browser calling or the system phone dialer without the user's agreement.

Linea's retail rates are three times the current Twilio cost, including monthly numbers and incoming/outgoing voice and SMS. Display currency follows the customer's saved billing country, not the purchased number's country.

**Why:** The user explicitly requested a 3× multiplier and selected “Customer billing country” when asked how currency should be chosen.

**How to apply:** Keep the pricing policy server-side. Do not substitute sample prices when provider permissions or conversion data are unavailable. Credit packs are a separate product decision, not a Twilio rate.
