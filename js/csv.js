"use strict";

(function () {
const CSV = (() => {
  const MAX = 200;

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

  function parseQuestions(text) {
    const errors = [];
    const rows = parseCSV(text);
    if (!rows.length) return { ok: false, errors: ["El archivo está vacío."] };
    const header = rows[0];
    const data = rows.slice(1);
    if (!data.length) return { ok: false, errors: ["El CSV solo contiene el encabezado, no hay preguntas."] };

    let qi = -1, ci = -1, cati = -1, expi = -1;
    header.forEach((h, i) => {
      const n = norm(h);
      if (isPregunta(n)) { if (qi === -1) qi = i; }
      else if (isCorrectas(n)) { if (ci === -1) ci = i; }
      else if (isCategoria(n)) { if (cati === -1) cati = i; }
      else if (isExplicacion(n)) { if (expi === -1) expi = i; }
    });
    if (qi === -1) qi = 0;
    if (ci === -1) ci = header.length - 1;
    if (ci <= qi) return { ok: false, errors: ["La columna 'correctas' debe estar después de la columna de la pregunta."] };
    if (data.length > MAX) errors.push(`El archivo tiene ${data.length} preguntas y el máximo permitido es ${MAX} (revisá el CSV o dividilo).`);

    const questions = [];
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      const line = r + 2;
      const textQ = String(row[qi] || "").trim();
      if (!textQ) { errors.push(`Fila ${line}: falta el texto de la pregunta.`); continue; }

      const options = [];
      for (let c = qi + 1; c < ci && c < row.length; c++) {
        if (c === cati || c === expi) continue;
        const v = String(row[c] || "").trim();
        if (v) options.push(v);
      }
      if (options.length < 2) errors.push(`Fila ${line}: se necesitan al menos 2 opciones (se encontraron ${options.length}).`);
      else if (options.length > 8) errors.push(`Fila ${line}: máximo 8 opciones por pregunta (se encontraron ${options.length}).`);

      const raw = String(row[ci] || "").trim();
      const tokens = raw ? raw.split(/[;|,]/) : [];
      const seen = new Set();
      const correct = [];
      for (const t of tokens) {
        const n = parseInt(t.trim(), 10);
        if (!Number.isFinite(n)) continue;
        if (n < 1 || n > options.length) {
          errors.push(`Fila ${line}: la opción correcta ${n} está fuera de rango (1 a ${options.length}).`);
          continue;
        }
        if (seen.has(n)) continue;
        seen.add(n);
        correct.push(n - 1);
      }
      if (!correct.length) errors.push(`Fila ${line}: la columna 'correctas' no tiene índices válidos (ej. 1;3;5). Todas las filas deben tener tantas celdas como el encabezado: si la pregunta usa menos de 8 opciones, dejá las celdas restantes vacías.`);

      questions.push({
        id: questions.length,
        text: textQ,
        options,
        correct: correct.sort((a, b) => a - b),
        category: String(cati >= 0 ? row[cati] || "" : "").trim(),
        explanation: String(expi >= 0 ? row[expi] || "" : "").trim()
      });
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true, questions };
  }

  return { parseCSV, parseQuestions, MAX };
})();

if (typeof window !== "undefined") window.CSV = CSV;
if (typeof module !== "undefined" && module.exports) module.exports = CSV;
})();