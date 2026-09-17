import { isCountyEmail, normalizeEmail } from "./knowledge-base.ts";
import type { DesktopLaunchResult, DesktopUpdateStatus } from "@/types/spartan-desktop";

export function isSpartanDesktop() {
  return typeof window !== "undefined" && Boolean(window.spartanDesktop);
}

export async function readDesktopWindowsIdentity() {
  const api = typeof window === "undefined" ? undefined : window.spartanDesktop;
  if (!api?.windowsIdentity) return null;
  try {
    const identity = await Promise.race([
      api.windowsIdentity(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 4000)),
    ]);
    const upn = normalizeEmail(identity?.upn ?? "");
    if (!isCountyEmail(upn)) return null;
    return { upn, account: identity?.account?.trim() ?? "" };
  } catch {
    return null;
  }
}

export async function launchDesktopApp(id: string): Promise<DesktopLaunchResult> {
  const api = typeof window === "undefined" ? undefined : window.spartanDesktop;
  if (!api?.launchApp) return { ok: false, error: "Desktop launch is only available in the installed browser." };
  try {
    return await api.launchApp(id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not open that app." };
  }
}

export async function launchElevatedTool(payload: {
  command: string;
  password: string;
}): Promise<DesktopLaunchResult> {
  const api = typeof window === "undefined" ? undefined : window.spartanDesktop;
  if (!api?.launchElevated) {
    return { ok: false, error: "Desktop launch is only available in the installed browser." };
  }
  try {
    return await api.launchElevated(payload);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not start that tool." };
  }
}

export async function readDesktopUpdateStatus(): Promise<DesktopUpdateStatus | null> {
  const api = typeof window === "undefined" ? undefined : window.spartanDesktop;
  if (!api?.getUpdateStatus) return null;
  try {
    return await api.getUpdateStatus();
  } catch {
    return null;
  }
}

export function subscribeDesktopUpdates(callback: (status: DesktopUpdateStatus) => void) {
  const api = typeof window === "undefined" ? undefined : window.spartanDesktop;
  if (!api?.onUpdateStatus) return () => {};
  return api.onUpdateStatus(callback);
}

export async function checkDesktopUpdates() {
  const api = typeof window === "undefined" ? undefined : window.spartanDesktop;
  if (!api?.checkForUpdates) return null;
  return api.checkForUpdates();
}

export async function installDesktopUpdate() {
  const api = typeof window === "undefined" ? undefined : window.spartanDesktop;
  if (!api?.installUpdate) return { ok: false as const };
  return api.installUpdate();
}
