import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeArticleId,
  parseKnowledgeCsv,
  parseKnowledgeCatalog,
  parseKnowledgeRows,
  serializeKnowledgeCatalog,
} from "./knowledge-import.ts";

describe("normalizeArticleId", () => {
  it("keeps KM ids and prefixes numeric Remedy ids", () => {
    assert.equal(normalizeArticleId("km0001842"), "KM0001842");
    assert.equal(normalizeArticleId("1842"), "KM1842");
  });
});

describe("parseKnowledgeCsv", () => {
  it("maps Remedy-style columns into articles", () => {
    const csv = [
      "Article ID,Article Title,Question,Answer,Keywords,Status,Last Modified,Expiration Date",
      '0002104,Authenticator enrollment,How do I enroll MFA?,"1. Open aka.ms/mfasetup\n2. Scan the QR code",mfa; authenticator,Published,06/02/2026,',
      ",Missing,No id,No steps,x,Published,,",
    ].join("\n");
    const report = parseKnowledgeCsv(csv, "2026-09-15");
    assert.equal(report.articles.length, 1);
    assert.equal(report.skipped, 1);
    const article = report.articles[0]!;
    assert.equal(article.id, "KM0002104");
    assert.equal(article.title, "Authenticator enrollment");
    assert.equal(article.currency, "current");
    assert.equal(article.steps.length, 2);
    assert.ok(article.keywords.includes("mfa"));
  });
});

describe("parseKnowledgeRows", () => {
  it("accepts Excel-style header rows", () => {
    const report = parseKnowledgeRows(
      ["KM ID", "Title", "Summary", "Steps", "Status"],
      [["KM0001755", "Account lockout", "Unlock AD", "1. Find the user\n2. Unlock", "Published"]],
      "2026-09-15",
    );
    assert.equal(report.articles[0]?.id, "KM0001755");
    assert.equal(report.articles[0]?.steps.length, 2);
  });
});

describe("parseKnowledgeCatalog", () => {
  it("rejects empty payloads", () => {
    assert.equal(parseKnowledgeCatalog({ schema: 1, articles: [] }), null);
  });

  it("round-trips serialize", () => {
    const catalog = serializeKnowledgeCatalog(
      [
        {
          id: "KM0001842",
          title: "Password and MFA reset",
          summary: "Use MyIT",
          steps: ["Confirm the caller"],
          keywords: ["password"],
          lastReviewed: "2026-07-14",
          currency: "current",
        },
      ],
      "e315170@miamidade.gov",
    );
    const parsed = parseKnowledgeCatalog(catalog);
    assert.equal(parsed?.articles[0]?.id, "KM0001842");
    assert.equal(parsed?.updatedBy, "e315170@miamidade.gov");
  });
});
