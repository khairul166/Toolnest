/**
 * ToolNest - AI Document Scanner & Auto-Enhancer (/assets/js/tools/document-scanner.js)
 * 100% Client-Side Document Scanner with automatic 4-corner paper detection,
 * 8-DOF projective homography perspective warp, integral-image shadow removal
 * (Magic Color, Adaptive B&W, Clean Grayscale), and PDF/PNG/JPG export.
 */
(function () {
  'use strict';

  /**
   * Solve an 8x8 linear system Ax = b via Gaussian elimination with partial pivoting
   * to find the 3x3 projective homography matrix H mapping destination (u,v) -> source (x,y).
   */
  function computeHomographyMatrix(srcPts, dstPts) {
    const A = [];
    const b = [];
    for (let i = 0; i < 4; i++) {
      const u = dstPts[i].x;
      const v = dstPts[i].y;
      const x = srcPts[i].x;
      const y = srcPts[i].y;

      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
      b.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
      b.push(y);
    }

    const n = 8;
    for (let col = 0; col < n; col++) {
      let maxRow = col;
      let maxVal = Math.abs(A[col][col]);
      for (let r = col + 1; r < n; r++) {
        const absVal = Math.abs(A[r][col]);
        if (absVal > maxVal) {
          maxVal = absVal;
          maxRow = r;
        }
      }
      const tmpRow = A[col];
      A[col] = A[maxRow];
      A[maxRow] = tmpRow;
      const tmpB = b[col];
      b[col] = b[maxRow];
      b[maxRow] = tmpB;

      const pivot = A[col][col] || 1e-12;
      for (let r = col + 1; r < n; r++) {
        const factor = A[r][col] / pivot;
        b[r] -= factor * b[col];
        for (let c = col; c < n; c++) {
          A[r][c] -= factor * A[col][c];
        }
      }
    }

    const h = new Float64Array(9);
    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < n; j++) {
        sum -= A[i][j] * h[j];
      }
      h[i] = sum / (A[i][i] || 1e-12);
    }
    h[8] = 1;
    return h;
  }

  /**
   * Automatically detect the 4 corners of a bright document sheet against a darker desk/background
   */
  function autoDetectDocumentCorners(imgData, w, h) {
    const data = imgData.data;

    // Sample outer border pixels to estimate desk/background brightness
    let borderLumSum = 0;
    let borderCount = 0;
    const stepX = Math.max(1, Math.floor(w / 40));
    const stepY = Math.max(1, Math.floor(h / 40));

    for (let x = 0; x < w; x += stepX) {
      const idxTop = x * 4;
      const idxBot = ((h - 1) * w + x) * 4;
      borderLumSum += 0.299 * data[idxTop] + 0.587 * data[idxTop + 1] + 0.114 * data[idxTop + 2];
      borderLumSum += 0.299 * data[idxBot] + 0.587 * data[idxBot + 1] + 0.114 * data[idxBot + 2];
      borderCount += 2;
    }
    for (let y = 0; y < h; y += stepY) {
      const idxL = (y * w) * 4;
      const idxR = (y * w + (w - 1)) * 4;
      borderLumSum += 0.299 * data[idxL] + 0.587 * data[idxL + 1] + 0.114 * data[idxL + 2];
      borderLumSum += 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2];
      borderCount += 2;
    }
    const borderMean = borderCount > 0 ? borderLumSum / borderCount : 80;

    // Sample center region to estimate paper brightness
    let centerLumSum = 0;
    let centerCount = 0;
    for (let y = Math.floor(h * 0.3); y < Math.floor(h * 0.7); y += stepY) {
      for (let x = Math.floor(w * 0.3); x < Math.floor(w * 0.7); x += stepX) {
        const idx = (y * w + x) * 4;
        centerLumSum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        centerCount++;
      }
    }
    const centerMean = centerCount > 0 ? centerLumSum / centerCount : 200;

    // If background and center have distinct luminance contrast, locate extreme corners of the paper mask
    if (centerMean - borderMean > 28) {
      const thresh = borderMean + (centerMean - borderMean) * 0.42;
      let minSum = Infinity;
      let maxSum = -Infinity;
      let minDiff = Infinity;
      let maxDiff = -Infinity;

      let tl = null;
      let tr = null;
      let br = null;
      let bl = null;
      let fgCount = 0;

      const scanStepX = Math.max(2, Math.floor(w / 160));
      const scanStepY = Math.max(2, Math.floor(h / 160));

      for (let y = scanStepY; y < h - scanStepY; y += scanStepY) {
        for (let x = scanStepX; x < w - scanStepX; x += scanStepX) {
          const i = (y * w + x) * 4;
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (lum >= thresh) {
            fgCount++;
            // Normalize coordinates so aspect ratio doesn't bias diagonal projection
            const nx = x / w;
            const ny = y / h;
            const sum = nx + ny;
            const diff = nx - ny;

            if (sum < minSum) {
              minSum = sum;
              tl = { x: x, y: y };
            }
            if (sum > maxSum) {
              maxSum = sum;
              br = { x: x, y: y };
            }
            if (diff > maxDiff) {
              maxDiff = diff;
              tr = { x: x, y: y };
            }
            if (diff < minDiff) {
              minDiff = diff;
              bl = { x: x, y: y };
            }
          }
        }
      }

      if (fgCount > 40 && tl && tr && br && bl) {
        return [tl, tr, br, bl];
      }
    }

    // Default fallback: slight inset rectangle so handles are easy to grab
    const padX = Math.round(w * 0.05);
    const padY = Math.round(h * 0.05);
    return [
      { x: padX, y: padY },
      { x: w - padX, y: padY },
      { x: w - padX, y: h - padY },
      { x: padX, y: h - padY }
    ];
  }

  /**
   * Perform 4-point projective perspective warp with bilinear interpolation
   */
  function warpPerspective(srcImageData, srcW, srcH, corners, outW, outH) {
    const dstPts = [
      { x: 0, y: 0 },
      { x: outW - 1, y: 0 },
      { x: outW - 1, y: outH - 1 },
      { x: 0, y: outH - 1 }
    ];
    const H = computeHomographyMatrix(corners, dstPts);
    const src = srcImageData.data;
    const dstImageData = new ImageData(outW, outH);
    const dst = dstImageData.data;

    const h0 = H[0], h1 = H[1], h2 = H[2];
    const h3 = H[3], h4 = H[4], h5 = H[5];
    const h6 = H[6], h7 = H[7], h8 = H[8];

    let dstIdx = 0;
    for (let v = 0; v < outH; v++) {
      const v_h1_h2 = h1 * v + h2;
      const v_h4_h5 = h4 * v + h5;
      const v_h7_h8 = h7 * v + h8;

      for (let u = 0; u < outW; u++) {
        const denom = h6 * u + v_h7_h8 || 1e-12;
        const sx = (h0 * u + v_h1_h2) / denom;
        const sy = (h3 * u + v_h4_h5) / denom;

        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);

        if (x0 >= 0 && x0 < srcW - 1 && y0 >= 0 && y0 < srcH - 1) {
          const dx = sx - x0;
          const dy = sy - y0;
          const w00 = (1 - dx) * (1 - dy);
          const w10 = dx * (1 - dy);
          const w01 = (1 - dx) * dy;
          const w11 = dx * dy;

          const i00 = (y0 * srcW + x0) * 4;
          const i10 = i00 + 4;
          const i01 = i00 + srcW * 4;
          const i11 = i01 + 4;

          dst[dstIdx] = src[i00] * w00 + src[i10] * w10 + src[i01] * w01 + src[i11] * w11;
          dst[dstIdx + 1] = src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11;
          dst[dstIdx + 2] = src[i00 + 2] * w00 + src[i10 + 2] * w10 + src[i01 + 2] * w01 + src[i11 + 2] * w11;
          dst[dstIdx + 3] = 255;
        } else {
          const cx = Math.max(0, Math.min(srcW - 1, Math.round(sx)));
          const cy = Math.max(0, Math.min(srcH - 1, Math.round(sy)));
          const ci = (cy * srcW + cx) * 4;
          dst[dstIdx] = src[ci];
          dst[dstIdx + 1] = src[ci + 1];
          dst[dstIdx + 2] = src[ci + 2];
          dst[dstIdx + 3] = 255;
        }
        dstIdx += 4;
      }
    }
    return dstImageData;
  }

  /**
   * Apply integral-image adaptive shadow removal and ink contrast enhancement
   */
  function applyScanEnhancement(imgData, mode, whitenessPct, contrastPct) {
    if (mode === 'original') return;

    const w = imgData.width;
    const h = imgData.height;
    const data = imgData.data;

    // Build luminance buffer + 2D integral image (summed-area table) for O(1) local background estimation
    const stride = w + 1;
    const integral = new Float64Array(stride * (h + 1));
    const lumArr = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      const prevRowOffset = y * stride;
      const currRowOffset = (y + 1) * stride;
      const pxRowOffset = y * w;

      for (let x = 0; x < w; x++) {
        const di = (pxRowOffset + x) * 4;
        const lum = Math.round(0.299 * data[di] + 0.587 * data[di + 1] + 0.114 * data[di + 2]);
        lumArr[pxRowOffset + x] = lum;
        rowSum += lum;
        integral[currRowOffset + x + 1] = integral[prevRowOffset + x + 1] + rowSum;
      }
    }

    const radius = Math.max(14, Math.round(Math.max(w, h) / 18));
    // whitenessPct (10..100): higher means more aggressive background whitening
    const whiteCutoff = 250 - (whitenessPct * 0.34); // ~216..246
    // contrastPct (0..100): higher means darker ink & sharper contrast
    const gamma = 1 + (contrastPct / 100) * 1.35;

    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(h - 1, y + radius);
      const r0 = y0 * stride;
      const r1 = (y1 + 1) * stride;
      const boxH = y1 - y0 + 1;
      const pxRow = y * w;

      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(w - 1, x + radius);
        const area = (x1 - x0 + 1) * boxH;

        const sum =
          integral[r1 + x1 + 1] -
          integral[r0 + x1 + 1] -
          integral[r1 + x0] +
          integral[r0 + x0];

        // Estimate local paper background brightness (boosted slightly since dark text lowers the box average)
        const localBg = Math.max(45, (sum / area) * 1.06);
        const di = (pxRow + x) * 4;
        const lum = lumArr[pxRow + x];

        if (mode === 'bw') {
          // Adaptive local threshold with smooth anti-aliased text edges
          const rel = (lum / localBg) * 255;
          const bwThresh = 238 - (whitenessPct * 0.25) + (contrastPct * 0.15);
          let val;
          if (rel >= bwThresh + 10) {
            val = 255;
          } else if (rel <= bwThresh - 18) {
            val = 0;
          } else {
            val = Math.round(((rel - (bwThresh - 18)) / 28) * 255);
          }
          data[di] = val;
          data[di + 1] = val;
          data[di + 2] = val;
        } else if (mode === 'gray') {
          let norm = (lum / localBg) * 255;
          if (norm >= whiteCutoff) {
            norm = 255;
          } else {
            norm = Math.pow(norm / whiteCutoff, gamma) * 255;
          }
          const gVal = Math.max(0, Math.min(255, Math.round(norm)));
          data[di] = gVal;
          data[di + 1] = gVal;
          data[di + 2] = gVal;
        } else {
          // Magic Color: normalize each RGB channel by local illumination to erase shadows while keeping color ink
          const normLum = (lum / localBg) * 255;
          if (normLum >= whiteCutoff) {
            data[di] = 255;
            data[di + 1] = 255;
            data[di + 2] = 255;
          } else {
            const scale = 255 / localBg;
            let nr = Math.min(255, data[di] * scale);
            let ng = Math.min(255, data[di + 1] * scale);
            let nb = Math.min(255, data[di + 2] * scale);

            // Apply contrast curve to darken ink & boost color saturation
            nr = Math.pow(nr / 255, gamma) * 255;
            ng = Math.pow(ng / 255, gamma) * 255;
            nb = Math.pow(nb / 255, gamma) * 255;

            const meanC = (nr + ng + nb) / 3;
            const satBoost = 1.25;
            data[di] = Math.max(0, Math.min(255, Math.round(meanC + (nr - meanC) * satBoost)));
            data[di + 1] = Math.max(0, Math.min(255, Math.round(meanC + (ng - meanC) * satBoost)));
            data[di + 2] = Math.max(0, Math.min(255, Math.round(meanC + (nb - meanC) * satBoost)));
          }
        }
      }
    }
  }

  /**
   * Generate a realistic angled & shadowed paper document on a dark wooden desk for 1-click testing
   */
  function createSampleShadowedDocumentFile() {
    return new Promise(function (resolve) {
      const w = 900;
      const h = 1120;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');

      // 1. Dark wooden desk background
      ctx.fillStyle = '#33241B';
      ctx.fillRect(0, 0, w, h);

      // 2. Draw an angled trapezoid sheet of paper on the desk
      const tl = { x: 115, y: 95 };
      const tr = { x: 775, y: 70 };
      const br = { x: 830, y: 1025 };
      const bl = { x: 70, y: 1005 };

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.fillStyle = '#F4F1EA';
      ctx.fill();
      ctx.clip();

      // Slight rotation to match the skewed paper
      ctx.translate(115, 95);
      ctx.rotate(-0.032);

      // Header bar (Blue corporate header)
      ctx.fillStyle = '#1D4ED8';
      ctx.fillRect(45, 45, 575, 78);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px Inter, sans-serif';
      ctx.fillText('OFFICIAL CLEARANCE CERTIFICATE', 68, 92);

      // Document body text lines
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText('Reference No: TN-2026-88412', 50, 175);
      ctx.fillText('Applicant Name: Tanvir Hasan', 50, 212);

      ctx.font = '17px Inter, sans-serif';
      ctx.fillStyle = '#334155';
      const lines = [
        'This document certifies that the applicant has completed all required',
        'verifications and financial clearances in accordance with statutory',
        'guidelines. All original attachments have been verified.',
        '',
        '1. Identity & Academic Transcript Verification: PASSED',
        '2. Account & Tax Clearance Status: APPROVED',
        '3. Authorized Issuing Office: Dhaka Central Division'
      ];
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 50, 270 + i * 36);
      }

      // Table box
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      ctx.strokeRect(50, 545, 565, 140);
      ctx.beginPath();
      ctx.moveTo(50, 590);
      ctx.lineTo(615, 590);
      ctx.stroke();
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText('Description', 68, 574);
      ctx.fillText('Status / Amount', 420, 574);
      ctx.font = '16px Inter, sans-serif';
      ctx.fillText('Registration & Verification Fee', 68, 628);
      ctx.fillText('BDT 2,500.00 (PAID)', 420, 628);
      ctx.fillText('Document Security Stamp', 68, 664);
      ctx.fillText('Verified Original', 420, 664);

      // Red "APPROVED" circular/rectangular stamp
      ctx.save();
      ctx.translate(470, 775);
      ctx.rotate(-0.18);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 5;
      ctx.strokeRect(-95, -34, 190, 68);
      ctx.fillStyle = '#DC2626';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('APPROVED', 0, 8);
      ctx.restore();

      // Blue ink signature
      ctx.strokeStyle = '#1E40AF';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(75, 795);
      ctx.bezierCurveTo(110, 745, 145, 815, 185, 760);
      ctx.bezierCurveTo(210, 735, 235, 790, 275, 770);
      ctx.stroke();
      ctx.fillStyle = '#475569';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('Authorized Signature', 75, 825);

      // 3. Cast a realistic dark diagonal phone/hand shadow across the lower-right half of the paper
      const shadowGrad = ctx.createLinearGradient(80, 280, 580, 780);
      shadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
      shadowGrad.addColorStop(0.42, 'rgba(15, 23, 42, 0.04)');
      shadowGrad.addColorStop(0.55, 'rgba(15, 23, 42, 0.34)');
      shadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0.44)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(0, 0, 760, 960);

      ctx.restore();

      c.toBlob(function (blob) {
        resolve(new File([blob], 'shadowed-certificate-photo.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-dscan-dropzone');
    const fileInput = document.getElementById('tn-dscan-file');
    const sampleBtn = document.getElementById('tn-dscan-sample-btn');
    const status = document.getElementById('tn-dscan-status');
    const workspace = document.getElementById('tn-dscan-workspace');

    const modeButtons = document.querySelectorAll('.tn-dscan-mode-btn');
    const whitenessSlider = document.getElementById('tn-dscan-whiteness');
    const whitenessVal = document.getElementById('tn-dscan-whiteness-val');
    const contrastSlider = document.getElementById('tn-dscan-contrast');
    const contrastVal = document.getElementById('tn-dscan-contrast-val');
    const aspectSelect = document.getElementById('tn-dscan-aspect');

    const autoDetectBtn = document.getElementById('tn-dscan-autodetect-btn');
    const fullCropBtn = document.getElementById('tn-dscan-fullcrop-btn');
    const sourceCanvas = document.getElementById('tn-dscan-source-canvas');
    const resultCanvas = document.getElementById('tn-dscan-result-canvas');
    const outDimsBadge = document.getElementById('tn-dscan-out-dims');
    const rotCcwBtn = document.getElementById('tn-dscan-rot-ccw');
    const rotCwBtn = document.getElementById('tn-dscan-rot-cw');

    const filenameInput = document.getElementById('tn-dscan-filename');
    const downloadPdfBtn = document.getElementById('tn-dscan-download-pdf');
    const downloadPngBtn = document.getElementById('tn-dscan-download-png');
    const downloadJpgBtn = document.getElementById('tn-dscan-download-jpg');
    const clearBtn = document.getElementById('tn-dscan-clear-btn');

    if (!dropzone || !fileInput || !sourceCanvas || !resultCanvas) return;

    let srcImage = null;
    let srcWidth = 0;
    let srcHeight = 0;
    let srcImageData = null;
    // 4 corners in source image coordinates: [TL, TR, BR, BL]
    let corners = [];
    let draggingCornerIdx = -1;
    let currentMode = 'magic';
    let extraRotation = 0; // 0, 90, 180, 270

    function setStatus(msg, isError) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'small mb-3' + (isError ? ' text-danger' : ' text-muted');
    }

    function drawSourceOverlay() {
      if (!srcImage || corners.length !== 4) return;
      sourceCanvas.width = srcWidth;
      sourceCanvas.height = srcHeight;
      const ctx = sourceCanvas.getContext('2d');
      ctx.drawImage(srcImage, 0, 0, srcWidth, srcHeight);

      // Dim outside polygon
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.beginPath();
      ctx.rect(0, 0, srcWidth, srcHeight);
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.restore();

      // Polygon outline
      const scaleFactor = Math.max(1, Math.max(srcWidth, srcHeight) / 500);
      ctx.save();
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 3 * scaleFactor;
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.stroke();

      // 4 Corner Handles
      const handleRadius = 11 * scaleFactor;
      for (let i = 0; i < 4; i++) {
        const pt = corners[i];
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#2563EB';
        ctx.fill();
        ctx.lineWidth = 2.5 * scaleFactor;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5 * scaleFactor, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
      ctx.restore();
    }

    function dist(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function renderWarpedAndEnhancedResult() {
      if (!srcImageData || corners.length !== 4) return;

      const topW = dist(corners[0], corners[1]);
      const botW = dist(corners[3], corners[2]);
      const leftH = dist(corners[0], corners[3]);
      const rightH = dist(corners[1], corners[2]);

      let targetW = Math.max(120, Math.round(Math.max(topW, botW)));
      let targetH = Math.max(120, Math.round(Math.max(leftH, rightH)));

      const aspectMode = aspectSelect ? aspectSelect.value : 'auto';
      if (aspectMode === 'a4') {
        targetH = Math.round(targetW * 1.4142);
      } else if (aspectMode === 'letter') {
        targetH = Math.round(targetW * 1.2941);
      } else if (aspectMode === 'id') {
        targetH = Math.round(targetW / 1.585);
      }

      // Cap processing dimensions to keep real-time slider updates fast
      const maxDim = 1350;
      if (Math.max(targetW, targetH) > maxDim) {
        const s = maxDim / Math.max(targetW, targetH);
        targetW = Math.round(targetW * s);
        targetH = Math.round(targetH * s);
      }

      const warpedData = warpPerspective(srcImageData, srcWidth, srcHeight, corners, targetW, targetH);
      const whiteness = whitenessSlider ? parseInt(whitenessSlider.value, 10) || 75 : 75;
      const contrast = contrastSlider ? parseInt(contrastSlider.value, 10) || 60 : 60;

      applyScanEnhancement(warpedData, currentMode, whiteness, contrast);

      // Apply optional 90-degree rotations
      if (extraRotation === 0) {
        resultCanvas.width = targetW;
        resultCanvas.height = targetH;
        resultCanvas.getContext('2d').putImageData(warpedData, 0, 0);
      } else {
        const tempC = document.createElement('canvas');
        tempC.width = targetW;
        tempC.height = targetH;
        tempC.getContext('2d').putImageData(warpedData, 0, 0);

        const swap = extraRotation === 90 || extraRotation === 270;
        resultCanvas.width = swap ? targetH : targetW;
        resultCanvas.height = swap ? targetW : targetH;
        const rCtx = resultCanvas.getContext('2d');
        rCtx.save();
        rCtx.translate(resultCanvas.width / 2, resultCanvas.height / 2);
        rCtx.rotate((extraRotation * Math.PI) / 180);
        rCtx.drawImage(tempC, -targetW / 2, -targetH / 2);
        rCtx.restore();
      }

      if (outDimsBadge) {
        outDimsBadge.textContent = resultCanvas.width + ' × ' + resultCanvas.height + ' px';
      }
    }

    function loadDocumentFile(file) {
      if (!file) return;
      const name = (file.name || '').toLowerCase();
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(name)) {
        setStatus('Please choose a JPEG, PNG, or WebP document photo.', true);
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        // Scale working source buffer up to 1200px max side for fast interactive warping
        const maxWorkDim = 1200;
        const scale = Math.min(1, maxWorkDim / Math.max(origW, origH));
        srcWidth = Math.max(60, Math.round(origW * scale));
        srcHeight = Math.max(60, Math.round(origH * scale));

        const off = document.createElement('canvas');
        off.width = srcWidth;
        off.height = srcHeight;
        const offCtx = off.getContext('2d');
        offCtx.drawImage(img, 0, 0, srcWidth, srcHeight);

        srcImage = off;
        srcImageData = offCtx.getImageData(0, 0, srcWidth, srcHeight);
        extraRotation = 0;

        corners = autoDetectDocumentCorners(srcImageData, srcWidth, srcHeight);
        if (filenameInput) {
          const base = file.name.replace(/\.[^.]+$/, '') || 'scanned-document';
          filenameInput.value = base + '-scan';
        }

        workspace.classList.remove('d-none');
        drawSourceOverlay();
        renderWarpedAndEnhancedResult();
        setStatus('Document corners detected and shadows removed! Drag any blue corner handle to fine-tune.');
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        setStatus('Could not decode this image. Please try another photo.', true);
      };
      img.src = url;
    }

    // Pointer / Touch Dragging for the 4 Corner Handles
    function getCanvasCoords(evt) {
      const rect = sourceCanvas.getBoundingClientRect();
      const clientX = evt.touches && evt.touches[0] ? evt.touches[0].clientX : evt.clientX;
      const clientY = evt.touches && evt.touches[0] ? evt.touches[0].clientY : evt.clientY;
      const scaleX = srcWidth / (rect.width || 1);
      const scaleY = srcHeight / (rect.height || 1);
      return {
        x: Math.max(0, Math.min(srcWidth - 1, (clientX - rect.left) * scaleX)),
        y: Math.max(0, Math.min(srcHeight - 1, (clientY - rect.top) * scaleY))
      };
    }

    function onPointerDown(evt) {
      if (!srcImage || corners.length !== 4) return;
      const pt = getCanvasCoords(evt);
      const hitRadius = Math.max(28, Math.max(srcWidth, srcHeight) * 0.055);
      let bestIdx = -1;
      let bestDist = hitRadius;
      for (let i = 0; i < 4; i++) {
        const d = dist(pt, corners[i]);
        if (d <= bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx !== -1) {
        evt.preventDefault();
        draggingCornerIdx = bestIdx;
      }
    }

    function onPointerMove(evt) {
      if (draggingCornerIdx === -1) return;
      evt.preventDefault();
      const pt = getCanvasCoords(evt);
      corners[draggingCornerIdx] = pt;
      drawSourceOverlay();
    }

    function onPointerUp() {
      if (draggingCornerIdx !== -1) {
        draggingCornerIdx = -1;
        renderWarpedAndEnhancedResult();
      }
    }

    sourceCanvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    sourceCanvas.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);

    // Filter Mode Buttons
    modeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        modeButtons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentMode = btn.getAttribute('data-mode') || 'magic';
        renderWarpedAndEnhancedResult();
      });
    });

    if (whitenessSlider) {
      whitenessSlider.addEventListener('input', function () {
        if (whitenessVal) whitenessVal.textContent = whitenessSlider.value + '%';
        renderWarpedAndEnhancedResult();
      });
    }

    if (contrastSlider) {
      contrastSlider.addEventListener('input', function () {
        if (contrastVal) contrastVal.textContent = contrastSlider.value + '%';
        renderWarpedAndEnhancedResult();
      });
    }

    if (aspectSelect) {
      aspectSelect.addEventListener('change', renderWarpedAndEnhancedResult);
    }

    if (autoDetectBtn) {
      autoDetectBtn.addEventListener('click', function () {
        if (!srcImageData) return;
        corners = autoDetectDocumentCorners(srcImageData, srcWidth, srcHeight);
        drawSourceOverlay();
        renderWarpedAndEnhancedResult();
      });
    }

    if (fullCropBtn) {
      fullCropBtn.addEventListener('click', function () {
        if (!srcImageData) return;
        corners = [
          { x: 0, y: 0 },
          { x: srcWidth - 1, y: 0 },
          { x: srcWidth - 1, y: srcHeight - 1 },
          { x: 0, y: srcHeight - 1 }
        ];
        drawSourceOverlay();
        renderWarpedAndEnhancedResult();
      });
    }

    if (rotCcwBtn) {
      rotCcwBtn.addEventListener('click', function () {
        extraRotation = ((extraRotation - 90) % 360 + 360) % 360;
        renderWarpedAndEnhancedResult();
      });
    }

    if (rotCwBtn) {
      rotCwBtn.addEventListener('click', function () {
        extraRotation = (extraRotation + 90) % 360;
        renderWarpedAndEnhancedResult();
      });
    }

    function getCleanBaseFilename() {
      const raw = (filenameInput && filenameInput.value.trim()) || 'scanned-document';
      return raw.replace(/\.(pdf|png|jpe?g)$/i, '');
    }

    if (downloadPngBtn) {
      downloadPngBtn.addEventListener('click', function () {
        resultCanvas.toBlob(function (blob) {
          if (blob && window.ToolNest && window.ToolNest.downloadBlob) {
            window.ToolNest.downloadBlob(blob, getCleanBaseFilename() + '.png');
          }
        }, 'image/png');
      });
    }

    if (downloadJpgBtn) {
      downloadJpgBtn.addEventListener('click', function () {
        resultCanvas.toBlob(function (blob) {
          if (blob && window.ToolNest && window.ToolNest.downloadBlob) {
            window.ToolNest.downloadBlob(blob, getCleanBaseFilename() + '.jpg');
          }
        }, 'image/jpeg', 0.92);
      });
    }

    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', async function () {
        if (!window.PDFLib) {
          if (window.ToolNest && window.ToolNest.showToast) {
            window.ToolNest.showToast('PDF library is loading. Please try again in a moment.', 'warning');
          }
          return;
        }
        try {
          const jpgBlob = await new Promise(function (resolve) {
            resultCanvas.toBlob(resolve, 'image/jpeg', 0.92);
          });
          const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer());
          const pdfDoc = await window.PDFLib.PDFDocument.create();
          const embedded = await pdfDoc.embedJpg(jpgBytes);

          const isLandscape = embedded.width > embedded.height;
          const a4W = isLandscape ? 841.89 : 595.28;
          const a4H = isLandscape ? 595.28 : 841.89;
          const margin = 18;
          const scale = Math.min((a4W - margin * 2) / embedded.width, (a4H - margin * 2) / embedded.height);
          const drawW = embedded.width * scale;
          const drawH = embedded.height * scale;

          const page = pdfDoc.addPage([a4W, a4H]);
          page.drawImage(embedded, {
            x: (a4W - drawW) / 2,
            y: (a4H - drawH) / 2,
            width: drawW,
            height: drawH
          });

          const pdfBytes = await pdfDoc.save();
          const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
          if (window.ToolNest && window.ToolNest.downloadBlob) {
            window.ToolNest.downloadBlob(pdfBlob, getCleanBaseFilename() + '.pdf');
          }
          if (window.ToolNest && window.ToolNest.showToast) {
            window.ToolNest.showToast('Scanned PDF downloaded!', 'success');
          }
        } catch (err) {
          if (window.ToolNest && window.ToolNest.showToast) {
            window.ToolNest.showToast(err.message || 'Could not create PDF.', 'danger');
          }
        }
      });
    }

    if (sampleBtn) {
      sampleBtn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const sampleFile = await createSampleShadowedDocumentFile();
        loadDocumentFile(sampleFile);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        srcImage = null;
        srcImageData = null;
        corners = [];
        fileInput.value = '';
        workspace.classList.add('d-none');
        setStatus('Upload a document photo or click "Load Sample Shadowed Document" to start scanning.');
      });
    }

    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length > 0) {
        loadDocumentFile(fileInput.files[0]);
      }
      fileInput.value = '';
    });

    dropzone.addEventListener('click', function (e) {
      if (!e.target.closest('label') && !e.target.closest('button')) {
        fileInput.click();
      }
    });
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    ['dragenter', 'dragover'].forEach(function (evtName) {
      dropzone.addEventListener(evtName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (evtName) {
      dropzone.addEventListener(evtName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', function (e) {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) loadDocumentFile(files[0]);
    });
  });
})();
