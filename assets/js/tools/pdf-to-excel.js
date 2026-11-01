/**
 * ToolNest - PDF to MS Excel (.XLSX & .CSV) Converter (/assets/js/tools/pdf-to-excel.js)
 * 100% Client-Side PDF Table Extractor powered by Mozilla pdf.js 3.11.174 and JSZip 3.10.1.
 * Uses X/Y coordinate clustering to reconstruct rows and columns, builds a genuine
 * Office Open XML (.xlsx) workbook in memory (single sheet or multi-sheet per page),
 * and supports CSV download plus Tab-Separated copy for direct paste into Excel/Sheets.
 */
(function () {
  'use strict';

  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let currentPdfFile = null;
  let currentPdfDoc = null;
  let totalPages = 0;
  // Array of { pageNumber, rows: string[][] }
  let extractedSheetPages = [];

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

  function escapeXml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Convert 0-based column index to Excel column letters (0 -> A, 25 -> Z, 26 -> AA)
   */
  function colIndexToLetter(colIdx) {
    let n = colIdx + 1;
    let letters = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      letters = String.fromCharCode(65 + rem) + letters;
      n = Math.floor((n - 1) / 26);
    }
    return letters || 'A';
  }

  /**
   * Extract 2D table rows (array of string arrays) from pdf.js textContent items using Y/X coordinates
   */
  function extractTableRowsFromItems(items, colGapThreshold) {
    const gapLimit = Number(colGapThreshold) || 14;
    const valid = (items || [])
      .filter(function (it) {
        return it && typeof it.str === 'string' && it.str.trim().length > 0 && Array.isArray(it.transform);
      })
      .map(function (it) {
        const x = Number(it.transform[4]) || 0;
        const y = Number(it.transform[5]) || 0;
        const w = Number(it.width) || it.str.length * 5.2;
        return {
          str: it.str.trim(),
          x: x,
          y: y,
          width: w
        };
      });

    if (valid.length === 0) return [];

    // Sort top-to-bottom (descending Y), then left-to-right (ascending X)
    valid.sort(function (a, b) {
      if (Math.abs(b.y - a.y) > 4.5) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

    // Cluster into horizontal rows by Y coordinate
    const rowGroups = [];
    valid.forEach(function (item) {
      const last = rowGroups[rowGroups.length - 1];
      if (last && Math.abs(last.y - item.y) <= 4.8) {
        last.items.push(item);
      } else {
        rowGroups.push({
          y: item.y,
          items: [item]
        });
      }
    });

    // Within each row, split cells by X-coordinate gap or multi-space/pipe delimiters
    const rows = rowGroups.map(function (grp) {
      grp.items.sort(function (a, b) {
        return a.x - b.x;
      });

      const cells = [];
      for (let i = 0; i < grp.items.length; i++) {
        const cur = grp.items[i];
        // Also check if a single PDF text run contains multiple columns separated by 2+ spaces or tabs or pipes
        const subParts = cur.str.split(/\s{2,}|\t|\s*\|\s*/).filter(Boolean);

        if (i === 0) {
          cells.push.apply(cells, subParts);
          continue;
        }

        const prev = grp.items[i - 1];
        const xGap = cur.x - (prev.x + prev.width);

        if (xGap >= gapLimit || subParts.length > 1) {
          cells.push.apply(cells, subParts);
        } else {
          // Same cell continuation
          cells[cells.length - 1] = (cells[cells.length - 1] + ' ' + cur.str).trim();
        }
      }
      return cells;
    });

    return rows;
  }

  /**
   * Build XML for a single OpenXML worksheet given a 2D array of rows
   */
  function buildWorksheetXml(rows) {
    const rowXmlList = [];

    for (let r = 0; r < rows.length; r++) {
      const rowNum = r + 1;
      const cells = rows[r] || [];
      const cellXmlList = [];

      for (let c = 0; c < cells.length; c++) {
        const rawVal = String(cells[c] == null ? '' : cells[c]).trim();
        if (!rawVal) continue;

        const cellRef = colIndexToLetter(c) + rowNum;
        // Detect clean numeric values (allowing optional commas and decimals)
        const cleanNumeric = rawVal.replace(/,/g, '');
        const isNumeric = /^-?\d+(\.\d+)?$/.test(cleanNumeric) && !/^0\d+/.test(cleanNumeric);
        const styleAttr = r === 0 ? ' s="1"' : '';

        if (isNumeric && r > 0) {
          cellXmlList.push('<c r="' + cellRef + '" t="n"' + styleAttr + '><v>' + cleanNumeric + '</v></c>');
        } else {
          cellXmlList.push(
            '<c r="' +
              cellRef +
              '" t="inlineStr"' +
              styleAttr +
              '><is><t xml:space="preserve">' +
              escapeXml(rawVal) +
              '</t></is></c>'
          );
        }
      }

      rowXmlList.push('<row r="' + rowNum + '">' + cellXmlList.join('') + '</row>');
    }

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetData>' +
      rowXmlList.join('') +
      '</sheetData>' +
      '</worksheet>'
    );
  }

  /**
   * Build a valid Office Open XML (.xlsx) Workbook Blob using JSZip
   */
  function buildXlsxBlob(sheetPages, sheetMode) {
    if (typeof window.JSZip !== 'function') {
      return Promise.reject(new Error('JSZip library is not loaded.'));
    }

    const zip = new window.JSZip();
    const sheets = [];

    if (sheetMode === 'multi' && sheetPages.length > 1) {
      sheetPages.forEach(function (sp, idx) {
        sheets.push({
          id: idx + 1,
          name: 'Page_' + sp.pageNumber,
          rows: sp.rows
        });
      });
    } else {
      const combinedRows = [];
      sheetPages.forEach(function (sp) {
        sp.rows.forEach(function (row) {
          combinedRows.push(row);
        });
      });
      sheets.push({
        id: 1,
        name: 'Extracted_Table',
        rows: combinedRows
      });
    }

    const sheetOverridesXml = sheets
      .map(function (s) {
        return (
          '<Override PartName="/xl/worksheets/sheet' +
          s.id +
          '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        );
      })
      .join('');

    const contentTypesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheetOverridesXml +
      '</Types>';

    const rootRelsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    const workbookSheetsXml = sheets
      .map(function (s) {
        return '<sheet name="' + escapeXml(s.name) + '" sheetId="' + s.id + '" r:id="rId' + s.id + '"/>';
      })
      .join('');

    const workbookXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' +
      workbookSheetsXml +
      '</sheets>' +
      '</workbook>';

    const workbookRelsEntries = sheets
      .map(function (s) {
        return (
          '<Relationship Id="rId' +
          s.id +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
          s.id +
          '.xml"/>'
        );
      })
      .join('');

    const stylesRelId = 'rId' + (sheets.length + 1);
    const workbookRelsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      workbookRelsEntries +
      '<Relationship Id="' +
      stylesRelId +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';

    const stylesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="2">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '</fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '</cellXfs>' +
      '</styleSheet>';

    zip.file('[Content_Types].xml', contentTypesXml);
    zip.folder('_rels').file('.rels', rootRelsXml);
    const xl = zip.folder('xl');
    xl.file('workbook.xml', workbookXml);
    xl.file('styles.xml', stylesXml);
    xl.folder('_rels').file('workbook.xml.rels', workbookRelsXml);

    const wsFolder = xl.folder('worksheets');
    sheets.forEach(function (s) {
      wsFolder.file('sheet' + s.id + '.xml', buildWorksheetXml(s.rows));
    });

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /**
   * Convert 2D rows array into RFC-4180 CSV string
   */
  function rowsToCsv(rows) {
    return (rows || [])
      .map(function (row) {
        return (row || [])
          .map(function (cell) {
            const s = String(cell == null ? '' : cell);
            if (/[",\n\r]/.test(s)) {
              return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
          })
          .join(',');
      })
      .join('\n');
  }

  /**
   * Create a sample 2-page PDF containing tabular financial/inventory rows for instant testing
   */
  function createSampleTablePdfFile() {
    const lines = [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >> endobj',
      '4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >> endobj',
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj',
      '6 0 obj << /Length 360 >> stream\nBT /F1 11 Tf 50 720 Td (Item_Code   Product_Name          Category     Qty   Unit_BDT   Total_BDT) Tj 0 -22 Td (SKU-101     Cotton_Panjabi_White  Apparel      15    1450       21750) Tj 0 -20 Td (SKU-102     Jamdani_Saree_Silk    Ethnic       8     4500       36000) Tj 0 -20 Td (SKU-103     Leather_Loafer_Tan    Footwear     12    2200       26400) Tj 0 -20 Td (SKU-104     Linen_Kurti_Stitched  Apparel      20    1150       23000) Tj ET\nendstream endobj',
      '7 0 obj << /Length 265 >> stream\nBT /F1 11 Tf 50 720 Td (SKU-105     Denim_Jacket_Indigo   Outerwear    10    2800       28000) Tj 0 -20 Td (SKU-106     Canvas_Tote_Bag       Accessories  35    450        15750) Tj 0 -20 Td (SKU-107     Formal_Oxford_Shirt   Apparel      18    1600       28800) Tj ET\nendstream endobj'
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
    return new File([blob], 'toolnest-sample-sales-table-2pages.pdf', { type: 'application/pdf' });
  }

  // Expose helpers for automated testing
  if (typeof window !== 'undefined') {
    window.ToolNestPdfToExcel = {
      parsePageRange: parsePageRange,
      colIndexToLetter: colIndexToLetter,
      extractTableRowsFromItems: extractTableRowsFromItems,
      buildXlsxBlob: buildXlsxBlob,
      rowsToCsv: rowsToCsv,
      createSampleTablePdfFile: createSampleTablePdfFile
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-p2e-dropzone');
    const fileInput = document.getElementById('tn-p2e-file-input');
    const fileInfoBar = document.getElementById('tn-p2e-file-info');
    const fileNameEl = document.getElementById('tn-p2e-file-name');
    const pageCountBadge = document.getElementById('tn-p2e-page-badge');

    const sheetModeSelect = document.getElementById('tn-p2e-sheet-mode');
    const colGapSelect = document.getElementById('tn-p2e-col-gap');
    const rangeModeSelect = document.getElementById('tn-p2e-range-mode');
    const rangeInputWrap = document.getElementById('tn-p2e-range-wrap');
    const rangeInput = document.getElementById('tn-p2e-range-input');

    const extractBtn = document.getElementById('tn-p2e-extract-btn');
    const sampleBtn = document.getElementById('tn-p2e-sample-btn');
    const resetBtn = document.getElementById('tn-p2e-reset-btn');

    const progressWrap = document.getElementById('tn-p2e-progress-wrap');
    const progressText = document.getElementById('tn-p2e-progress-text');
    const progressBar = document.getElementById('tn-p2e-progress-bar');
    const errorBox = document.getElementById('tn-p2e-error-box');

    const resultsWrap = document.getElementById('tn-p2e-results-wrap');
    const statsBadge = document.getElementById('tn-p2e-stats-badge');
    const tableHeadEl = document.getElementById('tn-p2e-table-head');
    const tableBodyEl = document.getElementById('tn-p2e-table-body');

    const dlXlsxBtn = document.getElementById('tn-p2e-dl-xlsx');
    const dlCsvBtn = document.getElementById('tn-p2e-dl-csv');
    const copyTsvBtn = document.getElementById('tn-p2e-copy-btn');

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

    function getAllCombinedRows() {
      const all = [];
      extractedSheetPages.forEach(function (sp) {
        sp.rows.forEach(function (r) {
          all.push(r);
        });
      });
      return all;
    }

    function renderTablePreview() {
      const rows = getAllCombinedRows();
      if (rows.length === 0) {
        tableHeadEl.innerHTML = '';
        tableBodyEl.innerHTML =
          '<tr><td class="text-center text-muted py-4">No tabular text rows found in the selected PDF pages.</td></tr>';
        statsBadge.textContent = '0 Rows Extracted';
        return;
      }

      let maxCols = 1;
      rows.forEach(function (r) {
        if (r.length > maxCols) maxCols = r.length;
      });

      // Render Excel-style column headers (A, B, C, ...)
      const colHeaders = ['<th class="bg-light text-muted text-center" style="width:46px;">#</th>'];
      for (let c = 0; c < maxCols; c++) {
        colHeaders.push('<th class="bg-light text-center">' + colIndexToLetter(c) + '</th>');
      }
      tableHeadEl.innerHTML = '<tr>' + colHeaders.join('') + '</tr>';

      // Render up to 150 preview rows in DOM for smooth responsiveness
      const previewSlice = rows.slice(0, 150);
      tableBodyEl.innerHTML = previewSlice
        .map(function (row, rIdx) {
          const cellsHtml = [
            '<td class="bg-light text-muted text-center fw-semibold">' + (rIdx + 1) + '</td>'
          ];
          for (let c = 0; c < maxCols; c++) {
            const val = row[c] != null ? row[c] : '';
            const isFirstRow = rIdx === 0 ? ' class="fw-bold bg-primary-subtle"' : '';
            cellsHtml.push('<td' + isFirstRow + '>' + window.ToolNest.escapeHtml(val) + '</td>');
          }
          return '<tr>' + cellsHtml.join('') + '</tr>';
        })
        .join('');

      statsBadge.textContent =
        rows.length + ' Row(s) × ' + maxCols + ' Column(s) Ready';
    }

    function loadPdfForTableExtraction(file) {
      showError('');
      if (!file) return;

      if (!window.pdfjsLib) {
        showError('PDF.js engine is still loading. Please wait a moment and try again.');
        return;
      }

      currentPdfFile = file;
      extractedSheetPages = [];
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

          return runTableExtraction();
        })
        .catch(function (err) {
          currentPdfDoc = null;
          totalPages = 0;
          fileInfoBar.classList.add('d-none');
          if (err && (err.name === 'PasswordException' || /password/i.test(err.message || ''))) {
            showError(
              'This PDF is password-protected. Please unlock the PDF first before converting to Excel.'
            );
          } else {
            showError('Could not read this PDF file. Please verify it is a valid, uncorrupted PDF document.');
          }
        });
    }

    async function runTableExtraction() {
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
      extractedSheetPages = [];

      const gapThreshold = Number(colGapSelect.value) || 14;

      try {
        for (let i = 0; i < pagesToExtract.length; i++) {
          const pageNum = pagesToExtract[i];
          const pct = Math.round(((i + 1) / pagesToExtract.length) * 100);
          progressText.textContent =
            'Extracting table rows from page ' + pageNum + ' (' + (i + 1) + ' of ' + pagesToExtract.length + ')...';
          progressBar.style.width = pct + '%';

          const page = await currentPdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const rows = extractTableRowsFromItems(textContent.items, gapThreshold);

          extractedSheetPages.push({
            pageNumber: pageNum,
            rows: rows
          });
        }

        renderTablePreview();
        resultsWrap.classList.remove('d-none');

        const totalRowsCount = getAllCombinedRows().length;
        if (totalRowsCount === 0) {
          showError(
            'Note: No selectable text rows were found in this PDF. Scanned image PDFs require OCR before spreadsheet extraction.'
          );
        } else {
          window.ToolNest.showToast('Extracted ' + totalRowsCount + ' row(s) into Excel preview!', 'success');
        }
      } catch (e) {
        showError(e && e.message ? e.message : 'An error occurred while extracting tables from the PDF.');
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
      loadPdfForTableExtraction(pdfFile);
    });

    extractBtn.addEventListener('click', runTableExtraction);
    colGapSelect.addEventListener('change', function () {
      if (currentPdfDoc) runTableExtraction();
    });

    dlXlsxBtn.addEventListener('click', function () {
      if (extractedSheetPages.length === 0) return;
      const baseName = currentPdfFile ? currentPdfFile.name.replace(/\.pdf$/i, '') : 'toolnest-table';
      buildXlsxBlob(extractedSheetPages, sheetModeSelect.value)
        .then(function (blob) {
          window.ToolNest.downloadBlob(blob, baseName + '.xlsx');
        })
        .catch(function (err) {
          showError(err.message || 'Could not generate .xlsx workbook.');
        });
    });

    dlCsvBtn.addEventListener('click', function () {
      const rows = getAllCombinedRows();
      if (rows.length === 0) return;
      const baseName = currentPdfFile ? currentPdfFile.name.replace(/\.pdf$/i, '') : 'toolnest-table';
      const csvText = rowsToCsv(rows);
      const blob = new Blob(['\ufeff', csvText], { type: 'text/csv;charset=utf-8' });
      window.ToolNest.downloadBlob(blob, baseName + '.csv');
    });

    copyTsvBtn.addEventListener('click', function () {
      const rows = getAllCombinedRows();
      if (rows.length === 0) return;
      const tsv = rows
        .map(function (r) {
          return r.join('\t');
        })
        .join('\n');
      window.ToolNest.copyToClipboard(tsv, copyTsvBtn);
    });

    if (sampleBtn) {
      sampleBtn.addEventListener('click', function () {
        const samplePdf = createSampleTablePdfFile();
        loadPdfForTableExtraction(samplePdf);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        currentPdfFile = null;
        currentPdfDoc = null;
        totalPages = 0;
        extractedSheetPages = [];
        fileInput.value = '';
        fileInfoBar.classList.add('d-none');
        resultsWrap.classList.add('d-none');
        tableHeadEl.innerHTML = '';
        tableBodyEl.innerHTML = '';
        showError('');
      });
    }
  });
})();
