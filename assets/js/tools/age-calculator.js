/**
 * ToolNest - Exact Age Calculator (/assets/js/tools/age-calculator.js)
 * Calculates chronological age in years, months, days, total time units,
 * and next birthday countdown 100% in the browser.
 */
(function () {
  'use strict';

  const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_NAMES_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

  function toBanglaDigits(str) {
    const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/\d/g, function (d) {
      return bn[Number(d)];
    });
  }

  function formatDateYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function calculateExactAge(dob, target) {
    let years = target.getFullYear() - dob.getFullYear();
    let months = target.getMonth() - dob.getMonth();
    let days = target.getDate() - dob.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonthLastDay = new Date(target.getFullYear(), target.getMonth(), 0).getDate();
      days += prevMonthLastDay;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const diffMs = target.getTime() - dob.getTime();
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.floor(totalDays / 7);
    const remWeekDays = totalDays % 7;
    const totalMonths = years * 12 + months;
    const totalHours = totalDays * 24;

    // Next Birthday calculation relative to target date
    let nextBdayYear = target.getFullYear();
    let nextBday = new Date(nextBdayYear, dob.getMonth(), dob.getDate());
    if (
      nextBday.getTime() < target.getTime() &&
      !(nextBday.getMonth() === target.getMonth() && nextBday.getDate() === target.getDate())
    ) {
      nextBdayYear += 1;
      nextBday = new Date(nextBdayYear, dob.getMonth(), dob.getDate());
    }

    let nbMonths = nextBday.getMonth() - target.getMonth();
    let nbDays = nextBday.getDate() - target.getDate();
    if (nbDays < 0) {
      nbMonths -= 1;
      const prevLast = new Date(nextBday.getFullYear(), nextBday.getMonth(), 0).getDate();
      nbDays += prevLast;
    }
    if (nbMonths < 0) {
      nbMonths += 12;
    }
    const isBirthdayToday = nbMonths === 0 && nbDays === 0;
    const nextBdayTotalDays = Math.round((nextBday.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

    return {
      years: years,
      months: months,
      days: days,
      totalMonths: totalMonths,
      totalWeeks: totalWeeks,
      remWeekDays: remWeekDays,
      totalDays: totalDays,
      totalHours: totalHours,
      birthDayNameEn: DAY_NAMES_EN[dob.getDay()],
      birthDayNameBn: DAY_NAMES_BN[dob.getDay()],
      nextBdayMonths: nbMonths,
      nextBdayDays: nbDays,
      nextBdayTotalDays: nextBdayTotalDays,
      nextBdayDayName: DAY_NAMES_EN[nextBday.getDay()],
      isBirthdayToday: isBirthdayToday
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dobInput = document.getElementById('tn-age-dob');
    const targetInput = document.getElementById('tn-age-target');
    const btnCalc = document.getElementById('tn-age-calc-btn');
    const btnSample = document.getElementById('tn-age-sample-btn');
    const btnReset = document.getElementById('tn-age-reset-btn');
    const btnCopy = document.getElementById('tn-age-copy-btn');
    const errBox = document.getElementById('tn-age-error');
    const resultsWrap = document.getElementById('tn-age-results');

    if (!dobInput || !targetInput) return;

    const today = new Date();
    const todayClean = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    targetInput.value = formatDateYMD(todayClean);
    dobInput.value = '1998-05-15';

    function runAgeCalculation() {
      if (!dobInput.value || !targetInput.value) {
        errBox.textContent = 'Please select both Date of Birth and Target Date.';
        errBox.classList.remove('d-none');
        return;
      }

      const dobParts = dobInput.value.split('-').map(Number);
      const targetParts = targetInput.value.split('-').map(Number);
      const dobDate = new Date(dobParts[0], dobParts[1] - 1, dobParts[2]);
      const targetDate = new Date(targetParts[0], targetParts[1] - 1, targetParts[2]);

      if (dobDate.getTime() > targetDate.getTime()) {
        errBox.textContent = 'Date of Birth cannot be after the Target / Age at Date. Please pick an earlier birth date.';
        errBox.classList.remove('d-none');
        resultsWrap.classList.add('d-none');
        return;
      }

      errBox.classList.add('d-none');
      resultsWrap.classList.remove('d-none');

      const res = calculateExactAge(dobDate, targetDate);

      document.getElementById('tn-age-years').textContent = res.years;
      document.getElementById('tn-age-months').textContent = res.months;
      document.getElementById('tn-age-days').textContent = res.days;

      const summaryEn = res.years + ' Years, ' + res.months + ' Months, and ' + res.days + ' Days';
      const summaryBn =
        toBanglaDigits(res.years) + ' বছর, ' + toBanglaDigits(res.months) + ' মাস, ' + toBanglaDigits(res.days) + ' দিন';

      document.getElementById('tn-age-summary-en').textContent = summaryEn;
      document.getElementById('tn-age-summary-bn').textContent = summaryBn + ' (জন্মবার: ' + res.birthDayNameBn + ')';

      const nextBdayEl = document.getElementById('tn-age-next-bday');
      if (res.isBirthdayToday) {
        nextBdayEl.textContent = 'Happy Birthday! Today is the exact birthday!';
      } else {
        nextBdayEl.textContent =
          res.nextBdayMonths +
          ' months, ' +
          res.nextBdayDays +
          ' days (' +
          res.nextBdayTotalDays +
          ' total days left, falls on ' +
          res.nextBdayDayName +
          ')';
      }

      document.getElementById('tn-age-total-months').textContent = res.totalMonths.toLocaleString() + ' months, ' + res.days + ' days';
      document.getElementById('tn-age-total-weeks').textContent = res.totalWeeks.toLocaleString() + ' weeks, ' + res.remWeekDays + ' days';
      document.getElementById('tn-age-total-days').textContent = res.totalDays.toLocaleString() + ' days';
      document.getElementById('tn-age-total-hours').textContent = res.totalHours.toLocaleString() + ' hours';
      document.getElementById('tn-age-born-day').textContent = res.birthDayNameEn + ' (' + res.birthDayNameBn + ')';
    }

    btnCalc.addEventListener('click', function () {
      runAgeCalculation();
      window.ToolNest.showToast('Exact age calculated!', 'success');
    });

    dobInput.addEventListener('change', runAgeCalculation);
    targetInput.addEventListener('change', runAgeCalculation);

    if (btnSample) {
      btnSample.addEventListener('click', function () {
        dobInput.value = '1999-11-20';
        targetInput.value = formatDateYMD(todayClean);
        runAgeCalculation();
        window.ToolNest.showToast('Sample date of birth loaded!', 'success');
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', function () {
        dobInput.value = '2000-01-01';
        targetInput.value = formatDateYMD(todayClean);
        runAgeCalculation();
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', function () {
        const text =
          'Exact Age: ' +
          document.getElementById('tn-age-summary-en').textContent +
          '\nBangla: ' +
          document.getElementById('tn-age-summary-bn').textContent +
          '\nNext Birthday: ' +
          document.getElementById('tn-age-next-bday').textContent +
          '\nTotal Days: ' +
          document.getElementById('tn-age-total-days').textContent;
        window.ToolNest.copyToClipboard(text, btnCopy);
      });
    }

    runAgeCalculation();
  });
})();
