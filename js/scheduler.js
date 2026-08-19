"use strict";

(function () {
const Scheduler = (() => {
  const DAY_MS = 86400000;
  const startOfDay = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const daysFromNow = (n) => {
    const d = startOfDay();
    d.setDate(d.getDate() + n);
    return d.toISOString();
  };
  const dayKey = (iso) => (iso ? String(iso).slice(0, 10) : "");
  const daysUntil = (iso, now) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return Infinity;
    const a = (now || startOfDay()).getTime();
    return Math.max(0, Math.round((d.getTime() - a) / DAY_MS));
  };

  const countByDay = (progress, skipId) => {
    const m = new Map();
    for (const [id, c] of Object.entries(progress || {})) {
      if (skipId != null && String(id) === String(skipId)) continue;
      if (c && c.due) {
        const k = dayKey(c.due);
        m.set(k, (m.get(k) || 0) + 1);
      }
    }
    return m;
  };

  function newCard() {
    return { reps: 0, ease: 2.5, interval: 0, due: null, fails: 0, attempts: 0, sum: 0, last: null };
  }

  function isDue(card, now) {
    if (!card || !card.due) return true;
    const d = new Date(card.due);
    return isNaN(d.getTime()) || d <= now;
  }

  function update(card, score, full, ctx) {
    const c = Object.assign(newCard(), card || {});
    c.attempts += 1;
    c.sum = (c.sum || 0) + score;
    c.last = score;
    let interval;
    if (full) {
      c.reps += 1;
      c.ease = Math.min(2.6, c.ease + 0.05);
      interval = c.reps <= 1 ? 1 : (c.reps === 2 ? 2 : Math.min(90, Math.round(c.interval * c.ease)));
    } else {
      c.reps = 0;
      c.fails += 1;
      c.ease = Math.max(1.3, c.ease - 0.2);
      interval = 1;
    }
    const ctx2 = ctx || {};
    const remaining = ctx2.examDate ? daysUntil(ctx2.examDate) : Infinity;
    if (Number.isFinite(remaining)) interval = Math.min(interval, remaining);
    const counts = countByDay(ctx2.progress, ctx2.qid);
    const cap = Math.max(1, ctx2.cap || 4);
    let guard = 0;
    while (interval > 0 && interval < remaining && guard++ < 60 && (counts.get(dayKey(daysFromNow(interval))) || 0) >= cap) {
      interval += 1;
    }
    c.interval = interval;
    c.due = daysFromNow(interval);
    return c;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  const weakSort = (progress) => (a, b) => {
    const ca = progress[a] || newCard();
    const cb = progress[b] || newCard();
    return (ca.ease - cb.ease) || (cb.fails - ca.fails);
  };

  function makeItem(q) {
    return { q, optOrder: shuffle(q.options.map((_, i) => i)) };
  }

  const splitPools = (questions, progress, now) => {
    const t = now || startOfDay();
    const unseen = [], due = [], rest = [];
    for (const q of questions) {
      const card = progress[q.id];
      if (isDue(card, t)) {
        if (card && card.due) due.push(q.id);
        else unseen.push(q.id);
      } else {
        rest.push(q.id);
      }
    }
    return { unseen, due, rest };
  };

  function buildSession(questions, progress, size, now) {
    const { unseen, due, rest } = splitPools(questions, progress, now);
    const pool = [].concat(
      unseen.sort(weakSort(progress)),
      due.sort(weakSort(progress)),
      rest.sort(weakSort(progress))
    );
    const n = size > 0 ? Math.min(size, pool.length) : pool.length;
    return shuffle(pool.slice(0, n)).map((qid) => makeItem(questions[qid]));
  }

  function buildFailedSession(questions, progress, size, fullPoints) {
    const ids = questions.filter((q) => {
      const c = progress[q.id];
      return c && c.last !== undefined && c.last < fullPoints - 1e-9;
    }).map((q) => q.id);
    const n = size > 0 ? Math.min(size, ids.length) : ids.length;
    return shuffle(ids.sort(weakSort(progress)).slice(0, n)).map((qid) => makeItem(questions[qid]));
  }

  function buildByMode(questions, progress, mode, size, now, fullPoints) {
    const { unseen, due, rest } = splitPools(questions, progress, now);
    const qidToItem = (qid) => makeItem(questions[qid]);
    const cap = (ids) => {
      const n = size > 0 ? Math.min(size, ids.length) : ids.length;
      return shuffle(ids.slice(0, n)).map(qidToItem);
    };
    switch (mode) {
      case "new":
        return cap(unseen.sort(weakSort(progress)));
      case "today": {
        const pool = [].concat(unseen, due).sort(weakSort(progress));
        return cap(pool);
      }
      case "failed":
        return buildFailedSession(questions, progress, size, fullPoints == null ? 1 : fullPoints, now);
      case "all":
        return cap([].concat(unseen, due, rest).sort(weakSort(progress)));
      case "random":
      default:
        return buildSession(questions, progress, size, now);
    }
  }

  return {
    newCard, isDue, update, shuffle, makeItem, buildSession, buildFailedSession, buildByMode,
    startOfDay, daysUntil, splitPools
  };
})();

if (typeof window !== "undefined") window.Scheduler = Scheduler;
if (typeof module !== "undefined" && module.exports) module.exports = Scheduler;
})();