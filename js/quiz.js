"use strict";

(function () {
const hasWindow = typeof window !== "undefined";
const CSV = hasWindow ? window.CSV : require("./csv.js");
const Sched = hasWindow ? window.Scheduler : require("./scheduler.js");
const Store = hasWindow ? window.QuizStore : require("./storage.js");

const Quiz = (() => {
  const S = {
    questions: [],
    progress: {},
    settings: { size: 20, points: 1 },
    hash: "",
    name: "",
    items: [],
    answers: {},
    results: null,
    sourceText: "",
    warnings: []
  };

  function scoreQuestion(q, checkedOrig) {
    const c = q.correct.length;
    const unit = 1 / c;
    let s = 0;
    for (const i of checkedOrig) s += q.correct.indexOf(i) >= 0 ? unit : -unit;
    return Math.round(s * 100000) / 100000;
  }

  function loadSettings() {
    const saved = Store.loadSettings();
    const size = parseInt(saved.sessionSize, 10);
    S.settings.size = size === 0 ? 0 : (isNaN(size) ? 20 : Math.min(200, Math.max(1, size)));
    const pts = parseFloat(saved.points);
    S.settings.points = isNaN(pts) ? 1 : Math.max(0.05, pts);
  }

  function loadCsv(text, name) {
    const res = CSV.parseQuestions(text);
    if (!res.ok) return res;
    S.sourceText = text;
    S.hash = Store.hash(text);
    S.name = name || "Cuestionario";
    S.questions = res.questions;
    S.warnings = res.warnings || [];
    S.progress = Store.loadProgress(S.hash);
    S.items = [];
    S.answers = {};
    S.results = null;
    loadSettings();
    Store.saveLastCsv({ text, name });
    return res;
  }

  function tryLoadSaved() {
    const saved = Store.loadLastCsv();
    if (!saved || !String(saved.text || "").trim()) return false;
    if (!CSV.parseQuestions(saved.text).ok) return false;
    loadCsv(saved.text, saved.name || "Cuestionario guardado");
    return true;
  }

  function persistSettings() {
    Store.saveSettings({ sessionSize: S.settings.size, points: S.settings.points });
  }

  function setSize(n) {
    const v = parseInt(n, 10);
    S.settings.size = v === 0 ? 0 : (isNaN(v) ? 20 : Math.min(200, Math.max(1, v)));
    persistSettings();
  }

  function setPoints(p) {
    S.settings.points = Math.max(0.05, parseFloat(p) || 1);
    persistSettings();
  }

  function buildFrom(fn) {
    S.items = fn();
    S.answers = {};
    S.results = null;
    saveDraft();
  }

  function newSession() {
    buildFrom(() => Sched.buildSession(S.questions, S.progress, S.settings.size));
  }

  function repeatSession(lastIds) {
    const ids = (lastIds && lastIds.length ? lastIds : S.items.map((it) => it.q.id));
    buildFrom(() => Sched.shuffle(ids).map((qid) => Sched.makeItem(S.questions[qid])));
  }

  function failedSession() {
    buildFrom(() => Sched.buildFailedSession(S.questions, S.progress, S.settings.size, S.settings.points));
  }

  function toggle(qid, dispIdx) {
    S.answers[qid] = S.answers[qid] || [];
    const i = S.answers[qid].indexOf(dispIdx);
    if (i >= 0) S.answers[qid].splice(i, 1);
    else S.answers[qid].push(dispIdx);
    saveDraft();
  }

  const isAnswered = (qid) => (S.answers[qid] || []).length > 0;
  const answeredCount = () => S.items.filter((it) => isAnswered(it.q.id)).length;

  function submit() {
    const pts = S.settings.points;
    const marked = { correct: [], partial: [], failed: [] };
    let total = 0;
    const detail = S.items.map((it) => {
      const q = it.q;
      const dispChecked = (S.answers[q.id] || []).slice().sort((a, b) => a - b);
      const origChecked = dispChecked.map((d) => it.optOrder[d]);
      const score = scoreQuestion(q, origChecked);
      const full = score + 1e-9 >= pts;
      S.progress[q.id] = Sched.update(S.progress[q.id] || Sched.newCard(), score, full);
      total += score;
      const state = full ? "correct" : (score > 1e-9 ? "partial" : "failed");
      marked[state].push(q.id);
      return { q, optOrder: it.optOrder, dispChecked, origChecked, score, state };
    });
    S.results = { detail, total, max: S.items.length * pts, pts, marked };
    Store.saveProgress(S.hash, S.progress);
    Store.clearDraft(S.hash);
    return S.results;
  }

  function saveDraft() {
    Store.saveDraft(S.hash, {
      items: S.items.map((it) => ({ idx: it.q.id, order: it.optOrder })),
      answers: S.answers
    });
  }

  function tryResume() {
    const d = Store.loadDraft(S.hash);
    if (!d || !Array.isArray(d.items)) return false;
    const items = [];
    for (const m of d.items) {
      const q = S.questions[m.idx];
      if (!q) return false;
      items.push({
        q,
        optOrder: Array.isArray(m.order) && m.order.length === q.options.length ? m.order : q.options.map((_, i) => i)
      });
    }
    S.items = items;
    S.answers = d.answers || {};
    S.results = null;
    return S.items.length > 0;
  }

  function resetProgress() {
    Store.resetProgress(S.hash);
    Store.clearDraft(S.hash);
    S.progress = {};
    S.items = [];
    S.answers = {};
    S.results = null;
  }

  function failedCount() {
    const pts = S.settings.points;
    return S.questions.filter((q) => {
      const c = S.progress[q.id];
      return c && c.last !== undefined && c.last < pts - 1e-9;
    }).length;
  }

  function stats() {
    const pts = S.settings.points;
    const t = Sched.startOfDay();
    let unseen = 0, due = 0, mastered = 0, failed = 0;
    const cats = new Map();
    for (const q of S.questions) {
      const c = S.progress[q.id];
      if (c && c.reps >= 3) mastered++;
      if (c && c.fails > 0) failed++;
      if (!c || !c.due) unseen++;
      else if (Sched.isDue(c, t)) due++;
      const key = q.category || "Sin categoría";
      if (!cats.has(key)) cats.set(key, { count: 0, attempts: 0, sum: 0, failed: 0 });
      const cat = cats.get(key);
      cat.count++;
      if (c) {
        cat.attempts += c.attempts;
        cat.sum += c.sum || 0;
        cat.failed += c.fails;
      }
    }
    return { total: S.questions.length, unseen, due, mastered, failed, cats, points: pts };
  }

  return {
    S, loadCsv, tryLoadSaved, newSession, repeatSession, failedSession, toggle,
    isAnswered, answeredCount, submit, tryResume, resetProgress,
    persistSettings, setSize, setPoints, stats, failedCount, scoreQuestion
  };
})();

if (hasWindow) window.Quiz = Quiz;
if (typeof module !== "undefined" && module.exports) module.exports = Quiz;
})();