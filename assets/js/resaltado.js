/* NEXUS · Resaltado de texto en las lecciones.
 * Al seleccionar texto en una sección aparece una barra con acciones:
 *   Resaltar · Explícamelo · Con mis datos · Crear ejercicio · Hacer tarjeta
 * Los resaltados se guardan en el cuaderno (Cuaderno.agregarResaltado) y se vuelven
 * a pintar cada vez que abres la página. Toca un resaltado para quitarlo.
 */
(function () {
  const C = window.Cuaderno;
  const Tutor = window.Tutor;
  let barra = null;
  let contexto = null; // { app, curso, cap, repintar, aviso }
  let seleccion = null; // { texto, seccionId }

  function crearBarra() {
    barra = document.createElement("div");
    barra.className = "barra-acciones";
    barra.setAttribute("role", "toolbar");
    barra.setAttribute("aria-label", "Acciones sobre el texto seleccionado");
    barra.hidden = true;
    barra.innerHTML = `
      <button type="button" data-r="resaltar">Resaltar</button>
      <button type="button" data-r="explicar">Explícamelo</button>
      <button type="button" data-r="datos">Con mis datos</button>
      <button type="button" data-r="ejercicio">Crear ejercicio</button>
      <button type="button" data-r="tarjeta">Hacer tarjeta</button>`;
    // Evita que el clic en la barra borre la selección antes de leerla
    barra.addEventListener("mousedown", (e) => e.preventDefault());
    barra.addEventListener("click", (e) => {
      const b = e.target.closest("[data-r]");
      if (b && seleccion) accion(b.dataset.r, seleccion);
    });
    document.body.appendChild(barra);
  }

  function ocultar() {
    if (barra) barra.hidden = true;
    seleccion = null;
  }

  function seccionDe(nodo) {
    const el = nodo && (nodo.nodeType === 1 ? nodo : nodo.parentElement);
    return el && el.closest(".seccion[data-seccion]");
  }

  function alCambiarSeleccion() {
    if (!contexto || !document.body.contains(contexto.app)) return ocultar();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return ocultar();
    const rango = sel.getRangeAt(0);
    const sec = seccionDe(rango.commonAncestorContainer);
    const texto = sel.toString().replace(/\s+/g, " ").trim();
    if (!sec || !contexto.app.contains(sec) || texto.length < 3) return ocultar();
    seleccion = { texto: texto.slice(0, 400), seccionId: sec.dataset.seccion };
    const r = rango.getBoundingClientRect();
    barra.hidden = false;
    const ancho = barra.offsetWidth;
    const izq = Math.min(Math.max(8, r.left + window.scrollX + r.width / 2 - ancho / 2), window.scrollX + document.documentElement.clientWidth - ancho - 8);
    barra.style.left = izq + "px";
    barra.style.top = Math.max(window.scrollY + 70, r.top + window.scrollY - barra.offsetHeight - 10) + "px";
  }

  function decirTutor(texto) {
    const p = document.getElementById("tutorTexto");
    if (p) {
      p.textContent = texto;
      p.closest(".tutor-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      contexto.aviso(texto);
    }
  }

  async function accion(tipo, sel) {
    const { curso, cap, repintar, aviso } = contexto;
    const seccion = (cap.theorySections || []).find((s) => s.id === sel.seccionId);
    window.getSelection().removeAllRanges();
    ocultar();
    if (tipo === "resaltar") {
      C.agregarResaltado({ curso: curso.id, cap: cap.id, seccion: sel.seccionId, texto: sel.texto });
      C.registrarActividad();
      aviso("Resaltado guardado en tu cuaderno");
      repintar();
    } else if (tipo === "explicar") {
      decirTutor((await Tutor.explicar({ curso, cap, seccion, texto: sel.texto })).texto);
    } else if (tipo === "datos") {
      decirTutor((await Tutor.conMisDatos({ curso, cap, texto: sel.texto })).texto);
    } else if (tipo === "ejercicio") {
      decirTutor((await Tutor.crearEjercicio({ curso, cap, texto: sel.texto })).texto);
    } else if (tipo === "tarjeta") {
      dialogoTarjeta(sel, seccion);
    }
  }

  function dialogoTarjeta(sel, seccion) {
    const { curso, cap, repintar, aviso } = contexto;
    const d = document.createElement("dialog");
    d.className = "dialogo";
    d.innerHTML = `<form method="dialog">
      <div class="h-mano">nueva tarjeta de repaso</div>
      <label for="tjFrente">Frente (la pregunta o el concepto)</label>
      <textarea id="tjFrente" required></textarea>
      <label for="tjReverso">Reverso (la respuesta, con tus palabras)</label>
      <textarea id="tjReverso"></textarea>
      <div class="row" style="margin-top:1rem;justify-content:flex-end">
        <button class="btn ghost" value="cancelar" type="submit">Cancelar</button>
        <button class="btn cta" value="guardar" type="submit">Guardar tarjeta</button>
      </div></form>`;
    document.body.appendChild(d);
    d.querySelector("#tjFrente").value = sel.texto;
    d.querySelector("#tjReverso").value = seccion && seccion.keyTakeaway ? seccion.keyTakeaway : "";
    d.addEventListener("close", () => {
      if (d.returnValue === "guardar") {
        const t = C.agregarTarjeta({ curso: curso.id, cap: cap.id, frente: d.querySelector("#tjFrente").value, reverso: d.querySelector("#tjReverso").value, origen: "resaltado" });
        if (t) { C.registrarActividad(); aviso("Tarjeta agregada a tu mazo"); repintar(); }
      }
      d.remove();
    });
    d.showModal();
  }

  // Vuelve a pintar los resaltados guardados: busca el texto en los nodos de la sección
  function pintarResaltados() {
    const { app, curso, cap } = contexto;
    for (const r of C.resaltados({ curso: curso.id, cap: cap.id })) {
      const sec = app.querySelector(`.seccion[data-seccion="${CSS.escape(r.seccion || "")}"]`);
      if (sec) envolver(sec, r);
    }
  }

  function envolver(raiz, r) {
    const nodos = [];
    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest("mark, button, textarea, .code-head") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let total = "";
    while (walker.nextNode()) {
      nodos.push({ nodo: walker.currentNode, inicio: total.length });
      total += walker.currentNode.nodeValue;
    }
    // Comparación sin importar espacios repetidos
    const normal = total.replace(/\s/g, " ");
    const buscado = r.texto.replace(/\s+/g, " ");
    const desde = normal.indexOf(buscado);
    if (desde < 0) return; // el texto de la lección cambió: el resaltado se conserva en tu lista, pero no se pinta
    const hasta = desde + buscado.length;
    for (const { nodo, inicio } of nodos) {
      const fin = inicio + nodo.nodeValue.length;
      if (fin <= desde || inicio >= hasta) continue;
      const a = Math.max(0, desde - inicio);
      const b = Math.min(nodo.nodeValue.length, hasta - inicio);
      const rango = document.createRange();
      rango.setStart(nodo, a);
      rango.setEnd(nodo, b);
      const mark = document.createElement("mark");
      mark.className = "resaltado";
      mark.dataset.id = r.id;
      mark.title = "Toca para quitar el resaltado";
      rango.surroundContents(mark);
    }
  }

  function alTocarResaltado(e) {
    const m = e.target.closest("mark.resaltado");
    if (!m || !contexto || !contexto.app.contains(m)) return;
    if (window.getSelection().toString()) return;
    if (confirm("¿Quitar este resaltado de tu cuaderno?")) {
      C.borrarResaltado(m.dataset.id);
      contexto.repintar();
    }
  }

  let escuchando = false;
  function activar(ctx) {
    contexto = ctx;
    if (!barra) crearBarra();
    ocultar();
    if (!escuchando) {
      let espera = null;
      document.addEventListener("selectionchange", () => { clearTimeout(espera); espera = setTimeout(alCambiarSeleccion, 180); });
      document.addEventListener("click", alTocarResaltado);
      window.addEventListener("hashchange", ocultar);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") ocultar(); });
      escuchando = true;
    }
    try { pintarResaltados(); } catch (err) { console.warn("No se pudieron pintar los resaltados", err); }
  }

  window.Resaltado = { activar };
})();
