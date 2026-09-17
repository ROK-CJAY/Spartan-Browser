import { createServerFn } from "@tanstack/react-start";
import { applyHostedAdmins, applyHostedKnowledge } from "./knowledge-server";
import { parseKnowledgeCatalog } from "./knowledge-import";
import {
  APP_VERSION,
  KNOWLEDGE_CATALOG_URLS,
  POLICY_URLS,
  RELEASES_URL,
  buildUpdateStatus,
  fallbackPolicy,
  parseDeskPolicy,
  setHostedModel,
  type DeskPolicy,
  type DeskUpdateStatus,
} from "./desk-updates";

const FETCH_MS = 8000;
let lastKnowledgeAt = "";

async function fetchJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/vnd.github+json, application/json",
        "User-Agent": "MDC-HelpDesk-Browser",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeBase64(value: string): string {
  const clean = value.replace(/\s/g, "");
  if (typeof atob === "function") return atob(clean);
  const BufferCtor = (globalThis as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer;
  if (BufferCtor) return BufferCtor.from(clean, "base64").toString("utf8");
  return clean;
}

function decodeGithubFile(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const value = json as Record<string, unknown>;
  if (typeof value.content === "string" && typeof value.sha === "string") {
    try {
      return JSON.parse(decodeBase64(value.content));
    } catch {
      return json;
    }
  }
  return json;
}

async function loadHostedPolicy(): Promise<{ policy: DeskPolicy; source: DeskUpdateStatus["source"] }> {
  for (const url of POLICY_URLS) {
    const json = await fetchJson(url);
    const policy = parseDeskPolicy(json);
    if (policy) return { policy, source: "github" };
  }
  return { policy: fallbackPolicy(), source: "offline" };
}

async function loadLatestRelease(): Promise<{ tag: string | null; url: string | null; notes: string | null }> {
  const json = await fetchJson(RELEASES_URL);
  if (!json || typeof json !== "object") return { tag: null, url: null, notes: null };
  const value = json as Record<string, unknown>;
  const tag = typeof value.tag_name === "string" ? value.tag_name.replace(/^v/i, "") : null;
  const url = typeof value.html_url === "string" ? value.html_url : null;
  const notes = typeof value.body === "string" ? value.body.slice(0, 400) : null;
  return { tag, url, notes };
}

async function loadHostedKnowledge() {
  for (const url of KNOWLEDGE_CATALOG_URLS) {
    const json = await fetchJson(url);
    if (!json) continue;
    const catalog = parseKnowledgeCatalog(decodeGithubFile(json));
    if (catalog) return catalog;
  }
  return null;
}

export async function pullHostedKnowledge() {
  const catalog = await loadHostedKnowledge();
  if (!catalog) return { updatedAt: null as string | null, count: 0, applied: false };
  if (catalog.updatedAt && catalog.updatedAt === lastKnowledgeAt) {
    return { updatedAt: catalog.updatedAt, count: catalog.articles.length, applied: false };
  }
  await applyHostedKnowledge(catalog.articles);
  lastKnowledgeAt = catalog.updatedAt;
  return { updatedAt: catalog.updatedAt, count: catalog.articles.length, applied: true };
}

export const syncHostedKnowledge = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return await pullHostedKnowledge();
  } catch (err) {
    console.error("[knowledge] pull skipped:", err);
    return { updatedAt: null, count: 0, applied: false };
  }
});

export const checkDeskUpdates = createServerFn({ method: "GET" }).handler(async (): Promise<DeskUpdateStatus> => {
  try {
    const [{ policy, source }, release] = await Promise.all([loadHostedPolicy(), loadLatestRelease()]);
    await applyHostedAdmins(policy.admins).catch((err) => {
      console.error("[updates] admin sync skipped:", err);
    });
    setHostedModel(policy.modelUrl, policy.modelName);
    await pullHostedKnowledge().catch(() => null);
    return buildUpdateStatus({
      policy,
      source,
      latestVersion: release.tag,
      releaseUrl: release.url,
      releaseNotes: release.notes,
    });
  } catch (err) {
    console.error("[updates] check failed:", err);
    return buildUpdateStatus({
      policy: fallbackPolicy(),
      source: "offline",
      latestVersion: null,
      releaseUrl: null,
      releaseNotes: null,
    });
  }
});

export { APP_VERSION };
