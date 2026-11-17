import {
  listProjects, createProject, listApps, createApp, listProducts, createProduct,
  listOfferings, createOffering, updateOffering, listPackages, createPackages,
  attachProductsToPackage, getProductsFromPackage, listAppPublicApiKeys,
} from "@replit/revenuecat-sdk";
import { getUncachableRevenueCatClient } from "./revenueCatClient";
import { readFileSync } from "node:fs";

// GBP was explicitly confirmed by the user. Consumables never confer subscriptions.
// Run without --apply to inspect only. Do not invent/change the app's package identifier.
async function main() {
  const client = await getUncachableRevenueCatClient();
  const apply = process.argv.includes("--apply");
  const take = <T>(r: { data?: T; error?: unknown }): T => {
    if (r.error || !r.data) throw new Error("RevenueCat operation failed; no credentials logged.");
    return r.data;
  };
  const projects = take(await listProjects({ client, query: { limit: 100 } }));
  let project = projects.items.find(p => p.name === "Linea");
  console.log("Existing Linea project:", project?.id ?? "none");
  if (!apply) return;
  project ??= take(await createProject({ client, body: { name: "Linea" } }));
  const path = { project_id: project.id };
  const apps = take(await listApps({ client, path, query: { limit: 100 } })).items;
  const test = apps.find(a => a.type === "test_store");
  if (!test) throw new Error("Expected auto-created Test Store.");
  const config = JSON.parse(readFileSync("../artifacts/linea/app.json", "utf8"));
  const packageName: string | undefined = config.expo.android?.package;
  let android = apps.find(a => a.type === "play_store" && a.play_store.package_name === packageName);
  if (packageName && !android) {
    android = take(await createApp({ client, path, body: {
      name: "Linea Android", type: "play_store", play_store: { package_name: packageName },
    } }));
  }
  const products = take(await listProducts({ client, path, query: { limit: 100 } })).items;
  const offerings = take(await listOfferings({ client, path, query: { limit: 100 } })).items;
  let offering = offerings.find(o => o.lookup_key === "linea_credit_gbp");
  offering ??= take(await createOffering({ client, path, body: {
    lookup_key: "linea_credit_gbp", display_name: "Linea GBP credit",
  } }));
  // Credit values live in provider metadata, not a local product table.
  const creditPacks: Record<string, { currency: string; minor: number }> = {};
  for (const amount of [5, 10, 15]) {
    const sku = `linea_credit_gbp_${amount}`;
    creditPacks[sku] = { currency: "GBP", minor: amount * 100 };
    const packages = take(await listPackages({ client, path: { ...path, offering_id: offering.id }, query: { limit: 100 } })).items;
    let pkg = packages.find(p => p.lookup_key === sku);
    pkg ??= take(await createPackages({ client, path: { ...path, offering_id: offering.id },
      body: { lookup_key: sku, display_name: `£${amount} credit` } }));
    for (const app of [test, ...(android ? [android] : [])]) {
      let product = products.find(p => p.app_id === app.id && p.store_identifier === sku);
      product ??= take(await createProduct({ client, path, body: {
        app_id: app.id, store_identifier: sku, type: "consumable",
        display_name: `Linea £${amount} credit — ${app.type}`,
        ...(app.type === "test_store" ? { title: `£${amount} credit` } : {}),
      } }));
      if (app.type === "test_store") {
        const prices = await client.post({ url: "/projects/{project_id}/products/{product_id}/test_store_prices",
          path: { ...path, product_id: product.id }, body: { prices: [{ currency: "GBP", amount_micros: amount * 1_000_000 }] } });
        if (prices.error && (prices.error as { type?: string }).type !== "resource_already_exists") {
          throw new Error("Failed to configure Test Store price.");
        }
      }
      const attached = take(await getProductsFromPackage({ client, path: { ...path, package_id: pkg.id }, query: { limit: 100 } }));
      if (!attached.items.some(p => p.product_id === product.id)) {
        take(await attachProductsToPackage({ client, path: { ...path, package_id: pkg.id },
          body: { products: [{ product_id: product.id, eligibility_criteria: "all" }] } }));
      }
    }
  }
  await updateOffering({ client, path: { ...path, offering_id: offering.id },
    body: { is_current: !offerings.some(o => o.is_current && o.id !== offering.id),
      metadata: { wallet_currency: "GBP", credit_packs: creditPacks } } }).then(take);
  const keys = take(await listAppPublicApiKeys({ client, path: { ...path, app_id: test.id } }));
  console.log(JSON.stringify({ projectId: project.id, testAppId: test.id,
    offeringId: offering.id, testPublicKey: keys.items[0]?.key,
    androidAppId: android?.id ?? null,
    blocker: packageName ? "Google Play Console setup deferred." : "Android package identifier not set; no Android app was created." }));
}
main().catch(() => { console.error("RevenueCat seed failed. Inspect integration access/configuration; no secret values logged."); process.exitCode = 1; });
