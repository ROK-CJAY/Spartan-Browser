import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Headphones,
  KeyRound,
  Pencil,
  Phone,
  Plus,
  Search,
  Ticket,
  X,
} from "lucide-react";
import { askDeskAgent, type DeskAgentArticle, type DeskAgentResult } from "@/lib/browser/desk-agent";
import { composeAgentReply } from "@/lib/browser/desk-reply";
import { DESK_AGENT_SUGGESTIONS, featuredArticles, retrieveArticles } from "@/lib/browser/knowledge-base";
import { isHostedAdmin, KNOWLEDGE_POLL_MS } from "@/lib/browser/desk-updates";
import { getKnowledgeAccess, listPublishedKnowledge } from "@/lib/browser/knowledge-server";
import { displayNameFromUpn } from "@/lib/browser/windows-identity";
import { useBrowserStore } from "@/lib/browser/store";
import {
  KNOWLEDGE_URL,
  quickAccessCatalog,
  type QuickAccessItem,
  type QuickAccessSource,
} from "@/lib/browser/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Favicon } from "./favicon";
import { initialsFrom } from "./identity";

const SOURCE_LABEL: Record<QuickAccessSource, string> = {
  system: "County systems",
  tool: "ITD tools",
  bookmark: "Bookmarks",
};

export function WorkspaceHome() {
  const openSettings = useBrowserStore((s) => s.openSettings);
  const navigate = useBrowserStore((s) => s.navigate);
  const profile = useBrowserStore((s) => s.activeProfile());
  const upn = useBrowserStore((s) => s.config.entraUpn);
  const ollamaEnabled = useBrowserStore((s) => s.config.ollamaEnabled);
  const ollamaUrl = useBrowserStore((s) => s.config.ollamaUrl);
  const ollamaModel = useBrowserStore((s) => s.config.ollamaModel);
  const name = upn ? displayNameFromUpn(upn) : profile.name;
  const first = name.split(/\s+/)[0] || name;
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DeskAgentResult | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [featured, setFeatured] = useState(() => featuredArticles());
  const [isAdmin, setIsAdmin] = useState(() => isHostedAdmin(upn));

  const agentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const articles = await listPublishedKnowledge();
        if (!cancelled) setFeatured(articles.filter((article) => article.featured).slice(0, 6));
      } catch {
        if (!cancelled) setFeatured(featuredArticles());
      }
      try {
        const access = await getKnowledgeAccess({ data: { upn } });
        if (!cancelled) setIsAdmin(access.isAdmin || isHostedAdmin(upn));
      } catch {
        if (!cancelled) setIsAdmin(isHostedAdmin(upn));
      }
    }
    void load();
    const id = window.setInterval(() => void load(), KNOWLEDGE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [upn]);

  async function ask(raw?: string) {
    const question = (raw ?? query).trim();
    if (!question || busy) return;
    setQuery(question);
    setBusy(true);
    setOpenId(null);
    agentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const next = await askDeskAgent({
        data: { question, ollamaEnabled, ollamaUrl, ollamaModel },
      });
      setResult(next);
      setOpenId(next.articles[0]?.id ?? null);
    } catch {
      const fallback = localDeskResult(question);
      setResult(fallback);
      setOpenId(fallback.articles[0]?.id ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-auto bg-[var(--bg)] text-[var(--fg)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.18em] text-[var(--muted)] uppercase">
            IT Service Center
          </p>
          <h1 className="font-display text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl">
            {upn ? `Welcome back, ${first}` : "Miami-Dade Help Desk"}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)] text-pretty">
            {upn
              ? "Ask the desk agent, pin shortcuts, and keep Desk and Knowledge on this tab."
              : "Ask the desk agent about known issues, pin shortcuts, and keep Desk and Knowledge here. Bind this PC’s Windows / Entra logon under Profiles if you train knowledge."}
          </p>
        </header>

        {upn ? (
          <section>
            <button
              type="button"
              onClick={() => openSettings("profiles")}
              className="flex min-h-11 w-full items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-left"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-[var(--accent)] text-sm font-semibold text-[var(--accent-fg)]">
                {initialsFrom(name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{name}</span>
                <span className="block truncate text-xs text-[var(--muted)]">{upn}</span>
              </span>
            </button>
          </section>
        ) : null}

        <DeskAgentSearch
          query={query}
          busy={busy}
          result={result}
          openId={openId}
          agentRef={agentRef}
          onQuery={setQuery}
          onAsk={ask}
          onOpenId={setOpenId}
        />
        <QuickAccessPanel />

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium">
              <Headphones className="size-4 text-[var(--accent)]" />
              Desk
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <Phone className="size-4 text-[var(--muted)]" />
                <span>
                  <span className="font-medium">305-596-HELP</span>
                  <span className="block text-xs text-[var(--muted)]">
                    8:00–17:00 EST, Monday–Friday
                  </span>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Ticket className="size-4 text-[var(--muted)]" />
                <span>MyIT for tickets, requests, and status</span>
              </li>
              <li className="flex items-center gap-3">
                <KeyRound className="size-4 text-[var(--muted)]" />
                <span>MFA via Microsoft Authenticator</span>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-4 flex items-center justify-between gap-2 text-sm font-medium">
              <span className="flex items-center gap-2">
                <BookOpen className="size-4 text-[var(--accent)]" />
                Knowledge
              </span>
              {isAdmin ? (
                <button
                  type="button"
                  className="text-xs font-normal text-[var(--accent)] hover:underline"
                  onClick={() => navigate(KNOWLEDGE_URL, "Knowledge")}
                >
                  Manage
                </button>
              ) : null}
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {featured.map((article) => (

                <li key={article.id} className="py-2.5 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => void ask(article.title)}
                    className="flex min-h-11 w-full items-start justify-between gap-3 text-left"
                  >
                    <span>
                      <span className="block text-sm font-medium">{article.title}</span>
                      <span className="block text-xs text-[var(--muted)]">{article.summary}</span>
                    </span>
                    <CurrencyBadge currency={article.currency} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function DeskAgentSearch({
  query,
  busy,
  result,
  openId,
  agentRef,
  onQuery,
  onAsk,
  onOpenId,
}: {
  query: string;
  busy: boolean;
  result: DeskAgentResult | null;
  openId: string | null;
  agentRef: RefObject<HTMLElement | null>;
  onQuery: (value: string) => void;
  onAsk: (raw?: string) => Promise<void>;
  onOpenId: (id: string | null) => void;
}) {
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void onAsk();
  }

  return (
    <section ref={agentRef} className="flex flex-col gap-3">
      <form onSubmit={onSubmit} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-2">
        <label className="sr-only" htmlFor="desk-agent-q">
          Ask the desk agent
        </label>
        <div className="flex items-center gap-2">
          <span className="grid size-11 shrink-0 place-items-center text-[var(--muted)]">
            <Search className="size-4" />
          </span>
          <input
            id="desk-agent-q"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Ask about a known issue — password, Citrix, INFORMS, printers…"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
            disabled={busy}
          />
          <Button type="submit" disabled={busy || !query.trim()} className="min-h-11 shrink-0">
            {busy ? "Looking up…" : "Ask"}
          </Button>
        </div>
      </form>
      <div className="flex flex-wrap gap-2">
        {DESK_AGENT_SUGGESTIONS.map((hint) => (
          <button
            key={hint}
            type="button"
            onClick={() => void onAsk(hint)}
            className="min-h-11 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
          >
            {hint}
          </button>
        ))}
      </div>
      {result ? <AgentResult result={result} openId={openId} setOpenId={onOpenId} /> : null}
    </section>
  );
}

function formatAgentText(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ");
}

function localDeskResult(question: string): DeskAgentResult {
  const articles = retrieveArticles(question, 5).map((article) => ({
    id: article.id,
    title: article.title,
    summary: article.summary,
    steps: article.steps,
    currency: article.currency,
    lastReviewed: article.lastReviewed,
    staleNote: article.staleNote,
  }));
  if (!articles.length) {
    return {
      ok: false,
      error: "No matching Remedy article. Try password, Citrix, INFORMS, printer, or lockout.",
      articles: [],
    };
  }
  return { ok: true, mode: "agent", text: composeAgentReply(question, articles), articles };
}

function AgentResult({
  result,
  openId,
  setOpenId,
}: {
  result: DeskAgentResult;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const articles = result.articles;
  const mixed = new Set(articles.map((a) => a.currency)).size > 1;
  const spoken = result.ok && result.text;
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result]);

  return (
    <div ref={boxRef} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
      {spoken ? (
        <div className="space-y-3">
          <p className="text-xs font-medium tracking-[0.14em] text-[var(--muted)] uppercase">
            {result.mode === "ollama" ? "Desk agent · this PC" : "Desk agent"}
          </p>
          <div className="space-y-3 text-sm leading-relaxed whitespace-pre-wrap">{formatAgentText(result.text)}</div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-[0.14em] text-[var(--muted)] uppercase">Desk agent</p>
          <p className="text-sm leading-relaxed text-[var(--muted)]">{result.ok ? "" : result.error}</p>
        </div>
      )}
      {mixed ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Remedy has mixed-age copies of this topic. Current articles take priority over outdated ones.
        </p>
      ) : null}
      {articles.length ? (
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {articles.map((article) => (
            <ArticleRow
              key={article.id}
              article={article}
              open={openId === article.id}
              onToggle={() => setOpenId(openId === article.id ? null : article.id)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ArticleRow({
  article,
  open,
  onToggle,
}: {
  article: DeskAgentArticle;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onToggle} className="flex min-h-11 w-full items-start gap-3 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{article.title}</span>
            <CurrencyBadge currency={article.currency} />
          </span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            {article.id} · reviewed {article.lastReviewed}
          </span>
        </span>
        {open ? <ChevronUp className="mt-1 size-4 text-[var(--muted)]" /> : <ChevronDown className="mt-1 size-4 text-[var(--muted)]" />}
      </button>
      {open ? (
        <div className="pb-3">
          <p className="text-sm leading-relaxed text-[var(--muted)]">{article.summary}</p>
          {article.staleNote ? <p className="mt-2 text-xs text-[var(--muted)]">{article.staleNote}</p> : null}
          <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed">
            {article.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </li>
  );
}

function CurrencyBadge({ currency }: { currency: DeskAgentArticle["currency"] }) {
  const label = currency === "current" ? "Current" : currency === "review" ? "Review" : "Outdated";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide uppercase",
        currency === "current"
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--muted)]",
      )}
    >
      {label}
    </span>
  );
}

function QuickAccessPanel() {
  const navigate = useBrowserStore((s) => s.navigate);
  const profile = useBrowserStore((s) => s.activeProfile());
  const addQuickAccess = useBrowserStore((s) => s.addQuickAccess);
  const removeQuickAccess = useBrowserStore((s) => s.removeQuickAccess);
  const moveQuickAccess = useBrowserStore((s) => s.moveQuickAccess);
  const [editing, setEditing] = useState(false);
  const items = profile.quickAccess ?? [];
  const usedUrls = items.map((item) => item.url).join("|");
  const catalog = useMemo(
    () => quickAccessCatalog(profile.bookmarks).filter((item) => !items.some((row) => row.url === item.url)),
    [profile.bookmarks, usedUrls, items],
  );

  const grouped = (["system", "tool", "bookmark"] as QuickAccessSource[])
    .map((source) => ({ source, items: catalog.filter((item) => item.source === source) }))
    .filter((group) => group.items.length);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Quick access</h2>
        <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setEditing((v) => !v)}>
          {editing ? (
            <>
              <Check className="size-3.5" />
              Done
            </>
          ) : (
            <>
              <Pencil className="size-3.5" />
              Customize
            </>
          )}
        </Button>
      </div>
      {items.length === 0 && !editing ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-6 text-sm text-[var(--muted)]">
          No shortcuts yet. Choose Customize to pin County systems, ITD tools, or bookmarks.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <QuickAccessTile
              key={item.id}
              item={item}
              editing={editing}
              canUp={index > 0}
              canDown={index < items.length - 1}
              onOpen={() => navigate(item.url, item.label)}
              onRemove={() => removeQuickAccess(item.id)}
              onMove={(dir) => moveQuickAccess(item.id, dir)}
            />
          ))}
        </div>
      )}
      {editing ? (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
          <p className="mb-3 text-xs text-[var(--muted)]">
            Pin up to 12 shortcuts from the rail catalogs and your bookmarks. County systems and ITD tools stay in the rail.
          </p>
          {grouped.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Everything available is already pinned.</p>
          ) : (
            grouped.map((group) => (
              <div key={group.source} className="mb-3 last:mb-0">
                <p className="mb-2 text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                  {SOURCE_LABEL[group.source]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addQuickAccess(item)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--btn)] px-3 text-xs hover:border-[var(--accent)]"
                    >
                      <Plus className="size-3" />
                      <Favicon url={item.url} title={item.label} size="sm" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

function QuickAccessTile({
  item,
  editing,
  canUp,
  canDown,
  onOpen,
  onRemove,
  onMove,
}: {
  item: QuickAccessItem;
  editing: boolean;
  canUp: boolean;
  canDown: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        disabled={editing}
        className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-left transition-colors duration-[var(--motion-quick)] hover:border-[var(--accent)] disabled:hover:border-[var(--border)]"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--btn)]">
          <Favicon url={item.url} title={item.label} size="md" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{item.label}</span>
          <span className="block truncate text-xs text-[var(--muted)]">{SOURCE_LABEL[item.source]}</span>
        </span>
      </button>
      {editing ? (
        <div className="absolute top-2 right-2 flex gap-1">
          <IconBtn label="Move up" disabled={!canUp} onClick={() => onMove(-1)}>
            <ChevronUp className="size-3.5" />
          </IconBtn>
          <IconBtn label="Move down" disabled={!canDown} onClick={() => onMove(1)}>
            <ChevronDown className="size-3.5" />
          </IconBtn>
          <IconBtn label={`Remove ${item.label}`} onClick={onRemove}>
            <X className="size-3.5" />
          </IconBtn>
        </div>
      ) : null}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--btn)] text-[var(--fg)] disabled:opacity-30"
    >
      {children}
    </button>
  );
}
