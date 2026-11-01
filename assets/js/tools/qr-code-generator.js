/**
 * ToolNest - Permanent QR Code Generator (/assets/js/tools/qr-code-generator.js)
 * Supports URL, Text, and WiFi QR codes with custom colors, optional center logo,
 * and both PNG and vector SVG export. Powered by qrcode-generator 1.4.4.
 */
(function () {
  'use strict';

  let logoImage = null;
  let logoDataUrl = null;
  let lastSvgMarkup = '';

  function escapeWifiField(str) {
    return String(str || '').replace(/([\\;,:])/g, '\\$1');
  }

  function encodeUtf8ByteString(str) {
    return unescape(encodeURIComponent(str));
  }

  document.addEventListener('DOMContentLoaded', function () {
    const modeRadios = document.querySelectorAll('input[name="tn-qr-mode"]');
    const panelUrl = document.getElementById('tn-qr-panel-url');
    const panelText = document.getElementById('tn-qr-panel-text');
    const panelWifi = document.getElementById('tn-qr-panel-wifi');

    const urlInput = document.getElementById('tn-qr-url');
    const textInput = document.getElementById('tn-qr-text');
    const wifiSsid = document.getElementById('tn-qr-wifi-ssid');
    const wifiPass = document.getElementById('tn-qr-wifi-pass');
    const wifiEnc = document.getElementById('tn-qr-wifi-enc');
    const wifiHidden = document.getElementById('tn-qr-wifi-hidden');

    const fgColorInput = document.getElementById('tn-qr-fg');
    const bgColorInput = document.getElementById('tn-qr-bg');
    const sizeSelect = document.getElementById('tn-qr-size');
    const eccSelect = document.getElementById('tn-qr-ecc');
    const logoFileInput = document.getElementById('tn-qr-logo-input');
    const btnBrandLogo = document.getElementById('tn-qr-brand-logo-btn');
    const btnClearLogo = document.getElementById('tn-qr-clear-logo-btn');

    const qrCanvas = document.getElementById('tn-qr-canvas');
    const btnDownloadPng = document.getElementById('tn-qr-dl-png');
    const btnDownloadSvg = document.getElementById('tn-qr-dl-svg');
    const btnReset = document.getElementById('tn-qr-reset-btn');
    const payloadPreview = document.getElementById('tn-qr-payload-preview');

    if (!qrCanvas) return;

    function getActiveMode() {
      const checked = document.querySelector('input[name="tn-qr-mode"]:checked');
      return checked ? checked.value : 'url';
    }

    function getPayloadString() {
      const mode = getActiveMode();
      if (mode === 'text') {
        return textInput.value.trim() || 'ToolNest Free Online Tools';
      }
      if (mode === 'wifi') {
        const ssid = escapeWifiField(wifiSsid.value.trim() || 'MyHomeWiFi');
        const pass = escapeWifiField(wifiPass.value);
        const enc = wifiEnc.value || 'WPA';
        const hid = wifiHidden && wifiHidden.checked ? 'true' : 'false';
        return 'WIFI:T:' + enc + ';S:' + ssid + ';P:' + pass + ';H:' + hid + ';;';
      }
      return urlInput.value.trim() || 'https://toolnest.com';
    }

    function renderQrCode() {
      if (typeof window.qrcode !== 'function') {
        return;
      }

      const rawPayload = getPayloadString();
      payloadPreview.textContent = rawPayload;

      // Use High ('H') error correction automatically if a center logo is active
      const ecc = logoImage ? 'H' : eccSelect.value || 'M';
      const fg = fgColorInput.value || '#0F172A';
      const bg = bgColorInput.value || '#FFFFFF';
      const targetSize = parseInt(sizeSelect.value, 10) || 400;

      try {
        const qr = window.qrcode(0, ecc);
        qr.addData(encodeUtf8ByteString(rawPayload));
        qr.make();

        const moduleCount = qr.getModuleCount();
        const quietZoneModules = 2;
        const totalModules = moduleCount + quietZoneModules * 2;
        const cellSize = targetSize / totalModules;

        qrCanvas.width = targetSize;
        qrCanvas.height = targetSize;
        const ctx = qrCanvas.getContext('2d');

        // Fill background
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, targetSize, targetSize);

        // Build SVG paths simultaneously
        const svgRects = [];

        ctx.fillStyle = fg;
        for (let r = 0; r < moduleCount; r++) {
          for (let c = 0; c < moduleCount; c++) {
            if (qr.isDark(r, c)) {
              const x = (c + quietZoneModules) * cellSize;
              const y = (r + quietZoneModules) * cellSize;
              ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cellSize), Math.ceil(cellSize));
              svgRects.push(
                '<rect x="' +
                  x.toFixed(2) +
                  '" y="' +
                  y.toFixed(2) +
                  '" width="' +
                  cellSize.toFixed(2) +
                  '" height="' +
                  cellSize.toFixed(2) +
                  '" fill="' +
                  fg +
                  '"/>'
              );
            }
          }
        }

        let svgLogoMarkup = '';
        if (logoImage && logoDataUrl) {
          const logoBoxSize = Math.round(targetSize * 0.21);
          const logoX = Math.round((targetSize - logoBoxSize) / 2);
          const logoY = Math.round((targetSize - logoBoxSize) / 2);
          const pad = 6;

          ctx.fillStyle = bg;
          ctx.fillRect(logoX - pad, logoY - pad, logoBoxSize + pad * 2, logoBoxSize + pad * 2);
          ctx.drawImage(logoImage, logoX, logoY, logoBoxSize, logoBoxSize);

          svgLogoMarkup =
            '<rect x="' +
            (logoX - pad) +
            '" y="' +
            (logoY - pad) +
            '" width="' +
            (logoBoxSize + pad * 2) +
            '" height="' +
            (logoBoxSize + pad * 2) +
            '" rx="6" fill="' +
            bg +
            '"/>' +
            '<image href="' +
            logoDataUrl +
            '" x="' +
            logoX +
            '" y="' +
            logoY +
            '" width="' +
            logoBoxSize +
            '" height="' +
            logoBoxSize +
            '"/>';
        }

        lastSvgMarkup =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
          targetSize +
          ' ' +
          targetSize +
          '" width="' +
          targetSize +
          '" height="' +
          targetSize +
          '">' +
          '<rect width="100%" height="100%" fill="' +
          bg +
          '"/>' +
          svgRects.join('') +
          svgLogoMarkup +
          '</svg>';
      } catch (err) {
        window.ToolNest.showToast('Text is too long for a single QR code.', 'danger');
      }
    }

    modeRadios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        const mode = getActiveMode();
        panelUrl.classList.toggle('d-none', mode !== 'url');
        panelText.classList.toggle('d-none', mode !== 'text');
        panelWifi.classList.toggle('d-none', mode !== 'wifi');
        renderQrCode();
      });
    });

    [urlInput, textInput, wifiSsid, wifiPass, wifiEnc, wifiHidden, fgColorInput, bgColorInput, sizeSelect, eccSelect].forEach(
      function (el) {
        if (el) el.addEventListener('input', renderQrCode);
        if (el) el.addEventListener('change', renderQrCode);
      }
    );

    if (logoFileInput) {
      logoFileInput.addEventListener('change', function () {
        const file = logoFileInput.files && logoFileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
          const dataUrl = e.target.result;
          const img = new Image();
          img.onload = function () {
            logoImage = img;
            logoDataUrl = dataUrl;
            eccSelect.value = 'H';
            renderQrCode();
            window.ToolNest.showToast('Center logo added to QR code!', 'success');
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnBrandLogo) {
      btnBrandLogo.addEventListener('click', function () {
        const img = new Image();
        img.onload = function () {
          const c = document.createElement('canvas');
          c.width = 120;
          c.height = 120;
          const cCtx = c.getContext('2d');
          cCtx.drawImage(img, 0, 0, 120, 120);
          logoDataUrl = c.toDataURL('image/png');
          logoImage = img;
          eccSelect.value = 'H';
          renderQrCode();
          window.ToolNest.showToast('Sample icon added to center of QR code!', 'success');
        };
        img.src = '/assets/img/favicon.svg';
      });
    }

    if (btnClearLogo) {
      btnClearLogo.addEventListener('click', function () {
        logoImage = null;
        logoDataUrl = null;
        if (logoFileInput) logoFileInput.value = '';
        renderQrCode();
      });
    }

    if (btnDownloadPng) {
      btnDownloadPng.addEventListener('click', function () {
        qrCanvas.toBlob(function (blob) {
          if (blob) {
            window.ToolNest.downloadBlob(blob, 'toolnest-qrcode.png');
            window.ToolNest.showToast('QR Code PNG downloaded!', 'success');
          }
        }, 'image/png');
      });
    }

    if (btnDownloadSvg) {
      btnDownloadSvg.addEventListener('click', function () {
        if (!lastSvgMarkup) renderQrCode();
        const blob = new Blob([lastSvgMarkup], { type: 'image/svg+xml;charset=utf-8' });
        window.ToolNest.downloadBlob(blob, 'toolnest-qrcode.svg');
        window.ToolNest.showToast('QR Code Vector SVG downloaded!', 'success');
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', function () {
        urlInput.value = 'https://toolnest.com';
        textInput.value = '';
        wifiSsid.value = '';
        wifiPass.value = '';
        fgColorInput.value = '#0F172A';
        bgColorInput.value = '#FFFFFF';
        logoImage = null;
        logoDataUrl = null;
        if (logoFileInput) logoFileInput.value = '';
        renderQrCode();
      });
    }

    renderQrCode();
  });
})();
