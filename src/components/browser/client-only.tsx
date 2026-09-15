import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

export function ClientOnly({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  if (!ready) return <div className="h-dvh bg-[#0b0d10]" />;
  return <>{children}</>;
}
