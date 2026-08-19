"use strict";

(function () {
const QuizStore = (() => {
  const mem = {};
  const store = typeof localStorage !== "undefined" ? localStorage : {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  };
  const PREFIX = "quiz.progress.";

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  const get = (k, def) => {
    try {
      const v = store.getItem(k);
      return v ? JSON.parse(v) : def;
    } catch (e) { return def; }
  };
  const set = (k, v) => {
    try { store.setItem(k, JSON.stringify(v)); } catch (e) { }
  };
  const remove = (k) => {
    try { store.removeItem(k); } catch (e) { }
  };

  function loadProgress(h) { return get(PREFIX + h, {}); }
  function saveProgress(h, p) { set(PREFIX + h, p); }
  function resetProgress(h) { remove(PREFIX + h); }

  function loadSettings() { return get("quiz.settings", {}); }
  function saveSettings(s) { set("quiz.settings", s); }

  function loadDraft(h) { return get("quiz.draft." + h, null); }
  function saveDraft(h, d) { set("quiz.draft." + h, d); }
  function clearDraft(h) { remove("quiz.draft." + h); }

  return {
    hash, loadProgress, saveProgress, resetProgress,
    loadSettings, saveSettings, loadDraft, saveDraft, clearDraft
  };
})();

if (typeof window !== "undefined") window.QuizStore = QuizStore;
if (typeof module !== "undefined" && module.exports) module.exports = QuizStore;
})();