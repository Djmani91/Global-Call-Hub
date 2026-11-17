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

Start installed calling implementation and testing with Android; iPhone remains a later supported target.

**Why:** The user explicitly said “Start from the Android” when asking to begin real-call testing.

**How to apply:** Prioritize Android build compatibility and incoming-call push setup without dropping the later iPhone scope.

Linea's retail rates are three times the current Twilio cost, including monthly numbers and incoming/outgoing voice and SMS. Display currency follows the customer's saved billing country, not the purchased number's country.

**Why:** The user explicitly requested a 3× multiplier and selected “Customer billing country” when asked how currency should be chosen.

**How to apply:** Keep the pricing policy server-side. Do not substitute sample prices when provider permissions or conversion data are unavailable. Credit packs are a separate product decision, not a Twilio rate.

Number rental terms are 1, 3 and 12 months, paid upfront and renewing for the same selected term. The user approved screenshot discounts of 52% for 3 months and 70% for 12 months, accepting that the latter is below Twilio rental cost when applied to the 3× monthly retail price.

**Why:** The user explicitly approved the screenshot discounts after the below-cost implication was explained.

**How to apply:** Do not silently replace these discounts with the default 3× policy. Selecting a number must open a separate “Get your Number” screen with term options and basic call/SMS rates, not expand a card inside the number results. The user corrected this distinction explicitly.

The user wants Google Play in-app purchases for Android billing first.

**Why:** The user explicitly requested Android purchases through Google in-app billing.

**How to apply:** Prioritize Android store billing, not a Google Pay wallet checkout. This Android-first billing scope does not change the separate requirement for calling on both Android and iPhone.

The credit packs add £5, £10 and £15 to a fixed GBP wallet. Google's localized checkout price can have a different currency.

**Why:** The user supplied these three amounts and explicitly confirmed the fixed GBP wallet and localized-checkout proposal.

**How to apply:** Keep credited GBP value distinct from localized paid price. Editing billing country must never relabel or convert an existing wallet balance.

Build the Android in-app purchase integration now, but the user will configure Google Play Console later, after uploading the app.

**Why:** The user explicitly deferred Google Console setup until after app upload.

**How to apply:** Do not require Google Play Console setup before implementing independently feasible app and server integration. Keep unavailable store products and checkout explicitly disabled; distinguish preview testing from real Google Play purchase verification.

The user approved a separate Standard Twilio API key for server-side pricing only, while retaining the restricted key for other operations.

**Why:** The restricted key repeatedly failed pricing requests, and the user agreed to the Standard key's broader access specifically for this diagnostic and pricing use.

**How to apply:** Preserve that separation. Approval to read prices with the broader key is not approval to use it for number orders, calls, messages or client-side access.
