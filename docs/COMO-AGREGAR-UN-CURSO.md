# Cómo agregar un curso nuevo

Cada curso es **un archivo JSON** dentro de la carpeta `cursos/`. La página lo lee y arma sola el índice, la teoría, los ejercicios y los exámenes. No hay que tocar HTML ni JavaScript.

## Pasos

1. **Copia la plantilla**: duplica `plantillas/curso-plantilla.json` dentro de `cursos/` con un nombre corto sin espacios, por ejemplo `cursos/excel-avanzado.json`.
2. **Cambia el `id`** del curso para que coincida con el nombre (ej. `"id": "excel-avanzado"`).
3. **Escribe el contenido**: capítulos, teoría, ejercicios y preguntas (ver formato abajo).
4. **Regístralo en el catálogo**: agrega una entrada en `cursos/catalogo.json`:

   ```json
   {
     "id": "excel-avanzado",
     "archivo": "excel-avanzado.json",
     "categoria": "Ofimática",
     "etiquetas": ["Excel", "Power Query"],
     "color": "#16a34a",
     "publicado": true
   }
   ```

   Con `"publicado": false` el curso queda oculto mientras lo preparas.
5. **Valida** (opcional pero recomendado): `python scripts/validar_cursos.py`. Al subir a GitHub esta validación corre sola y te avisa si algo está mal.
6. **Equilibra los exámenes** (opcional): `python scripts/mezclar_examenes.py cursos/excel-avanzado.json` reparte la respuesta correcta entre A, B, C y D. La web además mezcla las opciones en cada intento.

## Formato de un capítulo

| Campo | Obligatorio | Qué es |
|---|---|---|
| `id` | Sí | Identificador único (se usa en la URL y para guardar el progreso; no lo cambies después de publicar) |
| `order` | Sí | Número para ordenar los capítulos |
| `title` | Sí | Título |
| `code` | No | Etiqueta corta: "Cap. 01", "Apéndice A" |
| `module` | No | Nombre del módulo; los capítulos con el mismo texto se agrupan juntos |
| `subtitle`, `estimatedMinutes` | No | Resumen y duración |
| `objectives` | No | Lista de objetivos |
| `theorySections` | No | Secciones con `title`, `body`, `codeSnippet`, `codeLanguage`, `keyTakeaway` |
| `professionalStandard` | No | Reglas de buenas prácticas y código de referencia |
| `comparison` | No | Comparación "forma incorrecta vs. correcta" |
| `exercises` | No | Ejercicios con pista y solución ocultas |
| `exam` | No | Preguntas de opción múltiple (`options`, `correctIndex` empieza en 0, `explanation`) |

Las pestañas que no tengan contenido no se muestran, así que un curso puede ser solo teoría y examen.

**Lenguajes de código con color**: `sql`, `python`, `yaml`, `bash`, `markdown`. Otros se muestran sin color.

**Formato del texto**: `**negrita**`, `*cursiva*`, `` `código` ``, línea en blanco = párrafo nuevo, `- ` = lista, `1) ` = lista numerada. En JSON los saltos de línea se escriben `\n`.

## Consejos para buenos exámenes

- Que las opciones incorrectas sean creíbles y de largo parecido a la correcta. Si la correcta siempre es la más larga y detallada, se adivina sin saber.
- Evita "Todas las anteriores": la web cambia el orden de las opciones.

## Probar en tu computadora

La página necesita un servidor (no funciona abriendo `index.html` con doble clic):

```bash
python -m http.server 8000
```

Luego abre <http://localhost:8000>.
