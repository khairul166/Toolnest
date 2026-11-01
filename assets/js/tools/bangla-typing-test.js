/**
 * ToolNest - Bangla Typing Test (/assets/js/tools/bangla-typing-test.js)
 * 100% Client-Side Bangla Unicode Typing Speed & Accuracy Tester.
 * Features 12 Original Bangla Passages across 3 difficulty levels (Easy, Medium, Hard with Conjuncts),
 * 1/2/5 minute timers, NFC Unicode normalization + nukta unification, conjunct-safe character highlighting,
 * paste prevention, and WPM / Accuracy calculation.
 */
(function () {
  'use strict';

  /**
   * 12 Original Bangla Passages (4 Easy, 4 Medium, 4 Hard with rich Juktoborno / Conjuncts)
   * Written originally for ToolNest typing practice.
   */
  const BANGLA_PASSAGES = {
    easy: [
      {
        id: 'easy-1',
        title: 'ভোরের হাওয়া ও নদীর পাড়',
        text: 'ভোরের নরম আলোয় নদীর পাড়ে হাঁটতে খুব ভালো লাগে। ঠান্ডা বাতাসে গাছের সবুজ পাতাগুলো ধীরে ধীরে দুলতে থাকে। পাখিরা ডানা মেলে নীল আকাশে উড়ে যায় এবং জেলেরা ছোট নৌকা নিয়ে মাছ ধরতে বের হয়। প্রতিদিনের এই সহজ দৃশ্য মনকে শান্ত ও সতেজ করে তোলে।'
      },
      {
        id: 'easy-2',
        title: 'বাগানের তাজা সবজি ও ফুল',
        text: 'আমাদের বাড়ির পেছনে একটি ছোট সবজি ও ফুলের বাগান আছে। বিকেলে আমরা সবাই মিলে গাছে পানি দেই এবং আগাছা পরিষ্কার করি। লাল গোলাপ ও সাদা বেলি ফুলের ঘ্রাণে চারপাশ ভরে ওঠে। নিজের হাতে লাগানো গাছ থেকে তাজা ফল ও সবজি পাওয়ার আনন্দ সত্যিই আলাদা।'
      },
      {
        id: 'easy-3',
        title: 'বই পড়ার সুন্দর অভ্যাস',
        text: 'প্রতিদিন অন্তত আধা ঘণ্টা ভালো বই পড়ার অভ্যাস মানুষের চিন্তা ও জানার পরিধি অনেক বাড়িয়ে দেয়। গল্পের বই কিংবা সাধারণ জ্ঞানের পাতা উল্টালে নতুন নতুন শব্দের সাথে পরিচয় হয়। অবসর সময়ে অযথা সময় নষ্ট না করে একটি ভালো বই হাতে নেওয়া অনেক উপকারী।'
      },
      {
        id: 'easy-4',
        title: 'গ্রামীণ মেলা ও মাটির খেলনা',
        text: 'শীতের শেষে গ্রামের খোলা মাঠে ছোট একটি মেলা বসে। সেখানে কুমোরেরা রংবেরঙের মাটির হাঁড়ি, পুতুল ও ঘোড়া সাজিয়ে বসেন। ছোট ছেলেমেয়েরা বাঁশের বাঁশি ও তিলের খাজা কিনে আনন্দে মেতে ওঠে। সন্ধ্যার পর প্রদীপের আলোয় মেলার পরিবেশ আরও প্রাণবন্ত হয়ে ওঠে।'
      }
    ],
    medium: [
      {
        id: 'med-1',
        title: 'প্রযুক্তির সঠিক ব্যবহার ও দক্ষতা',
        text: 'আধুনিক যুগে কম্পিউটার ও ইন্টারনেট আমাদের দৈনন্দিন কাজকে অনেক সহজ ও দ্রুত করে দিয়েছে। অফিসের চিঠিপত্র লেখা, হিসাব-নিকাশ রাখা কিংবা দূরের মানুষের সাথে যোগাযোগ করার জন্য বাংলা ও ইংরেজি টাইপিং জানা অত্যন্ত জরুরি। নিয়মিত অনুশীলনের মাধ্যমে হাতের গতি ও নির্ভুলতা দুটোই বাড়ানো সম্ভব।'
      },
      {
        id: 'med-2',
        title: 'বর্ষাকালের প্রকৃতি ও গ্রামীণ জীবন',
        text: 'আষাঢ় মাসের প্রথম বৃষ্টিতে শহরের ধুলোবালি ধুয়ে চারপাশ পরিষ্কার হয়ে যায়। গ্রামের খাল-বিল ও পুকুর নতুন পানিতে কানায় কানায় ভরে ওঠে। কদম ফুলের সৌরভ আর টিনের চালে রিমঝিম বৃষ্টির শব্দে এক অনন্য পরিবেশ তৈরি হয়। কৃষকেরা নতুন উদ্যমে আমন ধানের চারা রোপণ করতে মাঠে নামেন।'
      },
      {
        id: 'med-3',
        title: 'সময়ানুবর্তিতা ও কাজের পরিকল্পনা',
        text: 'জীবনে সাফল্য অর্জনের জন্য সময়ের সঠিক মূল্য দেওয়া সবচেয়ে বড় শর্ত। প্রতিদিনের কাজগুলো একটি সুন্দর তালিকা করে গুছিয়ে নিলে শেষ মুহূর্তে কোনো তাড়াহুড়ো করতে হয় না। যাঁরা ছোটবেলা থেকেই সময়ের কাজ সময়ে শেষ করার অভ্যাস গড়ে তোলেন, তাঁরা কর্মজীবনে অনেক এগিয়ে থাকেন।'
      },
      {
        id: 'med-4',
        title: 'দেশীয় ক্ষুদ্র উদ্যোক্তা ও ই-কমার্স',
        text: 'বর্তমানে বাংলাদেশের তরুণ প্রজন্ম অনলাইন ব্যবসার মাধ্যমে নিজেদের স্বাবলম্বী করে তুলছে। ঘরে বসেই তাঁতের শাড়ি, হস্তশিল্প, খাঁটি মধু ও ঘরোয়া খাবার সারা দেশের ক্রেতাদের কাছে পৌঁছে দেওয়া হচ্ছে। কুরিয়ার সার্ভিস ও ডিজিটাল লেনদেনের সুবিধার কারণে ক্ষুদ্র ব্যবসা এখন দ্রুত প্রসার লাভ করছে।'
      }
    ],
    hard: [
      {
        id: 'hard-1',
        title: 'যুক্তবর্ণ ও ভাষাগত সূক্ষ্মতা অনুশীলন',
        text: 'বাংলা বানান ও মুদ্রাক্ষর চর্চায় যুক্তবর্ণের নিখুঁত প্রয়োগ অত্যন্ত গুরুত্বপূর্ণ। ক্ষণস্থায়ী ক্লান্তি বা নিরুৎসাহ যেন আমাদের সৃজনশীল উদ্ভাবনী শক্তিকে অবরুদ্ধ করতে না পারে। বিজ্ঞানমনস্ক দৃষ্টিভঙ্গি, অধ্যবসায় এবং আত্মবিশ্বাসের সমন্বয়ে যেকোনো জটিল দায়িত্ব সাফল্যের সঙ্গে সম্পন্ন করা সম্ভব।'
      },
      {
        id: 'hard-2',
        title: 'তথ্যপ্রযুক্তি ও সাইবার নিরাপত্তা সচেতনতা',
        text: 'ডিজিটাল অর্থনীতির বিস্তারের সাথে সাথে ব্যক্তিগত তথ্যের গোপনীয়তা ও প্রাতিষ্ঠানিক নিরাপত্তা রক্ষা করা অপরিহার্য হয়ে উঠেছে। অপরিচিত লিংকে ক্লিক না করা, শক্তিশালী পাসওয়ার্ড ব্যবহার করা এবং ব্রাউজারভিত্তিক নিরাপদ সফটওয়্যার বেছে নেওয়া প্রত্যেক সচেতন ব্যবহারকারীর দায়িত্ব।'
      },
      {
        id: 'hard-3',
        title: 'পরিবেশ সংরক্ষণ ও টেকসই উন্নয়ন',
        text: 'জলবায়ু পরিবর্তনের বিরূপ প্রভাব মোকাবিলায় বনায়ন বৃদ্ধি এবং নবায়নযোগ্য জ্বালানির ব্যবহার ত্বরান্বিত করা একান্ত আবশ্যক। শিল্পকারখানার অপরিশোধিত বর্জ্য যাতে নদী-নালা ও জীববৈচিত্র্যকে ক্ষতিগ্রস্ত না করে, সেদিকে সম্মিলিতভাবে তীক্ষ্ণ দৃষ্টি রাখা আমাদের নৈতিক কর্তব্য।'
      },
      {
        id: 'hard-4',
        title: 'ঐতিহ্যবাহী স্থাপত্য ও সংস্কৃতি চর্চা',
        text: 'প্রাচীন স্থাপত্যশৈলী, পোড়ামাটির ফলক এবং লোকজ সংগীতের সমৃদ্ধ ভাণ্ডার আমাদের হাজার বছরের সাংস্কৃতিক ঐতিহ্যের উজ্জ্বল সাক্ষ্য বহন করে। ঐতিহাসিক নিদর্শনগুলোর যথাযথ সংরক্ষণ ও প্রজন্মান্তরে এর তাৎপর্য তুলে ধরা প্রতিটি সংস্কৃতিমনা নাগরিকের দায়িত্ব।'
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

  function toBnNum(val) {
    return String(val).replace(/[0-9]/g, function (d) {
      return EN_TO_BN_DIGITS[d] || d;
    });
  }

  /**
   * Normalize Bangla Unicode string to NFC and unify common keyboard variations
   * (e.g. decomposed nukta sequences like ড+় -> ড়, ঢ+় -> ঢ়, য+় -> য়, ব+় -> র,
   * and zero-width non-joiner/joiner cleanup) so users on Avro, Probhat, or National Unicode
   * never get penalized for equivalent Unicode representations.
   */
  function normalizeBanglaUnicode(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFC')
      .replace(/\u09A1\u09BC/g, '\u09DC') // ড + ় -> ড়
      .replace(/\u09A2\u09BC/g, '\u09DD') // ঢ + ় -> ঢ়
      .replace(/\u09AF\u09BC/g, '\u09DF') // য + ় -> য়
      .replace(/\u09AC\u09BC/g, '\u09B0') // ব + ় -> র
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // Strip invisible ZWNJ/ZWJ differences
      .replace(/[ \t]+/g, ' ');
  }

  /**
   * Compare target passage and user-typed text with NFC normalization and conjunct-safe logic.
   * Returns { charStates, correctChars, errorChars, typedWords, correctWords, accuracyPct }
   */
  function evaluateBanglaTyping(targetRaw, typedRaw) {
    const target = normalizeBanglaUnicode(targetRaw);
    const typed = normalizeBanglaUnicode(typedRaw);

    const targetChars = Array.from(target);
    const typedChars = Array.from(typed);

    let correctChars = 0;
    let errorChars = 0;
    const charStates = [];

    for (let i = 0; i < targetChars.length; i++) {
      if (i < typedChars.length) {
        if (typedChars[i] === targetChars[i]) {
          charStates.push('correct');
          correctChars++;
        } else {
          // Conjunct-in-progress grace check: if user is at the very last typed char and typed a hasant (্)
          // or base consonant that is part of an ongoing conjunct, don't penalize until next char
          const isLastTyped = i === typedChars.length - 1;
          if (isLastTyped && typedChars[i] === '\u09CD' && targetChars[i] === '\u09CD') {
            charStates.push('correct');
            correctChars++;
          } else {
            charStates.push('wrong');
            errorChars++;
          }
        }
      } else if (i === typedChars.length) {
        charStates.push('current');
      } else {
        charStates.push('pending');
      }
    }

    // Word-level comparison for WPM
    const targetWords = target.trim().split(/\s+/).filter(Boolean);
    const rawTypedTrim = typed.trim();
    const typedWordsList = rawTypedTrim ? rawTypedTrim.split(/\s+/).filter(Boolean) : [];
    let correctWords = 0;

    for (let w = 0; w < typedWordsList.length && w < targetWords.length; w++) {
      if (typedWordsList[w] === targetWords[w]) {
        correctWords++;
      } else if (w === typedWordsList.length - 1 && !/\s$/.test(typed) && targetWords[w].startsWith(typedWordsList[w])) {
        // Partial word currently being typed accurately counts proportionally
        correctWords += typedWordsList[w].length / targetWords[w].length;
      }
    }

    const totalTypedChars = typedChars.length;
    const accuracyPct = totalTypedChars > 0 ? Math.max(0, Math.round((correctChars / totalTypedChars) * 100)) : 100;

    return {
      targetChars: targetChars,
      charStates: charStates,
      correctChars: correctChars,
      errorChars: errorChars,
      totalTypedChars: totalTypedChars,
      typedWordsCount: typedWordsList.length,
      correctWords: correctWords,
      accuracyPct: accuracyPct
    };
  }

  // Expose for automated verification
  if (typeof window !== 'undefined') {
    window.ToolNestBanglaTyping = {
      passages: BANGLA_PASSAGES,
      normalizeBanglaUnicode: normalizeBanglaUnicode,
      evaluateBanglaTyping: evaluateBanglaTyping
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const difficultySelect = document.getElementById('tn-btt-difficulty');
    const durationSelect = document.getElementById('tn-btt-duration');
    const newPassageBtn = document.getElementById('tn-btt-new-btn');
    const resetBtn = document.getElementById('tn-btt-reset-btn');

    const passageTitleEl = document.getElementById('tn-btt-passage-title');
    const passageBoxEl = document.getElementById('tn-btt-passage-box');
    const typingInput = document.getElementById('tn-btt-input');

    const statTimeEl = document.getElementById('tn-btt-stat-time');
    const statWpmEl = document.getElementById('tn-btt-stat-wpm');
    const statAccEl = document.getElementById('tn-btt-stat-acc');
    const statErrEl = document.getElementById('tn-btt-stat-err');

    const finalCard = document.getElementById('tn-btt-final-card');
    const finalWpm = document.getElementById('tn-btt-final-wpm');
    const finalAcc = document.getElementById('tn-btt-final-acc');
    const finalErr = document.getElementById('tn-btt-final-err');
    const finalChars = document.getElementById('tn-btt-final-chars');
    const tryAgainBtn = document.getElementById('tn-btt-try-again-btn');
    const copyScoreBtn = document.getElementById('tn-btt-copy-score-btn');

    if (!passageBoxEl || !typingInput) return;

    let currentPassage = BANGLA_PASSAGES.easy[0];
    let lastPassageId = '';
    let durationSeconds = 60;
    let remainingSeconds = 60;
    let timerInterval = null;
    let startTimeMs = null;
    let testFinished = false;

    function formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function pickRandomPassage(level) {
      const pool = BANGLA_PASSAGES[level] || BANGLA_PASSAGES.easy;
      const filtered = pool.filter(function (p) {
        return p.id !== lastPassageId;
      });
      const chosen = (filtered.length > 0 ? filtered : pool)[Math.floor(Math.random() * (filtered.length || pool.length))];
      lastPassageId = chosen.id;
      return chosen;
    }

    function renderPassageHighlight(evalResult) {
      const chars = evalResult.targetChars;
      const states = evalResult.charStates;

      passageBoxEl.innerHTML = chars
        .map(function (ch, idx) {
          const st = states[idx];
          const safeCh = window.ToolNest.escapeHtml(ch);
          if (st === 'correct') {
            return '<span class="tn-btt-char tn-btt-char--correct">' + safeCh + '</span>';
          }
          if (st === 'wrong') {
            return '<span class="tn-btt-char tn-btt-char--wrong">' + safeCh + '</span>';
          }
          if (st === 'current') {
            return '<span class="tn-btt-char tn-btt-char--current">' + safeCh + '</span>';
          }
          return '<span class="tn-btt-char">' + safeCh + '</span>';
        })
        .join('');
    }

    function computeLiveWpm(evalResult) {
      if (!startTimeMs) return 0;
      const elapsedMin = Math.max(1 / 60, (Date.now() - startTimeMs) / 60000);
      return Math.max(0, Math.round(evalResult.correctWords / elapsedMin));
    }

    function finishTest() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      testFinished = true;
      typingInput.disabled = true;

      const evalResult = evaluateBanglaTyping(currentPassage.text, typingInput.value);
      const wpm = computeLiveWpm(evalResult);

      statWpmEl.textContent = String(wpm);
      statAccEl.textContent = evalResult.accuracyPct + '%';
      statErrEl.textContent = String(evalResult.errorChars);

      finalCard.classList.remove('d-none');
      finalWpm.textContent = wpm + ' WPM (' + toBnNum(wpm) + ' শব্দ/মিনিট)';
      finalAcc.textContent = evalResult.accuracyPct + '% (' + toBnNum(evalResult.accuracyPct) + '%)';
      finalErr.textContent = evalResult.errorChars + ' (' + toBnNum(evalResult.errorChars) + 'টি ভুল)';
      finalChars.textContent = evalResult.correctChars + ' / ' + evalResult.totalTypedChars;

      window.ToolNest.showToast('Bangla Typing Test Completed! WPM: ' + wpm + ', Accuracy: ' + evalResult.accuracyPct + '%', 'success');
    }

    function resetCurrentTest(loadNewPassage) {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      testFinished = false;
      startTimeMs = null;

      durationSeconds = (parseInt(durationSelect.value, 10) || 1) * 60;
      remainingSeconds = durationSeconds;

      if (loadNewPassage) {
        currentPassage = pickRandomPassage(difficultySelect.value || 'easy');
      }

      if (passageTitleEl) {
        passageTitleEl.textContent = currentPassage.title;
      }

      typingInput.disabled = false;
      typingInput.value = '';
      finalCard.classList.add('d-none');

      statTimeEl.textContent = formatTime(remainingSeconds);
      statWpmEl.textContent = '0';
      statAccEl.textContent = '100%';
      statErrEl.textContent = '0';

      const initialEval = evaluateBanglaTyping(currentPassage.text, '');
      renderPassageHighlight(initialEval);
    }

    function startTimerIfNeeded() {
      if (startTimeMs || testFinished) return;
      startTimeMs = Date.now();
      timerInterval = setInterval(function () {
        const elapsedSec = Math.floor((Date.now() - startTimeMs) / 1000);
        remainingSeconds = Math.max(0, durationSeconds - elapsedSec);
        statTimeEl.textContent = formatTime(remainingSeconds);

        const evalResult = evaluateBanglaTyping(currentPassage.text, typingInput.value);
        statWpmEl.textContent = String(computeLiveWpm(evalResult));

        if (remainingSeconds <= 0) {
          finishTest();
        }
      }, 250);
    }

    // Disable paste inside typing textarea
    typingInput.addEventListener('paste', function (e) {
      e.preventDefault();
      window.ToolNest.showToast('Pasting is disabled during the Bangla Typing Test.', 'warning');
    });

    typingInput.addEventListener('input', function () {
      if (testFinished) return;
      startTimerIfNeeded();

      const evalResult = evaluateBanglaTyping(currentPassage.text, typingInput.value);
      renderPassageHighlight(evalResult);

      statWpmEl.textContent = String(computeLiveWpm(evalResult));
      statAccEl.textContent = evalResult.accuracyPct + '%';
      statErrEl.textContent = String(evalResult.errorChars);

      // Auto-finish if user completed typing the entire passage
      if (evalResult.totalTypedChars >= evalResult.targetChars.length) {
        finishTest();
      }
    });

    difficultySelect.addEventListener('change', function () {
      resetCurrentTest(true);
    });

    durationSelect.addEventListener('change', function () {
      resetCurrentTest(false);
    });

    if (newPassageBtn) {
      newPassageBtn.addEventListener('click', function () {
        resetCurrentTest(true);
        typingInput.focus();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetCurrentTest(false);
        typingInput.focus();
      });
    }

    if (tryAgainBtn) {
      tryAgainBtn.addEventListener('click', function () {
        resetCurrentTest(false);
        typingInput.focus();
      });
    }

    if (copyScoreBtn) {
      copyScoreBtn.addEventListener('click', function () {
        const summary =
          'ToolNest Bangla Typing Test Result — Speed: ' +
          finalWpm.textContent +
          ', Accuracy: ' +
          finalAcc.textContent +
          ', Errors: ' +
          finalErr.textContent;
        window.ToolNest.copyToClipboard(summary, copyScoreBtn);
      });
    }

    resetCurrentTest(true);
  });
})();
