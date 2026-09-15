import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { defaultClearOnClose, defaultConfig, defaultPayload, type BrowserPayload, type SavedLogin } from "./types";

function persistable(logins: SavedLogin[] | undefined): SavedLogin[] {
  return (logins ?? []).map((l) => ({
    id: l.id,
    site: l.site,
    username: l.username,
    secret: l.secret,
    notes: l.notes,
    updatedAt: l.updatedAt,
    kind: l.kind,
    tool: l.tool,
    expiresAt: l.expiresAt,
  }));
}

function parsePayload(raw: string | null | undefined): BrowserPayload {
  if (!raw) return defaultPayload();
  try {
    const parsed = JSON.parse(raw) as BrowserPayload;
    if (!parsed?.profiles?.length || !parsed.theme) return defaultPayload();
    const base = defaultPayload();
    return {
      ...base,
      ...parsed,
      config: {
        ...defaultConfig(),
        ...parsed.config,
        clearOnClose: { ...defaultClearOnClose(), ...parsed.config?.clearOnClose },
      },
      logins: persistable(parsed.logins ?? base.logins),
      downloads: parsed.downloads ?? [],
      vaultPinHash: parsed.vaultPinHash ?? null,
    };
  } catch {
    return defaultPayload();
  }
}

export const loadBrowserState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BrowserPayload | null> => {
    const sql = await getSql();
    const rows = await sql<{ payload: string }>`
      select payload from browser_state where user_id = ${context.userId} limit 1
    `;
    if (!rows[0]?.payload) return null;
    return parsePayload(rows[0].payload);
  });

export const saveBrowserState = createServerFn({ method: "POST" })
  .validator((payload: BrowserPayload) => payload)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const safe: BrowserPayload = {
      ...data,
      logins: persistable(data.logins),
    };
    const json = JSON.stringify(safe);
    await sql`
      insert into browser_state (user_id, payload, updated_at)
      values (${context.userId}, ${json}, now())
      on conflict (user_id)
      do update set payload = excluded.payload, updated_at = now()
    `;
    return { ok: true as const };
  });
