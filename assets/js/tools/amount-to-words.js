/**
 * ToolNest - Amount to Words Converter (/assets/js/tools/amount-to-words.js)
 * Converts numeric amounts into English (Lakh/Crore & International) and
 * authentic Bangla words (কথায়) with BDT Taka & Paisa support.
 */
(function () {
  'use strict';

  const EN_ONES = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const EN_TENS = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  // Authentic Bangla 0 to 99 word table
  const BN_NUMBERS = [
    'শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়',
    'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ',
    'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'ঊনত্রিশ',
    'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ',
    'চল্লিশ', 'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ',
    'পঞ্চাশ', 'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট',
    'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর',
    'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি',
    'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই',
    'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'
  ];

  const CURRENCIES = {
    BDT: { enMain: 'Taka', enSub: 'Paisa', bnMain: 'টাকা', bnSub: 'পয়সা', symbol: '৳' },
    USD: { enMain: 'Dollars', enSub: 'Cents', bnMain: 'ডলার', bnSub: 'সেন্ট', symbol: '$' },
    INR: { enMain: 'Rupees', enSub: 'Paise', bnMain: 'রুপি', bnSub: 'পয়সা', symbol: '₹' },
    GBP: { enMain: 'Pounds', enSub: 'Pence', bnMain: 'পাউন্ড', bnSub: 'পেন্স', symbol: '£' },
    EUR: { enMain: 'Euros', enSub: 'Cents', bnMain: 'ইউরো', bnSub: 'সেন্ট', symbol: '€' },
    NONE: { enMain: '', enSub: '', bnMain: '', bnSub: '', symbol: '' }
  };

  function normalizeDigitsToEnglish(raw) {
    if (!raw) return '';
    const bnDigits = '০১২৩৪৫৬৭৮৯';
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      const idx = bnDigits.indexOf(ch);
      out += idx !== -1 ? String(idx) : ch;
    }
    return out.replace(/,/g, '').replace(/[^\d.]/g, '');
  }

  function toBanglaDigits(str) {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/\d/g, function (d) {
      return bnDigits[Number(d)];
    });
  }

  function formatSouthAsianCommas(intStr) {
    if (intStr.length <= 3) return intStr;
    const lastThree = intStr.slice(-3);
    const rest = intStr.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  function convertTwoDigitEn(n) {
    if (n === 0) return '';
    if (n < 20) return EN_ONES[n];
    const ten = Math.floor(n / 10);
    const rem = n % 10;
    return EN_TENS[ten] + (rem ? '-' + EN_ONES[rem] : '');
  }

  function convertThreeDigitEn(n) {
    if (n === 0) return '';
    const hundred = Math.floor(n / 100);
    const rem = n % 100;
    let res = '';
    if (hundred > 0) {
      res += EN_ONES[hundred] + ' Hundred';
    }
    if (rem > 0) {
      res += (res ? ' ' : '') + convertTwoDigitEn(rem);
    }
    return res;
  }

  function numberToWordsEnSouthAsian(num) {
    if (num === 0) return 'Zero';

    function convertBelowCrore(n) {
      const parts = [];
      const lakh = Math.floor(n / 100000);
      n = n % 100000;
      const thousand = Math.floor(n / 1000);
      n = n % 1000;
      const hundred = Math.floor(n / 100);
      const rest = n % 100;

      if (lakh > 0) parts.push(convertTwoDigitEn(lakh) + ' Lakh');
      if (thousand > 0) parts.push(convertTwoDigitEn(thousand) + ' Thousand');
      if (hundred > 0) parts.push(EN_ONES[hundred] + ' Hundred');
      if (rest > 0) parts.push(convertTwoDigitEn(rest));
      return parts.join(' ');
    }

    if (num >= 10000000) {
      const crores = Math.floor(num / 10000000);
      const rem = num % 10000000;
      const crorePart = numberToWordsEnSouthAsian(crores) + ' Crore';
      const remPart = rem > 0 ? ' ' + convertBelowCrore(rem) : '';
      return crorePart + remPart;
    }

    return convertBelowCrore(num);
  }

  function numberToWordsEnInternational(num) {
    if (num === 0) return 'Zero';
    const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
    const parts = [];
    let scaleIdx = 0;
    let n = num;

    while (n > 0 && scaleIdx < scales.length) {
      const chunk = n % 1000;
      if (chunk > 0) {
        const chunkStr = convertThreeDigitEn(chunk);
        parts.unshift(chunkStr + (scales[scaleIdx] ? ' ' + scales[scaleIdx] : ''));
      }
      n = Math.floor(n / 1000);
      scaleIdx++;
    }
    return parts.join(' ');
  }

  function numberToWordsBangla(num) {
    if (num === 0) return 'শূন্য';

    function convertBelowKoti(n) {
      const parts = [];
      const lakh = Math.floor(n / 100000);
      n = n % 100000;
      const thousand = Math.floor(n / 1000);
      n = n % 1000;
      const hundred = Math.floor(n / 100);
      const rest = n % 100;

      if (lakh > 0) parts.push(BN_NUMBERS[lakh] + ' লক্ষ');
      if (thousand > 0) parts.push(BN_NUMBERS[thousand] + ' হাজার');
      if (hundred > 0) parts.push(BN_NUMBERS[hundred] + ' শত');
      if (rest > 0) parts.push(BN_NUMBERS[rest]);
      return parts.join(' ');
    }

    if (num >= 10000000) {
      const koti = Math.floor(num / 10000000);
      const rem = num % 10000000;
      const kotiStr = numberToWordsBangla(koti) + ' কোটি';
      const remStr = rem > 0 ? ' ' + convertBelowKoti(rem) : '';
      return kotiStr + remStr;
    }

    return convertBelowKoti(num);
  }

  document.addEventListener('DOMContentLoaded', function () {
    const amountInput = document.getElementById('tn-amount-input');
    const currencySelect = document.getElementById('tn-amount-currency');
    const onlyToggle = document.getElementById('tn-amount-only');
    const outEnLakh = document.getElementById('tn-out-en-lakh');
    const outBn = document.getElementById('tn-out-bn');
    const outEnIntl = document.getElementById('tn-out-en-intl');
    const formattedEn = document.getElementById('tn-formatted-en');
    const formattedBn = document.getElementById('tn-formatted-bn');
    const btnSample = document.getElementById('tn-amount-sample');
    const btnReset = document.getElementById('tn-amount-reset');

    if (!amountInput) return;

    function updateOutputs() {
      const cleaned = normalizeDigitsToEnglish(amountInput.value);
      const currKey = (currencySelect && currencySelect.value) || 'BDT';
      const curr = CURRENCIES[currKey] || CURRENCIES.BDT;
      const includeOnly = !onlyToggle || onlyToggle.checked;

      if (!cleaned) {
        outEnLakh.textContent = 'Enter an amount above to see words in Lakh & Crore.';
        outBn.textContent = 'উপরে টাকার পরিমাণ লিখুন...';
        outEnIntl.textContent = 'Enter an amount above to see International Million/Billion wording.';
        formattedEn.textContent = curr.symbol + ' 0.00';
        formattedBn.textContent = curr.symbol + ' ০.০০';
        return;
      }

      const split = cleaned.split('.');
      let intStr = split[0].replace(/^0+(?=\d)/, '') || '0';
      if (intStr.length > 15) {
        intStr = intStr.slice(0, 15);
      }
      const decRaw = (split[1] || '').slice(0, 2);
      const decStr = decRaw ? (decRaw + '00').slice(0, 2) : '00';

      const intNum = parseInt(intStr, 10) || 0;
      const decNum = parseInt(decStr, 10) || 0;

      const commaInt = formatSouthAsianCommas(intStr);
      formattedEn.textContent = (curr.symbol ? curr.symbol + ' ' : '') + commaInt + (decNum > 0 ? '.' + decStr : '');
      formattedBn.textContent = (curr.symbol ? curr.symbol + ' ' : '') + toBanglaDigits(commaInt + (decNum > 0 ? '.' + decStr : ''));

      // 1. English South Asian (Lakh / Crore)
      let enLakhWords = numberToWordsEnSouthAsian(intNum);
      if (curr.enMain) enLakhWords += ' ' + curr.enMain;
      if (decNum > 0) {
        enLakhWords += ' and ' + convertTwoDigitEn(decNum) + (curr.enSub ? ' ' + curr.enSub : '/100');
      }
      if (includeOnly && currKey !== 'NONE') enLakhWords += ' Only';
      outEnLakh.textContent = enLakhWords;

      // 2. Bangla Words (লক্ষ / কোটি)
      let bnWords = numberToWordsBangla(intNum);
      if (curr.bnMain) bnWords += ' ' + curr.bnMain;
      if (decNum > 0) {
        bnWords += ' এবং ' + BN_NUMBERS[decNum] + (curr.bnSub ? ' ' + curr.bnSub : ' দশমাংশ');
      }
      if (includeOnly && currKey !== 'NONE') bnWords += ' মাত্র';
      outBn.textContent = bnWords;

      // 3. English International (Million / Billion)
      let enIntlWords = numberToWordsEnInternational(intNum);
      if (curr.enMain) enIntlWords += ' ' + curr.enMain;
      if (decNum > 0) {
        enIntlWords += ' and ' + convertTwoDigitEn(decNum) + (curr.enSub ? ' ' + curr.enSub : '/100');
      }
      if (includeOnly && currKey !== 'NONE') enIntlWords += ' Only';
      outEnIntl.textContent = enIntlWords;
    }

    amountInput.addEventListener('input', updateOutputs);
    if (currencySelect) currencySelect.addEventListener('change', updateOutputs);
    if (onlyToggle) onlyToggle.addEventListener('change', updateOutputs);

    document.querySelectorAll('.tn-quick-amount').forEach(function (btn) {
      btn.addEventListener('click', function () {
        amountInput.value = btn.getAttribute('data-amount') || '125500.50';
        updateOutputs();
      });
    });

    if (btnSample) {
      btnSample.addEventListener('click', function () {
        amountInput.value = '125750.50';
        updateOutputs();
        window.ToolNest.showToast('Sample cheque amount loaded!', 'success');
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', function () {
        amountInput.value = '';
        updateOutputs();
        amountInput.focus();
      });
    }

    document.querySelectorAll('[data-copy-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetId = btn.getAttribute('data-copy-target');
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          window.ToolNest.copyToClipboard(targetEl.textContent, btn);
        }
      });
    });

    // Initialize with default sample value
    updateOutputs();
  });
})();
