interface ElectronAPI {
  saveHnSettings: (settings: {
    updateManifestUrl?: string;
  }) => Promise<{ ok: true }>;
  getAppInfo: () => Promise<{
    version: string;
    updateManifestUrl: string;
    packaged: boolean;
  }>;
  checkForUpdates: () => Promise<{
    ok: boolean;
    updateAvailable?: boolean;
    version?: string;
    message?: string;
  }>;
  /** Print a full HTML document as 8.5×6cm labels with the page size locked by the
   *  program (independent of the machine's printer default). Always shows the print
   *  dialog — silent printing was removed on 2026-07-13 because it rotated every
   *  label 90° on the ZD230 fleet (see Audit.md). Resolves ok:false if cancelled or
   *  the job fails. */
  printLabels: (html: string) => Promise<{ ok: boolean; message?: string }>;
  /** Print a full HTML document as a 7.5×3.5cm compact IPD label, same dialog-only
   *  discipline as printLabels. The pageSize/landscape DEVMODE pairing is derived by
   *  convention from the validated 8.5×6cm case but has NOT been physically validated
   *  on a real printer yet (see Audit.md). */
  printCompactLabel: (html: string) => Promise<{ ok: boolean; message?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
