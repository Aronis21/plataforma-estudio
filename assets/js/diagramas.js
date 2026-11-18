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
  // Registro
  // ---------------------------------------------------------------------------
  const TIPOS = { "venn-joins": htmlVennJoins };

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
  }

  window.Diagramas = { html, activar, svgVenn, JOINS, filasJoin };
})();
