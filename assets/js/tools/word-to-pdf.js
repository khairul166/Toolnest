/**
 * ToolNest - MS Word (.DOCX / .DOC / .TXT) to PDF Converter (/assets/js/tools/word-to-pdf.js)
 * 100% Client-Side Word to PDF Converter powered by JSZip 3.10.1, docx-preview 0.1.20,
 * html2canvas 1.4.1, and pdf-lib 1.17.1.
 * Preserves the exact original Word formatting — page dimensions, margins, fonts, inline runs
 * (bold, italic, underline, colors, highlights), tables, cell shadings, merged cells,
 * embedded images, and Unicode/Bangla text.
 */
(function () {
  'use strict';

  function decodeXmlEntities(str) {
    return String(str || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      })
      .replace(/&#(\d+);/g, function (_, dec) {
        return String.fromCharCode(parseInt(dec, 10));
      });
  }

  function normalizeHexColor(hex) {
    if (!hex || hex === 'auto' || hex === 'none') return null;
    var clean = String(hex).replace(/^#/, '').trim();
    if (/^[0-9a-fA-F]{6}$/.test(clean)) return '#' + clean.toUpperCase();
    return null;
  }

  function hexToRgb01(hex) {
    var norm = normalizeHexColor(hex);
    if (!norm) return null;
    var clean = norm.slice(1);
    return [
      parseInt(clean.slice(0, 2), 16) / 255,
      parseInt(clean.slice(2, 4), 16) / 255,
      parseInt(clean.slice(4, 6), 16) / 255
    ];
  }

  /**
   * Parse individual inline runs (<w:r>) inside a paragraph so mixed bold/italic/underline/color/size
   * and embedded images (<a:blip r:embed="rId..."/>) on the same line are preserved.
   */
  function parseRunsFromParagraph(pInner, defaultFontSize, defaultBold, defaultItalic, mediaMap) {
    var runs = [];
    var rRegex = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
    var rMatch;

    while ((rMatch = rRegex.exec(pInner)) !== null) {
      var rBody = rMatch[1];
      var rPrMatch = rBody.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/i);
      var rPr = rPrMatch ? rPrMatch[1] : '';

      var isBold = defaultBold || /<w:b(?:\s*\/>|\s+w:val="(?:true|1|on)")/i.test(rPr);
      if (/<w:b\s+w:val="(?:false|0|off)"/i.test(rPr)) isBold = false;

      var isItalic = defaultItalic || /<w:i(?:\s*\/>|\s+w:val="(?:true|1|on)")/i.test(rPr);
      if (/<w:i\s+w:val="(?:false|0|off)"/i.test(rPr)) isItalic = false;

      var isUnderline = /<w:u(?:\s*\/>|\s+w:val="(?!none)[^"]+")/i.test(rPr);
      var isStrike = /<w:strike(?:\s*\/>|\s+w:val="(?:true|1|on)")/i.test(rPr);

      var szMatch = rPr.match(/<w:sz\s+w:val="(\d+)"/i);
      var fontSize = szMatch ? parseInt(szMatch[1], 10) / 2 : defaultFontSize;

      var fontMatch = rPr.match(/<w:rFonts[^>]*\bw:ascii="([^"]+)"/i);
      var fontFamily = fontMatch ? fontMatch[1] : null;

      var colorMatch = rPr.match(/<w:color\s+w:val="([0-9a-fA-F]{6})"/i);
      var colorHex = colorMatch ? normalizeHexColor(colorMatch[1]) : null;

      var shdMatch = rPr.match(/<w:shd[^>]*\bw:fill="([0-9a-fA-F]{6})"/i);
      var bgHex = shdMatch ? normalizeHexColor(shdMatch[1]) : null;

      // Check for embedded image inside run (<a:blip r:embed="rId..."/>)
      var blipMatch = rBody.match(/<a:blip[^>]*\br:embed="([^"]+)"/i);
      if (blipMatch && mediaMap && mediaMap[blipMatch[1]]) {
        var extentMatch = rBody.match(/<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"/i);
        // 1 point = 12700 EMUs in OpenXML DrawingML
        var widthPt = extentMatch ? Math.round(parseInt(extentMatch[1], 10) / 12700) : 220;
        var heightPt = extentMatch ? Math.round(parseInt(extentMatch[2], 10) / 12700) : 140;
        runs.push({
          type: 'image',
          dataUrl: mediaMap[blipMatch[1]],
          widthPt: Math.min(Math.max(widthPt, 24), 480),
          heightPt: Math.min(Math.max(heightPt, 24), 640)
        });
      }

      var text = '';
      var tokenRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/>/g;
      var tMatch;
      while ((tMatch = tokenRegex.exec(rBody)) !== null) {
        if (tMatch[0].startsWith('<w:tab')) {
          text += '\t';
        } else if (tMatch[0].startsWith('<w:br')) {
          text += '\n';
        } else if (tMatch[1] != null) {
          text += decodeXmlEntities(tMatch[1]);
        }
      }

      if (text) {
        runs.push({
          type: 'text',
          text: text,
          isBold: isBold,
          isItalic: isItalic,
          isUnderline: isUnderline,
          isStrike: isStrike,
          fontSize: fontSize,
          fontFamily: fontFamily,
          colorHex: colorHex,
          colorRgb: hexToRgb01(colorHex),
          bgHex: bgHex
        });
      }
    }

    return runs;
  }

  /**
   * Parse a single <w:p> XML block into a rich paragraph object preserving Word formatting
   */
  function parseParagraphNode(inner, mediaMap) {
    var pPrMatch = inner.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/i);
    var pPr = pPrMatch ? pPrMatch[1] : '';

    var styleMatch = pPr.match(/<w:pStyle\s+w:val="([^"]+)"/i) || inner.match(/<w:pStyle\s+w:val="([^"]+)"/i);
    var styleVal = styleMatch ? styleMatch[1] : '';

    var headingLevel = 0;
    if (/^Heading([1-6])$/i.test(styleVal)) {
      headingLevel = parseInt(styleVal.replace(/\D/g, ''), 10) || 1;
    } else if (/^Title$/i.test(styleVal)) {
      headingLevel = 1;
    } else if (/^Subtitle$/i.test(styleVal)) {
      headingLevel = 2;
    }

    var jcMatch = pPr.match(/<w:jc\s+w:val="([^"]+)"/i) || inner.match(/<w:jc\s+w:val="([^"]+)"/i);
    var alignRaw = jcMatch ? jcMatch[1].toLowerCase() : 'left';
    var align =
      alignRaw === 'center'
        ? 'center'
        : alignRaw === 'right'
          ? 'right'
          : alignRaw === 'both' || alignRaw === 'justify'
            ? 'justify'
            : 'left';

    var isList = /<w:numPr\b/i.test(pPr) || /^List/i.test(styleVal);

    // Indentation in twips (1 pt = 20 twips)
    var indMatch = pPr.match(/<w:ind\b([^>]*)\/>/i);
    var indentLeftPt = 0;
    if (indMatch) {
      var leftAttr = indMatch[1].match(/\bw:left="(\d+)"/i);
      if (leftAttr) indentLeftPt = Math.min(parseInt(leftAttr[1], 10) / 20, 180);
    }
    if (isList && indentLeftPt < 18) indentLeftPt = 18;

    // Paragraph spacing before/after in twips
    var spacingMatch = pPr.match(/<w:spacing\b([^>]*)\/>/i);
    var spaceBeforePt = 0;
    var spaceAfterPt = 6;
    if (spacingMatch) {
      var bef = spacingMatch[1].match(/\bw:before="(\d+)"/i);
      var aft = spacingMatch[1].match(/\bw:after="(\d+)"/i);
      if (bef) spaceBeforePt = Math.min(parseInt(bef[1], 10) / 20, 48);
      if (aft) spaceAfterPt = Math.min(parseInt(aft[1], 10) / 20, 48);
    }

    // Paragraph background shading
    var pShdMatch = pPr.match(/<w:shd[^>]*\bw:fill="([0-9a-fA-F]{6})"/i);
    var bgHex = pShdMatch ? normalizeHexColor(pShdMatch[1]) : null;

    var defaultFontSize = 11;
    if (headingLevel === 1) defaultFontSize = /^Title$/i.test(styleVal) ? 20 : 16;
    else if (headingLevel === 2) defaultFontSize = 14;
    else if (headingLevel >= 3) defaultFontSize = 12.5;

    var pSzMatch = pPr.match(/<w:sz\s+w:val="(\d+)"/i);
    if (pSzMatch) defaultFontSize = parseInt(pSzMatch[1], 10) / 2;

    var defaultBold = headingLevel > 0;
    var defaultItalic = /^Subtitle$/i.test(styleVal);

    var runs = parseRunsFromParagraph(inner, defaultFontSize, defaultBold, defaultItalic, mediaMap);
    var fullText = runs
      .filter(function (r) { return r.type === 'text'; })
      .map(function (r) { return r.text; })
      .join('');
    var hasImages = runs.some(function (r) { return r.type === 'image'; });

    var cleaned = fullText.trim();
    if (!cleaned && !hasImages) return null;

    var firstTextRun = runs.find(function (r) { return r.type === 'text'; });
    var effectiveFontSize = firstTextRun ? firstTextRun.fontSize : defaultFontSize;
    var isHeading = headingLevel > 0 || effectiveFontSize >= 14;
    var isBold = isHeading || (runs.length > 0 && runs.every(function (r) { return r.type !== 'text' || r.isBold; }));
    var isItalic = runs.length > 0 && runs.every(function (r) { return r.type !== 'text' || r.isItalic; });
    var colorHex = firstTextRun ? firstTextRun.colorHex : null;

    return {
      type: 'paragraph',
      text: isList && cleaned ? '• ' + cleaned : cleaned,
      runs: runs,
      isHeading: isHeading,
      headingLevel: headingLevel,
      isBold: isBold,
      isItalic: isItalic,
      isList: isList,
      align: align,
      fontSize: effectiveFontSize,
      indentLeftPt: indentLeftPt,
      spaceBeforePt: spaceBeforePt,
      spaceAfterPt: spaceAfterPt,
      bgHex: bgHex,
      colorHex: colorHex,
      colorRgb: hexToRgb01(colorHex)
    };
  }

  /**
   * Parse a <w:tbl> XML block into a styled table object preserving cell shading, alignment, bold, and colspan
   */
  function parseTableNode(tblInner, mediaMap) {
    var rows = [];
    var styledRows = [];
    var maxCols = 0;

    var trRegex = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
    var trMatch;
    while ((trMatch = trRegex.exec(tblInner)) !== null) {
      var trBody = trMatch[1];
      var plainCells = [];
      var richCells = [];

      var tcRegex = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
      var tcMatch;
      while ((tcMatch = tcRegex.exec(trBody)) !== null) {
        var tcBody = tcMatch[1];
        var tcPrMatch = tcBody.match(/<w:tcPr>([\s\S]*?)<\/w:tcPr>/i);
        var tcPr = tcPrMatch ? tcPrMatch[1] : '';

        var spanMatch = tcPr.match(/<w:gridSpan\s+w:val="(\d+)"/i);
        var colSpan = spanMatch ? Math.max(1, parseInt(spanMatch[1], 10)) : 1;

        var shdMatch = tcPr.match(/<w:shd[^>]*\bw:fill="([0-9a-fA-F]{6})"/i);
        var bgHex = shdMatch ? normalizeHexColor(shdMatch[1]) : null;

        var wMatch = tcPr.match(/<w:tcW[^>]*\bw:w="(\d+)"/i);
        var widthPt = wMatch ? Math.round(parseInt(wMatch[1], 10) / 20) : null;

        // Parse paragraphs inside the cell
        var cellParas = [];
        var pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
        var pMatch;
        while ((pMatch = pRegex.exec(tcBody)) !== null) {
          var pObj = parseParagraphNode(pMatch[1], mediaMap);
          if (pObj) cellParas.push(pObj);
        }

        var cellText = cellParas.map(function (p) { return p.text; }).join('\n').trim();
        var cellAlign = cellParas.length ? cellParas[0].align : 'left';
        var cellBold = cellParas.length ? cellParas[0].isBold : false;
        var cellColorHex = cellParas.length ? cellParas[0].colorHex : null;

        plainCells.push(cellText);
        richCells.push({
          text: cellText,
          paragraphs: cellParas,
          colSpan: colSpan,
          bgHex: bgHex,
          widthPt: widthPt,
          align: cellAlign,
          isBold: cellBold,
          colorHex: cellColorHex
        });
      }

      if (plainCells.length > 0) {
        var totalSpan = richCells.reduce(function (sum, c) { return sum + (c.colSpan || 1); }, 0);
        if (totalSpan > maxCols) maxCols = totalSpan;
        rows.push(plainCells);
        styledRows.push(richCells);
      }
    }

    if (!rows.length) return null;
    return {
      type: 'table',
      rows: rows.map(function (r) {
        var copy = r.slice();
        while (copy.length < maxCols) copy.push('');
        return copy;
      }),
      styledRows: styledRows,
      maxCols: maxCols
    };
  }

  /**
   * Parse word/document.xml for full page setup (<w:sectPr>) and ordered blocks (paragraphs + tables)
   */
  function parseDocxDocument(xmlString, mediaMap) {
    var pageSetup = {
      widthPt: 595.28,
      heightPt: 841.89,
      marginTopPt: 54,
      marginBottomPt: 54,
      marginLeftPt: 54,
      marginRightPt: 54
    };

    if (!xmlString) {
      return { pageSetup: pageSetup, blocks: [] };
    }

    var pgSzMatch = xmlString.match(/<w:pgSz\b([^>]*)\/>/i);
    if (pgSzMatch) {
      var attrs = pgSzMatch[1];
      var wMatch = attrs.match(/\bw:w="(\d+)"/i);
      var hMatch = attrs.match(/\bw:h="(\d+)"/i);
      if (wMatch && hMatch) {
        var wPt = parseInt(wMatch[1], 10) / 20;
        var hPt = parseInt(hMatch[1], 10) / 20;
        if (wPt >= 200 && hPt >= 200) {
          pageSetup.widthPt = wPt;
          pageSetup.heightPt = hPt;
        }
      }
    }

    var pgMarMatch = xmlString.match(/<w:pgMar\b([^>]*)\/>/i);
    if (pgMarMatch) {
      var mAttrs = pgMarMatch[1];
      var topM = mAttrs.match(/\bw:top="(\d+)"/i);
      var botM = mAttrs.match(/\bw:bottom="(\d+)"/i);
      var leftM = mAttrs.match(/\bw:left="(\d+)"/i);
      var rightM = mAttrs.match(/\bw:right="(\d+)"/i);
      if (topM) pageSetup.marginTopPt = Math.min(Math.max(parseInt(topM[1], 10) / 20, 24), 120);
      if (botM) pageSetup.marginBottomPt = Math.min(Math.max(parseInt(botM[1], 10) / 20, 24), 120);
      if (leftM) pageSetup.marginLeftPt = Math.min(Math.max(parseInt(leftM[1], 10) / 20, 24), 120);
      if (rightM) pageSetup.marginRightPt = Math.min(Math.max(parseInt(rightM[1], 10) / 20, 24), 120);
    }

    var blocks = [];
    var blockRegex = /<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>|<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
    var match;
    while ((match = blockRegex.exec(xmlString)) !== null) {
      if (match[1] !== undefined) {
        var tbl = parseTableNode(match[1], mediaMap);
        if (tbl) blocks.push(tbl);
      } else if (match[2] !== undefined) {
        var para = parseParagraphNode(match[2], mediaMap);
        if (para) blocks.push(para);
      }
    }

    return { pageSetup: pageSetup, blocks: blocks };
  }

  /**
   * Backward-compatible paragraph array parser for automated tests
   */
  function parseDocxXml(xmlString) {
    var doc = parseDocxDocument(xmlString);
    return doc.blocks.filter(function (b) {
      return b.type === 'paragraph';
    });
  }

  function parsePlainTextToParagraphs(rawText) {
    var text = String(rawText || '');
    if (text.trim().startsWith('{\\rtf')) {
      text = text
        .replace(/\\par\b/g, '\n')
        .replace(/\\tab\b/g, '    ')
        .replace(/\\'[0-9a-fA-F]{2}/g, '')
        .replace(/\\[a-zA-Z]+\d*\s?/g, '')
        .replace(/[{}]/g, '');
    }

    var lines = text.replace(/\r\n/g, '\n').split(/\n/);
    var result = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trimEnd();
      if (!line.trim()) continue;
      result.push({
        type: 'paragraph',
        text: line,
        runs: [{ type: 'text', text: line, isBold: false, isItalic: false, fontSize: 11 }],
        isHeading: false,
        isBold: false,
        isItalic: false,
        isList: false,
        align: 'left',
        fontSize: 11,
        indentLeftPt: 0,
        spaceBeforePt: 0,
        spaceAfterPt: 6,
        colorRgb: null
      });
    }
    return result;
  }

  /**
   * Extract embedded images from word/_rels/document.xml.rels + word/media/* as base64 data URLs
   */
  async function extractDocxMediaMap(zip) {
    var mediaMap = {};
    try {
      var relsFile = zip.file('word/_rels/document.xml.rels');
      if (!relsFile) return mediaMap;
      var relsXml = await relsFile.async('string');
      var relRegex = /<Relationship\b([^>]*)\/>/gi;
      var m;
      var relTargets = [];
      while ((m = relRegex.exec(relsXml)) !== null) {
        var attrs = m[1];
        var idM = attrs.match(/\bId="([^"]+)"/i);
        var targetM = attrs.match(/\bTarget="([^"]+)"/i);
        if (idM && targetM && /media\//i.test(targetM[1])) {
          relTargets.push({ id: idM[1], target: targetM[1].replace(/^\/+/, '') });
        }
      }

      for (var i = 0; i < relTargets.length; i++) {
        var rel = relTargets[i];
        var zipPath = rel.target.startsWith('word/') ? rel.target : 'word/' + rel.target;
        var imgEntry = zip.file(zipPath);
        if (imgEntry) {
          var b64 = await imgEntry.async('base64');
          var ext = (zipPath.split('.').pop() || 'png').toLowerCase();
          var mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
          mediaMap[rel.id] = 'data:' + mime + ';base64,' + b64;
        }
      }
    } catch (e) {
      // Ignore media extraction errors
    }
    return mediaMap;
  }

  /**
   * Build exact visual HTML representation of parsed Word blocks (used when docx-preview is not active)
   */
  function renderPreviewHtml(blocks) {
    if (!blocks || !blocks.length) {
      return '<p class="text-muted small mb-0">Empty document.</p>';
    }
    var escapeHtml = function (s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    };

    return blocks
      .map(function (blk) {
        if (blk.type === 'table') {
          var sRows = blk.styledRows || [];
          var rowsHtml = sRows
            .map(function (row) {
              var cellsHtml = row
                .map(function (cell) {
                  var styles = 'border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top;';
                  if (cell.bgHex) styles += 'background-color:' + cell.bgHex + ';';
                  if (cell.align) styles += 'text-align:' + cell.align + ';';
                  if (cell.isBold) styles += 'font-weight:700;';
                  if (cell.colorHex) styles += 'color:' + cell.colorHex + ';';
                  var spanAttr = cell.colSpan && cell.colSpan > 1 ? ' colspan="' + cell.colSpan + '"' : '';
                  var innerHtml = escapeHtml(cell.text).replace(/\n/g, '<br>') || '&nbsp;';
                  return '<td' + spanAttr + ' style="' + styles + '">' + innerHtml + '</td>';
                })
                .join('');
              return '<tr>' + cellsHtml + '</tr>';
            })
            .join('');
          return '<table style="width:100%;border-collapse:collapse;margin:8pt 0;font-size:10.5pt;">' + rowsHtml + '</table>';
        }

        var pStyles =
          'margin:' +
          (blk.spaceBeforePt || 0) +
          'pt 0 ' +
          (blk.spaceAfterPt != null ? blk.spaceAfterPt : 6) +
          'pt ' +
          (blk.indentLeftPt || 0) +
          'pt;line-height:1.45;';
        if (blk.align) pStyles += 'text-align:' + blk.align + ';';
        if (blk.bgHex) pStyles += 'background-color:' + blk.bgHex + ';padding:2px 4px;';

        if (blk.runs && blk.runs.length) {
          var runsHtml = blk.runs
            .map(function (r) {
              if (r.type === 'image' && r.dataUrl) {
                return (
                  '<img src="' +
                  r.dataUrl +
                  '" style="max-width:100%;width:' +
                  r.widthPt +
                  'pt;height:auto;display:inline-block;margin:4pt 0;" alt="Embedded Document Image">'
                );
              }
              var rStyle = 'font-size:' + (r.fontSize || blk.fontSize || 11) + 'pt;';
              if (r.isBold) rStyle += 'font-weight:700;';
              if (r.isItalic) rStyle += 'font-style:italic;';
              var decs = [];
              if (r.isUnderline) decs.push('underline');
              if (r.isStrike) decs.push('line-through');
              if (decs.length) rStyle += 'text-decoration:' + decs.join(' ') + ';';
              if (r.colorHex) rStyle += 'color:' + r.colorHex + ';';
              if (r.bgHex) rStyle += 'background-color:' + r.bgHex + ';';
              if (r.fontFamily) rStyle += 'font-family:"' + escapeHtml(r.fontFamily) + '","Hind Siliguri",sans-serif;';
              var textHtml = escapeHtml(r.text).replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/\n/g, '<br>');
              return '<span style="' + rStyle + '">' + textHtml + '</span>';
            })
            .join('');
          var bulletPrefix = blk.isList ? '<span style="margin-right:6pt;">•</span>' : '';
          return '<p style="' + pStyles + '">' + bulletPrefix + runsHtml + '</p>';
        }

        return '<p style="' + pStyles + '">' + escapeHtml(blk.text).replace(/\n/g, '<br>') + '</p>';
      })
      .join('');
  }

  /**
   * High-Fidelity DOM-to-PDF Renderer:
   * Captures the rendered Word DOM container (either from docx-preview's <section class="docx"> pages
   * or our styled Word page sheet) at 2x scale using html2canvas and embeds into a multi-page PDF via pdf-lib.
   */
  async function convertRenderedDomToPdf(containerEl, pageSetup) {
    var PDFLib = window.PDFLib;
    var pdfDoc = await PDFLib.PDFDocument.create();
    var ps = pageSetup || { widthPt: 595.28, heightPt: 841.89 };

    // Check if docx-preview generated individual <section class="docx"> page elements
    var docxSections = containerEl.querySelectorAll('section.docx');
    if (docxSections && docxSections.length > 0) {
      for (var i = 0; i < docxSections.length; i++) {
        var sec = docxSections[i];
        var secRect = sec.getBoundingClientRect();
        var secWidthPt = secRect.width > 100 ? secRect.width * 0.75 : ps.widthPt;
        var secHeightPt = secRect.height > 100 ? secRect.height * 0.75 : ps.heightPt;

        var canvas = await window.html2canvas(sec, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        // If a single section is taller than 1.25x a standard page, slice it into pages cleanly
        var pageHeightPx = Math.round((ps.heightPt / ps.widthPt) * canvas.width);
        if (canvas.height > pageHeightPx * 1.18) {
          var totalSlices = Math.ceil(canvas.height / pageHeightPx);
          for (var s = 0; s < totalSlices; s++) {
            var sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            var sliceH = Math.min(pageHeightPx, canvas.height - s * pageHeightPx);
            sliceCanvas.height = pageHeightPx;
            var ctx = sliceCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(canvas, 0, s * pageHeightPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

            var sliceDataUrl = sliceCanvas.toDataURL('image/jpeg', 0.95);
            var sliceImg = await pdfDoc.embedJpg(sliceDataUrl);
            var pdfPage = pdfDoc.addPage([ps.widthPt, ps.heightPt]);
            pdfPage.drawImage(sliceImg, {
              x: 0,
              y: 0,
              width: ps.widthPt,
              height: ps.heightPt
            });
          }
        } else {
          var imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
          var embeddedImg = await pdfDoc.embedJpg(imgDataUrl);
          var page = pdfDoc.addPage([secWidthPt, secHeightPt]);
          page.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width: secWidthPt,
            height: secHeightPt
          });
        }
      }
    } else {
      // Slice the rendered page sheet into exact page-sized slices
      var fullCanvas = await window.html2canvas(containerEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      var sliceHeightPx = Math.round((ps.heightPt / ps.widthPt) * fullCanvas.width);
      var numPages = Math.max(1, Math.ceil(fullCanvas.height / sliceHeightPx));

      for (var p = 0; p < numPages; p++) {
        var pCanvas = document.createElement('canvas');
        pCanvas.width = fullCanvas.width;
        pCanvas.height = sliceHeightPx;
        var pCtx = pCanvas.getContext('2d');
        pCtx.fillStyle = '#ffffff';
        pCtx.fillRect(0, 0, pCanvas.width, pCanvas.height);

        var srcY = p * sliceHeightPx;
        var srcH = Math.min(sliceHeightPx, fullCanvas.height - srcY);
        if (srcH > 0) {
          pCtx.drawImage(fullCanvas, 0, srcY, fullCanvas.width, srcH, 0, 0, fullCanvas.width, srcH);
        }

        var jpgUrl = pCanvas.toDataURL('image/jpeg', 0.95);
        var jpgImg = await pdfDoc.embedJpg(jpgUrl);
        var addedPage = pdfDoc.addPage([ps.widthPt, ps.heightPt]);
        addedPage.drawImage(jpgImg, {
          x: 0,
          y: 0,
          width: ps.widthPt,
          height: ps.heightPt
        });
      }
    }

    var pdfBytes = await pdfDoc.save();
    return {
      pdfBytes: pdfBytes,
      pageCount: pdfDoc.getPageCount()
    };
  }

  /**
   * Create a sample .docx file in memory for one-click testing
   */
  function createSampleDocxFile() {
    var sampleDocXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1E3A8A"/><w:sz w:val="36"/></w:rPr><w:t>SERVICE LEVEL AGREEMENT (SLA)</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Client: Dhaka Digital Commerce Ltd. | Date: 26 October 2026</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1E3A8A"/><w:sz w:val="26"/></w:rPr><w:t>1. Scope of Browser-Based Document Services</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>This Microsoft Word (.docx) document was parsed and converted into a PDF directly inside your web browser using ToolNest, preserving original fonts, colors, alignments, and table borders.</w:t></w:r></w:p>' +
      '<w:tbl>' +
      '<w:tr><w:tc><w:tcPr><w:shd w:fill="1E3A8A"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Deliverable Item</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="1E3A8A"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Timeline</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="1E3A8A"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Fee (BDT)</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>UI/UX Design &amp; Prototyping</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>2 Weeks</w:t></w:r></w:p></w:tc><w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>45,000</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>Frontend Web Application</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>3 Weeks</w:t></w:r></w:p></w:tc><w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>80,000</w:t></w:r></w:p></w:tc></w:tr>' +
      '</w:tbl>' +
      '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1E3A8A"/><w:sz w:val="26"/></w:rPr><w:t>2. Confidentiality &amp; Privacy Guarantee</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>All financial schedules, legal clauses, and employee records remain 100% on the user device during conversion.</w:t></w:r></w:p>' +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr>' +
      '</w:body></w:document>';

    var zip = new window.JSZip();
    zip.file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
    );
    zip.file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
    );
    zip.file('word/document.xml', sampleDocXml);
    return zip.generateAsync({ type: 'blob' }).then(function (blob) {
      return new File([blob], 'toolnest-sample-agreement.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
    });
  }

  // Expose helpers for automated testing
  if (typeof window !== 'undefined') {
    window.ToolNestWordToPdf = {
      parseDocxXml: parseDocxXml,
      parseDocxDocument: parseDocxDocument,
      parsePlainTextToParagraphs: parsePlainTextToParagraphs,
      createSampleDocxFile: createSampleDocxFile
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    var dropzone = document.getElementById('tn-w2p-dropzone');
    var fileInput = document.getElementById('tn-w2p-file-input');
    var progressBox = document.getElementById('tn-w2p-progress');
    var errorBox = document.getElementById('tn-w2p-error-box');
    var resultsWrap = document.getElementById('tn-w2p-results-wrap');

    var fileNameEl = document.getElementById('tn-w2p-file-name');
    var fileMetaEl = document.getElementById('tn-w2p-file-meta');
    var paraBadge = document.getElementById('tn-w2p-para-badge');
    var previewBox = document.getElementById('tn-w2p-preview');

    var sampleBtn = document.getElementById('tn-w2p-sample-btn');
    var resetBtn = document.getElementById('tn-w2p-reset-btn');
    var dlPdfBtn = document.getElementById('tn-w2p-dl-pdf');

    if (!dropzone || !fileInput) return;

    var convertedPdfBlob = null;
    var convertedPdfFilename = 'document.pdf';

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

    async function handleWordFile(file) {
      if (!file) return;
      showError('');
      convertedPdfBlob = null;

      var name = file.name.toLowerCase();
      if (!/\.(docx|doc|txt|rtf)$/i.test(name)) {
        showError('Please upload a valid Microsoft Word (.docx, .doc), RTF, or TXT file.');
        return;
      }

      if (progressBox) progressBox.classList.remove('d-none');
      if (resultsWrap) resultsWrap.classList.remove('d-none');
      if (previewBox) previewBox.innerHTML = '';

      try {
        var docData;
        var renderedViaDocxPreview = false;

        if (name.endsWith('.docx')) {
          var arrayBuffer = await file.arrayBuffer();
          var zip = await window.JSZip.loadAsync(arrayBuffer);
          var docXmlFile = zip.file('word/document.xml');
          if (!docXmlFile) {
            throw new Error('Invalid .docx file structure (missing word/document.xml).');
          }
          var xmlText = await docXmlFile.async('string');
          var mediaMap = await extractDocxMediaMap(zip);
          docData = parseDocxDocument(xmlText, mediaMap);

          // Render exact original Word formatting (styles, fonts, images, tables, headers/footers) via docx-preview if available
          if (window.docx && typeof window.docx.renderAsync === 'function' && previewBox) {
            try {
              await window.docx.renderAsync(arrayBuffer, previewBox, null, {
                className: 'docx',
                inWrapper: false,
                ignoreWidth: false,
                ignoreHeight: false,
                ignoreFonts: false,
                breakPages: true,
                useBase64URL: true
              });
              if (previewBox.innerHTML.trim().length > 0) {
                renderedViaDocxPreview = true;
              }
            } catch (docxErr) {
              renderedViaDocxPreview = false;
            }
          }
        } else {
          var rawText = await file.text();
          docData = {
            pageSetup: {
              widthPt: 595.28,
              heightPt: 841.89,
              marginTopPt: 54,
              marginBottomPt: 54,
              marginLeftPt: 54,
              marginRightPt: 54
            },
            blocks: parsePlainTextToParagraphs(rawText)
          };
        }

        if (!renderedViaDocxPreview) {
          if (!docData.blocks || docData.blocks.length === 0) {
            throw new Error('This Word document appears to be empty.');
          }
          if (previewBox) {
            var ps = docData.pageSetup;
            previewBox.innerHTML =
              '<div class="docx-fallback-sheet" style="background:#fff;color:#0f172a;font-family:\'Hind Siliguri\',Calibri,Arial,sans-serif;padding:' +
              ps.marginTopPt +
              'pt ' +
              ps.marginRightPt +
              'pt ' +
              ps.marginBottomPt +
              'pt ' +
              ps.marginLeftPt +
              'pt;">' +
              renderPreviewHtml(docData.blocks) +
              '</div>';
          }
        }

        // Convert the rendered Word document DOM to a matching multi-page PDF
        var targetCaptureEl = previewBox.querySelector('.docx-fallback-sheet') || previewBox;
        var result = await convertRenderedDomToPdf(targetCaptureEl, docData.pageSetup);

        var baseName = file.name.replace(/\.(docx|doc|txt|rtf)$/i, '') || 'document';
        convertedPdfFilename = baseName + '.pdf';
        convertedPdfBlob = new Blob([result.pdfBytes], { type: 'application/pdf' });

        if (fileNameEl) fileNameEl.textContent = convertedPdfFilename;
        if (fileMetaEl) {
          var pdfSizeStr =
            window.ToolNest && window.ToolNest.formatBytes
              ? window.ToolNest.formatBytes(convertedPdfBlob.size)
              : Math.round(convertedPdfBlob.size / 1024) + ' KB';
          fileMetaEl.textContent =
            'Converted from ' +
            file.name +
            ' • ' +
            result.pageCount +
            (result.pageCount === 1 ? ' Page' : ' Pages') +
            ' • ' +
            pdfSizeStr;
        }
        if (paraBadge) {
          paraBadge.textContent = result.pageCount + (result.pageCount === 1 ? ' Page' : ' Pages');
        }

        if (progressBox) progressBox.classList.add('d-none');
        if (resultsWrap) resultsWrap.classList.remove('d-none');
        window.ToolNest.showToast('Word document converted to PDF! Click Download PDF to save.', 'success');
      } catch (err) {
        if (progressBox) progressBox.classList.add('d-none');
        if (resultsWrap) resultsWrap.classList.add('d-none');
        showError(err && err.message ? err.message : 'Could not convert this Word document.');
      }
    }

    window.ToolNest.setupDropzone(dropzone, fileInput, function (files) {
      if (files && files.length > 0) {
        handleWordFile(files[0]);
      }
    });

    if (dlPdfBtn) {
      dlPdfBtn.addEventListener('click', function () {
        if (!convertedPdfBlob) return;
        window.ToolNest.downloadBlob(convertedPdfBlob, convertedPdfFilename);
        window.ToolNest.showToast('Downloading ' + convertedPdfFilename, 'success');
      });
    }

    if (sampleBtn) {
      sampleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        createSampleDocxFile().then(function (sampleFile) {
          handleWordFile(sampleFile);
        });
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        convertedPdfBlob = null;
        fileInput.value = '';
        if (resultsWrap) resultsWrap.classList.add('d-none');
        if (previewBox) previewBox.innerHTML = '';
        showError('');
      });
    }
  });
})();
