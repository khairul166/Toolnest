/**
 * ToolNest - Text Tools & Word Counter (/assets/js/tools/text-tools.js)
 * Live word/character/line/reading-time counter, case converter,
 * duplicate line remover, and alphabetical line sorter.
 */
(function () {
  'use strict';

  let historyStack = [];

  function toTitleCase(str) {
    const minorWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet']);
    return str.replace(/\w\S*/g, function (word, index) {
      const lower = word.toLowerCase();
      if (index > 0 && minorWords.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    });
  }

  function toSentenceCase(str) {
    return str
      .toLowerCase()
      .replace(/(^\s*|[.!?।]\s+)([a-z])/g, function (match, sep, char) {
        return sep + char.toUpperCase();
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const textarea = document.getElementById('tn-text-input');
    const statWords = document.getElementById('tn-stat-words');
    const statChars = document.getElementById('tn-stat-chars');
    const statCharsNoSpace = document.getElementById('tn-stat-chars-nospace');
    const statLines = document.getElementById('tn-stat-lines');
    const statSentences = document.getElementById('tn-stat-sentences');
    const statReadTime = document.getElementById('tn-stat-readtime');
    const feedbackBanner = document.getElementById('tn-text-feedback');

    const btnCopy = document.getElementById('tn-text-copy-btn');
    const btnDownload = document.getElementById('tn-text-download-btn');
    const btnUndo = document.getElementById('tn-text-undo-btn');
    const btnSample = document.getElementById('tn-text-sample-btn');
    const btnClear = document.getElementById('tn-text-clear-btn');

    if (!textarea) return;

    function pushHistory() {
      historyStack.push(textarea.value);
      if (historyStack.length > 20) historyStack.shift();
      if (btnUndo) btnUndo.disabled = false;
    }

    function updateStats() {
      const val = textarea.value;
      const trimmed = val.trim();
      const words = trimmed ? trimmed.split(/\s+/).length : 0;
      const chars = val.length;
      const charsNoSpace = val.replace(/\s+/g, '').length;
      const lines = val ? val.split(/\r\n|\r|\n/).length : 0;
      const sentences = trimmed
        ? trimmed.split(/[.!?।]+/).filter(function (s) {
            return s.trim().length > 0;
          }).length
        : 0;
      const readMinutes = Math.max(words > 0 ? 1 : 0, Math.ceil(words / 200));

      if (statWords) statWords.textContent = words.toLocaleString();
      if (statChars) statChars.textContent = chars.toLocaleString();
      if (statCharsNoSpace) statCharsNoSpace.textContent = charsNoSpace.toLocaleString();
      if (statLines) statLines.textContent = lines.toLocaleString();
      if (statSentences) statSentences.textContent = sentences.toLocaleString();
      if (statReadTime) statReadTime.textContent = words === 0 ? '0 sec' : readMinutes + ' min';
    }

    function showActionFeedback(msg) {
      if (feedbackBanner) {
        feedbackBanner.textContent = msg;
        feedbackBanner.classList.remove('d-none');
      }
      window.ToolNest.showToast(msg, 'success');
    }

    textarea.addEventListener('input', updateStats);

    document.querySelectorAll('[data-tn-text-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const action = btn.getAttribute('data-tn-text-action');
        const current = textarea.value;
        if (!current.trim()) {
          window.ToolNest.showToast('Please enter or load some text first.', 'warning');
          return;
        }

        pushHistory();

        if (action === 'upper') {
          textarea.value = current.toUpperCase();
          showActionFeedback('Converted all text to UPPERCASE.');
        } else if (action === 'lower') {
          textarea.value = current.toLowerCase();
          showActionFeedback('Converted all text to lowercase.');
        } else if (action === 'title') {
          textarea.value = toTitleCase(current);
          showActionFeedback('Converted text to Title Case.');
        } else if (action === 'sentence') {
          textarea.value = toSentenceCase(current);
          showActionFeedback('Converted text to Sentence case.');
        } else if (action === 'dedupe') {
          const lines = current.split(/\r\n|\r|\n/);
          const seen = new Set();
          const unique = [];
          let removed = 0;
          lines.forEach(function (line) {
            const key = line.trim();
            if (!seen.has(key)) {
              seen.add(key);
              unique.push(line);
            } else {
              removed++;
            }
          });
          textarea.value = unique.join('\n');
          showActionFeedback('Removed ' + removed + ' duplicate line(s).');
        } else if (action === 'sort-asc') {
          const linesAsc = current.split(/\r\n|\r|\n/);
          linesAsc.sort(function (a, b) {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
          });
          textarea.value = linesAsc.join('\n');
          showActionFeedback('Sorted ' + linesAsc.length + ' lines alphabetically (A → Z).');
        } else if (action === 'sort-desc') {
          const linesDesc = current.split(/\r\n|\r|\n/);
          linesDesc.sort(function (a, b) {
            return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
          });
          textarea.value = linesDesc.join('\n');
          showActionFeedback('Sorted ' + linesDesc.length + ' lines in reverse order (Z → A).');
        } else if (action === 'remove-empty') {
          const nonEmpty = current.split(/\r\n|\r|\n/).filter(function (l) {
            return l.trim().length > 0;
          });
          textarea.value = nonEmpty.join('\n');
          showActionFeedback('Removed all blank/empty lines.');
        } else if (action === 'clean-spaces') {
          textarea.value = current
            .split(/\r\n|\r|\n/)
            .map(function (l) {
              return l.replace(/[ \t]+/g, ' ').trim();
            })
            .join('\n');
          showActionFeedback('Trimmed lines and removed extra spaces.');
        } else if (action === 'number-lines') {
          textarea.value = current
            .split(/\r\n|\r|\n/)
            .map(function (l, i) {
              return i + 1 + '. ' + l;
            })
            .join('\n');
          showActionFeedback('Added line numbers to every line.');
        }

        updateStats();
      });
    });

    if (btnUndo) {
      btnUndo.addEventListener('click', function () {
        if (historyStack.length > 0) {
          textarea.value = historyStack.pop();
          btnUndo.disabled = historyStack.length === 0;
          updateStats();
          window.ToolNest.showToast('Undid last transformation.', 'success');
        }
      });
    }

    if (btnSample) {
      btnSample.addEventListener('click', function () {
        pushHistory();
        textarea.value =
          'Dhaka Express Delivery\nChittagong Port Logistics\nSylhet Tea Gardens\nDhaka Express Delivery\nRajshahi Silk House\nKhulna Sundarbans Tour\nSylhet Tea Gardens';
        updateStats();
        showActionFeedback('Loaded sample multi-line list with duplicate entries.');
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', function () {
        pushHistory();
        textarea.value = '';
        if (feedbackBanner) feedbackBanner.classList.add('d-none');
        updateStats();
        textarea.focus();
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', function () {
        window.ToolNest.copyToClipboard(textarea.value, btnCopy);
      });
    }

    if (btnDownload) {
      btnDownload.addEventListener('click', function () {
        if (!textarea.value) {
          window.ToolNest.showToast('Nothing to download yet.', 'warning');
          return;
        }
        const blob = new Blob([textarea.value], { type: 'text/plain;charset=utf-8' });
        window.ToolNest.downloadBlob(blob, 'toolnest-cleaned-text.txt');
        window.ToolNest.showToast('Downloaded .txt file!', 'success');
      });
    }

    updateStats();
  });
})();
