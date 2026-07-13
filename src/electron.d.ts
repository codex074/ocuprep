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
    /** true when HOSxP could not be reached or answered with a non-200 status
     *  (e.g. an expired embedded token) — distinct from a genuine "not found". */
    failure?: boolean;
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
   *  by the program (independent of the machine's printer default). If a label
   *  printer is saved in settings, prints silently to it; otherwise shows the
   *  print dialog. Resolves ok:false if cancelled or the job fails. */
  printLabels: (html: string) => Promise<{ ok: boolean; message?: string; silentPrinter?: string }>;
  /** List installed printers and the currently saved label printer ('' = ask
   *  via print dialog every time). */
  getLabelPrinterSettings: () => Promise<{
    printers: { name: string; isDefault: boolean }[];
    labelPrinter: string;
    warning?: string;
  }>;
  /** Save the label printer used for silent printing ('' to always ask). */
  saveLabelPrinter: (name: string) => Promise<{ ok: true }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
