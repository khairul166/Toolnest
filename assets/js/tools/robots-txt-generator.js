document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('rtg-form');
  const output = document.getElementById('rtg-output');
  const status = document.getElementById('rtg-status');
  const copyBtn = document.getElementById('rtg-copy');
  const resetBtn = document.getElementById('rtg-reset');
  const presets = document.getElementById('rtg-presets');

  if (!form || !output) return;

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function generate() {
    const ua = val('rtg-user-agent');
    const disallow = val('rtg-disallow').split('\n').filter(l => l.trim()).map(l => l.trim());
    const allow = val('rtg-allow').split('\n').filter(l => l.trim()).map(l => l.trim());
    const crawlDelay = val('rtg-crawl-delay');
    const sitemap = val('rtg-sitemap');

    const lines = [];

    // User-Agent line
    lines.push('User-agent: ' + ua);

    // Disallow lines
    if (disallow.length > 0) {
      disallow.forEach(function (path) {
        lines.push('Disallow: ' + path);
      });
    } else {
      lines.push('Disallow:');
    }

    // Allow lines
    if (allow.length > 0) {
      allow.forEach(function (path) {
        lines.push('Allow: ' + path);
      });
    }

    // Crawl-Delay line
    if (crawlDelay !== '') {
      lines.push('Crawl-delay: ' + crawlDelay);
    }

    // Sitemap line
    if (sitemap !== '') {
      lines.push('Sitemap: ' + sitemap);
    }

    output.value = lines.join('\n');
    setStatus('Generated');
  }

  function setStatus(msg) {
    if (status) status.textContent = 'Status: ' + msg;
  }

  // Preset handlers
  presets.addEventListener('click', function (e) {
    if (e.target.classList.contains('preset-btn')) {
      // Remove active from all
      presets.querySelectorAll('.preset-btn').forEach(function (b) { b.classList.remove('active'); });
      // Add active to clicked
      e.target.classList.add('active');

      const preset = e.target.dataset.preset;

      // Set form values based on preset
      document.getElementById('rtg-user-agent').value = '*';

      if (preset === 'basic') {
        document.getElementById('rtg-disallow').value = '/';
        document.getElementById('rtg-allow').value = '';
        document.getElementById('rtg-crawl-delay').value = '';
        document.getElementById('rtg-sitemap').value = '';
      } else if (preset === 'images') {
        document.getElementById('rtg-disallow').value = '/admin /private';
        document.getElementById('rtg-allow').value = '/images /css /js';
        document.getElementById('rtg-crawl-delay').value = '';
        document.getElementById('rtg-sitemap').value = '';
      } else if (preset === 'wp') {
        document.getElementById('rtg-disallow').value = '/wp-admin /wp-includes';
        document.getElementById('rtg-allow').value = '/wp-content /uploads /images /css /js';
        document.getElementById('rtg-crawl-delay').value = '';
        document.getElementById('rtg-sitemap').value = '';
      } else if (preset === 'seo') {
        document.getElementById('rtg-disallow').value = '/private /tmp /admin';
        document.getElementById('rtg-allow').value = '/images /css /js /wp-content';
        document.getElementById('rtg-crawl-delay').value = '';
        document.getElementById('rtg-sitemap').value = '';
      }

      generate();
    }
  });

  // Form submit
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    generate();
  });

  // Copy button
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
        });
      } else {
        output.select();
        document.execCommand('copy');
        setStatus('Copied');
      }
    });
  }

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      form.reset();
      document.getElementById('rtg-sitemap').value = '';
      generate();
      setStatus('Ready');
    });
  }

  // Initial generate
  generate();
});