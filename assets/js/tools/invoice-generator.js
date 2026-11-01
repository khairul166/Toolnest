/**
 * ToolNest - Invoice & COD Courier Slip Generator (/assets/js/tools/invoice-generator.js)
 * Dynamic line items, tax/discount/delivery/advance calculations, live printable sheet,
 * Print/PDF export, and high-res PNG receipt image export.
 */
(function () {
  'use strict';

  let items = [
    { id: 1, name: 'Premium Cotton Panjabi (Size L)', qty: 1, price: 1450 },
    { id: 2, name: 'Handcrafted Leather Wallet', qty: 1, price: 650 }
  ];
  let nextItemId = 3;

  function formatMoney(amount, symbol) {
    const val = Number(amount) || 0;
    return symbol + ' ' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const docModeSelect = document.getElementById('tn-inv-mode');
    const currencySelect = document.getElementById('tn-inv-currency');
    const invNoInput = document.getElementById('tn-inv-number');
    const invDateInput = document.getElementById('tn-inv-date');
    const courierNameSelect = document.getElementById('tn-inv-courier');

    const sellerName = document.getElementById('tn-inv-seller-name');
    const sellerPhone = document.getElementById('tn-inv-seller-phone');
    const sellerAddress = document.getElementById('tn-inv-seller-addr');

    const buyerName = document.getElementById('tn-inv-buyer-name');
    const buyerPhone = document.getElementById('tn-inv-buyer-phone');
    const buyerAddress = document.getElementById('tn-inv-buyer-addr');

    const discountInput = document.getElementById('tn-inv-discount');
    const taxRateInput = document.getElementById('tn-inv-tax');
    const deliveryInput = document.getElementById('tn-inv-delivery');
    const advanceInput = document.getElementById('tn-inv-advance');
    const notesInput = document.getElementById('tn-inv-notes');

    const itemsEditorBody = document.getElementById('tn-inv-items-editor');
    const btnAddItem = document.getElementById('tn-inv-add-item');
    const btnPrintPdf = document.getElementById('tn-inv-print-btn');
    const btnDownloadImg = document.getElementById('tn-inv-dl-img-btn');
    const btnSample = document.getElementById('tn-inv-sample-btn');
    const btnReset = document.getElementById('tn-inv-reset-btn');

    if (!itemsEditorBody) return;

    // Default date = today
    const now = new Date();
    invDateInput.value =
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0');

    function renderItemsEditor() {
      itemsEditorBody.innerHTML = items
        .map(function (it, idx) {
          const lineTotal = (Number(it.qty) || 0) * (Number(it.price) || 0);
          return (
            '<tr>' +
            '<td><input type="text" class="form-control form-control-sm" data-item-field="name" data-idx="' +
            idx +
            '" value="' +
            window.ToolNest.escapeHtml(it.name) +
            '" placeholder="Item description"></td>' +
            '<td style="width:95px;"><input type="number" class="form-control form-control-sm text-center" data-item-field="qty" data-idx="' +
            idx +
            '" value="' +
            it.qty +
            '" min="1"></td>' +
            '<td style="width:130px;"><input type="number" class="form-control form-control-sm text-end" data-item-field="price" data-idx="' +
            idx +
            '" value="' +
            it.price +
            '" min="0" step="0.01"></td>' +
            '<td class="text-end fw-semibold small align-middle" style="width:120px;">' +
            lineTotal.toFixed(2) +
            '</td>' +
            '<td class="text-center align-middle" style="width:48px;">' +
            '<button type="button" class="btn btn-sm text-danger p-1" data-remove-item="' +
            idx +
            '" ' +
            (items.length === 1 ? 'disabled' : '') +
            ' aria-label="Remove item row"><i class="bi bi-trash3" aria-hidden="true"></i></button>' +
            '</td>' +
            '</tr>'
          );
        })
        .join('');

      itemsEditorBody.querySelectorAll('[data-item-field]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          const idx = Number(inp.getAttribute('data-idx'));
          const field = inp.getAttribute('data-item-field');
          if (!items[idx]) return;
          if (field === 'name') {
            items[idx].name = inp.value;
          } else if (field === 'qty') {
            items[idx].qty = Math.max(0, parseFloat(inp.value) || 0);
          } else if (field === 'price') {
            items[idx].price = Math.max(0, parseFloat(inp.value) || 0);
          }
          const rowTotalCell = inp.closest('tr').children[3];
          if (rowTotalCell) {
            rowTotalCell.textContent = (items[idx].qty * items[idx].price).toFixed(2);
          }
          updatePreview();
        });
      });

      itemsEditorBody.querySelectorAll('[data-remove-item]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const idx = Number(btn.getAttribute('data-remove-item'));
          if (items.length > 1) {
            items.splice(idx, 1);
            renderItemsEditor();
            updatePreview();
          }
        });
      });
    }

    function calculateTotals() {
      const subtotal = items.reduce(function (acc, it) {
        return acc + (Number(it.qty) || 0) * (Number(it.price) || 0);
      }, 0);
      const discount = Math.max(0, parseFloat(discountInput.value) || 0);
      const afterDiscount = Math.max(0, subtotal - discount);
      const taxRate = Math.max(0, parseFloat(taxRateInput.value) || 0);
      const taxAmount = afterDiscount * (taxRate / 100);
      const delivery = Math.max(0, parseFloat(deliveryInput.value) || 0);
      const grandTotal = afterDiscount + taxAmount + delivery;
      const advance = Math.max(0, parseFloat(advanceInput.value) || 0);
      const balanceDue = Math.max(0, grandTotal - advance);

      return {
        subtotal: subtotal,
        discount: discount,
        taxRate: taxRate,
        taxAmount: taxAmount,
        delivery: delivery,
        grandTotal: grandTotal,
        advance: advance,
        balanceDue: balanceDue
      };
    }

    function updatePreview() {
      const sym = currencySelect.value || '৳';
      const isCourier = docModeSelect.value === 'courier';
      const totals = calculateTotals();

      document.getElementById('tn-prev-title').textContent = isCourier ? 'COD COURIER PARCEL SLIP' : 'COMMERCIAL INVOICE';
      document.getElementById('tn-prev-courier-badge').textContent = courierNameSelect.value || 'Direct Delivery';
      document.getElementById('tn-prev-courier-badge').classList.toggle('d-none', !isCourier);

      document.getElementById('tn-prev-invno').textContent = invNoInput.value || 'INV-2026-101';
      document.getElementById('tn-prev-date').textContent = invDateInput.value || '2026-10-26';

      document.getElementById('tn-prev-seller-name').textContent = sellerName.value || 'Your Store Name';
      document.getElementById('tn-prev-seller-phone').textContent = sellerPhone.value || '';
      document.getElementById('tn-prev-seller-addr').textContent = sellerAddress.value || '';

      document.getElementById('tn-prev-buyer-name').textContent = buyerName.value || 'Customer Name';
      document.getElementById('tn-prev-buyer-phone').textContent = buyerPhone.value || '';
      document.getElementById('tn-prev-buyer-addr').textContent = buyerAddress.value || '';

      const prevItemsBody = document.getElementById('tn-prev-items-body');
      prevItemsBody.innerHTML = items
        .map(function (it, i) {
          const line = (Number(it.qty) || 0) * (Number(it.price) || 0);
          return (
            '<tr>' +
            '<td>' +
            (i + 1) +
            '</td>' +
            '<td>' +
            window.ToolNest.escapeHtml(it.name || 'Item') +
            '</td>' +
            '<td class="text-center">' +
            it.qty +
            '</td>' +
            '<td class="text-end">' +
            formatMoney(it.price, sym) +
            '</td>' +
            '<td class="text-end fw-semibold">' +
            formatMoney(line, sym) +
            '</td>' +
            '</tr>'
          );
        })
        .join('');

      document.getElementById('tn-prev-subtotal').textContent = formatMoney(totals.subtotal, sym);
      document.getElementById('tn-prev-discount').textContent = '- ' + formatMoney(totals.discount, sym);
      document.getElementById('tn-prev-tax').textContent = formatMoney(totals.taxAmount, sym);
      document.getElementById('tn-prev-delivery').textContent = formatMoney(totals.delivery, sym);
      document.getElementById('tn-prev-advance').textContent = '- ' + formatMoney(totals.advance, sym);
      document.getElementById('tn-prev-due').textContent = formatMoney(totals.balanceDue, sym);
      document.getElementById('tn-prev-cod-banner').textContent =
        totals.balanceDue <= 0 ? 'PAID IN FULL (৳ 0 COD)' : 'COLLECTIBLE COD: ' + formatMoney(totals.balanceDue, sym);
      document.getElementById('tn-prev-notes').textContent = notesInput.value || '';
    }

    function exportReceiptPng() {
      const sym = currencySelect.value || '৳';
      const totals = calculateTotals();
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = Math.max(680, 460 + items.length * 42);
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header bar
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, 900, 95);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.fillText(sellerName.value || 'Store Invoice', 40, 48);
      ctx.font = '15px Inter, sans-serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText((sellerPhone.value || '') + '  •  ' + (sellerAddress.value || ''), 40, 75);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText(docModeSelect.value === 'courier' ? 'COD COURIER SLIP' : 'INVOICE', 860, 45);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '15px Inter, sans-serif';
      ctx.fillText('#' + (invNoInput.value || 'INV-101') + ' | ' + (invDateInput.value || ''), 860, 73);
      ctx.textAlign = 'left';

      // Recipient box
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(40, 115, 820, 90);
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(40, 115, 820, 90);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText('Deliver / Bill To: ' + (buyerName.value || ''), 56, 142);
      ctx.font = '15px Inter, sans-serif';
      ctx.fillText('Phone: ' + (buyerPhone.value || '') + '   |   Courier: ' + (courierNameSelect.value || ''), 56, 168);
      ctx.fillStyle = '#475569';
      ctx.fillText('Address: ' + (buyerAddress.value || ''), 56, 192);

      // Table Header
      let y = 240;
      ctx.fillStyle = '#EFF6FF';
      ctx.fillRect(40, y - 24, 820, 34);
      ctx.fillStyle = '#1E40AF';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText('Item Description', 55, y - 2);
      ctx.fillText('Qty', 540, y - 2);
      ctx.fillText('Price', 640, y - 2);
      ctx.fillText('Total', 770, y - 2);

      ctx.fillStyle = '#0F172A';
      ctx.font = '15px Inter, sans-serif';
      items.forEach(function (it) {
        y += 38;
        const line = (Number(it.qty) || 0) * (Number(it.price) || 0);
        ctx.fillText(String(it.name || 'Item').slice(0, 46), 55, y);
        ctx.fillText(String(it.qty), 545, y);
        ctx.fillText(formatMoney(it.price, sym), 630, y);
        ctx.fillText(formatMoney(line, sym), 755, y);
      });

      y += 40;
      ctx.strokeStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(860, y);
      ctx.stroke();

      y += 35;
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillStyle = '#16A34A';
      ctx.fillText('Net Collectible / Balance Due: ' + formatMoney(totals.balanceDue, sym), 40, y);

      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText(
        'Subtotal: ' +
          formatMoney(totals.subtotal, sym) +
          ' | Delivery: ' +
          formatMoney(totals.delivery, sym) +
          ' | Advance Paid: ' +
          formatMoney(totals.advance, sym),
        40,
        y + 30
      );

      canvas.toBlob(function (blob) {
        if (blob) {
          window.ToolNest.downloadBlob(blob, (invNoInput.value || 'invoice') + '.png');
          window.ToolNest.showToast('Receipt PNG downloaded!', 'success');
        }
      }, 'image/png');
    }

    if (btnAddItem) {
      btnAddItem.addEventListener('click', function () {
        items.push({ id: nextItemId++, name: 'New Product / Service', qty: 1, price: 500 });
        renderItemsEditor();
        updatePreview();
      });
    }

    [
      docModeSelect,
      currencySelect,
      invNoInput,
      invDateInput,
      courierNameSelect,
      sellerName,
      sellerPhone,
      sellerAddress,
      buyerName,
      buyerPhone,
      buyerAddress,
      discountInput,
      taxRateInput,
      deliveryInput,
      advanceInput,
      notesInput
    ].forEach(function (el) {
      if (el) {
        el.addEventListener('input', updatePreview);
        el.addEventListener('change', updatePreview);
      }
    });

    if (btnPrintPdf) {
      btnPrintPdf.addEventListener('click', function () {
        window.print();
      });
    }

    if (btnDownloadImg) {
      btnDownloadImg.addEventListener('click', exportReceiptPng);
    }

    if (btnSample) {
      btnSample.addEventListener('click', function () {
        docModeSelect.value = 'courier';
        currencySelect.value = '৳';
        invNoInput.value = 'ORD-2026-884';
        sellerName.value = 'Dhaka Attire & Lifestyle';
        sellerPhone.value = '01711-000000';
        sellerAddress.value = 'House 14, Road 7, Dhanmondi, Dhaka-1209';
        buyerName.value = 'Tanvir Ahmed';
        buyerPhone.value = '01819-555555';
        buyerAddress.value = 'Flat 4B, Nasirabad Housing Society, Chattogram';
        deliveryInput.value = 120;
        advanceInput.value = 200;
        discountInput.value = 100;
        items = [
          { id: 1, name: 'Premium Cotton Panjabi (Navy Blue, XL)', qty: 1, price: 1650 },
          { id: 2, name: 'Stitched Cotton Pajama (White)', qty: 1, price: 550 }
        ];
        renderItemsEditor();
        updatePreview();
        window.ToolNest.showToast('Sample F-Commerce COD order loaded!', 'success');
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', function () {
        buyerName.value = '';
        buyerPhone.value = '';
        buyerAddress.value = '';
        discountInput.value = 0;
        taxRateInput.value = 0;
        deliveryInput.value = 60;
        advanceInput.value = 0;
        items = [{ id: 1, name: '', qty: 1, price: 0 }];
        renderItemsEditor();
        updatePreview();
      });
    }

    renderItemsEditor();
    updatePreview();
  });
})();
