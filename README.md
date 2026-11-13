# Plataforma de Estudio

Mi plataforma personal para estudiar cursos por mi cuenta: teoría, ejercicios con pista y solución, y exámenes con puntuación y seguimiento de progreso.

**Web:** https://aronis21.github.io/plataforma-estudio/

## Cursos

| Curso | Lecciones | Nivel |
|---|---|---|
| Analista de Datos Intermedio | 27 capítulos + 3 apéndices | Intermedio |

## Qué tiene

- Catálogo de cursos con porcentaje de avance.
- Índice por módulos con estado de cada lección (pendiente, leída, aprobada).
- Pestañas por lección: teoría, estándar profesional, comparación junior vs. intermedio, ejercicios y examen.
- Exámenes calificados con explicación por pregunta; las opciones cambian de orden en cada intento. Se aprueba con 70%.
- El progreso se guarda en el navegador y se puede exportar/importar para pasarlo a otro dispositivo.
- Modo oscuro automático y diseño adaptado al celular.

## Estructura

```
index.html                  Página única
assets/css/styles.css       Estilos
assets/js/app.js            Navegación y vistas
assets/js/texto.js          Formato del texto y bloques de código
assets/js/progreso.js       Guardado del progreso
cursos/catalogo.json        Lista de cursos publicados
cursos/*.json               Un archivo por curso
plantillas/                 Plantilla para crear cursos nuevos
scripts/validar_cursos.py   Revisa que los cursos tengan el formato correcto
scripts/mezclar_examenes.py Reparte la respuesta correcta entre A-D
docs/                       Guías
```

## Agregar un curso

Ver [docs/COMO-AGREGAR-UN-CURSO.md](docs/COMO-AGREGAR-UN-CURSO.md). En resumen: copia la plantilla a `cursos/`, llénala y agrégala a `cursos/catalogo.json`.

## Probar localmente

```bash
python -m http.server 8000
# abrir http://localhost:8000
```

## Historial de revisión

Ver [docs/REVISION-ANALISTA-DATOS.md](docs/REVISION-ANALISTA-DATOS.md) para las correcciones técnicas hechas al curso de Analista de Datos.
