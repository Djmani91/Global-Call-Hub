import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setHapticsEnabled } from '@/components/ui';
import { CallEntry, DEMO_CALLS, DEMO_THREADS, Thread } from '@/data/demo';

export type Profile = { name: string; email: string; homeCountry: string };
export type Prefs = { haptics: boolean; notifyMessages: boolean; notifyCalls: boolean; showSeconds: boolean; compact: boolean };
type Store = { profile: Profile; prefs: Prefs; threads: Thread[]; calls: CallEntry[]; blocked: string[]; reserved: string[] };

const DEFAULT: Store = {
  profile: { name: 'Sana Whitfield', email: 'sana@example.com', homeCountry: 'GB' },
  prefs: { haptics: true, notifyMessages: true, notifyCalls: true, showSeconds: false, compact: false },
  threads: DEMO_THREADS, calls: DEMO_CALLS, blocked: [], reserved: [],
};
const KEY = 'linea.store.v1';

type Ctx = Store & {
  ready: boolean;
  setProfile: (p: Profile) => void;
  setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
  saveLocalMessage: (number: string, text: string) => string;
  setDraft: (threadId: string, draft: string) => void;
  markRead: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  logAttempt: (number: string) => void;
  clearCalls: () => void;
  toggleBlocked: (number: string) => void;
  toggleShortlist: (id: string) => void;
  resetDemo: () => void;
};
const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) setStore({ ...DEFAULT, ...JSON.parse(raw) }); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => {});
  }, [store, ready]);

  useEffect(() => { setHapticsEnabled(store.prefs.haptics); }, [store.prefs.haptics]);

  const update = useCallback((fn: (s: Store) => Store) => setStore(fn), []);

  const value = useMemo<Ctx>(() => ({
    ...store, ready,
    setProfile: (profile) => update((s) => ({ ...s, profile })),
    setPref: (k, v) => update((s) => ({ ...s, prefs: { ...s.prefs, [k]: v } })),
    saveLocalMessage: (number, text) => {
      const existing = store.threads.find((t) => t.number === number);
      const id = existing?.id ?? `t${Date.now()}`;
      const msg = { id: `m${Date.now()}${Math.random().toString(36).slice(2, 7)}`, from: 'me' as const, text, at: Date.now(), local: true };
      update((s) => {
        const has = s.threads.some((t) => t.id === id);
        const threads = has
          ? s.threads.map((t) => (t.id === id ? { ...t, draft: '', messages: [...t.messages, msg] } : t))
          : [{ id, number, messages: [msg] }, ...s.threads];
        return { ...s, threads };
      });
      return id;
    },
    setDraft: (id, draft) => update((s) => ({ ...s, threads: s.threads.map((t) => (t.id === id ? { ...t, draft } : t)) })),
    markRead: (id) => update((s) => ({ ...s, threads: s.threads.map((t) => (t.id === id && t.unread ? { ...t, unread: false } : t)) })),
    deleteThread: (id) => update((s) => ({ ...s, threads: s.threads.filter((t) => t.id !== id) })),
    logAttempt: (number) => update((s) => ({ ...s, calls: [{ id: `k${Date.now()}`, number, direction: 'out', at: Date.now(), duration: 'Not placed' }, ...s.calls] })),
    clearCalls: () => update((s) => ({ ...s, calls: [] })),
    toggleBlocked: (n) => update((s) => ({ ...s, blocked: s.blocked.includes(n) ? s.blocked.filter((b) => b !== n) : [...s.blocked, n] })),
    toggleShortlist: (id) => update((s) => ({ ...s, reserved: s.reserved.includes(id) ? s.reserved.filter((b) => b !== id) : [...s.reserved, id] })),
    resetDemo: () => update(() => DEFAULT),
  }), [store, ready, update]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error('useApp must be inside AppProvider');
  return c;
}
