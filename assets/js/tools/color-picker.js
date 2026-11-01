/**
 * ToolNest - Color Picker, Image Eyedropper & Palette Generator (/assets/js/tools/color-picker.js)
 * 100% Client-Side Color Picker from Image (with Pixel Magnifier Loupe & Dominant Palette),
 * HEX / RGB / HSL / HSV / CMYK Converter, Tints & Shades, Color Harmonies, and WCAG Contrast Checker.
 */
(function () {
  'use strict';

  // Current active color in RGB { r, g, b }
  let currentRgb = { r: 37, g: 99, b: 235 }; // #2563EB (ToolNest Primary Blue)
  let savedHistory = ['#2563EB', '#F59E0B', '#16A34A', '#DC2626', '#0F172A', '#7C3AED'];
  let loadedImage = null;

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function componentToHex(c) {
    const hex = clamp(Math.round(c), 0, 255).toString(16).toUpperCase();
    return hex.length === 1 ? '0' + hex : hex;
  }

  function rgbToHex(r, g, b) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }

  function hexToRgb(hexStr) {
    if (!hexStr) return null;
    let clean = String(hexStr).trim().replace(/^#/, '');
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgbToHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rn:
          h = (gn - bn) / d + (gn < bn ? 6 : 0);
          break;
        case gn:
          h = (bn - rn) / d + 2;
          break;
        case bn:
          h = (rn - gn) / d + 4;
          break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  function hslToRgb(h, s, l) {
    const hn = ((h % 360) + 360) % 360 / 360;
    const sn = clamp(s, 0, 100) / 100;
    const ln = clamp(l, 0, 100) / 100;

    if (sn === 0) {
      const gray = Math.round(ln * 255);
      return { r: gray, g: gray, b: gray };
    }

    const hue2rgb = function (p, q, t) {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };

    const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
    const p = 2 * ln - q;

    return {
      r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
      g: Math.round(hue2rgb(p, q, hn) * 255),
      b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255)
    };
  }

  function rgbToHsv(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max !== min) {
      switch (max) {
        case rn:
          h = (gn - bn) / d + (gn < bn ? 6 : 0);
          break;
        case gn:
          h = (bn - rn) / d + 2;
          break;
        case bn:
          h = (rn - gn) / d + 4;
          break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      v: Math.round(v * 100)
    };
  }

  function rgbToCmyk(r, g, b) {
    if (r === 0 && g === 0 && b === 0) {
      return { c: 0, m: 0, y: 0, k: 100 };
    }
    const c1 = 1 - r / 255;
    const m1 = 1 - g / 255;
    const y1 = 1 - b / 255;
    const k = Math.min(c1, m1, y1);
    const c = Math.round(((c1 - k) / (1 - k)) * 100);
    const m = Math.round(((m1 - k) / (1 - k)) * 100);
    const y = Math.round(((y1 - k) / (1 - k)) * 100);
    return { c: c, m: m, y: y, k: Math.round(k * 100) };
  }

  /**
   * Relative luminance and WCAG 2.1 contrast ratio
   */
  function getLuminance(r, g, b) {
    const a = [r, g, b].map(function (v) {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function getContrastRatio(rgb1, rgb2) {
    const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    const brightest = Math.max(l1, l2);
    const darkest = Math.min(l1, l2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * Extract top 8 dominant colors from a canvas by quantizing RGB buckets
   */
  function extractDominantColors(canvas, count) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return [];

    const data = ctx.getImageData(0, 0, w, h).data;
    const step = Math.max(4, Math.floor((w * h) / 4000) * 4);
    const buckets = {};

    for (let i = 0; i < data.length; i += step) {
      const a = data[i + 3];
      if (a < 128) continue;
      // Quantize into 24-step RGB bins
      const rq = Math.min(255, Math.round(data[i] / 24) * 24);
      const gq = Math.min(255, Math.round(data[i + 1] / 24) * 24);
      const bq = Math.min(255, Math.round(data[i + 2] / 24) * 24);
      const key = rq + ',' + gq + ',' + bq;
      buckets[key] = (buckets[key] || 0) + 1;
    }

    const sorted = Object.keys(buckets)
      .map(function (k) {
        const parts = k.split(',').map(Number);
        return {
          r: parts[0],
          g: parts[1],
          b: parts[2],
          hex: rgbToHex(parts[0], parts[1], parts[2]),
          count: buckets[k]
        };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });

    // Filter out colors that are too similar in Euclidean RGB distance
    const selected = [];
    for (let i = 0; i < sorted.length && selected.length < (count || 8); i++) {
      const cand = sorted[i];
      const tooClose = selected.some(function (ex) {
        const dr = ex.r - cand.r;
        const dg = ex.g - cand.g;
        const db = ex.b - cand.b;
        return Math.sqrt(dr * dr + dg * dg + db * db) < 42;
      });
      if (!tooClose) {
        selected.push(cand.hex);
      }
    }

    return selected;
  }

  /**
   * Draw colorful sample artwork on canvas for instant Image Eyedropper testing
   */
  function createSampleArtworkImage() {
    return new Promise(function (resolve) {
      const c = document.createElement('canvas');
      c.width = 720;
      c.height = 400;
      const ctx = c.getContext('2d');

      // Multi-stop sunset & ocean gradient
      const bg = ctx.createLinearGradient(0, 0, c.width, c.height);
      bg.addColorStop(0, '#0F172A');
      bg.addColorStop(0.28, '#1E40AF');
      bg.addColorStop(0.55, '#EC4899');
      bg.addColorStop(0.8, '#F59E0B');
      bg.addColorStop(1, '#10B981');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);

      // Decorative color orbs for rich pixel picking
      const circles = [
        { x: 130, y: 120, r: 65, color: '#38BDF8' },
        { x: 290, y: 260, r: 80, color: '#F43F5E' },
        { x: 460, y: 130, r: 70, color: '#A855F7' },
        { x: 590, y: 250, r: 75, color: '#FACC15' },
        { x: 360, y: 110, r: 45, color: '#22C55E' }
      ];
      circles.forEach(function (ci) {
        ctx.beginPath();
        ctx.arc(ci.x, ci.y, ci.r, 0, Math.PI * 2);
        ctx.fillStyle = ci.color;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.stroke();
      });

      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(160, 325, 400, 48);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click Anywhere to Pick Pixel Color', c.width / 2, 355);

      const img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.src = c.toDataURL('image/png');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const nativePicker = document.getElementById('tn-cp-native');
    const previewSwatch = document.getElementById('tn-cp-preview-swatch');
    const previewHexLabel = document.getElementById('tn-cp-preview-hex');

    const hexInput = document.getElementById('tn-cp-hex');
    const rgbInput = document.getElementById('tn-cp-rgb');
    const hslInput = document.getElementById('tn-cp-hsl');
    const hsvInput = document.getElementById('tn-cp-hsv');
    const cmykInput = document.getElementById('tn-cp-cmyk');
    const cssVarInput = document.getElementById('tn-cp-css');

    const rSlider = document.getElementById('tn-cp-r');
    const gSlider = document.getElementById('tn-cp-g');
    const bSlider = document.getElementById('tn-cp-b');
    const rValBadge = document.getElementById('tn-cp-r-val');
    const gValBadge = document.getElementById('tn-cp-g-val');
    const bValBadge = document.getElementById('tn-cp-b-val');

    const btnRandom = document.getElementById('tn-cp-random-btn');
    const btnScreenEyedropper = document.getElementById('tn-cp-eyedropper-btn');
    const btnSaveColor = document.getElementById('tn-cp-save-btn');
    const btnClearHistory = document.getElementById('tn-cp-clear-history');

    // Image Eyedropper Elements
    const dropzone = document.getElementById('tn-cp-dropzone');
    const fileInput = document.getElementById('tn-cp-file-input');
    const btnSampleImg = document.getElementById('tn-cp-sample-img-btn');
    const imageCanvasWrap = document.getElementById('tn-cp-canvas-wrap');
    const imageCanvas = document.getElementById('tn-cp-image-canvas');
    const loupeWrap = document.getElementById('tn-cp-loupe-info');
    const loupeSwatch = document.getElementById('tn-cp-loupe-swatch');
    const loupeText = document.getElementById('tn-cp-loupe-text');
    const imagePaletteWrap = document.getElementById('tn-cp-image-palette');

    // Harmonies, Shades, Contrast & Saved Swatches
    const harmoniesContainer = document.getElementById('tn-cp-harmonies');
    const shadesContainer = document.getElementById('tn-cp-shades');
    const historyContainer = document.getElementById('tn-cp-history');
    const contrastWhiteRatio = document.getElementById('tn-cp-contrast-white');
    const contrastWhiteBadge = document.getElementById('tn-cp-contrast-white-badge');
    const contrastDarkRatio = document.getElementById('tn-cp-contrast-dark');
    const contrastDarkBadge = document.getElementById('tn-cp-contrast-dark-badge');
    const contrastDemoBox = document.getElementById('tn-cp-contrast-demo');

    if (!hexInput || !nativePicker) return;

    function addColorToHistory(hex) {
      const upper = hex.toUpperCase();
      savedHistory = [upper].concat(
        savedHistory.filter(function (c) {
          return c.toUpperCase() !== upper;
        })
      ).slice(0, 14);
      renderSavedHistory();
    }

    function renderSwatchPill(hex, label) {
      return (
        '<button type="button" class="btn btn-sm p-1 border rounded-3 d-inline-flex align-items-center gap-2 bg-white shadow-sm" data-pick-hex="' +
        hex +
        '" title="Click to select & copy ' +
        hex +
        '">' +
        '<span class="d-inline-block rounded-2 border" style="width: 26px; height: 26px; background-color: ' +
        hex +
        ';"></span>' +
        '<span class="small font-monospace fw-semibold pe-1">' +
        (label || hex) +
        '</span>' +
        '</button>'
      );
    }

    function bindSwatchClicks(container) {
      if (!container) return;
      container.querySelectorAll('[data-pick-hex]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const hex = btn.getAttribute('data-pick-hex');
          const rgb = hexToRgb(hex);
          if (rgb) {
            setColorFromRgb(rgb.r, rgb.g, rgb.b, false);
            window.ToolNest.copyToClipboard(hex);
          }
        });
      });
    }

    function renderSavedHistory() {
      if (!historyContainer) return;
      if (savedHistory.length === 0) {
        historyContainer.innerHTML = '<span class="small text-muted">No saved colors yet.</span>';
        return;
      }
      historyContainer.innerHTML = savedHistory
        .map(function (hex) {
          return renderSwatchPill(hex);
        })
        .join('');
      bindSwatchClicks(historyContainer);
    }

    function renderHarmoniesAndShades(hsl) {
      if (harmoniesContainer) {
        const harmonySpecs = [
          { name: 'Complementary', angles: [0, 180] },
          { name: 'Analogous', angles: [-30, 0, 30] },
          { name: 'Triadic', angles: [0, 120, 240] },
          { name: 'Split-Comp', angles: [0, 150, 210] }
        ];

        harmoniesContainer.innerHTML = harmonySpecs
          .map(function (spec) {
            const pills = spec.angles
              .map(function (offset) {
                const rgb = hslToRgb(hsl.h + offset, hsl.s, hsl.l);
                const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
                return renderSwatchPill(hex);
              })
              .join('');

            return (
              '<div class="col-md-6">' +
              '<div class="p-2 border rounded-3 bg-white h-100">' +
              '<div class="small fw-bold text-muted mb-2">' +
              spec.name +
              '</div>' +
              '<div class="d-flex flex-wrap gap-2">' +
              pills +
              '</div>' +
              '</div>' +
              '</div>'
            );
          })
          .join('');
        bindSwatchClicks(harmoniesContainer);
      }

      if (shadesContainer) {
        const lightnessSteps = [92, 82, 72, 62, 52, 42, 32, 22, 14];
        shadesContainer.innerHTML = lightnessSteps
          .map(function (lVal) {
            const rgb = hslToRgb(hsl.h, hsl.s, lVal);
            const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
            return renderSwatchPill(hex);
          })
          .join('');
        bindSwatchClicks(shadesContainer);
      }
    }

    function renderContrastChecker(rgb, hex) {
      const whiteRatio = getContrastRatio(rgb, { r: 255, g: 255, b: 255 });
      const darkRatio = getContrastRatio(rgb, { r: 15, g: 23, b: 42 });

      if (contrastWhiteRatio) contrastWhiteRatio.textContent = whiteRatio.toFixed(2) + ' : 1';
      if (contrastDarkRatio) contrastDarkRatio.textContent = darkRatio.toFixed(2) + ' : 1';

      if (contrastWhiteBadge) {
        const passWhite = whiteRatio >= 4.5;
        contrastWhiteBadge.className = 'badge ' + (passWhite ? 'bg-success' : whiteRatio >= 3.0 ? 'bg-warning text-dark' : 'bg-danger');
        contrastWhiteBadge.textContent = whiteRatio >= 7 ? 'AAA Pass' : passWhite ? 'AA Pass' : whiteRatio >= 3.0 ? 'AA Large Only' : 'Fail';
      }

      if (contrastDarkBadge) {
        const passDark = darkRatio >= 4.5;
        contrastDarkBadge.className = 'badge ' + (passDark ? 'bg-success' : darkRatio >= 3.0 ? 'bg-warning text-dark' : 'bg-danger');
        contrastDarkBadge.textContent = darkRatio >= 7 ? 'AAA Pass' : passDark ? 'AA Pass' : darkRatio >= 3.0 ? 'AA Large Only' : 'Fail';
      }

      if (contrastDemoBox) {
        contrastDemoBox.style.backgroundColor = hex;
        contrastDemoBox.style.color = whiteRatio >= darkRatio ? '#FFFFFF' : '#0F172A';
      }
    }

    function setColorFromRgb(r, g, b, skipHexFieldUpdate) {
      currentRgb = {
        r: clamp(Math.round(r), 0, 255),
        g: clamp(Math.round(g), 0, 255),
        b: clamp(Math.round(b), 0, 255)
      };

      const hex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);
      const hsl = rgbToHsl(currentRgb.r, currentRgb.g, currentRgb.b);
      const hsv = rgbToHsv(currentRgb.r, currentRgb.g, currentRgb.b);
      const cmyk = rgbToCmyk(currentRgb.r, currentRgb.g, currentRgb.b);

      nativePicker.value = hex;
      if (previewSwatch) previewSwatch.style.backgroundColor = hex;
      if (previewHexLabel) previewHexLabel.textContent = hex;

      if (!skipHexFieldUpdate) {
        hexInput.value = hex;
      }
      rgbInput.value = 'rgb(' + currentRgb.r + ', ' + currentRgb.g + ', ' + currentRgb.b + ')';
      hslInput.value = 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
      hsvInput.value = 'hsv(' + hsv.h + ', ' + hsv.s + '%, ' + hsv.v + '%)';
      cmykInput.value = 'cmyk(' + cmyk.c + '%, ' + cmyk.m + '%, ' + cmyk.y + '%, ' + cmyk.k + '%)';
      if (cssVarInput) {
        cssVarInput.value = '--color-primary: ' + hex + ';';
      }

      rSlider.value = currentRgb.r;
      gSlider.value = currentRgb.g;
      bSlider.value = currentRgb.b;
      rValBadge.textContent = currentRgb.r;
      gValBadge.textContent = currentRgb.g;
      bValBadge.textContent = currentRgb.b;

      renderHarmoniesAndShades(hsl);
      renderContrastChecker(currentRgb, hex);
    }

    // Event Listeners for Picker & Sliders
    nativePicker.addEventListener('input', function () {
      const rgb = hexToRgb(nativePicker.value);
      if (rgb) setColorFromRgb(rgb.r, rgb.g, rgb.b, false);
    });

    hexInput.addEventListener('input', function () {
      const rgb = hexToRgb(hexInput.value);
      if (rgb) setColorFromRgb(rgb.r, rgb.g, rgb.b, true);
    });

    [rSlider, gSlider, bSlider].forEach(function (sl) {
      sl.addEventListener('input', function () {
        setColorFromRgb(Number(rSlider.value), Number(gSlider.value), Number(bSlider.value), false);
      });
    });

    // Copy Format Buttons
    document.querySelectorAll('[data-copy-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetId = btn.getAttribute('data-copy-target');
        const el = document.getElementById(targetId);
        if (el && el.value) {
          window.ToolNest.copyToClipboard(el.value, btn);
        }
      });
    });

    if (btnRandom) {
      btnRandom.addEventListener('click', function () {
        const rr = Math.floor(Math.random() * 256);
        const rg = Math.floor(Math.random() * 256);
        const rb = Math.floor(Math.random() * 256);
        setColorFromRgb(rr, rg, rb, false);
      });
    }

    if (btnSaveColor) {
      btnSaveColor.addEventListener('click', function () {
        const hex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);
        addColorToHistory(hex);
        window.ToolNest.showToast('Saved ' + hex + ' to your palette!', 'success');
      });
    }

    if (btnClearHistory) {
      btnClearHistory.addEventListener('click', function () {
        savedHistory = [];
        renderSavedHistory();
      });
    }

    // Native Browser Screen EyeDropper API (Chrome / Edge)
    if (btnScreenEyedropper) {
      if (typeof window.EyeDropper === 'function') {
        btnScreenEyedropper.addEventListener('click', function () {
          const eyeDropper = new window.EyeDropper();
          eyeDropper
            .open()
            .then(function (result) {
              if (result && result.sRGBHex) {
                const rgb = hexToRgb(result.sRGBHex);
                if (rgb) {
                  setColorFromRgb(rgb.r, rgb.g, rgb.b, false);
                  addColorToHistory(result.sRGBHex);
                  window.ToolNest.copyToClipboard(result.sRGBHex);
                }
              }
            })
            .catch(function () {
              // User cancelled eyedropper
            });
        });
      } else {
        btnScreenEyedropper.addEventListener('click', function () {
          window.ToolNest.showToast('Use the Image Eyedropper canvas below to pick any pixel color!', 'warning');
        });
      }
    }

    // Image Eyedropper & Dominant Palette Extraction
    function renderImageToCanvas(img) {
      loadedImage = img;
      const maxW = 720;
      const maxH = 440;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      const scale = Math.min(1, maxW / w, maxH / h);
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));

      imageCanvas.width = w;
      imageCanvas.height = h;
      const ctx = imageCanvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      imageCanvasWrap.classList.remove('d-none');

      // Extract Dominant Palette
      const dominantHexes = extractDominantColors(imageCanvas, 8);
      if (imagePaletteWrap) {
        imagePaletteWrap.innerHTML = dominantHexes
          .map(function (hex) {
            return renderSwatchPill(hex);
          })
          .join('');
        bindSwatchClicks(imagePaletteWrap);
      }
    }

    function getCanvasPixelColor(e) {
      const rect = imageCanvas.getBoundingClientRect();
      const scaleX = imageCanvas.width / rect.width;
      const scaleY = imageCanvas.height / rect.height;
      const x = clamp(Math.floor((e.clientX - rect.left) * scaleX), 0, imageCanvas.width - 1);
      const y = clamp(Math.floor((e.clientY - rect.top) * scaleY), 0, imageCanvas.height - 1);
      const ctx = imageCanvas.getContext('2d');
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      return {
        x: x,
        y: y,
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
        hex: rgbToHex(pixel[0], pixel[1], pixel[2])
      };
    }

    if (imageCanvas) {
      imageCanvas.addEventListener('mousemove', function (e) {
        if (!loadedImage) return;
        const px = getCanvasPixelColor(e);
        if (loupeWrap) loupeWrap.classList.remove('d-none');
        if (loupeSwatch) loupeSwatch.style.backgroundColor = px.hex;
        if (loupeText) {
          loupeText.textContent = px.hex + ' • RGB(' + px.r + ', ' + px.g + ', ' + px.b + ') at (' + px.x + ', ' + px.y + ')';
        }
      });

      imageCanvas.addEventListener('click', function (e) {
        if (!loadedImage) return;
        const px = getCanvasPixelColor(e);
        setColorFromRgb(px.r, px.g, px.b, false);
        addColorToHistory(px.hex);
        window.ToolNest.copyToClipboard(px.hex);
      });
    }

    if (dropzone && fileInput) {
      window.ToolNest.setupDropzone(dropzone, fileInput, function (files) {
        const file = files[0];
        if (!file || !file.type.startsWith('image/')) {
          window.ToolNest.showToast('Please select a valid image file (JPG, PNG, WebP, SVG).', 'danger');
          return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
          URL.revokeObjectURL(url);
          renderImageToCanvas(img);
          window.ToolNest.showToast('Image loaded! Click anywhere on the image to pick a pixel color.', 'success');
        };
        img.src = url;
      });
    }

    if (btnSampleImg) {
      btnSampleImg.addEventListener('click', function () {
        createSampleArtworkImage().then(function (img) {
          renderImageToCanvas(img);
          window.ToolNest.showToast('Sample artwork loaded! Click any color on the canvas.', 'success');
        });
      });
    }

    // Initialize default color & sample artwork
    setColorFromRgb(currentRgb.r, currentRgb.g, currentRgb.b, false);
    renderSavedHistory();
    createSampleArtworkImage().then(function (img) {
      renderImageToCanvas(img);
    });
  });
})();
