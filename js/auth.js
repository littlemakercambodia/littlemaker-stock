// ─── Auth System (Firebase) ────────────────────────────────────────────────────
const Auth = {
  SESSION_KEY: 'lm_session',
  SESSION_TTL:  8 * 60 * 60 * 1000, // 8 hours

  _email(username) {
    return username.trim().toLowerCase() + '@littlemaker.app';
  },

  hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return 'h' + Math.abs(h).toString(16);
  },

  getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(this.SESSION_KEY) || 'null');
      if (!s) return null;
      if (Date.now() > s.expiresAt) { this._clearSession(); return null; }
      return s;
    } catch { return null; }
  },
  _saveSession(profile, remember) {
    const session = {
      userId:      profile.uid,
      username:    profile.username,
      displayName: profile.displayName,
      role:        profile.role,
      businessId:  profile.businessId,
      loginAt:     Date.now(),
      expiresAt:   Date.now() + (remember ? 7 * 24 * 60 * 60 * 1000 : this.SESSION_TTL),
    };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return session;
  },
  _clearSession() { localStorage.removeItem(this.SESSION_KEY); },

  // Seed default admin in Firebase Auth (called once on login.html load)
  async seedDefaultUser() {
    const defaultUser = 'nangitclmk168';
    const defaultPass = 'Nangkh168$%';
    try {
      const cred = await firebase.auth().signInWithEmailAndPassword(
        this._email(defaultUser), defaultPass
      );
      await firebase.auth().signOut();
    } catch (e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' ||
          e.code === 'auth/invalid-login-credentials') {
        try {
          const cred = await firebase.auth().createUserWithEmailAndPassword(
            this._email(defaultUser), defaultPass
          );
          await firebase.firestore().collection('userProfiles').doc(cred.user.uid).set({
            uid:         cred.user.uid,
            businessId:  cred.user.uid,
            username:    defaultUser,
            displayName: 'Administrator',
            role:        'admin',
            createdAt:   new Date().toISOString(),
          });
          await firebase.auth().signOut();
        } catch (createErr) {
          console.warn('[Auth] seedDefaultUser create error:', createErr.message);
        }
      }
    }
  },

  async login(username, password, remember) {
    try {
      const cred = await firebase.auth().signInWithEmailAndPassword(
        this._email(username), password
      );
      const profileDoc = await firebase.firestore()
        .collection('userProfiles').doc(cred.user.uid).get();

      let profile;
      if (profileDoc.exists) {
        profile = profileDoc.data();
        if (profile.disabled) {
          await firebase.auth().signOut();
          return null;
        }
      } else {
        profile = {
          uid: cred.user.uid, businessId: cred.user.uid,
          username: username.trim().toLowerCase(),
          displayName: username, role: 'admin',
          createdAt: new Date().toISOString(),
        };
        await firebase.firestore().collection('userProfiles').doc(cred.user.uid).set(profile);
      }

      window._lmUserProfile = profile;
      window._lmBusinessId  = profile.businessId;

      return this._saveSession(profile, remember);
    } catch (e) {
      console.error('[Auth] Login error:', e.code);
      return null;
    }
  },

  async logout() {
    this._clearSession();
    try { await firebase.auth().signOut(); } catch (_) {}
    location.href = 'login.html';
  },

  async requireLogin() {
    const fbUser = await window.waitForAuth();
    if (!fbUser) { location.href = 'login.html'; return null; }
    let session = this.getSession();
    if (!session && window._lmUserProfile) {
      session = this._saveSession(window._lmUserProfile, false);
    }
    if (!session) { location.href = 'login.html'; return null; }
    return session;
  },

  isAdmin() {
    const s = this.getSession();
    return s && s.role === 'admin';
  },

  async getUsers() {
    if (!window._lmBusinessId) return [];
    try {
      const snap = await firebase.firestore()
        .collection('userProfiles')
        .where('businessId', '==', window._lmBusinessId)
        .get();
      return snap.docs.map(d => d.data()).filter(u => !u.disabled);
    } catch (e) { return []; }
  },

  async addUser(username, displayName, password, role) {
    if (!window._lmBusinessId) return false;
    try {
      const secondaryApp = firebase.initializeApp(
        firebase.app().options, 'lm_temp_' + Date.now()
      );
      const secondaryAuth = secondaryApp.auth();
      const cred = await secondaryAuth.createUserWithEmailAndPassword(
        this._email(username), password
      );
      const newUid = cred.user.uid;
      await secondaryAuth.signOut();
      await secondaryApp.delete();

      await firebase.firestore().collection('userProfiles').doc(newUid).set({
        uid: newUid, businessId: window._lmBusinessId,
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(), role,
        createdAt: new Date().toISOString(),
      });
      return true;
    } catch (e) {
      console.error('[Auth] addUser error:', e.code);
      return false;
    }
  },

  async updateUser(uid, displayName, role, newPassword) {
    try {
      await firebase.firestore().collection('userProfiles').doc(uid).update({ displayName: displayName.trim(), role });
      if (newPassword && firebase.auth().currentUser?.uid === uid) {
        await firebase.auth().currentUser.updatePassword(newPassword);
      }
      return true;
    } catch (e) { return false; }
  },

  async deleteUser(uid) {
    try {
      await firebase.firestore().collection('userProfiles').doc(uid).update({ disabled: true });
    } catch (e) { console.error('[Auth] deleteUser:', e); }
  },
};

// ─── Auth Guard (async) ────────────────────────────────────────────────────────
async function authGuard() {
  const session = await Auth.requireLogin();
  if (!session) return null;

  if (typeof DB !== "undefined") await DB.syncFromCloud();

  const userEl = document.getElementById('header-user');
  if (userEl) {
    userEl.innerHTML = `
      <div class="user-chip" id="user-chip">
        <span class="user-avatar">${session.displayName.slice(0, 1).toUpperCase()}</span>
        <span class="user-name">${session.displayName}</span>
        <span class="user-role-badge ${session.role}">${session.role === 'admin' ? '👑' : '👤'}</span>
      </div>`;
    document.getElementById('user-chip').addEventListener('click', showUserMenu);
  }
  return session;
}

function showUserMenu() {
  let menu = document.getElementById('user-menu');
  if (menu) { menu.remove(); return; }
  const session = Auth.getSession();
  menu = document.createElement('div');
  menu.id = 'user-menu';
  menu.className = 'user-menu';
  menu.innerHTML = `
    <div class="user-menu-header">
      <strong>${session.displayName}</strong>
      <span class="text-muted text-sm">@${session.username}</span>
      <span class="badge ${session.role === 'admin' ? 'badge-success' : 'badge-warn'}" style="margin-top:4px;">
        ${session.role === 'admin' ? '👑 Admin' : '👤 Staff'}
      </span>
    </div>
    <div class="user-menu-sep"></div>
    ${session.role === 'admin' ? '<a class="user-menu-item" href="settings.html#users">⚙️ User Management</a>' : ''}
    <a class="user-menu-item" onclick="openChangePassword()">🔒 Change Password</a>
    <div class="user-menu-sep"></div>
    <a class="user-menu-item danger" onclick="Auth.logout()">🚪 ${t('logout_btn')}</a>`;
  document.querySelector('.header-right').appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', function h(e) {
      if (!menu.contains(e.target) && e.target.id !== 'user-chip') {
        menu.remove(); document.removeEventListener('click', h);
      }
    });
  }, 50);
}

function openChangePassword() {
  document.getElementById('user-menu')?.remove();
  const body = `
    <div class="form-grid">
      <div class="form-group full"><label>លេខសម្ងាត់បច្ចុប្បន្ន</label>
        <input type="password" id="cp-old" class="form-input" placeholder="••••••••"></div>
      <div class="form-group full"><label>លេខសម្ងាត់ថ្មី</label>
        <input type="password" id="cp-new" class="form-input" placeholder="••••••••"></div>
      <div class="form-group full"><label>បញ្ជាក់លេខសម្ងាត់ថ្មី</label>
        <input type="password" id="cp-confirm" class="form-input" placeholder="••••••••"></div>
    </div>`;
  Modal.open('🔒 ផ្លាស់ប្តូរលេខសម្ងាត់', body, async () => {
    const oldPw = document.getElementById('cp-old').value;
    const newPw = document.getElementById('cp-new').value;
    const cfmPw = document.getElementById('cp-confirm').value;
    if (!oldPw || !newPw || !cfmPw) { showToast(t('fill_required'), 'error'); return; }
    if (newPw !== cfmPw) { showToast('⚠ លេខសម្ងាត់មិនត្រូវគ្នា!', 'error'); return; }
    try {
      const user = firebase.auth().currentUser;
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, oldPw);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(newPw);
      Modal.close();
      showToast('✓ ផ្លាស់ប្តូរលេខសម្ងាត់ជោគជ័យ!');
    } catch (_) {
      showToast('⚠ លេខសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវ!', 'error');
    }
  });
}
