import type { ArticleCurrency, KnowledgeArticle } from "./knowledge-base.ts";

export type AgentArticle = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  currency: ArticleCurrency;
  lastReviewed: string;
  staleNote?: string;
};

export function composeAgentReply(question: string, articles: AgentArticle[]): string {
  if (!articles.length) {
    return "No matching Remedy article. Log a SmartIT ticket or escalate to 305-596-HELP.";
  }

  const primary =
    articles.find((article) => article.currency === "current") ?? articles[0]!;
  const older = articles.filter((article) => article.id !== primary.id);
  const lines: string[] = [];

  lines.push(`Read this to the caller using ${primary.id} — ${primary.title}.`);
  if (primary.currency === "outdated") {
    lines.push(
      `Warning: this article is outdated${primary.staleNote ? ` (${primary.staleNote})` : ""}. Confirm with a Knowledge admin before quoting it as policy.`,
    );
  } else if (primary.currency === "review") {
    lines.push("Warning: this article is marked for review. Use the steps, then flag it if they no longer match the environment.");
  }
  if (primary.staleNote && primary.currency === "current") {
    lines.push(primary.staleNote);
  }
  lines.push("");
  lines.push(primary.summary);
  lines.push("");
  primary.steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });

  if (older.length) {
    const ids = older.map((article) => `${article.id} (${article.currency})`).join(", ");
    lines.push("");
    lines.push(
      primary.currency === "current"
        ? `Do not follow older copies if they disagree: ${ids}.`
        : `Other matches: ${ids}.`,
    );
  }

  const q = question.trim();
  if (q) {
    lines.push("");
    lines.push("If this does not match the caller’s issue, say so and open a SmartIT ticket.");
  }
  return lines.join("\n");
}

export function toAgentArticle(article: KnowledgeArticle): AgentArticle {
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
