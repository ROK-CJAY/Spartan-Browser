import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  GUEST_OWNER,
  normalizeProfile,
  purgeLegacySharedStore,
  readLocalPayload,
  rememberLastDesk,
  storageName,
} from "./account";
import {
  dropVaultKeyCache,
  hashVaultPin,
  openSecret,
  persistableLogins,
  sealSecret,
} from "./vault-crypto";
import {
  type Bookmark,
  type BrowserConfig,
  type BrowserPayload,
  type ClearOnClose,
  type ClearRange,
  type HistoryItem,
  type PanelId,
  type Profile,
  type QuickAccessItem,
  type SavedLogin,
  type SettingsSection,
  type ThemeSettings,
  defaultBookmarks,
  defaultClearOnClose,
  defaultConfig,
  defaultPayload,
  defaultProfile,
  displayTitle,
  faviconFor,
  HOME_URL,
  newId,
  newTabUrl,
  normalizeTab,
  normalizeUrl,
  rangeCutoff,
  SETTINGS_URL,
} from "./types";

const MAX_HISTORY = 400;

type BrowserStore = BrowserPayload & {
  panel: PanelId;
  kiosk: boolean;
  addressDraft: string;
  hydrated: boolean;
  settingsSection: SettingsSection;
  menuOpen: boolean;
  findOpen: boolean;
  findQuery: string;
  deleteDialogOpen: boolean;
  splitView: boolean;
  closedTabs: Profile["tabs"];
  bookmarkPromptOpen: boolean;
  sessionOwnerId: string | null;
  sessionReady: boolean;
  vaultUnlocked: boolean;
  vaultPin: string | null;
  vaultPinHash: string | null;
  setHydrated: (v: boolean) => void;
  replacePayload: (payload: BrowserPayload) => void;
  adoptOwner: (ownerId: string) => void;
  bindSsoUser: (sso: { id: string; name: string | null; email: string | null }) => void;
  setSessionReady: (v: boolean) => void;
  hydrateVault: () => Promise<void>;
  unlockVault: (pin: string) => Promise<boolean>;
  lockVault: () => void;
  setVaultPin: (pin: string, current?: string) => Promise<boolean>;
  clearVaultPin: (current: string) => Promise<boolean>;
  payload: () => BrowserPayload;
  activeProfile: () => Profile;
  activeTab: () => Profile["tabs"][number];
  setPanel: (panel: PanelId) => void;
  setKiosk: (on: boolean) => void;
  setAddressDraft: (v: string) => void;
  navigate: (raw: string, title?: string) => void;
  goHome: () => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  openSettings: (section?: SettingsSection) => void;
  newTab: (url?: string) => void;
  newPrivateSession: () => void;
  closeTab: (id: string) => void;
  reopenClosedTab: () => void;
  cycleTab: (dir: 1 | -1) => void;
  selectTabAt: (index: number) => void;
  selectTab: (id: string) => void;
  setTabTitle: (title: string) => void;
  addBookmark: (folder?: string) => boolean;
  removeBookmark: (id: string) => void;
  renameBookmark: (id: string, title: string) => void;
  moveBookmark: (id: string, folder: string) => void;
  renameFolder: (from: string, to: string) => void;
  deleteFolder: (folder: string) => void;
  importBookmarks: (items: { title: string; url: string; folder?: string }[]) => number;
  addQuickAccess: (item: QuickAccessItem) => void;
  removeQuickAccess: (id: string) => void;
  moveQuickAccess: (id: string, dir: -1 | 1) => void;
  setQuickAccess: (items: QuickAccessItem[]) => void;
  clearHistory: () => void;
  deleteBrowsingData: (opts: { history: boolean; downloads: boolean; passwords?: boolean; range?: ClearRange }) => void;
  applyClearOnClose: () => void;
  createProfile: (name: string) => void;
  renameProfile: (id: string, name: string) => void;
  removeProfile: (id: string) => void;
  switchProfile: (id: string) => void;
  setTheme: (partial: Partial<ThemeSettings>) => void;
  applyPreset: (theme: ThemeSettings) => void;
  setConfig: (partial: Partial<BrowserConfig>) => void;
  setClearOnClose: (partial: Partial<ClearOnClose>) => void;
  setZoom: (zoom: number) => void;
  setSettingsSection: (s: SettingsSection) => void;
  setMenuOpen: (v: boolean) => void;
  setFindOpen: (v: boolean) => void;
  setFindQuery: (v: string) => void;
  setDeleteDialogOpen: (v: boolean) => void;
  setSplitView: (v: boolean) => void;
  setBookmarkPromptOpen: (v: boolean) => void;
  addLogin: (
    site: string,
    username: string,
    password?: string,
    extra?: { kind?: SavedLogin["kind"]; tool?: SavedLogin["tool"]; expiresAt?: string; notes?: string },
  ) => Promise<void>;
  updateLogin: (
    id: string,
    patch: {
      site?: string;
      username?: string;
      password?: string;
      notes?: string;
      kind?: SavedLogin["kind"];
      tool?: SavedLogin["tool"];
      expiresAt?: string;
    },
  ) => Promise<void>;
  removeLogin: (id: string) => void;
  resetBrowser: () => void;
};

function withActive(profiles: Profile[], activeId: string, fn: (p: Profile) => Profile) {
  return profiles.map((p) => (p.id === activeId ? fn(p) : p));
}

function recordVisit(
  profile: Profile,
  url: string,
  title: string,
  skipHistory: boolean,
  sessionMode: "push" | "replace" | "keep" = "push",
): Profile {
  if (!url || url.startsWith("about:")) return profile;
  const titleText = displayTitle(url, title);
  const tabs = profile.tabs.map((raw) => {
    if (raw.id !== profile.activeTabId) return raw;
    const t = normalizeTab(raw);
    if (sessionMode === "keep") return { ...t, url, title: titleText };
    if (sessionMode === "replace" || t.url === url) {
      const session = t.session.map((e, i) => (i === t.sessionIndex ? { url, title: titleText } : e));
      return { ...t, url, title: titleText, session };
    }
    const session = [...t.session.slice(0, t.sessionIndex + 1), { url, title: titleText }];
    return { ...t, url, title: titleText, session, sessionIndex: session.length - 1 };
  });
  if (skipHistory) return { ...profile, tabs };
  const item: HistoryItem = {
    id: newId(),
    url,
    title: titleText,
    visitedAt: new Date().toISOString(),
  };
  const history = [item, ...profile.history.filter((h) => h.url !== url)].slice(0, MAX_HISTORY);
  return { ...profile, history, tabs };
}

function seedBookmarks(p: Profile): Profile {
  const bookmarks = p.bookmarks ?? [];
  if (bookmarks.length === 0) return { ...p, bookmarks: defaultBookmarks() };
  if (!bookmarks.some((b) => (b.folder ?? "") === "Frequent Sites")) {
    return {
      ...p,
      bookmarks: [...bookmarks, ...defaultBookmarks().filter((b) => b.folder === "Frequent Sites")],
    };
  }
  return p;
}

function bindProfiles(
  profiles: Profile[],
  sso: { id: string; name: string | null; email: string | null },
): Profile[] {
  const label = sso.name?.trim() || sso.email?.trim() || "Work";
  const workAt = profiles.findIndex((p) => p.kind === "work" || p.ssoUserId === sso.id);
  const target = workAt >= 0 ? workAt : profiles.findIndex((p) => p.kind !== "inprivate");
  return profiles.map((p, i) => {
    if (i !== target) return p;
    return {
      ...p,
      kind: "work",
      name: label,
      ssoUserId: sso.id,
      ssoEmail: sso.email ?? undefined,
    };
  });
}

async function sealLoginPassword(
  ownerId: string,
  password: string | undefined,
  pin: string | null,
): Promise<string | undefined> {
  if (!password) return undefined;
  return sealSecret(ownerId, password, pin);
}

async function decryptLogins(ownerId: string, logins: SavedLogin[], pin: string | null): Promise<SavedLogin[]> {
  return Promise.all(
    logins.map(async (l) => {
      if (!l.secret) return { ...l, password: undefined };
      try {
        return { ...l, password: await openSecret(ownerId, l.secret, pin) };
      } catch {
        return { ...l, password: undefined };
      }
    }),
  );
}

async function resealLogins(ownerId: string, logins: SavedLogin[], pin: string | null): Promise<SavedLogin[]> {
  return Promise.all(
    logins.map(async (l) => {
      if (!l.password) return { ...l, secret: l.secret };
      return { ...l, secret: await sealSecret(ownerId, l.password, pin) };
    }),
  );
}

export const useBrowserStore = create<BrowserStore>()(
  persist(
    (set, get) => ({
      ...defaultPayload(),
      panel: null,
      kiosk: false,
      addressDraft: HOME_URL,
      hydrated: false,
      settingsSection: "profiles",
      menuOpen: false,
      findOpen: false,
      findQuery: "",
      deleteDialogOpen: false,
      splitView: false,
      closedTabs: [],
      bookmarkPromptOpen: false,
      sessionOwnerId: null,
      sessionReady: false,
      vaultUnlocked: true,
      vaultPin: null,
      vaultPinHash: null,
      setHydrated: (v) => set({ hydrated: v }),
      payload: () => {
        const s = get();
        return {
          profiles: s.profiles,
          activeProfileId: s.activeProfileId,
          theme: s.theme,
          config: s.config,
          logins: persistableLogins(s.logins, s.config.syncPasswords),
          downloads: s.downloads,
          vaultPinHash: s.vaultPinHash,
        };
      },
      replacePayload: (payload) =>
        set({
          profiles: payload.profiles.map((p) => seedBookmarks(normalizeProfile(p))),
          activeProfileId: payload.activeProfileId,
          theme: payload.theme,
          config: {
            ...defaultConfig(),
            ...payload.config,
            clearOnClose: { ...defaultClearOnClose(), ...payload.config?.clearOnClose },
          },
          logins: persistableLogins(payload.logins ?? []),
          downloads: payload.downloads ?? [],
          vaultPinHash: payload.vaultPinHash ?? null,
          vaultUnlocked: !payload.vaultPinHash,
          vaultPin: null,
        }),
      adoptOwner: (ownerId) => {
        purgeLegacySharedStore();
        dropVaultKeyCache();
        useBrowserStore.persist.setOptions({ name: storageName(ownerId) });
        let fresh = readLocalPayload(ownerId);
        if (!fresh) {
          if (ownerId === GUEST_OWNER) {
            const profile = defaultProfile("Help Desk");
            fresh = { ...defaultPayload(), profiles: [profile], activeProfileId: profile.id };
          } else {
            fresh = defaultPayload();
          }
        }
        if (ownerId === GUEST_OWNER) {
          if (fresh.profiles.some((p) => p.ssoUserId || p.kind === "work")) {
            const profile = defaultProfile("Help Desk");
            fresh = { ...defaultPayload(), profiles: [profile], activeProfileId: profile.id, logins: [], vaultPinHash: null };
          } else {
            fresh = {
              ...fresh,
              profiles: fresh.profiles.map((p) =>
                ["Work", "Desk", "Guest desk", "Guest"].includes(p.name) && !p.ssoUserId
                  ? { ...p, name: "Help Desk", kind: p.kind === "work" ? "local" : p.kind }
                  : p,
              ),
            };
          }
        }
        const active = fresh.profiles.find((p) => p.id === fresh.activeProfileId) ?? fresh.profiles[0];
        const tab = active?.tabs.find((t) => t.id === active.activeTabId) ?? active?.tabs[0];
        set({
          profiles: fresh.profiles.map((p) => seedBookmarks(normalizeProfile(p))),
          activeProfileId: fresh.activeProfileId,
          theme: fresh.theme,
          config: {
            ...defaultConfig(),
            ...fresh.config,
            clearOnClose: { ...defaultClearOnClose(), ...fresh.config?.clearOnClose },
          },
          logins: persistableLogins(fresh.logins ?? []),
          downloads: fresh.downloads ?? [],
          vaultPinHash: fresh.vaultPinHash ?? null,
          vaultUnlocked: !(fresh.vaultPinHash ?? null),
          vaultPin: null,
          sessionOwnerId: ownerId,
          sessionReady: false,
          hydrated: true,
          closedTabs: [],
          bookmarkPromptOpen: false,
          menuOpen: false,
          addressDraft: tab?.url ?? HOME_URL,
          panel: null,
        });
      },
      bindSsoUser: (sso) => {
        set((s) => {
          const profiles = bindProfiles(s.profiles, sso);
          const logins =
            s.logins.length || !sso.email
              ? s.logins
              : [
                  { id: newId(), site: "myit.miamidade.gov", username: sso.email, updatedAt: new Date().toISOString() },
                  { id: newId(), site: "cloud.miamidade.gov", username: sso.email, updatedAt: new Date().toISOString() },
                ];
          return { profiles, logins };
        });
        rememberLastDesk(sso.name?.trim() || sso.email?.trim() || "Staff");
      },
      setSessionReady: (v) => set({ sessionReady: v }),
      hydrateVault: async () => {
        const s = get();
        const owner = s.sessionOwnerId ?? GUEST_OWNER;
        if (s.vaultPinHash) {
          set({
            vaultUnlocked: false,
            vaultPin: null,
            logins: persistableLogins(s.logins),
          });
          return;
        }
        const logins = await decryptLogins(owner, s.logins, null);
        if ((get().sessionOwnerId ?? GUEST_OWNER) !== owner) return;
        set({ logins, vaultUnlocked: true, vaultPin: null });
      },
      unlockVault: async (pin) => {
        const s = get();
        const owner = s.sessionOwnerId ?? GUEST_OWNER;
        if (!s.vaultPinHash) {
          const logins = await decryptLogins(owner, s.logins, null);
          if ((get().sessionOwnerId ?? GUEST_OWNER) !== owner) return false;
          set({ logins, vaultUnlocked: true, vaultPin: null });
          return true;
        }
        const hash = await hashVaultPin(owner, pin);
        if (hash !== s.vaultPinHash) return false;
        const logins = await decryptLogins(owner, s.logins, pin);
        if ((get().sessionOwnerId ?? GUEST_OWNER) !== owner) return false;
        set({ logins, vaultUnlocked: true, vaultPin: pin });
        return true;
      },
      lockVault: () => {
        set((s) => ({
          vaultUnlocked: false,
          vaultPin: null,
          logins: persistableLogins(s.logins),
        }));
      },
      setVaultPin: async (pin, current) => {
        const trimmed = pin.trim();
        if (trimmed.length < 4) return false;
        const s = get();
        const owner = s.sessionOwnerId ?? GUEST_OWNER;
        if (s.vaultPinHash) {
          if (!current) return false;
          const ok = await hashVaultPin(owner, current);
          if (ok !== s.vaultPinHash) return false;
        }
        if (!s.vaultUnlocked && s.vaultPinHash) return false;
        const sealed = await resealLogins(owner, s.logins, trimmed);
        const vaultPinHash = await hashVaultPin(owner, trimmed);
        if ((get().sessionOwnerId ?? GUEST_OWNER) !== owner) return false;
        dropVaultKeyCache();
        set({ logins: sealed, vaultPinHash, vaultPin: trimmed, vaultUnlocked: true });
        return true;
      },
      clearVaultPin: async (current) => {
        const s = get();
        const owner = s.sessionOwnerId ?? GUEST_OWNER;
        if (!s.vaultPinHash) return true;
        const ok = await hashVaultPin(owner, current);
        if (ok !== s.vaultPinHash) return false;
        const sealed = await resealLogins(owner, s.logins, null);
        if ((get().sessionOwnerId ?? GUEST_OWNER) !== owner) return false;
        dropVaultKeyCache();
        set({ logins: sealed, vaultPinHash: null, vaultPin: null, vaultUnlocked: true });
        return true;
      },
      activeProfile: () => {
        const s = get();
        return s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0];
      },
      activeTab: () => {
        const p = get().activeProfile();
        return p.tabs.find((t) => t.id === p.activeTabId) ?? p.tabs[0];
      },
      setPanel: (panel) => set({ panel }),
      setKiosk: (on) => set({ kiosk: on }),
      setAddressDraft: (v) => set({ addressDraft: v }),
      navigate: (raw, title) => {
        const url = normalizeUrl(raw, get().config.searchEngine);
        const s = get();
        set({
          addressDraft: url,
          menuOpen: false,
          profiles: withActive(s.profiles, s.activeProfileId, (p) =>
            recordVisit(p, url, title ?? "", s.config.privateMode),
          ),
        });
      },
      goHome: () => get().navigate(get().theme.startPage || HOME_URL, "Workspace"),
      canGoBack: () => {
        const t = normalizeTab(get().activeTab());
        return (t.sessionIndex ?? 0) > 0;
      },
      canGoForward: () => {
        const t = normalizeTab(get().activeTab());
        return (t.sessionIndex ?? 0) < (t.session?.length ?? 1) - 1;
      },
      goBack: () => {
        const s = get();
        const current = normalizeTab(s.activeTab());
        const index = current.sessionIndex ?? 0;
        const session = current.session ?? [];
        if (index <= 0) return;
        const sessionIndex = index - 1;
        const page = session[sessionIndex];
        if (!page) return;
        set({
          addressDraft: page.url,
          menuOpen: false,
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            tabs: p.tabs.map((raw) =>
              raw.id === p.activeTabId ? { ...normalizeTab(raw), url: page.url, title: page.title, sessionIndex } : raw,
            ),
          })),
        });
      },
      goForward: () => {
        const s = get();
        const current = normalizeTab(s.activeTab());
        const index = current.sessionIndex ?? 0;
        const session = current.session ?? [];
        if (index >= session.length - 1) return;
        const sessionIndex = index + 1;
        const page = session[sessionIndex];
        if (!page) return;
        set({
          addressDraft: page.url,
          menuOpen: false,
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            tabs: p.tabs.map((raw) =>
              raw.id === p.activeTabId ? { ...normalizeTab(raw), url: page.url, title: page.title, sessionIndex } : raw,
            ),
          })),
        });
      },
      openSettings: (section = "profiles") => {
        set({ settingsSection: section, menuOpen: false });
        const p = get().activeProfile();
        const existing = p.tabs.find((t) => normalizeTab(t).url === SETTINGS_URL);
        if (existing) {
          if (p.activeTabId !== existing.id) get().selectTab(existing.id);
          return;
        }
        get().newTab(SETTINGS_URL);
      },
      newTab: (url) => {
        const s = get();
        const dest = url ?? newTabUrl(s.config, s.theme.startPage);
        const title = displayTitle(dest);
        const tab = normalizeTab({
          id: newId(),
          url: dest,
          title,
          session: [{ url: dest, title }],
          sessionIndex: 0,
        });
        set({
          addressDraft: dest,
          menuOpen: false,
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            tabs: [...p.tabs, tab],
            activeTabId: tab.id,
          })),
        });
      },
      newPrivateSession: () => {
        get().createProfile("InPrivate");
        get().setConfig({ privateMode: true });
      },
      closeTab: (id) => {
        const s = get();
        const closing = s.activeProfile().tabs.find((t) => t.id === id);
        set({
          closedTabs: closing ? [...s.closedTabs, closing].slice(-25) : s.closedTabs,
          profiles: withActive(s.profiles, s.activeProfileId, (p) => {
            if (p.tabs.length <= 1) return p;
            const tabs = p.tabs.filter((t) => t.id !== id);
            const activeTabId = p.activeTabId === id ? tabs[tabs.length - 1].id : p.activeTabId;
            return { ...p, tabs, activeTabId };
          }),
        });
        const tab = get().activeTab();
        set({ addressDraft: tab.url });
      },
      reopenClosedTab: () => {
        const s = get();
        if (!s.closedTabs.length) return;
        const last = s.closedTabs[s.closedTabs.length - 1];
        const tab = normalizeTab({ ...last, id: newId() });
        set({
          closedTabs: s.closedTabs.slice(0, -1),
          addressDraft: tab.url,
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            tabs: [...p.tabs, tab],
            activeTabId: tab.id,
          })),
        });
      },
      cycleTab: (dir) => {
        const p = get().activeProfile();
        const i = p.tabs.findIndex((t) => t.id === p.activeTabId);
        const next = p.tabs[(i + dir + p.tabs.length) % p.tabs.length];
        if (next) get().selectTab(next.id);
      },
      selectTabAt: (index) => {
        const p = get().activeProfile();
        const tab = p.tabs[index];
        if (tab) get().selectTab(tab.id);
      },
      selectTab: (id) => {
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            activeTabId: id,
          })),
        });
        const tab = get().activeTab();
        set({ addressDraft: tab.url });
      },
      setTabTitle: (title) => {
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            tabs: p.tabs.map((t) => (t.id === p.activeTabId ? { ...t, title } : t)),
          })),
        });
      },
      addBookmark: (folder = "") => {
        const s = get();
        const tab = s.activeTab();
        const exists = s.activeProfile().bookmarks.some((b) => b.url === tab.url);
        if (exists) return false;
        const bm: Bookmark = {
          id: newId(),
          url: tab.url,
          title: tab.title,
          folder,
          favicon: faviconFor(tab.url),
          addedAt: new Date().toISOString(),
        };
        set({
          bookmarkPromptOpen: false,
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            bookmarks: [...p.bookmarks, bm],
          })),
        });
        return true;
      },
      removeBookmark: (id) => {
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            bookmarks: p.bookmarks.filter((b) => b.id !== id),
          })),
        });
      },
      renameBookmark: (id, title) => {
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            bookmarks: p.bookmarks.map((b) => (b.id === id ? { ...b, title } : b)),
          })),
        });
      },
      moveBookmark: (id, folder) => {
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            bookmarks: p.bookmarks.map((b) => (b.id === id ? { ...b, folder } : b)),
          })),
        });
      },
      renameFolder: (from, to) => {
        const name = to.trim();
        if (!from || !name || from === name) return;
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            bookmarks: p.bookmarks.map((b) => ((b.folder ?? "") === from ? { ...b, folder: name } : b)),
          })),
        });
      },
      deleteFolder: (folder) => {
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            bookmarks: p.bookmarks.filter((b) => (b.folder ?? "") !== folder),
          })),
        });
      },
      importBookmarks: (items) => {
        const s = get();
        const existing = new Set(s.activeProfile().bookmarks.map((b) => b.url));
        const incoming: Bookmark[] = [];
        for (const item of items) {
          const url = normalizeUrl(item.url);
          if (!url || existing.has(url)) continue;
          existing.add(url);
          incoming.push({
            id: newId(),
            url,
            title: item.title || displayTitle(url),
            folder: item.folder ?? "",
            favicon: faviconFor(url),
            addedAt: new Date().toISOString(),
          });
        }
        if (incoming.length) {
          set({
            profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
              ...p,
              bookmarks: [...p.bookmarks, ...incoming],
            })),
          });
        }
        return incoming.length;
      },
      addQuickAccess: (item) => {
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => {
            const list = p.quickAccess ?? [];
            if (list.length >= 12) return p;
            if (list.some((row) => row.id === item.id || row.url === item.url)) return p;
            return { ...p, quickAccess: [...list, item] };
          }),
        });
      },
      removeQuickAccess: (id) => {
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            quickAccess: (p.quickAccess ?? []).filter((row) => row.id !== id),
          })),
        });
      },
      moveQuickAccess: (id, dir) => {
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => {
            const list = [...(p.quickAccess ?? [])];
            const i = list.findIndex((row) => row.id === id);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= list.length) return p;
            const [row] = list.splice(i, 1);
            list.splice(j, 0, row);
            return { ...p, quickAccess: list };
          }),
        });
      },
      setQuickAccess: (items) => {
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            quickAccess: items.slice(0, 12),
          })),
        });
      },
      clearHistory: () => {
        const s = get();
        set({
          profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
            ...p,
            history: [],
          })),
        });
      },
      deleteBrowsingData: ({ history, downloads, passwords, range = "all" }) => {
        const cut = rangeCutoff(range);
        if (history) {
          if (range === "all") get().clearHistory();
          else {
            const s = get();
            set({
              profiles: withActive(s.profiles, s.activeProfileId, (p) => ({
                ...p,
                history: p.history.filter((h) => new Date(h.visitedAt).getTime() < cut),
              })),
            });
          }
        }
        if (downloads) {
          if (range === "all") set({ downloads: [] });
          else {
            set((s) => ({
              downloads: s.downloads.filter((d) => new Date(d.at).getTime() < cut),
            }));
          }
        }
        if (passwords) set({ logins: [] });
      },
      applyClearOnClose: () => {
        const c = get().config.clearOnClose;
        if (c.history) get().clearHistory();
        if (c.downloads) set({ downloads: [] });
        if (c.passwords) set({ logins: [] });
      },
      createProfile: (name) => {
        const profile = defaultProfile(name.trim() || "Profile");
        set((s) => ({
          profiles: [...s.profiles, profile],
          activeProfileId: profile.id,
          addressDraft: profile.tabs[0].url,
          menuOpen: false,
        }));
      },
      renameProfile: (id, name) => {
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, name } : p)),
        }));
      },
      removeProfile: (id) => {
        const s = get();
        if (s.profiles.length <= 1) return;
        const profiles = s.profiles.filter((p) => p.id !== id);
        const activeProfileId = s.activeProfileId === id ? profiles[0].id : s.activeProfileId;
        set({ profiles, activeProfileId });
      },
      switchProfile: (id) => {
        const s = get();
        const next = s.profiles.find((p) => p.id === id);
        if (!next) return;
        const tab = next.tabs.find((t) => t.id === next.activeTabId) ?? next.tabs[0];
        set({ activeProfileId: id, addressDraft: tab.url, menuOpen: false });
      },
      setTheme: (partial) => set((s) => ({ theme: { ...s.theme, ...partial } })),
      applyPreset: (theme) => set({ theme: { ...theme } }),
      setConfig: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),
      setClearOnClose: (partial) =>
        set((s) => ({ config: { ...s.config, clearOnClose: { ...s.config.clearOnClose, ...partial } } })),
      setZoom: (zoom) => set((s) => ({ config: { ...s.config, zoom: Math.min(200, Math.max(50, zoom)) } })),
      setSettingsSection: (s) => set({ settingsSection: s }),
      setMenuOpen: (v) => set({ menuOpen: v }),
      setFindOpen: (v) => set({ findOpen: v }),
      setFindQuery: (v) => set({ findQuery: v }),
      setDeleteDialogOpen: (v) => set({ deleteDialogOpen: v, menuOpen: false }),
      setSplitView: (v) => set({ splitView: v, menuOpen: false }),
      setBookmarkPromptOpen: (v) => set({ bookmarkPromptOpen: v, menuOpen: false }),
      addLogin: async (site, username, password, extra) => {
        const st = get();
        if (!st.vaultUnlocked && password) return;
        const owner = st.sessionOwnerId ?? GUEST_OWNER;
        const secret = await sealLoginPassword(owner, password, st.vaultPin);
        if ((get().sessionOwnerId ?? GUEST_OWNER) !== owner) return;
        const row: SavedLogin = {
          id: newId(),
          site: site.trim(),
          username: username.trim(),
          password: password || undefined,
          secret,
          updatedAt: new Date().toISOString(),
          kind: extra?.kind,
          tool: extra?.tool,
          expiresAt: extra?.expiresAt,
          notes: extra?.notes,
        };
        set((s) => ({ logins: [...s.logins, row] }));
      },
      updateLogin: async (id, patch) => {
        const st = get();
        if (!st.vaultUnlocked) return;
        const owner = st.sessionOwnerId ?? GUEST_OWNER;
        const current = st.logins.find((l) => l.id === id);
        if (!current) return;
        const nextPassword = patch.password !== undefined ? patch.password : current.password;
        const secret =
          patch.password !== undefined ? await sealLoginPassword(owner, patch.password, st.vaultPin) : current.secret;
        if ((get().sessionOwnerId ?? GUEST_OWNER) !== owner) return;
        set((s) => ({
          logins: s.logins.map((l) =>
            l.id === id
              ? {
                  ...l,
                  site: patch.site?.trim() ?? l.site,
                  username: patch.username?.trim() ?? l.username,
                  notes: patch.notes !== undefined ? patch.notes : l.notes,
                  kind: patch.kind ?? l.kind,
                  tool: patch.tool ?? l.tool,
                  expiresAt: patch.expiresAt !== undefined ? patch.expiresAt : l.expiresAt,
                  password: nextPassword || undefined,
                  secret,
                  updatedAt: new Date().toISOString(),
                }
              : l,
          ),
        }));
      },
      removeLogin: (id) => set((s) => ({ logins: s.logins.filter((l) => l.id !== id) })),
      resetBrowser: () => {
        const keep = get().profiles;
        const fresh = defaultPayload();
        set({
          theme: fresh.theme,
          config: fresh.config,
          logins: fresh.logins,
          downloads: [],
          profiles: keep,
        });
      },
    }),
    {
      name: storageName(GUEST_OWNER),
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        profiles: s.profiles,
        activeProfileId: s.activeProfileId,
        theme: s.theme,
        config: s.config,
        logins: persistableLogins(s.logins),
        downloads: s.downloads,
        vaultPinHash: s.vaultPinHash,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.setHydrated(true);
      },
    },
  ),
);
