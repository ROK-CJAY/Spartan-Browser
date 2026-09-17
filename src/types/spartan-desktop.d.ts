export type SpartanWindowsIdentity = {
  upn: string;
  account: string;
};

export type DesktopLaunchResult = {
  ok: boolean;
  error?: string;
};

export type DesktopUpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "current"
  | "error";

export type DesktopUpdateStatus = {
  phase: DesktopUpdatePhase;
  currentVersion: string;
  latestVersion: string | null;
  percent: number;
  error: string | null;
  packaged?: boolean;
};

export type SpartanDesktopApi = {
  packaged: boolean;
  version: () => Promise<string>;
  windowsIdentity: () => Promise<SpartanWindowsIdentity | null>;
  launchApp: (id: string) => Promise<DesktopLaunchResult>;
  launchElevated: (payload: { command: string; password: string }) => Promise<DesktopLaunchResult>;
  getUpdateStatus: () => Promise<DesktopUpdateStatus>;
  checkForUpdates: () => Promise<DesktopUpdateStatus>;
  installUpdate: () => Promise<{ ok: boolean }>;
  onUpdateStatus: (callback: (status: DesktopUpdateStatus) => void) => () => void;
  onOpenTab: (callback: (url: string) => void) => () => void;
};

declare global {
  interface Window {
    spartanDesktop?: SpartanDesktopApi;
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          partition?: string;
          allowpopups?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
