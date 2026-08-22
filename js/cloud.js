"use strict";

/*
 * Sincronización en la nube (Firebase Auth + Firestore).
 *
 * Para activarla:
 * 1. Creá un proyecto gratis en https://console.firebase.google.com
 * 2. Authentication → Sign-in method → habilitá "Google".
 * 3. Firestore Database → crear base → modo producción.
 * 4. Reglas sugeridas:
 *      rules_version = '2';
 *      service cloud.firestore {
 *        match /databases/{database}/documents {
 *          match /users/{uid} {
 *            allow read, write: if request.auth != null && request.auth.uid == uid;
 *          }
 *        }
 *      }
 * 5. Project settings → Tus apps → Web → copiá los valores de config acá abajo.
 *
 * Sin configurar, la app funciona igual y el botón de cuenta explica estos pasos.
 */

(function () {
  const Cloud = (() => {
    const SDK_BASE = "https://www.gstatic.com/firebasejs/10.12.2";
    const FIREBASE_CONFIG = {
      apiKey: "PONÉ_TU_API_KEY",
      authDomain: "TU-PROYECTO.firebaseapp.com",
      projectId: "TU-PROYECTO",
      storageBucket: "TU-PROYECTO.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:xxxxxxxxxxxxxxxx"
    };

    const isConfigured = () =>
      !!FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.indexOf("PONÉ") !== 0;

    let fb = null;
    let user = null;
    let pushTimer = null;
    let storeUnsub = null;
    let started = false;
    const cbs = [];
    const emit = () => cbs.forEach((fn) => { try { fn(user); } catch (e) {} });

    const encKey = (k) => String(k).replace(/\./g, "__");
    const decKey = (k) => String(k).replace(/__/g, ".");

    function loadSdk() {
      return new Promise((resolve, reject) => {
        if (typeof window.firebase === "object" && window.firebase.firestore) return resolve(window.firebase);
        const files = ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"];
        let pending = files.length;
        let failed = false;
        files.forEach((f) => {
          const s = document.createElement("script");
          s.src = `${SDK_BASE}/${f}`;
          s.async = true;
          s.onload = () => { if (--pending === 0 && !failed) resolve(window.firebase); };
          s.onerror = () => {
            failed = true;
            reject(new Error("No se pudieron descargar los SDK de Firebase."));
          };
          document.head.appendChild(s);
        });
      });
    }

    function initFb(firebase) {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      fb = firebase;
    }

    function mergeSnap(local, remote) {
      const rk = remote && remote.kv ? remote.kv : {};
      const rt = remote && remote.times ? remote.times : {};
      const outKv = {};
      const outTimes = {};
      const keys = new Set(Object.keys(local.kv).concat(Object.keys(rk)));
      keys.forEach((ek) => {
        const hasL = Object.prototype.hasOwnProperty.call(local.kv, ek);
        const hasR = Object.prototype.hasOwnProperty.call(rk, ek);
        if (hasL && !hasR) { outKv[ek] = local.kv[ek]; outTimes[ek] = local.times[ek] || 0; }
        else if (!hasL && hasR) { outKv[ek] = rk[ek]; outTimes[ek] = rt[ek] || 0; }
        else if ((rt[ek] || 0) > (local.times[ek] || 0)) { outKv[ek] = rk[ek]; outTimes[ek] = rt[ek] || 0; }
        else { outKv[ek] = local.kv[ek]; outTimes[ek] = local.times[ek] || 0; }
      });
      return { kv: outKv, times: outTimes };
    }

    function docFromSnap(snap, savedAt) {
      const kv = {}, times = {};
      Object.keys(snap.kv).forEach((k) => {
        kv[encKey(k)] = snap.kv[k];
        times[encKey(k)] = snap.times[k] || savedAt;
      });
      return { kv, times, savedAt };
    }

    async function pushNow() {
      if (!fb || !user) return;
      try {
        const snap = window.QuizStore.snapshot();
        await fb.firestore().collection("users").doc(user.uid)
          .set(docFromSnap(snap, Date.now()));
      } catch (e) {}
    }

    function schedulePush() {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => { pushTimer = null; pushNow(); }, 2500);
    }

    function flush() { if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; pushNow(); } }

    async function pullMergeAndPush() {
      if (!fb || !user) return;
      try {
        const ref = fb.firestore().collection("users").doc(user.uid);
        const doc = await ref.get();
        const local = window.QuizStore.snapshot();
        if (doc.exists) {
          const d = doc.data() || {};
          const remote = { kv: d.kv || {}, times: d.times || {} };
          const merged = mergeSnap(local, remote);
          window.QuizStore.restore(merged.kv);
          await ref.set(docFromSnap(merged, Date.now()));
        } else {
          await ref.set(docFromSnap(local, Date.now()));
        }
        emit();
      } catch (e) {
        emit();
      }
    }

    function startSession(u) {
      user = u ? { uid: u.uid, name: u.displayName || "" } : null;
      if (!user) { emit(); return; }
      try { localStorage.setItem("quiz.cloud.wasIn", "1"); } catch (e) {}
      pullMergeAndPush().then(() => {
        if (user && !storeUnsub) storeUnsub = window.QuizStore.onChange(schedulePush);
      });
      emit();
    }

    function stopSession() {
      user = null;
      if (storeUnsub) { storeUnsub(); storeUnsub = null; }
      if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
      try { localStorage.removeItem("quiz.cloud.wasIn"); } catch (e) {}
      emit();
    }

    function signIn() {
      return loadSdk().then((firebase) => {
        initFb(firebase);
        fb.auth().onAuthStateChanged((u) => {
          if (u && (!user || user.uid !== u.uid)) startSession(u);
          else if (!u && user) stopSession();
        });
        const provider = new fb.auth.GoogleAuthProvider();
        return fb.auth().signInWithPopup(provider);
      }).then((cred) => {
        if (cred && cred.user) startSession({ uid: cred.user.uid, name: cred.user.displayName || "" });
      });
    }

    function signOut() {
      if (!fb) return Promise.resolve();
      return fb.auth().signOut().catch(() => {});
    }

    function init() {
      if (started || !isConfigured()) return;
      started = true;
      let wasIn = false;
      try { wasIn = localStorage.getItem("quiz.cloud.wasIn") === "1"; } catch (e) {}
      if (!wasIn) return;
      loadSdk().then((firebase) => {
        initFb(firebase);
        fb.auth().onAuthStateChanged((u) => {
          if (u) startSession(u); else emit();
        });
      }).catch(() => {});
    }

    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
    window.addEventListener("beforeunload", flush);

    return {
      isConfigured, init, signIn, signOut,
      user: () => user,
      onChange: (fn) => { if (typeof fn === "function") cbs.push(fn); }
    };
  })();

  if (typeof window !== "undefined") window.Cloud = Cloud;
})();
