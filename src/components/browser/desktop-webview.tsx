import { useEffect, useRef } from "react";
import { useBrowserStore } from "@/lib/browser/store";

type WebviewEl = HTMLElement & {
  src: string;
  getURL?: () => string;
};

export function DesktopWebview({ url, reloadKey }: { url: string; title: string; reloadKey: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<WebviewEl | null>(null);
  const lastUrl = useRef(url);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = document.createElement("webview") as WebviewEl;
    view.setAttribute("partition", "persist:spartan");
    view.setAttribute("allowpopups", "true");
    view.setAttribute(
      "useragent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    );
    view.setAttribute("src", url);
    view.style.width = "100%";
    view.style.height = "100%";
    view.style.border = "0";
    view.style.display = "flex";
    view.style.flex = "1";
    host.replaceChildren(view);
    viewRef.current = view;
    lastUrl.current = url;

    const syncUrl = (next: string) => {
      if (!next || next === lastUrl.current) return;
      lastUrl.current = next;
      const current = useBrowserStore.getState().activeTab().url;
      if (current !== next) useBrowserStore.getState().navigate(next);
    };

    const onNavigate = (event: Event) => {
      const next = (event as Event & { url?: string }).url ?? view.getURL?.();
      if (next) syncUrl(next);
    };
    const onTitle = (event: Event) => {
      const title = (event as Event & { title?: string }).title?.trim();
      if (title) useBrowserStore.getState().setTabTitle(title);
    };

    view.addEventListener("did-navigate", onNavigate);
    view.addEventListener("did-navigate-in-page", onNavigate);
    view.addEventListener("page-title-updated", onTitle);

    return () => {
      view.removeEventListener("did-navigate", onNavigate);
      view.removeEventListener("did-navigate-in-page", onNavigate);
      view.removeEventListener("page-title-updated", onTitle);
      viewRef.current = null;
      host.replaceChildren();
    };
    // Recreate only on explicit reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || url === lastUrl.current) return;
    lastUrl.current = url;
    view.setAttribute("src", url);
  }, [url]);

  return <div ref={hostRef} className="h-full w-full bg-white" />;
}
