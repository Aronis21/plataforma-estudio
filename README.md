# NEXUS Learning

Mi cuaderno personal de estudio (antes "Plataforma de Estudio"): teoría, ejercicios con pista y solución, y exámenes con puntuación y seguimiento de progreso. El diseño se llama **Cuaderno vivo**: cada curso tiene su propio papel (analista, desarrollador, laboratorio).

**Web:** https://aronis21.github.io/plataforma-estudio/

## Cursos

| Cuaderno | Curso | Estado |
|---|---|---|
| Cuaderno de analista (Datos) | Analista de Datos Intermedio · 29 capítulos + 3 apéndices | Disponible |
| Cuaderno de desarrollador (Web) | Programación y Desarrollo Web · 45 lecciones + 7 proyectos | Disponible (159 preguntas) |
| Cuaderno de laboratorio (IA) | Inteligencia Artificial · 13 capítulos, 39 preguntas | Disponible |

## Qué tiene

- **Hoy:** plan del día (siguiente capítulo de cada curso, tarjetas pendientes y tus propias tareas), racha de días seguidos, nota del tutor, "Te quedaste aquí", último resaltado, mazo de tarjetas y dudas guardadas.
- **Panel de cada curso:** gráfico de avance por módulo, "libro mayor" con tus números, índice por módulos y margen con dudas del curso.
- **Capítulo** con margen para tus notas y pestañas propias de cada papel: lección, regla profesional, corrección en tinta (junior vs. intermedio), ejercicios y evaluación.
- **Resaltar:** selecciona una frase de la lección para resaltarla, pedir una explicación o convertirla en tarjeta de repaso. Toca un resaltado para quitarlo.
- **Ejercicios:** tu intento se guarda solo, pistas por niveles y "¿cómo te fue?". Lo que no te salió pasa a tus tarjetas.
- **Evaluación:** se aprueba con 70%, las opciones cambian de orden en cada intento, dices qué tan seguro estás y recibes un análisis; lo que fallas pasa a tus tarjetas.
- **Práctica** (`#/practica`, separador "Práctica"), organizada en pestañas:
  - **Mi nivel:** tu nivel por tema y subtema (de Principiante a Profesional) según tus aciertos en la práctica y tus exámenes, qué reforzar y las preguntas que más fallas.
  - **Datos:** ejercicios de **T-SQL** (sintaxis de SQL Server) ordenados por nivel y concepto (los de JOIN muestran su diagrama de Venn; incluye JSON con `OPENJSON`), consola T-SQL con las bases `tienda`, `rrhh` y `app`, reto del día y equivalencias; además, preguntas por módulo del curso. La consola traduce T-SQL a SQLite (`tsql.js`) y avisa si escribes algo que no funcionaría en SQL Server.
  - **Web e IA:** una sub-pestaña por módulo; practicas por capítulo o el módulo completo con las preguntas de los exámenes (primero las que fallaste).
  - **JavaScript:** ejercicios con pruebas automáticas, consola libre y reto del día. El código corre en un hilo aparte con límite de 3 segundos. Los ejercicios de DOM (seleccionar y modificar, eventos, formularios) corren en una mini página aislada que puedes usar a mano.
- **Repaso espaciado** (`#/repaso`): cada tarjeta vuelve cuando toca recordarla.
- **Respaldo:** progreso, notas, resaltados, tarjetas y práctica se guardan en el navegador y se descargan/cargan en un solo archivo desde la página Hoy.
- Un papel por curso (Hoy, Datos, Web, IA) con separadores para cambiar de cuaderno, y diseño adaptado al celular.

## Tutor

El tutor funciona hoy en **modo local**: arma sus mensajes con tu progreso y con el contenido del curso (ideas clave, objetivos, ejercicios), sin inteligencia artificial y sin servidor. Todo está en `assets/js/tutor.js`.

Para conectar una IA real más adelante (por ejemplo, con Firebase: una Cloud Function que guarde la clave como secreto y llame a la API de Claude), solo hay que cambiar las funciones de `tutor.js` para que hagan `fetch()` a ese servidor. **Nunca pongas una clave de API en este repositorio: es público.**

## Estructura

```
index.html                  Página única
assets/css/tokens.css       Tipografías, tamaños y medidas comunes
assets/css/temas.css        Los papeles de cada curso (colores de Hoy, Datos, Web e IA)
assets/css/base.css         Esqueleto del cuaderno y componentes generales
assets/css/cuaderno.css     Componentes del cuaderno: margen, notas, tarjetas, correcciones…
assets/js/app.js            Navegación y vistas (Hoy, panel del curso, capítulo, repaso)
assets/js/texto.js          Formato del texto y bloques de código
assets/js/progreso.js       Progreso de lecturas, ejercicios y exámenes
assets/js/cuaderno.js       Notas, dudas, resaltados, tarjetas, plan del día y racha
assets/js/resaltado.js      Barra de acciones al seleccionar texto en una lección
assets/js/tutor.js          Tutor en modo local (punto de conexión para una IA futura)
assets/js/practica.js       Página Práctica: Mi nivel, consola SQL y práctica por tema
assets/js/practica-datos.js Bases de ejemplo y ejercicios de T-SQL (agrega ejercicios aquí)
assets/js/tsql.js           Capa de compatibilidad T-SQL: traduce a SQLite y agrega funciones de SQL Server
assets/js/diagramas.js      Diagramas de las lecciones (Venn de JOINs, regresión, matriz de confusión, validación cruzada)
assets/js/practica-js-datos.js  Ejercicios de JavaScript con sus pruebas
assets/js/practica-js-motor.js  Ejecuta JavaScript en un Web Worker con tiempo límite
assets/js/practica-dom.js       Ejercicios de DOM: mini página en un iframe aislado y sus pruebas
assets/css/practica.css     Estilos de la página Práctica
assets/vendor/sqljs/        SQLite para el navegador (sql.js 1.10.3, licencia MIT)
cursos/catalogo.json        Lista de cursos (con su "tema": datos, web o ia, y "estado")
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
