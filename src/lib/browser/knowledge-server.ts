import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { bumpKnowledgeCache } from "./knowledge-base";
import {
  KNOWLEDGE_ARTICLES,
  SEEDED_KNOWLEDGE_ADMINS,
  applyLifecycle,
  isCountyEmail,
  isShippedAdmin,
  normalizeEmail,
  publishedArticles,
  todayISO,
  type ArticleCurrency,
  type KnowledgeArticle,
} from "./knowledge-base";
import { isHostedAdmin, setHostedAdmins } from "./desk-updates";

export type KnowledgeAdmin = {
  email: string;
  userId: string;
  addedBy: string;
  addedAt: string;
};

export type KnowledgeAccess = {
  signedIn: boolean;
  isAdmin: boolean;
  email: string | null;
  county: boolean;
  bootstrapped: boolean;
  admins: KnowledgeAdmin[];
};

export type ArticleInput = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  keywords: string[];
  lastReviewed: string;
  currency: ArticleCurrency;
  featured: boolean;
  supersedes: string[];
  staleNote: string;
  expiresOn: string | null;
  retired: boolean;
};

type ArticleRow = {
  id: string;
  title: string;
  summary: string;
  steps_json: string;
  keywords_json: string;
  last_reviewed: string;
  currency: string;
  featured: boolean;
  supersedes_json: string;
  stale_note: string | null;
  expires_on: string | null;
  retired: boolean;
  updated_by: string | null;
};

type AdminRow = {
  email: string;
  user_id: string;
  added_by: string;
  added_at: string | Date;
};

class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function rowToArticle(row: ArticleRow): KnowledgeArticle {
  const currency: ArticleCurrency =
    row.currency === "review" || row.currency === "outdated" ? row.currency : "current";
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    steps: parseJsonArray(row.steps_json),
    keywords: parseJsonArray(row.keywords_json),
    lastReviewed: row.last_reviewed,
    currency,
    featured: Boolean(row.featured),
    supersedes: parseJsonArray(row.supersedes_json),
    staleNote: row.stale_note ?? undefined,
    expiresOn: row.expires_on,
    retired: Boolean(row.retired),
  };
}

function callerUpn(raw: unknown) {
  return normalizeEmail(String(raw ?? ""));
}

async function seedKnowledgeIfNeeded() {
  const sql = await getSql();
  const count = await sql.query<{ n: number }>("select count(*)::int as n from knowledge_articles");
  if ((count[0]?.n ?? 0) === 0) {
    for (const article of KNOWLEDGE_ARTICLES) {
      await sql.query(
        `insert into knowledge_articles (
          id, title, summary, steps_json, keywords_json, last_reviewed, currency, featured,
          supersedes_json, stale_note, expires_on, retired, updated_by
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,'seed')
        on conflict (id) do nothing`,
        [
          article.id,
          article.title,
          article.summary,
          JSON.stringify(article.steps),
          JSON.stringify(article.keywords),
          article.lastReviewed,
          article.currency,
          article.featured ?? false,
          JSON.stringify(article.supersedes ?? []),
          article.staleNote ?? null,
          article.expiresOn ?? null,
        ],
      );
    }
  }
  for (const email of SEEDED_KNOWLEDGE_ADMINS) {
    await sql.query(
      "insert into knowledge_admins (email, user_id, added_by) values ($1, $2, $3) on conflict (email) do nothing",
      [email, email, "shipped"],
    );
  }
}

async function loadAllArticles(): Promise<KnowledgeArticle[]> {
  await seedKnowledgeIfNeeded();
  const sql = await getSql();
  const rows = await sql.query<ArticleRow>(
    "select id, title, summary, steps_json, keywords_json, last_reviewed, currency, featured, supersedes_json, stale_note, expires_on, retired, updated_by from knowledge_articles order by id",
  );
  return rows.map(rowToArticle);
}

export async function loadPublishedArticles(): Promise<KnowledgeArticle[]> {
  const all = await loadAllArticles();
  return publishedArticles(all, todayISO());
}

async function listAdmins(): Promise<KnowledgeAdmin[]> {
  const sql = await getSql();
  const rows = await sql.query<AdminRow>(
    "select email, user_id, added_by, added_at from knowledge_admins order by added_at",
  );
  return rows.map((row) => ({
    email: row.email,
    userId: row.user_id,
    addedBy: row.added_by,
    addedAt: typeof row.added_at === "string" ? row.added_at : new Date(row.added_at).toISOString(),
  }));
}

export async function applyHostedAdmins(emails: string[]) {
  const clean = emails.map(normalizeEmail).filter(isCountyEmail);
  setHostedAdmins(clean);
  await seedKnowledgeIfNeeded();
  const sql = await getSql();
  for (const email of clean) {
    await sql.query(
      `insert into knowledge_admins (email, user_id, added_by) values ($1, $2, 'github')
       on conflict (email) do nothing`,
      [email, email],
    );
  }
  const rows = await sql.query<{ email: string; added_by: string }>(
    "select email, added_by from knowledge_admins",
  );
  const keep = new Set(clean);
  for (const row of rows) {
    if (row.added_by === "github" && !keep.has(row.email)) {
      await sql.query("delete from knowledge_admins where email = $1 and added_by = 'github'", [row.email]);
    }
  }
}

async function requireAdmin(upn: string) {
  if (!upn) throw new ForbiddenError("Sign in with this PC's Entra account.");
  if (!isCountyEmail(upn)) throw new ForbiddenError("Use a @miamidade.gov Entra UPN.");
  await seedKnowledgeIfNeeded();
  const admins = await listAdmins();
  const isAdmin =
    admins.some((admin) => admin.email === upn) || isShippedAdmin(upn) || isHostedAdmin(upn);
  if (!isAdmin) throw new ForbiddenError("Not a Knowledge admin.");
  return { email: upn, bootstrapped: false, admins };
}

function sanitizeArticle(input: ArticleInput): ArticleInput {
  const id = String(input.id ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "")
    .slice(0, 32);
  const title = String(input.title ?? "").trim().slice(0, 160);
  const summary = String(input.summary ?? "").trim().slice(0, 400);
  const steps = (input.steps ?? []).map((step) => String(step).trim()).filter(Boolean).slice(0, 20);
  const keywords = (input.keywords ?? [])
    .flatMap((k) => String(k).split(","))
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 24);
  const lastReviewed = /^\d{4}-\d{2}-\d{2}$/.test(String(input.lastReviewed ?? ""))
    ? String(input.lastReviewed)
    : todayISO();
  const currency: ArticleCurrency =
    input.currency === "review" || input.currency === "outdated" ? input.currency : "current";
  const expiresOn = /^\d{4}-\d{2}-\d{2}$/.test(String(input.expiresOn ?? "")) ? String(input.expiresOn) : null;
  const supersedes = (input.supersedes ?? [])
    .flatMap((v) => String(v).split(","))
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 8);
  if (!id || !title || !summary || !steps.length) {
    throw new Error("Article needs an ID, title, summary, and at least one step.");
  }
  return {
    id,
    title,
    summary,
    steps,
    keywords,
    lastReviewed,
    currency,
    featured: Boolean(input.featured),
    supersedes,
    staleNote: String(input.staleNote ?? "").trim().slice(0, 300),
    expiresOn,
    retired: Boolean(input.retired),
  };
}

export const getKnowledgeAccess = createServerFn({ method: "POST" })
  .validator((input: { upn?: string }) => ({ upn: callerUpn(input?.upn) }))
  .handler(async ({ data }): Promise<KnowledgeAccess> => {
    await seedKnowledgeIfNeeded();
    const upn = data.upn;
    if (!upn) {
      return { signedIn: false, isAdmin: false, email: null, county: false, bootstrapped: false, admins: [] };
    }
    const county = isCountyEmail(upn);
    await seedKnowledgeIfNeeded();
    const admins = await listAdmins();
    const isAdmin =
      county && (admins.some((admin) => admin.email === upn) || isShippedAdmin(upn) || isHostedAdmin(upn));
    return {
      signedIn: county,
      isAdmin,
      email: county ? upn : null,
      county,
      bootstrapped: false,
      admins: isAdmin ? admins : [],
    };
  });

export const listPublishedKnowledge = createServerFn({ method: "GET" }).handler(async () => {
  const articles = await loadPublishedArticles();
  return articles.map((article) => applyLifecycle(article) ?? article);
});

export const listManagedKnowledge = createServerFn({ method: "POST" })
  .validator((input: { upn?: string }) => ({ upn: callerUpn(input?.upn) }))
  .handler(async ({ data }) => {
    await requireAdmin(data.upn);
    return loadAllArticles();
  });

export const saveKnowledgeArticle = createServerFn({ method: "POST" })
  .validator((input: ArticleInput & { upn?: string }) => ({
    upn: callerUpn(input?.upn),
    article: sanitizeArticle(input),
  }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.upn);
    const article = data.article;
    const sql = await getSql();
    await sql.query(
      `insert into knowledge_articles (
        id, title, summary, steps_json, keywords_json, last_reviewed, currency, featured,
        supersedes_json, stale_note, expires_on, retired, updated_by, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
      on conflict (id) do update set
        title = excluded.title,
        summary = excluded.summary,
        steps_json = excluded.steps_json,
        keywords_json = excluded.keywords_json,
        last_reviewed = excluded.last_reviewed,
        currency = excluded.currency,
        featured = excluded.featured,
        supersedes_json = excluded.supersedes_json,
        stale_note = excluded.stale_note,
        expires_on = excluded.expires_on,
        retired = excluded.retired,
        updated_by = excluded.updated_by,
        updated_at = now()`,
      [
        article.id,
        article.title,
        article.summary,
        JSON.stringify(article.steps),
        JSON.stringify(article.keywords),
        article.lastReviewed,
        article.currency,
        article.featured,
        JSON.stringify(article.supersedes),
        article.staleNote || null,
        article.expiresOn,
        article.retired,
        admin.email,
      ],
    );
    bumpKnowledgeCache();
    return article;
  });

export const retireKnowledgeArticle = createServerFn({ method: "POST" })
  .validator((input: { upn?: string; id: string; retired: boolean }) => ({
    upn: callerUpn(input?.upn),
    id: String(input.id ?? "").trim().toUpperCase(),
    retired: Boolean(input.retired),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.upn);
    const sql = await getSql();
    await sql.query("update knowledge_articles set retired = $2, updated_at = now() where id = $1", [
      data.id,
      data.retired,
    ]);
    bumpKnowledgeCache();
    return { id: data.id, retired: data.retired };
  });

export const addKnowledgeAdmin = createServerFn({ method: "POST" })
  .validator((input: { upn?: string; email: string }) => ({
    upn: callerUpn(input?.upn),
    email: normalizeEmail(String(input.email ?? "")),
  }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.upn);
    if (!isCountyEmail(data.email)) {
      throw new ForbiddenError("New admins must use a @miamidade.gov Entra UPN.");
    }
    const sql = await getSql();
    await sql.query(
      "insert into knowledge_admins (email, user_id, added_by) values ($1, $2, $3) on conflict (email) do nothing",
      [data.email, data.email, admin.email],
    );
    return listAdmins();
  });

export const removeKnowledgeAdmin = createServerFn({ method: "POST" })
  .validator((input: { upn?: string; email: string }) => ({
    upn: callerUpn(input?.upn),
    email: normalizeEmail(String(input.email ?? "")),
  }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.upn);
    if (isShippedAdmin(data.email) || isHostedAdmin(data.email)) {
      throw new ForbiddenError("Shipped or GitHub-hosted Knowledge admins cannot be removed here. Edit policy/desk-policy.json on ROK-CJAY/Spartan-Browser.");
    }
    if (data.email === admin.email) {
      throw new ForbiddenError("You cannot remove yourself.");
    }
    const sql = await getSql();
    const count = await sql.query<{ n: number }>("select count(*)::int as n from knowledge_admins");
    if ((count[0]?.n ?? 0) <= 1) {
      throw new ForbiddenError("Keep at least one Knowledge admin.");
    }
    await sql.query("delete from knowledge_admins where email = $1", [data.email]);
    return listAdmins();
  });
