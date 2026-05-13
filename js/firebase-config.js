// ─── Firebase Configuration ────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBlwY35I4OcrDErvn01zCGZrlEI9Cosv3Y",
  authDomain: "littlemaker-stock.firebaseapp.com",
  projectId: "littlemaker-stock",
  storageBucket: "littlemaker-stock.firebasestorage.app",
  messagingSenderId: "1011886178735",
  appId: "1:1011886178735:web:e64757e9001b0cd803ef5a"
};

// Initialize primary Firebase app (guard against double-init on page reload)
if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ─── Global auth state ─────────────────────────────────────────────────────────
window._lmFbUser      = null;   // Firebase Auth user object
window._lmAuthReady   = false;  // true once onAuthStateChanged fires at least once
window._lmBusinessId  = null;   // Firestore path for this business's data
window._lmUserProfile = null;   // { displayName, role, username, businessId }

// ─── Watch auth state ──────────────────────────────────────────────────────────
firebase.auth().onAuthStateChanged(async (user) => {
  window._lmFbUser = user;

  if (user) {
    try {
      const doc = await firebase.firestore()
        .collection('userProfiles')
        .doc(user.uid)
        .get();

      if (doc.exists) {
        window._lmUserProfile = doc.data();
        window._lmBusinessId  = doc.data().businessId || user.uid;
      } else {
        // First-time admin: create profile automatically
        const profile = {
          uid:         user.uid,
          businessId:  user.uid,
          username:    user.email.replace('@littlemaker.app', ''),
          displayName: 'Administrator',
          role:        'admin',
          createdAt:   new Date().toISOString(),
        };
        await firebase.firestore()
          .collection('userProfiles')
          .doc(user.uid)
          .set(profile);
        window._lmUserProfile = profile;
        window._lmBusinessId  = user.uid;
      }
    } catch (e) {
      console.error('[Firebase] Profile load error:', e);
    }
  } else {
    window._lmBusinessId  = null;
    window._lmUserProfile = null;
  }

  window._lmAuthReady = true;
  document.dispatchEvent(new CustomEvent('lm-auth-ready', { detail: user }));
});

// ─── Helper: wait for auth state to resolve ────────────────────────────────────
window.waitForAuth = function () {
  return new Promise(resolve => {
    if (window._lmAuthReady) return resolve(window._lmFbUser);
    document.addEventListener('lm-auth-ready', e => resolve(e.detail), { once: true });
  });
};
