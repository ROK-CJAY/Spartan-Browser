import { createFileRoute } from "@tanstack/react-router";
import { letterResponse, resolveFavicon, sanitizeFaviconHost } from "@/lib/browser/favicon-proxy";

export const Route = createFileRoute("/api/favicon")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = sanitizeFaviconHost(new URL(request.url).searchParams.get("host"));
        if (!host) return letterResponse("?");
        return resolveFavicon(host);
      },
    },
  },
});
