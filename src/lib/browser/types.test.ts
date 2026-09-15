import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HOME_URL, KNOWLEDGE_URL, SETTINGS_URL, defaultQuickAccess, faviconFor, quickAccessCatalog } from "./types.ts";
import { letterSvg, sanitizeFaviconHost } from "./favicon-proxy.ts";

describe("faviconFor", () => {
  it("points at the desk favicon helper for https hosts", () => {
    assert.equal(faviconFor("https://outlook.office.com/mail"), "/api/favicon?host=outlook.office.com");
    assert.equal(faviconFor("https://www.google.com"), "/api/favicon?host=www.google.com");
  });

  it("skips desk-internal pages", () => {
    assert.equal(faviconFor(HOME_URL), "");
    assert.equal(faviconFor(SETTINGS_URL), "");
    assert.equal(faviconFor(KNOWLEDGE_URL), "");

    assert.equal(faviconFor("mdc-tool://aduc"), "");
    assert.equal(faviconFor("about:blank"), "");
    assert.equal(faviconFor(""), "");
  });
});

describe("sanitizeFaviconHost", () => {
  it("accepts normal hostnames", () => {
    assert.equal(sanitizeFaviconHost("Outlook.Office.com"), "outlook.office.com");
    assert.equal(sanitizeFaviconHost("myit.miamidade.gov"), "myit.miamidade.gov");
  });

  it("rejects junk", () => {
    assert.equal(sanitizeFaviconHost("https://evil.example"), "");
    assert.equal(sanitizeFaviconHost("../etc"), "");
    assert.equal(sanitizeFaviconHost("localhost"), "");
    assert.equal(sanitizeFaviconHost(""), "");
  });
});

describe("letterSvg", () => {
  it("draws the first letter", () => {
    assert.match(letterSvg("google.com"), />G</);
    assert.match(letterSvg("google.com"), /svg/);
  });
});

describe("quickAccess", () => {
  it("seeds MyIT, SmartIT, Cloud, Outlook, and Citrix", () => {
    const ids = defaultQuickAccess().map((item) => item.id);
    assert.deepEqual(ids, ["pin:myit", "pin:smartit", "pin:cloud", "bm:outlook", "tool:citrix-signin"]);
  });

  it("builds a catalog from systems, tools, and bookmarks without duplicate URLs", () => {
    const catalog = quickAccessCatalog([
      { id: "b1", title: "Outlook", url: "https://outlook.office.com", folder: "", addedAt: "" },
      { id: "b2", title: "MyIT again", url: "https://myit.miamidade.gov", folder: "", addedAt: "" },
    ]);
    const urls = catalog.map((item) => item.url);
    assert.equal(new Set(urls).size, urls.length);
    assert.ok(catalog.some((item) => item.label === "Outlook"));
    assert.ok(catalog.some((item) => item.id === "tool:aduc"));
    assert.ok(catalog.some((item) => item.id === "tool:cmrc"));
    assert.equal(catalog.filter((item) => item.url === "https://myit.miamidade.gov").length, 1);
  });
});
