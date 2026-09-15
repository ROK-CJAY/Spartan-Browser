import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, Plus, Shield, Trash2 } from "lucide-react";
import {
  addKnowledgeAdmin,
  getKnowledgeAccess,
  listManagedKnowledge,
  removeKnowledgeAdmin,
  retireKnowledgeArticle,
  saveKnowledgeArticle,
  type KnowledgeAccess,
  type ArticleInput,
} from "@/lib/browser/knowledge-server";
import { todayISO, isCountyEmail, isShippedAdmin, type ArticleCurrency, type KnowledgeArticle } from "@/lib/browser/knowledge-base";
import { isHostedAdmin } from "@/lib/browser/desk-updates";
import { useBrowserStore } from "@/lib/browser/store";
import { GuestSignIn } from "./identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMPTY: ArticleInput = {
  id: "",
  title: "",
  summary: "",
  steps: [""],
  keywords: [],
  lastReviewed: todayISO(),
  currency: "current",
  featured: false,
  supersedes: [],
  staleNote: "",
  expiresOn: null,
  retired: false,
};

function toInput(article: KnowledgeArticle): ArticleInput {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    steps: article.steps.length ? article.steps : [""],
    keywords: article.keywords,
    lastReviewed: article.lastReviewed,
    currency: article.currency,
    featured: Boolean(article.featured),
    supersedes: article.supersedes ?? [],
    staleNote: article.staleNote ?? "",
    expiresOn: article.expiresOn ?? null,
    retired: Boolean(article.retired),
  };
}

export function KnowledgeAdminPage() {
  const goHome = useBrowserStore((s) => s.goHome);
  const upn = useBrowserStore((s) => s.config.entraUpn);
  const [access, setAccess] = useState<KnowledgeAccess | null>(null);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [form, setForm] = useState<ArticleInput>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [filter, setFilter] = useState("");

  async function refresh() {
    const next = await getKnowledgeAccess({ data: { upn } });
    const admin = next.isAdmin || isHostedAdmin(upn) || isShippedAdmin(upn);
    setAccess({ ...next, signedIn: next.signedIn || Boolean(upn), isAdmin: admin });
    if (admin) {
      try {
        const rows = await listManagedKnowledge({ data: { upn } });
        setArticles(rows);
      } catch {
        setArticles([]);
      }
    } else {
      setArticles([]);
    }
  }

  useEffect(() => {
    void refresh().catch(() =>
      setAccess({
        signedIn: Boolean(upn),
        isAdmin: isHostedAdmin(upn) || isShippedAdmin(upn),
        email: upn || null,
        county: Boolean(upn),
        bootstrapped: false,
        admins: [],
      }),
    );
  }, [upn]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return articles.filter((article) => {
      if (!q) return true;
      return `${article.id} ${article.title} ${article.keywords.join(" ")}`.toLowerCase().includes(q);
    });
  }, [articles, filter]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveKnowledgeArticle({ data: { ...form, upn } });
      setEditing(false);
      setForm(EMPTY);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save article.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRetire(article: KnowledgeArticle) {
    setBusy(true);
    setError("");
    try {
      await retireKnowledgeArticle({ data: { id: article.id, retired: !article.retired, upn } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update article.");
    } finally {
      setBusy(false);
    }
  }

  async function addAdmin() {
    setBusy(true);
    setError("");
    try {
      await addKnowledgeAdmin({ data: { email: adminEmail, upn } });
      setAdminEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add admin.");
    } finally {
      setBusy(false);
    }
  }

  async function dropAdmin(email: string) {
    setBusy(true);
    setError("");
    try {
      await removeKnowledgeAdmin({ data: { email, upn } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove admin.");
    } finally {
      setBusy(false);
    }
  }

  if (!access) {
    return <div className="h-full animate-pulse bg-[var(--bg)]" />;
  }

  return (
    <div className="h-full overflow-auto bg-[var(--bg)] text-[var(--fg)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-6 sm:px-8">
        <header className="flex flex-col gap-3">
          <button
            type="button"
            onClick={goHome}
            className="flex min-h-11 w-fit items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--fg)]"
          >
            <ChevronLeft className="size-4" />
            Workspace
          </button>
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[var(--accent)] text-[var(--accent-fg)]">
              <BookOpen className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-medium tracking-tight">Knowledge admin</h1>
              <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                Train the desk agent by adding, editing, retiring, and expiring Remedy articles. Access is the Windows /
                Entra account on this PC (@miamidade.gov). Desk and Workspace stay the same for everyone else.
              </p>
            </div>
          </div>
        </header>

        {!upn ? (
          <div className="space-y-3">
            <GateCard
              title="Windows account"
              body="Knowledge admin uses the Entra account already signed into Windows on this PC. The installed app reads it automatically."
            />
            <GuestSignIn />
          </div>
        ) : !(access.signedIn || isCountyEmail(upn)) ? (
          <GateCard
            title="Windows account required"
            body="This desk could not confirm a County @miamidade.gov logon."
          />
        ) : !(access.isAdmin || isHostedAdmin(upn) || isShippedAdmin(upn)) ? (
          <GateCard
            title="You are not a Knowledge admin"
            body={`This PC is signed in as ${access.email ?? upn}. Only County UPNs on the Knowledge allow list can train the desk agent.`}
          />
        ) : (
          <>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Shield className="size-4 text-[var(--accent)]" />
                Admins
              </div>
              <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">
                The same allow list ships on every machine and also syncs from github.com/ROK-CJAY/Spartan-Browser
                (policy/desk-policy.json). Binding Windows only identifies who is sitting here. Extra
                @miamidade.gov UPNs can be added on this desk; GitHub-hosted and shipped accounts cannot be
                removed here.
              </p>
              <ul className="mb-3 divide-y divide-[var(--border)] text-sm">
                {access.admins.map((admin) => (
                  <li key={admin.email} className="flex min-h-11 items-center justify-between gap-3 py-2">
                    <span>
                      <span className="block font-medium">{admin.email}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {isShippedAdmin(admin.email) || admin.addedBy === "github"
                          ? admin.addedBy === "github"
                            ? "From GitHub policy"
                            : "Shipped with the desk"
                          : `Added by ${admin.addedBy}`}
                      </span>
                    </span>
                    {isShippedAdmin(admin.email) || admin.addedBy === "github" || admin.email === access.email ? (
                      <span className="text-xs text-[var(--muted)]">
                        {admin.email === access.email ? "You" : "Fixed"}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="grid size-9 place-items-center rounded-lg hover:bg-[var(--btn)]"
                        onClick={() => void dropAdmin(admin.email)}
                        aria-label={`Remove ${admin.email}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="name@miamidade.gov"
                  aria-label="New admin email"
                />
                <Button type="button" disabled={busy || !adminEmail.trim()} onClick={() => void addAdmin()}>
                  Add admin
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter articles"
                  className="max-w-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm({ ...EMPTY, lastReviewed: todayISO() });
                    setEditing(true);
                  }}
                >
                  <Plus className="size-4" />
                  New article
                </Button>
              </div>

              {editing ? (
                <ArticleForm
                  form={form}
                  busy={busy}
                  onChange={setForm}
                  onCancel={() => {
                    setEditing(false);
                    setForm(EMPTY);
                  }}
                  onSave={() => void save()}
                />
              ) : null}

              <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
                {visible.map((article) => (
                  <li key={article.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setForm(toInput(article));
                        setEditing(true);
                      }}
                    >
                      <span className="block text-sm font-medium">
                        {article.id} · {article.title}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">{article.summary}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <Badge>{article.retired ? "retired" : article.currency}</Badge>
                        {article.expiresOn ? <Badge>expires {article.expiresOn}</Badge> : null}
                        {article.featured ? <Badge>workspace</Badge> : null}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void toggleRetire(article)}
                    >
                      {article.retired ? "Restore" : "Retire"}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function GateCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
    </div>
  );
}



function Badge({ children }: { children: React.ReactNode }) {

  return (
    <span className="rounded-full bg-[var(--btn)] px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
      {children}
    </span>
  );
}

function ArticleForm({
  form,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  form: ArticleInput;
  busy: boolean;
  onChange: (next: ArticleInput) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  function patch(partial: Partial<ArticleInput>) {
    onChange({ ...form, ...partial });
  }
  const currencies: ArticleCurrency[] = ["current", "review", "outdated"];

  return (
    <form
      className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">
          KM ID
          <Input className="mt-1" value={form.id} onChange={(e) => patch({ id: e.target.value })} required />
        </label>
        <label className="text-xs font-medium">
          Currency
          <select
            className="mt-1 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            value={form.currency}
            onChange={(e) => patch({ currency: e.target.value as ArticleCurrency })}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium sm:col-span-2">
          Title
          <Input className="mt-1" value={form.title} onChange={(e) => patch({ title: e.target.value })} required />
        </label>
        <label className="text-xs font-medium sm:col-span-2">
          Summary
          <Input className="mt-1" value={form.summary} onChange={(e) => patch({ summary: e.target.value })} required />
        </label>
        <label className="text-xs font-medium">
          Last reviewed
          <Input className="mt-1" type="date" value={form.lastReviewed} onChange={(e) => patch({ lastReviewed: e.target.value })} />
        </label>
        <label className="text-xs font-medium">
          Expires on
          <Input
            className="mt-1"
            type="date"
            value={form.expiresOn ?? ""}
            onChange={(e) => patch({ expiresOn: e.target.value || null })}
          />
        </label>
        <label className="text-xs font-medium sm:col-span-2">
          Keywords (comma separated)
          <Input
            className="mt-1"
            value={form.keywords.join(", ")}
            onChange={(e) => patch({ keywords: e.target.value.split(",") })}
          />
        </label>
        <label className="text-xs font-medium sm:col-span-2">
          Supersedes (KM ids)
          <Input
            className="mt-1"
            value={form.supersedes.join(", ")}
            onChange={(e) => patch({ supersedes: e.target.value.split(",") })}
          />
        </label>
        <label className="text-xs font-medium sm:col-span-2">
          Stale note
          <Input className="mt-1" value={form.staleNote} onChange={(e) => patch({ staleNote: e.target.value })} />
        </label>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium">Steps</p>
        <div className="space-y-2">
          {form.steps.map((step, index) => (
            <Input
              key={index}
              value={step}
              onChange={(e) => {
                const steps = [...form.steps];
                steps[index] = e.target.value;
                patch({ steps });
              }}
              placeholder={`Step ${index + 1}`}
            />
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => patch({ steps: [...form.steps, ""] })}>
            Add step
          </Button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.featured}
          onChange={(e) => patch({ featured: e.target.checked })}
        />
        Show on Workspace Knowledge
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.retired} onChange={(e) => patch({ retired: e.target.checked })} />
        Retired (hidden from the desk agent)
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save article"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
