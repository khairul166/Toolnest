document.addEventListener('DOMContentLoaded', function () {
  const output = document.getElementById('pg-output');
  const copyBtn = document.getElementById('pg-copy');
  const generateBtn = document.getElementById('pg-generate');
  const status = document.getElementById('pg-status');
  const lengthInput = document.getElementById('pg-length');
  const lengthValue = document.getElementById('pg-length-value');
  const upper = document.getElementById('pg-upper');
  const lower = document.getElementById('pg-lower');
  const numbers = document.getElementById('pg-numbers');
  const symbols = document.getElementById('pg-symbols');
  const noAmbiguous = document.getElementById('pg-no-ambiguous');
  const strengthBar = document.getElementById('pg-strength-bar');
  const strengthLabel = document.getElementById('pg-strength-label');

  if (!output) return;

  const SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.<>?/'
  };
  const AMBIGUOUS = new Set(['0', 'O', '1', 'l', 'I', '|']);

  function setStatus(msg) {
    if (status) status.textContent = msg;
  }

  function pickSecureRandomInt(max) {
    // Returns a cryptographically random integer in [0, max)
    if (max <= 0) return 0;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const maxSafe = Math.pow(2, 32) - 1;
      const rand = (function () {
        let r = 0;
        do {
          const buf = new Uint32Array(1);
          crypto.getRandomValues(buf);
          r = buf[0];
        } while (r > maxSafe - (maxSafe % max));
        return r;
      })();
      return (rand / maxSafe * max) | 0;
    }
    return Math.floor(Math.random() * max);
  }

  function activeCharSets() {
    let sets = [];
    if (upper.checked) sets.push('upper');
    if (lower.checked) sets.push('lower');
    if (numbers.checked) sets.push('numbers');
    if (symbols.checked) sets.push('symbols');
    if (noAmbiguous.checked) {
      const filter = function (s) {
        return Array.from(s).filter(function (c) { return !AMBIGUOUS.has(c); }).join('');
      };
      sets = sets.map(function (name) { return { name: name, chars: filter(SETS[name]) }; });
    } else {
      sets = sets.map(function (name) { return { name: name, chars: SETS[name] }; });
    }
    return sets.filter(function (s) { return s.chars.length > 0; });
  }

  function generate() {
    const length = parseInt(lengthInput.value, 10);
    let sets = activeCharSets();

    if (sets.length === 0) {
      setStatus('Select at least one character set');
      output.value = '';
      updateStrength(0, length);
      return;
    }

    // Build a pool ensuring at least one char from each active set
    const pool = sets.map(function (s) { return s.chars; }).join('');
    const chars = [];
    // Guarantee one character from each active set
    sets.forEach(function (s) {
      const idx = pickSecureRandomInt(s.chars.length);
      chars.push(s.chars.charAt(idx));
    });
    // Fill remaining length from the full pool
    for (let i = chars.length; i < length; i++) {
      chars.push(pool.charAt(pickSecureRandomInt(pool.length)));
    }
    // Shuffle so the guaranteed characters are not at predictable positions
    for (let i = chars.length - 1; i > 0; i--) {
      const j = pickSecureRandomInt(i + 1);
      const tmp = chars[i];
      chars[i] = chars[j];
      chars[j] = tmp;
    }

    const result = chars.slice(0, length).join('');
    output.value = result;
    updateStrength(sets.length, length, result);
    setStatus('Generated');
    if (copyBtn) copyBtn.classList.remove('bg-success');
  }

  function updateStrength(setCount, length, result) {
    let score = 0;
    score += Math.min(length, 32) / 16;            // length factor
    score += setCount * 1.5;                        // variety factor
    if (result) {
      if (/[A-Z]/.test(result) && /[a-z]/.test(result)) score += 1;
      if (/\d/.test(result)) score += 1;
      if (/[!@#$%^&*(),.?"':;<_>/\\\[\]{}|=+]/.test(result)) score += 1;
    }
    let pct = Math.max(0, Math.min(100, (score / 9) * 100));
    let label, color;
    if (pct < 30) { label = 'Weak'; color = '#dc3545'; }
    else if (pct < 55) { label = 'Fair'; color = '#fd7e14'; }
    else if (pct < 80) { label = 'Good'; color = '#ffc107'; }
    else { label = 'Strong'; color = '#198754'; }

    if (strengthBar) {
      strengthBar.style.width = pct + '%';
      strengthBar.style.background = color;
    }
    if (strengthLabel) {
      strengthLabel.textContent = 'Strength: ' + label;
      strengthLabel.style.color = color;
    }
  }

  lengthInput.addEventListener('input', function () {
    lengthValue.textContent = lengthInput.value;
    generate();
  });
  [upper, lower, numbers, symbols, noAmbiguous].forEach(function (el) {
    el.addEventListener('change', generate);
  });
  generateBtn.addEventListener('click', function () {
    generate();
    setStatus('Regenerated');
  });
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

  generate();
});
