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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
