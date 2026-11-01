/**
 * ToolNest - AI Image Alt-Text & Caption Generator (/assets/js/tools/image-alt-text-generator.js)
 * 100% Client-Side Vision-to-Text AI powered by Transformers.js (Xenova/vit-gpt2-image-captioning),
 * with automatic Web Worker + main-thread fallback (for file:// protocol) and instant pixel/scene analysis.
 */
(function () {
  'use strict';

  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const MAX_IMAGE_PIXELS = 16000000;

  const NAMED_COLORS = [
    { name: 'crimson red', r: 210, g: 40, b: 45 },
    { name: 'coral orange', r: 235, g: 110, b: 65 },
    { name: 'warm amber', r: 235, g: 170, b: 35 },
    { name: 'emerald green', r: 30, g: 165, b: 95 },
    { name: 'forest green', r: 35, g: 95, b: 55 },
    { name: 'teal blue', r: 20, g: 150, b: 165 },
    { name: 'sky blue', r: 75, g: 165, b: 235 },
    { name: 'royal blue', r: 37, g: 99, b: 235 },
    { name: 'deep navy', r: 22, g: 42, b: 85 },
    { name: 'violet purple', r: 125, g: 70, b: 210 },
    { name: 'soft pink', r: 230, g: 120, b: 170 },
    { name: 'warm brown', r: 135, g: 85, b: 50 },
    { name: 'sand beige', r: 220, g: 205, b: 175 },
    { name: 'crisp white', r: 245, g: 247, b: 250 },
    { name: 'neutral gray', r: 140, g: 150, b: 165 },
    { name: 'charcoal dark', r: 35, g: 42, b: 52 }
  ];

  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'of', 'in', 'on', 'at', 'with', 'and', 'or', 'to', 'for', 'from',
    'by', 'is', 'are', 'standing', 'sitting', 'holding', 'next', 'front', 'top', 'up', 'over',
    'img', 'image', 'photo', 'pic', 'picture', 'screenshot', 'dsc', 'whatsapp', 'final', 'copy'
  ]);

  let mainThreadCaptionerPromise = null;

  function closestColorName(r, g, b) {
    let best = NAMED_COLORS[0].name;
    let bestDist = Infinity;
    for (let i = 0; i < NAMED_COLORS.length; i++) {
      const c = NAMED_COLORS[i];
      const dr = r - c.r;
      const dg = g - c.g;
      const db = b - c.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = c.name;
      }
    }
    return best;
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    }).join('').toUpperCase();
  }

  /**
   * Analyze image colors, brightness, contrast, and create a compact 384px Data URL for the AI model
   */
  function analyzeImageOnCanvas(imgEl, origW, origH) {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const ctx = c.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, 48, 48);
    const data = ctx.getImageData(0, 0, 48, 48).data;

    const buckets = new Map();
    let totalLum = 0;
    let validPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalLum += 0.299 * r + 0.587 * g + 0.114 * b;
      validPixels++;

      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;
      const key = qr + ',' + qg + ',' + qb;
      const entry = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      entry.count++;
      entry.r += r;
      entry.g += g;
      entry.b += b;
      buckets.set(key, entry);
    }

    const avgLum = validPixels > 0 ? totalLum / validPixels : 128;
    const lighting = avgLum > 185 ? 'brightly lit' : avgLum < 75 ? 'low-light moody' : 'naturally lit';

    const sorted = Array.from(buckets.values()).sort(function (a, b) {
      return b.count - a.count;
    });

    const picked = [];
    const seenNames = new Set();
    for (let j = 0; j < sorted.length && picked.length < 3; j++) {
      const item = sorted[j];
      const r = Math.round(item.r / item.count);
      const g = Math.round(item.g / item.count);
      const b = Math.round(item.b / item.count);
      const name = closestColorName(r, g, b);
      if (!seenNames.has(name)) {
        seenNames.add(name);
        picked.push({ hex: rgbToHex(r, g, b), name: name });
      }
    }

    // Create 384px JPEG Data URL for fast AI vision model inference
    const maxAiDim = 384;
    const scale = Math.min(1, maxAiDim / Math.max(origW, origH));
    const aiCanvas = document.createElement('canvas');
    aiCanvas.width = Math.max(1, Math.round(origW * scale));
    aiCanvas.height = Math.max(1, Math.round(origH * scale));
    const aiCtx = aiCanvas.getContext('2d');
    aiCtx.fillStyle = '#FFFFFF';
    aiCtx.fillRect(0, 0, aiCanvas.width, aiCanvas.height);
    aiCtx.drawImage(imgEl, 0, 0, aiCanvas.width, aiCanvas.height);
    const aiDataUrl = aiCanvas.toDataURL('image/jpeg', 0.85);

    return {
      colors: picked,
      lighting: lighting,
      aiDataUrl: aiDataUrl
    };
  }

  /**
   * Build an instant heuristic visual description from image metadata & filename before/if neural model finishes
   */
  function buildHeuristicCaption(fileName, keyword, visualMeta) {
    const cleanName = String(fileName || '')
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\d+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const nameWords = cleanName
      .split(' ')
      .filter(function (w) { return w.length > 2 && !STOP_WORDS.has(w.toLowerCase()); });

    const subject = keyword
      ? keyword.trim()
      : nameWords.length >= 2
        ? nameWords.join(' ')
        : visualMeta.orientation + ' visual composition';

    const topColors = visualMeta.colors.map(function (c) { return c.name; });
    const colorDesc = topColors.length >= 2
      ? topColors[0] + ' and ' + topColors[1]
      : topColors[0] || 'balanced';

    return (
      visualMeta.lighting.charAt(0).toUpperCase() +
      visualMeta.lighting.slice(1) +
      ' ' +
      subject +
      ' with ' +
      colorDesc +
      ' tones'
    );
  }

  document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('tn-alt-file');
    const dropzone = document.getElementById('tn-alt-dropzone');
    const sampleButton = document.getElementById('tn-alt-sample');
    const runButton = document.getElementById('tn-alt-run');
    const clearButton = document.getElementById('tn-alt-clear');

    const keywordInput = document.getElementById('tn-alt-keyword');
    const contextSelect = document.getElementById('tn-alt-context');

    const status = document.getElementById('tn-alt-status');
    const progressWrap = document.getElementById('tn-alt-progress-wrap');
    const progressLabel = document.getElementById('tn-alt-progress-label');
    const progressBar = document.getElementById('tn-alt-progress');

    const previewSection = document.getElementById('tn-alt-preview-section');
    const previewImg = document.getElementById('tn-alt-preview-img');
    const metaBadgeDims = document.getElementById('tn-alt-meta-dims');
    const metaBadgeOrient = document.getElementById('tn-alt-meta-orient');
    const paletteSwatches = document.getElementById('tn-alt-palette');

    const resultsSection = document.getElementById('tn-alt-results');
    const rawAiBadge = document.getElementById('tn-alt-raw-caption');
    const wcagOutput = document.getElementById('tn-alt-wcag-output');
    const wcagCountBadge = document.getElementById('tn-alt-wcag-count');
    const seoOutput = document.getElementById('tn-alt-seo-output');
    const htmlOutput = document.getElementById('tn-alt-html-output');
    const captionOutput = document.getElementById('tn-alt-caption-output');
    const tagsWrap = document.getElementById('tn-alt-tags-wrap');

    const copyWcagBtn = document.getElementById('tn-alt-copy-wcag');
    const copySeoBtn = document.getElementById('tn-alt-copy-seo');
    const copyHtmlBtn = document.getElementById('tn-alt-copy-html');
    const copyCaptionBtn = document.getElementById('tn-alt-copy-caption');

    if (!fileInput || !dropzone || !runButton || !clearButton || !status || !progressWrap ||
        !progressLabel || !progressBar || !previewSection || !previewImg || !resultsSection) {
      return;
    }

    let selectedFile = null;
    let originalUrl = null;
    let worker = null;
    let workerFailed = false;
    let processing = false;
    let currentVisualMeta = {
      width: 0,
      height: 0,
      orientation: 'landscape',
      lighting: 'naturally lit',
      colors: [],
      aiDataUrl: ''
    };
    let lastRawAiCaption = '';

    function setStatus(message, type) {
      status.textContent = message;
      status.className = 'small mb-3' + (type === 'danger' ? ' text-danger' : ' text-muted');
    }

    function setBusy(isBusy) {
      processing = isBusy;
      fileInput.disabled = isBusy;
      runButton.disabled = isBusy || !selectedFile;
      clearButton.disabled = isBusy || !selectedFile;
      if (sampleButton) sampleButton.disabled = isBusy;
      dropzone.setAttribute('aria-disabled', String(isBusy));
      progressWrap.classList.toggle('d-none', !isBusy);
    }

    function revokeUrl(url) {
      if (url) URL.revokeObjectURL(url);
    }

    function showProgress(message, percent) {
      progressLabel.textContent = message;
      const bounded = Math.max(5, Math.min(100, Math.round(percent)));
      progressBar.style.width = bounded + '%';
      progressBar.setAttribute('aria-valuenow', String(bounded));
    }

    function cleanBaseSentence(raw) {
      let s = String(raw || '').trim();
      s = s.replace(/^(an?\s+)?(image|picture|photo|photograph)\s+of\s+/i, '');
      s = s.replace(/\s+/g, ' ').replace(/\.+$/, '');
      if (!s) return '';
      return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function updateWcagCharCount() {
      if (!wcagOutput || !wcagCountBadge) return;
      const len = wcagOutput.value.length;
      wcagCountBadge.textContent = len + ' / 125 chars';
      wcagCountBadge.className = len <= 125
        ? 'badge bg-success-subtle text-success border border-success-subtle ms-1'
        : 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle ms-1';

      if (htmlOutput && selectedFile) {
        const safeAlt = wcagOutput.value.replace(/"/g, '&quot;');
        const fname = (selectedFile.name || 'image.jpg').replace(/"/g, '');
        htmlOutput.value =
          '<img src="' + fname + '" alt="' + safeAlt + '" width="' +
          currentVisualMeta.width + '" height="' + currentVisualMeta.height +
          '" loading="lazy" decoding="async">';
      }
    }

    function buildFormattedOutputs(rawCaption) {
      const base = cleanBaseSentence(rawCaption);
      const kw = keywordInput ? keywordInput.value.trim() : '';
      const ctxMode = contextSelect ? contextSelect.value : 'seo';
      const topColors = currentVisualMeta.colors.map(function (c) { return c.name; });
      const colorPhrase = topColors.length >= 2
        ? topColors[0] + ' and ' + topColors[1]
        : topColors[0] || '';

      // 1. Concise WCAG Alt-Text (<= 125 chars)
      let wcagText = base;
      if (kw && !base.toLowerCase().includes(kw.toLowerCase())) {
        const candidate = kw + ' — ' + base.charAt(0).toLowerCase() + base.slice(1);
        wcagText = candidate.length <= 120 ? candidate.charAt(0).toUpperCase() + candidate.slice(1) : base;
      }
      if (wcagText.length > 124) {
        wcagText = wcagText.slice(0, 121).trim() + '...';
      }
      if (!wcagText.endsWith('.')) wcagText += '.';

      // 2. Context-aware SEO Alt-Text
      let seoText = base;
      if (ctxMode === 'ecommerce') {
        const prefix = kw ? kw + ': ' : '';
        seoText = prefix + base + (colorPhrase ? ' featuring ' + colorPhrase + ' tones' : '') + '.';
      } else if (ctxMode === 'editorial') {
        seoText = base + (kw ? ' (' + kw + ')' : '') + (colorPhrase ? ', captured in ' + colorPhrase + ' tones' : '') + '.';
      } else if (ctxMode === 'wcag') {
        seoText = base + (colorPhrase ? ' with ' + colorPhrase + ' colors' : '') + '.';
      } else {
        seoText = (kw ? kw + ' — ' : '') + base + (colorPhrase ? ' in ' + colorPhrase + ' palette' : '') + '.';
      }

      // 3. Detailed Caption & Hashtags
      const words = (base + ' ' + kw + ' ' + colorPhrase)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(function (w) { return w.length > 2 && !STOP_WORDS.has(w); });
      const uniqueWords = Array.from(new Set(words)).slice(0, 6);
      const hashtags = uniqueWords.map(function (w) { return '#' + w; }).join(' ');

      const detailedCaption =
        base +
        (kw && !base.toLowerCase().includes(kw.toLowerCase()) ? ' — ' + kw + '.' : '.') +
        (colorPhrase ? ' Visual palette highlights ' + colorPhrase + ' tones' : '') +
        ' (' + currentVisualMeta.orientation + ' ' + currentVisualMeta.width + '×' + currentVisualMeta.height + 'px).' +
        (hashtags ? '\n\nSuggested Tags: ' + hashtags : '');

      if (rawAiBadge) rawAiBadge.textContent = base;
      if (wcagOutput) wcagOutput.value = wcagText;
      if (seoOutput) seoOutput.value = seoText;
      if (captionOutput) captionOutput.value = detailedCaption;

      updateWcagCharCount();

      if (tagsWrap) {
        tagsWrap.innerHTML = '';
        uniqueWords.forEach(function (tag) {
          const span = document.createElement('span');
          span.className = 'badge bg-primary-subtle text-primary border border-primary-subtle';
          span.textContent = tag;
          tagsWrap.appendChild(span);
        });
      }

      resultsSection.classList.remove('d-none');
    }

    /**
     * Run AI Vision Model in main thread via dynamic import() when Worker is blocked (e.g. file://)
     */
    async function runMainThreadAiVision(dataUrl) {
      if (!mainThreadCaptionerPromise) {
        const mod = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
        mod.env.allowLocalModels = false;
        if (mod.env.backends && mod.env.backends.onnx && mod.env.backends.onnx.wasm) {
          mod.env.backends.onnx.wasm.numThreads = 1;
        }
        mainThreadCaptionerPromise = mod.pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
          quantized: true,
          progress_callback: function (progress) {
            if (progress.status === 'progress' && Number.isFinite(progress.progress)) {
              const fileName = progress.file ? ' (' + progress.file.split('/').pop() + ')' : '';
              showProgress('Downloading AI vision model' + fileName + '...', progress.progress);
            } else if (progress.status === 'done') {
              showProgress('AI vision model loaded. Generating caption...', 95);
            }
          }
        }).catch(function (err) {
          mainThreadCaptionerPromise = null;
          throw err;
        });
      }

      const captioner = await mainThreadCaptionerPromise;
      showProgress('Analyzing image content with AI vision model...', 95);
      const output = await captioner(dataUrl, { max_new_tokens: 40 });
      const rawCaption = Array.isArray(output) && output[0] && output[0].generated_text
        ? String(output[0].generated_text).trim()
        : '';
      if (!rawCaption) throw new Error('Empty caption returned');
      return rawCaption;
    }

    async function fallbackToMainThreadOrHeuristic() {
      try {
        const aiCaption = await runMainThreadAiVision(currentVisualMeta.aiDataUrl);
        setBusy(false);
        lastRawAiCaption = aiCaption;
        buildFormattedOutputs(lastRawAiCaption);
        setStatus('AI Vision alt-text and captions generated!');
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('AI alt-text & captions generated!', 'success');
        }
      } catch (_) {
        // Offline or CDN restricted: use visual & semantic scene analyzer so tool always succeeds
        setBusy(false);
        const kw = keywordInput ? keywordInput.value.trim() : '';
        lastRawAiCaption = buildHeuristicCaption(selectedFile ? selectedFile.name : '', kw, currentVisualMeta);
        buildFormattedOutputs(lastRawAiCaption);
        setStatus('Generated alt-text and captions using local visual scene & color analysis.');
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Alt-text & captions generated!', 'success');
        }
      }
    }

    function runAiAnalysis() {
      if (!selectedFile || processing) return;
      setBusy(true);
      setStatus('Running browser AI vision analysis on your image...');
      showProgress('Initializing AI vision model...', 10);

      if (workerFailed || window.location.protocol === 'file:') {
        fallbackToMainThreadOrHeuristic();
        return;
      }

      try {
        if (!worker) {
          worker = new Worker('../../assets/js/tools/image-alt-text-generator-worker.js', { type: 'module' });
          worker.addEventListener('message', function (event) {
            const message = event.data || {};
            if (message.type === 'progress') {
              if (message.status === 'progress' && Number.isFinite(message.progress)) {
                const fileName = message.file ? ' (' + message.file.split('/').pop() + ')' : '';
                showProgress('Downloading AI vision model' + fileName + '...', message.progress);
              } else if (message.status === 'done') {
                showProgress('AI vision model loaded. Generating caption...', 95);
              }
              return;
            }
            if (message.type === 'stage') {
              showProgress(message.message || 'Analyzing image...', 92);
              return;
            }
            if (message.type === 'result') {
              setBusy(false);
              lastRawAiCaption = message.caption || '';
              buildFormattedOutputs(lastRawAiCaption);
              setStatus('AI Vision alt-text and captions generated! You can copy any format below.');
              if (window.ToolNest && window.ToolNest.showToast) {
                window.ToolNest.showToast('AI alt-text & captions generated!', 'success');
              }
              return;
            }
            if (message.type === 'error') {
              workerFailed = true;
              fallbackToMainThreadOrHeuristic();
            }
          });
          worker.addEventListener('error', function () {
            workerFailed = true;
            fallbackToMainThreadOrHeuristic();
          });
        }
        worker.postMessage({ type: 'caption', dataUrl: currentVisualMeta.aiDataUrl });
      } catch (_) {
        workerFailed = true;
        fallbackToMainThreadOrHeuristic();
      }
    }

    function selectFile(file) {
      if (processing || !file) return;

      const name = (file.name || '').toLowerCase();
      const isSupported =
        file.type === 'image/jpeg' ||
        file.type === 'image/png' ||
        file.type === 'image/webp' ||
        /\.(jpe?g|png|webp)$/i.test(name);

      if (!isSupported) {
        setStatus('Please choose a JPEG, PNG, or WebP image.', 'danger');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setStatus('This image is larger than 20 MB. Please choose a smaller file.', 'danger');
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        if (w * h > MAX_IMAGE_PIXELS) {
          URL.revokeObjectURL(url);
          setStatus('This image is larger than 16 megapixels. Resize it before processing.', 'danger');
          return;
        }

        revokeUrl(originalUrl);
        originalUrl = url;
        selectedFile = file;

        const orient = w > h ? 'Landscape' : h > w ? 'Portrait' : 'Square';
        const analyzed = analyzeImageOnCanvas(img, w, h);

        currentVisualMeta = {
          width: w,
          height: h,
          orientation: orient.toLowerCase(),
          lighting: analyzed.lighting,
          colors: analyzed.colors,
          aiDataUrl: analyzed.aiDataUrl
        };

        previewImg.src = originalUrl;
        if (metaBadgeDims) metaBadgeDims.textContent = w + ' × ' + h + ' px';
        if (metaBadgeOrient) metaBadgeOrient.textContent = orient;

        if (paletteSwatches) {
          paletteSwatches.innerHTML = '';
          analyzed.colors.forEach(function (c) {
            const pill = document.createElement('span');
            pill.className = 'badge bg-white text-dark border d-inline-flex align-items-center gap-1';
            pill.innerHTML =
              '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
              c.hex + ';border:1px solid rgba(0,0,0,0.15);"></span> ' + c.name;
            paletteSwatches.appendChild(pill);
          });
        }

        previewSection.classList.remove('d-none');
        runButton.disabled = false;
        clearButton.disabled = false;

        // Immediately populate preliminary visual scene alt-text so results are visible right away
        const kw = keywordInput ? keywordInput.value.trim() : '';
        lastRawAiCaption = buildHeuristicCaption(file.name, kw, currentVisualMeta);
        buildFormattedOutputs(lastRawAiCaption);
        setStatus('Instant visual analysis ready below! Click "Generate AI Alt-Text & Captions" to run the deep neural vision model.');
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        setStatus('Could not decode this image. Try another JPEG, PNG, or WebP file.', 'danger');
      };
      img.src = url;
    }

    function createSamplePhotoFile() {
      return new Promise(function (resolve) {
        const c = document.createElement('canvas');
        c.width = 640;
        c.height = 440;
        const ctx = c.getContext('2d');

        ctx.fillStyle = '#DBEAFE';
        ctx.fillRect(0, 0, 640, 270);

        ctx.fillStyle = '#B45309';
        ctx.fillRect(0, 270, 640, 170);
        ctx.fillStyle = '#92400E';
        ctx.fillRect(0, 270, 640, 10);

        ctx.fillStyle = '#1E293B';
        ctx.fillRect(140, 110, 240, 155);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(152, 122, 216, 131);
        ctx.fillStyle = '#94A3B8';
        ctx.beginPath();
        ctx.moveTo(115, 265);
        ctx.lineTo(405, 265);
        ctx.lineTo(430, 295);
        ctx.lineTo(90, 295);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#DC2626';
        ctx.fillRect(465, 210, 66, 75);
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(533, 247, 18, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

        c.toBlob(function (blob) {
          resolve(new File([blob], 'laptop-and-red-coffee-mug-on-desk.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
      });
    }

    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length > 0) {
        selectFile(fileInput.files[0]);
      }
      fileInput.value = '';
    });

    dropzone.addEventListener('click', function (event) {
      if (!processing && !event.target.closest('label') && !event.target.closest('button')) {
        fileInput.click();
      }
    });
    dropzone.addEventListener('keydown', function (event) {
      if (!processing && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        fileInput.click();
      }
    });
    ['dragenter', 'dragover'].forEach(function (name) {
      dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (!processing) dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', function (event) {
      if (processing) return;
      const files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length > 0) selectFile(files[0]);
    });

    if (sampleButton) {
      sampleButton.addEventListener('click', async function (event) {
        event.stopPropagation();
        if (processing) return;
        const sample = await createSamplePhotoFile();
        if (keywordInput && !keywordInput.value) {
          keywordInput.value = 'Remote developer desk setup';
        }
        selectFile(sample);
      });
    }

    runButton.addEventListener('click', function () {
      runAiAnalysis();
    });

    if (keywordInput) {
      keywordInput.addEventListener('input', function () {
        if (selectedFile) {
          const base = lastRawAiCaption || buildHeuristicCaption(selectedFile.name, keywordInput.value, currentVisualMeta);
          buildFormattedOutputs(base);
        }
      });
    }
    if (contextSelect) {
      contextSelect.addEventListener('change', function () {
        if (selectedFile && lastRawAiCaption) {
          buildFormattedOutputs(lastRawAiCaption);
        }
      });
    }
    if (wcagOutput) {
      wcagOutput.addEventListener('input', updateWcagCharCount);
    }

    function bindCopyButton(btn, inputEl) {
      if (!btn || !inputEl) return;
      btn.addEventListener('click', function () {
        if (window.ToolNest && window.ToolNest.copyToClipboard) {
          window.ToolNest.copyToClipboard(inputEl.value, btn);
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(inputEl.value);
        }
      });
    }

    bindCopyButton(copyWcagBtn, wcagOutput);
    bindCopyButton(copySeoBtn, seoOutput);
    bindCopyButton(copyHtmlBtn, htmlOutput);
    bindCopyButton(copyCaptionBtn, captionOutput);

    clearButton.addEventListener('click', function () {
      if (processing) return;
      revokeUrl(originalUrl);
      originalUrl = null;
      selectedFile = null;
      lastRawAiCaption = '';
      fileInput.value = '';
      previewImg.removeAttribute('src');
      previewSection.classList.add('d-none');
      resultsSection.classList.add('d-none');
      runButton.disabled = true;
      clearButton.disabled = true;
      setStatus('Choose a photo to get started.');
    });

    window.addEventListener('pagehide', function () {
      if (worker) worker.terminate();
      revokeUrl(originalUrl);
    });
  });
})();
