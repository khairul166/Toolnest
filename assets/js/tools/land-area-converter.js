/**
 * ToolNest - Land Area Converter (/assets/js/tools/land-area-converter.js)
 * 100% Client-Side Land Measurement Converter for Bangladesh & Global Users.
 * Converts between Square Feet, Square Meter, Square Yard, Katha, Bigha, Decimal (Shatak),
 * Acre, and Hectare with Region Standards, Custom Katha/Bigha overrides, and Bangla Digits toggle.
 */
(function () {
  'use strict';

  /**
   * Single Editable Configuration Object for All Land Area Conversion Factors
   * Base unit: Square Feet (sq ft)
   * Exact values required:
   * - 1 acre = 43,560 sq ft
   * - 1 decimal = 435.6 sq ft
   * - 1 sq yd = 9 sq ft
   * - 1 sq m = 10.7639 sq ft
   */
  const LAND_CONVERSION_CONFIG = {
    baseUnit: 'sqft',
    units: [
      { id: 'sqft', name: 'Square Feet (sq ft)', nameBn: 'বর্গফুট (Sq Ft)', sqFtFactor: 1 },
      { id: 'sqm', name: 'Square Meter (sq m)', nameBn: 'বর্গমিটার (Sq Meter)', sqFtFactor: 10.7639 },
      { id: 'sqyd', name: 'Square Yard (sq yd / Gaj)', nameBn: 'বর্গগজ (Sq Yard)', sqFtFactor: 9 },
      { id: 'decimal', name: 'Decimal / Shatak (শতক)', nameBn: 'শতক / ডেসিমেল (Decimal)', sqFtFactor: 435.6 },
      { id: 'katha', name: 'Katha (কাঠা)', nameBn: 'কাঠা (Katha)', sqFtFactor: 720 },
      { id: 'bigha', name: 'Bigha (বিঘা)', nameBn: 'বিঘা (Bigha)', sqFtFactor: 14400 },
      { id: 'acre', name: 'Acre (একর)', nameBn: 'একর (Acre)', sqFtFactor: 43560 },
      { id: 'hectare', name: 'Hectare (হেক্টর)', nameBn: 'হেক্টর (Hectare)', sqFtFactor: 107639 }
    ],
    regionStandards: [
      {
        id: 'common',
        label: 'Common Standard (1 Katha = 720 sq ft, 1 Bigha = 20 Katha / 14,400 sq ft)',
        kathaSqFt: 720,
        bighaSqFt: 14400
      },
      {
        id: 'mymensingh',
        label: 'Mymensingh / Tangail Local (1 Katha = 2,831.4 sq ft / 6.5 Decimal, 1 Bigha = 20 Katha)',
        kathaSqFt: 2831.4,
        bighaSqFt: 56628
      },
      {
        id: 'rajshahi',
        label: 'Rajshahi / Northern Local (1 Katha = 720 sq ft, 1 Bigha = 33 Decimal / 14,374.8 sq ft)',
        kathaSqFt: 720,
        bighaSqFt: 14374.8
      },
      {
        id: 'custom',
        label: 'Custom Regional Standard (Enter your own sq ft per Katha & Bigha)',
        kathaSqFt: 720,
        bighaSqFt: 14400
      }
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

  function formatLandNumber(num, useBanglaDigits) {
    if (!Number.isFinite(num)) return '0';
    let formatted;
    if (num === 0) {
      formatted = '0';
    } else if (Math.abs(num) >= 1000) {
      formatted = num.toLocaleString('en-US', { maximumFractionDigits: 4 });
    } else if (Math.abs(num) >= 1) {
      formatted = Number(num.toFixed(4)).toString();
    } else {
      formatted = Number(num.toFixed(6)).toString();
    }
    return useBanglaDigits ? toBanglaDigits(formatted) : formatted;
  }

  function getActiveFactors(regionId, customKathaSqFt, customBighaSqFt) {
    const reg =
      LAND_CONVERSION_CONFIG.regionStandards.find(function (r) {
        return r.id === regionId;
      }) || LAND_CONVERSION_CONFIG.regionStandards[0];

    const kathaVal = regionId === 'custom' ? Math.max(1, Number(customKathaSqFt) || 720) : reg.kathaSqFt;
    const bighaVal = regionId === 'custom' ? Math.max(1, Number(customBighaSqFt) || 14400) : reg.bighaSqFt;

    const map = {};
    LAND_CONVERSION_CONFIG.units.forEach(function (u) {
      if (u.id === 'katha') {
        map[u.id] = kathaVal;
      } else if (u.id === 'bigha') {
        map[u.id] = bighaVal;
      } else {
        map[u.id] = u.sqFtFactor;
      }
    });
    return map;
  }

  function convertLandArea(value, fromUnit, toUnit, factorsMap) {
    const val = Number(value);
    if (!Number.isFinite(val) || val < 0) return 0;
    const fromFactor = factorsMap[fromUnit] || 1;
    const toFactor = factorsMap[toUnit] || 1;
    const totalSqFt = val * fromFactor;
    return totalSqFt / toFactor;
  }

  // Expose pure calculation helpers for automated verification
  if (typeof window !== 'undefined') {
    window.ToolNestLandConverter = {
      config: LAND_CONVERSION_CONFIG,
      getActiveFactors: getActiveFactors,
      convertLandArea: convertLandArea
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const valInput = document.getElementById('tn-land-value');
    const fromSelect = document.getElementById('tn-land-from');
    const toSelect = document.getElementById('tn-land-to');
    const swapBtn = document.getElementById('tn-land-swap-btn');
    const regionSelect = document.getElementById('tn-land-region');
    const customGroup = document.getElementById('tn-land-custom-group');
    const customKathaInput = document.getElementById('tn-land-custom-katha');
    const customBighaInput = document.getElementById('tn-land-custom-bigha');
    const bnDigitsToggle = document.getElementById('tn-land-bn-digits');

    const primaryResultVal = document.getElementById('tn-land-result-val');
    const primaryResultSub = document.getElementById('tn-land-result-sub');
    const allUnitsTableBody = document.getElementById('tn-land-table-body');
    const copyResultBtn = document.getElementById('tn-land-copy-btn');
    const copyTableBtn = document.getElementById('tn-land-copy-table-btn');
    const resetBtn = document.getElementById('tn-land-reset-btn');

    if (!valInput || !fromSelect || !toSelect) return;

    // Populate Unit Dropdowns & Region Dropdown
    LAND_CONVERSION_CONFIG.units.forEach(function (u) {
      const opt1 = document.createElement('option');
      opt1.value = u.id;
      opt1.textContent = u.name;
      fromSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = u.id;
      opt2.textContent = u.name;
      toSelect.appendChild(opt2);
    });
    fromSelect.value = 'katha';
    toSelect.value = 'sqft';

    LAND_CONVERSION_CONFIG.regionStandards.forEach(function (r) {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.label;
      regionSelect.appendChild(opt);
    });

    function updateCalculation() {
      const regionId = regionSelect.value;
      if (customGroup) {
        customGroup.classList.toggle('d-none', regionId !== 'custom');
      }

      const factors = getActiveFactors(
        regionId,
        customKathaInput ? customKathaInput.value : 720,
        customBighaInput ? customBighaInput.value : 14400
      );

      const rawVal = parseFloat(valInput.value);
      const validVal = Number.isFinite(rawVal) && rawVal >= 0 ? rawVal : 0;
      const fromId = fromSelect.value;
      const toId = toSelect.value;
      const useBn = Boolean(bnDigitsToggle && bnDigitsToggle.checked);

      const fromUnitObj = LAND_CONVERSION_CONFIG.units.find(function (u) {
        return u.id === fromId;
      });
      const toUnitObj = LAND_CONVERSION_CONFIG.units.find(function (u) {
        return u.id === toId;
      });

      const converted = convertLandArea(validVal, fromId, toId, factors);
      const totalSqFt = validVal * (factors[fromId] || 1);

      primaryResultVal.textContent = formatLandNumber(converted, useBn) + ' ' + (toUnitObj ? toUnitObj.name : toId);
      primaryResultSub.textContent =
        formatLandNumber(validVal, useBn) +
        ' ' +
        (fromUnitObj ? fromUnitObj.name : fromId) +
        ' = ' +
        formatLandNumber(totalSqFt, useBn) +
        ' Square Feet (sq ft)';

      if (allUnitsTableBody) {
        allUnitsTableBody.innerHTML = LAND_CONVERSION_CONFIG.units
          .map(function (u) {
            const uVal = totalSqFt / (factors[u.id] || 1);
            const isTarget = u.id === toId;
            const rowClass = isTarget ? 'table-primary fw-bold' : '';
            const factorDesc = formatLandNumber(factors[u.id], useBn) + ' sq ft';
            return (
              '<tr class="' +
              rowClass +
              '">' +
              '<td>' +
              window.ToolNest.escapeHtml(u.name) +
              '</td>' +
              '<td class="tn-bangla-text text-muted">' +
              window.ToolNest.escapeHtml(u.nameBn) +
              '</td>' +
              '<td class="font-monospace fw-bold text-primary">' +
              formatLandNumber(uVal, useBn) +
              '</td>' +
              '<td class="small text-muted">1 unit = ' +
              factorDesc +
              '</td>' +
              '</tr>'
            );
          })
          .join('');
      }
    }

    [valInput, fromSelect, toSelect, regionSelect, customKathaInput, customBighaInput, bnDigitsToggle].forEach(function (el) {
      if (!el) return;
      el.addEventListener('input', updateCalculation);
      el.addEventListener('change', updateCalculation);
    });

    if (swapBtn) {
      swapBtn.addEventListener('click', function () {
        const tmp = fromSelect.value;
        fromSelect.value = toSelect.value;
        toSelect.value = tmp;
        updateCalculation();
      });
    }

    // Quick Preset Buttons
    document.querySelectorAll('[data-land-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        valInput.value = btn.getAttribute('data-land-val') || '1';
        fromSelect.value = btn.getAttribute('data-land-from') || 'katha';
        toSelect.value = btn.getAttribute('data-land-to') || 'decimal';
        updateCalculation();
      });
    });

    if (copyResultBtn) {
      copyResultBtn.addEventListener('click', function () {
        const text = primaryResultVal.textContent + ' (' + primaryResultSub.textContent + ')';
        window.ToolNest.copyToClipboard(text, copyResultBtn);
      });
    }

    if (copyTableBtn) {
      copyTableBtn.addEventListener('click', function () {
        const rows = [];
        allUnitsTableBody.querySelectorAll('tr').forEach(function (tr) {
          const cols = tr.querySelectorAll('td');
          if (cols.length >= 3) {
            rows.push(cols[0].textContent + ': ' + cols[2].textContent);
          }
        });
        window.ToolNest.copyToClipboard(rows.join('\n'), copyTableBtn);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        valInput.value = '1';
        fromSelect.value = 'katha';
        toSelect.value = 'sqft';
        regionSelect.value = 'common';
        if (bnDigitsToggle) bnDigitsToggle.checked = false;
        updateCalculation();
      });
    }

    updateCalculation();
  });
})();
