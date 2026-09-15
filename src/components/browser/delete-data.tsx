import { useState } from "react";
import { useBrowserStore } from "@/lib/browser/store";
import type { ClearRange } from "@/lib/browser/types";
import { Button } from "@/components/ui/button";

const RANGES: { id: ClearRange; label: string }[] = [
  { id: "hour", label: "Last hour" },
  { id: "day", label: "Last 24 hours" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "Last 4 weeks" },
  { id: "all", label: "All time" },
];

export function DeleteDataDialog() {
  const open = useBrowserStore((s) => s.deleteDialogOpen);
  const setOpen = useBrowserStore((s) => s.setDeleteDialogOpen);
  const clear = useBrowserStore((s) => s.deleteBrowsingData);
  const [range, setRange] = useState<ClearRange>("hour");
  const [history, setHistory] = useState(true);
  const [downloads, setDownloads] = useState(true);
  const [cookies, setCookies] = useState(true);
  const [cache, setCache] = useState(true);
  const [passwords, setPasswords] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-labelledby="clear-title"
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 text-[var(--fg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="clear-title" className="text-lg font-semibold tracking-tight">
          Delete browsing data
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Clears data stored in this profile. County SSO cookies live in the system browser and are
          not removed here.
        </p>
        <label className="mt-4 block text-sm">
          Time range
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as ClearRange)}
            className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--addr)] px-2"
          >
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 flex flex-col">
          <Check label="Browsing history" checked={history} onChange={setHistory} />
          <Check label="Download history" checked={downloads} onChange={setDownloads} />
          <Check
            label="Cookies and other site data"
            hint="First-party session only. Entra cookies stay with Windows."
            checked={cookies}
            onChange={setCookies}
          />
          <Check label="Cached images and files" checked={cache} onChange={setCache} />
          <Check label="Passwords" hint="Removes this employee’s saved usernames and passwords." checked={passwords} onChange={setPasswords} />
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">Some items may be managed by your organization.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              clear({ history, downloads, passwords, range });
              setOpen(false);
            }}
          >
            Clear now
          </Button>
        </div>
      </div>
    </div>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
  locked,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 border-b border-[var(--border)] py-2.5 last:border-0">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={locked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm">{label}</span>
        {hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}
      </span>
    </label>
  );
}
