const SOURCES = [
  (host: string) => `https://icons.duckduckgo.com/ip3/${host}.ico`,
  (host: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`,
] as const;

const cache = new Map<string, { type: string; body: ArrayBuffer; until: number }>();
const CACHE_MS = 24 * 60 * 60 * 1000;

export function sanitizeFaviconHost(raw: string | null | undefined): string {
  const host = (raw ?? "").trim().toLowerCase();
  if (host.length < 3 || host.length > 253) return "";
  if (host.includes("..") || host.startsWith(".") || host.endsWith(".")) return "";
  if (!/^[a-z0-9.-]+$/.test(host)) return "";
  if (!host.includes(".")) return "";
  return host;
}

export function letterSvg(host: string): string {
  const ch = (host.charAt(0).toUpperCase().match(/[A-Z0-9]/)?.[0] ?? "?");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1c222b"/><text x="16" y="21" text-anchor="middle" font-size="16" font-family="system-ui,sans-serif" fill="#8b96a3">${ch}</text></svg>`;
}

export function letterResponse(host: string): Response {
  return new Response(letterSvg(host), {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

export async function resolveFavicon(host: string): Promise<Response> {
  const clean = sanitizeFaviconHost(host);
  if (!clean) return letterResponse("?");
  const hit = cache.get(clean);
  if (hit && hit.until > Date.now()) {
    return new Response(hit.body, {
      status: 200,
      headers: {
        "content-type": hit.type,
        "cache-control": "public, max-age=86400",
      },
    });
  }

  let fallback: { type: string; body: ArrayBuffer } | null = null;
  for (const src of SOURCES) {
    try {
      const res = await fetch(src(clean), { redirect: "follow", signal: AbortSignal.timeout(4000) });
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!type.startsWith("image/")) continue;
      const body = await res.arrayBuffer();
      if (body.byteLength < 32) continue;
      const payload = { type, body };
      if (res.ok) {
        cache.set(clean, { ...payload, until: Date.now() + CACHE_MS });
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": type,
            "cache-control": "public, max-age=86400",
          },
        });
      }
      fallback ??= payload;
    } catch {
      continue;
    }
  }

  if (fallback) {
    cache.set(clean, { ...fallback, until: Date.now() + 60 * 60 * 1000 });
    return new Response(fallback.body, {
      status: 200,
      headers: {
        "content-type": fallback.type,
        "cache-control": "public, max-age=3600",
      },
    });
  }

  return letterResponse(clean);
}
