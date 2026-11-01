document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('mtg-form');
  const output = document.getElementById('mtg-output');
  const status = document.getElementById('mtg-status');
  const copyBtn = document.getElementById('mtg-copy');
  const resetBtn = document.getElementById('mtg-reset');
  const twitterBox = document.getElementById('mtg-twitter');
  const robotsBox = document.getElementById('mtg-robots');
  const typeSelect = document.getElementById('mtg-type');
  const generateBtn = document.getElementById('mtg-generate');

  if (!form || !output) return;

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setStatus(msg) {
    if (status) status.textContent = 'Status: ' + msg;
  }

  function buildTags() {
    const title = val('mtg-page-title');
    const desc = val('mtg-description');
    const keywords = val('mtg-keywords');
    const author = val('mtg-author');
    const website = val('mtg-website') || 'ToolNest';
    const url = val('mtg-url');
    const image = val('mtg-image');
    const ogType = typeSelect ? typeSelect.value : 'website';

    const lines = [];

    if (title) lines.push('<title>' + esc(title) + '</title>');
    if (desc) lines.push('<meta name="description" content="' + esc(desc) + '">');
    if (keywords) lines.push('<meta name="keywords" content="' + esc(keywords) + '">');
    if (author) lines.push('<meta name="author" content="' + esc(author) + '">');
    if (robotsBox && robotsBox.checked) {
      lines.push('<meta name="robots" content="index, follow">');
    }
    if (url) lines.push('<link rel="canonical" href="' + esc(url) + '">');

    // Open Graph
    lines.push('<!-- Open Graph / Facebook / LinkedIn -->');
    lines.push('<meta property="og:site_name" content="' + esc(website) + '">');
    if (title) lines.push('<meta property="og:title" content="' + esc(title) + '">');
    if (desc) lines.push('<meta property="og:description" content="' + esc(desc) + '">');
    if (url) lines.push('<meta property="og:url" content="' + esc(url) + '">');
    lines.push('<meta property="og:type" content="' + esc(ogType) + '">');
    if (image) lines.push('<meta property="og:image" content="' + esc(image) + '">');

    // Twitter
    if (twitterBox && twitterBox.checked) {
      lines.push('<!-- Twitter Card -->');
      lines.push('<meta name="twitter:card" content="' + (image ? 'summary_large_image' : 'summary') + '">');
      if (title) lines.push('<meta name="twitter:title" content="' + esc(title) + '">');
      if (desc) lines.push('<meta name="twitter:description" content="' + esc(desc) + '">');
      if (image) lines.push('<meta name="twitter:image" content="' + esc(image) + '">');
      lines.push('<meta name="twitter:site" content="@' + esc(website.replace(/[^A-Za-z0-9]/g, '')) + '">');
    }

    return lines.join('\n');
  }

  function generate() {
    const code = buildTags();
    output.value = code;
    const ok = val('mtg-page-title') !== '';
    setStatus(ok ? 'Generated' : 'Generated (missing page title)');
    if (copyBtn) copyBtn.classList.remove('bg-success');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    generate();
  });
  [twitterBox, robotsBox, typeSelect].forEach(function (el) {
    if (el) el.addEventListener('change', generate);
  });
  if (generateBtn) generateBtn.addEventListener('click', function () {
    generate();
    setStatus('Generated');
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (!output.value) {
        setStatus('Nothing to copy');
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(output.value).then(function () {
          setStatus('Copied');
          copyBtn.classList.add('bg-success');
          setTimeout(function () {
            copyBtn.classList.remove('bg-success');
            setStatus('Ready');
          }, 1500);
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
      form.reset();
      document.getElementById('mtg-website').value = 'ToolNest';
      twitterBox.checked = true;
      output.value = '';
      setStatus('Ready');
    });
  }

  generate();
});
