'use strict';

// Copy to electron/secrets.cjs (gitignored) before building the exe.
module.exports = {
  // EMR Viewer's YATA_LOOKUP_TOKEN: lets the app ask emr.codex074.com for a patient's name by HN.
  emrLookupToken: 'REPLACE_WITH_EMR_YATA_LOOKUP_TOKEN',
};
