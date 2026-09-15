import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  BookOpen,
  Camera,

  ChevronRight,
  Download,
  EllipsisVertical,
  Eraser,
  HelpCircle,
  History,
  Languages,
  Lock,
  Maximize2,
  Plus,
  Printer,
  Puzzle,
  Search,
  Settings,
  SquareSplitHorizontal,
  AppWindow,
} from "lucide-react";
import { useBrowserStore } from "@/lib/browser/store";
import {
  DOWNLOADS_URL,
  FAVORITES_URL,
  HISTORY_URL,
  PINNED,
} from "@/lib/browser/types";
import { cn } from "@/lib/utils";

type Sub = "groups" | "extensions" | "more" | "help" | null;

export function AppMenu() {
  const open = useBrowserStore((s) => s.menuOpen);
  const setMenuOpen = useBrowserStore((s) => s.setMenuOpen);
  const newTab = useBrowserStore((s) => s.newTab);
  const newPrivate = useBrowserStore((s) => s.newPrivateSession);
  const navigate = useBrowserStore((s) => s.navigate);
  const openSettings = useBrowserStore((s) => s.openSettings);
  const setFindOpen = useBrowserStore((s) => s.setFindOpen);
  const zoom = useBrowserStore((s) => s.config.zoom);
  const setZoom = useBrowserStore((s) => s.setZoom);
  const kiosk = useBrowserStore((s) => s.kiosk);
  const setKiosk = useBrowserStore((s) => s.setKiosk);
  const setDeleteOpen = useBrowserStore((s) => s.setDeleteDialogOpen);
  const splitView = useBrowserStore((s) => s.splitView);
  const setSplitView = useBrowserStore((s) => s.setSplitView);
  const setBookmarkPromptOpen = useBrowserStore((s) => s.setBookmarkPromptOpen);
  const closeTab = useBrowserStore((s) => s.closeTab);
  const tabs = useBrowserStore((s) => s.activeProfile().tabs);
  const activeTabId = useBrowserStore((s) => s.activeProfile().activeTabId);
  const [sub, setSub] = useState<Sub>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setSub(null);
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setMenuOpen]);

  function item(
    label: string,
    shortcut: string | undefined,
    run: () => void,
    Icon: typeof Plus,
    opts?: { chevron?: boolean; active?: boolean },
  ) {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={run}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-[var(--btn)]",
          opts?.active && "bg-[var(--btn)]",
        )}
      >
        <Icon className="size-4 shrink-0 text-[var(--muted)]" />
        <span className="flex-1">{label}</span>
        {opts?.chevron ? (
          <ChevronRight className="size-3.5 text-[var(--muted)]" />
        ) : shortcut ? (
          <span className="text-[11px] text-[var(--muted)] tabular-nums">{shortcut}</span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        title="Settings and more"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setMenuOpen(!open)}
        className={cn(
          "grid size-9 place-items-center rounded-lg hover:bg-[var(--btn)]",
          open && "bg-[var(--btn)]",
        )}
      >
        <EllipsisVertical className="size-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute top-10 right-0 z-50 w-[320px] rounded-xl border border-[var(--border)] bg-[var(--panel)] py-1 shadow-2xl"
        >
          {item("New tab", "Ctrl+T", () => newTab(), Plus)}
          {item("New window", "Ctrl+N", () => window.open(location.origin, "_blank"), AppWindow)}
          {item("New InPrivate window", "Ctrl+Shift+N", () => newPrivate(), Lock)}
          <div className="my-1 flex items-center gap-2 border-y border-[var(--border)] px-3 py-1.5 text-[13px]">
            <Search className="size-4 text-[var(--muted)]" />
            <span className="flex-1">Zoom</span>
            <button type="button" className="grid size-7 place-items-center rounded-md hover:bg-[var(--btn)]" onClick={() => setZoom(zoom - 10)} aria-label="Zoom out">
              −
            </button>
            <span className="w-10 text-center tabular-nums">{zoom}%</span>
            <button type="button" className="grid size-7 place-items-center rounded-md hover:bg-[var(--btn)]" onClick={() => setZoom(zoom + 10)} aria-label="Zoom in">
              +
            </button>
            <button
              type="button"
              className="grid size-7 place-items-center rounded-md hover:bg-[var(--btn)]"
              title="Reset zoom"
              onClick={() => setZoom(100)}
            >
              <Maximize2 className="size-3.5 text-[var(--muted)]" />
            </button>
          </div>
          {item("Favorites", "Ctrl+Shift+O", () => navigate(FAVORITES_URL, "Favorites"), Bookmark)}
          {item("Knowledge admin", undefined, () => navigate("mdc://knowledge", "Knowledge"), BookOpen)}
          {item("History", "Ctrl+H", () => navigate(HISTORY_URL, "History"), History)}

          {item("Tab groups", undefined, () => setSub(sub === "groups" ? null : "groups"), SquareSplitHorizontal, {
            chevron: true,
            active: sub === "groups",
          })}
          {item("Downloads", "Ctrl+J", () => navigate(DOWNLOADS_URL, "Downloads"), Download)}
          {item("Extensions", undefined, () => setSub(sub === "extensions" ? null : "extensions"), Puzzle, {
            chevron: true,
            active: sub === "extensions",
          })}
          {item("Passwords", undefined, () => openSettings("passwords"), Lock)}
          <div className="my-1 border-t border-[var(--border)]" />
          {item("Delete browsing data", "Ctrl+Shift+Del", () => setDeleteOpen(true), Eraser)}
          {item("Print", "Ctrl+P", () => { window.print(); setMenuOpen(false); }, Printer)}
          {item("Translate", undefined, () => openSettings("languages"), Languages)}
          {item(
            splitView ? "Exit split screen" : "Split screen",
            undefined,
            () => setSplitView(!splitView),
            SquareSplitHorizontal,
          )}
          {item("Screenshot", "Ctrl+Shift+S", () => { window.print(); setMenuOpen(false); }, Camera)}
          {item("Find on page", "Ctrl+F", () => { setFindOpen(true); setMenuOpen(false); }, Search)}
          {item("More tools", undefined, () => setSub(sub === "more" ? null : "more"), Settings, {
            chevron: true,
            active: sub === "more",
          })}
          <div className="my-1 border-t border-[var(--border)]" />
          {item("Settings", undefined, () => openSettings("profiles"), Settings)}
          {item("Help and feedback", undefined, () => setSub(sub === "help" ? null : "help"), HelpCircle, {
            chevron: true,
            active: sub === "help",
          })}
          {item(
            "Close window",
            undefined,
            () => {
              if (tabs.length > 1) closeTab(activeTabId);
              else {
                setMenuOpen(false);
                window.close();
              }
            },
            AppWindow,
          )}
          <p className="mt-1 border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted)]">
            Managed by your organization
          </p>
          {sub ? <SubPanel kind={sub} onClose={() => setSub(null)} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function SubPanel({ kind, onClose }: { kind: Exclude<Sub, null>; onClose: () => void }) {
  const navigate = useBrowserStore((s) => s.navigate);
  const newTab = useBrowserStore((s) => s.newTab);
  const openSettings = useBrowserStore((s) => s.openSettings);
  const setBookmarkPromptOpen = useBrowserStore((s) => s.setBookmarkPromptOpen);
  const setKiosk = useBrowserStore((s) => s.setKiosk);
  const kiosk = useBrowserStore((s) => s.kiosk);
  const setDeleteOpen = useBrowserStore((s) => s.setDeleteDialogOpen);
  const setMenuOpen = useBrowserStore((s) => s.setMenuOpen);

  const rows =
    kind === "groups"
      ? [
          { label: "New tab group", run: () => newTab() },
          ...PINNED.map((p) => ({
            label: p.label,
            run: () => navigate(p.url, p.label),
          })),
        ]
      : kind === "extensions"
        ? [{ label: "Managed by Miami-Dade ITD", run: () => openSettings("extensions") }]
        : kind === "more"
          ? [
              { label: "Add this page to favorites", run: () => { setBookmarkPromptOpen(true); } },
              {
                label: kiosk ? "Exit kiosk mode" : "Kiosk mode",
                run: () => {
                  const next = !kiosk;
                  setKiosk(next);
                  if (next) document.documentElement.requestFullscreen?.().catch(() => {});
                  else document.exitFullscreen?.().catch(() => {});
                  setMenuOpen(false);
                },
              },
              { label: "Delete browsing data", run: () => setDeleteOpen(true) },
              { label: "Developer tools", run: onClose, locked: true },
            ]
          : [
              { label: "Help (MyIT)", run: () => navigate("https://myit.miamidade.gov", "MyIT") },
              { label: "Send feedback", run: () => navigate("https://myit.miamidade.gov", "MyIT") },
              { label: "About this browser", run: () => openSettings("about") },
            ];

  return (
    <div className="absolute top-8 right-full z-50 mr-1 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] py-1 shadow-2xl">
      {rows.map((r) => (
        <button
          key={r.label}
          type="button"
          disabled={"locked" in r && r.locked}
          onClick={r.run}
          className="flex w-full items-center px-3 py-2 text-left text-[13px] hover:bg-[var(--btn)] disabled:opacity-40"
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
