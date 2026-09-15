import {
  defaultClearOnClose,
  defaultConfig,
  defaultPayload,
  defaultQuickAccess,
  normalizeTab,
  type BrowserPayload,
  type Profile,
  type SavedLogin,
} from "./types";
import { persistableLogins } from "./vault-crypto";

export const GUEST_OWNER = "guest";
export const LEGACY_STORE_KEY = "mdc-helpdesk-browser";
const LAST_DESK_KEY = "mdc-helpdesk-browser:last-desk";

export function storageName(owner: string) {
  return `mdc-helpdesk-browser:v3:${owner}`;
}

/** Drop the old shared key so Employee B cannot inherit Employee A's desk. */
export function purgeLegacySharedStore() {
  try {
    localStorage.removeItem(LEGACY_STORE_KEY);
  } catch {
    /* ignore */
  }
}

export type LastDesk = { name: string; at: string };

/** Display name only — never vault data. Shared PCs show who sat here last. */
export function rememberLastDesk(name: string) {
  const label = name.trim();
  if (!label || ["guest desk", "guest", "desk", "work", "help desk"].includes(label.toLowerCase())) return;
  try {
    localStorage.setItem(LAST_DESK_KEY, JSON.stringify({ name: label, at: new Date().toISOString() } satisfies LastDesk));
  } catch {
    /* ignore */
  }
}

export function readLastDesk(): LastDesk | null {
  try {
    const raw = localStorage.getItem(LAST_DESK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastDesk;
    if (!parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

function asPayload(raw: unknown): BrowserPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as { state?: Partial<BrowserPayload> } & Partial<BrowserPayload>;
  const s = parsed.state ?? parsed;
  if (!s.profiles?.length || !s.theme) return null;
  const base = defaultPayload();
  return {
    ...base,
    ...s,
    profiles: s.profiles.map(normalizeProfile),
    config: {
      ...defaultConfig(),
      ...s.config,
      clearOnClose: { ...defaultClearOnClose(), ...s.config?.clearOnClose },
    },
    logins: persistableLogins((s.logins ?? []) as SavedLogin[], true),
    downloads: s.downloads ?? [],
    vaultPinHash: s.vaultPinHash ?? null,
  };
}

export function normalizeProfile(p: Profile): Profile {
  return {
    ...p,
    kind: p.kind ?? "local",
    bookmarks: (p.bookmarks ?? []).map((b) => ({ ...b, folder: b.folder ?? "" })),
    tabs: (p.tabs ?? []).map(normalizeTab),
    quickAccess: Array.isArray(p.quickAccess) ? p.quickAccess : defaultQuickAccess(),
  };
}

export function readLocalPayload(owner: string): BrowserPayload | null {
  try {
    const raw = localStorage.getItem(storageName(owner));
    if (!raw) return null;
    return asPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}
