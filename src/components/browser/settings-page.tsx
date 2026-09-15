import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Accessibility,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  Cookie,
  Cpu,
  Download,
  Globe,
  Info,
  KeyRound,
  Languages,
  Layers,
  Link2,
  Monitor,
  Paintbrush,
  Pencil,
  Plus,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Type,
  Upload,
  User,
  UserCircle,
  Bot,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useBrowserStore } from "@/lib/browser/store";
import {
  ACCENT_SWATCHES,
  THEME_PRESETS,
  type ClearOnClose,
  type ColorMode,
  type CookieMode,
  type SearchEngine,
  type SettingsSection,
  type ThemeSettings,
  type TrackingLevel,
} from "@/lib/browser/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SsoCard } from "./identity";
import { PasswordsSection } from "./password-vault";
import { checkDeskUpdates } from "@/lib/browser/desk-updates-server";
import { APP_VERSION, type DeskUpdateStatus } from "@/lib/browser/desk-updates";
import {
  checkDesktopUpdates,
  installDesktopUpdate,
  isSpartanDesktop,
  readDesktopUpdateStatus,
  subscribeDesktopUpdates,
} from "@/lib/browser/desktop";
import type { DesktopUpdateStatus } from "@/types/spartan-desktop";

type Lucide = typeof User;

const NAV: { id: SettingsSection; label: string; icon: Lucide }[] = [
  { id: "profiles", label: "Profiles", icon: UserCircle },
  { id: "passwords", label: "Passwords and autofill", icon: KeyRound },
  { id: "privacy", label: "Privacy, search, and services", icon: Shield },
  { id: "assistant", label: "Desk assistant", icon: Bot },
  { id: "appearance", label: "Appearance", icon: Paintbrush },
  { id: "default", label: "Default browser", icon: Monitor },
  { id: "startup", label: "Start, home, and new tab", icon: Sparkles },
  { id: "languages", label: "Languages", icon: Languages },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
  { id: "system", label: "System and performance", icon: Cpu },
  { id: "reset", label: "Reset settings", icon: RotateCcw },
  { id: "extensions", label: "Extensions", icon: Puzzle },
  { id: "about", label: "About this browser", icon: Info },
];

const FONTS = ["IBM Plex Sans", "Segoe UI", "Calibri", "Georgia", "Tahoma", "Trebuchet MS"];

type Page =
  | null
  | "sync"
  | "import"
  | "preferences"
  | "share"
  | "workspaces"
  | "cookies"
  | "tracking"
  | "search-engine"
  | "toolbar"
  | "fonts"
  | "colors"
  | "clear-on-close"
  | "typo"
  | "security"
  | "connected"
  | "privacy-prefs";

type Hit = { label: string; hint?: string; section: SettingsSection; page?: Page; icon: Lucide };

const INDEX: Hit[] = [
  { label: "Passwords", hint: "Autofill and saved usernames", section: "passwords", icon: KeyRound },
  { label: "ADUC and CmRC scripts", hint: "Run in memory or save .ps1 outside C:\\Scripts", section: "passwords", icon: KeyRound },
  { label: "Manage cookies", hint: "Site data and third-party cookies", section: "privacy", page: "cookies", icon: Cookie },
  { label: "Hardware acceleration", hint: "System and performance", section: "system", icon: Cpu },
  { label: "Favorites", hint: "Start, home, and new tab", section: "startup", icon: Star },
  { label: "Sync", hint: "Roam across Help Desk PCs", section: "profiles", page: "sync", icon: RefreshCw },
  { label: "Appearance", hint: "Theme, zoom, and colors", section: "appearance", icon: Paintbrush },
  { label: "Tracking prevention", section: "privacy", page: "tracking", icon: Shield },
  { label: "Languages", section: "languages", icon: Languages },
  { label: "Downloads", section: "downloads", icon: Download },
  { label: "Kiosk mode", section: "system", icon: Monitor },
  { label: "Profiles", section: "profiles", icon: UserCircle },
  { label: "Import browser data", section: "profiles", page: "import", icon: Upload },
  { label: "Reset settings", section: "reset", icon: RotateCcw },
  { label: "Extensions", section: "extensions", icon: Puzzle },
  { label: "Accessibility", section: "accessibility", icon: Accessibility },
  { label: "Desk assistant", section: "assistant", icon: Bot },
  { label: "Knowledge admin", hint: "Train Remedy articles for the desk agent", section: "assistant", icon: Bot },

  { label: "About", hint: "Version and GitHub updates", section: "about", icon: Info },
  { label: "Check for updates", hint: "Spartan Browser GitHub releases and admin list", section: "about", icon: RefreshCw },

  { label: "Search engine", section: "privacy", page: "search-engine", icon: Search },
  { label: "Clear browsing data on close", section: "privacy", page: "clear-on-close", icon: Trash2 },
  { label: "Typo protection", section: "privacy", page: "typo", icon: Type },
  { label: "Security", section: "privacy", page: "security", icon: ShieldCheck },
  { label: "Connected experiences", section: "privacy", page: "connected", icon: Link2 },
];

export function SettingsPage() {
  const section = useBrowserStore((s) => s.settingsSection);
  const setSection = useBrowserStore((s) => s.setSettingsSection);
  const navigate = useBrowserStore((s) => s.navigate);
  const goBack = useBrowserStore((s) => s.goBack);
  const canGoBack = useBrowserStore((s) => s.canGoBack);
  const closeTab = useBrowserStore((s) => s.closeTab);
  const goHome = useBrowserStore((s) => s.goHome);
  const activeTabId = useBrowserStore((s) => s.activeProfile().activeTabId);
  const tabCount = useBrowserStore((s) => s.activeProfile().tabs.length);
  const [q, setQ] = useState("");
  const [page, setPage] = useState<Page>(null);
  const query = q.trim().toLowerCase();

  function go(id: SettingsSection, next: Page = null) {
    setSection(id);
    setPage(next);
    setQ("");
  }

  function leaveSettings() {
    if (page) {
      setPage(null);
      return;
    }
    if (canGoBack()) {
      goBack();
      return;
    }
    if (tabCount > 1) closeTab(activeTabId);
    else goHome();
  }

  const hits = useMemo(
    () => (query ? INDEX.filter((h) => `${h.label} ${h.hint ?? ""}`.toLowerCase().includes(query)) : []),
    [query],
  );

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)] text-[var(--fg)]">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] md:flex">
        <div className="flex items-start gap-1 px-3 pt-4 pb-1">
          <button
            type="button"
            onClick={leaveSettings}
            className="grid size-9 place-items-center rounded-lg hover:bg-[var(--btn)]"
            aria-label="Back"
            title="Back"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="px-1 pt-1">
            <h1 className="text-[22px] font-semibold tracking-tight">Settings</h1>
          </div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Settings">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id && !query;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={cn(
                  "relative mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px]",
                  active ? "bg-[var(--btn)] font-medium" : "text-[var(--muted)] hover:bg-[var(--btn)] hover:text-[var(--fg)]",
                )}
              >
                {active ? <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-[var(--fg)]" /> : null}
                <Icon className="size-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("https://myit.miamidade.gov", "MyIT")}
            className="mb-3 w-full rounded-full border border-[var(--border)] px-3 py-2 text-[13px] hover:bg-[var(--btn)]"
          >
            Send feedback
          </button>
          <p className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <Briefcase className="size-3.5" />
            Managed by your organization
          </p>
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6 sm:px-8">
          <button
            type="button"
            onClick={leaveSettings}
            className="flex items-center gap-1 self-start rounded-lg py-1 pr-3 text-[13px] text-[var(--muted)] hover:bg-[var(--btn)] hover:text-[var(--fg)] md:hidden"
          >
            <ChevronLeft className="size-5" />
            Back
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings" className="h-11 rounded-full pl-10" aria-label="Search settings" />
          </div>
          <div className="flex flex-wrap gap-2 md:hidden">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs",
                  section === item.id ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--btn)]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {query ? (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Results</p>
              {hits.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No matching settings.</p>
              ) : (
                <Group>
                  {hits.map((h) => (
                    <Row key={h.label} icon={h.icon} title={h.label} hint={h.hint} onClick={() => go(h.section, h.page ?? null)} />
                  ))}
                </Group>
              )}
            </div>
          ) : (
            <>
              {!page ? <MostSearched onPick={go} /> : null}
              <SectionBody id={section} page={page} setPage={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MostSearched({ onPick }: { onPick: (id: SettingsSection, page?: Page) => void }) {
  const chips: { label: string; id: SettingsSection; page?: Page; icon: Lucide }[] = [
    { label: "Passwords", id: "passwords", icon: KeyRound },
    { label: "Manage cookies", id: "privacy", page: "cookies", icon: Cookie },
    { label: "Hardware acceleration", id: "system", icon: Cpu },
    { label: "Favorites", id: "startup", icon: Star },
  ];
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Most searched</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => onPick(c.id, c.page)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[13px] hover:border-[var(--accent)]"
            >
              <Icon className="size-3.5 text-[var(--muted)]" />
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionBody({ id, page, setPage }: { id: SettingsSection; page: Page; setPage: (p: Page) => void }) {
  if (page === "sync") return <SyncPage onBack={() => setPage(null)} />;
  if (page === "import") return <ImportPage onBack={() => setPage(null)} />;
  if (page === "preferences") return <PrefsPage onBack={() => setPage(null)} />;
  if (page === "share") return <SharePage onBack={() => setPage(null)} />;
  if (page === "workspaces") return <WorkspacesPage onBack={() => setPage(null)} />;
  if (page === "cookies") return <CookiesPage onBack={() => setPage(null)} />;
  if (page === "tracking") return <TrackingPage onBack={() => setPage(null)} />;
  if (page === "search-engine") return <SearchEnginePage onBack={() => setPage(null)} />;
  if (page === "toolbar") return <ToolbarPage onBack={() => setPage(null)} />;
  if (page === "fonts") return <FontsPage onBack={() => setPage(null)} />;
  if (page === "colors") return <ColorsPage onBack={() => setPage(null)} />;
  if (page === "clear-on-close") return <ClearOnClosePage onBack={() => setPage(null)} />;
  if (page === "typo") return <TypoPage onBack={() => setPage(null)} />;
  if (page === "security") return <SecurityPage onBack={() => setPage(null)} />;
  if (page === "connected") return <ConnectedPage onBack={() => setPage(null)} />;
  if (page === "privacy-prefs") return <PrivacyPrefsPage onBack={() => setPage(null)} />;
  switch (id) {
    case "profiles":
      return <ProfilesSection setPage={setPage} />;
    case "passwords":
      return <PasswordsSection />;
    case "privacy":
      return <PrivacySection setPage={setPage} />;
    case "assistant":
      return <AssistantSection />;
    case "appearance":
      return <AppearanceSection setPage={setPage} />;
    case "default":
      return <DefaultSection />;
    case "startup":
      return <StartupSection />;
    case "languages":
      return <LanguagesSection />;
    case "downloads":
      return <DownloadsSection />;
    case "accessibility":
      return <AccessSection />;
    case "system":
      return <SystemSection />;
    case "reset":
      return <ResetSection />;
    case "extensions":
      return <ExtensionsSection />;
    default:
      return <AboutSection />;
  }
}

function Heading({ title }: { title: string }) {
  return <h2 className="mb-1 text-[22px] font-semibold tracking-tight">{title}</h2>;
}
function Subhead({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-[13px] text-[var(--muted)]">{children}</p>;
}
function Group({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-xl bg-[var(--panel)]">{children}</div>;
}
function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <button type="button" onClick={onBack} aria-label="Back" className="grid size-9 place-items-center rounded-lg hover:bg-[var(--btn)]">
        <ChevronLeft className="size-5" />
      </button>
      <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange, locked }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; locked?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-3.5 last:border-0">
      <span>
        <span className="block text-[13px] font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12px] text-[var(--muted)]">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={locked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-[var(--accent)]" : "bg-[var(--btn)]", locked && "opacity-50")}
      >
        <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform", checked && "translate-x-5")} />
      </button>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  hint,
  onClick,
  locked,
  trailing,
}: {
  icon: Lucide;
  title: string;
  hint?: string;
  onClick?: () => void;
  locked?: boolean;
  trailing?: ReactNode;
}) {
  const Comp = onClick && !locked ? "button" : "div";
  return (
    <Comp
      type={onClick && !locked ? "button" : undefined}
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3.5 text-left last:border-0 hover:bg-[var(--btn)]"
    >
      <Icon className="size-4 shrink-0 text-[var(--muted)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{title}</span>
        {hint ? <span className="mt-0.5 block text-[12px] text-[var(--muted)]">{hint}</span> : null}
      </span>
      {trailing}
      {locked ? <Briefcase className="size-3.5 text-[var(--muted)]" /> : onClick ? <ChevronRight className="size-4 text-[var(--muted)]" /> : null}
    </Comp>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "W"
  );
}

function ProfilesSection({ setPage }: { setPage: (p: Page) => void }) {
  const user = useCurrentUser();
  const entraUpn = useBrowserStore((s) => s.config.entraUpn);
  const profiles = useBrowserStore((s) => s.profiles);
  const active = useBrowserStore((s) => s.activeProfileId);
  const switchProfile = useBrowserStore((s) => s.switchProfile);
  const createProfile = useBrowserStore((s) => s.createProfile);
  const renameProfile = useBrowserStore((s) => s.renameProfile);
  const removeProfile = useBrowserStore((s) => s.removeProfile);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const current = profiles.find((p) => p.id === active) ?? profiles[0];
  const others = profiles.filter((p) => p.id !== active);

  return (
    <>
      <Heading title="Profiles" />
      <Subhead>
        {entraUpn
          ? "This work profile uses the Windows / Entra account already signed into this PC."
          : "The installed desk app reads the Windows logon automatically. County sites still complete Entra MFA inside Spartan."}


      </Subhead>
      <SsoCard />
      <div className="mt-6 mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-medium">Profiles in this account</h3>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
      <p className="mb-3 text-[13px] text-[var(--muted)]">
        Extra profiles (Work, InPrivate) still belong to {user?.displayName ?? "this desk"}. They are not
        separate employees.
      </p>
      {adding ? (
        <div className="mb-4 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Profile name" />
          <Button
            onClick={() => {
              if (name.trim()) createProfile(name.trim());
              setName("");
              setAdding(false);
            }}
          >
            Add
          </Button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl bg-[var(--panel)]">
        <div className="flex flex-wrap items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium">{current.name}</div>
            <div className="text-[12px] text-[var(--muted)]">
              {current.kind === "work" ? "SSO work profile" : current.kind === "inprivate" ? "InPrivate" : "Local profile"}
            </div>
          </div>
          {current.kind !== "work" ? (
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg hover:bg-[var(--btn)]"
              onClick={() => {
                const next = window.prompt("Rename profile", current.name);
                if (next) renameProfile(current.id, next);
              }}
              aria-label="Edit"
            >
              <Pencil className="size-4" />
            </button>
          ) : null}
          {profiles.length > 1 && current.kind !== "work" ? (
            <button type="button" className="grid size-9 place-items-center rounded-lg hover:bg-[var(--btn)]" onClick={() => removeProfile(current.id)} aria-label="Delete">
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      <h3 className="mt-6 mb-1 text-[15px] font-medium">Profile settings</h3>
      <p className="mb-3 text-[13px] text-[var(--muted)]">These browser settings apply only to this employee.</p>
      <Group>
        <Row icon={RefreshCw} title="Sync" hint="Roam with the signed-in account" onClick={() => setPage("sync")} />
        <Row icon={Upload} title="Import browser data" onClick={() => setPage("import")} />
        <Row icon={Settings2} title="Profile preferences" onClick={() => setPage("preferences")} />
        <Row icon={Share2} title="Share browsing data with Windows" locked />
        <Row icon={Layers} title="Workspaces" onClick={() => setPage("workspaces")} />
      </Group>
      {others.length ? (
        <>
          <h3 className="mt-6 mb-3 text-[15px] font-medium">More profiles in this account</h3>
          <div className="flex flex-col gap-2">
            {others.map((p) => (
              <button key={p.id} type="button" onClick={() => switchProfile(p.id)} className="flex items-center gap-3 rounded-xl bg-[var(--panel)] px-4 py-3 text-left hover:bg-[var(--btn)]">
                <div className="grid size-10 place-items-center rounded-full bg-[var(--btn)] text-xs font-semibold">{initials(p.name)}</div>
                <span>
                  <span className="block text-[13px] font-medium">{p.name}</span>
                  <span className="text-[12px] text-[var(--muted)]">{p.kind === "work" ? "SSO" : p.kind}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function SyncPage({ onBack }: { onBack: () => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  return (
    <div>
      <BackHeader title="Sync" onBack={onBack} />
      <Subhead>Favorites, history, settings, usernames, and encrypted passwords roam with the signed-in employee. They never mix with the next person who uses this PC.</Subhead>
      <Group>
        <Toggle label="Sync" checked={config.syncEnabled} onChange={(v) => setConfig({ syncEnabled: v })} />
        <Toggle label="Favorites" checked={config.syncFavorites} onChange={(v) => setConfig({ syncFavorites: v })} />
        <Toggle label="History" checked={config.syncHistory} onChange={(v) => setConfig({ syncHistory: v })} />
        <Toggle label="Settings" checked={config.syncSettings} onChange={(v) => setConfig({ syncSettings: v })} />
        <Toggle label="Passwords" hint="Encrypted vault for this signed-in employee" checked={config.syncPasswords} onChange={(v) => setConfig({ syncPasswords: v })} />
      </Group>
    </div>
  );
}

function ImportPage({ onBack }: { onBack: () => void }) {
  const importBookmarks = useBrowserStore((s) => s.importBookmarks);
  const bookmarks = useBrowserStore((s) => s.activeProfile().bookmarks);
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  return (
    <div>
      <BackHeader title="Import browser data" onBack={onBack} />
      <Subhead>Import favorites from a JSON backup or a Chrome/Edge HTML export. Passwords are never imported.</Subhead>
      <Group>
        <div className="space-y-3 px-4 py-4">
          <input
            ref={input}
            type="file"
            accept=".json,.html,text/html,application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              let items: { title: string; url: string; folder?: string }[] = [];
              if (file.name.endsWith(".html") || text.includes("<a ")) {
                const matches = [...text.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)/gi)];
                items = matches.map((m) => ({ url: m[1], title: m[2] || m[1] }));
              } else {
                try {
                  const json = JSON.parse(text) as { bookmarks?: { title?: string; name?: string; url: string; folder?: string }[] };
                  const list = json.bookmarks ?? (Array.isArray(json) ? json : []);
                  items = list.map((b) => ({ title: b.title ?? b.name ?? b.url, url: b.url, folder: b.folder }));
                } catch {
                  setMsg("Could not read that file.");
                  return;
                }
              }
              const n = importBookmarks(items);
              setMsg(`Imported ${n} favorite${n === 1 ? "" : "s"}.`);
            }}
          />
          <Button variant="outline" onClick={() => input.current?.click()}>Choose file</Button>
          <Button
            variant="outline"
            onClick={() => {
              const blob = new Blob([JSON.stringify({ bookmarks }, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "mdc-favorites.json";
              a.click();
            }}
          >
            Export favorites
          </Button>
          {msg ? <p className="text-[13px] text-[var(--muted)]">{msg}</p> : null}
        </div>
      </Group>
    </div>
  );
}

function PrefsPage({ onBack }: { onBack: () => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  return (
    <div>
      <BackHeader title="Profile preferences" onBack={onBack} />
      <Group>
        <Toggle label="InPrivate browsing" hint="History is not written while this is on." checked={config.privateMode} onChange={(v) => setConfig({ privateMode: v })} />
      </Group>
    </div>
  );
}

function SharePage({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <BackHeader title="Share browsing data" onBack={onBack} />
      <p className="text-[13px] text-[var(--muted)]">Managed by Miami-Dade County ITD.</p>
    </div>
  );
}

function WorkspacesPage({ onBack }: { onBack: () => void }) {
  const navigate = useBrowserStore((s) => s.navigate);
  const setPage = onBack;
  return (
    <div>
      <BackHeader title="Workspaces" onBack={setPage} />
      <Group>
        <Row icon={Layers} title="Help Desk" hint="MyIT, SmartIT, NSD" onClick={() => navigate("mdc://workspace", "Workspace")} />
        <Row icon={Building2} title="County portal" hint="miamidade.gov" onClick={() => navigate("https://www.miamidade.gov", "County")} />
      </Group>
    </div>
  );
}

function PrivacySection({ setPage }: { setPage: (p: Page) => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const setDelete = useBrowserStore((s) => s.setDeleteDialogOpen);
  return (
    <>
      <Heading title="Privacy, search, and services" />
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setDelete(true)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] hover:bg-[var(--btn)]">
          Clear browsing data
        </button>
        <button type="button" onClick={() => setPage("typo")} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] hover:bg-[var(--btn)]">
          Typo protection
        </button>
        <button type="button" onClick={() => setPage("clear-on-close")} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] hover:bg-[var(--btn)]">
          Clear on close
        </button>
      </div>
      <Group>
        <Row icon={Shield} title="Tracking prevention" hint={config.trackingPrevention} onClick={() => setPage("tracking")} />
        <Row icon={Trash2} title="Clear browsing data" hint="History, downloads, and cache for this profile" onClick={() => setDelete(true)} />
        <Row icon={Cookie} title="Privacy" hint="Do not track, cookies, safe browsing" onClick={() => setPage("privacy-prefs")} />
        <Row icon={ShieldCheck} title="Security" hint="HTTPS, SmartScreen, site isolation" onClick={() => setPage("security")} />
        <Row icon={Link2} title="Search and connected experiences" onClick={() => setPage("connected")} />
        <Row icon={Cookie} title="Cookies and site data" hint={config.cookieMode} onClick={() => setPage("cookies")} />
        <Row icon={Search} title="Address bar search engine" hint={config.searchEngine} onClick={() => setPage("search-engine")} />
        <Row icon={Type} title="Typo protection" hint={config.typoProtection ? "On" : "Off"} onClick={() => setPage("typo")} />
        <Row icon={Trash2} title="Clear browsing data on close" onClick={() => setPage("clear-on-close")} />
      </Group>
      <div className="mt-6">
        <Group>
          <Toggle label="Do not track" checked={config.doNotTrack} onChange={(v) => setConfig({ doNotTrack: v })} />
          <Toggle label="HTTPS-only mode" checked={config.httpsOnly} onChange={(v) => setConfig({ httpsOnly: v })} />
          <Toggle label="Block pop-ups" checked={config.blockPopups} onChange={(v) => setConfig({ blockPopups: v })} />
          <Toggle label="Search suggestions" checked={config.searchSuggestions} onChange={(v) => setConfig({ searchSuggestions: v })} />
          <Toggle label="Optional diagnostic data" hint="Off by default for County images." checked={config.sendDiagnostics} onChange={(v) => setConfig({ sendDiagnostics: v })} />
        </Group>
      </div>
    </>
  );
}

function TrackingPage({ onBack }: { onBack: () => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const levels: { id: TrackingLevel; title: string; hint: string }[] = [
    { id: "basic", title: "Basic", hint: "Allows most trackers. Least protection, best compatibility." },
    { id: "balanced", title: "Balanced", hint: "Blocks some trackers. Recommended for Help Desk work." },
    { id: "strict", title: "Strict", hint: "Blocks most trackers. Some sites may not work." },
  ];
  return (
    <div>
      <BackHeader title="Tracking prevention" onBack={onBack} />
      <Group>
        {levels.map((l) => (
          <label key={l.id} className={cn("flex cursor-pointer items-start gap-3 border-b border-[var(--border)] px-4 py-3.5 last:border-0", config.trackingPrevention === l.id && "bg-[var(--btn)]")}>
            <input type="radio" name="track" className="mt-1" checked={config.trackingPrevention === l.id} onChange={() => setConfig({ trackingPrevention: l.id })} />
            <span>
              <span className="block text-[13px] font-medium">{l.title}</span>
              <span className="text-[12px] text-[var(--muted)]">{l.hint}</span>
            </span>
          </label>
        ))}
      </Group>
    </div>
  );
}

function CookiesPage({ onBack }: { onBack: () => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const modes: { id: CookieMode; title: string; hint: string }[] = [
    { id: "allow", title: "Allow all cookies", hint: "Sites may remember you across visits." },
    { id: "block-third", title: "Block third-party cookies", hint: "Recommended." },
    { id: "block-all", title: "Block all cookies", hint: "Many County portals will prompt more often." },
  ];
  return (
    <div>
      <BackHeader title="Cookies and site data" onBack={onBack} />
      <Group>
        {modes.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-start gap-3 border-b border-[var(--border)] px-4 py-3.5 last:border-0">
            <input type="radio" name="cookie" className="mt-1" checked={config.cookieMode === m.id} onChange={() => setConfig({ cookieMode: m.id })} />
            <span>
              <span className="block text-[13px] font-medium">{m.title}</span>
              <span className="text-[12px] text-[var(--muted)]">{m.hint}</span>
            </span>
          </label>
        ))}
      </Group>
    </div>
  );
}

function SearchEnginePage({ onBack }: { onBack: () => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const engines: { id: SearchEngine; title: string }[] = [
    { id: "county", title: "Miami-Dade search" },
    { id: "bing", title: "Bing" },
    { id: "google", title: "Google" },
  ];
  return (
    <div>
      <BackHeader title="Address bar search engine" onBack={onBack} />
      <Group>
        {engines.map((e) => (
          <label key={e.id} className="flex cursor-pointer items-center gap-3 border-b border-[var(--border)] px-4 py-3.5 last:border-0">
            <input type="radio" name="engine" checked={config.searchEngine === e.id} onChange={() => setConfig({ searchEngine: e.id })} />
            <span className="text-[13px]">{e.title}</span>
          </label>
        ))}
      </Group>
    </div>
  );
}

function ClearOnClosePage({ onBack }: { onBack: () => void }) {
  const config = useBrowserStore((s) => s.config);
  const setClearOnClose = useBrowserStore((s) => s.setClearOnClose);
  const rows: { key: keyof ClearOnClose; label: string; locked?: boolean }[] = [
    { key: "history", label: "Browsing history" },
    { key: "downloads", label: "Download history" },
    { key: "cookies", label: "Cookies and other site data" },
    { key: "cache", label: "Cached images and files" },
    { key: "passwords", label: "Passwords" },
    { key: "autofill", label: "Autofill form data" },
  ];
  return (
    <div>
      <BackHeader title="Clear browsing data on close" onBack={onBack} />
      <Subhead>Choose what to automatically clear every time this browser session ends.</Subhead>
      <Group>
        {rows.map((r) => (
          <Toggle
            key={r.key}
            label={r.label}
            hint={r.locked ? "Blocked by organization policy." : undefined}
            checked={r.locked ? false : config.clearOnClose[r.key]}
            locked={r.locked}
            onChange={(v) => setClearOnClose({ [r.key]: v })}
          />
        ))}
      </Group>
    </div>
  );
}

function TypoPage({ onBack }: { onBack: () => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  return (
    <div>
      <BackHeader title="Typo protection" onBack={onBack} />
      <Subhead>Warn before opening lookalike County domains that may be used in phishing.</Subhead>
      <Group>
        <Toggle label="Enable typo protection" checked={config.typoProtection} onChange={(v) => setConfig({ typoProtection: v })} />
      </Group>
    </div>
  );
}

function SecurityPage({ onBack }: { onBack: () => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  return (
    <div>
      <BackHeader title="Security" onBack={onBack} />
      <Subhead>Manage how this browser protects staff data on County images.</Subhead>
      <Group>
        <Toggle label="Firewall enabled" hint="Windows image policy." checked={config.firewallEnabled} onChange={(v) => setConfig({ firewallEnabled: v })} locked />
        <Toggle label="SmartScreen filter" checked={config.smartscreen} onChange={(v) => setConfig({ smartscreen: v })} />
        <Toggle label="Allow insecure content" hint="Off. Mixed content is blocked." checked={config.allowInsecure} onChange={(v) => setConfig({ allowInsecure: v })} />
        <Toggle label="Site isolation" checked={config.siteIsolation} onChange={(v) => setConfig({ siteIsolation: v })} />
        <Toggle label="HTTPS-only mode" checked={config.httpsOnly} onChange={(v) => setConfig({ httpsOnly: v })} />
        <Toggle label="Safe browsing" checked={config.safeBrowsing} onChange={(v) => setConfig({ safeBrowsing: v })} />
      </Group>
    </div>
  );
}

function ConnectedPage({ onBack }: { onBack: () => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  return (
    <div>
      <BackHeader title="Search and connected experiences" onBack={onBack} />
      <Subhead>Manage search suggestions and optional connected features. Ads and usage sharing stay off for County images.</Subhead>
      <Group>
        <Toggle label="Search suggestions" checked={config.searchSuggestions} onChange={(v) => setConfig({ searchSuggestions: v })} />
        <Toggle label="Personalize ads" hint="Off. Not used on County images." checked={config.personalizeAds} onChange={(v) => setConfig({ personalizeAds: v })} locked />
        <Toggle label="Use location" checked={config.useLocation} onChange={(v) => setConfig({ useLocation: v })} />
        <Toggle label="Share usage data" checked={config.shareUsageData} onChange={(v) => setConfig({ shareUsageData: v })} />
        <Toggle label="Prefetch DNS" checked={config.prefetchDns} onChange={(v) => setConfig({ prefetchDns: v })} />
      </Group>
    </div>
  );
}

function PrivacyPrefsPage({ onBack }: { onBack: () => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  return (
    <div>
      <BackHeader title="Privacy" onBack={onBack} />
      <Group>
        <Toggle label="Send Do Not Track" checked={config.doNotTrack} onChange={(v) => setConfig({ doNotTrack: v })} />
        <Toggle label="Allow cookies" checked={config.allowCookies} onChange={(v) => setConfig({ allowCookies: v })} />
        <Toggle label="Block third-party cookies" checked={config.cookieMode === "block-third"} onChange={(v) => setConfig({ cookieMode: v ? "block-third" : "allow" })} />
        <Toggle label="Enable safe browsing" checked={config.safeBrowsing} onChange={(v) => setConfig({ safeBrowsing: v })} />
      </Group>
    </div>
  );
}

function AssistantSection() {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const navigate = useBrowserStore((s) => s.navigate);
  return (
    <>
      <Heading title="Desk assistant" />
      <Subhead>
        Workspace retrieves Remedy articles and writes an answer a phone agent can read. Optional: a model on this PC
        (Ollama, localhost only). Knowledge admins train the catalog and can push it to every open desk.
      </Subhead>
      <Group>
        <Toggle label="Show assistant in the sidebar" checked={config.aiAssist} onChange={(v) => setConfig({ aiAssist: v })} />
        <Toggle
          label="Use a local model on this PC"
          hint="Ollama at 127.0.0.1 only. If it is not running, the desk agent still answers from the articles."
          checked={config.ollamaEnabled}
          onChange={(v) => setConfig({ ollamaEnabled: v })}
        />
        <Row
          icon={Bot}
          title="Knowledge admin"
          hint="Add, edit, import Excel, and publish articles"
          onClick={() => navigate("mdc://knowledge", "Knowledge")}
        />
      </Group>
      <div className="mt-4 space-y-3">
        <label className="block text-[13px] font-medium">
          Ollama address
          <Input
            className="mt-1"
            value={config.ollamaUrl}
            onChange={(e) => setConfig({ ollamaUrl: e.target.value })}
            placeholder="http://127.0.0.1:11434"
          />
        </label>
        <label className="block text-[13px] font-medium">
          Ollama model
          <Input
            className="mt-1"
            value={config.ollamaModel}
            onChange={(e) => setConfig({ ollamaModel: e.target.value })}
            placeholder="llama3.1"
          />
        </label>
        <label className="block text-[13px] font-medium">
          GitHub token (publish knowledge)
          <Input
            className="mt-1"
            type="password"
            autoComplete="off"
            value={config.githubPublishToken}
            onChange={(e) => setConfig({ githubPublishToken: e.target.value })}
            placeholder="ghp_…"
          />
          <span className="mt-1 block text-[12px] font-normal text-[var(--muted)]">
            Contents access to ROK-CJAY/Spartan-Browser. Stored on this PC. Used only to publish
            knowledge/desk-knowledge.json so every open desk can pull it.
          </span>
        </label>
      </div>
    </>
  );
}

function AppearanceSection({ setPage }: { setPage: (p: Page) => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const applyPreset = useBrowserStore((s) => s.applyPreset);
  const theme = useBrowserStore((s) => s.theme);
  const setTheme = useBrowserStore((s) => s.setTheme);
  const setZoom = useBrowserStore((s) => s.setZoom);

  function applyMode(mode: ColorMode) {
    setConfig({ colorMode: mode });
    if (mode === "dark") applyPreset({ ...THEME_PRESETS.opera, colorAccent: config.accentColor });
    else if (mode === "light") applyPreset({ ...THEME_PRESETS.light, colorAccent: config.accentColor });
    else if (mode === "county") applyPreset({ ...THEME_PRESETS.county, colorAccent: config.accentColor });
    else if (mode === "grey") applyPreset({ ...THEME_PRESETS.grey, colorAccent: config.accentColor });
    else {
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyPreset({ ...(dark ? THEME_PRESETS.opera : THEME_PRESETS.light), colorAccent: config.accentColor });
    }
  }

  const modes: { id: ColorMode; label: string }[] = [
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
    { id: "county", label: "County blue" },
    { id: "grey", label: "Grey" },
    { id: "system", label: "System" },
  ];

  return (
    <>
      <Heading title="Appearance" />
      <p className="mb-2 text-[13px] font-medium">Theme</p>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => applyMode(m.id)}
            className={cn(
              "rounded-xl border px-3 py-4 text-[13px]",
              config.colorMode === m.id ? "border-[var(--accent)] bg-[var(--panel)]" : "border-[var(--border)] hover:bg-[var(--btn)]",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[13px] font-medium">Accent color</p>
      <div className="mb-5 flex flex-wrap gap-3">
        {ACCENT_SWATCHES.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            onClick={() => {
              setConfig({ accentColor: c.value });
              setTheme({ colorAccent: c.value });
            }}
            className={cn("size-8 rounded-full border-2", config.accentColor === c.value ? "scale-110 border-[var(--fg)]" : "border-transparent")}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      <Group>
        <div className="flex items-center justify-between px-4 py-3.5 text-[13px]">
          <span>Page zoom</span>
          <span className="flex items-center gap-2">
            <button type="button" className="grid size-8 place-items-center rounded-lg hover:bg-[var(--btn)]" onClick={() => setZoom(config.zoom - 10)}>−</button>
            <span className="w-12 text-center tabular-nums">{config.zoom}%</span>
            <button type="button" className="grid size-8 place-items-center rounded-lg hover:bg-[var(--btn)]" onClick={() => setZoom(config.zoom + 10)}>+</button>
          </span>
        </div>
        <Toggle label="Show home button" checked={config.showHomeButton} onChange={(v) => setConfig({ showHomeButton: v })} />
        <Toggle label="Show favorites bar" checked={config.showFavoritesBar} onChange={(v) => setConfig({ showFavoritesBar: v })} />
        <Toggle label="Show workspace sidebar" checked={theme.showPanel} onChange={(v) => setTheme({ showPanel: v })} />
        <Toggle label="Vertical tabs" checked={config.verticalTabs} onChange={(v) => setConfig({ verticalTabs: v })} />
        <Row icon={Paintbrush} title="Customize colors" onClick={() => setPage("colors")} />
        <Row icon={Settings2} title="Toolbar" onClick={() => setPage("toolbar")} />
        <Row icon={Globe} title="Fonts" hint={theme.fontFamily} onClick={() => setPage("fonts")} />
      </Group>
    </>
  );
}

function ToolbarPage({ onBack }: { onBack: () => void }) {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const theme = useBrowserStore((s) => s.theme);
  const setTheme = useBrowserStore((s) => s.setTheme);
  return (
    <div>
      <BackHeader title="Toolbar" onBack={onBack} />
      <Group>
        <Toggle label="Home button" checked={config.showHomeButton} onChange={(v) => setConfig({ showHomeButton: v })} />
        <Toggle label="Favorites bar" checked={config.showFavoritesBar} onChange={(v) => setConfig({ showFavoritesBar: v })} />
        <Toggle label="Workspace panel" checked={theme.showPanel} onChange={(v) => setTheme({ showPanel: v })} />
      </Group>
    </div>
  );
}

function FontsPage({ onBack }: { onBack: () => void }) {
  const theme = useBrowserStore((s) => s.theme);
  const setTheme = useBrowserStore((s) => s.setTheme);
  return (
    <div>
      <BackHeader title="Fonts" onBack={onBack} />
      <label className="block text-[13px]">
        Font
        <select value={theme.fontFamily} onChange={(e) => setTheme({ fontFamily: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--addr)] px-2">
          {FONTS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ColorsPage({ onBack }: { onBack: () => void }) {
  const theme = useBrowserStore((s) => s.theme);
  const setTheme = useBrowserStore((s) => s.setTheme);
  const colors = [
    ["App", "colorApp", theme.colorApp],
    ["Rail", "colorRail", theme.colorRail],
    ["Panel", "colorPanel", theme.colorPanel],
    ["Top bar", "colorTop", theme.colorTop],
    ["Accent", "colorAccent", theme.colorAccent],
    ["Text", "colorText", theme.colorText],
    ["Muted", "colorMuted", theme.colorMuted],
    ["Buttons", "colorButton", theme.colorButton],
    ["Address", "colorAddress", theme.colorAddress],
  ] as const;
  return (
    <div>
      <BackHeader title="Customize colors" onBack={onBack} />
      <Group>
        {colors.map(([label, key, value]) => (
          <label key={key} className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 text-[13px] last:border-0">
            {label}
            <input
              type="color"
              value={value}
              onChange={(e) => setTheme({ [key]: e.target.value } as Partial<ThemeSettings>)}
              className="h-8 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent"
            />
          </label>
        ))}
      </Group>
    </div>
  );
}

function DefaultSection() {
  return (
    <>
      <Heading title="Default browser" />
      <Subhead>ITD deploys this app beside Edge. Windows default-app policy is set by the organization.</Subhead>
      <Group>
        <Row icon={Monitor} title="This image is managed" hint="Staff should use this browser for Help Desk work." locked />
      </Group>
    </>
  );
}

function StartupSection() {
  const theme = useBrowserStore((s) => s.theme);
  const setTheme = useBrowserStore((s) => s.setTheme);
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  return (
    <>
      <Heading title="Start, home, and new tab page" />
      <label className="mb-4 block text-[13px]">
        Home page
        <Input className="mt-1" value={theme.startPage} onChange={(e) => setTheme({ startPage: e.target.value })} />
      </label>
      <p className="mb-2 text-[13px] font-medium">New tab opens</p>
      <Group>
        {(
          [
            ["workspace", "Staff workspace"],
            ["blank", "Blank workspace"],
            ["custom", "Custom address"],
          ] as const
        ).map(([id, label]) => (
          <label key={id} className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5 text-[13px] last:border-0">
            <input type="radio" name="ntp" checked={config.newTabPage === id} onChange={() => setConfig({ newTabPage: id })} />
            {label}
          </label>
        ))}
      </Group>
      {config.newTabPage === "custom" ? <Input className="mt-3" value={config.customNewTab} onChange={(e) => setConfig({ customNewTab: e.target.value })} /> : null}
    </>
  );
}

function LanguagesSection() {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  return (
    <>
      <Heading title="Languages" />
      <label className="mb-4 block text-[13px]">
        Display language
        <select className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--addr)] px-2" value={config.language} onChange={(e) => setConfig({ language: e.target.value })}>
          <option value="en-US">English (United States)</option>
          <option value="es-US">Español (Estados Unidos)</option>
          <option value="ht">Kreyòl ayisyen</option>
        </select>
      </label>
      <Group>
        <Toggle label="Spellcheck" checked={config.spellcheck} onChange={(v) => setConfig({ spellcheck: v })} />
        <Toggle label="Offer to translate pages" checked={config.offerTranslate} onChange={(v) => setConfig({ offerTranslate: v })} />
      </Group>
    </>
  );
}

function DownloadsSection() {
  const downloads = useBrowserStore((s) => s.downloads);
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  return (
    <>
      <Heading title="Downloads" />
      <Group>
        <Toggle label="Ask where to save each file" checked={config.downloadAsk} onChange={(v) => setConfig({ downloadAsk: v })} />
      </Group>
      {downloads.length === 0 ? (
        <p className="mt-4 text-[13px] text-[var(--muted)]">No downloads in this profile yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--border)] text-[13px]">
          {downloads.map((d) => (
            <li key={d.id} className="py-2">
              {d.name}
              <span className="block text-[12px] text-[var(--muted)]">{d.status}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AccessSection() {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const theme = useBrowserStore((s) => s.theme);
  const setTheme = useBrowserStore((s) => s.setTheme);
  return (
    <>
      <Heading title="Accessibility" />
      <Group>
        <Toggle label="High contrast chrome" checked={config.highContrast} onChange={(v) => setConfig({ highContrast: v })} />
        <Toggle label="Reduce motion" checked={config.reduceMotion} onChange={(v) => setConfig({ reduceMotion: v })} />
      </Group>
      <label className="mt-4 block text-[13px]">
        UI text size ({theme.fontSize}px)
        <input type="range" min={12} max={18} value={theme.fontSize} onChange={(e) => setTheme({ fontSize: Number(e.target.value) })} className="mt-2 w-full" />
      </label>
    </>
  );
}

function SystemSection() {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const kiosk = useBrowserStore((s) => s.kiosk);
  const setKiosk = useBrowserStore((s) => s.setKiosk);
  return (
    <>
      <Heading title="System and performance" />
      <Group>
        <Toggle label="Use hardware acceleration when available" checked={config.hardwareAccel} onChange={(v) => setConfig({ hardwareAccel: v })} />
        <Toggle label="Efficiency mode" checked={config.efficiencyMode} onChange={(v) => setConfig({ efficiencyMode: v })} />
        <Toggle label="Sleep inactive tabs" checked={config.sleepInactiveTabs} onChange={(v) => setConfig({ sleepInactiveTabs: v })} />
        <Toggle
          label="Kiosk mode"
          hint="Full screen. Press Esc or F11 to exit."
          checked={kiosk}
          onChange={(v) => {
            setKiosk(v);
            if (v) document.documentElement.requestFullscreen?.().catch(() => {});
            else document.exitFullscreen?.().catch(() => {});
          }}
        />
      </Group>
    </>
  );
}

function ResetSection() {
  const resetBrowser = useBrowserStore((s) => s.resetBrowser);
  return (
    <>
      <Heading title="Reset settings" />
      <Subhead>Restores appearance and configuration. Profiles and favorites stay.</Subhead>
      <Group>
        <div className="px-4 py-4">
          <Button
            variant="outline"
            onClick={() => {
              if (window.confirm("Reset appearance and configuration to County defaults?")) resetBrowser();
            }}
          >
            Restore settings to default
          </Button>
        </div>
      </Group>
    </>
  );
}

function ExtensionsSection() {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  return (
    <>
      <Heading title="Extensions" />
      <Subhead>Extensions are managed by the organization. Staff cannot sideload add-ons on this image.</Subhead>
      <Group>
        <div className="flex items-start justify-between gap-4 px-4 py-4">
          <span>
            <span className="block text-[13px] font-medium">Password Helper</span>
            <span className="mt-0.5 block text-[12px] text-[var(--muted)]">
              Suggests strong passwords. Saving passwords is blocked — County sites use Entra ID.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={config.passwordHelper}
            onClick={() => setConfig({ passwordHelper: !config.passwordHelper })}
            className={cn("relative h-5 w-10 shrink-0 rounded-full", config.passwordHelper ? "bg-[var(--accent)]" : "bg-[var(--btn)]")}
          >
            <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform", config.passwordHelper && "translate-x-5")} />
          </button>
        </div>
      </Group>
    </>
  );
}

function AboutSection() {
  const desktop = isSpartanDesktop();
  const [status, setStatus] = useState<DeskUpdateStatus | null>(null);
  const [installer, setInstaller] = useState<DesktopUpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!desktop) return;
    void readDesktopUpdateStatus().then((next) => {
      if (next) setInstaller(next);
    });
    return subscribeDesktopUpdates((next) => setInstaller(next));
  }, [desktop]);

  async function check() {
    setBusy(true);
    setError("");
    try {
      if (desktop) {
        const update = await checkDesktopUpdates();
        if (update) setInstaller(update);
        if (update?.error) setError(update.error);
      }
      try {
        const next = await checkDeskUpdates();
        setStatus(next);
      } catch (err) {
        if (!desktop) setError(err instanceof Error ? err.message : "Could not reach GitHub.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function restartAndUpdate() {
    setError("");
    const result = await installDesktopUpdate();
    if (!result.ok) setError("The update is still downloading. Try Check for updates again.");
  }

  const installerBusy = installer?.phase === "checking" || installer?.phase === "downloading";
  const ready = installer?.phase === "ready";

  return (
    <>
      <Heading title="About this browser" />
      <Subhead>
        {desktop
          ? "Check GitHub Releases for a newer Spartan Browser. When it finishes downloading, restart here to install it."
          : "Check GitHub Releases for a newer Windows installer. Knowledge articles and the admin list refresh from this repo while Spartan is open."}
      </Subhead>
      <Group>
        <div className="flex items-start gap-3 px-4 py-4">
          <div className="grid size-12 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)]">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">Spartan Browser</p>
            <p className="text-[13px] text-[var(--muted)]">
              Version {installer?.currentVersion || APP_VERSION} · Miami-Dade County IT Service Center
            </p>
            <p className="mt-2 text-[13px] text-[var(--muted)]">Managed by your organization. Some settings are locked.</p>
          </div>
        </div>
      </Group>
      <Group>
        <div className="space-y-3 px-4 py-4 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={busy || installerBusy} onClick={() => void check()}>
              <RefreshCw className={cn("mr-2 size-4", (busy || installerBusy) && "animate-spin")} />
              {busy || installer?.phase === "checking"
                ? "Checking…"
                : installer?.phase === "downloading"
                  ? `Downloading ${installer.percent}%`
                  : "Check for updates"}
            </Button>
            {ready ? (
              <Button type="button" onClick={() => void restartAndUpdate()}>
                Restart and update
              </Button>
            ) : null}
            {!desktop && status?.updateAvailable && status.releaseUrl ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (status.releaseUrl) window.open(status.releaseUrl, "_blank", "noopener");
                }}
              >
                Open release
              </Button>
            ) : null}
          </div>
          {error ? <p className="text-red-400">{error}</p> : null}
          {installer?.error ? <p className="text-red-400">{installer.error}</p> : null}
          <div className="space-y-1 text-[var(--muted)]">
            {installer ? (
              <p>
                {installer.phase === "ready"
                  ? `Version ${installer.latestVersion} is downloaded. Restart Spartan Browser to finish installing.`
                  : installer.phase === "downloading"
                    ? `Downloading version ${installer.latestVersion} (${installer.percent}%). Keep the app open.`
                    : installer.phase === "available"
                      ? `Version ${installer.latestVersion} is available and will download automatically.`
                      : installer.phase === "current"
                        ? "This desk is on the current version."
                        : installer.phase === "checking"
                          ? "Checking GitHub Releases…"
                          : installer.phase === "error"
                            ? "Could not check for a desktop update. Try again, or install the Setup file from GitHub Releases."
                            : "Check for updates to see if a newer installer is on GitHub."}
              </p>
            ) : status ? (
              <p>
                {status.updateAvailable
                  ? `Version ${status.latestVersion} is on GitHub Releases (this desk is ${status.currentVersion}).`
                  : "This desk is on the current shipped version."}
              </p>
            ) : (
              <p>Check for updates to look for a newer Spartan Browser on GitHub Releases.</p>
            )}
            {status ? <p>Policy last checked {new Date(status.checkedAt).toLocaleString()}</p> : null}
          </div>
        </div>
      </Group>
    </>
  );
}
