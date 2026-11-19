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
  // 7. Ciclo de vida de un componente React (curso TypeScript y React)
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
  // 8. ETL frente a ELT (estático)
  // ---------------------------------------------------------------------------
  function flecha(x1, y, x2, mk) {
    return `<line class="dg-flecha" x1="${x1}" y1="${y}" x2="${x2 - 2}" y2="${y}" marker-end="url(#${mk})"/>`;
  }
  function caja(x, y, w, h, lineas, clase) {
    const cy = y + h / 2 - (lineas.length - 1) * 6.5;
    const txt = lineas.map((l, i) => `<tspan x="${x + w / 2}" y="${cy + i * 13 + 4}">${esc(l)}</tspan>`).join("");
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="dg-caja ${clase || ""}"/><text text-anchor="middle" class="t-caja">${txt}</text>`;
  }

  function htmlEtlElt() {
    const mk = `dg-punta-${++uid}`;
    const W = 360, w = 74, h = 44, g = 20;
    const fila = (y, cajas) => cajas.map((c, i) => {
      const x = i * (w + g);
      return caja(x, y, w, h, c[0], c[1]) + (i < cajas.length - 1 ? flecha(x + w, y + h / 2, x + w + g, mk) : "");
    }).join("");
    const etl = fila(22, [[["fuente"], ""], [["servidor", "ETL"], "transforma"], [["almacén", "(limpio)"], "almacen"]]);
    const elt = fila(112, [[["fuente"], ""], [["almacén", "raw"], "almacen"], [["SQL / dbt", "en el almacén"], "transforma"], [["staging", "y marts"], "almacen"]]);
    return `<figure class="diagrama" data-diagrama="etl-elt">
      <svg class="dg-svg" viewBox="0 0 ${W} 166" role="img" aria-label="Comparación de flujos: en ETL la transformación ocurre en un servidor antes de cargar; en ELT se carga crudo y se transforma dentro del almacén">
        <defs><marker id="${mk}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="dg-punta"/></marker></defs>
        <text x="0" y="13" class="t-in">ETL · Extract, Transform, Load</text>
        ${etl}
        <text x="0" y="103" class="t-in">ELT · Extract, Load, Transform</text>
        ${elt}
      </svg>
      <div class="dg-leyenda"><span><i class="dg-l-transforma"></i>dónde se transforma</span><span><i class="dg-l-almacen"></i>almacén de datos</span></div>
      <figcaption>En ETL solo el resultado limpio llega al almacén: si cambia una regla, hay que volver a extraer. En ELT el dato crudo queda guardado en raw y la transformación es SQL versionado (dbt) que se puede volver a ejecutar cuando quieras.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // 9. DAG de Airflow con estados de ejecución (interactivo)
  // ---------------------------------------------------------------------------
  const DAG_NODOS = [
    { id: "erp", txt: "extraer_erp", x: 0, y: 0, w: 108 },
    { id: "crm", txt: "extraer_crm", x: 126, y: 0, w: 108 },
    { id: "pagos", txt: "extraer_pagos", x: 252, y: 0, w: 108 },
    { id: "fresh", txt: "freshness", x: 126, y: 62, w: 108 },
    { id: "snap", txt: "dbt snapshot", x: 126, y: 118, w: 108 },
    { id: "build", txt: "dbt build", x: 126, y: 174, w: 108 },
    { id: "pub", txt: "publicar", x: 126, y: 230, w: 108 },
  ];
  const DAG_ARISTAS = [["erp", "fresh"], ["crm", "fresh"], ["pagos", "fresh"], ["fresh", "snap"], ["snap", "build"], ["build", "pub"]];
  const DAG_ESC = [
    { id: "ok", nombre: "Corrida exitosa", falla: null,
      texto: "Las tres extracciones corren en paralelo. freshness espera a las tres; luego cada tarea arranca cuando termina la anterior." },
    { id: "crm", nombre: "Falla extraer_crm", falla: "crm",
      texto: "extraer_crm agota sus reintentos. Las otras extracciones terminan bien, pero todo lo que depende de crm queda en «upstream_failed»: no se transforma ni se publica con datos incompletos." },
    { id: "build", nombre: "Falla una prueba en dbt build", falla: "build",
      texto: "Una prueba de dbt falla. Las tareas previas quedan en verde y publicar no corre: el tablero sigue mostrando los datos válidos de ayer. Al corregir, se reintenta solo desde build." },
  ];
  const DAG_H = 28;

  function estadosDag(falla) {
    const est = {};
    for (const n of DAG_NODOS) est[n.id] = "ok";
    if (!falla) return est;
    est[falla] = "fallo";
    // propaga "omitida" a todos los descendientes
    const pend = [falla];
    while (pend.length) {
      const a = pend.pop();
      for (const [o, d] of DAG_ARISTAS) if (o === a && est[d] !== "omitida") { est[d] = "omitida"; pend.push(d); }
    }
    return est;
  }

  function svgDag(falla, mk) {
    const est = estadosDag(falla);
    const nodo = (id) => DAG_NODOS.find((n) => n.id === id);
    const aristas = DAG_ARISTAS.map(([o, d]) => {
      const a = nodo(o), b = nodo(d);
      return `<line class="dg-flecha" x1="${a.x + a.w / 2}" y1="${a.y + DAG_H}" x2="${b.x + b.w / 2}" y2="${b.y - 2}" marker-end="url(#${mk})"/>`;
    }).join("");
    const nodos = DAG_NODOS.map((n) => `<g class="dg-nodo ${est[n.id]}">
        <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${DAG_H}" rx="6"/>
        <text x="${n.x + n.w / 2}" y="${n.y + 18}" text-anchor="middle">${esc(n.txt)}</text></g>`).join("");
    return `<svg class="dg-svg dg-dag" viewBox="0 0 360 ${230 + DAG_H + 2}" role="img" aria-label="DAG de Airflow: tres extracciones en paralelo, luego freshness, dbt snapshot, dbt build y publicar">
        <defs><marker id="${mk}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="dg-punta"/></marker></defs>
        ${aristas}${nodos}
      </svg>`;
  }

  function htmlDag() {
    const n = ++uid;
    const e0 = DAG_ESC[0];
    return `<figure class="diagrama" data-diagrama="dag-airflow" data-n="${n}">
      <div class="dg-botones" role="group" aria-label="Elige un escenario de ejecución">
        ${DAG_ESC.map((e) => `<button type="button" class="dg-btn" data-esc="${e.id}" aria-pressed="${e === e0}">${esc(e.nombre)}</button>`).join("")}
      </div>
      <div class="dg-panel-dag" aria-live="polite">${svgDag(e0.falla, `dg-punta-dag-${n}`)}<p class="dg-dag-texto">${esc(e0.texto)}</p></div>
      <div class="dg-leyenda"><span><i class="dg-l-ok"></i>éxito</span><span><i class="dg-l-fallo"></i>falló</span><span><i class="dg-l-omitida"></i>no corre (upstream_failed)</span></div>
      <figcaption>Cada caja es una tarea y cada flecha una dependencia (&gt;&gt;). Cambia de escenario para ver qué pasa con las tareas que dependen de una que falla.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // 10. Ramas de Git: merge, rebase y squash (interactivo)
  // ---------------------------------------------------------------------------
  const MODOS_RAMAS = [
    {
      id: "antes", nombre: "Antes de integrar",
      cmd: "git switch -c feature/filtros   # desde B\n# ...dos commits: D y E\n# mientras tanto, main recibe C",
      texto: "La rama feature/filtros salió de B. Mientras trabajabas, alguien integró C en main. Ahora las dos historias se separaron y hay que juntarlas.",
    },
    {
      id: "merge", nombre: "merge",
      cmd: "git switch main\ngit merge --no-ff feature/filtros",
      texto: "Se crea un commit de unión M con dos padres (C y E). La historia queda tal como ocurrió, con la bifurcación visible. Es seguro: no reescribe ningún commit.",
    },
    {
      id: "rebase", nombre: "rebase",
      cmd: "git switch feature/filtros\ngit rebase main\ngit switch main\ngit merge --ff-only feature/filtros",
      texto: "D y E se vuelven a aplicar encima de C y nacen D' y E', con otro hash. La historia queda en una sola línea. Solo se hace sobre commits que nadie más tiene.",
    },
    {
      id: "squash", nombre: "squash",
      cmd: "git switch main\ngit merge --squash feature/filtros\ngit commit -m \"feat: filtros por fecha\"",
      texto: "Todo el trabajo de la rama se convierte en un único commit S sobre main. Es lo que hace el botón «Squash and merge» de GitHub: un commit por pull request.",
    },
  ];

  function svgRamas(modo) {
    const X = (i) => 30 + i * 62, YM = 40, YF = 104;
    let h = "";
    const linea = (x1, y1, x2, y2, cls = "rama") => { h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`; };
    const commit = (x, y, t, cls = "") => { h += `<g class="commit ${cls}"><circle cx="${x}" cy="${y}" r="13"/><text x="${x}" y="${y + 4}" text-anchor="middle">${t}</text></g>`; };
    h += `<text x="0" y="${YM - 22}" class="rotulo">main</text>`;
    const main = modo === "rebase" ? ["A", "B", "C", "D'", "E'"] : modo === "merge" ? ["A", "B", "C", "M"] : modo === "squash" ? ["A", "B", "C", "S"] : ["A", "B", "C"];
    // En merge, M va una columna después de E para que se vea la unión
    const pos = (i) => (modo === "merge" && i === 3 ? X(4) : X(i));
    for (let i = 0; i < main.length - 1; i++) linea(pos(i), YM, pos(i + 1), YM);
    const conFeature = modo === "antes" || modo === "merge";
    if (conFeature) {
      h += `<text x="0" y="${YF + 30}" class="rotulo">feature/filtros</text>`;
      linea(X(1), YM, X(2), YF); linea(X(2), YF, X(3), YF);
      if (modo === "merge") linea(X(3), YF, X(4), YM, "rama union");
      commit(X(2), YF, "D"); commit(X(3), YF, "E");
    } else if (modo === "rebase") {
      h += `<text x="${X(0) - 10}" y="${YF - 14}" class="rotulo tenue">los D y E originales se descartan</text>`;
    }
    main.forEach((t, i) => commit(pos(i), YM, t, ["D'", "E'", "M", "S"].includes(t) ? "nuevo" : ""));
    return `<svg class="dg-svg dg-ramas" viewBox="0 0 330 ${conFeature ? 150 : 120}" role="img" aria-label="Historia de Git: ${esc(MODOS_RAMAS.find((m) => m.id === modo).nombre)}">${h}</svg>`;
  }

  function panelRamas(m) {
    return `<div>${svgRamas(m.id)}</div>
      <div class="dg-explica"><p>${esc(m.texto)}</p><pre class="dg-sql">${esc(m.cmd)}</pre></div>`;
  }

  function htmlRamas() {
    const m0 = MODOS_RAMAS[0];
    return `<figure class="diagrama" data-diagrama="ramas-git">
      <div class="dg-botones" role="group" aria-label="Forma de integrar la rama">
        ${MODOS_RAMAS.map((m) => `<button type="button" class="dg-btn" data-modo="${m.id}" aria-pressed="${m === m0}">${esc(m.nombre)}</button>`).join("")}
      </div>
      <div class="dg-panel dg-panel-ancho" aria-live="polite">${panelRamas(m0)}</div>
      <figcaption>Elige una forma de integrar la rama y mira cómo queda la historia. Los círculos rellenos son commits nuevos que crea esa operación.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // 11. Pipeline de CI/CD (interactivo)
  // ---------------------------------------------------------------------------
  const ETAPAS_PIPELINE = [
    {
      id: "push", nombre: "push / PR", tipo: "ci",
      texto: "Todo empieza cuando subes commits o abres un pull request. GitHub lee los archivos de .github/workflows/ y arranca los trabajos cuyo evento coincide.",
      yaml: "on:\n  pull_request:\n  push:\n    branches: [main]",
      falla: "Si el archivo YAML tiene un error, el workflow ni siquiera aparece: revisa la pestaña Actions.",
    },
    {
      id: "pruebas", nombre: "lint y pruebas", tipo: "ci",
      texto: "Una máquina limpia descarga el código, instala dependencias exactas y corre el linter y las pruebas. Es la integración continua: cada cambio se comprueba solo.",
      yaml: "- uses: actions/checkout@v4\n- run: npm ci\n- run: npm run lint\n- run: npm test",
      falla: "El PR queda en rojo y la regla de protección de main impide fusionarlo.",
    },
    {
      id: "build", nombre: "construir imagen", tipo: "cd",
      texto: "Si las pruebas pasan en main, se construye la imagen de Docker una sola vez y se etiqueta con el hash del commit. Esa misma imagen viaja por todos los entornos.",
      yaml: "- run: docker build -t $IMAGEN:${{ github.sha }} .",
      falla: "Un Dockerfile roto se detecta aquí, antes de tocar ningún servidor.",
    },
    {
      id: "registro", nombre: "publicar en registro", tipo: "cd",
      texto: "La imagen se sube a Artifact Registry. El pipeline se autentica con una identidad de servicio, sin contraseñas guardadas en el repositorio.",
      yaml: "- uses: google-github-actions/auth@v2\n  with:\n    workload_identity_provider: ${{ secrets.WIF_PROVIDER }}\n- run: docker push $IMAGEN:${{ github.sha }}",
      falla: "Un error de permisos aquí casi siempre es un rol que le falta a la cuenta de servicio.",
    },
    {
      id: "staging", nombre: "desplegar a staging", tipo: "cd",
      texto: "Se despliega la imagen en un entorno de pruebas igual a producción y se ejecuta una prueba de humo: pedir /salud y esperar un 200.",
      yaml: "- run: gcloud run deploy app-staging --image $IMAGEN:${{ github.sha }} --region us-central1\n- run: curl -fsS $URL_STAGING/salud",
      falla: "Si la prueba de humo falla, el pipeline se detiene y producción no se entera.",
    },
    {
      id: "prod", nombre: "aprobar y producción", tipo: "cd",
      texto: "El entorno production pide una aprobación humana. Al aprobar, se despliega exactamente la misma imagen que ya pasó por staging.",
      yaml: "deploy-prod:\n  needs: deploy-staging\n  environment: production   # pide aprobación\n  steps:\n    - run: gcloud run deploy app --image $IMAGEN:${{ github.sha }}",
      falla: "Si algo sale mal, se vuelve a la revisión anterior en segundos, porque la imagen vieja sigue en el registro.",
    },
  ];

  function panelPipeline(e) {
    return `<div class="dg-explica">
      <p><strong>${esc(e.nombre)}</strong> · <span class="dg-cuenta">${e.tipo === "ci" ? "integración continua" : "entrega continua"}</span></p>
      <p>${esc(e.texto)}</p>
      <pre class="dg-sql">${esc(e.yaml)}</pre>
      <p class="dg-cuenta">Si falla: ${esc(e.falla)}</p>
    </div>`;
  }

  function htmlPipeline() {
    const e0 = ETAPAS_PIPELINE[0];
    return `<figure class="diagrama" data-diagrama="pipeline-cicd">
      <ol class="dg-pipeline" aria-label="Etapas del pipeline">
        ${ETAPAS_PIPELINE.map((e) => `<li class="${e.tipo}"><button type="button" class="dg-btn" data-etapa="${e.id}" aria-pressed="${e === e0}">${esc(e.nombre)}</button></li>`).join("")}
      </ol>
      <div class="dg-leyenda"><span><i class="b-ci"></i>CI: comprobar cada cambio</span><span><i class="b-cd"></i>CD: entregar lo que pasó</span></div>
      <div class="dg-panel-p" aria-live="polite">${panelPipeline(e0)}</div>
      <figcaption>Toca cada etapa para ver qué hace, cómo se escribe en GitHub Actions y qué pasa si falla. Una etapa solo empieza si la anterior terminó en verde.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // 5. Árbol B de un índice: Seek, Seek de rango y Scan (interactivo)
  // ---------------------------------------------------------------------------
  const ARBOL_MODOS = [
    {
      id: "seek", nombre: "Index Seek", sql: "WHERE id = 450",
      paginas: { raiz: true, inter: [1], hojas: [4] },
      texto: "Baja por el árbol: la raíz dice que 450 está en la página intermedia 301–600, y esa dice que está en la hoja 401–500. Tres páginas leídas, sin importar cuántas filas tenga la tabla.",
    },
    {
      id: "rango", nombre: "Seek de rango", sql: "WHERE id BETWEEN 450 AND 650",
      paginas: { raiz: true, inter: [1], hojas: [4, 5, 6] },
      texto: "Baja hasta la primera clave del rango (450) y desde ahí avanza por las hojas, que están enlazadas entre sí, hasta pasar de 650. No vuelve a subir al árbol: cinco páginas.",
    },
    {
      id: "scan", nombre: "Index Scan", sql: "WHERE estado = 'pendiente'",
      paginas: { raiz: false, inter: [], hojas: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
      texto: "El índice está ordenado por id, no por estado, así que no sirve para buscar: hay que leer todas las hojas, de la primera a la última. Con millones de filas son miles de páginas.",
    },
  ];
  function svgArbol(m) {
    const W = 560, hojaW = 54, gap = 7, x0 = (W - (9 * hojaW + 8 * gap)) / 2;
    const yR = 8, yI = 78, yH = 150, alto = 34;
    const on = (c) => (c ? " on" : "");
    const interW = 120, interX = [x0 + 40, (W - interW) / 2, W - x0 - 40 - interW];
    let h = "";
    // Líneas padre → hijo
    interX.forEach((x) => { h += `<line class="ar-linea" x1="${W / 2}" y1="${yR + alto}" x2="${x + interW / 2}" y2="${yI}"/>`; });
    for (let k = 0; k < 9; k++) {
      const xh = x0 + k * (hojaW + gap);
      const xi = interX[Math.floor(k / 3)] + interW / 2;
      h += `<line class="ar-linea" x1="${xi}" y1="${yI + alto}" x2="${xh + hojaW / 2}" y2="${yH}"/>`;
      if (k < 8) h += `<line class="ar-enlace" x1="${xh + hojaW}" y1="${yH + alto / 2}" x2="${xh + hojaW + gap}" y2="${yH + alto / 2}"/>`;
    }
    // Páginas
    const raizW = 140;
    h += `<g class="ar-pag${on(m.paginas.raiz)}"><rect x="${(W - raizW) / 2}" y="${yR}" width="${raizW}" height="${alto}" rx="4"/><text x="${W / 2}" y="${yR + 21}" text-anchor="middle">raíz · 1–900</text></g>`;
    interX.forEach((x, i) => {
      h += `<g class="ar-pag${on(m.paginas.inter.includes(i))}"><rect x="${x}" y="${yI}" width="${interW}" height="${alto}" rx="4"/><text x="${x + interW / 2}" y="${yI + 21}" text-anchor="middle">${i * 300 + 1}–${(i + 1) * 300}</text></g>`;
    });
    for (let k = 0; k < 9; k++) {
      const xh = x0 + k * (hojaW + gap);
      h += `<g class="ar-pag hoja${on(m.paginas.hojas.includes(k))}"><rect x="${xh}" y="${yH}" width="${hojaW}" height="${alto}" rx="4"/><text x="${xh + hojaW / 2}" y="${yH + 21}" text-anchor="middle">${k * 100 + 1}–${(k + 1) * 100}</text></g>`;
    }
    return `<svg class="dg-svg dg-arbol" viewBox="0 0 ${W} ${yH + alto + 6}" role="img" aria-label="Árbol B de un índice sobre id: raíz, 3 páginas intermedias y 9 hojas. Resaltadas, las páginas que lee ${esc(m.nombre)}">${h}</svg>`;
  }
  function panelArbol(m) {
    const n = (m.paginas.raiz ? 1 : 0) + m.paginas.inter.length + m.paginas.hojas.length;
    return `<pre class="dg-sql"><code>SELECT * FROM ventas.pedidos\n${esc(m.sql)};</code></pre>
      ${svgArbol(m)}
      <p class="dg-explica-arbol"><strong>${n} páginas leídas.</strong> ${esc(m.texto)}</p>`;
  }
  function htmlArbol() {
    const m0 = ARBOL_MODOS[0];
    return `<figure class="diagrama" data-diagrama="indice-arbol-b">
      <div class="dg-botones" role="group" aria-label="Elige cómo se lee el índice">
        ${ARBOL_MODOS.map((m) => `<button type="button" class="dg-btn" data-arbol="${m.id}" aria-pressed="${m === m0}">${esc(m.nombre)}</button>`).join("")}
      </div>
      <div class="dg-panel-arbol" aria-live="polite">${panelArbol(m0)}</div>
      <figcaption>Índice clúster sobre <code>id</code> con 900 filas repartidas en 9 páginas hoja. Las páginas resaltadas son las que el motor tiene que leer en cada caso.</figcaption>
    </figure>`;
  }
  // ---------------------------------------------------------------------------
  // 10. Boosting árbol a árbol (interactivo)
  // ---------------------------------------------------------------------------
  // Temperatura del día (x) y ventas de helados (y): relación no lineal
  const BOOST = [[2, 12], [4, 14], [6, 13], [8, 18], [10, 21], [12, 20], [14, 30], [16, 34], [18, 33], [20, 41], [22, 47], [24, 45], [26, 38], [28, 35], [30, 33]];
  const BOOST_LR = 0.5, BOOST_MAX = 8;

  // Ajusta árboles de un solo corte (stumps) en secuencia sobre los residuos
  function boostingPasos(pts, rondas, lr) {
    const media = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const pred = pts.map(() => media);
    const pasos = [{ pred: pred.slice(), corte: null }];
    for (let r = 0; r < rondas; r++) {
      const res = pts.map((p, i) => p[1] - pred[i]);
      let mejor = null;
      for (let k = 1; k < pts.length; k++) {
        const izq = res.slice(0, k), der = res.slice(k);
        const mi = izq.reduce((a, b) => a + b, 0) / izq.length, md = der.reduce((a, b) => a + b, 0) / der.length;
        const sse = izq.reduce((a, b) => a + (b - mi) ** 2, 0) + der.reduce((a, b) => a + (b - md) ** 2, 0);
        if (!mejor || sse < mejor.sse) mejor = { sse, k, mi, md };
      }
      for (let i = 0; i < pts.length; i++) pred[i] += lr * (i < mejor.k ? mejor.mi : mejor.md);
      pasos.push({ pred: pred.slice(), corte: (pts[mejor.k - 1][0] + pts[mejor.k][0]) / 2 });
    }
    return pasos;
  }
  const PASOS_BOOST = boostingPasos(BOOST, BOOST_MAX, BOOST_LR);

  function panelBoosting(n) {
    const paso = PASOS_BOOST[n];
    const W = 360, H = 220, m = 34;
    const X = (x) => m + (x / 32) * (W - m - 10), Y = (y) => H - m - (y / 52) * (H - m - 10);
    const rmse = Math.sqrt(BOOST.reduce((a, p, i) => a + (p[1] - paso.pred[i]) ** 2, 0) / BOOST.length);
    // Predicción en escalones: cada punto manda hasta la mitad del camino al siguiente
    let d = "";
    BOOST.forEach(([x], i) => {
      const x1 = i === 0 ? 1 : (BOOST[i - 1][0] + x) / 2, x2 = i === BOOST.length - 1 ? 31 : (x + BOOST[i + 1][0]) / 2;
      d += `${i === 0 ? "M" : "L"}${X(x1)},${Y(paso.pred[i])} L${X(x2)},${Y(paso.pred[i])} `;
    });
    const res = BOOST.map(([x, y], i) => `<line class="residuo" x1="${X(x)}" y1="${Y(y)}" x2="${X(x)}" y2="${Y(paso.pred[i])}"/>`).join("");
    const pts = BOOST.map(([x, y]) => `<circle class="punto" cx="${X(x)}" cy="${Y(y)}" r="4"/>`).join("");
    const corte = paso.corte == null ? "" : `<line class="corte" x1="${X(paso.corte)}" y1="8" x2="${X(paso.corte)}" y2="${H - m}"/>`;
    const texto = n === 0
      ? "Con 0 árboles el modelo predice el promedio para todos. Los residuos (líneas punteadas) son enormes."
      : `El árbol ${n} solo hace un corte (línea vertical) y aprende a corregir los residuos que ${n === 1 ? "dejó el promedio inicial" : `dejaron los ${n - 1} árboles previos`}. Se suma a la predicción multiplicado por la tasa de aprendizaje (${BOOST_LR}).`;
    return `<svg class="dg-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas de helados según temperatura y predicción del boosting con ${n} árboles">
        <line class="eje" x1="${m}" y1="${H - m}" x2="${W - 8}" y2="${H - m}"/>
        <line class="eje" x1="${m}" y1="8" x2="${m}" y2="${H - m}"/>
        ${corte}${res}
        <path class="recta" fill="none" d="${d}"/>
        ${pts}
        <text x="${W / 2}" y="${H - 8}" text-anchor="middle">temperatura (°C)</text>
        <text x="12" y="${H / 2}" text-anchor="middle" transform="rotate(-90 12 ${H / 2})">ventas</text>
      </svg>
      <div class="dg-metricas"><span><strong>Árboles</strong> ${n}</span><span><strong>RMSE</strong> ${rmse.toFixed(2)}</span></div>
      <p class="dg-explica-b">${esc(texto)}</p>`;
  }

  function htmlBoosting() {
    return `<figure class="diagrama" data-diagrama="boosting">
      <label class="dg-umbral">Número de árboles: <strong data-valor>0</strong>
        <input type="range" min="0" max="${BOOST_MAX}" step="1" value="0" aria-label="Número de árboles del boosting">
      </label>
      <div class="dg-panel-b" aria-live="polite">${panelBoosting(0)}</div>
      <figcaption>Mueve el control: cada árbol nuevo es pequeño y torpe por sí solo, pero se enfoca en lo que los anteriores todavía fallan. Con suficientes árboles la escalera sigue la curva; con demasiados empezaría a seguir también el ruido.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // 11. Validación temporal: ventana expansiva o deslizante (interactivo)
  // ---------------------------------------------------------------------------
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const VENTANAS = {
    expansiva: { nombre: "Ventana expansiva", texto: "Cada ronda entrena con todo el pasado disponible y prueba en el mes siguiente. Usa más datos a medida que avanza; es lo habitual cuando el pasado lejano sigue siendo útil." },
    deslizante: { nombre: "Ventana deslizante", texto: "Cada ronda entrena solo con los últimos 6 meses. Sirve cuando el negocio cambia y los datos viejos ya no representan el presente." },
    hueco: { nombre: "Con hueco", texto: "Entre el entrenamiento y la prueba se deja un mes sin usar. Imita la realidad cuando los datos llegan con retraso o predices con un mes de anticipación." },
  };

  function panelTemporal(tipo) {
    const W = 360, x0 = 52, celda = (W - x0 - 4) / 12, fila = 24;
    let h = MESES.map((mes, i) => `<text x="${x0 + i * celda + celda / 2}" y="12" text-anchor="middle">${mes}</text>`).join("");
    for (let r = 0; r < 4; r++) {
      const y = 20 + r * fila, prueba = 8 + r, hueco = tipo === "hueco" ? 1 : 0;
      const fin = prueba - hueco, ini = tipo === "deslizante" ? fin - 6 : 0;
      h += `<text x="0" y="${y + 14}">ronda ${r + 1}</text>`;
      for (let i = 0; i < 12; i++) {
        const cls = i === prueba ? "b-test" : i >= ini && i < fin ? "b-train" : i >= fin && i < prueba ? "b-hueco" : "b-nada";
        h += `<rect x="${x0 + i * celda}" y="${y}" width="${celda - 2}" height="18" class="${cls}"/>`;
      }
    }
    const H = 20 + 4 * fila + 4;
    return `<svg class="dg-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(VENTANAS[tipo].nombre)}: 4 rondas de entrenamiento y prueba ordenadas en el tiempo">${h}</svg>
      <p class="dg-explica-b">${esc(VENTANAS[tipo].texto)}</p>`;
  }

  function htmlTemporal() {
    const botones = Object.entries(VENTANAS).map(([id, v], i) => `<button type="button" class="dg-btn" data-ventana="${id}" aria-pressed="${i === 0}">${esc(v.nombre)}</button>`).join("");
    return `<figure class="diagrama" data-diagrama="validacion-temporal">
      <div class="dg-botones" role="group" aria-label="Tipo de ventana">${botones}</div>
      <div class="dg-panel-t" aria-live="polite">${panelTemporal("expansiva")}</div>
      <div class="dg-leyenda"><span><i class="b-train"></i>entrena</span><span><i class="b-test"></i>prueba</span><span><i class="b-hueco"></i>hueco sin usar</span></div>
      <figcaption>En una serie temporal nunca se valida con datos anteriores a los de entrenamiento: cada ronda prueba siempre en el futuro de lo que vio. Nada de mezclar al azar.</figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------------------
  // Registro
  // ---------------------------------------------------------------------------
  const TIPOS = {
    "indice-arbol-b": htmlArbol,
    "venn-joins": htmlVennJoins,
    regresion: htmlRegresion,
    "matriz-confusion": htmlConfusion,
    "validacion-cruzada": htmlValidacion,
    "ciclo-vida-react": htmlCicloVida,
    "modelo-estrella": htmlEstrella,
    "calculate-contexto": htmlCalculate,
    "etl-elt": htmlEtlElt,
    "dag-airflow": htmlDag,
    "ramas-git": htmlRamas,
    "pipeline-cicd": htmlPipeline,
    boosting: htmlBoosting,
    "validacion-temporal": htmlTemporal,
  };

  function html(spec) {
    const f = spec && TIPOS[spec.type];
    return f ? f(spec) : "";
  }

  function activar(raiz) {
    (raiz || document).querySelectorAll('[data-diagrama="indice-arbol-b"]').forEach((fig) => {
      if (fig.dataset.listo) return;
      fig.dataset.listo = "1";
      fig.addEventListener("click", (e) => {
        const b = e.target.closest("[data-arbol]");
        if (!b) return;
        const m = ARBOL_MODOS.find((x) => x.id === b.dataset.arbol);
        fig.querySelectorAll("[data-arbol]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        fig.querySelector(".dg-panel-arbol").innerHTML = panelArbol(m);
      });
    });
    activarDag(raiz);
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
    (raiz || document).querySelectorAll('[data-diagrama="boosting"]').forEach((fig) => {
      if (fig.dataset.listo) return;
      fig.dataset.listo = "1";
      const inp = fig.querySelector("input[type=range]");
      inp.addEventListener("input", () => {
        const n = Number(inp.value);
        fig.querySelector("[data-valor]").textContent = String(n);
        fig.querySelector(".dg-panel-b").innerHTML = panelBoosting(n);
      });
    });
    (raiz || document).querySelectorAll('[data-diagrama="validacion-temporal"]').forEach((fig) => {
      if (fig.dataset.listo) return;
      fig.dataset.listo = "1";
      fig.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ventana]");
        if (!b) return;
        fig.querySelectorAll("[data-ventana]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        fig.querySelector(".dg-panel-t").innerHTML = panelTemporal(b.dataset.ventana);
      });
    });
  }

  function activarDag(raiz) {
    (raiz || document).querySelectorAll('[data-diagrama="dag-airflow"]').forEach((fig) => {
      if (fig.dataset.listo) return;
      fig.dataset.listo = "1";
      const n = fig.dataset.n;
      fig.addEventListener("click", (e) => {
        const b = e.target.closest("[data-esc]");
        if (!b) return;
        const esc_ = DAG_ESC.find((x) => x.id === b.dataset.esc);
        fig.querySelectorAll("[data-esc]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        fig.querySelector(".dg-panel-dag").innerHTML = `${svgDag(esc_.falla, `dg-punta-dag-${n}`)}<p class="dg-dag-texto">${esc(esc_.texto)}</p>`;
      });
    });
    (raiz || document).querySelectorAll('[data-diagrama="ramas-git"]').forEach((fig) => {
      if (fig.dataset.listo) return;
      fig.dataset.listo = "1";
      fig.addEventListener("click", (e) => {
        const b = e.target.closest("[data-modo]");
        if (!b) return;
        const m = MODOS_RAMAS.find((x) => x.id === b.dataset.modo);
        fig.querySelectorAll("[data-modo]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        fig.querySelector(".dg-panel").innerHTML = panelRamas(m);
      });
    });
    (raiz || document).querySelectorAll('[data-diagrama="pipeline-cicd"]').forEach((fig) => {
      if (fig.dataset.listo) return;
      fig.dataset.listo = "1";
      fig.addEventListener("click", (e) => {
        const b = e.target.closest("[data-etapa]");
        if (!b) return;
        const et = ETAPAS_PIPELINE.find((x) => x.id === b.dataset.etapa);
        fig.querySelectorAll("[data-etapa]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        fig.querySelector(".dg-panel-p").innerHTML = panelPipeline(et);
      });
    });
  }

  window.Diagramas = { html, activar, ESTRELLA, estadoEstrella, CALC, svgVenn, JOINS, filasJoin, ajusteLineal, REG, CLIENTES_CHURN, boostingPasos, BOOST };
})();
