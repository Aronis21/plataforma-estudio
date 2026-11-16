/* NEXUS · Cuaderno: todo lo que escribes y guardas mientras estudias.
 * Se guarda en este navegador (localStorage), separado del progreso de los exámenes.
 *
 * Estructura (clave "nexus:cuaderno"):
 * {
 *   version: 1,
 *   ultimo:     { curso, cap, pestana, fecha }          última página abierta ("Te quedaste aquí")
 *   actividad:  { "2026-11-16": n, ... }                  días con estudio (para la racha)
 *   notas:      [{ id, curso, cap, texto, tipo: "nota" | "duda", fecha }]
 *   resaltados: [{ id, curso, cap, seccion, texto, fecha }]
 *   tarjetas:   [{ id, curso, cap, frente, reverso, origen, nivel, proxima, fecha }]
 *   borradores: { "curso|cap|ejercicio": "texto" }
 *   plan:       { fecha, hechos: { clave: true }, extra: [{ id, texto }] }
 *   evaluaciones: { "curso|cap": { fecha, aciertos, total, seguroBien, seguroMal, adivinadas } }
 * }
 */
(function () {
  const CLAVE = "nexus:cuaderno";
  // Repaso espaciado sencillo (cajas de Leitner): días hasta volver a ver la tarjeta según su nivel.
  const INTERVALOS = [0, 1, 3, 7, 14, 30];

  function vacio() {
    return { version: 1, ultimo: null, actividad: {}, notas: [], resaltados: [], tarjetas: [], borradores: {}, plan: null, evaluaciones: {} };
  }

  function leer() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE));
      return d && typeof d === "object" ? { ...vacio(), ...d } : vacio();
    } catch (_) {
      return vacio();
    }
  }

  function guardar(d) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(d));
    } catch (_) { /* almacenamiento no disponible: se pierde al recargar */ }
  }

  function cambiar(fn) {
    const d = leer();
    const r = fn(d);
    guardar(d);
    return r;
  }

  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Fecha local en formato AAAA-MM-DD (no UTC, para que el "hoy" sea el tuyo)
  function fechaISO(d = new Date()) {
    const z = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  function sumarDias(iso, n) {
    const [a, m, d] = iso.split("-").map(Number);
    return fechaISO(new Date(a, m - 1, d + n));
  }

  // ---------- Actividad y racha ----------
  function registrarActividad() {
    cambiar((d) => {
      const hoy = fechaISO();
      d.actividad[hoy] = (d.actividad[hoy] || 0) + 1;
    });
  }

  function racha() {
    const act = leer().actividad;
    let dia = fechaISO();
    if (!act[dia]) dia = sumarDias(dia, -1); // si hoy aún no estudias, la racha de ayer sigue viva
    let n = 0;
    while (act[dia]) {
      n++;
      dia = sumarDias(dia, -1);
    }
    return n;
  }

  // ---------- Última página ----------
  function recordarUltimo(curso, cap, pestana) {
    cambiar((d) => {
      d.ultimo = { curso, cap, pestana: pestana || null, fecha: new Date().toISOString() };
    });
  }
  const ultimo = () => leer().ultimo;

  // ---------- Notas y dudas ----------
  function agregarNota({ curso = null, cap = null, texto, tipo = "nota" }) {
    texto = (texto || "").trim();
    if (!texto) return null;
    return cambiar((d) => {
      const n = { id: nuevoId(), curso, cap, texto, tipo, fecha: new Date().toISOString() };
      d.notas.push(n);
      return n;
    });
  }
  function notas(filtro = {}) {
    return leer().notas.filter(
      (n) => (filtro.curso === undefined || n.curso === filtro.curso) && (filtro.cap === undefined || n.cap === filtro.cap) && (!filtro.tipo || n.tipo === filtro.tipo)
    );
  }
  function borrarNota(id) {
    cambiar((d) => { d.notas = d.notas.filter((n) => n.id !== id); });
  }

  // ---------- Resaltados ----------
  function agregarResaltado({ curso, cap, seccion, texto }) {
    texto = (texto || "").trim();
    if (!texto) return null;
    return cambiar((d) => {
      const r = { id: nuevoId(), curso, cap, seccion, texto, fecha: new Date().toISOString() };
      d.resaltados.push(r);
      return r;
    });
  }
  function resaltados(filtro = {}) {
    return leer().resaltados.filter((r) => (filtro.curso === undefined || r.curso === filtro.curso) && (filtro.cap === undefined || r.cap === filtro.cap));
  }
  function borrarResaltado(id) {
    cambiar((d) => { d.resaltados = d.resaltados.filter((r) => r.id !== id); });
  }

  // ---------- Tarjetas de repaso ----------
  function agregarTarjeta({ curso, cap, frente, reverso, origen = "manual" }) {
    frente = (frente || "").trim();
    if (!frente) return null;
    return cambiar((d) => {
      // Evita duplicados exactos del mismo capítulo
      const existe = d.tarjetas.find((t) => t.curso === curso && t.cap === cap && t.frente === frente);
      if (existe) return existe;
      const t = { id: nuevoId(), curso, cap, frente, reverso: (reverso || "").trim(), origen, nivel: 0, proxima: fechaISO(), fecha: new Date().toISOString() };
      d.tarjetas.push(t);
      return t;
    });
  }
  function tarjetas(filtro = {}) {
    return leer().tarjetas.filter((t) => filtro.curso === undefined || t.curso === filtro.curso);
  }
  function tarjetasPendientes(filtro = {}) {
    const hoy = fechaISO();
    return tarjetas(filtro).filter((t) => t.proxima <= hoy);
  }
  // calidad: "otra" (no la sabía) | "bien" | "facil"
  function responderTarjeta(id, calidad) {
    cambiar((d) => {
      const t = d.tarjetas.find((x) => x.id === id);
      if (!t) return;
      if (calidad === "otra") t.nivel = 0;
      else t.nivel = Math.min(INTERVALOS.length - 1, t.nivel + (calidad === "facil" ? 2 : 1));
      t.proxima = sumarDias(fechaISO(), Math.max(1, INTERVALOS[t.nivel]));
    });
    registrarActividad();
  }
  function borrarTarjeta(id) {
    cambiar((d) => { d.tarjetas = d.tarjetas.filter((t) => t.id !== id); });
  }

  // ---------- Borradores de ejercicios ----------
  const claveBorrador = (curso, cap, ej) => `${curso}|${cap}|${ej}`;
  function guardarBorrador(curso, cap, ej, texto) {
    cambiar((d) => {
      if (texto && texto.trim()) d.borradores[claveBorrador(curso, cap, ej)] = texto;
      else delete d.borradores[claveBorrador(curso, cap, ej)];
    });
  }
  const borrador = (curso, cap, ej) => leer().borradores[claveBorrador(curso, cap, ej)] || "";

  // ---------- Plan de hoy ----------
  function planDeHoy() {
    const d = leer();
    if (!d.plan || d.plan.fecha !== fechaISO()) return { fecha: fechaISO(), hechos: {}, extra: [] };
    return d.plan;
  }
  function cambiarPlan(fn) {
    cambiar((d) => {
      if (!d.plan || d.plan.fecha !== fechaISO()) d.plan = { fecha: fechaISO(), hechos: {}, extra: [] };
      fn(d.plan);
    });
  }
  const marcarPlan = (clave, hecho) => cambiarPlan((p) => { p.hechos[clave] = !!hecho; });
  const agregarAlPlan = (texto) => (texto || "").trim() && cambiarPlan((p) => p.extra.push({ id: nuevoId(), texto: texto.trim() }));
  const quitarDelPlan = (id) => cambiarPlan((p) => { p.extra = p.extra.filter((x) => x.id !== id); delete p.hechos[id]; });

  // ---------- Evaluaciones (análisis de seguridad) ----------
  function registrarEvaluacion(curso, cap, resumen) {
    cambiar((d) => { d.evaluaciones[`${curso}|${cap}`] = { ...resumen, fecha: new Date().toISOString() }; });
  }
  const evaluacion = (curso, cap) => leer().evaluaciones[`${curso}|${cap}`] || null;
  const evaluaciones = () => leer().evaluaciones;

  // ---------- Respaldo ----------
  const exportar = () => leer();
  function importar(datos) {
    if (!datos || typeof datos !== "object" || !Array.isArray(datos.notas)) throw new Error("La parte del cuaderno no es válida");
    guardar({ ...vacio(), ...datos });
  }

  window.Cuaderno = {
    fechaISO, registrarActividad, racha, recordarUltimo, ultimo,
    agregarNota, notas, borrarNota,
    agregarResaltado, resaltados, borrarResaltado,
    agregarTarjeta, tarjetas, tarjetasPendientes, responderTarjeta, borrarTarjeta,
    guardarBorrador, borrador,
    planDeHoy, marcarPlan, agregarAlPlan, quitarDelPlan,
    registrarEvaluacion, evaluacion, evaluaciones,
    exportar, importar,
  };
})();
