"use strict";

(function () {
const CSV = (() => {
  const MAX = 1000;

  const normText = (t) => String(t || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  function detectDelimiter(line) {
    let best = ",";
    let bestN = -1;
    for (const d of [",", ";", "\t"]) {
      let n = 0;
      for (const ch of line) if (ch === d) n++;
      if (n > bestN) { bestN = n; best = d; }
    }
    return best;
  }

  function parseCSV(text) {
    const content = String(text)
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    if (!content.trim()) return [];
    const end = content.indexOf("\n");
    const firstLine = end === -1 ? content : content.slice(0, end);
    const delim = detectDelimiter(firstLine);
    const rows = [];
    let field = "", row = [], inQuotes = false;
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      if (inQuotes) {
        if (ch === '"') {
          if (content[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        row.push(field.trim());
        field = "";
      } else if (ch === "\n") {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
    row.push(field.trim());
    rows.push(row);
    return rows.filter((r) => r.some((c) => c !== ""));
  }

  const norm = (h) => h.toLowerCase()
    .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i").replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9]/g, "");
  const isPregunta = (n) => ["pregunta", "preguntas", "question", "enunciado", "texto"].includes(n);
  const isCategoria = (n) => ["categoria", "category", "tema", "materia", "area"].includes(n);
  const isCorrectas = (n) => ["correctas", "correcta", "respuestas", "respuesta", "respuestascorrectas", "clave", "answers", "answer"].includes(n);
  const isExplicacion = (n) => ["explicacion", "explicacionrespuesta", "explanation", "nota", "retroalimentacion"].includes(n);
  const isOpciones = (n) => ["opciones", "opcionesdropdown", "opcionesdedropdown", "opcionesrespuesta", "dropdown", "respuestasposibles"].includes(n);

  function parseQuestions(text) {
    const rows = parseCSV(text);
    if (!rows.length) return { ok: false, errors: ["El archivo está vacío."] };
    const header = rows[0];
    const data = rows.slice(1);
    if (!data.length) return { ok: false, errors: ["El CSV solo contiene el encabezado, no hay preguntas."] };

    let qi = -1, ci = -1, cati = -1, expi = -1, oi = -1;
    const slotCols = [];
    header.forEach((h, i) => {
      const n = norm(h);
      const sm = n.match(/^respuesta(\d+)$/);
      if (sm) slotCols.push({ i, num: parseInt(sm[1], 10) });
      else if (isPregunta(n)) { if (qi === -1) qi = i; }
      else if (isCorrectas(n)) { if (ci === -1) ci = i; }
      else if (isCategoria(n)) { if (cati === -1) cati = i; }
      else if (isExplicacion(n)) { if (expi === -1) expi = i; }
      else if (isOpciones(n)) { if (oi === -1) oi = i; }
    });
    slotCols.sort((a, b) => a.num - b.num);
    const isDropdown = slotCols.length > 0;
    if (qi === -1) qi = 0;
    if (ci === -1) ci = header.length - 1;
    if (ci <= qi) return { ok: false, errors: ["La columna 'correctas' debe estar después de la columna de la pregunta."] };
    if (data.length > MAX) return { ok: false, errors: [`El archivo tiene ${data.length} preguntas y el máximo permitido es ${MAX} (revisá el CSV o dividilo).`] };
    let hasOptCols = false;
    for (let c = qi + 1; c < ci && c < header.length; c++) {
      if (c === cati || c === expi || c === oi) continue;
      hasOptCols = true;
      break;
    }
    const isFill = !isDropdown && !hasOptCols;

    const questions = [];
    const warnings = [];
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      const line = r + 2;
      const rowErrors = [];
      const textQ = String(row[qi] || "").trim();
      if (!textQ) {
        warnings.push(`Fila ${line}: falta el texto de la pregunta. Se omitió.`);
        continue;
      }

      if (isDropdown) {
        const optsRaw = oi >= 0 ? String(row[oi] || "").trim() : "";
        const dropdown = optsRaw ? optsRaw.split(/[;|]/).map((t) => t.trim()).filter(Boolean) : [];
        const slotVals = [];
        const slotErrors = [];
        for (const sc of slotCols) {
          const v = String(row[sc.i] || "").trim();
          if (!v) continue;
          const idx = dropdown.indexOf(v);
          if (idx < 0) slotErrors.push(`'${v}' no está en la lista de opciones`);
          else slotVals.push({ text: v, idx });
        }
        if (slotVals.length || dropdown.length >= 2) {
          if (dropdown.length < 2) {
            warnings.push(`Fila ${line}: falta la columna 'opciones' con al menos 2 respuestas posibles para el dropdown. Se omitió.`);
            continue;
          }
          if (!slotVals.length) {
            warnings.push(`Fila ${line}: no hay respuestas en las columnas 'respuesta1…' (celdas vacías). Se omitió.`);
            continue;
          }
          if (slotErrors.length) {
            warnings.push(`Fila ${line}: ${slotErrors.join("; ")}. Se omitió la pregunta.`);
            continue;
          }
          questions.push({
            id: questions.length,
            type: "dropdown",
            text: textQ,
            options: [],
            slots: slotVals.map((s) => s.text),
            correctSlot: slotVals.map((s) => s.idx),
            dropdown,
            category: String(cati >= 0 ? row[cati] || "" : "").trim(),
            explanation: String(expi >= 0 ? row[expi] || "" : "").trim()
          });
          continue;
        }
      }

      const rawC = String(row[ci] || "").trim();
      const numericC = rawC ? rawC.split(/[;|,]/).every((t) => t.trim() === "" || Number.isFinite(parseInt(t.trim(), 10))) : false;
      const rowOptions = [];
      for (let c = qi + 1; c < ci && c < row.length; c++) {
        if (c === cati || c === expi || c === oi) continue;
        const v = String(row[c] || "").trim();
        if (v) rowOptions.push(v);
      }
      const hasOneOption = rowOptions.length === 1;
      const textFill = !isDropdown && !isFill && rowOptions.length === 0 && !numericC;

      if (isFill || textFill || (hasOneOption && !isDropdown)) {
        let correctVal = "";
        if (hasOneOption && !isDropdown) {
          correctVal = rowOptions[0];
        }
        const raw = String(row[ci] || "").trim();
        const accepted = raw ? raw.split(/[;|]/).map((t) => t.trim()).filter(Boolean) : [];
        const seen = new Set();
        const clean = accepted.length ? accepted.filter((t) => {
          const n = normText(t);
          if (!n || seen.has(n)) return false;
          seen.add(n);
          return true;
        }) : [normText(correctVal)];
        if (!clean.length) {
          warnings.push(`Fila ${line}: la columna 'correctas' necesita al menos una respuesta correcta como texto. Se omitió.`);
          continue;
        }
        questions.push({
          id: questions.length,
          type: "fill",
          text: textQ,
          options: [],
          correct: clean,
          category: String(cati >= 0 ? row[cati] || "" : "").trim(),
          explanation: String(expi >= 0 ? row[expi] || "" : "").trim()
        });
        continue;
      }

      const options = rowOptions;
      if (options.length < 2) rowErrors.push(`se necesitan al menos 2 opciones (se encontraron ${options.length})`);
      else if (options.length > 8) rowErrors.push(`máximo 8 opciones por pregunta (se encontraron ${options.length})`);

      const raw = String(row[ci] || "").trim();
      const tokens = raw ? raw.split(/[;|,]/) : [];
      const seen = new Set();
      const correct = [];
      for (const t of tokens) {
        const n = parseInt(t.trim(), 10);
        if (!Number.isFinite(n)) continue;
        if (n < 1 || n > options.length) {
          rowErrors.push(`la opción correcta ${n} está fuera de rango (1 a ${options.length})`);
          continue;
        }
        if (seen.has(n)) continue;
        seen.add(n);
        correct.push(n - 1);
      }
      if (!correct.length) rowErrors.push(`la columna 'correctas' no tiene índices válidos (ej. 1;3;5). Si la pregunta usa menos de 8 opciones, dejá las celdas restantes vacías`);

      if (rowErrors.length) {
        warnings.push(`Fila ${line}: ${rowErrors.join("; ")}. Se omitió la pregunta.`);
        continue;
      }

      questions.push({
        id: questions.length,
        type: "select",
        text: textQ,
        options,
        correct: correct.sort((a, b) => a - b),
        category: String(cati >= 0 ? row[cati] || "" : "").trim(),
        explanation: String(expi >= 0 ? row[expi] || "" : "").trim()
      });
    }
    if (warnings.length) return { ok: true, questions, warnings };
    return { ok: true, questions, warnings: [] };
  }

  return { parseCSV, parseQuestions, MAX, normText };
})();

if (typeof window !== "undefined") window.CSV = CSV;
if (typeof module !== "undefined" && module.exports) module.exports = CSV;
})();