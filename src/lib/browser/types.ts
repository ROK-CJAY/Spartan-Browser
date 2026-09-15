export type Bookmark = {
  id: string;
  title: string;
  url: string;
  addedAt: string;
  folder: string;
  favicon?: string;
};

export type QuickAccessSource = "system" | "tool" | "bookmark";

export type QuickAccessItem = {
  id: string;
  label: string;
  url: string;
  source: QuickAccessSource;
};

export type HistoryItem = {
  id: string;
  title: string;
  url: string;
  visitedAt: string;
};

export type TabEntry = {
  url: string;
  title: string;
};

export type Tab = {
  id: string;
  url: string;
  title: string;
  session?: TabEntry[];
  sessionIndex?: number;
};

export type TabSession = Tab & { session: TabEntry[]; sessionIndex: number };

export function normalizeTab(t: Tab): TabSession {
  const session = t.session?.length ? t.session : [{ url: t.url, title: t.title }];
  const sessionIndex = Math.min(Math.max(0, t.sessionIndex ?? session.length - 1), session.length - 1);
  const page = session[sessionIndex] ?? session[0];
  return {
    ...t,
    url: page?.url ?? t.url,
    title: page?.title ?? t.title,
    session,
    sessionIndex,
  };
}

export type ProfileKind = "work" | "local" | "inprivate";

export type Profile = {
  id: string;
  name: string;
  bookmarks: Bookmark[];
  history: HistoryItem[];
  tabs: Tab[];
  activeTabId: string;
  kind: ProfileKind;
  ssoUserId?: string;
  ssoEmail?: string;
  quickAccess: QuickAccessItem[];
};

export type ThemeSettings = {
  fontFamily: string;
  fontSize: number;
  colorApp: string;
  colorRail: string;
  colorPanel: string;
  colorTop: string;
  colorAccent: string;
  colorText: string;
  colorMuted: string;
  colorButton: string;
  colorAddress: string;
  railWidth: number;
  panelWidth: number;
  topHeight: number;
  showPanel: boolean;
  startPage: string;
};

export type ScriptLaunchMode = "inline" | "file";
export type TrackingLevel = "basic" | "balanced" | "strict";
export type CookieMode = "allow" | "block-third" | "block-all";
export type SearchEngine = "county" | "bing" | "google";
export type StartupBehavior = "restore" | "ntp" | "specific";
export type ColorMode = "dark" | "light" | "county" | "grey" | "system";
export type ClearRange = "hour" | "day" | "week" | "month" | "all";

export type ClearOnClose = {
  history: boolean;
  downloads: boolean;
  cookies: boolean;
  cache: boolean;
  passwords: boolean;
  autofill: boolean;
};

export type BrowserExtension = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export type BrowserConfig = {
  zoom: number;
  privateMode: boolean;
  doNotTrack: boolean;
  blockPopups: boolean;
  sendDiagnostics: boolean;
  hardwareAccel: boolean;
  showHomeButton: boolean;
  newTabPage: "workspace" | "blank" | "custom";
  customNewTab: string;
  language: string;
  spellcheck: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  savePasswords: boolean;
  autofill: boolean;
  syncEnabled: boolean;
  downloadAsk: boolean;
  aiAssist: boolean;
  searchSuggestions: boolean;
  httpsOnly: boolean;
  trackingPrevention: TrackingLevel;
  cookieMode: CookieMode;
  searchEngine: SearchEngine;
  startupBehavior: StartupBehavior;
  colorMode: ColorMode;
  showFavoritesBar: boolean;
  verticalTabs: boolean;
  sleepInactiveTabs: boolean;
  efficiencyMode: boolean;
  syncFavorites: boolean;
  syncHistory: boolean;
  syncSettings: boolean;
  syncPasswords: boolean;
  offerTranslate: boolean;
  typoProtection: boolean;
  prefetchDns: boolean;
  allowCookies: boolean;
  safeBrowsing: boolean;
  firewallEnabled: boolean;
  smartscreen: boolean;
  allowInsecure: boolean;
  siteIsolation: boolean;
  personalizeAds: boolean;
  useLocation: boolean;
  shareUsageData: boolean;
  accentColor: string;
  passwordHelper: boolean;
  adminPasswordDays: number;
  scriptLaunchMode: ScriptLaunchMode;
  scriptFolder: string;
  entraUpn: string;
  windowsAccount: string;
  clearOnClose: ClearOnClose;
};

export type ElevatedToolId = "aduc" | "cmrc";

export type SavedLogin = {
  id: string;
  site: string;
  username: string;
  /** Session memory only — never written to disk or the roaming payload. */
  password?: string;
  /** AES-GCM ciphertext (`iv.cipher`). */
  secret?: string;
  notes?: string;
  updatedAt?: string;
  kind?: "web" | "elevated";
  tool?: ElevatedToolId;
  expiresAt?: string;
};

export type DownloadItem = {
  id: string;
  name: string;
  source: string;
  at: string;
  status: "complete" | "blocked";
};

export type SettingsSection =
  | "profiles"
  | "passwords"
  | "privacy"
  | "assistant"
  | "appearance"
  | "default"
  | "startup"
  | "languages"
  | "downloads"
  | "accessibility"
  | "system"
  | "reset"
  | "extensions"
  | "about";

export type PanelId =
  | "tools"
  | "bookmarks"
  | "history"
  | "profile"
  | "settings"
  | null;

export type BrowserPayload = {
  profiles: Profile[];
  activeProfileId: string;
  theme: ThemeSettings;
  config: BrowserConfig;
  logins: SavedLogin[];
  downloads: DownloadItem[];
  vaultPinHash?: string | null;
};

export const HOME_URL = "mdc://workspace";
export const SETTINGS_URL = "mdc://settings";
export const DOWNLOADS_URL = "mdc://downloads";
export const HISTORY_URL = "mdc://history";
export const FAVORITES_URL = "mdc://favorites";
export const KNOWLEDGE_URL = "mdc://knowledge";
export const SERVICE_DESK_URL = "https://miamidadecounty.sharepoint.com/sites/ITServiceDesk";

export const PINNED = [
  { id: "myit", label: "MyIT", url: "https://myit.miamidade.gov" },
  { id: "smartit", label: "SmartIT", url: "https://smartit.miamidade.gov" },
  { id: "nsd", label: "NSD", url: "https://nsd.miamidade.gov" },
  { id: "cloud", label: "Cloud", url: "https://cloud.miamidade.gov" },
  { id: "county", label: "County", url: "https://www.miamidade.gov" },
] as const;

export type ItdTool = {
  id: string;
  label: string;
  url?: string;
  submenu?: { id: string; label: string; url: string }[];
};

export const ITD_TOOLS: ItdTool[] = [
  { id: "informs", label: "INFORMS", url: "https://informs.miamidade.gov" },
  {
    id: "query",
    label: "Query Viewer",
    url: "https://ehrprd.miamidade.gov/psc/EHR92PRD_2/EMPLOYEE/HRMS/q/?ICAction=ICQryNameURL=PUBLIC.MD_HELPDESK_ID_SEARCH",
  },
  { id: "citrix", label: "Citrix", url: "https://xenapp.cloud.com/monitor?customerId=MiamiDadeCou" },
  {
    id: "nsd",
    label: "NSD",
    submenu: [
      { id: "ad-search", label: "Active Directory Search", url: "https://nsd.miamidade.gov/active-directory/user/" },
      { id: "calendars", label: "Calendars", url: "https://nsd.miamidade.gov/calendar/calendar-main" },
      { id: "net-tools", label: "Network Tools", url: "https://nsd.miamidade.gov/apps/app-list/net" },
    ],
  },
  {
    id: "epar",
    label: "EPAR",
    url: "https://hrprd.miamidade.gov/psp/HRPRD/EMPLOYEE/HRMS/c/MAINTAIN_SECURITY.USERMAINT.GBL",
  },
  { id: "smartit", label: "Smart IT", url: "https://miamidade-smartit.us.onbmc.com/smartit/app/#/create/smart-recorder" },
  { id: "azure", label: "Entra ID", url: "https://entra.microsoft.com/#home" },
  {
    id: "eams",
    label: "EAMS",
    submenu: [
      { id: "dtpw", label: "DTPW (Transit)", url: "https://prdentext.miamidade.gov:7443/web/base/logindisp?tenant=MDTPROD" },
      { id: "pros", label: "PROS (Parks)", url: "https://prdentext.miamidade.gov:7443/web/base/logindisp?tenant=PRKPROD" },
    ],
  },
  { id: "citrix-mgr", label: "Citrix Manager", url: "https://xenapp.cloud.com/manage/webstudio/home" },
];

export const DESKTOP_APPS = [
  { id: "notepad", label: "Notepad", hint: "Windows image only" },
  { id: "calc", label: "Calculator", hint: "Windows image only" },
  { id: "aduc", label: "Active Directory", hint: "Launch as a saved admin account" },
  { id: "mainframe", label: "Mainframe (TN3270)", hint: "Mocha Soft on the desk image" },
  { id: "lockout", label: "Lockout Status", hint: "Resource Kit tool on the desk image" },
  { id: "teamviewer", label: "TeamViewer", hint: "Installed on the desk image" },
  { id: "cmrc", label: "CmRC Viewer", hint: "Launch as a saved admin account" },
] as const;

export const ELEVATED_TOOLS: Record<
  ElevatedToolId,
  { id: ElevatedToolId; label: string; site: string; fileName: string }
> = {
  aduc: {
    id: "aduc",
    label: "Active Directory",
    site: "mdc-tool://aduc",
    fileName: "Launch-ADUC.ps1",
  },
  cmrc: {
    id: "cmrc",
    label: "CmRC Viewer",
    site: "mdc-tool://cmrc",
    fileName: "Launch-CMRC.ps1",
  },
};

export function isElevatedTool(id: string): id is ElevatedToolId {
  return id === "aduc" || id === "cmrc";
}

export const ACCENT_SWATCHES = [
  { id: "county", label: "County teal", value: "#1a8fb8" },
  { id: "blue", label: "Blue", value: "#3b82f6" },
  { id: "teal", label: "Teal", value: "#14b8a6" },
  { id: "green", label: "Green", value: "#10b981" },
  { id: "navy", label: "Navy", value: "#0b6e99" },
  { id: "slate", label: "Slate", value: "#64748b" },
  { id: "red", label: "Red", value: "#ef4444" },
  { id: "orange", label: "Orange", value: "#f97316" },
] as const;

export const THEME_PRESETS: Record<string, ThemeSettings> = {
  opera: {
    fontFamily: "IBM Plex Sans",
    fontSize: 14,
    colorApp: "#0b0d10",
    colorRail: "#101318",
    colorPanel: "#161b22",
    colorTop: "#12161c",
    colorAccent: "#1a8fb8",
    colorText: "#e8eef2",
    colorMuted: "#8b96a3",
    colorButton: "#1c222b",
    colorAddress: "#1a2028",
    railWidth: 64,
    panelWidth: 280,
    topHeight: 52,
    showPanel: true,
    startPage: HOME_URL,
  },
  county: {
    fontFamily: "IBM Plex Sans",
    fontSize: 14,
    colorApp: "#0c2438",
    colorRail: "#091c2c",
    colorPanel: "#12344c",
    colorTop: "#0e2a40",
    colorAccent: "#2aa3c9",
    colorText: "#f0f6fa",
    colorMuted: "#9bb3c4",
    colorButton: "#15405c",
    colorAddress: "#173a54",
    railWidth: 64,
    panelWidth: 280,
    topHeight: 52,
    showPanel: true,
    startPage: HOME_URL,
  },
  grey: {
    fontFamily: "IBM Plex Sans",
    fontSize: 14,
    colorApp: "#161616",
    colorRail: "#111111",
    colorPanel: "#1f1f1f",
    colorTop: "#1a1a1a",
    colorAccent: "#9aa3ad",
    colorText: "#ececec",
    colorMuted: "#8a8a8a",
    colorButton: "#2a2a2a",
    colorAddress: "#222222",
    railWidth: 64,
    panelWidth: 280,
    topHeight: 52,
    showPanel: true,
    startPage: HOME_URL,
  },
  light: {
    fontFamily: "IBM Plex Sans",
    fontSize: 14,
    colorApp: "#eef2f5",
    colorRail: "#dfe6ec",
    colorPanel: "#ffffff",
    colorTop: "#ffffff",
    colorAccent: "#0b6e99",
    colorText: "#12202b",
    colorMuted: "#5b6b78",
    colorButton: "#e5ecef",
    colorAddress: "#f7f9fb",
    railWidth: 64,
    panelWidth: 280,
    topHeight: 52,
    showPanel: true,
    startPage: HOME_URL,
  },
};

export function defaultClearOnClose(): ClearOnClose {
  return {
    history: false,
    downloads: false,
    cookies: false,
    cache: false,
    passwords: false,
    autofill: false,
  };
}

export function defaultConfig(): BrowserConfig {
  return {
    zoom: 100,
    privateMode: false,
    doNotTrack: true,
    blockPopups: true,
    sendDiagnostics: false,
    hardwareAccel: true,
    showHomeButton: true,
    newTabPage: "workspace",
    customNewTab: HOME_URL,
    language: "en-US",
    spellcheck: true,
    highContrast: false,
    reduceMotion: false,
    savePasswords: true,
    autofill: true,
    syncEnabled: true,
    downloadAsk: true,
    aiAssist: false,
    searchSuggestions: true,
    httpsOnly: true,
    trackingPrevention: "balanced",
    cookieMode: "block-third",
    searchEngine: "county",
    startupBehavior: "ntp",
    colorMode: "dark",
    showFavoritesBar: true,
    verticalTabs: false,
    sleepInactiveTabs: true,
    efficiencyMode: true,
    syncFavorites: true,
    syncHistory: true,
    syncSettings: true,
    syncPasswords: true,
    offerTranslate: true,
    typoProtection: true,
    prefetchDns: true,
    allowCookies: true,
    safeBrowsing: true,
    firewallEnabled: true,
    smartscreen: true,
    allowInsecure: false,
    siteIsolation: true,
    personalizeAds: false,
    useLocation: false,
    shareUsageData: false,
    accentColor: "#1a8fb8",
    passwordHelper: true,
    adminPasswordDays: 90,
    scriptLaunchMode: "inline",
    scriptFolder: "%LOCALAPPDATA%\\MDCHelpDesk\\Scripts",
    entraUpn: "",
    windowsAccount: "",
    clearOnClose: defaultClearOnClose(),
  };
}

export function newId() {
  return crypto.randomUUID();
}

export function faviconFor(url: string) {
  if (!url || url.startsWith("mdc://") || url.startsWith("mdc-tool://") || url.startsWith("about:")) {
    return "";
  }
  const host = hostOf(url);
  if (!host) return "";
  return `/api/favicon?host=${encodeURIComponent(host)}`;
}

export function flattenItdTools(): { id: string; label: string; url: string }[] {
  const out: { id: string; label: string; url: string }[] = [];
  for (const tool of ITD_TOOLS) {
    if (tool.url) out.push({ id: tool.id, label: tool.label, url: tool.url });
    for (const sub of tool.submenu ?? []) {
      out.push({ id: sub.id, label: `${tool.label} · ${sub.label}`, url: sub.url });
    }
  }
  return out;
}

export function defaultQuickAccess(): QuickAccessItem[] {
  return [
    { id: "pin:myit", label: "MyIT", url: "https://myit.miamidade.gov", source: "system" },
    { id: "pin:smartit", label: "SmartIT", url: "https://smartit.miamidade.gov", source: "system" },
    { id: "pin:cloud", label: "Cloud", url: "https://cloud.miamidade.gov", source: "system" },
    { id: "bm:outlook", label: "Outlook", url: "https://outlook.office.com", source: "bookmark" },
    { id: "tool:citrix-signin", label: "Citrix", url: "https://xenapp.cloud.com", source: "tool" },
  ];
}

export function quickAccessCatalog(bookmarks: Bookmark[]): QuickAccessItem[] {
  const items: QuickAccessItem[] = [
    ...PINNED.map((pin) => ({
      id: `pin:${pin.id}`,
      label: pin.label,
      url: pin.url,
      source: "system" as const,
    })),
    ...flattenItdTools().map((tool) => ({
      id: `tool:${tool.id}`,
      label: tool.label,
      url: tool.url,
      source: "tool" as const,
    })),
    { id: "tool:aduc", label: "Active Directory", url: "mdc-tool://aduc", source: "tool" },
    { id: "tool:cmrc", label: "CmRC Viewer", url: "mdc-tool://cmrc", source: "tool" },
    ...bookmarks.map((bookmark) => ({
      id: `bm:${bookmark.id}`,
      label: bookmark.title,
      url: bookmark.url,
      source: "bookmark" as const,
    })),
  ];
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function defaultBookmarks(): Bookmark[] {
  const now = new Date().toISOString();
  const rows: { title: string; url: string; folder: string }[] = [
    { title: "Google", url: "https://www.google.com", folder: "" },
    { title: "ITD Intra", url: "https://miamidadecounty.sharepoint.com/sites/ITD-Intra", folder: "Frequent Sites" },
    { title: "Outlook", url: "https://outlook.office.com", folder: "Frequent Sites" },
    { title: "Citrix Secure Sign In", url: "https://xenapp.cloud.com", folder: "Frequent Sites" },
    { title: "Webex", url: "https://desktop.wxcc-us1.cisco.com/iframe-widget", folder: "Frequent Sites" },
    { title: "IT Service Desk", url: SERVICE_DESK_URL, folder: "Frequent Sites" },
  ];
  return rows.map((r) => ({
    id: newId(),
    title: r.title,
    url: r.url,
    folder: r.folder,
    favicon: faviconFor(r.url),
    addedAt: now,
  }));
}

export function defaultProfile(name = "Help Desk"): Profile {
  const tabId = newId();
  const title = "Workspace";
  const tab = normalizeTab({
    id: tabId,
    url: HOME_URL,
    title,
    session: [{ url: HOME_URL, title }],
    sessionIndex: 0,
  });
  return {
    id: newId(),
    name,
    kind: name === "InPrivate" ? "inprivate" : "local",
    bookmarks: defaultBookmarks(),
    history: [],
    tabs: [tab],
    activeTabId: tabId,
    quickAccess: defaultQuickAccess(),
  };
}

export function defaultPayload(): BrowserPayload {
  const profile = defaultProfile();
  return {
    profiles: [profile],
    activeProfileId: profile.id,
    theme: { ...THEME_PRESETS.opera },
    config: defaultConfig(),
    logins: [],
    downloads: [],
    vaultPinHash: null,
  };
}

export function isInternalUrl(url: string) {
  return url.startsWith("mdc://");
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** County and Microsoft login hosts refuse iframe embedding. */
export function requiresSecureLaunch(url: string) {
  const host = hostOf(url);
  if (!host) return false;
  return (
    host === "miamidade.gov" ||
    host.endsWith(".miamidade.gov") ||
    host === "login.microsoftonline.com" ||
    host.endsWith(".microsoftonline.com") ||
    host === "aka.ms" ||
    host.endsWith(".sharepoint.com") ||
    host.endsWith(".office.com") ||
    host.endsWith(".office365.com") ||
    host.endsWith(".cloud.com") ||
    host.endsWith(".microsoft.com") ||
    host.endsWith(".onbmc.com") ||
    host.endsWith(".cisco.com")
  );
}

export function normalizeUrl(raw: string, engine: SearchEngine = "county") {
  const input = raw.trim();
  if (!input) return HOME_URL;
  if (input.startsWith("mdc://")) return input;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input)) return input;
  if (input.includes(".") && !input.includes(" ")) return `https://${input}`;
  const q = encodeURIComponent(input);
  if (engine === "google") return `https://www.google.com/search?q=${q}`;
  if (engine === "bing") return `https://www.bing.com/search?q=${q}`;
  return `https://www.miamidade.gov/global/search.page?q=${q}`;
}

export function displayTitle(url: string, fallback?: string) {
  if (fallback && fallback.trim()) return fallback;
  if (url === HOME_URL) return "Workspace";
  if (url === SETTINGS_URL) return "Settings";
  if (url === DOWNLOADS_URL) return "Downloads";
  if (url === HISTORY_URL) return "History";
  if (url === FAVORITES_URL) return "Favorites";
  if (url === KNOWLEDGE_URL) return "Knowledge";
  const host = hostOf(url);
  return host || url;
}

export function newTabUrl(config: BrowserConfig, startPage: string) {
  if (config.startupBehavior === "restore") return startPage || HOME_URL;
  if (config.newTabPage === "blank") return "mdc://workspace";
  if (config.newTabPage === "custom" && config.customNewTab) return config.customNewTab;
  return startPage || HOME_URL;
}

export function rangeCutoff(range: ClearRange): number {
  const now = Date.now();
  if (range === "hour") return now - 60 * 60 * 1000;
  if (range === "day") return now - 24 * 60 * 60 * 1000;
  if (range === "week") return now - 7 * 24 * 60 * 60 * 1000;
  if (range === "month") return now - 28 * 24 * 60 * 60 * 1000;
  return 0;
}

const LOOKALIKES = ["miamidada.gov", "miamada.gov", "miamidede.gov", "miami-dade.gov", "miamidade.co"];

export function typoSuspect(url: string) {
  const host = hostOf(url);
  if (!host) return false;
  return LOOKALIKES.some((h) => host === h || host.endsWith(`.${h}`));
}
