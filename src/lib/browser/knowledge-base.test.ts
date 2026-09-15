import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  KNOWLEDGE_ARTICLES,
  SEEDED_KNOWLEDGE_ADMINS,
  applyLifecycle,
  featuredArticles,
  isCountyEmail,
  isShippedAdmin,
  retrieveArticles,
  tokenize,
  type KnowledgeArticle,
} from "./knowledge-base.ts";

describe("tokenize", () => {
  it("drops stop words and punctuation", () => {
    assert.deepEqual(tokenize("How do I reset the password?"), ["do", "reset", "password"]);
  });
});

describe("isCountyEmail", () => {
  it("accepts County Entra UPNs", () => {
    assert.equal(isCountyEmail("Ada.Lovelace@MiamiDade.gov"), true);
    assert.equal(isCountyEmail("dev@example.com"), false);
    assert.equal(isCountyEmail("user@it.miamidade.gov"), false);
  });
});

describe("shipped Knowledge admins", () => {
  it("is the same three County UPNs on every machine", () => {
    assert.deepEqual([...SEEDED_KNOWLEDGE_ADMINS], [
      "e315170@miamidade.gov",
      "e325037@miamidade.gov",
      "e310678@miamidade.gov",
    ]);
    assert.equal(isShippedAdmin("E315170@MiamiDade.gov"), true);
    assert.equal(isShippedAdmin("agent@miamidade.gov"), false);
  });
});

describe("applyLifecycle", () => {
  it("hides retired articles and marks expired ones outdated", () => {
    const base: KnowledgeArticle = {
      id: "KM1",
      title: "Test",
      summary: "s",
      steps: ["one"],
      keywords: ["test"],
      lastReviewed: "2026-01-01",
      currency: "current",
    };
    assert.equal(applyLifecycle({ ...base, retired: true }), null);
    const expired = applyLifecycle({ ...base, expiresOn: "2026-01-01" }, "2026-09-15");
    assert.equal(expired?.currency, "outdated");
  });
});

describe("retrieveArticles", () => {
  it("ranks the current password article above the retired SSPR article", () => {
    const hits = retrieveArticles("password and MFA reset", 5);
    assert.equal(hits[0]?.id, "KM0001842");
    assert.ok(hits.some((a) => a.id === "KM0000911"));
    assert.equal(hits[0]?.currency, "current");
  });

  it("finds Citrix Cloud for a launch failure and still surfaces StoreFront as outdated", () => {
    const hits = retrieveArticles("Citrix won't launch", 5);
    assert.equal(hits[0]?.id, "KM0001560");
    assert.ok(hits.some((a) => a.id === "KM0000722" && a.currency === "outdated"));
  });

  it("maps timesheet questions to INFORMS, not PeopleSoft ESS", () => {
    const hits = retrieveArticles("INFORMS timesheet", 3);
    assert.equal(hits[0]?.id, "KM0001888");
  });

  it("returns nothing for an empty or stop-word-only query", () => {
    assert.deepEqual(retrieveArticles(""), []);
    assert.deepEqual(retrieveArticles("the and for"), []);
  });

  it("does not retrieve retired articles", () => {
    const pool = KNOWLEDGE_ARTICLES.map((article) =>
      article.id === "KM0001842" ? { ...article, retired: true } : article,
    );
    const hits = retrieveArticles("password and MFA reset", 5, pool);
    assert.equal(hits.some((a) => a.id === "KM0001842"), false);
  });
});

describe("featuredArticles", () => {
  it("keeps the four workspace knowledge tiles", () => {
    const titles = featuredArticles().map((a) => a.title);
    assert.deepEqual(titles, [
      "Password and MFA reset",
      "Citrix Cloud desktop",
      "INFORMS time and pay",
      "Printer mapping and follow-me print",
    ]);
    assert.ok(KNOWLEDGE_ARTICLES.some((a) => a.currency === "outdated"));
    assert.ok(KNOWLEDGE_ARTICLES.some((a) => a.currency === "review"));
  });
});
