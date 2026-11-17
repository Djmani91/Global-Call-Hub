import { createClient } from "@replit/revenuecat-sdk/client";
import { ReplitConnectors } from "@replit/connectors-sdk";

// The connector supplies authorization. Never copy its token into application code.
export async function getUncachableRevenueCatClient() {
  const connectors = new ReplitConnectors();
  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      return connectors.proxy("revenuecat", url.pathname + url.search, {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        ...(request.method === "GET" ? {} : { body: JSON.parse(await request.text()) }),
      });
    },
  });
}
