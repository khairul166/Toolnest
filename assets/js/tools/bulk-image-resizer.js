/**
 * ToolNest - RedKetchup-Style Bulk Image Resizer (/assets/js/tools/bulk-image-resizer.js)
 * 100% Client-Side Batch Image Resizer with 6 Resize Modes (Exact Dimensions,
 * Target File Size KB/MB, Percentage, Longest Side, Fixed Width, Fixed Height),
 * 9-Point Crop Anchor, Rotation/Flip, Custom Naming Patterns, and One-Click ZIP Export.
 */
(function () {
  'use strict';

  /**
   * Editable Social & Standard Size Presets
   */
  const BULK_PRESETS = [
    { id: 'custom', name: 'Custom Dimensions', width: 1200, height: 630 },
    { id: 'fb-post', name: 'Facebook Shared Post (1200 × 630)', width: 1200, height: 630 },
    { id: 'fb-square', name: 'Facebook / IG Square (1080 × 1080)', width: 1080, height: 1080 },
    { id: 'fb-cover', name: 'Facebook Page Cover (820 × 312)', width: 820, height: 312 },
    { id: 'fb-story', name: 'Facebook / IG Story (1080 × 1920)', width: 1080, height: 1920 },
    { id: 'fb-ad', name: 'Facebook Link Ad (1200 × 628)', width: 1200, height: 628 },
    { id: 'yt-thumb', name: 'YouTube HD Thumbnail (1280 × 720)', width: 1280, height: 720 },
    { id: 'hd-1080', name: 'Full HD 1080p (1920 × 1080)', width: 1920, height: 1080 },
    { id: 'bd-photo', name: 'BD Job Portal Photo (300 × 300)', width: 300, height: 300 },
    { id: 'bd-sign', name: 'BD Job Portal Signature (300 × 80)', width: 300, height: 80 }
  ];

  // Queue of loaded source items: { id, file, name, origW, origH, origSize, img }
  let sourceQueue = [];
  // Processed output items: { id, outputName, origName, origW, origH, outW, outH, origSize, outSize, blob, previewUrl }
  let processedBatch = [];
  let nextId = 1;

  function loadImageFile(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve({
          id: nextId++,
          file: file,
          name: file.name,
          origW: img.naturalWidth || img.width,
          origH: img.naturalHeight || img.height,
          origSize: file.size,
          img: img
        });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image: ' + file.name));
      };
      img.src = url;
    });
  }

  function generateSampleBatchFiles() {
    const specs = [
      { name: 'product-sneaker-shot.jpg', w: 1600, h: 1200, c1: '#1E40AF', c2: '#2563EB', label: 'Product Photo #1' },
      { name: 'summer-collection-banner.jpg', w: 1920, h: 1080, c1: '#0F172A', c2: '#F59E0B', label: 'Collection Banner #2' },
      { name: 'portrait-lookbook.jpg', w: 1080, h: 1440, c1: '#065F46', c2: '#10B981', label: 'Portrait Lookbook #3' },
      { name: 'storefront-promo.jpg', w: 1400, h: 900, c1: '#7C2D12', c2: '#EA580C', label: 'Storefront Promo #4' }
    ];

    return Promise.all(
      specs.map(function (sp) {
        return new Promise(function (resolve) {
          const c = document.createElement('canvas');
          c.width = sp.w;
          c.height = sp.h;
          const ctx = c.getContext('2d');

          const grad = ctx.createLinearGradient(0, 0, sp.w, sp.h);
          grad.addColorStop(0, sp.c1);
          grad.addColorStop(1, sp.c2);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, sp.w, sp.h);

          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 8;
          ctx.strokeRect(40, 40, sp.w - 80, sp.h - 80);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 52px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(sp.label, sp.w / 2, sp.h / 2 - 20);
          ctx.font = '32px Inter, sans-serif';
          ctx.fillText('Original: ' + sp.w + ' × ' + sp.h + ' px', sp.w / 2, sp.h / 2 + 40);

          c.toBlob(
            function (blob) {
              resolve(new File([blob], sp.name, { type: 'image/jpeg' }));
            },
            'image/jpeg',
            0.94
          );
        });
      })
    );
  }

  function cleanupProcessedPreviews() {
    processedBatch.forEach(function (item) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    processedBatch = [];
  }

  /**
   * Calculate anchor offsets (0.0, 0.5, or 1.0) from 9-point anchor string
   */
  function getAnchorFactors(anchor) {
    let ax = 0.5;
    let ay = 0.5;
    if (anchor.includes('left')) ax = 0.0;
    else if (anchor.includes('right')) ax = 1.0;
    if (anchor.includes('top')) ay = 0.0;
    else if (anchor.includes('bottom')) ay = 1.0;
    return { ax: ax, ay: ay };
  }

  /**
   * Render stageCanvas to a target (w, h) and encode as a Blob
   */
  function renderScaledBlob(stageCanvas, w, h, mime, quality, bgColor) {
    const outW = Math.max(16, Math.round(w));
    const outH = Math.max(16, Math.round(h));
    const c = document.createElement('canvas');
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext('2d');
    if (mime === 'image/jpeg') {
      ctx.fillStyle = bgColor || '#FFFFFF';
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.drawImage(stageCanvas, 0, 0, outW, outH);

    return new Promise(function (resolve) {
      c.toBlob(
        function (blob) {
          resolve({
            blob: blob,
            width: outW,
            height: outH,
            quality: quality
          });
        },
        mime,
        quality
      );
    });
  }

  /**
   * Pad an encoded image Blob with standard-compliant JPEG COM segments (before EOI)
   * or safe ancillary bytes so the resulting file approaches targetBytes without EVER exceeding it.
   */
  function padImageBlobToTargetBytes(blob, safeTargetBytes, mime) {
    const desiredBytes = Math.floor(safeTargetBytes * 0.992);
    if (!blob || blob.size >= desiredBytes) {
      return Promise.resolve(blob);
    }

    return blob.arrayBuffer().then(function (buffer) {
      const origBytes = new Uint8Array(buffer);
      let deficit = desiredBytes - origBytes.length;
      if (deficit <= 8) return blob;

      // Standard-compliant JPEG COM (0xFF 0xFE) segment insertion before EOI (0xFF 0xD9)
      if (
        mime === 'image/jpeg' &&
        origBytes.length > 4 &&
        origBytes[origBytes.length - 2] === 0xff &&
        origBytes[origBytes.length - 1] === 0xd9
      ) {
        const chunks = [origBytes.subarray(0, origBytes.length - 2)];
        while (deficit > 4) {
          const payloadLen = Math.min(65500, deficit - 4);
          const segLen = payloadLen + 2; // includes 2-byte big-endian length
          const seg = new Uint8Array(payloadLen + 4);
          seg[0] = 0xff;
          seg[1] = 0xfe; // JPEG COM marker
          seg[2] = (segLen >> 8) & 0xff;
          seg[3] = segLen & 0xff;
          chunks.push(seg);
          deficit -= payloadLen + 4;
        }
        chunks.push(new Uint8Array([0xff, 0xd9])); // Restore EOI marker
        return new Blob(chunks, { type: mime });
      }

      // Fallback safe ancillary byte padding for PNG / WebP
      const padBlock = new Uint8Array(deficit);
      return new Blob([origBytes, padBlock], { type: mime });
    });
  }

  /**
   * Binary-search quality & dimensions to hit an approximate target file size (KB or MB)
   * while STRICTLY never exceeding the user's target file size.
   */
  async function resizeToTargetFileSize(stageCanvas, srcW, srcH, mime, config) {
    const hardLimitBytes = Math.max(2048, config.targetBytes);
    // Keep a small safety buffer (99.4% of hardLimitBytes) so the file size NEVER exceeds the target
    const safeTargetBytes = Math.max(1024, Math.floor(hardLimitBytes * 0.994));
    const isLossy = mime === 'image/jpeg' || mime === 'image/webp';
    const strategy = config.fileSizeStrategy || 'auto';
    const baseQ = strategy === 'dimensions-only' ? config.quality : 0.88;

    let best = await renderScaledBlob(stageCanvas, srcW, srcH, mime, baseQ, config.bgColor);
    if (!best.blob) return best;

    /**
     * Strictly prefer candidates that are <= safeTargetBytes (never exceeding hardLimitBytes).
     * Among candidates <= safeTargetBytes, pick the one closest to safeTargetBytes.
     * If no candidate is <= safeTargetBytes yet, pick the smallest candidate so far.
     */
    const pickBestUnderTarget = function (candidate) {
      if (!candidate || !candidate.blob) return;
      const bestUnder = best.blob.size <= safeTargetBytes;
      const candUnder = candidate.blob.size <= safeTargetBytes;

      if (candUnder && !bestUnder) {
        best = candidate;
      } else if (candUnder && bestUnder) {
        if (candidate.blob.size > best.blob.size) {
          best = candidate;
        }
      } else if (!candUnder && !bestUnder) {
        if (candidate.blob.size < best.blob.size) {
          best = candidate;
        }
      }
    };

    if (best.blob.size > safeTargetBytes) {
      // Case 1: Image needs to be reduced so it is strictly <= safeTargetBytes
      let handledByQualityAlone = false;
      if (isLossy && strategy !== 'dimensions-only') {
        const minQ = strategy === 'quality-first' ? 0.12 : 0.35;
        const lowQTest = await renderScaledBlob(stageCanvas, srcW, srcH, mime, minQ, config.bgColor);
        pickBestUnderTarget(lowQTest);

        if (lowQTest.blob && lowQTest.blob.size <= safeTargetBytes) {
          handledByQualityAlone = true;
          // Binary search quality alone at original dimensions
          let lo = minQ;
          let hi = baseQ;
          for (let step = 0; step < 6; step++) {
            const mid = (lo + hi) / 2;
            const cand = await renderScaledBlob(stageCanvas, srcW, srcH, mime, mid, config.bgColor);
            pickBestUnderTarget(cand);
            if (!cand.blob) break;
            if (cand.blob.size > safeTargetBytes) hi = mid;
            else lo = mid;
          }
        }
      }

      if (!handledByQualityAlone) {
        // Binary search dimension scale factor in [0.04, 1.0]
        const searchQ = isLossy && strategy !== 'dimensions-only' ? (strategy === 'quality-first' ? 0.55 : 0.82) : config.quality;
        let sLo = 0.04;
        let sHi = 1.0;
        for (let step = 0; step < 7; step++) {
          const sMid = (sLo + sHi) / 2;
          const cand = await renderScaledBlob(stageCanvas, srcW * sMid, srcH * sMid, mime, searchQ, config.bgColor);
          pickBestUnderTarget(cand);
          if (!cand.blob) break;
          if (cand.blob.size > safeTargetBytes) sHi = sMid;
          else sLo = sMid;
        }

        // Fine-tune quality at the discovered dimensions if lossy
        if (isLossy && strategy !== 'dimensions-only') {
          const finalW = best.width;
          const finalH = best.height;
          let qLo = 0.12;
          let qHi = 0.96;
          for (let step = 0; step < 5; step++) {
            const qMid = (qLo + qHi) / 2;
            const cand = await renderScaledBlob(stageCanvas, finalW, finalH, mime, qMid, config.bgColor);
            pickBestUnderTarget(cand);
            if (!cand.blob) break;
            if (cand.blob.size > safeTargetBytes) qHi = qMid;
            else qLo = qMid;
          }
        }
      }
    } else {
      // Case 2: Target file size is LARGER than baseline (e.g., user wants ~1.5 MB or ~5 MB)
      let handledByHighQuality = false;
      if (isLossy && strategy !== 'dimensions-only') {
        const maxQTest = await renderScaledBlob(stageCanvas, srcW, srcH, mime, 0.99, config.bgColor);
        pickBestUnderTarget(maxQTest);
        if (maxQTest.blob && maxQTest.blob.size >= safeTargetBytes) {
          handledByHighQuality = true;
          let lo = baseQ;
          let hi = 0.99;
          for (let step = 0; step < 6; step++) {
            const mid = (lo + hi) / 2;
            const cand = await renderScaledBlob(stageCanvas, srcW, srcH, mime, mid, config.bgColor);
            pickBestUnderTarget(cand);
            if (!cand.blob) break;
            if (cand.blob.size > safeTargetBytes) hi = mid;
            else lo = mid;
          }
        }
      }

      // Upscale dimensions if allowed by "Do not enlarge" setting, never exceeding safeTargetBytes
      if (!handledByHighQuality && !config.noEnlarge) {
        const maxLongest = 4200;
        const maxScale = Math.max(1.0, Math.min(4.0, maxLongest / Math.max(srcW, srcH)));
        const highQ = isLossy && strategy !== 'dimensions-only' ? 0.95 : config.quality;
        if (maxScale > 1.05) {
          let sLo = 1.0;
          let sHi = maxScale;
          for (let step = 0; step < 7; step++) {
            const sMid = (sLo + sHi) / 2;
            const cand = await renderScaledBlob(stageCanvas, srcW * sMid, srcH * sMid, mime, highQ, config.bgColor);
            pickBestUnderTarget(cand);
            if (!cand.blob) break;
            if (cand.blob.size > safeTargetBytes) sHi = sMid;
            else sLo = sMid;
          }
        }
      }
    }

    // Final strict safety guard: if best.blob is STILL above safeTargetBytes, step down until strictly under
    let guardSteps = 0;
    while (best.blob && best.blob.size > safeTargetBytes && guardSteps < 8) {
      guardSteps++;
      const ratio = Math.sqrt(safeTargetBytes / best.blob.size) * 0.92;
      const nextW = Math.max(16, Math.floor(best.width * ratio));
      const nextH = Math.max(16, Math.floor(best.height * ratio));
      const nextQ = isLossy ? Math.max(0.1, (best.quality || 0.75) * 0.88) : config.quality;
      const fallback = await renderScaledBlob(stageCanvas, nextW, nextH, mime, nextQ, config.bgColor);
      if (fallback && fallback.blob) {
        best = fallback;
      } else {
        break;
      }
    }

    // If under 96% of safeTargetBytes, apply precision byte-padding up to ~99.2% of safeTargetBytes (strictly under hardLimitBytes)
    if (config.allowSizePadding && best.blob && best.blob.size < safeTargetBytes * 0.96) {
      const paddedBlob = await padImageBlobToTargetBytes(best.blob, safeTargetBytes, mime);
      if (paddedBlob && paddedBlob.size <= safeTargetBytes) {
        best.blob = paddedBlob;
      }
    }

    return best;
  }

  function buildOutputFilename(origName, targetW, targetH, index, mime, config) {
    const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
    const baseName = origName.replace(/\.[^/.]+$/, '');
    let outName = (config.prefix || '') + baseName + (config.suffix || '');
    outName = outName
      .replace(/\{width\}/gi, String(targetW))
      .replace(/\{height\}/gi, String(targetH))
      .replace(/\{index\}/gi, String(index + 1).padStart(2, '0'));
    return outName + ext;
  }

  function resizeSingleItem(item, index, config) {
    const img = item.img;
    const rot = config.rotation;
    const swapDims = rot === 90 || rot === 270;
    const srcW = swapDims ? item.origH : item.origW;
    const srcH = swapDims ? item.origW : item.origH;

    // 1. Pre-render rotated/flipped source onto an offscreen canvas
    const stageCanvas = document.createElement('canvas');
    stageCanvas.width = srcW;
    stageCanvas.height = srcH;
    const sCtx = stageCanvas.getContext('2d');
    sCtx.save();
    sCtx.translate(srcW / 2, srcH / 2);
    if (rot !== 0) {
      sCtx.rotate((rot * Math.PI) / 180);
    }
    sCtx.scale(config.flipH ? -1 : 1, config.flipV ? -1 : 1);
    sCtx.drawImage(img, -item.origW / 2, -item.origH / 2, item.origW, item.origH);
    sCtx.restore();

    let mime = config.format;
    if (mime === 'original') {
      mime = item.file.type === 'image/png' || item.file.type === 'image/webp' ? item.file.type : 'image/jpeg';
    }

    // Special Mode: Target File Size (KB / MB)
    if (config.mode === 'filesize') {
      return resizeToTargetFileSize(stageCanvas, srcW, srcH, mime, config).then(function (res) {
        const safeBlob = (res && res.blob) || item.file;
        const outW = (res && res.width) || srcW;
        const outH = (res && res.height) || srcH;
        const outName = buildOutputFilename(item.name, outW, outH, index, mime, config);
        const previewUrl = URL.createObjectURL(safeBlob);
        return {
          id: item.id,
          origName: item.name,
          outputName: outName,
          origW: item.origW,
          origH: item.origH,
          outW: outW,
          outH: outH,
          origSize: item.origSize,
          outSize: safeBlob.size,
          blob: safeBlob,
          previewUrl: previewUrl
        };
      });
    }

    // 2. Determine target output dimensions based on selected Resize Mode
    let targetW = srcW;
    let targetH = srcH;

    if (config.mode === 'dimensions') {
      targetW = config.width;
      targetH = config.height;
      if (config.noEnlarge && targetW > srcW && targetH > srcH) {
        targetW = srcW;
        targetH = srcH;
      }
    } else if (config.mode === 'percentage') {
      const factor = config.scalePct / 100;
      targetW = Math.max(1, Math.round(srcW * factor));
      targetH = Math.max(1, Math.round(srcH * factor));
    } else if (config.mode === 'longest') {
      const maxSide = config.longestSide;
      if (config.noEnlarge && Math.max(srcW, srcH) <= maxSide) {
        targetW = srcW;
        targetH = srcH;
      } else if (srcW >= srcH) {
        targetW = maxSide;
        targetH = Math.max(1, Math.round((srcH / srcW) * maxSide));
      } else {
        targetH = maxSide;
        targetW = Math.max(1, Math.round((srcW / srcH) * maxSide));
      }
    } else if (config.mode === 'width') {
      targetW = config.noEnlarge && config.width > srcW ? srcW : config.width;
      targetH = Math.max(1, Math.round((srcH / srcW) * targetW));
    } else if (config.mode === 'height') {
      targetH = config.noEnlarge && config.height > srcH ? srcH : config.height;
      targetW = Math.max(1, Math.round((srcW / srcH) * targetH));
    }

    // 3. Draw onto final output canvas according to fitMode & anchor
    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetW;
    outCanvas.height = targetH;
    const ctx = outCanvas.getContext('2d');

    if (mime === 'image/jpeg' || config.fitMode === 'contain') {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, targetW, targetH);
    }

    const anchor = getAnchorFactors(config.anchor);

    if (config.mode !== 'dimensions' || config.fitMode === 'stretch') {
      ctx.drawImage(stageCanvas, 0, 0, targetW, targetH);
    } else if (config.fitMode === 'contain') {
      const scale = Math.min(targetW / srcW, targetH / srcH);
      const drawW = Math.round(srcW * scale);
      const drawH = Math.round(srcH * scale);
      const dx = Math.round((targetW - drawW) * anchor.ax);
      const dy = Math.round((targetH - drawH) * anchor.ay);
      ctx.drawImage(stageCanvas, dx, dy, drawW, drawH);
    } else {
      // Crop to Fill (Cover) with 9-point anchor
      const scale = Math.max(targetW / srcW, targetH / srcH);
      const cropW = Math.round(targetW / scale);
      const cropH = Math.round(targetH / scale);
      const sx = Math.round((srcW - cropW) * anchor.ax);
      const sy = Math.round((srcH - cropH) * anchor.ay);
      ctx.drawImage(stageCanvas, sx, sy, cropW, cropH, 0, 0, targetW, targetH);
    }

    const outName = buildOutputFilename(item.name, targetW, targetH, index, mime, config);

    return new Promise(function (resolve) {
      outCanvas.toBlob(
        function (blob) {
          const safeBlob = blob || item.file;
          const previewUrl = URL.createObjectURL(safeBlob);
          resolve({
            id: item.id,
            origName: item.name,
            outputName: outName,
            origW: item.origW,
            origH: item.origH,
            outW: targetW,
            outH: targetH,
            origSize: item.origSize,
            outSize: safeBlob.size,
            blob: safeBlob,
            previewUrl: previewUrl
          });
        },
        mime,
        config.quality
      );
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-bulk-dropzone');
    const fileInput = document.getElementById('tn-bulk-file-input');
    const queuePanel = document.getElementById('tn-bulk-queue-panel');
    const queueList = document.getElementById('tn-bulk-queue-list');
    const queueCountBadge = document.getElementById('tn-bulk-queue-count');

    const modeSelect = document.getElementById('tn-bulk-mode');
    const presetSelect = document.getElementById('tn-bulk-preset');
    const widthInput = document.getElementById('tn-bulk-width');
    const heightInput = document.getElementById('tn-bulk-height');
    const pctInput = document.getElementById('tn-bulk-pct');
    const longestInput = document.getElementById('tn-bulk-longest');
    const targetSizeInput = document.getElementById('tn-bulk-target-size');
    const targetUnitSelect = document.getElementById('tn-bulk-target-unit');
    const fileSizeStrategySelect = document.getElementById('tn-bulk-filesize-strategy');
    const fileSizePadCheck = document.getElementById('tn-bulk-filesize-pad');
    const fitSelect = document.getElementById('tn-bulk-fit');
    const anchorSelect = document.getElementById('tn-bulk-anchor');
    const bgColorInput = document.getElementById('tn-bulk-bg');
    const noEnlargeCheck = document.getElementById('tn-bulk-no-enlarge');

    const rotateSelect = document.getElementById('tn-bulk-rotate');
    const flipHCheck = document.getElementById('tn-bulk-fliph');
    const flipVCheck = document.getElementById('tn-bulk-flipv');

    const formatSelect = document.getElementById('tn-bulk-format');
    const qualitySlider = document.getElementById('tn-bulk-quality');
    const qualityLabel = document.getElementById('tn-bulk-quality-val');
    const prefixInput = document.getElementById('tn-bulk-prefix');
    const suffixInput = document.getElementById('tn-bulk-suffix');

    const btnProcess = document.getElementById('tn-bulk-run-btn');
    const btnSample = document.getElementById('tn-bulk-sample-btn');
    const btnClear = document.getElementById('tn-bulk-clear-btn');
    const btnDownloadZip = document.getElementById('tn-bulk-dl-zip');
    const btnDownloadEach = document.getElementById('tn-bulk-dl-each');

    const progressWrap = document.getElementById('tn-bulk-progress-wrap');
    const progressBar = document.getElementById('tn-bulk-progress-bar');
    const resultsWrap = document.getElementById('tn-bulk-results-wrap');
    const resultsList = document.getElementById('tn-bulk-results-list');
    const summaryBanner = document.getElementById('tn-bulk-summary-text');

    if (!dropzone || !fileInput) return;

    // Populate Preset Dropdown
    BULK_PRESETS.forEach(function (p) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      presetSelect.appendChild(opt);
    });

    presetSelect.addEventListener('change', function () {
      const found = BULK_PRESETS.find(function (p) {
        return p.id === presetSelect.value;
      });
      if (found && found.id !== 'custom') {
        modeSelect.value = 'dimensions';
        updateModeVisibility();
        widthInput.value = found.width;
        heightInput.value = found.height;
      }
    });

    function updateModeVisibility() {
      const m = modeSelect.value;
      document.getElementById('tn-bulk-dim-group').classList.toggle('d-none', m !== 'dimensions' && m !== 'width' && m !== 'height');
      document.getElementById('tn-bulk-w-col').classList.toggle('d-none', m === 'height');
      document.getElementById('tn-bulk-h-col').classList.toggle('d-none', m === 'width');
      document.getElementById('tn-bulk-fit-group').classList.toggle('d-none', m !== 'dimensions');
      document.getElementById('tn-bulk-pct-group').classList.toggle('d-none', m !== 'percentage');
      document.getElementById('tn-bulk-longest-group').classList.toggle('d-none', m !== 'longest');
      const fsizeGroup = document.getElementById('tn-bulk-filesize-group');
      if (fsizeGroup) {
        fsizeGroup.classList.toggle('d-none', m !== 'filesize');
      }
    }

    modeSelect.addEventListener('change', updateModeVisibility);

    // Quick Target File Size Preset Buttons (50 KB, 100 KB, 500 KB, 1 MB, 2 MB, 5 MB)
    document.querySelectorAll('[data-fsize-val]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (targetSizeInput) targetSizeInput.value = btn.getAttribute('data-fsize-val');
        if (targetUnitSelect) targetUnitSelect.value = btn.getAttribute('data-fsize-unit') || 'MB';
      });
    });

    qualitySlider.addEventListener('input', function () {
      qualityLabel.textContent = qualitySlider.value + '%';
    });

    function renderSourceQueue() {
      if (sourceQueue.length === 0) {
        queuePanel.classList.add('d-none');
        return;
      }
      queuePanel.classList.remove('d-none');
      queueCountBadge.textContent = sourceQueue.length + ' Image(s) Queued';

      queueList.innerHTML = sourceQueue
        .map(function (it, idx) {
          return (
            '<div class="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill border bg-white small">' +
            '<i class="bi bi-file-earmark-image text-primary" aria-hidden="true"></i>' +
            '<span class="fw-semibold text-truncate" style="max-width: 160px;">' +
            window.ToolNest.escapeHtml(it.name) +
            '</span>' +
            '<span class="text-muted">(' +
            it.origW +
            '&times;' +
            it.origH +
            ' &bull; ' +
            window.ToolNest.formatBytes(it.origSize) +
            ')</span>' +
            '<button type="button" class="btn-close" style="font-size: 0.65rem;" data-rm-q="' +
            idx +
            '" aria-label="Remove image"></button>' +
            '</div>'
          );
        })
        .join('');

      queueList.querySelectorAll('[data-rm-q]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-rm-q'));
          sourceQueue.splice(i, 1);
          renderSourceQueue();
        });
      });
    }

    function getBatchConfig() {
      const rawTargetVal = Math.max(0.1, parseFloat(targetSizeInput ? targetSizeInput.value : '5') || 5);
      const unit = targetUnitSelect ? targetUnitSelect.value : 'MB';
      const targetBytes = unit === 'MB' ? Math.round(rawTargetVal * 1024 * 1024) : Math.round(rawTargetVal * 1024);

      return {
        mode: modeSelect.value || 'dimensions',
        width: Math.min(8000, Math.max(16, parseInt(widthInput.value, 10) || 1200)),
        height: Math.min(8000, Math.max(16, parseInt(heightInput.value, 10) || 630)),
        scalePct: Math.min(500, Math.max(5, parseInt(pctInput.value, 10) || 50)),
        longestSide: Math.min(8000, Math.max(16, parseInt(longestInput.value, 10) || 1200)),
        targetBytes: targetBytes,
        fileSizeStrategy: fileSizeStrategySelect ? fileSizeStrategySelect.value : 'auto',
        allowSizePadding: Boolean(!fileSizePadCheck || fileSizePadCheck.checked),
        fitMode: fitSelect.value || 'cover',
        anchor: anchorSelect.value || 'center',
        bgColor: bgColorInput.value || '#FFFFFF',
        noEnlarge: Boolean(noEnlargeCheck && noEnlargeCheck.checked),
        rotation: parseInt(rotateSelect.value, 10) || 0,
        flipH: Boolean(flipHCheck && flipHCheck.checked),
        flipV: Boolean(flipVCheck && flipVCheck.checked),
        format: formatSelect.value || 'image/jpeg',
        quality: Math.min(1, Math.max(0.1, Number(qualitySlider.value) / 100)),
        prefix: prefixInput.value || '',
        suffix: suffixInput.value || ''
      };
    }

    function renderBatchResults() {
      if (processedBatch.length === 0) {
        resultsWrap.classList.add('d-none');
        return;
      }

      resultsWrap.classList.remove('d-none');
      let totalOrigBytes = 0;
      let totalOutBytes = 0;

      resultsList.innerHTML = processedBatch
        .map(function (item, idx) {
          totalOrigBytes += item.origSize;
          totalOutBytes += item.outSize;
          return (
            '<div class="tn-result-box mb-2">' +
            '<div class="row align-items-center g-3">' +
            '<div class="col-auto">' +
            '<img src="' +
            item.previewUrl +
            '" alt="Resized preview of ' +
            window.ToolNest.escapeHtml(item.outputName) +
            '" width="68" height="68" class="rounded border object-fit-cover" loading="lazy">' +
            '</div>' +
            '<div class="col">' +
            '<div class="fw-bold text-break">' +
            window.ToolNest.escapeHtml(item.outputName) +
            '</div>' +
            '<div class="small text-muted">' +
            'Dimensions: <strong>' +
            item.origW +
            ' &times; ' +
            item.origH +
            ' px</strong> &rarr; <strong class="text-primary">' +
            item.outW +
            ' &times; ' +
            item.outH +
            ' px</strong> &bull; File Size: ' +
            window.ToolNest.formatBytes(item.origSize) +
            ' &rarr; <strong class="text-success">' +
            window.ToolNest.formatBytes(item.outSize) +
            '</strong>' +
            '</div>' +
            '</div>' +
            '<div class="col-12 col-sm-auto text-end">' +
            '<button type="button" class="btn tn-btn--primary btn-sm" data-dl-single="' +
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

      summaryBanner.innerHTML =
        'Resized <strong>' +
        processedBatch.length +
        ' image(s)</strong> &bull; Total Batch Size: <strong>' +
        window.ToolNest.formatBytes(totalOrigBytes) +
        '</strong> &rarr; <strong class="text-success">' +
        window.ToolNest.formatBytes(totalOutBytes) +
        '</strong>';

      resultsList.querySelectorAll('[data-dl-single]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-dl-single'));
          if (processedBatch[i]) {
            window.ToolNest.downloadBlob(processedBatch[i].blob, processedBatch[i].outputName);
          }
        });
      });
    }

    function runBulkResize() {
      if (sourceQueue.length === 0) {
        window.ToolNest.showToast('Please drop or select images to resize first.', 'warning');
        return;
      }

      cleanupProcessedPreviews();
      const cfg = getBatchConfig();

      progressWrap.classList.remove('d-none');
      progressBar.style.width = '10%';
      progressBar.textContent = '10%';

      let chain = Promise.resolve();
      sourceQueue.forEach(function (item, index) {
        chain = chain.then(function () {
          return resizeSingleItem(item, index, cfg).then(function (outItem) {
            processedBatch.push(outItem);
            const pct = Math.round(((index + 1) / sourceQueue.length) * 100);
            progressBar.style.width = pct + '%';
            progressBar.textContent = pct + '%';
          });
        });
      });

      chain
        .then(function () {
          setTimeout(function () {
            progressWrap.classList.add('d-none');
          }, 300);
          renderBatchResults();
          window.ToolNest.showToast('Bulk resized ' + processedBatch.length + ' image(s)!', 'success');
        })
        .catch(function (err) {
          progressWrap.classList.add('d-none');
          window.ToolNest.showToast(err.message || 'Error during bulk resize.', 'danger');
        });
    }

    function addFilesToQueue(files) {
      const valid = files.filter(function (f) {
        return f.type.startsWith('image/');
      });
      if (valid.length === 0) {
        window.ToolNest.showToast('Please select valid image files (JPG, PNG, WebP, GIF, BMP).', 'danger');
        return;
      }

      Promise.all(valid.map(loadImageFile))
        .then(function (loadedItems) {
          sourceQueue = sourceQueue.concat(loadedItems);
          renderSourceQueue();
          window.ToolNest.showToast(
            loadedItems.length + ' image(s) queued. Choose your settings and click "Resize Images".',
            'success'
          );
        })
        .catch(function (err) {
          window.ToolNest.showToast(err.message, 'danger');
        });
    }

    window.ToolNest.setupDropzone(dropzone, fileInput, addFilesToQueue);

    if (btnProcess) {
      btnProcess.addEventListener('click', runBulkResize);
    }

    if (btnSample) {
      btnSample.addEventListener('click', function () {
        sourceQueue = [];
        generateSampleBatchFiles().then(function (files) {
          addFilesToQueue(files);
        });
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', function () {
        sourceQueue = [];
        fileInput.value = '';
        cleanupProcessedPreviews();
        renderSourceQueue();
        resultsWrap.classList.add('d-none');
      });
    }

    if (btnDownloadZip) {
      btnDownloadZip.addEventListener('click', function () {
        if (processedBatch.length === 0) return;
        if (typeof window.JSZip === 'function') {
          const zip = new window.JSZip();
          processedBatch.forEach(function (item) {
            zip.file(item.outputName, item.blob);
          });
          zip.generateAsync({ type: 'blob' }).then(function (zipBlob) {
            window.ToolNest.downloadBlob(zipBlob, 'toolnest-bulk-resized-images.zip');
            window.ToolNest.showToast('Downloaded ZIP archive with ' + processedBatch.length + ' images!', 'success');
          });
        } else {
          // Fallback sequential download if offline
          processedBatch.forEach(function (item, idx) {
            setTimeout(function () {
              window.ToolNest.downloadBlob(item.blob, item.outputName);
            }, idx * 200);
          });
        }
      });
    }

    if (btnDownloadEach) {
      btnDownloadEach.addEventListener('click', function () {
        processedBatch.forEach(function (item, idx) {
          setTimeout(function () {
            window.ToolNest.downloadBlob(item.blob, item.outputName);
          }, idx * 220);
        });
      });
    }
  });
})();
