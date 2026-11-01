/**
 * ToolNest - Image Resizer with Editable Social & Portal Presets
 * (/assets/js/tools/image-resizer.js)
 * 100% Client-Side Image Resizer using HTML5 Canvas
 */
(function () {
  'use strict';

  /**
   * SINGLE EDITABLE JS CONFIG FOR SOCIAL & PORTAL SIZE PRESETS
   * Edit or add presets here and the UI buttons + dropdown update automatically.
   */
  const SOCIAL_SIZE_PRESETS = [
    { id: 'fb-post-landscape', platform: 'Facebook', name: 'Facebook Shared Post', width: 1200, height: 630 },
    { id: 'fb-post-square', platform: 'Facebook', name: 'Facebook Square Post', width: 1080, height: 1080 },
    { id: 'fb-cover', platform: 'Facebook', name: 'Facebook Page / Profile Cover', width: 820, height: 312 },
    { id: 'fb-story', platform: 'Facebook', name: 'Facebook Story & Reel', width: 1080, height: 1920 },
    { id: 'fb-ad-feed', platform: 'Facebook', name: 'Facebook Feed Ad (1:1)', width: 1080, height: 1080 },
    { id: 'fb-ad-link', platform: 'Facebook', name: 'Facebook Carousel / Link Ad', width: 1200, height: 628 },
    { id: 'fb-event', platform: 'Facebook', name: 'Facebook Event Cover', width: 1920, height: 1005 },
    { id: 'ig-portrait', platform: 'Instagram', name: 'Instagram Portrait Post (4:5)', width: 1080, height: 1350 },
    { id: 'yt-thumb', platform: 'YouTube', name: 'YouTube HD Thumbnail', width: 1280, height: 720 },
    { id: 'li-banner', platform: 'LinkedIn', name: 'LinkedIn Profile Banner', width: 1584, height: 396 },
    { id: 'bd-job-photo', platform: 'BD Job Portal', name: 'Teletalk / BD Job Photo', width: 300, height: 300 },
    { id: 'bd-job-sign', platform: 'BD Job Portal', name: 'Teletalk / BD Job Signature', width: 300, height: 80 }
  ];

  let sourceImg = null;
  let sourceName = 'sample-image';
  let aspectRatio = 1.5;

  function generateSampleCanvasImage() {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 853;
    const ctx = c.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 1280, 853);
    grad.addColorStop(0, '#1E40AF');
    grad.addColorStop(0.55, '#2563EB');
    grad.addColorStop(1, '#10B981');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 853);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 4;
    ctx.strokeRect(48, 48, 1184, 757);

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(640, 310, 95, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ToolNest Social Media Resizer', 640, 490);
    ctx.font = '28px Inter, sans-serif';
    ctx.fillText('Original Sample: 1280 x 853 px', 640, 545);

    const img = new Image();
    img.src = c.toDataURL('image/png');
    return img;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-resize-dropzone');
    const fileInput = document.getElementById('tn-resize-file-input');
    const presetSelect = document.getElementById('tn-resize-preset');
    const quickChipsContainer = document.getElementById('tn-resize-quick-chips');
    const widthInput = document.getElementById('tn-resize-width');
    const heightInput = document.getElementById('tn-resize-height');
    const lockAspect = document.getElementById('tn-resize-lock');
    const fitModeSelect = document.getElementById('tn-resize-fit');
    const bgColorInput = document.getElementById('tn-resize-bg');
    const formatSelect = document.getElementById('tn-resize-format');
    const previewCanvas = document.getElementById('tn-resize-canvas');
    const metaLabel = document.getElementById('tn-resize-meta');
    const btnDownload = document.getElementById('tn-resize-download-btn');
    const btnSample = document.getElementById('tn-resize-sample-btn');
    const btnReset = document.getElementById('tn-resize-reset-btn');

    if (!previewCanvas) return;

    // Populate Preset Dropdown and Quick Facebook Buttons from SOCIAL_SIZE_PRESETS config
    SOCIAL_SIZE_PRESETS.forEach(function (preset) {
      const opt = document.createElement('option');
      opt.value = preset.id;
      opt.textContent = preset.platform + ' — ' + preset.name + ' (' + preset.width + ' × ' + preset.height + ' px)';
      presetSelect.appendChild(opt);
    });

    if (quickChipsContainer) {
      quickChipsContainer.innerHTML = SOCIAL_SIZE_PRESETS.slice(0, 6)
        .map(function (p) {
          return (
            '<button type="button" class="btn tn-btn--outline btn-sm" data-preset-id="' +
            p.id +
            '">' +
            window.ToolNest.escapeHtml(p.name) +
            ' (' +
            p.width +
            '&times;' +
            p.height +
            ')</button>'
          );
        })
        .join('');

      quickChipsContainer.querySelectorAll('[data-preset-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const id = btn.getAttribute('data-preset-id');
          presetSelect.value = id;
          applyPresetById(id);
        });
      });
    }

    function applyPresetById(id) {
      const found = SOCIAL_SIZE_PRESETS.find(function (p) {
        return p.id === id;
      });
      if (!found) return;
      lockAspect.checked = false;
      widthInput.value = found.width;
      heightInput.value = found.height;
      renderCanvas();
    }

    presetSelect.addEventListener('change', function () {
      if (presetSelect.value === 'custom') return;
      applyPresetById(presetSelect.value);
    });

    widthInput.addEventListener('input', function () {
      presetSelect.value = 'custom';
      const w = Math.max(1, parseInt(widthInput.value, 10) || 1);
      if (lockAspect.checked && aspectRatio > 0) {
        heightInput.value = Math.max(1, Math.round(w / aspectRatio));
      }
      renderCanvas();
    });

    heightInput.addEventListener('input', function () {
      presetSelect.value = 'custom';
      const h = Math.max(1, parseInt(heightInput.value, 10) || 1);
      if (lockAspect.checked && aspectRatio > 0) {
        widthInput.value = Math.max(1, Math.round(h * aspectRatio));
      }
      renderCanvas();
    });

    fitModeSelect.addEventListener('change', renderCanvas);
    bgColorInput.addEventListener('input', renderCanvas);
    formatSelect.addEventListener('change', renderCanvas);

    function renderCanvas() {
      if (!sourceImg) return;
      const targetW = Math.min(4096, Math.max(16, parseInt(widthInput.value, 10) || 1200));
      const targetH = Math.min(4096, Math.max(16, parseInt(heightInput.value, 10) || 630));
      const mode = fitModeSelect.value || 'cover';
      const bg = bgColorInput.value || '#FFFFFF';

      previewCanvas.width = targetW;
      previewCanvas.height = targetH;
      const ctx = previewCanvas.getContext('2d');

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, targetW, targetH);

      const srcW = sourceImg.naturalWidth || sourceImg.width;
      const srcH = sourceImg.naturalHeight || sourceImg.height;

      if (mode === 'stretch') {
        ctx.drawImage(sourceImg, 0, 0, targetW, targetH);
      } else if (mode === 'contain') {
        const scale = Math.min(targetW / srcW, targetH / srcH);
        const drawW = Math.round(srcW * scale);
        const drawH = Math.round(srcH * scale);
        const offsetX = Math.round((targetW - drawW) / 2);
        const offsetY = Math.round((targetH - drawH) / 2);
        ctx.drawImage(sourceImg, offsetX, offsetY, drawW, drawH);
      } else {
        // Cover (Center Crop)
        const scale = Math.max(targetW / srcW, targetH / srcH);
        const cropW = Math.round(targetW / scale);
        const cropH = Math.round(targetH / scale);
        const sx = Math.round((srcW - cropW) / 2);
        const sy = Math.round((srcH - cropH) / 2);
        ctx.drawImage(sourceImg, sx, sy, cropW, cropH, 0, 0, targetW, targetH);
      }

      metaLabel.textContent =
        'Original: ' + srcW + ' × ' + srcH + ' px  →  Output: ' + targetW + ' × ' + targetH + ' px';
    }

    function loadSourceImage(img, name) {
      sourceImg = img;
      sourceName = (name || 'resized-image').replace(/\.[^/.]+$/, '');
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      aspectRatio = w / h;
      renderCanvas();
    }

    window.ToolNest.setupDropzone(dropzone, fileInput, function (files) {
      const file = files[0];
      if (!file || !file.type.startsWith('image/')) {
        window.ToolNest.showToast('Please select a valid image file.', 'danger');
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        loadSourceImage(img, file.name);
        window.ToolNest.showToast('Image loaded and resized!', 'success');
      };
      img.src = url;
    });

    if (btnDownload) {
      btnDownload.addEventListener('click', function () {
        if (!sourceImg) return;
        const mime = formatSelect.value || 'image/jpeg';
        const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
        previewCanvas.toBlob(
          function (blob) {
            if (blob) {
              const outName = sourceName + '-' + previewCanvas.width + 'x' + previewCanvas.height + ext;
              window.ToolNest.downloadBlob(blob, outName);
              window.ToolNest.showToast('Resized image downloaded!', 'success');
            }
          },
          mime,
          0.92
        );
      });
    }

    if (btnSample) {
      btnSample.addEventListener('click', function () {
        const sample = generateSampleCanvasImage();
        sample.onload = function () {
          loadSourceImage(sample, 'toolnest-social-banner');
          window.ToolNest.showToast('Sample graphic loaded!', 'success');
        };
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', function () {
        presetSelect.value = 'fb-post-landscape';
        applyPresetById('fb-post-landscape');
      });
    }

    // Load default sample image on startup so canvas is immediately interactive
    const initialSample = generateSampleCanvasImage();
    initialSample.onload = function () {
      loadSourceImage(initialSample, 'toolnest-social-banner');
      applyPresetById('fb-post-landscape');
    };
  });
})();
