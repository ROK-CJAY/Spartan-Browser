import { isCountyEmail, normalizeEmail } from "./knowledge-base.ts";
import type { DesktopUpdateStatus } from "@/types/spartan-desktop";

export function isSpartanDesktop() {
  return typeof window !== "undefined" && Boolean(window.spartanDesktop?.packaged);
}

export async function readDesktopWindowsIdentity() {
  const api = typeof window === "undefined" ? undefined : window.spartanDesktop;
  if (!api?.windowsIdentity) return null;
  try {
    const identity = await api.windowsIdentity();
    const upn = normalizeEmail(identity?.upn ?? "");
    if (!isCountyEmail(upn)) return null;
    return { upn, account: identity?.account?.trim() ?? "" };
  } catch {
    return null;
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
