import { useEffect, useState } from "react";
import { BookOpen, Download, History, Home, Monitor, Settings, Star, Users } from "lucide-react";
import {
  DOWNLOADS_URL,
  FAVORITES_URL,
  HISTORY_URL,
  HOME_URL,
  KNOWLEDGE_URL,
  SETTINGS_URL,
  faviconFor,
  hostOf,
} from "@/lib/browser/types";
import { cn } from "@/lib/utils";

type Size = "sm" | "md";

export function Favicon({
  url,
  title,
  size = "md",
  className,
}: {
  url: string;
  title?: string;
  size?: Size;
  className?: string;
}) {
  const src = faviconFor(url);
  const [failed, setFailed] = useState(false);
  const Internal = internalIcon(url);
  const box = size === "sm" ? "size-3.5" : "size-4";
  const glyph = size === "sm" ? "size-3" : "size-3.5";

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (Internal) {
    return (
      <span
        className={cn("grid shrink-0 place-items-center text-[var(--muted)]", box, className)}
        aria-hidden
      >
        <Internal className={glyph} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[3px] bg-[var(--btn)]",
        box,
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          "font-medium leading-none text-[var(--muted)]",
          size === "sm" ? "text-[8px]" : "text-[9px]",
        )}
      >
        {letterFor(url, title)}
      </span>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full bg-[var(--btn)] object-contain"
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}

function internalIcon(url: string) {
  if (url === HOME_URL || url === "about:blank") return Home;
  if (url === SETTINGS_URL) return Settings;
  if (url === KNOWLEDGE_URL) return BookOpen;
  if (url === DOWNLOADS_URL) return Download;
  if (url === HISTORY_URL) return History;
  if (url === FAVORITES_URL) return Star;
  if (url.startsWith("mdc-tool://aduc")) return Users;
  if (url.startsWith("mdc-tool://cmrc")) return Monitor;
  if (url.startsWith("mdc://") || url.startsWith("mdc-tool://")) return Home;
  return null;
}

function letterFor(url: string, title?: string) {
  const raw = (title?.trim() || hostOf(url) || "?").replace(/^https?:\/\//i, "");
  const ch = raw.charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(ch) ? ch : "?";
}
