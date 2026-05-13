document.addEventListener('DOMContentLoaded', async () => {
  await authGuard();
  loadSettingsForm();
  renderUserList();

  // បានបន្ថែម Optional Chaining (?.) ទៅលើគ្រប់ប៊ូតុងដើម្បីការពារកុំឱ្យកូដគាំង
  document.getElementById('btn-add-user')?.addEventListener('click', openAddUser);
  document.getElementById('btn-save-settings')?.addEventListener('click', saveSettingsForm);
  document.getElementById('btn-export-json')?.addEventListener('click', exportAll);
  
  // សម្រាប់ការ Import ត្រូវប្រាកដថាធាតុទាំងពីរនេះមាន
  const btnImportJson = document.getElementById('btn-import-json');
  const importFile = document.getElementById('import-file');
  if (btnImportJson && importFile) {
    btnImportJson.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importAll);
  }

  document.getElementById('btn-export-products')?.addEventListener('click', exportProducts);
  document.getElementById('btn-export-sales')?.addEventListener('click', exportSales);
  document.getElementById('btn-export-purchases')?.addEventListener('click', exportPurchases);
  document.getElementById('btn-reset')?.addEventListener('click', resetData);

  // Theme buttons: បន្ថែមការផ្លាស់ប្តូរភ្លាមៗ (Live Preview)
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyTheme(btn.dataset.theme); // អនុវត្តពណ៌ភ្លាមៗដើម្បីមើលជាមុន
    });
  });

  // Language buttons: ដោះស្រាយបញ្ហា Browser ចាស់ៗដែលមិនស្គាល់ CSS :has()
  document.querySelectorAll('.lang-radio').forEach(r => {
    r.addEventListener('change', updateLangVisuals);
  });
});

// អនុគមន៍ជំនួយសម្រាប់ប្តូរពណ៌ប៊ូតុងភាសា
function updateLangVisuals() {
  document.querySelectorAll('.lang-radio-label').forEach(lbl => {
    const radio = lbl.querySelector('.lang-radio');
    if (radio && radio.checked) {
      lbl.style.borderColor = 'var(--accent)';
      lbl.style.background = 'var(--accent-pale)';
    } else {
      lbl.style.borderColor = 'var(--border)';
      lbl.style.background = 'var(--bg)';
    }
  });
}

function loadSettingsForm() {
  const s = DB.getSettings();
  // Language
  document.querySelectorAll('.lang-radio').forEach(r => {
    r.checked = (r.value === currentLang);
  });
  updateLangVisuals(); // ហៅឱ្យបង្ហាញពណ៌ត្រឹមត្រូវពេលចូលទំព័រដំបូង

  // Theme
  const theme = getTheme();
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  // Business info
  if (document.getElementById('s-biz-name')) document.getElementById('s-biz-name').value = s.bizName || '';
  if (document.getElementById('s-biz-phone')) document.getElementById('s-biz-phone').value = s.bizPhone || '';
  if (document.getElementById('s-biz-address')) document.getElementById('s-biz-address').value = s.bizAddress || '';
  if (document.getElementById('s-receipt-footer')) document.getElementById('s-receipt-footer').value = s.receiptFooter || t('receipt_thank');
  
  // Stats
  const stats = DB.getStats();
  if (document.getElementById('info-products')) document.getElementById('info-products').textContent = stats.productCount;
  if (document.getElementById('info-sales')) document.getElementById('info-sales').textContent = DB.getSales().length;
  if (document.getElementById('info-purchases')) document.getElementById('info-purchases').textContent = DB.getPurchases().length;
}

function saveSettingsForm() {
  // Language
  const langEl = document.querySelector('.lang-radio:checked');
  if (langEl && langEl.value !== currentLang) {
    localStorage.setItem('lm_lang', langEl.value);
  }
  // Theme
  const activeThemeBtn = document.querySelector('.theme-btn.active');
  if (activeThemeBtn) {
    localStorage.setItem('lm_theme', activeThemeBtn.dataset.theme);
    applyTheme(activeThemeBtn.dataset.theme);
  }
  // Business info
  const s = {
    bizName: document.getElementById('s-biz-name')?.value.trim() || '',
    bizPhone: document.getElementById('s-biz-phone')?.value.trim() || '',
    bizAddress: document.getElementById('s-biz-address')?.value.trim() || '',
    receiptFooter: document.getElementById('s-receipt-footer')?.value.trim() || '',
  };
  DB.saveSettings(s);
  showToast(t('settings_saved'));

  // Reload if lang changed
  const langVal = langEl ? langEl.value : currentLang;
  if (langVal !== currentLang) {
    setTimeout(() => location.reload(), 800);
  }
}

function exportAll() {
  const data = DB.exportAll();
  downloadJSON(data, `littlemaker-backup-${new Date().toISOString().slice(0,10)}.json`);
  showToast(t('saved'));
}

function importAll(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      DB.importAll(data);
      showToast(t('settings_import_success'));
      setTimeout(() => location.reload(), 1000);
    } catch {
      showToast(t('settings_import_error'), 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function exportProducts() {
  const products = DB.getProducts();
  const rows = [[t('product_name'), t('category'), t('buy_price'), t('sell_price'), t('stock'), t('unit')]];
  products.forEach(p => rows.push([p.name, t('cat_'+p.category), p.buyPrice, p.sellPrice, p.stock, t('unit_'+p.unit)]));
  downloadCSV(rows, `products-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(t('saved'));
}

function exportSales() {
  const sales = DB.getSales();
  const rows = [[t('date'), t('product'), t('quantity'), t('unit_price'), t('total'), t('customer'), t('note')]];
  sales.forEach(s => rows.push([fmtDate(s.date), s.productName, s.quantity, s.unitPrice, s.total, s.customer||'', s.note||'']));
  downloadCSV(rows, `sales-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(t('saved'));
}

function exportPurchases() {
  const purchases = DB.getPurchases();
  const rows = [[t('date'), t('product'), t('quantity'), t('unit_price'), t('total'), t('supplier'), t('note')]];
  purchases.forEach(p => rows.push([fmtDate(p.date), p.productName, p.quantity, p.unitPrice, p.total, p.supplier||'', p.note||'']));
  downloadCSV(rows, `purchases-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(t('saved'));
}

function resetData() {
  showConfirm(t('settings_reset_confirm'), () => {
    DB.resetAll();
    showToast(t('settings_reset_done'));
    setTimeout(() => location.href = 'index.html', 1000);
  });
}

// ─── User Management ─────────────────────────────────────────────────────────
async function renderUserList() {
  const el = document.getElementById('user-list');
  if (!el) return;
  const session = Auth.getSession();
  el.innerHTML = '<div class="text-muted" style="padding:12px;">⏳ Loading...</div>';
  const users = await Auth.getUsers();
  el.innerHTML = users.map(u => `
    <div class="user-row">
      <div class="user-avatar-big">${u.displayName.slice(0,1).toUpperCase()}</div>
      <div class="user-info-col">
        <strong>${u.displayName}</strong>
        <span class="text-muted text-sm">@${u.username}</span>
      </div>
      <span class="badge ${u.role === 'admin' ? 'badge-success' : 'badge-warn'}">
        ${u.role === 'admin' ? '👑 Admin' : '👤 Staff'}
      </span>
      <div class="action-btns" style="margin-left:auto;">
        <button class="btn-icon btn-edit" onclick="openEditUser('${u.uid}')">✎</button>
        ${u.uid !== session?.userId ? `<button class="btn-icon btn-del" onclick="confirmDeleteUser('${u.uid}','${u.displayName}')">✕</button>` : '<span style="width:30px"></span>'}
      </div>
    </div>`).join('') || '<div class="no-data">No users found</div>';
}

function openAddUser() {
  if (!Auth.isAdmin()) { showToast('⚠ Admin only', 'error'); return; }
  const body = `
    <div class="form-grid">
      <div class="form-group">
        <label>${t('user_name_label')} *</label>
        <input type="text" id="fu-user" class="form-input" placeholder="username" autocapitalize="none">
      </div>
      <div class="form-group">
        <label>${t('user_display')} *</label>
        <input type="text" id="fu-display" class="form-input" placeholder="ឈ្មោះបង្ហាញ">
      </div>
      <div class="form-group">
        <label>${t('password')} *</label>
        <input type="password" id="fu-pass" class="form-input">
      </div>
      <div class="form-group">
        <label>${t('user_role')}</label>
        <select id="fu-role" class="form-input">
          <option value="staff">${t('role_staff')}</option>
          <option value="admin">${t('role_admin')}</option>
        </select>
      </div>
    </div>`;
  Modal.open(t('user_add'), body, async () => {
    const user    = document.getElementById('fu-user').value.trim();
    const display = document.getElementById('fu-display').value.trim();
    const pass    = document.getElementById('fu-pass').value;
    const role    = document.getElementById('fu-role').value;
    if (!user || !display || !pass) { showToast(t('fill_required'), 'error'); return; }
    const btn = document.getElementById('modal-save');
    btn.disabled = true; btn.textContent = '⏳ Creating...';
    const ok = await Auth.addUser(user, display, pass, role);
    btn.disabled = false; btn.textContent = t('save');
    if (!ok) { showToast('⚠ ឈ្មោះអ្នកប្រើនេះមានរួចហើយ ឬ មានបញ្ហា!', 'error'); return; }
    Modal.close(); showToast(t('saved')); renderUserList();
  });
}

async function openEditUser(uid) {
  if (!Auth.isAdmin()) { showToast('⚠ Admin only', 'error'); return; }
  const users = await Auth.getUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const body = `
    <div class="form-grid">
      <div class="form-group full">
        <label>${t('user_name_label')}</label>
        <input class="form-input" value="@${u.username}" disabled style="opacity:.6;">
      </div>
      <div class="form-group full">
        <label>${t('user_display')} *</label>
        <input type="text" id="fu-display" class="form-input" value="${u.displayName}">
      </div>
      <div class="form-group">
        <label>${t('user_role')}</label>
        <select id="fu-role" class="form-input">
          <option value="staff" ${u.role==='staff'?'selected':''}>${t('role_staff')}</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>${t('role_admin')}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${t('user_new_pass')}</label>
        <input type="password" id="fu-pass" class="form-input" placeholder="(ទុកចោលបើមិនផ្លាស់ប្តូរ)">
      </div>
    </div>`;
  Modal.open(t('user_edit'), body, () => {
    const display = document.getElementById('fu-display').value.trim();
    const role    = document.getElementById('fu-role').value;
    const pass    = document.getElementById('fu-pass').value;
    if (!display) { showToast(t('fill_required'), 'error'); return; }
    Auth.updateUser(uid, display, role, pass || null).then(() => {
        Modal.close(); showToast(t('saved')); renderUserList();
    });
  });
}

function confirmDeleteUser(uid, name) {
  showConfirm(`${t('confirm_delete')}\n"${name}"`, async () => {
    await Auth.deleteUser(uid);
    showToast(t('deleted')); renderUserList();
  });
}
