import { env, pipeline, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm';

env.backends.onnx.wasm.numThreads = 1;

let removerPromise;

async function getRemover() {
  if (!removerPromise) {
    removerPromise = pipeline('background-removal', 'Xenova/modnet', {
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
      removerPromise = null;
      throw error;
    });
  }

  return removerPromise;
}

self.addEventListener('message', async function (event) {
  if (!event.data || event.data.type !== 'remove') return;

  try {
    const remover = await getRemover();
    const image = await RawImage.fromBlob(event.data.file);
    const masks = await remover(image);

    if (!masks || masks.length === 0) {
      throw new Error('The model did not return a foreground mask.');
    }

    const maskBlob = await masks[0].toBlob();
    self.postMessage({
      type: 'result',
      mask: maskBlob,
      width: image.width,
      height: image.height
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
