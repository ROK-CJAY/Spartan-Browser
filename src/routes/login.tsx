import { createFileRoute } from "@tanstack/react-router";
import { Monitor } from "lucide-react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#0b0d10] px-6 text-[#e8eef2]">
      <div className="w-full max-w-sm">
        <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-[#1a8fb8] text-[#0b0d10]">
          <Monitor className="size-5" />
        </div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">Help Desk Browser</h1>
        <p className="mt-2 mb-6 text-sm leading-relaxed text-[#8b96a3]">
          Staff identity is the Windows / Entra account already logged onto this County PC. There is no Google, X, or
          extra email sign-in. Open Workspace and bind this desk under Profiles.
        </p>
        <a
          href="/"
          className="grid h-11 w-full place-items-center rounded-xl border border-white/12 bg-[#161b22] px-4 text-sm font-medium hover:bg-[#1c222b]"
        >
          Open the desk
        </a>
      </div>
    </main>
  );
}
