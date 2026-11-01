/**
 * ToolNest - UTM Link Builder (/assets/js/tools/utm-link-builder.js)
 * 100% Client-Side Google Analytics 4 (GA4) & Meta Ads Campaign URL Builder.
 * Supports one-click channel presets, lowercase normalization, space replacement,
 * existing query/hash preservation, parameter breakdown, and batch CSV history export.
 */
(function () {
  'use strict';

  const UTM_CHANNEL_PRESETS = {
    fb_ads: {
      label: 'Facebook Paid Ad / Boost',
      source: 'facebook',
      medium: 'paid_social',
      campaign: 'eid_collection_2026',
      term: 'dhaka_shoppers_18_40',
      content: 'carousel_ad_v1'
    },
    fb_organic: {
      label: 'Facebook Organic Post',
      source: 'facebook',
      medium: 'social',
      campaign: 'page_promo',
      term: '',
      content: 'pinned_post_link'
    },
    ig_ads: {
      label: 'Instagram Reel / Story Ad',
      source: 'instagram',
      medium: 'paid_social',
      campaign: 'summer_drop_2026',
      term: 'fashion_interest',
      content: 'reel_video_15s'
    },
    google_cpc: {
      label: 'Google Search Ads (CPC)',
      source: 'google',
      medium: 'cpc',
      campaign: 'search_brand_2026',
      term: 'buy_panjabi_online_bd',
      content: 'headline_a'
    },
    youtube: {
      label: 'YouTube Video Description',
      source: 'youtube',
      medium: 'video',
      campaign: 'product_review_oct',
      term: '',
      content: 'description_top_link'
    },
    newsletter: {
      label: 'Email Newsletter',
      source: 'newsletter',
      medium: 'email',
      campaign: 'weekly_digest_oct',
      term: '',
      content: 'hero_cta_button'
    },
    sms: {
      label: 'Bulk SMS Blast',
      source: 'sms_blast',
      medium: 'sms',
      campaign: 'flash_sale_weekend',
      term: 'vip_customers',
      content: 'short_link_1'
    },
    whatsapp: {
      label: 'WhatsApp / Messenger',
      source: 'whatsapp',
      medium: 'messaging',
      campaign: 'order_followup',
      term: '',
      content: 'catalog_share'
    }
  };

  /**
   * Sanitize a UTM parameter value according to user formatting preferences
   */
  function formatUtmValue(rawValue, forceLowercase, spaceRule) {
    let val = String(rawValue || '').trim();
    if (!val) return '';
    if (forceLowercase) {
      val = val.toLowerCase();
    }
    if (spaceRule === 'underscore') {
      val = val.replace(/\s+/g, '_');
    } else if (spaceRule === 'hyphen') {
      val = val.replace(/\s+/g, '-');
    }
    return val;
  }

  /**
   * Build a valid UTM-tagged URL while preserving existing query parameters and #hash fragments
   */
  function buildUtmUrl(params) {
    const rawUrl = String(params.url || '').trim();
    if (!rawUrl) {
      return {
        isValid: false,
        error: 'Please enter a destination website URL.',
        finalUrl: '',
        queryString: '',
        activeParams: []
      };
    }

    // Auto-prepend https:// if user entered example.com without scheme
    const normalizedInputUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(rawUrl)
      ? rawUrl
      : 'https://' + rawUrl;

    let parsedUrl;
    try {
      parsedUrl = new URL(normalizedInputUrl);
      if (!parsedUrl.hostname || !parsedUrl.hostname.includes('.')) {
        return {
          isValid: false,
          error: 'Please enter a valid domain name (e.g. https://yourstore.com/product).',
          finalUrl: '',
          queryString: '',
          activeParams: []
        };
      }
    } catch (e) {
      return {
        isValid: false,
        error: 'Invalid URL format. Example: https://yourstore.com/summer-sale',
        finalUrl: '',
        queryString: '',
        activeParams: []
      };
    }

    const forceLower = params.forceLowercase !== false;
    const spaceRule = params.spaceRule || 'underscore';

    const utmEntries = [
      { key: 'utm_source', label: 'Campaign Source', required: true, raw: params.source },
      { key: 'utm_medium', label: 'Campaign Medium', required: true, raw: params.medium },
      { key: 'utm_campaign', label: 'Campaign Name', required: true, raw: params.campaign },
      { key: 'utm_id', label: 'Campaign ID', required: false, raw: params.id },
      { key: 'utm_term', label: 'Campaign Term', required: false, raw: params.term },
      { key: 'utm_content', label: 'Campaign Content', required: false, raw: params.content }
    ];

    const activeParams = [];
    utmEntries.forEach(function (entry) {
      const cleanVal = formatUtmValue(entry.raw, forceLower, spaceRule);
      if (cleanVal) {
        parsedUrl.searchParams.set(entry.key, cleanVal);
        activeParams.push({
          key: entry.key,
          label: entry.label,
          value: cleanVal
        });
      } else {
        parsedUrl.searchParams.delete(entry.key);
      }
    });

    const missingRequired = [];
    if (!formatUtmValue(params.source, forceLower, spaceRule)) missingRequired.push('utm_source');
    if (!formatUtmValue(params.medium, forceLower, spaceRule)) missingRequired.push('utm_medium');
    if (!formatUtmValue(params.campaign, forceLower, spaceRule)) missingRequired.push('utm_campaign');

    return {
      isValid: true,
      missingRequired: missingRequired,
      finalUrl: parsedUrl.toString(),
      queryString: parsedUrl.search,
      activeParams: activeParams
    };
  }

  // Expose helper for automated testing
  if (typeof window !== 'undefined') {
    window.ToolNestUtmBuilder = {
      presets: UTM_CHANNEL_PRESETS,
      formatUtmValue: formatUtmValue,
      buildUtmUrl: buildUtmUrl
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const urlInput = document.getElementById('tn-utm-url');
    const sourceInput = document.getElementById('tn-utm-source');
    const mediumInput = document.getElementById('tn-utm-medium');
    const campaignInput = document.getElementById('tn-utm-campaign');
    const idInput = document.getElementById('tn-utm-id');
    const termInput = document.getElementById('tn-utm-term');
    const contentInput = document.getElementById('tn-utm-content');

    const lowercaseCheck = document.getElementById('tn-utm-lowercase');
    const spaceSelect = document.getElementById('tn-utm-space-rule');

    const outputTextarea = document.getElementById('tn-utm-output');
    const statusBadge = document.getElementById('tn-utm-status-badge');
    const charCountEl = document.getElementById('tn-utm-char-count');
    const paramsBreakdownEl = document.getElementById('tn-utm-breakdown');

    const copyBtn = document.getElementById('tn-utm-copy-btn');
    const testLinkBtn = document.getElementById('tn-utm-test-btn');
    const saveHistoryBtn = document.getElementById('tn-utm-save-btn');
    const sampleBtn = document.getElementById('tn-utm-sample-btn');
    const resetBtn = document.getElementById('tn-utm-reset-btn');

    const historyWrap = document.getElementById('tn-utm-history-wrap');
    const historyBody = document.getElementById('tn-utm-history-body');
    const exportCsvBtn = document.getElementById('tn-utm-export-csv');
    const clearHistoryBtn = document.getElementById('tn-utm-clear-history');

    if (!urlInput || !outputTextarea) return;

    let savedLinks = [];

    function getCurrentParams() {
      return {
        url: urlInput.value,
        source: sourceInput.value,
        medium: mediumInput.value,
        campaign: campaignInput.value,
        id: idInput ? idInput.value : '',
        term: termInput ? termInput.value : '',
        content: contentInput ? contentInput.value : '',
        forceLowercase: lowercaseCheck ? lowercaseCheck.checked : true,
        spaceRule: spaceSelect ? spaceSelect.value : 'underscore'
      };
    }

    function updateUtmPreview() {
      const res = buildUtmUrl(getCurrentParams());

      if (!res.isValid) {
        outputTextarea.value = '';
        if (charCountEl) charCountEl.textContent = '0 characters';
        if (statusBadge) {
          statusBadge.className = 'badge bg-danger-subtle text-danger px-3 py-2';
          statusBadge.innerHTML =
            '<i class="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i> ' +
            window.ToolNest.escapeHtml(res.error);
        }
        if (paramsBreakdownEl) {
          paramsBreakdownEl.innerHTML =
            '<span class="text-muted small">Enter a valid website URL above to preview UTM parameters.</span>';
        }
        if (testLinkBtn) testLinkBtn.setAttribute('href', '#');
        return;
      }

      outputTextarea.value = res.finalUrl;
      if (charCountEl) {
        charCountEl.textContent = res.finalUrl.length + ' characters';
      }
      if (testLinkBtn) {
        testLinkBtn.setAttribute('href', res.finalUrl);
      }

      if (statusBadge) {
        if (res.missingRequired && res.missingRequired.length > 0) {
          statusBadge.className = 'badge bg-warning-subtle text-dark border border-warning px-3 py-2';
          statusBadge.innerHTML =
            '<i class="bi bi-info-circle-fill me-1" aria-hidden="true"></i> Recommended: Fill in ' +
            window.ToolNest.escapeHtml(res.missingRequired.join(', '));
        } else {
          statusBadge.className = 'badge bg-success-subtle text-success px-3 py-2';
          statusBadge.innerHTML =
            '<i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i> Valid GA4 &amp; Meta Ads Tracking Link Ready';
        }
      }

      if (paramsBreakdownEl) {
        if (res.activeParams.length === 0) {
          paramsBreakdownEl.innerHTML =
            '<span class="text-muted small">No UTM parameters added yet. Type in the fields above or click a preset.</span>';
        } else {
          paramsBreakdownEl.innerHTML = res.activeParams
            .map(function (p) {
              return (
                '<span class="badge bg-white text-dark border px-2 py-1 fw-normal">' +
                '<strong class="text-primary">' +
                window.ToolNest.escapeHtml(p.key) +
                '</strong>=' +
                window.ToolNest.escapeHtml(p.value) +
                '</span>'
              );
            })
            .join(' ');
        }
      }
    }

    function renderHistory() {
      if (!historyWrap || !historyBody) return;
      if (savedLinks.length === 0) {
        historyWrap.classList.add('d-none');
        return;
      }
      historyWrap.classList.remove('d-none');
      historyBody.innerHTML = savedLinks
        .map(function (item, idx) {
          return (
            '<tr>' +
            '<td class="small fw-semibold">' +
            window.ToolNest.escapeHtml(item.campaign || '—') +
            '<div class="text-muted fw-normal">' +
            window.ToolNest.escapeHtml(item.source) +
            ' / ' +
            window.ToolNest.escapeHtml(item.medium) +
            '</div></td>' +
            '<td class="small"><code class="text-break">' +
            window.ToolNest.escapeHtml(item.finalUrl) +
            '</code></td>' +
            '<td class="text-end text-nowrap">' +
            '<button type="button" class="btn tn-btn--outline btn-sm py-1 px-2 me-1" data-copy-saved="' +
            idx +
            '" aria-label="Copy saved UTM URL"><i class="bi bi-clipboard" aria-hidden="true"></i></button>' +
            '<button type="button" class="btn tn-btn--outline btn-sm py-1 px-2 text-danger" data-rm-saved="' +
            idx +
            '" aria-label="Delete saved UTM URL"><i class="bi bi-trash" aria-hidden="true"></i></button>' +
            '</td>' +
            '</tr>'
          );
        })
        .join('');

      historyBody.querySelectorAll('[data-copy-saved]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const idx = Number(btn.getAttribute('data-copy-saved'));
          if (savedLinks[idx]) {
            window.ToolNest.copyToClipboard(savedLinks[idx].finalUrl, btn);
          }
        });
      });

      historyBody.querySelectorAll('[data-rm-saved]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const idx = Number(btn.getAttribute('data-rm-saved'));
          savedLinks.splice(idx, 1);
          renderHistory();
        });
      });
    }

    // Bind live input listeners
    [urlInput, sourceInput, mediumInput, campaignInput, idInput, termInput, contentInput, lowercaseCheck, spaceSelect].forEach(
      function (el) {
        if (!el) return;
        el.addEventListener('input', updateUtmPreview);
        el.addEventListener('change', updateUtmPreview);
      }
    );

    // Bind Quick Channel Preset buttons
    document.querySelectorAll('[data-utm-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.getAttribute('data-utm-preset');
        const preset = UTM_CHANNEL_PRESETS[key];
        if (!preset) return;
        if (!urlInput.value.trim()) {
          urlInput.value = 'https://dhakafashion.com/eid-collection';
        }
        sourceInput.value = preset.source;
        mediumInput.value = preset.medium;
        campaignInput.value = preset.campaign;
        if (termInput) termInput.value = preset.term;
        if (contentInput) contentInput.value = preset.content;
        updateUtmPreview();
        window.ToolNest.showToast('Applied "' + preset.label + '" preset!', 'success');
      });
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (!outputTextarea.value) {
          window.ToolNest.showToast('Please enter a valid URL first.', 'warning');
          return;
        }
        window.ToolNest.copyToClipboard(outputTextarea.value, copyBtn);
      });
    }

    if (saveHistoryBtn) {
      saveHistoryBtn.addEventListener('click', function () {
        const res = buildUtmUrl(getCurrentParams());
        if (!res.isValid || !res.finalUrl) {
          window.ToolNest.showToast('Enter a valid URL before adding to your campaign list.', 'warning');
          return;
        }
        savedLinks.unshift({
          source: formatUtmValue(sourceInput.value, lowercaseCheck.checked, spaceSelect.value) || 'direct',
          medium: formatUtmValue(mediumInput.value, lowercaseCheck.checked, spaceSelect.value) || 'none',
          campaign: formatUtmValue(campaignInput.value, lowercaseCheck.checked, spaceSelect.value) || 'untitled',
          term: formatUtmValue(termInput ? termInput.value : '', lowercaseCheck.checked, spaceSelect.value),
          content: formatUtmValue(contentInput ? contentInput.value : '', lowercaseCheck.checked, spaceSelect.value),
          finalUrl: res.finalUrl
        });
        renderHistory();
        window.ToolNest.showToast('Added UTM link to Campaign List!', 'success');
      });
    }

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', function () {
        if (savedLinks.length === 0) return;
        const header = 'utm_source,utm_medium,utm_campaign,utm_term,utm_content,full_utm_url\n';
        const rows = savedLinks
          .map(function (r) {
            return [r.source, r.medium, r.campaign, r.term, r.content, r.finalUrl]
              .map(function (cell) {
                return '"' + String(cell || '').replace(/"/g, '""') + '"';
              })
              .join(',');
          })
          .join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
        window.ToolNest.downloadBlob(blob, 'toolnest-utm-campaign-links.csv');
      });
    }

    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', function () {
        savedLinks = [];
        renderHistory();
      });
    }

    if (sampleBtn) {
      sampleBtn.addEventListener('click', function () {
        urlInput.value = 'https://dhakafashion.com/panjabi-collection';
        sourceInput.value = 'facebook';
        mediumInput.value = 'paid_social';
        campaignInput.value = 'eid_sale_2026';
        if (idInput) idInput.value = 'cmp_bd_104';
        if (termInput) termInput.value = 'mens_cotton_panjabi';
        if (contentInput) contentInput.value = 'video_reel_ad_1';
        updateUtmPreview();
        window.ToolNest.showToast('Sample Facebook Ad campaign loaded.', 'success');
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        urlInput.value = 'https://yourstore.com/special-offer';
        sourceInput.value = '';
        mediumInput.value = '';
        campaignInput.value = '';
        if (idInput) idInput.value = '';
        if (termInput) termInput.value = '';
        if (contentInput) contentInput.value = '';
        if (lowercaseCheck) lowercaseCheck.checked = true;
        if (spaceSelect) spaceSelect.value = 'underscore';
        updateUtmPreview();
      });
    }

    updateUtmPreview();
  });
})();
