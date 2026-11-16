export type Country = { code: string; name: string; dial: string; kind: string; stripes: string[]; vertical?: boolean; note: string; local?: boolean };
export const COUNTRIES: Country[] = [
  { code: 'GB', name: 'United Kingdom', dial: '+44', kind: 'Mobile & Landline', stripes: ['#1E3E8C', '#F4F1EA', '#C8202F'], note: 'Proof of address may be required by the regulator.', local: true },
  { code: 'AU', name: 'Australia', dial: '+61', kind: 'Mobile', stripes: ['#1E3E8C', '#F4F1EA', '#1E3E8C'], note: 'Australian numbers typically require a local business or residential address.' },
  { code: 'AT', name: 'Austria', dial: '+43', kind: 'Mobile', stripes: ['#C8202F', '#F4F1EA', '#C8202F'], note: 'Identity documents may be required before activation.' },
  { code: 'CA', name: 'Canada', dial: '+1', kind: 'Mobile', stripes: ['#C8202F', '#F4F1EA', '#C8202F'], vertical: true, note: 'Generally available; SMS registration rules may apply.' },
  { code: 'FI', name: 'Finland', dial: '+358', kind: 'Mobile', stripes: ['#F4F1EA', '#2457A8', '#F4F1EA'], note: 'Availability is limited and may need end-user verification.' },
  { code: 'FR', name: 'France', dial: '+33', kind: 'Mobile', stripes: ['#2457A8', '#F4F1EA', '#C8202F'], vertical: true, note: 'A French address and ID are usually required.' },
  { code: 'IL', name: 'Israel', dial: '+972', kind: 'Mobile', stripes: ['#F4F1EA', '#2457A8', '#F4F1EA'], note: 'Inventory is limited; documentation may be required.' },
  { code: 'MX', name: 'Mexico', dial: '+52', kind: 'Mobile', stripes: ['#1D7A45', '#F4F1EA', '#C8202F'], vertical: true, note: 'Local address requirements may apply.' },
  { code: 'PR', name: 'Puerto Rico', dial: '+1', kind: 'Mobile', stripes: ['#C8202F', '#F4F1EA', '#C8202F'], note: 'Follows North American numbering plan rules.' },
  { code: 'US', name: 'United States', dial: '+1', kind: 'Mobile', stripes: ['#C8202F', '#F4F1EA', '#1E3E8C'], note: 'Messaging to US numbers requires A2P 10DLC registration.' },
];
export const findCountry = (code?: string) => COUNTRIES.find((c) => c.code === code);

const SAMPLE_DIGITS: Record<string, string[]> = {
  GB: ['7700 900481', '7700 900726', '7700 900153', '20 7946 0318'],
  AU: ['491 570 142', '491 570 386', '491 571 009'],
  AT: ['664 120 4471', '664 120 9083', '660 300 1172'],
  CA: ['(604) 555-0142', '(416) 555-0187', '(514) 555-0129'],
  FI: ['40 120 4428', '50 330 8721'],
  FR: ['6 12 34 56 08', '7 00 11 42 90', '6 98 76 01 33'],
  IL: ['50 555 0173', '52 555 0841'],
  MX: ['55 5501 2384', '33 5502 7719', '81 5503 4410'],
  PR: ['(787) 555-0134', '(939) 555-0172'],
  US: ['(212) 555-0168', '(415) 555-0193', '(312) 555-0127', '(646) 555-0151'],
};
const SAMPLE_MONTHLY: Record<string, number> = { GB: 4.49, AU: 6.25, AT: 5.8, CA: 3.15, FI: 7.4, FR: 5.35, IL: 9.1, MX: 4.85, PR: 3.15, US: 2.95 };
export type SampleNumber = { id: string; country: string; display: string; monthly: number; sms: boolean; voice: boolean };
export function sampleNumbers(code: string): SampleNumber[] {
  const c = findCountry(code);
  return (SAMPLE_DIGITS[code] ?? []).map((d, i) => ({
    id: `${code}-${i}`, country: code, display: `${c?.dial} ${d}`,
    monthly: +(SAMPLE_MONTHLY[code] + i * 0.35).toFixed(2), sms: !(code === 'IL' && i === 1), voice: true,
  }));
}
export const findSample = (id?: string) => {
  const code = id?.split('-')[0] ?? '';
  return sampleNumbers(code).find((n) => n.id === id);
};

export type Contact = { id: string; name: string; number: string; hue: string };
export const CONTACTS: Contact[] = [
  { id: 'c1', name: 'Ines Okafor', number: '+44 7700 900214', hue: '#D9F5E3' },
  { id: 'c2', name: 'Tomas Reyes', number: '+52 55 5501 8820', hue: '#E3E2FA' },
  { id: 'c3', name: 'Halvard Lindqvist', number: '+358 40 120 7731', hue: '#FBE6D4' },
  { id: 'c4', name: 'Priya Venkatesan', number: '+1 (416) 555-0110', hue: '#D8F1F6' },
  { id: 'c5', name: 'Mira Abergel', number: '+972 50 555 0119', hue: '#F7DDE6' },
  { id: 'c6', name: 'Lindenhof Dental', number: '+43 1 555 0193', hue: '#E9F2CF' },
];
export const contactByNumber = (n: string) => CONTACTS.find((c) => c.number === n);

export type CallEntry = { id: string; number: string; direction: 'in' | 'out' | 'missed'; at: number; duration?: string };
const now = Date.now();
const h = 3600_000;
export const DEMO_CALLS: CallEntry[] = [
  { id: 'k1', number: '+44 7700 900214', direction: 'missed', at: now - 1.3 * h },
  { id: 'k2', number: '+52 55 5501 8820', direction: 'out', at: now - 5.2 * h, duration: '12m 41s' },
  { id: 'k3', number: '+1 (416) 555-0110', direction: 'in', at: now - 27 * h, duration: '4m 08s' },
  { id: 'k4', number: '+43 1 555 0193', direction: 'missed', at: now - 50 * h },
  { id: 'k5', number: '+358 40 120 7731', direction: 'out', at: now - 74 * h, duration: '23m 17s' },
  { id: 'k6', number: '+972 50 555 0119', direction: 'in', at: now - 6.1 * 24 * h, duration: '1m 52s' },
  { id: 'k7', number: '+33 6 55 01 42 77', direction: 'missed', at: now - 9 * 24 * h },
];

export type Message = { id: string; text: string; at: number; from: 'them' | 'me'; local?: boolean };
export type Thread = { id: string; number: string; messages: Message[]; draft?: string; unread?: boolean };
export const DEMO_THREADS: Thread[] = [
  { id: 't1', number: '+44 7700 900214', unread: true, messages: [
    { id: 'm1', from: 'them', text: 'Landed in Lisbon. Call Sunday when you are free?', at: now - 3 * h },
    { id: 'm2', from: 'them', text: 'Mum says hello too.', at: now - 2.9 * h },
  ] },
  { id: 't2', number: '+52 55 5501 8820', messages: [
    { id: 'm3', from: 'them', text: 'The flat viewing moved to Thursday, 10:30.', at: now - 30 * h },
  ] },
  { id: 't3', number: '+43 1 555 0193', messages: [
    { id: 'm4', from: 'them', text: 'Lindenhof Dental: reminder of your appointment on 4 Dec at 09:15.', at: now - 10 * 24 * h },
  ] },
];

export const TOPUPS = [
  { id: 'p1', amount: 4.99, note: 'About 160 UK mobile minutes (sample rate)' },
  { id: 'p2', amount: 9.99, note: 'About 340 UK mobile minutes (sample rate)' },
  { id: 'p3', amount: 19.99, note: 'About 720 UK mobile minutes (sample rate)' },
  { id: 'p4', amount: 39.99, note: 'Best for frequent international calls' },
];
export const SAMPLE_RATES = [
  { code: 'GB', call: 0.03, sms: 0.04 }, { code: 'US', call: 0.02, sms: 0.03 }, { code: 'CA', call: 0.02, sms: 0.03 },
  { code: 'FR', call: 0.06, sms: 0.07 }, { code: 'MX', call: 0.09, sms: 0.05 }, { code: 'IL', call: 0.11, sms: 0.08 },
  { code: 'AU', call: 0.07, sms: 0.06 }, { code: 'FI', call: 0.08, sms: 0.07 }, { code: 'AT', call: 0.07, sms: 0.07 }, { code: 'PR', call: 0.03, sms: 0.03 },
];

export function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const hrs = Math.round(m / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const d = Math.round(hrs / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}
export const initials = (s: string) => s.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '#';
export function when(t: number, exact: boolean) {
  if (!exact) return ago(t);
  const d = new Date(t);
  return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}
