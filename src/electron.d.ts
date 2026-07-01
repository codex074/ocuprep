interface HnPatient {
  fullName: string;
  hn: string;
  vn?: string;
  qn?: string;
  pname?: string;
  fname?: string;
  lname?: string;
  source?: string;
}

interface ElectronAPI {
  lookupHN: (hn: string) => Promise<{
    ok: boolean;
    patient?: HnPatient;
    message?: string;
  }>;
  getHnSettings: () => Promise<{
    hosxpApiUrl: string;
    hasToken: boolean;
    hasTokenHis: boolean;
  }>;
  saveHnSettings: (settings: {
    hosxpApiUrl: string;
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
  /** Print a full HTML document as 8.5×6cm labels with the page size locked
   *  by the program (independent of the machine's printer default). Shows the
   *  print dialog for printer selection; resolves ok:false if cancelled. */
  printLabels: (html: string) => Promise<{ ok: boolean; message?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
