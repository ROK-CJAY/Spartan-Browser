import { useMemo, useState } from "react";
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useBrowserStore } from "@/lib/browser/store";
import { generatePassword, loginsForUrl, passwordStrength, siteHost, expiryState, formatExpiry } from "@/lib/browser/vault-crypto";
import { ELEVATED_TOOLS, isInternalUrl, type ScriptLaunchMode } from "@/lib/browser/types";
import {
  DEFAULT_SCRIPT_FOLDER,
  SCRIPT_FOLDER_PRESETS,
  downloadElevatedScript,
  toolScriptPath,
} from "@/lib/browser/elevated-scripts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordsSection() {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const logins = useBrowserStore((s) => s.logins);
  const addLogin = useBrowserStore((s) => s.addLogin);
  const updateLogin = useBrowserStore((s) => s.updateLogin);
  const removeLogin = useBrowserStore((s) => s.removeLogin);
  const navigate = useBrowserStore((s) => s.navigate);
  const unlocked = useBrowserStore((s) => s.vaultUnlocked);
  const pinHash = useBrowserStore((s) => s.vaultPinHash);
  const unlockVault = useBrowserStore((s) => s.unlockVault);
  const lockVault = useBrowserStore((s) => s.lockVault);
  const setVaultPin = useBrowserStore((s) => s.setVaultPin);
  const clearVaultPin = useBrowserStore((s) => s.clearVaultPin);
  const account = useCurrentUser();

  const [site, setSite] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinOpen, setPinOpen] = useState(false);

  const shown = logins.filter((l) =>
    `${l.site} ${l.username}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const withSecret = logins.filter((l) => l.secret || l.password).length;

  function flash(id: string) {
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1200);
  }

  async function onAdd() {
    if (!site.trim() || !user.trim()) return;
    await addLogin(site.trim(), user.trim(), password);
    setSite("");
    setUser("");
    setPassword("");
    setShowNew(false);
  }

  if (pinHash && !unlocked) {
    return (
      <>
        <h2 className="mb-1 text-[22px] font-semibold tracking-tight">Password vault</h2>
        <p className="mb-4 text-[13px] text-[var(--muted)]">
          This vault is locked to {account?.displayName ?? "the signed-in employee"}. Enter the PIN to
          view or copy saved passwords.
        </p>
        <form
          className="max-w-sm space-y-3 rounded-xl bg-[var(--panel)] p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await unlockVault(pin);
            setPinError(ok ? "" : "That PIN does not match this vault.");
            if (ok) setPin("");
          }}
        >
          <div className="mb-1 flex items-center gap-2 text-[13px] font-medium">
            <Lock className="size-4 text-[var(--accent)]" />
            Unlock vault
          </div>
          <Input
            type="password"
            autoComplete="off"
            placeholder="Vault PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          {pinError ? <p className="text-[12px] text-[var(--muted)]">{pinError}</p> : null}
          <Button type="submit" className="w-full">
            Unlock
          </Button>
        </form>
        <p className="mt-4 text-[12px] text-[var(--muted)]">
          Usernames stay listed. Passwords stay encrypted until this employee unlocks the vault.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl bg-[var(--panel)]">
          {logins.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-[var(--muted)]">No saved logins in this profile yet.</p>
          ) : (
            logins.map((l) => (
              <div key={l.id} className="border-b border-[var(--border)] px-4 py-3 last:border-0">
                <div className="text-[13px] font-medium">{l.site}</div>
                <div className="text-[12px] text-[var(--muted)]">{l.username} · password locked</div>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="mb-1 text-[22px] font-semibold tracking-tight">Password vault</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        {account
          ? `Usernames and passwords for ${account.displayName ?? account.primaryEmail}. Encrypted in this employee’s vault — the next person on this PC will not see them. County MyIT / Cloud still use Entra ID.`
          : "Passwords stay on this desk. Optional SSO in Profiles if you want the vault to follow you to another PC."}
      </p>

      <div className="overflow-hidden rounded-xl bg-[var(--panel)]">
        <Toggle
          label="Offer to save passwords"
          hint="Save a username and password into this employee vault."
          checked={config.savePasswords}
          onChange={(v) => setConfig({ savePasswords: v })}
        />
        <Toggle
          label="Autofill"
          hint="Suggest saved usernames and copy passwords on matching County sites."
          checked={config.autofill}
          onChange={(v) => setConfig({ autofill: v })}
        />
        <Toggle
          label="Password Helper"
          hint={config.passwordHelper ? "Suggests a strong password when you add one." : "Off"}
          checked={config.passwordHelper}
          onChange={(v) => setConfig({ passwordHelper: v })}
        />
        <Toggle
          label="Sync passwords"
          hint={
            account
              ? "Roam encrypted secrets with this signed-in employee. Never with the next person on this PC."
              : "Off unless you use optional SSO so this vault can follow you."
          }
          checked={config.syncPasswords}
          onChange={(v) => setConfig({ syncPasswords: v })}
        />
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <span>
            <span className="block text-[13px] font-medium">Admin password lifetime</span>
            <span className="mt-0.5 block text-[12px] text-[var(--muted)]">
              ADUC / CmRC accounts are treated as expired after this many days. County AD is not checked from this browser.
            </span>
          </span>
          <Input
            className="h-9 w-20"
            inputMode="numeric"
            value={String(config.adminPasswordDays ?? 90)}
            onChange={(e) => setConfig({ adminPasswordDays: Math.min(365, Math.max(1, Number(e.target.value) || 90)) })}
          />
        </div>
      </div>

      <ScriptLaunchSettings />

      <div className="mt-6 overflow-hidden rounded-xl bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <div className="text-[13px] font-medium">Vault PIN</div>
            <div className="text-[12px] text-[var(--muted)]">
              {pinHash ? "Required after lock or when the next employee signs in." : "Optional extra lock on this vault."}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pinHash ? (
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-[12px] hover:bg-[var(--btn)]"
                onClick={() => lockVault()}
              >
                Lock now
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-[12px] hover:bg-[var(--btn)]"
              onClick={() => {
                setPinOpen((v) => !v);
                setPinError("");
              }}
            >
              {pinHash ? "Change PIN" : "Set PIN"}
            </button>
          </div>
        </div>
        {pinOpen ? (
          <form
            className="space-y-2 border-t border-[var(--border)] px-4 py-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await setVaultPin(pinNew, pinHash ? pinCurrent : undefined);
              setPinError(ok ? "" : "PIN must be at least 4 characters" + (pinHash ? ", and the current PIN must match." : "."));
              if (ok) {
                setPinNew("");
                setPinCurrent("");
                setPinOpen(false);
              }
            }}
          >
            {pinHash ? (
              <Input
                type="password"
                autoComplete="off"
                placeholder="Current PIN"
                value={pinCurrent}
                onChange={(e) => setPinCurrent(e.target.value)}
              />
            ) : null}
            <Input
              type="password"
              autoComplete="off"
              placeholder="New PIN (4 or more characters)"
              value={pinNew}
              onChange={(e) => setPinNew(e.target.value)}
            />
            {pinError ? <p className="text-[12px] text-[var(--muted)]">{pinError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm">
                Save PIN
              </Button>
              {pinHash ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await clearVaultPin(pinCurrent);
                    setPinError(ok ? "" : "Current PIN did not match.");
                    if (ok) {
                      setPinCurrent("");
                      setPinNew("");
                      setPinOpen(false);
                    }
                  }}
                >
                  Remove PIN
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>

      <h3 className="mt-6 mb-3 text-[15px] font-medium">Add to vault</h3>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Input placeholder="Site" value={site} onChange={(e) => setSite(e.target.value)} />
        <Input placeholder="Username or network ID" value={user} onChange={(e) => setUser(e.target.value)} />
        <div className="relative">
          <Input
            type={showNew ? "text" : "password"}
            autoComplete="off"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-16"
          />
          <button
            type="button"
            className="absolute top-1 right-1 grid size-8 place-items-center rounded-md hover:bg-[var(--btn)]"
            onClick={() => setShowNew((v) => !v)}
            aria-label={showNew ? "Hide password" : "Show password"}
          >
            {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <div className="flex gap-2">
          {config.passwordHelper ? (
            <Button
              type="button"
              variant="outline"
              title="Generate password"
              onClick={() => {
                setPassword(generatePassword());
                setShowNew(true);
              }}
            >
              <RefreshCw className="size-4" />
            </Button>
          ) : null}
          <Button type="button" onClick={() => void onAdd()}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </div>
      {password && config.passwordHelper ? (
        <p className="mb-3 text-[12px] text-[var(--muted)]">Strength: {passwordStrength(password)}</p>
      ) : null}

      <h3 className="mt-2 mb-3 text-[15px] font-medium">
        Saved logins{" "}
        <span className="text-[12px] font-normal text-[var(--muted)]">
          {shown.length} · {withSecret} with passwords
        </span>
      </h3>
      <Input className="mb-3" placeholder="Search by site or username" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="overflow-hidden rounded-xl bg-[var(--panel)]">
        {shown.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-[var(--muted)]">No saved logins in this employee vault yet.</p>
        ) : (
          shown.map((l) => {
            const open = editing === l.id;
            const shownPass = reveal[l.id];
            return (
              <div key={l.id} className="border-b border-[var(--border)] px-4 py-3 last:border-0">
                {open ? (
                  <EditRow
                    site={l.site}
                    username={l.username}
                    password={l.password ?? ""}
                    onCancel={() => setEditing(null)}
                    onSave={async (next) => {
                      await updateLogin(l.id, next);
                      setEditing(null);
                    }}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        if (l.kind === "elevated" || l.site.startsWith("mdc-tool://")) return;
                        navigate(l.site.startsWith("http") ? l.site : `https://${l.site}`, l.site);
                      }}
                    >
                      <span className="block truncate text-[13px] font-medium">
                        {l.tool && ELEVATED_TOOLS[l.tool] ? ELEVATED_TOOLS[l.tool].label : l.site}
                      </span>
                      <span className="block truncate text-[12px] text-[var(--muted)]">{l.username}</span>
                      <span className="font-mono text-[12px] text-[var(--muted)]">
                        {l.password ? (shownPass ? l.password : "••••••••") : "Username only"}
                      </span>
                      {l.kind === "elevated" ? (
                        <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                          {(() => {
                            const ex = expiryState(l);
                            if (ex.state === "expired") return "Password expired — update before launching ADUC/CmRC.";
                            if (ex.state === "soon") return `Expires in ${ex.days} day${ex.days === 1 ? "" : "s"} (${formatExpiry(l.expiresAt)})`;
                            return formatExpiry(l.expiresAt) ? `Stored until ${formatExpiry(l.expiresAt)}` : "Elevated account";
                          })()}
                        </span>
                      ) : null}
                    </button>
                    {l.password ? (
                      <IconBtn
                        label={shownPass ? "Hide password" : "Show password"}
                        onClick={() => setReveal((r) => ({ ...r, [l.id]: !r[l.id] }))}
                      >
                        {shownPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </IconBtn>
                    ) : null}
                    <IconBtn
                      label="Copy username"
                      onClick={() => {
                        navigator.clipboard?.writeText(l.username).catch(() => {});
                        flash(`${l.id}-u`);
                      }}
                    >
                      <Copy className="size-4" />
                    </IconBtn>
                    {l.password ? (
                      <IconBtn
                        label="Copy password"
                        onClick={() => {
                          navigator.clipboard?.writeText(l.password ?? "").catch(() => {});
                          flash(`${l.id}-p`);
                        }}
                      >
                        <KeyRound className="size-4" />
                      </IconBtn>
                    ) : null}
                    <IconBtn label="Edit" onClick={() => setEditing(l.id)}>
                      <Pencil className="size-4" />
                    </IconBtn>
                    <IconBtn label="Remove" onClick={() => removeLogin(l.id)}>
                      <Trash2 className="size-4" />
                    </IconBtn>
                    {copied === `${l.id}-u` ? <span className="text-[11px] text-[var(--muted)]">Username</span> : null}
                    {copied === `${l.id}-p` ? <span className="text-[11px] text-[var(--muted)]">Password</span> : null}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function EditRow({
  site,
  username,
  password,
  onCancel,
  onSave,
}: {
  site: string;
  username: string;
  password: string;
  onCancel: () => void;
  onSave: (next: { site: string; username: string; password: string }) => void;
}) {
  const [s, setS] = useState(site);
  const [u, setU] = useState(username);
  const [p, setP] = useState(password);
  const [show, setShow] = useState(false);
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Input value={s} onChange={(e) => setS(e.target.value)} placeholder="Site" />
      <Input value={u} onChange={(e) => setU(e.target.value)} placeholder="Username" />
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          autoComplete="off"
          value={p}
          onChange={(e) => setP(e.target.value)}
          placeholder="Password"
          className="pr-16"
        />
        <button
          type="button"
          className="absolute top-1 right-1 grid size-8 place-items-center rounded-md hover:bg-[var(--btn)]"
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <div className="flex gap-2 sm:col-span-3">
        <Button type="button" size="sm" onClick={() => onSave({ site: s, username: u, password: p })}>
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setP(generatePassword())}>
          Generate
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function VaultChip() {
  const tab = useBrowserStore((s) => s.activeTab());
  const logins = useBrowserStore((s) => s.logins);
  const config = useBrowserStore((s) => s.config);
  const unlocked = useBrowserStore((s) => s.vaultUnlocked);
  const addLogin = useBrowserStore((s) => s.addLogin);
  const openSettings = useBrowserStore((s) => s.openSettings);
  const matches = useMemo(() => (config.autofill ? loginsForUrl(logins, tab.url) : []), [config.autofill, logins, tab.url]);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState("");

  if (isInternalUrl(tab.url) || (!config.savePasswords && !config.autofill)) return null;
  const host = siteHost(tab.url);
  if (!host) return null;

  return (
    <div className="relative">
      <button
        type="button"
        title={matches.length ? `${matches.length} saved login${matches.length === 1 ? "" : "s"}` : "Password vault"}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "grid size-9 place-items-center rounded-lg hover:bg-[var(--btn)]",
          open && "bg-[var(--btn)]",
        )}
      >
        <KeyRound className={cn("size-4", matches.length ? "text-[var(--accent)]" : "text-[var(--muted)]")} />
      </button>
      {open ? (
        <div className="absolute top-10 right-0 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 shadow-2xl">
          <div className="mb-2 text-[12px] font-medium tracking-wide text-[var(--muted)] uppercase">{host}</div>
          {matches.length ? (
            <ul className="mb-2 space-y-2">
              {matches.map((l) => (
                <li key={l.id} className="rounded-lg bg-[var(--btn)] px-3 py-2">
                  <div className="truncate text-[13px] font-medium">{l.username}</div>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-[var(--accent)]"
                      onClick={() => {
                        navigator.clipboard?.writeText(l.username).catch(() => {});
                        setCopied("user");
                      }}
                    >
                      Copy username
                    </button>
                    {unlocked && l.password ? (
                      <button
                        type="button"
                        className="text-[11px] text-[var(--accent)]"
                        onClick={() => {
                          navigator.clipboard?.writeText(l.password ?? "").catch(() => {});
                          setCopied("pass");
                        }}
                      >
                        Copy password
                      </button>
                    ) : (
                      <span className="text-[11px] text-[var(--muted)]">{unlocked ? "No password" : "Vault locked"}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-[12px] text-[var(--muted)]">No saved login for this site yet.</p>
          )}
          {copied ? <p className="mb-2 text-[11px] text-[var(--muted)]">Copied {copied === "user" ? "username" : "password"}.</p> : null}
          {config.savePasswords && unlocked ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!user.trim()) return;
                void addLogin(host, user.trim(), password);
                setUser("");
                setPassword("");
              }}
            >
              <Input placeholder="Username" value={user} onChange={(e) => setUser(e.target.value)} />
              <Input
                type="password"
                autoComplete="off"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" size="sm" className="w-full">
                Save to vault
              </Button>
            </form>
          ) : null}
          <button
            type="button"
            className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-[var(--btn)]"
            onClick={() => {
              setOpen(false);
              openSettings("passwords");
            }}
          >
            Open password vault
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ScriptLaunchSettings() {
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const mode: ScriptLaunchMode = config.scriptLaunchMode ?? "inline";
  const folder = config.scriptFolder || DEFAULT_SCRIPT_FOLDER;

  function setMode(next: ScriptLaunchMode) {
    setConfig({ scriptLaunchMode: next, scriptFolder: folder || DEFAULT_SCRIPT_FOLDER });
  }

  return (
    <div className="mt-6 overflow-hidden rounded-xl bg-[var(--panel)]">
      <div className="px-4 py-3.5">
        <div className="text-[13px] font-medium">ADUC and CmRC launchers</div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--muted)]">
          These tools no longer need a C:\Scripts folder. Default is in-memory PowerShell. A .ps1 is optional if a desk
          image still wants a file.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("inline")}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px]",
              mode === "inline" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--btn)]",
            )}
          >
            Run in memory
          </button>
          <button
            type="button"
            onClick={() => setMode("file")}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px]",
              mode === "file" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--btn)]",
            )}
          >
            Use a .ps1 file
          </button>
        </div>
      </div>
      {mode === "file" ? (
        <div className="space-y-3 border-t border-[var(--border)] px-4 py-3.5">
          <label className="block text-[12px] text-[var(--muted)]">
            Script folder
            <Input
              className="mt-1 font-mono text-[12px]"
              value={folder}
              onChange={(e) => setConfig({ scriptFolder: e.target.value })}
              placeholder={DEFAULT_SCRIPT_FOLDER}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {SCRIPT_FOLDER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setConfig({ scriptFolder: p.path })}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px]",
                  folder === p.path ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--btn)]",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="font-mono text-[11px] break-all text-[var(--muted)]">
            {toolScriptPath("aduc", folder)}
            <br />
            {toolScriptPath("cmrc", folder)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => downloadElevatedScript("aduc", folder)}>
              <Download className="size-3.5" />
              Launch-ADUC.ps1
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadElevatedScript("cmrc", folder)}>
              <Download className="size-3.5" />
              Launch-CMRC.ps1
            </Button>
          </div>
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-[var(--muted)]">
            <FolderOpen className="mt-0.5 size-3.5 shrink-0" />
            Save those files in the folder above — AppData, Documents, a D: drive, or a network share. C:\Scripts is not
            required.
          </p>
        </div>
      ) : (
        <p className="border-t border-[var(--border)] px-4 py-3 text-[12px] leading-relaxed text-[var(--muted)]">
          Launch copies an encoded PowerShell command. The desk image never writes Launch-ADUC.ps1 or Launch-CMRC.ps1.
          Switch to “Use a .ps1 file” only if a local policy still wants a saved script.
        </p>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
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
        onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-[var(--accent)]" : "bg-[var(--btn)]")}
      >
        <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform", checked && "translate-x-5")} />
      </button>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--btn)]">
      {children}
    </button>
  );
}
