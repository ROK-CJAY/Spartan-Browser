import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { useBrowserStore } from "@/lib/browser/store";
import { displayNameFromUpn, parseWindowsIdentity } from "@/lib/browser/windows-identity";
import { isCountyEmail } from "@/lib/browser/knowledge-base";
import { isSpartanDesktop, readDesktopWindowsIdentity } from "@/lib/browser/desktop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function initialsFrom(name: string) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "HD"
  );
}

export function SsoCard() {
  const profile = useBrowserStore((s) => s.activeProfile());
  const config = useBrowserStore((s) => s.config);
  const upn = config.entraUpn;
  const desktop = isSpartanDesktop();

  if (!upn) return <GuestSignIn />;

  const name = displayNameFromUpn(upn);

  return (
    <div className="overflow-hidden rounded-xl bg-[var(--panel)]">
      <div className="flex items-start gap-3 px-4 py-4">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">{name}</div>
          <div className="truncate text-[12px] text-[var(--muted)]">{upn}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--btn)] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[var(--accent)] uppercase">
              Entra / Windows
            </span>
            {config.windowsAccount ? (
              <span className="text-[12px] text-[var(--muted)]">{config.windowsAccount}</span>
            ) : null}
          </div>
        </div>
      </div>
      <p className="border-t border-[var(--border)] px-4 py-3 text-[12px] leading-relaxed text-[var(--muted)]">
        {desktop
          ? `Signed in as the Windows account on this PC (${profile.name}). County sites still complete Entra MFA on their own pages, inside Spartan.`
          : `This desk is bound to the Windows logon on this PC (${profile.name}). MyIT, Cloud, and other County apps still prompt for Entra on their own sites.`}
      </p>
    </div>
  );
}

export function GuestSignIn() {
  const setConfig = useBrowserStore((s) => s.setConfig);
  const desktop = isSpartanDesktop();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(desktop);

  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    void readDesktopWindowsIdentity().then((identity) => {
      if (cancelled || !identity) {
        if (!cancelled) setWaiting(false);
        return;
      }
      setConfig({ entraUpn: identity.upn, windowsAccount: identity.account });
    });
    return () => {
      cancelled = true;
    };
  }, [desktop, setConfig]);

  function bind(text: string) {
    const parsed = parseWindowsIdentity(text);
    if (parsed) {
      setConfig({ entraUpn: parsed.upn, windowsAccount: parsed.account });
      setError("");
      return;
    }
    if (isCountyEmail(text)) {
      setConfig({ entraUpn: text.trim().toLowerCase(), windowsAccount: "" });
      setError("");
      return;
    }
    setError("Use this PC’s Entra UPN (name@miamidade.gov).");
  }

  if (desktop) {
    return (
      <div className="overflow-hidden rounded-xl bg-[var(--panel)] p-4">
        <div className="mb-3 grid size-10 place-items-center rounded-full bg-[var(--btn)] text-[var(--accent)]">
          <Monitor className="size-4" />
        </div>
        <h3 className="text-[15px] font-medium">Windows account</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
          {waiting
            ? "Reading the Entra account already signed into Windows on this PC…"
            : "Spartan could not read whoami /upn. Sign into Windows with a County @miamidade.gov account and relaunch."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-[var(--panel)] p-4">
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-[var(--btn)] text-[var(--accent)]">
        <Monitor className="size-4" />
      </div>
      <h3 className="text-[15px] font-medium">Windows / Entra logon</h3>
      <p className="mt-1 mb-4 text-[12px] leading-relaxed text-[var(--muted)]">
        This preview is not the installed desk app, so paste the County UPN for this session.
      </p>
      <div className="flex flex-col gap-2">
        <Input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="name@miamidade.gov"
          aria-label="Entra UPN"
          onKeyDown={(e) => {
            if (e.key === "Enter") bind(raw);
          }}
        />
        <Button type="button" onClick={() => bind(raw)} disabled={!raw.trim()}>
          Use this Windows account
        </Button>
        {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}

export function AccountChip({ onOpen }: { onOpen: () => void }) {
  const profile = useBrowserStore((s) => s.activeProfile());
  const upn = useBrowserStore((s) => s.config.entraUpn);
  const name = upn ? displayNameFromUpn(upn) : profile.name;
  return (
    <button
      type="button"
      title={upn ? `${name} · Entra` : "Help Desk"}
      onClick={onOpen}
      className="flex h-9 max-w-[11rem] items-center gap-2 rounded-full bg-[var(--btn)] pr-3 pl-1 hover:ring-1 hover:ring-[var(--accent)]"
    >
      <span
        className={cn(
          "grid size-7 place-items-center rounded-full text-[10px] font-semibold",
          upn ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--addr)] text-[var(--muted)]",
        )}
      >
        {initialsFrom(name)}
      </span>
      <span className="hidden min-w-0 flex-1 text-left sm:block">
        <span className="block truncate text-[11px] leading-tight font-medium">{name}</span>
        <span className="block text-[10px] leading-tight text-[var(--muted)]">{upn ? "Entra" : "Desk"}</span>
      </span>
    </button>
  );
}

export function RailAvatar({ onOpen }: { onOpen: () => void }) {
  const profile = useBrowserStore((s) => s.activeProfile());
  const upn = useBrowserStore((s) => s.config.entraUpn);
  const name = upn ? displayNameFromUpn(upn) : profile.name;
  return (
    <button
      type="button"
      title={upn ? `${name} · Entra` : "Help Desk"}
      onClick={onOpen}
      className={cn(
        "grid size-11 place-items-center rounded-xl text-[11px] font-semibold",
        upn ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--btn)] text-[var(--muted)]",
      )}
    >
      {initialsFrom(name)}
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="grid size-12 place-items-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--accent-fg)]">
      {initialsFrom(name)}
    </div>
  );
}
