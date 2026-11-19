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
  function svgVenn(zonas, n, nombres = ["clientes (c)", "pedidos (p)"]) {
    const on = (z) => zonas.includes(z);
    // Círculos: clientes (A) a la izquierda y pedidos (B) a la derecha
    const ax = 115, bx = 195, cy = 110, r = 70;
    const A = `<circle cx="${ax}" cy="${cy}" r="${r}"/>`, B = `<circle cx="${bx}" cy="${cy}" r="${r}"/>`;
    return `<svg class="venn" viewBox="0 0 310 190" role="img" aria-label="Diagrama de Venn: ${esc(nombres[0])} a la izquierda, ${esc(nombres[1])} a la derecha">
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
      <text x="${ax - 40}" y="22" class="venn-tit" text-anchor="middle">${esc(nombres[0])}</text>
      <text x="${bx + 40}" y="22" class="venn-tit" text-anchor="middle">${esc(nombres[1])}</text>
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
  // 5. Modelo estrella: cómo viaja un filtro por las relaciones (interactivo)
  // ---------------------------------------------------------------------------
  const ESTRELLA = {
    dims: {
      Producto: { x: 52, y: 120, clave: "p", filas: { P1: "Café · Bebidas", P2: "Jugo · Bebidas", P3: "Leche · Lácteos", P4: "Queso · Lácteos" } },
      Cliente: { x: 308, y: 120, clave: "c", filas: { C1: "Ana", C2: "Beto", C3: "Carla", C4: "Darío" } },
      Calendario: { x: 180, y: 30, clave: "m", filas: { Ene: "Enero", Feb: "Febrero" } },
      Sucursal: { x: 180, y: 210, clave: "s", filas: { S1: "Norte", S2: "Sur" } },
    },
    ventas: [
      { p: "P1", c: "C1", s: "S1", m: "Ene" }, { p: "P3", c: "C1", s: "S1", m: "Feb" },
      { p: "P2", c: "C2", s: "S2", m: "Ene" }, { p: "P4", c: "C2", s: "S2", m: "Ene" },
      { p: "P1", c: "C3", s: "S1", m: "Ene" }, { p: "P3", c: "C3", s: "S2", m: "Feb" },
      { p: "P4", c: "C1", s: "S2", m: "Feb" }, { p: "P3", c: "C2", s: "S1", m: "Ene" },
    ],
    filtros: {
      Producto: { texto: 'Producto[Categoria] = "Bebidas"', ok: (k) => k === "P1" || k === "P2" },
      Cliente: { texto: 'Cliente[Cliente] = "Ana"', ok: (k) => k === "C1" },
      Calendario: { texto: 'Calendario[Mes] = "Enero"', ok: (k) => k === "Ene" },
      Sucursal: { texto: 'Sucursal[Region] = "Norte"', ok: (k) => k === "S1" },
    },
  };

  function estadoEstrella(origen, bidi) {
    const E = ESTRELLA, f = E.filtros[origen], kOrigen = E.dims[origen].clave;
    const ventas = E.ventas.filter((v) => f.ok(v[kOrigen]));
    const visibles = {};
    for (const [nom, d] of Object.entries(E.dims)) {
      const total = Object.keys(d.filas).length;
      let n = total;
      if (nom === origen) n = Object.keys(d.filas).filter(f.ok).length;
      else if (bidi) n = new Set(ventas.map((v) => v[d.clave])).size;
      visibles[nom] = { n, total };
    }
    return { ventas: ventas.length, totalVentas: E.ventas.length, visibles };
  }

  function svgEstrella(origen, bidi) {
    const E = ESTRELLA, st = estadoEstrella(origen, bidi);
    const cx = 180, cy = 120, w = 92, h = 40;
    let lineas = "", cajas = "";
    for (const [nom, d] of Object.entries(E.dims)) {
      const activa = nom === origen || bidi;
      // Flecha en el punto medio: de la dimensión hacia Ventas; con "ambas", otra de Ventas hacia la dimensión
      const mx = (d.x + cx) / 2, my = (d.y + cy) / 2;
      const ang = Math.atan2(cy - d.y, cx - d.x) * (180 / Math.PI);
      const punta = (a, desp, on) => `<path class="flecha ${on ? "on" : ""}" d="M -7 -6 L 6 0 L -7 6 z" transform="translate(${mx} ${my}) rotate(${a}) translate(${desp} 0)"/>`;
      lineas += `<line class="rel ${activa ? "on" : ""}" x1="${d.x}" y1="${d.y}" x2="${cx}" y2="${cy}"/>
        ${punta(ang, bidi ? 8 : 0, nom === origen)}${bidi ? punta(ang + 180, 8, nom !== origen) : ""}`;
      const v = st.visibles[nom];
      const filtrada = v.n < v.total;
      cajas += `<g class="tabla-nodo ${nom === origen ? "origen" : filtrada ? "filtrada" : ""}">
        <rect x="${d.x - w / 2}" y="${d.y - h / 2}" width="${w}" height="${h}" rx="6"/>
        <text x="${d.x}" y="${d.y - 3}" text-anchor="middle" class="t-nom">${esc(nom)}</text>
        <text x="${d.x}" y="${d.y + 12}" text-anchor="middle" class="t-n">${v.n} de ${v.total} filas</text>
      </g>`;
    }
    cajas += `<g class="tabla-nodo hechos ${st.ventas < st.totalVentas ? "filtrada" : ""}">
      <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="6"/>
      <text x="${cx}" y="${cy - 3}" text-anchor="middle" class="t-nom">Ventas</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" class="t-n">${st.ventas} de ${st.totalVentas} filas</text>
    </g>`;
    return `<svg class="dg-svg dg-estrella" viewBox="0 0 360 240" role="img" aria-label="Modelo estrella: Ventas en el centro y Producto, Cliente, Calendario y Sucursal alrededor; el filtro sobre ${esc(origen)} deja ${st.ventas} de ${st.totalVentas} filas de Ventas">${lineas}${cajas}</svg>`;
  }

  function textoEstrella(origen, bidi) {
    const st = estadoEstrella(origen, bidi);
    const otras = Object.keys(ESTRELLA.dims).filter((n) => n !== origen);
    const detalle = bidi
      ? `Con dirección <strong>ambas</strong>, el filtro también sube desde Ventas: ${otras.map((n) => `${esc(n)} queda en ${st.visibles[n].n} de ${st.visibles[n].total}`).join(", ")}. Las segmentaciones empiezan a filtrarse entre sí.`
      : `Con dirección <strong>única</strong>, el filtro baja de ${esc(origen)} a Ventas y se detiene ahí: ${otras.map(esc).join(", ")} siguen completas. Para contar, por ejemplo, clientes con compra, cuenta sobre Ventas: <code>DISTINCTCOUNT ( Ventas[ClienteID] )</code>.`;
    return `<p><strong>Filtro:</strong> <code>${esc(ESTRELLA.filtros[origen].texto)}</code> → Ventas pasa de ${st.totalVentas} a ${st.ventas} filas, y todas las medidas se calculan sobre esas filas.</p><p>${detalle}</p>`;
  }

  function htmlEstrella() {
    const origen = "Producto", bidi = false;
    return `<figure class="diagrama" data-diagrama="modelo-estrella" data-origen="${origen}" data-bidi="0">
      <div class="dg-botones" role="group" aria-label="Elige qué tabla filtrar">
        ${Object.keys(ESTRELLA.dims).map((n) => `<button type="button" class="dg-btn" data-origen="${n}" aria-pressed="${n === origen}">Filtrar ${esc(n)}</button>`).join("")}
      </div>
      <div class="dg-botones" role="group" aria-label="Dirección del filtro cruzado">
        <button type="button" class="dg-btn" data-bidi="0" aria-pressed="true">Dirección única</button>
        <button type="button" class="dg-btn" data-bidi="1" aria-pressed="false">Dirección ambas</button>
      </div>
      <div class="dg-panel-e" aria-live="polite">${svgEstrella(origen, bidi)}<div class="dg-explica">${textoEstrella(origen, bidi)}</div></div>
      <figcaption>Cada relación es de uno (dimensión) a varios (Ventas). Las flechas muestran hacia dónde viaja el filtro; en color, las tablas que quedan filtradas.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // 6. CALCULATE: cómo cambia el contexto de filtro de cada celda (interactivo)
  // ---------------------------------------------------------------------------
  const CATEGORIAS = [["Bebidas", 420], ["Lácteos", 310], ["Limpieza", 180], ["Panadería", 90]];
  const TOTAL_CAT = CATEGORIAS.reduce((a, c) => a + c[1], 0);
  const CALC = [
    {
      id: "base", nombre: "[Ventas]", dax: "Ventas =\nSUMX ( Ventas, Ventas[Cantidad] * Ventas[PrecioUnit] )",
      fila: (cat) => [`Categoria = "${cat}"`], valor: (cat, v) => v, total: () => TOTAL_CAT,
      texto: "Sin CALCULATE: cada celda usa el filtro de su fila. El total no tiene filtro de categoría.",
    },
    {
      id: "reemplaza", nombre: "Filtro simple", dax: 'Ventas Bebidas =\nCALCULATE ( [Ventas], Producto[Categoria] = "Bebidas" )',
      fila: () => ['Categoria = "Bebidas"'], valor: () => 420, total: () => 420,
      texto: "El filtro nuevo sobre Categoria reemplaza al de la fila: todas las filas, y también el total, muestran Bebidas.",
    },
    {
      id: "keep", nombre: "KEEPFILTERS", dax: 'Ventas solo Bebidas =\nCALCULATE ( [Ventas], KEEPFILTERS ( Producto[Categoria] = "Bebidas" ) )',
      fila: (cat) => [`Categoria = "${cat}"`, 'Categoria = "Bebidas"'], valor: (cat, v) => (cat === "Bebidas" ? v : null), total: () => 420,
      texto: "KEEPFILTERS cruza el filtro nuevo con el de la fila. Solo Bebidas cumple las dos condiciones; las demás filas quedan vacías.",
    },
    {
      id: "remove", nombre: "REMOVEFILTERS", dax: "Ventas todas las categorías =\nCALCULATE ( [Ventas], REMOVEFILTERS ( Producto[Categoria] ) )",
      fila: () => ["(sin filtro de categoría)"], valor: () => TOTAL_CAT, total: () => TOTAL_CAT,
      texto: "REMOVEFILTERS quita el filtro de la fila: cada celda muestra el total de todas las categorías. Es el denominador de un porcentaje.",
    },
    {
      id: "pct", nombre: "% del total", dax: "% del total =\nDIVIDE (\n    [Ventas],\n    CALCULATE ( [Ventas], REMOVEFILTERS ( Producto[Categoria] ) )\n)",
      fila: (cat) => [`numerador: Categoria = "${cat}"`, "denominador: sin filtro"], valor: (cat, v) => v / TOTAL_CAT, total: () => 1, pct: true,
      texto: "Combina las dos ideas: el numerador conserva el filtro de la fila y el denominador lo quita.",
    },
  ];

  function panelCalc(c, sel) {
    const fmt = (v) => (v === null ? "" : c.pct ? Math.round(v * 1000) / 10 + " %" : String(v));
    const filaSel = CATEGORIAS.find((x) => x[0] === sel);
    const filas = CATEGORIAS.map(([cat, v]) => `<tr class="${cat === sel ? "marca" : ""}" data-cat="${esc(cat)}" tabindex="0" role="button" aria-label="Ver el contexto de la fila ${esc(cat)}"><td>${esc(cat)}</td><td>${v}</td><td>${fmt(c.valor(cat, v))}</td></tr>`).join("");
    return `<div class="dg-calc">
        <table class="dg-tabla dg-calc-tabla" aria-label="Matriz por categoría">
          <thead><tr><th>Categoria</th><th>[Ventas]</th><th>${esc(c.nombre)}</th></tr></thead>
          <tbody>${filas}<tr class="total"><td>Total</td><td>${TOTAL_CAT}</td><td>${fmt(c.total())}</td></tr></tbody>
        </table>
        <div class="dg-explica">
          <pre class="dg-sql"><code>${esc(c.dax)}</code></pre>
          <p class="dg-ctx"><strong>Fila ${esc(sel)}</strong> · contexto antes: <code>Categoria = "${esc(sel)}"</code>, <code>Año = 2025</code><br>
          contexto con la medida: ${c.fila(filaSel[0]).map((t) => `<code>${esc(t)}</code>`).join(" y ")}, <code>Año = 2025</code></p>
          <p>${esc(c.texto)} El filtro de la segmentación (Año = 2025) se conserva siempre.</p>
        </div>
      </div>`;
  }

  function htmlCalculate() {
    const c0 = CALC[0];
    return `<figure class="diagrama" data-diagrama="calculate-contexto" data-calc="${c0.id}" data-cat="Lácteos">
      <div class="dg-botones" role="group" aria-label="Elige la medida">
        ${CALC.map((c) => `<button type="button" class="dg-btn" data-calc="${c.id}" aria-pressed="${c === c0}">${esc(c.nombre)}</button>`).join("")}
      </div>
      <div class="dg-panel-k" aria-live="polite">${panelCalc(c0, "Lácteos")}</div>
      <figcaption>Una matriz por categoría con una segmentación Año = 2025. Elige una medida y toca una fila para ver cómo CALCULATE cambia su contexto de filtro.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // 5. Ciclo de vida de un componente React (curso TypeScript y React)
  // ---------------------------------------------------------------------------
  const FASES = [
    {
      id: "montar", nombre: "Montar",
      cuando: "El componente aparece en pantalla por primera vez.",
      pasos: [
        ["render", "React ejecuta tu función con las props y el estado inicial y obtiene el JSX."],
        ["dom", "React crea los elementos en el DOM y el navegador los pinta."],
        ["efecto", "Se ejecuta el useEffect: pedir datos, poner un intervalo, escuchar un evento."],
      ],
    },
    {
      id: "actualizar", nombre: "Actualizar",
      cuando: "Cambia una prop o se llama a un setter de estado.",
      pasos: [
        ["render", "React vuelve a ejecutar tu función con los valores nuevos."],
        ["dom", "Compara con el JSX anterior y cambia en el DOM solo lo que es distinto."],
        ["limpieza", "Si cambió alguna dependencia del efecto, primero corre la limpieza del efecto anterior."],
        ["efecto", "Luego corre el efecto otra vez con los valores nuevos. Si ninguna dependencia cambió, no se repite."],
      ],
    },
    {
      id: "desmontar", nombre: "Desmontar",
      cuando: "El componente deja de mostrarse (cambias de vista, se filtra, se cierra).",
      pasos: [
        ["dom", "React quita sus elementos del DOM."],
        ["limpieza", "Corre la limpieza del último efecto: cancelar la petición, clearInterval, removeEventListener."],
      ],
    },
  ];
  const ETIQUETA_PASO = { render: "render", dom: "DOM", efecto: "efecto", limpieza: "limpieza" };

  function panelFase(f) {
    return `<p class="dg-cuando"><strong>${esc(f.nombre)}:</strong> ${esc(f.cuando)}</p>
      <ol class="dg-pasos">${f.pasos.map(([t, txt]) => `<li><span class="dg-paso ${t}">${ETIQUETA_PASO[t]}</span><span>${esc(txt)}</span></li>`).join("")}</ol>`;
  }

  function htmlCicloVida() {
    const f0 = FASES[0];
    return `<figure class="diagrama" data-diagrama="ciclo-vida-react">
      <div class="dg-botones" role="group" aria-label="Elige un momento del ciclo de vida">
        ${FASES.map((f) => `<button type="button" class="dg-btn" data-fase="${f.id}" aria-pressed="${f === f0}">${esc(f.nombre)}</button>`).join("")}
      </div>
      <div class="dg-panel-fase" aria-live="polite">${panelFase(f0)}</div>
      <figcaption>El render solo calcula. Todo lo que toca el mundo de fuera va en un efecto, y cada efecto que deja algo encendido devuelve una limpieza.</figcaption>
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
    "ciclo-vida-react": htmlCicloVida,
    "modelo-estrella": htmlEstrella,
    "calculate-contexto": htmlCalculate,
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

    (raiz || document).querySelectorAll('[data-diagrama="ciclo-vida-react"]').forEach((fig) => {
      if (fig.dataset.listo) return;
      fig.dataset.listo = "1";
      fig.addEventListener("click", (e) => {
        const b = e.target.closest("[data-fase]");
        if (!b) return;
        const f = FASES.find((x) => x.id === b.dataset.fase);
        fig.querySelectorAll("[data-fase]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        fig.querySelector(".dg-panel-fase").innerHTML = panelFase(f);
      });
    });
    (raiz || document).querySelectorAll('[data-diagrama="modelo-estrella"]').forEach((fig) => {
      if (fig.dataset.listo) return;
      fig.dataset.listo = "1";
      fig.addEventListener("click", (e) => {
        const b = e.target.closest("[data-origen], [data-bidi]");
        if (!b || b === fig) return;
        if (b.dataset.origen) fig.dataset.origen = b.dataset.origen;
        if (b.dataset.bidi) fig.dataset.bidi = b.dataset.bidi;
        fig.querySelectorAll("button[data-origen]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.origen === fig.dataset.origen)));
        fig.querySelectorAll("button[data-bidi]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.bidi === fig.dataset.bidi)));
        const bidi = fig.dataset.bidi === "1";
        fig.querySelector(".dg-panel-e").innerHTML = svgEstrella(fig.dataset.origen, bidi) + `<div class="dg-explica">${textoEstrella(fig.dataset.origen, bidi)}</div>`;
      });
    });
    (raiz || document).querySelectorAll('[data-diagrama="calculate-contexto"]').forEach((fig) => {
      if (fig.dataset.listo) return;
      fig.dataset.listo = "1";
      const pintar = () => {
        const c = CALC.find((x) => x.id === fig.dataset.calc);
        fig.querySelectorAll("button[data-calc]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.calc === c.id)));
        fig.querySelector(".dg-panel-k").innerHTML = panelCalc(c, fig.dataset.cat);
      };
      fig.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-calc]");
        const tr = e.target.closest("tr[data-cat]");
        if (b) fig.dataset.calc = b.dataset.calc;
        else if (tr) fig.dataset.cat = tr.dataset.cat;
        else return;
        pintar();
      });
      fig.addEventListener("keydown", (e) => {
        const tr = e.target.closest("tr[data-cat]");
        if (!tr || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        fig.dataset.cat = tr.dataset.cat;
        pintar();
        const nueva = fig.querySelector(`tr[data-cat="${CSS.escape(tr.dataset.cat)}"]`);
        if (nueva) nueva.focus();
      });
    });
  }

  window.Diagramas = { html, activar, ESTRELLA, estadoEstrella, CALC, svgVenn, JOINS, filasJoin, ajusteLineal, REG, CLIENTES_CHURN };
})();
