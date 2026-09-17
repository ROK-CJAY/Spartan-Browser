import { isCountyEmail, normalizeEmail, SEEDED_KNOWLEDGE_ADMINS } from "./knowledge-base.ts";


export const APP_VERSION = "0.9.5";
export const HDB_REPO = "ROK-CJAY/Spartan-Browser";

export const POLICY_URLS = [
  `https://raw.githubusercontent.com/${HDB_REPO}/main/policy/desk-policy.json`,
  `https://raw.githubusercontent.com/${HDB_REPO}/main/desk-policy.json`,
] as const;
export const KNOWLEDGE_CATALOG_URLS = [
  `https://raw.githubusercontent.com/${HDB_REPO}/main/knowledge/desk-knowledge.json`,
  `https://api.github.com/repos/${HDB_REPO}/contents/knowledge/desk-knowledge.json?ref=main`,
] as const;
export const KNOWLEDGE_POLL_MS = 60_000;
export const RELEASES_URL = `https://api.github.com/repos/${HDB_REPO}/releases/latest`;

export type DeskPolicy = {
  schema: number;
  updatedAt: string;
  minAppVersion?: string;
  admins: string[];
  modelUrl?: string;
  modelName?: string;
};

export type HostedModel = {
  url: string;
  name: string;
};

export type DeskUpdateStatus = {
  checkedAt: string;
  source: "github" | "fallback" | "offline";
  policy: DeskPolicy;
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
};

let hostedAdmins: string[] = [...SEEDED_KNOWLEDGE_ADMINS];
let hostedModel: HostedModel = { url: "", name: "llama3.1" };

export function setHostedAdmins(emails: string[]) {
  const next = emails.map(normalizeEmail).filter(isCountyEmail);
  hostedAdmins = next.length ? next : [...SEEDED_KNOWLEDGE_ADMINS];
}

export function getHostedAdmins(): string[] {
  return hostedAdmins;
}

export function isHostedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return hostedAdmins.includes(normalizeEmail(email));
}

export function setHostedModel(url?: string, name?: string) {
  hostedModel = {
    url: sanitizeModelUrl(url || ""),
    name: (name || "llama3.1").trim().slice(0, 80) || "llama3.1",
  };
}

export function getHostedModel(): HostedModel {
  return hostedModel;
}

function isPrivateIpv4(host: string) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  const d = Number(m[4]);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/** Localhost, county host, or RFC1918 — never a public LLM host. */
export function sanitizeModelUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    if (host === "127.0.0.1" || host === "localhost") return url.origin;
    if (host === "miamidade.gov" || host.endsWith(".miamidade.gov")) return url.origin;
    if (isPrivateIpv4(host)) return url.origin;
    return "";
  } catch {
    return "";
  }
}

export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function parseDeskPolicy(raw: unknown): DeskPolicy | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const admins = Array.isArray(value.admins)
    ? value.admins.map((item) => normalizeEmail(String(item))).filter(isCountyEmail)
    : [];
  if (!admins.length) return null;
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString();
  const minAppVersion = typeof value.minAppVersion === "string" ? value.minAppVersion : undefined;
  const schema = typeof value.schema === "number" ? value.schema : 1;
  const modelUrl = typeof value.modelUrl === "string" ? sanitizeModelUrl(value.modelUrl) : "";
  const modelName = typeof value.modelName === "string" ? value.modelName.trim().slice(0, 80) : "";
  return {
    schema,
    updatedAt,
    minAppVersion,
    admins,
    ...(modelUrl ? { modelUrl } : {}),
    ...(modelName ? { modelName } : {}),
  };
}

export function fallbackPolicy(): DeskPolicy {
  return {
    schema: 1,
    updatedAt: "shipped",
    minAppVersion: APP_VERSION,
    admins: [...SEEDED_KNOWLEDGE_ADMINS],
  };
}

export function buildUpdateStatus(input: {
  policy: DeskPolicy;
  source: DeskUpdateStatus["source"];
  latestVersion?: string | null;
  releaseUrl?: string | null;
  releaseNotes?: string | null;
  now?: string;
}): DeskUpdateStatus {
  const latest = input.latestVersion ?? null;
  const behindRelease = latest ? compareVersions(latest, APP_VERSION) > 0 : false;
  const behindMin = input.policy.minAppVersion
    ? compareVersions(input.policy.minAppVersion, APP_VERSION) > 0
    : false;
  return {
    checkedAt: input.now ?? new Date().toISOString(),
    source: input.source,
    policy: input.policy,
    currentVersion: APP_VERSION,
    latestVersion: latest,
    updateAvailable: behindRelease || behindMin,
    releaseUrl: input.releaseUrl ?? `https://github.com/${HDB_REPO}/releases`,
    releaseNotes: input.releaseNotes ?? null,
  };
}
