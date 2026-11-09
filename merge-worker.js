/* merge-worker.js — Offloads PDF merging completely to Web Worker */
'use strict';

let PDFLibInstance = null;
let isCancelled = false;

self.addEventListener('message', async (e) => {
  const data = e.data;
  if (!data) return;

  if (data.type === 'cancel') {
    isCancelled = true;
    return;
  }

  if (data.type === 'merge') {
    isCancelled = false;
    const { files, libUrl } = data;

    try {
      // Lazy-load local pdf-lib inside the worker
      if (!PDFLibInstance) {
        if (typeof PDFLib !== 'undefined') {
          PDFLibInstance = PDFLib;
        } else {
          try {
            importScripts(libUrl || '/lib/pdf-lib.min.js');
            PDFLibInstance = self.PDFLib;
          } catch (importErr) {
            self.postMessage({ type: 'error', message: 'Failed to load pdf-lib: ' + importErr.message });
            return;
          }
        }
      }

      const { PDFDocument } = PDFLibInstance;
      const merged = await PDFDocument.create();
      const skipped = [];
      const total = files.length;

      for (let i = 0; i < total; i++) {
        if (isCancelled) {
          self.postMessage({ type: 'cancelled' });
          return;
        }

        const item = files[i];
        self.postMessage({
          type: 'progress',
          current: i + 1,
          total,
          fileName: item.name
        });

        try {
          // Load document with ignoreEncryption: true
          const src = await PDFDocument.load(item.buffer, {
            ignoreEncryption: true,
            updateMetadata: false
          });

          const indices = src.getPageIndices();
          if (indices.length > 0) {
            const copiedPages = await merged.copyPages(src, indices);
            for (let j = 0; j < copiedPages.length; j++) {
              merged.addPage(copiedPages[j]);
            }
          }
        } catch (fileErr) {
          console.warn('[merge-worker] Skipped file due to error:', item.name, fileErr.message);
          skipped.push({ name: item.name, reason: fileErr.message || 'Corrupt or password protected' });
        }
      }

      if (isCancelled) {
        self.postMessage({ type: 'cancelled' });
        return;
      }

      self.postMessage({
        type: 'progress',
        current: total,
        total,
        fileName: 'Optimizing and saving document…'
      });

      // Save with useObjectStreams: true for smaller output
      const mergedBytes = await merged.save({ useObjectStreams: true });

      self.postMessage({
        type: 'done',
        buffer: mergedBytes.buffer,
        pageCount: merged.getPageCount(),
        skipped: skipped.map(s => s.name)
      }, [mergedBytes.buffer]);

    } catch (err) {
      self.postMessage({ type: 'error', message: err.message || 'Merge failed' });
    }
  }
});
