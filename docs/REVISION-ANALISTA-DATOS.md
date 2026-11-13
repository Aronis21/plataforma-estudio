# Revisión técnica: Analista de Datos Intermedio

Revisión hecha el 2026-11-12 sobre el archivo original. Se leyeron las 31 lecciones completas; el código Python se verificó con un analizador de sintaxis, el SQL con `sqlglot` y las cifras estadísticas se recalcularon con `scipy`.

## Correcciones de contenido

| Lección | Qué se corrigió |
|---|---|
| `intro` | El comentario describía un filtro distinto al que aplica el código |
| `cap-01` | La CTE ventas_filtradas no tiene pedido_id ni fecha_pedido |
| `cap-01` | LAG no maneja meses faltantes: devuelve la fila anterior existente |
| `cap-01` | Aclarar la limitación de LAG con huecos |
| `cap-02` | El enunciado y la solución usaban nombres de columna distintos |
| `cap-04` | Un total vacío ('') haría fallar el casteo; el propio texto recomienda NULLIF |
| `cap-04` | El ejemplo no usa UNNEST |
| `cap-05` | El escenario decía 30 días pero ambas consultas filtran el mes de octubre |
| `cap-06` | costo_total no existe en fct_ventas_items (tiene costo_unitario) y faltaba el corte mensual |
| `cap-06` | El escenario pide margen mensual por categoría |
| `cap-14` | Faltaba importar la función probada |
| `cap-14` | Faltaba importar la función probada |
| `cap-15` | El enunciado tenía un texto de borrador ('perdón, al revés') |
| `cap-16` | Redacción ambigua del factor de reducción |
| `cap-17` | La inflación depende del número de miradas; no es una cifra fija |
| `cap-17` | Lo que se compara con 0.001 es el p-value, no el estadístico chi2 |
| `cap-17` | chi2_contingency con esos datos da p ≈ 0.033 |
| `cap-17` | Con 2M por grupo esa diferencia da p ≈ 0.17 (no significativa); con 10M da p ≈ 0.002 |
| `cap-19` | El código detecta desviaciones en ambas direcciones (abs), no solo caídas |
| `cap-27` | El ejercicio del caso calcula 34% -> 29%; la cifra 26% no cuadraba |
| `cap-27` | Consistencia con el ejercicio del caso |
| `cap-27` | Consistencia con el ejercicio del caso |
| `apendice-b` | Desempatar por la misma columna de PARTITION BY no desempata nada |
| `apendice-b` | El texto anuncia tres patrones pero el código mostraba dos |
| `apendice-b` | Faltaba importar pandas |
| `apendice-c` | El texto promete 5 líneas pero enumeraba 4 |
| `apendice-c` | El ejercicio pide 4 puntos y la solución tenía 3 |

## Exámenes

- En el original la respuesta correcta era la **B en 75 de 93 preguntas** (A: 12, C: 6, D: 0). Se reordenaron las opciones para repartirla: A 24, B 23, C 23, D 23. Ninguna respuesta cambió.
- La web además mezcla las opciones en cada intento.
- **Pendiente:** en 77 de 93 preguntas la opción correcta es claramente la más larga. Conviene reescribir las opciones incorrectas para que tengan un largo y detalle parecidos.

## Otros cambios

- Los ids de los apéndices pasaron de `apendice-apndicea/b/c` a `apendice-a/b/c`.
