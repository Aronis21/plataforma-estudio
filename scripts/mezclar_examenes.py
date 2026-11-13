"""Reordena las opciones de cada examen para que la respuesta correcta quede
repartida de forma equilibrada entre A, B, C y D. Determinista (semilla fija).
Uso: python scripts/mezclar_examenes.py cursos/mi-curso.json   (sobrescribe el archivo)
     python scripts/mezclar_examenes.py entrada.json salida.json
"""
import json
import random
import sys
from collections import Counter

SEED = 20261112


def main(src, dst):
    data = json.load(open(src, encoding="utf-8"))
    rng = random.Random(SEED)
    questions = [q for c in data["chapters"] for q in c["exam"]]
    for q in questions:
        bad = [o for o in q["options"] if "anteriores" in o.lower() or "ninguna de" in o.lower()]
        assert not bad, f"{q['id']} tiene opciones que dependen de la posición: {bad}"

    # Posiciones objetivo equilibradas, luego mezcladas
    targets = []
    for q in questions:
        targets.append(len(targets) % len(q["options"]))
    rng.shuffle(targets)

    for q, target in zip(questions, targets):
        n = len(q["options"])
        target %= n
        correct = q["options"][q["correctIndex"]]
        others = [o for i, o in enumerate(q["options"]) if i != q["correctIndex"]]
        rng.shuffle(others)
        new_opts = others[:target] + [correct] + others[target:]
        q["options"] = new_opts
        q["correctIndex"] = target
        assert q["options"][q["correctIndex"]] == correct

    print("Distribución de la respuesta correcta:", dict(sorted(Counter(q["correctIndex"] for q in questions).items())))
    json.dump(data, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else sys.argv[1])
