/* NEXUS · Motor de los ejercicios de DOM (pestaña JavaScript de Práctica).
 * Cada ejercicio trae una mini página (ej.dom.html). Tu código corre dentro de un iframe
 * aislado (sandbox, sin acceso a la página de NEXUS), y las pruebas hacen clics, escriben
 * en campos y revisan cómo quedó la página.
 *
 *   PracticaDOM.vista(iframe, codigo, ej)  → carga la mini página con tu código para usarla a mano
 *   PracticaDOM.comprobar(codigo, ej)      → { logs, error, pruebas: [{ ok, entrada, esperado, obtenido, error }] }
 *
 * Formato de una prueba:
 *   { descripcion, acciones: [{ tipo: "click", sel, veces } | { tipo: "escribir", sel, valor } | { tipo: "enviar", sel }],
 *     esperar: { sel, texto } | { sel, cuenta } | { sel, clase, tiene } | { sel, valor } }
 */
(function () {
  const LIMITE_MS = 3000;

  // Protección contra bucles infinitos: añade __g() al inicio de cada bucle con llaves.
  // Si un mismo tramo de ejecución pasa de un millón de vueltas, se detiene con un error.
  function protegerBucles(codigo) {
    let out = "", i = 0;
    const n = codigo.length;
    const saltarTexto = (q) => {
      let j = i + 1;
      while (j < n && codigo[j] !== q) { if (codigo[j] === "\\") j++; j++; }
      return j + 1;
    };
    while (i < n) {
      const c = codigo[i];
      if (c === "/" && codigo[i + 1] === "/") { const f = codigo.indexOf("\n", i); const j = f === -1 ? n : f; out += codigo.slice(i, j); i = j; continue; }
      if (c === "/" && codigo[i + 1] === "*") { const f = codigo.indexOf("*/", i + 2); const j = f === -1 ? n : f + 2; out += codigo.slice(i, j); i = j; continue; }
      if (c === '"' || c === "'" || c === "`") { const j = saltarTexto(c); out += codigo.slice(i, j); i = j; continue; }
      const m = /^(for|while|do)\b/.exec(codigo.slice(i, i + 6));
      if (m && !/[\w$.]/.test(codigo[i - 1] || "")) {
        let j = i + m[1].length;
        if (m[1] !== "do") {
          while (j < n && /\s/.test(codigo[j])) j++;
          if (codigo[j] === "(") {
            let prof = 0;
            for (; j < n; j++) {
              if (codigo[j] === "(") prof++;
              else if (codigo[j] === ")") { prof--; if (!prof) { j++; break; } }
            }
          }
        }
        let k = j;
        while (k < n && /\s/.test(codigo[k])) k++;
        if (codigo[k] === "{") { out += codigo.slice(i, k + 1) + "__g();"; i = k + 1; continue; }
        out += codigo.slice(i, j); i = j; continue;
      }
      out += c; i++;
    }
    return out;
  }

  // Código que corre dentro del iframe, antes del código del estudiante
  function arnes() {
    const ficha = document.currentScript.dataset.ficha;
    const enviar = (m) => parent.postMessage(Object.assign({ ficha }, m), "*");
    const fmt = (v) => {
      if (typeof v === "string") return v;
      if (v instanceof Element) return `<${v.tagName.toLowerCase()}${v.id ? "#" + v.id : ""}${v.className ? "." + String(v.className).trim().replace(/\s+/g, ".") : ""}>`;
      try { return JSON.stringify(v); } catch (_) { return String(v); }
    };
    const logs = [];
    const anotar = (tipo) => (...a) => { const l = { tipo, texto: a.map(fmt).join(" ") }; if (logs.length < 200) logs.push(l); enviar({ tipo: "log", log: l }); };
    window.console = { log: anotar("log"), info: anotar("log"), warn: anotar("warn"), error: anotar("error"), debug: anotar("log"), table: anotar("log") };
    let vueltas = 0, pendiente = false;
    window.__g = () => {
      if (++vueltas > 1e6) throw new Error("Tu código dio más de un millón de vueltas en un bucle. ¿Hay un bucle que nunca termina?");
      if (!pendiente) { pendiente = true; setTimeout(() => { vueltas = 0; pendiente = false; }, 0); }
    };
    window.__errores = [];
    window.addEventListener("error", (e) => {
      const msg = `${(e.error && e.error.name) || "Error"}: ${(e.error && e.error.message) || e.message}`;
      window.__errores.push(msg);
      enviar({ tipo: "error", error: msg });
    });
    window.__logs = logs;
    window.__enviar = enviar;
  }

  // Ejecuta una prueba dentro del iframe (se inyecta como texto)
  function correrPrueba(p) {
    const q = (s) => document.querySelector(s);
    const res = { ok: false, entrada: p.descripcion };
    try {
      for (const a of p.acciones || []) {
        const el = q(a.sel);
        if (!el) throw new Error(`No encontré el elemento ${a.sel} en la página.`);
        if (a.tipo === "click") for (let k = 0; k < (a.veces || 1); k++) el.click();
        else if (a.tipo === "escribir") {
          el.value = a.valor;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (a.tipo === "enviar") {
          const ev = new Event("submit", { bubbles: true, cancelable: true });
          el.dispatchEvent(ev);
          if (!ev.defaultPrevented) throw new Error("El formulario se habría enviado y recargado la página: llama a event.preventDefault() en el evento submit.");
        }
      }
      if (window.__errores.length) throw new Error(window.__errores[0]);
      const e = p.esperar;
      let obtenido, esperado;
      if ("cuenta" in e) { obtenido = document.querySelectorAll(e.sel).length; esperado = e.cuenta; }
      else {
        const el = q(e.sel);
        if (!el) throw new Error(`No existe ningún elemento ${e.sel}.`);
        if ("texto" in e) { obtenido = el.textContent.replace(/\s+/g, " ").trim(); esperado = e.texto; }
        else if ("clase" in e) { obtenido = el.classList.contains(e.clase); esperado = e.tiene !== false; }
        else if ("valor" in e) { obtenido = el.value; esperado = e.valor; }
      }
      res.ok = obtenido === esperado;
      res.esperado = JSON.stringify(esperado);
      res.obtenido = JSON.stringify(obtenido);
    } catch (err) {
      res.esperado = JSON.stringify(Object.values(p.esperar).slice(-1)[0]);
      res.error = (err && err.message) || String(err);
    }
    return res;
  }

  const CSS_BASE = "body{font:15px/1.5 system-ui,sans-serif;margin:12px;color:#1d1f24}button{font:inherit;padding:.3rem .8rem;margin:.2rem;cursor:pointer}input{font:inherit;padding:.3rem}.oculto{display:none}.error{border:2px solid #c2410c}.importante{font-weight:700;color:#8a5a0b}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.2rem .5rem}";
  const sinCierre = (s) => String(s).replace(/<\/script/gi, "<\\/script");

  function documento(codigo, ej, ficha, prueba) {
    const d = ej.dom;
    return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS_BASE}${d.css || ""}</style></head><body>${d.html}
<script data-ficha="${ficha}">(${arnes.toString()})();<\/script>
${d.datos ? `<script>${sinCierre(d.datos)}<\/script>` : ""}
<script>${sinCierre(protegerBucles(codigo))}\n<\/script>
${prueba ? `<script>setTimeout(function(){var r=(${correrPrueba.toString()})(${sinCierre(JSON.stringify(prueba))});__enviar({tipo:"fin",prueba:r,logs:__logs});},0);<\/script>` : ""}
</body></html>`;
  }

  let contador = 0;
  function cargar(iframe, html) {
    iframe.setAttribute("sandbox", "allow-scripts allow-forms");
    iframe.srcdoc = html;
  }

  function vista(iframe, codigo, ej, alLog) {
    const ficha = "v" + (++contador);
    if (iframe._oyente) window.removeEventListener("message", iframe._oyente);
    iframe._oyente = (e) => {
      if (!e.data || e.data.ficha !== ficha) return;
      if (alLog && e.data.tipo === "log") alLog(e.data.log);
      if (alLog && e.data.tipo === "error") alLog({ tipo: "error", texto: e.data.error });
    };
    window.addEventListener("message", iframe._oyente);
    cargar(iframe, documento(codigo, ej, ficha, null));
  }

  function unaPrueba(codigo, ej, prueba) {
    return new Promise((resolver) => {
      const ficha = "p" + (++contador);
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:absolute;width:400px;height:300px;left:-9999px;top:0;border:0";
      iframe.setAttribute("aria-hidden", "true");
      iframe.tabIndex = -1;
      let terminado = false;
      const fin = (r) => {
        if (terminado) return;
        terminado = true;
        clearTimeout(t);
        window.removeEventListener("message", oyente);
        iframe.remove();
        resolver(r);
      };
      const oyente = (e) => {
        if (!e.data || e.data.ficha !== ficha || e.data.tipo !== "fin") return;
        fin({ prueba: e.data.prueba, logs: e.data.logs || [] });
      };
      const t = setTimeout(() => fin({ prueba: { ok: false, entrada: prueba.descripcion, error: `La página no respondió en ${LIMITE_MS / 1000} segundos (¿se recargó el formulario o hay un bucle infinito?).` }, logs: [] }), LIMITE_MS);
      window.addEventListener("message", oyente);
      document.body.appendChild(iframe);
      cargar(iframe, documento(codigo, ej, ficha, prueba));
    });
  }

  async function comprobar(codigo, ej) {
    const pruebas = [];
    let logs = [];
    for (const p of ej.pruebas) {
      const r = await unaPrueba(codigo, ej, p);
      pruebas.push(r.prueba);
      if (!logs.length) logs = r.logs;
    }
    return { logs, pruebas };
  }

  window.PracticaDOM = { vista, comprobar, protegerBucles, LIMITE_MS };
})();
