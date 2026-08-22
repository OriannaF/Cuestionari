"use strict";

(function () {
  const Quiz = window.Quiz;
  const S = () => Quiz.S;
  const $ = (sel) => document.querySelector(sel);
  let warningsDismissed = false;

  const esc = (v) => String(v == null ? "" : v)
    .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rich = (v) => String(v == null ? "" : v)
    .split(/(!\[[^\]]*\]\([^)]*\))/g)
    .map((p) => {
      const m = /^!\[([^\]]*)\]\(([^)]*)\)$/.exec(p);
      if (!m) return esc(p);
      const s = (m[2] || "").trim();
      if (/^(?:javascript|vbscript):/i.test(s)) return esc(p);
      if (/^data:/i.test(s) && !/^data:image\//i.test(s)) return esc(p);
      return ` <img class="qimg" src="${esc(s)}" alt="${esc((m[1] || "").trim())}" loading="lazy"> `;
    })
    .join("");
  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("es", { maximumFractionDigits: 2 });
  const LETTERS = "ABCDEFGHIJ";
  const stat = (cls, num, lbl) => `<div class="stat"><div class="num ${cls}">${num}</div><div class="lbl">${lbl}</div></div>`;

  const POMO_DEFAULT = { study: 25, short: 5, long: 15 };
  let pomo = { phase: "study", remaining: POMO_DEFAULT.study * 60, running: false, doneCount: 0, timer: null };
  let pomoCfg = { ...POMO_DEFAULT };

  function pomoLoad() {
    try {
      const raw = JSON.parse(localStorage.getItem("quiz.pomo") || "{}");
      ["study", "short", "long"].forEach((k) => {
        const v = parseInt(raw[k], 10);
        if (v >= 1 && v <= 150) pomoCfg[k] = v;
      });
    } catch (e) {}
  }
  function pomoSave() {
    try { localStorage.setItem("quiz.pomo", JSON.stringify(pomoCfg)); } catch (e) {}
  }
  const pomoDur = (ph) => (pomoCfg[ph === "study" ? "study" : ph] || POMO_DEFAULT[ph]) * 60;
  const pomoLabel = () => ({ study: "Estudio", short: "Pausa", long: "Pausa larga" })[pomo.phase];

  function pomoBeep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      [0, 0.22, 0.44].forEach((t) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.2);
      });
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, 900);
    } catch (e) {}
  }

  function pomoNextPhase() {
    if (pomo.phase === "study") {
      pomo.doneCount++;
      return pomo.doneCount % 4 === 0 ? "long" : "short";
    }
    return "study";
  }

  function pomoRender() {
    const box = document.getElementById("pomo");
    const timeEl = document.getElementById("pomo-time");
    const playEl = document.getElementById("pomo-play");
    const dotsEl = document.getElementById("pomo-dots");
    if (!box || !timeEl || !playEl || !dotsEl) return;
    const m = Math.floor(pomo.remaining / 60);
    const s = pomo.remaining % 60;
    timeEl.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    timeEl.title = pomoLabel();
    playEl.querySelector(".material-symbols-outlined").textContent = pomo.running ? "pause" : "play_arrow";
    playEl.title = pomo.running ? "Pausar" : "Iniciar";
    box.classList.toggle("running", pomo.running);
    box.classList.toggle("break", pomo.phase !== "study");
    box.classList.toggle("study", pomo.phase === "study");
    let dots = "";
    for (let i = 0; i < 4; i++) dots += `<span class="pomo-dot ${i < pomo.doneCount % 4 ? "done" : ""}"></span>`;
    dotsEl.innerHTML = dots;
  }

  function pomoTick() {
    pomo.remaining--;
    if (pomo.remaining > 0) { pomoRender(); return; }
    clearInterval(pomo.timer);
    pomo.timer = null;
    pomo.running = false;
    pomo.remaining = pomoDur(pomo.phase);
    pomo.phase = pomoNextPhase();
    pomo.remaining = pomoDur(pomo.phase);
    pomoBeep();
    toast(`Pomodoro: ${pomoLabel()} — apretá play cuando estés listo`);
    pomoRender();
    document.getElementById("pomo").classList.add("done");
  }

  function initPomodoro() {
    pomoLoad();
    pomo.remaining = pomoDur("study");
    const box = document.getElementById("pomo");
    if (!box) return;
    document.getElementById("pomo-play").addEventListener("click", () => {
      box.classList.remove("done");
      pomo.running = !pomo.running;
      if (pomo.running) {
        pomo.timer = setInterval(pomoTick, 1000);
      } else if (pomo.timer) {
        clearInterval(pomo.timer);
        pomo.timer = null;
      }
      pomoRender();
    });
    document.getElementById("pomo-reset").addEventListener("click", () => {
      if (pomo.timer) { clearInterval(pomo.timer); pomo.timer = null; }
      pomo.running = false;
      pomo.remaining = pomoDur(pomo.phase);
      box.classList.remove("done");
      pomoRender();
    });
    const panel = document.getElementById("pomo-panel");
    document.getElementById("pomo-cfg").addEventListener("click", (e) => {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        document.getElementById("pomo-study").value = pomoCfg.study;
        document.getElementById("pomo-short").value = pomoCfg.short;
        document.getElementById("pomo-long").value = pomoCfg.long;
      }
    });
    panel.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => { panel.hidden = true; });
    [["pomo-study", "study"], ["pomo-short", "short"], ["pomo-long", "long"]].forEach(([id, key]) => {
      document.getElementById(id).addEventListener("change", (e) => {
        const v = parseInt(e.target.value, 10);
        if (!(v >= 1 && v <= 150)) return;
        pomoCfg[key] = v;
        pomoSave();
        if (!pomo.running) {
          pomo.remaining = pomoDur(pomo.phase);
          document.getElementById("pomo").classList.remove("done");
          pomoRender();
        }
      });
    });
    pomoRender();
  }

  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    let close = el.querySelector(".toast-close");
    if (!close) {
      close = document.createElement("button");
      close.className = "toast-close";
      close.addEventListener("click", () => {
        el.classList.remove("show");
        clearTimeout(el._t);
      });
    }
    close.textContent = "✕";
    el.appendChild(close);
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 3200);
  }

  const BUNDLED_NAME = "Final ADS";

function loadSource() {
    const loadOne = (url, name) =>
      fetch(url)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error("no file"))))
        .then((txt) => {
          if (!txt.trim()) return { ok: false, skipped: true };
          const res = Quiz.loadCsv(txt, name);
          if (res.ok && S().warnings.length) S().warnings = [];
          return res.ok ? { ok: true } : { ok: false, errors: res.errors };
        })
        .catch(() => ({ ok: false, skipped: true }));

    return Promise.all([
      loadOne("data/cuestionario.csv", "Final ADS"),
      loadOne("data/cuestionario Borboleto.csv", "Borboleto")
    ]).then(([r1, r2]) => {
      if (S().questionnaires.length > 0) return { ok: true, loaded: true };
      if (r1.errors) return { ok: false, errors: r1.errors };
      if (r2.errors) return { ok: false, errors: r2.errors };
      return Quiz.tryLoadSaved()
        ? { ok: true, loaded: true }
        : { ok: true, loaded: false };
    });
  }

  function initCloudUI() {
    const btn = document.getElementById("cloud-btn");
    if (!btn) return;
    const Cloud = window.Cloud;
    const ic = document.getElementById("cloud-ic");
    const label = document.getElementById("cloud-label");
    const paint = () => {
      const u = Cloud && Cloud.user();
      if (ic) ic.textContent = u ? "cloud_done" : "account_circle";
      if (label) label.textContent = u ? (u.name || "Cuenta") : "Entrar";
      btn.title = u ? "Sincronizado · clic para cerrar sesión" : "Iniciar sesión y sincronizar progreso";
    };
    btn.addEventListener("click", () => {
      if (!Cloud || !Cloud.isConfigured()) {
        toast("Sync sin configurar: creá un proyecto gratis en Firebase y pegá las claves en js/cloud.js");
        return;
      }
      if (Cloud.user()) {
        if (confirm("¿Cerrar sesión en este dispositivo? Tu progreso queda guardado en la nube.")) Cloud.signOut().then(paint);
        return;
      }
      toast("Abriendo Google…");
      Cloud.signIn().then(() => { paint(); }).catch(() => toast("No se pudo iniciar sesión. Revisá tu conexión o la config de Firebase."));
    });
    if (Cloud) Cloud.onChange(paint);
    paint();
  }

  function init() {
    const tt = document.getElementById("theme-toggle");
    if (tt) tt.addEventListener("click", () => {
      const el = document.documentElement;
      const dark = el.classList.toggle("dark");
      el.classList.toggle("light", !dark);
      try { localStorage.setItem("quiz.theme", dark ? "dark" : "light"); } catch (e) {}
    });
    initPomodoro();
    initCloudUI();
    loadSource().then((r) => {
      if (r.loaded) {
        warningsDismissed = false;
        renderHome();
      } else if (r.errors) {
        renderLoadError(r.errors);
      } else {
        renderUpload();
      }
    });
  }

  function view(html) {
    $("#app").innerHTML = `<div class="view">${html}</div>`;
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const res = Quiz.loadCsv(String(reader.result), file.name);
      if (res.ok) {
        warningsDismissed = false;
        renderHome();
        toast(`Cuestionario cargado: ${S().questions.length} preguntas`);
      } else {
        renderLoadError(res.errors);
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function bindUpload(zoneId, fileId) {
    const dz = document.getElementById(zoneId);
    const input = document.getElementById(fileId);
    if (!dz || !input) return;
    dz.addEventListener("click", () => input.click());
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("hover"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("hover"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("hover");
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readFile(f);
    });
    input.addEventListener("change", () => {
      if (input.files[0]) readFile(input.files[0]);
      input.value = "";
    });
  }

  function renderUpload() {
    view(`
      <div class="card center">
        <h2>Cargar un cuestionario</h2>
        <p class="muted">Subí un archivo CSV con las preguntas. Cada pregunta admite hasta 8 opciones y varias respuestas correctas.</p>
        <div class="dropzone" id="dropzone">
          <div class="dz-title">Arrastrá el CSV acá o hacé clic para elegirlo</div>
          <div class="muted small">Máximo 1000 preguntas · una fila por pregunta · delimitador , o ; (se detecta solo)</div>
        </div>
        <input type="file" id="file" accept=".csv,text/csv,text/plain" hidden>
      </div>
    `);
    bindUpload("dropzone", "file");
  }

  function renderLoadError(errors) {
    view(`
      <div class="card">
        <h2>No se pudo cargar el cuestionario</h2>
        <div class="error-list">${errors.map((e) => `<div class="error-item">${esc(e)}</div>`).join("")}</div>
        <div class="btn-row">
          <button class="btn" id="btn-back">Volver</button>
        </div>
      </div>
    `);
    document.getElementById("btn-back").addEventListener("click", () => {
      if (S().questions.length) renderHome();
      else renderUpload();
    });
  }

  const EXAM_ICONS = ["school", "menu_book", "science", "calculate", "account_balance", "psychology", "biotech", "public"];

  function renderHome() {
    const qs = S().questionnaires;

    const stats = qs.map((qq) => Quiz.statsFor(qq.hash)).filter(Boolean);
    const agg = { total: 0, today: 0, mastered: 0, failed: 0 };
    stats.forEach((st) => { agg.total += st.total; agg.today += st.today; agg.mastered += st.mastered; agg.failed += st.failed; });

    const modeOptions = (st) => [
      ["today", `Para hoy (${st.today})`],
      ["random", `Aleatorias (${st.total})`],
      ["new", `Solo nuevas (${st.newN})`],
      ["failed", `Solo falladas (${st.failedNow})`],
      ["all", `Todas (${st.total})`]
    ].map(([v, lbl]) => `<option value="${v}" ${S().settings.mode === v ? "selected" : ""}>${lbl}</option>`).join("");

    const sizeOptions = (st) => [10, 15, 20, 25, 30, 40, 50, 0].map((n) =>
      `<option value="${n}" ${S().settings.size === n ? "selected" : ""}>${n === 0 ? `Todas (${Math.min(1000, st.total)})` : n} preguntas</option>`).join("");

    const examCards = qs.map((qq, i) => {
      const st = stats.find((s) => s.hash === qq.hash);
      if (!st) return "";
      const icon = EXAM_ICONS[i % EXAM_ICONS.length];
      const hasDraft = Quiz.draftOf(qq.hash);
      return `
      <div class="exam-card">
        <div class="exam-card-icon"><span class="material-symbols-outlined">${icon}</span></div>
        <div class="exam-card-body">
          <h3>${esc(st.name)}</h3>
          <div class="exam-card-meta">
            <span><b>${st.total}</b> preguntas</span><span>·</span>
            <span><b>${st.today}</b> para hoy</span><span>·</span>
            <span><b>${st.mastered}</b> dominadas</span>
          </div>
          ${hasDraft ? `
          <button class="draft-chip" id="btn-resume-${st.hash}">
            <span class="material-symbols-outlined">history</span>
            Continuar sesión guardada
          </button>` : ""}
          <label class="field-label" for="sel-size-${st.hash}">Cantidad de preguntas</label>
          <select class="input" id="sel-size-${st.hash}">${sizeOptions(st)}</select>
          <label class="field-label" for="sel-mode-${st.hash}">Tipo de sesión</label>
          <select class="input" id="sel-mode-${st.hash}">${modeOptions(st)}</select>
          <button class="btn primary block big" id="btn-start-${st.hash}">
            Comenzar <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>`;
    }).join("");

    const manageCards = qs.map((qq) => {
      const st = stats.find((s) => s.hash === qq.hash);
      if (!st) return "";
      return `
      <details class="card manage-card" id="sec-${st.hash}">
        <summary>
          <span class="material-symbols-outlined" style="color:var(--accent)">tune</span>
          ${esc(st.name)}
          <span class="muted small" style="font-weight:400">fecha de parcial, calendario y progreso</span>
          <span class="material-symbols-outlined summary-chev">expand_more</span>
        </summary>
        <div class="manage-body">
          <div class="controls">
            <label>Fecha de parcial
              <input class="input" id="inp-exam-${st.hash}" type="date" value="${st.date}">
            </label>
            <label>Puntos por pregunta
              <input class="input" id="inp-points-${st.hash}" type="number" min="0.25" step="0.25" value="${S().settings.points}">
            </label>
            <button class="btn danger sm" id="btn-reset-${st.hash}">Reiniciar progreso</button>
          </div>
          <p class="muted small">Las tarjetas de este cuestionario no se planifican después de su fecha de parcial.</p>
          <div class="cal-block">
            <div class="card-head">
              <h2 style="font-size:16px">Calendario de repasos</h2>
              <div class="cal-nav">
                <button class="btn icon cal-prev" title="Mes anterior">‹</button>
                <span class="cal-label">${calLabel()}</span>
                <button class="btn icon cal-next" title="Mes siguiente">›</button>
              </div>
            </div>
            <div class="cal-grid"></div>
            <div class="muted small">Hacé clic en un día para ver las preguntas planificadas.</div>
            <div class="cal-list"></div>
          </div>
        </div>
      </details>`;
    }).join("");

    view(`
      <section class="home-section">
        <h1 class="page-title">Progreso</h1>
        <div class="stat-cards">
          <div class="stat-card">
            <div class="stat-ic"><span class="material-symbols-outlined">trending_up</span></div>
            <div><p class="lbl">Preguntas totales</p><p class="big">${agg.total}</p></div>
          </div>
          <div class="stat-card">
            <div class="stat-ic amber"><span class="material-symbols-outlined">timer</span></div>
            <div><p class="lbl">Para hoy</p><p class="big">${agg.today}</p></div>
          </div>
          <div class="stat-card">
            <div class="stat-ic green"><span class="material-symbols-outlined">task_alt</span></div>
            <div><p class="lbl">Dominadas</p><p class="big">${agg.mastered}</p></div>
          </div>
          <div class="stat-card">
            <div class="stat-ic red"><span class="material-symbols-outlined">error</span></div>
            <div><p class="lbl">Falladas históricas</p><p class="big">${agg.failed}</p></div>
          </div>
        </div>
      </section>
      ${S().warnings.length && !warningsDismissed ? `
      <section class="home-section">
        <div class="card warn-card" id="warn-card">
          <div class="card-head">
            <h2>Filas omitidas (${S().warnings.length})</h2>
            <button class="btn icon" id="btn-warn-close" title="Cerrar aviso">✕</button>
          </div>
          <p class="muted small">Se cargaron las preguntas válidas. Estas filas se ignoraron:</p>
          <div class="error-list">${S().warnings.map((w) => `<div class="error-item">${esc(w)}</div>`).join("")}</div>
        </div>
      </section>` : ""}
      <section class="home-section">
        <div class="home-head">
          <div>
            <h2 class="section-title">Nueva Práctica</h2>
          </div>
        </div>
        <div class="exam-grid">${examCards}</div>
      </section>
      ${qs.length ? `
      <section class="home-section">
        <div class="home-head">
          <div>
            <h2 class="section-title">Gestión de cuestionarios</h2>
            <p class="muted small sub">Fechas de parcial, calendarios y progreso por CSV</p>
          </div>
        </div>
        ${manageCards}
      </section>` : ""}
      <section class="home-section">
        <div class="card">
          <h2>Agregar cuestionario</h2>
          <div class="dropzone compact" id="dropzone2">
            <div>Arrastrá otro CSV acá o hacé clic para elegirlo — se suma como una tarjeta nueva</div>
          </div>
          <input type="file" id="file2" accept=".csv,text/csv,text/plain" hidden>
        </div>
      </section>
    `);

    bindUpload("dropzone2", "file2");
    qs.forEach((qq) => {
      const h = qq.hash;
      const sec = document.getElementById("sec-" + h);
      const startBtn = document.getElementById("btn-start-" + h);
      if (startBtn) startBtn.addEventListener("click", () => {
        Quiz.selectQuestionnaire(h);
        const modeSel = document.getElementById("sel-mode-" + h);
        if (modeSel) Quiz.setMode(modeSel.value);
        Quiz.newSession();
        renderQuiz();
      });
      const modeSel = document.getElementById("sel-mode-" + h);
      if (modeSel) modeSel.addEventListener("change", (e) => Quiz.setMode(e.target.value));
      const sizeSel = document.getElementById("sel-size-" + h);
      if (sizeSel) sizeSel.addEventListener("change", (e) => Quiz.setSize(e.target.value));
      const pointsInp = document.getElementById("inp-points-" + h);
      if (pointsInp) pointsInp.addEventListener("change", (e) => Quiz.setPoints(e.target.value));
      const examInp = document.getElementById("inp-exam-" + h);
      if (examInp) examInp.addEventListener("change", (e) => { Quiz.setExamDateFor(h, e.target.value); renderCalFor(h); });
      const resetBtn = document.getElementById("btn-reset-" + h);
      if (resetBtn) resetBtn.addEventListener("click", () => {
        if (confirm(`¿Reiniciar todo el progreso de "${qq.name}"?`)) {
          Quiz.resetProgressFor(h);
          renderHome();
          toast("Progreso reiniciado");
        }
      });
      const resumeBtn = document.getElementById("btn-resume-" + h);
      if (resumeBtn) resumeBtn.addEventListener("click", () => {
        Quiz.selectQuestionnaire(h);
        if (Quiz.tryResume()) renderQuiz();
        else { S().items = []; renderHome(); }
      });
      if (sec) {
        const prevBtn = sec.querySelector(".cal-prev");
        if (prevBtn) prevBtn.addEventListener("click", () => {
          calNow();
          calMonth--;
          if (calMonth < 0) { calMonth = 11; calYear--; }
          renderAllCals();
        });
        const nextBtn = sec.querySelector(".cal-next");
        if (nextBtn) nextBtn.addEventListener("click", () => {
          calNow();
          calMonth++;
          if (calMonth > 11) { calMonth = 0; calYear++; }
          renderAllCals();
        });
        renderCalFor(h);
      }
    });
    const warnClose = document.getElementById("btn-warn-close");
    if (warnClose) warnClose.addEventListener("click", () => { warningsDismissed = true; renderHome(); });
  }

  let calYear = 0, calMonth = -1;
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];
  const isoOf = (y, m, d) => new Date(y, m, d, 12).toISOString().slice(0, 10);
  const fmtIso = (iso) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  function calNow() {
    if (calYear === 0) {
      const t = new Date();
      calYear = t.getFullYear();
      calMonth = t.getMonth();
    }
  }

  const calLabel = () => { calNow(); return `${MONTHS[calMonth]} ${calYear}`; };

  function renderCalFor(hash) {
    const sec = document.getElementById("sec-" + hash);
    if (!sec) return;
    const grid = sec.querySelector(".cal-grid");
    const label = sec.querySelector(".cal-label");
    const list = sec.querySelector(".cal-list");
    if (!grid) return;
    label.textContent = calLabel();
    const by = Quiz.scheduledByDayFor(hash);
    const examIso = Quiz.examDateFor(hash);
    const first = new Date(calYear, calMonth, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const nw = new Date();
    const todayIso = isoOf(nw.getFullYear(), nw.getMonth(), nw.getDate());
    let cells = DAY_LETTERS.map((l) => `<div class="cal-head">${l}</div>`).join("");
    for (let i = 0; i < offset; i++) cells += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = isoOf(calYear, calMonth, d);
      const n = (by[iso] || []).length;
      const exam = iso === examIso;
      const cls = [iso === todayIso ? "today" : "", n ? "has-plan" : "", exam ? "cal-exam" : ""].join(" ");
      cells += `<div class="cal-day ${cls}" data-iso="${iso}" ${n ? `title="${n} pregunta${n === 1 ? "" : "s"}"` : ""}>
        <span class="cal-day-num">${d}</span>
        ${n ? `<span class="cal-pill">${n}</span>` : ""}
        ${exam ? `<span class="cal-dot" title="Parcial"></span>` : ""}
      </div>`;
    }
    grid.innerHTML = cells;
    grid.querySelectorAll(".cal-day.has-plan").forEach((cell) => {
      cell.addEventListener("click", () => {
        sec.querySelectorAll(".cal-day.selected").forEach((c) => c.classList.remove("selected"));
        cell.classList.add("selected");
        const qs = Quiz.questionsOnDayFor(hash, cell.dataset.iso);
        list.innerHTML = `
          <div class="cal-list-title">${fmtIso(cell.dataset.iso)} — ${qs.length} pregunta${qs.length === 1 ? "" : "s"}</div>
          ${qs.length ? qs.map((q, i) => `
            <div class="cal-list-item">
              <span class="cal-item-num">${i + 1}</span>
              <span class="cal-item-text">${esc(q.text)}</span>
            </div>`).join("")
            : `<div class="muted small">Sin preguntas planificadas para ese día.</div>`}`;
      });
    });
  }

  function renderAllCals() {
    S().questionnaires.forEach((q) => renderCalFor(q.hash));
  }

  function renderQuiz() {
    const items = S().items;
    if (!items.length) { renderHome(); return; }
    document.body.classList.add("quiz-open");
    document.getElementById("quiz-name").textContent = `${S().name} · Sesión de ${items.length} preguntas`;

    const n = items.length;
    const answered = Quiz.answeredCount();
    const cards = items.map((it, i) => {
      const q = it.q;
      const answeredNow = Quiz.isAnswered(q.id);
      const body = q.type === "dropdown"
        ? (() => {
          const chosen = S().answers[q.id] || {};
          const rows = q.slots.map((txt, si) => `<label class="slot">
            <span class="slot-num">${si + 1}</span>
            <select class="input slot-select" data-q="${q.id}" data-slot="${si}">
              <option value="">Elegí una opción…</option>
              ${q.dropdown.map((opt, j) => `<option value="${j}" ${j === chosen[si] ? "selected" : ""}>${esc(opt)}</option>`).join("")}
            </select>
          </label>`).join("");
          return `<div class="qtext">${rich(q.text)}</div><div class="slot-grid">${rows}</div>`;
        })()
        : q.type === "fill"
          ? (() => {
            const val = typeof S().answers[q.id] === "string" ? S().answers[q.id] : "";
            return `<div class="qtext">${rich(q.text)}</div>
              <input class="input fill-input" data-q="${q.id}" placeholder="Escribí la respuesta…" value="${esc(val)}" autocomplete="off">`;
          })()
          : (() => {
          const checked = S().answers[q.id] || [];
          const opts = it.optOrder.map((orig, disp) => {
            const on = checked.indexOf(disp) >= 0;
            return `<label class="opt ${on ? "checked" : ""}">
              <input type="checkbox" class="hidden-input" data-q="${q.id}" data-d="${disp}" ${on ? "checked" : ""}>
              <span class="alpha">${LETTERS[disp]}</span>
              <span>${rich(q.options[orig])}</span>
            </label>`;
          }).join("");
          return `<div class="qtext">${rich(q.text)}</div><div class="opt-grid">${opts}</div>`;
        })();
      return `<div class="qcard" id="qcard-${q.id}" ${answeredNow ? "" : "data-unanswered"}>
        <div class="qhead">
          <span class="qnum">${i + 1}<span class="muted">/${n}</span></span>
          ${q.category ? `<span class="chip">${esc(q.category)}</span>` : ""}
          ${q.type === "dropdown" ? `<span class="chip">dropdown</span>` : q.type === "fill" ? `<span class="chip">rellenar</span>` : ""}
          <span class="chip warn" ${answeredNow ? "style='display:none'" : ""}>sin responder</span>
        </div>
        ${body}
      </div>`;
    }).join("");

    view(`
      <div class="card quiz-meta">
        <div class="progress"><span style="width:${Math.round((answered / n) * 100)}%" id="bar"></span></div>
        <div class="muted small center-txt">Respondiste <b id="cnt-answered">${answered}</b> de ${n} · las respuestas correctas se muestran al terminar</div>
      </div>
      <div class="qlist">${cards}</div>
      <div class="sticky">
        <button class="btn" id="btn-exit">Salir</button>
        <span class="muted" id="pending-label">${n - answered} sin responder</span>
        <button class="btn primary" id="btn-submit">Finalizar y ver puntaje</button>
      </div>
    `);
    bindQuizEvents();
  }

  function updateQuizUI() {
    const n = S().items.length;
    const answered = Quiz.answeredCount();
    $("#bar").style.width = Math.round((answered / n) * 100) + "%";
    $("#cnt-answered").textContent = answered;
    $("#pending-label").textContent = `${n - answered} sin responder`;
  }

  const advanceTimers = {};

  function scheduleAdvance(qid, delay) {
    const items = S().items;
    const idx = items.findIndex((it) => it.q.id === qid);
    if (idx < 0 || idx >= items.length - 1) return;
    let targetId = null;
    for (let i = idx + 1; i < items.length; i++) {
      if (!Quiz.isAnswered(items[i].q.id)) { targetId = items[i].q.id; break; }
    }
    if (!targetId) {
      setTimeout(() => {
        const btn = document.getElementById("btn-submit");
        if (btn) btn.focus();
      }, delay);
      return;
    }
    clearTimeout(advanceTimers[targetId]);
    advanceTimers[targetId] = setTimeout(() => {
      const el = document.getElementById("qcard-" + targetId);
      if (!el || !$("#btn-exit")) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("adv-target");
      void el.offsetWidth;
      el.classList.add("adv-target");
      setTimeout(() => el.classList.remove("adv-target"), 900);
    }, delay);
  }

  function bindQuizEvents() {
    $("#btn-exit").addEventListener("click", () => {
      if (confirm("¿Salir de la sesión? Tus respuestas se guardan y podés continuar después.")) {
        document.body.classList.remove("quiz-open");
        renderHome();
      }
    });
    $("#btn-submit").addEventListener("click", submitQuiz);
    document.querySelectorAll(".opt input[type=checkbox]").forEach((input) => {
      input.addEventListener("change", (e) => {
        const qid = parseInt(e.target.dataset.q, 10);
        const disp = parseInt(e.target.dataset.d, 10);
        const wasAnswered = Quiz.isAnswered(qid);
        Quiz.toggle(qid, disp);
        e.target.closest(".opt").classList.toggle("checked", e.target.checked);
        const card = document.getElementById("qcard-" + qid);
        const answeredNow = Quiz.isAnswered(qid);
        const chip = card.querySelector(".chip.warn");
        if (chip) chip.style.display = answeredNow ? "none" : "";
        if (answeredNow) card.removeAttribute("data-unanswered");
        else card.setAttribute("data-unanswered", "");
        updateQuizUI();
        if (!wasAnswered && answeredNow) scheduleAdvance(qid, 500);
      });
    });
    document.querySelectorAll(".slot-select").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const qid = parseInt(e.target.dataset.q, 10);
        const slot = parseInt(e.target.dataset.slot, 10);
        const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
        const wasAnswered = Quiz.isAnswered(qid);
        Quiz.setSlot(qid, slot, val);
        const card = document.getElementById("qcard-" + qid);
        const answeredNow = Quiz.isAnswered(qid);
        const chip = card.querySelector(".chip.warn");
        if (chip) chip.style.display = answeredNow ? "none" : "";
        if (answeredNow) card.removeAttribute("data-unanswered");
        else card.setAttribute("data-unanswered", "");
        updateQuizUI();
        if (!wasAnswered && answeredNow) scheduleAdvance(qid, 400);
      });
    });
    document.querySelectorAll(".fill-input").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const qid = parseInt(e.target.dataset.q, 10);
        const wasAnswered = Quiz.isAnswered(qid);
        Quiz.setFill(qid, e.target.value);
        const card = document.getElementById("qcard-" + qid);
        const answeredNow = Quiz.isAnswered(qid);
        const chip = card.querySelector(".chip.warn");
        if (chip) chip.style.display = answeredNow ? "none" : "";
        if (answeredNow) card.removeAttribute("data-unanswered");
        else card.setAttribute("data-unanswered", "");
        updateQuizUI();
        if (!wasAnswered && answeredNow) {
          clearTimeout(advanceTimers["f" + qid]);
          advanceTimers["f" + qid] = setTimeout(() => {
            delete advanceTimers["f" + qid];
            scheduleAdvance(qid, 0);
          }, 1200);
        }
      });
      inp.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const qid = parseInt(e.target.dataset.q, 10);
        if (advanceTimers["f" + qid]) {
          clearTimeout(advanceTimers["f" + qid]);
          delete advanceTimers["f" + qid];
        }
        if (Quiz.isAnswered(qid)) scheduleAdvance(qid, 0);
      });
    });
  }

  function submitQuiz() {
    const res = Quiz.submit();
    document.body.classList.remove("quiz-open");
    renderResults(res);
  }

  function renderResults(r) {
    const pct = r.max ? Math.round((r.total / r.max) * 100) : 0;
    const msg = pct === 100 ? "¡Perfecto!" : pct >= 80 ? "¡Muy bien!" : pct >= 60 ? "Aprobado" : pct >= 40 ? "Hay que repasar" : "¡A estudiar más!";
    const stateOf = (s) => s === "correct" ? ["ok", "Correcta"] : s === "partial" ? ["par", "Parcial"] : ["no", "Incorrecta"];
    const failedN = r.marked.failed.length + r.marked.partial.length;

    document.getElementById("quiz-name").textContent = `${S().name} · Resultados`;

    const rows = r.detail.map((d, i) => {
      const [cls, lbl] = stateOf(d.state);
const opts = d.q.type === "dropdown"
        ? d.q.slots.map((txt, si) => {
          const ch = d.slotChosen ? d.slotChosen[si] : null;
          const isC = ch === d.q.correctSlot[si];
          const oCls = isC ? "correct" : ch == null ? "missed" : "wrong";
          const flag = isC ? "✓" : ch == null ? "sin responder" : "✗";
          return `<div class="opt ${oCls}" style="cursor:default">
            <span class="alpha">${si + 1}</span>
            <span><b>${rich(txt)}</b><br>
              <span class="muted small">Tu respuesta:</span> ${ch == null ? "—" : esc(d.q.dropdown[ch])}<br>
              <span class="muted small">Correcta:</span> ${esc(d.q.dropdown[d.q.correctSlot[si]])}
            </span>
            <span class="opt-flag">${flag}</span>
          </div>`;
        }).join("")
        : d.q.type === "fill"
          ? (() => {
            const has = !!d.fillAnswer;
            const isC = d.score > 0 && has;
            const oCls = isC ? "correct" : has ? "wrong" : "missed";
            const flag = isC ? "✓" : has ? "✗" : "sin responder";
            return `<div class="opt ${oCls}" style="cursor:default">
              <span class="alpha">1</span>
              <span>
                <b>Tu respuesta:</b> ${has ? esc(d.fillAnswer) : "—"}<br>
                <span class="muted small">Correcta:</span> ${d.q.correct.map((c) => esc(c)).join(" / ")}
              </span>
              <span class="opt-flag">${flag}</span>
            </div>`;
          })()
          : d.optOrder.map((orig, disp) => {
          const isC = d.q.correct.indexOf(orig) >= 0;
          const was = d.dispChecked.indexOf(disp) >= 0;
          const oCls = isC && was ? "correct" : isC ? "missed" : was ? "wrong" : "";
          const flag = isC && was ? "✓" : isC ? "correcta" : was ? "✗" : "";
          return `<div class="opt ${oCls}" style="cursor:default">
            <span class="alpha">${LETTERS[disp]}</span>
            <span>${rich(d.q.options[orig])}</span>
            <span class="opt-flag">${flag}</span>
          </div>`;
        }).join("");
      return `
        <div class="qcard">
          <div class="qhead">
            <span class="qnum">${i + 1}</span>
            ${d.q.category ? `<span class="chip">${esc(d.q.category)}</span>` : ""}
            <span class="badge ${cls}">${lbl}</span>
            <span class="score-chip">${fmt(d.score)} p</span>
          </div>
          <div class="qtext">${rich(d.q.text)}</div>
          <div class="opt-grid">${opts}</div>
          ${d.q.explanation ? `<div class="explain">${rich(d.q.explanation)}</div>` : ""}
        </div>`;
    }).join("");

    view(`
      <div class="card result-hero">
        <div class="big">${fmt(r.total)} <span class="muted">/ ${fmt(r.max)} puntos</span></div>
        <div class="pct ${pct === 100 ? "ok-c" : pct >= 60 ? "" : "bad-c"}">${pct} %</div>
        <div class="msg">${msg}</div>
        <div class="btn-row justify-center">
          <button class="btn primary" id="btn-repeat">Repetir mismas preguntas</button>
          <button class="btn" id="btn-fail" ${failedN ? "" : "disabled"}>Solo falladas (${failedN})</button>
          <button class="btn" id="btn-next">Nueva sesión</button>
          <button class="btn" id="btn-home">Inicio</button>
        </div>
      </div>
      ${rows}
    `);

    document.getElementById("btn-repeat").addEventListener("click", () => { Quiz.repeatSession(); renderQuiz(); });
    document.getElementById("btn-fail").addEventListener("click", () => { Quiz.failedSession(); renderQuiz(); });
    document.getElementById("btn-next").addEventListener("click", () => { Quiz.newSession(); renderQuiz(); });
    document.getElementById("btn-home").addEventListener("click", () => renderHome());
  }

  window.UI = { init };
})();