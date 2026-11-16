/* NEXUS · Tutor del cuaderno.
 *
 * Por ahora el tutor funciona en modo LOCAL: no usa inteligencia artificial, solo arma
 * sus mensajes con tu progreso y con el contenido del curso (ideas clave, objetivos,
 * ejercicios). Así la página funciona en GitHub Pages sin servidor ni claves.
 *
 * Cuando se conecte una IA real (por ejemplo, una Cloud Function de Firebase que llame a la
 * API de Claude), basta con cambiar el cuerpo de estas funciones para que hagan un fetch()
 * a ese servidor. La página ya espera Promesas, así que no hay que tocar el resto del código.
 * NUNCA pongas una clave de API en este archivo: el repositorio es público.
 */
(function () {
  const MODO = "local";

  const respuesta = (texto, extra = {}) => Promise.resolve({ texto, modo: MODO, ...extra });

  // Explica un fragmento resaltado usando la idea clave de su sección.
  function explicar({ seccion, texto }) {
    if (seccion && seccion.keyTakeaway) {
      return respuesta(`La idea clave de esta sección es: ${seccion.keyTakeaway}`, { titulo: "Explicación" });
    }
    return respuesta(`Guardé “${recortar(texto, 80)}” en tu margen. Cuando el tutor con IA esté conectado, aquí te lo explicará con otras palabras.`, { titulo: "Explicación" });
  }

  function conMisDatos() {
    return respuesta("Esta función llegará cuando conectemos el tutor con IA: te explicará el concepto usando tus propios datos (por ejemplo, tus órdenes de taller).", { titulo: "Con tus datos", pendiente: true });
  }

  // Sugiere un ejercicio del mismo capítulo en lugar de inventar uno.
  function crearEjercicio({ cap }) {
    const ej = cap && cap.exercises && cap.exercises[0];
    if (ej) return respuesta(`Mientras tanto, practica con “${ej.title}”, el ejercicio de este capítulo que trabaja esta idea.`, { titulo: "Ejercicio", ejercicio: ej.id });
    return respuesta("Este capítulo todavía no tiene ejercicios. Cuando el tutor con IA esté conectado, podrá crearte uno.", { titulo: "Ejercicio", pendiente: true });
  }

  // Nota adhesiva de la página Hoy: elige el consejo más útil según tu situación.
  function notaDelDia({ examenPendiente, dudaReciente, tarjetasHoy, racha, siguiente }) {
    if (examenPendiente) {
      return `Tu último examen de ${examenPendiente.code} quedó en ${examenPendiente.ultimo}/${examenPendiente.total}. Repasa la teoría y vuelve a intentarlo antes de avanzar.`;
    }
    if (dudaReciente) return `Anotaste: “${recortar(dudaReciente.texto, 90)}”. Búscala en la lección y, si ya la resolviste, bórrala de tus dudas.`;
    if (tarjetasHoy > 0) return `Tienes ${tarjetasHoy} ${tarjetasHoy === 1 ? "tarjeta" : "tarjetas"} para repasar. Cinco minutos de repaso hoy valen más que una hora la próxima semana.`;
    if (siguiente) return `Lo siguiente en tu ruta es ${siguiente.code || ""} “${recortar(siguiente.title, 60)}”. ${racha ? `Llevas ${racha} ${racha === 1 ? "día" : "días"} seguidos.` : "Hoy es buen día para empezar la racha."}`;
    return "Escribe abajo cualquier duda que tengas y la guardo en tu cuaderno.";
  }

  // Comentario del margen en el panel de un curso.
  function notaDelCurso({ resumen, siguiente, debiles }) {
    if (resumen.aprobados === resumen.total && resumen.total) return "Completaste todo el curso. Repasa tus tarjetas de vez en cuando para no olvidarlo.";
    if (debiles && debiles.length) return `Refuerza ${debiles.map((c) => c.code).join(", ")}: tus exámenes ahí quedaron por debajo del 70%.`;
    if (!resumen.aprobados && !resumen.leidos) return "Empieza por la introducción: marca el tono de todo el curso.";
    if (siguiente) return `Vas bien. Sigue con ${siguiente.code || ""} “${recortar(siguiente.title, 50)}”.`;
    return "Sigue a tu ritmo: cada capítulo aprobado suma a tu avance.";
  }

  function recortar(t, n) {
    t = String(t || "");
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }

  window.Tutor = { MODO, explicar, conMisDatos, crearEjercicio, notaDelDia, notaDelCurso };
})();
