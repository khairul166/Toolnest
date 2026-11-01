document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('tn-bg-file');
  const dropzone = document.getElementById('tn-bg-dropzone');
  const removeButton = document.getElementById('tn-bg-remove');
  const downloadButton = document.getElementById('tn-bg-download');
  const clearButton = document.getElementById('tn-bg-clear');
  const status = document.getElementById('tn-bg-status');
  const progressWrap = document.getElementById('tn-bg-progress-wrap');
  const progressLabel = document.getElementById('tn-bg-progress-label');
  const progressBar = document.getElementById('tn-bg-progress');
  const results = document.getElementById('tn-bg-results');
  const originalPreview = document.getElementById('tn-bg-original-preview');
  const resultCanvas = document.getElementById('tn-bg-result-canvas');

  if (!fileInput || !dropzone || !removeButton || !downloadButton || !clearButton ||
      !status || !progressWrap || !progressLabel || !progressBar || !results ||
      !originalPreview || !resultCanvas) {
    return;
  }

  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const MAX_IMAGE_PIXELS = 16000000;
  let selectedFile = null;
  let originalUrl = null;
  let resultUrl = null;
  let worker = null;
  let processing = false;

  function setStatus(message, type) {
    status.textContent = message;
    status.className = 'small mb-3' + (type === 'danger' ? ' text-danger' : ' text-muted');
  }

  function setBusy(isBusy) {
    processing = isBusy;
    fileInput.disabled = isBusy;
    removeButton.disabled = isBusy || !selectedFile;
    clearButton.disabled = isBusy || !selectedFile;
    downloadButton.disabled = isBusy || !resultUrl;
    dropzone.setAttribute('aria-disabled', String(isBusy));
    progressWrap.classList.toggle('d-none', !isBusy);
  }

  function revokeUrl(url) {
    if (url) URL.revokeObjectURL(url);
  }

  function resetResult() {
    revokeUrl(resultUrl);
    resultUrl = null;
    resultCanvas.width = 0;
    resultCanvas.height = 0;
    downloadButton.disabled = true;
    results.classList.add('d-none');
  }

  function clearSelection() {
    if (processing) return;
    revokeUrl(originalUrl);
    originalUrl = null;
    selectedFile = null;
    fileInput.value = '';
    originalPreview.removeAttribute('src');
    resetResult();
    removeButton.disabled = true;
    clearButton.disabled = true;
    setStatus('Choose a photo to get started.');
  }

  function showProgress(message, percent) {
    progressLabel.textContent = message;
    const boundedPercent = Math.max(0, Math.min(100, Math.round(percent)));
    progressBar.style.width = boundedPercent + '%';
    progressBar.setAttribute('aria-valuenow', String(boundedPercent));
  }

  function getWorker() {
    if (!worker) {
      worker = new Worker(new URL('./background-remover-worker.js', import.meta.url), { type: 'module' });
      worker.addEventListener('message', handleWorkerMessage);
      worker.addEventListener('error', function (event) {
        setBusy(false);
        setStatus('Background removal failed to start. Check your connection and try again. ' + event.message, 'danger');
      });
    }
    return worker;
  }

  async function selectFile(file) {
    if (processing || !file) return;

    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      setStatus('Choose a JPEG, PNG, or WebP image.', 'danger');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatus('This image is larger than 20 MB. Choose a smaller file.', 'danger');
      return;
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
        setStatus('This image is larger than 16 megapixels. Resize it before processing.', 'danger');
        return;
      }

      revokeUrl(originalUrl);
      originalUrl = URL.createObjectURL(file);
      selectedFile = file;
      resetResult();
      originalPreview.src = originalUrl;
      results.classList.remove('d-none');
      removeButton.disabled = false;
      clearButton.disabled = false;
      setStatus('Photo ready. Select Remove Background to create a transparent cutout.');
    } catch (error) {
      setStatus('Could not read this image. Try another JPEG, PNG, or WebP file.', 'danger');
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

    if (message.type === 'result') {
      renderResult(message);
      return;
    }

    if (message.type === 'error') {
      setBusy(false);
      setStatus('Could not remove the background. ' + message.message, 'danger');
    }
  }

  async function renderResult(message) {
    let maskBitmap;
    let imageBitmap;

    try {
      if (!selectedFile || !message.mask || !message.width || !message.height) {
        throw new Error('The image result was incomplete. Please try again.');
      }

      maskBitmap = await createImageBitmap(message.mask);
      imageBitmap = await createImageBitmap(selectedFile);
      resultCanvas.width = message.width;
      resultCanvas.height = message.height;
      const context = resultCanvas.getContext('2d');
      if (!context) throw new Error('Your browser could not create an image preview.');

      context.drawImage(imageBitmap, 0, 0, message.width, message.height);
      context.globalCompositeOperation = 'destination-in';
      context.drawImage(maskBitmap, 0, 0, message.width, message.height);
      context.globalCompositeOperation = 'source-over';

      const resultBlob = await new Promise(function (resolve, reject) {
        resultCanvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('Your browser could not export the transparent PNG.'));
        }, 'image/png');
      });

      revokeUrl(resultUrl);
      resultUrl = URL.createObjectURL(resultBlob);
      downloadButton.disabled = false;
      setStatus('Background removed. Preview the transparent cutout and download your PNG.');
    } catch (error) {
      setStatus('Could not create the transparent PNG. ' + error.message, 'danger');
    } finally {
      if (maskBitmap) maskBitmap.close();
      if (imageBitmap) imageBitmap.close();
      setBusy(false);
    }
  }

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files.length > 0) {
      selectFile(fileInput.files[0]);
    }
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

  removeButton.addEventListener('click', function () {
    if (!selectedFile || processing) return;
    resetResult();
    setBusy(true);
    setStatus('Loading the AI model and removing the background. Your photo stays in this browser.');
    showProgress('Loading AI model. Its first download may take a little while...', 0);
    try {
      getWorker().postMessage({ type: 'remove', file: selectedFile });
    } catch (error) {
      setBusy(false);
      setStatus('Could not start background removal. ' + error.message, 'danger');
    }
  });

  downloadButton.addEventListener('click', function () {
    if (!resultUrl || !selectedFile) return;
    const baseName = selectedFile.name.replace(/\.[^.]+$/, '') || 'image';
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = baseName + '-no-background.png';
    link.click();
  });
  clearButton.addEventListener('click', clearSelection);
  window.addEventListener('pagehide', function () {
    if (worker) worker.terminate();
    revokeUrl(originalUrl);
    revokeUrl(resultUrl);
  });
});
