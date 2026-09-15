import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronLeft, CloudUpload, FileSpreadsheet, Plus, Shield, Trash2, Upload } from "lucide-react";
import {
  addKnowledgeAdmin,
  getKnowledgeAccess,
  importKnowledgeArticles,
  listManagedKnowledge,
  publishKnowledgeCatalog,
  removeKnowledgeAdmin,
  retireKnowledgeArticle,
  saveKnowledgeArticle,
  type KnowledgeAccess,
  type ArticleInput,
} from "@/lib/browser/knowledge-server";
import { todayISO, isCountyEmail, isShippedAdmin, type ArticleCurrency, type KnowledgeArticle } from "@/lib/browser/knowledge-base";
import { isHostedAdmin } from "@/lib/browser/desk-updates";
import {
  KNOWLEDGE_TEMPLATE_CSV,
  parseKnowledgeCsv,
  parseKnowledgeRows,
  type ImportReport,
} from "@/lib/browser/knowledge-import";
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
  const token = useBrowserStore((s) => s.config.githubPublishToken);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const fileRef = useRef<HTMLInputElement>(null);
  const [access, setAccess] = useState<KnowledgeAccess | null>(null);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [form, setForm] = useState<ArticleInput>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [filter, setFilter] = useState("");
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [pushOnSave, setPushOnSave] = useState(true);

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

  async function pushAll() {
    const result = await publishKnowledgeCatalog({ data: { upn, token } });
    setNotice(`Published ${result.count} articles to every desk. Open Spartan copies pick this up within a minute.`);
  }

  async function maybePush() {
    if (!pushOnSave) return;
    if (!token.trim()) {
      setNotice("Saved on this desk only. Add a GitHub token below to push to every open Spartan.");
      return;
    }
    await pushAll();
  }

  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await saveKnowledgeArticle({ data: { ...form, upn } });
      setEditing(false);
      setForm(EMPTY);
      await refresh();
      await maybePush();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save article.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRetire(article: KnowledgeArticle) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await retireKnowledgeArticle({ data: { id: article.id, retired: !article.retired, upn } });
      await refresh();
      await maybePush();
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

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const report = await parseSpreadsheet(file);
      setPreview(report);
      if (!report.articles.length) {
        setError(report.errors[0] || "No usable Remedy rows in that spreadsheet.");
      }
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Could not read that spreadsheet.");
    }
  }

  async function confirmImport() {
    if (!preview?.articles.length) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await importKnowledgeArticles({ data: { upn, articles: preview.articles } });
      setPreview(null);
      await refresh();
      setNotice(
        `Imported ${result.imported} article${result.imported === 1 ? "" : "s"}${
          result.skipped ? ` (${result.skipped} skipped)` : ""
        }.`,
      );
      await maybePush();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import spreadsheet.");
    } finally {
      setBusy(false);
    }
  }

  async function publishNow() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await pushAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish to GitHub.");
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
                Train the desk agent from Remedy: add articles, upload the Excel export, and publish so every open
                Spartan picks up the change. Access is the Windows / Entra account on this PC (@miamidade.gov).
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
            {notice ? <p className="text-sm text-[var(--accent)]">{notice}</p> : null}

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

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="size-4 text-[var(--accent)]" />
                Remedy spreadsheet
              </div>
              <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">
                Upload the Excel or CSV export from Remedy (KM ID, Title, Question/Summary, Answer/Steps, Status).
                Existing IDs are updated. Download the template if your export uses different column names.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void onPickFile(file);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4" />
                  Upload Excel / CSV
                </Button>
                <Button type="button" variant="outline" onClick={() => downloadTemplate()}>
                  Download template
                </Button>
              </div>
              {preview ? (
                <div className="mt-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                  <p className="text-sm">
                    Ready to import {preview.articles.length} article{preview.articles.length === 1 ? "" : "s"}
                    {preview.skipped ? ` (${preview.skipped} rows skipped)` : ""}.
                  </p>
                  {preview.errors.length ? (
                    <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--muted)]">
                      {preview.errors.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  <ul className="max-h-40 space-y-1 overflow-auto text-xs text-[var(--muted)]">
                    {preview.articles.slice(0, 12).map((article) => (
                      <li key={article.id}>
                        {article.id} · {article.title}
                      </li>
                    ))}
                    {preview.articles.length > 12 ? <li>…and {preview.articles.length - 12} more</li> : null}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={busy || !preview.articles.length} onClick={() => void confirmImport()}>
                      {busy ? "Importing…" : "Import these articles"}
                    </Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => setPreview(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <CloudUpload className="size-4 text-[var(--accent)]" />
                Push to every desk
              </div>
              <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">
                Publishing writes knowledge/desk-knowledge.json on github.com/ROK-CJAY/Spartan-Browser. Every open
                Spartan pulls that file about once a minute — no restart. Token stays on this PC.
              </p>
              <label className="mb-3 block text-xs font-medium">
                GitHub token
                <Input
                  className="mt-1"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setConfig({ githubPublishToken: e.target.value })}
                  placeholder="ghp_… with Contents access"
                />
              </label>
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={pushOnSave} onChange={(e) => setPushOnSave(e.target.checked)} />
                Push to all desks when I save, import, or retire
              </label>
              <Button type="button" disabled={busy} onClick={() => void publishNow()}>
                {busy ? "Publishing…" : "Publish to all desks now"}
              </Button>
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

async function parseSpreadsheet(file: File): Promise<ImportReport> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv") {
    return parseKnowledgeCsv(await file.text());
  }
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) return { articles: [], skipped: 0, errors: ["The spreadsheet has no sheets."] };
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  if (rows.length < 2) return { articles: [], skipped: 0, errors: ["The spreadsheet is empty."] };
  const headers = (rows[0] ?? []).map((cell) => String(cell ?? ""));
  const body = rows.slice(1).map((row) => (Array.isArray(row) ? row : []).map((cell) => String(cell ?? "")));
  return parseKnowledgeRows(headers, body);
}

function downloadTemplate() {
  const blob = new Blob([KNOWLEDGE_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "spartan-knowledge-template.csv";
  a.click();
  URL.revokeObjectURL(url);
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
