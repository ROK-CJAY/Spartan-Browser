import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Copy, Folder, Pencil, Plus, Trash2 } from "lucide-react";
import { useBrowserStore } from "@/lib/browser/store";
import { PINNED, type Bookmark } from "@/lib/browser/types";
import { cn } from "@/lib/utils";
import { Favicon } from "./favicon";

type Menu =
  | { kind: "fav"; x: number; y: number; bookmark: Bookmark }
  | { kind: "folder"; x: number; y: number; folder: string }
  | { kind: "drop"; x: number; y: number; folder: string }
  | { kind: "overflow"; x: number; y: number }
  | null;

export function FavoritesBar() {
  const bookmarks = useBrowserStore((s) => s.activeProfile().bookmarks);
  const navigate = useBrowserStore((s) => s.navigate);
  const newTab = useBrowserStore((s) => s.newTab);
  const removeBookmark = useBrowserStore((s) => s.removeBookmark);
  const renameBookmark = useBrowserStore((s) => s.renameBookmark);
  const renameFolder = useBrowserStore((s) => s.renameFolder);
  const deleteFolder = useBrowserStore((s) => s.deleteFolder);
  const setPrompt = useBrowserStore((s) => s.setBookmarkPromptOpen);
  const [menu, setMenu] = useState<Menu>(null);
  const [renaming, setRenaming] = useState<{ id?: string; folder?: string; value: string } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const topLevel = bookmarks.filter((b) => !(b.folder ?? ""));
  const folders = useMemo(() => {
    const names = Array.from(new Set(bookmarks.map((b) => b.folder ?? "").filter(Boolean)));
    return names.map((name) => ({ name, items: bookmarks.filter((b) => (b.folder ?? "") === name) }));
  }, [bookmarks]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-fav-menu]") && !t.closest("[data-fav-item]")) setMenu(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setRenaming(null);
      }
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  function copy(url: string) {
    navigator.clipboard?.writeText(url).catch(() => {});
    setMenu(null);
  }

  function commitRename() {
    if (!renaming) return;
    const value = renaming.value.trim();
    if (renaming.id && value) renameBookmark(renaming.id, value);
    if (renaming.folder && value) renameFolder(renaming.folder, value);
    setRenaming(null);
  }

  return (
    <div ref={barRef} className="relative flex items-center gap-1 overflow-x-auto pt-0.5">
      {PINNED.map((p) => (
        <Chip key={p.id} label={p.label} url={p.url} onClick={() => navigate(p.url, p.label)} />
      ))}
      {topLevel.map((b) =>
        renaming?.id === b.id ? (
          <input
            key={b.id}
            autoFocus
            value={renaming.value}
            onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(null);
            }}
            className="h-7 w-28 rounded-md border border-[var(--accent)] bg-[var(--addr)] px-2 text-[11px]"
          />
        ) : (
          <Chip
            key={b.id}
            label={b.title}
            url={b.url}
            onClick={() => navigate(b.url, b.title)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ kind: "fav", x: e.clientX, y: e.clientY, bookmark: b });
            }}
          />
        ),
      )}
      {folders.map((f) => (
        <div key={f.name} className="relative" data-fav-item>
          {renaming?.folder === f.name ? (
            <input
              autoFocus
              value={renaming.value}
              onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(null);
              }}
              className={cn(
                "h-7 w-32 rounded-md border px-2 text-[11px]",
                !renaming.value.trim() || folders.some((x) => x.name === renaming.value.trim() && x.name !== f.name)
                  ? "border-red-400 bg-[var(--addr)]"
                  : "border-[var(--accent)] bg-[var(--addr)]",
              )}
            />
          ) : (
            <button
              type="button"
              title={f.name}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setMenu(menu?.kind === "drop" && menu.folder === f.name ? null : { kind: "drop", x: r.left, y: r.bottom + 4, folder: f.name });
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ kind: "folder", x: e.clientX, y: e.clientY, folder: f.name });
              }}
              className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] text-[var(--muted)] hover:bg-[var(--btn)] hover:text-[var(--fg)]"
            >
              <Folder className="size-3" />
              <span className="max-w-28 truncate">{f.name}</span>
              <ChevronDown className="size-3" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        title="Add this page to favorites"
        onClick={() => setPrompt(true)}
        className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--btn)] hover:text-[var(--fg)]"
      >
        <Plus className="size-3.5" />
      </button>

      {menu?.kind === "drop" ? (
        <Menu pos={{ x: menu.x, y: menu.y }}>
          {bookmarks
            .filter((b) => (b.folder ?? "") === menu.folder)
            .map((b) => (
              <MenuItem
                key={b.id}
                label={b.title}
                icon={<Favicon url={b.url} title={b.title} size="sm" />}
                onClick={() => {
                  navigate(b.url, b.title);
                  setMenu(null);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ kind: "fav", x: e.clientX, y: e.clientY, bookmark: b });
                }}
              />
            ))}
        </Menu>
      ) : null}

      {menu?.kind === "fav" ? (
        <Menu pos={{ x: menu.x, y: menu.y }}>
          <MenuItem
            label="Open"
            onClick={() => {
              navigate(menu.bookmark.url, menu.bookmark.title);
              setMenu(null);
            }}
          />
          <MenuItem
            label="Open in new tab"
            onClick={() => {
              newTab(menu.bookmark.url);
              setMenu(null);
            }}
          />
          <MenuItem label="Copy link address" icon={<Copy className="size-3.5" />} onClick={() => copy(menu.bookmark.url)} />
          <MenuItem
            label="Rename"
            icon={<Pencil className="size-3.5" />}
            onClick={() => {
              setRenaming({ id: menu.bookmark.id, value: menu.bookmark.title });
              setMenu(null);
            }}
          />
          <MenuItem
            label="Delete"
            icon={<Trash2 className="size-3.5" />}
            onClick={() => {
              removeBookmark(menu.bookmark.id);
              setMenu(null);
            }}
          />
        </Menu>
      ) : null}

      {menu?.kind === "folder" ? (
        <Menu pos={{ x: menu.x, y: menu.y }}>
          <MenuItem
            label="Rename folder"
            icon={<Pencil className="size-3.5" />}
            onClick={() => {
              setRenaming({ folder: menu.folder, value: menu.folder });
              setMenu(null);
            }}
          />
          <MenuItem
            label="Delete folder"
            icon={<Trash2 className="size-3.5" />}
            onClick={() => {
              deleteFolder(menu.folder);
              setMenu(null);
            }}
          />
        </Menu>
      ) : null}
    </div>
  );
}

function Chip({
  label,
  url,
  onClick,
  onContextMenu,
}: {
  label: string;
  url: string;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      title={label}
      data-fav-item
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="flex h-7 max-w-36 shrink-0 items-center gap-1 truncate rounded-md px-2 text-[11px] text-[var(--muted)] hover:bg-[var(--btn)] hover:text-[var(--fg)]"
    >
      <Favicon url={url} title={label} size="sm" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Menu({ pos, children }: { pos: { x: number; y: number }; children: ReactNode }) {
  const top = Math.min(pos.y, typeof window === "undefined" ? pos.y : Math.max(8, window.innerHeight - 280));
  const left = Math.min(pos.x, typeof window === "undefined" ? pos.x : Math.max(8, window.innerWidth - 220));
  return createPortal(
    <div
      data-fav-menu
      className="fixed z-[80] min-w-48 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] py-1 text-[var(--fg)] shadow-lg"
      style={{ top, left }}
    >
      {children}
    </div>,
    document.body,
  );
}

function MenuItem({
  label,
  onClick,
  onContextMenu,
  icon,
}: {
  label: string;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--btn)]"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

export function BookmarkPrompt() {
  const open = useBrowserStore((s) => s.bookmarkPromptOpen);
  const setOpen = useBrowserStore((s) => s.setBookmarkPromptOpen);
  const add = useBrowserStore((s) => s.addBookmark);
  const bookmarks = useBrowserStore((s) => s.activeProfile().bookmarks);
  const folders = Array.from(new Set(bookmarks.map((b) => b.folder ?? "").filter(Boolean)));
  const [folder, setFolder] = useState("");
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (open) {
      setFolder("");
      setCustom("");
    }
  }, [open]);

  if (!open) return null;

  function save() {
    add(custom.trim() || folder);
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 text-[var(--fg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-medium">Save favorite</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Ungrouped, or drop it in a folder.</p>
        <label className="mt-4 block text-xs text-[var(--muted)]">
          Folder
          <select
            className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--addr)] px-2 text-sm"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          >
            <option value="">Ungrouped</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-xs text-[var(--muted)]">
          Or new folder
          <input
            className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--addr)] px-2 text-sm"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Frequent Sites"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3 py-2 text-sm hover:bg-[var(--btn)]" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="button" className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-[var(--accent-fg)]" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
