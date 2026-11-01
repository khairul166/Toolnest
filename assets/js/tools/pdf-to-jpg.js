/**
 * ToolNest - PDF to JPG / PNG Converter (/assets/js/tools/pdf-to-jpg.js)
 * 100% Client-Side PDF Page Renderer powered by Mozilla pdf.js 3.11.174 and JSZip 3.10.1.
 * Renders pages sequentially one at a time with 1x/2x/3x scale, page range filtering,
 * password-protected PDF detection, thumbnail grid, and single/ZIP export.
 */
(function () {
  'use strict';

  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let currentPdfFile = null;
  let currentPdfDoc = null;
  let totalPageCount = 0;
  // Array of { pageNumber, outputName, width, height, size, blob, previewUrl }
  let renderedPages = [];

  /**
   * Parse a page range string like "1-3, 5" into a sorted array of 1-based page numbers
   */
  function parsePageRange(rangeStr, maxPages) {
    const clean = (rangeStr || '').trim();
    if (!clean) {
      const all = [];
      for (let p = 1; p <= maxPages; p++) all.push(p);
      return all;
    }

    const pagesSet = new Set();
    const parts = clean.split(',');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;
      if (part.includes('-')) {
        const bounds = part.split('-').map(function (s) {
          return parseInt(s.trim(), 10);
        });
        const start = bounds[0];
        const end = bounds[1];
        if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
          for (let p = start; p <= Math.min(end, maxPages); p++) {
            pagesSet.add(p);
          }
        }
      } else {
        const single = parseInt(part, 10);
        if (Number.isInteger(single) && single >= 1 && single <= maxPages) {
          pagesSet.add(single);
        }
      }
    }

    return Array.from(pagesSet).sort(function (a, b) {
      return a - b;
    });
  }

  /**
   * Build a valid 3-page minimal PDF in memory so users can test multi-page PDF to JPG immediately
   */
  function createSampleThreePagePdfFile() {
    const lines = [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 6 0 R >> >> /Contents 7 0 R >> endobj',
      '4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 6 0 R >> >> /Contents 8 0 R >> endobj',
      '5 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 6 0 R >> >> /Contents 9 0 R >> endobj',
      '6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj',
      '7 0 obj << /Length 138 >> stream\n0.14 0.39 0.92 rg 40 640 532 100 re f 1 1 1 rg BT /F1 26 Tf 75 680 Td (ToolNest Sample PDF - Page 1) Tj ET 0.1 0.15 0.25 rg BT /F1 18 Tf 75 560 Td (100% Client-Side PDF to JPG Conversion) Tj ET\nendstream endobj',
      '8 0 obj << /Length 138 >> stream\n0.08 0.64 0.29 rg 40 640 532 100 re f 1 1 1 rg BT /F1 26 Tf 75 680 Td (ToolNest Sample PDF - Page 2) Tj ET 0.1 0.15 0.25 rg BT /F1 18 Tf 75 560 Td (High-Resolution 1x, 2x, 3x Scale Export) Tj ET\nendstream endobj',
      '9 0 obj << /Length 138 >> stream\n0.96 0.62 0.04 rg 40 640 532 100 re f 1 1 1 rg BT /F1 26 Tf 75 680 Td (ToolNest Sample PDF - Page 3) Tj ET 0.1 0.15 0.25 rg BT /F1 18 Tf 75 560 Td (Download Single Pages or Full ZIP Archive) Tj ET\nendstream endobj'
    ];

    let body = '';
    const offsets = [0];
    lines.forEach(function (l) {
      offsets.push(body.length);
      body += l + '\n';
    });
    const xrefStart = body.length;
    body += 'xref\n0 ' + offsets.length + '\n0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i++) {
      body += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    body += 'trailer << /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF';

    const blob = new Blob([body], { type: 'application/pdf' });
    return new File([blob], 'toolnest-sample-brochure-3pages.pdf', { type: 'application/pdf' });
  }

  function cleanupRenderedPages() {
    renderedPages.forEach(function (p) {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    renderedPages = [];
  }

  // Expose helper for automated verification
  if (typeof window !== 'undefined') {
    window.ToolNestPdfToJpg = {
      parsePageRange: parsePageRange,
      createSampleThreePagePdfFile: createSampleThreePagePdfFile
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-p2j-dropzone');
    const fileInput = document.getElementById('tn-p2j-file-input');
    const fileInfoBar = document.getElementById('tn-p2j-file-info');
    const fileNameLabel = document.getElementById('tn-p2j-file-name');
    const pageCountBadge = document.getElementById('tn-p2j-page-count');

    const formatSelect = document.getElementById('tn-p2j-format');
    const scaleSelect = document.getElementById('tn-p2j-scale');
    const qualitySlider = document.getElementById('tn-p2j-quality');
    const qualityVal = document.getElementById('tn-p2j-quality-val');
    const rangeModeSelect = document.getElementById('tn-p2j-range-mode');
    const rangeInputWrap = document.getElementById('tn-p2j-range-wrap');
    const rangeInput = document.getElementById('tn-p2j-range-input');

    const convertBtn = document.getElementById('tn-p2j-convert-btn');
    const sampleBtn = document.getElementById('tn-p2j-sample-btn');
    const resetBtn = document.getElementById('tn-p2j-reset-btn');
    const dlZipBtn = document.getElementById('tn-p2j-dl-zip');

    const errorAlert = document.getElementById('tn-p2j-error-alert');
    const progressWrap = document.getElementById('tn-p2j-progress-wrap');
    const progressText = document.getElementById('tn-p2j-progress-text');
    const progressBar = document.getElementById('tn-p2j-progress-bar');

    const resultsWrap = document.getElementById('tn-p2j-results-wrap');
    const summaryText = document.getElementById('tn-p2j-summary-text');
    const pagesGrid = document.getElementById('tn-p2j-pages-grid');

    if (!dropzone || !fileInput) return;

    function configurePdfWorker() {
      if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      }
    }

    function showError(msg) {
      if (!errorAlert) return;
      if (!msg) {
        errorAlert.classList.add('d-none');
        errorAlert.textContent = '';
      } else {
        errorAlert.classList.remove('d-none');
        errorAlert.innerHTML = '<i class="bi bi-shield-exclamation me-1" aria-hidden="true"></i> ' + window.ToolNest.escapeHtml(msg);
      }
    }

    qualitySlider.addEventListener('input', function () {
      qualityVal.textContent = qualitySlider.value + '%';
    });

    formatSelect.addEventListener('change', function () {
      qualitySlider.disabled = formatSelect.value === 'image/png';
    });

    rangeModeSelect.addEventListener('change', function () {
      rangeInputWrap.classList.toggle('d-none', rangeModeSelect.value !== 'custom');
    });

    async function loadSelectedPdf(file) {
      showError('');
      cleanupRenderedPages();
      resultsWrap.classList.add('d-none');

      if (!file || (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf')) {
        showError('Please select a valid PDF file (.pdf).');
        return;
      }

      configurePdfWorker();
      if (!window.pdfjsLib || !window.pdfjsLib.getDocument) {
        showError('PDF rendering engine (pdf.js) is still loading. Please try again in a moment.');
        return;
      }

      try {
        const arrayBuf = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuf });
        const pdfDoc = await loadingTask.promise;

        currentPdfFile = file;
        currentPdfDoc = pdfDoc;
        totalPageCount = pdfDoc.numPages;

        fileInfoBar.classList.remove('d-none');
        fileNameLabel.textContent = file.name + ' (' + window.ToolNest.formatBytes(file.size) + ')';
        pageCountBadge.textContent = totalPageCount + ' Page(s) Detected';
        if (rangeInput) {
          rangeInput.placeholder = 'e.g. 1-' + totalPageCount;
        }

        await renderSelectedPages();
      } catch (err) {
        currentPdfDoc = null;
        fileInfoBar.classList.add('d-none');
        if (err && (err.name === 'PasswordException' || /password/i.test(err.message || ''))) {
          showError(
            'This PDF is password-protected. Please unlock or remove the password from the PDF before converting pages to JPG.'
          );
        } else {
          showError('Could not read PDF file: ' + (err.message || 'Corrupted or unsupported PDF document.'));
        }
      }
    }

    async function renderSinglePageToBlob(pdfDoc, pageNum, scale, mime, quality, baseFileName) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      const ext = mime === 'image/png' ? '.png' : '.jpg';
      const outName = baseFileName + '-page-' + String(pageNum).padStart(2, '0') + ext;

      return new Promise(function (resolve, reject) {
        canvas.toBlob(
          function (blob) {
            if (!blob) {
              reject(new Error('Failed to encode page ' + pageNum));
              return;
            }
            resolve({
              pageNumber: pageNum,
              outputName: outName,
              width: canvas.width,
              height: canvas.height,
              size: blob.size,
              blob: blob,
              previewUrl: URL.createObjectURL(blob)
            });
          },
          mime,
          mime === 'image/png' ? undefined : quality
        );
      });
    }

    function renderThumbnailsGrid() {
      if (renderedPages.length === 0) {
        resultsWrap.classList.add('d-none');
        return;
      }
      resultsWrap.classList.remove('d-none');

      let totalBytes = 0;
      pagesGrid.innerHTML = renderedPages
        .map(function (item, idx) {
          totalBytes += item.size;
          return (
            '<div class="col-12 col-sm-6 col-md-4">' +
            '<div class="p-3 border rounded-3 bg-white h-100 shadow-sm d-flex flex-column justify-content-between">' +
            '<div class="d-flex justify-content-between align-items-center mb-2">' +
            '<span class="badge bg-primary">Page ' +
            item.pageNumber +
            '</span>' +
            '<span class="small text-muted">' +
            window.ToolNest.formatBytes(item.size) +
            '</span>' +
            '</div>' +
            '<div class="text-center p-2 bg-light rounded border mb-2">' +
            '<img src="' +
            item.previewUrl +
            '" alt="Page ' +
            item.pageNumber +
            ' preview" class="img-fluid rounded" style="max-height: 190px;" loading="lazy">' +
            '</div>' +
            '<div>' +
            '<div class="small text-muted mb-2">' +
            item.width +
            ' &times; ' +
            item.height +
            ' px</div>' +
            '<button type="button" class="btn tn-btn--primary btn-sm w-100" data-dl-page="' +
            idx +
            '">' +
            '<i class="bi bi-download" aria-hidden="true"></i> Download Page ' +
            item.pageNumber +
            '</button>' +
            '</div>' +
            '</div>' +
            '</div>'
          );
        })
        .join('');

      summaryText.innerHTML =
        'Rendered <strong>' +
        renderedPages.length +
        ' page(s)</strong> &bull; Total Image Output: <strong>' +
        window.ToolNest.formatBytes(totalBytes) +
        '</strong>';

      pagesGrid.querySelectorAll('[data-dl-page]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-dl-page'));
          if (renderedPages[i]) {
            window.ToolNest.downloadBlob(renderedPages[i].blob, renderedPages[i].outputName);
          }
        });
      });
    }

    async function renderSelectedPages() {
      showError('');
      if (!currentPdfDoc || !currentPdfFile) {
        window.ToolNest.showToast('Please upload a PDF file first.', 'warning');
        return;
      }

      const pagesToRender =
        rangeModeSelect.value === 'custom'
          ? parsePageRange(rangeInput.value, totalPageCount)
          : parsePageRange('', totalPageCount);

      if (pagesToRender.length === 0) {
        showError('No valid page numbers matched your range (1 to ' + totalPageCount + ').');
        return;
      }

      cleanupRenderedPages();
      const mime = formatSelect.value || 'image/jpeg';
      const scale = parseFloat(scaleSelect.value) || 2;
      const quality = Math.min(1, Math.max(0.1, Number(qualitySlider.value) / 100));
      const baseName = currentPdfFile.name.replace(/\.pdf$/i, '');

      progressWrap.classList.remove('d-none');
      progressBar.style.width = '5%';
      progressBar.textContent = '0 / ' + pagesToRender.length;

      try {
        // Render sequentially one page at a time to handle large PDFs without browser memory spikes
        for (let i = 0; i < pagesToRender.length; i++) {
          const pageNo = pagesToRender[i];
          progressText.textContent = 'Rendering page ' + pageNo + ' (' + (i + 1) + ' of ' + pagesToRender.length + ')...';
          const pageItem = await renderSinglePageToBlob(currentPdfDoc, pageNo, scale, mime, quality, baseName);
          renderedPages.push(pageItem);

          const pct = Math.round(((i + 1) / pagesToRender.length) * 100);
          progressBar.style.width = pct + '%';
          progressBar.textContent = pct + '%';
        }

        setTimeout(function () {
          progressWrap.classList.add('d-none');
        }, 300);

        renderThumbnailsGrid();
        window.ToolNest.showToast('Converted ' + renderedPages.length + ' PDF page(s) to images!', 'success');
      } catch (err) {
        progressWrap.classList.add('d-none');
        showError(err.message || 'Error while rendering PDF pages.');
      }
    }

    window.ToolNest.setupDropzone(dropzone, fileInput, function (files) {
      if (files && files[0]) {
        loadSelectedPdf(files[0]);
      }
    });

    if (convertBtn) {
      convertBtn.addEventListener('click', renderSelectedPages);
    }

    if (sampleBtn) {
      sampleBtn.addEventListener('click', function () {
        const samplePdf = createSampleThreePagePdfFile();
        loadSelectedPdf(samplePdf);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        currentPdfFile = null;
        currentPdfDoc = null;
        totalPageCount = 0;
        fileInput.value = '';
        showError('');
        cleanupRenderedPages();
        fileInfoBar.classList.add('d-none');
        resultsWrap.classList.add('d-none');
      });
    }

    if (dlZipBtn) {
      dlZipBtn.addEventListener('click', function () {
        if (renderedPages.length === 0) return;
        if (typeof window.JSZip === 'function') {
          const zip = new window.JSZip();
          renderedPages.forEach(function (p) {
            zip.file(p.outputName, p.blob);
          });
          zip.generateAsync({ type: 'blob' }).then(function (zipBlob) {
            const zipName = (currentPdfFile ? currentPdfFile.name.replace(/\.pdf$/i, '') : 'pdf') + '-pages.zip';
            window.ToolNest.downloadBlob(zipBlob, zipName);
            window.ToolNest.showToast('Downloaded ZIP with ' + renderedPages.length + ' page images!', 'success');
          });
        } else {
          renderedPages.forEach(function (p, idx) {
            setTimeout(function () {
              window.ToolNest.downloadBlob(p.blob, p.outputName);
            }, idx * 220);
          });
        }
      });
    }
  });
})();
