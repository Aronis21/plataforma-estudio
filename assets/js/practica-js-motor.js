/* NEXUS · Motor de la práctica de JavaScript.
 * Ejecuta el código en un Web Worker (hilo aparte) con tiempo límite, así un bucle
 * infinito no congela la página. Se usa para la consola libre y para comprobar ejercicios.
 *
 *   PracticaJSMotor.ejecutar(codigo)            → { logs, valor, error, ms }
 *   PracticaJSMotor.comprobar(codigo, ejercicio) → { logs, error, pruebas: [{ ok, entrada, esperado, obtenido, error }] }
 */
(function () {
  const LIMITE_MS = 3000;

  // Código que corre dentro del worker. Se escribe como función para que sea legible
  // y se convierte a texto al crear el worker.
  function dentroDelWorker() {
    const logs = [];
    const fmt = (v, prof = 0) => {
      if (typeof v === "string") return prof ? JSON.stringify(v) : v;
      if (v === undefined) return "undefined";
      if (typeof v === "function") return `[Function ${v.name || "anónima"}]`;
      if (typeof v === "bigint") return v + "n";
      if (v instanceof Error) return `${v.name}: ${v.message}`;
      if (v instanceof Date) return isNaN(v) ? "Invalid Date" : v.toISOString();
      if (v instanceof Map) return `Map(${v.size}) ${fmt([...v.entries()], 1)}`;
      if (v instanceof Set) return `Set(${v.size}) ${fmt([...v], 1)}`;
      if (typeof v === "number" && !isFinite(v)) return String(v);
      try {
        return JSON.stringify(v, (k, x) => (x === undefined ? "__undefined__" : typeof x === "function" ? `[Function ${x.name || "anónima"}]` : typeof x === "number" && !isFinite(x) ? String(x) : x)).replace(/"__undefined__"/g, "undefined");
      } catch (_) {
        return String(v);
      }
    };
    const anotar = (tipo) => (...a) => { if (logs.length < 500) logs.push({ tipo, texto: a.map((x) => fmt(x)).join(" ") }); };
    const consola = { log: anotar("log"), info: anotar("log"), debug: anotar("log"), warn: anotar("warn"), error: anotar("error"), table: anotar("log") };
    try { Object.defineProperty(self, "console", { value: consola, configurable: true, writable: true }); } catch (_) {
      try { self.console = consola; } catch (__) { /* sin consola propia */ }
    }

    // Igualdad profunda; en números con decimales tolera 0.0001
    function igual(a, b) {
      if (typeof a === "number" && typeof b === "number") {
        if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b);
        return Number.isInteger(a) && Number.isInteger(b) ? a === b : Math.abs(a - b) < 1e-4;
      }
      if (a === b) return true;
      if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => igual(x, b[i]));
      const ka = Object.keys(a), kb = Object.keys(b);
      return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && igual(a[k], b[k]));
    }
    const copia = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

    const especiales = {
      memorizar(fn) {
        let llamadasReales = 0;
        const m = fn((x) => { llamadasReales++; return x * x; });
        if (typeof m !== "function") throw new Error("memorizar(fn) debe devolver una función");
        const resultados = [m(2), m(2), m(3), m(2)];
        return { resultados, llamadasReales };
      },
      reintentar(fn) {
        let llamadas = 0;
        const resultado = fn(() => { llamadas++; if (llamadas < 3) throw new Error("falla " + llamadas); return "ok"; }, 5);
        let k = 0, errorFinal = null;
        try { fn(() => { k++; throw new Error("falla " + k); }, 2); } catch (e) { errorFinal = e && e.message; }
        return { resultado, llamadas, errorFinal };
      },
    };

    self.onmessage = (e) => {
      const { codigo, funcion, pruebas } = e.data;
      const t0 = Date.now();
      let valor, error = null, resultados = null;
      try {
        // eval indirecto: corre en el ámbito global del worker y devuelve el valor de la última expresión.
        // Para los ejercicios se añade al final el nombre de la función, así funciona con function, const o let.
        const extra = funcion ? `\n;(typeof ${funcion} === "function" ? ${funcion} : undefined)` : "";
        valor = (0, eval)(codigo + extra);
        if (funcion) {
          const fn = valor;
          valor = undefined;
          if (typeof fn !== "function") throw new Error(`No encontré la función ${funcion}. Revisa que el nombre esté bien escrito.`);
          resultados = pruebas.map((p) => {
            const entrada = p.especial ? `(prueba especial: ${p.especial})` : `${funcion}(${p.args.map((a) => fmt(a, 1)).join(", ")})${p.llamar ? `(${p.llamar.map((a) => fmt(a, 1)).join(", ")})` : ""}`;
            try {
              let obtenido;
              if (p.especial) obtenido = especiales[p.especial](fn);
              else {
                obtenido = fn(...copia(p.args));
                if (p.llamar) {
                  if (typeof obtenido !== "function") throw new Error("Se esperaba que devolviera una función");
                  obtenido = obtenido(...copia(p.llamar));
                }
              }
              return { ok: igual(obtenido, p.esperado), entrada, esperado: fmt(p.esperado, 1), obtenido: fmt(obtenido, 1) };
            } catch (err) {
              return { ok: false, entrada, esperado: fmt(p.esperado, 1), error: `${(err && err.name) || "Error"}: ${(err && err.message) || err}` };
            }
          });
        }
      } catch (err) {
        error = `${(err && err.name) || "Error"}: ${(err && err.message) || err}`;
      }
      self.postMessage({ logs, valor: valor === undefined ? undefined : fmt(valor, 1), hayValor: valor !== undefined, error, pruebas: resultados, ms: Date.now() - t0 });
    };
  }

  const fuente = `(${dentroDelWorker.toString()})();`;
  let url = null;

  function correr(mensaje) {
    return new Promise((resolver) => {
      if (!url) url = URL.createObjectURL(new Blob([fuente], { type: "text/javascript" }));
      let w;
      try {
        w = new Worker(url);
      } catch (err) {
        resolver({ logs: [], error: "Tu navegador no permitió ejecutar el código: " + err.message });
        return;
      }
      const t = setTimeout(() => {
        w.terminate();
        resolver({ logs: [], error: `Tu código tardó más de ${LIMITE_MS / 1000} segundos y se detuvo. ¿Hay un bucle que nunca termina?`, tiempoAgotado: true });
      }, LIMITE_MS);
      w.onmessage = (e) => { clearTimeout(t); w.terminate(); resolver(e.data); };
      w.onerror = (e) => { e.preventDefault(); clearTimeout(t); w.terminate(); resolver({ logs: [], error: e.message || "Error de sintaxis" }); };
      w.postMessage(mensaje);
    });
  }

  window.PracticaJSMotor = {
    LIMITE_MS,
    ejecutar: (codigo) => correr({ codigo }),
    comprobar: (codigo, ej) => correr({ codigo, funcion: ej.funcion, pruebas: ej.pruebas }),
    _dentroDelWorker: dentroDelWorker,
  };
})();
