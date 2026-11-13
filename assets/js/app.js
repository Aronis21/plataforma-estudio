/* Plataforma de Estudio — aplicación de una sola página sin dependencias de compilación.
 * Rutas (hash):
 *   #/                          catálogo de cursos
 *   #/curso/<idCurso>           índice del curso por módulos
 *   #/curso/<idCurso>/<idCap>   capítulo (pestañas: teoría, estándar, comparación, ejercicios, examen)
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

  // ---------- Utilidades de UI ----------
  function setCrumbs(items) {
    crumbs.innerHTML = items
      .map((it, i) => (it.href && i < items.length - 1 ? `<a href="${it.href}">${escapar(it.texto)}</a>` : `<span>${escapar(it.texto)}</span>`))
      .join('<span class="sep">/</span>');
  }

  function barra(pct) {
    return `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`;
  }

  const ICONO_ESTADO = { aprobado: "✓", leido: "●", pendiente: "○" };
  const TEXTO_ESTADO = { aprobado: "Aprobado", leido: "Leído", pendiente: "Pendiente" };

  function mostrarSidebar(html) {
    if (html == null) {
      sidebar.hidden = true;
      menuBtn.hidden = true;
      document.body.classList.remove("con-sidebar");
      return;
    }
    sidebar.innerHTML = html;
    sidebar.hidden = false;
    menuBtn.hidden = false;
    document.body.classList.add("con-sidebar");
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

  function sidebarCurso(curso, idActivo) {
    const r = P.resumenCurso(curso);
    let html = `<div class="side-head">
      <a href="#/curso/${curso.id}" class="side-title">${escapar(curso.title)}</a>
      ${barra(r.pct)}
      <div class="side-meta">${r.aprobados}/${r.total} aprobados</div>
    </div><nav class="side-nav">`;
    for (const [modulo, caps] of modulosDe(curso)) {
      html += `<div class="side-mod">${escapar(modulo)}</div>`;
      for (const cap of caps) {
        const est = P.estado(curso.id, cap.id);
        html += `<a href="#/curso/${curso.id}/${cap.id}" class="side-item ${cap.id === idActivo ? "activo" : ""} est-${est}">
          <span class="est" title="${TEXTO_ESTADO[est]}">${ICONO_ESTADO[est]}</span>
          <span class="side-code">${escapar(cap.code || "")}</span>
          <span class="side-name">${escapar(cap.title)}</span>
        </a>`;
      }
    }
    html += "</nav>";
    return html;
  }

  // ---------- Vista: catálogo ----------
  async function vistaCatalogo() {
    const cat = await obtenerCatalogo();
    setCrumbs([{ texto: "Cursos" }]);
    mostrarSidebar(null);
    document.title = cat.titulo || "Plataforma de Estudio";

    const visibles = cat.cursos.filter((c) => c.publicado !== false);
    const cursos = await Promise.all(visibles.map((c) => obtenerCurso(c.id).catch((err) => ({ _error: err, _meta: c }))));

    let tarjetas = "";
    for (const curso of cursos) {
      if (curso._error) {
        tarjetas += `<div class="card error"><h3>${escapar(curso._meta.id)}</h3><p>${escapar(curso._error.message)}</p></div>`;
        continue;
      }
      const r = P.resumenCurso(curso);
      const minutos = curso.chapters.reduce((s, c) => s + (c.estimatedMinutes || 0), 0);
      const etiquetas = (curso._meta.etiquetas || []).map((t) => `<span class="tag">${escapar(t)}</span>`).join("");
      tarjetas += `<a class="card course-card" href="#/curso/${curso.id}" style="--acento:${escapar(curso._meta.color || "#2563eb")}">
        <div class="card-top">
          <span class="kicker">${escapar(curso._meta.categoria || curso.level || "Curso")}</span>
          ${curso.level ? `<span class="pill">${escapar(curso.level)}</span>` : ""}
        </div>
        <h3>${escapar(curso.title)}</h3>
        <p class="muted">${escapar(curso.subtitle || "")}</p>
        <div class="tags">${etiquetas}</div>
        <div class="card-stats">
          <span>${curso.chapters.length} lecciones</span><span>·</span><span>~${Math.round(minutos / 60)} h</span>
        </div>
        ${barra(r.pct)}
        <div class="card-foot">${r.pct}% completado · ${r.aprobados} de ${r.total} aprobados</div>
      </a>`;
    }

    app.innerHTML = `
      <section class="hero">
        <h1>${escapar(cat.titulo || "Plataforma de Estudio")}</h1>
        <p class="lead">${escapar(cat.descripcion || "")}</p>
      </section>
      <section class="grid">${tarjetas || '<p class="muted">Aún no hay cursos publicados.</p>'}</section>
      <section class="panel ajustes">
        <h2>Tu progreso</h2>
        <p class="muted">El progreso se guarda en este navegador. Expórtalo para pasarlo a otro dispositivo.</p>
        <div class="row">
          <button class="btn" id="btnExportar" type="button">Exportar progreso</button>
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

  // ---------- Vista: índice del curso ----------
  async function vistaCurso(idCurso) {
    const curso = await obtenerCurso(idCurso);
    setCrumbs([{ texto: "Cursos", href: "#/" }, { texto: curso.title }]);
    mostrarSidebar(sidebarCurso(curso, null));
    document.title = curso.title;

    const r = P.resumenCurso(curso);
    const siguiente = curso.chapters.find((c) => P.estado(curso.id, c.id) !== "aprobado");
    let modulos = "";
    for (const [modulo, caps] of modulosDe(curso)) {
      const aprob = caps.filter((c) => P.estado(curso.id, c.id) === "aprobado").length;
      modulos += `<section class="modulo">
        <div class="modulo-head"><h2>${escapar(modulo)}</h2><span class="muted small">${aprob}/${caps.length}</span></div>
        <div class="lista-caps">`;
      for (const cap of caps) {
        const est = P.estado(curso.id, cap.id);
        const ex = P.capitulo(curso.id, cap.id).examen;
        modulos += `<a class="cap-row est-${est}" href="#/curso/${curso.id}/${cap.id}">
          <span class="est">${ICONO_ESTADO[est]}</span>
          <span class="cap-code">${escapar(cap.code || "")}</span>
          <span class="cap-main"><strong>${escapar(cap.title)}</strong><span class="muted small">${escapar(cap.subtitle || "")}</span></span>
          <span class="cap-side muted small">${cap.estimatedMinutes ? cap.estimatedMinutes + " min" : ""}${ex ? `<br>Examen ${ex.mejor}/${ex.total}` : ""}</span>
        </a>`;
      }
      modulos += "</div></section>";
    }

    app.innerHTML = `
      <section class="hero curso-hero">
        <span class="kicker">${escapar(curso._meta.categoria || "")}${curso.level ? " · " + escapar(curso.level) : ""}</span>
        <h1>${escapar(curso.title)}</h1>
        <p class="lead">${escapar(curso.subtitle || "")}</p>
        <div class="hero-progress">${barra(r.pct)}<span>${r.pct}% · ${r.aprobados} aprobados · ${r.leidos} leídos</span></div>
        <div class="row">
          ${siguiente ? `<a class="btn" href="#/curso/${curso.id}/${siguiente.id}">${r.aprobados || r.leidos ? "Continuar" : "Empezar"}: ${escapar(siguiente.code || siguiente.title)}</a>` : '<span class="pill ok">¡Curso completado!</span>'}
          <button class="btn ghost" id="btnReiniciar" type="button">Reiniciar progreso</button>
        </div>
      </section>
      ${modulos}`;

    document.getElementById("btnReiniciar").onclick = () => {
      if (confirm("¿Borrar todo el progreso de este curso en este navegador?")) {
        P.reiniciarCurso(curso.id);
        vistaCurso(curso.id);
      }
    };
  }

  // ---------- Vista: capítulo ----------
  function pestañasDe(cap) {
    const t = [];
    if (cap.theorySections?.length || cap.objectives?.length) t.push(["teoria", "Teoría"]);
    if (cap.professionalStandard) t.push(["estandar", "Estándar profesional"]);
    if (cap.comparison) t.push(["comparacion", "Junior vs. Intermedio"]);
    if (cap.exercises?.length) t.push(["ejercicios", `Ejercicios (${cap.exercises.length})`]);
    if (cap.exam?.length) t.push(["examen", `Examen (${cap.exam.length})`]);
    return t;
  }

  function htmlTeoria(cap) {
    let h = "";
    if (cap.objectives?.length) {
      h += `<div class="panel objetivos"><h3>Objetivos</h3><ul>${cap.objectives.map((o) => `<li>${enLinea(o)}</li>`).join("")}</ul></div>`;
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

  function htmlExamen(curso, cap, semilla) {
    const prev = P.capitulo(curso.id, cap.id).examen;
    const letras = "ABCDEFGH";
    let h = `<div class="panel examen-info">
      <p>Responde las ${cap.exam.length} preguntas y pulsa <strong>Calificar</strong>. Aprobado desde ${Math.round(P.APROBADO * 100)}%.
      Las opciones cambian de orden en cada intento.</p>
      ${prev ? `<p class="muted small">Mejor resultado: ${prev.mejor}/${prev.total} · Último: ${prev.ultimo}/${prev.total} · Intentos: ${prev.intentos}</p>` : ""}
    </div><form id="formExamen">`;
    cap.exam.forEach((q, qi) => {
      const opciones = mezclar(q.options, semilla + qi * 7919);
      h += `<fieldset class="pregunta" data-correcta="${q.correctIndex}">
        <legend><span class="num">${qi + 1}</span>${enLinea(q.question)}</legend>
        ${opciones
          .map(
            ([texto, original], pos) => `<label class="opcion"><input type="radio" name="q${qi}" value="${original}">
              <span class="letra">${letras[pos]}</span><span>${enLinea(texto)}</span></label>`
          )
          .join("")}
        <div class="explicacion" hidden>${enLinea(q.explanation || "")}</div>
      </fieldset>`;
    });
    h += `<div class="row sticky-actions">
        <button class="btn" type="submit">Calificar</button>
        <button class="btn ghost" type="button" id="btnReintentar" hidden>Nuevo intento</button>
        <span id="resultado" class="resultado" aria-live="polite"></span>
      </div></form>`;
    return h;
  }

  function enlazarExamen(curso, cap, repintar) {
    const form = document.getElementById("formExamen");
    if (!form) return;
    form.onsubmit = (e) => {
      e.preventDefault();
      const preguntas = [...form.querySelectorAll(".pregunta")];
      const sinResponder = preguntas.filter((f) => !f.querySelector("input:checked"));
      if (sinResponder.length && !confirm(`Te faltan ${sinResponder.length} pregunta(s). ¿Calificar de todos modos?`)) return;
      let aciertos = 0;
      for (const f of preguntas) {
        const correcta = f.dataset.correcta;
        const marcada = f.querySelector("input:checked");
        f.querySelectorAll(".opcion").forEach((op) => {
          const inp = op.querySelector("input");
          inp.disabled = true;
          if (inp.value === correcta) op.classList.add("correcta");
          else if (inp.checked) op.classList.add("incorrecta");
        });
        const ok = marcada && marcada.value === correcta;
        if (ok) aciertos++;
        f.classList.add(ok ? "bien" : "mal");
        f.querySelector(".explicacion").hidden = false;
      }
      const total = preguntas.length;
      P.registrarExamen(curso.id, cap.id, aciertos, total);
      const aprobado = aciertos / total >= P.APROBADO;
      const res = document.getElementById("resultado");
      res.innerHTML = `<strong>${aciertos}/${total}</strong> (${Math.round((aciertos * 100) / total)}%) — ${aprobado ? "¡Aprobado!" : "Aún no; repasa y vuelve a intentarlo."}`;
      res.className = "resultado " + (aprobado ? "ok" : "ko");
      form.querySelector("button[type=submit]").hidden = true;
      document.getElementById("btnReintentar").hidden = false;
      mostrarSidebar(sidebarCurso(curso, cap.id));
    };
    document.getElementById("btnReintentar").onclick = repintar;
  }

  function enlazarEjercicios(curso, cap) {
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
      chk.onchange = () => P.marcarEjercicio(curso.id, cap.id, idEj, chk.checked);
    });
  }

  async function vistaCapitulo(idCurso, idCap, pestañaInicial) {
    const curso = await obtenerCurso(idCurso);
    const idx = curso.chapters.findIndex((c) => c.id === idCap);
    if (idx < 0) throw new Error(`No existe el capítulo "${idCap}"`);
    const cap = curso.chapters[idx];
    const anterior = curso.chapters[idx - 1];
    const siguiente = curso.chapters[idx + 1];
    const pestañas = pestañasDe(cap);
    let activa = pestañas.some(([k]) => k === pestañaInicial) ? pestañaInicial : pestañas[0]?.[0];

    setCrumbs([{ texto: "Cursos", href: "#/" }, { texto: curso.title, href: `#/curso/${curso.id}` }, { texto: cap.code || cap.title }]);
    mostrarSidebar(sidebarCurso(curso, cap.id));
    document.title = `${cap.code ? cap.code + " · " : ""}${cap.title}`;
    cerrarMenu();

    const pintar = () => {
      const leido = !!P.capitulo(curso.id, cap.id).leido;
      let contenido = "";
      if (activa === "teoria") contenido = htmlTeoria(cap);
      else if (activa === "estandar") contenido = htmlEstandar(cap);
      else if (activa === "comparacion") contenido = htmlComparacion(cap);
      else if (activa === "ejercicios") contenido = htmlEjercicios(curso, cap);
      else if (activa === "examen") contenido = htmlExamen(curso, cap, Date.now() % 100000);

      app.innerHTML = `
        <header class="cap-header">
          <span class="kicker">${escapar(cap.module || "")}</span>
          <h1><span class="cap-code-lg">${escapar(cap.code || "")}</span> ${escapar(cap.title)}</h1>
          ${cap.subtitle ? `<p class="lead">${escapar(cap.subtitle)}</p>` : ""}
          <div class="row meta">
            ${cap.estimatedMinutes ? `<span class="pill">⏱ ${cap.estimatedMinutes} min</span>` : ""}
            <span class="pill est-${P.estado(curso.id, cap.id)}">${TEXTO_ESTADO[P.estado(curso.id, cap.id)]}</span>
            <label class="check"><input type="checkbox" id="chkLeido" ${leido ? "checked" : ""}> Marcar como leído</label>
          </div>
        </header>
        <nav class="tabs" role="tablist">
          ${pestañas.map(([k, t]) => `<button role="tab" type="button" class="tab ${k === activa ? "activa" : ""}" data-tab="${k}" aria-selected="${k === activa}">${escapar(t)}</button>`).join("")}
        </nav>
        <div class="tab-body">${contenido}</div>
        <nav class="pager">
          ${anterior ? `<a class="btn ghost" href="#/curso/${curso.id}/${anterior.id}">← ${escapar(anterior.code || "Anterior")}</a>` : "<span></span>"}
          ${siguiente ? `<a class="btn" href="#/curso/${curso.id}/${siguiente.id}">${escapar(siguiente.code || "Siguiente")} →</a>` : `<a class="btn" href="#/curso/${curso.id}">Volver al índice</a>`}
        </nav>`;

      app.querySelectorAll(".tab").forEach((b) => {
        b.onclick = () => {
          activa = b.dataset.tab;
          pintar();
          app.querySelector(".tabs").scrollIntoView({ block: "start", behavior: "smooth" });
        };
      });
      document.getElementById("chkLeido").onchange = (e) => {
        P.marcarLeido(curso.id, cap.id, e.target.checked);
        pintar();
        mostrarSidebar(sidebarCurso(curso, cap.id));
      };
      if (activa === "ejercicios") enlazarEjercicios(curso, cap);
      if (activa === "examen") enlazarExamen(curso, cap, pintar);
    };
    pintar();
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
