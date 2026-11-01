/**
 * ToolNest - Signature Maker
 * Draw and export handwritten signatures locally as PNG.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var canvas = document.getElementById('tn-signature-canvas');
    var ctx = canvas.getContext('2d');
    var color = document.getElementById('tn-signature-color');
    var width = document.getElementById('tn-signature-width');
    var widthValue = document.getElementById('tn-signature-width-value');
    var transparent = document.getElementById('tn-signature-transparent');
    var drawing = false;
    var hasInk = false;
    var history = [];

    function saveState() {
      history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (history.length > 30) history.shift();
    }

    function clearCanvas() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!transparent.checked) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      hasInk = false;
    }

    function point(event) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height
      };
    }

    canvas.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      saveState();
      drawing = true;
      canvas.setPointerCapture(event.pointerId);
      var p = point(event);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
      hasInk = true;
    });
    canvas.addEventListener('pointermove', function (event) {
      if (!drawing) return;
      event.preventDefault();
      var p = point(event);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (name) {
      canvas.addEventListener(name, function () { drawing = false; ctx.closePath(); });
    });

    function configure() {
      ctx.strokeStyle = color.value;
      ctx.lineWidth = Number(width.value);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      widthValue.textContent = width.value + ' px';
    }
    color.addEventListener('input', configure);
    width.addEventListener('input', configure);
    transparent.addEventListener('change', function () {
      var image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      clearCanvas();
      ctx.putImageData(image, 0, 0);
    });

    document.getElementById('tn-signature-undo').addEventListener('click', function () {
      if (history.length) ctx.putImageData(history.pop(), 0, 0);
    });
    document.getElementById('tn-signature-clear').addEventListener('click', function () {
      saveState();
      clearCanvas();
    });
    function canDownload() {
      if (!hasInk) {
        window.ToolNest.showToast('Draw a signature before downloading.', 'warning');
        return false;
      }
      return true;
    }

    document.getElementById('tn-signature-download').addEventListener('click', function () {
      if (!canDownload()) return;
      canvas.toBlob(function (blob) {
        window.ToolNest.downloadBlob(blob, 'toolnest-signature.png');
      }, 'image/png');
    });

    document.getElementById('tn-signature-download-jpg').addEventListener('click', function () {
      if (!canDownload()) return;
      var jpgCanvas = document.createElement('canvas');
      jpgCanvas.width = canvas.width;
      jpgCanvas.height = canvas.height;
      var jpgContext = jpgCanvas.getContext('2d');
      jpgContext.fillStyle = '#ffffff';
      jpgContext.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
      jpgContext.drawImage(canvas, 0, 0);
      jpgCanvas.toBlob(function (blob) {
        window.ToolNest.downloadBlob(blob, 'toolnest-signature.jpg');
      }, 'image/jpeg', 0.95);
    });
    document.getElementById('tn-signature-sample').addEventListener('click', function () {
      saveState();
      clearCanvas();
      ctx.save();
      ctx.font = 'italic 88px cursive';
      ctx.fillStyle = color.value;
      ctx.fillText('Your Name', 130, 210);
      ctx.restore();
      hasInk = true;
    });

    configure();
    clearCanvas();
  });
})();
