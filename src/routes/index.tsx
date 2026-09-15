import { createFileRoute } from "@tanstack/react-router";
import { BrowserApp } from "@/components/browser/app";
import { ClientOnly } from "@/components/browser/client-only";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <ClientOnly>
      <BrowserApp />
    </ClientOnly>
  );
}
