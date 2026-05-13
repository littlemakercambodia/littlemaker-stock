// ─── Current view tab ──────────────────────────────────────────────────────────
let currentTab = 'products'; // 'products' | 'recycle' | 'history'

// ─── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('toolbar-main').style.display = tab === 'products' ? '' : 'none';
  if (tab === 'products') renderProducts();
  else if (tab === 'recycle') renderRecycleBin();
  else if (tab === 'history') renderHistory();
}

// ─── Active Products ────────────────────────────────────────────────────────────
function renderProducts() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const catFilter = document.getElementById('cat-filter').value;
  let products = DB.getProducts();
  if (search) products = products.filter(p => p.name.toLowerCase().includes(search));
  if (catFilter) products = products.filter(p => p.category === catFilter);

  const tbody = document.getElementById('product-list');
  const count = document.getElementById('product-count');
  if (count) count.textContent = products.length + ' ' + t('items');

  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="no-data">${t('no_data')}</td></tr>`;
    return;
  }
  tbody.innerHTML = products.map((p, i) => {
    const margin = p.buyPrice > 0 ? Math.round((p.sellPrice - p.buyPrice) / p.buyPrice * 100) : 0;
    return `
    <tr data-id="${p.id}" class="product-row">
      <td>${i + 1}</td>
      <td><strong>${p.name}</strong></td>
      <td><span class="cat-tag cat-${p.category}">${t('cat_' + p.category)}</span></td>
      <td class="text-right">${fmtKHR(p.buyPrice)}</td>
      <td class="text-right">${fmtKHR(p.sellPrice)}</td>
      <td class="text-right">
        <span class="margin-badge ${margin >= 20 ? 'mg-good' : margin >= 10 ? 'mg-ok' : 'mg-low'}">+${margin}%</span>
      </td>
      <td class="text-right"><strong>${fmtNum(p.stock)}</strong> ${t('unit_' + p.unit)}</td>
      <td>${stockBadge(p.stock)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon btn-adj" title="${t('adjust_stock')}" onclick="openAdjustStock('${p.id}')">📦</button>
          <button class="btn-icon btn-edit" title="${t('edit_product')}" onclick="openEditProduct('${p.id}')">✎</button>
          <button class="btn-icon btn-del" title="${t('move_to_bin')}" onclick="moveProductToBin('${p.id}', '${p.name.replace(/'/g,"\\'")}')">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── Recycle Bin ───────────────────────────────────────────────────────────────
function renderRecycleBin() {
  const bin = DB.getRecycleBin();
  const tbody = document.getElementById('product-list');
  const count = document.getElementById('product-count');
  if (count) count.textContent = bin.length + ' ' + t('items');

  if (!bin.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="no-data">${t('bin_empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = bin.map((p, i) => `
    <tr class="bin-row">
      <td>${i + 1}</td>
      <td><strong style="opacity:.7">${p.name}</strong></td>
      <td><span class="cat-tag cat-${p.category}">${t('cat_' + p.category)}</span></td>
      <td class="text-right" style="opacity:.7">${fmtKHR(p.buyPrice)}</td>
      <td class="text-right" style="opacity:.7">${fmtKHR(p.sellPrice)}</td>
      <td style="opacity:.6;font-size:12px">${fmtDateTime(p.deletedAt)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon btn-restore" title="${t('restore')}" onclick="restoreProduct('${p.id}', '${p.name.replace(/'/g,"\\'")}')">♻️</button>
          <button class="btn-icon btn-del" title="${t('perm_delete')}" onclick="permanentDeleteProduct('${p.id}', '${p.name.replace(/'/g,"\\'")}')">✕</button>
        </div>
      </td>
    </tr>`).join('');
}

// ─── History ───────────────────────────────────────────────────────────────────
function renderHistory() {
  const history = DB.getHistory();
  const tbody = document.getElementById('product-list');
  const count = document.getElementById('product-count');
  if (count) count.textContent = history.length + ' ' + t('items');

  if (!history.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="no-data">${t('no_history')}</td></tr>`;
    return;
  }
  tbody.innerHTML = history.map((h, i) => {
    const actionInfo = {
      add: { icon: '➕', label: t('hist_add'), cls: 'hist-add' },
      edit: { icon: '✎', label: t('hist_edit'), cls: 'hist-edit' },
      delete: { icon: '🗑', label: t('hist_delete'), cls: 'hist-delete' },
      restore: { icon: '♻️', label: t('hist_restore'), cls: 'hist-restore' },
      permanent_delete: { icon: '💀', label: t('hist_perm_delete'), cls: 'hist-perm' },
      adjust: { icon: '📦', label: t('hist_adjust'), cls: 'hist-adjust' },
    };
    const info = actionInfo[h.action] || { icon: '•', label: h.action, cls: '' };
    return `
    <tr>
      <td>${i + 1}</td>
      <td><span class="hist-badge ${info.cls}">${info.icon} ${info.label}</span></td>
      <td><strong>${h.productName}</strong></td>
      <td style="font-size:12px;color:var(--text-muted)">${fmtDateTime(h.timestamp)}</td>
      <td>
        <button class="btn-icon btn-info" title="${t('view_detail')}" onclick="showHistoryDetail('${h.id}')">👁</button>
      </td>
    </tr>`;
  }).join('');
}

function showHistoryDetail(hid) {
  const h = DB.getHistory().find(x => x.id === hid);
  if (!h) return;
  const s = h.snapshot;
  const body = `
    <div class="hist-detail">
      <div class="hist-detail-row"><span class="hist-detail-label">${t('product_name')}</span><strong>${s.name}</strong></div>
      <div class="hist-detail-row"><span class="hist-detail-label">${t('category')}</span>${t('cat_' + s.category)}</div>
      <div class="hist-detail-row"><span class="hist-detail-label">${t('buy_price')}</span>${fmtKHR(s.buyPrice)}</div>
      <div class="hist-detail-row"><span class="hist-detail-label">${t('sell_price')}</span>${fmtKHR(s.sellPrice)}</div>
      <div class="hist-detail-row"><span class="hist-detail-label">${t('stock')}</span>${fmtNum(s.stock)} ${t('unit_' + s.unit)}</div>
      <div class="hist-detail-row"><span class="hist-detail-label">${t('date')}</span>${fmtDateTime(h.timestamp)}</div>
    </div>`;
  Modal.open(t('history_detail'), body, null);
  document.getElementById('modal-save').style.display = 'none';
  document.getElementById('modal-cancel').textContent = t('close');
}

// ─── Table header switcher ─────────────────────────────────────────────────────
function renderTableHeader() {
  const thead = document.getElementById('table-head');
  if (currentTab === 'products') {
    thead.innerHTML = `<tr>
      <th style="width:40px">#</th>
      <th data-t="product_name">ឈ្មោះ</th>
      <th data-t="category">ប្រភេទ</th>
      <th data-t="buy_price" class="text-right">តម្លៃទិញ</th>
      <th data-t="sell_price" class="text-right">តម្លៃលក់</th>
      <th class="text-right">% ចំណេញ</th>
      <th data-t="stock" class="text-right">ស្តុក</th>
      <th>ស្ថានភាព</th>
      <th data-t="actions" style="width:120px">សកម្មភាព</th>
    </tr>`;
  } else if (currentTab === 'recycle') {
    thead.innerHTML = `<tr>
      <th style="width:40px">#</th>
      <th>ឈ្មោះ</th>
      <th>ប្រភេទ</th>
      <th class="text-right">តម្លៃទិញ</th>
      <th class="text-right">តម្លៃលក់</th>
      <th>លុបនៅ</th>
      <th style="width:100px">សកម្មភាព</th>
    </tr>`;
  } else {
    thead.innerHTML = `<tr>
      <th style="width:40px">#</th>
      <th>សកម្មភាព</th>
      <th>ផលិតផល</th>
      <th>ពេលវេលា</th>
      <th style="width:60px">ព័ត៌មាន</th>
    </tr>`;
  }
  applyLang();
}

// ─── Product actions ────────────────────────────────────────────────────────────
function openAddProduct() {
  const body = `
    <div class="form-grid">
      <div class="form-group full">
        <label>${t('product_name')} *</label>
        <input type="text" id="f-name" class="form-input" required placeholder="ឈ្មោះផលិតផល...">
      </div>
      <div class="form-group">
        <label>${t('category')} *</label>
        <select id="f-cat" class="form-input">${getCatOptions()}</select>
      </div>
      <div class="form-group">
        <label>${t('unit')} *</label>
        <select id="f-unit" class="form-input">${getUnitOptions()}</select>
      </div>
      <div class="form-group">
        <label>${t('buy_price')} *</label>
        <input type="number" id="f-buy" class="form-input" min="0" placeholder="0" oninput="calcMargin()">
      </div>
      <div class="form-group">
        <label>${t('sell_price')} *</label>
        <input type="number" id="f-sell" class="form-input" min="0" placeholder="0" oninput="calcMargin()">
      </div>
      <div class="form-group">
        <label>${t('stock')}</label>
        <input type="number" id="f-stock" class="form-input" min="0" value="0">
      </div>
      <div class="form-group full">
        <div id="margin-preview" class="margin-preview"></div>
      </div>
    </div>`;
  Modal.open(t('add_product'), body, saveProduct);
}

function calcMargin() {
  const buy = parseFloat(document.getElementById('f-buy')?.value) || 0;
  const sell = parseFloat(document.getElementById('f-sell')?.value) || 0;
  const el = document.getElementById('margin-preview');
  if (el && buy > 0) {
    const margin = Math.round((sell - buy) / buy * 100);
    const profit = sell - buy;
    el.innerHTML = `<span class="${profit >= 0 ? 'text-success' : 'text-danger'}">
      ${t('profit_per_item')}: ${fmtKHR(profit)} (${margin}%)
    </span>`;
  } else if (el) el.innerHTML = '';
}

function openEditProduct(id) {
  const p = DB.getProduct(id);
  if (!p) return;
  const body = `
    <input type="hidden" id="f-id" value="${p.id}">
    <div class="form-grid">
      <div class="form-group full">
        <label>${t('product_name')} *</label>
        <input type="text" id="f-name" class="form-input" value="${p.name}" required>
      </div>
      <div class="form-group">
        <label>${t('category')} *</label>
        <select id="f-cat" class="form-input">${getCatOptions(p.category)}</select>
      </div>
      <div class="form-group">
        <label>${t('unit')} *</label>
        <select id="f-unit" class="form-input">${getUnitOptions(p.unit)}</select>
      </div>
      <div class="form-group">
        <label>${t('buy_price')} *</label>
        <input type="number" id="f-buy" class="form-input" value="${p.buyPrice}" min="0" oninput="calcMargin()">
      </div>
      <div class="form-group">
        <label>${t('sell_price')} *</label>
        <input type="number" id="f-sell" class="form-input" value="${p.sellPrice}" min="0" oninput="calcMargin()">
      </div>
      <div class="form-group">
        <label>${t('stock')}</label>
        <input type="number" id="f-stock" class="form-input" value="${p.stock}" min="0">
      </div>
      <div class="form-group full">
        <div id="margin-preview" class="margin-preview"></div>
      </div>
    </div>`;
  Modal.open(t('edit_product'), body, saveProduct);
  setTimeout(calcMargin, 50);
}

function saveProduct() {
  const name = document.getElementById('f-name').value.trim();
  const cat = document.getElementById('f-cat').value;
  const unit = document.getElementById('f-unit').value;
  const buyPrice = parseFloat(document.getElementById('f-buy').value) || 0;
  const sellPrice = parseFloat(document.getElementById('f-sell').value) || 0;
  const stock = parseInt(document.getElementById('f-stock').value) || 0;
  if (!name) { showToast(t('fill_required'), 'error'); return; }
  const idEl = document.getElementById('f-id');
  const isEdit = !!idEl;
  const product = {
    id: idEl ? idEl.value : DB.uid(),
    name, category: cat, unit, buyPrice, sellPrice, stock,
    updatedAt: new Date().toISOString()
  };
  if (!isEdit) product.createdAt = new Date().toISOString();
  DB.addHistory(isEdit ? 'edit' : 'add', product);
  DB.saveProduct(product);
  Modal.close();
  showToast(t('saved'));
  renderTableHeader();
  renderProducts();
  updateNotifBadge();
}

function moveProductToBin(id, name) {
  showConfirm(`${t('confirm_move_bin')}\n"${name}"`, () => {
    DB.moveToRecycleBin(id);
    showToast(t('moved_to_bin'), 'success');
    renderProducts();
    updateNotifBadge();
    updateBinBadge();
  });
}

function restoreProduct(id, name) {
  DB.restoreFromBin(id);
  showToast(`♻️ "${name}" ${t('restored')}`, 'success');
  renderTableHeader();
  renderRecycleBin();
  updateNotifBadge();
  updateBinBadge();
}

function permanentDeleteProduct(id, name) {
  showConfirm(`⚠️ ${t('confirm_perm_delete')}\n"${name}"`, () => {
    DB.permanentDelete(id);
    showToast(t('perm_deleted'), 'success');
    renderTableHeader();
    renderRecycleBin();
    updateBinBadge();
  });
}

function emptyBin() {
  const bin = DB.getRecycleBin();
  if (!bin.length) return;
  showConfirm(`⚠️ ${t('confirm_empty_bin')} (${bin.length} ${t('items')})`, () => {
    DB.emptyRecycleBin();
    showToast(t('bin_emptied'), 'success');
    renderTableHeader();
    renderRecycleBin();
    updateBinBadge();
  });
}

function clearHistory() {
  showConfirm(t('confirm_clear_history'), () => {
    DB.clearHistory();
    renderTableHeader();
    renderHistory();
    showToast(t('history_cleared'), 'success');
  });
}

function updateBinBadge() {
  const badge = document.getElementById('bin-badge');
  const count = DB.getRecycleBin().length;
  if (badge) {
    badge.textContent = count;
    badge.style.display = count ? 'inline-flex' : 'none';
  }
}

function exportProductsPage() {
  const products = DB.getProducts();
  const rows = [[t('product_name'), t('category'), t('buy_price'), t('sell_price'), t('profit_per_item'), t('stock'), t('unit')]];
  products.forEach(p => rows.push([
    p.name, t('cat_' + p.category), p.buyPrice, p.sellPrice,
    p.sellPrice - p.buyPrice, p.stock, t('unit_' + p.unit)
  ]));
  downloadCSV(rows, `products-${new Date().toISOString().slice(0, 10)}.csv`);
  showToast(t('saved'));
}

function initCatFilter() {
  const sel = document.getElementById('cat-filter');
  if (!sel) return;
  sel.innerHTML = `<option value="">${t('all_categories')}</option>` +
    ['food', 'drink', 'material', 'other'].map(c => `<option value="${c}">${t('cat_' + c)}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  await authGuard();
  initCatFilter();
  renderTableHeader();
  renderProducts();
  updateBinBadge();
  document.getElementById('search-input').addEventListener('input', () => { if (currentTab === 'products') renderProducts(); });
  document.getElementById('cat-filter').addEventListener('change', () => { if (currentTab === 'products') renderProducts(); });
  document.getElementById('btn-add').addEventListener('click', openAddProduct);
  const csvBtn = document.getElementById('btn-csv');
  if (csvBtn) csvBtn.addEventListener('click', exportProductsPage);

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      renderTableHeader();
    });
  });

  // Action bar buttons
  document.getElementById('btn-empty-bin')?.addEventListener('click', emptyBin);
  document.getElementById('btn-clear-history')?.addEventListener('click', clearHistory);
});
