/**
 * ToolNest — MS Excel to PDF Converter (.XLSX & .CSV to PDF)
 * Automatically parses Excel (.xlsx) OpenXML workbooks via JSZip and CSV/TSV files 100% client-side,
 * converts the spreadsheet into a matching multi-page vector PDF table on upload via pdf-lib,
 * and lets the user download the converted PDF with one click.
 */
(function () {
  'use strict';

  var THEMES = {
    emerald: {
      name: 'Excel Classic',
      headerBg: [0.06, 0.38, 0.25],
      headerText: [1, 1, 1],
      stripeBg: [0.95, 0.98, 0.96],
      borderColor: [0.76, 0.83, 0.79]
    }
  };

  function decodeXmlEntities(str) {
    if (!str) return '';
    return String(str)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      })
      .replace(/&#(\d+);/g, function (_, dec) {
        return String.fromCharCode(parseInt(dec, 10));
      });
  }

  /**
   * Convert Excel column letters (e.g. "A" -> 0, "B" -> 1, "AA" -> 26)
   */
  function colRefToIndex(cellRef) {
    if (!cellRef) return -1;
    var match = String(cellRef).match(/^([A-Z]+)/i);
    if (!match) return -1;
    var letters = match[1].toUpperCase();
    var idx = 0;
    for (var i = 0; i < letters.length; i++) {
      idx = idx * 26 + (letters.charCodeAt(i) - 64);
    }
    return idx - 1;
  }

  /**
   * Parse xl/sharedStrings.xml into an array of strings
   */
  function parseSharedStringsXml(xmlStr) {
    if (!xmlStr) return [];
    var strings = [];
    var siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    var siMatch;
    while ((siMatch = siRegex.exec(xmlStr)) !== null) {
      var siBody = siMatch[1];
      var tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g;
      var tMatch;
      var textParts = [];
      while ((tMatch = tRegex.exec(siBody)) !== null) {
        textParts.push(decodeXmlEntities(tMatch[1]));
      }
      strings.push(textParts.join(''));
    }
    return strings;
  }

  /**
   * Parse an OpenXML worksheet (xl/worksheets/sheet*.xml) into a 2D array of strings
   */
  function parseWorksheetXml(sheetXml, sharedStrings) {
    if (!sheetXml) return [];
    var ss = sharedStrings || [];
    var rows = [];
    var maxCols = 0;

    var rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
    var rowMatch;
    while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
      var rowBody = rowMatch[1];
      var rowCells = [];
      var nextCol = 0;

      var cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      var cellMatch;
      while ((cellMatch = cellRegex.exec(rowBody)) !== null) {
        var attrs = cellMatch[1] || '';
        var cellInner = cellMatch[2] || '';

        var refMatch = attrs.match(/\br="([A-Z]+\d+)"/i);
        var colIdx = refMatch ? colRefToIndex(refMatch[1]) : nextCol;
        if (colIdx < 0) colIdx = nextCol;

        var typeMatch = attrs.match(/\bt="([^"]+)"/);
        var cellType = typeMatch ? typeMatch[1] : 'n';

        var cellValue = '';
        if (cellType === 'inlineStr') {
          var isRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g;
          var isMatch;
          var inlineParts = [];
          while ((isMatch = isRegex.exec(cellInner)) !== null) {
            inlineParts.push(decodeXmlEntities(isMatch[1]));
          }
          cellValue = inlineParts.join('');
        } else {
          var vMatch = cellInner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
          var rawVal = vMatch ? decodeXmlEntities(vMatch[1].trim()) : '';
          if (cellType === 's') {
            var ssIdx = parseInt(rawVal, 10);
            cellValue = !isNaN(ssIdx) && ss[ssIdx] !== undefined ? ss[ssIdx] : rawVal;
          } else if (cellType === 'b') {
            cellValue = rawVal === '1' ? 'TRUE' : 'FALSE';
          } else {
            cellValue = rawVal;
          }
        }

        while (rowCells.length < colIdx) {
          rowCells.push('');
        }
        rowCells[colIdx] = String(cellValue);
        nextCol = colIdx + 1;
      }

      if (rowCells.some(function (c) { return c.trim() !== ''; })) {
        if (rowCells.length > maxCols) maxCols = rowCells.length;
        rows.push(rowCells);
      }
    }

    return rows.map(function (r) {
      var copy = r.slice();
      while (copy.length < maxCols) copy.push('');
      return copy;
    });
  }

  /**
   * Parse CSV or TSV text into a 2D array of rows
   */
  function parseCsvText(csvText, delimiter) {
    if (!csvText) return [];
    var sep = delimiter || (csvText.indexOf('\t') !== -1 && csvText.indexOf(',') === -1 ? '\t' : ',');
    var lines = String(csvText).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var rows = [];
    var maxCols = 0;

    lines.forEach(function (line) {
      if (!line.trim()) return;
      var cells = [];
      var cur = '';
      var inQuotes = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (inQuotes) {
          if (ch === '"') {
            if (i + 1 < line.length && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            cur += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === sep) {
            cells.push(cur.trim());
            cur = '';
          } else {
            cur += ch;
          }
        }
      }
      cells.push(cur.trim());
      if (cells.length > maxCols) maxCols = cells.length;
      rows.push(cells);
    });

    return rows.map(function (r) {
      var copy = r.slice();
      while (copy.length < maxCols) copy.push('');
      return copy;
    });
  }

  function sanitizeForPdfFont(str) {
    if (!str) return '';
    return String(str)
      .replace(/৳/g, 'BDT ')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
  }

  function fitCellText(text, font, fontSize, maxWidth) {
    var clean = sanitizeForPdfFont(text).trim();
    if (!clean) return '';
    if (font.widthOfTextAtSize(clean, fontSize) <= maxWidth) return clean;

    var trimmed = clean;
    while (trimmed.length > 1 && font.widthOfTextAtSize(trimmed + '...', fontSize) > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return trimmed + '...';
  }

  function computeColumnWidths(rows, totalWidth) {
    if (!rows || !rows.length) return [];
    var colCount = rows[0].length || 1;
    var weights = new Array(colCount).fill(6);

    var sampleLimit = Math.min(rows.length, 40);
    for (var r = 0; r < sampleLimit; r++) {
      for (var c = 0; c < colCount; c++) {
        var len = String(rows[r][c] || '').length;
        var clamped = Math.min(Math.max(len + 2, 6), 36);
        if (clamped > weights[c]) weights[c] = clamped;
      }
    }

    var sumWeights = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
    return weights.map(function (w) {
      return (w / sumWeights) * totalWidth;
    });
  }

  /**
   * Automatically build a multi-page vector PDF from all worksheets in the Excel file
   */
  async function generatePdfFromWorkbook(sheets) {
    if (!window.PDFLib) {
      throw new Error('PDF library is not loaded yet.');
    }
    var pdfDoc = await window.PDFLib.PDFDocument.create();
    var fontRegular = await pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);
    var fontBold = await pdfDoc.embedFont(window.PDFLib.StandardFonts.HelveticaBold);
    var rgb = window.PDFLib.rgb;
    var theme = THEMES.emerald;

    var nonEmptySheets = (sheets || []).filter(function (s) {
      return s.rows && s.rows.length > 0;
    });
    if (!nonEmptySheets.length) {
      nonEmptySheets = [{ name: 'Sheet1', rows: [['Empty Spreadsheet']] }];
    }

    for (var sIdx = 0; sIdx < nonEmptySheets.length; sIdx++) {
      var sheet = nonEmptySheets[sIdx];
      var rows = sheet.rows;
      var colCount = rows[0].length || 1;

      // Auto-select orientation matching sheet layout: Landscape if 5+ columns or specified in sheet XML
      var isLandscape = sheet.orientation === 'landscape' || (sheet.orientation !== 'portrait' && colCount >= 5);
      var pageWidth = isLandscape ? 841.89 : 595.28;
      var pageHeight = isLandscape ? 595.28 : 841.89;
      var margin = 36;
      var usableWidth = pageWidth - margin * 2;
      var fontSize = colCount > 8 ? 8.5 : 9.5;
      var rowHeight = Math.round(fontSize * 2.2);

      var colWidths = computeColumnWidths(rows, usableWidth);
      var headerRow = rows[0];
      var dataRows = rows.slice(1);

      var currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      var cursorY = pageHeight - margin;

      var sheetTitle = sanitizeForPdfFont(sheet.name || '');
      if (sheetTitle && nonEmptySheets.length > 1) {
        currentPage.drawText(sheetTitle, {
          x: margin,
          y: cursorY - 13,
          size: 12,
          font: fontBold,
          color: rgb(theme.headerBg[0], theme.headerBg[1], theme.headerBg[2])
        });
        cursorY -= 22;
      }

      function drawRow(page, rowCells, yTop, isHeader, rowIndex) {
        var yBottom = yTop - rowHeight;

        if (isHeader) {
          page.drawRectangle({
            x: margin,
            y: yBottom,
            width: usableWidth,
            height: rowHeight,
            color: rgb(theme.headerBg[0], theme.headerBg[1], theme.headerBg[2])
          });
        } else if (rowIndex % 2 === 1) {
          page.drawRectangle({
            x: margin,
            y: yBottom,
            width: usableWidth,
            height: rowHeight,
            color: rgb(theme.stripeBg[0], theme.stripeBg[1], theme.stripeBg[2])
          });
        }

        var xCursor = margin;
        for (var c = 0; c < colWidths.length; c++) {
          var cw = colWidths[c];
          page.drawRectangle({
            x: xCursor,
            y: yBottom,
            width: cw,
            height: rowHeight,
            borderColor: rgb(theme.borderColor[0], theme.borderColor[1], theme.borderColor[2]),
            borderWidth: 0.5
          });

          var rawCell = rowCells[c] !== undefined ? String(rowCells[c]) : '';
          var activeFont = isHeader ? fontBold : fontRegular;
          var fitted = fitCellText(rawCell, activeFont, fontSize, cw - 10);

          if (fitted) {
            var isNumeric = !isHeader && /^[\d,.\-+%$BDT\s]+$/.test(fitted) && /\d/.test(fitted);
            var textWidth = activeFont.widthOfTextAtSize(fitted, fontSize);
            var textX = isNumeric ? Math.max(xCursor + 5, xCursor + cw - textWidth - 6) : xCursor + 5;
            var textY = yBottom + (rowHeight - fontSize) / 2 + 1.5;

            page.drawText(fitted, {
              x: textX,
              y: textY,
              size: fontSize,
              font: activeFont,
              color: isHeader
                ? rgb(theme.headerText[0], theme.headerText[1], theme.headerText[2])
                : rgb(0.12, 0.15, 0.20)
            });
          }
          xCursor += cw;
        }
        return yBottom;
      }

      if (headerRow) {
        cursorY = drawRow(currentPage, headerRow, cursorY, true, 0);
      }

      for (var r = 0; r < dataRows.length; r++) {
        if (cursorY - rowHeight < margin) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          cursorY = pageHeight - margin;
          if (headerRow) {
            cursorY = drawRow(currentPage, headerRow, cursorY, true, 0);
          }
        }
        cursorY = drawRow(currentPage, dataRows[r], cursorY, false, r);
      }
    }

    var pdfBytes = await pdfDoc.save();
    return {
      pdfBytes: pdfBytes,
      pageCount: pdfDoc.getPageCount()
    };
  }

  /**
   * Create a realistic sample .xlsx file in memory using JSZip
   */
  async function createSampleXlsxFile() {
    var zip = new window.JSZip();
    zip.file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '</Types>'
    );

    zip.file(
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheets><sheet name="Monthly Sales Summary" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets>' +
      '</workbook>'
    );

    var sampleRows = [
      ['Invoice ID', 'Branch City', 'Product Category', 'Units Sold', 'Unit Price (BDT)', 'Total Revenue (BDT)', 'Status'],
      ['INV-2026-101', 'Dhaka North', 'Wireless Router AX3000', '45', '4,200', '189,000', 'Paid'],
      ['INV-2026-102', 'Chattogram Agrabad', 'UPS Backup 1200VA', '30', '5,600', '168,000', 'Paid'],
      ['INV-2026-103', 'Sylhet Zindabazar', 'SSD NVMe 1TB Gen4', '60', '7,850', '471,000', 'Paid'],
      ['INV-2026-104', 'Rajshahi Sadar', 'Mechanical Keyboard RGB', '85', '3,100', '263,500', 'Dispatched'],
      ['INV-2026-105', 'Khulna Boyra', '27-inch IPS Monitor', '22', '19,500', '429,000', 'Paid'],
      ['INV-2026-106', 'Dhaka Dhanmondi', 'USB-C Docking Station', '50', '3,450', '172,500', 'Pending'],
      ['TOTAL', 'All Branches (6)', 'Monthly Summary', '292', '-', '1,693,000', 'Verified']
    ];

    var colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    var sheetBody = sampleRows.map(function (row, rIdx) {
      var rNum = rIdx + 1;
      var cellsXml = row.map(function (val, cIdx) {
        var ref = colLetters[cIdx] + rNum;
        return '<c r="' + ref + '" t="inlineStr"><is><t>' + val + '</t></is></c>';
      }).join('');
      return '<row r="' + rNum + '">' + cellsXml + '</row>';
    }).join('');

    zip.file(
      'xl/worksheets/sheet1.xml',
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetData>' + sheetBody + '</sheetData>' +
      '</worksheet>'
    );

    var blob = await zip.generateAsync({ type: 'blob' });
    return new File([blob], 'bd-branch-sales-report.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  // Expose helper API for automated testing
  window.ToolNestExcelToPdf = {
    parseSharedStringsXml: parseSharedStringsXml,
    parseWorksheetXml: parseWorksheetXml,
    parseCsvText: parseCsvText,
    colRefToIndex: colRefToIndex,
    THEMES: THEMES
  };

  function init() {
    var dropzone = document.getElementById('epDropzone');
    var fileInput = document.getElementById('epFileInput');
    var sampleBtn = document.getElementById('epSampleBtn');
    var progressBox = document.getElementById('epProgress');
    var errorAlert = document.getElementById('epErrorAlert');
    var errorMsg = document.getElementById('epErrorMsg');
    var workspace = document.getElementById('epWorkspace');

    var fileNameLabel = document.getElementById('epFileName');
    var fileMetaLabel = document.getElementById('epFileMeta');
    var statRows = document.getElementById('epStatRows');
    var statCols = document.getElementById('epStatCols');
    var statSheets = document.getElementById('epStatSheets');
    var tablePreview = document.getElementById('epTablePreview');

    var convertBtn = document.getElementById('epConvertBtn');
    var resetBtn = document.getElementById('epResetBtn');

    if (!dropzone || !fileInput) return;

    var convertedPdfBlob = null;
    var convertedPdfFilename = 'spreadsheet.pdf';

    function showError(msg) {
      if (!errorAlert || !errorMsg) return;
      errorMsg.textContent = msg;
      errorAlert.classList.remove('d-none');
    }

    function hideError() {
      if (errorAlert) errorAlert.classList.add('d-none');
    }

    function renderSheetPreview(sheets) {
      var activeSheet = (sheets && sheets[0]) || { name: 'Sheet1', rows: [] };
      var rows = activeSheet.rows || [];
      var rowCount = rows.length;
      var colCount = rowCount > 0 ? rows[0].length : 0;

      if (statRows) statRows.textContent = rowCount.toLocaleString('en-IN');
      if (statCols) statCols.textContent = colCount.toLocaleString('en-IN');
      if (statSheets) statSheets.textContent = (sheets ? sheets.length : 1).toString();

      if (!tablePreview) return;
      if (!rowCount) {
        tablePreview.innerHTML = '<tbody><tr><td class="text-center text-muted py-4">This worksheet is empty.</td></tr></tbody>';
        return;
      }

      var previewLimit = Math.min(rowCount, 50);
      var html = '<thead class="table-light"><tr>';
      rows[0].forEach(function (cell) {
        var safe = String(cell || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += '<th class="small fw-semibold text-nowrap">' + (safe || '&nbsp;') + '</th>';
      });
      html += '</tr></thead><tbody>';

      for (var r = 1; r < previewLimit; r++) {
        html += '<tr>';
        rows[r].forEach(function (cell) {
          var safe = String(cell || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          html += '<td class="small text-nowrap">' + (safe || '') + '</td>';
        });
        html += '</tr>';
      }
      html += '</tbody>';
      tablePreview.innerHTML = html;
    }

    async function handleFile(file) {
      hideError();
      if (!file) return;
      convertedPdfBlob = null;

      var ext = (file.name.split('.').pop() || '').toLowerCase();
      if (['xlsx', 'csv', 'tsv', 'txt'].indexOf(ext) === -1) {
        showError('Unsupported file format. Please select an Excel (.xlsx) or CSV (.csv) spreadsheet.');
        return;
      }

      if (progressBox) progressBox.classList.remove('d-none');
      if (workspace) workspace.classList.add('d-none');

      try {
        var baseName = file.name.replace(/\.[^.]+$/, '') || 'spreadsheet';
        var sheets = [];

        if (ext === 'xlsx') {
          if (!window.JSZip) {
            throw new Error('JSZip library is still loading. Please try again in a moment.');
          }
          var buf = await file.arrayBuffer();
          var zip = await window.JSZip.loadAsync(buf);

          var ssEntry = zip.file('xl/sharedStrings.xml');
          var sharedStrings = [];
          if (ssEntry) {
            var ssXml = await ssEntry.async('string');
            sharedStrings = parseSharedStringsXml(ssXml);
          }

          var sheetNames = [];
          var wbEntry = zip.file('xl/workbook.xml');
          if (wbEntry) {
            var wbXml = await wbEntry.async('string');
            var sRegex = /<sheet\b[^>]*name="([^"]+)"[^>]*>/g;
            var sMatch;
            while ((sMatch = sRegex.exec(wbXml)) !== null) {
              sheetNames.push(decodeXmlEntities(sMatch[1]));
            }
          }

          var sheetFiles = [];
          zip.forEach(function (relPath, entry) {
            if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(relPath)) {
              sheetFiles.push({ path: relPath, entry: entry });
            }
          });
          sheetFiles.sort(function (a, b) {
            var na = parseInt((a.path.match(/sheet(\d+)\.xml/i) || [0, 0])[1], 10);
            var nb = parseInt((b.path.match(/sheet(\d+)\.xml/i) || [0, 0])[1], 10);
            return na - nb;
          });

          if (!sheetFiles.length) {
            throw new Error('Could not find any worksheets inside this .xlsx file.');
          }

          for (var i = 0; i < sheetFiles.length; i++) {
            var sXml = await sheetFiles[i].entry.async('string');
            var parsedRows = parseWorksheetXml(sXml, sharedStrings);
            var orientMatch = sXml.match(/<pageSetup\b[^>]*orientation="([^"]+)"/i);
            sheets.push({
              name: sheetNames[i] || ('Sheet ' + (i + 1)),
              rows: parsedRows,
              orientation: orientMatch ? orientMatch[1].toLowerCase() : null
            });
          }
        } else {
          var text = await file.text();
          var rows = parseCsvText(text, ext === 'tsv' ? '\t' : null);
          sheets.push({
            name: baseName,
            rows: rows,
            orientation: null
          });
        }

        // Automatically convert workbook to PDF
        var result = await generatePdfFromWorkbook(sheets);
        convertedPdfFilename = baseName + '.pdf';
        convertedPdfBlob = new Blob([result.pdfBytes], { type: 'application/pdf' });

        if (fileNameLabel) fileNameLabel.textContent = convertedPdfFilename;
        if (fileMetaLabel) {
          var sizeStr = window.ToolNest && window.ToolNest.formatBytes
            ? window.ToolNest.formatBytes(convertedPdfBlob.size)
            : Math.round(convertedPdfBlob.size / 1024) + ' KB';
          fileMetaLabel.textContent =
            'Converted from ' + file.name + ' • ' + result.pageCount + (result.pageCount === 1 ? ' Page' : ' Pages') + ' • ' + sizeStr;
        }

        renderSheetPreview(sheets);
        if (progressBox) progressBox.classList.add('d-none');
        if (workspace) workspace.classList.remove('d-none');

        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Excel spreadsheet converted to PDF! Click Download PDF to save.', 'success');
        }
      } catch (err) {
        if (progressBox) progressBox.classList.add('d-none');
        showError('Unable to convert spreadsheet: ' + (err && err.message ? err.message : 'Corrupted or password-protected file.'));
      }
    }

    dropzone.addEventListener('click', function (e) {
      if (e.target && e.target.closest('button')) return;
      fileInput.click();
    });

    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) {
        handleFile(fileInput.files[0]);
      }
    });

    if (sampleBtn) {
      sampleBtn.addEventListener('click', async function (e) {
        e.stopPropagation();
        try {
          var sampleFile = await createSampleXlsxFile();
          await handleFile(sampleFile);
        } catch (err) {
          showError('Could not load sample Excel file.');
        }
      });
    }

    if (convertBtn) {
      convertBtn.addEventListener('click', function () {
        if (!convertedPdfBlob) return;
        if (window.ToolNest && window.ToolNest.downloadBlob) {
          window.ToolNest.downloadBlob(convertedPdfBlob, convertedPdfFilename);
          window.ToolNest.showToast('Downloading ' + convertedPdfFilename, 'success');
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        convertedPdfBlob = null;
        fileInput.value = '';
        hideError();
        if (workspace) workspace.classList.add('d-none');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
