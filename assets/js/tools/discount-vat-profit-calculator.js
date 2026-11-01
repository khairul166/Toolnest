/**
 * ToolNest - Discount, VAT & Profit Calculator (/assets/js/tools/discount-vat-profit-calculator.js)
 * 100% Client-Side 3-Tab Business & F-Commerce Financial Calculator:
 * 1) Discount Calculator (Percentage or Fixed + Optional Extra Stacked Discount)
 * 2) VAT Calculator (Add VAT or Extract VAT from Inclusive Price with Editable Rate)
 * 3) Profit Margin & F-Commerce Net Profit Calculator (Standard + Reverse Target Margin Mode)
 */
(function () {
  'use strict';

  /**
   * Editable Configuration Constant for Default VAT Rate & Currency Options
   */
  const DEFAULT_FINANCE_CONFIG = {
    defaultVatRate: 15, // Standard 15% VAT default (editable by user)
    defaultCurrency: '৳',
    currencies: [
      { symbol: '৳', label: '৳ (BDT — Bangladeshi Taka)' },
      { symbol: '$', label: '$ (USD — US Dollar)' },
      { symbol: '€', label: '€ (EUR — Euro)' },
      { symbol: '£', label: '£ (GBP — British Pound)' },
      { symbol: '₹', label: '₹ (INR — Indian Rupee)' }
    ]
  };

  function fmtMoney(val, symbol) {
    const safe = Number.isFinite(val) ? val : 0;
    return (symbol || '৳') + ' ' + safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPct(val) {
    const safe = Number.isFinite(val) ? val : 0;
    return Number(safe.toFixed(2)) + '%';
  }

  /**
   * Tab 1: Discount Calculation
   */
  function calculateDiscount(origPrice, discType, discValue, extraDiscPct) {
    const price = Math.max(0, Number(origPrice) || 0);
    const val = Math.max(0, Number(discValue) || 0);
    const extraPct = Math.min(100, Math.max(0, Number(extraDiscPct) || 0));

    let firstDiscountAmt = 0;
    if (discType === 'amount') {
      firstDiscountAmt = Math.min(price, val);
    } else {
      const pct = Math.min(100, val);
      firstDiscountAmt = price * (pct / 100);
    }

    const priceAfterFirst = Math.max(0, price - firstDiscountAmt);
    const secondDiscountAmt = priceAfterFirst * (extraPct / 100);
    const totalSaved = firstDiscountAmt + secondDiscountAmt;
    const finalPrice = Math.max(0, price - totalSaved);
    const effectivePct = price > 0 ? (totalSaved / price) * 100 : 0;

    return {
      originalPrice: price,
      firstDiscountAmt: firstDiscountAmt,
      secondDiscountAmt: secondDiscountAmt,
      totalSaved: totalSaved,
      finalPrice: finalPrice,
      effectivePct: effectivePct
    };
  }

  /**
   * Tab 2: VAT Calculation (Add Exclusive VAT or Remove Inclusive VAT)
   */
  function calculateVat(amount, vatRatePct, mode) {
    const price = Math.max(0, Number(amount) || 0);
    const rate = Math.max(0, Number(vatRatePct) || 0);

    if (mode === 'remove') {
      // Price is VAT-inclusive: Net = Gross / (1 + rate/100)
      const netPrice = price / (1 + rate / 100);
      const vatAmount = price - netPrice;
      return {
        netPrice: netPrice,
        vatAmount: vatAmount,
        grossPrice: price,
        rate: rate
      };
    }

    // Default 'add': Price is VAT-exclusive
    const vatAmount = price * (rate / 100);
    const grossPrice = price + vatAmount;
    return {
      netPrice: price,
      vatAmount: vatAmount,
      grossPrice: grossPrice,
      rate: rate
    };
  }

  /**
   * Tab 3: Profit Margin & F-Commerce Net Profit Calculation
   */
  function calculateProfit(params) {
    const cost = Math.max(0, Number(params.costPrice) || 0);
    const mode = params.mode || 'standard';
    let selling = Math.max(0, Number(params.sellingPrice) || 0);

    if (mode === 'reverse') {
      // Reverse mode: Cost + Target Margin % -> Required Selling Price
      const targetMargin = Math.min(99.9, Math.max(0, Number(params.targetMarginPct) || 0));
      selling = targetMargin < 100 ? cost / (1 - targetMargin / 100) : cost;
    }

    const grossProfit = selling - cost;
    const grossMarginPct = selling > 0 ? (grossProfit / selling) * 100 : 0;
    const markupPct = cost > 0 ? (grossProfit / cost) * 100 : 0;

    // F-Commerce extra per-order costs
    const delivery = Math.max(0, Number(params.deliveryCost) || 0);
    const packaging = Math.max(0, Number(params.packagingCost) || 0);
    const adCost = Math.max(0, Number(params.adCost) || 0);
    const returnLoss = Math.max(0, Number(params.returnAllowance) || 0);

    const totalExtraCosts = delivery + packaging + adCost + returnLoss;
    const netProfitPerOrder = grossProfit - totalExtraCosts;
    const netMarginPct = selling > 0 ? (netProfitPerOrder / selling) * 100 : 0;

    return {
      costPrice: cost,
      sellingPrice: selling,
      grossProfit: grossProfit,
      grossMarginPct: grossMarginPct,
      markupPct: markupPct,
      totalExtraCosts: totalExtraCosts,
      netProfitPerOrder: netProfitPerOrder,
      netMarginPct: netMarginPct
    };
  }

  // Expose pure calculation helpers for automated verification
  if (typeof window !== 'undefined') {
    window.ToolNestFinanceCalc = {
      config: DEFAULT_FINANCE_CONFIG,
      calculateDiscount: calculateDiscount,
      calculateVat: calculateVat,
      calculateProfit: calculateProfit
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const currencySelect = document.getElementById('tn-dvp-currency');

    // Tab 1: Discount Elements
    const discOrigInput = document.getElementById('tn-disc-orig');
    const discTypeSelect = document.getElementById('tn-disc-type');
    const discValInput = document.getElementById('tn-disc-val');
    const discExtraInput = document.getElementById('tn-disc-extra');
    const discFinalOut = document.getElementById('tn-disc-final');
    const discSavedOut = document.getElementById('tn-disc-saved');
    const discEffOut = document.getElementById('tn-disc-eff');
    const discCopyBtn = document.getElementById('tn-disc-copy-btn');
    const discResetBtn = document.getElementById('tn-disc-reset-btn');

    // Tab 2: VAT Elements
    const vatAmountInput = document.getElementById('tn-vat-amount');
    const vatRateInput = document.getElementById('tn-vat-rate');
    const vatModeSelect = document.getElementById('tn-vat-mode');
    const vatNetOut = document.getElementById('tn-vat-net');
    const vatTaxOut = document.getElementById('tn-vat-tax');
    const vatGrossOut = document.getElementById('tn-vat-gross');
    const vatCopyBtn = document.getElementById('tn-vat-copy-btn');
    const vatResetBtn = document.getElementById('tn-vat-reset-btn');

    // Tab 3: Profit & F-Commerce Elements
    const profModeSelect = document.getElementById('tn-prof-mode');
    const profCostInput = document.getElementById('tn-prof-cost');
    const profSellWrap = document.getElementById('tn-prof-sell-wrap');
    const profSellInput = document.getElementById('tn-prof-sell');
    const profTargetWrap = document.getElementById('tn-prof-target-wrap');
    const profTargetInput = document.getElementById('tn-prof-target');

    const profDeliveryInput = document.getElementById('tn-prof-delivery');
    const profPackInput = document.getElementById('tn-prof-pack');
    const profAdInput = document.getElementById('tn-prof-ad');
    const profReturnInput = document.getElementById('tn-prof-return');

    const profSellingOut = document.getElementById('tn-prof-out-selling');
    const profGrossOut = document.getElementById('tn-prof-out-gross');
    const profMarginOut = document.getElementById('tn-prof-out-margin');
    const profMarkupOut = document.getElementById('tn-prof-out-markup');
    const profNetOut = document.getElementById('tn-prof-out-net');
    const profNetMarginOut = document.getElementById('tn-prof-out-net-margin');
    const profCopyBtn = document.getElementById('tn-prof-copy-btn');
    const profResetBtn = document.getElementById('tn-prof-reset-btn');

    if (!currencySelect || !discOrigInput) return;

    // Populate Currency Dropdown & Default VAT Rate
    DEFAULT_FINANCE_CONFIG.currencies.forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c.symbol;
      opt.textContent = c.label;
      currencySelect.appendChild(opt);
    });
    currencySelect.value = DEFAULT_FINANCE_CONFIG.defaultCurrency;
    if (vatRateInput) {
      vatRateInput.value = String(DEFAULT_FINANCE_CONFIG.defaultVatRate);
    }

    function getSym() {
      return currencySelect.value || '৳';
    }

    function updateAllCalculations() {
      const sym = getSym();

      // 1. Discount
      const dRes = calculateDiscount(
        discOrigInput.value,
        discTypeSelect.value,
        discValInput.value,
        discExtraInput.value
      );
      discFinalOut.textContent = fmtMoney(dRes.finalPrice, sym);
      discSavedOut.textContent = fmtMoney(dRes.totalSaved, sym);
      discEffOut.textContent = fmtPct(dRes.effectivePct);

      // 2. VAT
      const vRes = calculateVat(vatAmountInput.value, vatRateInput.value, vatModeSelect.value);
      vatNetOut.textContent = fmtMoney(vRes.netPrice, sym);
      vatTaxOut.textContent = fmtMoney(vRes.vatAmount, sym);
      vatGrossOut.textContent = fmtMoney(vRes.grossPrice, sym);

      // 3. Profit & F-Commerce
      const isRev = profModeSelect.value === 'reverse';
      profSellWrap.classList.toggle('d-none', isRev);
      profTargetWrap.classList.toggle('d-none', !isRev);

      const pRes = calculateProfit({
        mode: profModeSelect.value,
        costPrice: profCostInput.value,
        sellingPrice: profSellInput.value,
        targetMarginPct: profTargetInput.value,
        deliveryCost: profDeliveryInput.value,
        packagingCost: profPackInput.value,
        adCost: profAdInput.value,
        returnAllowance: profReturnInput.value
      });

      profSellingOut.textContent = fmtMoney(pRes.sellingPrice, sym);
      profGrossOut.textContent = fmtMoney(pRes.grossProfit, sym);
      profMarginOut.textContent = fmtPct(pRes.grossMarginPct);
      profMarkupOut.textContent = fmtPct(pRes.markupPct);
      profNetOut.textContent = fmtMoney(pRes.netProfitPerOrder, sym);
      profNetOut.className = 'tn-stat-card__value ' + (pRes.netProfitPerOrder >= 0 ? 'text-success' : 'text-danger');
      profNetMarginOut.textContent = 'Net Margin: ' + fmtPct(pRes.netMarginPct) + ' (Extra Costs: ' + fmtMoney(pRes.totalExtraCosts, sym) + ')';
    }

    // Bind live input listeners
    [
      currencySelect,
      discOrigInput,
      discTypeSelect,
      discValInput,
      discExtraInput,
      vatAmountInput,
      vatRateInput,
      vatModeSelect,
      profModeSelect,
      profCostInput,
      profSellInput,
      profTargetInput,
      profDeliveryInput,
      profPackInput,
      profAdInput,
      profReturnInput
    ].forEach(function (el) {
      if (!el) return;
      el.addEventListener('input', updateAllCalculations);
      el.addEventListener('change', updateAllCalculations);
    });

    // Quick VAT Rate Pills
    document.querySelectorAll('[data-vat-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        vatRateInput.value = btn.getAttribute('data-vat-preset') || '15';
        updateAllCalculations();
      });
    });

    // Copy & Reset Buttons
    if (discCopyBtn) {
      discCopyBtn.addEventListener('click', function () {
        const txt =
          'Final Price: ' +
          discFinalOut.textContent +
          ' | You Save: ' +
          discSavedOut.textContent +
          ' (' +
          discEffOut.textContent +
          ' off)';
        window.ToolNest.copyToClipboard(txt, discCopyBtn);
      });
    }

    if (discResetBtn) {
      discResetBtn.addEventListener('click', function () {
        discOrigInput.value = '2500';
        discTypeSelect.value = 'percent';
        discValInput.value = '20';
        discExtraInput.value = '0';
        updateAllCalculations();
      });
    }

    if (vatCopyBtn) {
      vatCopyBtn.addEventListener('click', function () {
        const txt =
          'Net Price: ' +
          vatNetOut.textContent +
          ' | VAT (' +
          vatRateInput.value +
          '%): ' +
          vatTaxOut.textContent +
          ' | Gross Total: ' +
          vatGrossOut.textContent;
        window.ToolNest.copyToClipboard(txt, vatCopyBtn);
      });
    }

    if (vatResetBtn) {
      vatResetBtn.addEventListener('click', function () {
        vatAmountInput.value = '1000';
        vatRateInput.value = String(DEFAULT_FINANCE_CONFIG.defaultVatRate);
        vatModeSelect.value = 'add';
        updateAllCalculations();
      });
    }

    if (profCopyBtn) {
      profCopyBtn.addEventListener('click', function () {
        const txt =
          'Selling Price: ' +
          profSellingOut.textContent +
          ' | Gross Profit: ' +
          profGrossOut.textContent +
          ' (Margin: ' +
          profMarginOut.textContent +
          ', Markup: ' +
          profMarkupOut.textContent +
          ') | Net Profit/Order: ' +
          profNetOut.textContent;
        window.ToolNest.copyToClipboard(txt, profCopyBtn);
      });
    }

    if (profResetBtn) {
      profResetBtn.addEventListener('click', function () {
        profModeSelect.value = 'standard';
        profCostInput.value = '600';
        profSellInput.value = '1100';
        profTargetInput.value = '40';
        profDeliveryInput.value = '80';
        profPackInput.value = '25';
        profAdInput.value = '90';
        profReturnInput.value = '35';
        updateAllCalculations();
      });
    }

    updateAllCalculations();
  });
})();
