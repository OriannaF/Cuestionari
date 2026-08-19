"use strict";

(function () {
const Scheduler = (() => {
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

  function newCard() {
    return { reps: 0, ease: 2.5, interval: 0, due: null, fails: 0, attempts: 0, sum: 0, last: null };
  }

  function isDue(card, now) {
    if (!card || !card.due) return true;
    const d = new Date(card.due);
    return isNaN(d.getTime()) || d <= now;
  }

  function update(card, score, full) {
    const c = Object.assign(newCard(), card || {});
    c.attempts += 1;
    c.sum = (c.sum || 0) + score;
    c.last = score;
    if (full) {
      c.reps += 1;
      c.ease = Math.min(2.6, c.ease + 0.05);
      c.interval = c.reps <= 1 ? 1 : (c.reps === 2 ? 2 : Math.min(90, Math.round(c.interval * c.ease)));
    } else {
      c.reps = 0;
      c.fails += 1;
      c.ease = Math.max(1.3, c.ease - 0.2);
      c.interval = 1;
    }
    c.due = daysFromNow(c.interval);
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

  function buildSession(questions, progress, size, now) {
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

  return {
    newCard, isDue, update, shuffle, makeItem, buildSession, buildFailedSession, startOfDay
  };
})();

if (typeof window !== "undefined") window.Scheduler = Scheduler;
if (typeof module !== "undefined" && module.exports) module.exports = Scheduler;
})();