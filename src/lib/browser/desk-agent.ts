import { createServerFn } from "@tanstack/react-start";
import {
  KNOWLEDGE_ARTICLES,
  getKnowledgeRevision,
  retrieveArticles,
  type ArticleCurrency,
  type KnowledgeArticle,
} from "./knowledge-base";
import { loadPublishedArticles } from "./knowledge-server";

export type DeskAgentArticle = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  currency: ArticleCurrency;
  lastReviewed: string;
  staleNote?: string;
};

export type DeskAgentResult =
  | {
      ok: true;
      mode: "grok" | "articles";
      text: string;
      articles: DeskAgentArticle[];
    }
  | {
      ok: false;
      error: string;
      articles: DeskAgentArticle[];
    };

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; revision: number; result: DeskAgentResult }>();

const SYSTEM = `You are the Miami-Dade County IT Service Center desk agent.
Help Desk staff will describe a caller issue. Answer using ONLY the Remedy knowledge articles provided.

Rules:
- Prefer articles marked current over review or outdated.
- If current and outdated articles disagree, follow the current article and say the older one is superseded.
- Expired articles are treated as outdated. Retired articles are not provided — do not mention them.
- If only review or outdated articles match, give the steps and warn they may be stale.
- Be concise. Use numbered steps a phone agent can read aloud.
- Name the article IDs you relied on (for example KM0001842).
- If the articles do not cover the issue, say so and suggest logging a SmartIT ticket or escalating to 305-596-HELP.
- Do not invent systems, URLs, or article IDs.`;

function summarize(article: KnowledgeArticle): DeskAgentArticle {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    steps: article.steps,
    currency: article.currency,
    lastReviewed: article.lastReviewed,
    staleNote: article.staleNote,
  };
}

function formatArticles(articles: KnowledgeArticle[]): string {
  return articles
    .map((article) => {
      const stale = article.staleNote ? `\nStale note: ${article.staleNote}` : "";
      const supersedes = article.supersedes?.length ? `\nSupersedes: ${article.supersedes.join(", ")}` : "";
      const expires = article.expiresOn ? `\nExpires: ${article.expiresOn}` : "";
      return [
        `ID: ${article.id}`,
        `Title: ${article.title}`,
        `Currency: ${article.currency} (last reviewed ${article.lastReviewed})`,
        `Summary: ${article.summary}${stale}${supersedes}${expires}`,
        `Steps:\n${article.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function cacheKey(question: string) {
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

async function completeGrok(apiKey: string, question: string, articles: KnowledgeArticle[]): Promise<string | null> {
  const body = {
    model: "grok-4.5",
    temperature: 0.2,
    max_tokens: 700,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Caller issue:\n${question}\n\nRemedy articles:\n${formatArticles(articles)}`,
      },
    ],
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content?.trim() || null;
    }
    if (res.status < 500 || attempt === 1) return null;
  }
  return null;
}

export const askDeskAgent = createServerFn({ method: "POST" })
  .validator((input: { question: string }) => ({
    question: String(input?.question ?? "")
      .trim()
      .slice(0, 500),
  }))
  .handler(async ({ data }): Promise<DeskAgentResult> => {
    const question = data.question;
    if (!question) {
      return { ok: false, error: "Ask a question about a known issue.", articles: [] };
    }

    const revision = getKnowledgeRevision();
    const key = cacheKey(question);
    const hit = cache.get(key);
    if (hit && hit.revision === revision && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

    let pool: KnowledgeArticle[] = [];
    try {
      pool = await loadPublishedArticles();
    } catch {
      pool = [];
    }
    const ranked = retrieveArticles(question, 5, pool.length ? pool : KNOWLEDGE_ARTICLES);

    const articles = ranked.map(summarize);

    if (!ranked.length) {
      const result: DeskAgentResult = {
        ok: false,
        error: "No matching Remedy article. Try password, Citrix, INFORMS, printer, or lockout.",
        articles: [],
      };
      cache.set(key, { at: Date.now(), revision, result });
      return result;
    }

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      const result: DeskAgentResult = { ok: true, mode: "articles", text: "", articles };
      cache.set(key, { at: Date.now(), revision, result });
      return result;
    }

    try {
      const text = await completeGrok(apiKey, question, ranked);
      const result: DeskAgentResult = text
        ? { ok: true, mode: "grok", text, articles }
        : { ok: true, mode: "articles", text: "", articles };
      cache.set(key, { at: Date.now(), revision, result });
      return result;
    } catch {
      const result: DeskAgentResult = { ok: true, mode: "articles", text: "", articles };
      cache.set(key, { at: Date.now(), revision, result });
      return result;
    }
  });
