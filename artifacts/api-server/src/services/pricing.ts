// Decimal arithmetic keeps provider fractions intact until the final display rounding.
export const MULTIPLIER = 3;
export const BILLING_CURRENCIES = {
  GB: "GBP", US: "USD", PR: "USD", AU: "AUD", AT: "EUR",
  CA: "CAD", FI: "EUR", FR: "EUR", IL: "ILS", MX: "MXN",
} as const;

function decimal(value: unknown): { value: bigint; scale: bigint } {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,12})?$/.test(text)) throw new Error("Twilio returned an unavailable or invalid current price. Prices are hidden.");
  const [whole, fraction = ""] = text.split(".");
  return { value: BigInt(whole + fraction), scale: 10n ** BigInt(fraction.length) };
}

export function customerAmount(cost: unknown, fx: unknown, precision: number): number {
  const a = decimal(cost);
  const b = decimal(fx);
  if (b.value <= 0n) throw new Error("Invalid exchange rate");
  const scale = 10n ** BigInt(precision);
  const numerator = a.value * 3n * b.value * scale;
  const denominator = a.scale * b.scale;
  return Number((numerator + denominator / 2n) / denominator) / Number(scale);
}

export type RawRate = {
  label: string; direction: "rental" | "incoming" | "outgoing";
  numberType: string; cost: unknown; unit: "month" | "minute" | "segment"; prefixes: string[];
};
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Twilio pricing data");
  return value as RecordValue;
};
function list(value: unknown): RecordValue[] {
  if (!Array.isArray(value)) throw new Error("Invalid Twilio pricing data");
  return value.map(object);
}
const text = (value: unknown, fallback: string) => typeof value === "string" && value ? value : fallback;

export function extractRates(kind: "numbers" | "voice" | "sms", body: RecordValue): RawRate[] {
  const rows: RawRate[] = [];
  const add = (p: RecordValue, direction: RawRate["direction"], unit: RawRate["unit"], label: string, prefixes: string[] = []) => {
    // Null is not zero: a missing rate must never be offered as free.
    decimal(p.current_price);
    rows.push({ label, direction, unit, cost: p.current_price, numberType: text(p.number_type, "all"), prefixes });
  };
  if (kind === "numbers") {
    list(body.phone_number_prices).forEach(p => add(p, "rental", "month", text(p.number_type, "Number rental")));
  } else if (kind === "voice") {
    list(body.inbound_call_prices).forEach(p => add(p, "incoming", "minute", text(p.number_type, "Incoming call")));
    list(body.outbound_prefix_prices).forEach(p => {
      const prefixes = Array.isArray(p.prefixes) ? p.prefixes.map(String) : [];
      const origins = Array.isArray(p.origination_prefixes) ? p.origination_prefixes.map(String) : [];
      const label = text(p.friendly_name, "Outgoing call") + (origins.length ? ` · origin prefixes ${origins.join(", ")}` : "");
      add(p, "outgoing", "minute", label, prefixes);
    });
  } else {
    list(body.inbound_sms_prices).forEach(p => add(p, "incoming", "segment", text(p.number_type, "Incoming SMS")));
    list(body.outbound_sms_prices).forEach(network => {
      list(network.prices).forEach(p => add(p, "outgoing", "segment",
        `${text(network.carrier, "Destination network")} · ${text(p.number_type, "SMS")} · MCC ${text(network.mcc, "—")} / MNC ${text(network.mnc, "—")}`));
    });
  }
  return rows;
}

type Fx = { rate: number; date: string | null };
const fxCache = new Map<string, { expires: number; fx: Fx }>();
export async function exchangeRate(from: string, to: string): Promise<Fx> {
  if (from === to) return { rate: 1, date: null };
  const key = `${from}:${to}`;
  const cached = fxCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.fx;
  try {
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${from}/${to}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Exchange service failed");
    const body = object(await response.json());
    const age = Date.now() - Date.parse(String(body.date) + "T00:00:00Z");
    if (body.base !== from || body.quote !== to || typeof body.rate !== "number" ||
        !Number.isFinite(body.rate) || body.rate <= 0 || !Number.isFinite(age) ||
        age > 7 * 86_400_000 || age < -86_400_000) throw new Error("Invalid exchange quote");
    const fx = { rate: body.rate, date: String(body.date) };
    fxCache.set(key, { expires: Date.now() + 3_600_000, fx });
    return fx;
  } catch {
    throw new Error(`Exchange rate unavailable for ${from} → ${to}. Prices are hidden; please retry later.`);
  }
}
