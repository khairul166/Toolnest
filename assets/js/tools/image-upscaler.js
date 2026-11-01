document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('tn-upscale-file');
  const dropzone = document.getElementById('tn-upscale-dropzone');
  const runButton = document.getElementById('tn-upscale-run');
  const downloadButton = document.getElementById('tn-upscale-download');
  const clearButton = document.getElementById('tn-upscale-clear');
  const status = document.getElementById('tn-upscale-status');
  const progressWrap = document.getElementById('tn-upscale-progress-wrap');
  const progressLabel = document.getElementById('tn-upscale-progress-label');
  const progressBar = document.getElementById('tn-upscale-progress');
  const results = document.getElementById('tn-upscale-results');
  const originalPreview = document.getElementById('tn-upscale-original-preview');
  const originalDimensions = document.getElementById('tn-upscale-original-dimensions');
  const resultDimensions = document.getElementById('tn-upscale-result-dimensions');
  const resultCanvas = document.getElementById('tn-upscale-result-canvas');

  if (!fileInput || !dropzone || !runButton || !downloadButton || !clearButton ||
      !status || !progressWrap || !progressLabel || !progressBar || !results ||
      !originalPreview || !originalDimensions || !resultDimensions || !resultCanvas) {
    return;
  }

  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const MAX_IMAGE_PIXELS = 2000000;
  let selectedFile = null;
  let originalUrl = null;
  let resultUrl = null;
  let worker = null;
  let processing = false;

  function setStatus(message, isError) {
    status.textContent = message;
    status.className = 'small mb-3' + (isError ? ' text-danger' : ' text-muted');
  }

  function setBusy(isBusy) {
    processing = isBusy;
    fileInput.disabled = isBusy;
    runButton.disabled = isBusy || !selectedFile;
    clearButton.disabled = isBusy || !selectedFile;
    downloadButton.disabled = isBusy || !resultUrl;
    dropzone.setAttribute('aria-disabled', String(isBusy));
    progressWrap.classList.toggle('d-none', !isBusy);
  }

  function revokeUrl(url) {
    if (url) URL.revokeObjectURL(url);
  }

  function clearResult() {
    revokeUrl(resultUrl);
    resultUrl = null;
    resultCanvas.width = 0;
    resultCanvas.height = 0;
    resultDimensions.textContent = '';
    downloadButton.disabled = true;
  }

  function clearSelection() {
    if (processing) return;
    revokeUrl(originalUrl);
    originalUrl = null;
    selectedFile = null;
    fileInput.value = '';
    originalPreview.removeAttribute('src');
    originalDimensions.textContent = '';
    clearResult();
    results.classList.add('d-none');
    runButton.disabled = true;
    clearButton.disabled = true;
    setStatus('Choose an image to get started.');
  }

  function showProgress(message, percent) {
    progressLabel.textContent = message;
    const boundedPercent = Math.max(0, Math.min(100, Math.round(percent)));
    progressBar.style.width = boundedPercent + '%';
    progressBar.setAttribute('aria-valuenow', String(boundedPercent));
  }

  function getWorker() {
    if (!worker) {
      worker = new Worker(new URL('./image-upscaler-worker.js', import.meta.url), { type: 'module' });
      worker.addEventListener('message', handleWorkerMessage);
      worker.addEventListener('error', function (event) {
        setBusy(false);
        setStatus('Image upscaling failed to start. Check your connection and try again. ' + event.message, true);
      });
    }
    return worker;
  }

  async function selectFile(file) {
    if (processing || !file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setStatus('Choose a JPEG, PNG, or WebP image.', true);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatus('This image is larger than 15 MB. Choose a smaller file.', true);
      return;
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
        setStatus('This image is larger than 2 megapixels. Resize it before upscaling.', true);
        return;
      }

      revokeUrl(originalUrl);
      originalUrl = URL.createObjectURL(file);
      selectedFile = file;
      clearResult();
      originalPreview.src = originalUrl;
      originalDimensions.textContent = bitmap.width + ' × ' + bitmap.height + ' pixels';
      results.classList.remove('d-none');
      runButton.disabled = false;
      clearButton.disabled = false;
      setStatus('Image ready. Select Upscale Image 2x to create a larger version.');
    } catch (error) {
      setStatus('Could not read this image. Try another JPEG, PNG, or WebP file.', true);
    } finally {
      if (bitmap) bitmap.close();
    }
  }

  function handleWorkerMessage(event) {
    const message = event.data || {};
    if (message.type === 'progress') {
      if (message.status === 'progress' && Number.isFinite(message.progress)) {
        const fileName = message.file ? ' (' + message.file.split('/').pop() + ')' : '';
        showProgress('Downloading AI model' + fileName + '...', message.progress);
      } else if (message.status === 'done') {
        showProgress('AI model file ready.', 100);
      } else {
        showProgress('Loading AI model. Its first download may take a little while...', 0);
      }
      return;
    }

    if (message.type === 'stage') {
      showProgress(message.message, 100);
      return;
    }

    if (message.type === 'result') {
      renderResult(message);
      return;
    }

    if (message.type === 'error') {
      setBusy(false);
      setStatus('Could not upscale this image. ' + message.message, true);
    }
  }

  async function renderResult(message) {
    try {
      if (!message.pixels || !message.width || !message.height ||
          message.width * message.height > MAX_IMAGE_PIXELS * 4) {
        throw new Error('The upscaled image was incomplete or too large to display.');
      }

      const pixels = new Uint8Array(message.pixels);
      const imageData = new ImageData(message.width, message.height);
      if (message.channels === 4 && pixels.length === imageData.data.length) {
        imageData.data.set(pixels);
      } else if (message.channels === 3 && pixels.length === message.width * message.height * 3) {
        for (let source = 0, target = 0; source < pixels.length; source += 3, target += 4) {
          imageData.data[target] = pixels[source];
          imageData.data[target + 1] = pixels[source + 1];
          imageData.data[target + 2] = pixels[source + 2];
          imageData.data[target + 3] = 255;
        }
      } else {
        throw new Error('The model returned an unsupported image format.');
      }

      resultCanvas.width = message.width;
      resultCanvas.height = message.height;
      const context = resultCanvas.getContext('2d');
      if (!context) throw new Error('Your browser could not create an image preview.');
      context.putImageData(imageData, 0, 0);

      const resultBlob = await new Promise(function (resolve, reject) {
        resultCanvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('Your browser could not export the upscaled PNG.'));
        }, 'image/png');
      });

      revokeUrl(resultUrl);
      resultUrl = URL.createObjectURL(resultBlob);
      resultDimensions.textContent = message.width + ' × ' + message.height + ' pixels';
      downloadButton.disabled = false;
      setStatus('Upscaling complete. Download your enlarged PNG.');
    } catch (error) {
      setStatus('Could not display the upscaled image. ' + error.message, true);
    } finally {
      setBusy(false);
    }
  }

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files.length > 0) selectFile(fileInput.files[0]);
    fileInput.value = '';
  });
  dropzone.addEventListener('click', function (event) {
    if (!processing && !event.target.closest('label')) fileInput.click();
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

  runButton.addEventListener('click', function () {
    if (!selectedFile || processing) return;
    clearResult();
    setBusy(true);
    setStatus('Loading the AI model and upscaling your image in this browser.');
    showProgress('Loading AI model. Its first download may take a little while...', 0);
    try {
      getWorker().postMessage({ type: 'upscale', file: selectedFile });
    } catch (error) {
      setBusy(false);
      setStatus('Could not start image upscaling. ' + error.message, true);
    }
  });
  downloadButton.addEventListener('click', function () {
    if (!resultUrl || !selectedFile) return;
    const baseName = selectedFile.name.replace(/\.[^.]+$/, '') || 'image';
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = baseName + '-upscaled-2x.png';
    link.click();
  });
  clearButton.addEventListener('click', clearSelection);
  window.addEventListener('pagehide', function () {
    if (worker) worker.terminate();
    revokeUrl(originalUrl);
    revokeUrl(resultUrl);
  });
});
