/**
 * ToolNest - Create PDF & Organize Pages (/assets/js/tools/create-pdf.js)
 * 100% Client-Side Adobe Acrobat-Style PDF Creator & Visual Page Organizer.
 * Combines multiple Images (JPG, PNG, WebP) and PDF files with live page thumbnails (pdf.js),
 * drag-and-drop reordering, per-page & batch rotation, insertion, duplication, zoom modal,
 * and lossless vector PDF assembly (pdf-lib).
 */
(function () {
  'use strict';

  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const PAGE_SIZES_PT = {
    a4: { width: 595.28, height: 841.89 },
    letter: { width: 612, height: 792 }
  };

  // Map of pdfSourceId -> { id, name, bytes: Uint8Array }
  const pdfSourcesMap = new Map();
  let nextSourceId = 1;

  // Array of page items:
  // {
  //   id, type: 'pdf' | 'image' | 'blank',
  //   sourceName, pdfSourceId, pageIndex, originalPageNum, totalInSource,
  //   imgElement, mime, origW, origH,
  //   rotation: 0 | 90 | 180 | 270,
  //   thumbUrl, selected: boolean
  // }
  let pageItems = [];
  let nextPageId = 1;
  let dragSourceIndex = null;
  let insertAfterIndex = null;
  let currentModalPageId = null;
  let generatedPdfBlob = null;
  let generatedPdfFilename = 'toolnest-created-document.pdf';

  function ensurePdfJsWorker() {
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      }
    }
  }

  function normalizeRotation(deg) {
    return ((deg % 360) + 360) % 360;
  }

  /**
   * Create a fallback thumbnail canvas data URL if pdf.js is unavailable
   */
  function createFallbackPdfThumb(fileName, pageNum, totalPages, wPt, hPt) {
    const c = document.createElement('canvas');
    const ratio = wPt && hPt ? wPt / hPt : 1 / 1.414;
    c.width = 360;
    c.height = Math.round(360 / ratio);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, c.width - 24, c.height - 24);

    ctx.fillStyle = '#2563EB';
    ctx.fillRect(28, 36, c.width - 56, 48);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('PDF PAGE ' + pageNum + ' OF ' + totalPages, 44, 67);

    ctx.fillStyle = '#334155';
    ctx.font = '600 15px Inter, sans-serif';
    const shortName = fileName.length > 28 ? fileName.slice(0, 25) + '...' : fileName;
    ctx.fillText(shortName, 36, 125);

    ctx.fillStyle = '#E2E8F0';
    for (let y = 160; y < c.height - 50; y += 26) {
      ctx.fillRect(36, y, c.width - (y % 52 === 0 ? 110 : 72), 10);
    }
    return c.toDataURL('image/png');
  }

  /**
   * Create a clean visual thumbnail for a Blank Page
   */
  function createBlankPageThumb() {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 566;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#E2E8F0';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, c.width - 56, c.height - 56);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Blank Page', c.width / 2, c.height / 2);
    return c.toDataURL('image/png');
  }

  /**
   * Parse a PDF file into individual visual page items using pdf.js (with pdf-lib fallback)
   */
  async function loadPdfFilePages(file, onPageProgress) {
    const arrayBuffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(arrayBuffer);
    const sourceId = nextSourceId++;
    pdfSourcesMap.set(sourceId, {
      id: sourceId,
      name: file.name,
      bytes: rawBytes
    });

    const newItems = [];

    if (window.pdfjsLib) {
      ensurePdfJsWorker();
      // Pass a copy of Uint8Array to pdf.js because pdf.js worker may transfer/detach the buffer
      const pdfJsCopy = rawBytes.slice();
      const loadingTask = window.pdfjsLib.getDocument({ data: pdfJsCopy });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      for (let p = 1; p <= numPages; p++) {
        if (onPageProgress) onPageProgress(p, numPages, file.name);
        const page = await pdfDoc.getPage(p);
        const baseVp = page.getViewport({ scale: 1 });
        const targetMaxDim = 640;
        const scale = Math.min(2, Math.max(0.75, targetMaxDim / Math.max(baseVp.width, baseVp.height)));
        const vp = page.getViewport({ scale: scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const thumbUrl = canvas.toDataURL('image/jpeg', 0.86);

        newItems.push({
          id: nextPageId++,
          type: 'pdf',
          sourceName: file.name,
          pdfSourceId: sourceId,
          pageIndex: p - 1,
          originalPageNum: p,
          totalInSource: numPages,
          origW: baseVp.width,
          origH: baseVp.height,
          rotation: 0,
          thumbUrl: thumbUrl,
          selected: false
        });
      }
      return newItems;
    }

    // Fallback if pdf.js is not loaded
    if (!window.PDFLib) {
      throw new Error('PDF library is still loading. Please try again in a moment.');
    }
    const pdfDoc = await window.PDFLib.PDFDocument.load(rawBytes, { ignoreEncryption: true });
    const count = pdfDoc.getPageCount();
    const pages = pdfDoc.getPages();
    for (let i = 0; i < count; i++) {
      if (onPageProgress) onPageProgress(i + 1, count, file.name);
      const sz = pages[i].getSize();
      newItems.push({
        id: nextPageId++,
        type: 'pdf',
        sourceName: file.name,
        pdfSourceId: sourceId,
        pageIndex: i,
        originalPageNum: i + 1,
        totalInSource: count,
        origW: sz.width,
        origH: sz.height,
        rotation: 0,
        thumbUrl: createFallbackPdfThumb(file.name, i + 1, count, sz.width, sz.height),
        selected: false
      });
    }
    return newItems;
  }

  /**
   * Load an image file (JPG, PNG, WebP) into a single page item
   */
  function loadImageFilePage(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        // Create a moderately sized preview Data URL so zooming and thumbnails are fast
        const maxPreview = 720;
        const scale = Math.min(1, maxPreview / Math.max(origW, origH));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(origW * scale));
        c.height = Math.max(1, Math.round(origH * scale));
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const thumbUrl = c.toDataURL('image/jpeg', 0.88);
        URL.revokeObjectURL(url);

        resolve({
          id: nextPageId++,
          type: 'image',
          sourceName: file.name,
          imgElement: img,
          mime: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          origW: origW,
          origH: origH,
          rotation: 0,
          thumbUrl: thumbUrl,
          selected: false
        });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not decode image: ' + file.name));
      };
      img.src = url;
    });
  }

  /**
   * Render an image item with its user-selected rotation into PNG/JPEG bytes for pdf-lib
   */
  function renderRotatedImageBytes(item) {
    const rot = normalizeRotation(item.rotation);
    const swap = rot === 90 || rot === 270;
    const w = swap ? item.origH : item.origW;
    const h = swap ? item.origW : item.origH;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const isPng = item.mime === 'image/png';
    if (!isPng) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.save();
    ctx.translate(w / 2, h / 2);
    if (rot !== 0) {
      ctx.rotate((rot * Math.PI) / 180);
    }
    ctx.drawImage(item.imgElement, -item.origW / 2, -item.origH / 2, item.origW, item.origH);
    ctx.restore();

    const outMime = isPng ? 'image/png' : 'image/jpeg';
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (!blob) {
            reject(new Error('Failed to encode image page: ' + item.sourceName));
            return;
          }
          blob.arrayBuffer().then(function (buf) {
            resolve({
              bytes: new Uint8Array(buf),
              mime: outMime,
              width: w,
              height: h
            });
          });
        },
        outMime,
        0.92
      );
    });
  }

  /**
   * Generate a mixed sample of 1 two-page PDF + 2 scanned images so users can test immediately
   */
  async function generateSampleFiles() {
    if (!window.PDFLib) {
      throw new Error('PDF library is still loading. Please try again in a moment.');
    }
    const PDFDocument = window.PDFLib.PDFDocument;
    const rgb = window.PDFLib.rgb;
    const StandardFonts = window.PDFLib.StandardFonts;

    const doc = await PDFDocument.create();
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await doc.embedFont(StandardFonts.Helvetica);

    const p1 = doc.addPage([595.28, 841.89]);
    p1.drawRectangle({ x: 36, y: 715, width: 523, height: 85, color: rgb(0.145, 0.388, 0.921) });
    p1.drawText('PROJECT PROPOSAL & CONTRACT (PDF p.1)', { x: 54, y: 760, size: 18, font: fontBold, color: rgb(1, 1, 1) });
    p1.drawText('Prepared with ToolNest Create PDF & Organize Pages', { x: 54, y: 734, size: 12, font: fontReg, color: rgb(0.9, 0.95, 1) });
    p1.drawText('1. Executive Summary', { x: 45, y: 655, size: 15, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    p1.drawText('Drag and drop this PDF page anywhere, rotate it, or interleave image scans.', { x: 45, y: 630, size: 11, font: fontReg, color: rgb(0.3, 0.35, 0.45) });

    const p2 = doc.addPage([595.28, 841.89]);
    p2.drawRectangle({ x: 36, y: 715, width: 523, height: 85, color: rgb(0.05, 0.58, 0.53) });
    p2.drawText('TERMS & PAYMENT SCHEDULE (PDF p.2)', { x: 54, y: 760, size: 18, font: fontBold, color: rgb(1, 1, 1) });
    p2.drawText('Original Vector PDF Page — 100% Lossless Text Quality', { x: 54, y: 734, size: 12, font: fontReg, color: rgb(0.9, 1, 0.98) });
    p2.drawText('2. Milestone Deliverables & Signatures', { x: 45, y: 655, size: 15, font: fontBold, color: rgb(0.1, 0.15, 0.25) });

    const pdfBytes = await doc.save();
    const samplePdfFile = new File([pdfBytes], 'sample-contract-2pages.pdf', { type: 'application/pdf' });

    const sampleImages = [
      { name: 'scanned-id-verification.jpg', w: 900, h: 1270, bg: '#FEF3C7', accent: '#D97706', title: 'SCANNED ID / CERTIFICATE (IMAGE)', sub: 'Photo Page • Drag between PDF pages or rotate 90°' },
      { name: 'signed-payment-receipt.jpg', w: 900, h: 1270, bg: '#DCFCE7', accent: '#16A34A', title: 'SIGNED PAYMENT RECEIPT (IMAGE)', sub: 'Smartphone Scan • Automatically Sized to A4 / Letter' }
    ];

    const imgFiles = await Promise.all(
      sampleImages.map(function (cfg) {
        return new Promise(function (resolve) {
          const c = document.createElement('canvas');
          c.width = cfg.w;
          c.height = cfg.h;
          const ctx = c.getContext('2d');
          ctx.fillStyle = cfg.bg;
          ctx.fillRect(0, 0, cfg.w, cfg.h);
          ctx.strokeStyle = cfg.accent;
          ctx.lineWidth = 10;
          ctx.strokeRect(32, 32, cfg.w - 64, cfg.h - 64);
          ctx.fillStyle = cfg.accent;
          ctx.fillRect(60, 80, cfg.w - 120, 110);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 30px Inter, sans-serif';
          ctx.fillText(cfg.title, 85, 145);
          ctx.fillStyle = '#1E293B';
          ctx.font = '600 22px Inter, sans-serif';
          ctx.fillText(cfg.sub, 80, 260);
          ctx.fillStyle = '#64748B';
          for (let y = 330; y < cfg.h - 140; y += 54) {
            ctx.fillRect(80, y, cfg.w - (y % 108 === 0 ? 280 : 180), 16);
          }
          c.toBlob(function (blob) {
            resolve(new File([blob], cfg.name, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.9);
        });
      })
    );

    return [samplePdfFile, imgFiles[0], imgFiles[1]];
  }

  if (typeof window !== 'undefined') {
    window.ToolNestCreatePdf = {
      PAGE_SIZES_PT: PAGE_SIZES_PT,
      normalizeRotation: normalizeRotation
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-cpdf-dropzone');
    const fileInput = document.getElementById('tn-cpdf-file-input');
    const insertInput = document.getElementById('tn-cpdf-insert-input');
    const sampleBtn = document.getElementById('tn-cpdf-sample-btn');

    const loadingWrap = document.getElementById('tn-cpdf-loading-wrap');
    const loadingText = document.getElementById('tn-cpdf-loading-text');
    const loadingBar = document.getElementById('tn-cpdf-loading-bar');

    const organizerWrap = document.getElementById('tn-cpdf-organizer-wrap');
    const pagesGrid = document.getElementById('tn-cpdf-pages-grid');
    const totalBadge = document.getElementById('tn-cpdf-total-badge');
    const selectedBadge = document.getElementById('tn-cpdf-selected-badge');
    const gridSizeSelect = document.getElementById('tn-cpdf-grid-size');

    const btnSelectAll = document.getElementById('tn-cpdf-select-all-btn');
    const btnSelectNone = document.getElementById('tn-cpdf-select-none-btn');
    const btnSelectOdd = document.getElementById('tn-cpdf-select-odd-btn');
    const btnSelectEven = document.getElementById('tn-cpdf-select-even-btn');

    const btnRotCcw = document.getElementById('tn-cpdf-rot-ccw-btn');
    const btnRotCw = document.getElementById('tn-cpdf-rot-cw-btn');
    const btnDuplicate = document.getElementById('tn-cpdf-dup-btn');
    const btnReverse = document.getElementById('tn-cpdf-reverse-btn');
    const btnDeleteSelected = document.getElementById('tn-cpdf-delete-sel-btn');
    const btnAddMore = document.getElementById('tn-cpdf-add-more-btn');
    const btnAddBlank = document.getElementById('tn-cpdf-add-blank-btn');

    const pageSizeSelect = document.getElementById('tn-cpdf-page-size');
    const orientationSelect = document.getElementById('tn-cpdf-orientation');
    const marginSelect = document.getElementById('tn-cpdf-margin');
    const filenameInput = document.getElementById('tn-cpdf-filename');
    const normalizePdfCheckbox = document.getElementById('tn-cpdf-normalize-pdf-pages');

    const btnBuildAll = document.getElementById('tn-cpdf-build-all-btn');
    const btnBuildSelected = document.getElementById('tn-cpdf-build-selected-btn');
    const btnClear = document.getElementById('tn-cpdf-clear-btn');

    const resultCard = document.getElementById('tn-cpdf-result-card');
    const resultSummary = document.getElementById('tn-cpdf-result-summary');
    const btnDownloadAgain = document.getElementById('tn-cpdf-download-btn');

    // Preview Modal Elements
    const previewModalEl = document.getElementById('tnCpdfPreviewModal');
    const modalTitle = document.getElementById('tnCpdfPreviewModalLabel');
    const modalImg = document.getElementById('tn-cpdf-modal-img');
    const modalMeta = document.getElementById('tn-cpdf-modal-meta');
    const btnModalPrev = document.getElementById('tn-cpdf-modal-prev');
    const btnModalNext = document.getElementById('tn-cpdf-modal-next');
    const btnModalRotCcw = document.getElementById('tn-cpdf-modal-rot-ccw');
    const btnModalRotCw = document.getElementById('tn-cpdf-modal-rot-cw');
    const btnModalDelete = document.getElementById('tn-cpdf-modal-delete');

    if (!dropzone || !pagesGrid) return;

    function showProgress(text, pct) {
      if (!loadingWrap) return;
      loadingWrap.classList.remove('d-none');
      if (loadingText) loadingText.textContent = text;
      if (loadingBar) {
        const clamped = Math.max(5, Math.min(100, Math.round(pct)));
        loadingBar.style.width = clamped + '%';
        loadingBar.textContent = clamped + '%';
      }
    }

    function hideProgress() {
      if (loadingWrap) loadingWrap.classList.add('d-none');
    }

    function updateCountersAndButtons() {
      const total = pageItems.length;
      const selectedCount = pageItems.filter(function (p) { return p.selected; }).length;

      if (totalBadge) {
        totalBadge.textContent = total + (total === 1 ? ' Page' : ' Pages');
      }
      if (selectedBadge) {
        selectedBadge.textContent = selectedCount + ' Selected';
        selectedBadge.className = selectedCount > 0
          ? 'badge bg-primary-subtle text-primary border border-primary-subtle'
          : 'badge bg-secondary-subtle text-dark border';
      }
      if (btnBuildSelected) {
        btnBuildSelected.disabled = selectedCount === 0;
        btnBuildSelected.innerHTML =
          '<i class="bi bi-bounding-box-circles" aria-hidden="true"></i> Export Selected (' + selectedCount + ')';
      }
    }

    function renderGrid() {
      pagesGrid.innerHTML = '';
      if (pageItems.length === 0) {
        organizerWrap.classList.add('d-none');
        updateCountersAndButtons();
        return;
      }

      organizerWrap.classList.remove('d-none');
      updateCountersAndButtons();

      const esc = window.ToolNest && window.ToolNest.escapeHtml
        ? window.ToolNest.escapeHtml
        : function (s) { return String(s); };

      pageItems.forEach(function (item, idx) {
        const card = document.createElement('div');
        card.className = 'tn-cpdf-card' + (item.selected ? ' is-selected' : '');
        card.setAttribute('draggable', 'true');
        card.setAttribute('role', 'listitem');
        card.dataset.index = String(idx);
        card.dataset.id = String(item.id);

        const typeBadgeClass = item.type === 'pdf'
          ? 'bg-danger-subtle text-danger border-danger-subtle'
          : item.type === 'image'
            ? 'bg-info-subtle text-info-emphasis border-info-subtle'
            : 'bg-secondary-subtle text-secondary border-secondary-subtle';
        const typeLabel = item.type === 'pdf' ? 'PDF' : item.type === 'image' ? 'IMG' : 'BLANK';

        const subCaption = item.type === 'pdf'
          ? item.sourceName + ' (p.' + item.originalPageNum + '/' + item.totalInSource + ')'
          : item.sourceName;

        const rotBadgeHtml = item.rotation !== 0
          ? '<span class="badge bg-warning text-dark ms-1" title="Page rotated">' + item.rotation + '&deg;</span>'
          : '';

        card.innerHTML =
          '<div class="d-flex justify-content-between align-items-center mb-2">' +
            '<div class="form-check mb-0 d-flex align-items-center gap-1">' +
              '<input class="form-check-input tn-cpdf-select-chk mt-0" type="checkbox" data-id="' + item.id + '" ' +
                (item.selected ? 'checked' : '') + ' aria-label="Select page ' + (idx + 1) + '">' +
              '<span class="badge bg-primary">#' + (idx + 1) + '</span>' +
              rotBadgeHtml +
            '</div>' +
            '<span class="badge border ' + typeBadgeClass + '" style="font-size:0.68rem;">' + typeLabel + '</span>' +
          '</div>' +
          '<div class="tn-cpdf-thumb-stage" data-action="zoom" data-id="' + item.id + '" title="Click to inspect page ' + (idx + 1) + '">' +
            '<img src="' + item.thumbUrl + '" alt="Page ' + (idx + 1) + ' preview" class="tn-cpdf-thumb-img" style="transform: rotate(' + item.rotation + 'deg);">' +
          '</div>' +
          '<div class="small fw-medium text-truncate mt-2 text-center" title="' + esc(subCaption) + '">' +
            esc(subCaption) +
          '</div>' +
          '<div class="tn-cpdf-card-actions">' +
            '<button type="button" class="btn tn-btn--outline tn-cpdf-icon-btn" data-action="zoom" data-id="' + item.id + '" title="Zoom / Inspect Page">' +
              '<i class="bi bi-zoom-in" aria-hidden="true"></i>' +
            '</button>' +
            '<button type="button" class="btn tn-btn--outline tn-cpdf-icon-btn" data-action="left" data-index="' + idx + '" ' + (idx === 0 ? 'disabled' : '') + ' title="Move Page Left">' +
              '<i class="bi bi-chevron-left" aria-hidden="true"></i>' +
            '</button>' +
            '<button type="button" class="btn tn-btn--outline tn-cpdf-icon-btn" data-action="right" data-index="' + idx + '" ' + (idx === pageItems.length - 1 ? 'disabled' : '') + ' title="Move Page Right">' +
              '<i class="bi bi-chevron-right" aria-hidden="true"></i>' +
            '</button>' +
            '<button type="button" class="btn tn-btn--outline tn-cpdf-icon-btn" data-action="rot-ccw" data-id="' + item.id + '" title="Rotate 90° Left">' +
              '<i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>' +
            '</button>' +
            '<button type="button" class="btn tn-btn--outline tn-cpdf-icon-btn" data-action="rot-cw" data-id="' + item.id + '" title="Rotate 90° Right">' +
              '<i class="bi bi-arrow-clockwise" aria-hidden="true"></i>' +
            '</button>' +
            '<button type="button" class="btn tn-btn--outline tn-cpdf-icon-btn" data-action="insert-after" data-index="' + idx + '" title="Insert Files After This Page">' +
              '<i class="bi bi-plus-circle" aria-hidden="true"></i>' +
            '</button>' +
            '<button type="button" class="btn tn-btn--outline tn-cpdf-icon-btn text-danger" data-action="remove" data-id="' + item.id + '" title="Delete Page">' +
              '<i class="bi bi-trash3" aria-hidden="true"></i>' +
            '</button>' +
          '</div>';

        // Drag events for smooth reordering
        card.addEventListener('dragstart', function (e) {
          dragSourceIndex = idx;
          card.classList.add('is-dragging');
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(idx));
          }
        });

        card.addEventListener('dragend', function () {
          card.classList.remove('is-dragging');
          pagesGrid.querySelectorAll('.tn-cpdf-card').forEach(function (el) {
            el.classList.remove('is-drop-target');
          });
        });

        card.addEventListener('dragover', function (e) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          card.classList.add('is-drop-target');
        });

        card.addEventListener('dragleave', function () {
          card.classList.remove('is-drop-target');
        });

        card.addEventListener('drop', function (e) {
          e.preventDefault();
          card.classList.remove('is-drop-target');
          const targetIndex = idx;
          if (dragSourceIndex === null || dragSourceIndex === targetIndex) return;
          const moved = pageItems.splice(dragSourceIndex, 1)[0];
          pageItems.splice(targetIndex, 0, moved);
          dragSourceIndex = null;
          renderGrid();
        });

        pagesGrid.appendChild(card);
      });
    }

    /**
     * Process an array/FileList of mixed PDF and Image files and insert at `insertPos` (or append if null)
     */
    async function handleFiles(fileList, insertPos) {
      if (!fileList || fileList.length === 0) return;

      const validFiles = Array.from(fileList).filter(function (f) {
        const name = (f.name || '').toLowerCase();
        return (
          f.type === 'application/pdf' ||
          name.endsWith('.pdf') ||
          /^image\/(jpeg|png|webp|gif|bmp)$/i.test(f.type) ||
          /\.(jpe?g|png|webp)$/i.test(name)
        );
      });

      if (validFiles.length === 0) {
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Please select PDF files or JPG, PNG, or WebP images.', 'warning');
        }
        return;
      }

      const newlyLoaded = [];
      try {
        for (let i = 0; i < validFiles.length; i++) {
          const f = validFiles[i];
          const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
          const basePct = (i / validFiles.length) * 100;

          if (isPdf) {
            showProgress('Reading PDF: ' + f.name + '...', basePct + 5);
            const pdfPages = await loadPdfFilePages(f, function (pageNum, totalPages, fname) {
              const subPct = basePct + ((pageNum / totalPages) * (100 / validFiles.length));
              showProgress('Rendering ' + fname + ' (Page ' + pageNum + ' of ' + totalPages + ')...', subPct);
            });
            newlyLoaded.push.apply(newlyLoaded, pdfPages);
          } else {
            showProgress('Loading image: ' + f.name + '...', basePct + 50 / validFiles.length);
            const imgPage = await loadImageFilePage(f);
            newlyLoaded.push(imgPage);
          }
        }

        if (typeof insertPos === 'number' && insertPos >= 0 && insertPos <= pageItems.length) {
          pageItems.splice.apply(pageItems, [insertPos, 0].concat(newlyLoaded));
        } else {
          pageItems.push.apply(pageItems, newlyLoaded);
        }

        if (resultCard) resultCard.classList.add('d-none');
        renderGrid();
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Added ' + newlyLoaded.length + (newlyLoaded.length === 1 ? ' page' : ' pages') + ' to organizer.', 'success');
        }
      } catch (err) {
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast(err.message || 'Could not load one or more files.', 'danger');
        }
      } finally {
        hideProgress();
      }
    }

    // Modal Preview Logic
    function openPreviewModal(pageId) {
      const idx = pageItems.findIndex(function (p) { return p.id === pageId; });
      if (idx === -1 || !previewModalEl) return;
      currentModalPageId = pageId;
      syncModalContent();

      if (window.bootstrap && window.bootstrap.Modal) {
        const instance = window.bootstrap.Modal.getOrCreateInstance(previewModalEl);
        instance.show();
      }
    }

    function syncModalContent() {
      const idx = pageItems.findIndex(function (p) { return p.id === currentModalPageId; });
      if (idx === -1) {
        if (previewModalEl && window.bootstrap && window.bootstrap.Modal) {
          const inst = window.bootstrap.Modal.getInstance(previewModalEl);
          if (inst) inst.hide();
        }
        return;
      }
      const item = pageItems[idx];
      if (modalTitle) {
        modalTitle.textContent = 'Page ' + (idx + 1) + ' of ' + pageItems.length + ' — ' + item.sourceName;
      }
      if (modalImg) {
        modalImg.src = item.thumbUrl;
        modalImg.style.transform = 'rotate(' + item.rotation + 'deg)';
      }
      if (modalMeta) {
        const typeStr = item.type === 'pdf'
          ? 'PDF Source Page ' + item.originalPageNum + ' of ' + item.totalInSource
          : item.type === 'image'
            ? 'Image (' + item.origW + ' × ' + item.origH + ' px)'
            : 'Blank Page';
        modalMeta.textContent = typeStr + (item.rotation ? ' • Rotated ' + item.rotation + '°' : '');
      }
      if (btnModalPrev) btnModalPrev.disabled = idx === 0;
      if (btnModalNext) btnModalNext.disabled = idx === pageItems.length - 1;
    }

    if (btnModalPrev) {
      btnModalPrev.addEventListener('click', function () {
        const idx = pageItems.findIndex(function (p) { return p.id === currentModalPageId; });
        if (idx > 0) {
          currentModalPageId = pageItems[idx - 1].id;
          syncModalContent();
        }
      });
    }

    if (btnModalNext) {
      btnModalNext.addEventListener('click', function () {
        const idx = pageItems.findIndex(function (p) { return p.id === currentModalPageId; });
        if (idx !== -1 && idx < pageItems.length - 1) {
          currentModalPageId = pageItems[idx + 1].id;
          syncModalContent();
        }
      });
    }

    if (btnModalRotCcw) {
      btnModalRotCcw.addEventListener('click', function () {
        const item = pageItems.find(function (p) { return p.id === currentModalPageId; });
        if (item) {
          item.rotation = normalizeRotation(item.rotation - 90);
          renderGrid();
          syncModalContent();
        }
      });
    }

    if (btnModalRotCw) {
      btnModalRotCw.addEventListener('click', function () {
        const item = pageItems.find(function (p) { return p.id === currentModalPageId; });
        if (item) {
          item.rotation = normalizeRotation(item.rotation + 90);
          renderGrid();
          syncModalContent();
        }
      });
    }

    if (btnModalDelete) {
      btnModalDelete.addEventListener('click', function () {
        const idx = pageItems.findIndex(function (p) { return p.id === currentModalPageId; });
        if (idx !== -1) {
          pageItems.splice(idx, 1);
          if (pageItems.length > 0) {
            const nextIdx = Math.min(idx, pageItems.length - 1);
            currentModalPageId = pageItems[nextIdx].id;
          } else {
            currentModalPageId = null;
          }
          renderGrid();
          syncModalContent();
        }
      });
    }

    // Delegated clicks & checkbox changes inside the page grid
    pagesGrid.addEventListener('change', function (e) {
      const chk = e.target.closest('.tn-cpdf-select-chk');
      if (!chk) return;
      const id = parseInt(chk.getAttribute('data-id'), 10);
      const item = pageItems.find(function (p) { return p.id === id; });
      if (item) {
        item.selected = chk.checked;
        const card = chk.closest('.tn-cpdf-card');
        if (card) card.classList.toggle('is-selected', item.selected);
        updateCountersAndButtons();
      }
    });

    pagesGrid.addEventListener('click', function (e) {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.getAttribute('data-action');
      const idAttr = actionEl.getAttribute('data-id');
      const idxAttr = actionEl.getAttribute('data-index');
      const id = idAttr ? parseInt(idAttr, 10) : null;
      const index = idxAttr ? parseInt(idxAttr, 10) : null;

      if (action === 'zoom' && id !== null) {
        openPreviewModal(id);
      } else if (action === 'left' && index !== null && index > 0) {
        const temp = pageItems[index - 1];
        pageItems[index - 1] = pageItems[index];
        pageItems[index] = temp;
        renderGrid();
      } else if (action === 'right' && index !== null && index < pageItems.length - 1) {
        const tempR = pageItems[index + 1];
        pageItems[index + 1] = pageItems[index];
        pageItems[index] = tempR;
        renderGrid();
      } else if (action === 'rot-ccw' && id !== null) {
        const itemCcw = pageItems.find(function (p) { return p.id === id; });
        if (itemCcw) {
          itemCcw.rotation = normalizeRotation(itemCcw.rotation - 90);
          renderGrid();
        }
      } else if (action === 'rot-cw' && id !== null) {
        const itemCw = pageItems.find(function (p) { return p.id === id; });
        if (itemCw) {
          itemCw.rotation = normalizeRotation(itemCw.rotation + 90);
          renderGrid();
        }
      } else if (action === 'insert-after' && index !== null) {
        insertAfterIndex = index + 1;
        if (insertInput) {
          insertInput.value = '';
          insertInput.click();
        }
      } else if (action === 'remove' && id !== null) {
        pageItems = pageItems.filter(function (p) { return p.id !== id; });
        renderGrid();
      }
    });

    // Toolbar Selection Buttons
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', function () {
        pageItems.forEach(function (p) { p.selected = true; });
        renderGrid();
      });
    }
    if (btnSelectNone) {
      btnSelectNone.addEventListener('click', function () {
        pageItems.forEach(function (p) { p.selected = false; });
        renderGrid();
      });
    }
    if (btnSelectOdd) {
      btnSelectOdd.addEventListener('click', function () {
        pageItems.forEach(function (p, i) { p.selected = (i % 2 === 0); });
        renderGrid();
      });
    }
    if (btnSelectEven) {
      btnSelectEven.addEventListener('click', function () {
        pageItems.forEach(function (p, i) { p.selected = (i % 2 === 1); });
        renderGrid();
      });
    }

    if (gridSizeSelect) {
      gridSizeSelect.addEventListener('change', function () {
        pagesGrid.setAttribute('data-grid-size', gridSizeSelect.value);
      });
    }

    // Batch Toolbar Actions
    function getTargetItems() {
      const selected = pageItems.filter(function (p) { return p.selected; });
      return selected.length > 0 ? selected : pageItems;
    }

    if (btnRotCcw) {
      btnRotCcw.addEventListener('click', function () {
        const targets = getTargetItems();
        targets.forEach(function (p) { p.rotation = normalizeRotation(p.rotation - 90); });
        renderGrid();
      });
    }

    if (btnRotCw) {
      btnRotCw.addEventListener('click', function () {
        const targets = getTargetItems();
        targets.forEach(function (p) { p.rotation = normalizeRotation(p.rotation + 90); });
        renderGrid();
      });
    }

    if (btnDuplicate) {
      btnDuplicate.addEventListener('click', function () {
        const selected = pageItems.filter(function (p) { return p.selected; });
        if (selected.length === 0) {
          if (window.ToolNest && window.ToolNest.showToast) {
            window.ToolNest.showToast('Select one or more pages first to duplicate them.', 'warning');
          }
          return;
        }
        const nextList = [];
        pageItems.forEach(function (p) {
          nextList.push(p);
          if (p.selected) {
            nextList.push(Object.assign({}, p, { id: nextPageId++, selected: false }));
          }
        });
        pageItems = nextList;
        renderGrid();
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Duplicated ' + selected.length + (selected.length === 1 ? ' page.' : ' pages.'), 'success');
        }
      });
    }

    if (btnReverse) {
      btnReverse.addEventListener('click', function () {
        pageItems.reverse();
        renderGrid();
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Page order reversed.', 'success');
        }
      });
    }

    if (btnDeleteSelected) {
      btnDeleteSelected.addEventListener('click', function () {
        const selectedCount = pageItems.filter(function (p) { return p.selected; }).length;
        if (selectedCount === 0) {
          if (window.ToolNest && window.ToolNest.showToast) {
            window.ToolNest.showToast('Check the pages you want to delete first.', 'warning');
          }
          return;
        }
        pageItems = pageItems.filter(function (p) { return !p.selected; });
        renderGrid();
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Deleted ' + selectedCount + (selectedCount === 1 ? ' page.' : ' pages.'), 'success');
        }
      });
    }

    if (btnAddMore) {
      btnAddMore.addEventListener('click', function () {
        insertAfterIndex = null;
        fileInput.value = '';
        fileInput.click();
      });
    }

    if (btnAddBlank) {
      btnAddBlank.addEventListener('click', function () {
        pageItems.push({
          id: nextPageId++,
          type: 'blank',
          sourceName: 'Blank Page',
          origW: 595.28,
          origH: 841.89,
          rotation: 0,
          thumbUrl: createBlankPageThumb(),
          selected: false
        });
        renderGrid();
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Blank page added. Drag it to any position.', 'success');
        }
      });
    }

    if (insertInput) {
      insertInput.addEventListener('change', function () {
        if (insertInput.files && insertInput.files.length > 0) {
          handleFiles(insertInput.files, insertAfterIndex);
        }
      });
    }

    /**
     * Build and download a PDF from `targetPages`
     */
    async function buildAndExportPdf(targetPages, suffixLabel) {
      if (!targetPages || targetPages.length === 0) {
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Please add at least one image or PDF page first.', 'warning');
        }
        return;
      }

      if (!window.PDFLib) {
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('PDF engine is still loading. Please try again in a moment.', 'danger');
        }
        return;
      }

      const sizeMode = pageSizeSelect ? pageSizeSelect.value : 'a4';
      const orientMode = orientationSelect ? orientationSelect.value : 'auto';
      const marginPt = marginSelect ? parseInt(marginSelect.value, 10) || 0 : 20;
      const normalizePdfPages = normalizePdfCheckbox ? normalizePdfCheckbox.checked : false;

      btnBuildAll.disabled = true;
      if (btnBuildSelected) btnBuildSelected.disabled = true;

      try {
        showProgress('Assembling PDF pages...', 5);

        const PDFDocument = window.PDFLib.PDFDocument;
        const degrees = window.PDFLib.degrees;
        const outDoc = await PDFDocument.create();

        // Cache loaded source PDFDocuments by pdfSourceId
        const loadedSrcDocs = new Map();

        for (let i = 0; i < targetPages.length; i++) {
          const item = targetPages[i];
          const pct = ((i + 1) / targetPages.length) * 100;
          showProgress('Building page ' + (i + 1) + ' of ' + targetPages.length + '...', pct);

          if (item.type === 'pdf') {
            let srcDoc = loadedSrcDocs.get(item.pdfSourceId);
            if (!srcDoc) {
              const srcEntry = pdfSourcesMap.get(item.pdfSourceId);
              if (!srcEntry) throw new Error('Source PDF data missing for ' + item.sourceName);
              srcDoc = await PDFDocument.load(srcEntry.bytes, { ignoreEncryption: true });
              loadedSrcDocs.set(item.pdfSourceId, srcDoc);
            }

            if (!normalizePdfPages || sizeMode === 'fit') {
              const copiedPages = await outDoc.copyPages(srcDoc, [item.pageIndex]);
              const copiedPage = copiedPages[0];
              if (item.rotation !== 0) {
                const currentRot = copiedPage.getRotation().angle || 0;
                copiedPage.setRotation(degrees(normalizeRotation(currentRot + item.rotation)));
              }
              outDoc.addPage(copiedPage);
            } else {
              // Scale imported PDF page onto the target standard page size (A4 / Letter)
              const embeddedPage = await outDoc.embedPage(srcDoc.getPages()[item.pageIndex]);
              const basePreset = PAGE_SIZES_PT[sizeMode] || PAGE_SIZES_PT.a4;
              const isLandscape = embeddedPage.width > embeddedPage.height;
              const pageW = isLandscape ? basePreset.height : basePreset.width;
              const pageH = isLandscape ? basePreset.width : basePreset.height;

              const newPage = outDoc.addPage([pageW, pageH]);
              const availW = Math.max(20, pageW - marginPt * 2);
              const availH = Math.max(20, pageH - marginPt * 2);
              const scale = Math.min(availW / embeddedPage.width, availH / embeddedPage.height);
              const drawW = embeddedPage.width * scale;
              const drawH = embeddedPage.height * scale;

              newPage.drawPage(embeddedPage, {
                x: (pageW - drawW) / 2,
                y: (pageH - drawH) / 2,
                width: drawW,
                height: drawH
              });
              if (item.rotation !== 0) {
                newPage.setRotation(degrees(normalizeRotation(item.rotation)));
              }
            }
          } else if (item.type === 'image') {
            const rendered = await renderRotatedImageBytes(item);
            const embeddedImg = rendered.mime === 'image/png'
              ? await outDoc.embedPng(rendered.bytes)
              : await outDoc.embedJpg(rendered.bytes);

            let pageW;
            let pageH;
            let drawW;
            let drawH;
            let drawX;
            let drawY;

            if (sizeMode === 'fit') {
              pageW = rendered.width + marginPt * 2;
              pageH = rendered.height + marginPt * 2;
              drawW = rendered.width;
              drawH = rendered.height;
              drawX = marginPt;
              drawY = marginPt;
            } else {
              const basePreset = PAGE_SIZES_PT[sizeMode] || PAGE_SIZES_PT.a4;
              let useLandscape = orientMode === 'landscape';
              if (orientMode === 'auto') {
                useLandscape = rendered.width > rendered.height;
              }
              pageW = useLandscape ? basePreset.height : basePreset.width;
              pageH = useLandscape ? basePreset.width : basePreset.height;

              const availW = Math.max(20, pageW - marginPt * 2);
              const availH = Math.max(20, pageH - marginPt * 2);
              const scale = Math.min(availW / rendered.width, availH / rendered.height);
              drawW = rendered.width * scale;
              drawH = rendered.height * scale;
              drawX = (pageW - drawW) / 2;
              drawY = (pageH - drawH) / 2;
            }

            const page = outDoc.addPage([pageW, pageH]);
            page.drawImage(embeddedImg, {
              x: drawX,
              y: drawY,
              width: drawW,
              height: drawH
            });
          } else {
            // Blank page
            const basePreset = PAGE_SIZES_PT[sizeMode === 'letter' ? 'letter' : 'a4'];
            const swap = item.rotation === 90 || item.rotation === 270;
            const bw = swap ? basePreset.height : basePreset.width;
            const bh = swap ? basePreset.width : basePreset.height;
            outDoc.addPage([bw, bh]);
          }
        }

        const pdfBytes = await outDoc.save();
        generatedPdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        let rawName = (filenameInput && filenameInput.value.trim()) || 'toolnest-created-document.pdf';
        if (!rawName.toLowerCase().endsWith('.pdf')) rawName += '.pdf';
        if (suffixLabel) {
          rawName = rawName.replace(/\.pdf$/i, '-' + suffixLabel + '.pdf');
        }
        generatedPdfFilename = rawName;

        if (resultCard && resultSummary) {
          const sizeStr = window.ToolNest && window.ToolNest.formatBytes
            ? window.ToolNest.formatBytes(generatedPdfBlob.size)
            : Math.round(generatedPdfBlob.size / 1024) + ' KB';
          const esc = window.ToolNest && window.ToolNest.escapeHtml
            ? window.ToolNest.escapeHtml
            : function (s) { return String(s); };
          resultSummary.innerHTML =
            '<i class="bi bi-check-circle-fill text-success me-1" aria-hidden="true"></i> ' +
            'Built <strong>' + esc(generatedPdfFilename) + '</strong> with <strong>' + targetPages.length +
            (targetPages.length === 1 ? ' page' : ' pages') + '</strong> (' + sizeStr + ')';
          resultCard.classList.remove('d-none');
        }

        if (window.ToolNest && window.ToolNest.downloadBlob) {
          window.ToolNest.downloadBlob(generatedPdfBlob, generatedPdfFilename);
        }
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('PDF created with ' + targetPages.length + ' pages!', 'success');
        }
      } catch (err) {
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast(err.message || 'Failed to build PDF.', 'danger');
        }
      } finally {
        hideProgress();
        btnBuildAll.disabled = false;
        updateCountersAndButtons();
      }
    }

    if (btnBuildAll) {
      btnBuildAll.addEventListener('click', function () {
        buildAndExportPdf(pageItems, '');
      });
    }

    if (btnBuildSelected) {
      btnBuildSelected.addEventListener('click', function () {
        const selected = pageItems.filter(function (p) { return p.selected; });
        buildAndExportPdf(selected, 'selected');
      });
    }

    if (btnDownloadAgain) {
      btnDownloadAgain.addEventListener('click', function () {
        if (generatedPdfBlob && window.ToolNest && window.ToolNest.downloadBlob) {
          window.ToolNest.downloadBlob(generatedPdfBlob, generatedPdfFilename);
        }
      });
    }

    if (sampleBtn) {
      sampleBtn.addEventListener('click', async function () {
        try {
          showProgress('Generating sample PDF and scanned images...', 20);
          const sampleFiles = await generateSampleFiles();
          await handleFiles(sampleFiles, null);
        } catch (err) {
          hideProgress();
          if (window.ToolNest && window.ToolNest.showToast) {
            window.ToolNest.showToast(err.message || 'Could not generate sample files.', 'danger');
          }
        }
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', function () {
        pageItems = [];
        pdfSourcesMap.clear();
        generatedPdfBlob = null;
        if (fileInput) fileInput.value = '';
        if (insertInput) insertInput.value = '';
        if (resultCard) resultCard.classList.add('d-none');
        renderGrid();
      });
    }

    if (window.ToolNest && window.ToolNest.setupDropzone) {
      window.ToolNest.setupDropzone(dropzone, fileInput, function (files) {
        handleFiles(files, null);
      });
    }
  });
})();
