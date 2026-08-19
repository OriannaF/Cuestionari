"use strict";

(function () {
  const Quiz = window.Quiz;
  const S = () => Quiz.S;
  const $ = (sel) => document.querySelector(sel);

  const esc = (v) => String(v == null ? "" : v)
    .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  const BUNDLED_NAME = "Final ADS";

  function loadSource() {
    return fetch("data/cuestionario.csv")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("no file"))))
      .then((txt) => {
        if (!txt.trim()) return Quiz.tryLoadSaved();
        const res = Quiz.loadCsv(txt, BUNDLED_NAME);
        if (res.ok) return true;
        throw res;
      })
      .catch((err) => {
        if (err && err.errors) return err;
        return Quiz.tryLoadSaved();
      });
  }

  function init() {
    loadSource().then((r) => {
      if (r === true) {
        renderHome();
        toast(`Cuestionario cargado: ${S().questions.length} preguntas`);
      } else if (r && r.errors) {
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
          <div class="muted small">Máximo 200 preguntas · una fila por pregunta · delimitador , o ; (se detecta solo)</div>
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

    document.getElementById("quiz-name").textContent = `${S().name} · ${S().hash}`;

    const catRows = [...st.cats.entries()].map(([name, c]) => {
      const acc = c.attempts ? Math.round((c.sum / (c.attempts * pts)) * 100) : null;
      return `<tr><td>${esc(name)}</td><td>${c.count}</td><td>${c.failed}</td><td>${acc === null ? "—" : acc + " %"}</td></tr>`;
    }).join("");

    view(`
      <div class="card">
        <div class="grid-stats">
          ${stat("", st.total, "Preguntas")}
          ${stat("due", st.unseen + st.due, "Pendientes")}
          ${stat("ok", st.mastered, "Dominadas")}
          ${stat("bad", st.failed, "Falladas")}
        </div>
        <p class="muted small">Las pendientes son las nunca vistas más las que el algoritmo de repetición espaciada manda repasar hoy.</p>
      </div>
      ${draft ? `
        <div class="card accent-card">
          <div class="btn-row align-center">
            <span class="muted">Tenías una sesión en curso guardada</span>
            <button class="btn primary" id="btn-resume">Continuar sesión</button>
            <button class="btn" id="btn-discard">Descartar</button>
          </div>
        </div>` : ""}
      ${S().warnings.length ? `
        <div class="card warn-card">
          <h2>Filas omitidas (${S().warnings.length})</h2>
          <p class="muted small">Se cargaron las preguntas válidas. Estas filas se ignoraron:</p>
          <div class="error-list">${S().warnings.map((w) => `<div class="error-item">${esc(w)}</div>`).join("")}</div>
        </div>` : ""}
      <div class="card">
        <h2>Nueva sesión</h2>
        <div class="controls">
          <label>Preguntas por sesión
            <select class="input" id="sel-size">
              ${[15, 20, 25, 30, 40, 50, 0].map((n) =>
                `<option value="${n}" ${S().settings.size === n ? "selected" : ""}>${n === 0 ? `Todas (${Math.min(200, st.total)})` : n}</option>`).join("")}
            </select>
          </label>
          <label>Puntos por pregunta
            <input class="input" id="inp-points" type="number" min="0.25" step="0.25" value="${pts}">
          </label>
        </div>
        <div class="btn-row">
          <button class="btn primary" id="btn-start">Empezar sesión</button>
          <button class="btn" id="btn-fail" ${failedN ? "" : "disabled"}>Repetir solo falladas ${failedN ? `(${failedN})` : ""}</button>
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
    document.getElementById("btn-start").addEventListener("click", () => { Quiz.newSession(); renderQuiz(); });
    document.getElementById("btn-fail").addEventListener("click", () => { Quiz.failedSession(); renderQuiz(); });
    document.getElementById("sel-size").addEventListener("change", (e) => Quiz.setSize(e.target.value));
    document.getElementById("inp-points").addEventListener("change", (e) => { Quiz.setPoints(e.target.value); renderHome(); });
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (confirm("¿Reiniciar todo el progreso de este cuestionario?")) {
        Quiz.resetProgress();
        renderHome();
        toast("Progreso reiniciado");
      }
    });
    const resumeBtn = document.getElementById("btn-resume");
    if (resumeBtn) resumeBtn.addEventListener("click", () => {
      if (Quiz.tryResume()) renderQuiz();
      else { S().items = []; renderHome(); }
    });
    const discardBtn = document.getElementById("btn-discard");
    if (discardBtn) discardBtn.addEventListener("click", () => { S().items = []; S().results = null; renderHome(); });
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
      const checked = S().answers[q.id] || [];
      const opts = it.optOrder.map((orig, disp) => {
        const on = checked.indexOf(disp) >= 0;
        return `<label class="opt ${on ? "checked" : ""}">
          <input type="checkbox" class="hidden-input" data-q="${q.id}" data-d="${disp}" ${on ? "checked" : ""}>
          <span class="alpha">${LETTERS[disp]}</span>
          <span>${esc(q.options[orig])}</span>
        </label>`;
      }).join("");
      return `<div class="qcard" id="qcard-${q.id}" ${checked.length ? "" : "data-unanswered"}>
        <div class="qhead">
          <span class="qnum">${i + 1}<span class="muted">/${n}</span></span>
          ${q.category ? `<span class="chip">${esc(q.category)}</span>` : ""}
          <span class="chip warn" ${checked.length ? "style='display:none'" : ""}>sin responder</span>
        </div>
        <div class="qtext">${esc(q.text)}</div>
        <div class="opt-grid">${opts}</div>
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
        const answeredNow = (S().answers[qid] || []).length > 0;
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
      const opts = d.optOrder.map((orig, disp) => {
        const isC = d.q.correct.indexOf(orig) >= 0;
        const was = d.dispChecked.indexOf(disp) >= 0;
        const oCls = isC && was ? "correct" : isC ? "missed" : was ? "wrong" : "";
        const flag = isC && was ? "✓" : isC ? "correcta" : was ? "✗" : "";
        return `<div class="opt ${oCls}" style="cursor:default">
          <span class="alpha">${LETTERS[disp]}</span>
          <span>${esc(d.q.options[orig])}</span>
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
          <div class="qtext">${esc(d.q.text)}</div>
          <div class="opt-grid">${opts}</div>
          ${d.q.explanation ? `<div class="explain">${esc(d.q.explanation)}</div>` : ""}
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