document.addEventListener('DOMContentLoaded', function () {
  const input = document.getElementById('jf-input');
  const output = document.getElementById('jf-output');
  const formatBtn = document.getElementById('jf-format');
  const minifyBtn = document.getElementById('jf-minify-btn');
  const copyBtn = document.getElementById('jf-copy');
  const resetBtn = document.getElementById('jf-reset');
  const status = document.getElementById('jf-status');

  if (!input || !output) return;

  function setStatus(msg) {
    if (status) status.textContent = msg;
  }

  function transform(pretty) {
    const raw = input.value.trim();
    if (!raw) {
      setStatus('Please enter JSON');
      output.value = '';
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      output.value = pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
      setStatus(pretty ? 'Formatted' : 'Minified');
    } catch (err) {
      output.value = '';
      setStatus('Invalid JSON: ' + err.message);
    }
  }

  if (formatBtn) formatBtn.addEventListener('click', function () { transform(true); });
  if (minifyBtn) minifyBtn.addEventListener('click', function () { transform(false); });

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (!output.value) {
        setStatus('Nothing to copy');
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(output.value).then(function () {
          setStatus('Copied');
          setTimeout(function () { setStatus('Ready'); }, 1500);
        }).catch(function () {
          output.select();
          document.execCommand('copy');
          setStatus('Copied');
        });
      } else {
        output.select();
        document.execCommand('copy');
        setStatus('Copied');
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      input.value = '';
      output.value = '';
      setStatus('Ready');
    });
  }
});