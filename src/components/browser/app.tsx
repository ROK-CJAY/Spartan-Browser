import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bookmark,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  ExternalLink,
  History,
  Home,
  LayoutGrid,
  Lock,
  Maximize2,
  Minimize2,
  Monitor,
  Plus,
  RotateCw,
  Search,
  Settings,
  Shield,
  Star,
  StickyNote,
  Ticket,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { AppMenu } from "./app-menu";
import { BookmarkPrompt, FavoritesBar } from "./favorites-bar";
import { DeleteDataDialog } from "./delete-data";
import { Favicon } from "./favicon";
import { WorkspaceHome } from "./home";
import { KnowledgeAdminPage } from "./knowledge-admin";
import { DesktopWebview } from "./desktop-webview";
import { RailAvatar, SsoCard, AccountChip } from "./identity";
import { SecureLaunch } from "./launch";
import { VaultChip } from "./password-vault";
import { ElevatedLaunchDialog } from "./elevated-launch";
import { SettingsPage } from "./settings-page";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { GUEST_OWNER } from "@/lib/browser/account";
import { loadBrowserState, saveBrowserState } from "@/lib/browser/server";
import { useBrowserStore } from "@/lib/browser/store";
import {
  DESKTOP_APPS,
  DOWNLOADS_URL,
  FAVORITES_URL,
  HISTORY_URL,
  HOME_URL,
  ITD_TOOLS,
  KNOWLEDGE_URL,
  PINNED,
  SETTINGS_URL,
  displayTitle,
  hostOf,
  isElevatedTool,
  isInternalUrl,
  normalizeUrl,
  requiresSecureLaunch,
  typoSuspect,
  type PanelId,
} from "@/lib/browser/types";
import { checkDeskUpdates, syncHostedKnowledge } from "@/lib/browser/desk-updates-server";
import { isHostedAdmin, KNOWLEDGE_POLL_MS, type DeskUpdateStatus } from "@/lib/browser/desk-updates";
import { isSpartanDesktop, installDesktopUpdate, readDesktopUpdateStatus, readDesktopWindowsIdentity, subscribeDesktopUpdates } from "@/lib/browser/desktop";
import type { DesktopUpdateStatus } from "@/types/spartan-desktop";
import { expiryState, loginForTool } from "@/lib/browser/vault-crypto";
import { cn } from "@/lib/utils";

export function BrowserApp() {
  const theme = useBrowserStore((s) => s.theme);
  const config = useBrowserStore((s) => s.config);
  const kiosk = useBrowserStore((s) => s.kiosk);
  const sessionReady = useBrowserStore((s) => s.sessionReady);
  const applyClearOnClose = useBrowserStore((s) => s.applyClearOnClose);
  const { user, isPending } = useCurrentUserState();
  const sessionGen = useRef(0);
  const [authWaited, setAuthWaited] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setAuthWaited(true), 400);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const vars: Record<string, string> = {
      "--bg": theme.colorApp,
      "--rail": theme.colorRail,
      "--panel": theme.colorPanel,
      "--top": theme.colorTop,
      "--accent": theme.colorAccent,
      "--fg": theme.colorText,
      "--muted": theme.colorMuted,
      "--btn": theme.colorButton,
      "--addr": theme.colorAddress,
      "--motion-quick": config.reduceMotion ? "0ms" : "150ms",
    };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.style.fontFamily = `${theme.fontFamily}, IBM Plex Sans, sans-serif`;
    root.style.fontSize = `${theme.fontSize}px`;
    root.style.filter = config.highContrast ? "contrast(1.12)" : "";
    document.body.style.background = theme.colorApp;
    document.body.style.color = theme.colorText;
  }, [theme, config.reduceMotion, config.highContrast]);

  useEffect(() => {
    if (isPending && !authWaited) return;
    const owner = user?.id ?? GUEST_OWNER;
    const gen = ++sessionGen.current;

    void (async () => {
      const store = useBrowserStore.getState();
      const prev = store.sessionOwnerId;
      if (prev && prev !== owner && prev !== GUEST_OWNER && store.config.syncEnabled) {
        try {
          await saveBrowserState({ data: store.payload() });
        } catch {
          /* signed-out save is skipped by auth */
        }
      }
      if (sessionGen.current !== gen) return;
      store.adoptOwner(owner);
      if (sessionGen.current !== gen) return;
      store.setSessionReady(true);
      if (user && !user.isDevFallback) {
        try {
          const remote = await loadBrowserState();
          if (sessionGen.current !== gen) return;
          if (remote) store.replacePayload(remote);
        } catch {
          /* stay on this employee's local cache */
        }
      }
      if (sessionGen.current !== gen) return;
      if (user) {
        store.bindSsoUser({
          id: user.id,
          name: user.displayName,
          email: user.primaryEmail,
        });
      }
      if (sessionGen.current !== gen) return;
      await store.hydrateVault();
      if (sessionGen.current !== gen) return;
      store.setSessionReady(true);
    })();
  }, [user?.id, user?.isDevFallback, isPending, authWaited]);

  const profiles = useBrowserStore((s) => s.profiles);
  const activeProfileId = useBrowserStore((s) => s.activeProfileId);
  const logins = useBrowserStore((s) => s.logins);
  const downloads = useBrowserStore((s) => s.downloads);
  const sessionOwnerId = useBrowserStore((s) => s.sessionOwnerId);

  useEffect(() => {
    if (!sessionReady || !user || user.isDevFallback || !config.syncEnabled) return;
    const handle = window.setTimeout(() => {
      const payload = useBrowserStore.getState().payload();
      saveBrowserState({ data: payload }).catch(() => {});
    }, 700);
    return () => window.clearTimeout(handle);
  }, [sessionReady, sessionOwnerId, user, config.syncEnabled, profiles, activeProfileId, theme, config, logins, downloads]);

  useEffect(() => {
    const onHide = () => useBrowserStore.getState().applyClearOnClose();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [applyClearOnClose]);

  useEffect(() => {
    let cancelled = false;
    void readDesktopWindowsIdentity().then((identity) => {
      if (cancelled || !identity) return;
      useBrowserStore.getState().setConfig({
        entraUpn: identity.upn,
        windowsAccount: identity.account,
      });
    });
    const stop = window.spartanDesktop?.onOpenTab((url) => {
      const store = useBrowserStore.getState();
      if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) return;
      store.newTab(url);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <Chrome
      kiosk={kiosk}
      showPanel={theme.showPanel}
      railWidth={theme.railWidth}
      panelWidth={theme.panelWidth}
      topHeight={theme.topHeight}
      zoom={config.zoom}
    />
  );
}

function Chrome({
  kiosk,
  showPanel,
  railWidth,
  panelWidth,
  topHeight,
  zoom,
}: {
  kiosk: boolean;
  showPanel: boolean;
  railWidth: number;
  panelWidth: number;
  topHeight: number;
  zoom: number;
}) {
  const panel = useBrowserStore((s) => s.panel);
  const setPanel = useBrowserStore((s) => s.setPanel);
  const config = useBrowserStore((s) => s.config);
  const profile = useBrowserStore((s) => s.activeProfile());
  const tab = useBrowserStore((s) => s.activeTab());
  const navigate = useBrowserStore((s) => s.navigate);
  const newTab = useBrowserStore((s) => s.newTab);
  const closeTab = useBrowserStore((s) => s.closeTab);
  const selectTab = useBrowserStore((s) => s.selectTab);
  const goHome = useBrowserStore((s) => s.goHome);
  const goBack = useBrowserStore((s) => s.goBack);
  const goForward = useBrowserStore((s) => s.goForward);
  const openSettings = useBrowserStore((s) => s.openSettings);
  const addressDraft = useBrowserStore((s) => s.addressDraft);
  const setAddressDraft = useBrowserStore((s) => s.setAddressDraft);
  const findOpen = useBrowserStore((s) => s.findOpen);
  const findQuery = useBrowserStore((s) => s.findQuery);
  const setFindOpen = useBrowserStore((s) => s.setFindOpen);
  const setFindQuery = useBrowserStore((s) => s.setFindQuery);
  const splitView = useBrowserStore((s) => s.splitView);
  const setKiosk = useBrowserStore((s) => s.setKiosk);
  const setBookmarkPromptOpen = useBrowserStore((s) => s.setBookmarkPromptOpen);

  const addressRef = useRef<HTMLInputElement>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [typoUrl, setTypoUrl] = useState<string | null>(null);
  const [deskNotice, setDeskNotice] = useState<(typeof DESKTOP_APPS)[number] | null>(null);
  const [elevatedTool, setElevatedTool] = useState<null | "aduc" | "cmrc">(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [deskUpdate, setDeskUpdate] = useState<DeskUpdateStatus | null>(null);
  const [installer, setInstaller] = useState<DesktopUpdateStatus | null>(null);


  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const next = await checkDeskUpdates();
        if (!cancelled) setDeskUpdate(next);
      } catch {
        /* keep last */
      }
    }
    void tick();
    const id = window.setInterval(() => void tick(), 30 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    void syncHostedKnowledge().catch(() => {});
    const id = window.setInterval(() => {
      void syncHostedKnowledge().catch(() => {});
    }, KNOWLEDGE_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isSpartanDesktop()) return;
    void readDesktopUpdateStatus().then((next) => {
      if (next) setInstaller(next);
    });
    return subscribeDesktopUpdates((next) => setInstaller(next));
  }, []);

  useEffect(() => {
    setAddressDraft(tab.url);
  }, [tab.id, tab.url, setAddressDraft]);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && useBrowserStore.getState().kiosk) {
        useBrowserStore.getState().setKiosk(false);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const store = useBrowserStore.getState();
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;

      if (e.key === "Escape") {
        store.setMenuOpen(false);
        store.setFindOpen(false);
        store.setBookmarkPromptOpen(false);
        store.setDeleteDialogOpen(false);
        setSuggestOpen(false);
        setTypoUrl(null);
        setMobilePanel(false);
        setElevatedTool(null);
        setDeskNotice(null);
        if (document.activeElement === addressRef.current && addressRef.current) {
          addressRef.current.value = store.activeTab().url;
          store.setAddressDraft(store.activeTab().url);
        }
        if (store.kiosk) {
          store.setKiosk(false);
          document.exitFullscreen?.().catch(() => {});
        }
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        if (store.kiosk) {
          store.setKiosk(false);
          document.exitFullscreen?.().catch(() => {});
        } else {
          store.setKiosk(true);
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
        return;
      }
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        store.goBack();
        return;
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        store.goForward();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        addressRef.current?.focus();
        addressRef.current?.select();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "t" && !e.shiftKey) {
        e.preventDefault();
        store.newTab();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        store.setBookmarkPromptOpen(true);
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        store.closeTab(store.activeTab().id);
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        store.reopenClosedTab();
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        store.cycleTab(-1);
        return;
      }
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        store.cycleTab(1);
        return;
      }
      if (e.ctrlKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        store.selectTabAt(Number(e.key) - 1);
        return;
      }
      if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
        e.preventDefault();
        setReloadKey((n) => n + 1);
        store.navigate(store.activeTab().url, store.activeTab().title);
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        store.navigate(HISTORY_URL, "History");
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        store.navigate(DOWNLOADS_URL, "Downloads");
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        store.navigate(FAVORITES_URL, "Favorites");
        return;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        store.setDeleteDialogOpen(true);
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        store.setFindOpen(true);
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        store.newPrivateSession();
        return;
      }
      if (e.ctrlKey && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        store.setZoom(store.config.zoom + 10);
        return;
      }
      if (e.ctrlKey && e.key === "-") {
        e.preventDefault();
        store.setZoom(store.config.zoom - 10);
        return;
      }
      if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        store.setZoom(100);
        return;
      }
      if (typing) return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const suggestions = useMemo(() => {
    if (!config.searchSuggestions || !suggestOpen) return [];
    const q = addressDraft.trim().toLowerCase();
    return profile.history
      .filter((h) => !q || h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [addressDraft, config.searchSuggestions, profile.history, suggestOpen]);

  function submitAddress(raw: string) {
    const url = normalizeUrl(raw, config.searchEngine);
    setSuggestOpen(false);
    if (config.typoProtection && typoSuspect(url)) {
      setTypoUrl(url);
      return;
    }
    navigate(raw);
  }

  function togglePanel(id: PanelId) {
    const next = panel === id ? null : id;
    setPanel(next);
    setMobilePanel(Boolean(next));
  }

  const starred = profile.bookmarks.some((b) => b.url === tab.url);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]" style={{ fontFamily: "inherit" }}>
      {kiosk ? (
        <div className="z-50 flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--accent)] px-3 py-2 text-[var(--accent-fg)]">
          <Maximize2 className="size-4 shrink-0" />
          <p className="min-w-0 flex-1 text-sm font-medium">Kiosk mode</p>
          <span className="hidden text-xs opacity-80 sm:inline">Esc or F11 also exits</span>
          <button
            type="button"
            className="h-9 shrink-0 rounded-lg bg-[var(--accent-fg)] px-3 text-sm font-medium text-[var(--accent)] hover:opacity-90"
            onClick={() => {
              setKiosk(false);
              document.exitFullscreen?.().catch(() => {});
            }}
          >
            Exit kiosk mode
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1">
      <Rail
        width={railWidth}
        panel={panel}
        kiosk={kiosk}
        onToggle={togglePanel}
        onSettings={() => openSettings("profiles")}
        onKiosk={() => {
          if (kiosk) {
            setKiosk(false);
            document.exitFullscreen?.().catch(() => {});
          } else {
            setKiosk(true);
            document.documentElement.requestFullscreen?.().catch(() => {});
          }
        }}
      />

      {showPanel && panel ? (
        <aside
          className="hidden h-full min-h-0 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] md:flex"
          style={{ width: panelWidth }}
        >
          <WorkspacePanel
            panel={panel}
            onDesktop={(app) => {
              if (isElevatedTool(app.id)) setElevatedTool(app.id);
              else setDeskNotice(app);
            }}
            onNavigate={(url, title) => navigate(url, title)}
          />
        </aside>
      ) : null}

      {mobilePanel && panel ? (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobilePanel(false)}>
          <aside
            className="absolute top-0 bottom-0 left-16 w-[min(100%-4rem,20rem)] overflow-hidden border-r border-[var(--border)] bg-[var(--panel)]"
            onClick={(e) => e.stopPropagation()}
          >
            <WorkspacePanel
              panel={panel}
              onDesktop={(app) => {
                if (isElevatedTool(app.id)) setElevatedTool(app.id);
                else setDeskNotice(app);
                setMobilePanel(false);
              }}
              onNavigate={(url, title) => {
                navigate(url, title);
                setMobilePanel(false);
              }}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="relative z-40 flex shrink-0 flex-col border-b border-[var(--border)] bg-[var(--top)]"
          style={{ minHeight: topHeight }}
        >
          {installer?.phase === "ready" || installer?.phase === "downloading" || installer?.phase === "available" ? (
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs">
              <span>
                {installer.phase === "ready"
                  ? `Spartan Browser ${installer.latestVersion} is downloaded.`
                  : installer.phase === "downloading"
                    ? `Downloading Spartan Browser ${installer.latestVersion} (${installer.percent}%)…`
                    : `Spartan Browser ${installer.latestVersion} is available.`}
              </span>
              {installer.phase === "ready" ? (
                <button
                  type="button"
                  className="rounded-md bg-[var(--accent)] px-2 py-1 font-medium text-[var(--accent-fg)]"
                  onClick={() => void installDesktopUpdate()}
                >
                  Restart and update
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-md px-2 py-1 font-medium hover:bg-[var(--btn)]"
                  onClick={() => openSettings("about")}
                >
                  View progress
                </button>
              )}
            </div>
          ) : deskUpdate?.updateAvailable && !isSpartanDesktop() ? (
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs">
              <span>
                Version {deskUpdate.latestVersion} is on GitHub Releases (this desk is {deskUpdate.currentVersion}).
              </span>
              <button
                type="button"
                className="rounded-md px-2 py-1 font-medium hover:bg-[var(--btn)]"
                onClick={() => openSettings("about")}
              >
                Review update
              </button>
            </div>
          ) : null}
          {!config.verticalTabs ? (
            <div className="flex items-end gap-1 overflow-x-auto px-2 pt-1.5">
              {profile.tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTab(t.id)}
                  className={cn(
                    "group flex h-8 max-w-48 min-w-28 items-center gap-1.5 rounded-t-lg px-2 text-xs",
                    t.id === tab.id ? "bg-[var(--bg)]" : "bg-[var(--btn)]/60 hover:bg-[var(--btn)]",
                  )}
                >
                  <Favicon url={t.url} title={t.title} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-left">{t.title}</span>
                  {profile.tabs.length > 1 ? (
                    <span
                      role="button"
                      aria-label={`Close ${t.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(t.id);
                      }}
                      className="grid size-4 place-items-center rounded hover:bg-[var(--addr)]"
                    >
                      <X className="size-3" />
                    </span>
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                title="New tab (Ctrl+T)"
                onClick={() => newTab()}
                className="mb-0.5 grid size-7 place-items-center rounded-md hover:bg-[var(--btn)]"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-1 px-2 py-1.5">
            <IconBtn label="Back (Alt+Left)" disabled={(tab.sessionIndex ?? 0) <= 0} onClick={goBack}>
              <ChevronLeft className="size-5" />
            </IconBtn>
            <IconBtn
              label="Forward (Alt+Right)"
              disabled={(tab.sessionIndex ?? 0) >= (tab.session?.length ?? 1) - 1}
              onClick={goForward}
            >
              <ChevronRight className="size-5" />
            </IconBtn>
            <IconBtn label="Reload" onClick={() => setReloadKey((n) => n + 1)}>
              <RotateCw className="size-4" />
            </IconBtn>
            {config.showHomeButton ? (
              <IconBtn label="Home" onClick={goHome}>
                <Home className="size-4" />
              </IconBtn>
            ) : null}
            <form
              className="relative min-w-0 flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                submitAddress(addressDraft);
              }}
            >
              <div className="flex h-9 items-center gap-2 rounded-full bg-[var(--addr)] px-3 ring-1 ring-[var(--border)] focus-within:ring-[var(--accent)]">
                {requiresSecureLaunch(tab.url) || tab.url.startsWith("https://") ? (
                  <Lock className="size-3.5 shrink-0 text-[var(--muted)]" />
                ) : (
                  <GlobeMark />
                )}
                <input
                  ref={addressRef}
                  value={addressDraft}
                  onChange={(e) => {
                    setAddressDraft(e.target.value);
                    setSuggestOpen(true);
                  }}
                  onFocus={() => setSuggestOpen(true)}
                  onBlur={() => window.setTimeout(() => setSuggestOpen(false), 180)}
                  spellCheck={config.spellcheck}
                  aria-label="Address bar"
                  className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                  placeholder="Search or enter address"
                />
                <button
                  type="button"
                  title={starred ? "Saved in favorites" : "Add to favorites (Ctrl+D)"}
                  onClick={() => setBookmarkPromptOpen(true)}
                  className="grid size-7 place-items-center rounded-md hover:bg-[var(--btn)]"
                >
                  <Star className={cn("size-3.5", starred && "fill-[var(--accent)] text-[var(--accent)]")} />
                </button>
              </div>
              {suggestions.length ? (
                <ul className="absolute top-10 z-50 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] py-1 shadow-xl">
                  {suggestions.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--btn)]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => submitAddress(h.url)}
                      >
                        <Favicon url={h.url} title={h.title} size="sm" />
                        <span className="min-w-0 flex-1 truncate">{h.title}</span>
                        <span className="max-w-[40%] truncate text-[11px] text-[var(--muted)]">{h.url}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </form>
            {!isInternalUrl(tab.url) ? (
              <a
                href={tab.url}
                target="_blank"
                rel="noreferrer"
                title="Open in system tab"
                className="grid size-9 place-items-center rounded-lg hover:bg-[var(--btn)]"
              >
                <ExternalLink className="size-4" />
              </a>
            ) : null}
            <VaultChip />
            <AccountChip onOpen={() => togglePanel("profile")} />
            <AppMenu />
          </div>
          {config.showFavoritesBar && !kiosk ? (
            <div className="border-t border-[var(--border)] px-2 py-1">
              <FavoritesBar />
            </div>
          ) : null}
        </header>
        <div className="flex min-h-0 flex-1">
          {config.verticalTabs && !kiosk ? (
            <div className="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[var(--border)] bg-[var(--panel)] p-1.5">
              {profile.tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTab(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-2 text-left text-xs",
                    t.id === tab.id ? "bg-[var(--btn)]" : "hover:bg-[var(--btn)]",
                  )}
                >
                  <Favicon url={t.url} title={t.title} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {profile.tabs.length > 1 ? (
                    <X
                      className="size-3 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(t.id);
                      }}
                    />
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                onClick={() => newTab()}
                className="rounded-lg px-2 py-2 text-left text-xs text-[var(--muted)] hover:bg-[var(--btn)]"
              >
                New tab
              </button>
            </div>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1" style={{ zoom: `${zoom}%` }}>
            <div className="min-h-0 min-w-0 flex-1">
              <PageView url={tab.url} title={tab.title} reloadKey={reloadKey} />
            </div>
            {splitView ? (
              <div className="min-h-0 min-w-0 flex-1 border-l border-[var(--border)]">
                <WorkspaceHome />
              </div>
            ) : null}
          </div>
        </div>
        {findOpen ? (
          <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--panel)] px-3 py-2">
            <Search className="size-4 text-[var(--muted)]" />
            <input
              autoFocus
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (window as Window & { find?: (q: string) => boolean }).find?.(findQuery);
              }}
              placeholder="Find on page"
              className="h-8 flex-1 rounded-md bg-[var(--addr)] px-2 text-sm outline-none"
            />
            <button
              type="button"
              className="grid size-8 place-items-center rounded-md hover:bg-[var(--btn)]"
              onClick={() => setFindOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
      </div>
      <BookmarkPrompt />
      <DeleteDataDialog />
      {typoUrl ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4" onClick={() => setTypoUrl(null)}>
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-medium">Possible mistyped County site</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {hostOf(typoUrl)} looks like a lookalike of miamidade.gov. Continue only if you typed it on purpose.
            </p>
            <p className="mt-2 font-mono text-xs break-all text-[var(--muted)]">{typoUrl}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-2 text-sm hover:bg-[var(--btn)]" onClick={() => setTypoUrl(null)}>
                Stay here
              </button>
              <button
                type="button"
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-[var(--accent-fg)]"
                onClick={() => {
                  const next = typoUrl;
                  setTypoUrl(null);
                  navigate(next);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {elevatedTool ? (
        <ElevatedLaunchDialog key={elevatedTool} toolId={elevatedTool} onClose={() => setElevatedTool(null)} />
      ) : null}
      {deskNotice ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4" onClick={() => setDeskNotice(null)}>
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-medium">{deskNotice.label}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {deskNotice.hint}. Desktop launchers such as Notepad, ADUC, and TeamViewer run on the Windows Help Desk
              image, not in this web preview.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-[var(--accent-fg)]"
                onClick={() => setDeskNotice(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Rail({
  width,
  panel,
  kiosk,
  onToggle,
  onSettings,
  onKiosk,
}: {
  width: number;
  panel: PanelId;
  kiosk: boolean;
  onToggle: (id: PanelId) => void;
  onSettings: () => void;
  onKiosk: () => void;
}) {
  const goHome = useBrowserStore((s) => s.goHome);
  const navigate = useBrowserStore((s) => s.navigate);
  const upn = useBrowserStore((s) => s.config.entraUpn);
  const knowledgeAdmin = isHostedAdmin(upn);
  return (
    <nav
      className="z-30 flex h-full shrink-0 flex-col items-center gap-1 border-r border-[var(--border)] bg-[var(--rail)] py-2"
      style={{ width }}
      aria-label="Sidebar"
    >
      <button
        type="button"
        title="Workspace"
        onClick={goHome}
        className="mb-2 grid size-11 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)]"
      >
        <Shield className="size-5" />
      </button>
      {(
        [
          { id: "tools" as const, label: "ITD tools", icon: Wrench },
          { id: "bookmarks" as const, label: "Favorites", icon: Bookmark },
          { id: "history" as const, label: "History", icon: History },
          { id: "profile" as const, label: "Profile", icon: User },
        ]
      ).map((item) => {
        const Icon = item.icon;
        const active = panel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onClick={() => onToggle(item.id)}
            className={cn(
              "grid size-11 place-items-center rounded-xl",
              active ? "bg-[var(--btn)] text-[var(--fg)]" : "text-[var(--muted)] hover:bg-[var(--btn)] hover:text-[var(--fg)]",
            )}
          >
            <Icon className="size-5" />
          </button>
        );
      })}
      <button
        type="button"
        title={knowledgeAdmin ? "Knowledge admin" : "Knowledge"}
        onClick={() => navigate(KNOWLEDGE_URL, "Knowledge")}
        className={cn(
          "grid size-11 place-items-center rounded-xl",
          knowledgeAdmin
            ? "text-[var(--accent)] hover:bg-[var(--btn)]"
            : "text-[var(--muted)] hover:bg-[var(--btn)] hover:text-[var(--fg)]",
        )}
      >
        <BookOpen className="size-5" />
      </button>
      <div className="flex-1" />
      <button
        type="button"
        title={kiosk ? "Exit kiosk mode" : "Kiosk mode"}
        onClick={onKiosk}
        className={cn(
          "grid size-11 place-items-center rounded-xl",
          kiosk
            ? "bg-[var(--accent)] text-[var(--accent-fg)]"
            : "text-[var(--muted)] hover:bg-[var(--btn)] hover:text-[var(--fg)]",
        )}
      >
        {kiosk ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
      </button>
      <RailAvatar onOpen={() => onToggle("profile")} />
      <button
        type="button"
        title="Settings"
        onClick={onSettings}
        className="grid size-11 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--btn)] hover:text-[var(--fg)]"
      >
        <Settings className="size-5" />
      </button>
    </nav>
  );
}

function WorkspacePanel({
  panel,
  onDesktop,
  onNavigate,
}: {
  panel: PanelId;
  onDesktop: (app: (typeof DESKTOP_APPS)[number]) => void;
  onNavigate: (url: string, title: string) => void;
}) {
  if (panel === "bookmarks") return <BookmarksPanel onNavigate={onNavigate} />;
  if (panel === "history") return <HistoryPanel onNavigate={onNavigate} />;
  if (panel === "profile") return <ProfilePanel />;
  return <ToolsPanel onDesktop={onDesktop} onNavigate={onNavigate} />;
}

function ToolsPanel({
  onDesktop,
  onNavigate,
}: {
  onDesktop: (app: (typeof DESKTOP_APPS)[number]) => void;
  onNavigate: (url: string, title: string) => void;
}) {
  const [open, setOpen] = useState<string | null>("nsd");
  const [adQuery, setAdQuery] = useState("");
  const logins = useBrowserStore((s) => s.logins);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
      <h2 className="px-1 text-xs font-medium tracking-[0.16em] text-[var(--muted)] uppercase">County</h2>
      <div className="mt-2 flex flex-col gap-1">
        {PINNED.map((p) => (
          <SideRow
            key={p.id}
            label={p.label}
            hint={p.url.replace("https://", "")}
            onClick={() => onNavigate(p.url, p.label)}
            icon={<Cloud className="size-4" />}
          />
        ))}
      </div>
      <h2 className="mt-5 px-1 text-xs font-medium tracking-[0.16em] text-[var(--muted)] uppercase">ITD tools</h2>
      <div className="mt-2 flex flex-col gap-1">
        {ITD_TOOLS.map((tool) =>
          tool.submenu ? (
            <div key={tool.id}>
              <button
                type="button"
                onClick={() => setOpen(open === tool.id ? null : tool.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-[var(--btn)]"
              >
                <LayoutGrid className="size-4 text-[var(--accent)]" />
                <span className="flex-1">{tool.label}</span>
                <ChevronDown className={cn("size-3.5 text-[var(--muted)] transition-transform", open === tool.id && "rotate-180")} />
              </button>
              {open === tool.id ? (
                <div className="ml-4 border-l border-[var(--border)] pl-2">
                  {tool.submenu.map((sub) =>
                    sub.id === "ad-search" ? (
                      <form
                        key={sub.id}
                        className="px-1 py-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!adQuery.trim()) return;
                          onNavigate(
                            `https://nsd.miamidade.gov/active-directory/user/${encodeURIComponent(adQuery.trim())}`,
                            "AD Search",
                          );
                        }}
                      >
                        <p className="mb-1 text-[11px] text-[var(--muted)]">Active Directory search</p>
                        <input
                          value={adQuery}
                          onChange={(e) => setAdQuery(e.target.value)}
                          placeholder="Network ID"
                          className="h-8 w-full rounded-md bg-[var(--addr)] px-2 text-xs outline-none"
                        />
                      </form>
                    ) : (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => onNavigate(sub.url, sub.label)}
                        className="flex w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--btn)]"
                      >
                        {sub.label}
                      </button>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <SideRow
              key={tool.id}
              label={tool.label}
              onClick={() => tool.url && onNavigate(tool.url, tool.label)}
              icon={tool.id === "smartit" ? <Ticket className="size-4" /> : <Wrench className="size-4" />}
            />
          ),
        )}
      </div>
      <h2 className="mt-5 px-1 text-xs font-medium tracking-[0.16em] text-[var(--muted)] uppercase">Desktop apps</h2>
      <p className="mt-1 px-1 text-[11px] text-[var(--muted)]">Windows Help Desk image only.</p>
      <div className="mt-2 flex flex-col gap-1 pb-4">
        {DESKTOP_APPS.map((app) => {
          let hint: string = app.hint;
          if (isElevatedTool(app.id)) {
            const saved = loginForTool(logins, app.id);
            const ex = expiryState(saved);
            if (!saved) hint = "Save an admin account to launch";
            else if (ex.state === "expired") hint = "Password expired — tap to update";
            else if (ex.state === "soon") hint = `As ${saved.username} · expires in ${ex.days}d`;
            else hint = `Launch as ${saved.username}`;
          }
          return (
            <SideRow
              key={app.id}
              label={app.label}
              hint={hint}
              onClick={() => onDesktop(app)}
              icon={
                app.id === "calc" ? (
                  <Calculator className="size-4" />
                ) : app.id === "aduc" ? (
                  <Users className="size-4" />
                ) : app.id === "notepad" ? (
                  <StickyNote className="size-4" />
                ) : (
                  <Monitor className="size-4" />
                )
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function BookmarksPanel({ onNavigate }: { onNavigate: (url: string, title: string) => void }) {
  const bookmarks = useBrowserStore((s) => s.activeProfile().bookmarks);
  const removeBookmark = useBrowserStore((s) => s.removeBookmark);
  const setPrompt = useBrowserStore((s) => s.setBookmarkPromptOpen);
  const folders = Array.from(new Set(bookmarks.map((b) => b.folder ?? "").filter(Boolean)));
  const ungrouped = bookmarks.filter((b) => !(b.folder ?? ""));
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-medium tracking-[0.16em] text-[var(--muted)] uppercase">Favorites</h2>
        <button type="button" className="text-xs text-[var(--accent)]" onClick={() => setPrompt(true)}>
          Add
        </button>
      </div>
      {ungrouped.map((b) => (
        <FavRow key={b.id} bookmark={b} onNavigate={onNavigate} onRemove={() => removeBookmark(b.id)} />
      ))}
      {folders.map((folder) => (
        <div key={folder} className="mt-3">
          <div className="px-1 text-[11px] font-medium text-[var(--muted)]">{folder}</div>
          {bookmarks
            .filter((b) => (b.folder ?? "") === folder)
            .map((b) => (
              <FavRow key={b.id} bookmark={b} onNavigate={onNavigate} onRemove={() => removeBookmark(b.id)} />
            ))}
        </div>
      ))}
      {!bookmarks.length ? <p className="px-1 text-xs text-[var(--muted)]">No favorites yet. Ctrl+D saves this page.</p> : null}
    </div>
  );
}

function FavRow({
  bookmark,
  onNavigate,
  onRemove,
}: {
  bookmark: { id: string; url: string; title: string };
  onNavigate: (url: string, title: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => onNavigate(bookmark.url, bookmark.title)}
        className="flex min-w-0 flex-1 items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-[var(--btn)]"
      >
        <Favicon url={bookmark.url} title={bookmark.title} size="sm" />
        <span className="min-w-0 truncate">{bookmark.title}</span>
      </button>
      <button
        type="button"
        className="hidden size-7 place-items-center rounded-md group-hover:grid hover:bg-[var(--btn)]"
        onClick={onRemove}
        aria-label="Remove"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

function HistoryPanel({ onNavigate }: { onNavigate: (url: string, title: string) => void }) {
  const history = useBrowserStore((s) => s.activeProfile().history);
  const clearHistory = useBrowserStore((s) => s.clearHistory);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-medium tracking-[0.16em] text-[var(--muted)] uppercase">History</h2>
        {history.length ? (
          <button type="button" className="text-xs text-[var(--muted)] hover:text-[var(--fg)]" onClick={clearHistory}>
            Clear
          </button>
        ) : null}
      </div>
      {history.length === 0 ? <p className="px-1 text-xs text-[var(--muted)]">Pages you open are listed here.</p> : null}
      {history.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => onNavigate(h.url, h.title)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--btn)]"
        >
          <Favicon url={h.url} title={h.title} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px]">{h.title}</span>
            <span className="block truncate text-[11px] text-[var(--muted)]">{h.url}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function ProfilePanel() {
  const profiles = useBrowserStore((s) => s.profiles);
  const active = useBrowserStore((s) => s.activeProfileId);
  const switchProfile = useBrowserStore((s) => s.switchProfile);
  const createProfile = useBrowserStore((s) => s.createProfile);
  const openSettings = useBrowserStore((s) => s.openSettings);
  const { user } = useCurrentUserState();
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
      <h2 className="px-1 text-xs font-medium tracking-[0.16em] text-[var(--muted)] uppercase">
        {user ? "SSO profile" : "This desk"}
      </h2>
      <div className="mt-3">
        <SsoCard />
      </div>
      <h3 className="mt-5 px-1 text-xs font-medium tracking-[0.16em] text-[var(--muted)] uppercase">
        {user ? "In this account" : "On this desk"}
      </h3>
      <p className="mt-1 px-1 text-[11px] text-[var(--muted)]">
        Extra profiles stay inside this employee’s vault. They are not a way to become someone else.
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => switchProfile(p.id)}
            className={cn("rounded-lg px-2 py-2 text-left text-[13px] hover:bg-[var(--btn)]", p.id === active && "bg-[var(--btn)]")}
          >
            <span className="block">{p.name}</span>
            <span className="text-[11px] text-[var(--muted)]">
              {p.kind === "work" ? "Work · SSO" : p.kind === "inprivate" ? "InPrivate" : "Local"}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 rounded-lg px-2 py-2 text-left text-[13px] text-[var(--accent)] hover:bg-[var(--btn)]"
        onClick={() => {
          const name = window.prompt("Profile name", "Help Desk");
          if (name) createProfile(name);
        }}
      >
        Add local profile
      </button>
      <button
        type="button"
        className="rounded-lg px-2 py-2 text-left text-[13px] hover:bg-[var(--btn)]"
        onClick={() => openSettings("profiles")}
      >
        Open profile settings
      </button>
    </div>
  );
}

function PageView({ url, title, reloadKey }: { url: string; title: string; reloadKey: number }) {
  if (url === HOME_URL || url === "about:blank") return <WorkspaceHome />;
  if (url === SETTINGS_URL) return <SettingsPage />;
  if (url === KNOWLEDGE_URL) return <KnowledgeAdminPage />;
  if (url === HISTORY_URL) return <HistoryPage />;
  if (url === DOWNLOADS_URL) return <DownloadsPage />;
  if (url === FAVORITES_URL) return <FavoritesPage />;
  if (isSpartanDesktop() && /^https?:/i.test(url)) {
    return <DesktopWebview url={url} title={title} reloadKey={reloadKey} />;
  }
  if (requiresSecureLaunch(url)) return <SecureLaunch url={url} title={title} />;
  return (
    <iframe
      key={`${url}-${reloadKey}`}
      title={title || displayTitle(url)}
      src={url}
      className="h-full w-full border-0 bg-white"
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

function HistoryPage() {
  const history = useBrowserStore((s) => s.activeProfile().history);
  const navigate = useBrowserStore((s) => s.navigate);
  const clearHistory = useBrowserStore((s) => s.clearHistory);
  return (
    <div className="h-full overflow-auto bg-[var(--bg)] px-6 py-8 text-[var(--fg)]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-medium">History</h1>
          {history.length ? (
            <button type="button" className="text-sm text-[var(--muted)] hover:text-[var(--fg)]" onClick={clearHistory}>
              Clear all
            </button>
          ) : null}
        </div>
        {history.length === 0 ? <p className="text-sm text-[var(--muted)]">No visits in this profile yet.</p> : null}
        <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
          {history.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--btn)]"
                onClick={() => navigate(h.url, h.title)}
              >
                <Favicon url={h.url} title={h.title} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{h.title}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">{h.url}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DownloadsPage() {
  const downloads = useBrowserStore((s) => s.downloads);
  return (
    <div className="h-full overflow-auto bg-[var(--bg)] px-6 py-8 text-[var(--fg)]">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-medium">Downloads</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This staff browser does not save files itself. County SSO downloads happen in the system tab you open.
        </p>
        {downloads.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--muted)]">No download history in this profile.</p>
        ) : (
          <ul className="mt-6 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
            {downloads.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <Download className="size-4 text-[var(--muted)]" />
                <span className="flex-1 text-sm">{d.name}</span>
                <span className="text-xs text-[var(--muted)]">{d.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FavoritesPage() {
  const bookmarks = useBrowserStore((s) => s.activeProfile().bookmarks);
  const navigate = useBrowserStore((s) => s.navigate);
  const removeBookmark = useBrowserStore((s) => s.removeBookmark);
  const folders = Array.from(new Set(bookmarks.map((b) => b.folder ?? "")));
  return (
    <div className="h-full overflow-auto bg-[var(--bg)] px-6 py-8 text-[var(--fg)]">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-medium">Favorites</h1>
        {folders.map((folder) => (
          <section key={folder || "top"} className="mt-6">
            <h2 className="mb-2 text-sm font-medium text-[var(--muted)]">{folder || "Ungrouped"}</h2>
            <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
              {bookmarks
                .filter((b) => (b.folder ?? "") === folder)
                .map((b) => (
                  <li key={b.id} className="flex items-center gap-2 px-4 py-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 truncate text-left text-sm hover:underline"
                      onClick={() => navigate(b.url, b.title)}
                    >
                      <Favicon url={b.url} title={b.title} size="sm" />
                      <span className="min-w-0 truncate">{b.title}</span>
                    </button>
                    <button type="button" className="text-xs text-[var(--muted)]" onClick={() => removeBookmark(b.id)}>
                      Remove
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function SideRow({
  label,
  hint,
  onClick,
  icon,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--btn)]">
      <span className="mt-0.5 text-[var(--accent)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13px]">{label}</span>
        {hint ? <span className="block truncate text-[11px] text-[var(--muted)]">{hint}</span> : null}
      </span>
    </button>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg",
        disabled ? "cursor-default text-[var(--muted)] opacity-35" : "hover:bg-[var(--btn)]",
      )}
    >
      {children}
    </button>
  );
}

function GlobeMark() {
  return (
    <span className="grid size-3.5 place-items-center rounded-full border border-[var(--muted)] text-[8px] text-[var(--muted)]">
      i
    </span>
  );
}
