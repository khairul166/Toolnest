/**
 * ToolNest - Loan EMI, FDR & DPS Calculator (/assets/js/tools/loan-emi-fdr-dps-calculator.js)
 * 100% Client-Side 3-Tab Financial Calculator:
 * 1) Loan EMI Calculator (Monthly installment, total interest, amortization schedule)
 * 2) FDR Calculator (Fixed Deposit Receipt maturity, quarterly/yearly compounding)
 * 3) DPS Calculator (Deposit Pension Scheme monthly recurring savings maturity)
 */
(function () {
  'use strict';

  function formatBDT(amount) {
    if (isNaN(amount) || !isFinite(amount)) return '৳ 0.00';
    return '৳ ' + Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // --- TAB 1: LOAN EMI ---
  function calculateEMI() {
    const pInput = document.getElementById('tn-emi-principal');
    const rInput = document.getElementById('tn-emi-rate');
    const tInput = document.getElementById('tn-emi-tenure');
    const uInput = document.getElementById('tn-emi-tenure-unit');

    if (!pInput || !rInput || !tInput) return;

    const principal = parseFloat(pInput.value) || 0;
    const annualRate = parseFloat(rInput.value) || 0;
    const tenureVal = parseFloat(tInput.value) || 0;
    const isYears = uInput ? uInput.value === 'years' : true;
    const totalMonths = isYears ? Math.round(tenureVal * 12) : Math.round(tenureVal);

    if (principal <= 0 || annualRate < 0 || totalMonths <= 0) {
      document.getElementById('tn-emi-monthly').textContent = '৳ 0.00';
      document.getElementById('tn-emi-total-interest').textContent = '৳ 0.00';
      document.getElementById('tn-emi-total-payment').textContent = '৳ 0.00';
      return;
    }

    const monthlyRate = annualRate / 12 / 100;
    const emi = monthlyRate === 0
      ? principal / totalMonths
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1);

    const totalPayment = emi * totalMonths;
    const totalInterest = totalPayment - principal;

    document.getElementById('tn-emi-monthly').textContent = formatBDT(emi);
    document.getElementById('tn-emi-total-interest').textContent = formatBDT(totalInterest);
    document.getElementById('tn-emi-total-payment').textContent = formatBDT(totalPayment);

    // Progress bar
    const pPercent = Math.round((principal / totalPayment) * 100);
    const iPercent = 100 - pPercent;
    const barP = document.getElementById('tn-emi-bar-principal');
    const barI = document.getElementById('tn-emi-bar-interest');
    const ratioText = document.getElementById('tn-emi-ratio-text');

    if (barP && barI) {
      barP.style.width = pPercent + '%';
      barP.textContent = 'Principal (' + pPercent + '%)';
      barI.style.width = iPercent + '%';
      barI.textContent = 'Interest (' + iPercent + '%)';
    }
    if (ratioText) {
      ratioText.textContent = pPercent + '% Principal / ' + iPercent + '% Interest';
    }

    // Populate Amortization Schedule
    const tbody = document.getElementById('tn-emi-schedule-body');
    if (tbody) {
      tbody.innerHTML = '';
      let balance = principal;
      const maxRows = Math.min(totalMonths, 360);

      for (let m = 1; m <= maxRows; m++) {
        const interestM = balance * monthlyRate;
        const principalM = emi - interestM;
        balance -= principalM;
        if (balance < 0) balance = 0;

        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + m + '</td>' +
          '<td>' + formatBDT(emi) + '</td>' +
          '<td>' + formatBDT(principalM) + '</td>' +
          '<td>' + formatBDT(interestM) + '</td>' +
          '<td>' + formatBDT(balance) + '</td>';
        tbody.appendChild(tr);
      }
    }
  }

  // --- TAB 2: FDR (FIXED DEPOSIT) ---
  function calculateFDR() {
    const pInput = document.getElementById('tn-fdr-principal');
    const rInput = document.getElementById('tn-fdr-rate');
    const tInput = document.getElementById('tn-fdr-tenure');
    const uInput = document.getElementById('tn-fdr-tenure-unit');
    const cInput = document.getElementById('tn-fdr-compound');

    if (!pInput || !rInput || !tInput) return;

    const principal = parseFloat(pInput.value) || 0;
    const annualRate = parseFloat(rInput.value) || 0;
    const tenureVal = parseFloat(tInput.value) || 0;
    const isYears = uInput ? uInput.value === 'years' : true;
    const tenureYears = isYears ? tenureVal : tenureVal / 12;
    const n = cInput ? parseInt(cInput.value, 10) || 4 : 4;

    if (principal <= 0 || annualRate < 0 || tenureYears <= 0) {
      document.getElementById('tn-fdr-maturity').textContent = '৳ 0.00';
      document.getElementById('tn-fdr-interest').textContent = '৳ 0.00';
      document.getElementById('tn-fdr-effective-rate').textContent = '0%';
      return;
    }

    const r = annualRate / 100;
    const maturity = principal * Math.pow(1 + r / n, n * tenureYears);
    const totalInterest = maturity - principal;
    const ear = (Math.pow(1 + r / n, n) - 1) * 100;

    document.getElementById('tn-fdr-maturity').textContent = formatBDT(maturity);
    document.getElementById('tn-fdr-interest').textContent = formatBDT(totalInterest);
    document.getElementById('tn-fdr-effective-rate').textContent = ear.toFixed(2) + '%';

    // Progress bar
    const pPercent = Math.round((principal / maturity) * 100);
    const iPercent = 100 - pPercent;
    const barP = document.getElementById('tn-fdr-bar-principal');
    const barI = document.getElementById('tn-fdr-bar-interest');
    const ratioText = document.getElementById('tn-fdr-ratio-text');

    if (barP && barI) {
      barP.style.width = pPercent + '%';
      barP.textContent = 'Deposit (' + pPercent + '%)';
      barI.style.width = iPercent + '%';
      barI.textContent = 'Interest (' + iPercent + '%)';
    }
    if (ratioText) {
      ratioText.textContent = pPercent + '% Deposit / ' + iPercent + '% Interest';
    }

    // Yearly Growth Table
    const tbody = document.getElementById('tn-fdr-yearly-body');
    if (tbody) {
      tbody.innerHTML = '';
      let openBal = principal;
      const fullYears = Math.ceil(tenureYears);

      for (let y = 1; y <= fullYears; y++) {
        const tY = y > tenureYears ? tenureYears : y;
        const closeBal = principal * Math.pow(1 + r / n, n * tY);
        const interestEarned = closeBal - openBal;

        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>Year ' + y + (y > tenureYears ? ' (Partial)' : '') + '</td>' +
          '<td>' + formatBDT(openBal) + '</td>' +
          '<td>' + formatBDT(interestEarned) + '</td>' +
          '<td>' + formatBDT(closeBal) + '</td>';
        tbody.appendChild(tr);

        openBal = closeBal;
      }
    }
  }

  // --- TAB 3: DPS (DEPOSIT PENSION SCHEME) ---
  function calculateDPS() {
    const mInput = document.getElementById('tn-dps-monthly');
    const rInput = document.getElementById('tn-dps-rate');
    const tInput = document.getElementById('tn-dps-tenure');
    const uInput = document.getElementById('tn-dps-tenure-unit');

    if (!mInput || !rInput || !tInput) return;

    const monthlyDeposit = parseFloat(mInput.value) || 0;
    const annualRate = parseFloat(rInput.value) || 0;
    const tenureVal = parseFloat(tInput.value) || 0;
    const isYears = uInput ? uInput.value === 'years' : true;
    const totalMonths = isYears ? Math.round(tenureVal * 12) : Math.round(tenureVal);

    if (monthlyDeposit <= 0 || annualRate < 0 || totalMonths <= 0) {
      document.getElementById('tn-dps-maturity').textContent = '৳ 0.00';
      document.getElementById('tn-dps-total-deposit').textContent = '৳ 0.00';
      document.getElementById('tn-dps-interest').textContent = '৳ 0.00';
      return;
    }

    const monthlyRate = annualRate / 12 / 100;
    const totalDeposited = monthlyDeposit * totalMonths;
    const maturity = monthlyRate === 0
      ? totalDeposited
      : monthlyDeposit * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate);
    const totalInterest = maturity - totalDeposited;

    document.getElementById('tn-dps-maturity').textContent = formatBDT(maturity);
    document.getElementById('tn-dps-total-deposit').textContent = formatBDT(totalDeposited);
    document.getElementById('tn-dps-interest').textContent = formatBDT(totalInterest);

    // Progress bar
    const dPercent = Math.round((totalDeposited / maturity) * 100);
    const iPercent = 100 - dPercent;
    const barD = document.getElementById('tn-dps-bar-deposit');
    const barI = document.getElementById('tn-dps-bar-interest');
    const ratioText = document.getElementById('tn-dps-ratio-text');

    if (barD && barI) {
      barD.style.width = dPercent + '%';
      barD.textContent = 'Deposits (' + dPercent + '%)';
      barI.style.width = iPercent + '%';
      barI.textContent = 'Interest (' + iPercent + '%)';
    }
    if (ratioText) {
      ratioText.textContent = dPercent + '% Deposits / ' + iPercent + '% Interest';
    }

    // Yearly Growth Table
    const tbody = document.getElementById('tn-dps-yearly-body');
    if (tbody) {
      tbody.innerHTML = '';
      const totalYears = Math.ceil(totalMonths / 12);
      let cumulativeDep = 0;

      for (let y = 1; y <= totalYears; y++) {
        const monthsInYear = Math.min(12, totalMonths - (y - 1) * 12);
        const monthsSoFar = (y - 1) * 12 + monthsInYear;
        const depThisYear = monthlyDeposit * monthsInYear;
        cumulativeDep += depThisYear;

        const balAtYear = monthlyRate === 0
          ? cumulativeDep
          : monthlyDeposit * ((Math.pow(1 + monthlyRate, monthsSoFar) - 1) / monthlyRate) * (1 + monthlyRate);
        const interestSoFar = balAtYear - cumulativeDep;

        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>Year ' + y + '</td>' +
          '<td>' + formatBDT(depThisYear) + '</td>' +
          '<td>' + formatBDT(cumulativeDep) + '</td>' +
          '<td>' + formatBDT(interestSoFar) + '</td>' +
          '<td>' + formatBDT(balAtYear) + '</td>';
        tbody.appendChild(tr);
      }
    }
  }

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', function () {
    ['tn-emi-principal', 'tn-emi-rate', 'tn-emi-tenure', 'tn-emi-tenure-unit'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', calculateEMI);
        el.addEventListener('change', calculateEMI);
      }
    });

    document.querySelectorAll('[data-emi-rate-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const rate = this.getAttribute('data-emi-rate-preset');
        const input = document.getElementById('tn-emi-rate');
        if (input) {
          input.value = rate;
          calculateEMI();
        }
      });
    });

    const emiScheduleBtn = document.getElementById('tn-emi-schedule-btn');
    if (emiScheduleBtn) {
      emiScheduleBtn.addEventListener('click', function () {
        const wrap = document.getElementById('tn-emi-schedule-wrap');
        if (wrap) {
          wrap.classList.toggle('d-none');
          emiScheduleBtn.textContent = wrap.classList.contains('d-none')
            ? 'Show Amortization Schedule'
            : 'Hide Amortization Schedule';
        }
      });
    }

    const emiCopyBtn = document.getElementById('tn-emi-copy-btn');
    if (emiCopyBtn) {
      emiCopyBtn.addEventListener('click', function () {
        const text =
          'Loan EMI Summary:\n' +
          'Monthly EMI: ' + document.getElementById('tn-emi-monthly').textContent + '\n' +
          'Total Interest: ' + document.getElementById('tn-emi-total-interest').textContent + '\n' +
          'Total Payable: ' + document.getElementById('tn-emi-total-payment').textContent;
        if (window.ToolNest && window.ToolNest.copyToClipboard) {
          window.ToolNest.copyToClipboard(text, emiCopyBtn);
        }
      });
    }

    const emiResetBtn = document.getElementById('tn-emi-reset-btn');
    if (emiResetBtn) {
      emiResetBtn.addEventListener('click', function () {
        document.getElementById('tn-emi-principal').value = '500000';
        document.getElementById('tn-emi-rate').value = '9';
        document.getElementById('tn-emi-tenure').value = '5';
        document.getElementById('tn-emi-tenure-unit').value = 'years';
        calculateEMI();
      });
    }

    // FDR Listeners
    ['tn-fdr-principal', 'tn-fdr-rate', 'tn-fdr-tenure', 'tn-fdr-tenure-unit', 'tn-fdr-compound'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', calculateFDR);
        el.addEventListener('change', calculateFDR);
      }
    });

    document.querySelectorAll('[data-fdr-rate-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const rate = this.getAttribute('data-fdr-rate-preset');
        const input = document.getElementById('tn-fdr-rate');
        if (input) {
          input.value = rate;
          calculateFDR();
        }
      });
    });

    const fdrCopyBtn = document.getElementById('tn-fdr-copy-btn');
    if (fdrCopyBtn) {
      fdrCopyBtn.addEventListener('click', function () {
        const text =
          'FDR Fixed Deposit Summary:\n' +
          'Maturity Amount: ' + document.getElementById('tn-fdr-maturity').textContent + '\n' +
          'Total Interest: ' + document.getElementById('tn-fdr-interest').textContent + '\n' +
          'Effective Annual Rate: ' + document.getElementById('tn-fdr-effective-rate').textContent;
        if (window.ToolNest && window.ToolNest.copyToClipboard) {
          window.ToolNest.copyToClipboard(text, fdrCopyBtn);
        }
      });
    }

    const fdrResetBtn = document.getElementById('tn-fdr-reset-btn');
    if (fdrResetBtn) {
      fdrResetBtn.addEventListener('click', function () {
        document.getElementById('tn-fdr-principal').value = '100000';
        document.getElementById('tn-fdr-rate').value = '7';
        document.getElementById('tn-fdr-tenure').value = '3';
        document.getElementById('tn-fdr-tenure-unit').value = 'years';
        document.getElementById('tn-fdr-compound').value = '4';
        calculateFDR();
      });
    }

    // DPS Listeners
    ['tn-dps-monthly', 'tn-dps-rate', 'tn-dps-tenure', 'tn-dps-tenure-unit'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', calculateDPS);
        el.addEventListener('change', calculateDPS);
      }
    });

    document.querySelectorAll('[data-dps-rate-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const rate = this.getAttribute('data-dps-rate-preset');
        const input = document.getElementById('tn-dps-rate');
        if (input) {
          input.value = rate;
          calculateDPS();
        }
      });
    });

    const dpsCopyBtn = document.getElementById('tn-dps-copy-btn');
    if (dpsCopyBtn) {
      dpsCopyBtn.addEventListener('click', function () {
        const text =
          'DPS Savings Summary:\n' +
          'Maturity Amount: ' + document.getElementById('tn-dps-maturity').textContent + '\n' +
          'Total Deposited: ' + document.getElementById('tn-dps-total-deposit').textContent + '\n' +
          'Total Interest: ' + document.getElementById('tn-dps-interest').textContent;
        if (window.ToolNest && window.ToolNest.copyToClipboard) {
          window.ToolNest.copyToClipboard(text, dpsCopyBtn);
        }
      });
    }

    const dpsResetBtn = document.getElementById('tn-dps-reset-btn');
    if (dpsResetBtn) {
      dpsResetBtn.addEventListener('click', function () {
        document.getElementById('tn-dps-monthly').value = '5000';
        document.getElementById('tn-dps-rate').value = '7';
        document.getElementById('tn-dps-tenure').value = '5';
        document.getElementById('tn-dps-tenure-unit').value = 'years';
        calculateDPS();
      });
    }

    // Calculate all initial values
    calculateEMI();
    calculateFDR();
    calculateDPS();
  });
})();
