import { env, pipeline, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm';

env.backends.onnx.wasm.numThreads = 1;

let upscalerPromise;

async function getUpscaler() {
  if (!upscalerPromise) {
    upscalerPromise = pipeline('image-to-image', 'Xenova/swin2SR-classical-sr-x2-64', {
      dtype: 'q8',
      progress_callback: function (progress) {
        self.postMessage({
          type: 'progress',
          status: progress.status,
          progress: progress.progress,
          file: progress.file
        });
      }
    }).catch(function (error) {
      upscalerPromise = null;
      throw error;
    });
  }

  return upscalerPromise;
}

self.addEventListener('message', async function (event) {
  if (!event.data || event.data.type !== 'upscale') return;

  try {
    const model = await getUpscaler();
    self.postMessage({ type: 'stage', message: 'Preparing image...' });
    const image = await RawImage.fromBlob(event.data.file);
    self.postMessage({ type: 'stage', message: 'Running AI upscaling...' });
    const output = await model(image);

    if (!output || !output.data || !output.width || !output.height) {
      throw new Error('The model did not return an upscaled image.');
    }

    self.postMessage({ type: 'stage', message: 'Preparing enlarged preview...' });
    const pixels = output.data.slice();
    self.postMessage({
      type: 'result',
      pixels: pixels.buffer,
      width: output.width,
      height: output.height,
      channels: output.channels
    }, [pixels.buffer]);
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
