/**
 * ToolNest - Protect PDF (/assets/js/tools/protect-pdf.js)
 * 100% Client-Side 128-bit Standard PDF Encryption (ISO 32000-1 /Filter /Standard /V 2 /R 3 /Length 128).
 * Encrypts all PDF streams and strings locally in the browser using MD5 + RC4-128 key derivation,
 * supports Document Open Password, Owner Permissions Password, and granular permission flags (/P).
 */
(function () {
  'use strict';

  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  // Standard 32-byte PDF encryption padding string (ISO 32000-1 Section 7.6.3.3)
  const PDF_PAD = new Uint8Array([
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41,
    0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
    0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
  ]);

  let currentFile = null;
  let currentPdfBytes = null;
  let currentPageCount = 0;
  let protectedPdfBlob = null;
  let protectedFilename = 'document-protected.pdf';

  function ensurePdfJsWorker() {
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      }
    }
  }

  /**
   * Pure JS RFC 1321 MD5 implementation returning a 16-byte Uint8Array
   */
  function md5Bytes(inputBytes) {
    function rotl(x, n) {
      return (x << n) | (x >>> (32 - n));
    }
    const K = new Uint32Array(64);
    for (let i = 0; i < 64; i++) {
      K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
    }
    const S = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];

    const origLen = inputBytes.length;
    const bitLenLo = (origLen * 8) >>> 0;
    const bitLenHi = Math.floor((origLen * 8) / 0x100000000) >>> 0;
    const padLen = ((56 - ((origLen + 1) % 64)) + 64) % 64;
    const totalLen = origLen + 1 + padLen + 8;
    const buf = new Uint8Array(totalLen);
    buf.set(inputBytes, 0);
    buf[origLen] = 0x80;

    const view = new DataView(buf.buffer);
    view.setUint32(totalLen - 8, bitLenLo, true);
    view.setUint32(totalLen - 4, bitLenHi, true);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    const M = new Uint32Array(16);
    for (let offset = 0; offset < totalLen; offset += 64) {
      for (let j = 0; j < 16; j++) {
        M[j] = view.getUint32(offset + j * 4, true);
      }
      let A = a0;
      let B = b0;
      let C = c0;
      let D = d0;
      for (let i = 0; i < 64; i++) {
        let F;
        let g;
        if (i < 16) {
          F = (B & C) | (~B & D);
          g = i;
        } else if (i < 32) {
          F = (D & B) | (~D & C);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          F = B ^ C ^ D;
          g = (3 * i + 5) % 16;
        } else {
          F = C ^ (B | ~D);
          g = (7 * i) % 16;
        }
        F = (F + A + K[i] + M[g]) >>> 0;
        A = D;
        D = C;
        C = B;
        B = (B + rotl(F, S[i])) >>> 0;
      }
      a0 = (a0 + A) >>> 0;
      b0 = (b0 + B) >>> 0;
      c0 = (c0 + C) >>> 0;
      d0 = (d0 + D) >>> 0;
    }

    const out = new Uint8Array(16);
    const outView = new DataView(out.buffer);
    outView.setUint32(0, a0, true);
    outView.setUint32(4, b0, true);
    outView.setUint32(8, c0, true);
    outView.setUint32(12, d0, true);
    return out;
  }

  /**
   * Symmetric RC4 stream cipher
   */
  function rc4Bytes(keyBytes, dataBytes) {
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    let j = 0;
    const keyLen = keyBytes.length;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + keyBytes[i % keyLen]) & 0xff;
      const t = S[i];
      S[i] = S[j];
      S[j] = t;
    }
    const out = new Uint8Array(dataBytes.length);
    let x = 0;
    let y = 0;
    for (let k = 0; k < dataBytes.length; k++) {
      x = (x + 1) & 0xff;
      y = (y + S[x]) & 0xff;
      const t = S[x];
      S[x] = S[y];
      S[y] = t;
      out[k] = dataBytes[k] ^ S[(S[x] + S[y]) & 0xff];
    }
    return out;
  }

  function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0').toUpperCase();
    }
    return hex;
  }

  /**
   * Pad or truncate a password string to 32 bytes per PDF Standard Security Handler
   */
  function padPassword(pwdStr) {
    const raw = [];
    const s = String(pwdStr || '');
    for (let i = 0; i < s.length && raw.length < 32; i++) {
      raw.push(s.charCodeAt(i) & 0xff);
    }
    const out = new Uint8Array(32);
    let idx = 0;
    while (idx < raw.length && idx < 32) {
      out[idx] = raw[idx];
      idx++;
    }
    let padIdx = 0;
    while (idx < 32) {
      out[idx++] = PDF_PAD[padIdx++];
    }
    return out;
  }

  /**
   * Algorithm 3: Compute /O (32-byte Owner value) for Revision 3 (128-bit)
   */
  function computeOwnerValue(userPwd, ownerPwd) {
    const effOwner = ownerPwd ? ownerPwd : userPwd + '#ToolNestOwnerKey';
    const paddedOwner = padPassword(effOwner);
    let digest = md5Bytes(paddedOwner);
    for (let i = 0; i < 50; i++) {
      digest = md5Bytes(digest);
    }
    const rc4Key = digest.slice(0, 16);
    let encrypted = rc4Bytes(rc4Key, padPassword(userPwd));
    const tempKey = new Uint8Array(16);
    for (let step = 1; step <= 19; step++) {
      for (let b = 0; b < 16; b++) tempKey[b] = rc4Key[b] ^ step;
      encrypted = rc4Bytes(tempKey, encrypted);
    }
    return encrypted;
  }

  /**
   * Algorithm 2: Compute 16-byte File Encryption Key for Revision 3 (128-bit)
   */
  function computeFileEncryptionKey(userPwd, OBytes, permissionsInt, fileIdBytes) {
    const paddedUser = padPassword(userPwd);
    const buf = new Uint8Array(32 + 32 + 4 + fileIdBytes.length);
    buf.set(paddedUser, 0);
    buf.set(OBytes, 32);
    buf[64] = permissionsInt & 0xff;
    buf[65] = (permissionsInt >>> 8) & 0xff;
    buf[66] = (permissionsInt >>> 16) & 0xff;
    buf[67] = (permissionsInt >>> 24) & 0xff;
    buf.set(fileIdBytes, 68);

    let digest = md5Bytes(buf);
    for (let i = 0; i < 50; i++) {
      digest = md5Bytes(digest.slice(0, 16));
    }
    return digest.slice(0, 16);
  }

  /**
   * Algorithm 5: Compute /U (32-byte User value) for Revision 3 (128-bit)
   */
  function computeUserValue(fileKey, fileIdBytes) {
    const buf = new Uint8Array(32 + fileIdBytes.length);
    buf.set(PDF_PAD, 0);
    buf.set(fileIdBytes, 32);
    const digest = md5Bytes(buf);
    let encrypted = rc4Bytes(fileKey, digest);
    const tempKey = new Uint8Array(16);
    for (let step = 1; step <= 19; step++) {
      for (let b = 0; b < 16; b++) tempKey[b] = fileKey[b] ^ step;
      encrypted = rc4Bytes(tempKey, encrypted);
    }
    const U = new Uint8Array(32);
    U.set(encrypted, 0);
    U.set(PDF_PAD.slice(0, 16), 16);
    return U;
  }

  /**
   * Algorithm 1: Compute per-object 16-byte RC4 key for object (objNum, genNum)
   */
  function computeObjectKey(fileKey, objNum, genNum) {
    const buf = new Uint8Array(21);
    buf.set(fileKey, 0);
    buf[16] = objNum & 0xff;
    buf[17] = (objNum >>> 8) & 0xff;
    buf[18] = (objNum >>> 16) & 0xff;
    buf[19] = genNum & 0xff;
    buf[20] = (genNum >>> 8) & 0xff;
    return md5Bytes(buf);
  }

  /**
   * Compute the signed 32-bit PDF Permissions integer (/P) per ISO 32000-1 Table 22
   */
  function buildPermissionsBitmask(opts) {
    // Base mask with bits 7-8 and bits 13-32 set to 1 (0xFFFFF0C0)
    let p = 0xFFFFF0C0 | 0;
    if (opts.print === 'low') {
      p |= (1 << 2); // Bit 3: Print low-res
    } else if (opts.print === 'high') {
      p |= (1 << 2) | (1 << 11); // Bit 3 + Bit 12: Print high-res
    }
    if (opts.modify) {
      p |= (1 << 3); // Bit 4: Modify contents
    }
    if (opts.copy) {
      p |= (1 << 4); // Bit 5: Copy text & graphics
    }
    if (opts.annot) {
      p |= (1 << 5) | (1 << 8); // Bit 6 + Bit 9: Annotations & interactive form fields
    }
    if (opts.access) {
      p |= (1 << 9); // Bit 10: Screen reader accessibility
    }
    if (opts.assemble) {
      p |= (1 << 10); // Bit 11: Assemble document
    }
    return p | 0;
  }

  /**
   * Ensure the serialized PDF trailer contains /Encrypt and /ID before startxref
   */
  function ensureTrailerHasEncryptAndId(pdfBytes, encryptObjNum, fileIdHex) {
    const tailLen = Math.min(pdfBytes.length, 2048);
    const tailStart = pdfBytes.length - tailLen;
    let tailStr = '';
    for (let i = tailStart; i < pdfBytes.length; i++) {
      tailStr += String.fromCharCode(pdfBytes[i]);
    }

    const trailerIdx = tailStr.lastIndexOf('trailer');
    if (trailerIdx === -1) return pdfBytes;

    const dictEndIdx = tailStr.indexOf('>>', trailerIdx);
    if (dictEndIdx === -1) return pdfBytes;

    const trailerSection = tailStr.slice(trailerIdx, dictEndIdx);
    let extraEntries = '';
    if (!trailerSection.includes('/Encrypt')) {
      extraEntries += '/Encrypt ' + encryptObjNum + ' 0 R\n';
    }
    if (!trailerSection.includes('/ID')) {
      extraEntries += '/ID [ <' + fileIdHex + '> <' + fileIdHex + '> ]\n';
    }
    if (!extraEntries) return pdfBytes;

    const newTailStr = tailStr.slice(0, dictEndIdx) + extraEntries + tailStr.slice(dictEndIdx);
    const extraBytes = new Uint8Array(newTailStr.length);
    for (let j = 0; j < newTailStr.length; j++) {
      extraBytes[j] = newTailStr.charCodeAt(j) & 0xff;
    }

    const out = new Uint8Array(tailStart + extraBytes.length);
    out.set(pdfBytes.subarray(0, tailStart), 0);
    out.set(extraBytes, tailStart);
    return out;
  }

  /**
   * Encrypt a PDF byte array using 128-bit Standard Security Handler (V=2, R=3)
   */
  async function encryptPdfDocumentBytes(rawPdfBytes, userPwd, ownerPwd, permOpts, onProgress) {
    if (!window.PDFLib) {
      throw new Error('PDF library is still loading. Please try again in a moment.');
    }
    const PDFDocument = window.PDFLib.PDFDocument;
    const PDFString = window.PDFLib.PDFString;
    const PDFHexString = window.PDFLib.PDFHexString;
    const PDFDict = window.PDFLib.PDFDict;
    const PDFArray = window.PDFLib.PDFArray;
    const PDFRawStream = window.PDFLib.PDFRawStream;

    if (onProgress) onProgress('Normalizing PDF object structure...', 15);
    const initialDoc = await PDFDocument.load(rawPdfBytes, { ignoreEncryption: true });
    const cleanBytes = await initialDoc.save({ useObjectStreams: false });

    if (onProgress) onProgress('Deriving 128-bit encryption keys...', 30);
    const doc = await PDFDocument.load(cleanBytes);

    // Finalize Info and caches BEFORE encrypting objects so save() does not add unencrypted strings
    if (typeof doc.updateInfoDict === 'function') doc.updateInfoDict();
    if (typeof doc.flush === 'function') doc.flush();
    doc.updateInfoDict = function () {};
    doc.flush = function () {};

    const permissionsInt = buildPermissionsBitmask(permOpts);
    const idSeed = new TextEncoder().encode('ToolNest-' + Date.now() + '-' + cleanBytes.length);
    const fileIdBytes = md5Bytes(idSeed);
    const fileIdHex = bytesToHex(fileIdBytes);

    const OBytes = computeOwnerValue(userPwd, ownerPwd);
    const fileKey = computeFileEncryptionKey(userPwd, OBytes, permissionsInt, fileIdBytes);
    const UBytes = computeUserValue(fileKey, fileIdBytes);

    function encryptValueRecursively(val, objKey) {
      if (!val) return val;
      if (PDFString && val instanceof PDFString) {
        const rawStrBytes = val.asBytes();
        const enc = rc4Bytes(objKey, rawStrBytes);
        return PDFHexString.of(bytesToHex(enc));
      }
      if (PDFHexString && val instanceof PDFHexString) {
        const rawHexBytes = val.asBytes();
        const encHex = rc4Bytes(objKey, rawHexBytes);
        return PDFHexString.of(bytesToHex(encHex));
      }
      if (PDFRawStream && val instanceof PDFRawStream) {
        if (val.contents instanceof Uint8Array) {
          val.contents = rc4Bytes(objKey, val.contents);
        }
        if (val.dict) encryptValueRecursively(val.dict, objKey);
        return val;
      }
      if (PDFDict && val instanceof PDFDict && val.dict instanceof Map) {
        for (const [k, v] of val.dict.entries()) {
          const updated = encryptValueRecursively(v, objKey);
          if (updated !== v) {
            val.dict.set(k, updated);
          }
        }
        return val;
      }
      if (PDFArray && val instanceof PDFArray && Array.isArray(val.array)) {
        for (let i = 0; i < val.array.length; i++) {
          val.array[i] = encryptValueRecursively(val.array[i], objKey);
        }
        return val;
      }
      return val;
    }

    const indirectObjects = doc.context.enumerateIndirectObjects();
    const totalObjs = indirectObjects.length;

    for (let idx = 0; idx < totalObjs; idx++) {
      if (idx % 25 === 0 && onProgress) {
        const pct = 35 + Math.round((idx / totalObjs) * 50);
        onProgress('Encrypting PDF object ' + (idx + 1) + ' of ' + totalObjs + '...', pct);
      }
      const pair = indirectObjects[idx];
      const ref = pair[0];
      const obj = pair[1];
      const objKey = computeObjectKey(fileKey, ref.objectNumber, ref.generationNumber || 0);
      const updatedObj = encryptValueRecursively(obj, objKey);
      if (updatedObj !== obj) {
        doc.context.assign(ref, updatedObj);
      }
    }

    if (onProgress) onProgress('Writing Standard Security dictionary & trailer...', 90);
    const encryptDict = doc.context.obj({
      Filter: 'Standard',
      V: 2,
      R: 3,
      Length: 128,
      P: permissionsInt,
      O: PDFHexString.of(bytesToHex(OBytes)),
      U: PDFHexString.of(bytesToHex(UBytes))
    });
    const encryptRef = doc.context.register(encryptDict);
    const idHexObj = PDFHexString.of(fileIdHex);

    doc.context.trailerInfo.Encrypt = encryptRef;
    doc.context.trailerInfo.ID = doc.context.obj([idHexObj, idHexObj]);

    const savedBytes = await doc.save({
      useObjectStreams: false,
      updateFieldAppearances: false
    });

    const finalBytes = ensureTrailerHasEncryptAndId(savedBytes, encryptRef.objectNumber, fileIdHex);
    if (onProgress) onProgress('Complete!', 100);
    return finalBytes;
  }

  /**
   * Generate a sample 2-page confidential financial statement PDF in memory
   */
  async function generateSamplePdfFile() {
    if (!window.PDFLib) {
      throw new Error('PDF library is still loading. Please try again in a moment.');
    }
    const PDFDocument = window.PDFLib.PDFDocument;
    const rgb = window.PDFLib.rgb;
    const StandardFonts = window.PDFLib.StandardFonts;

    const doc = await PDFDocument.create();
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await doc.embedFont(StandardFonts.Helvetica);

    const p1 = doc.addPage([595.28, 841.89]);
    p1.drawRectangle({ x: 36, y: 715, width: 523, height: 85, color: rgb(0.08, 0.25, 0.55) });
    p1.drawText('CONFIDENTIAL SALARY & TAX STATEMENT', { x: 54, y: 760, size: 18, font: fontBold, color: rgb(1, 1, 1) });
    p1.drawText('Sample PDF Document • Test 128-bit Password Protection', { x: 54, y: 734, size: 12, font: fontReg, color: rgb(0.85, 0.92, 1) });
    p1.drawText('Employee Name: Rahman Ahmed', { x: 48, y: 655, size: 13, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    p1.drawText('Net Disbursed Amount: BDT 1,25,500.00 (One Lakh Twenty-Five Thousand Five Hundred)', { x: 48, y: 625, size: 11, font: fontReg, color: rgb(0.25, 0.3, 0.4) });
    p1.drawText('Encrypt this PDF with a Document Open Password so only authorized recipients can view it.', { x: 48, y: 590, size: 11, font: fontReg, color: rgb(0.25, 0.3, 0.4) });

    const p2 = doc.addPage([595.28, 841.89]);
    p2.drawRectangle({ x: 36, y: 715, width: 523, height: 85, color: rgb(0.1, 0.45, 0.35) });
    p2.drawText('APPENDIX — ANNUAL BREAKDOWN (PAGE 2)', { x: 54, y: 760, size: 18, font: fontBold, color: rgb(1, 1, 1) });
    p2.drawText('Protected locally in your browser with ToolNest Protect PDF', { x: 54, y: 734, size: 12, font: fontReg, color: rgb(0.88, 1, 0.95) });

    const bytes = await doc.save();
    return new File([bytes], 'confidential-statement-sample.pdf', { type: 'application/pdf' });
  }

  /**
   * Render a first-page thumbnail using pdf.js (or fallback canvas)
   */
  async function renderFirstPageThumb(pdfBytes, fileName) {
    if (window.pdfjsLib) {
      try {
        ensurePdfJsWorker();
        const copy = pdfBytes.slice();
        const pdfDoc = await window.pdfjsLib.getDocument({ data: copy }).promise;
        const page = await pdfDoc.getPage(1);
        const vp = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        return { thumbUrl: canvas.toDataURL('image/jpeg', 0.85), pageCount: pdfDoc.numPages, encrypted: false };
      } catch (err) {
        if (err && err.name === 'PasswordException') {
          return { thumbUrl: createFallbackLockThumb(fileName, true), pageCount: 1, encrypted: true };
        }
      }
    }

    let count = 1;
    if (window.PDFLib) {
      try {
        const d = await window.PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        count = d.getPageCount();
      } catch (_) {}
    }
    return { thumbUrl: createFallbackLockThumb(fileName, false), pageCount: count, encrypted: false };
  }

  function createFallbackLockThumb(fileName, isLocked) {
    const c = document.createElement('canvas');
    c.width = 220;
    c.height = 300;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = isLocked ? '#DC2626' : '#2563EB';
    ctx.fillRect(20, 24, c.width - 40, 44);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(isLocked ? 'ENCRYPTED PDF' : 'PDF DOCUMENT', 34, 52);
    ctx.fillStyle = '#475569';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText((fileName || 'document.pdf').slice(0, 20), 24, 105);
    return c.toDataURL('image/png');
  }

  function evaluatePasswordStrength(pwd) {
    if (!pwd) return { pct: 0, label: 'Enter a password to check strength', color: '#94a3b8' };
    let score = 0;
    if (pwd.length >= 6) score += 20;
    if (pwd.length >= 10) score += 25;
    if (pwd.length >= 14) score += 15;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 15;
    if (/\d/.test(pwd)) score += 15;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 10;

    if (score < 40) return { pct: 30, label: 'Weak — Add more characters, numbers, or symbols', color: '#dc2626' };
    if (score < 70) return { pct: 65, label: 'Good — Suitable for standard document protection', color: '#d97706' };
    return { pct: 100, label: 'Strong — High-entropy password', color: '#16a34a' };
  }

  function generateRandomStrongPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    const arr = new Uint32Array(14);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (let i = 0; i < 14; i++) arr[i] = Math.floor(Math.random() * 100000);
    }
    let out = '';
    for (let j = 0; j < arr.length; j++) {
      out += chars[arr[j] % chars.length];
    }
    return out;
  }

  if (typeof window !== 'undefined') {
    window.ToolNestProtectPdf = {
      md5Bytes: md5Bytes,
      rc4Bytes: rc4Bytes,
      buildPermissionsBitmask: buildPermissionsBitmask,
      encryptPdfDocumentBytes: encryptPdfDocumentBytes
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('tn-ppdf-dropzone');
    const fileInput = document.getElementById('tn-ppdf-file-input');
    const sampleBtn = document.getElementById('tn-ppdf-sample-btn');

    const fileCard = document.getElementById('tn-ppdf-file-card');
    const thumbImg = document.getElementById('tn-ppdf-thumb');
    const fileNameEl = document.getElementById('tn-ppdf-file-name');
    const pageBadge = document.getElementById('tn-ppdf-page-badge');
    const sizeBadge = document.getElementById('tn-ppdf-size-badge');
    const statusBadge = document.getElementById('tn-ppdf-status-badge');
    const changeFileBtn = document.getElementById('tn-ppdf-change-file-btn');

    const userPwdInput = document.getElementById('tn-ppdf-user-pwd');
    const confirmPwdInput = document.getElementById('tn-ppdf-confirm-pwd');
    const toggleUserPwdBtn = document.getElementById('tn-ppdf-toggle-user-pwd');
    const copyUserPwdBtn = document.getElementById('tn-ppdf-copy-user-pwd');
    const genPwdBtn = document.getElementById('tn-ppdf-gen-pwd-btn');
    const strengthFill = document.getElementById('tn-ppdf-strength-fill');
    const strengthLabel = document.getElementById('tn-ppdf-strength-label');
    const matchFeedback = document.getElementById('tn-ppdf-match-feedback');

    const useOwnerChk = document.getElementById('tn-ppdf-use-owner-chk');
    const ownerWrap = document.getElementById('tn-ppdf-owner-wrap');
    const ownerPwdInput = document.getElementById('tn-ppdf-owner-pwd');

    const presetStrictBtn = document.getElementById('tn-ppdf-preset-strict');
    const presetPrintBtn = document.getElementById('tn-ppdf-preset-print');
    const presetAllBtn = document.getElementById('tn-ppdf-preset-all');

    const printPermSelect = document.getElementById('tn-ppdf-print-perm');
    const filenameInput = document.getElementById('tn-ppdf-filename');
    const permCopyChk = document.getElementById('tn-ppdf-perm-copy');
    const permModifyChk = document.getElementById('tn-ppdf-perm-modify');
    const permAnnotChk = document.getElementById('tn-ppdf-perm-annot');
    const permAssembleChk = document.getElementById('tn-ppdf-perm-assemble');
    const permAccessChk = document.getElementById('tn-ppdf-perm-access');

    const protectBtn = document.getElementById('tn-ppdf-protect-btn');
    const clearBtn = document.getElementById('tn-ppdf-clear-btn');

    const progressWrap = document.getElementById('tn-ppdf-progress-wrap');
    const progressText = document.getElementById('tn-ppdf-progress-text');
    const progressBar = document.getElementById('tn-ppdf-progress-bar');

    const resultCard = document.getElementById('tn-ppdf-result-card');
    const resultSummary = document.getElementById('tn-ppdf-result-summary');
    const downloadBtn = document.getElementById('tn-ppdf-download-btn');

    if (!dropzone || !protectBtn) return;

    function updatePasswordUi() {
      const pwd = userPwdInput ? userPwdInput.value : '';
      const conf = confirmPwdInput ? confirmPwdInput.value : '';
      const st = evaluatePasswordStrength(pwd);

      if (strengthFill) {
        strengthFill.style.width = st.pct + '%';
        strengthFill.style.backgroundColor = st.color;
      }
      if (strengthLabel) {
        strengthLabel.textContent = st.label;
      }

      if (matchFeedback) {
        if (!conf) {
          matchFeedback.textContent = 'Must match the Document Open Password';
          matchFeedback.className = 'small text-muted mt-1';
        } else if (pwd === conf) {
          matchFeedback.innerHTML = '<i class="bi bi-check-circle-fill text-success me-1"></i> Passwords match';
          matchFeedback.className = 'small text-success fw-medium mt-1';
        } else {
          matchFeedback.innerHTML = '<i class="bi bi-exclamation-circle-fill text-danger me-1"></i> Passwords do not match';
          matchFeedback.className = 'small text-danger fw-medium mt-1';
        }
      }
    }

    if (userPwdInput) userPwdInput.addEventListener('input', updatePasswordUi);
    if (confirmPwdInput) confirmPwdInput.addEventListener('input', updatePasswordUi);

    if (toggleUserPwdBtn && userPwdInput) {
      toggleUserPwdBtn.addEventListener('click', function () {
        const isPwd = userPwdInput.type === 'password';
        userPwdInput.type = isPwd ? 'text' : 'password';
        if (confirmPwdInput) confirmPwdInput.type = isPwd ? 'text' : 'password';
        toggleUserPwdBtn.innerHTML = isPwd
          ? '<i class="bi bi-eye-slash" aria-hidden="true"></i>'
          : '<i class="bi bi-eye" aria-hidden="true"></i>';
      });
    }

    if (copyUserPwdBtn && userPwdInput) {
      copyUserPwdBtn.addEventListener('click', function () {
        if (!userPwdInput.value) {
          if (window.ToolNest && window.ToolNest.showToast) {
            window.ToolNest.showToast('Enter or generate a password first.', 'warning');
          }
          return;
        }
        if (window.ToolNest && window.ToolNest.copyToClipboard) {
          window.ToolNest.copyToClipboard(userPwdInput.value, copyUserPwdBtn);
        }
      });
    }

    if (genPwdBtn && userPwdInput && confirmPwdInput) {
      genPwdBtn.addEventListener('click', function () {
        const generated = generateRandomStrongPassword();
        userPwdInput.value = generated;
        confirmPwdInput.value = generated;
        userPwdInput.type = 'text';
        confirmPwdInput.type = 'text';
        if (toggleUserPwdBtn) {
          toggleUserPwdBtn.innerHTML = '<i class="bi bi-eye-slash" aria-hidden="true"></i>';
        }
        updatePasswordUi();
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Generated strong password! Copy and save it safely.', 'success');
        }
      });
    }

    if (useOwnerChk && ownerWrap) {
      useOwnerChk.addEventListener('change', function () {
        ownerWrap.classList.toggle('d-none', !useOwnerChk.checked);
      });
    }

    // Permission Presets
    if (presetStrictBtn) {
      presetStrictBtn.addEventListener('click', function () {
        if (printPermSelect) printPermSelect.value = 'none';
        if (permCopyChk) permCopyChk.checked = false;
        if (permModifyChk) permModifyChk.checked = false;
        if (permAnnotChk) permAnnotChk.checked = false;
        if (permAssembleChk) permAssembleChk.checked = false;
        if (permAccessChk) permAccessChk.checked = true;
      });
    }

    if (presetPrintBtn) {
      presetPrintBtn.addEventListener('click', function () {
        if (printPermSelect) printPermSelect.value = 'high';
        if (permCopyChk) permCopyChk.checked = false;
        if (permModifyChk) permModifyChk.checked = false;
        if (permAnnotChk) permAnnotChk.checked = false;
        if (permAssembleChk) permAssembleChk.checked = false;
        if (permAccessChk) permAccessChk.checked = true;
      });
    }

    if (presetAllBtn) {
      presetAllBtn.addEventListener('click', function () {
        if (printPermSelect) printPermSelect.value = 'high';
        if (permCopyChk) permCopyChk.checked = true;
        if (permModifyChk) permModifyChk.checked = true;
        if (permAnnotChk) permAnnotChk.checked = true;
        if (permAssembleChk) permAssembleChk.checked = true;
        if (permAccessChk) permAccessChk.checked = true;
      });
    }

    async function handleSelectedFile(file) {
      if (!file) return;
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Please select a valid PDF file.', 'warning');
        }
        return;
      }

      try {
        const buf = await file.arrayBuffer();
        currentFile = file;
        currentPdfBytes = new Uint8Array(buf);

        const info = await renderFirstPageThumb(currentPdfBytes, file.name);
        currentPageCount = info.pageCount;

        if (thumbImg) thumbImg.src = info.thumbUrl;
        if (fileNameEl) fileNameEl.textContent = file.name;
        if (pageBadge) pageBadge.textContent = info.pageCount + (info.pageCount === 1 ? ' Page' : ' Pages');
        if (sizeBadge) {
          sizeBadge.textContent = window.ToolNest && window.ToolNest.formatBytes
            ? window.ToolNest.formatBytes(file.size)
            : Math.round(file.size / 1024) + ' KB';
        }
        if (statusBadge) {
          if (info.encrypted) {
            statusBadge.className = 'badge bg-danger-subtle text-danger border border-danger-subtle';
            statusBadge.innerHTML = '<i class="bi bi-lock-fill" aria-hidden="true"></i> Password-Protected';
          } else {
            statusBadge.className = 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle';
            statusBadge.innerHTML = '<i class="bi bi-unlock" aria-hidden="true"></i> Unprotected';
          }
        }
        if (filenameInput) {
          const baseName = file.name.replace(/\.pdf$/i, '');
          filenameInput.value = baseName + '-protected.pdf';
        }

        if (fileCard) fileCard.classList.remove('d-none');
        if (resultCard) resultCard.classList.add('d-none');
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Loaded ' + file.name + ' (' + info.pageCount + ' pages).', 'success');
        }
      } catch (err) {
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast(err.message || 'Could not read PDF file.', 'danger');
        }
      }
    }

    if (changeFileBtn && fileInput) {
      changeFileBtn.addEventListener('click', function () {
        fileInput.value = '';
        fileInput.click();
      });
    }

    if (sampleBtn) {
      sampleBtn.addEventListener('click', async function () {
        try {
          const sampleFile = await generateSamplePdfFile();
          await handleSelectedFile(sampleFile);
          if (userPwdInput && !userPwdInput.value) {
            userPwdInput.value = 'ToolNest2026!';
            if (confirmPwdInput) confirmPwdInput.value = 'ToolNest2026!';
            userPwdInput.type = 'text';
            if (confirmPwdInput) confirmPwdInput.type = 'text';
            updatePasswordUi();
          }
        } catch (err) {
          if (window.ToolNest && window.ToolNest.showToast) {
            window.ToolNest.showToast(err.message || 'Could not generate sample PDF.', 'danger');
          }
        }
      });
    }

    protectBtn.addEventListener('click', async function () {
      if (!currentPdfBytes) {
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Please select a PDF file first (or click Load Sample PDF).', 'warning');
        }
        return;
      }

      const userPwd = userPwdInput ? userPwdInput.value : '';
      const confirmPwd = confirmPwdInput ? confirmPwdInput.value : '';
      if (!userPwd) {
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Please enter a Document Open Password.', 'warning');
        }
        if (userPwdInput) userPwdInput.focus();
        return;
      }

      if (userPwd !== confirmPwd) {
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('Passwords do not match. Please re-enter.', 'danger');
        }
        if (confirmPwdInput) confirmPwdInput.focus();
        return;
      }

      const ownerPwd = useOwnerChk && useOwnerChk.checked && ownerPwdInput ? ownerPwdInput.value : '';
      const permOpts = {
        print: printPermSelect ? printPermSelect.value : 'high',
        copy: permCopyChk ? permCopyChk.checked : false,
        modify: permModifyChk ? permModifyChk.checked : false,
        annot: permAnnotChk ? permAnnotChk.checked : true,
        assemble: permAssembleChk ? permAssembleChk.checked : false,
        access: permAccessChk ? permAccessChk.checked : true
      };

      protectBtn.disabled = true;
      if (progressWrap) progressWrap.classList.remove('d-none');

      try {
        const encryptedBytes = await encryptPdfDocumentBytes(
          currentPdfBytes,
          userPwd,
          ownerPwd,
          permOpts,
          function (msg, pct) {
            if (progressText) progressText.textContent = msg;
            if (progressBar) {
              progressBar.style.width = pct + '%';
              progressBar.textContent = pct + '%';
            }
          }
        );

        protectedPdfBlob = new Blob([encryptedBytes], { type: 'application/pdf' });
        let outName = (filenameInput && filenameInput.value.trim()) || 'document-protected.pdf';
        if (!outName.toLowerCase().endsWith('.pdf')) outName += '.pdf';
        protectedFilename = outName;

        if (resultCard && resultSummary) {
          const sizeStr = window.ToolNest && window.ToolNest.formatBytes
            ? window.ToolNest.formatBytes(protectedPdfBlob.size)
            : Math.round(protectedPdfBlob.size / 1024) + ' KB';
          const esc = window.ToolNest && window.ToolNest.escapeHtml
            ? window.ToolNest.escapeHtml
            : function (s) { return String(s); };
          resultSummary.innerHTML =
            '<i class="bi bi-shield-lock-fill text-success me-1" aria-hidden="true"></i> ' +
            'Encrypted <strong>' + esc(protectedFilename) + '</strong> (' + currentPageCount +
            (currentPageCount === 1 ? ' page, ' : ' pages, ') + sizeStr + ') with 128-bit Standard PDF Security.';
          resultCard.classList.remove('d-none');
        }

        if (window.ToolNest && window.ToolNest.downloadBlob) {
          window.ToolNest.downloadBlob(protectedPdfBlob, protectedFilename);
        }
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast('PDF encrypted and downloaded!', 'success');
        }
      } catch (err) {
        if (window.ToolNest && window.ToolNest.showToast) {
          window.ToolNest.showToast(err.message || 'Encryption failed.', 'danger');
        }
      } finally {
        protectBtn.disabled = false;
        if (progressWrap) progressWrap.classList.add('d-none');
      }
    });

    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        if (protectedPdfBlob && window.ToolNest && window.ToolNest.downloadBlob) {
          window.ToolNest.downloadBlob(protectedPdfBlob, protectedFilename);
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        currentFile = null;
        currentPdfBytes = null;
        currentPageCount = 0;
        protectedPdfBlob = null;
        if (fileInput) fileInput.value = '';
        if (fileCard) fileCard.classList.add('d-none');
        if (resultCard) resultCard.classList.add('d-none');
        if (userPwdInput) userPwdInput.value = '';
        if (confirmPwdInput) confirmPwdInput.value = '';
        if (ownerPwdInput) ownerPwdInput.value = '';
        updatePasswordUi();
      });
    }

    if (window.ToolNest && window.ToolNest.setupDropzone) {
      window.ToolNest.setupDropzone(dropzone, fileInput, function (files) {
        if (files && files.length > 0) handleSelectedFile(files[0]);
      });
    }
  });
})();
