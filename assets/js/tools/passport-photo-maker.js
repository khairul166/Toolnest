/**
 * ToolNest - Passport & Visa Photo Maker (/assets/js/tools/passport-photo-maker.js)
 * Official size presets (300 DPI), interactive crop/zoom/pan, background color replacement,
 * and printable 4R / A4 multi-photo sheet generator.
 */
(function () {
  'use strict';

  const PASSPORT_PRESETS = [
    { id: 'bd-passport', name: 'Bangladesh Passport & e-Visa (35 × 45 mm)', width: 413, height: 531, mmW: 35, mmH: 45 },
    { id: 'us-visa', name: 'US / India Passport & Visa (2 × 2 inch)', width: 600, height: 600, mmW: 50.8, mmH: 50.8 },
    { id: 'schengen-uk', name: 'UK / Schengen / Europe Visa (35 × 45 mm)', width: 413, height: 531, mmW: 35, mmH: 45 },
    { id: 'bd-stamp', name: 'Bangladesh Stamp Size (20 × 25 mm)', width: 236, height: 295, mmW: 20, mmH: 25 },
    { id: 'bd-job', name: 'BD Teletalk Job Application (300 × 300 px)', width: 300, height: 300, mmW: 25.4, mmH: 25.4 },
    { id: 'canada-visa', name: 'Canada Visa / PR Photo (35 × 45 mm)', width: 413, height: 531, mmW: 35, mmH: 45 }
  ];

  let portraitImg = null;
  let bgColor = '#FFFFFF';

  function createSamplePortrait() {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 750;
    const ctx = c.getContext('2d');

    // Transparent background so background color picker immediately changes the backdrop!
    ctx.clearRect(0, 0, 600, 750);

    // Shoulders / Formal Suit
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(300, 690, 215, 175, 0, Math.PI, 0, false);
    ctx.fill();

    // White Collar Shirt & Tie
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(235, 520);
    ctx.lineTo(365, 520);
    ctx.lineTo(300, 665);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.moveTo(288, 545);
    ctx.lineTo(312, 545);
    ctx.lineTo(318, 660);
    ctx.lineTo(300, 685);
    ctx.lineTo(282, 660);
    ctx.closePath();
    ctx.fill();

    // Neck
    ctx.fillStyle = '#E6B89C';
    ctx.fillRect(258, 435, 84, 105);

    // Head
    ctx.fillStyle = '#F1C6A8';
    ctx.beginPath();
    ctx.ellipse(300, 315, 112, 142, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(300, 220, 118, 72, 0, Math.PI, 0, false);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(258, 305, 10, 0, Math.PI * 2);
    ctx.arc(342, 305, 10, 0, Math.PI * 2);
    ctx.fill();

    // Friendly neutral expression
    ctx.strokeStyle = '#7C2D12';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(300, 365, 28, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    const img = new Image();
    img.src = c.toDataURL('image/png');
    return img;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-pass-dropzone');
    const fileInput = document.getElementById('tn-pass-file-input');
    const presetSelect = document.getElementById('tn-pass-preset');
    const zoomRange = document.getElementById('tn-pass-zoom');
    const panXRange = document.getElementById('tn-pass-panx');
    const panYRange = document.getElementById('tn-pass-pany');
    const bgColorInput = document.getElementById('tn-pass-bgcolor');
    const chromaTolerance = document.getElementById('tn-pass-tolerance');
    const showGuideCheck = document.getElementById('tn-pass-guide');
    const addBorderCheck = document.getElementById('tn-pass-border');
    const sheetTypeSelect = document.getElementById('tn-pass-sheet');
    const singleCanvas = document.getElementById('tn-pass-single-canvas');
    const sheetCanvas = document.getElementById('tn-pass-sheet-canvas');
    const btnDownloadSingle = document.getElementById('tn-pass-dl-single');
    const btnDownloadSheet = document.getElementById('tn-pass-dl-sheet');
    const btnSample = document.getElementById('tn-pass-sample-btn');
    const btnReset = document.getElementById('tn-pass-reset-btn');
    const singleMeta = document.getElementById('tn-pass-single-meta');

    if (!singleCanvas || !sheetCanvas) return;

    PASSPORT_PRESETS.forEach(function (p) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name + ' — ' + p.width + '×' + p.height + ' px';
      presetSelect.appendChild(opt);
    });

    function getActivePreset() {
      const id = presetSelect.value;
      return (
        PASSPORT_PRESETS.find(function (p) {
          return p.id === id;
        }) || PASSPORT_PRESETS[0]
      );
    }

    function renderSinglePhoto(includeGuideOverlay) {
      if (!portraitImg) return;
      const preset = getActivePreset();
      singleCanvas.width = preset.width;
      singleCanvas.height = preset.height;
      const ctx = singleCanvas.getContext('2d');

      // Fill background color
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, preset.width, preset.height);

      const zoom = Number(zoomRange.value) / 100;
      const panX = Number(panXRange.value);
      const panY = Number(panYRange.value);

      const srcW = portraitImg.naturalWidth || portraitImg.width;
      const srcH = portraitImg.naturalHeight || portraitImg.height;
      const baseScale = Math.max(preset.width / srcW, preset.height / srcH);
      const drawW = srcW * baseScale * zoom;
      const drawH = srcH * baseScale * zoom;
      const dx = (preset.width - drawW) / 2 + panX;
      const dy = (preset.height - drawH) / 2 + panY;

      // Optional smart corner background color replacement when tolerance > 0
      const tol = Number(chromaTolerance.value) || 0;
      if (tol > 0) {
        const tempC = document.createElement('canvas');
        tempC.width = preset.width;
        tempC.height = preset.height;
        const tCtx = tempC.getContext('2d');
        tCtx.drawImage(portraitImg, dx, dy, drawW, drawH);
        const imgData = tCtx.getImageData(0, 0, preset.width, preset.height);
        const d = imgData.data;
        // Sample top-left pixel as backdrop reference
        const refR = d[0];
        const refG = d[1];
        const refB = d[2];
        const refA = d[3];

        if (refA > 10) {
          const threshold = tol * 2.2;
          for (let i = 0; i < d.length; i += 4) {
            const dist = Math.sqrt(
              Math.pow(d[i] - refR, 2) + Math.pow(d[i + 1] - refG, 2) + Math.pow(d[i + 2] - refB, 2)
            );
            if (dist <= threshold) {
              d[i + 3] = 0;
            }
          }
          tCtx.putImageData(imgData, 0, 0);
        }
        ctx.drawImage(tempC, 0, 0);
      } else {
        ctx.drawImage(portraitImg, dx, dy, drawW, drawH);
      }

      if (addBorderCheck && addBorderCheck.checked) {
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, preset.width - 2, preset.height - 2);
      }

      if (includeGuideOverlay && showGuideCheck && showGuideCheck.checked) {
        ctx.save();
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.65)';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(
          preset.width / 2,
          preset.height * 0.44,
          preset.width * 0.29,
          preset.height * 0.31,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.restore();
      }

      singleMeta.textContent =
        preset.name + ' • ' + preset.width + ' × ' + preset.height + ' px (300 DPI)';
    }

    function renderPrintableSheet() {
      // First render clean single photo without dashed guide lines
      renderSinglePhoto(false);

      const sheetMode = sheetTypeSelect.value || '4r';
      // 4R = 6 x 4 inch @ 300 DPI = 1800 x 1200 px
      // A4 = 210 x 297 mm @ 150 DPI preview/print = 1240 x 1754 px
      const is4R = sheetMode === '4r';
      const sheetW = is4R ? 1800 : 2480;
      const sheetH = is4R ? 1200 : 3508;

      sheetCanvas.width = sheetW;
      sheetCanvas.height = sheetH;
      const sCtx = sheetCanvas.getContext('2d');
      sCtx.fillStyle = '#FFFFFF';
      sCtx.fillRect(0, 0, sheetW, sheetH);

      const pw = singleCanvas.width;
      const ph = singleCanvas.height;
      const gap = 36;
      const cols = is4R ? Math.min(4, Math.floor((sheetW - 80) / (pw + gap))) : Math.min(5, Math.floor((sheetW - 120) / (pw + gap)));
      const rows = is4R ? Math.min(2, Math.floor((sheetH - 80) / (ph + gap))) : Math.min(4, Math.floor((sheetH - 160) / (ph + gap)));

      const totalGridW = cols * pw + (cols - 1) * gap;
      const totalGridH = rows * ph + (rows - 1) * gap;
      const startX = Math.round((sheetW - totalGridW) / 2);
      const startY = Math.round((sheetH - totalGridH) / 2);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = startX + c * (pw + gap);
          const y = startY + r * (ph + gap);
          sCtx.drawImage(singleCanvas, x, y);
          sCtx.strokeStyle = '#CBD5E1';
          sCtx.lineWidth = 2;
          sCtx.strokeRect(x, y, pw, ph);
        }
      }

      // Restore guide overlay on single canvas if checked
      if (showGuideCheck && showGuideCheck.checked) {
        renderSinglePhoto(true);
      }
    }

    function updateAll() {
      renderPrintableSheet();
    }

    [presetSelect, zoomRange, panXRange, panYRange, chromaTolerance, showGuideCheck, addBorderCheck, sheetTypeSelect].forEach(
      function (el) {
        if (el) el.addEventListener('input', updateAll);
      }
    );

    if (bgColorInput) {
      bgColorInput.addEventListener('input', function () {
        bgColor = bgColorInput.value;
        updateAll();
      });
    }

    document.querySelectorAll('[data-pass-bg]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        bgColor = btn.getAttribute('data-pass-bg') || '#FFFFFF';
        if (bgColorInput) bgColorInput.value = bgColor;
        updateAll();
      });
    });

    window.ToolNest.setupDropzone(dropzone, fileInput, function (files) {
      const file = files[0];
      if (!file || !file.type.startsWith('image/')) {
        window.ToolNest.showToast('Please select a valid photo file.', 'danger');
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        portraitImg = img;
        zoomRange.value = 100;
        panXRange.value = 0;
        panYRange.value = 0;
        updateAll();
        window.ToolNest.showToast('Portrait photo loaded!', 'success');
      };
      img.src = url;
    });

    if (btnDownloadSingle) {
      btnDownloadSingle.addEventListener('click', function () {
        renderSinglePhoto(false);
        singleCanvas.toBlob(
          function (blob) {
            if (blob) {
              const preset = getActivePreset();
              window.ToolNest.downloadBlob(blob, preset.id + '-photo.jpg');
              window.ToolNest.showToast('Single passport photo downloaded!', 'success');
            }
            if (showGuideCheck && showGuideCheck.checked) renderSinglePhoto(true);
          },
          'image/jpeg',
          0.95
        );
      });
    }

    if (btnDownloadSheet) {
      btnDownloadSheet.addEventListener('click', function () {
        renderPrintableSheet();
        sheetCanvas.toBlob(
          function (blob) {
            if (blob) {
              const sheetMode = sheetTypeSelect.value || '4r';
              window.ToolNest.downloadBlob(blob, 'passport-printable-sheet-' + sheetMode + '.jpg');
              window.ToolNest.showToast('Printable photo sheet downloaded!', 'success');
            }
          },
          'image/jpeg',
          0.95
        );
      });
    }

    if (btnSample) {
      btnSample.addEventListener('click', function () {
        const sample = createSamplePortrait();
        sample.onload = function () {
          portraitImg = sample;
          zoomRange.value = 100;
          panXRange.value = 0;
          panYRange.value = 0;
          bgColor = '#D0E7FF';
          if (bgColorInput) bgColorInput.value = '#D0E7FF';
          updateAll();
          window.ToolNest.showToast('Sample portrait loaded!', 'success');
        };
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', function () {
        zoomRange.value = 100;
        panXRange.value = 0;
        panYRange.value = 0;
        chromaTolerance.value = 0;
        bgColor = '#FFFFFF';
        if (bgColorInput) bgColorInput.value = '#FFFFFF';
        updateAll();
      });
    }

    // Load initial sample portrait
    const initSample = createSamplePortrait();
    initSample.onload = function () {
      portraitImg = initSample;
      bgColor = '#D0E7FF';
      if (bgColorInput) bgColorInput.value = '#D0E7FF';
      updateAll();
    };
  });
})();
