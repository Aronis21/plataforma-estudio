"""Valida que los cursos en cursos/ cumplan el formato que espera la plataforma.

Uso:  python scripts/validar_cursos.py
Sale con código 1 si encuentra errores (así GitHub Actions marca el commit en rojo).
"""
import ast
import json
import sys
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CURSOS = RAIZ / "cursos"

errores: list[str] = []
avisos: list[str] = []


def err(msg):
    errores.append(msg)


def aviso(msg):
    avisos.append(msg)


def validar_curso(entrada: dict):
    ruta = CURSOS / entrada["archivo"]
    if not ruta.exists():
        err(f"[catalogo] {entrada['id']}: no existe el archivo {ruta.name}")
        return
    try:
        curso = json.loads(ruta.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        err(f"[{ruta.name}] JSON inválido: {e}")
        return

    pref = f"[{ruta.name}]"
    if curso.get("id") != entrada["id"]:
        err(f"{pref} el 'id' del curso ({curso.get('id')}) no coincide con el del catálogo ({entrada['id']})")
    for campo in ("title", "chapters"):
        if campo not in curso:
            err(f"{pref} falta el campo obligatorio '{campo}'")
    caps = curso.get("chapters", [])
    if not caps:
        err(f"{pref} el curso no tiene capítulos")

    ids = Counter()
    posiciones = Counter()
    for cap in caps:
        cid = cap.get("id", "?")
        p = f"{pref} {cid}:"
        for campo in ("id", "title", "order"):
            if campo not in cap:
                err(f"{p} falta '{campo}'")
        ids[cid] += 1
        for s in cap.get("theorySections", []):
            ids[s.get("id")] += 1
            revisar_codigo(p + " " + str(s.get("id")), s.get("codeSnippet"), s.get("codeLanguage"))
        if est := cap.get("professionalStandard"):
            revisar_codigo(p + " estándar", est.get("referenceCode"), est.get("codeLanguage"))
        if cmp_ := cap.get("comparison"):
            revisar_codigo(p + " junior", cmp_.get("juniorCode"), cmp_.get("codeLanguage"))
            revisar_codigo(p + " intermedio", cmp_.get("intermediateCode"), cmp_.get("codeLanguage"))
        for e in cap.get("exercises", []):
            ids[e.get("id")] += 1
            if not e.get("prompt"):
                err(f"{p} ejercicio {e.get('id')} sin 'prompt'")
            revisar_codigo(f"{p} {e.get('id')}", e.get("solutionCode"), e.get("codeLanguage"))
        for q in cap.get("exam", []):
            qid = q.get("id")
            ids[qid] += 1
            opts = q.get("options", [])
            ci = q.get("correctIndex")
            if len(opts) < 2:
                err(f"{p} pregunta {qid} tiene menos de 2 opciones")
            if not isinstance(ci, int) or not 0 <= ci < len(opts):
                err(f"{p} pregunta {qid}: correctIndex fuera de rango")
            else:
                posiciones[ci] += 1
            if len(set(opts)) != len(opts):
                err(f"{p} pregunta {qid}: opciones repetidas")

    for i, n in ids.items():
        if i and n > 1:
            err(f"{pref} id repetido: {i}")

    total = sum(posiciones.values())
    if total >= 8:
        mayor = max(posiciones.values())
        if mayor / total > 0.5:
            aviso(f"{pref} la respuesta correcta está en la misma posición en {mayor}/{total} preguntas. "
                  f"Ejecuta scripts/mezclar_examenes.py (la web ya mezcla al mostrar, pero conviene equilibrar el archivo).")
    print(f"✓ {curso.get('title')}: {len(caps)} capítulos, {total} preguntas")


def revisar_codigo(donde, codigo, lenguaje):
    if codigo and lenguaje == "python":
        try:
            ast.parse(codigo)
        except SyntaxError as e:
            err(f"{donde}: error de sintaxis Python en línea {e.lineno}: {e.msg}")


def main():
    cat_ruta = CURSOS / "catalogo.json"
    try:
        catalogo = json.loads(cat_ruta.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"✗ cursos/catalogo.json no se pudo leer: {e}")
        sys.exit(1)
    vistos = set()
    for entrada in catalogo.get("cursos", []):
        for campo in ("id", "archivo"):
            if campo not in entrada:
                err(f"[catalogo] una entrada no tiene '{campo}': {entrada}")
        if entrada.get("id") in vistos:
            err(f"[catalogo] id de curso repetido: {entrada.get('id')}")
        vistos.add(entrada.get("id"))
        if "archivo" in entrada and "id" in entrada:
            validar_curso(entrada)

    for a in avisos:
        print("⚠", a)
    for e in errores:
        print("✗", e)
    if errores:
        print(f"\n{len(errores)} error(es).")
        sys.exit(1)
    print("\nTodo correcto.")


if __name__ == "__main__":
    main()
