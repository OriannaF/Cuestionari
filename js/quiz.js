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

  function scoreFill(q, text) {
    const t = CSV.normText(text);
    if (!t) return 0;
    return q.correct.some((c) => CSV.normText(c) === t) ? 1 : -1;
  }

  function scoreDropdown(q, chosen) {
    const unit = 1 / q.slots.length;
    let s = 0;
    for (let i = 0; i < q.slots.length; i++) {
      const c = chosen == null ? null : chosen[i];
      if (c === q.correctSlot[i]) s += unit;
      else if (c != null) s -= unit;
    }
    return Math.round(s * 100000) / 100000;
  }

  function loadSettings() {
    const saved = Store.loadSettings();
    const size = parseInt(saved.sessionSize, 10);
    S.settings.size = size === 0 ? 0 : (isNaN(size) ? 20 : Math.min(1000, Math.max(1, size)));
    const pts = parseFloat(saved.points);
    S.settings.points = isNaN(pts) ? 1 : Math.max(0.05, pts);
    const modes = ["today", "random", "new", "failed", "all"];
    S.settings.mode = modes.includes(saved.mode) ? saved.mode : "today";
    const ed = String(saved.examDate || "").trim();
    S.settings.examDate = /^\d{4}-\d{2}-\d{2}$/.test(ed) && !isNaN(new Date(ed + "T00:00:00").getTime()) ? ed : "";
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
    Store.saveSettings({
      sessionSize: S.settings.size,
      points: S.settings.points,
      mode: S.settings.mode,
      examDate: S.settings.examDate
    });
  }

  function setSize(n) {
    const v = parseInt(n, 10);
    S.settings.size = v === 0 ? 0 : (isNaN(v) ? 20 : Math.min(1000, Math.max(1, v)));
    persistSettings();
  }

  function setMode(m) {
    S.settings.mode = ["today", "random", "new", "failed", "all"].includes(m) ? m : "today";
    persistSettings();
  }

  function setExamDate(iso) {
    const v = String(iso || "").trim();
    S.settings.examDate = /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + "T00:00:00").getTime()) ? v : "";
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
    buildFrom(() => Sched.buildByMode(S.questions, S.progress, S.settings.mode, S.settings.size, undefined, S.settings.points));
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

  function setSlot(qid, slot, optIdx) {
    const a = S.answers[qid] = S.answers[qid] || {};
    if (optIdx == null) delete a[slot];
    else a[slot] = optIdx;
    saveDraft();
  }

  function setFill(qid, text) {
    const v = String(text || "").trim();
    if (v) S.answers[qid] = v;
    else delete S.answers[qid];
    saveDraft();
  }

  const isAnswered = (qid) => {
    const a = S.answers[qid];
    if (!a) return false;
    if (typeof a === "string") return a.length > 0;
    return Array.isArray(a) ? a.length > 0 : Object.keys(a).length > 0;
  };
  const answeredCount = () => S.items.filter((it) => isAnswered(it.q.id)).length;

  function submit() {
    const pts = S.settings.points;
    const marked = { correct: [], partial: [], failed: [] };
    let total = 0;
    const cap = Math.max(4, Math.round(S.questions.length / 30));
    const schedCtx = { progress: S.progress, examDate: S.settings.examDate, cap };
    const detail = S.items.map((it) => {
      const q = it.q;
      const card = S.progress[q.id] || Sched.newCard();
      if (q.type === "dropdown") {
        const chosen = S.answers[q.id] || {};
        const score = scoreDropdown(q, chosen);
        const full = score + 1e-9 >= pts;
        S.progress[q.id] = Sched.update(card, score, full, Object.assign({ qid: q.id }, schedCtx));
        total += score;
        const state = full ? "correct" : (score > 1e-9 ? "partial" : "failed");
        marked[state].push(q.id);
        return { q, optOrder: [], slotChosen: chosen, score, state };
      }
      if (q.type === "fill") {
        const answer = typeof S.answers[q.id] === "string" ? S.answers[q.id] : "";
        const score = scoreFill(q, answer);
        const full = score + 1e-9 >= pts;
        S.progress[q.id] = Sched.update(card, score, full, Object.assign({ qid: q.id }, schedCtx));
        total += score;
        const state = full ? "correct" : (score > 1e-9 ? "partial" : "failed");
        marked[state].push(q.id);
        return { q, optOrder: [], fillAnswer: answer, score, state };
      }
      const dispChecked = (S.answers[q.id] || []).slice().sort((a, b) => a - b);
      const origChecked = dispChecked.map((d) => it.optOrder[d]);
      const score = scoreQuestion(q, origChecked);
      const full = score + 1e-9 >= pts;
      S.progress[q.id] = Sched.update(card, score, full, Object.assign({ qid: q.id }, schedCtx));
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

  function todayCount() {
    const t = Sched.startOfDay();
    return S.questions.filter((q) => {
      const c = S.progress[q.id];
      return !c || !c.due || Sched.isDue(c, t);
    }).length;
  }

  function newCount() {
    return S.questions.filter((q) => !S.progress[q.id]).length;
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
    S, loadCsv, tryLoadSaved, newSession, repeatSession, failedSession, toggle, setSlot, setFill,
    isAnswered, answeredCount, submit, tryResume, resetProgress,
    persistSettings, setSize, setPoints, setMode, setExamDate,
    stats, failedCount, todayCount, newCount, scoreQuestion
  };
})();

if (hasWindow) window.Quiz = Quiz;
if (typeof module !== "undefined" && module.exports) module.exports = Quiz;
})();