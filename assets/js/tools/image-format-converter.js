/**
 * ToolNest - Image Format Converter (/assets/js/tools/image-format-converter.js)
 * 100% Client-Side Batch Converter between JPG, PNG, WebP, and HEIC/HEIF (input).
 * Lazily loads heic2any@0.0.4 from jsDelivr ONLY when a .heic/.heif file is selected.
 * Supports quality slider, transparent-to-white fill for JPG, and ZIP export via JSZip 3.10.1.
 */
(function () {
  'use strict';

  const HEIC2ANY_CDN_URL = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';

  let queuedFiles = [];
  let convertedItems = [];
  let heicLoaderPromise = null;

  function isHeicFile(file) {
    if (!file) return false;
    const t = (file.type || '').toLowerCase();
    const n = (file.name || '').toLowerCase();
    return t === 'image/heic' || t === 'image/heif' || n.endsWith('.heic') || n.endsWith('.heif');
  }

  function isSupportedImageFile(file) {
    if (!file) return false;
    if (isHeicFile(file)) return true;
    const t = (file.type || '').toLowerCase();
    const n = (file.name || '').toLowerCase();
    return (
      t === 'image/jpeg' ||
      t === 'image/png' ||
      t === 'image/webp' ||
      t === 'image/gif' ||
      t === 'image/bmp' ||
      n.endsWith('.jpg') ||
      n.endsWith('.jpeg') ||
      n.endsWith('.png') ||
      n.endsWith('.webp')
    );
  }

  /**
   * Dynamically load pinned heic2any@0.0.4 ONLY when a user selects a HEIC/HEIF file
   */
  function ensureHeicLibraryLoaded() {
    if (typeof window.heic2any === 'function') {
      return Promise.resolve(window.heic2any);
    }
    if (heicLoaderPromise) {
      return heicLoaderPromise;
    }

    heicLoaderPromise = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = HEIC2ANY_CDN_URL;
      script.async = true;
      script.onload = function () {
        if (typeof window.heic2any === 'function') {
          resolve(window.heic2any);
        } else {
          heicLoaderPromise = null;
          reject(new Error('HEIC decoder loaded but window.heic2any was not initialized.'));
        }
      };
      script.onerror = function () {
        heicLoaderPromise = null;
        reject(new Error('Could not load HEIC decoder library (heic2any@0.0.4). Check your internet connection.'));
      };
      document.head.appendChild(script);
    });

    return heicLoaderPromise;
  }

  function decodeFileToImage(file) {
    const decodePromise = isHeicFile(file)
      ? ensureHeicLibraryLoaded().then(function (heic2anyFn) {
          return heic2anyFn({
            blob: file,
            toType: 'image/png'
          }).then(function (resultBlob) {
            return Array.isArray(resultBlob) ? resultBlob[0] : resultBlob;
          });
        })
      : Promise.resolve(file);

    return decodePromise.then(function (imageBlob) {
      return new Promise(function (resolve, reject) {
        const url = URL.createObjectURL(imageBlob);
        const img = new Image();
        img.onload = function () {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          reject(new Error('Unsupported or corrupted image file: ' + file.name));
        };
        img.src = url;
      });
    });
  }

  function convertSingleFile(file, config) {
    return decodeFileToImage(file).then(function (img) {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      const outMime = config.targetFormat;
      if (outMime === 'image/jpeg' || config.fillWhiteBg) {
        ctx.fillStyle = config.bgColor || '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(img, 0, 0, w, h);

      const ext = outMime === 'image/png' ? '.png' : outMime === 'image/webp' ? '.webp' : '.jpg';
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const outName = baseName + ext;

      return new Promise(function (resolve, reject) {
        canvas.toBlob(
          function (blob) {
            if (!blob) {
              reject(new Error('Browser canvas could not encode ' + file.name));
              return;
            }
            const previewUrl = URL.createObjectURL(blob);
            resolve({
              origName: file.name,
              origFormat: isHeicFile(file) ? 'HEIC/HEIF' : (file.type || 'image').replace('image/', '').toUpperCase(),
              outputName: outName,
              outFormat: ext.replace('.', '').toUpperCase(),
              width: w,
              height: h,
              origSize: file.size,
              outSize: blob.size,
              blob: blob,
              previewUrl: previewUrl
            });
          },
          outMime,
          outMime === 'image/png' ? undefined : config.quality
        );
      });
    });
  }

  /**
   * Generate sample transparent PNG and WebP files for instant testing
   */
  function generateSampleFiles() {
    const specs = [
      { name: 'transparent-brand-badge.png', mime: 'image/png', w: 900, h: 600, label: 'Transparent PNG Badge' },
      { name: 'product-hero-banner.webp', mime: 'image/webp', w: 1200, h: 800, label: 'High-Res WebP Photo' }
    ];

    return Promise.all(
      specs.map(function (sp) {
        return new Promise(function (resolve) {
          const c = document.createElement('canvas');
          c.width = sp.w;
          c.height = sp.h;
          const ctx = c.getContext('2d');

          if (sp.mime !== 'image/png') {
            const g = ctx.createLinearGradient(0, 0, sp.w, sp.h);
            g.addColorStop(0, '#0F172A');
            g.addColorStop(1, '#2563EB');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, sp.w, sp.h);
          }

          // Rounded card in center (leaving outer corners transparent on PNG)
          ctx.fillStyle = '#2563EB';
          ctx.beginPath();
          ctx.arc(sp.w / 2, sp.h / 2, Math.min(sp.w, sp.h) * 0.36, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(sp.w / 2 + 90, sp.h / 2 - 70, 55, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 42px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(sp.label, sp.w / 2, sp.h / 2);
          ctx.font = '24px Inter, sans-serif';
          ctx.fillText(sp.w + ' × ' + sp.h + ' px • 100% Local Conversion', sp.w / 2, sp.h / 2 + 48);

          c.toBlob(
            function (blob) {
              resolve(new File([blob], sp.name, { type: sp.mime }));
            },
            sp.mime,
            0.92
          );
        });
      })
    );
  }

  function cleanupConverted() {
    convertedItems.forEach(function (it) {
      if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    });
    convertedItems = [];
  }

  // Expose helper functions for automated verification
  if (typeof window !== 'undefined') {
    window.ToolNestImageFormatConverter = {
      HEIC2ANY_CDN_URL: HEIC2ANY_CDN_URL,
      isHeicFile: isHeicFile,
      isSupportedImageFile: isSupportedImageFile,
      ensureHeicLibraryLoaded: ensureHeicLibraryLoaded,
      decodeFileToImage: decodeFileToImage
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-ifc-dropzone');
    const fileInput = document.getElementById('tn-ifc-file-input');
    const queueWrap = document.getElementById('tn-ifc-queue-wrap');
    const queueCount = document.getElementById('tn-ifc-queue-count');
    const queueList = document.getElementById('tn-ifc-queue-list');

    const targetFormatSelect = document.getElementById('tn-ifc-format');
    const qualitySlider = document.getElementById('tn-ifc-quality');
    const qualityBadge = document.getElementById('tn-ifc-quality-val');
    const qualityGroup = document.getElementById('tn-ifc-quality-group');
    const fillWhiteCheck = document.getElementById('tn-ifc-fill-white');
    const bgColorInput = document.getElementById('tn-ifc-bg-color');

    const convertBtn = document.getElementById('tn-ifc-convert-btn');
    const sampleBtn = document.getElementById('tn-ifc-sample-btn');
    const resetBtn = document.getElementById('tn-ifc-reset-btn');
    const dlZipBtn = document.getElementById('tn-ifc-dl-zip');
    const dlEachBtn = document.getElementById('tn-ifc-dl-each');

    const progressWrap = document.getElementById('tn-ifc-progress-wrap');
    const progressText = document.getElementById('tn-ifc-progress-text');
    const progressBar = document.getElementById('tn-ifc-progress-bar');
    const errorBox = document.getElementById('tn-ifc-error-box');
    const resultsWrap = document.getElementById('tn-ifc-results-wrap');
    const summaryText = document.getElementById('tn-ifc-summary-text');
    const resultsList = document.getElementById('tn-ifc-results-list');

    if (!dropzone || !fileInput) return;

    function updateFormatControls() {
      const isPng = targetFormatSelect.value === 'image/png';
      if (qualityGroup) {
        qualityGroup.style.opacity = isPng ? '0.5' : '1';
        qualitySlider.disabled = isPng;
      }
      if (targetFormatSelect.value === 'image/jpeg' && fillWhiteCheck) {
        fillWhiteCheck.checked = true;
      }
    }

    targetFormatSelect.addEventListener('change', updateFormatControls);
    qualitySlider.addEventListener('input', function () {
      qualityBadge.textContent = qualitySlider.value + '%';
    });

    function showError(msg) {
      if (!errorBox) return;
      if (!msg) {
        errorBox.classList.add('d-none');
        errorBox.textContent = '';
      } else {
        errorBox.classList.remove('d-none');
        errorBox.innerHTML = '<i class="bi bi-exclamation-octagon-fill me-1" aria-hidden="true"></i> ' + window.ToolNest.escapeHtml(msg);
      }
    }

    function renderQueue() {
      if (queuedFiles.length === 0) {
        queueWrap.classList.add('d-none');
        return;
      }
      queueWrap.classList.remove('d-none');
      queueCount.textContent = queuedFiles.length + ' File(s) Selected';
      queueList.innerHTML = queuedFiles
        .map(function (f, i) {
          const badge = isHeicFile(f) ? '<span class="badge bg-warning text-dark">HEIC</span>' : '';
          return (
            '<div class="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill border bg-white small">' +
            '<i class="bi bi-file-earmark-image text-primary" aria-hidden="true"></i>' +
            '<span class="fw-semibold text-truncate" style="max-width: 170px;">' +
            window.ToolNest.escapeHtml(f.name) +
            '</span>' +
            badge +
            '<span class="text-muted">(' +
            window.ToolNest.formatBytes(f.size) +
            ')</span>' +
            '<button type="button" class="btn-close" style="font-size: 0.65rem;" data-rm-idx="' +
            i +
            '" aria-label="Remove file"></button>' +
            '</div>'
          );
        })
        .join('');

      queueList.querySelectorAll('[data-rm-idx]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const idx = Number(btn.getAttribute('data-rm-idx'));
          queuedFiles.splice(idx, 1);
          renderQueue();
        });
      });
    }

    function renderConvertedResults() {
      if (convertedItems.length === 0) {
        resultsWrap.classList.add('d-none');
        return;
      }
      resultsWrap.classList.remove('d-none');

      let totalOrig = 0;
      let totalOut = 0;
      resultsList.innerHTML = convertedItems
        .map(function (it, idx) {
          totalOrig += it.origSize;
          totalOut += it.outSize;
          return (
            '<div class="tn-result-box mb-2">' +
            '<div class="row align-items-center g-3">' +
            '<div class="col-auto">' +
            '<img src="' +
            it.previewUrl +
            '" alt="Converted preview of ' +
            window.ToolNest.escapeHtml(it.outputName) +
            '" width="68" height="68" class="rounded border object-fit-cover" loading="lazy">' +
            '</div>' +
            '<div class="col">' +
            '<div class="fw-bold text-break">' +
            window.ToolNest.escapeHtml(it.outputName) +
            ' <span class="badge bg-primary-subtle text-primary ms-1">' +
            it.origFormat +
            ' &rarr; ' +
            it.outFormat +
            '</span></div>' +
            '<div class="small text-muted">' +
            it.width +
            ' &times; ' +
            it.height +
            ' px &bull; Original: <strong>' +
            window.ToolNest.formatBytes(it.origSize) +
            '</strong> &rarr; New Size: <strong class="text-success">' +
            window.ToolNest.formatBytes(it.outSize) +
            '</strong>' +
            '</div>' +
            '</div>' +
            '<div class="col-12 col-sm-auto text-end">' +
            '<button type="button" class="btn tn-btn--primary btn-sm" data-dl-conv="' +
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

      summaryText.innerHTML =
        'Converted <strong>' +
        convertedItems.length +
        ' image(s)</strong> &bull; Total Original Size: <strong>' +
        window.ToolNest.formatBytes(totalOrig) +
        '</strong> &rarr; Total New Size: <strong class="text-success">' +
        window.ToolNest.formatBytes(totalOut) +
        '</strong>';

      resultsList.querySelectorAll('[data-dl-conv]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-dl-conv'));
          if (convertedItems[i]) {
            window.ToolNest.downloadBlob(convertedItems[i].blob, convertedItems[i].outputName);
          }
        });
      });
    }

    function runBatchConversion() {
      showError('');
      if (queuedFiles.length === 0) {
        window.ToolNest.showToast('Please select or drop image files first.', 'warning');
        return;
      }

      cleanupConverted();
      const cfg = {
        targetFormat: targetFormatSelect.value || 'image/jpeg',
        quality: Math.min(1, Math.max(0.1, Number(qualitySlider.value) / 100)),
        fillWhiteBg: Boolean(fillWhiteCheck && fillWhiteCheck.checked),
        bgColor: bgColorInput ? bgColorInput.value : '#FFFFFF'
      };

      const hasHeic = queuedFiles.some(isHeicFile);
      progressWrap.classList.remove('d-none');
      progressText.textContent = hasHeic
        ? 'Loading client-side HEIC decoder (heic2any) & converting images...'
        : 'Converting image formats in browser...';
      progressBar.style.width = '10%';
      progressBar.textContent = '10%';

      const failedNames = [];
      let chain = Promise.resolve();

      queuedFiles.forEach(function (file, index) {
        chain = chain.then(function () {
          return convertSingleFile(file, cfg)
            .then(function (item) {
              convertedItems.push(item);
            })
            .catch(function (err) {
              failedNames.push(file.name + ' (' + (err.message || 'Decode error') + ')');
            })
            .then(function () {
              const pct = Math.round(((index + 1) / queuedFiles.length) * 100);
              progressBar.style.width = pct + '%';
              progressBar.textContent = pct + '%';
            });
        });
      });

      chain.then(function () {
        setTimeout(function () {
          progressWrap.classList.add('d-none');
        }, 300);

        if (failedNames.length > 0) {
          showError('Could not convert: ' + failedNames.join('; '));
        }

        renderConvertedResults();
        if (convertedItems.length > 0) {
          window.ToolNest.showToast('Converted ' + convertedItems.length + ' image(s) successfully!', 'success');
        }
      });
    }

    function addFiles(files) {
      showError('');
      const valid = [];
      const rejected = [];

      files.forEach(function (f) {
        if (isSupportedImageFile(f)) {
          valid.push(f);
        } else {
          rejected.push(f.name);
        }
      });

      if (rejected.length > 0) {
        showError('Unsupported file type skipped: ' + rejected.join(', ') + '. Supported inputs: JPG, PNG, WebP, HEIC/HEIF.');
      }

      if (valid.length === 0) return;

      queuedFiles = queuedFiles.concat(valid);
      renderQueue();
      runBatchConversion();
    }

    window.ToolNest.setupDropzone(dropzone, fileInput, addFiles);

    if (convertBtn) {
      convertBtn.addEventListener('click', runBatchConversion);
    }

    if (sampleBtn) {
      sampleBtn.addEventListener('click', function () {
        queuedFiles = [];
        generateSampleFiles().then(function (files) {
          addFiles(files);
        });
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        queuedFiles = [];
        fileInput.value = '';
        showError('');
        cleanupConverted();
        renderQueue();
        resultsWrap.classList.add('d-none');
      });
    }

    if (dlZipBtn) {
      dlZipBtn.addEventListener('click', function () {
        if (convertedItems.length === 0) return;
        if (typeof window.JSZip === 'function') {
          const zip = new window.JSZip();
          convertedItems.forEach(function (it) {
            zip.file(it.outputName, it.blob);
          });
          zip.generateAsync({ type: 'blob' }).then(function (zipBlob) {
            window.ToolNest.downloadBlob(zipBlob, 'toolnest-converted-images.zip');
            window.ToolNest.showToast('Downloaded ZIP archive with ' + convertedItems.length + ' converted images!', 'success');
          });
        } else {
          convertedItems.forEach(function (it, i) {
            setTimeout(function () {
              window.ToolNest.downloadBlob(it.blob, it.outputName);
            }, i * 220);
          });
        }
      });
    }

    if (dlEachBtn) {
      dlEachBtn.addEventListener('click', function () {
        convertedItems.forEach(function (it, i) {
          setTimeout(function () {
            window.ToolNest.downloadBlob(it.blob, it.outputName);
          }, i * 220);
        });
      });
    }

    updateFormatControls();
  });
})();
