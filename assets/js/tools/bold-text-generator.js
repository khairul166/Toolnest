/**
 * ToolNest - Advanced Bold & Fancy Text Generator (/assets/js/tools/bold-text-generator.js)
 * 100% Client-Side Unicode Text Transformer with 35+ LingoJam-style options.
 */
(function () {
  'use strict';

  function mapChars(str, upperBase, lowerBase, numBase) {
    return Array.from(str).map(function (ch) {
      const code = ch.codePointAt(0);
      if (upperBase !== null && code >= 0x41 && code <= 0x5A) {
        return String.fromCodePoint(upperBase + (code - 0x41));
      }
      if (lowerBase !== null && code >= 0x61 && code <= 0x7A) {
        return String.fromCodePoint(lowerBase + (code - 0x61));
      }
      if (numBase !== null && code >= 0x30 && code <= 0x39) {
        return String.fromCodePoint(numBase + (code - 0x30));
      }
      return ch;
    }).join('');
  }

  function mapDict(str, dict) {
    return Array.from(str).map(function (ch) {
      return Object.prototype.hasOwnProperty.call(dict, ch) ? dict[ch] : ch;
    }).join('');
  }

  // 1. Bold (Serif)
  function toBoldSerif(s) { return mapChars(s, 0x1D400, 0x1D41A, 0x1D7CE); }
  // 2. Bold (Sans-Serif)
  function toBoldSans(s) { return mapChars(s, 0x1D5D4, 0x1D5EE, 0x1D7EC); }
  // 3. Bold Italic (Serif)
  function toBoldItalicSerif(s) { return mapChars(s, 0x1D468, 0x1D482, 0x1D7CE); }
  // 4. Bold Italic (Sans-Serif)
  function toBoldItalicSans(s) { return mapChars(s, 0x1D63C, 0x1D656, 0x1D7EC); }
  // 5. Bold Script / Cursive
  function toBoldScript(s) { return mapChars(s, 0x1D4D0, 0x1D4EA, 0x1D7CE); }
  // 6. Bold Fraktur / Gothic
  function toBoldFraktur(s) { return mapChars(s, 0x1D56C, 0x1D586, null); }
  // 7. Double-Struck / Blackboard Bold
  const DOUBLE_STRUCK_EXCEPTIONS = {
    'C': 'ℂ', 'H': 'ℍ', 'N': 'ℕ', 'P': 'ℙ', 'Q': 'ℚ', 'R': 'ℝ', 'Z': 'ℤ', 'γ': 'ℽ', 'Γ': 'ℾ', 'Π': 'ℿ', 'π': '⅀'
  };
  function toDoubleStruck(s) {
    return Array.from(s).map(function (ch) {
      if (DOUBLE_STRUCK_EXCEPTIONS[ch]) return DOUBLE_STRUCK_EXCEPTIONS[ch];
      const code = ch.codePointAt(0);
      if (code >= 0x41 && code <= 0x5A) return String.fromCodePoint(0x1D538 + (code - 0x41));
      if (code >= 0x61 && code <= 0x7A) return String.fromCodePoint(0x1D552 + (code - 0x61));
      if (code >= 0x30 && code <= 0x39) return String.fromCodePoint(0x1D7D8 + (code - 0x30));
      return ch;
    }).join('');
  }
  // 8. Monospace
  function toMonospace(s) { return mapChars(s, 0x1D670, 0x1D68A, 0x1D7F6); }
  // 9. Fullwidth / Vaporwave
  function toFullwidth(s) {
    return Array.from(s).map(function (ch) {
      const code = ch.codePointAt(0);
      if (ch === ' ') return '　';
      if (code >= 0x21 && code <= 0x7E) return String.fromCodePoint(0xFEE0 + code);
      return ch;
    }).join('');
  }
  // 10. Circled / Bubble
  function toCircled(s) {
    return Array.from(s).map(function (ch) {
      const code = ch.codePointAt(0);
      if (code >= 0x41 && code <= 0x5A) return String.fromCodePoint(0x24B6 + (code - 0x41));
      if (code >= 0x61 && code <= 0x7A) return String.fromCodePoint(0x24D0 + (code - 0x61));
      if (code >= 0x31 && code <= 0x39) return String.fromCodePoint(0x2460 + (code - 0x31));
      if (code === 0x30) return '⓪';
      return ch;
    }).join('');
  }
  // 11. Inverted Circled / Dark Bubble
  function toInvertedCircled(s) {
    return Array.from(s).map(function (ch) {
      const code = ch.codePointAt(0);
      const upper = ch.toUpperCase();
      const uCode = upper.codePointAt(0);
      if (uCode >= 0x41 && uCode <= 0x5A) return String.fromCodePoint(0x1F150 + (uCode - 0x41));
      if (code >= 0x31 && code <= 0x39) return String.fromCodePoint(0x2776 + (code - 0x31));
      if (code === 0x30) return '⓿';
      return ch;
    }).join('');
  }
  // 12. Squared / Boxed
  function toSquared(s) {
    return Array.from(s).map(function (ch) {
      const uCode = ch.toUpperCase().codePointAt(0);
      if (uCode >= 0x41 && uCode <= 0x5A) return String.fromCodePoint(0x1F130 + (uCode - 0x41));
      return ch;
    }).join('');
  }
  // 13. Inverted Squared / Black Square
  function toInvertedSquared(s) {
    return Array.from(s).map(function (ch) {
      const uCode = ch.toUpperCase().codePointAt(0);
      if (uCode >= 0x41 && uCode <= 0x5A) return String.fromCodePoint(0x1F170 + (uCode - 0x41));
      return ch;
    }).join('');
  }
  // 14. Regional Indicator (Blue Bold Blocks)
  function toRegionalIndicator(s) {
    return Array.from(s).map(function (ch) {
      const uCode = ch.toUpperCase().codePointAt(0);
      if (uCode >= 0x41 && uCode <= 0x5A) return String.fromCodePoint(0x1F1E6 + (uCode - 0x41));
      return ch;
    }).join(' ');
  }
  // 15. Small Caps
  const SMALL_CAPS_MAP = {
    'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ',
    'l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'ꜱ','t':'ᴛ','u':'ᴜ','v':'ᴠ',
    'w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ'
  };
  function toSmallCaps(s) { return mapDict(s.toLowerCase(), SMALL_CAPS_MAP); }
  // 16. Upside Down / Inverted
  const FLIP_MAP = {
    'a':'ɐ','b':'q','c':'ɔ','d':'p','e':'ǝ','f':'ɟ','g':'ƃ','h':'ɥ','i':'ᴉ','j':'ɾ','k':'ʞ',
    'l':'l','m':'ɯ','n':'u','o':'o','p':'d','q':'b','r':'ɹ','s':'s','t':'ʇ','u':'n','v':'ʌ',
    'w':'ʍ','x':'x','y':'ʎ','z':'z','A':'∀','B':'𐐒','C':'Ɔ','D':'ᗡ','E':'Ǝ','F':'Ⅎ','G':'⅁',
    'H':'H','I':'I','J':'ſ','K':'ʞ','L':'˥','M':'W','N':'N','O':'O','P':'Ԁ','Q':'Ò','R':'ᴚ',
    'S':'S','T':'⊥','U':'∩','V':'Λ','W':'M','X':'X','Y':'⅄','Z':'Z','0':'0','1':'Ɩ','2':'ᄅ',
    '3':'Ɛ','4':'ㄣ','5':'ϛ','6':'9','7':'ㄥ','8':'8','9':'6','.':'˙',',':'\'','?':'¿','!':'¡',
    '\'':',','"':'„','(':')',')':'(','[':']',']':'[','{':'}','}':'{','<':'>','>':'<','_':'‾'
  };
  function toUpsideDown(s) {
    return Array.from(s).reverse().map(function (ch) {
      return FLIP_MAP[ch] || ch;
    }).join('');
  }
  // 17. Strikethrough
  function toStrikethrough(s) { return Array.from(s).map(function (c) { return c + '\u0336'; }).join(''); }
  // 18. Tilde Strikethrough
  function toTildeStrike(s) { return Array.from(s).map(function (c) { return c + '\u0334'; }).join(''); }
  // 19. Underline (Single)
  function toUnderline(s) { return Array.from(s).map(function (c) { return c + '\u0332'; }).join(''); }
  // 20. Double Underline
  function toDoubleUnderline(s) { return Array.from(s).map(function (c) { return c + '\u0333'; }).join(''); }
  // 21. Slash Through
  function toSlashThrough(s) { return Array.from(s).map(function (c) { return c + '\u0337'; }).join(''); }
  // 22. Cross Above and Below
  function toCrossAboveBelow(s) { return Array.from(s).map(function (c) { return c + '\u033D\u0353'; }).join(''); }
  // 23. Stinky / Wavy Top
  function toStinky(s) { return Array.from(s).map(function (c) { return c + '\u033E'; }).join(''); }
  // 24. Arrow Below
  function toArrowBelow(s) { return Array.from(s).map(function (c) { return c + '\u034E'; }).join(''); }
  // 25. Weird Box / Bracketed
  function toWeirdBox(s) {
    return Array.from(s).map(function (c) {
      return c.trim() ? '[' + c + '\u0305\u0332]' : c;
    }).join('');
  }
  // 26. Sparkles / Stars Frame
  function toSparkles(s) { return '˜”*°•.˜”*°• ' + s + ' •°*”˜.•°*”˜'; }
  // 27. Stars Flourish
  function toStarsFlourish(s) { return '★·.·´¯`·.·★ ' + s + ' ★·.·´¯`·.·★'; }
  // 28. Kirby Hug
  function toKirbyHug(s) { return '(っ◔◡◔)っ ♥ ' + s + ' ♥'; }
  // 29. Hearts Between
  function toHeartsBetween(s) { return Array.from(s).join('♥'); }
  // 30. Wavy Waves Joiner
  function toWavyJoiner(s) { return '≋' + Array.from(s).join('≋') + '≋'; }
  // 31. Dotty Blocks Joiner
  function toDottyJoiner(s) { return '░' + Array.from(s).join('░') + '░'; }
  // 32. Block Shades Frame
  function toBlockShades(s) { return ' ▂▃▄▅▆▇█ ' + s + ' █▇▆▅▄▃▂ '; }
  // 33. Barcode Frame
  function toBarcodeFrame(s) { return '▌│█║▌║▌║ ' + s + ' ║▌║▌║█│▌'; }
  // 34. Wingdings / Arrows Look
  function toArrowFrame(s) { return '↣↣↣↣↣ ' + s + ' ↢↢↢↢↢'; }
  // 35. Japanese Brackets
  function toJapaneseBrackets(s) { return '【 ' + s + ' 】'; }

  const STYLES = [
    // --- Core Bold Fonts ---
    { id: 'bold-serif', label: 'Bold (Serif)', category: 'bold', fn: toBoldSerif, desc: 'Classic bold serif for high-impact titles' },
    { id: 'bold-sans', label: 'Bold (Sans-Serif)', category: 'bold', fn: toBoldSans, desc: 'Clean modern sans-serif bold for Instagram & Facebook' },
    { id: 'bold-italic-serif', label: 'Bold Italic (Serif)', category: 'bold', fn: toBoldItalicSerif, desc: 'Slanted bold serif characters' },
    { id: 'bold-italic-sans', label: 'Bold Italic (Sans-Serif)', category: 'bold', fn: toBoldItalicSans, desc: 'Clean modern italic bold font' },
    { id: 'bold-script', label: 'Bold Cursive / Script', category: 'bold', fn: toBoldScript, desc: 'Calligraphy style cursive bold' },
    { id: 'bold-fraktur', label: 'Bold Gothic / Fraktur', category: 'bold', fn: toBoldFraktur, desc: 'Medieval heavy blackletter gothic bold' },
    { id: 'double-struck', label: 'Double-Struck / Blackboard', category: 'bold', fn: toDoubleStruck, desc: 'Hollow chalkboard bold mathematical letters' },
    { id: 'monospace', label: 'Monospace / Typewriter', category: 'bold', fn: toMonospace, desc: 'Fixed-width developer and terminal font' },
    { id: 'fullwidth', label: 'Vaporwave / Fullwidth', category: 'bold', fn: toFullwidth, desc: 'A E S T H E T I C  wide spacing letters' },
    { id: 'small-caps', label: 'Small Caps', category: 'bold', fn: toSmallCaps, desc: 'Upper small capital letters' },
    { id: 'blue-blocks', label: 'Blue Block Letters', category: 'bold', fn: toRegionalIndicator, desc: 'Emoji flag indicator block letters' },

    // --- Framed & Boxed ---
    { id: 'circled', label: 'Circled / Bubble Letters', category: 'framed', fn: toCircled, desc: 'Letters enclosed inside circles' },
    { id: 'inverted-circled', label: 'Inverted Dark Bubbles', category: 'framed', fn: toInvertedCircled, desc: 'White text inside solid black circles' },
    { id: 'squared', label: 'Squared / Box Letters', category: 'framed', fn: toSquared, desc: 'Letters enclosed in outline boxes' },
    { id: 'inverted-squared', label: 'Inverted Black Squares', category: 'framed', fn: toInvertedSquared, desc: 'Solid square blocks with letters' },
    { id: 'weird-box', label: 'Weird Brackets Box', category: 'framed', fn: toWeirdBox, desc: 'Individual brackets around each letter' },
    { id: 'japanese-brackets', label: 'Japanese Lenticular Brackets', category: 'framed', fn: toJapaneseBrackets, desc: 'Heavy aesthetic brackets 【 】' },

    // --- Strikethrough & Decorative Marks ---
    { id: 'strikethrough', label: 'Bold Strikethrough', category: 'decor', fn: toStrikethrough, desc: 'Horizontal line through middle' },
    { id: 'tilde-strike', label: 'Tilde Strikethrough', category: 'decor', fn: toTildeStrike, desc: 'Wavy tilde strike line' },
    { id: 'underline', label: 'Underlined', category: 'decor', fn: toUnderline, desc: 'Single bottom underline on each letter' },
    { id: 'double-underline', label: 'Double Underlined', category: 'decor', fn: toDoubleUnderline, desc: 'Double underline mark' },
    { id: 'slash-through', label: 'Slash Through', category: 'decor', fn: toSlashThrough, desc: 'Diagonal slash through text' },
    { id: 'cross-above-below', label: 'Crosses Above & Below', category: 'decor', fn: toCrossAboveBelow, desc: 'Cross accents on every letter' },
    { id: 'stinky-marks', label: 'Stinky / Steam Marks', category: 'decor', fn: toStinky, desc: 'Wavy smoke marks above text' },
    { id: 'arrow-below', label: 'Arrows Below', category: 'decor', fn: toArrowBelow, desc: 'Pointer arrows beneath each letter' },
    { id: 'upside-down', label: 'Upside Down / Inverted', category: 'decor', fn: toUpsideDown, desc: 'Text flipped 180 degrees' },

    // --- Flourishes & Aesthetic Borders ---
    { id: 'sparkles', label: 'Sparkles Banner', category: 'flourish', fn: toSparkles, desc: 'Whimsical star & dot borders' },
    { id: 'stars-flourish', label: 'Classic Star Flourish', category: 'flourish', fn: toStarsFlourish, desc: 'Retro Myspace/Tumblr star wing border' },
    { id: 'kirby-hug', label: 'Cute Kirby Hug', category: 'flourish', fn: toKirbyHug, desc: 'Cute anime face hugging text with hearts' },
    { id: 'hearts-between', label: 'Hearts Between Letters', category: 'flourish', fn: toHeartsBetween, desc: 'Text intertwined with red hearts' },
    { id: 'wavy-joiner', label: 'Wavy Water Waves', category: 'flourish', fn: toWavyJoiner, desc: 'Ocean wave symbols between characters' },
    { id: 'dotty-joiner', label: 'Dotty Dappled Shade', category: 'flourish', fn: toDottyJoiner, desc: 'Pixel-shaded dapple pattern' },
    { id: 'block-shades', label: 'Step Equalizer Blocks', category: 'flourish', fn: toBlockShades, desc: 'Audio equalizer volume steps' },
    { id: 'barcode-frame', label: 'Barcode Cyberpunk Frame', category: 'flourish', fn: toBarcodeFrame, desc: 'Futuristic barcode sidebars' },
    { id: 'arrow-frame', label: 'Arrow Wing Accents', category: 'flourish', fn: toArrowFrame, desc: 'Leading and trailing stylized arrows' }
  ];

  document.addEventListener('DOMContentLoaded', function () {
    const inputArea = document.getElementById('tn-bold-input');
    const resultsContainer = document.getElementById('tn-bold-results');
    const btnSample = document.getElementById('tn-bold-sample');
    const btnClear = document.getElementById('tn-bold-clear');
    const charCountEl = document.getElementById('tn-bold-chars');
    const wordCountEl = document.getElementById('tn-bold-words');
    const filterPills = document.querySelectorAll('[data-style-filter]');

    let currentCategory = 'all';

    if (!inputArea || !resultsContainer) return;

    function renderResults() {
      const text = inputArea.value || 'Hello World';
      const rawVal = inputArea.value;
      const chars = rawVal.length;
      const words = rawVal.trim() ? rawVal.trim().split(/\s+/).length : 0;
      if (charCountEl) charCountEl.textContent = chars;
      if (wordCountEl) wordCountEl.textContent = words;

      const filtered = STYLES.filter(function (s) {
        return currentCategory === 'all' || s.category === currentCategory;
      });

      resultsContainer.innerHTML = filtered.map(function (item) {
        const transformed = item.fn(text);
        const safeVal = (transformed || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

        return (
          '<div class="col-12 col-md-6 mb-3">' +
            '<div class="tn-card p-3 h-100 d-flex flex-column justify-content-between shadow-sm">' +
              '<div class="d-flex justify-content-between align-items-center mb-2">' +
                '<div>' +
                  '<span class="badge bg-primary-subtle text-primary fw-semibold">' + item.label + '</span>' +
                '</div>' +
                '<button type="button" class="btn btn-sm btn-outline-primary tn-copy-style-btn" data-target="res-' + item.id + '" title="Copy to clipboard">' +
                  '<i class="bi bi-clipboard me-1"></i>Copy' +
                '</button>' +
              '</div>' +
              '<div class="p-3 bg-light rounded-3 text-break fs-5" id="res-' + item.id + '" style="min-height: 56px; user-select: all; line-height: 1.5;">' +
                safeVal +
              '</div>' +
              '<small class="text-muted mt-2">' + item.desc + '</small>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      // Bind copy buttons
      resultsContainer.querySelectorAll('.tn-copy-style-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const targetId = btn.getAttribute('data-target');
          const targetEl = document.getElementById(targetId);
          if (targetEl && window.ToolNest && window.ToolNest.copyToClipboard) {
            window.ToolNest.copyToClipboard(targetEl.textContent, btn);
          }
        });
      });
    }

    // Category filter tabs
    filterPills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        filterPills.forEach(function (p) {
          p.classList.remove('btn-primary', 'active');
          p.classList.add('btn-outline-secondary');
        });
        pill.classList.remove('btn-outline-secondary');
        pill.classList.add('btn-primary', 'active');
        currentCategory = pill.getAttribute('data-style-filter');
        renderResults();
      });
    });

    inputArea.addEventListener('input', renderResults);

    if (btnSample) {
      btnSample.addEventListener('click', function () {
        inputArea.value = 'Bold Text Generator';
        renderResults();
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Sample text loaded!', 'success');
        }
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', function () {
        inputArea.value = '';
        renderResults();
        inputArea.focus();
      });
    }

    renderResults();
  });
})();