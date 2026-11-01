/**
 * ToolNest - Image to PDF Converter (/assets/js/tools/image-to-pdf.js)
 * 100% Client-Side Image to PDF Builder powered by pdf-lib 1.17.1.
 * Supports multi-image upload (JPG, PNG, WebP), drag-and-drop + button reordering,
 * per-image rotation, A4/Letter/Fit-to-Image page sizes, orientation, margins, and custom filename.
 */
(function () {
  'use strict';

  const PAGE_SIZES_PT = {
    a4: { width: 595.28, height: 841.89 },
    letter: { width: 612, height: 792 }
  };

  if (typeof window !== 'undefined') {
    window.ToolNestImageToPdf = {
      PAGE_SIZES_PT: PAGE_SIZES_PT
    };
  }

  // Array of { id, file, name, size, img, origW, origH, rotation, previewUrl }
  let imageItems = [];
  let nextItemId = 1;
  let dragSourceIndex = null;
  let generatedPdfBlob = null;

  function loadImageItem(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        resolve({
          id: nextItemId++,
          file: file,
          name: file.name,
          size: file.size,
          img: img,
          origW: img.naturalWidth || img.width,
          origH: img.naturalHeight || img.height,
          rotation: 0,
          previewUrl: url
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
   * Render an image item (with its user-applied rotation) to JPEG/PNG Uint8Array for pdf-lib embedding
   */
  function renderRotatedImageBytes(item) {
    const rot = ((item.rotation % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const w = swap ? item.origH : item.origW;
    const h = swap ? item.origW : item.origH;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const isPng = item.file.type === 'image/png';
    if (!isPng) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.save();
    ctx.translate(w / 2, h / 2);
    if (rot !== 0) {
      ctx.rotate((rot * Math.PI) / 180);
    }
    ctx.drawImage(item.img, -item.origW / 2, -item.origH / 2, item.origW, item.origH);
    ctx.restore();

    const outMime = isPng ? 'image/png' : 'image/jpeg';
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (!blob) {
            reject(new Error('Failed to encode image page: ' + item.name));
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

  function createSampleDocumentImages() {
    const pages = [
      { name: 'scanned-page-01.jpg', w: 1000, h: 1414, bg: '#EFF6FF', border: '#2563EB', title: 'Document Page 1 (Cover)' },
      { name: 'scanned-page-02.jpg', w: 1000, h: 1414, bg: '#FEF3C7', border: '#F59E0B', title: 'Document Page 2 (Invoice)' },
      { name: 'scanned-page-03.jpg', w: 1414, h: 1000, bg: '#DCFCE7', border: '#16A34A', title: 'Document Page 3 (Wide Chart)' }
    ];

    return Promise.all(
      pages.map(function (p) {
        return new Promise(function (resolve) {
          const c = document.createElement('canvas');
          c.width = p.w;
          c.height = p.h;
          const ctx = c.getContext('2d');

          ctx.fillStyle = p.bg;
          ctx.fillRect(0, 0, p.w, p.h);

          ctx.strokeStyle = p.border;
          ctx.lineWidth = 12;
          ctx.strokeRect(40, 40, p.w - 80, p.h - 80);

          ctx.fillStyle = '#0F172A';
          ctx.font = 'bold 48px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.title, p.w / 2, p.h / 2 - 20);
          ctx.font = '28px Inter, sans-serif';
          ctx.fillStyle = '#475569';
          ctx.fillText(p.w + ' × ' + p.h + ' px • Drag or Rotate Before Building PDF', p.w / 2, p.h / 2 + 40);

          c.toBlob(
            function (blob) {
              resolve(new File([blob], p.name, { type: 'image/jpeg' }));
            },
            'image/jpeg',
            0.92
          );
        });
      })
    );
  }

  function cleanupItems() {
    imageItems.forEach(function (it) {
      if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    });
    imageItems = [];
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-i2p-dropzone');
    const fileInput = document.getElementById('tn-i2p-file-input');
    const pageSizeSelect = document.getElementById('tn-i2p-page-size');
    const orientationSelect = document.getElementById('tn-i2p-orientation');
    const marginSelect = document.getElementById('tn-i2p-margin');
    const filenameInput = document.getElementById('tn-i2p-filename');

    const listWrap = document.getElementById('tn-i2p-list-wrap');
    const countBadge = document.getElementById('tn-i2p-count-badge');
    const itemsGrid = document.getElementById('tn-i2p-items-grid');

    const buildBtn = document.getElementById('tn-i2p-build-btn');
    const sampleBtn = document.getElementById('tn-i2p-sample-btn');
    const clearBtn = document.getElementById('tn-i2p-clear-btn');

    const progressWrap = document.getElementById('tn-i2p-progress-wrap');
    const progressBar = document.getElementById('tn-i2p-progress-bar');
    const resultCard = document.getElementById('tn-i2p-result-card');
    const resultSummary = document.getElementById('tn-i2p-result-summary');
    const downloadBtn = document.getElementById('tn-i2p-download-btn');

    if (!dropzone || !fileInput) return;

    function getCleanOutputFilename() {
      let raw = (filenameInput && filenameInput.value ? filenameInput.value.trim() : '') || 'toolnest-images-to-pdf';
      raw = raw.replace(/\.pdf$/i, '');
      return raw + '.pdf';
    }

    function renderImageGrid() {
      if (imageItems.length === 0) {
        listWrap.classList.add('d-none');
        return;
      }
      listWrap.classList.remove('d-none');
      countBadge.textContent = imageItems.length + ' Page(s) in PDF Queue';

      itemsGrid.innerHTML = imageItems
        .map(function (it, idx) {
          const rot = ((it.rotation % 360) + 360) % 360;
          return (
            '<div class="col-12 col-sm-6 col-md-4" draggable="true" data-i2p-card="' +
            idx +
            '">' +
            '<div class="p-3 border rounded-3 bg-white h-100 shadow-sm d-flex flex-column justify-content-between">' +
            '<div class="d-flex justify-content-between align-items-center mb-2">' +
            '<span class="badge bg-primary">Page ' +
            (idx + 1) +
            '</span>' +
            '<span class="small text-muted"><i class="bi bi-grip-horizontal me-1" aria-hidden="true"></i>Drag</span>' +
            '</div>' +
            '<div class="text-center py-2 bg-light rounded border mb-2 overflow-hidden" style="height: 150px; display: flex; align-items: center; justify-content: center;">' +
            '<img src="' +
            it.previewUrl +
            '" alt="Preview of ' +
            window.ToolNest.escapeHtml(it.name) +
            '" style="max-height: 130px; max-width: 100%; transform: rotate(' +
            rot +
            'deg); transition: transform 150ms ease;" loading="lazy">' +
            '</div>' +
            '<div>' +
            '<div class="small fw-bold text-truncate mb-1" title="' +
            window.ToolNest.escapeHtml(it.name) +
            '">' +
            window.ToolNest.escapeHtml(it.name) +
            '</div>' +
            '<div class="small text-muted mb-2">' +
            it.origW +
            '&times;' +
            it.origH +
            ' px &bull; Rot: ' +
            rot +
            '&deg;</div>' +
            '<div class="d-flex flex-wrap gap-1 justify-content-between">' +
            '<div class="btn-group btn-group-sm" role="group" aria-label="Reorder page">' +
            '<button type="button" class="btn btn-outline-secondary" data-move-up="' +
            idx +
            '" ' +
            (idx === 0 ? 'disabled' : '') +
            ' title="Move page earlier"><i class="bi bi-arrow-left" aria-hidden="true"></i></button>' +
            '<button type="button" class="btn btn-outline-secondary" data-move-down="' +
            idx +
            '" ' +
            (idx === imageItems.length - 1 ? 'disabled' : '') +
            ' title="Move page later"><i class="bi bi-arrow-right" aria-hidden="true"></i></button>' +
            '</div>' +
            '<div class="btn-group btn-group-sm" role="group" aria-label="Rotate or remove">' +
            '<button type="button" class="btn btn-outline-primary" data-rotate="' +
            idx +
            '" title="Rotate 90° Clockwise"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> 90&deg;</button>' +
            '<button type="button" class="btn btn-outline-danger" data-remove="' +
            idx +
            '" title="Remove image"><i class="bi bi-x-lg" aria-hidden="true"></i></button>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>'
          );
        })
        .join('');

      // Drag and drop reordering bindings
      itemsGrid.querySelectorAll('[data-i2p-card]').forEach(function (cardEl) {
        const idx = Number(cardEl.getAttribute('data-i2p-card'));
        cardEl.addEventListener('dragstart', function (e) {
          dragSourceIndex = idx;
          e.dataTransfer.effectAllowed = 'move';
        });
        cardEl.addEventListener('dragover', function (e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });
        cardEl.addEventListener('drop', function (e) {
          e.preventDefault();
          if (dragSourceIndex === null || dragSourceIndex === idx) return;
          const moved = imageItems.splice(dragSourceIndex, 1)[0];
          imageItems.splice(idx, 0, moved);
          dragSourceIndex = null;
          renderImageGrid();
        });
      });

      // Button controls
      itemsGrid.querySelectorAll('[data-move-up]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-move-up'));
          if (i > 0) {
            const tmp = imageItems[i - 1];
            imageItems[i - 1] = imageItems[i];
            imageItems[i] = tmp;
            renderImageGrid();
          }
        });
      });

      itemsGrid.querySelectorAll('[data-move-down]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-move-down'));
          if (i < imageItems.length - 1) {
            const tmp = imageItems[i + 1];
            imageItems[i + 1] = imageItems[i];
            imageItems[i] = tmp;
            renderImageGrid();
          }
        });
      });

      itemsGrid.querySelectorAll('[data-rotate]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-rotate'));
          if (imageItems[i]) {
            imageItems[i].rotation = (imageItems[i].rotation + 90) % 360;
            renderImageGrid();
          }
        });
      });

      itemsGrid.querySelectorAll('[data-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-remove'));
          if (imageItems[i]) {
            if (imageItems[i].previewUrl) URL.revokeObjectURL(imageItems[i].previewUrl);
            imageItems.splice(i, 1);
            renderImageGrid();
          }
        });
      });
    }

    async function buildPdfDocument() {
      if (imageItems.length === 0) {
        window.ToolNest.showToast('Please add at least one image first.', 'warning');
        return;
      }
      if (!window.PDFLib || !window.PDFLib.PDFDocument) {
        window.ToolNest.showToast('PDF library (pdf-lib) is still loading. Please try again.', 'danger');
        return;
      }

      progressWrap.classList.remove('d-none');
      resultCard.classList.add('d-none');
      progressBar.style.width = '10%';
      progressBar.textContent = '10%';

      try {
        const pdfDoc = await window.PDFLib.PDFDocument.create();
        const sizeMode = pageSizeSelect.value || 'a4';
        const orientMode = orientationSelect.value || 'portrait';
        const marginPt = parseInt(marginSelect.value, 10) || 0;

        for (let i = 0; i < imageItems.length; i++) {
          const item = imageItems[i];
          const rendered = await renderRotatedImageBytes(item);
          const embeddedImg =
            rendered.mime === 'image/png'
              ? await pdfDoc.embedPng(rendered.bytes)
              : await pdfDoc.embedJpg(rendered.bytes);

          let pageW;
          let pageH;

          if (sizeMode === 'fit') {
            pageW = rendered.width + marginPt * 2;
            pageH = rendered.height + marginPt * 2;
          } else {
            const baseSpec = PAGE_SIZES_PT[sizeMode] || PAGE_SIZES_PT.a4;
            let useLandscape = orientMode === 'landscape';
            if (orientMode === 'auto') {
              useLandscape = rendered.width > rendered.height;
            }
            pageW = useLandscape ? baseSpec.height : baseSpec.width;
            pageH = useLandscape ? baseSpec.width : baseSpec.height;
          }

          const page = pdfDoc.addPage([pageW, pageH]);
          const availW = Math.max(20, pageW - marginPt * 2);
          const availH = Math.max(20, pageH - marginPt * 2);

          const scale = sizeMode === 'fit' ? 1 : Math.min(availW / rendered.width, availH / rendered.height);
          const drawW = rendered.width * scale;
          const drawH = rendered.height * scale;
          const x = (pageW - drawW) / 2;
          const y = (pageH - drawH) / 2;

          page.drawImage(embeddedImg, {
            x: x,
            y: y,
            width: drawW,
            height: drawH
          });

          const pct = Math.round(((i + 1) / imageItems.length) * 100);
          progressBar.style.width = pct + '%';
          progressBar.textContent = pct + '%';
        }

        const pdfBytes = await pdfDoc.save();
        generatedPdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        setTimeout(function () {
          progressWrap.classList.add('d-none');
        }, 250);

        resultCard.classList.remove('d-none');
        resultSummary.innerHTML =
          'Created <strong>' +
          window.ToolNest.escapeHtml(getCleanOutputFilename()) +
          '</strong> with <strong>' +
          imageItems.length +
          ' page(s)</strong> (' +
          window.ToolNest.formatBytes(generatedPdfBlob.size) +
          ')';

        window.ToolNest.showToast('PDF generated with ' + imageItems.length + ' page(s)!', 'success');
      } catch (err) {
        progressWrap.classList.add('d-none');
        window.ToolNest.showToast(err.message || 'Failed to build PDF.', 'danger');
      }
    }

    function addFiles(files) {
      const valid = files.filter(function (f) {
        return f.type === 'image/jpeg' || f.type === 'image/png' || f.type === 'image/webp' || /\.(jpe?g|png|webp)$/i.test(f.name);
      });
      if (valid.length === 0) {
        window.ToolNest.showToast('Please select valid JPG, PNG, or WebP images.', 'danger');
        return;
      }

      Promise.all(valid.map(loadImageItem))
        .then(function (loaded) {
          imageItems = imageItems.concat(loaded);
          renderImageGrid();
          window.ToolNest.showToast('Added ' + loaded.length + ' image(s). Reorder or rotate, then click Create PDF.', 'success');
        })
        .catch(function (err) {
          window.ToolNest.showToast(err.message, 'danger');
        });
    }

    window.ToolNest.setupDropzone(dropzone, fileInput, addFiles);

    if (buildBtn) {
      buildBtn.addEventListener('click', buildPdfDocument);
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        if (!generatedPdfBlob) return;
        window.ToolNest.downloadBlob(generatedPdfBlob, getCleanOutputFilename());
      });
    }

    if (sampleBtn) {
      sampleBtn.addEventListener('click', function () {
        cleanupItems();
        createSampleDocumentImages().then(function (files) {
          addFiles(files);
        });
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        cleanupItems();
        fileInput.value = '';
        generatedPdfBlob = null;
        renderImageGrid();
        resultCard.classList.add('d-none');
      });
    }
  });
})();
