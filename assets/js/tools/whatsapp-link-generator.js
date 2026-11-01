/**
 * ToolNest - WhatsApp Link Generator
 * Creates wa.me links locally in the browser.
 */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function digits(value) { return String(value || '').replace(/\D/g, ''); }

  function buildLink() {
    var country = digits(el('tn-wa-country').value);
    var phone = digits(el('tn-wa-phone').value);
    var message = String(el('tn-wa-message').value || '').trim();
    var status = el('tn-wa-status');
    var output = el('tn-wa-output');
    var open = el('tn-wa-open');
    var copy = el('tn-wa-copy');

    if (!country || !phone) {
      output.value = '';
      open.href = '#';
      open.setAttribute('aria-disabled', 'true');
      copy.disabled = true;
      status.className = 'small text-danger';
      status.textContent = 'Enter a country code and phone number.';
      return '';
    }

    var fullNumber = country + phone;
    var link = 'https://wa.me/' + fullNumber;
    if (message) link += '?text=' + encodeURIComponent(message);
    output.value = link;
    open.href = link;
    open.removeAttribute('aria-disabled');
    copy.disabled = false;
    status.className = 'small text-success';
    status.textContent = 'WhatsApp link ready for +' + fullNumber + '.';
    return link;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var fields = ['tn-wa-country', 'tn-wa-phone', 'tn-wa-message'];
    fields.forEach(function (id) {
      var input = el(id);
      if (input) input.addEventListener('input', buildLink);
    });

    el('tn-wa-sample').addEventListener('click', function () {
      el('tn-wa-country').value = '880';
      el('tn-wa-phone').value = '1711000000';
      el('tn-wa-message').value = 'Assalamu Alaikum! I would like to know more about your product.';
      buildLink();
    });

    el('tn-wa-reset').addEventListener('click', function () {
      el('tn-wa-country').value = '880';
      el('tn-wa-phone').value = '';
      el('tn-wa-message').value = '';
      buildLink();
    });

    el('tn-wa-copy').addEventListener('click', function () {
      var link = buildLink();
      if (link && window.ToolNest && window.ToolNest.copyToClipboard) {
        window.ToolNest.copyToClipboard(link, this);
      }
    });

    buildLink();
  });
})();
