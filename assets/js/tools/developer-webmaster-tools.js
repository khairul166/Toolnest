(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    function by(id) { return document.getElementById(id); }
    function set(id, value) { by(id).value = value; }
    function text(id, value) { by(id).textContent = value; }

    by('dw-json-format').addEventListener('click', function () { try { set('dw-json-output', JSON.stringify(JSON.parse(by('dw-json-input').value), null, 2)); } catch (e) { set('dw-json-output', 'Invalid JSON: ' + e.message); } });
    by('dw-json-minify').addEventListener('click', function () { try { set('dw-json-output', JSON.stringify(JSON.parse(by('dw-json-input').value))); } catch (e) { set('dw-json-output', 'Invalid JSON: ' + e.message); } });
    by('dw-base64-encode').addEventListener('click', function () { set('dw-base64-output', btoa(unescape(encodeURIComponent(by('dw-base64-input').value)))); });
    by('dw-base64-decode').addEventListener('click', function () { try { set('dw-base64-output', decodeURIComponent(escape(atob(by('dw-base64-input').value)))); } catch (e) { set('dw-base64-output', 'Invalid Base64'); } });
    by('dw-url-encode').addEventListener('click', function () { set('dw-url-output', encodeURIComponent(by('dw-url-input').value)); });
    by('dw-url-decode').addEventListener('click', function () { try { set('dw-url-output', decodeURIComponent(by('dw-url-input').value)); } catch (e) { set('dw-url-output', 'Invalid encoded URL'); } });
    by('dw-password-generate').addEventListener('click', function () { var n = Number(by('dw-password-length').value) || 16, chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+='; var out = ''; crypto.getRandomValues(new Uint32Array(n)).forEach(function (v) { out += chars[v % chars.length]; }); set('dw-password-output', out); });
    by('dw-uuid-generate').addEventListener('click', function () { var u = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random()*16|0, v = c === 'x' ? r : (r&3|8); return v.toString(16); }); text('dw-uuid-output', u); });
    by('dw-hash-generate').addEventListener('click', async function () { var data = new TextEncoder().encode(by('dw-hash-input').value), hash = await crypto.subtle.digest(by('dw-hash-algorithm').value, data); set('dw-hash-output', Array.from(new Uint8Array(hash)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('')); });
    function updateMeta() { var title = by('dw-meta-title').value, desc = by('dw-meta-description').value, url = by('dw-meta-url').value, image = by('dw-meta-image').value; set('dw-meta-output', '<title>' + title + '</title>\n<meta name="description" content="' + desc + '">\n<link rel="canonical" href="' + url + '">\n<meta property="og:title" content="' + title + '">\n<meta property="og:description" content="' + desc + '">\n<meta property="og:url" content="' + url + '">\n<meta property="og:image" content="' + image + '">'); text('dw-serp-title', title || 'Page title preview'); text('dw-serp-description', desc || 'Search result description preview.'); }
    ['dw-meta-title','dw-meta-description','dw-meta-url','dw-meta-image'].forEach(function (id) { by(id).addEventListener('input', updateMeta); });
    by('dw-robots-generate').addEventListener('click', function () { set('dw-robots-output', 'User-agent: ' + by('dw-robots-agent').value + '\nDisallow: ' + by('dw-robots-disallow').value + '\nAllow: /\nSitemap: ' + by('dw-robots-sitemap').value); });
    function gradient() { var a=by('dw-gradient-a').value,b=by('dw-gradient-b').value,angle=by('dw-gradient-angle').value; text('dw-gradient-preview',''); by('dw-gradient-preview').style.background='linear-gradient('+angle+'deg, '+a+', '+b+')'; set('dw-gradient-output','background: linear-gradient('+angle+'deg, '+a+', '+b+');'); }
    ['dw-gradient-a','dw-gradient-b','dw-gradient-angle'].forEach(function (id) { by(id).addEventListener('input', gradient); });
    function colorConvert() { var hex=by('dw-color-hex').value.replace('#',''), n=parseInt(hex,16); if(hex.length!==6||isNaN(n)){text('dw-color-output','Enter a 6-digit HEX color.');return;} var r=n>>16&255,g=n>>8&255,b=n&255; text('dw-color-output','HEX: #'+hex.toUpperCase()+'\nRGB: rgb('+r+', '+g+', '+b+')\nCSS: color: #'+hex.toUpperCase()+';'); }
    by('dw-color-hex').addEventListener('input', colorConvert); updateMeta(); gradient(); colorConvert();
  });
})();
