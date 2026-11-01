/**
 * ToolNest - Lorem Ipsum Generator (/assets/js/tools/lorem-ipsum-generator.js)
 * 100% Client-Side placeholder text generator with custom paragraphs, sentences, and words.
 * Generates HTML, plain text, and Markdown formats.
 */

(function () {
  'use strict';

  // Core Lorem Ipsum words (standard set)
  const LOREM_IPSUM_WORDS = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
    'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
    'magna', 'aliqua', 'ut', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
    'exercitation', 'ullamco', 'laboris', 'nisi', 'ut', 'aliquip', 'ex', 'ea',
    'commodo', 'consequat', 'duis', 'aute', 'irure', 'dolor', 'in', 'reprehenderit',
    'in', 'voluptate', 'velit', 'esse', 'cillum', 'dolore', 'eu', 'fugiat', 'nulla',
    'pariatur', 'excepteur', 'sint', 'occaecat', 'cupidatat', 'non', 'proident',
    'sunt', 'in', 'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum'
  ];

  // DOM Elements
  let paragraphsInput, sentencesInput, wordsInput;
  let generateBtn, copyBtn, outputDiv, textarea;
  let formatHtml, formatPlain, formatMarkdown;

  // Initialize the tool
  function initLoremIpsumGenerator() {
    // Get DOM elements
    paragraphsInput = document.getElementById('tn-lorem-paragraphs');
    sentencesInput = document.getElementById('tn-lorem-sentences');
    wordsInput = document.getElementById('tn-lorem-words');
    generateBtn = document.getElementById('tn-lorem-generate');
    copyBtn = document.getElementById('tn-lorem-copy');
    outputDiv = document.getElementById('tn-lorem-output');
    textarea = document.getElementById('tn-lorem-textarea');
    formatHtml = document.getElementById('tn-lorem-html');
    formatPlain = document.getElementById('tn-lorem-plain');
    formatMarkdown = document.getElementById('tn-lorem-markdown');

    // Validate elements exist
    if (!paragraphsInput || !generateBtn) return;

    // Event listeners
    generateBtn.addEventListener('click', generateLoremIpsum);
    copyBtn.addEventListener('click', copyToClipboard);
    
    // Validate inputs on change
    paragraphsInput.addEventListener('change', validateInputs);
    sentencesInput.addEventListener('change', validateInputs);
    wordsInput.addEventListener('change', validateInputs);
    
    // Initial validation
    validateInputs();
    
    // Generate sample text on load
    setTimeout(generateLoremIpsum, 300);
  }

  // Validate input ranges
  function validateInputs() {
    const paragraphs = Math.min(Math.max(parseInt(paragraphsInput.value) || 3, 1), 20);
    const sentences = Math.min(Math.max(parseInt(sentencesInput.value) || 5, 1), 20);
    const words = Math.min(Math.max(parseInt(wordsInput.value) || 15, 3), 30);

    paragraphsInput.value = paragraphs;
    sentencesInput.value = sentences;
    wordsInput.value = words;
  }

  // Generate a random word from the Lorem Ipsum dictionary
  function getRandomWord() {
    return LOREM_IPSUM_WORDS[Math.floor(Math.random() * LOREM_IPSUM_WORDS.length)];
  }

  // Generate a sentence with the specified number of words
  function generateSentence(wordCount) {
    let sentence = '';
    for (let i = 0; i < wordCount; i++) {
      if (i === 0) {
        // Capitalize first word
        const word = getRandomWord();
        sentence += word.charAt(0).toUpperCase() + word.slice(1);
      } else {
        sentence += ' ' + getRandomWord();
      }
    }
    return sentence + '.';
  }

  // Generate a paragraph with the specified number of sentences
  function generateParagraph(sentenceCount, wordsPerSentence) {
    let paragraph = '';
    for (let i = 0; i < sentenceCount; i++) {
      paragraph += generateSentence(wordsPerSentence);
      if (i < sentenceCount - 1) {
        paragraph += ' ';
      }
    }
    return paragraph;
  }

  // Generate Lorem Ipsum text based on user settings
  function generateLoremIpsum() {
    const paragraphs = parseInt(paragraphsInput.value);
    const sentences = parseInt(sentencesInput.value);
    const words = parseInt(wordsInput.value);
    
    // Show loading state
    outputDiv.textContent = 'Generating Lorem Ipsum text...';
    textarea.style.display = 'none';
    outputDiv.style.display = 'block';
    copyBtn.disabled = true;
    
    setTimeout(() => {
      let result = '';
      let rawText = '';
      
      // Generate paragraphs
      for (let p = 0; p < paragraphs; p++) {
        const paragraphText = generateParagraph(sentences, words);
        rawText += paragraphText + '\n\n';
        
        if (formatHtml.checked) {
          result += `<p class="mb-3">${paragraphText}</p>`;
        } else if (formatMarkdown.checked) {
          result += paragraphText + '\n\n';
        } else {
          result += paragraphText + '\n\n';
        }
      }
      
      // Set output based on format
      if (formatHtml.checked) {
        outputDiv.innerHTML = result;
        textarea.value = rawText.trim();
      } else if (formatMarkdown.checked) {
        outputDiv.textContent = result.trim();
        textarea.value = result.trim();
      } else {
        outputDiv.textContent = result.trim();
        textarea.value = result.trim();
      }
      
      // Show textarea for copying
      textarea.style.display = 'block';
      outputDiv.style.display = 'none';
      copyBtn.disabled = false;
      
      // Show success message
      window.ToolNest.showToast(
        `Generated ${paragraphs} paragraph(s) with ${sentences} sentence(s) each`,
        'success'
      );
      
    }, 100); // Small delay for smooth UX
  }

  // Copy generated text to clipboard
  function copyToClipboard() {
    const textToCopy = textarea.value;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      window.ToolNest.showToast('Lorem Ipsum text copied to clipboard!', 'success');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy to Clipboard';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      window.ToolNest.showToast('Failed to copy text', 'error');
    });
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', initLoremIpsumGenerator);

})();