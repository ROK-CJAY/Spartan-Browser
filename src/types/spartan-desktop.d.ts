export type SpartanWindowsIdentity = {
  upn: string;
  account: string;
};

export type SpartanDesktopApi = {
  packaged: boolean;
  version: () => Promise<string>;
  checkForUpdates: () => Promise<{ ok: boolean; version?: string | null; error?: string }>;
  windowsIdentity: () => Promise<SpartanWindowsIdentity | null>;
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
