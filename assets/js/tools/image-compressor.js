/**
 * ToolNest - Batch Image Compressor (/assets/js/tools/image-compressor.js)
 * 100% Client-Side Multi-File Image Compression with Quality Slider & Before/After Stats
 */
(function () {
  'use strict';

  let uploadedFiles = [];
  let compressedItems = [];

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to decode image: ' + file.name));
      };
      img.src = url;
    });
  }

  function compressSingleFile(file, quality, maxWidth, outputFormat) {
    return loadImageFromFile(file).then(function (img) {
      let targetW = img.naturalWidth || img.width;
      let targetH = img.naturalHeight || img.height;

      if (maxWidth > 0 && targetW > maxWidth) {
        const ratio = maxWidth / targetW;
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      let mime = outputFormat;
      if (mime === 'auto') {
        // PNG does not support lossy quality parameter in canvas.toBlob, so convert PNG to WebP or JPEG when compressing
        mime = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      }

      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      return new Promise(function (resolve) {
        canvas.toBlob(
          function (blob) {
            const safeBlob = blob || file;
            const ext = mime === 'image/webp' ? '.webp' : mime === 'image/png' ? '.png' : '.jpg';
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const previewUrl = URL.createObjectURL(safeBlob);
            resolve({
              originalName: file.name,
              outputName: baseName + '-compressed' + ext,
              originalSize: file.size,
              compressedSize: safeBlob.size,
              width: targetW,
              height: targetH,
              blob: safeBlob,
              previewUrl: previewUrl
            });
          },
          mime,
          quality
        );
      });
    });
  }

  function createSamplePhotoFile() {
    return new Promise(function (resolve) {
      const c = document.createElement('canvas');
      c.width = 1200;
      c.height = 800;
      const ctx = c.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 1200, 800);
      grad.addColorStop(0, '#1E40AF');
      grad.addColorStop(0.5, '#2563EB');
      grad.addColorStop(1, '#F59E0B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 800);

      // Draw decorative circles & noise detail so uncompressed size is realistic (~250 KB)
      for (let i = 0; i < 180; i++) {
        ctx.fillStyle = 'rgba(255,255,255,' + ((i % 7) * 0.04 + 0.05) + ')';
        ctx.beginPath();
        ctx.arc((i * 73) % 1200, (i * 59) % 800, (i % 45) + 12, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 54px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ToolNest Sample High-Res Photo', 600, 380);
      ctx.font = '30px Inter, sans-serif';
      ctx.fillText('1200 x 800 px • Ready for Client-Side Compression', 600, 440);

      c.toBlob(
        function (blob) {
          const file = new File([blob], 'sample-landscape-photo.jpg', { type: 'image/jpeg' });
          resolve(file);
        },
        'image/jpeg',
        0.98
      );
    });
  }

  function cleanupPreviews() {
    compressedItems.forEach(function (item) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    compressedItems = [];
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-comp-dropzone');
    const fileInput = document.getElementById('tn-comp-file-input');
    const qualitySlider = document.getElementById('tn-comp-quality');
    const qualityLabel = document.getElementById('tn-comp-quality-val');
    const maxWSelect = document.getElementById('tn-comp-maxw');
    const formatSelect = document.getElementById('tn-comp-format');
    const btnCompress = document.getElementById('tn-comp-run-btn');
    const btnSample = document.getElementById('tn-comp-sample-btn');
    const btnDownloadAll = document.getElementById('tn-comp-download-all');
    const btnReset = document.getElementById('tn-comp-reset-btn');
    const progressWrap = document.getElementById('tn-comp-progress-wrap');
    const progressBar = document.getElementById('tn-comp-progress-bar');
    const resultsWrap = document.getElementById('tn-comp-results-wrap');
    const listContainer = document.getElementById('tn-comp-list');
    const totalSummaryEl = document.getElementById('tn-comp-total-summary');

    if (!dropzone || !fileInput) return;

    qualitySlider.addEventListener('input', function () {
      qualityLabel.textContent = qualitySlider.value + '%';
    });

    qualitySlider.addEventListener('change', function () {
      if (uploadedFiles.length > 0) {
        processBatch();
      }
    });

    maxWSelect.addEventListener('change', function () {
      if (uploadedFiles.length > 0) processBatch();
    });

    formatSelect.addEventListener('change', function () {
      if (uploadedFiles.length > 0) processBatch();
    });

    function renderResults() {
      if (compressedItems.length === 0) {
        resultsWrap.classList.add('d-none');
        return;
      }

      resultsWrap.classList.remove('d-none');
      let totalBefore = 0;
      let totalAfter = 0;

      listContainer.innerHTML = compressedItems
        .map(function (item, idx) {
          totalBefore += item.originalSize;
          totalAfter += item.compressedSize;
          const diff = item.originalSize - item.compressedSize;
          const pct = item.originalSize > 0 ? Math.round((diff / item.originalSize) * 100) : 0;
          const badgeClass = pct >= 0 ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-dark';
          const badgeText = pct >= 0 ? '-' + pct + '% Saved' : '+' + Math.abs(pct) + '%';

          return (
            '<div class="tn-result-box mb-3">' +
            '<div class="row align-items-center g-3">' +
            '<div class="col-auto">' +
            '<img src="' +
            item.previewUrl +
            '" alt="Compressed preview of ' +
            window.ToolNest.escapeHtml(item.originalName) +
            '" width="72" height="72" class="rounded border object-fit-cover" loading="lazy">' +
            '</div>' +
            '<div class="col">' +
            '<div class="fw-bold text-break">' +
            window.ToolNest.escapeHtml(item.outputName) +
            '</div>' +
            '<div class="small text-muted">' +
            item.width +
            ' &times; ' +
            item.height +
            ' px &bull; Before: <strong>' +
            window.ToolNest.formatBytes(item.originalSize) +
            '</strong> &rarr; After: <strong class="text-success">' +
            window.ToolNest.formatBytes(item.compressedSize) +
            '</strong></div>' +
            '</div>' +
            '<div class="col-12 col-sm-auto d-flex align-items-center gap-2 justify-content-end">' +
            '<span class="badge ' +
            badgeClass +
            ' px-2 py-2">' +
            badgeText +
            '</span>' +
            '<button type="button" class="btn tn-btn--primary btn-sm" data-dl-idx="' +
            idx +
            '">' +
            '<i class="bi bi-download" aria-hidden="true"></i> Download' +
            '</button>' +
            '</div>' +
            '</div>' +
            '</div>'
          );
        })
        .join('');

      const totalSaved = Math.max(0, totalBefore - totalAfter);
      const totalPct = totalBefore > 0 ? Math.round((totalSaved / totalBefore) * 100) : 0;
      totalSummaryEl.innerHTML =
        'Processed <strong>' +
        compressedItems.length +
        ' file(s)</strong>: Total Before <strong>' +
        window.ToolNest.formatBytes(totalBefore) +
        '</strong> &rarr; Total After <strong class="text-success">' +
        window.ToolNest.formatBytes(totalAfter) +
        '</strong> (Saved <strong>' +
        window.ToolNest.formatBytes(totalSaved) +
        ' / ' +
        totalPct +
        '%</strong>)';

      listContainer.querySelectorAll('[data-dl-idx]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-dl-idx'));
          if (compressedItems[i]) {
            window.ToolNest.downloadBlob(compressedItems[i].blob, compressedItems[i].outputName);
          }
        });
      });
    }

    function processBatch() {
      if (uploadedFiles.length === 0) {
        window.ToolNest.showToast('Please select or drop at least one image first.', 'warning');
        return;
      }

      cleanupPreviews();
      const quality = Math.min(1, Math.max(0.05, Number(qualitySlider.value) / 100));
      const maxW = Number(maxWSelect.value) || 0;
      const fmt = formatSelect.value || 'auto';

      progressWrap.classList.remove('d-none');
      progressBar.style.width = '10%';
      progressBar.textContent = '10%';

      let chain = Promise.resolve();
      uploadedFiles.forEach(function (file, index) {
        chain = chain.then(function () {
          return compressSingleFile(file, quality, maxW, fmt).then(function (res) {
            compressedItems.push(res);
            const pct = Math.round(((index + 1) / uploadedFiles.length) * 100);
            progressBar.style.width = pct + '%';
            progressBar.textContent = pct + '%';
          });
        });
      });

      chain
        .then(function () {
          setTimeout(function () {
            progressWrap.classList.add('d-none');
          }, 350);
          renderResults();
          window.ToolNest.showToast('Compressed ' + compressedItems.length + ' image(s) successfully!', 'success');
        })
        .catch(function (err) {
          progressWrap.classList.add('d-none');
          window.ToolNest.showToast(err.message || 'Could not compress image.', 'danger');
        });
    }

    window.ToolNest.setupDropzone(dropzone, fileInput, function (files) {
      const valid = files.filter(function (f) {
        return f.type.startsWith('image/');
      });
      if (valid.length === 0) {
        window.ToolNest.showToast('Please select valid JPG, PNG, or WebP image files.', 'danger');
        return;
      }
      uploadedFiles = valid;
      processBatch();
    });

    if (btnCompress) {
      btnCompress.addEventListener('click', processBatch);
    }

    if (btnSample) {
      btnSample.addEventListener('click', function () {
        createSamplePhotoFile().then(function (sampleFile) {
          uploadedFiles = [sampleFile];
          processBatch();
        });
      });
    }

    if (btnDownloadAll) {
      btnDownloadAll.addEventListener('click', function () {
        compressedItems.forEach(function (item, idx) {
          setTimeout(function () {
            window.ToolNest.downloadBlob(item.blob, item.outputName);
          }, idx * 220);
        });
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', function () {
        uploadedFiles = [];
        fileInput.value = '';
        cleanupPreviews();
        resultsWrap.classList.add('d-none');
      });
    }
  });
})();
