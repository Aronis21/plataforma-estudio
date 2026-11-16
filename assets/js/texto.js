/* Formato de texto ligero para el contenido de los cursos.
 * Soporta: **negrita**, *cursiva*, `código`, párrafos separados por línea en blanco,
 * listas con "- " y listas numeradas con "1) " o "1. ".
 */
(function () {
  function escapar(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Formato en línea (el texto ya viene escapado por dentro)
  function enLinea(s) {
    // 1) Se apartan los fragmentos de `código` para que su contenido (p. ej. fct_*) no se tome como formato.
    const codigos = [];
    let t = escapar(s).replace(/`([^`]+)`/g, (_, c) => {
      codigos.push(c);
      return `\u0000${codigos.length - 1}\u0000`;
    });
    // 2) Negrita y cursiva (la negrita puede contener código).
    t = t
      .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,:;!?]|$)/g, "$1<em>$2</em>");
    // 3) Se devuelven los fragmentos de código.
    return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codigos[+i]}</code>`);
  }

  // Bloques: párrafos y listas
  function bloques(s) {
    const lineas = String(s ?? "").split("\n");
    let html = "";
    let lista = null; // 'ul' | 'ol'
    let parrafo = [];

    const cerrarParrafo = () => {
      if (parrafo.length) {
        html += `<p>${parrafo.map(enLinea).join("<br>")}</p>`;
        parrafo = [];
      }
    };
    const cerrarLista = () => {
      if (lista) {
        html += `</${lista}>`;
        lista = null;
      }
    };

    for (const linea of lineas) {
      const t = linea.trim();
      const ul = t.match(/^[-•]\s+(.*)$/);
      const ol = t.match(/^\d+[).]\s+(.*)$/);
      if (!t) {
        cerrarParrafo();
        cerrarLista();
      } else if (ul || ol) {
        cerrarParrafo();
        const tipo = ul ? "ul" : "ol";
        if (lista !== tipo) {
          cerrarLista();
          html += `<${tipo}>`;
          lista = tipo;
        }
        html += `<li>${enLinea((ul || ol)[1])}</li>`;
      } else {
        cerrarLista();
        parrafo.push(t);
      }
    }
    cerrarParrafo();
    cerrarLista();
    return html;
  }

  const NOMBRES_LENGUAJE = { sql: "SQL", python: "Python", yaml: "YAML", bash: "Bash", markdown: "Markdown" };

  function bloqueCodigo(codigo, lenguaje) {
    if (!codigo) return "";
    const leng = (lenguaje || "").toLowerCase();
    let cuerpo = escapar(codigo);
    if (window.hljs && leng && window.hljs.getLanguage(leng)) {
      try {
        cuerpo = window.hljs.highlight(codigo, { language: leng, ignoreIllegals: true }).value;
      } catch (_) { /* se queda sin resaltar */ }
    }
    const etiqueta = NOMBRES_LENGUAJE[leng] || leng || "código";
    return `<div class="code">
      <div class="code-head"><span>${escapar(etiqueta)}</span><button class="copy-btn" type="button">Copiar</button></div>
      <pre><code class="hljs">${cuerpo}</code></pre>
    </div>`;
  }

  window.Texto = { escapar, enLinea, bloques, bloqueCodigo };
})();
