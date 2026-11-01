/**
 * ToolNest - Currency Converter (/assets/js/tools/currency-converter.js)
 * 100% Client-Side Global & Bangladesh Remittance Currency Converter.
 * Supports 25+ currencies (BDT, USD, EUR, GBP, SAR, AED, MYR, INR, etc.),
 * Live API refresh with offline fallback, Custom Bank Rate override,
 * optional +2.5% Remittance Incentive Bonus, Bangla digits toggle, and Multi-Currency Table.
 */
(function () {
  'use strict';

  /**
   * Single Editable Configuration Object for Default Reference Exchange Rates
   * Base Currency: USD (1.00)
   * Works immediately offline and updates automatically when Live Rates are fetched.
   */
  const DEFAULT_CURRENCY_CONFIG = {
    baseCurrency: 'USD',
    lastUpdatedLabel: 'Reference Market Rates (Editable)',
    defaultRemittanceBonusPct: 2.5,
    currencies: [
      { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', flag: '🇧🇩', ratePerUsd: 120.0 },
      { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', ratePerUsd: 1.0 },
      { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', ratePerUsd: 0.92 },
      { code: 'GBP', name: 'British Pound Sterling', symbol: '£', flag: '🇬🇧', ratePerUsd: 0.77 },
      { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', flag: '🇸🇦', ratePerUsd: 3.75 },
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪', ratePerUsd: 3.6725 },
      { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾', ratePerUsd: 4.35 },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬', ratePerUsd: 1.32 },
      { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', flag: '🇶🇦', ratePerUsd: 3.64 },
      { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', flag: '🇴🇲', ratePerUsd: 0.385 },
      { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ক', flag: '🇰🇼', ratePerUsd: 0.307 },
      { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', flag: '🇧🇭', ratePerUsd: 0.376 },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', ratePerUsd: 84.0 },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦', ratePerUsd: 1.38 },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺', ratePerUsd: 1.51 },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', ratePerUsd: 152.0 },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳', ratePerUsd: 7.12 },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭', ratePerUsd: 0.865 },
      { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', flag: '🇵🇰', ratePerUsd: 278.0 },
      { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू', flag: '🇳🇵', ratePerUsd: 134.4 },
      { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', flag: '🇱🇰', ratePerUsd: 293.5 },
      { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭', ratePerUsd: 33.7 },
      { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷', ratePerUsd: 1380.0 },
      { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷', ratePerUsd: 34.2 }
    ]
  };

  const EN_TO_BN_DIGITS = {
    '0': '০',
    '1': '১',
    '2': '২',
    '3': '৩',
    '4': '৪',
    '5': '৫',
    '6': '৬',
    '7': '৭',
    '8': '৮',
    '9': '৯'
  };

  function toBanglaDigits(str) {
    return String(str).replace(/[0-9]/g, function (d) {
      return EN_TO_BN_DIGITS[d] || d;
    });
  }

  function formatCurrencyAmount(val, decimals, useBn) {
    const safe = Number.isFinite(val) ? val : 0;
    const dec = typeof decimals === 'number' ? decimals : 2;
    const formatted = safe.toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    });
    return useBn ? toBanglaDigits(formatted) : formatted;
  }

  /**
   * Compute cross rate between any two currencies given a map of { CODE: ratePerUsd }
   * Returns how many units of `toCode` equal 1 unit of `fromCode`
   */
  function getPairRate(fromCode, toCode, ratesMap) {
    const fromRate = ratesMap[fromCode] || 1;
    const toRate = ratesMap[toCode] || 1;
    if (fromCode === toCode) return 1;
    return toRate / fromRate;
  }

  /**
   * Convert an amount with optional custom rate override and remittance bonus percentage
   */
  function convertCurrency(params) {
    const amount = Math.max(0, Number(params.amount) || 0);
    const fromCode = params.fromCode || 'USD';
    const toCode = params.toCode || 'BDT';
    const ratesMap = params.ratesMap || {};

    const defaultPairRate = getPairRate(fromCode, toCode, ratesMap);
    const customRate = Number(params.customPairRate);
    const activeRate =
      params.useCustomRate && Number.isFinite(customRate) && customRate > 0
        ? customRate
        : defaultPairRate;

    const baseConverted = amount * activeRate;
    const inverseRate = activeRate > 0 ? 1 / activeRate : 0;

    const applyBonus = Boolean(params.applyRemittanceBonus);
    const bonusPct = applyBonus ? Math.max(0, Number(params.remittanceBonusPct) || 0) : 0;
    const bonusAmount = baseConverted * (bonusPct / 100);
    const totalWithBonus = baseConverted + bonusAmount;

    return {
      amount: amount,
      fromCode: fromCode,
      toCode: toCode,
      unitRate: activeRate,
      inverseRate: inverseRate,
      baseConverted: baseConverted,
      bonusPct: bonusPct,
      bonusAmount: bonusAmount,
      totalWithBonus: totalWithBonus
    };
  }

  // Expose pure calculation helpers for automated testing
  if (typeof window !== 'undefined') {
    window.ToolNestCurrencyConverter = {
      config: DEFAULT_CURRENCY_CONFIG,
      getPairRate: getPairRate,
      convertCurrency: convertCurrency,
      formatCurrencyAmount: formatCurrencyAmount
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const amountInput = document.getElementById('tn-cc-amount');
    const fromSelect = document.getElementById('tn-cc-from');
    const toSelect = document.getElementById('tn-cc-to');
    const swapBtn = document.getElementById('tn-cc-swap-btn');

    const customRateCheck = document.getElementById('tn-cc-custom-rate-check');
    const customRateInput = document.getElementById('tn-cc-custom-rate');
    const customRateUnitLabel = document.getElementById('tn-cc-rate-unit-label');

    const bonusCheck = document.getElementById('tn-cc-bonus-check');
    const bonusPctInput = document.getElementById('tn-cc-bonus-pct');
    const bnDigitsCheck = document.getElementById('tn-cc-bn-digits');

    const statusBadge = document.getElementById('tn-cc-rate-status');
    const refreshLiveBtn = document.getElementById('tn-cc-refresh-btn');

    const resultPrimaryEl = document.getElementById('tn-cc-result-primary');
    const resultRateLineEl = document.getElementById('tn-cc-result-rate-line');
    const resultInverseLineEl = document.getElementById('tn-cc-result-inverse-line');

    const bonusBreakdownBox = document.getElementById('tn-cc-bonus-box');
    const bonusBaseValEl = document.getElementById('tn-cc-bonus-base');
    const bonusExtraValEl = document.getElementById('tn-cc-bonus-extra');
    const bonusTotalValEl = document.getElementById('tn-cc-bonus-total');

    const copyBtn = document.getElementById('tn-cc-copy-btn');
    const copyTableBtn = document.getElementById('tn-cc-copy-table-btn');
    const resetBtn = document.getElementById('tn-cc-reset-btn');

    const multiplesHeaderFrom = document.getElementById('tn-cc-mult-from-head');
    const multiplesHeaderTo = document.getElementById('tn-cc-mult-to-head');
    const multiplesBody = document.getElementById('tn-cc-multiples-body');
    const allCurrenciesBody = document.getElementById('tn-cc-all-body');

    if (!amountInput || !fromSelect || !toSelect) return;

    // Build live rates map seeded from DEFAULT_CURRENCY_CONFIG
    const ratesMap = {};
    const metaMap = {};
    DEFAULT_CURRENCY_CONFIG.currencies.forEach(function (c) {
      ratesMap[c.code] = c.ratePerUsd;
      metaMap[c.code] = c;
    });

    // Populate From and To selects
    DEFAULT_CURRENCY_CONFIG.currencies.forEach(function (c) {
      const label = c.code + ' — ' + c.name + ' (' + c.symbol + ')';
      const opt1 = document.createElement('option');
      opt1.value = c.code;
      opt1.textContent = label;
      fromSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = c.code;
      opt2.textContent = label;
      toSelect.appendChild(opt2);
    });

    fromSelect.value = 'USD';
    toSelect.value = 'BDT';

    function syncDefaultRateIntoCustomInput() {
      if (!customRateCheck || !customRateCheck.checked) {
        const pairRate = getPairRate(fromSelect.value, toSelect.value, ratesMap);
        if (customRateInput) {
          customRateInput.value = Number(pairRate.toFixed(4));
        }
      }
      if (customRateUnitLabel) {
        customRateUnitLabel.textContent = '1 ' + fromSelect.value + ' in ' + toSelect.value;
      }
    }

    function updateConverterUI() {
      const fromCode = fromSelect.value;
      const toCode = toSelect.value;
      const useBn = bnDigitsCheck ? bnDigitsCheck.checked : false;
      const useCustom = customRateCheck ? customRateCheck.checked : false;

      if (customRateInput) {
        customRateInput.disabled = !useCustom;
      }
      if (!useCustom) {
        syncDefaultRateIntoCustomInput();
      } else if (customRateUnitLabel) {
        customRateUnitLabel.textContent = '1 ' + fromCode + ' in ' + toCode;
      }

      const res = convertCurrency({
        amount: amountInput.value,
        fromCode: fromCode,
        toCode: toCode,
        ratesMap: ratesMap,
        useCustomRate: useCustom,
        customPairRate: customRateInput ? customRateInput.value : 0,
        applyRemittanceBonus: bonusCheck ? bonusCheck.checked : false,
        remittanceBonusPct: bonusPctInput ? bonusPctInput.value : 2.5
      });

      const fromMeta = metaMap[fromCode] || { symbol: fromCode, name: fromCode };
      const toMeta = metaMap[toCode] || { symbol: toCode, name: toCode };

      const displayAmount = res.bonusPct > 0 ? res.totalWithBonus : res.baseConverted;
      resultPrimaryEl.textContent =
        toMeta.symbol + ' ' + formatCurrencyAmount(displayAmount, 2, useBn) + ' ' + toCode;

      resultRateLineEl.textContent =
        '1 ' +
        fromCode +
        ' = ' +
        formatCurrencyAmount(res.unitRate, 4, useBn) +
        ' ' +
        toCode +
        (useCustom ? ' (Custom Rate)' : '');

      resultInverseLineEl.textContent =
        '1 ' + toCode + ' = ' + formatCurrencyAmount(res.inverseRate, 6, useBn) + ' ' + fromCode;

      if (bonusBreakdownBox) {
        if (bonusCheck && bonusCheck.checked) {
          bonusBreakdownBox.classList.remove('d-none');
          bonusBaseValEl.textContent =
            toMeta.symbol + ' ' + formatCurrencyAmount(res.baseConverted, 2, useBn) + ' ' + toCode;
          bonusExtraValEl.textContent =
            '+ ' +
            toMeta.symbol +
            ' ' +
            formatCurrencyAmount(res.bonusAmount, 2, useBn) +
            ' (' +
            formatCurrencyAmount(res.bonusPct, 2, useBn) +
            '%)';
          bonusTotalValEl.textContent =
            toMeta.symbol + ' ' + formatCurrencyAmount(res.totalWithBonus, 2, useBn) + ' ' + toCode;
        } else {
          bonusBreakdownBox.classList.add('d-none');
        }
      }

      // Render Quick Multiples Table (1, 5, 10, 50, 100, 500, 1000, 5000)
      if (multiplesHeaderFrom) multiplesHeaderFrom.textContent = fromCode + ' (' + fromMeta.symbol + ')';
      if (multiplesHeaderTo) multiplesHeaderTo.textContent = toCode + ' (' + toMeta.symbol + ')';
      if (multiplesBody) {
        const steps = [1, 5, 10, 50, 100, 500, 1000, 5000];
        multiplesBody.innerHTML = steps
          .map(function (m) {
            const convertedVal = m * res.unitRate * (1 + res.bonusPct / 100);
            return (
              '<tr>' +
              '<td class="fw-semibold">' +
              formatCurrencyAmount(m, 0, useBn) +
              ' ' +
              fromCode +
              '</td>' +
              '<td class="text-end fw-bold text-primary">' +
              toMeta.symbol +
              ' ' +
              formatCurrencyAmount(convertedVal, 2, useBn) +
              ' ' +
              toCode +
              '</td>' +
              '</tr>'
            );
          })
          .join('');
      }

      // Render All Currencies Comparison Table for the entered amount
      if (allCurrenciesBody) {
        const enteredAmt = Math.max(0, Number(amountInput.value) || 0);
        const amountInUsd = enteredAmt / (ratesMap[fromCode] || 1);
        const keyCodes = ['BDT', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'MYR', 'SGD', 'QAR', 'OMR', 'KWD', 'INR', 'CAD', 'AUD', 'JPY', 'CNY'];
        allCurrenciesBody.innerHTML = keyCodes
          .map(function (code) {
            const m = metaMap[code];
            if (!m) return '';
            const val =
              code === toCode && useCustom
                ? enteredAmt * res.unitRate
                : amountInUsd * (ratesMap[code] || 1);
            const pairRate =
              code === toCode && useCustom
                ? res.unitRate
                : getPairRate(fromCode, code, ratesMap);
            const highlight = code === toCode ? ' class="table-primary fw-bold"' : '';
            return (
              '<tr' +
              highlight +
              '>' +
              '<td><span class="fw-semibold">' +
              code +
              '</span> <span class="text-muted small">— ' +
              window.ToolNest.escapeHtml(m.name) +
              '</span></td>' +
              '<td class="text-end fw-bold">' +
              m.symbol +
              ' ' +
              formatCurrencyAmount(val, 2, useBn) +
              '</td>' +
              '<td class="text-end small text-muted">1 ' +
              fromCode +
              ' = ' +
              formatCurrencyAmount(pairRate, 4, useBn) +
              ' ' +
              code +
              '</td>' +
              '</tr>'
            );
          })
          .join('');
      }
    }

    function fetchLiveExchangeRates(showFeedback) {
      if (typeof window.fetch !== 'function') return;
      if (refreshLiveBtn) refreshLiveBtn.disabled = true;

      fetch('https://open.er-api.com/v6/latest/USD')
        .then(function (resp) {
          if (!resp.ok) throw new Error('Network response was not ok');
          return resp.json();
        })
        .then(function (data) {
          if (data && data.rates) {
            Object.keys(ratesMap).forEach(function (code) {
              if (typeof data.rates[code] === 'number' && data.rates[code] > 0) {
                ratesMap[code] = data.rates[code];
              }
            });
            if (statusBadge) {
              statusBadge.className = 'badge bg-success-subtle text-success px-3 py-2';
              statusBadge.innerHTML =
                '<i class="bi bi-wifi me-1" aria-hidden="true"></i> Live Mid-Market Rates Active';
            }
            syncDefaultRateIntoCustomInput();
            updateConverterUI();
            if (showFeedback) {
              window.ToolNest.showToast('Updated with latest live market exchange rates!', 'success');
            }
          }
        })
        .catch(function () {
          if (statusBadge) {
            statusBadge.className = 'badge bg-secondary-subtle text-secondary px-3 py-2';
            statusBadge.innerHTML =
              '<i class="bi bi-database-check me-1" aria-hidden="true"></i> Offline Reference Rates (Custom Rate Editable)';
          }
          if (showFeedback) {
            window.ToolNest.showToast('Using built-in offline rates. You can also enter a custom rate.', 'warning');
          }
        })
        .finally(function () {
          if (refreshLiveBtn) refreshLiveBtn.disabled = false;
        });
    }

    // Bind events
    [amountInput, fromSelect, toSelect, customRateCheck, customRateInput, bonusCheck, bonusPctInput, bnDigitsCheck].forEach(
      function (el) {
        if (!el) return;
        el.addEventListener('input', updateConverterUI);
        el.addEventListener('change', updateConverterUI);
      }
    );

    if (swapBtn) {
      swapBtn.addEventListener('click', function () {
        const tmp = fromSelect.value;
        fromSelect.value = toSelect.value;
        toSelect.value = tmp;
        if (customRateCheck) customRateCheck.checked = false;
        syncDefaultRateIntoCustomInput();
        updateConverterUI();
      });
    }

    // Popular Currency Pair Preset Chips
    document.querySelectorAll('[data-cc-pair]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const from = btn.getAttribute('data-cc-from') || 'USD';
        const to = btn.getAttribute('data-cc-to') || 'BDT';
        fromSelect.value = from;
        toSelect.value = to;
        if (customRateCheck) customRateCheck.checked = false;
        syncDefaultRateIntoCustomInput();
        updateConverterUI();
      });
    });

    if (refreshLiveBtn) {
      refreshLiveBtn.addEventListener('click', function () {
        fetchLiveExchangeRates(true);
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        const text =
          amountInput.value +
          ' ' +
          fromSelect.value +
          ' = ' +
          resultPrimaryEl.textContent +
          ' (' +
          resultRateLineEl.textContent +
          ')';
        window.ToolNest.copyToClipboard(text, copyBtn);
      });
    }

    if (copyTableBtn) {
      copyTableBtn.addEventListener('click', function () {
        const lines = [];
        allCurrenciesBody.querySelectorAll('tr').forEach(function (tr) {
          const cols = tr.querySelectorAll('td');
          if (cols.length >= 2) {
            lines.push(cols[0].textContent.trim() + ': ' + cols[1].textContent.trim());
          }
        });
        window.ToolNest.copyToClipboard(lines.join('\n'), copyTableBtn);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        amountInput.value = '100';
        fromSelect.value = 'USD';
        toSelect.value = 'BDT';
        if (customRateCheck) customRateCheck.checked = false;
        if (bonusCheck) bonusCheck.checked = false;
        if (bonusPctInput) bonusPctInput.value = '2.5';
        if (bnDigitsCheck) bnDigitsCheck.checked = false;
        syncDefaultRateIntoCustomInput();
        updateConverterUI();
      });
    }

    syncDefaultRateIntoCustomInput();
    updateConverterUI();
    fetchLiveExchangeRates(false);
  });
})();
