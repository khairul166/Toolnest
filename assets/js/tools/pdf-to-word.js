/**
 * ToolNest - PDF to MS Word (.DOCX) Converter (/assets/js/tools/pdf-to-word.js)
 * 100% Client-Side PDF to Word Converter powered by Mozilla pdf.js 3.11.174 and JSZip 3.10.1.
 * Extracts text with Y/X coordinate line reconstruction, builds a genuine Office Open XML (.docx)
 * document package in memory, and also supports .doc and .txt export plus live editing preview.
 */
(function () {
  'use strict';

  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let currentPdfFile = null;
  let currentPdfDoc = null;
  let totalPages = 0;
  // Array of { pageNumber, lines: [{ text, fontSize, isHeading }], paragraphs: [{ text, isHeading }], rawItemCount }
  let extractedPages = [];

  /**
   * Parse a page range string like "1-3, 5" into sorted 1-based page numbers
   */
  function parsePageRange(rangeStr, maxPages) {
    const clean = (rangeStr || '').trim();
    if (!clean) {
      const all = [];
      for (let p = 1; p <= maxPages; p++) all.push(p);
      return all;
    }

    const set = new Set();
    clean.split(',').forEach(function (part) {
      const trimmed = part.trim();
      if (!trimmed) return;
      if (trimmed.includes('-')) {
        const bounds = trimmed.split('-').map(function (s) {
          return parseInt(s.trim(), 10);
        });
        const start = bounds[0];
        const end = bounds[1];
        if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
          for (let p = start; p <= Math.min(end, maxPages); p++) {
            set.add(p);
          }
        }
      } else {
        const single = parseInt(trimmed, 10);
        if (Number.isInteger(single) && single >= 1 && single <= maxPages) {
          set.add(single);
        }
      }
    });

    return Array.from(set).sort(function (a, b) {
      return a - b;
    });
  }

  /**
   * Escape XML special characters for OpenXML word/document.xml
   */
  function escapeXml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Group pdf.js textContent items into ordered visual lines and smart paragraphs
   */
  function reconstructLinesAndParagraphs(items, mode) {
    const validItems = (items || [])
      .filter(function (it) {
        return it && typeof it.str === 'string' && it.str.trim().length > 0 && Array.isArray(it.transform);
      })
      .map(function (it) {
        const x = Number(it.transform[4]) || 0;
        const y = Number(it.transform[5]) || 0;
        const fontHeight = Math.abs(Number(it.transform[3]) || Number(it.height) || 11);
        return {
          str: it.str,
          x: x,
          y: y,
          width: Number(it.width) || 0,
          fontSize: Math.round(fontHeight * 10) / 10
        };
      });

    if (validItems.length === 0) {
      return { lines: [], paragraphs: [], rawItemCount: 0 };
    }

    // Sort top-to-bottom (higher Y first in PDF coordinates), then left-to-right (lower X first)
    validItems.sort(function (a, b) {
      if (Math.abs(b.y - a.y) > 4) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

    // Group items with similar Y coordinates into visual lines
    const lineGroups = [];
    validItems.forEach(function (item) {
      const lastGroup = lineGroups[lineGroups.length - 1];
      if (lastGroup && Math.abs(lastGroup.y - item.y) <= 4.5) {
        lastGroup.items.push(item);
      } else {
        lineGroups.push({
          y: item.y,
          items: [item]
        });
      }
    });

    const lines = lineGroups.map(function (grp) {
      grp.items.sort(function (a, b) {
        return a.x - b.x;
      });
      let lineText = '';
      let maxFont = 0;
      for (let i = 0; i < grp.items.length; i++) {
        const cur = grp.items[i];
        if (cur.fontSize > maxFont) maxFont = cur.fontSize;
        if (i > 0) {
          const prev = grp.items[i - 1];
          const gap = cur.x - (prev.x + prev.width);
          if (gap > 12) {
            lineText += '   ';
          } else if (gap > 1.5 && !lineText.endsWith(' ') && !cur.str.startsWith(' ')) {
            lineText += ' ';
          }
        }
        lineText += cur.str;
      }
      return {
        text: lineText.trim(),
        y: grp.y,
        fontSize: maxFont || 11,
        isHeading: maxFont >= 15.5
      };
    });

    if (mode === 'lines') {
      return {
        lines: lines,
        paragraphs: lines.map(function (l) {
          return { text: l.text, isHeading: l.isHeading };
        }),
        rawItemCount: validItems.length
      };
    }

    // Smart paragraph merging: combine consecutive body lines unless separated by a large vertical gap or heading change
    const paragraphs = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.text) continue;

      if (paragraphs.length === 0) {
        paragraphs.push({
          text: line.text,
          isHeading: line.isHeading,
          lastY: line.y,
          lastFontSize: line.fontSize
        });
        continue;
      }

      const prevPara = paragraphs[paragraphs.length - 1];
      const yGap = Math.abs(prevPara.lastY - line.y);
      const isBullet = /^([•\-*▪]|\d+[.)])\s+/.test(line.text);

      if (
        prevPara.isHeading ||
        line.isHeading ||
        isBullet ||
        yGap > line.fontSize * 1.85 ||
        /[.:;!?]$/.test(prevPara.text)
      ) {
        paragraphs.push({
          text: line.text,
          isHeading: line.isHeading,
          lastY: line.y,
          lastFontSize: line.fontSize
        });
      } else {
        if (prevPara.text.endsWith('-')) {
          prevPara.text = prevPara.text.slice(0, -1) + line.text;
        } else {
          prevPara.text += ' ' + line.text;
        }
        prevPara.lastY = line.y;
      }
    }

    return {
      lines: lines,
      paragraphs: paragraphs,
      rawItemCount: validItems.length
    };
  }

  /**
   * Build a valid Office Open XML (.docx) file Blob using JSZip
   */
  function buildDocxBlob(pagesData, includePageBreaks, docTitle) {
    if (typeof window.JSZip !== 'function') {
      return Promise.reject(new Error('JSZip library is not loaded.'));
    }

    const zip = new window.JSZip();

    const contentTypesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>';

    const relsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>';

    const wordRelsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';

    const stylesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults>' +
      '<w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Nirmala UI"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
      '</w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
      '<w:name w:val="Normal"/><w:qFormat/>' +
      '</w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1">' +
      '<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr>' +
      '<w:rPr><w:b/><w:bCs/><w:color w:val="1E3A8A"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>' +
      '</w:style>' +
      '</w:styles>';

    const bodyParagraphsXml = [];

    if (docTitle) {
      bodyParagraphsXml.push(
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' +
          '<w:r><w:t xml:space="preserve">' +
          escapeXml(docTitle) +
          '</w:t></w:r></w:p>'
      );
    }

    pagesData.forEach(function (page, idx) {
      const paras = page.paragraphs || [];
      if (paras.length === 0) {
        bodyParagraphsXml.push(
          '<w:p><w:r><w:t xml:space="preserve">[Page ' +
            page.pageNumber +
            ': No selectable text found on this page.]</w:t></w:r></w:p>'
        );
      } else {
        paras.forEach(function (p) {
          const styleTag = p.isHeading ? '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' : '';
          bodyParagraphsXml.push(
            '<w:p>' +
              styleTag +
              '<w:r><w:t xml:space="preserve">' +
              escapeXml(p.text) +
              '</w:t></w:r></w:p>'
          );
        });
      }

      if (includePageBreaks && idx < pagesData.length - 1) {
        bodyParagraphsXml.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      }
    });

    const documentXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
      bodyParagraphsXml.join('') +
      '<w:sectPr>' +
      '<w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>' +
      '</w:sectPr>' +
      '</w:body>' +
      '</w:document>';

    zip.file('[Content_Types].xml', contentTypesXml);
    zip.folder('_rels').file('.rels', relsXml);
    const wordFolder = zip.folder('word');
    wordFolder.file('document.xml', documentXml);
    wordFolder.file('styles.xml', stylesXml);
    wordFolder.folder('_rels').file('document.xml.rels', wordRelsXml);

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  /**
   * Create a sample 2-page PDF with headings and paragraphs for instant testing
   */
  function createSampleDocumentPdfFile() {
    const lines = [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >> endobj',
      '4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >> endobj',
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      '6 0 obj << /Length 310 >> stream\nBT /F1 20 Tf 60 720 Td (ToolNest Business Proposal - Page 1) Tj /F1 12 Tf 0 -36 Td (1. Executive Summary) Tj 0 -22 Td (This sample PDF document demonstrates 100% browser-based PDF to MS Word conversion.) Tj 0 -18 Td (All headings and paragraphs are extracted locally and packaged into a clean DOCX file.) Tj 0 -30 Td (2. Key Project Deliverables) Tj 0 -20 Td (- Client-side privacy with zero server uploads.) Tj 0 -18 Td (- Editable Word paragraphs and page break preservation.) Tj ET\nendstream endobj',
      '7 0 obj << /Length 245 >> stream\nBT /F1 20 Tf 60 720 Td (Financial & Timeline Overview - Page 2) Tj /F1 12 Tf 0 -36 Td (3. Implementation Schedule) Tj 0 -22 Td (Phase 1: Requirements discovery and UI design completed in Week 1.) Tj 0 -18 Td (Phase 2: Client-side OpenXML DOCX generator deployed in Week 2.) Tj 0 -30 Td (Approved by: ToolNest Engineering Team, Dhaka.) Tj ET\nendstream endobj'
    ];

    let body = '';
    const offsets = [0];
    lines.forEach(function (l) {
      offsets.push(body.length);
      body += l + '\n';
    });
    const xrefStart = body.length;
    body += 'xref\n0 ' + offsets.length + '\n0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i++) {
      body += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    body += 'trailer << /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF';

    const blob = new Blob([body], { type: 'application/pdf' });
    return new File([blob], 'toolnest-sample-proposal-2pages.pdf', { type: 'application/pdf' });
  }

  // Expose helpers for automated testing
  if (typeof window !== 'undefined') {
    window.ToolNestPdfToWord = {
      parsePageRange: parsePageRange,
      reconstructLinesAndParagraphs: reconstructLinesAndParagraphs,
      buildDocxBlob: buildDocxBlob,
      createSampleDocumentPdfFile: createSampleDocumentPdfFile
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-p2w-dropzone');
    const fileInput = document.getElementById('tn-p2w-file-input');
    const fileInfoBar = document.getElementById('tn-p2w-file-info');
    const fileNameEl = document.getElementById('tn-p2w-file-name');
    const pageCountBadge = document.getElementById('tn-p2w-page-badge');

    const modeSelect = document.getElementById('tn-p2w-mode');
    const rangeModeSelect = document.getElementById('tn-p2w-range-mode');
    const rangeInputWrap = document.getElementById('tn-p2w-range-wrap');
    const rangeInput = document.getElementById('tn-p2w-range-input');
    const pageBreakCheck = document.getElementById('tn-p2w-page-breaks');

    const extractBtn = document.getElementById('tn-p2w-extract-btn');
    const sampleBtn = document.getElementById('tn-p2w-sample-btn');
    const resetBtn = document.getElementById('tn-p2w-reset-btn');

    const progressWrap = document.getElementById('tn-p2w-progress-wrap');
    const progressText = document.getElementById('tn-p2w-progress-text');
    const progressBar = document.getElementById('tn-p2w-progress-bar');
    const errorBox = document.getElementById('tn-p2w-error-box');

    const resultsWrap = document.getElementById('tn-p2w-results-wrap');
    const statsBadge = document.getElementById('tn-p2w-stats-badge');
    const previewTextarea = document.getElementById('tn-p2w-preview-text');
    const dlDocxBtn = document.getElementById('tn-p2w-dl-docx');
    const dlDocBtn = document.getElementById('tn-p2w-dl-doc');
    const dlTxtBtn = document.getElementById('tn-p2w-dl-txt');
    const copyTextBtn = document.getElementById('tn-p2w-copy-btn');

    if (!dropzone || !fileInput) return;

    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    }

    function showError(msg) {
      if (!errorBox) return;
      if (!msg) {
        errorBox.classList.add('d-none');
        errorBox.textContent = '';
      } else {
        errorBox.classList.remove('d-none');
        errorBox.innerHTML =
          '<i class="bi bi-exclamation-octagon-fill me-1" aria-hidden="true"></i> ' +
          window.ToolNest.escapeHtml(msg);
      }
    }

    rangeModeSelect.addEventListener('change', function () {
      const isCustom = rangeModeSelect.value === 'custom';
      rangeInputWrap.classList.toggle('d-none', !isCustom);
    });

    function loadPdfDocument(file) {
      showError('');
      if (!file) return;

      if (!window.pdfjsLib) {
        showError('PDF.js engine is still loading. Please wait a moment and try again.');
        return;
      }

      currentPdfFile = file;
      extractedPages = [];
      resultsWrap.classList.add('d-none');

      file
        .arrayBuffer()
        .then(function (buf) {
          const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(buf) });
          return loadingTask.promise;
        })
        .then(function (pdfDoc) {
          currentPdfDoc = pdfDoc;
          totalPages = pdfDoc.numPages;

          fileInfoBar.classList.remove('d-none');
          fileNameEl.textContent = file.name + ' (' + window.ToolNest.formatBytes(file.size) + ')';
          pageCountBadge.textContent = totalPages + (totalPages === 1 ? ' Page' : ' Pages');
          rangeInput.placeholder = 'e.g. 1-' + totalPages;
          if (!rangeInput.value) {
            rangeInput.value = '1-' + totalPages;
          }

          return runTextExtraction();
        })
        .catch(function (err) {
          currentPdfDoc = null;
          totalPages = 0;
          fileInfoBar.classList.add('d-none');
          if (err && (err.name === 'PasswordException' || /password/i.test(err.message || ''))) {
            showError(
              'This PDF is password-protected. Please unlock the PDF first before converting to Word.'
            );
          } else {
            showError('Could not read this PDF file. Please verify it is a valid, uncorrupted PDF document.');
          }
        });
    }

    async function runTextExtraction() {
      if (!currentPdfDoc || totalPages === 0) {
        showError('Please upload a PDF file first.');
        return;
      }

      showError('');
      const pagesToExtract =
        rangeModeSelect.value === 'custom'
          ? parsePageRange(rangeInput.value, totalPages)
          : parsePageRange('', totalPages);

      if (pagesToExtract.length === 0) {
        showError('Invalid page range. Enter page numbers between 1 and ' + totalPages + '.');
        return;
      }

      extractBtn.disabled = true;
      progressWrap.classList.remove('d-none');
      progressBar.style.width = '0%';
      extractedPages = [];

      const groupingMode = modeSelect.value || 'paragraphs';
      let totalWords = 0;
      let totalItems = 0;

      try {
        for (let i = 0; i < pagesToExtract.length; i++) {
          const pageNum = pagesToExtract[i];
          const pct = Math.round(((i + 1) / pagesToExtract.length) * 100);
          progressText.textContent =
            'Extracting text from page ' + pageNum + ' (' + (i + 1) + ' of ' + pagesToExtract.length + ')...';
          progressBar.style.width = pct + '%';

          const page = await currentPdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const reconstructed = reconstructLinesAndParagraphs(textContent.items, groupingMode);

          totalItems += reconstructed.rawItemCount;
          reconstructed.paragraphs.forEach(function (p) {
            const w = p.text.trim().split(/\s+/).filter(Boolean).length;
            totalWords += w;
          });

          extractedPages.push({
            pageNumber: pageNum,
            lines: reconstructed.lines,
            paragraphs: reconstructed.paragraphs,
            rawItemCount: reconstructed.rawItemCount
          });
        }

        // Populate editable preview textarea
        const pageBlocks = extractedPages.map(function (pg) {
          const header = '--- Page ' + pg.pageNumber + ' ---\n';
          const body =
            pg.paragraphs.length > 0
              ? pg.paragraphs
                  .map(function (p) {
                    return p.text;
                  })
                  .join('\n\n')
              : '[No selectable text found on Page ' + pg.pageNumber + ']';
          return header + body;
        });

        previewTextarea.value = pageBlocks.join('\n\n');
        statsBadge.textContent =
          extractedPages.length + ' Page(s) • ' + totalWords.toLocaleString('en-US') + ' Words Ready';
        resultsWrap.classList.remove('d-none');

        if (totalItems === 0) {
          showError(
            'Note: This PDF appears to contain scanned images without selectable text layers. The generated Word file will note that no selectable text was found.'
          );
        } else {
          window.ToolNest.showToast('Converted ' + extractedPages.length + ' PDF page(s) to Word!', 'success');
        }
      } catch (e) {
        showError(e && e.message ? e.message : 'An error occurred while extracting text from the PDF.');
      } finally {
        extractBtn.disabled = false;
        progressWrap.classList.add('d-none');
      }
    }

    window.ToolNest.setupDropzone(dropzone, fileInput, function (files) {
      const pdfFile = files.find(function (f) {
        return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      });
      if (!pdfFile) {
        showError('Please select a valid .PDF file.');
        return;
      }
      loadPdfDocument(pdfFile);
    });

    extractBtn.addEventListener('click', runTextExtraction);
    modeSelect.addEventListener('change', function () {
      if (currentPdfDoc) runTextExtraction();
    });

    dlDocxBtn.addEventListener('click', function () {
      if (extractedPages.length === 0) return;
      const baseName = currentPdfFile ? currentPdfFile.name.replace(/\.pdf$/i, '') : 'toolnest-document';

      // Use user edits from previewTextarea if modified, or structured extractedPages
      const editedText = previewTextarea.value.trim();
      const pagesForDocx = editedText
        ? [
            {
              pageNumber: 1,
              paragraphs: editedText
                .split(/\n{2,}/)
                .map(function (block) {
                  const clean = block.trim();
                  return {
                    text: clean,
                    isHeading: /^---\s*Page\s+\d+\s*---$/i.test(clean) || clean.length < 55 && /^[0-9]+\.\s+/.test(clean)
                  };
                })
                .filter(function (b) {
                  return b.text.length > 0;
                })
            }
          ]
        : extractedPages;

      buildDocxBlob(pagesForDocx, pageBreakCheck.checked, '')
        .then(function (blob) {
          window.ToolNest.downloadBlob(blob, baseName + '.docx');
        })
        .catch(function (err) {
          showError(err.message || 'Could not generate .docx file.');
        });
    });

    if (dlDocBtn) {
      dlDocBtn.addEventListener('click', function () {
        if (!previewTextarea.value.trim()) return;
        const baseName = currentPdfFile ? currentPdfFile.name.replace(/\.pdf$/i, '') : 'toolnest-document';
        const parasHtml = previewTextarea.value
          .split(/\n{2,}/)
          .map(function (p) {
            return '<p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;">' + window.ToolNest.escapeHtml(p.trim()).replace(/\n/g, '<br>') + '</p>';
          })
          .join('');
        const wordHtml =
          '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
          '<head><meta charset="utf-8"><title>' +
          window.ToolNest.escapeHtml(baseName) +
          '</title></head><body>' +
          parasHtml +
          '</body></html>';
        const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword;charset=utf-8' });
        window.ToolNest.downloadBlob(blob, baseName + '.doc');
      });
    }

    if (dlTxtBtn) {
      dlTxtBtn.addEventListener('click', function () {
        if (!previewTextarea.value.trim()) return;
        const baseName = currentPdfFile ? currentPdfFile.name.replace(/\.pdf$/i, '') : 'toolnest-document';
        const blob = new Blob([previewTextarea.value], { type: 'text/plain;charset=utf-8' });
        window.ToolNest.downloadBlob(blob, baseName + '.txt');
      });
    }

    if (copyTextBtn) {
      copyTextBtn.addEventListener('click', function () {
        window.ToolNest.copyToClipboard(previewTextarea.value, copyTextBtn);
      });
    }

    if (sampleBtn) {
      sampleBtn.addEventListener('click', function () {
        const samplePdf = createSampleDocumentPdfFile();
        loadPdfDocument(samplePdf);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        currentPdfFile = null;
        currentPdfDoc = null;
        totalPages = 0;
        extractedPages = [];
        fileInput.value = '';
        fileInfoBar.classList.add('d-none');
        resultsWrap.classList.add('d-none');
        previewTextarea.value = '';
        showError('');
      });
    }
  });
})();
