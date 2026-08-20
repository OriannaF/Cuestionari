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

  function init() {
    loadSource().then((r) => {
      if (r.loaded) {
        warningsDismissed = false;
        renderHome();
        if (S().questionnaires.length > 1) {
          const names = S().questionnaires.map(q => q.name).join(", ");
          toast(`Cuestionarios cargados: ${S().questionnaires.length} (${names})`);
        } else {
          toast(`Cuestionario cargado: ${S().questions.length} preguntas`);
        }
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

  function renderHome() {
    const st = Quiz.stats();
    const draft = S().items.length > 0 && !S().results;
    const failedN = Quiz.failedCount();
    const pts = st.points;
    const mode = S().settings.mode;
    const todayN = Quiz.todayCount();
    const newN = Quiz.newCount();
    const ed = Quiz.quizDate();
    const cats = [...new Set(S().questions.map((q) => q.category || "Sin categoría"))];
    homeCats = cats;
    const dateList = [];
    if (ed) dateList.push({ name: "Cuestionario", iso: ed });
    cats.forEach((c) => {
      const iso = Quiz.catDate(c);
      if (iso) dateList.push({ name: c, iso });
    });
    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);
    const TODAY = todayMid.toISOString().slice(0, 10);
    const upcoming = dateList
      .map((d) => ({ ...d, left: Math.round((new Date(d.iso + "T00:00:00") - todayMid) / 86400000) }))
      .filter((d) => d.left >= 0)
      .sort((a, b) => a.left - b.left)[0];

    document.getElementById("quiz-name").textContent = `${S().name} · ${S().hash}`;

    const catRows = [...st.cats.entries()].map(([name, c]) => {
      const acc = c.attempts ? Math.round((c.sum / (c.attempts * pts)) * 100) : null;
      return `<tr><td>${esc(name)}</td><td>${c.count}</td><td>${c.failed}</td><td>${acc === null ? "—" : acc + " %"}</td></tr>`;
    }).join("");

    const fmtDate = (iso) => {
      const [y, m, d] = iso.split("-");
      return `${d}/${m}`;
    };
    const modeOptions = [
      ["today", `Para hoy (${todayN})`],
      ["random", `Aleatorias (${st.total})`],
      ["new", `Solo nuevas (${newN})`],
      ["failed", `Solo falladas (${failedN})`],
      ["all", `Todas (${st.total})`]
    ].map(([v, lbl]) => `<option value="${v}" ${mode === v ? "selected" : ""}>${lbl}</option>`).join("");

    const questionnaires = S().questionnaires.map((q, i) => `
      <option value="${q.hash}" ${S().currentHash === q.hash ? "selected" : ""}>${q.name || `Cuestionario ${i + 1}`}</option>`).join("");
    const combineOpt = `<option value="all" ${S().currentHash === "all" ? "selected" : ""}>Combinar todos los cuestionarios</option>`;

    const examChip = upcoming
      ? `<div class="chip ${upcoming.left <= 3 ? "warn" : ""} exam-chip" title="${esc(upcoming.name)}">Parcial: ${upcoming.name === "Cuestionario" ? "" : esc(upcoming.name) + " "}${fmtDate(upcoming.iso)} · ${upcoming.left === 0 ? "¡HOY!" : `faltan ${upcoming.left} día${upcoming.left === 1 ? "" : "s"}`}</div>`
      : "";

    const questionnaireSelector = S().questionnaires.length > 1 ? `
      <div class="card accent-card" style="margin: 16px 0;">
        <div class="card-head">
          <h2>Cuestionario</h2>
          <span class="muted small">${S().questionnaires.length} cargados</span>
        </div>
        <div class="controls">
          <select class="input" id="sel-questionnaire">
            ${combineOpt}
            ${questionnaires}
          </select>
        </div>
      </div>` : "";

    const catDateInputs = cats.map((c, i) => {
      const iso = Quiz.catDate(c);
      return `<div class="cat-date-row">
        <span class="cat-date-name">${esc(c)}</span>
        <input class="input cat-date-input" id="inp-cat-exam-${i}" type="date" data-cat="${esc(c)}" value="${iso}" ${iso ? "" : 'style="color:var(--muted)"'}>
        <button class="btn icon" data-clear="${esc(c)}" title="Quitar fecha del tema">✕</button>
      </div>`;
    }).join("");

    view(`
      <div class="card hero">
        <div class="hero-today">
          <div class="hero-num">${todayN}</div>
          <div class="hero-lbl">para hoy <span class="muted small">(${st.total} en total)</span></div>
        </div>
        <div class="hero-mid">
          <div class="hero-title">Plan del día</div>
          <div class="muted small">${newN} nuevas · ${Math.max(0, todayN - newN)} repasos vencidos</div>
          ${examChip}
        </div>
        <div class="hero-btn">
          <button class="btn primary big" id="btn-start">Empezar sesión de hoy</button>
        </div>
      </div>
      <div class="card">
        <div class="grid-stats">
          ${stat("", st.total, "Preguntas")}
          ${stat("due", todayN, "Para hoy")}
          ${stat("ok", st.mastered, "Dominadas")}
          ${stat("bad", st.failed, "Falladas históricas")}
        </div>
      </div>
      ${draft ? `
        <div class="card accent-card">
          <div class="btn-row align-center">
            <span class="muted">Tenías una sesión en curso guardada</span>
            <button class="btn primary" id="btn-resume">Continuar sesión</button>
            <button class="btn" id="btn-discard">Descartar</button>
          </div>
        </div>` : ""}
      ${S().warnings.length && !warningsDismissed ? `
        <div class="card warn-card" id="warn-card">
          <div class="card-head">
            <h2>Filas omitidas (${S().warnings.length})</h2>
            <button class="btn icon" id="btn-warn-close" title="Cerrar aviso">✕</button>
          </div>
          <p class="muted small">Se cargaron las preguntas válidas. Estas filas se ignoraron:</p>
          <div class="error-list">${S().warnings.map((w) => `<div class="error-item">${esc(w)}</div>`).join("")}</div>
        </div>` : ""}
      <div class="card">
        <h2>Fechas de parcial</h2>
        <div class="controls">
          <label>Cuestionario
            <input class="input" id="inp-exam" type="date" value="${ed}">
          </label>
          <span class="muted small">Las tarjetas no se planifican después de estas fechas. Cada tema puede tener su propia fecha; si no tiene, usa la del cuestionario.</span>
        </div>
        ${catDateInputs ? `<div class="cat-date-list">${catDateInputs}</div>` : ""}
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Calendario de repasos</h2>
          <div class="cal-nav">
            <button class="btn icon" id="cal-prev" title="Mes anterior">‹</button>
            <span class="cal-label" id="cal-label">${calLabel()}</span>
            <button class="btn icon" id="cal-next" title="Mes siguiente">›</button>
          </div>
        </div>
        <div class="cal-grid" id="cal-grid"></div>
        <div class="muted small" id="cal-hint">Hacé clic en un día para ver las preguntas planificadas.</div>
        <div class="cal-list" id="cal-list"></div>
      </div>
      <div class="card">
        <h2>Nueva sesión</h2>
        <div class="controls">
          <label>Tipo de sesión
            <select class="input" id="sel-mode">${modeOptions}</select>
          </label>
          <label>Tope por sesión
            <select class="input" id="sel-size">
              ${[15, 20, 25, 30, 40, 50, 0].map((n) =>
                `<option value="${n}" ${S().settings.size === n ? "selected" : ""}>${n === 0 ? `Todas (${Math.min(1000, st.total)})` : n}</option>`).join("")}
            </select>
          </label>
          <label>Puntos por pregunta
            <input class="input" id="inp-points" type="number" min="0.25" step="0.25" value="${pts}">
          </label>
        </div>
        <div class="btn-row">
          <button class="btn primary" id="btn-start2">Empezar sesión</button>
        </div>
      </div>
      <div class="card">
        <h2>Desempeño por categoría</h2>
        <table>
          <thead><tr><th>Categoría</th><th>Preguntas</th><th>Falladas</th><th>Acierto</th></tr></thead>
          <tbody>${catRows || `<tr><td colspan="4" class="muted">Sin datos todavía</td></tr>`}</tbody>
        </table>
      </div>
      <div class="card">
        <h2>Cambiar cuestionario</h2>
        <div class="dropzone compact" id="dropzone2">
          <div>Arrastrá otro CSV acá o hacé clic para elegirlo</div>
        </div>
        <input type="file" id="file2" accept=".csv,text/csv,text/plain" hidden>
        <div class="btn-row">
          <button class="btn danger" id="btn-reset">Reiniciar progreso</button>
        </div>
      </div>
    `);

    bindUpload("dropzone2", "file2");
    document.getElementById("btn-start").addEventListener("click", () => { Quiz.setMode("today"); Quiz.newSession(); renderQuiz(); });
    document.getElementById("btn-start2").addEventListener("click", () => { Quiz.newSession(); renderQuiz(); });
    document.getElementById("sel-mode").addEventListener("change", (e) => { Quiz.setMode(e.target.value); renderHome(); });
    document.getElementById("sel-size").addEventListener("change", (e) => Quiz.setSize(e.target.value));
    document.getElementById("inp-points").addEventListener("change", (e) => { Quiz.setPoints(e.target.value); renderHome(); });
    document.getElementById("sel-questionnaire").addEventListener("change", (e) => {
      const hash = e.target.value;
      if (hash === "all") {
        S.currentHash = "all";
        // Combine all questions from all questionnaires
        S.questions = [];
        S.questionnaires.forEach(q => { S.questions = S.questions.concat(q.questions); });
        S.name = "Todos los cuestionarios";
      } else {
        S.currentHash = hash;
        const current = S.questionnaires.find(q => q.hash === hash);
        if (current) {
          S.questions = current.questions;
          S.name = current.name;
        }
      }
      renderHome();
    });
    document.getElementById("inp-exam").addEventListener("change", (e) => { Quiz.setExamDate(e.target.value); renderHome(); });
    document.querySelectorAll(".cat-date-input").forEach((inp) => {
      inp.addEventListener("change", (e) => { Quiz.setCatExamDate(e.target.dataset.cat, e.target.value); renderHome(); });
    });
    document.querySelectorAll("[data-clear]").forEach((btn) => {
      btn.addEventListener("click", () => { Quiz.setCatExamDate(btn.dataset.clear, ""); renderHome(); });
    });
    bindCalendar();
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (confirm("¿Reiniciar todo el progreso de este cuestionario?")) {
        Quiz.resetProgress();
        renderHome();
        toast("Progreso reiniciado");
      }
    });
    const warnClose = document.getElementById("btn-warn-close");
    if (warnClose) warnClose.addEventListener("click", () => { warningsDismissed = true; renderHome(); });
    const resumeBtn = document.getElementById("btn-resume");
    if (resumeBtn) resumeBtn.addEventListener("click", () => {
      if (Quiz.tryResume()) renderQuiz();
      else { S().items = []; renderHome(); }
    });
    const discardBtn = document.getElementById("btn-discard");
    if (discardBtn) discardBtn.addEventListener("click", () => { S().items = []; S().results = null; renderHome(); });
  }

  let calYear = 0, calMonth = -1;
  let homeCats = [];
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

  function examDaysOf() {
    const m = {};
    const qd = Quiz.quizDate();
    if (qd) m[qd] = "Cuestionario";
    for (const c of homeCats) {
      const iso = Quiz.catDate(c);
      if (iso) m[iso] = c;
    }
    return m;
  }

  function renderCal() {
    calNow();
    const grid = document.getElementById("cal-grid");
    const label = document.getElementById("cal-label");
    if (!grid) return;
    if (label) label.textContent = calLabel();
    const by = Quiz.scheduledByDay();
    const examDays = examDaysOf();
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
      const exam = examDays[iso];
      const cls = [iso === todayIso ? "today" : "", n ? "has-plan" : "", exam ? "cal-exam" : ""].join(" ");
      cells += `<div class="cal-day ${cls}" data-iso="${iso}" ${n ? `title="${n} pregunta${n === 1 ? "" : "s"}"` : ""}>
        <span class="cal-day-num">${d}</span>
        ${n ? `<span class="cal-pill">${n}</span>` : ""}
        ${exam ? `<span class="cal-dot" title="Parcial: ${esc(exam)}"></span>` : ""}
      </div>`;
    }
    grid.innerHTML = cells;
    grid.querySelectorAll(".cal-day.has-plan").forEach((cell) => {
      cell.addEventListener("click", () => showCalDay(cell.dataset.iso, cell));
    });
  }

  function showCalDay(iso, cell) {
    const list = document.getElementById("cal-list");
    document.querySelectorAll(".cal-day.selected").forEach((c) => c.classList.remove("selected"));
    if (!list) return;
    if (!iso) { list.innerHTML = ""; return; }
    if (cell) cell.classList.add("selected");
    const qs = Quiz.questionsOnDay(iso);
    const exam = examDaysOf()[iso];
    list.innerHTML = `
      <div class="cal-list-title">${fmtIso(iso)}${exam ? ` · Parcial: ${esc(exam)}` : ""} — ${qs.length} pregunta${qs.length === 1 ? "" : "s"}</div>
      ${qs.length ? qs.map((q, i) => `
        <div class="cal-list-item">
          <span class="cal-item-num">${i + 1}</span>
          <span class="cal-item-text">${esc(q.text)}</span>
          ${q.category ? `<span class="chip">${esc(q.category)}</span>` : ""}
        </div>`).join("")
        : `<div class="muted small">Sin preguntas planificadas para ese día.</div>`}`;
  }

  function bindCalendar() {
    const prev = document.getElementById("cal-prev");
    const next = document.getElementById("cal-next");
    if (!prev) return;
    prev.addEventListener("click", () => {
      calNow();
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCal();
      showCalDay(null, null);
    });
    next.addEventListener("click", () => {
      calNow();
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCal();
      showCalDay(null, null);
    });
    renderCal();
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
        Quiz.toggle(qid, disp);
        e.target.closest(".opt").classList.toggle("checked", e.target.checked);
        const card = document.getElementById("qcard-" + qid);
        const answeredNow = Quiz.isAnswered(qid);
        const chip = card.querySelector(".chip.warn");
        if (chip) chip.style.display = answeredNow ? "none" : "";
        if (answeredNow) card.removeAttribute("data-unanswered");
        else card.setAttribute("data-unanswered", "");
        updateQuizUI();
      });
    });
    document.querySelectorAll(".slot-select").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const qid = parseInt(e.target.dataset.q, 10);
        const slot = parseInt(e.target.dataset.slot, 10);
        const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
        Quiz.setSlot(qid, slot, val);
        const card = document.getElementById("qcard-" + qid);
        const answeredNow = Quiz.isAnswered(qid);
        const chip = card.querySelector(".chip.warn");
        if (chip) chip.style.display = answeredNow ? "none" : "";
        if (answeredNow) card.removeAttribute("data-unanswered");
        else card.setAttribute("data-unanswered", "");
        updateQuizUI();
      });
    });
    document.querySelectorAll(".fill-input").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const qid = parseInt(e.target.dataset.q, 10);
        Quiz.setFill(qid, e.target.value);
        const card = document.getElementById("qcard-" + qid);
        const answeredNow = Quiz.isAnswered(qid);
        const chip = card.querySelector(".chip.warn");
        if (chip) chip.style.display = answeredNow ? "none" : "";
        if (answeredNow) card.removeAttribute("data-unanswered");
        else card.setAttribute("data-unanswered", "");
        updateQuizUI();
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