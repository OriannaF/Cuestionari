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
    const qs = S().questionnaires;
    document.getElementById("quiz-name").textContent = `${qs.length} cuestionario${qs.length === 1 ? "" : "s"} cargado${qs.length === 1 ? "" : "s"}`;

    const modeOptions = (st) => [
      ["today", `Para hoy (${st.today})`],
      ["random", `Aleatorias (${st.total})`],
      ["new", `Solo nuevas (${st.newN})`],
      ["failed", `Solo falladas (${st.failedNow})`],
      ["all", `Todas (${st.total})`]
    ].map(([v, lbl]) => `<option value="${v}" ${S().settings.mode === v ? "selected" : ""}>${lbl}</option>`).join("");

    const sizeOptions = (st) => [15, 20, 25, 30, 40, 50, 0].map((n) =>
      `<option value="${n}" ${S().settings.size === n ? "selected" : ""}>${n === 0 ? `Todas (${Math.min(1000, st.total)})` : n}</option>`).join("");

    const sections = qs.map((qq) => {
      const st = Quiz.statsFor(qq.hash);
      if (!st) return "";
      const hasDraft = Quiz.draftOf(qq.hash);
      return `
      <div class="card cal-section" id="sec-${st.hash}">
        <div class="card-head">
          <h2>${esc(st.name)}</h2>
          <span class="muted small">${st.total} preguntas · ${st.hash}</span>
        </div>
        <div class="grid-stats">
          ${stat("", st.total, "Preguntas")}
          ${stat("due", st.today, "Para hoy")}
          ${stat("ok", st.mastered, "Dominadas")}
          ${stat("bad", st.failed, "Falladas históricas")}
        </div>
        <div class="controls">
          <label>Fecha de parcial
            <input class="input" id="inp-exam-${st.hash}" type="date" value="${st.date}">
          </label>
          <span class="muted small">Las tarjetas de este cuestionario no se planifican después de esta fecha.</span>
        </div>
        ${hasDraft ? `
        <div class="btn-row align-center">
          <span class="muted">Tenías una sesión en curso guardada</span>
          <button class="btn primary" id="btn-resume-${st.hash}">Continuar sesión</button>
          <button class="btn" id="btn-discard-${st.hash}">Descartar</button>
        </div>` : ""}
        <div class="controls">
          <label>Tipo de sesión
            <select class="input" id="sel-mode-${st.hash}">${modeOptions(st)}</select>
          </label>
          <label>Tope por sesión
            <select class="input" id="sel-size-${st.hash}">${sizeOptions(st)}</select>
          </label>
          <label>Puntos por pregunta
            <input class="input" id="inp-points-${st.hash}" type="number" min="0.25" step="0.25" value="${S().settings.points}">
          </label>
        </div>
        <div class="btn-row">
          <button class="btn primary big" id="btn-start-${st.hash}">Empezar sesión de hoy</button>
          <button class="btn primary" id="btn-start2-${st.hash}">Empezar sesión</button>
          <button class="btn danger" id="btn-reset-${st.hash}">Reiniciar progreso</button>
        </div>
        <div class="cal-block">
          <div class="card-head">
            <h2>Calendario de repasos</h2>
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
      </div>`;
    }).join("");

    view(`
      ${qs.length ? `
        <div class="card accent-card">
          <div class="card-head">
            <h2>Cuestionarios</h2>
            <span class="muted small">${qs.length} cargados</span>
          </div>
          <p class="muted small">Cada cuestionario tiene sus propias estadísticas, fecha de parcial y calendario.</p>
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
      ${sections}
      <div class="card">
        <h2>Cambiar cuestionario</h2>
        <div class="dropzone compact" id="dropzone2">
          <div>Arrastrá otro CSV acá o hacé clic para elegirlo</div>
        </div>
        <input type="file" id="file2" accept=".csv,text/csv,text/plain" hidden>
      </div>
    `);

    bindUpload("dropzone2", "file2");
    qs.forEach((qq) => {
      const h = qq.hash;
      const sec = document.getElementById("sec-" + h);
      if (!sec) return;
      document.getElementById("btn-start-" + h).addEventListener("click", () => {
        Quiz.selectQuestionnaire(h);
        Quiz.setMode("today");
        Quiz.newSession();
        renderQuiz();
      });
      document.getElementById("btn-start2-" + h).addEventListener("click", () => {
        Quiz.selectQuestionnaire(h);
        Quiz.newSession();
        renderQuiz();
      });
      document.getElementById("sel-mode-" + h).addEventListener("change", (e) => { Quiz.setMode(e.target.value); renderHome(); });
      document.getElementById("sel-size-" + h).addEventListener("change", (e) => Quiz.setSize(e.target.value));
      document.getElementById("inp-points-" + h).addEventListener("change", (e) => { Quiz.setPoints(e.target.value); renderHome(); });
      document.getElementById("inp-exam-" + h).addEventListener("change", (e) => { Quiz.setExamDateFor(h, e.target.value); renderHome(); });
      document.getElementById("btn-reset-" + h).addEventListener("click", () => {
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
      const discardBtn = document.getElementById("btn-discard-" + h);
      if (discardBtn) discardBtn.addEventListener("click", () => {
        Quiz.selectQuestionnaire(h);
        S().items = [];
        S().results = null;
        renderHome();
      });
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