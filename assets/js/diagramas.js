/* ==========================================================================
   NEXUS · Diagramas dentro de las lecciones
   Una sección de teoría puede llevar "diagram": { "type": "..." }.
   Diagramas.html(spec)  -> HTML del diagrama (o "" si el tipo no existe)
   Diagramas.activar(el) -> conecta los botones de los diagramas interactivos
   ========================================================================== */
(function () {
  "use strict";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------------------------------------------------------------------------
  // 1. JOINs con diagrama de Venn
  // ---------------------------------------------------------------------------
  const CLIENTES = [
    { cliente_id: 1, nombre: "Ana" },
    { cliente_id: 2, nombre: "Beto" },
    { cliente_id: 3, nombre: "Carla" },
  ];
  const PEDIDOS = [
    { pedido_id: 101, cliente_id: 1, monto: 250 },
    { pedido_id: 102, cliente_id: 1, monto: 90 },
    { pedido_id: 103, cliente_id: 3, monto: 400 },
    { pedido_id: 104, cliente_id: 7, monto: 120 },
  ];

  const SEL = "SELECT c.nombre, p.pedido_id, p.monto\nFROM clientes AS c\n";
  const JOINS = [
    {
      id: "inner", nombre: "INNER JOIN", zonas: ["i"],
      sql: SEL + "INNER JOIN pedidos AS p\n  ON p.cliente_id = c.cliente_id;",
      texto: "Solo las filas que coinciden en las dos tablas. Beto (sin pedidos) y el pedido 104 (cliente inexistente) desaparecen.",
    },
    {
      id: "left", nombre: "LEFT JOIN", zonas: ["l", "i"],
      sql: SEL + "LEFT JOIN pedidos AS p\n  ON p.cliente_id = c.cliente_id;",
      texto: "Todos los clientes, tengan o no pedidos. Donde no hay pedido, las columnas de la derecha salen en NULL.",
    },
    {
      id: "right", nombre: "RIGHT JOIN", zonas: ["i", "r"],
      sql: SEL + "RIGHT JOIN pedidos AS p\n  ON p.cliente_id = c.cliente_id;",
      texto: "Todos los pedidos, tengan o no cliente válido. En la práctica casi siempre se escribe como LEFT JOIN cambiando el orden de las tablas.",
    },
    {
      id: "full", nombre: "FULL OUTER JOIN", zonas: ["l", "i", "r"],
      sql: SEL + "FULL OUTER JOIN pedidos AS p\n  ON p.cliente_id = c.cliente_id;",
      texto: "Todo de ambos lados: lo que coincide se une y lo que no, aparece con NULL del otro lado. Ideal para reconciliar dos fuentes.",
    },
    {
      id: "left-anti", nombre: "LEFT anti-join", zonas: ["l"],
      sql: SEL + "LEFT JOIN pedidos AS p\n  ON p.cliente_id = c.cliente_id\nWHERE p.pedido_id IS NULL;\n-- o mejor: WHERE NOT EXISTS (...)",
      texto: "Clientes que NO tienen ningún pedido. Responde preguntas como «¿quién no compró?».",
    },
    {
      id: "right-anti", nombre: "RIGHT anti-join", zonas: ["r"],
      sql: SEL + "RIGHT JOIN pedidos AS p\n  ON p.cliente_id = c.cliente_id\nWHERE c.cliente_id IS NULL;",
      texto: "Pedidos huérfanos: apuntan a un cliente que no existe. Es una prueba clásica de calidad de datos.",
    },
    {
      id: "full-anti", nombre: "FULL sin coincidencias", zonas: ["l", "r"],
      sql: SEL + "FULL OUTER JOIN pedidos AS p\n  ON p.cliente_id = c.cliente_id\nWHERE c.cliente_id IS NULL\n   OR p.pedido_id IS NULL;",
      texto: "Solo lo que no cuadra en ninguno de los dos lados. Sirve para listar diferencias entre dos sistemas.",
    },
    {
      id: "cross", nombre: "CROSS JOIN", zonas: [],
      sql: "SELECT c.nombre, p.pedido_id, p.monto\nFROM clientes AS c\nCROSS JOIN pedidos AS p;",
      texto: "No usa condición: combina cada cliente con cada pedido (3 × 4 = 12 filas). Un diagrama de Venn no puede representarlo; se usa para generar combinaciones, como calendario × sucursal.",
    },
  ];

  function filasJoin(id) {
    const out = [];
    const fila = (c, p) => ({ nombre: c ? c.nombre : null, pedido_id: p ? p.pedido_id : null, monto: p ? p.monto : null });
    if (id === "cross") {
      for (const c of CLIENTES) for (const p of PEDIDOS) out.push(fila(c, p));
      return out;
    }
    const izq = id === "inner" || id === "left" || id === "full" || id === "left-anti" || id === "full-anti";
    const der = id === "right" || id === "full" || id === "right-anti" || id === "full-anti";
    const coincide = id === "inner" || id === "left" || id === "right" || id === "full";
    if (coincide || izq) {
      for (const c of CLIENTES) {
        const ps = PEDIDOS.filter((p) => p.cliente_id === c.cliente_id);
        if (ps.length) { if (coincide) ps.forEach((p) => out.push(fila(c, p))); }
        else if (izq && id !== "inner") out.push(fila(c, null));
      }
    }
    if (der) {
      for (const p of PEDIDOS) {
        if (!CLIENTES.some((c) => c.cliente_id === p.cliente_id)) out.push(fila(null, p));
      }
    }
    return out;
  }

  let uid = 0;
  function svgVenn(zonas, n) {
    const on = (z) => zonas.includes(z);
    // Círculos: clientes (A) a la izquierda y pedidos (B) a la derecha
    const ax = 115, bx = 195, cy = 110, r = 70;
    const A = `<circle cx="${ax}" cy="${cy}" r="${r}"/>`, B = `<circle cx="${bx}" cy="${cy}" r="${r}"/>`;
    return `<svg class="venn" viewBox="0 0 310 190" role="img" aria-label="Diagrama de Venn: clientes a la izquierda, pedidos a la derecha">
      <defs>
        <clipPath id="vA${n}">${A}</clipPath>
        <mask id="vNoB${n}"><rect width="310" height="190" fill="#fff"/><circle cx="${bx}" cy="${cy}" r="${r}" fill="#000"/></mask>
        <mask id="vNoA${n}"><rect width="310" height="190" fill="#fff"/><circle cx="${ax}" cy="${cy}" r="${r}" fill="#000"/></mask>
      </defs>
      <g class="venn-zona ${on("l") ? "on" : ""}" mask="url(#vNoB${n})">${A}</g>
      <g class="venn-zona ${on("r") ? "on" : ""}" mask="url(#vNoA${n})">${B}</g>
      <g class="venn-zona ${on("i") ? "on" : ""}" clip-path="url(#vA${n})">${B}</g>
      <g class="venn-borde">${A}${B}</g>
      <text x="${ax - 35}" y="${cy - 2}" class="venn-etq" text-anchor="middle">solo</text>
      <text x="${ax - 35}" y="${cy + 12}" class="venn-etq" text-anchor="middle">clientes</text>
      <text x="${(ax + bx) / 2}" y="${cy + 4}" class="venn-etq" text-anchor="middle">ambas</text>
      <text x="${bx + 35}" y="${cy - 2}" class="venn-etq" text-anchor="middle">solo</text>
      <text x="${bx + 35}" y="${cy + 12}" class="venn-etq" text-anchor="middle">pedidos</text>
      <text x="${ax - 40}" y="22" class="venn-tit" text-anchor="middle">clientes (c)</text>
      <text x="${bx + 40}" y="22" class="venn-tit" text-anchor="middle">pedidos (p)</text>
    </svg>`;
  }

  const celda = (v) => (v === null ? '<td class="nulo">NULL</td>' : `<td>${esc(v)}</td>`);
  function tablaHTML(cols, filas, marcar) {
    return `<table class="dg-tabla"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${filas.map((f) => `<tr${marcar && marcar(f) ? ' class="marca"' : ""}>${cols.map((c) => celda(f[c])).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function panelJoin(j, n) {
    const filas = filasJoin(j.id);
    const ana = filas.filter((f) => f.nombre === "Ana").length;
    return `${j.zonas.length ? svgVenn(j.zonas, n) : `<div class="venn-cross" role="img" aria-label="CROSS JOIN: cada cliente con cada pedido">${CLIENTES.map((c) => `<div class="fila-cross"><span>${esc(c.nombre)}</span>${PEDIDOS.map((p) => `<span class="pc">${p.pedido_id}</span>`).join("")}</div>`).join("")}</div>`}
      <div class="dg-explica">
        <p><strong>${esc(j.nombre)}.</strong> ${esc(j.texto)}</p>
        <pre class="dg-sql"><code>${esc(j.sql)}</code></pre>
        <p class="dg-cuenta">Resultado: <strong>${filas.length} fila${filas.length === 1 ? "" : "s"}</strong>${ana > 1 ? ` · Ana aparece ${ana} veces (una por pedido)` : ""}</p>
        ${tablaHTML(["nombre", "pedido_id", "monto"], filas, (f) => f.nombre === "Ana" && ana > 1)}
      </div>`;
  }

  function htmlVennJoins() {
    const n = ++uid;
    const j0 = JOINS[0];
    return `<figure class="diagrama dg-joins" data-diagrama="venn-joins" data-n="${n}">
      <div class="dg-fuentes">
        <div><div class="dg-cap">clientes</div>${tablaHTML(["cliente_id", "nombre"], CLIENTES)}</div>
        <div><div class="dg-cap">pedidos</div>${tablaHTML(["pedido_id", "cliente_id", "monto"], PEDIDOS)}</div>
      </div>
      <div class="dg-botones" role="group" aria-label="Elige el tipo de JOIN">
        ${JOINS.map((j) => `<button type="button" class="dg-btn" data-join="${j.id}" aria-pressed="${j === j0}">${esc(j.nombre)}</button>`).join("")}
      </div>
      <div class="dg-panel" aria-live="polite">${panelJoin(j0, n)}</div>
      <figcaption>Elige un JOIN: la zona sombreada es lo que devuelve. Las filas resaltadas muestran que el diagrama no avisa cuando una fila se repite.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // 2. Regresión lineal con residuos (estático)
  // ---------------------------------------------------------------------------
  const REG = [[1, 5.6], [2, 3.9], [3, 8.4], [4, 7.0], [5, 11.2], [6, 9.0], [7, 13.9], [8, 11.6], [9, 16.8], [10, 15.1]];

  function ajusteLineal(pts) {
    const n = pts.length;
    const mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    let sxy = 0, sxx = 0;
    for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
    const b1 = sxy / sxx, b0 = my - b1 * mx;
    let sae = 0, sse = 0, sst = 0;
    for (const [x, y] of pts) { const e = y - (b0 + b1 * x); sae += Math.abs(e); sse += e * e; sst += (y - my) ** 2; }
    return { b0, b1, mae: sae / n, rmse: Math.sqrt(sse / n), r2: 1 - sse / sst };
  }

  function htmlRegresion() {
    const a = ajusteLineal(REG);
    const W = 360, H = 220, m = 34;
    const X = (x) => m + (x / 11) * (W - m - 10), Y = (y) => H - m - (y / 18) * (H - m - 10);
    const f = (x) => a.b0 + a.b1 * x;
    const res = REG.map(([x, y]) => `<line class="residuo" x1="${X(x)}" y1="${Y(y)}" x2="${X(x)}" y2="${Y(f(x))}"/>`).join("");
    const pts = REG.map(([x, y]) => `<circle class="punto" cx="${X(x)}" cy="${Y(y)}" r="4"/>`).join("");
    const r = (v, d = 2) => v.toFixed(d);
    return `<figure class="diagrama" data-diagrama="regresion">
      <svg class="dg-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagrama de dispersión con la recta de regresión y los residuos de cada punto">
        <line class="eje" x1="${m}" y1="${H - m}" x2="${W - 8}" y2="${H - m}"/>
        <line class="eje" x1="${m}" y1="8" x2="${m}" y2="${H - m}"/>
        ${res}
        <line class="recta" x1="${X(0.5)}" y1="${Y(f(0.5))}" x2="${X(10.5)}" y2="${Y(f(10.5))}"/>
        ${pts}
        <text x="${W / 2}" y="${H - 8}" text-anchor="middle">gasto en anuncios (miles)</text>
        <text x="12" y="${H / 2}" text-anchor="middle" transform="rotate(-90 12 ${H / 2})">ventas (miles)</text>
        <text x="${X(0.6)}" y="${Y(17)}" class="t-in">ŷ = ${r(a.b0)} + ${r(a.b1)}·x</text>
      </svg>
      <div class="dg-metricas">
        <span><strong>Pendiente</strong> ${r(a.b1)}: cada mil extra en anuncios se asocia con ${r(a.b1)} mil más en ventas.</span>
        <span><strong>MAE</strong> ${r(a.mae)}</span><span><strong>RMSE</strong> ${r(a.rmse)}</span><span><strong>R²</strong> ${r(a.r2, 3)}</span>
      </div>
      <figcaption>La recta roja es la predicción; cada línea punteada es un residuo (real − predicho). MAE promedia sus tamaños, RMSE castiga más los grandes y R² dice qué parte de la variación explica la recta.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // 3. Matriz de confusión con umbral ajustable (interactivo)
  // ---------------------------------------------------------------------------
  // Probabilidad de baja (churn) que da el modelo y si el cliente realmente se fue (1) o no (0)
  const CLIENTES_CHURN = [
    [0.95, 1], [0.91, 1], [0.86, 0], [0.82, 1], [0.77, 1], [0.71, 0], [0.66, 1], [0.62, 0], [0.57, 0], [0.53, 1],
    [0.48, 0], [0.44, 1], [0.39, 0], [0.34, 0], [0.29, 0], [0.25, 1], [0.2, 0], [0.15, 0], [0.11, 0], [0.06, 0],
  ];

  function panelConfusion(u) {
    let vp = 0, fp = 0, fn = 0, vn = 0;
    for (const [p, y] of CLIENTES_CHURN) {
      const pred = p >= u ? 1 : 0;
      if (pred && y) vp++; else if (pred && !y) fp++; else if (!pred && y) fn++; else vn++;
    }
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
    const W = 360, H = 64, m = 12;
    const X = (p) => m + (1 - p) * (W - 2 * m);
    const puntos = CLIENTES_CHURN.map(([p, y]) => `<circle cx="${X(p)}" cy="${y ? 22 : 44}" r="6" class="${y ? "real-si" : "real-no"}"/>`).join("");
    return `<svg class="dg-svg dg-tira" viewBox="0 0 ${W} ${H}" role="img" aria-label="Clientes ordenados por probabilidad; arriba los que se fueron, abajo los que se quedaron">
        <rect x="${m}" y="6" width="${X(u) - m}" height="54" class="zona-alerta"/>
        <line x1="${X(u)}" y1="2" x2="${X(u)}" y2="${H - 2}" class="umbral"/>
        ${puntos}
      </svg>
      <div class="dg-matriz-fila">
        <table class="dg-tabla dg-matriz" aria-label="Matriz de confusión">
          <thead><tr><th></th><th>predice: se va</th><th>predice: se queda</th></tr></thead>
          <tbody>
            <tr><th>real: se fue</th><td class="bien">VP ${vp}</td><td class="mal">FN ${fn}</td></tr>
            <tr><th>real: se quedó</th><td class="mal">FP ${fp}</td><td class="bien">VN ${vn}</td></tr>
          </tbody>
        </table>
        <div class="dg-metricas col">
          <span><strong>Precision</strong> ${pct(vp, vp + fp)} <small>de los avisados, cuántos se iban de verdad</small></span>
          <span><strong>Recall</strong> ${pct(vp, vp + fn)} <small>de los que se iban, cuántos detectamos</small></span>
          <span><strong>Accuracy</strong> ${pct(vp + vn, CLIENTES_CHURN.length)} <small>aciertos totales</small></span>
        </div>
      </div>`;
  }

  function htmlConfusion() {
    return `<figure class="diagrama" data-diagrama="matriz-confusion">
      <label class="dg-umbral">Umbral de decisión: <strong data-valor>0.50</strong>
        <input type="range" min="0.05" max="0.95" step="0.05" value="0.5" aria-label="Umbral de decisión">
      </label>
      <div class="dg-panel-c" aria-live="polite">${panelConfusion(0.5)}</div>
      <figcaption>20 clientes ordenados por la probabilidad de baja que da el modelo (izquierda = más riesgo). Arriba, en color, los que realmente se fueron. Todo lo que queda dentro de la zona sombreada recibe la alerta. Baja el umbral: sube el recall y cae la precision.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // 4. División de datos y validación cruzada (estático)
  // ---------------------------------------------------------------------------
  function htmlValidacion() {
    const W = 360, fila = 26, x0 = 70, ancho = 270;
    let h = "";
    // Fila 0: separación inicial
    h += `<text x="0" y="18">datos</text>
      <rect x="${x0}" y="4" width="${ancho * 0.8}" height="20" class="b-train"/><text x="${x0 + ancho * 0.4}" y="18" text-anchor="middle" class="t-in">entrenamiento (80%)</text>
      <rect x="${x0 + ancho * 0.8}" y="4" width="${ancho * 0.2}" height="20" class="b-test"/><text x="${x0 + ancho * 0.9}" y="18" text-anchor="middle" class="t-in">test</text>`;
    for (let k = 0; k < 5; k++) {
      const y = 44 + k * fila;
      h += `<text x="0" y="${y + 14}">pliegue ${k + 1}</text>`;
      for (let j = 0; j < 5; j++) {
        h += `<rect x="${x0 + (j * ancho * 0.8) / 5}" y="${y}" width="${(ancho * 0.8) / 5 - 2}" height="20" class="${j === k ? "b-val" : "b-train"}"/>`;
      }
    }
    const H = 44 + 5 * fila + 6;
    return `<figure class="diagrama" data-diagrama="validacion-cruzada">
      <svg class="dg-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Separación en entrenamiento y test, y validación cruzada de 5 pliegues sobre el entrenamiento">${h}</svg>
      <div class="dg-leyenda"><span><i class="b-train"></i>entrena</span><span><i class="b-val"></i>valida</span><span><i class="b-test"></i>test: se usa una sola vez, al final</span></div>
      <figcaption>Primero apartas el test y no lo tocas. Con el resto haces validación cruzada: 5 rondas, cada vez validando en un bloque distinto. El promedio de las 5 notas es tu estimación honesta para elegir modelo.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // Registro
  // ---------------------------------------------------------------------------
  const TIPOS = {
    "venn-joins": htmlVennJoins,
    regresion: htmlRegresion,
    "matriz-confusion": htmlConfusion,
    "validacion-cruzada": htmlValidacion,
  };

  function html(spec) {
    const f = spec && TIPOS[spec.type];
    return f ? f(spec) : "";
  }

  function activar(raiz) {
    (raiz || document).querySelectorAll('[data-diagrama="venn-joins"]').forEach((fig) => {
      if (fig.dataset.listo) return;
      fig.dataset.listo = "1";
      const n = fig.dataset.n;
      fig.addEventListener("click", (e) => {
        const b = e.target.closest("[data-join]");
        if (!b) return;
        const j = JOINS.find((x) => x.id === b.dataset.join);
        fig.querySelectorAll("[data-join]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        fig.querySelector(".dg-panel").innerHTML = panelJoin(j, n);
      });
    });
    (raiz || document).querySelectorAll('[data-diagrama="matriz-confusion"]').forEach((fig) => {
      if (fig.dataset.listo) return;
      fig.dataset.listo = "1";
      const inp = fig.querySelector("input[type=range]");
      inp.addEventListener("input", () => {
        const u = Number(inp.value);
        fig.querySelector("[data-valor]").textContent = u.toFixed(2);
        fig.querySelector(".dg-panel-c").innerHTML = panelConfusion(u);
      });
    });
  }

  window.Diagramas = { html, activar, svgVenn, JOINS, filasJoin, ajusteLineal, REG, CLIENTES_CHURN };
})();
