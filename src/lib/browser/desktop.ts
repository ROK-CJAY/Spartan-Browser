import { isCountyEmail, normalizeEmail } from "./knowledge-base.ts";

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
