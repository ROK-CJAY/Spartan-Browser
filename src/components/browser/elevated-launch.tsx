import { useState } from "react";
import { Download, Eye, EyeOff, KeyRound, Lock, Play } from "lucide-react";
import { useBrowserStore } from "@/lib/browser/store";
import { ELEVATED_TOOLS, type ElevatedToolId } from "@/lib/browser/types";
import { downloadElevatedScript, launchCommand, scriptFileName, toolScriptPath } from "@/lib/browser/elevated-scripts";
import { addDaysIso, expiryState, formatExpiry, loginForTool } from "@/lib/browser/vault-crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ElevatedLaunchDialog({
  toolId,
  onClose,
}: {
  toolId: ElevatedToolId;
  onClose: () => void;
}) {
  const tool = ELEVATED_TOOLS[toolId];
  const logins = useBrowserStore((s) => s.logins);
  const config = useBrowserStore((s) => s.config);
  const setConfig = useBrowserStore((s) => s.setConfig);
  const unlocked = useBrowserStore((s) => s.vaultUnlocked);
  const pinHash = useBrowserStore((s) => s.vaultPinHash);
  const unlockVault = useBrowserStore((s) => s.unlockVault);
  const addLogin = useBrowserStore((s) => s.addLogin);
  const updateLogin = useBrowserStore((s) => s.updateLogin);
  const login = loginForTool(logins, toolId);
  const expiry = expiryState(login);
  const launchMode = config.scriptLaunchMode ?? "inline";
  const scriptFolder = config.scriptFolder;
  const filePath = toolScriptPath(toolId, scriptFolder);

  const [mode, setMode] = useState<"form" | "ready" | "queued">(
    login && expiry.state !== "expired" && expiry.state !== "missing" ? "ready" : "form",
  );
  const [user, setUser] = useState(login?.username ?? "");
  const [password, setPassword] = useState("");
  const [computer, setComputer] = useState("");
  const [days, setDays] = useState(String(config.adminPasswordDays || 90));
  const [show, setShow] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  async function save() {
    if (!user.trim() || !password) {
      setMsg("Enter the alternate User ID and password.");
      return;
    }
    const n = Math.min(365, Math.max(1, Number(days) || 90));
    setConfig({ adminPasswordDays: n });
    const expiresAt = addDaysIso(new Date(), n);
    setBusy(true);
    setMsg("");
    try {
      if (login) {
        await updateLogin(login.id, {
          username: user.trim(),
          password,
          kind: "elevated",
          tool: toolId,
          expiresAt,
          site: tool.site,
        });
      } else {
        await addLogin(tool.site, user.trim(), password, {
          kind: "elevated",
          tool: toolId,
          expiresAt,
        });
      }
      setPassword("");
      setMode("ready");
    } finally {
      setBusy(false);
    }
  }

  function launch() {
    const row = loginForTool(useBrowserStore.getState().logins, toolId);
    const state = expiryState(row);
    if (!row) {
      setMode("form");
      setMsg("Save an admin account first.");
      return;
    }
    if (state.state === "expired") {
      setUser(row.username);
      setMode("form");
      setMsg("The saved password is past its expiry. Reset it in Entra / AD, then save the new password.");
      return;
    }
    if (!row.password) {
      setUser(row.username);
      setMode("form");
      setMsg("Unlock the vault or enter the password again to launch.");
      return;
    }
    setMode("queued");
  }

  function commandFor(userId: string) {
    return launchCommand(toolId, userId, {
      computer,
      mode: launchMode,
      folder: scriptFolder,
    });
  }

  function copyCommand() {
    const id = login?.username ?? user;
    if (!id) return;
    navigator.clipboard?.writeText(commandFor(id)).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 text-[var(--fg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-medium">{tool.label}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
          Opens on the County Windows image as an account that is not the signed-in desk user. Credentials stay in this
          employee’s vault — never in a .ps1 file.
        </p>

        {pinHash && !unlocked ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await unlockVault(pin);
              setPinError(ok ? "" : "That PIN does not match this vault.");
              if (ok) setPin("");
            }}
          >
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <Lock className="size-4 text-[var(--accent)]" />
              Unlock vault to use the saved admin account
            </div>
            <Input
              type="password"
              autoComplete="off"
              placeholder="Vault PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            {pinError ? <p className="text-[12px] text-[var(--muted)]">{pinError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Unlock</Button>
            </div>
          </form>
        ) : mode === "queued" && login ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-[var(--btn)] px-4 py-3">
              <div className="text-[11px] tracking-wide text-[var(--muted)] uppercase">Queued as</div>
              <div className="mt-0.5 font-mono text-[14px]">{login.username}</div>
              {toolId === "cmrc" && computer.trim() ? (
                <div className="mt-1 text-[12px] text-[var(--muted)]">Target {computer.trim()}</div>
              ) : null}
            </div>
            <p className="text-[12px] leading-relaxed text-[var(--muted)]">
              {launchMode === "inline"
                ? "This preview cannot start Windows apps. On the County image the browser runs encoded PowerShell in memory and pipes the vault password on stdin — no file on C: or anywhere else."
                : "This preview cannot start Windows apps. On the County image the browser runs the saved .ps1 from the folder in Settings and pipes the vault password on stdin — never as a command-line argument, never saved in the file."}
            </p>
            <pre className="overflow-x-auto rounded-lg bg-[var(--addr)] px-3 py-2 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-[var(--fg)]">
              {launchMode === "inline"
                ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand …`
                : commandFor(login.username)}
            </pre>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button type="button" variant="outline" onClick={copyCommand}>
                {copied ? "Copied" : "Copy command"}
              </Button>
              {launchMode === "file" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadElevatedScript(toolId, scriptFolder)}
                >
                  <Download className="size-4" />
                  {scriptFileName(toolId)}
                </Button>
              ) : null}
            </div>
          </div>
        ) : mode === "ready" && login ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-[var(--btn)] px-4 py-3">
              <div className="text-[11px] tracking-wide text-[var(--muted)] uppercase">Launch as</div>
              <div className="mt-0.5 font-mono text-[14px]">{login.username}</div>
              <div className="mt-1 text-[12px] text-[var(--muted)]">
                {expiry.state === "expired"
                  ? "Password marked expired — update it before launch."
                  : expiry.state === "soon"
                    ? `Password due in ${expiry.days} day${expiry.days === 1 ? "" : "s"} (${formatExpiry(login.expiresAt)}).`
                    : `Password stored until ${formatExpiry(login.expiresAt)}.`}
              </div>
            </div>
            {toolId === "cmrc" ? (
              <Input
                placeholder="Target computer (optional)"
                autoComplete="off"
                value={computer}
                onChange={(e) => setComputer(e.target.value)}
              />
            ) : null}
            <p className="text-[12px] leading-relaxed text-[var(--muted)]">
              {launchMode === "inline"
                ? "On the desk image this runs PowerShell in memory as that account. Nothing is written to C:\\Scripts or any other folder."
                : `On the desk image this runs ${filePath} as that account. Change the folder in Settings → Passwords. Do not put the password in the file.`}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setUser(login.username);
                  setPassword("");
                  setMode("form");
                }}
              >
                {expiry.state === "expired" || expiry.state === "soon" ? "Update password" : "Different account"}
              </Button>
              {launchMode === "file" ? (
                <Button type="button" variant="outline" onClick={() => downloadElevatedScript(toolId, scriptFolder)}>
                  <Download className="size-4" />
                  Script
                </Button>
              ) : null}
              <Button type="button" onClick={launch} disabled={expiry.state === "expired"}>
                <Play className="size-4" />
                Launch as {login.username.split("\\").pop()}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {(expiry.state === "expired" || expiry.state === "soon") && login ? (
              <p className="rounded-lg bg-[var(--btn)] px-3 py-2 text-[12px] text-[var(--muted)]">
                {expiry.state === "expired"
                  ? "The saved password is past its expiry. Reset it in Entra / AD, then enter the new password here."
                  : `This password expires in ${expiry.days} day${expiry.days === 1 ? "" : "s"}. Update it if you already reset it.`}
              </p>
            ) : null}
            <Input
              placeholder="User ID (DOMAIN\\id or id)"
              autoComplete="off"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                autoComplete="off"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
              />
              <button
                type="button"
                className="absolute top-1 right-1 grid size-8 place-items-center rounded-md hover:bg-[var(--btn)]"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <label className="block text-[12px] text-[var(--muted)]">
              Treat as valid for (days)
              <Input
                className="mt-1"
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </label>
            {msg ? <p className="text-[12px] text-[var(--muted)]">{msg}</p> : null}
            <p className="text-[11px] leading-relaxed text-[var(--muted)]">
              This browser cannot test the password against County AD. After a County reset, save the new password here.
              {launchMode === "inline"
                ? " Launch runs encoded PowerShell in memory — no C:\\Scripts folder."
                : ` ${filePath} on the image reads identity from this vault over stdin.`}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              {login && expiry.state !== "expired" ? (
                <Button type="button" variant="outline" onClick={() => setMode("ready")}>
                  Use saved account
                </Button>
              ) : null}
              <Button type="submit" disabled={busy}>
                <KeyRound className="size-4" />
                {login ? "Save and continue" : "Save account"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
