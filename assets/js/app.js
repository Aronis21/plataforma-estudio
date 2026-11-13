/* Plataforma de Estudio — aplicación de una sola página sin dependencias de compilación.
 * Rutas (hash):
 *   #/                                   mi aprendizaje (catálogo + continuar)
 *   #/curso/<idCurso>                    inicio del curso por módulos
 *   #/curso/<idCurso>/<idCap>[/<elem>]   elemento de un capítulo (teoria, estandar, comparacion, ejercicios, examen)
 */
(function () {
  const { escapar, enLinea, bloques, bloqueCodigo } = window.Texto;
  const P = window.Progreso;

  const app = document.getElementById("app");
  const sidebar = document.getElementById("sidebar");
  const crumbs = document.getElementById("crumbs");
  const menuBtn = document.getElementById("menuBtn");
  const backdrop = document.getElementById("backdrop");

  let catalogo = null;
  const cacheCursos = {};

  // ---------- Preferencias: tema y tamaño de letra ----------
  const CLAVE_PREF = "plataforma-estudio:preferencias";
  const TAMAÑOS = ["normal", "grande", "extra"];

  function leerPref() {
    try { return JSON.parse(localStorage.getItem(CLAVE_PREF)) || {}; } catch (_) { return {}; }
  }
  function guardarPref(p) {
    try { localStorage.setItem(CLAVE_PREF, JSON.stringify(p)); } catch (_) { /* nada */ }
  }
  function temaEfectivo() {
    const t = document.documentElement.dataset.theme;
    if (t) return t;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function aplicarTemaCodigo() {
    const oscuro = temaEfectivo() === "dark";
    const claro = document.getElementById("hljsClaro");
    const osc = document.getElementById("hljsOscuro");
    if (claro && osc && document.documentElement.dataset.theme) {
      claro.media = oscuro ? "not all" : "all";
      osc.media = oscuro ? "all" : "not all";
    }
  }
  aplicarTemaCodigo();
  document.getElementById("btnTema").onclick = () => {
    const p = leerPref();
    p.tema = temaEfectivo() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = p.tema;
    guardarPref(p);
    aplicarTemaCodigo();
  };
  document.getElementById("btnLetra").onclick = () => {
    const p = leerPref();
    const actual = TAMAÑOS.indexOf(p.letra || "normal");
    p.letra = TAMAÑOS[(actual + 1) % TAMAÑOS.length];
    if (p.letra === "normal") delete document.documentElement.dataset.letra;
    else document.documentElement.dataset.letra = p.letra;
    guardarPref(p);
  };

  // ---------- Carga de datos ----------
  async function cargarJSON(ruta) {
    const r = await fetch(ruta, { cache: "no-cache" });
    if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
    return r.json();
  }

  async function obtenerCatalogo() {
    if (!catalogo) {
      catalogo = await cargarJSON("cursos/catalogo.json");
      document.getElementById("siteTitle").textContent = catalogo.titulo || "Plataforma de Estudio";
    }
    return catalogo;
  }

  async function obtenerCurso(id) {
    if (cacheCursos[id]) return cacheCursos[id];
    const cat = await obtenerCatalogo();
    const entrada = cat.cursos.find((c) => c.id === id);
    if (!entrada) throw new Error(`El curso "${id}" no está en cursos/catalogo.json`);
    const curso = await cargarJSON(`cursos/${entrada.archivo}`);
    curso.chapters = [...(curso.chapters || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    curso._meta = entrada;
    cacheCursos[id] = curso;
    return curso;
  }

  function modulosDe(curso) {
    const mapa = new Map();
    for (const cap of curso.chapters) {
      const m = cap.module || "Contenido";
      if (!mapa.has(m)) mapa.set(m, []);
      mapa.get(m).push(cap);
    }
    return [...mapa.entries()];
  }

  // ---------- Elementos de un capítulo ----------
  // Cada capítulo se presenta como una lista de elementos, igual que en una plataforma de cursos.
  const TIPO = {
    teoria: { icono: "▤", tipo: "Lectura" },
    estandar: { icono: "▤", tipo: "Lectura" },
    comparacion: { icono: "⇄", tipo: "Caso práctico" },
    ejercicios: { icono: "✎", tipo: "Práctica" },
    examen: { icono: "?", tipo: "Cuestionario" },
  };

  function elementosDe(cap) {
    const t = [];
    if (cap.theorySections?.length || cap.objectives?.length) t.push(["teoria", "Teoría"]);
    if (cap.professionalStandard) t.push(["estandar", "Estándar profesional"]);
    if (cap.comparison) t.push(["comparacion", "Junior vs. Intermedio"]);
    if (cap.exercises?.length) t.push(["ejercicios", `Ejercicios (${cap.exercises.length})`]);
    if (cap.exam?.length) t.push(["examen", `Cuestionario (${cap.exam.length})`]);
    return t;
  }

  function elementoHecho(curso, cap, clave) {
    const c = P.capitulo(curso.id, cap.id);
    if (clave === "examen") return P.estado(curso.id, cap.id) === "aprobado";
    if (clave === "ejercicios") return (cap.exercises || []).every((e) => (c.ejercicios || {})[e.id]);
    return !!c.leido;
  }

  function enlaceElemento(curso, cap, clave) {
    return `#/curso/${curso.id}/${cap.id}/${clave}`;
  }

  // Siguiente elemento del curso a partir de uno dado (salta al siguiente capítulo al terminar)
  function siguienteElemento(curso, cap, clave) {
    const elems = elementosDe(cap);
    const i = elems.findIndex(([k]) => k === clave);
    if (i >= 0 && i < elems.length - 1) return { cap, clave: elems[i + 1][0], texto: elems[i + 1][1] };
    const idx = curso.chapters.indexOf(cap);
    const sig = curso.chapters[idx + 1];
    if (!sig) return null;
    const primero = elementosDe(sig)[0];
    return { cap: sig, clave: primero?.[0] || "", texto: `${sig.code || ""} · ${sig.title}` };
  }

  // ---------- Utilidades de UI ----------
  function setCrumbs(items) {
    crumbs.innerHTML = items
      .map((it, i) => (it.href && i < items.length - 1 ? `<a href="${it.href}">${escapar(it.texto)}</a>` : `<span>${escapar(it.texto)}</span>`))
      .join('<span class="sep">/</span>');
  }

  function barra(pct, etiqueta) {
    return `<div class="bar" role="progressbar" aria-label="${escapar(etiqueta || "Progreso")}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`;
  }

  const TEXTO_ESTADO = { aprobado: "Aprobado", leido: "En curso", pendiente: "Pendiente" };

  function mostrarSidebar(html) {
    if (html == null) {
      sidebar.hidden = true;
      menuBtn.hidden = true;
      document.body.classList.remove("con-sidebar");
      return;
    }
    const scroll = sidebar.scrollTop;
    sidebar.innerHTML = html;
    sidebar.hidden = false;
    menuBtn.hidden = false;
    document.body.classList.add("con-sidebar");
    sidebar.scrollTop = scroll;
  }

  function cerrarMenu() {
    document.body.classList.remove("menu-abierto");
    backdrop.hidden = true;
  }
  menuBtn.addEventListener("click", () => {
    const abierto = document.body.classList.toggle("menu-abierto");
    backdrop.hidden = !abierto;
  });
  backdrop.addEventListener("click", cerrarMenu);

  // Botones "Copiar" de los bloques de código
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".copy-btn");
    if (!btn) return;
    const code = btn.closest(".code").querySelector("code").innerText;
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = "Copiado";
    } catch (_) {
      btn.textContent = "No se pudo copiar";
    }
    setTimeout(() => (btn.textContent = "Copiar"), 1500);
  });

  function sidebarCurso(curso, idActivo, claveActiva) {
    const r = P.resumenCurso(curso);
    const capActivo = curso.chapters.find((c) => c.id === idActivo);
    let html = `<div class="side-head">
      <a href="#/curso/${curso.id}" class="side-title">${escapar(curso.title)}</a>
      <div class="side-prog">${barra(r.pct, "Progreso del curso")}<span>${r.aprobados}/${r.total}</span></div>
    </div><nav class="side-nav" aria-label="Contenido del curso">`;
    for (const [modulo, caps] of modulosDe(curso)) {
      const aprob = caps.filter((c) => P.estado(curso.id, c.id) === "aprobado").length;
      const abierto = capActivo ? capActivo.module === modulo || (!capActivo.module && modulo === "Contenido") : false;
      html += `<details class="side-mod" ${abierto ? "open" : ""}>
        <summary><span class="mod-nombre">${escapar(modulo)}</span><span class="mod-cuenta">${aprob}/${caps.length}</span></summary>`;
      for (const cap of caps) {
        const est = P.estado(curso.id, cap.id);
        const activo = cap.id === idActivo;
        html += `<a href="#/curso/${curso.id}/${cap.id}" class="side-item ${activo ? "activo" : ""}" title="${escapar(cap.title)}">
          <span class="dot est-${est}" aria-label="${TEXTO_ESTADO[est]}"></span>
          ${cap.code ? `<span class="side-code">${escapar(cap.code.replace(/^Cap\.\s*/, ""))}</span>` : ""}
          <span class="side-name">${escapar(cap.title)}</span>
        </a>`;
        if (activo) {
          html += `<div class="side-elems">`;
          for (const [k, t] of elementosDe(cap)) {
            const hecho = elementoHecho(curso, cap, k);
            html += `<a href="${enlaceElemento(curso, cap, k)}" class="side-elem ${k === claveActiva ? "activo" : ""} ${hecho ? "hecho" : ""}">
              <span class="elem-icono" aria-hidden="true">${hecho ? "✓" : TIPO[k].icono}</span>
              <span class="elem-texto"><span class="elem-nombre">${escapar(t)}</span><span class="elem-tipo">${TIPO[k].tipo}</span></span>
            </a>`;
          }
          html += `</div>`;
        }
      }
      html += "</details>";
    }
    html += "</nav>";
    return html;
  }

  function tarjetaContinuar(curso) {
    const v = P.ultimaVisita();
    let cap = v && v.curso === curso.id ? curso.chapters.find((c) => c.id === v.cap) : null;
    let clave = cap ? v.pestaña : null;
    let etiqueta = "Continuar donde lo dejaste";
    if (!cap) {
      cap = curso.chapters.find((c) => P.estado(curso.id, c.id) !== "aprobado");
      if (!cap) return "";
      const r = P.resumenCurso(curso);
      etiqueta = r.aprobados || r.leidos ? "Siguiente capítulo" : "Empieza el curso";
    }
    const elems = elementosDe(cap);
    if (!elems.some(([k]) => k === clave)) clave = elems[0]?.[0] || "";
    const nombreElem = (elems.find(([k]) => k === clave) || [, ""])[1];
    return `<a class="continuar" href="${enlaceElemento(curso, cap, clave)}">
      <span><small>${etiqueta}</small><strong>${escapar(cap.code ? cap.code + " · " : "")}${escapar(cap.title)}</strong>
      <span class="continuar-sub">${escapar(curso.title)}${nombreElem ? " · " + escapar(nombreElem) : ""}</span></span>
      <span class="ir">Reanudar →</span>
    </a>`;
  }

  // ---------- Vista: mi aprendizaje ----------
  async function vistaCatalogo() {
    const cat = await obtenerCatalogo();
    setCrumbs([{ texto: "Mi aprendizaje" }]);
    mostrarSidebar(null);
    document.title = cat.titulo || "Plataforma de Estudio";

    const visibles = cat.cursos.filter((c) => c.publicado !== false);
    const cursos = await Promise.all(visibles.map((c) => obtenerCurso(c.id).catch((err) => ({ _error: err, _meta: c }))));

    let tarjetas = "";
    let continuar = "";
    const v = P.ultimaVisita();
    for (const curso of cursos) {
      if (curso._error) {
        tarjetas += `<div class="card error"><h3>${escapar(curso._meta.id)}</h3><p>${escapar(curso._error.message)}</p></div>`;
        continue;
      }
      if (!continuar || (v && v.curso === curso.id)) continuar = tarjetaContinuar(curso);
      const r = P.resumenCurso(curso);
      const minutos = curso.chapters.reduce((s, c) => s + (c.estimatedMinutes || 0), 0);
      const etiquetas = (curso._meta.etiquetas || []).map((t) => `<span class="tag">${escapar(t)}</span>`).join("");
      tarjetas += `<a class="card course-card" href="#/curso/${curso.id}">
        <div class="card-top">
          <span class="kicker">${escapar(curso._meta.categoria || "Curso")}</span>
          ${curso.level ? `<span class="pill">${escapar(curso.level)}</span>` : ""}
        </div>
        <h3>${escapar(curso.title)}</h3>
        <p class="muted">${escapar(curso.subtitle || "")}</p>
        <div class="tags">${etiquetas}</div>
        <div class="card-stats">
          <span>${modulosDe(curso).length} módulos</span><span>·</span><span>${curso.chapters.length} lecciones</span><span>·</span><span>~${Math.round(minutos / 60)} h</span>
        </div>
        ${barra(r.pct, "Progreso del curso")}
        <div class="card-foot">${r.pct}% completado · ${r.aprobados} de ${r.total} aprobados</div>
      </a>`;
    }

    app.innerHTML = `
      <section class="hero">
        <h1>Mi aprendizaje</h1>
        <p class="lead">${escapar(cat.descripcion || "")}</p>
      </section>
      ${continuar}
      <h2 class="titulo-seccion">Mis cursos</h2>
      <section class="grid">${tarjetas || '<p class="muted">Aún no hay cursos publicados.</p>'}</section>
      <section class="panel ajustes">
        <h2>Tu progreso</h2>
        <p class="muted">El progreso se guarda en este navegador. Expórtalo para pasarlo a otro dispositivo.</p>
        <div class="row">
          <button class="btn ghost" id="btnExportar" type="button">Exportar progreso</button>
          <label class="btn ghost">Importar progreso<input type="file" id="inpImportar" accept="application/json" hidden></label>
        </div>
        <p class="muted small" id="msgProgreso"></p>
      </section>`;

    document.getElementById("btnExportar").onclick = () => {
      const blob = new Blob([JSON.stringify(P.exportarTodo(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `progreso-estudio-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    document.getElementById("inpImportar").onchange = async (e) => {
      const msg = document.getElementById("msgProgreso");
      try {
        const texto = await e.target.files[0].text();
        P.importarTodo(JSON.parse(texto));
        msg.textContent = "Progreso importado.";
        vistaCatalogo();
      } catch (err) {
        msg.textContent = "No se pudo importar: " + err.message;
      }
    };
  }

  // ---------- Vista: inicio del curso ----------
  async function vistaCurso(idCurso) {
    const curso = await obtenerCurso(idCurso);
    setCrumbs([{ texto: "Mi aprendizaje", href: "#/" }, { texto: curso.title }]);
    mostrarSidebar(sidebarCurso(curso, null));
    document.title = curso.title;
    cerrarMenu();

    const r = P.resumenCurso(curso);
    const mods = modulosDe(curso);
    let modulos = "";
    mods.forEach(([modulo, caps]) => {
      const aprob = caps.filter((c) => P.estado(curso.id, c.id) === "aprobado").length;
      const minutos = caps.reduce((s, c) => s + (c.estimatedMinutes || 0), 0);
      const pct = Math.round((aprob * 100) / caps.length);
      modulos += `<section class="modulo">
        <div class="modulo-head">
          <h2>${escapar(modulo)}</h2>
          <span class="muted small">${caps.length} ${caps.length === 1 ? "lección" : "lecciones"} · ${minutos} min</span>
        </div>
        <div class="modulo-prog">${barra(pct, "Progreso del módulo")}<span>${aprob}/${caps.length} aprobadas</span></div>
        <div class="lista-caps">`;
      for (const cap of caps) {
        const est = P.estado(curso.id, cap.id);
        const ex = P.capitulo(curso.id, cap.id).examen;
        modulos += `<a class="cap-row" href="#/curso/${curso.id}/${cap.id}">
          <span class="dot est-${est}" aria-label="${TEXTO_ESTADO[est]}"></span>
          <span class="cap-code">${escapar(cap.code || "")}</span>
          <span class="cap-main"><strong>${escapar(cap.title)}</strong><span class="muted small">${escapar(cap.subtitle || "")}</span></span>
          <span class="cap-side muted small">${cap.estimatedMinutes ? cap.estimatedMinutes + " min" : ""}${ex ? `<br>Nota ${Math.round((ex.mejor * 100) / ex.total)}%` : ""}</span>
        </a>`;
      }
      modulos += "</div></section>";
    });

    app.innerHTML = `
      <section class="hero curso-hero">
        <span class="kicker">${escapar(curso._meta.categoria || "")}${curso.level ? " · " + escapar(curso.level) : ""}</span>
        <h1>${escapar(curso.title)}</h1>
        <p class="lead">${escapar(curso.subtitle || "")}</p>
        <div class="hero-progress">${barra(r.pct, "Progreso del curso")}<span>${r.pct}% · ${r.aprobados} aprobados · ${r.leidos} en curso</span></div>
      </section>
      ${r.aprobados === r.total ? '<p class="pill ok">¡Curso completado!</p>' : tarjetaContinuar(curso)}
      ${modulos}
      <div class="zona-opciones">
        <span>Opciones del curso:</span>
        <button class="link-btn" id="btnReiniciar" type="button">Reiniciar progreso</button>
        <span id="confReiniciar" hidden>¿Borrar todo el progreso de este curso en este navegador?
          <button class="btn peligro" id="btnConfirmar" type="button">Sí, borrar</button>
          <button class="btn ghost" id="btnCancelar" type="button">Cancelar</button>
        </span>
      </div>`;

    const conf = document.getElementById("confReiniciar");
    document.getElementById("btnReiniciar").onclick = () => (conf.hidden = false);
    document.getElementById("btnCancelar").onclick = () => (conf.hidden = true);
    document.getElementById("btnConfirmar").onclick = () => {
      P.reiniciarCurso(curso.id);
      vistaCurso(curso.id);
    };
  }

  // ---------- Contenido de los elementos ----------
  function htmlTeoria(cap) {
    let h = "";
    if (cap.objectives?.length) {
      h += `<div class="objetivos"><h3>Al terminar podrás</h3><ul>${cap.objectives.map((o) => `<li>${enLinea(o)}</li>`).join("")}</ul></div>`;
    }
    for (const s of cap.theorySections || []) {
      h += `<article class="seccion">
        <h2>${enLinea(s.title)}</h2>
        ${bloques(s.body)}
        ${bloqueCodigo(s.codeSnippet, s.codeLanguage)}
        ${s.keyTakeaway ? `<div class="takeaway"><strong>Idea clave</strong>${enLinea(s.keyTakeaway)}</div>` : ""}
      </article>`;
    }
    return h;
  }

  function htmlEstandar(cap) {
    const e = cap.professionalStandard;
    return `<article class="seccion">
      <h2>${enLinea(e.title || "Estándar profesional")}</h2>
      ${e.summary ? `<p class="lead-sm">${enLinea(e.summary)}</p>` : ""}
      <ol class="reglas">${(e.rules || []).map((r) => `<li>${enLinea(r)}</li>`).join("")}</ol>
      ${e.referenceCode ? "<h3>Código de referencia</h3>" + bloqueCodigo(e.referenceCode, e.codeLanguage) : ""}
    </article>`;
  }

  function htmlComparacion(cap) {
    const c = cap.comparison;
    return `<article class="seccion">
      <h2>Escenario</h2>
      <p class="lead-sm">${enLinea(c.scenario || "")}</p>
      <div class="comparacion">
        <div class="lado malo">
          <h3>✗ ${escapar(c.juniorLabel || "Error de Junior")}</h3>
          ${bloqueCodigo(c.juniorCode, c.codeLanguage)}
          <ul>${(c.juniorFlaws || []).map((f) => `<li>${enLinea(f)}</li>`).join("")}</ul>
        </div>
        <div class="lado bueno">
          <h3>✓ ${escapar(c.intermediateLabel || "Solución de Intermedio")}</h3>
          ${bloqueCodigo(c.intermediateCode, c.codeLanguage)}
          <ul>${(c.intermediateBenefits || []).map((f) => `<li>${enLinea(f)}</li>`).join("")}</ul>
        </div>
      </div>
    </article>`;
  }

  function htmlEjercicios(curso, cap) {
    const hechos = P.capitulo(curso.id, cap.id).ejercicios || {};
    return cap.exercises
      .map(
        (e) => `<article class="ejercicio" data-ej="${escapar(e.id)}">
        <div class="ej-head">
          <h2>${enLinea(e.title)}</h2>
          ${e.difficulty ? `<span class="pill dif-${escapar(e.difficulty.toLowerCase())}">${escapar(e.difficulty)}</span>` : ""}
        </div>
        ${bloques(e.prompt)}
        <label class="espacio">Tu respuesta (borrador, no se guarda)
          <textarea rows="6" spellcheck="false" placeholder="Escribe aquí tu solución antes de mirar la pista o la solución…"></textarea>
        </label>
        <div class="row">
          ${e.hint ? '<button class="btn ghost" data-accion="pista" type="button">Ver pista</button>' : ""}
          <button class="btn ghost" data-accion="solucion" type="button">Ver solución</button>
          <label class="check"><input type="checkbox" data-accion="hecho" ${hechos[e.id] ? "checked" : ""}> Lo resolví</label>
        </div>
        ${e.hint ? `<div class="pista" hidden><strong>Pista</strong>${bloques(e.hint)}</div>` : ""}
        <div class="solucion" hidden>
          ${e.solutionExplanation ? `<div class="takeaway"><strong>Explicación</strong>${bloques(e.solutionExplanation)}</div>` : ""}
          ${bloqueCodigo(e.solutionCode, e.codeLanguage)}
        </div>
      </article>`
      )
      .join("");
  }

  function enlazarEjercicios(curso, cap, alCambiar) {
    app.querySelectorAll(".ejercicio").forEach((art) => {
      const idEj = art.dataset.ej;
      art.addEventListener("click", (e) => {
        const acc = e.target.dataset?.accion;
        if (acc === "pista") {
          const p = art.querySelector(".pista");
          p.hidden = !p.hidden;
          e.target.textContent = p.hidden ? "Ver pista" : "Ocultar pista";
        } else if (acc === "solucion") {
          const s = art.querySelector(".solucion");
          s.hidden = !s.hidden;
          e.target.textContent = s.hidden ? "Ver solución" : "Ocultar solución";
        }
      });
      const chk = art.querySelector('input[data-accion="hecho"]');
      chk.onchange = () => {
        P.marcarEjercicio(curso.id, cap.id, idEj, chk.checked);
        alCambiar();
      };
    });
  }

  // ---------- Cuestionario: una pregunta a la vez ----------
  // Mezcla determinista por intento (para que la posición de la respuesta no se memorice)
  function mezclar(arr, semilla) {
    const a = arr.map((v, i) => [v, i]);
    let s = semilla >>> 0 || 1;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const LETRAS = "ABCDEFGH";
  let teclasQuiz = null; // manejador de teclado del cuestionario activo

  document.addEventListener("keydown", (e) => {
    if (!teclasQuiz || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest("input, textarea, select")) return;
    teclasQuiz(e);
  });

  function montarCuestionario(cont, curso, cap, alTerminar) {
    const preguntas = cap.exam;
    const total = preguntas.length;
    const st = { semilla: Date.now() % 100000, i: 0, respuestas: [] }; // respuestas: índice original elegido

    function opcionesDe(qi) {
      return mezclar(preguntas[qi].options, st.semilla + qi * 7919);
    }

    function pintarPregunta() {
      const q = preguntas[st.i];
      const elegida = st.respuestas[st.i];
      const respondida = elegida !== undefined;
      const aciertos = st.respuestas.filter((r, qi) => r === preguntas[qi].correctIndex).length;
      const ops = opcionesDe(st.i);
      const ok = respondida && elegida === q.correctIndex;
      const ultima = st.i === total - 1;
      const pct = Math.round(((st.i + (respondida ? 1 : 0)) * 100) / total);

      cont.innerHTML = `<div class="quiz">
        <div class="quiz-top"><span>Pregunta ${st.i + 1} de ${total}</span>${barra(pct, "Avance del cuestionario")}<span class="aciertos">✓ ${aciertos}</span></div>
        <h2 id="enunciado">${enLinea(q.question)}</h2>
        <div class="opciones" role="group" aria-labelledby="enunciado">
          ${ops
            .map(([texto, original], pos) => {
              let cls = "";
              if (respondida) {
                if (original === q.correctIndex) cls = "correcta";
                else if (original === elegida) cls = "incorrecta";
                else cls = "apagada";
              }
              return `<button type="button" class="opcion ${cls}" data-original="${original}" ${respondida ? "disabled" : ""}>
                <span class="letra">${LETRAS[pos]}</span><span class="texto">${enLinea(texto)}</span></button>`;
            })
            .join("")}
        </div>
        ${
          respondida
            ? `<div class="feedback ${ok ? "bien" : "mal"}" aria-live="polite">
                <span class="titulo">${ok ? "¡Correcto!" : `Incorrecto. La respuesta correcta es la ${LETRAS[ops.findIndex(([, o]) => o === q.correctIndex)]}.`}</span>
                ${q.explanation ? `<p>${enLinea(q.explanation)}</p>` : ""}
                <div class="row"><button type="button" class="btn" id="btnSiguientePregunta">${ultima ? "Ver resultado" : "Siguiente pregunta →"}</button></div>
              </div>`
            : `<p class="quiz-ayuda">Pulsa <kbd>A</kbd>–<kbd>${LETRAS[ops.length - 1]}</kbd> para responder y <kbd>Enter</kbd> para seguir.</p>`
        }
      </div>`;

      cont.querySelectorAll(".opcion").forEach((b) => {
        b.onclick = () => responder(Number(b.dataset.original));
      });
      const sig = cont.querySelector("#btnSiguientePregunta");
      if (sig) {
        sig.onclick = avanzar;
        sig.focus({ preventScroll: true });
      }
      teclasQuiz = (e) => {
        const k = e.key.toUpperCase();
        const pos = LETRAS.indexOf(k);
        if (!respondida && pos >= 0 && pos < ops.length) {
          e.preventDefault();
          responder(ops[pos][1]);
        } else if (respondida && e.key === "Enter" && document.activeElement?.id !== "btnSiguientePregunta") {
          e.preventDefault();
          avanzar();
        }
      };
    }

    function responder(original) {
      if (st.respuestas[st.i] !== undefined) return;
      st.respuestas[st.i] = original;
      pintarPregunta();
    }

    function avanzar() {
      if (st.i < total - 1) {
        st.i++;
        pintarPregunta();
        cont.scrollIntoView({ block: "start", behavior: "smooth" });
      } else {
        terminar();
      }
    }

    function terminar() {
      teclasQuiz = null;
      const aciertos = st.respuestas.filter((r, qi) => r === preguntas[qi].correctIndex).length;
      P.registrarExamen(curso.id, cap.id, aciertos, total);
      const pct = Math.round((aciertos * 100) / total);
      const aprobado = aciertos / total >= P.APROBADO;
      const prev = P.capitulo(curso.id, cap.id).examen;
      const falladas = preguntas
        .map((q, qi) => ({ q, qi }))
        .filter(({ q, qi }) => st.respuestas[qi] !== q.correctIndex);
      const sig = siguienteElemento(curso, cap, "examen");

      cont.innerHTML = `<div class="quiz">
        <div class="resumen-nota ${aprobado ? "ok" : "ko"}">
          <span class="nota">${pct}%</span>
          <span><strong>${aprobado ? "¡Aprobado!" : "Aún no apruebas"}</strong><br>
          <span class="muted small">${aciertos} de ${total} correctas · se aprueba con ${Math.round(P.APROBADO * 100)}% · mejor nota ${Math.round((prev.mejor * 100) / prev.total)}%</span></span>
        </div>
        ${
          falladas.length
            ? `<div class="repaso"><h3>Para repasar</h3>${falladas
                .map(
                  ({ q }) => `<div class="repaso-item"><strong>${enLinea(q.question)}</strong>
                    <p>Respuesta correcta: <span class="correcta-txt">${enLinea(q.options[q.correctIndex])}</span></p>
                    ${q.explanation ? `<p class="muted">${enLinea(q.explanation)}</p>` : ""}</div>`
                )
                .join("")}</div>`
            : '<p class="muted">Respondiste todo bien. Buen trabajo.</p>'
        }
        <div class="row">
          <button type="button" class="btn ${aprobado ? "ghost" : ""}" id="btnReintentar">Nuevo intento</button>
          ${aprobado && sig ? `<a class="btn" href="${enlaceElemento(curso, sig.cap, sig.clave)}">Siguiente: ${escapar(sig.cap.code || sig.cap.title)} →</a>` : ""}
        </div>
      </div>`;
      cont.querySelector("#btnReintentar").onclick = () => {
        st.semilla = Date.now() % 100000;
        st.i = 0;
        st.respuestas = [];
        pintarPregunta();
      };
      alTerminar();
    }

    pintarPregunta();
  }

  // ---------- Vista: elemento de un capítulo ----------
  async function vistaCapitulo(idCurso, idCap, claveInicial) {
    const curso = await obtenerCurso(idCurso);
    const idx = curso.chapters.findIndex((c) => c.id === idCap);
    if (idx < 0) throw new Error(`No existe el capítulo "${idCap}"`);
    const cap = curso.chapters[idx];
    const elems = elementosDe(cap);
    const activa = elems.some(([k]) => k === claveInicial) ? claveInicial : elems[0]?.[0];
    const iActiva = elems.findIndex(([k]) => k === activa);
    teclasQuiz = null;

    setCrumbs([
      { texto: "Mi aprendizaje", href: "#/" },
      { texto: curso.title, href: `#/curso/${curso.id}` },
      { texto: cap.code || cap.title },
    ]);
    const refrescarSidebar = () => mostrarSidebar(sidebarCurso(curso, cap.id, activa));
    refrescarSidebar();
    document.title = `${cap.code ? cap.code + " · " : ""}${cap.title}`;
    cerrarMenu();
    P.registrarVisita(curso.id, cap.id, activa);

    const esLectura = ["teoria", "estandar", "comparacion"].includes(activa);
    const sig = siguienteElemento(curso, cap, activa);
    const anterior = iActiva > 0 ? elems[iActiva - 1] : null;
    const capAnterior = curso.chapters[idx - 1];

    let contenido = "";
    if (activa === "teoria") contenido = htmlTeoria(cap);
    else if (activa === "estandar") contenido = htmlEstandar(cap);
    else if (activa === "comparacion") contenido = htmlComparacion(cap);
    else if (activa === "ejercicios") contenido = htmlEjercicios(curso, cap);
    else if (activa === "examen") contenido = `<div id="cuestionario"></div>`;

    const piePagina = () => {
      const leido = !!P.capitulo(curso.id, cap.id).leido;
      if (esLectura && !leido) {
        return `<div class="fin-seccion"><p>¿Terminaste de leer? Marca la lectura como completada para llevar tu avance.</p>
          <button class="btn" type="button" id="btnCompletar">Marcar como completado</button></div>`;
      }
      if (esLectura) return `<div class="fin-seccion"><p><span class="pill ok">✓ Completado</span></p><button class="link-btn" type="button" id="btnDesmarcar">Desmarcar</button></div>`;
      return "";
    };

    const pasos = elems
      .map(([k, t]) => {
        const hecho = elementoHecho(curso, cap, k);
        return `<a role="tab" class="paso ${k === activa ? "activa" : ""} ${hecho ? "hecho" : ""}" aria-selected="${k === activa}" href="${enlaceElemento(curso, cap, k)}">${hecho && k !== activa ? "✓ " : ""}${escapar(t)}</a>`;
      })
      .join("");

    app.innerHTML = `
      <header class="cap-header">
        <div class="cap-meta"><span>${escapar(cap.module || "")}</span>
          <span class="derecha">${TIPO[activa]?.tipo || ""}${cap.estimatedMinutes ? ` · ${cap.estimatedMinutes} min` : ""} · ${TEXTO_ESTADO[P.estado(curso.id, cap.id)]}</span></div>
        <h1>${cap.code ? `<span class="cap-code-lg">${escapar(cap.code)}</span> ` : ""}${escapar(cap.title)}</h1>
        ${cap.subtitle ? `<p class="lead">${escapar(cap.subtitle)}</p>` : ""}
      </header>
      <nav class="pasos" role="tablist" aria-label="Elementos del capítulo">${pasos}</nav>
      <div class="tab-body ${activa === "examen" ? "" : "lectura"}">${contenido}<div id="pie">${piePagina()}</div></div>
      <nav class="pager">
        ${
          anterior
            ? `<a class="btn ghost" href="${enlaceElemento(curso, cap, anterior[0])}">← ${escapar(anterior[1])}</a>`
            : capAnterior
              ? `<a class="btn ghost" href="#/curso/${curso.id}/${capAnterior.id}">← ${escapar(capAnterior.code || "Anterior")}</a>`
              : "<span></span>"
        }
        ${sig ? `<a class="btn" href="${enlaceElemento(curso, sig.cap, sig.clave)}">Siguiente: ${escapar(sig.cap === cap ? sig.texto.replace(/ \(\d+\)$/, "") : sig.cap.code || sig.cap.title)} →</a>` : `<a class="btn" href="#/curso/${curso.id}">Volver al curso</a>`}
      </nav>`;

    // Mantener visible el paso activo en pantallas estrechas
    const barraPasos = app.querySelector(".pasos");
    const pasoActivo = barraPasos.querySelector(".paso.activa");
    if (pasoActivo) barraPasos.scrollLeft = pasoActivo.offsetLeft - (barraPasos.clientWidth - pasoActivo.offsetWidth) / 2;

    const enlazarPie = () => {
      const c = document.getElementById("btnCompletar");
      if (c) c.onclick = () => { P.marcarLeido(curso.id, cap.id, true); actualizarEstado(); };
      const d = document.getElementById("btnDesmarcar");
      if (d) d.onclick = () => { P.marcarLeido(curso.id, cap.id, false); actualizarEstado(); };
    };
    const actualizarEstado = () => {
      document.getElementById("pie").innerHTML = piePagina();
      enlazarPie();
      refrescarSidebar();
      app.querySelectorAll(".paso").forEach((a, i) => {
        const k = elems[i][0];
        const hecho = elementoHecho(curso, cap, k);
        a.classList.toggle("hecho", hecho);
        a.textContent = (hecho && k !== activa ? "✓ " : "") + elems[i][1];
      });
    };
    enlazarPie();
    if (activa === "ejercicios") enlazarEjercicios(curso, cap, actualizarEstado);
    if (activa === "examen") montarCuestionario(document.getElementById("cuestionario"), curso, cap, actualizarEstado);
    window.scrollTo(0, 0);
  }

  // ---------- Router ----------
  async function router() {
    const partes = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (partes[0] === "curso" && partes[1] && partes[2]) await vistaCapitulo(partes[1], partes[2], partes[3]);
      else if (partes[0] === "curso" && partes[1]) await vistaCurso(partes[1]);
      else await vistaCatalogo();
    } catch (err) {
      console.error(err);
      mostrarSidebar(null);
      const local = location.protocol === "file:";
      app.innerHTML = `<div class="panel error"><h2>No se pudo cargar</h2><p>${escapar(err.message)}</p>
        ${local ? "<p>Estás abriendo el archivo directamente. Ejecuta <code>python -m http.server</code> en la carpeta del proyecto y abre <code>http://localhost:8000</code>.</p>" : ""}
        <p><a href="#/">Volver al inicio</a></p></div>`;
    }
    app.focus({ preventScroll: true });
  }

  window.addEventListener("hashchange", router);
  router();
})();
