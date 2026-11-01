/**
 * ToolNest - PDF Merge & Split (/assets/js/tools/pdf-merge-split.js)
 * 100% Client-Side PDF Merger, Page Reorderer, and Range Splitter powered by pdf-lib 1.17.1
 */
(function () {
  'use strict';

  // Stores individual page items across all uploaded PDFs:
  // { id, fileName, fileBuffer, pageIndex (0-based), originalPageNum (1-based), totalInSource, selected }
  let pageItems = [];
  let nextId = 1;

  /**
   * Parse a 1-based page range string such as "1-3, 5, 2" against pageItems.length
   */
  function parsePageRange(rangeStr, maxPages) {
    if (!rangeStr || !rangeStr.trim()) {
      const all = [];
      for (let i = 1; i <= maxPages; i++) all.push(i);
      return all;
    }

    const result = [];
    const tokens = rangeStr.split(',');
    for (let t = 0; t < tokens.length; t++) {
      const part = tokens[t].trim();
      if (!part) continue;
      if (part.includes('-')) {
        const bounds = part.split('-').map(function (s) {
          return parseInt(s.trim(), 10);
        });
        const start = bounds[0];
        const end = bounds[1];
        if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= 1) {
          const step = start <= end ? 1 : -1;
          for (let p = start; step > 0 ? p <= end : p >= end; p += step) {
            if (p >= 1 && p <= maxPages) result.push(p);
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (Number.isInteger(num) && num >= 1 && num <= maxPages) {
          result.push(num);
        }
      }
    }
    return result;
  }

  async function generateSamplePdfs() {
    if (!window.PDFLib) {
      throw new Error('PDF library is still loading. Please try again in a moment.');
    }
    const PDFDocument = window.PDFLib.PDFDocument;
    const rgb = window.PDFLib.rgb;
    const StandardFonts = window.PDFLib.StandardFonts;

    const docA = await PDFDocument.create();
    const fontA = await docA.embedFont(StandardFonts.HelveticaBold);
    for (let i = 1; i <= 3; i++) {
      const p = docA.addPage([595, 842]);
      p.drawRectangle({ x: 40, y: 720, width: 515, height: 70, color: rgb(0.145, 0.388, 0.921) });
      p.drawText('ToolNest Sample Document A - Page ' + i + ' of 3', {
        x: 60,
        y: 748,
        size: 18,
        font: fontA,
        color: rgb(1, 1, 1)
      });
      p.drawText('100% Client-Side PDF Merge, Page Reorder, and Range Split Test Page.', {
        x: 60,
        y: 660,
        size: 13,
        font: fontA,
        color: rgb(0.1, 0.15, 0.25)
      });
    }
    const bytesA = await docA.save();

    const docB = await PDFDocument.create();
    const fontB = await docB.embedFont(StandardFonts.HelveticaBold);
    for (let j = 1; j <= 2; j++) {
      const p2 = docB.addPage([595, 842]);
      p2.drawRectangle({ x: 40, y: 720, width: 515, height: 70, color: rgb(0.96, 0.62, 0.04) });
      p2.drawText('ToolNest Sample Document B - Page ' + j + ' of 2', {
        x: 60,
        y: 748,
        size: 18,
        font: fontB,
        color: rgb(0.06, 0.09, 0.16)
      });
      p2.drawText('Combine multiple PDFs or extract custom page ranges without uploading.', {
        x: 60,
        y: 660,
        size: 13,
        font: fontB,
        color: rgb(0.1, 0.15, 0.25)
      });
    }
    const bytesB = await docB.save();

    return [
      new File([bytesA], 'sample-proposal-3pages.pdf', { type: 'application/pdf' }),
      new File([bytesB], 'sample-appendix-2pages.pdf', { type: 'application/pdf' })
    ];
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-pdf-dropzone');
    const fileInput = document.getElementById('tn-pdf-file-input');
    const pagesContainer = document.getElementById('tn-pdf-pages-list');
    const workspacePanel = document.getElementById('tn-pdf-workspace-panel');
    const totalBadge = document.getElementById('tn-pdf-total-badge');
    const rangeInput = document.getElementById('tn-pdf-range-input');
    const btnMergeAll = document.getElementById('tn-pdf-merge-btn');
    const btnSplitRange = document.getElementById('tn-pdf-split-btn');
    const btnReverseOrder = document.getElementById('tn-pdf-reverse-btn');
    const btnSample = document.getElementById('tn-pdf-sample-btn');
    const btnClear = document.getElementById('tn-pdf-clear-btn');
    const progressWrap = document.getElementById('tn-pdf-progress-wrap');
    const progressBar = document.getElementById('tn-pdf-progress-bar');

    if (!dropzone || !fileInput) return;

    function renderPageList() {
      if (pageItems.length === 0) {
        workspacePanel.classList.add('d-none');
        pagesContainer.innerHTML = '';
        return;
      }

      workspacePanel.classList.remove('d-none');
      totalBadge.textContent = pageItems.length + ' Total Page(s) Loaded';

      pagesContainer.innerHTML = pageItems
        .map(function (item, idx) {
          const pos = idx + 1;
          return (
            '<div class="d-flex flex-wrap align-items-center justify-content-between gap-2 p-2 mb-2 rounded border bg-white">' +
            '<div class="d-flex align-items-center gap-2">' +
            '<span class="badge bg-primary rounded-pill px-2 py-1">#' +
            pos +
            '</span>' +
            '<div>' +
            '<div class="fw-bold small text-break">' +
            window.ToolNest.escapeHtml(item.fileName) +
            '</div>' +
            '<div class="text-muted" style="font-size:0.8rem;">Source Page ' +
            item.originalPageNum +
            ' of ' +
            item.totalInSource +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="d-flex align-items-center gap-1">' +
            '<button type="button" class="btn tn-btn--outline btn-sm py-1 px-2" data-move-up="' +
            idx +
            '" ' +
            (idx === 0 ? 'disabled' : '') +
            ' aria-label="Move page up">' +
            '<i class="bi bi-arrow-up" aria-hidden="true"></i>' +
            '</button>' +
            '<button type="button" class="btn tn-btn--outline btn-sm py-1 px-2" data-move-down="' +
            idx +
            '" ' +
            (idx === pageItems.length - 1 ? 'disabled' : '') +
            ' aria-label="Move page down">' +
            '<i class="bi bi-arrow-down" aria-hidden="true"></i>' +
            '</button>' +
            '<button type="button" class="btn tn-btn--outline btn-sm py-1 px-2 text-danger" data-remove-idx="' +
            idx +
            '" aria-label="Remove page">' +
            '<i class="bi bi-x-lg" aria-hidden="true"></i>' +
            '</button>' +
            '</div>' +
            '</div>'
          );
        })
        .join('');

      pagesContainer.querySelectorAll('[data-move-up]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-move-up'));
          if (i > 0) {
            const temp = pageItems[i - 1];
            pageItems[i - 1] = pageItems[i];
            pageItems[i] = temp;
            renderPageList();
          }
        });
      });

      pagesContainer.querySelectorAll('[data-move-down]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-move-down'));
          if (i < pageItems.length - 1) {
            const temp = pageItems[i + 1];
            pageItems[i + 1] = pageItems[i];
            pageItems[i] = temp;
            renderPageList();
          }
        });
      });

      pagesContainer.querySelectorAll('[data-remove-idx]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-remove-idx'));
          pageItems.splice(i, 1);
          renderPageList();
        });
      });
    }

    async function addPdfFiles(files) {
      if (!window.PDFLib) {
        window.ToolNest.showToast('PDF engine is loading. Please try again.', 'warning');
        return;
      }

      progressWrap.classList.remove('d-none');
      progressBar.style.width = '25%';
      progressBar.textContent = 'Reading PDF pages...';

      try {
        for (let f = 0; f < files.length; f++) {
          const file = files[f];
          if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            window.ToolNest.showToast('Skipped non-PDF file: ' + file.name, 'warning');
            continue;
          }
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await window.PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
          const count = pdfDoc.getPageCount();

          for (let p = 0; p < count; p++) {
            pageItems.push({
              id: nextId++,
              fileName: file.name,
              fileBuffer: arrayBuffer,
              pageIndex: p,
              originalPageNum: p + 1,
              totalInSource: count
            });
          }
        }

        progressWrap.classList.add('d-none');
        renderPageList();
        window.ToolNest.showToast('Loaded ' + pageItems.length + ' total PDF page(s).', 'success');
      } catch (err) {
        progressWrap.classList.add('d-none');
        window.ToolNest.showToast('Could not parse PDF: ' + (err.message || 'Invalid file'), 'danger');
      }
    }

    async function buildPdfFromIndices(oneBasedPositions, outputFilename) {
      if (pageItems.length === 0) {
        window.ToolNest.showToast('Please upload at least one PDF first.', 'warning');
        return;
      }
      if (oneBasedPositions.length === 0) {
        window.ToolNest.showToast('No valid page numbers matched your range.', 'danger');
        return;
      }

      progressWrap.classList.remove('d-none');
      progressBar.style.width = '40%';
      progressBar.textContent = 'Assembling PDF...';

      try {
        const outDoc = await window.PDFLib.PDFDocument.create();
        const loadedDocsCache = new Map();

        for (let i = 0; i < oneBasedPositions.length; i++) {
          const pos = oneBasedPositions[i];
          const item = pageItems[pos - 1];
          if (!item) continue;

          let srcDoc = loadedDocsCache.get(item.fileBuffer);
          if (!srcDoc) {
            srcDoc = await window.PDFLib.PDFDocument.load(item.fileBuffer, { ignoreEncryption: true });
            loadedDocsCache.set(item.fileBuffer, srcDoc);
          }

          const copiedPages = await outDoc.copyPages(srcDoc, [item.pageIndex]);
          outDoc.addPage(copiedPages[0]);
        }

        progressBar.style.width = '90%';
        const pdfBytes = await outDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        window.ToolNest.downloadBlob(blob, outputFilename);

        progressWrap.classList.add('d-none');
        window.ToolNest.showToast('Downloaded ' + outputFilename + ' (' + oneBasedPositions.length + ' pages)!', 'success');
      } catch (err) {
        progressWrap.classList.add('d-none');
        window.ToolNest.showToast('Error generating PDF: ' + (err.message || 'Unknown error'), 'danger');
      }
    }

    window.ToolNest.setupDropzone(dropzone, fileInput, function (files) {
      addPdfFiles(files);
    });

    if (btnMergeAll) {
      btnMergeAll.addEventListener('click', function () {
        const allPositions = pageItems.map(function (_, idx) {
          return idx + 1;
        });
        buildPdfFromIndices(allPositions, 'toolnest-merged-document.pdf');
      });
    }

    if (btnSplitRange) {
      btnSplitRange.addEventListener('click', function () {
        const rangeStr = rangeInput ? rangeInput.value : '';
        const selectedPositions = parsePageRange(rangeStr, pageItems.length);
        buildPdfFromIndices(selectedPositions, 'toolnest-split-pages.pdf');
      });
    }

    if (btnReverseOrder) {
      btnReverseOrder.addEventListener('click', function () {
        pageItems.reverse();
        renderPageList();
        window.ToolNest.showToast('Page order reversed!', 'success');
      });
    }

    if (btnSample) {
      btnSample.addEventListener('click', function () {
        pageItems = [];
        generateSamplePdfs()
          .then(function (sampleFiles) {
            return addPdfFiles(sampleFiles);
          })
          .catch(function (err) {
            window.ToolNest.showToast(err.message, 'danger');
          });
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', function () {
        pageItems = [];
        fileInput.value = '';
        if (rangeInput) rangeInput.value = '';
        renderPageList();
      });
    }
  });
})();
