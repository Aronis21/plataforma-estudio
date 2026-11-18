/* NEXUS · Práctica: consola SQL con ejercicios, práctica por tema y hoja de nivel.
 *
 * Rutas (todas bajo #/practica):
 *   #/practica                              Mi nivel (estadísticas y qué reforzar)
 *   #/practica/sql/ejercicios[/<concepto>]  ejercicios T-SQL por nivel (se muestran dentro de la pestaña Datos)
 *   #/practica/sql/ej/<id>                  un ejercicio con su consola T-SQL
 *   #/practica/sql/consola[/<base>]         consola T-SQL libre
 *   #/practica/sql/reto                     reto T-SQL del día
 *   #/practica/js/ejercicios[/<concepto>]   ejercicios de JavaScript (pestaña JavaScript)
 *   #/practica/js/ej/<id> · /js/consola · /js/reto
 *   #/practica/<idCurso>                    pestaña del curso (Datos abre los ejercicios T-SQL)
 *   #/practica/<idCurso>/<n>                módulo n del curso: capítulos con preguntas
 *   #/practica/<idCurso>/<n>/<idCap|todo>   práctica de preguntas (en orden: primero las falladas)
 *
 * Todo se guarda en este navegador, clave "nexus:practica":
 * {
 *   version: 1,
 *   preguntas: { "curso|cap|pregunta": { aciertos, fallos, ultima: bool, fecha } },
 *   historial: [{ f, tipo: "p" | "sql" | "js", curso, mod, cap, concepto, ref, ok }],   (últimas 3000)
 *   sql, js:   { [idEjercicio]: { intentos, resuelto, revelado, fecha } },
 *   borradores:{ [idEjercicio | "libre:<base>" | "js:libre"]: "código" },
 *   reto, retoJS: { fecha, id, resuelto },  retosHechos, retosJSHechos: n
 * }
 */
(function () {
  const { escapar, enLinea } = window.Texto;
  const P = window.Progreso;
  const C = window.Cuaderno;
  const D = window.PracticaDatos;
  const JSD = window.PracticaJS;
  const T = window.TSQL;
  const CLAVE = "nexus:practica";
  const MAX_HISTORIAL = 3000;

  const NIVEL_EJ = { basico: "Básico", intermedio: "Intermedio", avanzado: "Avanzado" };
  const ORDEN_NIVEL = ["basico", "intermedio", "avanzado"];
  const CONCEPTOS = ["Consultas y filtros", "Agregación", "JOIN", "NULL, CASE e IIF", "Fechas y texto", "Subconsultas y CTE", "Funciones de ventana", "JSON"];
  const CONCEPTOS_JS = Object.keys(JSD.lecciones);
  // Datos de cada clase de ejercicio con consola
  const CLASES = {
    sql: { lista: () => D.ejercicios, conceptos: CONCEPTOS, reto: "reto", contador: "retosHechos", nombre: "T-SQL", ruta: "#/practica/sql" },
    js: { lista: () => JSD.ejercicios, conceptos: CONCEPTOS_JS, reto: "retoJS", contador: "retosJSHechos", nombre: "JavaScript", ruta: "#/practica/js" },
  };

  // ---------- Almacenamiento ----------
  function vacio() {
    return { version: 1, preguntas: {}, historial: [], sql: {}, js: {}, borradores: {}, reto: null, retosHechos: 0, retoJS: null, retosJSHechos: 0 };
  }
  function leer() {
    try {
      return { ...vacio(), ...(JSON.parse(localStorage.getItem(CLAVE)) || {}) };
    } catch (_) {
      return vacio();
    }
  }
  function guardar(d) {
    try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch (_) { /* sin almacenamiento */ }
  }
  function cambiar(fn) {
    const d = leer();
    const r = fn(d);
    guardar(d);
    return r;
  }
  function anotar(d, entrada) {
    d.historial.push({ f: new Date().toISOString(), ...entrada });
    if (d.historial.length > MAX_HISTORIAL) d.historial.splice(0, d.historial.length - MAX_HISTORIAL);
  }

  function registrarPregunta({ curso, mod, cap, q, ok }) {
    cambiar((d) => {
      const k = `${curso}|${cap}|${q}`;
      const r = d.preguntas[k] || { aciertos: 0, fallos: 0 };
      if (ok) r.aciertos++; else r.fallos++;
      r.ultima = ok;
      r.fecha = new Date().toISOString();
      d.preguntas[k] = r;
      anotar(d, { tipo: "p", curso, mod, cap, ref: q, ok });
    });
    C.registrarActividad();
  }

  // Un ejercicio (T-SQL o JavaScript) "cuenta" para tu nivel cuando lo resuelves (acierto)
  // o cuando ves la solución sin haberlo resuelto (fallo).
  function registrarEj(clase, ej, evento) {
    const K = CLASES[clase];
    return cambiar((d) => {
      const r = d[clase][ej.id] || { intentos: 0, resuelto: false, revelado: false };
      if (evento === "intento") r.intentos++;
      if (evento === "resuelto") {
        r.intentos++;
        if (r.resueltoHoy !== C.fechaISO() && r.reveladoHoy !== C.fechaISO()) anotar(d, { tipo: clase, concepto: ej.concepto, ref: ej.id, ok: true });
        r.resuelto = true;
        r.resueltoHoy = C.fechaISO();
        const reto = d[K.reto];
        if (reto && reto.id === ej.id && reto.fecha === C.fechaISO() && !reto.resuelto) {
          reto.resuelto = true;
          d[K.contador] = (d[K.contador] || 0) + 1;
        }
      }
      if (evento === "revelado") {
        if (!r.resuelto && r.reveladoHoy !== C.fechaISO()) anotar(d, { tipo: clase, concepto: ej.concepto, ref: ej.id, ok: false });
        r.revelado = true;
        r.reveladoHoy = C.fechaISO();
      }
      r.fecha = new Date().toISOString();
      d[clase][ej.id] = r;
      return r;
    });
  }

  function borrador(clave) { return leer().borradores[clave]; }
  function guardarBorrador(clave, texto) { cambiar((d) => { d.borradores[clave] = texto; }); }

  function retoDeHoy(clase) {
    const hoy = C.fechaISO();
    const K = CLASES[clase];
    return cambiar((d) => {
      const actual = d[K.reto];
      if (actual && actual.fecha === hoy && K.lista().some((e) => e.id === actual.id)) return actual;
      // El reto del día es el siguiente ejercicio sin resolver en el orden de la lista (por nivel).
      const lista = ejerciciosOrdenados(clase);
      const sig = lista.find((e) => !(d[clase][e.id] && d[clase][e.id].resuelto) && (!actual || e.id !== actual.id)) || lista[Number(hoy.replace(/-/g, "")) % lista.length];
      d[K.reto] = { fecha: hoy, id: sig.id, resuelto: false };
      return d[K.reto];
    });
  }

  function exportar() { return leer(); }
  function importar(datos) { if (datos && typeof datos === "object") guardar({ ...vacio(), ...datos }); }

  // ---------- Cálculo del nivel ----------
  const NIVELES = [
    { id: "principiante", nombre: "Principiante", min: 0 },
    { id: "basico", nombre: "Básico", min: 35 },
    { id: "intermedio", nombre: "Intermedio", min: 55 },
    { id: "avanzado", nombre: "Avanzado", min: 70 },
    { id: "profesional", nombre: "Profesional", min: 85 },
  ];
  const MIN_PROFESIONAL = 20; // respuestas mínimas para poder ser "Profesional"

  // entradas: [{ ok }] de la más antigua a la más reciente. examen: { aciertos, total }.
  function evaluar(entradas, examen = { aciertos: 0, total: 0 }) {
    const recientes = entradas.slice(-40);
    let pa = 0, pt = 0;
    recientes.forEach((e, i) => {
      const w = 0.5 + (0.5 * (i + 1)) / recientes.length; // lo reciente pesa más
      pt += w;
      if (e.ok) pa += w;
    });
    const n = entradas.length + examen.total;
    if (!n) return { n: 0, precision: null, puntaje: null, nivel: null };
    const precision = (pa + examen.aciertos) / (pt + examen.total);
    const confianza = Math.min(1, n / MIN_PROFESIONAL);
    const puntaje = Math.round(100 * precision * (0.6 + 0.4 * confianza));
    let nivel = NIVELES[0];
    for (const nv of NIVELES) if (puntaje >= nv.min) nivel = nv;
    if (nivel.id === "profesional" && n < MIN_PROFESIONAL) nivel = NIVELES[3];
    return { n, precision: Math.round(precision * 100), puntaje, nivel };
  }

  function insignia(ev) {
    if (!ev || !ev.nivel) return `<span class="nivel-insignia sin">Sin datos</span>`;
    return `<span class="nivel-insignia ${ev.nivel.id}">${ev.nivel.nombre}</span>`;
  }
  function barraNivel(ev) {
    const pct = ev && ev.puntaje != null ? ev.puntaje : 0;
    return `<span class="barra-nivel ${ev && ev.nivel ? ev.nivel.id : "sin"}" role="img" aria-label="Puntaje ${pct} de 100"><span style="width:${pct}%"></span></span>`;
  }

  // ---------- Cursos: módulos y preguntas ----------
  function nombreCorto(mod) {
    return String(mod).replace(/^m[óo]dulo\s*\d+\s*[:·-]\s*/i, "").replace(/^\d+\s*·\s*/, "").replace(/^EXP\s*\d+\s*·\s*/i, "").trim();
  }

  // Nombre breve para las sub-pestañas: "SQL Analítico y Arquitectura…" → "SQL Analítico"
  function etiquetaCorta(nombre) {
    let t = nombreCorto(nombre);
    for (const sep of [" y ", ", ", " para "]) {
      const i = t.indexOf(sep);
      if (i >= 6) t = t.slice(0, i);
    }
    return t;
  }

  // Módulos del curso con sus capítulos que tienen preguntas disponibles
  function modulosPractica(ctx, curso) {
    return ctx.modulosDe(curso).map(([nombre, caps], i) => {
      const conPreguntas = caps.filter((c) => ctx.capDisponible(curso, c) && (c.exam || []).length);
      return { i, nombre, corto: nombreCorto(nombre), caps, conPreguntas, total: conPreguntas.reduce((s, c) => s + c.exam.length, 0) };
    });
  }

  function evaluarModulo(curso, mod, d) {
    const entradas = d.historial.filter((h) => h.tipo === "p" && h.curso === curso.id && h.mod === mod.nombre);
    const examen = { aciertos: 0, total: 0 };
    for (const cap of mod.conPreguntas) {
      const ex = P.capitulo(curso.id, cap.id).examen;
      if (ex && ex.total) { examen.aciertos += ex.ultimo ?? ex.mejor ?? 0; examen.total += ex.total; }
    }
    return evaluar(entradas, examen);
  }

  function evaluarConcepto(concepto, d, clase = "sql") {
    return evaluar(d.historial.filter((h) => h.tipo === clase && h.concepto === concepto));
  }

  // Agrega varias evaluaciones en una (ponderadas por número de respuestas)
  function combinar(evs) {
    const con = evs.filter((e) => e.n);
    if (!con.length) return { n: 0, nivel: null, puntaje: null, precision: null };
    const n = con.reduce((s, e) => s + e.n, 0);
    const puntaje = Math.round(con.reduce((s, e) => s + e.puntaje * e.n, 0) / n);
    const precision = Math.round(con.reduce((s, e) => s + e.precision * e.n, 0) / n);
    let nivel = NIVELES[0];
    for (const nv of NIVELES) if (puntaje >= nv.min) nivel = nv;
    if (nivel.id === "profesional" && n < MIN_PROFESIONAL) nivel = NIVELES[3];
    return { n, puntaje, precision, nivel };
  }

  // Estado de una pregunta según tu historial: "mal" | "bien" | "nueva"
  function estadoPregunta(d, curso, cap, q) {
    const r = d.preguntas[`${curso}|${cap}|${q}`];
    if (!r) return "nueva";
    return r.ultima ? "bien" : "mal";
  }

  // ---------- SQLite (sql.js, incluido en assets/vendor) ----------
  let promesaSQL = null;
  function cargarSQL() {
    if (!promesaSQL) {
      promesaSQL = new Promise((resolver, rechazar) => {
        const s = document.createElement("script");
        s.src = "assets/vendor/sqljs/sql-wasm.js";
        s.onload = () => window.initSqlJs({ locateFile: (f) => `assets/vendor/sqljs/${f}` }).then(resolver, rechazar);
        s.onerror = () => rechazar(new Error("No se pudo cargar el motor SQL."));
        document.head.appendChild(s);
      }).catch((err) => { promesaSQL = null; throw err; });
    }
    return promesaSQL;
  }
  const basesAbiertas = {};
  function baseNueva(SQL, nombre) {
    const db = new SQL.Database();
    db.exec(D.bases[nombre].sql);
    T.registrar(db);
    return db;
  }
  function baseConsola(SQL, nombre) {
    if (!basesAbiertas[nombre]) basesAbiertas[nombre] = baseNueva(SQL, nombre);
    return basesAbiertas[nombre];
  }
  function restaurarBase(SQL, nombre) {
    if (basesAbiertas[nombre]) basesAbiertas[nombre].close();
    basesAbiertas[nombre] = baseNueva(SQL, nombre);
    return basesAbiertas[nombre];
  }

  // Ejecuta y devuelve el último conjunto de resultados
  function ejecutar(db, sql) {
    const t0 = performance.now();
    const res = db.exec(sql);
    const ms = Math.round(performance.now() - t0);
    const ultimo = res[res.length - 1] || null;
    return { ultimo, ms, cambios: db.getRowsModified() };
  }

  // ---------- Comparación de resultados ----------
  function celdaIgual(a, b) {
    if (a === null || b === null) return a === b;
    const na = typeof a === "number" ? a : Number(a);
    const nb = typeof b === "number" ? b : Number(b);
    if ((typeof a === "number" || typeof b === "number") && !isNaN(na) && !isNaN(nb) && String(a).trim() !== "" && String(b).trim() !== "") {
      if (Number.isInteger(na) && Number.isInteger(nb)) return na === nb;
      return Math.abs(na - nb) <= 0.011;
    }
    return String(a).trim() === String(b).trim();
  }
  function filaIgual(f1, f2) { return f1.length === f2.length && f1.every((v, i) => celdaIgual(v, f2[i])); }
  function claveFila(f) {
    return f.map((v) => (v === null ? "∅" : typeof v === "number" ? v.toFixed(2) : !isNaN(Number(v)) && String(v).trim() !== "" ? Number(v).toFixed(2) : String(v).trim())).join("\u0001");
  }
  function ordenar(filas) { return [...filas].sort((a, b) => (claveFila(a) < claveFila(b) ? -1 : claveFila(a) > claveFila(b) ? 1 : 0)); }

  function comparar(tuyo, esperado, exigeOrden) {
    const t = tuyo ? tuyo.values : [];
    const e = esperado ? esperado.values : [];
    const colsT = tuyo ? tuyo.columns.length : 0;
    const colsE = esperado ? esperado.columns.length : 0;
    if (!tuyo) return { ok: false, msg: "Tu consulta no devolvió ninguna tabla de resultados. Recuerda terminar con un SELECT." };
    if (colsT !== colsE) return { ok: false, msg: `Tu resultado tiene ${colsT} ${colsT === 1 ? "columna" : "columnas"} y se esperaban ${colsE}.` };
    if (t.length !== e.length) return { ok: false, msg: `Tu resultado tiene ${t.length} ${t.length === 1 ? "fila" : "filas"} y se esperaban ${e.length}.` };
    if (exigeOrden) {
      const i = t.findIndex((f, k) => !filaIgual(f, e[k]));
      if (i === -1) return { ok: true };
      const mismas = ordenar(t).every((f, k) => filaIgual(f, ordenar(e)[k]));
      if (mismas) return { ok: false, msg: "Las filas son correctas, pero el orden no es el que pide el enunciado." };
      return { ok: false, msg: `Hay valores distintos. La primera diferencia está en la fila ${i + 1}.` };
    }
    const ts = ordenar(t);
    const es = ordenar(e);
    const i = ts.findIndex((f, k) => !filaIgual(f, es[k]));
    if (i === -1) return { ok: true };
    // ¿Las columnas están en otro orden?
    if (colsT > 1) {
      const firma = (filas) => ordenar(filas.map((f) => [...f].sort((x, y) => String(x).localeCompare(String(y))))).map(claveFila).join("|");
      if (firma(t) === firma(e)) return { ok: false, msg: "Los valores son correctos, pero las columnas están en otro orden. Respeta el orden que pide el enunciado." };
    }
    return { ok: false, msg: "Tienes el número de filas correcto, pero algunos valores no coinciden con lo esperado." };
  }

  // ---------- Utilidades de vista ----------
  function ejerciciosOrdenados(clase = "sql") {
    const K = CLASES[clase];
    return [...K.lista()].sort((a, b) => ORDEN_NIVEL.indexOf(a.nivel) - ORDEN_NIVEL.indexOf(b.nivel) || K.conceptos.indexOf(a.concepto) - K.conceptos.indexOf(b.concepto) || a.id.localeCompare(b.id));
  }
  const slug = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const conceptoDeSlug = (s, lista = CONCEPTOS) => lista.find((c) => slug(c) === s) || null;

  // Las columnas sin alias muestran la expresión: se deshace la traducción para que se vea en T-SQL
  const nombreColumna = (c) => String(c).replace(/\bT_(\w+)\('(\w+)',\s*/g, "$1($2, ").replace(/\bT_(LEFT|RIGHT)\(/g, "$1(");

  function tablaResultado(r, max = 200) {
    if (!r) return "";
    const filas = r.values.slice(0, max);
    return `<div class="tabla-scroll"><table class="tabla-resultado">
      <thead><tr>${r.columns.map((c) => `<th>${escapar(nombreColumna(c))}</th>`).join("")}</tr></thead>
      <tbody>${filas.map((f) => `<tr>${f.map((v) => (v === null ? '<td class="nulo">NULL</td>' : `<td class="${typeof v === "number" ? "num-celda" : ""}">${escapar(typeof v === "number" && !Number.isInteger(v) ? String(Math.round(v * 10000) / 10000) : String(v))}</td>`)).join("")}</tr>`).join("")}</tbody>
    </table></div>
    <p class="small muted" style="margin:.4rem 0 0">${r.values.length} ${r.values.length === 1 ? "fila" : "filas"}${r.values.length > max ? ` · se muestran las primeras ${max}` : ""}</p>`;
  }

  // Pestañas principales: Mi nivel, un tema por curso y JavaScript (después de Web)
  function pestanasPrincipales(cursos, activa) {
    const items = [["nivel", "Mi nivel", "#/practica"]];
    let conJS = false;
    for (const c of cursos) {
      items.push([c.id, c._meta.separador || c.title, `#/practica/${encodeURIComponent(c.id)}`]);
      if (c._meta.tema === "web") { items.push(["js", "JavaScript", "#/practica/js/ejercicios"]); conJS = true; }
    }
    if (!conJS) items.push(["js", "JavaScript", "#/practica/js/ejercicios"]);
    return `<nav class="tabs practica-tabs" aria-label="Temas de práctica">${items
      .map(([id, txt, href]) => `<a class="tab ${id === activa ? "activa" : ""}" href="${href}" ${id === activa ? 'aria-current="page"' : ""}>${escapar(txt)}</a>`)
      .join("")}</nav>`;
  }
  function subpestanas(items, activa, etiqueta, titulo) {
    return `<nav class="subtabs" aria-label="${escapar(etiqueta)}">${titulo ? `<span class="subtabs-titulo">${escapar(titulo)}</span>` : ""}${items
      .map(([id, txt, href, extra]) => `<a class="subtab ${id === activa ? "activa" : ""}" href="${href}" ${id === activa ? 'aria-current="page"' : ""}>${escapar(txt)}${extra ? ` <span class="cuenta">${escapar(extra)}</span>` : ""}</a>`)
      .join("")}</nav>`;
  }

  function cabecera(mano, titulo, lead) {
    return `<header class="practica-cabecera">
      <div class="fecha-mano">${escapar(mano)}</div>
      <h1 class="titulo-hoja">${escapar(titulo)}</h1>
      ${lead ? `<p class="lead" style="margin-top:.6rem">${lead}</p>` : ""}
    </header>`;
  }

  const cursoDatos = (cursos) => cursos.find((c) => c._meta.tema === "datos") || null;

  // Navegación de la pestaña Datos: T-SQL (ejercicios, consola, reto) y preguntas por módulo
  function navDatos(ctx, cursos, activa) {
    const d = leer();
    const reto = d.reto;
    const hecho = reto && reto.fecha === C.fechaISO() && reto.resuelto;
    let html = subpestanas([
      ["sql-ejercicios", "Ejercicios T-SQL", "#/practica/sql/ejercicios"],
      ["sql-consola", "Consola T-SQL", "#/practica/sql/consola"],
      ["sql-reto", "Reto del día", "#/practica/sql/reto", hecho ? "✓" : ""],
    ], activa, "T-SQL", "T-SQL");
    const curso = cursoDatos(cursos);
    if (curso) {
      const mods = modulosPractica(ctx, curso).filter((m) => m.total);
      if (mods.length) html += subpestanas(mods.map((m) => [`mod-${m.i}`, etiquetaCorta(m.nombre), `#/practica/${encodeURIComponent(curso.id)}/${m.i}`]), activa, "Preguntas por módulo", "Preguntas");
    }
    return `<div class="nav-tema">${html}</div>`;
  }

  function navJS(activa) {
    const reto = leer().retoJS;
    const hecho = reto && reto.fecha === C.fechaISO() && reto.resuelto;
    return `<div class="nav-tema">${subpestanas([
      ["ejercicios", "Ejercicios", "#/practica/js/ejercicios"],
      ["consola", "Consola", "#/practica/js/consola"],
      ["reto", "Reto del día", "#/practica/js/reto", hecho ? "✓" : ""],
    ], activa, "Secciones de JavaScript")}</div>`;
  }

  // ======================================================================
  //  Vista principal
  // ======================================================================
  async function vista(ctx, partes) {
    await ctx.obtenerCatalogo();
    const todos = await ctx.cursosVisibles();
    const cursos = todos.filter((c) => !c._error);
    ctx.mostrarSidebar(null);
    const [primero, ...resto] = partes;

    if (!primero) return vistaNivel(ctx, cursos);
    if (primero === "sql") return vistaSQL(ctx, cursos, resto);
    if (primero === "js") return vistaJS(ctx, cursos, resto);
    const curso = cursos.find((c) => c.id === primero);
    if (!curso) throw new Error(`No encontré el tema "${primero}" en la práctica.`);
    if (curso._meta.tema === "datos" && !resto.length) return vistaSQL(ctx, cursos, []);
    return vistaCurso(ctx, cursos, curso, resto);
  }

  function marco(ctx, cursos, activa, contenido, margen) {
    ctx.app.innerHTML = `<div class="pagina practica">
      <div class="pagina-main">
        ${pestanasPrincipales(cursos, activa)}
        ${contenido}
      </div>
      ${margen ? `<aside class="margen" aria-label="Margen">${margen}</aside>` : ""}
    </div>`;
  }

  // ---------------------------- Mi nivel ----------------------------
  function tablaConceptos(clase, d, evs) {
    const K = CLASES[clase];
    return `<table class="tabla-nivel">
      <thead><tr><th>Concepto</th><th>Nivel</th><th class="col-barra">Puntaje</th><th>Resueltos</th><th>Respuestas</th></tr></thead>
      <tbody>${evs.map(({ c, ev }) => {
        const del = K.lista().filter((e) => e.concepto === c);
        const hechos = del.filter((e) => d[clase][e.id] && d[clase][e.id].resuelto).length;
        return `<tr><td><a href="${K.ruta}/ejercicios/${slug(c)}">${escapar(c)}</a></td><td>${insignia(ev)}</td><td class="col-barra">${barraNivel(ev)}</td>
          <td class="num-celda">${hechos}/${del.length}</td><td class="num-celda">${ev.n}</td></tr>`;
      }).join("")}</tbody>
    </table>`;
  }

  function vistaNivel(ctx, cursos) {
    ctx.aplicarTema(null, "practica");
    ctx.setCrumbs([{ texto: "Hoy", href: "#/" }, { texto: "Práctica" }, { texto: "Mi nivel" }]);
    document.title = "Mi nivel · Práctica · NEXUS";
    const d = leer();
    const cursoWeb = cursos.find((c) => c._meta.tema === "web");

    // Ejercicios con consola por concepto
    const evSQL = CONCEPTOS.map((c) => ({ c, ev: evaluarConcepto(c, d, "sql") }));
    const evJS = CONCEPTOS_JS.map((c) => ({ c, ev: evaluarConcepto(c, d, "js") }));
    const resueltosSQL = D.ejercicios.filter((e) => d.sql[e.id] && d.sql[e.id].resuelto).length;
    const resueltosJS = JSD.ejercicios.filter((e) => d.js[e.id] && d.js[e.id].resuelto).length;
    const evTotalJS = combinar(evJS.map((x) => x.ev));

    // Cursos por módulo (Datos incluye además T-SQL)
    const bloques = cursos.map((curso) => {
      const prep = curso._meta && curso._meta.estado === "en-preparacion";
      const mods = modulosPractica(ctx, curso).filter((m) => m.total);
      const evMods = mods.map((m) => ({ m, ev: evaluarModulo(curso, m, d) }));
      const esDatos = curso._meta.tema === "datos";
      const evs = evMods.map((x) => x.ev).concat(esDatos ? evSQL.map((x) => x.ev) : []);
      return { curso, prep, evMods, esDatos, ev: combinar(evs) };
    });

    // Resumen por tema
    const resumen = [];
    for (const b of bloques) {
      const practicados = b.evMods.filter((x) => x.ev.n).length;
      resumen.push({
        nombre: b.curso._meta.separador || b.curso.title,
        sub: b.esDatos
          ? `${resueltosSQL}/${D.ejercicios.length} ejercicios T-SQL · ${practicados}/${b.evMods.length} subtemas`
          : b.prep || !b.evMods.length ? "En preparación" : `${practicados}/${b.evMods.length} subtemas practicados`,
        ev: b.ev, href: `#/practica/${encodeURIComponent(b.curso.id)}`, clase: ctx.temaDe(b.curso._meta),
      });
      if (b.curso._meta.tema === "web") resumen.push({ nombre: "JavaScript", sub: `${resueltosJS}/${JSD.ejercicios.length} ejercicios resueltos`, ev: evTotalJS, href: "#/practica/js/ejercicios", clase: "web" });
    }
    if (!cursoWeb) resumen.push({ nombre: "JavaScript", sub: `${resueltosJS}/${JSD.ejercicios.length} ejercicios resueltos`, ev: evTotalJS, href: "#/practica/js/ejercicios", clase: "web" });
    const resumenHTML = `<div class="niveles-resumen">${resumen.map((r) => `<a class="nivel-tema ${r.clase}" href="${r.href}">
        <span class="etiqueta">${escapar(r.nombre)}</span>
        ${insignia(r.ev)}
        ${barraNivel(r.ev)}
        <span class="small muted">${r.ev.n ? `${r.ev.precision}% de aciertos · ${r.ev.n} respuestas` : "Aún sin respuestas"}</span>
        <span class="small muted">${escapar(r.sub)}</span>
      </a>`).join("")}</div>`;

    // Qué reforzar
    const nombreDatos = (cursoDatos(cursos) && cursoDatos(cursos)._meta.separador) || "Datos";
    const candidatos = [];
    for (const { c, ev } of evSQL) {
      if (ev.n && ev.puntaje < 70) candidatos.push({ ev, titulo: `${nombreDatos} · T-SQL · ${c}`, motivo: motivo(ev), accion: `#/practica/sql/ejercicios/${slug(c)}`, txtAccion: "Practicar ejercicios" });
    }
    for (const { c, ev } of evJS) {
      if (!ev.n || ev.puntaje >= 70) continue;
      const lec = cursoWeb && JSD.lecciones[c] && cursoWeb.chapters.find((x) => x.id === JSD.lecciones[c]);
      candidatos.push({
        ev, titulo: `JavaScript · ${c}`, motivo: motivo(ev),
        repaso: lec ? { href: `#/curso/${cursoWeb.id}/${lec.id}`, txt: `Repasa ${lec.code || lec.title}` } : null,
        accion: `#/practica/js/ejercicios/${slug(c)}`, txtAccion: "Practicar ejercicios",
      });
    }
    for (const b of bloques) {
      for (const { m, ev } of b.evMods) {
        if (!ev.n || ev.puntaje >= 70) continue;
        const capFlojo = capituloMasFallado(d, b.curso, m);
        candidatos.push({
          ev, titulo: `${b.curso._meta.separador || b.curso.title} · ${m.corto}`, motivo: motivo(ev),
          repaso: capFlojo ? { href: `#/curso/${b.curso.id}/${capFlojo.cap.id}`, txt: `Repasa ${capFlojo.cap.code || capFlojo.cap.title}${capFlojo.fallos ? ` (${capFlojo.fallos} ${capFlojo.fallos === 1 ? "fallo" : "fallos"})` : ""}` } : null,
          accion: `#/practica/${encodeURIComponent(b.curso.id)}/${m.i}${capFlojo ? "/" + encodeURIComponent(capFlojo.cap.id) : ""}`, txtAccion: "Practicar",
        });
      }
    }
    candidatos.sort((a, b) => a.ev.puntaje - b.ev.puntaje);
    // Temas aún sin practicar de capítulos que ya leíste
    const sinPracticar = [];
    for (const b of bloques) {
      for (const { m, ev } of b.evMods) {
        if (ev.n) continue;
        const leidos = m.conPreguntas.filter((c) => P.estado(b.curso.id, c.id) !== "pendiente").length;
        if (leidos) sinPracticar.push({ titulo: `${b.curso._meta.separador || b.curso.title} · ${m.corto}`, leidos, href: `#/practica/${encodeURIComponent(b.curso.id)}/${m.i}` });
      }
    }
    const reforzarHTML = candidatos.length || sinPracticar.length
      ? `<ol class="reforzar">${candidatos.slice(0, 6).map((x) => `<li>
          <div class="reforzar-cab"><strong>${escapar(x.titulo)}</strong>${insignia(x.ev)}</div>
          <p class="small muted">${escapar(x.motivo)}</p>
          <div class="row">${x.repaso ? `<a class="btn ghost" href="${x.repaso.href}">${escapar(x.repaso.txt)}</a>` : ""}<a class="btn" href="${x.accion}">${escapar(x.txtAccion)}</a></div>
        </li>`).join("")}
        ${sinPracticar.slice(0, Math.max(0, 6 - candidatos.length)).map((x) => `<li>
          <div class="reforzar-cab"><strong>${escapar(x.titulo)}</strong><span class="nivel-insignia sin">Sin practicar</span></div>
          <p class="small muted">Ya leíste ${x.leidos} ${x.leidos === 1 ? "capítulo" : "capítulos"} de este tema pero aún no lo has practicado.</p>
          <div class="row"><a class="btn" href="${x.href}">Practicar</a></div>
        </li>`).join("")}</ol>`
      : `<p class="prep-aviso">${d.historial.length ? "¡Vas bien! Ningún tema baja de Avanzado. Sigue practicando para llegar a Profesional." : "Todavía no hay resultados. Resuelve ejercicios de T-SQL en Datos o de JavaScript, o responde preguntas por módulo, y aquí verás qué reforzar."}</p>`;

    // Detalle por tema (libro mayor)
    const jsHTML = `<section class="detalle-tema" aria-label="JavaScript">
      <h3 class="h-mano"><span class="punto-tema web" aria-hidden="true"></span>JavaScript <span class="small muted">· ejercicios por concepto</span></h3>
      ${tablaConceptos("js", d, evJS)}
    </section>`;
    let detalleHTML = "";
    for (const b of bloques) {
      const tema = ctx.temaDe(b.curso._meta);
      const nombre = b.curso._meta.separador || b.curso.title;
      if (b.prep || !b.evMods.length) {
        detalleHTML += `<section class="detalle-tema"><h3 class="h-mano">${escapar(nombre)}</h3><p class="prep-aviso">Este cuaderno está en preparación: aún no tiene preguntas para practicar.</p></section>`;
      } else {
        detalleHTML += `<section class="detalle-tema" aria-label="${escapar(b.curso.title)}">
          <h3 class="h-mano"><span class="punto-tema ${tema}" aria-hidden="true"></span>${escapar(nombre)} <span class="small muted">· ${escapar(b.curso.title)}</span></h3>
          ${b.esDatos ? `<p class="etiqueta" style="margin:.6rem 0 .3rem">T-SQL · ejercicios de consola por concepto</p>${tablaConceptos("sql", d, evSQL)}<p class="etiqueta" style="margin:1.2rem 0 .3rem">Preguntas por módulo</p>` : ""}
          <table class="tabla-nivel">
            <thead><tr><th>Subtema</th><th>Nivel</th><th class="col-barra">Puntaje</th><th>Aciertos</th><th>Respuestas</th></tr></thead>
            <tbody>${b.evMods.map(({ m, ev }) => `<tr>
              <td><a href="#/practica/${encodeURIComponent(b.curso.id)}/${m.i}">${escapar(m.corto)}</a></td>
              <td>${insignia(ev)}</td>
              <td class="col-barra">${barraNivel(ev)}</td>
              <td class="num-celda">${ev.n ? ev.precision + "%" : "—"}</td>
              <td class="num-celda">${ev.n}</td></tr>`).join("")}</tbody>
          </table>
        </section>`;
      }
      if (b.curso._meta.tema === "web") detalleHTML += jsHTML;
    }
    if (!cursoWeb) detalleHTML += jsHTML;

    // Margen: preguntas que más fallas + cómo se calcula
    const falladas = [];
    for (const [k, r] of Object.entries(d.preguntas)) {
      if (!r.fallos) continue;
      const [idCurso, idCap, idQ] = k.split("|");
      const curso = cursos.find((c) => c.id === idCurso);
      const cap = curso && curso.chapters.find((c) => c.id === idCap);
      const q = cap && (cap.exam || []).find((x) => x.id === idQ);
      if (!q) continue;
      const mod = modulosPractica(ctx, curso).find((m) => m.caps.includes(cap));
      falladas.push({ r, q, curso, cap, mod });
    }
    falladas.sort((a, b) => (a.r.ultima === b.r.ultima ? 0 : a.r.ultima ? 1 : -1) || b.r.fallos - a.r.fallos);
    const falladasHTML = falladas.length
      ? `<ul class="lista-falladas">${falladas.slice(0, 6).map((x) => `<li>
          <a href="#/practica/${encodeURIComponent(x.curso.id)}/${x.mod ? x.mod.i : 0}/${encodeURIComponent(x.cap.id)}">${enLinea(recortar(x.q.question, 110))}</a>
          <span class="small muted">${escapar(x.cap.code || "")} · ${x.r.fallos} ${x.r.fallos === 1 ? "fallo" : "fallos"}${x.r.ultima ? " · ya la acertaste" : ""}</span>
        </li>`).join("")}</ul>`
      : `<p class="nota-mano" style="color:var(--tinta-2)">Aquí aparecerán las preguntas que más se te resisten.</p>`;
    const margen = `<div class="margen-titulo">Preguntas que más fallas</div>
      ${falladasHTML}
      <div class="nota-adhesiva der" style="margin-top:.5rem">
        <span class="etiqueta">Cómo se calcula tu nivel</span>
        <p style="font-size:1.2rem">Cuenta tus aciertos en la práctica y tu último examen de cada capítulo. Lo reciente pesa más. Para ser Profesional hacen falta ${MIN_PROFESIONAL} respuestas o más.</p>
      </div>
      <div class="margen-pie">
        <div class="fila"><span>Respuestas de práctica</span><span>${d.historial.length}</span></div>
        <div class="fila"><span>Ejercicios T-SQL resueltos</span><span>${resueltosSQL}/${D.ejercicios.length}</span></div>
        <div class="fila"><span>Ejercicios JavaScript resueltos</span><span>${resueltosJS}/${JSD.ejercicios.length}</span></div>
        <div class="fila"><span>Retos del día completados</span><span>${(d.retosHechos || 0) + (d.retosJSHechos || 0)}</span></div>
      </div>`;

    marco(ctx, cursos, "nivel", `
      ${cabecera("práctica", "Mi nivel", "Tu nivel en cada tema según tus resultados, y lo que te conviene reforzar.")}
      ${resumenHTML}
      <section style="margin-top:2.2rem" aria-labelledby="tReforzar">
        <h2 class="h-mano" id="tReforzar">Qué reforzar</h2>
        ${reforzarHTML}
      </section>
      <section style="margin-top:2.2rem" aria-labelledby="tDetalle">
        <h2 class="h-mano" id="tDetalle">Detalle por tema</h2>
        ${detalleHTML}
      </section>`, margen);
  }

  function motivo(ev) {
    if (ev.n < 5) return `Solo ${ev.n} ${ev.n === 1 ? "respuesta" : "respuestas"} con ${ev.precision}% de aciertos: practica más para confirmar tu nivel.`;
    if (ev.precision < 50) return `Aciertas ${ev.precision}% de ${ev.n} respuestas: menos de la mitad. Vuelve a la lección antes de practicar.`;
    return `Aciertas ${ev.precision}% de ${ev.n} respuestas. Con un poco más de práctica subes de nivel.`;
  }

  function capituloMasFallado(d, curso, mod) {
    let mejor = null;
    for (const cap of mod.conPreguntas) {
      let fallos = 0;
      for (const q of cap.exam) {
        const r = d.preguntas[`${curso.id}|${cap.id}|${q.id}`];
        if (r && !r.ultima) fallos++;
      }
      const ex = P.capitulo(curso.id, cap.id).examen;
      const examenFlojo = ex && ex.total && (ex.ultimo ?? ex.mejor) / ex.total < P.APROBADO ? 1 : 0;
      const peso = fallos * 2 + examenFlojo;
      if (peso && (!mejor || peso > mejor.peso)) mejor = { cap, fallos, peso };
    }
    return mejor;
  }

  function recortar(t, n) {
    t = String(t || "");
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }

  // ------------------------ Lista de ejercicios (T-SQL y JS) ------------------------
  function htmlListaEjercicios(clase, concepto) {
    const K = CLASES[clase];
    const d = leer();
    const lista = ejerciciosOrdenados(clase).filter((e) => !concepto || e.concepto === concepto);
    const chips = `<div class="chips-filtro" role="group" aria-label="Filtrar por concepto">
      <a class="chip-btn ${concepto ? "" : "activo"}" href="${K.ruta}/ejercicios" ${concepto ? "" : 'aria-current="true"'}>Todos</a>
      ${K.conceptos.map((c) => `<a class="chip-btn ${c === concepto ? "activo" : ""}" href="${K.ruta}/ejercicios/${slug(c)}" ${c === concepto ? 'aria-current="true"' : ""}>${escapar(c)}</a>`).join("")}
    </div>`;
    const grupos = ORDEN_NIVEL.map((nv) => {
      const del = lista.filter((e) => e.nivel === nv);
      if (!del.length) return "";
      const hechos = del.filter((e) => d[clase][e.id] && d[clase][e.id].resuelto).length;
      return `<section class="grupo-ej">
        <div class="modulo-head"><h2 class="h-mano">${NIVEL_EJ[nv]}</h2><span class="small muted">${hechos}/${del.length} resueltos</span></div>
        <div class="lista-caps">${del.map((e) => {
          const r = d[clase][e.id];
          const est = r && r.resuelto ? "aprobado" : r && (r.intentos || r.revelado) ? "leido" : "pendiente";
          const txt = est === "aprobado" ? "Resuelto" : est === "leido" ? "Intentado" : "Pendiente";
          return `<a class="cap-row est-${est}" href="${K.ruta}/ej/${e.id}">
            <span class="est" title="${txt}">${est === "aprobado" ? "✓" : est === "leido" ? "●" : "○"}</span>
            <span class="cap-code">${escapar(e.id.toUpperCase())}</span>
            <span class="cap-main"><span class="titulo-cap">${escapar(e.titulo)}</span><span class="small muted">${escapar(e.concepto)}${e.base ? ` · base ${escapar(e.base)}` : ""}</span></span>
            <span class="cap-side small muted">${txt}</span>
          </a>`;
        }).join("")}</div>
      </section>`;
    }).join("");
    return chips + (grupos || '<p class="prep-aviso">No hay ejercicios de este concepto.</p>');
  }

  function margenNivelClase(clase, titulo) {
    const d = leer();
    const ev = combinar(CLASES[clase].conceptos.map((c) => evaluarConcepto(c, d, clase)));
    return `<div class="margen-titulo">${escapar(titulo)}</div>
      <div>${insignia(ev)}</div>${barraNivel(ev)}
      <p class="small muted">${ev.n ? `${ev.precision}% de aciertos en ${ev.n} ejercicios terminados.` : "Resuelve ejercicios para ver tu nivel."}</p>`;
  }

  // ---------------------------- T-SQL (pestaña Datos) ----------------------------
  async function vistaSQL(ctx, cursos, resto) {
    const curso = cursoDatos(cursos);
    const entradaDatos = (curso && curso._meta) || { tema: "datos", cuaderno: "Cuaderno de analista" };
    ctx.aplicarTema(entradaDatos, "practica");
    const [modo = "ejercicios", arg] = resto;
    if (modo === "consola") return vistaConsola(ctx, cursos, arg && D.bases[arg] ? arg : "tienda");
    if (modo === "reto") {
      const reto = retoDeHoy("sql");
      return vistaEjercicio(ctx, cursos, D.ejercicios.find((e) => e.id === reto.id), true);
    }
    if (modo === "ej") {
      const ej = D.ejercicios.find((e) => e.id === arg);
      if (!ej) throw new Error(`No existe el ejercicio "${arg}".`);
      return vistaEjercicio(ctx, cursos, ej, false);
    }
    return vistaListaSQL(ctx, cursos, conceptoDeSlug(arg));
  }

  function migasDatos(cursos, ultimo) {
    const curso = cursoDatos(cursos);
    const items = [{ texto: "Hoy", href: "#/" }, { texto: "Práctica", href: "#/practica" }, { texto: (curso && curso._meta.separador) || "Datos", href: "#/practica/sql/ejercicios" }];
    return items.concat(ultimo);
  }

  const AYUDA_TSQL = `<details class="ayuda-tsql">
    <summary>Equivalencias T-SQL</summary>
    <table class="tabla-nivel">
      <thead><tr><th>Para…</th><th>En T-SQL</th><th>No uses</th></tr></thead>
      <tbody>
        <tr><td>Limitar filas</td><td><code>SELECT TOP (10) …</code></td><td><code>LIMIT 10</code></td></tr>
        <tr><td>Paginar</td><td><code>ORDER BY id OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY</code></td><td><code>LIMIT … OFFSET</code></td></tr>
        <tr><td>Fecha y hora actual</td><td><code>GETDATE()</code></td><td><code>NOW()</code></td></tr>
        <tr><td>Quitar la hora</td><td><code>CAST(fecha AS DATE)</code></td><td><code>date(fecha)</code></td></tr>
        <tr><td>Año, mes, día</td><td><code>YEAR(f)</code>, <code>MONTH(f)</code>, <code>DATEPART(week, f)</code></td><td><code>strftime</code>, <code>EXTRACT</code></td></tr>
        <tr><td>Mes como texto</td><td><code>FORMAT(f, 'yyyy-MM')</code></td><td><code>DATE_TRUNC</code>, <code>to_char</code></td></tr>
        <tr><td>Diferencia de fechas</td><td><code>DATEDIFF(day, inicio, fin)</code></td><td><code>fin - inicio</code>, <code>julianday</code></td></tr>
        <tr><td>Sumar tiempo</td><td><code>DATEADD(month, 1, f)</code>, <code>EOMONTH(f)</code></td><td><code>INTERVAL</code></td></tr>
        <tr><td>Valor por defecto</td><td><code>ISNULL(x, 0)</code> o <code>COALESCE</code></td><td><code>IFNULL</code>, <code>NVL</code></td></tr>
        <tr><td>Condición corta</td><td><code>IIF(cond, a, b)</code></td><td><code>IF()</code></td></tr>
        <tr><td>Unir textos</td><td><code>a + ' ' + b</code>, <code>CONCAT(a, b)</code></td><td><code>a || b</code></td></tr>
        <tr><td>Largo y posición</td><td><code>LEN(t)</code>, <code>CHARINDEX(' ', t)</code>, <code>LEFT(t, 3)</code></td><td><code>length</code>, <code>instr</code>, <code>substr</code></td></tr>
        <tr><td>Lista de un grupo</td><td><code>STRING_AGG(col, ', ') WITHIN GROUP (ORDER BY col)</code></td><td><code>group_concat</code></td></tr>
        <tr><td>Convertir tipo</td><td><code>CAST(x AS DECIMAL(10,2))</code>, <code>CONVERT(INT, x)</code></td><td><code>x::int</code></td></tr>
        <tr><td>Inicio de mes o semana</td><td><code>DATEFROMPARTS(YEAR(f), MONTH(f), 1)</code>, <code>DATETRUNC(week, f)</code></td><td><code>DATE_TRUNC</code></td></tr>
        <tr><td>Calendario de días</td><td><code>DATEADD(day, gs.value, '2026-03-01')</code> con <code>GENERATE_SERIES(0, 30) AS gs</code></td><td><code>generate_series</code> con fechas</td></tr>
        <tr><td>Leer un campo JSON</td><td><code>JSON_VALUE(payload, '$.cliente.pais')</code></td><td><code>payload->>'pais'</code>, <code>json_extract</code></td></tr>
        <tr><td>Desanidar un arreglo JSON</td><td><code>CROSS APPLY OPENJSON(payload, '$.items') AS i</code> (<code>OUTER APPLY</code> conserva los vacíos)</td><td><code>LATERAL</code>, <code>json_each</code></td></tr>
      </tbody>
    </table>
    <p class="small muted">Esta consola traduce T-SQL a un motor SQLite que corre en tu navegador. No están disponibles las variables (<code>@x</code>), <code>DECLARE</code>, las tablas temporales (<code>#t</code>), <code>MERGE</code> ni <code>PIVOT</code>. Recuerda que en SQL Server <code>AVG</code> de enteros devuelve un entero: multiplica por <code>1.0</code>.</p>
  </details>`;

  function vistaListaSQL(ctx, cursos, concepto) {
    ctx.setCrumbs(migasDatos(cursos, [{ texto: "Ejercicios T-SQL" }]));
    document.title = "T-SQL · Práctica · NEXUS";
    const curso = cursoDatos(cursos);
    const margen = `${margenNivelClase("sql", "Tu T-SQL")}
      <div class="margen-titulo" style="margin-top:.6rem">Bases de ejemplo</div>
      <ul class="lista-bases">${Object.entries(D.bases).map(([k, b]) => `<li><a href="#/practica/sql/consola/${k}"><strong>${k}</strong></a><span class="small muted">${escapar(b.descripcion)}</span></li>`).join("")}</ul>`;
    marco(ctx, cursos, curso ? curso.id : "nivel", `
      ${cabecera("práctica · Datos", "Ejercicios de T-SQL", "Escribe tus consultas como en SQL Server. Ordenados de básico a avanzado: abre uno, escribe tu consulta y pulsa <strong>Comprobar</strong>.")}
      ${navDatos(ctx, cursos, "sql-ejercicios")}
      ${htmlListaEjercicios("sql", concepto)}`, margen);
  }

  // Tipos que verías en SQL Server para cada columna de las bases de ejemplo
  function tipoTSQL(columna, tipo) {
    const t = String(tipo || "").toLowerCase();
    if (/^fecha/.test(columna)) return columna === "fecha" && t === "text" ? "datetime / date" : "date";
    if (t === "integer") return /^(activo)$/.test(columna) ? "bit" : "int";
    if (t === "real") return "decimal(10,2)";
    if (t === "text") return "nvarchar";
    return t;
  }

  // Consola reutilizable (editor + acciones + resultado)
  function htmlConsola(clave, inicial, lenguaje) {
    const ph = lenguaje === "js" ? "Escribe tu código… (Ctrl + Enter para ejecutar)" : "Escribe tu consulta T-SQL… (Ctrl + Enter para ejecutar)";
    return `<div class="consola" id="consola">
      <label class="sr" for="sqlEditor">${lenguaje === "js" ? "Código JavaScript" : "Consulta T-SQL"}</label>
      <textarea class="sql-editor" id="sqlEditor" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="${ph}">${escapar(inicial || "")}</textarea>
      <div class="row consola-acciones" id="consolaAcciones" data-clave="${escapar(clave)}"></div>
      <div class="salida" id="sqlSalida" aria-live="polite"></div>
    </div>`;
  }

  function htmlEsquema(SQL, nombre, db) {
    const tablas = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY rowid")[0];
    if (!tablas) return '<p class="small muted">La base no tiene tablas.</p>';
    return tablas.values.map(([t]) => {
      let cols = [], n = "?";
      try {
        cols = db.exec(`PRAGMA table_info("${t.replace(/"/g, '""')}")`)[0].values;
        n = db.exec(`SELECT COUNT(*) FROM "${t.replace(/"/g, '""')}"`)[0].values[0][0];
      } catch (_) { /* tabla rara: se muestra sin detalle */ }
      return `<div class="esquema-tabla">
        <button class="esquema-nombre" type="button" data-insertar="SELECT TOP (10) * FROM ${escapar(t)};" title="Ver las primeras filas de ${escapar(t)}">${escapar(t)} <span class="small muted">${n} filas</span></button>
        <ul>${cols.map((c) => `<li><span>${escapar(c[1])}</span><span class="tipo-col">${escapar(tipoTSQL(c[1], c[2]))}${c[5] ? " · pk" : ""}</span></li>`).join("")}</ul>
      </div>`;
    }).join("");
  }

  function enlazarEditor(ed, alEjecutar, clave) {
    ed.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); alEjecutar(); }
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        const i = ed.selectionStart;
        ed.setRangeText("  ", i, ed.selectionEnd, "end");
      }
    });
    let t = null;
    ed.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => guardarBorrador(clave, ed.value), 400); });
  }

  function avisoDialecto(msgs) {
    if (!msgs || !msgs.length) return "";
    return `<div class="feedback aviso"><strong>Esto no es T-SQL</strong><ul>${msgs.map((m) => `<li>${escapar(m)}</li>`).join("")}</ul></div>`;
  }

  function pintarSalida(salida, r, sql) {
    const dialecto = sql ? avisoDialecto(T.noEsTSQL(sql)) : "";
    const avisos = r.avisos && r.avisos.length ? `<div class="feedback aviso">${r.avisos.map((a) => `<p>${escapar(a)}</p>`).join("")}</div>` : "";
    if (r.error) {
      salida.innerHTML = `${dialecto}<div class="feedback ko"><strong>Error</strong><p>${escapar(r.error)}</p></div>`;
      return;
    }
    if (!r.ultimo) {
      salida.innerHTML = `${dialecto}<div class="feedback"><p>La consulta se ejecutó${r.cambios ? ` y cambió ${r.cambios} ${r.cambios === 1 ? "fila" : "filas"}` : ""}, pero no devolvió filas.</p></div>`;
      return;
    }
    salida.innerHTML = `${dialecto}${avisos}<div class="salida-cab"><span class="etiqueta">Resultado</span><span class="small muted">${r.ms} ms</span></div>${tablaResultado(r.ultimo)}`;
  }

  // Traduce T-SQL y ejecuta; los errores llegan explicados en español
  function intentar(db, sql) {
    let tr;
    try { tr = T.traducir(sql); } catch (_) { tr = { sql, avisos: [] }; }
    try {
      return { ...ejecutar(db, tr.sql), avisos: tr.avisos };
    } catch (err) {
      return { error: T.explicarError(err.message, sql) };
    }
  }

  async function prepararMotor() {
    const salida = document.getElementById("sqlSalida");
    salida.innerHTML = '<p class="small muted">Cargando el motor SQL…</p>';
    try {
      const SQL = await cargarSQL();
      salida.innerHTML = "";
      return SQL;
    } catch (err) {
      salida.innerHTML = `<div class="feedback ko"><strong>No se pudo cargar la consola</strong><p>${escapar(err.message)} Revisa tu conexión y recarga la página.</p></div>`;
      return null;
    }
  }

  async function vistaConsola(ctx, cursos, base) {
    ctx.setCrumbs(migasDatos(cursos, [{ texto: "Consola T-SQL" }]));
    document.title = "Consola T-SQL · Práctica · NEXUS";
    const curso = cursoDatos(cursos);
    const clave = `libre:${base}`;
    const tablaInicial = base === "rrhh" ? "empleados" : base === "app" ? "usuarios" : "clientes";
    const inicial = borrador(clave) ?? `-- Base "${base}". Escribe cualquier consulta T-SQL:\nSELECT TOP (10) * FROM ${tablaInicial};`;
    const margen = `<div class="margen-titulo">Tablas de ${escapar(base)}</div>
      <p class="small muted" style="margin:0">${escapar(D.bases[base].descripcion)} Toca una tabla para ver sus primeras filas.</p>
      <div class="esquema" id="esquema"><p class="small muted">Cargando…</p></div>`;
    marco(ctx, cursos, curso ? curso.id : "nivel", `
      ${cabecera("práctica · Datos", "Consola T-SQL", "Escribe como en SQL Server; la consola lo ejecuta en una base que vive en tu navegador. Experimenta sin miedo: si rompes algo, restaura la base.")}
      ${navDatos(ctx, cursos, "sql-consola")}
      ${subpestanas(Object.keys(D.bases).map((k) => [k, k, `#/practica/sql/consola/${k}`]), base, "Base de datos", "Base")}
      ${htmlConsola(clave, inicial, "sql")}
      ${AYUDA_TSQL}`, margen);

    document.getElementById("consolaAcciones").innerHTML = `<button class="btn cta" type="button" id="btnEjecutar">Ejecutar</button>
      <button class="btn ghost" type="button" id="btnRestaurar">Restaurar base</button>
      <span class="small muted atajo">Ctrl + Enter</span>`;
    const SQL = await prepararMotor();
    if (!SQL) return;
    let db = baseConsola(SQL, base);
    const ed = document.getElementById("sqlEditor");
    const salida = document.getElementById("sqlSalida");
    const pintarEsquema = () => { document.getElementById("esquema").innerHTML = htmlEsquema(SQL, base, db); };
    pintarEsquema();
    const correr = () => {
      const r = intentar(db, ed.value);
      pintarSalida(salida, r, ed.value);
      if (!r.error) pintarEsquema();
    };
    enlazarEditor(ed, correr, clave);
    document.getElementById("btnEjecutar").onclick = correr;
    document.getElementById("btnRestaurar").onclick = () => {
      db = restaurarBase(SQL, base);
      pintarEsquema();
      salida.innerHTML = `<div class="feedback ok"><p>La base <strong>${escapar(base)}</strong> volvió a su estado original.</p></div>`;
    };
    document.getElementById("esquema").addEventListener("click", (e) => {
      const b = e.target.closest("[data-insertar]");
      if (!b) return;
      ed.value = b.dataset.insertar;
      guardarBorrador(clave, ed.value);
      correr();
      ed.focus();
    });
  }

  // Ejercicios de JOIN: diagrama de Venn del tipo de JOIN junto al enunciado
  function vennEjercicio(ej) {
    const D2 = window.Diagramas;
    const j = ej.venn && D2 && D2.JOINS.find((x) => x.id === ej.venn);
    if (!j) return `<p class="enunciado-ej">${enLinea(ej.enunciado)}</p>`;
    const dib = j.zonas.length ? D2.svgVenn(j.zonas, "ej", ["izquierda", "derecha"]) : "";
    return `<div class="ej-venn"><p class="enunciado-ej">${enLinea(ej.enunciado)}</p>
      <figure class="ej-venn-fig">${dib}<figcaption><strong>${escapar(j.nombre)}</strong>${j.zonas.length ? "" : " · combina cada fila con cada fila"}</figcaption></figure></div>`;
  }

  function cabeceraEjercicio(ej, nota) {
    return `<article class="ejercicio ej-sql">
      <div class="ej-head">
        <div class="row"><span class="pill dif-${ej.nivel === "basico" ? "básico" : ej.nivel === "avanzado" ? "desafío" : "intermedio"}">${NIVEL_EJ[ej.nivel]}</span><span class="pill">${escapar(ej.concepto)}</span>${ej.base ? `<span class="pill">base ${escapar(ej.base)}</span>` : ""}</div>
        <span class="small muted" id="ejEstado"></span>
      </div>
      ${vennEjercicio(ej)}
      <p class="small muted" style="margin:0">${nota}</p>
    </article>`;
  }

  function pagerEj(clase, ej) {
    const lista = ejerciciosOrdenados(clase);
    const pos = lista.findIndex((e) => e.id === ej.id);
    return { ant: lista[pos - 1], sig: lista[pos + 1] };
  }
  function htmlPager(K, ant, sig) {
    return `<nav class="pager">${ant ? `<a class="btn ghost" href="${K.ruta}/ej/${ant.id}">← ${escapar(ant.titulo)}</a>` : "<span></span>"}${sig ? `<a class="btn ghost" href="${K.ruta}/ej/${sig.id}">${escapar(sig.titulo)} →</a>` : "<span></span>"}</nav>`;
  }

  async function vistaEjercicio(ctx, cursos, ej, esReto) {
    ctx.setCrumbs(migasDatos(cursos, [{ texto: esReto ? "Reto del día" : ej.titulo }]));
    document.title = `${ej.titulo} · T-SQL · NEXUS`;
    const curso = cursoDatos(cursos);
    const { ant, sig } = pagerEj("sql", ej);
    const estado = () => leer().sql[ej.id] || {};
    const reto = esReto ? leer().reto : null;
    const inicial = borrador(ej.id) ?? "";

    const margen = `<div class="margen-titulo">Tablas de ${escapar(ej.base)}</div>
      <p class="small muted" style="margin:0">${escapar(D.bases[ej.base].descripcion)} Toca una tabla para ver sus primeras filas.</p>
      <div class="esquema" id="esquema"><p class="small muted">Cargando…</p></div>`;
    marco(ctx, cursos, curso ? curso.id : "nivel", `
      ${cabecera(esReto ? `reto T-SQL del día · ${C.fechaISO()}` : "práctica · T-SQL", ej.titulo, null)}
      ${navDatos(ctx, cursos, esReto ? "sql-reto" : "sql-ejercicios")}
      ${cabeceraEjercicio(ej, `Escríbelo en T-SQL. No importan los nombres de las columnas, sí cuántas son y su orden.${ej.orden ? " El orden de las filas también cuenta." : " El orden de las filas no importa."}`)}
      ${esReto && reto && reto.resuelto ? '<div class="feedback ok"><p><strong>¡Reto de hoy completado!</strong> Mañana tendrás uno nuevo.</p></div>' : ""}
      ${htmlConsola(ej.id, inicial, "sql")}
      <div id="ayuda"></div>
      ${AYUDA_TSQL}
      ${esReto ? "" : htmlPager(CLASES.sql, ant, sig)}`, margen);

    const pintarEstado = () => {
      const r = estado();
      document.getElementById("ejEstado").textContent = r.resuelto ? "✓ Resuelto" : r.intentos ? `${r.intentos} ${r.intentos === 1 ? "intento" : "intentos"}` : "Pendiente";
    };
    pintarEstado();
    document.getElementById("consolaAcciones").innerHTML = `<button class="btn" type="button" id="btnEjecutar">Ejecutar</button>
      <button class="btn cta" type="button" id="btnComprobar">Comprobar</button>
      <button class="btn ghost" type="button" id="btnPista">Pista</button>
      <button class="btn ghost" type="button" id="btnSolucion">Ver solución</button>
      <span class="small muted atajo">Ctrl + Enter ejecuta</span>`;

    const SQL = await prepararMotor();
    if (!SQL) return;
    const db = baseConsola(SQL, ej.base);
    document.getElementById("esquema").innerHTML = htmlEsquema(SQL, ej.base, db);
    const ed = document.getElementById("sqlEditor");
    const salida = document.getElementById("sqlSalida");
    const ayuda = document.getElementById("ayuda");
    const correr = () => pintarSalida(salida, intentar(db, ed.value), ed.value);
    enlazarEditor(ed, correr, ej.id);
    document.getElementById("btnEjecutar").onclick = correr;

    document.getElementById("btnComprobar").onclick = () => {
      if (!ed.value.trim()) { salida.innerHTML = '<div class="feedback"><p>Escribe una consulta primero.</p></div>'; return; }
      // Primero: ¿es T-SQL? Lo que solo funciona en esta consola no cuenta como resuelto.
      const dialecto = T.noEsTSQL(ed.value);
      if (dialecto.length) {
        salida.innerHTML = avisoDialecto(dialecto) + '<p class="small muted">Corrígelo para que funcione en SQL Server y vuelve a comprobar.</p>';
        return;
      }
      // Se compara en copias limpias de la base, así no influyen los cambios hechos en la consola
      const limpiaT = baseNueva(SQL, ej.base);
      const limpiaE = baseNueva(SQL, ej.base);
      const tuyo = intentar(limpiaT, ed.value);
      const esperado = intentar(limpiaE, ej.solucion);
      limpiaT.close();
      limpiaE.close();
      if (tuyo.error) { pintarSalida(salida, tuyo); return; }
      const c = comparar(tuyo.ultimo, esperado.ultimo, ej.orden);
      registrarEj("sql", ej, c.ok ? "resuelto" : "intento");
      pintarEstado();
      salida.innerHTML = `<div class="feedback ${c.ok ? "ok" : "ko"}">
          <strong>${c.ok ? "¡Correcto!" : "Todavía no"}</strong><p>${escapar(c.ok ? (esReto ? "Completaste el reto del día." : "Tu resultado coincide con el esperado.") : c.msg)}</p>
          ${c.ok && sig && !esReto ? `<a class="btn cta" href="#/practica/sql/ej/${sig.id}">Siguiente ejercicio →</a>` : ""}
        </div>
        <div class="salida-cab"><span class="etiqueta">Tu resultado</span><span class="small muted">${tuyo.ms} ms</span></div>${tablaResultado(tuyo.ultimo)}`;
      if (c.ok) C.registrarActividad();
    };
    document.getElementById("btnPista").onclick = () => {
      ayuda.innerHTML = `<div class="pista"><strong>Pista</strong><p>${enLinea(ej.pista)}</p></div>`;
    };
    document.getElementById("btnSolucion").onclick = () => {
      const r = estado();
      if (!r.resuelto && !confirm("Si ves la solución antes de resolverlo, contará como no resuelto para tu nivel. ¿Verla?")) return;
      registrarEj("sql", ej, "revelado");
      pintarEstado();
      const esperado = intentar(baseNueva(SQL, ej.base), ej.solucion);
      ayuda.innerHTML = `<div class="solucion">
        ${bloqueSolucion(ej.solucion, "sql")}
        <div class="salida-cab"><span class="etiqueta">Resultado esperado</span></div>${tablaResultado(esperado.ultimo, 20)}
      </div>`;
    };
    document.getElementById("esquema").addEventListener("click", (e) => {
      const b = e.target.closest("[data-insertar]");
      if (!b) return;
      const r = intentar(db, b.dataset.insertar);
      pintarSalida(salida, r);
      salida.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  function bloqueSolucion(codigo, lenguaje) {
    let html = escapar(codigo);
    if (window.hljs) { try { html = window.hljs.highlight(codigo, { language: lenguaje === "js" ? "javascript" : "sql" }).value; } catch (_) { /* sin resaltado */ } }
    return `<div class="code"><div class="code-head"><span>solución</span><button class="copy-btn" type="button">Copiar</button></div><pre><code class="hljs">${html}</code></pre></div>`;
  }

  // ---------------------------- JavaScript ----------------------------
  function vistaJS(ctx, cursos, resto) {
    const web = cursos.find((c) => c._meta.tema === "web");
    ctx.aplicarTema((web && web._meta) || { tema: "web", cuaderno: "Cuaderno de desarrollador" }, "practica");
    const [modo = "ejercicios", arg] = resto;
    if (modo === "consola") return vistaConsolaJS(ctx, cursos);
    if (modo === "reto") {
      const reto = retoDeHoy("js");
      return vistaEjercicioJS(ctx, cursos, JSD.ejercicios.find((e) => e.id === reto.id), true);
    }
    if (modo === "ej") {
      const ej = JSD.ejercicios.find((e) => e.id === arg);
      if (!ej) throw new Error(`No existe el ejercicio "${arg}".`);
      return vistaEjercicioJS(ctx, cursos, ej, false);
    }
    const concepto = conceptoDeSlug(arg, CONCEPTOS_JS);
    ctx.setCrumbs([{ texto: "Hoy", href: "#/" }, { texto: "Práctica", href: "#/practica" }, { texto: "JavaScript" }]);
    document.title = "JavaScript · Práctica · NEXUS";
    const lecciones = web
      ? `<div class="margen-titulo" style="margin-top:.6rem">Lecciones relacionadas</div>
        <ul class="lista-bases">${CONCEPTOS_JS.map((c) => {
          const cap = web.chapters.find((x) => x.id === JSD.lecciones[c]);
          return cap ? `<li><span class="small"><strong>${escapar(c)}</strong></span><a class="small" href="#/curso/${web.id}/${cap.id}">${escapar(cap.code || "")} · ${escapar(cap.title)}</a></li>` : "";
        }).join("")}</ul>`
      : "";
    marco(ctx, cursos, "js", `
      ${cabecera("práctica · JavaScript", "Ejercicios de JavaScript", "En cada ejercicio escribes una función y pulsas <strong>Comprobar</strong>: se ejecutan pruebas automáticas y ves cuáles pasan.")}
      ${navJS("ejercicios")}
      ${htmlListaEjercicios("js", concepto)}`, margenNivelClase("js", "Tu JavaScript") + lecciones);
  }

  function pintarLogs(r) {
    const logs = (r.logs || []).map((l) => `<div class="log ${l.tipo}">${escapar(l.texto)}</div>`).join("");
    return logs ? `<div class="salida-cab"><span class="etiqueta">Consola</span></div><div class="logs">${logs}</div>` : "";
  }

  async function vistaConsolaJS(ctx, cursos) {
    ctx.setCrumbs([{ texto: "Hoy", href: "#/" }, { texto: "Práctica", href: "#/practica" }, { texto: "JavaScript", href: "#/practica/js/ejercicios" }, { texto: "Consola" }]);
    document.title = "Consola JavaScript · Práctica · NEXUS";
    const clave = "js:libre";
    const inicial = borrador(clave) ?? `// Escribe cualquier código y pulsa Ejecutar.\nconst equipos = [\n  { codigo: "B-01", horas: 520 },\n  { codigo: "C-07", horas: 130 },\n];\nconst urgentes = equipos.filter((e) => e.horas >= 500);\nconsole.log("Urgentes:", urgentes);\nurgentes.length;`;
    marco(ctx, cursos, "js", `
      ${cabecera("práctica · JavaScript", "Consola", "Lo que imprimas con <code>console.log</code> aparece abajo, junto con el valor de la última línea. El código corre aparte, con un límite de 3 segundos.")}
      ${navJS("consola")}
      ${htmlConsola(clave, inicial, "js")}`, `<div class="margen-titulo">Ideas para probar</div>
        <ul class="lista-falladas">
          <li><code>[3, 1, 2].sort((a, b) => a - b)</code></li>
          <li><code>new Date("2026-03-01").getDay()</code></li>
          <li><code>JSON.stringify({ a: 1, b: [2, 3] })</code></li>
          <li><code>"Mantenimiento".slice(0, 5).toUpperCase()</code></li>
          <li><code>0.1 + 0.2</code> (¿por qué no da 0.3?)</li>
        </ul>`);
    document.getElementById("consolaAcciones").innerHTML = `<button class="btn cta" type="button" id="btnEjecutar">Ejecutar</button>
      <button class="btn ghost" type="button" id="btnLimpiar">Limpiar salida</button>
      <span class="small muted atajo">Ctrl + Enter</span>`;
    const ed = document.getElementById("sqlEditor");
    const salida = document.getElementById("sqlSalida");
    const correr = async () => {
      salida.innerHTML = '<p class="small muted">Ejecutando…</p>';
      const r = await window.PracticaJSMotor.ejecutar(ed.value);
      salida.innerHTML = pintarLogs(r)
        + (r.error ? `<div class="feedback ko"><strong>Error</strong><p>${escapar(r.error)}</p></div>` : "")
        + (!r.error && r.hayValor ? `<div class="salida-cab"><span class="etiqueta">Valor final</span>${r.ms != null ? `<span class="small muted">${r.ms} ms</span>` : ""}</div><div class="logs"><div class="log valor">${escapar(r.valor)}</div></div>` : "")
        + (!r.error && !r.hayValor && !(r.logs || []).length ? '<p class="small muted">El código se ejecutó sin mostrar nada. Usa <code>console.log(…)</code> para ver valores.</p>' : "");
    };
    enlazarEditor(ed, correr, clave);
    document.getElementById("btnEjecutar").onclick = correr;
    document.getElementById("btnLimpiar").onclick = () => { salida.innerHTML = ""; };
  }

  async function vistaEjercicioJS(ctx, cursos, ej, esReto) {
    ctx.setCrumbs([{ texto: "Hoy", href: "#/" }, { texto: "Práctica", href: "#/practica" }, { texto: "JavaScript", href: "#/practica/js/ejercicios" }, { texto: esReto ? "Reto del día" : ej.titulo }]);
    document.title = `${ej.titulo} · JavaScript · NEXUS`;
    const K = CLASES.js;
    const { ant, sig } = pagerEj("js", ej);
    const estado = () => leer().js[ej.id] || {};
    const reto = esReto ? leer().retoJS : null;
    const clave = `js:${ej.id}`;
    const inicial = borrador(clave) ?? ej.plantilla;
    const web = cursos.find((c) => c._meta.tema === "web");
    const lec = web && web.chapters.find((x) => x.id === JSD.lecciones[ej.concepto]);
    const margen = `<div class="margen-titulo">Pruebas</div>
      <p class="small muted" style="margin:0">Así se va a llamar a tu función. Deben pasar todas.</p>
      <ul class="lista-pruebas">${ej.pruebas.map((p) => `<li><code>${escapar(p.especial ? `prueba especial de ${ej.funcion}` : `${ej.funcion}(${p.args.map((a) => JSON.stringify(a)).join(", ")})${p.llamar ? `(${p.llamar.map((a) => JSON.stringify(a)).join(", ")})` : ""}`)}</code><span class="small muted">→ ${escapar(JSON.stringify(p.esperado))}</span></li>`).join("")}</ul>
      ${lec ? `<div class="margen-titulo" style="margin-top:.6rem">Repasa</div><a href="#/curso/${web.id}/${lec.id}">${escapar(lec.code || "")} · ${escapar(lec.title)}</a>` : ""}`;
    marco(ctx, cursos, "js", `
      ${cabecera(esReto ? `reto JavaScript del día · ${C.fechaISO()}` : "práctica · JavaScript", ej.titulo, null)}
      ${navJS(esReto ? "reto" : "ejercicios")}
      ${cabeceraEjercicio(ej, `Escribe la función <code>${escapar(ej.funcion)}</code>. Puedes usar <code>console.log</code> para depurar; el código se detiene si tarda más de 3 segundos.`)}
      ${esReto && reto && reto.resuelto ? '<div class="feedback ok"><p><strong>¡Reto de hoy completado!</strong> Mañana tendrás uno nuevo.</p></div>' : ""}
      ${htmlConsola(clave, inicial, "js")}
      <div id="ayuda"></div>
      ${esReto ? "" : htmlPager(K, ant, sig)}`, margen);

    const pintarEstado = () => {
      const r = estado();
      document.getElementById("ejEstado").textContent = r.resuelto ? "✓ Resuelto" : r.intentos ? `${r.intentos} ${r.intentos === 1 ? "intento" : "intentos"}` : "Pendiente";
    };
    pintarEstado();
    document.getElementById("consolaAcciones").innerHTML = `<button class="btn cta" type="button" id="btnComprobar">Comprobar</button>
      <button class="btn" type="button" id="btnEjecutar">Ejecutar</button>
      <button class="btn ghost" type="button" id="btnPista">Pista</button>
      <button class="btn ghost" type="button" id="btnSolucion">Ver solución</button>
      <button class="btn ghost" type="button" id="btnReiniciar">Reiniciar código</button>
      <span class="small muted atajo">Ctrl + Enter comprueba</span>`;
    const ed = document.getElementById("sqlEditor");
    const salida = document.getElementById("sqlSalida");
    const ayuda = document.getElementById("ayuda");

    const comprobar = async () => {
      salida.innerHTML = '<p class="small muted">Ejecutando pruebas…</p>';
      const r = await window.PracticaJSMotor.comprobar(ed.value, ej);
      if (r.error && !r.pruebas) {
        salida.innerHTML = `${pintarLogs(r)}<div class="feedback ko"><strong>Error</strong><p>${escapar(r.error)}</p></div>`;
        return;
      }
      const pasan = r.pruebas.filter((p) => p.ok).length;
      const ok = pasan === r.pruebas.length;
      registrarEj("js", ej, ok ? "resuelto" : "intento");
      pintarEstado();
      salida.innerHTML = `<div class="feedback ${ok ? "ok" : "ko"}">
          <strong>${ok ? "¡Correcto!" : "Todavía no"}</strong><p>${ok ? (esReto ? "Completaste el reto del día." : "Pasaron todas las pruebas.") : `Pasaron ${pasan} de ${r.pruebas.length} pruebas.`}</p>
          ${ok && sig && !esReto ? `<a class="btn cta" href="${K.ruta}/ej/${sig.id}">Siguiente ejercicio →</a>` : ""}
        </div>
        <ul class="resultado-pruebas">${r.pruebas.map((p) => `<li class="${p.ok ? "bien" : "mal"}">
          <span class="marca">${p.ok ? "✓" : "✗"}</span>
          <div><code>${escapar(p.entrada)}</code>
          <div class="small">esperado: <code>${escapar(p.esperado)}</code>${p.error ? ` · <span class="error-prueba">${escapar(p.error)}</span>` : ` · obtenido: <code>${escapar(p.obtenido)}</code>`}</div></div>
        </li>`).join("")}</ul>${pintarLogs(r)}`;
      if (ok) C.registrarActividad();
    };
    const ejecutarLibre = async () => {
      salida.innerHTML = '<p class="small muted">Ejecutando…</p>';
      const r = await window.PracticaJSMotor.ejecutar(ed.value);
      salida.innerHTML = pintarLogs(r) + (r.error ? `<div class="feedback ko"><strong>Error</strong><p>${escapar(r.error)}</p></div>` : !(r.logs || []).length ? '<p class="small muted">Se ejecutó sin mostrar nada. Usa <code>console.log(…)</code> o pulsa Comprobar.</p>' : "");
    };
    enlazarEditor(ed, comprobar, clave);
    document.getElementById("btnComprobar").onclick = comprobar;
    document.getElementById("btnEjecutar").onclick = ejecutarLibre;
    document.getElementById("btnPista").onclick = () => {
      ayuda.innerHTML = `<div class="pista"><strong>Pista</strong><p>${enLinea(ej.pista)}</p></div>`;
    };
    document.getElementById("btnReiniciar").onclick = () => {
      if (ed.value !== ej.plantilla && !confirm("¿Volver al código inicial? Se borrará lo que escribiste.")) return;
      ed.value = ej.plantilla;
      guardarBorrador(clave, ed.value);
      salida.innerHTML = "";
    };
    document.getElementById("btnSolucion").onclick = () => {
      const r = estado();
      if (!r.resuelto && !confirm("Si ves la solución antes de resolverlo, contará como no resuelto para tu nivel. ¿Verla?")) return;
      registrarEj("js", ej, "revelado");
      pintarEstado();
      ayuda.innerHTML = `<div class="solucion">${bloqueSolucion(ej.solucion, "js")}</div>`;
    };
  }

  // ---------------------------- Cursos ----------------------------
  let sesion = null; // práctica de preguntas en curso

  function vistaCurso(ctx, cursos, curso, resto) {
    ctx.aplicarTema(curso._meta, "practica");
    const nombreTema = curso._meta.separador || curso.title;
    const mods = modulosPractica(ctx, curso);
    const conPreguntas = mods.filter((m) => m.total);
    const d = leer();
    if (!conPreguntas.length) {
      ctx.setCrumbs([{ texto: "Hoy", href: "#/" }, { texto: "Práctica", href: "#/practica" }, { texto: nombreTema }]);
      document.title = `${nombreTema} · Práctica · NEXUS`;
      marco(ctx, cursos, curso.id, `${cabecera(`práctica · ${nombreTema}`, curso.title, null)}
        <p class="prep-aviso">Este cuaderno está en preparación: aún no tiene preguntas para practicar. Cuando sus capítulos tengan evaluación, aparecerán aquí organizados por módulo.</p>`);
      return;
    }
    const idx = resto[0] != null && conPreguntas.some((m) => String(m.i) === resto[0]) ? Number(resto[0]) : conPreguntas[0].i;
    const mod = mods[idx];
    const subtabs = curso._meta.tema === "datos"
      ? navDatos(ctx, cursos, `mod-${idx}`)
      : subpestanas(conPreguntas.map((m) => [String(m.i), etiquetaCorta(m.nombre), `#/practica/${encodeURIComponent(curso.id)}/${m.i}`]), String(idx), "Subtemas");

    if (resto[1]) return vistaPreguntas(ctx, cursos, curso, mod, resto[1], subtabs);

    ctx.setCrumbs([{ texto: "Hoy", href: "#/" }, { texto: "Práctica", href: "#/practica" }, { texto: nombreTema, href: `#/practica/${encodeURIComponent(curso.id)}` }, { texto: mod.corto }]);
    document.title = `${mod.corto} · Práctica · NEXUS`;
    const ev = evaluarModulo(curso, mod, d);
    const pendientesMod = mod.conPreguntas.reduce((s, c) => s + c.exam.filter((q) => estadoPregunta(d, curso.id, c.id, q.id) !== "bien").length, 0);
    const filas = mod.caps.map((cap) => {
      const total = (cap.exam || []).length;
      const disponible = ctx.capDisponible(curso, cap) && total;
      if (!disponible) {
        return `<div class="cap-row bloqueado"><span class="est">·</span><span class="cap-code">${escapar(cap.code || "")}</span>
          <span class="cap-main"><span class="titulo-cap">${escapar(cap.title)}</span></span><span class="cap-side small muted">${total ? "En preparación" : "Sin preguntas"}</span></div>`;
      }
      const bien = cap.exam.filter((q) => estadoPregunta(d, curso.id, cap.id, q.id) === "bien").length;
      const mal = cap.exam.filter((q) => estadoPregunta(d, curso.id, cap.id, q.id) === "mal").length;
      const est = bien === total ? "aprobado" : bien || mal ? "leido" : "pendiente";
      return `<a class="cap-row est-${est}" href="#/practica/${encodeURIComponent(curso.id)}/${mod.i}/${encodeURIComponent(cap.id)}">
        <span class="est">${est === "aprobado" ? "✓" : est === "leido" ? "●" : "○"}</span>
        <span class="cap-code">${escapar(cap.code || "")}</span>
        <span class="cap-main"><span class="titulo-cap">${escapar(cap.title)}</span>
          <span class="mini-dominio" aria-label="${bien} de ${total} dominadas"><span class="bien" style="width:${(bien * 100) / total}%"></span><span class="mal" style="width:${(mal * 100) / total}%"></span></span></span>
        <span class="cap-side small muted">${bien}/${total} dominadas${mal ? ` · <span style="color:var(--ko)">${mal} por corregir</span>` : ""}</span>
      </a>`;
    }).join("");

    const margen = `<div class="margen-titulo">Tu nivel en ${escapar(mod.corto)}</div>
      <div>${insignia(ev)}</div>${barraNivel(ev)}
      <p class="small muted">${ev.n ? `${ev.precision}% de aciertos en ${ev.n} respuestas (práctica y exámenes).` : "Aún sin respuestas en este subtema."}</p>
      <div class="margen-pie">
        <div class="fila"><span>Preguntas del subtema</span><span>${mod.total}</span></div>
        <div class="fila"><span>Por dominar</span><span>${pendientesMod}</span></div>
      </div>`;
    marco(ctx, cursos, curso.id, `
      ${cabecera(`práctica · ${nombreTema}`, curso.title, null)}
      ${subtabs}
      <div class="modulo-head" style="margin-top:1.2rem"><h2 class="h-mano">${escapar(mod.nombre)}</h2><span class="small muted">${mod.total} preguntas</span></div>
      <div class="row" style="margin:.4rem 0 1.2rem"><a class="btn cta" href="#/practica/${encodeURIComponent(curso.id)}/${mod.i}/todo">Practicar todo el subtema</a>
        <span class="small muted">Primero salen las que fallaste, luego las nuevas y al final las que ya dominas.</span></div>
      <div class="lista-caps">${filas}</div>`, margen);
  }

  // Ordena las preguntas: falladas → nuevas → dominadas, respetando el orden del capítulo
  function colaPreguntas(d, curso, caps) {
    const todas = [];
    for (const cap of caps) for (const q of cap.exam) todas.push({ cap, q, est: estadoPregunta(d, curso.id, cap.id, q.id) });
    const peso = { mal: 0, nueva: 1, bien: 2 };
    return todas.map((x, i) => ({ ...x, i })).sort((a, b) => peso[a.est] - peso[b.est] || a.i - b.i);
  }

  function vistaPreguntas(ctx, cursos, curso, mod, objetivo, subtabs) {
    const nombreTema = curso._meta.separador || curso.title;
    const caps = objetivo === "todo" ? mod.conPreguntas : mod.conPreguntas.filter((c) => c.id === objetivo);
    if (!caps.length) throw new Error("Ese capítulo no tiene preguntas para practicar.");
    const titulo = objetivo === "todo" ? `Todo ${mod.corto}` : `${caps[0].code ? caps[0].code + " · " : ""}${caps[0].title}`;
    ctx.setCrumbs([{ texto: "Hoy", href: "#/" }, { texto: "Práctica", href: "#/practica" }, { texto: nombreTema, href: `#/practica/${encodeURIComponent(curso.id)}` }, { texto: mod.corto, href: `#/practica/${encodeURIComponent(curso.id)}/${mod.i}` }, { texto: objetivo === "todo" ? "Todo" : caps[0].code || caps[0].title }]);
    document.title = `${titulo} · Práctica · NEXUS`;
    const claveSesion = `${curso.id}|${mod.i}|${objetivo}`;
    if (!sesion || sesion.clave !== claveSesion) {
      sesion = { clave: claveSesion, cola: colaPreguntas(leer(), curso, caps), pos: 0, aciertos: 0, respondidas: 0, racha: 0, mejorRacha: 0, falladas: [], respuesta: null };
    }
    const volver = `#/practica/${encodeURIComponent(curso.id)}/${mod.i}`;

    const pintar = () => {
      const s = sesion;
      const actual = s.cola[s.pos];
      const ev = evaluarModulo(curso, mod, leer());
      const margen = `<div class="margen-titulo">Esta práctica</div>
        <div class="racha-practica ${s.racha >= 3 ? "encendida" : ""}"><span class="racha-num">${s.racha}</span><span>${s.racha === 1 ? "acierto seguido" : "aciertos seguidos"}</span></div>
        <div class="margen-pie" style="margin-top:0">
          <div class="fila"><span>Aciertos</span><span>${s.aciertos}/${s.respondidas}</span></div>
          <div class="fila"><span>Mejor racha</span><span>${s.mejorRacha}</span></div>
        </div>
        <div class="margen-titulo" style="margin-top:.6rem">Nivel en ${escapar(mod.corto)}</div>
        <div>${insignia(ev)}</div>${barraNivel(ev)}`;

      let cuerpo;
      if (!actual) {
        const pct = s.respondidas ? Math.round((s.aciertos * 100) / s.respondidas) : 0;
        cuerpo = `<div class="papel-card fin-practica">
          <span class="etiqueta">Práctica terminada</span>
          <h3>${s.aciertos} de ${s.respondidas} correctas (${pct}%)</h3>
          <p class="extracto">${pct >= 85 ? "¡Excelente! Este tema lo dominas." : pct >= 60 ? "Bien. Repite las que fallaste para afianzarlas." : "Conviene repasar la lección y volver a intentarlo."} Mejor racha: ${s.mejorRacha}.</p>
          <div class="row" style="margin-top:1rem">
            ${s.falladas.length ? '<button class="btn cta" type="button" id="btnRepetir">Repetir las que fallé</button>' : ""}
            <a class="btn ghost" href="${volver}">Volver a ${escapar(mod.corto)}</a>
            <a class="btn ghost" href="#/practica">Ver mi nivel</a>
          </div>
        </div>`;
      } else {
        const { cap, q } = actual;
        const r = s.respuesta;
        cuerpo = `<div class="fila-panel progreso-practica" style="justify-content:space-between;align-items:center;gap:.6rem">
            <span class="etiqueta">Pregunta ${s.pos + 1} de ${s.cola.length}</span>
            <span class="small muted">${escapar(cap.code || "")}${actual.est === "mal" ? ' · <span style="color:var(--ko)">la fallaste antes</span>' : actual.est === "bien" ? " · ya la acertaste" : " · nueva"}</span>
          </div>
          <div class="bar" style="margin:.4rem 0 1rem"><span style="width:${(s.pos * 100) / s.cola.length}%"></span></div>
          <fieldset class="pregunta ${r ? (r.ok ? "bien" : "mal") : ""}">
            <legend><span class="enunciado">${enLinea(q.question)}</span></legend>
            ${q.options.map((op, k) => {
              const clase = r ? (k === q.correctIndex ? "correcta" : k === r.elegida ? "incorrecta" : "") : "";
              return `<label class="opcion ${clase}"><input type="radio" name="op" value="${k}" ${r ? "disabled" : ""} ${r && r.elegida === k ? "checked" : ""}><span class="letra">${"ABCDEFG"[k]}</span><span>${enLinea(op)}</span></label>`;
            }).join("")}
            ${r ? `<div class="explicacion"><strong>${r.ok ? "¡Correcto!" : "No es esa."}</strong> ${enLinea(q.explanation || "")}</div>` : ""}
          </fieldset>
          <div class="row">
            ${r ? `<button class="btn cta" type="button" id="btnSiguiente">${s.pos + 1 < s.cola.length ? "Siguiente pregunta" : "Ver resultado"}</button>
                   ${!r.ok ? '<button class="btn ghost" type="button" id="btnTarjeta">Guardar como tarjeta de repaso</button>' : ""}
                   <a class="btn ghost" href="#/curso/${curso.id}/${cap.id}">Repasar la lección</a>`
                : `<button class="btn cta" type="button" id="btnResponder" disabled>Responder</button>
                   <button class="btn ghost" type="button" id="btnTerminar">Terminar aquí</button>`}
          </div>`;
      }
      marco(ctx, cursos, curso.id, `
        ${cabecera(`práctica · ${nombreTema}`, titulo, null)}
        ${subtabs}
        <div class="practica-preguntas">${cuerpo}</div>`, margen);

      if (!actual) {
        const rep = document.getElementById("btnRepetir");
        if (rep) rep.onclick = () => {
          sesion = { ...sesion, cola: sesion.falladas.map((x) => ({ ...x, est: "mal" })), pos: 0, aciertos: 0, respondidas: 0, racha: 0, falladas: [], respuesta: null };
          pintar();
        };
        return;
      }
      const resp = document.getElementById("btnResponder");
      if (resp) {
        ctx.app.querySelectorAll('input[name="op"]').forEach((inp) => (inp.onchange = () => { resp.disabled = false; }));
        resp.onclick = () => {
          const marcada = ctx.app.querySelector('input[name="op"]:checked');
          if (!marcada) return;
          const elegida = Number(marcada.value);
          const ok = elegida === actual.q.correctIndex;
          registrarPregunta({ curso: curso.id, mod: mod.nombre, cap: actual.cap.id, q: actual.q.id, ok });
          s.respondidas++;
          if (ok) { s.aciertos++; s.racha++; s.mejorRacha = Math.max(s.mejorRacha, s.racha); } else { s.racha = 0; s.falladas.push(actual); }
          s.respuesta = { elegida, ok };
          pintar();
        };
        document.getElementById("btnTerminar").onclick = () => { s.pos = s.cola.length; s.respuesta = null; pintar(); };
      }
      const sigB = document.getElementById("btnSiguiente");
      if (sigB) sigB.onclick = () => { s.pos++; s.respuesta = null; pintar(); window.scrollTo({ top: 0 }); };
      const tar = document.getElementById("btnTarjeta");
      if (tar) tar.onclick = () => {
        C.agregarTarjeta({ curso: curso.id, cap: actual.cap.id, frente: actual.q.question, reverso: `**Respuesta:** ${actual.q.options[actual.q.correctIndex]}\n\n${actual.q.explanation || ""}`, origen: "practica" });
        ctx.aviso("Tarjeta guardada en tu mazo de repaso");
        tar.disabled = true;
        tar.textContent = "Tarjeta guardada";
      };
    };
    pintar();
  }

  window.Practica = { vista, exportar, importar, evaluar, comparar };
})();
