import { useMemo, useState } from "react";
import { Copy, ExternalLink, KeyRound, Lock } from "lucide-react";
import { hostOf } from "@/lib/browser/types";
import { loginsForUrl } from "@/lib/browser/vault-crypto";
import { useBrowserStore } from "@/lib/browser/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SecureLaunch({ url, title }: { url: string; title: string }) {
  const host = hostOf(url);
  const logins = useBrowserStore((s) => s.logins);
  const unlocked = useBrowserStore((s) => s.vaultUnlocked);
  const savePasswords = useBrowserStore((s) => s.config.savePasswords);
  const addLogin = useBrowserStore((s) => s.addLogin);
  const matches = useMemo(() => loginsForUrl(logins, url), [logins, url]);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState("");

  return (
    <div className="grid h-full place-items-center overflow-auto bg-[var(--bg)] px-6 py-8 text-[var(--fg)]">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-8">
        <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-[var(--btn)] text-[var(--accent)]">
          <Lock className="size-5" />
        </div>
        <h1 className="font-display text-2xl font-medium tracking-tight text-balance">
          {title || host}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] text-pretty">
          {host} is a County or identity host. It blocks being framed inside
          another app so SSO and MFA stay on the real site. Open it in a new
          tab — your Windows / Entra account signs in there. Copy a saved login
          from this employee’s vault if you need it.
        </p>
        <p className="mt-3 font-mono text-xs break-all text-[var(--muted)]">{url}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild>
            <a href={url} target="_blank" rel="noreferrer">
              Open {host || "site"}
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>

        {matches.length ? (
          <div className="mt-6 space-y-2">
            <div className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Vault for this site</div>
            {matches.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--btn)] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{l.username}</div>
                  <div className="text-xs text-[var(--muted)]">{unlocked && l.password ? "Password saved" : unlocked ? "Username only" : "Password locked"}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="grid size-8 place-items-center rounded-lg hover:bg-[var(--panel)]"
                    title="Copy username"
                    onClick={() => {
                      navigator.clipboard?.writeText(l.username).catch(() => {});
                      setCopied("user");
                    }}
                  >
                    <Copy className="size-3.5" />
                  </button>
                  {unlocked && l.password ? (
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-lg hover:bg-[var(--panel)]"
                      title="Copy password"
                      onClick={() => {
                        navigator.clipboard?.writeText(l.password ?? "").catch(() => {});
                        setCopied("pass");
                      }}
                    >
                      <KeyRound className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {copied ? <p className="text-xs text-[var(--muted)]">Copied {copied === "user" ? "username" : "password"}.</p> : null}
          </div>
        ) : null}

        {savePasswords && unlocked ? (
          <form
            className="mt-6 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!user.trim()) return;
              void addLogin(host || url, user.trim(), password);
              setUser("");
              setPassword("");
            }}
          >
            <div className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Save to this vault</div>
            <Input placeholder="Username" value={user} onChange={(e) => setUser(e.target.value)} />
            <Input
              type="password"
              autoComplete="off"
              placeholder="Password (optional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" variant="outline" className="w-full">
              Save login
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
