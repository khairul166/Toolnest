import { env, pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

let captionerPromise = null;

async function getCaptioner() {
  if (!captionerPromise) {
    captionerPromise = pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
      quantized: true,
      progress_callback: function (progress) {
        self.postMessage({
          type: 'progress',
          status: progress.status,
          progress: progress.progress,
          file: progress.file
        });
      }
    }).catch(function (error) {
      captionerPromise = null;
      throw error;
    });
  }
  return captionerPromise;
}

self.addEventListener('message', async function (event) {
  if (!event.data || event.data.type !== 'caption') return;

  try {
    const captioner = await getCaptioner();
    self.postMessage({ type: 'stage', message: 'Analyzing image content with AI vision model...' });

    const output = await captioner(event.data.dataUrl, {
      max_new_tokens: 40
    });

    const rawCaption = Array.isArray(output) && output[0] && output[0].generated_text
      ? String(output[0].generated_text).trim()
      : '';

    if (!rawCaption) {
      throw new Error('The AI vision model did not return a caption.');
    }

    self.postMessage({
      type: 'result',
      caption: rawCaption
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
