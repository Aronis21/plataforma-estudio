/* NEXUS Learning · Cuaderno vivo — aplicación de una sola página sin dependencias de compilación.
 * Rutas (hash):
 *   #/                          página "Hoy" (catálogo de cursos)
 *   #/curso/<idCurso>           índice del curso por módulos
 *   #/curso/<idCurso>/<idCap>   capítulo (pestañas: teoría, estándar, comparación, ejercicios, examen)
 *   #/repaso                    repaso de las tarjetas que tocan hoy
 */
(function () {
  const { escapar, enLinea, bloques, bloqueCodigo } = window.Texto;
  const P = window.Progreso;
  const C = window.Cuaderno;
  const Tutor = window.Tutor;

  const app = document.getElementById("app");
  const sidebar = document.getElementById("sidebar");
  const crumbs = document.getElementById("crumbs");
  const menuBtn = document.getElementById("menuBtn");
  const backdrop = document.getElementById("backdrop");
  const chipCurso = document.getElementById("chipCurso");
  const separadores = document.getElementById("separadores");

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

  // ---------- Tema del cuaderno (papel de cada curso) ----------
  // Cada curso del catálogo indica su "tema": datos | web | ia. Sin curso, el papel es "hoy".
  const TEMAS = ["hoy", "datos", "web", "ia"];
  const NOMBRE_CUADERNO = { datos: "Cuaderno de analista", web: "Cuaderno de desarrollador", ia: "Cuaderno de laboratorio" };

  function temaDe(entrada) {
    return entrada && TEMAS.includes(entrada.tema) ? entrada.tema : "hoy";
  }

  function aplicarTema(entrada) {
    const tema = temaDe(entrada);
    document.body.dataset.tema = tema;
    if (entrada && tema !== "hoy") {
      chipCurso.textContent = entrada.cuaderno || NOMBRE_CUADERNO[tema] || entrada.id;
      chipCurso.hidden = false;
    } else {
      chipCurso.hidden = true;
    }
    pintarSeparadores(entrada ? entrada.id : null);
  }

  function pintarSeparadores(idActivo) {
    if (!catalogo) return;
    const cursos = catalogo.cursos.filter((c) => c.publicado !== false);
    let html = `<a class="separador hoy" href="#/" ${idActivo ? "" : 'aria-current="page"'}>Hoy</a>`;
    for (const c of cursos) {
      const tema = temaDe(c);
      const nombre = c.separador || c.id;
      html += `<a class="separador ${tema}" href="#/curso/${encodeURIComponent(c.id)}" ${c.id === idActivo ? 'aria-current="page"' : ""}>${escapar(nombre)}</a>`;
    }
    separadores.innerHTML = html;
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
    const prep = enPreparacion(curso._meta);
    let html = `<div class="side-head">
      <div class="side-titulo-mano">${TITULO_INDICE[temaDe(curso._meta)] || "Índice"}</div>
      <a href="#/curso/${curso.id}" class="side-title">${escapar(curso.title)}</a>
      ${prep ? "" : barra(r.pct)}
      <div class="side-meta">${prep ? "En preparación" : `${r.aprobados}/${r.total} aprobados`}</div>
    </div><nav class="side-nav">`;
    for (const [modulo, caps] of modulosDe(curso)) {
      html += `<div class="side-mod">${escapar(modulo)}</div>`;
      for (const cap of caps) {
        const est = P.estado(curso.id, cap.id);
        const interior = `<span class="est" title="${prep ? "En preparación" : TEXTO_ESTADO[est]}">${prep ? "·" : ICONO_ESTADO[est]}</span>
          <span class="side-name"><span class="side-code">${escapar(cap.code || "")}</span>${escapar(cap.title)}</span>`;
        html += prep
          ? `<div class="side-item">${interior}</div>`
          : `<a href="#/curso/${curso.id}/${cap.id}" class="side-item ${cap.id === idActivo ? "activo" : ""} est-${est}">${interior}</a>`;
      }
    }
    html += "</nav>";
    return html;
  }

  // ---------- Utilidades del cuaderno ----------
  const RESALTADOR = { datos: "#FFD45C", web: "#A9D2FF", ia: "#DCF58A", hoy: "#FFD45C" };
  const FRANJA = { datos: "#F0B429", web: "#1D64D8", ia: "#C6E85A", hoy: "#1D1F24" };
  const enPreparacion = (entrada) => entrada && entrada.estado === "en-preparacion";

  function siguienteCap(curso) {
    return curso.chapters.find((c) => P.estado(curso.id, c.id) !== "aprobado") || null;
  }

  function aviso(texto) {
    const div = document.createElement("div");
    div.className = "aviso-flotante";
    div.setAttribute("role", "status");
    div.textContent = texto;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2600);
  }

  function fechaLarga() {
    try {
      return new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    } catch (_) {
      return C.fechaISO();
    }
  }

  async function cursosVisibles() {
    const cat = await obtenerCatalogo();
    const visibles = cat.cursos.filter((c) => c.publicado !== false);
    return Promise.all(visibles.map((c) => obtenerCurso(c.id).catch((err) => ({ _error: err, _meta: c, id: c.id, chapters: [] }))));
  }

  function respaldoHTML() {
    return `<section class="respaldo" aria-labelledby="tRespaldo">
      <h2 class="h-mano" id="tRespaldo">Respaldo de tu cuaderno</h2>
      <p class="muted small">Tu progreso, notas, resaltados y tarjetas se guardan en este navegador. Descarga un respaldo para pasarlos a otro dispositivo.</p>
      <div class="row">
        <button class="btn" id="btnExportar" type="button">Descargar respaldo</button>
        <label class="btn ghost">Cargar respaldo<input type="file" id="inpImportar" accept="application/json" hidden></label>
      </div>
      <p class="muted small" id="msgProgreso" aria-live="polite"></p>
    </section>`;
  }

  function enlazarRespaldo(repintar) {
    document.getElementById("btnExportar").onclick = () => {
      const datos = { ...P.exportarTodo(), version: 2, cuaderno: C.exportar() };
      const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nexus-respaldo-${C.fechaISO()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    document.getElementById("inpImportar").onchange = async (e) => {
      const msg = document.getElementById("msgProgreso");
      try {
        const datos = JSON.parse(await e.target.files[0].text());
        P.importarTodo(datos);
        if (datos.cuaderno) C.importar(datos.cuaderno);
        aviso("Respaldo cargado");
        repintar();
      } catch (err) {
        msg.textContent = "No se pudo cargar: " + err.message;
      }
    };
  }

  // ---------- Vista: Hoy (página principal) ----------
  async function vistaHoy() {
    const cat = await obtenerCatalogo();
    setCrumbs([{ texto: "Hoy" }]);
    mostrarSidebar(null);
    aplicarTema(null);
    document.title = cat.titulo || "NEXUS Learning";

    const cursos = await cursosVisibles();
    const activos = cursos.filter((c) => !c._error && !enPreparacion(c._meta));
    const plan = C.planDeHoy();
    const pendientes = C.tarjetasPendientes();
    const racha = C.racha();

    // Plan de hoy: el siguiente capítulo de cada curso + repaso + lo que tú agregues
    const items = [];
    for (const curso of activos) {
      const sig = siguienteCap(curso);
      if (!sig) continue;
      const tema = temaDe(curso._meta);
      items.push({
        clave: `sig:${curso.id}:${sig.id}`,
        html: `<a href="#/curso/${curso.id}/${sig.id}"><span class="marcador" style="--resaltador:${RESALTADOR[tema]}">${escapar(sig.code || "")} · ${escapar(recortar(sig.title, 42))}</span></a>${sig.estimatedMinutes ? ` <span class="min">— ${sig.estimatedMinutes} min</span>` : ""}`,
      });
    }
    if (pendientes.length) {
      items.push({ clave: "tarjetas", html: `<a href="#/repaso"><span class="marcador" style="--resaltador:#DCF58A">${pendientes.length} ${pendientes.length === 1 ? "tarjeta" : "tarjetas"} de repaso</span></a>` });
    }
    for (const x of plan.extra) items.push({ clave: x.id, html: escapar(x.texto), extra: true });

    const planHTML = items.length
      ? items.map((it) => `<li><label><input type="checkbox" data-plan="${escapar(it.clave)}" ${plan.hechos[it.clave] ? "checked" : ""}>
          <span class="${plan.hechos[it.clave] ? "hecho" : ""}">${it.html}</span></label>
          ${it.extra ? `<button class="quitar" type="button" data-quitar="${escapar(it.clave)}" aria-label="Quitar del plan">✕</button>` : ""}</li>`).join("")
      : `<li class="muted">Nada pendiente. Agrega algo abajo.</li>`;

    // Nota del tutor
    let examenPendiente = null;
    for (const curso of activos) {
      for (const cap of curso.chapters) {
        const ex = P.capitulo(curso.id, cap.id).examen;
        if (ex && ex.total && ex.mejor / ex.total < P.APROBADO && (!examenPendiente || ex.fecha > examenPendiente.fecha)) {
          examenPendiente = { code: cap.code || cap.title, ultimo: ex.ultimo, total: ex.total, fecha: ex.fecha };
        }
      }
    }
    const dudas = C.notas({ tipo: "duda" });
    const primerSiguiente = activos.map(siguienteCap).find(Boolean);
    const notaTutor = Tutor.notaDelDia({ examenPendiente, dudaReciente: dudas[dudas.length - 1], tarjetasHoy: pendientes.length, racha, siguiente: primerSiguiente });

    // "Te quedaste aquí"
    let aqui = null;
    const u = C.ultimo();
    if (u) {
      const curso = activos.find((c) => c.id === u.curso);
      const cap = curso && curso.chapters.find((c) => c.id === u.cap);
      if (cap) aqui = { curso, cap, pestana: u.pestana };
    }
    if (!aqui && activos[0]) {
      const cap = siguienteCap(activos[0]);
      if (cap) aqui = { curso: activos[0], cap, pestana: null };
    }
    let aquiHTML = "";
    if (aqui) {
      const tema = temaDe(aqui.curso._meta);
      const notasCap = C.notas({ curso: aqui.curso.id, cap: aqui.cap.id, tipo: "nota" });
      const ultimaNota = notasCap[notasCap.length - 1];
      aquiHTML = `<a class="papel-card" href="#/curso/${aqui.curso.id}/${aqui.cap.id}${aqui.pestana ? "/" + aqui.pestana : ""}" style="--franja:${FRANJA[tema]}">
        <span class="franja" aria-hidden="true"></span>
        <div class="cabecera-card"><span class="etiqueta">${escapar(aqui.curso._meta.separador || "")} · ${u ? "Te quedaste aquí" : "Para empezar"}</span><span class="small muted">${escapar(aqui.cap.code || "")}</span></div>
        <h3>${escapar(aqui.cap.title)}</h3>
        <p class="extracto">${escapar(aqui.cap.subtitle || "")}</p>
        ${ultimaNota ? `<div class="nota-mano" style="margin-top:.7rem">↳ tu nota: “${escapar(recortar(ultimaNota.texto, 90))}”</div>` : ""}
      </a>`;
    }

    // Último resaltado y mazo de tarjetas
    const resaltes = C.resaltados();
    const ult = resaltes[resaltes.length - 1];
    const fragmentoHTML = ult
      ? `<a class="papel-card" href="#/curso/${encodeURIComponent(ult.curso)}/${encodeURIComponent(ult.cap)}" style="flex:1 1 220px">
          <span class="etiqueta">Fragmento resaltado</span>
          <p class="extracto" style="margin-top:.6rem"><span class="marcador">${escapar(recortar(ult.texto, 140))}</span></p>
        </a>`
      : `<div class="papel-card" style="flex:1 1 220px"><span class="etiqueta">Fragmentos</span>
          <p class="nota-mano" style="margin:.6rem 0 0">Resalta una frase en cualquier lección y aparecerá aquí.</p></div>`;
    const mazoHTML = pendientes.length
      ? `<a class="mazo" href="#/repaso" style="flex:1 1 220px"><span class="mazo-frente">
          <span class="etiqueta">${pendientes.length} ${pendientes.length === 1 ? "tarjeta" : "tarjetas"} para hoy</span>
          <span class="pregunta-txt">${escapar(recortar(pendientes[0].frente, 110))}</span>
          <span class="nota-mano" style="display:block;margin-top:.5rem;font-size:1.2rem;color:var(--tinta-2)">toca para repasar</span></span></a>`
      : `<div class="mazo" style="flex:1 1 220px"><span class="mazo-frente">
          <span class="etiqueta">Tarjetas de repaso</span>
          <span class="pregunta-txt">${C.tarjetas().length ? "Hoy no te toca ninguna. ¡Al día!" : "Aún no tienes tarjetas: créalas en las lecciones o al fallar una pregunta."}</span></span></div>`;

    // Cuadernos (cursos)
    const cuadernosHTML = cursos.map((curso) => {
      const m = curso._meta;
      const tema = temaDe(m);
      if (curso._error) return `<div class="cuaderno-item ${tema}"><strong>${escapar(m.id)}</strong><span class="small">${escapar(curso._error.message)}</span></div>`;
      const prep = enPreparacion(m);
      const r = P.resumenCurso(curso);
      return `<a class="cuaderno-item ${tema} ${prep ? "prep" : ""}" href="#/curso/${curso.id}">
        <span class="tipo">${escapar(m.cuaderno || NOMBRE_CUADERNO[tema] || "Cuaderno")}</span>
        <strong>${escapar(curso.title)}</strong>
        <span class="pie"><span>${prep ? "En preparación" : `${r.aprobados}/${r.total} aprobados`}</span><span>${prep ? "" : r.pct + "%"}</span></span>
        ${prep ? "" : `<span class="mini-bar"><span style="width:${r.pct}%"></span></span>`}
      </a>`;
    }).join("");

    // Margen: dudas guardadas
    const dudasHTML = dudas.length
      ? `<ul class="lista-notas">${dudas.slice(-6).reverse().map((n) => `<li class="duda"><span class="nota-mano">${escapar(n.texto)}</span>
          <button class="borrar" type="button" data-borrar-nota="${n.id}" aria-label="Borrar duda">✕</button></li>`).join("")}</ul>`
      : `<p class="nota-mano" style="color:var(--tinta-2)">Aquí aparecerán las dudas que escribas abajo.</p>`;

    app.innerHTML = `<div class="pagina">
      <div class="pagina-main">
        <header class="fila-panel" style="justify-content:space-between;align-items:flex-end;gap:1rem 2rem">
          <div><div class="fecha-mano">${escapar(fechaLarga())}</div><h1 class="titulo-hoja">Hoy en tu cuaderno</h1></div>
          <div class="nota-mano inclinada" style="color:var(--tinta-2)">${racha ? `racha: ${racha} ${racha === 1 ? "día" : "días"} · <span class="subrayado-mano">¡no la rompas!</span>` : "hoy puede empezar tu racha"}</div>
        </header>
        <div class="fila-panel" style="margin-top:2.2rem">
          <section style="flex:1 1 300px;min-width:0" aria-labelledby="tPlan">
            <h2 class="h-mano" id="tPlan">Plan de hoy</h2>
            <ul class="plan">${planHTML}</ul>
            <form class="fila-agregar" id="formPlan">
              <label class="sr" for="inpPlan">Agregar al plan</label>
              <input class="entrada-mano" id="inpPlan" type="text" placeholder="agregar algo al plan…" autocomplete="off">
              <button class="btn ghost" type="submit">Añadir</button>
            </form>
            <div class="nota-adhesiva" style="margin-top:2.2rem;max-width:360px">
              <span class="cinta" aria-hidden="true"></span>
              <span class="etiqueta">Nota del tutor</span>
              <p>${escapar(notaTutor)}</p>
            </div>
          </section>
          <section style="flex:1.4 1 380px;min-width:0;display:flex;flex-direction:column;gap:1.4rem" aria-label="Continuar">
            ${aquiHTML}
            <div class="fila-panel" style="gap:1.4rem">${fragmentoHTML}${mazoHTML}</div>
          </section>
        </div>
        <section style="margin-top:2.6rem" aria-labelledby="tCuadernos">
          <h2 class="h-mano" id="tCuadernos">Tus cuadernos</h2>
          <div class="cuadernos">${cuadernosHTML || '<p class="muted">Aún no hay cursos publicados.</p>'}</div>
        </section>
        <form class="fila-agregar" id="formDuda" style="margin-top:2.4rem">
          <svg width="60" height="30" viewBox="0 0 60 30" aria-hidden="true" style="flex:none"><path d="M4 22C18 6 36 4 52 14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" style="color:var(--mano)"/><path d="M46 8l7 6-8 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" style="color:var(--mano)"/></svg>
          <label class="sr" for="inpDuda">Escribe una duda</label>
          <input class="entrada-mano" id="inpDuda" type="text" placeholder="escribe cualquier duda aquí y la guardo en tu cuaderno…" autocomplete="off">
          <button class="btn ghost" type="submit">Guardar duda</button>
        </form>
        ${respaldoHTML()}
      </div>
      <aside class="margen" aria-label="Margen">
        <div class="margen-titulo">Dudas guardadas</div>
        ${dudasHTML}
        <div class="margen-pie">
          <div class="fila"><span>Tarjetas en tu mazo</span><span>${C.tarjetas().length}</span></div>
          <div class="fila"><span>Resaltados</span><span>${resaltes.length}</span></div>
          <div class="fila"><span>Notas</span><span>${C.notas({ tipo: "nota" }).length}</span></div>
        </div>
      </aside>
    </div>`;

    app.querySelectorAll("[data-plan]").forEach((chk) => {
      chk.onchange = () => {
        C.marcarPlan(chk.dataset.plan, chk.checked);
        if (chk.checked) C.registrarActividad();
        chk.nextElementSibling.classList.toggle("hecho", chk.checked);
      };
    });
    app.querySelectorAll("[data-quitar]").forEach((b) => (b.onclick = () => { C.quitarDelPlan(b.dataset.quitar); vistaHoy(); }));
    document.getElementById("formPlan").onsubmit = (e) => {
      e.preventDefault();
      const inp = document.getElementById("inpPlan");
      if (inp.value.trim()) { C.agregarAlPlan(inp.value); vistaHoy(); }
    };
    document.getElementById("formDuda").onsubmit = (e) => {
      e.preventDefault();
      const inp = document.getElementById("inpDuda");
      if (C.agregarNota({ texto: inp.value, tipo: "duda" })) { aviso("Duda guardada en tu cuaderno"); vistaHoy(); }
    };
    app.querySelectorAll("[data-borrar-nota]").forEach((b) => (b.onclick = () => { C.borrarNota(b.dataset.borrarNota); vistaHoy(); }));
    enlazarRespaldo(vistaHoy);
  }

  // ---------- Vista: repaso de tarjetas ----------
  async function vistaRepaso() {
    await obtenerCatalogo();
    setCrumbs([{ texto: "Hoy", href: "#/" }, { texto: "Repaso" }]);
    mostrarSidebar(null);
    aplicarTema(null);
    document.title = "Repaso · NEXUS";
    const cola = C.tarjetasPendientes();
    // Nombre legible del capítulo de cada tarjeta (p. ej. "Cap. 06")
    const nombresCap = {};
    for (const id of new Set(cola.map((t) => t.curso))) {
      try {
        const curso = await obtenerCurso(id);
        for (const c of curso.chapters) nombresCap[`${id}|${c.id}`] = c.code || c.title;
      } catch (_) { /* curso no disponible: se muestra el id */ }
    }
    let i = 0;
    let volteada = false;

    const pintar = () => {
      const t = cola[i];
      if (!t) {
        app.innerHTML = `<div class="pagina"><div class="pagina-main"><div class="repaso">
          <div class="fecha-mano">repaso</div><h1 class="titulo-hoja">${cola.length ? "¡Listo por hoy!" : "No hay tarjetas para hoy"}</h1>
          <p class="lead" style="margin-top:1rem">${cola.length ? `Repasaste ${cola.length} ${cola.length === 1 ? "tarjeta" : "tarjetas"}. Volverán cuando toque recordarlas.` : "Crea tarjetas desde las lecciones (resaltando una frase) o se crearán solas cuando falles una pregunta del examen."}</p>
          <a class="btn cta" href="#/" style="margin-top:1rem">Volver a Hoy</a></div></div></div>`;
        return;
      }
      const entrada = catalogo.cursos.find((c) => c.id === t.curso);
      app.innerHTML = `<div class="pagina"><div class="pagina-main"><div class="repaso">
        <div class="fila-panel" style="justify-content:space-between;align-items:baseline">
          <div class="fecha-mano">repaso de hoy</div><span class="etiqueta">${i + 1} de ${cola.length}</span>
        </div>
        <article class="tarjeta-repaso" style="margin-top:1rem;--chip-bg:${FRANJA[temaDe(entrada)]}">
          <div class="frente">${enLinea(t.frente)}</div>
          ${volteada ? `<div class="reverso">${t.reverso ? bloques(t.reverso) : '<p class="muted">Sin respuesta escrita.</p>'}</div>` : ""}
          <div class="origen">${escapar(entrada ? entrada.separador || entrada.id : t.curso)}${t.cap ? " · " + escapar(nombresCap[`${t.curso}|${t.cap}`] || t.cap) : ""}</div>
        </article>
        <div class="row" style="margin-top:1.2rem">
          ${volteada
            ? `<button class="btn ghost" type="button" data-cal="otra">No la sabía</button>
               <button class="btn" type="button" data-cal="bien">La sabía</button>
               <button class="btn cta" type="button" data-cal="facil">Muy fácil</button>`
            : `<button class="btn" type="button" id="btnVoltear">Ver respuesta</button>`}
          <button class="chip-btn" type="button" id="btnBorrarT" style="margin-left:auto">Borrar tarjeta</button>
        </div>
      </div></div></div>`;
      const v = document.getElementById("btnVoltear");
      if (v) v.onclick = () => { volteada = true; pintar(); };
      app.querySelectorAll("[data-cal]").forEach((b) => (b.onclick = () => { C.responderTarjeta(t.id, b.dataset.cal); i++; volteada = false; pintar(); }));
      document.getElementById("btnBorrarT").onclick = () => {
        if (confirm("¿Borrar esta tarjeta de tu mazo?")) { C.borrarTarjeta(t.id); cola.splice(i, 1); volteada = false; pintar(); }
      };
    };
    pintar();
  }

  function recortar(t, n) {
    t = String(t || "");
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }

  // ---------- Vista: panel del curso ----------
  const TITULO_INDICE = { datos: "Índice", web: "índice/", ia: "Registro", hoy: "Índice" };

  // Etiqueta corta de cada módulo para el gráfico ("M1", "01", "E01", "In", "Ap")
  function etiquetaModulo(nombre) {
    const n = String(nombre);
    if (/^EXP\s*(\d+)/i.test(n)) return "E" + n.match(/^EXP\s*(\d+)/i)[1];
    if (/m[óo]dulo\s*(\d+)/i.test(n)) return "M" + n.match(/m[óo]dulo\s*(\d+)/i)[1];
    if (/^(\d+)/.test(n)) return n.match(/^(\d+)/)[1];
    if (/^ap[ée]ndice/i.test(n)) return "Ap";
    if (/^inicio/i.test(n)) return "In";
    return n.slice(0, 3);
  }

  // Gráfico de barras "dibujado a mano": porcentaje aprobado de cada módulo
  function graficoAvance(curso) {
    const mods = modulosDe(curso);
    const W = 360, H = 200, base = 172, alto = 140, x0 = 40;
    const paso = Math.min(52, (W - x0 - 10) / Math.max(1, mods.length));
    const ancho = Math.max(14, paso * 0.62);
    const temblor = (i) => ((i * 37) % 5) - 2; // pequeño desvío para que parezca hecho a mano
    let barras = "";
    let etiquetas = "";
    let marca = "";
    mods.forEach(([nombre, caps], i) => {
      const aprob = caps.filter((c) => P.estado(curso.id, c.id) === "aprobado").length;
      const pct = caps.length ? aprob / caps.length : 0;
      const x = x0 + i * paso + (paso - ancho) / 2;
      const y = base - Math.max(pct * alto, 0);
      const t = temblor(i);
      if (pct >= 1) {
        barras += `<path d="M${x} ${base}L${x + 1} ${y + t}L${x + ancho} ${y - t}L${x + ancho - 1} ${base}" style="fill:var(--ok);fill-opacity:.3;stroke:var(--ok)" stroke-width="2"/>`;
      } else if (pct > 0) {
        barras += `<path d="M${x} ${base}L${x + 1} ${y + t}L${x + ancho} ${y - t}L${x + ancho - 1} ${base}" style="fill:var(--resaltador);stroke:var(--acento)" stroke-width="2"/>`;
        if (!marca) marca = `<text x="${x - 6}" y="${y - 10}" style="fill:var(--acento);font-family:var(--f-mano)" font-size="21">${Math.round(pct * 100)}% ←aquí</text>`;
      } else {
        barras += `<path d="M${x} ${base}V${base - alto}H${x + ancho}V${base}" style="fill:none;stroke:var(--borde)" stroke-width="1.6" stroke-dasharray="4 5"/>`;
      }
      etiquetas += `<text x="${x + ancho / 2}" y="${base + 20}" text-anchor="middle" style="fill:var(--tinta);font-family:var(--f-mano)" font-size="17">${escapar(etiquetaModulo(nombre))}</text>`;
    });
    const descripcion = mods.map(([n, caps]) => `${n}: ${caps.filter((c) => P.estado(curso.id, c.id) === "aprobado").length} de ${caps.length}`).join("; ");
    return `<figure class="grafico-mano">
      <figcaption class="h-mano" style="font-size:1.5rem">mi avance por módulo</figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Capítulos aprobados por módulo. ${escapar(descripcion)}">
        <path d="M28 ${base}L${W - 10} ${base + 1}" style="stroke:var(--tinta)" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M30 ${base + 2}L29 18" style="stroke:var(--tinta)" stroke-width="2" fill="none" stroke-linecap="round"/>
        ${barras}${etiquetas}${marca}
      </svg>
    </figure>`;
  }

  function libroMayor(curso) {
    const r = P.resumenCurso(curso);
    let ejercicios = 0, mejor = 0, total = 0, minutosRestantes = 0;
    for (const cap of curso.chapters) {
      const pc = P.capitulo(curso.id, cap.id);
      ejercicios += Object.values(pc.ejercicios || {}).filter(Boolean).length;
      if (pc.examen && pc.examen.total) { mejor += pc.examen.mejor; total += pc.examen.total; }
      if (P.estado(curso.id, cap.id) !== "aprobado") minutosRestantes += cap.estimatedMinutes || 0;
    }
    const precision = total ? Math.round((mejor * 100) / total) + "%" : "—";
    return `<div class="libro-mayor">
      <div class="h-mano" style="font-size:1.5rem">libro mayor</div>
      <table><tbody>
        <tr><td>Capítulos aprobados</td><td>${r.aprobados} / ${r.total}</td></tr>
        <tr><td>Leídos sin aprobar</td><td>${r.leidos}</td></tr>
        <tr><td>Ejercicios resueltos</td><td>${ejercicios}</td></tr>
        <tr><td>Acierto en exámenes</td><td>${precision}</td></tr>
        <tr><td>Tiempo que falta</td><td>~${Math.round(minutosRestantes / 60)} h</td></tr>
      </tbody></table>
    </div>`;
  }

  async function vistaCurso(idCurso) {
    const curso = await obtenerCurso(idCurso);
    const m = curso._meta;
    const tema = temaDe(m);
    const prep = enPreparacion(m);
    setCrumbs([{ texto: "Hoy", href: "#/" }, { texto: curso.title }]);
    aplicarTema(m);
    mostrarSidebar(sidebarCurso(curso, null));
    document.title = curso.title;
    cerrarMenu();

    const r = P.resumenCurso(curso);
    const siguiente = siguienteCap(curso);
    const debiles = curso.chapters.filter((c) => {
      const ex = P.capitulo(curso.id, c.id).examen;
      return ex && ex.total && ex.mejor / ex.total < P.APROBADO;
    });

    let modulos = "";
    for (const [modulo, caps] of modulosDe(curso)) {
      const aprob = caps.filter((c) => P.estado(curso.id, c.id) === "aprobado").length;
      modulos += `<section class="modulo">
        <div class="modulo-head"><h2>${escapar(modulo)}</h2><span class="muted small">${prep ? caps.length + " temas" : `${aprob}/${caps.length}`}</span></div>
        <div class="lista-caps">`;
      for (const cap of caps) {
        const est = P.estado(curso.id, cap.id);
        const ex = P.capitulo(curso.id, cap.id).examen;
        const interior = `<span class="est">${prep ? "·" : ICONO_ESTADO[est]}</span>
          <span class="cap-code">${escapar(cap.code || "")}</span>
          <span class="cap-main"><span class="titulo-cap">${escapar(cap.title)}</span><span class="muted small">${escapar(cap.subtitle || "")}</span></span>
          <span class="cap-side muted small">${prep ? "en preparación" : `${cap.estimatedMinutes ? cap.estimatedMinutes + " min" : ""}${ex ? `<br>Examen ${ex.mejor}/${ex.total}` : ""}`}</span>`;
        modulos += prep
          ? `<div class="cap-row bloqueado">${interior}</div>`
          : `<a class="cap-row est-${est}" href="#/curso/${curso.id}/${cap.id}">${interior}</a>`;
      }
      modulos += "</div></section>";
    }

    const dudas = C.notas({ curso: curso.id, tipo: "duda" });
    const tarjetasCurso = C.tarjetas({ curso: curso.id });
    const pendientesCurso = C.tarjetasPendientes({ curso: curso.id });
    const sellos = (m.etiquetas || []).map((t) => `<span class="sello ${prep ? "pend" : ""}">${escapar(t)}</span>`).join("");

    app.innerHTML = `<div class="pagina">
      <div class="pagina-main">
        <header class="curso-hero">
          <div class="fecha-mano">${escapar((m.cuaderno || NOMBRE_CUADERNO[tema] || "cuaderno").toLowerCase())}</div>
          <h1 class="titulo-hoja">${escapar(curso.title)}</h1>
          <p class="lead" style="margin-top:.8rem">${escapar(curso.subtitle || "")}</p>
          ${prep ? "" : `<div class="row" style="margin-top:1rem">
            ${siguiente ? `<a class="btn cta" href="#/curso/${curso.id}/${siguiente.id}">${r.aprobados || r.leidos ? "Continuar" : "Empezar"}: ${escapar(siguiente.code || siguiente.title)} →</a>` : '<span class="pill ok">¡Curso completado!</span>'}
            ${pendientesCurso.length ? `<a class="btn ghost" href="#/repaso">${pendientesCurso.length} ${pendientesCurso.length === 1 ? "tarjeta" : "tarjetas"} para hoy</a>` : ""}
          </div>`}
        </header>
        ${prep
          ? `<div class="prep-aviso" style="margin-top:1.5rem"><span class="nota-mano">Este cuaderno está en preparación.</span>
              <p style="margin:.4rem 0 0">Ya tiene su temario; las lecciones, ejercicios y evaluaciones se irán agregando.</p></div>`
          : `<div class="fila-panel" style="margin-top:1.8rem">${graficoAvance(curso)}${libroMayor(curso)}</div>`}
        ${modulos}
      </div>
      <aside class="margen" aria-label="Margen">
        <div class="margen-titulo">${tema === "ia" ? "Observaciones" : "Margen"}</div>
        <div class="nota-adhesiva der"><span class="cinta" aria-hidden="true"></span><span class="etiqueta">Nota del tutor</span>
          <p>${escapar(prep ? "Mientras preparo este cuaderno, puedes escribir aquí abajo lo que te gustaría aprender en él." : Tutor.notaDelCurso({ resumen: r, siguiente, debiles }))}</p></div>
        ${sellos ? `<div><div class="h-mano" style="font-size:1.4rem">temas del cuaderno</div><div class="chips-temas">${sellos}</div></div>` : ""}
        <div>
          <div class="h-mano" style="font-size:1.4rem">${prep ? "lo que quiero aprender" : "dudas de este curso"}</div>
          ${dudas.length ? `<ul class="lista-notas">${dudas.slice(-5).reverse().map((n) => `<li class="duda"><span class="nota-mano">${escapar(n.texto)}</span><button class="borrar" type="button" data-borrar-nota="${n.id}" aria-label="Borrar">✕</button></li>`).join("")}</ul>` : ""}
          <form class="fila-agregar" id="formDudaCurso">
            <label class="sr" for="inpDudaCurso">Escribe una duda de este curso</label>
            <input class="entrada-mano" id="inpDudaCurso" type="text" placeholder="${prep ? "escribe un tema…" : "escribe una duda…"}" autocomplete="off">
            <button class="chip-btn" type="submit">Guardar</button>
          </form>
        </div>
        <div class="margen-pie">
          <div class="fila"><span>Tarjetas de este curso</span><span>${tarjetasCurso.length}</span></div>
          <div class="fila"><span>Notas y resaltados</span><span>${C.notas({ curso: curso.id, tipo: "nota" }).length + C.resaltados({ curso: curso.id }).length}</span></div>
          ${prep ? "" : `<button class="chip-btn" id="btnReiniciar" type="button" style="align-self:flex-start;margin-top:.5rem">Reiniciar progreso del curso</button>`}
        </div>
      </aside>
    </div>`;

    document.getElementById("formDudaCurso").onsubmit = (e) => {
      e.preventDefault();
      const inp = document.getElementById("inpDudaCurso");
      if (C.agregarNota({ curso: curso.id, texto: inp.value, tipo: "duda" })) { aviso("Guardado en tu cuaderno"); vistaCurso(curso.id); }
    };
    app.querySelectorAll("[data-borrar-nota]").forEach((b) => (b.onclick = () => { C.borrarNota(b.dataset.borrarNota); vistaCurso(curso.id); }));
    const btnR = document.getElementById("btnReiniciar");
    if (btnR) btnR.onclick = () => {
      if (confirm("¿Borrar todo el progreso de exámenes y lecturas de este curso en este navegador? Tus notas y tarjetas se conservan.")) {
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

    setCrumbs([{ texto: "Hoy", href: "#/" }, { texto: curso.title, href: `#/curso/${curso.id}` }, { texto: cap.code || cap.title }]);
    aplicarTema(curso._meta);
    mostrarSidebar(sidebarCurso(curso, cap.id));
    document.title = `${cap.code ? cap.code + " · " : ""}${cap.title}`;
    cerrarMenu();

    C.registrarActividad();
    const pintar = () => {
      C.recordarUltimo(curso.id, cap.id, activa);
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
          ${siguiente ? `<a class="btn cta" href="#/curso/${curso.id}/${siguiente.id}">${escapar(siguiente.code || "Siguiente")} →</a>` : `<a class="btn" href="#/curso/${curso.id}">Volver al índice</a>`}
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
      else if (partes[0] === "repaso") await vistaRepaso();
      else await vistaHoy();
    } catch (err) {
      console.error(err);
      mostrarSidebar(null);
      if (!catalogo) document.body.dataset.tema = "hoy";
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
