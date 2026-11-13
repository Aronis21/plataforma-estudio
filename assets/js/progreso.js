/* Progreso del estudiante, guardado en el navegador (localStorage).
 * Estructura por curso:
 * { capitulos: { [idCapitulo]: { leido: bool, examen: { mejor: n, ultimo: n, total: n, intentos: n, fecha } , ejercicios: { [idEj]: true } } } }
 */
(function () {
  const PREFIJO = "plataforma-estudio:progreso:";
  const APROBADO = 0.7; // 70% para dar un capítulo por aprobado

  function leer(idCurso) {
    try {
      return JSON.parse(localStorage.getItem(PREFIJO + idCurso)) || { capitulos: {} };
    } catch (_) {
      return { capitulos: {} };
    }
  }

  function guardar(idCurso, datos) {
    try {
      localStorage.setItem(PREFIJO + idCurso, JSON.stringify(datos));
    } catch (_) { /* almacenamiento no disponible: se pierde al recargar */ }
  }

  function capitulo(idCurso, idCap) {
    const d = leer(idCurso);
    return d.capitulos[idCap] || {};
  }

  function actualizar(idCurso, idCap, fn) {
    const d = leer(idCurso);
    const actual = d.capitulos[idCap] || {};
    d.capitulos[idCap] = fn(actual) || actual;
    guardar(idCurso, d);
  }

  function marcarLeido(idCurso, idCap, valor) {
    actualizar(idCurso, idCap, (c) => ({ ...c, leido: valor }));
  }

  function marcarEjercicio(idCurso, idCap, idEj, valor) {
    actualizar(idCurso, idCap, (c) => ({ ...c, ejercicios: { ...(c.ejercicios || {}), [idEj]: valor } }));
  }

  function registrarExamen(idCurso, idCap, aciertos, total) {
    actualizar(idCurso, idCap, (c) => {
      const previo = c.examen || {};
      return {
        ...c,
        examen: {
          mejor: Math.max(previo.mejor || 0, aciertos),
          ultimo: aciertos,
          total,
          intentos: (previo.intentos || 0) + 1,
          fecha: new Date().toISOString(),
        },
      };
    });
  }

  // Estado de un capítulo: 'aprobado' | 'leido' | 'pendiente'
  function estado(idCurso, idCap) {
    const c = capitulo(idCurso, idCap);
    if (c.examen && c.examen.total && c.examen.mejor / c.examen.total >= APROBADO) return "aprobado";
    if (c.leido) return "leido";
    return "pendiente";
  }

  function resumenCurso(curso) {
    const caps = curso.chapters || [];
    let aprobados = 0;
    let leidos = 0;
    for (const cap of caps) {
      const e = estado(curso.id, cap.id);
      if (e === "aprobado") aprobados++;
      else if (e === "leido") leidos++;
    }
    return { total: caps.length, aprobados, leidos, pct: caps.length ? Math.round((aprobados * 100) / caps.length) : 0 };
  }

  function exportarTodo() {
    const salida = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIJO)) salida[k.slice(PREFIJO.length)] = JSON.parse(localStorage.getItem(k));
    }
    return { version: 1, exportado: new Date().toISOString(), cursos: salida };
  }

  function importarTodo(datos) {
    if (!datos || typeof datos.cursos !== "object") throw new Error("Archivo de progreso no válido");
    for (const [id, valor] of Object.entries(datos.cursos)) guardar(id, valor);
  }

  function reiniciarCurso(idCurso) {
    try { localStorage.removeItem(PREFIJO + idCurso); } catch (_) { /* nada */ }
  }

  // Último capítulo visitado (para "Continuar donde lo dejaste")
  const CLAVE_VISITA = "plataforma-estudio:ultima-visita";

  function registrarVisita(idCurso, idCap, pestaña) {
    try {
      localStorage.setItem(CLAVE_VISITA, JSON.stringify({ curso: idCurso, cap: idCap, pestaña, fecha: new Date().toISOString() }));
    } catch (_) { /* nada */ }
  }

  function ultimaVisita() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_VISITA));
    } catch (_) {
      return null;
    }
  }

  window.Progreso = {
    APROBADO, capitulo, marcarLeido, marcarEjercicio, registrarExamen, estado,
    resumenCurso, exportarTodo, importarTodo, reiniciarCurso, registrarVisita, ultimaVisita,
  };
})();
