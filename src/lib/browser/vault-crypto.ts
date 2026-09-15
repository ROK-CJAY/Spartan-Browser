import type { ElevatedToolId, SavedLogin } from "./types";

const enc = new TextEncoder();
const dec = new TextDecoder();
const SALT = enc.encode("mdc-helpdesk-vault-v1");
const keyCache = new Map<string, CryptoKey>();

function b64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(value: string) {
  const s = atob(value);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function material(ownerId: string, pin?: string | null) {
  return `${ownerId}::${pin?.trim() || "open"}::mdc-helpdesk-vault-v1`;
}

async function vaultKey(ownerId: string, pin?: string | null) {
  const id = material(ownerId, pin);
  const cached = keyCache.get(id);
  if (cached) return cached;
  const base = await crypto.subtle.importKey("raw", enc.encode(id), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  keyCache.set(id, key);
  return key;
}

export function dropVaultKeyCache() {
  keyCache.clear();
}

export async function sealSecret(ownerId: string, plaintext: string, pin?: string | null) {
  const key = await vaultKey(ownerId, pin);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return `${b64(iv)}.${b64(new Uint8Array(cipher))}`;
}

export async function openSecret(ownerId: string, packed: string, pin?: string | null) {
  const [ivPart, cipherPart] = packed.split(".");
  if (!ivPart || !cipherPart) throw new Error("bad secret");
  const key = await vaultKey(ownerId, pin);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivPart) },
    key,
    unb64(cipherPart),
  );
  return dec.decode(plain);
}

export async function hashVaultPin(ownerId: string, pin: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${ownerId}::${pin.trim()}::mdc-vault-pin`));
  return b64(new Uint8Array(digest));
}

export function persistableLogins(logins: SavedLogin[], keepSecrets = true): SavedLogin[] {
  return logins.map((l) => ({
    id: l.id,
    site: l.site,
    username: l.username,
    secret: keepSecrets ? l.secret : undefined,
    notes: l.notes,
    updatedAt: l.updatedAt,
    kind: l.kind,
    tool: l.tool,
    expiresAt: l.expiresAt,
  }));
}

export function siteHost(site: string) {
  const raw = site.trim();
  if (!raw) return "";
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return raw.toLowerCase().split("/")[0] ?? "";
  }
}

export function loginsForUrl(logins: SavedLogin[], url: string) {
  const host = siteHost(url);
  if (!host) return [];
  return logins.filter((l) => {
    const site = siteHost(l.site);
    if (!site) return false;
    return host === site || host.endsWith(`.${site}`) || site.endsWith(`.${host}`);
  });
}

const GEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_";

export function generatePassword(length = 18) {
  const n = Math.min(32, Math.max(12, length));
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => GEN_CHARS[b % GEN_CHARS.length]).join("");
}

export function passwordStrength(value: string) {
  let score = 0;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (score <= 2) return "Fair";
  if (score <= 4) return "Strong";
  return "Very strong";
}

export function addDaysIso(from: Date, days: number) {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function loginForTool(logins: SavedLogin[], tool: ElevatedToolId) {
  return logins.find((l) => l.tool === tool || l.site === `mdc-tool://${tool}`) ?? null;
}

export function expiryState(login: SavedLogin | null): {
  state: "missing" | "expired" | "soon" | "ok";
  days: number | null;
} {
  if (!login) return { state: "missing", days: null };
  const raw = login.expiresAt;
  if (!raw) return { state: "expired", days: 0 };
  const days = Math.ceil((new Date(raw).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return { state: "expired", days };
  if (days <= 14) return { state: "soon", days };
  return { state: "ok", days };
}

export function formatExpiry(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}
