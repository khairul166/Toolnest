/**
 * ToolNest - Shared Application Script (/assets/js/main.js)
 * Provides global tool search, category filtering, clipboard helpers,
 * drag-and-drop file bindings, and accessible toast notifications.
 */
(function () {
  'use strict';

  const TOOLS_REGISTRY = [
    {
      id: 'bijoy-to-unicode',
      name: 'Bijoy to Unicode Converter',
      url: '/tools/bijoy-to-unicode/index.html',
      category: 'Converters',
      icon: 'bi-translate',
      desc: 'Convert Bangla text between Bijoy ANSI (SutonnyMJ) and Unicode instantly in both directions.',
      keywords: 'bijoy to unicode, unicode to bijoy, bangla converter, sutonnymj, অভ্র, বিজয় টু ইউনিকোড'
    },
    {
      id: 'amount-to-words',
      name: 'Amount to Words Converter',
      url: '/tools/amount-to-words/index.html',
      category: 'Converters',
      icon: 'bi-cash-coin',
      desc: 'Convert numbers and currency amounts into English and Bangla words with BDT Taka, Paisa, Lakh, and Crore.',
      keywords: 'amount in words, number to words bangla, taka to words, lakh crore converter, কথায় লিখুন'
    },
    {
      id: 'age-calculator',
      name: 'Age Calculator',
      url: '/tools/age-calculator/index.html',
      category: 'Converters',
      icon: 'bi-calendar2-check',
      desc: 'Calculate exact age in years, months, days, total weeks, hours, and countdown to your next birthday.',
      keywords: 'age calculator, date of birth calculator, job age calculator bd, বয়স ক্যালকুলেটর'
    },
    {
      id: 'image-compressor',
      name: 'Image Compressor',
      url: '/tools/image-compressor/index.html',
      category: 'Image',
      icon: 'bi-file-earmark-zip',
      desc: 'Compress JPG, PNG, and WebP images in batches with a quality slider and live before/after size comparison.',
      keywords: 'image compressor, reduce photo size kb, compress jpeg png webp, ছবি ছোট করার টুল'
    },
    {
      id: 'background-remover',
      name: 'AI Background Remover',
      url: '/tools/background-remover/index.html',
      category: 'Image',
      icon: 'bi-person-bounding-box',
      desc: 'Remove portrait photo backgrounds with browser-based AI and download transparent PNG images.',
      keywords: 'background remover, remove image background, photo background remover, transparent png, ai background removal'
    },
    {
      id: 'image-upscaler',
      name: 'AI Image Upscaler (2x)',
      url: '/tools/image-upscaler/index.html',
      category: 'Image',
      icon: 'bi-zoom-in',
      desc: 'Upscale small images 2x with browser-based AI and download the enlarged result as a PNG.',
      keywords: 'ai image upscaler, photo upscaler, image super resolution, enlarge image 2x, low resolution photo enhancer'
    },
    {
      id: 'image-alt-text-generator',
      name: 'AI Image Alt-Text & Caption Generator',
      url: '/tools/image-alt-text-generator/index.html',
      category: 'Image',
      icon: 'bi-eye',
      desc: 'Generate WCAG screen-reader alt-text, SEO image descriptions, HTML img tags, and social captions with browser-based Vision AI.',
      keywords: 'ai image alt text generator, image caption generator, seo alt text, wcag alt attribute, describe image ai'
    },
    {
      id: 'document-scanner',
      name: 'AI Document Scanner & Auto-Enhancer',
      url: '/tools/document-scanner/index.html',
      category: 'Image',
      icon: 'bi-bounding-box',
      desc: 'Flatten angled document photos with 4-corner perspective crop, remove shadows with Magic Color or B&W, and export clean PDFs or PNGs.',
      keywords: 'document scanner, camscanner online, remove shadow from document photo, perspective crop deskew, magic color scan'
    },
    {
      id: 'image-resizer',
      name: 'Image Resizer & Social Presets',
      url: '/tools/image-resizer/index.html',
      category: 'Image',
      icon: 'bi-aspect-ratio',
      desc: 'Resize images to custom dimensions or one-click Facebook, Instagram, YouTube, and LinkedIn presets.',
      keywords: 'image resizer, facebook cover size, social media image size, photo resize pixel'
    },
    {
      id: 'bulk-image-resizer',
      name: 'Bulk Image Resizer (Batch & ZIP)',
      url: '/tools/bulk-image-resizer/index.html',
      category: 'Image',
      icon: 'bi-images',
      desc: 'Batch resize multiple images at once by dimensions, file size, percentage, or longest side with 9-point crop anchor, renaming, and ZIP export.',
      keywords: 'bulk image resizer, redketchup bulk resize, batch photo resizer, zip image resize'
    },
    {
      id: 'color-picker',
      name: 'Color Picker & Image Eyedropper',
      url: '/tools/color-picker/index.html',
      category: 'Image',
      icon: 'bi-eyedropper',
      desc: 'Pick exact pixel colors from any image, extract dominant palettes, convert HEX, RGB, HSL, HSV, CMYK, and check WCAG contrast.',
      keywords: 'color picker, image color picker, eyedropper tool, hex to rgb cmyk hsl, color palette generator'
    },
    {
      id: 'passport-photo-maker',
      name: 'Passport & Visa Photo Maker',
      url: '/tools/passport-photo-maker/index.html',
      category: 'Image',
      icon: 'bi-person-bounding-box',
      desc: 'Create official passport and visa photos with size presets, interactive crop, background color fill, and printable A4/4R sheets.',
      keywords: 'passport photo maker, visa photo size bd, 2x2 photo, 35x45mm photo, पासपोर्ट ছবি'
    },
    {
      id: 'create-pdf',
      name: 'Create PDF & Organize Pages',
      url: '/tools/create-pdf/index.html',
      category: 'PDF',
      icon: 'bi-files',
      desc: 'Create a PDF from multiple images and PDF files with an Adobe Acrobat-style visual page organizer to reorder, rotate, insert, and extract pages.',
      keywords: 'create pdf, organize pdf pages, combine images and pdf, adobe acrobat organize pages, reorder rotate pdf pages'
    },
    {
      id: 'protect-pdf',
      name: 'Protect PDF (Encrypt & Password)',
      url: '/tools/protect-pdf/index.html',
      category: 'PDF',
      icon: 'bi-file-earmark-lock2',
      desc: 'Password-protect PDF files with 128-bit encryption, document open password, owner permissions password, and printing/copying restrictions.',
      keywords: 'protect pdf, encrypt pdf, password protect pdf, lock pdf, restrict pdf printing copying'
    },
    {
      id: 'pdf-merge-split',
      name: 'PDF Merge & Split',
      url: '/tools/pdf-merge-split/index.html',
      category: 'PDF',
      icon: 'bi-file-earmark-pdf',
      desc: 'Combine multiple PDF files, reorder pages, or split specific page ranges 100% privately in your browser.',
      keywords: 'pdf merge, pdf split, combine pdf files, extract pdf pages'
    },
    {
      id: 'qr-code-generator',
      name: 'QR Code Generator',
      url: '/tools/qr-code-generator/index.html',
      category: 'Business',
      icon: 'bi-qr-code-scan',
      desc: 'Generate permanent, no-expiry QR codes for URLs, text, and WiFi with custom colors, center logo, and PNG/SVG download.',
      keywords: 'qr code generator, wifi qr code, custom logo qr code, svg png qr download'
    },
    {
      id: 'text-tools',
      name: 'Text Tools & Word Counter',
      url: '/tools/text-tools/index.html',
      category: 'Text',
      icon: 'bi-card-text',
      desc: 'Count words and characters, convert text case, remove duplicate lines, sort lines, and clean whitespace.',
      keywords: 'word counter, case converter, remove duplicate lines, sort lines, character count'
    },
    {
      id: 'bold-text-generator',
      name: 'Bold Text Generator',
      url: '/tools/bold-text-generator/index.html',
      category: 'Text',
      icon: 'bi-type-bold',
      desc: 'Convert text into fancy Unicode bold styles for Facebook, Instagram, Twitter/X, Discord, and messaging apps.',
      keywords: 'bold text generator, bold text, unicode bold, fancy font, bold letters, instagram bold text, facebook bold font'
    },
    {
      id: 'invoice-generator',
      name: 'Invoice & Courier Slip Generator',
      url: '/tools/invoice-generator/index.html',
      category: 'Business',
      icon: 'bi-receipt',
      desc: 'Create professional invoices and Bangladesh e-commerce COD courier slips with automatic totals and print/PDF export.',
      keywords: 'invoice generator, courier slip bd, steadfast pathao redx label, cash on delivery receipt'
    },
    {
      id: 'land-area-converter',
      name: 'Land Area Converter (Katha, Decimal, Bigha)',
      url: '/tools/land-area-converter/index.html',
      category: 'Converters',
      icon: 'bi-rulers',
      desc: 'Convert land area between Katha, Decimal (Shatak), Bigha, Acre, Hectare, Sq Feet, Sq Meter, and Sq Yard with regional standards.',
      keywords: 'land area converter, katha to decimal, shatak to sq ft, bigha acre converter, জমি পরিমাপ ক্যালকুলেটর'
    },
    {
      id: 'image-format-converter',
      name: 'Image Format Converter (HEIC, WebP, PNG, JPG)',
      url: '/tools/image-format-converter/index.html',
      category: 'Image',
      icon: 'bi-arrow-repeat',
      desc: 'Batch convert between JPG, PNG, WebP, and iPhone HEIC/HEIF photos with quality slider, transparency fill, and ZIP export.',
      keywords: 'image format converter, heic to jpg, webp to png, png to jpg white background, batch image converter'
    },
    {
      id: 'image-to-pdf',
      name: 'Image to PDF Converter',
      url: '/tools/image-to-pdf/index.html',
      category: 'PDF',
      icon: 'bi-file-earmark-richtext',
      desc: 'Combine multiple JPG, PNG, and WebP images into a single PDF document with drag reordering, rotation, and A4/Letter sizing.',
      keywords: 'image to pdf, jpg to pdf, png to pdf, combine photos into pdf, scanned document pdf'
    },
    {
      id: 'pdf-to-jpg',
      name: 'PDF to JPG & PNG Converter',
      url: '/tools/pdf-to-jpg/index.html',
      category: 'PDF',
      icon: 'bi-file-earmark-image',
      desc: 'Convert PDF pages into high-resolution 1x/2x/3x JPG or PNG images with page range selection and one-click ZIP download.',
      keywords: 'pdf to jpg, pdf to png, extract pdf pages as images, high resolution pdf converter'
    },
    {
      id: 'bangla-typing-test',
      name: 'Bangla Typing Test (WPM & Accuracy)',
      url: '/tools/bangla-typing-test/index.html',
      category: 'Text',
      icon: 'bi-keyboard',
      desc: 'Timed 1, 2, or 5 minute Bangla Unicode typing test with 12 original passages, conjunct levels, and live WPM & accuracy.',
      keywords: 'bangla typing test, বাংলা টাইপিং টেস্ট, avro unicode typing speed wpm, bcc computer operator typing'
    },
    {
      id: 'discount-vat-profit-calculator',
      name: 'Discount, VAT & Profit Calculator',
      url: '/tools/discount-vat-profit-calculator/index.html',
      category: 'Business',
      icon: 'bi-calculator',
      desc: 'Calculate sale discounts, add or remove VAT, and compute profit margin, markup, and F-commerce net profit per order in BDT (৳).',
      keywords: 'discount calculator, vat calculator bd nbr, profit margin markup calculator, f-commerce net profit'
    },
    {
      id: 'utm-link-builder',
      name: 'UTM Link Builder (GA4 & Ads)',
      url: '/tools/utm-link-builder/index.html',
      category: 'Business',
      icon: 'bi-link-45deg',
      desc: 'Build trackable campaign URLs with utm_source, utm_medium, and utm_campaign for Google Analytics 4, Facebook Ads, and SMS blasts.',
      keywords: 'utm link builder, campaign url builder ga4, utm_source utm_medium utm_campaign, facebook ad tracking link'
    },
    {
      id: 'currency-converter',
      name: 'Currency Converter (BDT, USD, SAR, AED, GBP)',
      url: '/tools/currency-converter/index.html',
      category: 'Converters',
      icon: 'bi-currency-exchange',
      desc: 'Convert 25+ global currencies to BDT Taka with custom bank rates, +2.5% remittance incentive bonus, and multi-currency table.',
      keywords: 'currency converter, usd to bdt, sar to bdt, aed to bdt, remittance bonus calculator 2.5%, টাকার রেট'
    },
    {
      id: 'pdf-to-word',
      name: 'PDF to MS Word Converter (.DOCX)',
      url: '/tools/pdf-to-word/index.html',
      category: 'PDF',
      icon: 'bi-file-earmark-word',
      desc: 'Convert PDF documents into editable Microsoft Word (.docx, .doc) and plain text files 100% locally in your browser.',
      keywords: 'pdf to word, pdf to docx, convert pdf to editable word document, client side pdf to word'
    },
    {
      id: 'pdf-to-excel',
      name: 'PDF to MS Excel Converter (.XLSX & .CSV)',
      url: '/tools/pdf-to-excel/index.html',
      category: 'PDF',
      icon: 'bi-file-earmark-excel',
      desc: 'Extract tables, bank statements, and price lists from PDF files into Microsoft Excel (.xlsx) and CSV spreadsheets.',
      keywords: 'pdf to excel, pdf to xlsx, pdf to csv, extract table from pdf to excel, bank statement pdf to excel'
    },
    {
      id: 'word-to-pdf',
      name: 'MS Word to PDF Converter (.DOCX & .DOC)',
      url: '/tools/word-to-pdf/index.html',
      category: 'PDF',
      icon: 'bi-file-earmark-pdf',
      desc: 'Convert Microsoft Word (.docx, .doc), RTF, and TXT documents into formatted, printable A4 or Letter PDF files.',
      keywords: 'word to pdf, docx to pdf, doc to pdf, convert ms word to pdf online, ডক থেকে পিডিএফ'
    },
    {
      id: 'excel-to-pdf',
      name: 'MS Excel to PDF Converter (.XLSX & .CSV)',
      url: '/tools/excel-to-pdf/index.html',
      category: 'PDF',
      icon: 'bi-file-earmark-spreadsheet',
      desc: 'Convert Microsoft Excel (.xlsx) workbooks and CSV spreadsheets into clean Landscape or Portrait vector PDF tables.',
      keywords: 'excel to pdf, xlsx to pdf, csv to pdf, convert spreadsheet to pdf table, এক্সেল থেকে পিডিএফ'
    },
    {
      id: 'json-formatter',
      name: 'JSON Formatter & Minifier',
      url: '/tools/json-formatter/index.html',
      category: 'Developers',
      icon: 'bi-braces',
      desc: 'Format and minify JSON data with options for beautified output or minified compact output.',
      keywords: 'json formatter, json minifier, json beautify, json validator, parse json, format json online'
    },
    {
      id: 'password-generator',
      name: 'Password Generator',
      url: '/tools/password-generator/index.html',
      category: 'Developers',
      icon: 'bi-key',
      desc: 'Generate strong random passwords with a length slider, character-set options, strength meter, and one-click copy.',
      keywords: 'password generator, strong password, random password, password maker, secure pass, password tool'
    },
    {
      id: 'meta-tag-generator',
      name: 'Meta Tag Generator',
      url: '/tools/meta-tag-generator/index.html',
      category: 'Developers',
      icon: 'bi-file-earmark-code',
      desc: 'Generate SEO, Open Graph, and Twitter card meta tags with title, description, canonical, and robots options.',
      keywords: 'meta tag generator, og tags, open graph, twitter card, seo meta, canonical meta, robots meta'
    },

    {
      id: 'robots-txt-generator',
      name: 'Robots.txt Generator',
      url: '/tools/robots-txt-generator/index.html',
      category: 'Developers',
      icon: 'bi-file-text',
      desc: 'Generate customized robots.txt files to control search engine crawlers access to your website.',
      keywords: 'robots.txt generator, search engine crawlers, disallow allow, user agent, seo robots'
    },






    {
      id: 'cv-maker',
      name: 'CV Maker & Resume Builder',
      url: '/tools/cv-maker/index.html',
      category: 'Business',
      icon: 'bi-file-earmark-person',
      desc: 'Create a professional CV with live preview, experience, education, skills, and print or PDF export.',
      keywords: 'cv maker, resume builder, curriculum vitae, resume template, cv pdf, job application'
    },
    {
      id: 'signature-maker',
      name: 'Signature Maker',
      url: '/tools/signature-maker/index.html',
      category: 'Image',
      icon: 'bi-pen',
      desc: 'Draw a handwritten signature with mouse, touch, or stylus and download it as a transparent PNG.',
      keywords: 'signature maker, digital signature, handwritten signature, draw signature, signature png, e signature'
    },
    {
      id: 'whatsapp-link-generator',
      name: 'WhatsApp Link Generator',
      url: '/tools/whatsapp-link-generator/index.html',
      category: 'Business',
      icon: 'bi-whatsapp',
      desc: 'Create WhatsApp click-to-chat links with an international phone number and optional prefilled message.',
      keywords: 'whatsapp link generator, wa.me link, click to chat, whatsapp message link, whatsapp button, whatsapp url'
    },
    {
      id: 'loan-emi-fdr-dps-calculator',
      name: 'Loan EMI, FDR & DPS Calculator',
      url: '/tools/loan-emi-fdr-dps-calculator/index.html',
      category: 'Business',
      icon: 'bi-bank',
      desc: 'Calculate monthly Loan EMI with amortization schedule, Fixed Deposit (FDR) maturity value, and DPS savings returns.',
      keywords: 'loan emi calculator, fdr calculator, dps calculator, bank loan interest, fixed deposit bd, ডিপিএস ক্যালকুলেটর'
    },
    {
      id: 'lorem-ipsum-generator',
      name: 'Lorem Ipsum Generator',
      url: '/tools/lorem-ipsum-generator/index.html',
      category: 'Text',
      icon: 'bi-textarea',
      desc: 'Generate placeholder text with customizable paragraphs, sentences, and words. Perfect for design mockups and content placeholders.',
      keywords: 'lorem ipsum generator, placeholder text, dummy text, ipsum lorem, filler text, mockup text'
    }
  ];

  function ensureToastContainer() {
    let container = document.getElementById('tn-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tn-toast-container';
      container.className = 'tn-toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type) {
    const tone = type || 'success';
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    const bgClass = tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning text-dark' : 'bg-dark';
    toast.className = 'toast align-items-center text-white ' + bgClass + ' border-0 show shadow mb-2';
    toast.setAttribute('role', 'status');
    toast.innerHTML =
      '<div class="d-flex">' +
      '<div class="toast-body fw-medium">' + escapeHtml(message) + '</div>' +
      '<button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close"></button>' +
      '</div>';

    const closeBtn = toast.querySelector('.btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        toast.remove();
      });
    }
    container.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3200);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function copyToClipboard(text, buttonEl) {
    if (!text) {
      showToast('Nothing to copy yet.', 'warning');
      return Promise.resolve(false);
    }

    const doFeedback = function () {
      showToast('Copied to clipboard!', 'success');
      if (buttonEl) {
        const originalHtml = buttonEl.getAttribute('data-original-html') || buttonEl.innerHTML;
        buttonEl.setAttribute('data-original-html', originalHtml);
        buttonEl.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i> Copied!';
        setTimeout(function () {
          buttonEl.innerHTML = originalHtml;
        }, 1800);
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        doFeedback();
        return true;
      }).catch(function () {
        return fallbackCopy(text, doFeedback);
      });
    }
    return Promise.resolve(fallbackCopy(text, doFeedback));
  }

  function fallbackCopy(text, callback) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      callback();
      document.body.removeChild(ta);
      return true;
    } catch (err) {
      document.body.removeChild(ta);
      showToast('Could not copy automatically. Please select and copy.', 'danger');
      return false;
    }
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return (i === 0 ? val.toFixed(0) : val.toFixed(2)) + ' ' + sizes[i];
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'toolnest-download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function setupDropzone(dropzoneEl, fileInputEl, onFilesSelected) {
    if (!dropzoneEl || !fileInputEl) return;

    dropzoneEl.addEventListener('click', function (e) {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL' && !e.target.closest('label')) {
        fileInputEl.click();
      }
    });

    dropzoneEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInputEl.click();
      }
    });

    ['dragenter', 'dragover'].forEach(function (evtName) {
      dropzoneEl.addEventListener(evtName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(function (evtName) {
      dropzoneEl.addEventListener(evtName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.remove('is-dragover');
      });
    });

    dropzoneEl.addEventListener('drop', function (e) {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0 && typeof onFilesSelected === 'function') {
        onFilesSelected(Array.from(files));
      }
    });

    fileInputEl.addEventListener('change', function () {
      if (fileInputEl.files && fileInputEl.files.length > 0 && typeof onFilesSelected === 'function') {
        onFilesSelected(Array.from(fileInputEl.files));
      }
    });
  }

  function initHeaderSearch() {
    const input = document.getElementById('tn-header-search');
    const resultsBox = document.getElementById('tn-header-search-results');
    if (!input || !resultsBox) return;

    function renderDropdown(query) {
      const q = (query || '').trim().toLowerCase();
      if (!q) {
        resultsBox.classList.remove('is-open');
        resultsBox.innerHTML = '';
        return;
      }

      const matches = TOOLS_REGISTRY.filter(function (tool) {
        return (
          tool.name.toLowerCase().includes(q) ||
          tool.category.toLowerCase().includes(q) ||
          tool.desc.toLowerCase().includes(q) ||
          tool.keywords.toLowerCase().includes(q)
        );
      });

      if (matches.length === 0) {
        resultsBox.innerHTML =
          '<div class="p-3 text-muted small">No tools found for "' +
          escapeHtml(query) +
          '". <a href="/tools/index.html" class="fw-semibold">Browse all tools</a></div>';
        resultsBox.classList.add('is-open');
        return;
      }

      resultsBox.innerHTML = matches
        .map(function (tool) {
          return (
            '<a href="' +
            tool.url +
            '" class="tn-search-results__item">' +
            '<i class="bi ' +
            tool.icon +
            ' text-primary fs-5" aria-hidden="true"></i>' +
            '<div>' +
            '<div class="fw-semibold">' +
            escapeHtml(tool.name) +
            '</div>' +
            '<div class="small text-muted">' +
            escapeHtml(tool.category) +
            '</div>' +
            '</div>' +
            '</a>'
          );
        })
        .join('');
      resultsBox.classList.add('is-open');
    }

    input.addEventListener('input', function () {
      renderDropdown(input.value);
    });

    input.addEventListener('focus', function () {
      if (input.value.trim()) {
        renderDropdown(input.value);
      }
    });

    document.addEventListener('click', function (e) {
      if (!input.contains(e.target) && !resultsBox.contains(e.target)) {
        resultsBox.classList.remove('is-open');
      }
    });
  }

  function initHeaderMenu() {
    const nav = document.querySelector('.tn-header .navbar-nav');
    const brand = document.querySelector('.tn-header__brand');
    const allToolsLink = nav && Array.prototype.find.call(nav.querySelectorAll('.tn-header__nav-link'), function (link) {
      return link.textContent.trim().toLowerCase() === 'all tools';
    });
    if (!nav || !brand || !allToolsLink || nav.querySelector('.tn-header__mega-item')) return;

    const homeUrl = new URL(brand.getAttribute('href'), window.location.href);
    const siteRoot = new URL('.', homeUrl);
    const toolsUrl = new URL('tools/index.html', siteRoot);
    const categories = [
      { name: 'Converters', slug: 'converters', icon: 'bi-arrow-left-right', description: 'Convert text, numbers, and everyday formats.' },
      { name: 'Developers', slug: 'developers', icon: 'bi-code-slash', description: 'Handy utilities for code and websites.' },
      { name: 'Image', slug: 'image', icon: 'bi-image', description: 'Edit, resize, and enhance images.' },
      { name: 'PDF', slug: 'pdf', icon: 'bi-file-earmark-pdf', description: 'Work with PDF files in your browser.' },
      { name: 'Text', slug: 'text', icon: 'bi-text-paragraph', description: 'Format, count, and create text.' },
      { name: 'Business', slug: 'business', icon: 'bi-briefcase', description: 'Create useful business documents and links.' }
    ];
    const categoryMarkup = categories.map(function (category) {
      const count = TOOLS_REGISTRY.filter(function (tool) {
        return tool.category.toLowerCase() === category.name.toLowerCase();
      }).length;
      const href = new URL(toolsUrl.href);
      href.searchParams.set('category', category.slug);
      return '<a class="tn-mega-menu__category" href="' + escapeHtml(href.href) + '">' +
        '<span class="tn-mega-menu__icon"><i class="bi ' + category.icon + '" aria-hidden="true"></i></span>' +
        '<span class="tn-mega-menu__copy"><span class="tn-mega-menu__name">' + category.name +
        '<span class="tn-mega-menu__count">' + count + '</span></span>' +
        '<span class="tn-mega-menu__description">' + category.description + '</span></span>' +
        '<i class="bi bi-arrow-up-right tn-mega-menu__arrow" aria-hidden="true"></i></a>';
    }).join('');

    const item = document.createElement('li');
    item.className = 'nav-item tn-header__mega-item';
    item.innerHTML =
      '<button class="nav-link tn-header__nav-link tn-header__mega-toggle" type="button" aria-expanded="false" aria-controls="tnToolsMegaMenu">' +
      '<i class="bi bi-grid-3x3-gap-fill" aria-hidden="true"></i><span>Explore</span>' +
      '<i class="bi bi-chevron-down tn-header__mega-chevron" aria-hidden="true"></i></button>' +
      '<div class="tn-mega-menu" id="tnToolsMegaMenu" aria-label="Explore tools">' +
      '<div class="tn-mega-menu__heading"><div><span class="tn-mega-menu__eyebrow">TOOLNEST DIRECTORY</span>' +
      '<h2>Find the right tool</h2><p>Fast, free tools that keep your work private.</p></div>' +
      '<a class="tn-mega-menu__browse" href="' + escapeHtml(toolsUrl.href) + '">Browse all tools <i class="bi bi-arrow-right" aria-hidden="true"></i></a></div>' +
      '<div class="tn-mega-menu__grid">' + categoryMarkup + '</div>' +
      '<div class="tn-mega-menu__footer"><i class="bi bi-shield-check" aria-hidden="true"></i> Your files stay on your device</div></div>';

    const toggle = item.querySelector('.tn-header__mega-toggle');
    const menu = item.querySelector('.tn-mega-menu');
    toggle.addEventListener('click', function () {
      const isOpen = item.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        item.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        const collapse = nav.closest('.navbar-collapse');
        if (collapse && collapse.classList.contains('show') && window.bootstrap && window.bootstrap.Collapse) {
          const instance = window.bootstrap.Collapse.getInstance(collapse);
          if (instance) instance.hide();
        }
      }
    });
    document.addEventListener('click', function (event) {
      if (!item.contains(event.target)) {
        item.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && item.classList.contains('is-open')) {
        item.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
    nav.insertBefore(item, allToolsLink.closest('.nav-item').nextSibling);
  }

  function initGridFiltering() {
    const searchInput = document.getElementById('tn-grid-search');
    const filterButtons = document.querySelectorAll('[data-tn-filter]');
    const cards = document.querySelectorAll('[data-tn-tool-card]');
    const emptyState = document.getElementById('tn-grid-empty');

    if (cards.length === 0) return;

    filterButtons.forEach(function (btn) {
      const category = (btn.getAttribute('data-tn-filter') || 'all').toLowerCase();
      const count = category === 'all'
        ? cards.length
        : Array.prototype.filter.call(cards, function (card) {
          return (card.getAttribute('data-tn-category') || '').toLowerCase() === category;
        }).length;
      const countElement = btn.querySelector('[data-tn-filter-count]');

      if (countElement) {
        countElement.textContent = String(count);
      }
    });

    let activeCategory = 'all';

    function applyFilter() {
      const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
      let visibleCount = 0;

      cards.forEach(function (card) {
        const cat = (card.getAttribute('data-tn-category') || '').toLowerCase();
        const text = (card.textContent || '').toLowerCase();
        const kw = (card.getAttribute('data-tn-keywords') || '').toLowerCase();

        const matchesCategory = activeCategory === 'all' || cat === activeCategory;
        const matchesQuery = !q || text.includes(q) || kw.includes(q);

        if (matchesCategory && matchesQuery) {
          card.classList.remove('d-none');
          visibleCount++;
        } else {
          card.classList.add('d-none');
        }
      });

      if (emptyState) {
        emptyState.classList.toggle('d-none', visibleCount > 0);
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', applyFilter);
    }

    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterButtons.forEach(function (b) {
          b.classList.remove('btn-primary', 'active');
          b.classList.add('tn-btn--outline');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.remove('tn-btn--outline');
        btn.classList.add('btn-primary', 'active');
        btn.setAttribute('aria-pressed', 'true');
        activeCategory = (btn.getAttribute('data-tn-filter') || 'all').toLowerCase();
        applyFilter();
      });
    });

    // Support URL hash or ?cat= parameter on /tools/
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get('category');
    if (catParam) {
      const targetBtn = document.querySelector('[data-tn-filter="' + catParam.toLowerCase() + '"]');
      if (targetBtn) targetBtn.click();
    }
  }

  function initThemeToggle() {
    const root = document.documentElement;
    const stored = localStorage.getItem('toolnest-theme');
    const initial = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    root.setAttribute('data-theme', initial);
    let buttons = document.querySelectorAll('[data-tn-theme-toggle]');
    if (buttons.length === 0) {
      const search = document.querySelector('.tn-header__search-wrap');
      if (search && search.parentElement) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tn-theme-toggle ms-lg-2 mt-2 mt-lg-0';
        button.setAttribute('data-tn-theme-toggle', '');
        search.parentElement.appendChild(button);
        buttons = document.querySelectorAll('[data-tn-theme-toggle]');
      }
    }
    function render() {
      const dark = root.getAttribute('data-theme') === 'dark';
      buttons.forEach(function (button) {
        button.innerHTML = dark ? '<i class="bi bi-sun" aria-hidden="true"></i>' : '<i class="bi bi-moon-stars" aria-hidden="true"></i>';
        button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        button.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
      });
    }
    buttons.forEach(function (button) { button.addEventListener('click', function () { const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', next); localStorage.setItem('toolnest-theme', next); render(); }); });
    render();
  }

  function highlightActiveNav() {
    const path = window.location.pathname.toLowerCase();
    const navLinks = document.querySelectorAll('.tn-header__nav-link');
    navLinks.forEach(function (link) {
      const href = (link.getAttribute('href') || '').toLowerCase();
      if (href.endsWith('/toolnest/index.html') && (path.endsWith('/toolnest/index.html') || path === '/')) {
        link.classList.add('active');
      } else if (href.endsWith('/tools/index.html') && path.includes('/tools/')) {
        link.classList.add('active');
      } else if (href.endsWith('/pages/contact.html') && path.endsWith('/pages/contact.html')) {
        link.classList.add('active');
      }
    });
  }

  function initBackToTop() {
    if (document.querySelector('.tn-back-to-top')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tn-back-to-top tn-no-print';
    button.setAttribute('aria-label', 'Back to top');
    button.title = 'Back to top';
    button.innerHTML = '<i class="bi bi-arrow-up" aria-hidden="true"></i>';
    button.addEventListener('click', function () {
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) {
        window.scrollTo(0, 0);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    function updateVisibility() {
      button.classList.toggle('is-visible', window.scrollY > 400);
    }

    window.addEventListener('scroll', updateVisibility, { passive: true });
    document.body.appendChild(button);
    updateVisibility();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initThemeToggle();
    initHeaderMenu();
    initHeaderSearch();
    initGridFiltering();
    highlightActiveNav();
    initBackToTop();
  });

  window.ToolNest = {
    tools: TOOLS_REGISTRY,
    showToast: showToast,
    copyToClipboard: copyToClipboard,
    formatBytes: formatBytes,
    downloadBlob: downloadBlob,
    setupDropzone: setupDropzone,
    escapeHtml: escapeHtml
  };
})();
