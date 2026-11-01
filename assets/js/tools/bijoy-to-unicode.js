/**
 * ToolNest - Bijoy to Unicode & Unicode to Bijoy Converter
 * (/assets/js/tools/bijoy-to-unicode.js)
 * 100% Client-Side Bidirectional Bangla Encoding Converter
 */
(function () {
  'use strict';

  // Ordered mapping from Bijoy ANSI (SutonnyMJ) tokens to Unicode
  const BIJOY_TO_UNI_MAP = [
    ['Av', 'আ'], ['A', 'অ'], ['B', 'ই'], ['C', 'ঈ'], ['D', 'উ'], ['E', 'ঊ'],
    ['F', 'ঋ'], ['G', 'এ'], ['H', 'ঐ'], ['I', 'ও'], ['J', 'ঔ'],
    ['K', 'ক'], ['L', 'খ'], ['M', 'গ'], ['N', 'ঘ'], ['O', 'ঙ'],
    ['P', 'চ'], ['Q', 'ছ'], ['R', 'জ'], ['S', 'ঝ'], ['T', 'ঞ'],
    ['U', 'ট'], ['V', 'ঠ'], ['W', 'ড'], ['X', 'ঢ'], ['Y', 'ণ'],
    ['Z', 'ত'], ['_', 'থ'], ['`', 'দ'], ['a', 'ধ'], ['b', 'ন'],
    ['c', 'প'], ['d', 'ফ'], ['e', 'ব'], ['f', 'ভ'], ['g', 'ম'],
    ['h', 'য'], ['i', 'র'], ['j', 'ল'], ['k', 'শ'], ['l', 'ষ'],
    ['m', 'স'], ['n', 'হ'], ['o', 'ড়'], ['p', 'ঢ়'], ['q', 'য়'],
    ['r', 'ৎ'], ['s', 'ং'], ['t', 'ঃ'], ['u', 'ঁ'],
    // Juktakkhors & Special Forms
    ['ÿ', 'ক্ষ'], ['¶', 'ক্ষ'], ['Á', 'জ্ঞ'], ['²', 'ক্ক'], ['³', 'ক্ত'],
    ['´', 'ক্ন'], ['µ', 'ক্র'], ['·', 'ক্স'], ['¸', 'গু'], ['¹', 'গ্ধ'],
    ['º', 'গ্ন'], ['»', 'গ্ম'], ['¼', 'ঙ্ক'], ['½', 'ঙ্গ'], ['¾', 'জ্জ'],
    ['¿', '্ত্র'], ['À', 'জ্ব'], ['Â', 'ঞ্চ'], ['Ã', 'ঞ্জ'], ['Ä', 'ঞ্ছ'],
    ['Å', 'ঞ্ঝ'], ['Æ', 'ট্ট'], ['Ç', 'ড্ড'], ['È', 'ণ্ট'], ['É', 'ণ্ঠ'],
    ['Ê', 'ণ্ড'], ['Ë', 'ত্ত'], ['Ì', 'ত্থ'], ['Í', 'ত্ন'], ['Î', 'ত্র'],
    ['Ï', 'দ্দ'], ['Ð', 'দ্ধ'], ['Ñ', 'দ্ব'], ['Ò', 'দ্ভ'], ['Ó', 'দ্ম'],
    ['Ô', 'ধ্ব'], ['Õ', 'ন্ত'], ['Ö', 'ন্ত্র'], ['×', 'স্থ'], ['Ø', 'দ্ব'],
    ['Ù', 'ম্প'], ['Ú', 'ম্ম'], ['Û', 'ল্ক'], ['Ü', 'ল্গ'], ['Ý', 'ল্প'],
    ['Þ', 'ষ্প'], ['ß', 'ষ্ট'], ['à', 'ষ্ঠ'], ['á', 'ষ্ণ'], ['â', 'স্ক'],
    ['ã', 'স্ত'], ['ä', 'স্ত্র'], ['å', 'স্ফ'], ['æ', 'হ্ম'], ['ç', 'হ্ন'],
    ['è', 'হ্ব'], ['é', 'হ্র'], ['ê', 'হ্ল'],
    ['Ö', '্র'], ['«', '্র'], ['ª', '্র'], ['¨', '্য'], ['&', '্'],
    // Kars (Vowel signs)
    ['v', 'া'], ['w', 'ি'], ['x', 'ী'], ['y', 'ু'], ['z', 'ূ'],
    ['~', 'ূ'], ['…', 'ৃ'], ['†', 'ে'], ['‡', 'ে'], ['ˆ', 'ৈ'], ['Š', 'ৗ'],
    // Digits & Punctuation
    ['0', '০'], ['1', '১'], ['2', '২'], ['3', '৩'], ['4', '৪'],
    ['5', '৫'], ['6', '৬'], ['7', '৭'], ['8', '৮'], ['9', '৯'],
    ['|', '।']
  ];

  // Ordered mapping from Unicode to Bijoy ANSI (SutonnyMJ)
  const UNI_TO_BIJOY_MAP = [
    ['ক্ষ', 'ÿ'], ['জ্ঞ', 'Á'], ['ক্ক', '²'], ['ক্ত', '³'], ['ক্ন', '´'],
    ['ক্র', 'µ'], ['ক্স', '·'], ['গ্ধ', '¹'], ['গ্ন', 'º'], ['গ্ম', '»'],
    ['ঙ্ক', '¼'], ['ঙ্গ', '½'], ['জ্জ', '¾'], ['জ্ব', 'À'], ['ঞ্চ', 'Â'],
    ['ঞ্জ', 'Ã'], ['ঞ্ছ', 'Ä'], ['ঞ্ঝ', 'Å'], ['ট্ট', 'Æ'], ['ড্ড', 'Ç'],
    ['ণ্ট', 'È'], ['ণ্ঠ', 'É'], ['ণ্ড', 'Ê'], ['ত্ত', 'Ë'], ['ত্থ', 'Ì'],
    ['ত্ন', 'Í'], ['ত্র', 'Î'], ['দ্দ', 'Ï'], ['দ্ধ', 'Ð'], ['দ্ভ', 'Ò'],
    ['দ্ম', 'Ó'], ['ধ্ব', 'Ô'], ['ন্ত', 'Õ'], ['ন্ত্র', 'Ö'], ['স্থ', '×'],
    ['দ্ব', 'Ø'], ['ম্প', 'Ù'], ['ম্ম', 'Ú'], ['ল্ক', 'Û'], ['ল্গ', 'Ü'],
    ['ল্প', 'Ý'], ['ষ্প', 'Þ'], ['ষ্ট', 'ß'], ['ষ্ঠ', 'à'], ['ষ্ণ', 'á'],
    ['স্ক', 'â'], ['স্ত', 'ã'], ['স্ত্র', 'ä'], ['স্ফ', 'å'], ['হ্ম', 'æ'],
    ['হ্ন', 'ç'], ['হ্ব', 'è'], ['হ্র', 'é'], ['হ্ল', 'ê'],
    ['্র', '«'], ['্য', '¨'], ['্', '&'],
    ['আ', 'Av'], ['অ', 'A'], ['ই', 'B'], ['ঈ', 'C'], ['উ', 'D'], ['ঊ', 'E'],
    ['ঋ', 'F'], ['এ', 'G'], ['ঐ', 'H'], ['ও', 'I'], ['ঔ', 'J'],
    ['ক', 'K'], ['খ', 'L'], ['গ', 'M'], ['ঘ', 'N'], ['ঙ', 'O'],
    ['চ', 'P'], ['ছ', 'Q'], ['জ', 'R'], ['ঝ', 'S'], ['ঞ', 'T'],
    ['ট', 'U'], ['ঠ', 'V'], ['ড', 'W'], ['ঢ', 'X'], ['ণ', 'Y'],
    ['ত', 'Z'], ['থ', '_'], ['দ', '`'], ['ধ', 'a'], ['ন', 'b'],
    ['প', 'c'], ['ফ', 'd'], ['ব', 'e'], ['ভ', 'f'], ['ম', 'g'],
    ['য', 'h'], ['র', 'i'], ['ল', 'j'], ['শ', 'k'], ['ষ', 'l'],
    ['স', 'm'], ['হ', 'n'], ['ড়', 'o'], ['ঢ়', 'p'], ['য়', 'q'],
    ['ৎ', 'r'], ['ং', 's'], ['ঃ', 't'], ['ঁ', 'u'],
    ['া', 'v'], ['ি', 'w'], ['ী', 'x'], ['ু', 'y'], ['ূ', 'z'],
    ['ৃ', '…'], ['ে', '†'], ['ৈ', 'ˆ'], ['ৗ', 'Š'],
    ['০', '0'], ['১', '1'], ['২', '2'], ['৩', '3'], ['৪', '4'],
    ['৫', '5'], ['৬', '6'], ['৭', '7'], ['৮', '8'], ['৯', '9'],
    ['।', '|']
  ];

  function isBanglaConsonant(ch) {
    if (!ch) return false;
    const code = ch.charCodeAt(0);
    return (code >= 0x0995 && code <= 0x09B9) || code === 0x09DC || code === 0x09DD || code === 0x09DF;
  }

  function isPreKar(ch) {
    return ch === 'ি' || ch === 'ে' || ch === 'ৈ';
  }

  /**
   * Convert Bijoy ANSI string to Unicode Bangla
   */
  function convertBijoyToUnicode(input) {
    if (!input) return '';
    let str = input;

    // Normalize composed Bijoy sequences
    str = str.replace(/ড়/g, 'ড়').replace(/ঢ়/g, 'ঢ়').replace(/য়/g, 'য়');

    // Step 1: Map Bijoy tokens to raw Unicode characters
    for (let i = 0; i < BIJOY_TO_UNI_MAP.length; i++) {
      const pair = BIJOY_TO_UNI_MAP[i];
      str = str.split(pair[0]).join(pair[1]);
    }

    // Step 2: Move Pre-Kars (ি, ে, ৈ) from BEFORE consonant cluster to AFTER consonant cluster
    // A consonant cluster is: Consonant + (্ + Consonant)* + (?:্য)?
    const clusterAfterPreKar = /([িেৈ])([ক-হড়ঢ়য়](?:্[ক-হড়ঢ়য়])*(?:্য)?)/g;
    str = str.replace(clusterAfterPreKar, '$2$1');

    // Step 3: Handle Reph '©' which in Bijoy appears at the end of consonant cluster + kar
    // Move '©' to 'র্' before the consonant cluster
    const rephPattern = /([ক-হড়ঢ়য়](?:্[ক-হড়ঢ়য়])*(?:্য)?[া-ৌ]?)©/g;
    str = str.replace(rephPattern, 'র্$1');
    str = str.replace(/©/g, 'র্');

    // Step 4: Combine split compound vowels (ে + া = ো, ে + ৗ = ৌ)
    str = str.replace(/ো/g, 'ো');
    str = str.replace(/ৌ/g, 'ৌ');
    // Fix অ + া = আ if any remained
    str = str.replace(/অা/g, 'আ');

    return str;
  }

  /**
   * Convert Unicode Bangla string to Bijoy ANSI (SutonnyMJ)
   */
  function convertUnicodeToBijoy(input) {
    if (!input) return '';
    let str = input;

    // Normalize Nukta combinations
    str = str.replace(/ব়/g, 'র').replace(/ড\u09BC/g, 'ড়').replace(/ঢ\u09BC/g, 'ঢ়').replace(/য\u09BC/g, 'য়');

    // Step 1: Decompose two-part vowel signs (ো -> ে + া, ৌ -> ে + ৗ)
    str = str.replace(/ো/g, 'ো');
    str = str.replace(/ৌ/g, 'ৌ');

    // Step 2: Move Reph (র্) from before consonant cluster to '©' after cluster
    const rephUniPattern = /র্([ক-হড়ঢ়য়](?:্[ক-হড়ঢ়য়])*(?:্য)?)/g;
    str = str.replace(rephUniPattern, '$1©');

    // Step 3: Move Pre-Kars (ি, ে, ৈ) from AFTER consonant cluster to BEFORE consonant cluster
    const preKarUniPattern = /([ক-হড়ঢ়য়](?:্[ক-হড়ঢ়য়])*(?:্য)?)([িেৈ])/g;
    str = str.replace(preKarUniPattern, '$2$1');

    // Ensure Reph © stays after pre-kar repositioning if both exist
    str = str.replace(/([িেৈ])([ক-হড়ঢ়য়](?:্[ক-হড়ঢ়য়])*(?:্য)?)©/g, '$1$2©');

    // Step 4: Replace Unicode tokens with Bijoy ANSI equivalents
    for (let i = 0; i < UNI_TO_BIJOY_MAP.length; i++) {
      const pair = UNI_TO_BIJOY_MAP[i];
      str = str.split(pair[0]).join(pair[1]);
    }

    return str;
  }

  function updateStats(text, statsEl) {
    if (!statsEl) return;
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    statsEl.textContent = words + ' words · ' + chars + ' characters';
  }

  document.addEventListener('DOMContentLoaded', function () {
    const bijoyBox = document.getElementById('tn-bijoy-input');
    const unicodeBox = document.getElementById('tn-unicode-input');
    const btnBijoyToUni = document.getElementById('tn-btn-bijoy-to-uni');
    const btnUniToBijoy = document.getElementById('tn-btn-uni-to-bijoy');
    const btnSample = document.getElementById('tn-bijoy-sample');
    const btnClear = document.getElementById('tn-bijoy-clear');
    const btnCopyBijoy = document.getElementById('tn-copy-bijoy');
    const btnCopyUnicode = document.getElementById('tn-copy-unicode');
    const liveToggle = document.getElementById('tn-bijoy-live');
    const bijoyStats = document.getElementById('tn-bijoy-stats');
    const unicodeStats = document.getElementById('tn-unicode-stats');

    if (!bijoyBox || !unicodeBox) return;

    function runBijoyToUni() {
      unicodeBox.value = convertBijoyToUnicode(bijoyBox.value);
      updateStats(bijoyBox.value, bijoyStats);
      updateStats(unicodeBox.value, unicodeStats);
    }

    function runUniToBijoy() {
      bijoyBox.value = convertUnicodeToBijoy(unicodeBox.value);
      updateStats(bijoyBox.value, bijoyStats);
      updateStats(unicodeBox.value, unicodeStats);
    }

    bijoyBox.addEventListener('input', function () {
      updateStats(bijoyBox.value, bijoyStats);
      if (!liveToggle || liveToggle.checked) {
        runBijoyToUni();
      }
    });

    unicodeBox.addEventListener('input', function () {
      updateStats(unicodeBox.value, unicodeStats);
      if (!liveToggle || liveToggle.checked) {
        runUniToBijoy();
      }
    });

    if (btnBijoyToUni) {
      btnBijoyToUni.addEventListener('click', function () {
        runBijoyToUni();
        window.ToolNest.showToast('Converted Bijoy ANSI to Unicode!', 'success');
      });
    }

    if (btnUniToBijoy) {
      btnUniToBijoy.addEventListener('click', function () {
        runUniToBijoy();
        window.ToolNest.showToast('Converted Unicode to Bijoy ANSI!', 'success');
      });
    }

    if (btnSample) {
      btnSample.addEventListener('click', function () {
        unicodeBox.value = 'আমার সোনার বাংলা, আমি তোমায় ভালোবাসি। ২০২৬ সালে টুলনেস্ট ব্যবহার করে সহজেই বাংলা কনভার্ট করুন।';
        runUniToBijoy();
        window.ToolNest.showToast('Sample Bangla text loaded!', 'success');
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', function () {
        bijoyBox.value = '';
        unicodeBox.value = '';
        updateStats('', bijoyStats);
        updateStats('', unicodeStats);
        bijoyBox.focus();
      });
    }

    if (btnCopyBijoy) {
      btnCopyBijoy.addEventListener('click', function () {
        window.ToolNest.copyToClipboard(bijoyBox.value, btnCopyBijoy);
      });
    }

    if (btnCopyUnicode) {
      btnCopyUnicode.addEventListener('click', function () {
        window.ToolNest.copyToClipboard(unicodeBox.value, btnCopyUnicode);
      });
    }
  });
})();
