import { todayISO, type ArticleCurrency, type KnowledgeArticle } from "./knowledge-base.ts";

export type ImportedArticle = {
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

export type ImportReport = {
  articles: ImportedArticle[];
  skipped: number;
  errors: string[];
};

const ID_KEYS = ["km id", "kmid", "article id", "articleid", "doc id", "document id", "entry id", "id", "km", "number"];
const TITLE_KEYS = ["title", "article title", "name", "article name"];
const SUMMARY_KEYS = ["summary", "question", "problem", "issue", "description", "article question", "short description"];
const STEPS_KEYS = ["steps", "answer", "solution", "resolution", "article body", "workaround", "details", "article", "text"];
const KEYWORD_KEYS = ["keywords", "search keywords", "tags", "category", "categories"];
const STATUS_KEYS = ["status", "article status", "currency", "state", "article status value"];
const REVIEW_KEYS = ["last reviewed", "review date", "modified", "last modified", "update date", "updated"];
const EXPIRE_KEYS = ["expires", "expiration", "expiry", "valid to", "expire date", "expires on"];
const RETIRED_KEYS = ["retired", "inactive"];
const FEATURED_KEYS = ["featured", "workspace"];
const NOTE_KEYS = ["stale note", "notes", "comment", "internal note"];
const SUPERSEDE_KEYS = ["supersedes", "replaces", "replaced by"];

function headerKey(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value) return value;
  }
  return "";
}

function truthy(value: string) {
  return /^(1|y|yes|true|retired|inactive)$/i.test(value.trim());
}

function parseDate(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1]!;
  const mdy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mdy) {
    const month = mdy[1]!.padStart(2, "0");
    const day = mdy[2]!.padStart(2, "0");
    let year = mdy[3]!;
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  const excel = Number(text);
  if (excel > 20000 && excel < 80000) {
    const date = new Date(Math.round((excel - 25569) * 86400 * 1000));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return null;
}

function splitList(value: string) {
  return value
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitSteps(value: string): string[] {
  const text = value.replace(/\r\n/g, "\n").replace(/<li[^>]*>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").trim();
  if (!text) return [];
  const numbered = text.split(/\n+(?=\s*(?:\d+[\).:-]|[-*•])\s+)/);
  if (numbered.length > 1) {
    return numbered
      .map((step) => step.replace(/^\s*(?:\d+[\).:-]|[-*•])\s*/, "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  const lines = text.split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (lines.length > 1) return lines.slice(0, 20);
  return [text.replace(/\s+/g, " ").trim()].filter(Boolean);
}

function mapStatus(value: string): { currency: ArticleCurrency; retired: boolean } {
  const text = value.trim().toLowerCase();
  if (/retir|cancel|inactiv|closed|archive/.test(text)) return { currency: "outdated", retired: true };
  if (/outdat|expir|obsolet|supersed/.test(text)) return { currency: "outdated", retired: false };
  if (/review|draft|pending/.test(text)) return { currency: "review", retired: false };
  return { currency: "current", retired: false };
}

export function normalizeArticleId(raw: string) {
  const compact = raw.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  if (!compact) return "";
  if (/^\d+$/.test(compact)) return `KM${compact}`.slice(0, 32);
  return compact.slice(0, 32);
}

function toRow(cells: string[], headers: string[]): Record<string, string> {
  const row: Record<string, string> = {};
  headers.forEach((header, index) => {
    const key = headerKey(header);
    if (key) row[key] = String(cells[index] ?? "").trim();
  });
  return row;
}

function rowToArticle(row: Record<string, string>, today: string): ImportedArticle | string {
  const id = normalizeArticleId(pick(row, ID_KEYS));
  const title = pick(row, TITLE_KEYS).slice(0, 160);
  const summaryRaw = pick(row, SUMMARY_KEYS);
  const steps = splitSteps(pick(row, STEPS_KEYS) || summaryRaw);
  const summary = (summaryRaw || title || steps[0] || "").replace(/\s+/g, " ").slice(0, 400);
  if (!id || !title || !steps.length) {
    return `Skipped ${id || title || "row"} — need an ID, title, and solution/steps.`;
  }
  const status = mapStatus(pick(row, STATUS_KEYS));
  const retired = status.retired || truthy(pick(row, RETIRED_KEYS));
  return {
    id,
    title,
    summary,
    steps,
    keywords: splitList(pick(row, KEYWORD_KEYS)).map((item) => item.toLowerCase()).slice(0, 24),
    lastReviewed: parseDate(pick(row, REVIEW_KEYS)) || today,
    currency: status.currency,
    featured: truthy(pick(row, FEATURED_KEYS)),
    supersedes: splitList(pick(row, SUPERSEDE_KEYS)).map(normalizeArticleId).filter(Boolean).slice(0, 8),
    staleNote: pick(row, NOTE_KEYS).slice(0, 300),
    expiresOn: parseDate(pick(row, EXPIRE_KEYS)),
    retired,
  };
}

export function parseKnowledgeCsv(text: string, today = todayISO()): ImportReport {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return { articles: [], skipped: 0, errors: ["The spreadsheet is empty."] };
  const headers = rows[0]!;
  const articles: ImportedArticle[] = [];
  const errors: string[] = [];
  let skipped = 0;
  for (const cells of rows.slice(1)) {
    const row = toRow(cells, headers);
    const parsed = rowToArticle(row, today);
    if (typeof parsed === "string") {
      skipped += 1;
      if (errors.length < 8) errors.push(parsed);
      continue;
    }
    articles.push(parsed);
  }
  return { articles: dedupe(articles), skipped, errors };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      row.push(current);
      current = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length || row.length) {
    row.push(current);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

export function parseKnowledgeRows(headers: string[], rows: string[][], today = todayISO()): ImportReport {
  const articles: ImportedArticle[] = [];
  const errors: string[] = [];
  let skipped = 0;
  for (const cells of rows) {
    if (!cells.some((cell) => String(cell).trim())) continue;
    const parsed = rowToArticle(toRow(cells.map((cell) => String(cell ?? "")), headers), today);
    if (typeof parsed === "string") {
      skipped += 1;
      if (errors.length < 8) errors.push(parsed);
      continue;
    }
    articles.push(parsed);
  }
  return { articles: dedupe(articles), skipped, errors };
}

function dedupe(articles: ImportedArticle[]) {
  const map = new Map<string, ImportedArticle>();
  for (const article of articles) map.set(article.id, article);
  return [...map.values()];
}

export const KNOWLEDGE_TEMPLATE_CSV = [
  "KM ID,Title,Summary,Steps,Keywords,Status,Last Reviewed,Expires,Retired,Featured,Stale Note,Supersedes",
  'KM0001842,Password and MFA reset,Reset Entra password from MyIT,"Confirm the caller. Open MyIT Reset password. Complete Authenticator if prompted.",password; mfa; entra,Published,2026-07-14,,No,Yes,,KM0000911',
].join("\n");

export type KnowledgeCatalog = {
  schema: number;
  updatedAt: string;
  updatedBy: string;
  articles: KnowledgeArticle[];
};

export function parseKnowledgeCatalog(raw: unknown): KnowledgeCatalog | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.articles)) return null;
  const articles: KnowledgeArticle[] = [];
  for (const item of value.articles) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = normalizeArticleId(String(row.id ?? ""));
    const title = String(row.title ?? "").trim();
    const steps = Array.isArray(row.steps) ? row.steps.map((step) => String(step).trim()).filter(Boolean) : [];
    if (!id || !title || !steps.length) continue;
    const currency: ArticleCurrency =
      row.currency === "review" || row.currency === "outdated" ? row.currency : "current";
    articles.push({
      id,
      title,
      summary: String(row.summary ?? title).slice(0, 400),
      steps: steps.slice(0, 20),
      keywords: Array.isArray(row.keywords) ? row.keywords.map((k) => String(k).toLowerCase()) : [],
      lastReviewed: String(row.lastReviewed ?? todayISO()).slice(0, 10),
      currency,
      featured: Boolean(row.featured),
      supersedes: Array.isArray(row.supersedes) ? row.supersedes.map((k) => String(k)) : [],
      staleNote: row.staleNote ? String(row.staleNote) : undefined,
      expiresOn: typeof row.expiresOn === "string" ? row.expiresOn : null,
      retired: Boolean(row.retired),
    });
  }
  if (!articles.length) return null;
  return {
    schema: typeof value.schema === "number" ? value.schema : 1,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    updatedBy: typeof value.updatedBy === "string" ? value.updatedBy : "github",
    articles,
  };
}

export function serializeKnowledgeCatalog(articles: KnowledgeArticle[], updatedBy: string): KnowledgeCatalog {
  return {
    schema: 1,
    updatedAt: new Date().toISOString(),
    updatedBy,
    articles,
  };
}
