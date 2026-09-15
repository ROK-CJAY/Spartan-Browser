import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { applyHostedAdmins } from "./knowledge-server";
import {
  APP_VERSION,
  POLICY_URLS,
  RELEASES_URL,
  buildUpdateStatus,
  fallbackPolicy,
  parseDeskPolicy,
  type DeskPolicy,
  type DeskUpdateStatus,
} from "./desk-updates";

const FETCH_MS = 8000;

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

async function loadFallbackFile(): Promise<DeskPolicy | null> {
  try {
    const file = path.join(process.cwd(), "public", "desk-policy.json");
    const raw = await readFile(file, "utf-8");
    return parseDeskPolicy(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function loadHostedPolicy(): Promise<{ policy: DeskPolicy; source: DeskUpdateStatus["source"] }> {
  for (const url of POLICY_URLS) {
    const json = await fetchJson(url);
    const policy = parseDeskPolicy(json);
    if (policy) return { policy, source: "github" };
  }
  const file = await loadFallbackFile();
  if (file) return { policy: file, source: "fallback" };
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

export const checkDeskUpdates = createServerFn({ method: "GET" }).handler(async (): Promise<DeskUpdateStatus> => {
  const [{ policy, source }, release] = await Promise.all([loadHostedPolicy(), loadLatestRelease()]);
  await applyHostedAdmins(policy.admins);
  return buildUpdateStatus({
    policy,
    source,
    latestVersion: release.tag,
    releaseUrl: release.url,
    releaseNotes: release.notes,
  });
});

export { APP_VERSION };
