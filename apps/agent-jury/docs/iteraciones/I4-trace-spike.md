# I4 · Spike de trazas: cómo llegó el agente a su respuesta

> Spike, sin esquema ni despliegue de producción. Una sola ejecución de **una pregunta** en TEST (2026-11-12) con `fabric-data-agent-sdk==0.1.36a0`. Cuaderno del spike: `fabric/notebooks/spikes/evaluate_agent_trace.py`. Los datos en bruto quedaron en `.private/` (no versionado).

## 1. Pregunta de los jurados

Quieren ver **cómo** llegó el agente a su respuesta: pasos, fuente de datos, medida usada, DAX/SQL generado y un resumen corto, no solo el veredicto del juez.

## 2. Qué expone el SDK

| Vía | ¿Sirve? | Detalle |
| --- | --- | --- |
| `evaluate_data_agent` + tabla `<table>_steps` | **Sí, es la vía recomendada** | El SDK ya pide al agente por la API *Responses* (`FabricOpenAIResponses`, no la antigua de hilos) y guarda, por pregunta, una fila de pasos en la tabla `<table_name>_steps` del Lakehouse. **No cuesta nada extra**: es la misma respuesta que ya se pide. Hoy el cuaderno la genera y no la lee |
| `get_evaluation_details` | Parcial | Devuelve la tabla de resultados, **sin pasos**. Añade `thread_url` (enlace a la respuesta), `data_agent_version`, `data_agent_etag`, `data_agent_configuration` y `data_sources` (un id de fuente, sin nombre) |
| `thread_url` / `evaluation_thread_url` | No para jurados | El enlace lo abre solo quien ejecutó la evaluación (la identidad de la app). Además contiene los ids del workspace y del agente: **no se guarda** |
| Llamar al agente aparte por *Responses* o MCP | Innecesario | Daría los mismos elementos de salida (`function_call`, `function_call_output`, `code_interpreter_call`), pero con **otra llamada al agente por pregunta** (más CU y más tiempo) y distinta respuesta (el agente no es determinista). No se probó, por eso |

Lectura de la tabla de pasos desde el cuaderno de Python (sin Spark): el spike usó `fabric.dataagent.evaluation._storage._get_data("<tabla>_steps")` (**función privada**). Para producción, leer la tabla Delta con `deltalake` (`Tables/<tabla>_steps`) y fijar la versión del SDK, porque el esquema no es API pública.

## 3. Lo que se captura de forma fiable

Esquema de `<table>_steps` (una fila por pregunta, `id` = `id` de la fila de resultados): `id`, `thread_id`, `run_id`, `function_names`, `function_queries`, `function_outputs`, `sql_steps`, `dax_steps`, `kql_steps`. Las seis últimas son **listas guardadas como texto** (`str(list)`), alineadas por posición.

Resultado real de la pregunta de España (el agente respondió 141; el juez, "Yes"):

| Paso | `function_names` | `function_queries` | `function_outputs` / `dax_steps` |
| --- | --- | --- | --- |
| 1 · Fuente | `trace.analyze_semantic_model` | "Count the number of customers whose Country is Spain." | el DAX generado (sale en `dax_steps`) |
| 2 · Consulta | `analyze.database.nl2code` | la misma frase | `EVALUATE ROW("Customers in Spain", COUNTROWS(FILTER(ALL('Customer'), 'Customer'[Country] = "Spain")))` |
| 3 · Resultado | `analyze.database.execute` | la misma frase | tabla de resultado: `Customers in Spain = 141` |

- **Fiable:** nombres de las herramientas, la petición en lenguaje natural de cada paso, el **DAX/SQL/KQL generado** (extraído de los bloques de código de la salida) y la **tabla de resultado** devuelta por la ejecución.
- **Medida usada:** no hay campo estructurado. Esta vez el agente **no usó ninguna medida**: filtró la tabla `Customer` por `Country`. Solo se deduce leyendo el DAX (aparecerían como `[Medida]`).
- **Fuente de datos:** el nombre de la herramienta indica el tipo (modelo semántico); el nombre del modelo no sale en los pasos. `data_sources` trae un id de fuente. Resolver el nombre requeriría `FabricDataAgentManagement` (no probado).
- **Resumen corto:** el SDK no lo da. Se puede componer en el cuaderno con una plantilla (sin LLM, sin CU) a partir de los pasos.
- **No capturado:** razonamiento interno del agente (el SDK no extrae los elementos `reasoning`).

## 4. Tamaño

| Campo | Caracteres |
| --- | --- |
| `function_names` | 88 |
| `function_queries` | 171 |
| `function_outputs` | 459 |
| `dax_steps` | 291 |
| `sql_steps` y `kql_steps` | 24 cada una (`['None', …]`) |
| **Fila de pasos completa** | **≈ 1,1 KB** |

Es una pregunta sencilla con un resultado de una celda. Una pregunta con varias variaciones del DAX y una tabla de 10 filas puede subir a **5–20 KB**: hay que **acotar** (§6).

## 5. ¿Contiene algo sensible?

| Elemento | Riesgo | Tratamiento propuesto |
| --- | --- | --- |
| Nombres de tablas, columnas y medidas del modelo | Bajo (metadatos internos; los jurados ven el mismo modelo) | Se guardan |
| Literales del filtro (`"Spain"`) | Bajo | Se guardan |
| **Tablas de resultado** | **Medio:** una pregunta del tipo "los 10 mejores clientes" devuelve **filas con nombres u otros datos de negocio** que el jurado quizá no debería ver fila a fila | Solo **vista previa**: máximo 5 filas y 500 caracteres, y un indicador "recortado". Opción por vista "guardar vista previa de resultados" (apagada por defecto) |
| `thread_url`, `thread_id`, `run_id`, ids de workspace, agente y fuente, `etag`, `data_agent_configuration` | Medio (ids internos; el enlace solo lo abre la app) | **Nunca se guardan** |
| Mensajes de error con rutas o ids | Bajo-medio | Recortar a 300 caracteres y quitar GUIDs |

Se aplica además el filtro que ya usa la app: nada que parezca un email o un GUID real entra en documentos o pruebas (los datos de prueba usan los valores permitidos).

## 6. Coste extra por pregunta

- **Llamadas al agente / CU:** **ninguna extra.** Los pasos salen de la respuesta que ya se pide. El agente respondió en 26 s y el juez en el resto; la ejecución completa del cuaderno fue de 91 s, de los cuales unos 40 s son la evaluación (el resto, arranque y `pip`). Esto es igual a una vista normal de una pregunta.
- **Cuaderno:** leer la tabla de pasos y componer el JSON: milisegundos. Un `INSERT` más por veredicto en la BD de la app.
- **Almacenamiento:** ≈ 1–8 KB por veredicto con el tope propuesto. Despreciable.
- **Lo que sí costaría:** pedir los pasos con una segunda llamada al agente. No se propone.

## 7. Propuesta

**Entidad `VerdictTrace`** (solo inserción, como el resto; la escribe el cuaderno con T-SQL, la regla 20 se mantiene):

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | `@uuid` | |
| `verdict_id` | `@uuid` | relación `@one()` a `Verdict` (una traza por veredicto) |
| `steps` | `@text({ max: 8000 })` | JSON: `[{ kind: "source" \| "query" \| "result", tool, request, language, code, preview }]` |
| `truncated` | `@boolean` | `true` si se recortó algo |
| `sdkVersion` | `@text({ max: 50 })` | el esquema de pasos depende de la versión |
| `createdAt` | `@datetime` | |

- **Política:** lectura para usuarios autenticados; sin `create`, `update` ni `delete` desde el cliente. La política SQL del cuaderno (`scripts/notebook-sql-policy.mjs`) pasa a permitir `INSERT` en `VerdictTraces`.
- **Cuaderno:** tras `evaluate_data_agent`, leer la fila de `<tabla>_steps` con `id` igual al de la fila de resultados, componer los pasos (`source` = primera herramienta, `query` = DAX/SQL/KQL, `result` = vista previa), recortar, e insertar. **Fail-open:** si falla, el veredicto se guarda igual y la tarjeta no muestra la traza.
- **Pantalla:** en la tarjeta del veredicto, un acordeón **"Cómo llegó el agente a su respuesta"** (cerrado por defecto) con una línea de tiempo: **fuente → consulta → resultado → respuesta**. Cada paso con su texto en claro; el DAX en un bloque monoespaciado plegable ("Ver la consulta"); un aviso "Resultado recortado" si procede. Reutiliza los tokens del diseño; sin `aria-live`. Si no hay traza (vistas anteriores o error), no se muestra nada.
- **Lectura:** la traza se pide solo al abrir el acordeón (una consulta por veredicto), no en la carga inicial de la vista.

### Qué va a TEST y qué a producción

- **TEST primero** (cambia esquema y cuaderno): entidad `VerdictTrace`, cambio de cuaderno, política SQL, una vista real de una pregunta, comprobaciones (`i4-checks`) y como mucho 2 capturas.
- **Producción después**, con el orden de siempre: esquema (`VerdictTrace`) antes o junto al código, subir el cuaderno de producción (`deploy-notebook.mjs --target=production --allow-production`) y el despliegue de la app. Sin sembrar datos ni lanzar vistas en producción.
- **Fail-open en Home y en la vista:** la lectura de trazas, como la de revisiones, no puede impedir que la pantalla cargue.

## 8. Decisiones abiertas

| # | Decisión | Recomendación |
| --- | --- | --- |
| T1 | ¿Guardar la vista previa de los resultados? | Sí, **apagada por defecto** y activable por vista; máximo 5 filas / 500 caracteres |
| T2 | ¿Una fila por veredicto con JSON, o una por paso? | Una por veredicto (un solo `INSERT`, esquema estable aunque el SDK cambie) |
| T3 | ¿Resumen corto? | Plantilla sin LLM ("Buscó en el modelo semántico, generó una consulta DAX y devolvió 1 fila"); no pagar otra llamada |
| T4 | ¿Quién ve la traza? | Todos los jurados activos (ya ven el veredicto y la respuesta) |
| T5 | ¿Dónde leer la tabla de pasos? | `deltalake` directamente y SDK fijado; no usar la función privada del SDK |
| T6 | ¿Medida y nombre de la fuente? | Solo lo que se deduce del DAX y del nombre de la herramienta; no resolver nombres con `FabricDataAgentManagement` en esta iteración |

## 9. Notas del spike

- El agente respondió **141** en esta ejecución (antes dio 292 en otra): el agente no es determinista, lo que refuerza el valor de la traza.
- El cuaderno del spike sustituyó **temporalmente** el cuaderno `evaluate_agent` del workspace de TEST; se restauró desplegando el cuaderno real al terminar. No se tocó producción.
