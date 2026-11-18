/* NEXUS · Capa de compatibilidad T-SQL (SQL Server) sobre SQLite (sql.js).
 *
 * El navegador no puede ejecutar SQL Server, así que la consola traduce lo más usado de
 * T-SQL a SQLite antes de ejecutarlo y agrega las funciones de SQL Server que faltan.
 *
 *   TSQL.registrar(db)     agrega a la base las funciones LEN, CHARINDEX, DATEDIFF, FORMAT…
 *   TSQL.traducir(sql)     → { sql, avisos }   T-SQL → SQLite
 *   TSQL.noEsTSQL(sql)     → [mensajes]        sintaxis que funcionaría aquí pero no en SQL Server
 *   TSQL.explicarError(mensaje, sql) → texto con una pista en español
 *
 * Cubre: TOP (n), OFFSET … FETCH, ISNULL, IIF, LEN, CHARINDEX, LEFT/RIGHT, CONCAT, + para unir
 * textos, STRING_AGG … WITHIN GROUP, GETDATE, DATEDIFF, DATEADD, DATEPART, DATENAME, DATETRUNC,
 * YEAR/MONTH/DAY, EOMONTH, DATEFROMPARTS, FORMAT, CAST/CONVERT/TRY_CAST, N'texto', [corchetes], GO.
 * No cubre: variables (@x), DECLARE, procedimientos, tablas temporales (#t), MERGE, PIVOT.
 */
(function () {
  // ---------------------------------------------------------------- utilidades de fechas
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  function aFecha(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
    d._conHora = !!m[4];
    return d;
  }
  function texto(d, conHora) {
    const f = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return conHora ? `${f} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` : f;
  }
  const PARTES = {
    year: "year", yy: "year", yyyy: "year",
    quarter: "quarter", qq: "quarter", q: "quarter",
    month: "month", mm: "month", m: "month",
    dayofyear: "dayofyear", dy: "dayofyear", y: "dayofyear",
    day: "day", dd: "day", d: "day",
    week: "week", wk: "week", ww: "week",
    weekday: "weekday", dw: "weekday", w: "weekday",
    hour: "hour", hh: "hour",
    minute: "minute", mi: "minute", n: "minute",
    second: "second", ss: "second", s: "second",
  };
  function parte(p) {
    const x = PARTES[String(p).toLowerCase()];
    if (!x) throw new Error(`Parte de fecha no válida: ${p}`);
    return x;
  }
  const DIA = 86400000;
  const soloDia = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

  function datediff(p, a, b) {
    const x = aFecha(a), y = aFecha(b);
    if (!x || !y) return null;
    switch (parte(p)) {
      case "year": return y.getUTCFullYear() - x.getUTCFullYear();
      case "quarter": return (y.getUTCFullYear() * 4 + Math.floor(y.getUTCMonth() / 3)) - (x.getUTCFullYear() * 4 + Math.floor(x.getUTCMonth() / 3));
      case "month": return (y.getUTCFullYear() * 12 + y.getUTCMonth()) - (x.getUTCFullYear() * 12 + x.getUTCMonth());
      case "day": case "dayofyear": case "weekday": return Math.round((soloDia(y) - soloDia(x)) / DIA);
      case "week": return Math.round(((soloDia(y) - y.getUTCDay() * DIA) - (soloDia(x) - x.getUTCDay() * DIA)) / (7 * DIA));
      case "hour": return Math.floor(y.getTime() / 3600000) - Math.floor(x.getTime() / 3600000);
      case "minute": return Math.floor(y.getTime() / 60000) - Math.floor(x.getTime() / 60000);
      case "second": return Math.floor(y.getTime() / 1000) - Math.floor(x.getTime() / 1000);
    }
    return null;
  }
  function dateadd(p, n, v) {
    const d = aFecha(v);
    if (!d || n === null) return null;
    n = Math.trunc(Number(n));
    const r = new Date(d.getTime());
    const sumarMeses = (k) => {
      const dia = r.getUTCDate();
      r.setUTCDate(1);
      r.setUTCMonth(r.getUTCMonth() + k);
      const ultimo = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
      r.setUTCDate(Math.min(dia, ultimo));
    };
    switch (parte(p)) {
      case "year": sumarMeses(12 * n); break;
      case "quarter": sumarMeses(3 * n); break;
      case "month": sumarMeses(n); break;
      case "week": r.setTime(r.getTime() + 7 * n * DIA); break;
      case "hour": r.setTime(r.getTime() + n * 3600000); break;
      case "minute": r.setTime(r.getTime() + n * 60000); break;
      case "second": r.setTime(r.getTime() + n * 1000); break;
      default: r.setTime(r.getTime() + n * DIA);
    }
    const conHora = d._conHora || ["hour", "minute", "second"].includes(parte(p));
    return texto(r, conHora);
  }
  function semanaDelAnio(d) {
    const ini = Date.UTC(d.getUTCFullYear(), 0, 1);
    const dowIni = new Date(ini).getUTCDay();
    return Math.floor((Math.round((soloDia(d) - ini) / DIA) + dowIni) / 7) + 1;
  }
  function datepart(p, v) {
    const d = aFecha(v);
    if (!d) return null;
    switch (parte(p)) {
      case "year": return d.getUTCFullYear();
      case "quarter": return Math.floor(d.getUTCMonth() / 3) + 1;
      case "month": return d.getUTCMonth() + 1;
      case "dayofyear": return Math.round((soloDia(d) - Date.UTC(d.getUTCFullYear(), 0, 1)) / DIA) + 1;
      case "day": return d.getUTCDate();
      case "week": return semanaDelAnio(d);
      case "weekday": return d.getUTCDay() + 1; // domingo = 1, como SQL Server en inglés
      case "hour": return d.getUTCHours();
      case "minute": return d.getUTCMinutes();
      case "second": return d.getUTCSeconds();
    }
    return null;
  }
  const MESES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DIAS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function datename(p, v) {
    const d = aFecha(v);
    if (!d) return null;
    const x = parte(p);
    if (x === "month") return MESES[d.getUTCMonth()];
    if (x === "weekday") return DIAS[d.getUTCDay()];
    return String(datepart(p, v));
  }
  function datetrunc(p, v) {
    const d = aFecha(v);
    if (!d) return null;
    const x = parte(p);
    let r;
    if (x === "year") r = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    else if (x === "quarter") r = new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1));
    else if (x === "month") r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    else if (x === "week") r = new Date(soloDia(d) - d.getUTCDay() * DIA);
    else if (x === "hour") r = new Date(Math.floor(d.getTime() / 3600000) * 3600000);
    else if (x === "minute") r = new Date(Math.floor(d.getTime() / 60000) * 60000);
    else r = new Date(soloDia(d));
    return texto(r, d._conHora);
  }
  function eomonth(v, k) {
    const d = aFecha(v);
    if (!d) return null;
    return texto(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1 + (Number(k) || 0), 0)), false);
  }
  function ahora() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // FORMAT(valor, formato): fechas (yyyy, MM, dd, HH, mm, ss, MMMM, MMM, ddd, dddd) y números (N2, C, P1, 0.00, #,##0)
  function formato(v, f) {
    if (v === null || v === undefined || f === null) return null;
    f = String(f);
    const d = typeof v === "string" ? aFecha(v) : null;
    if (d) {
      return f.replace(/yyyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|mm|ss/g, (t) => ({
        yyyy: d.getUTCFullYear(), yy: pad(d.getUTCFullYear() % 100), MMMM: MESES[d.getUTCMonth()], MMM: MESES[d.getUTCMonth()].slice(0, 3),
        MM: pad(d.getUTCMonth() + 1), M: d.getUTCMonth() + 1, dddd: DIAS[d.getUTCDay()], ddd: DIAS[d.getUTCDay()].slice(0, 3),
        dd: pad(d.getUTCDate()), d: d.getUTCDate(), HH: pad(d.getUTCHours()), H: d.getUTCHours(), hh: pad(d.getUTCHours() % 12 || 12),
        mm: pad(d.getUTCMinutes()), ss: pad(d.getUTCSeconds()),
      })[t]);
    }
    const n = Number(v);
    if (isNaN(n)) return String(v);
    const conDec = (x, dec, grupos) => x.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: grupos });
    let m;
    if ((m = f.match(/^[Nn](\d*)$/))) return conDec(n, m[1] === "" ? 2 : +m[1], true);
    if ((m = f.match(/^[Ff](\d*)$/))) return conDec(n, m[1] === "" ? 2 : +m[1], false);
    if ((m = f.match(/^[Cc](\d*)$/))) return (n < 0 ? "-$" : "$") + conDec(Math.abs(n), m[1] === "" ? 2 : +m[1], true);
    if ((m = f.match(/^[Pp](\d*)$/))) return conDec(n * 100, m[1] === "" ? 2 : +m[1], true) + "%";
    if ((m = f.match(/^[Dd](\d*)$/))) return String(Math.trunc(n)).padStart(+m[1] || 0, "0");
    if (/^[#0,]*(\.[0#]+)?%?$/.test(f)) {
      const dec = (f.split(".")[1] || "").replace("%", "").length;
      const pct = f.endsWith("%");
      return conDec(pct ? n * 100 : n, dec, f.includes(",")) + (pct ? "%" : "");
    }
    return String(v);
  }

  // ---------------------------------------------------------------- funciones en la base
  function registrar(db) {
    // sql.js fija el número de argumentos con fn.length: las funciones con argumentos
    // opcionales se registran una vez por cada cantidad posible.
    const ARIDADES = { CHARINDEX: [2, 3], EOMONTH: [1, 2], FORMAT: [2, 3] };
    const envolver = [(fn) => () => fn(), (fn) => (a) => fn(a), (fn) => (a, b) => fn(a, b), (fn) => (a, b, c) => fn(a, b, c)];
    const f = (nombre, fn) => {
      for (const n of ARIDADES[nombre] || [fn.length]) db.create_function(nombre, envolver[n](fn));
    };
    f("LEN", (s) => (s === null || s === undefined ? null : String(s).replace(/ +$/, "").length));
    f("DATALENGTH", (s) => (s === null || s === undefined ? null : String(s).length));
    f("CHARINDEX", (sub, s, ini) => {
      if (sub === null || s === null || sub === undefined || s === undefined) return null;
      const i = String(s).toLowerCase().indexOf(String(sub).toLowerCase(), Math.max(0, (Number(ini) || 1) - 1));
      return i + 1;
    });
    f("REPLICATE", (s, n) => (s === null || n === null ? null : String(s).repeat(Math.max(0, Number(n)))));
    f("REVERSE", (s) => (s === null ? null : [...String(s)].reverse().join("")));
    f("SQUARE", (x) => (x === null ? null : x * x));
    f("GETDATE", ahora);
    f("SYSDATETIME", ahora);
    f("GETUTCDATE", () => new Date().toISOString().slice(0, 19).replace("T", " "));
    f("T_DATEDIFF", datediff);
    f("T_DATEADD", dateadd);
    f("T_DATEPART", datepart);
    f("T_DATENAME", datename);
    f("T_DATETRUNC", datetrunc);
    f("YEAR", (v) => datepart("year", v));
    f("MONTH", (v) => datepart("month", v));
    f("DAY", (v) => datepart("day", v));
    f("EOMONTH", eomonth);
    f("DATEFROMPARTS", (y, m, d) => (y === null || m === null || d === null ? null : texto(new Date(Date.UTC(y, m - 1, d)), false)));
    f("FORMAT", formato);
    f("T_LEFT", (s, n) => (s === null || n === null ? null : String(s).slice(0, Math.max(0, n))));
    f("T_RIGHT", (s, n) => (s === null || n === null ? null : n <= 0 ? "" : String(s).slice(-n)));
    return db;
  }

  // ---------------------------------------------------------------- traducción
  // Separa textos ('...'), identificadores ([...] y "...") y comentarios para no tocarlos.
  function enmascarar(sql) {
    const guardados = [];
    let out = "";
    let i = 0;
    while (i < sql.length) {
      const c = sql[i];
      if (c === "-" && sql[i + 1] === "-") { const fin = sql.indexOf("\n", i); i = fin === -1 ? sql.length : fin; continue; }
      if (c === "/" && sql[i + 1] === "*") { const fin = sql.indexOf("*/", i + 2); i = fin === -1 ? sql.length : fin + 2; out += " "; continue; }
      if (c === "'" || ((c === "N" || c === "n") && sql[i + 1] === "'" && !/[\w\]]/.test(sql[i - 1] || ""))) {
        let j = c === "'" ? i + 1 : i + 2;
        let s = "'";
        while (j < sql.length) {
          if (sql[j] === "'" && sql[j + 1] === "'") { s += "''"; j += 2; continue; }
          if (sql[j] === "'") break;
          s += sql[j++];
        }
        s += "'";
        guardados.push({ tipo: "texto", valor: s });
        out += `\u0001${guardados.length - 1}\u0001`;
        i = j + 1;
        continue;
      }
      if (c === "[" || c === '"') {
        const cierre = c === "[" ? "]" : '"';
        const fin = sql.indexOf(cierre, i + 1);
        const fragmento = sql.slice(i, fin === -1 ? sql.length : fin + 1);
        guardados.push({ tipo: "id", valor: c === "[" ? fragmento : fragmento });
        out += `\u0002${guardados.length - 1}\u0002`;
        i = fin === -1 ? sql.length : fin + 1;
        continue;
      }
      out += c;
      i++;
    }
    return { texto: out, guardados };
  }
  const desenmascarar = (t, g) => t.replace(/[\u0001\u0002](\d+)[\u0001\u0002]/g, (_, n) => g[+n].valor);

  // Busca llamadas NOMBRE( … ) con paréntesis balanceados y deja reemplazarlas
  function reemplazarLlamadas(t, nombreRe, fn) {
    const re = new RegExp(`\\b(${nombreRe})\\s*\\(`, "gi");
    let m, salida = "", ultimo = 0;
    while ((m = re.exec(t))) {
      const ini = m.index;
      let j = re.lastIndex, prof = 1;
      while (j < t.length && prof) { if (t[j] === "(") prof++; else if (t[j] === ")") prof--; j++; }
      if (prof) break;
      const dentro = t.slice(re.lastIndex, j - 1);
      const r = fn(m[1], dentro, t.slice(j));
      salida += t.slice(ultimo, ini) + r.texto;
      ultimo = j + (r.consumir || 0);
      re.lastIndex = ultimo;
    }
    return salida + t.slice(ultimo);
  }
  function partirArgs(s) {
    const args = [];
    let prof = 0, actual = "";
    for (const c of s) {
      if (c === "(") prof++;
      if (c === ")") prof--;
      if (c === "," && prof === 0) { args.push(actual); actual = ""; continue; }
      actual += c;
    }
    args.push(actual);
    return args.map((a) => a.trim());
  }
  // Último " AS " al nivel superior de un CAST
  function partirAs(s) {
    let prof = 0;
    for (let i = s.length - 1; i >= 0; i--) {
      const c = s[i];
      if (c === ")") prof++;
      if (c === "(") prof--;
      if (prof === 0 && /\sAS\s/i.test(s.slice(i - 1, i + 3)) && /^AS\s/i.test(s.slice(i, i + 3))) return [s.slice(0, i - 1), s.slice(i + 3)];
    }
    return null;
  }
  function castA(expr, tipo) {
    const t = tipo.trim().toLowerCase();
    if (/^date$/.test(t)) return `date(${expr})`;
    if (/^(datetime2?|smalldatetime|datetimeoffset)(\s*\(\s*\d+\s*\))?$/.test(t)) return `datetime(${expr})`;
    const largo = t.match(/^n?(?:var)?char\s*\(\s*(\d+)\s*\)$/);
    if (largo) return `substr(CAST(${expr} AS TEXT), 1, ${largo[1]})`;
    if (/^(n?varchar|n?char|n?text|sysname)/.test(t)) return `CAST(${expr} AS TEXT)`;
    if (/^(int|bigint|smallint|tinyint|bit)$/.test(t)) return `CAST(${expr} AS INTEGER)`;
    const dec = t.match(/^(decimal|numeric)\s*\(\s*\d+\s*,\s*(\d+)\s*\)$/);
    if (dec) return `ROUND(CAST(${expr} AS REAL), ${dec[2]})`;
    if (/^(decimal|numeric|float|real|money|smallmoney)/.test(t)) return `CAST(${expr} AS REAL)`;
    return `CAST(${expr} AS ${tipo})`;
  }

  function traducir(sql) {
    const avisos = [];
    const { texto: t0, guardados } = enmascarar(sql);
    let t = t0.replace(/^\s*GO\s*;?\s*$/gim, "");

    // ISNULL(a, b) → COALESCE(a, b); COUNT_BIG → COUNT; CEILING → CEIL
    t = t.replace(/\bISNULL\s*\(/gi, "COALESCE(").replace(/\bCOUNT_BIG\s*\(/gi, "COUNT(").replace(/\bCEILING\s*\(/gi, "CEIL(");
    t = t.replace(/\bLEFT\s*\(/gi, "T_LEFT(").replace(/\bRIGHT\s*\(/gi, "T_RIGHT(");
    // DATEDIFF(day, a, b) → T_DATEDIFF('day', a, b)  (la parte de la fecha va sin comillas en T-SQL)
    t = t.replace(/\b(DATEDIFF_BIG|DATEDIFF|DATEADD|DATEPART|DATENAME|DATETRUNC)\s*\(\s*(\w+)\s*,/gi, (_, f, p) => `T_${f.toUpperCase().replace("_BIG", "")}('${p}',`);
    // CONVERT(tipo, expr[, estilo]) → CAST(expr AS tipo)
    t = reemplazarLlamadas(t, "TRY_CONVERT|CONVERT", (_, dentro) => {
      const [tipo, expr] = partirArgs(dentro);
      return { texto: `CAST(${expr} AS ${tipo})` };
    });
    // CAST / TRY_CAST con tipos de SQL Server
    t = reemplazarLlamadas(t, "TRY_CAST|CAST", (_, dentro) => {
      const p = partirAs(dentro);
      if (!p) return { texto: `CAST(${dentro})` };
      return { texto: castA(p[0], p[1]) };
    });
    // STRING_AGG(x, sep) WITHIN GROUP (ORDER BY …) → string_agg(x, sep ORDER BY …)
    t = reemplazarLlamadas(t, "STRING_AGG", (_, dentro, resto) => {
      const m = resto.match(/^\s*WITHIN\s+GROUP\s*\(\s*(ORDER\s+BY[^()]*(?:\([^()]*\)[^()]*)*)\)/i);
      if (m) return { texto: `string_agg(${dentro} ${m[1].trim()})`, consumir: m[0].length };
      return { texto: `string_agg(${dentro})` };
    });
    // OFFSET n ROWS FETCH NEXT m ROWS ONLY → LIMIT m OFFSET n
    t = t.replace(/\bOFFSET\s+(\d+)\s+ROWS?\s+FETCH\s+(?:NEXT|FIRST)\s+(\d+)\s+ROWS?\s+ONLY\b/gi, "LIMIT $2 OFFSET $1");
    t = t.replace(/\bOFFSET\s+(\d+)\s+ROWS?\b/gi, "LIMIT -1 OFFSET $1");
    // SELECT TOP (n) … → SELECT … LIMIT n  (al final de esa consulta o subconsulta)
    const reTop = /\bSELECT(\s+(?:DISTINCT|ALL)\b)?\s+TOP\s*(?:\(\s*(\d+)\s*\)|(\d+))(\s+PERCENT)?(\s+WITH\s+TIES)?/i;
    let m, vueltas = 0;
    while ((m = reTop.exec(t)) && vueltas++ < 50) {
      const n = m[2] || m[3];
      if (m[4]) avisos.push("TOP … PERCENT no está disponible aquí: se tomaron las primeras filas como número.");
      if (m[5]) avisos.push("WITH TIES no está disponible aquí: no se incluyen los empates del último lugar.");
      const ini = m.index;
      const finSel = ini + m[0].length;
      let j = finSel, prof = 0;
      while (j < t.length) {
        const c = t[j];
        if (c === "(") prof++;
        else if (c === ")") { if (prof === 0) break; prof--; }
        else if (c === ";" && prof === 0) break;
        j++;
      }
      let cuerpo = t.slice(finSel, j);
      const fin = cuerpo.match(/\s*$/)[0];
      cuerpo = cuerpo.slice(0, cuerpo.length - fin.length);
      t = t.slice(0, ini) + `SELECT${m[1] || ""}` + cuerpo + ` LIMIT ${n}` + fin + t.slice(j);
    }
    // 'texto' + algo → 'texto' || algo  (en T-SQL + une textos)
    t = t.replace(/(\u0001\d+\u0001)\s*\+/g, "$1 ||").replace(/\+\s*(\u0001\d+\u0001)/g, "|| $1");
    return { sql: desenmascarar(t, guardados), avisos };
  }

  // ---------------------------------------------------------------- dialecto
  const NO_TSQL = [
    [/\bLIMIT\b/i, "LIMIT no existe en T-SQL: usa SELECT TOP (n) … o ORDER BY … OFFSET … FETCH."],
    [/\|\|/, "En T-SQL los textos se unen con + o con CONCAT(), no con ||."],
    [/\bstrftime\s*\(/i, "strftime() es de SQLite: en T-SQL usa FORMAT(fecha, 'yyyy-MM'), YEAR(), MONTH() o DATEPART()."],
    [/\bjulianday\s*\(/i, "julianday() es de SQLite: en T-SQL usa DATEDIFF(day, inicio, fin)."],
    [/\bdatetime\s*\(/i, "datetime() es de SQLite: en T-SQL usa CAST(x AS DATETIME)."],
    [/\bdate\s*\(/i, "En T-SQL no existe DATE(): usa CAST(x AS DATE)."],
    [/::/, "El operador :: es de PostgreSQL: en T-SQL usa CAST(x AS tipo)."],
    [/\bILIKE\b/i, "ILIKE es de PostgreSQL: en SQL Server LIKE normalmente ya no distingue mayúsculas."],
    [/\bNOW\s*\(/i, "NOW() no existe en T-SQL: usa GETDATE()."],
    [/\bDATE_TRUNC\s*\(/i, "DATE_TRUNC es de PostgreSQL: en T-SQL usa DATETRUNC(month, fecha) o DATEFROMPARTS(YEAR(f), MONTH(f), 1)."],
    [/\bINTERVAL\b/i, "INTERVAL no existe en T-SQL: usa DATEADD(day, n, fecha)."],
    [/\bIFNULL\s*\(/i, "IFNULL() no existe en T-SQL: usa ISNULL(x, valor) o COALESCE()."],
    [/\bsubstr\s*\(/i, "substr() no existe en T-SQL: usa SUBSTRING(texto, inicio, largo)."],
    [/\blength\s*\(/i, "length() no existe en T-SQL: usa LEN()."],
    [/\bgroup_concat\s*\(/i, "group_concat() es de SQLite: en T-SQL usa STRING_AGG(col, ', ')."],
    [/\binstr\s*\(/i, "instr() no existe en T-SQL: usa CHARINDEX(buscado, texto)."],
    [/\bprintf\s*\(/i, "printf() no existe en T-SQL: usa FORMAT() o CONCAT()."],
    [/\b(TRUE|FALSE)\b/i, "T-SQL no tiene TRUE/FALSE: usa 1 y 0 (tipo BIT)."],
    [/\bRANDOM\s*\(/i, "RANDOM() no existe en T-SQL: usa NEWID() o RAND()."],
  ];
  function noEsTSQL(sql) {
    const { texto: t } = enmascarar(sql);
    return NO_TSQL.filter(([re]) => re.test(t)).map(([, msg]) => msg);
  }

  function explicarError(msg, sql) {
    const m = String(msg || "");
    const { texto: t } = enmascarar(sql || "");
    if (/@\w/.test(t) || /\bDECLARE\b/i.test(t)) return "Las variables (@x) y DECLARE no están disponibles en esta consola. Escribe el valor directamente en la consulta.";
    if (/#\w/.test(t)) return "Las tablas temporales (#tabla) no están disponibles en esta consola. Usa un CTE (WITH … AS (…)).";
    let x;
    if ((x = m.match(/no such function: (\w+)/i))) return `La función ${x[1].replace(/^T_/, "")} no existe en T-SQL o no está disponible en esta consola. Revisa la ayuda de equivalencias.`;
    if ((x = m.match(/no such column: ([\w.]+)/i))) return `No existe la columna ${x[1]}. Revisa el nombre en las tablas de la derecha (o el alias de la tabla).`;
    if ((x = m.match(/no such table: (\w+)/i))) return `No existe la tabla ${x[1]}. Revisa el nombre en la lista de tablas.`;
    if (/misuse of aggregate/i.test(m)) return "Usaste una función de agregación (SUM, COUNT…) donde no se puede, por ejemplo dentro de WHERE. Para filtrar grupos usa HAVING.";
    if (/Parte de fecha no válida/i.test(m)) return m + ". Usa year, quarter, month, week, day, hour, minute o second.";
    if (/syntax error/i.test(m)) return `Error de sintaxis (${m.replace(/^.*?near/i, "cerca de")}). Revisa comas, paréntesis y palabras clave.`;
    return m;
  }

  window.TSQL = { registrar, traducir, noEsTSQL, explicarError, _f: { datediff, dateadd, datepart, formato, eomonth, datetrunc } };
})();
