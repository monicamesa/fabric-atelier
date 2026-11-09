# Agent Jury — Especificación general del MVP

> **Who judges the judge?**
> Documento pensado para vivir en `docs/especificacion-general.md` del repositorio y servir de guía a agentes de código (plan → especificación → implementación → testing → despliegue).
> Fecha: 2026-11-09 · Estado: borrador v0.2
>
> **Idioma:** la interfaz es **bilingüe (inglés y español)**, con un selector de idioma en la cabecera. Inglés por defecto. Esta especificación está en español; los nombres de entidades y campos del código van siempre en inglés (ver sección 9.1).

---

## 1. Contexto y problema

Las organizaciones están publicando Fabric Data Agents, pero nadie puede afirmar con datos que respondan bien. Ya existen herramientas que automatizan la evaluación:

- El SDK oficial `fabric-data-agent-sdk` (`evaluate_data_agent`) compara la respuesta del agente con una respuesta esperada usando un LLM como juez.
- **Data Agent Quality Lab** (omerizm47, MIT) ejecuta evaluaciones planificadas, muestra tendencias, detecta regresiones y diagnostica fallos.
- **fabric-rlm-core** (pawarbi) genera respuestas esperadas a partir de las fuentes del agente.

**El hueco que cubre esta app es la capa humana**, que ninguna de esas herramientas resuelve:

1. **Quién decide cuál es la respuesta correcta.** Hoy la escribe un técnico en un CSV o la genera una IA. Nadie de negocio la valida.
2. **Quién vigila al juez.** El veredicto del LLM se acepta sin medir cuántas veces se equivoca frente a una persona.
3. **Qué pasa cuando dos áreas no coinciden.** Respuestas esperadas contradictorias suelen revelar definiciones de métricas distintas, no fallos del agente.

**Principio de diseño:** la calidad de un agente la define el negocio, no la IA. La app complementa a Quality Lab: el tribunal decide qué es verdad y exporta el banco aprobado en su formato.

## 2. Objetivos del MVP

| # | Objetivo | Cómo se mide |
|---|---|---|
| O1 | Que expertos de negocio construyan un banco de preguntas con respuestas esperadas aprobadas por consenso | Nº de preguntas aprobadas por agente |
| O2 | Hacer visibles los desacuerdos de definición | Nº de preguntas en conflicto, con las propuestas enfrentadas |
| O3 | Medir la fiabilidad del juez LLM frente al criterio humano | % de acuerdo juez-humano por agente y categoría |
| O4 | Lanzar evaluaciones desde la app sin tocar notebooks | Ejecución lanzada y resultados visibles en la app |
| O5 | Interoperar con Quality Lab | Export del banco aprobado en su formato de CSV |

## 3. Fuera de alcance del MVP

- Captura automática de preguntas reales de usuarios (el endpoint MCP del agente no gestiona conversaciones; sin verificar si existe telemetría aprovechable).
- Generación automática de respuestas esperadas con IA (ya lo cubre fabric-rlm-core).
- Evaluaciones planificadas, tendencias y alertas de regresión (ya lo cubre Quality Lab).
- Modificar la configuración del agente (instrucciones, ejemplos) desde la app.
- Multi-tenant y usuarios externos.

## 4. Usuarios y roles

| Rol | Quién | Puede |
|---|---|---|
| **Experto** | Persona de negocio de un dominio (Finanzas, Ventas…) | Proponer preguntas y respuestas esperadas; votar propuestas de su dominio |
| **Aprobador** | Responsable de un dominio | Todo lo del experto; su voto cuenta para el consenso y puede rechazar |
| **Revisor de veredictos** | Experto o aprobador | Confirmar o corregir el veredicto del juez LLM |
| **Admin** | Equipo de datos | Registrar agentes, gestionar revisores, lanzar evaluaciones, exportar |

**Limitación de la plataforma que condiciona el diseño:** las políticas de `@role` solo comparan *claims* del usuario (`sub`, `email`, `role`) con campos de la fila mediante `.eq()`. No pueden consultar otra tabla, por lo que no es posible expresar "el votante es aprobador de este dominio" como política. Ver el patrón de la sección 7.

## 5. Flujos principales

### F1. Proponer una pregunta
1. Un experto elige un agente y escribe la pregunta, una categoría y la respuesta que considera correcta.
2. Junto a la respuesta indica **la definición usada**: periodo, filtros, criterio ("clientes activos = al menos un pedido en los últimos 90 días").
3. La pregunta queda en estado **En revisión**.

### F2. Revisar y votar
1. Otros expertos y aprobadores del dominio ven la pregunta y sus propuestas.
2. Pueden votar a favor, en contra (con comentario obligatorio) o añadir **una propuesta alternativa**.
3. La app calcula el estado según las reglas de consenso (sección 6).

### F3. Resolver conflictos
1. La vista de conflictos muestra preguntas con propuestas enfrentadas, con sus definiciones lado a lado.
2. Los aprobadores de los dominios implicados acuerdan una propuesta o reformulan la pregunta para que sea inequívoca.
3. El conflicto resuelto queda registrado: es una **decisión de definición de métrica**, útil más allá de la app.

### F4. Lanzar una evaluación
1. El admin elige agente, etapa (`sandbox` o `production`) y el subconjunto de preguntas aprobadas.
2. La app lanza un notebook de evaluación mediante una Function (sección 8).
3. La app muestra el estado de la ejecución y, al terminar, sus resultados.

### F5. Revisar veredictos del juez
1. Una cola muestra cada resultado: pregunta, respuesta esperada, respuesta del agente y veredicto del juez.
2. El revisor confirma o corrige el veredicto y, si corrige, indica el motivo: juez demasiado estricto, juez demasiado laxo, respuesta esperada incorrecta u otro.
3. Si el motivo es "respuesta esperada incorrecta", la pregunta vuelve a **En revisión**.

### F6. Exportar el banco aprobado
El admin exporta las preguntas aprobadas de un agente a un CSV con columnas `question, expected_answer, category, tags`, compatible con Quality Lab.

## 6. Reglas de negocio

- **R1. Votos inmutables.** Un voto no se edita ni se borra. Para cambiar de opinión se emite un voto nuevo; cuenta el último de cada persona.
- **R2. Nadie se aprueba a sí mismo.** El voto del autor de una propuesta no cuenta para su consenso.
- **R3. Consenso (configurable).** Una propuesta queda **Aprobada** cuando tiene al menos `N` votos a favor de revisores válidos del dominio, al menos uno de un aprobador, y ningún voto en contra vigente de un aprobador. Valor por defecto: `N = 1`, pensado para equipos pequeños.
- **R4. Conflicto.** Una pregunta está **En conflicto** si tiene dos o más propuestas con algún voto a favor, o si una propuesta tiene votos a favor y en contra de aprobadores a la vez.
- **R5. Solo se evalúa lo aprobado.** Las evaluaciones solo usan preguntas aprobadas, con la propuesta aprobada como respuesta esperada.
- **R6. La verdad se calcula, no se escribe.** El estado de una pregunta no es un campo editable por el cliente: se deriva de propuestas y votos (sección 7).

## 7. Modelo de datos (base de datos de la app)

Patrón general: **registros de solo inserción con identidad verificada + estado calculado**. Las políticas garantizan que nadie inserta en nombre de otro (`claims.sub.eq(item.user_id)`); la validez de cada voto (rol, dominio, no autoaprobación) se calcula al derivar el estado. Así se respetan las limitaciones de `@role` sin perder garantías.

Convenciones de Rayfin a respetar:
- Clave primaria siempre `id` UUID; sin claves compuestas.
- Todo campo de texto con `max` explícito (sin `max` genera `NVARCHAR(MAX)` y puede romper la generación de metadatos GraphQL).
- Relaciones con `@one()` / `@many()` y claves foráneas `{propiedad}_id`. Sin muchos a muchos.
- La identidad del usuario se guarda en un campo `*_user_id` de texto rellenado desde `claims.sub` (no se puede relacionar con la entidad de sistema `USER`).

| Entidad | Campos principales | Permisos |
|---|---|---|
| `Dominio` | `nombre` | Lectura: autenticados. Escritura: admin (ver nota) |
| `Revisor` | `email`, `dominio_id`, `rol` (`experto` · `aprobador` · `admin`), `activo` | Lectura: autenticados. Escritura: admin (ver nota) |
| `Agente` | `nombre`, `workspace_id`, `item_id`, `dominio_id`, `activo` | Lectura: autenticados. Escritura: admin (ver nota) |
| `Pregunta` | `agente_id`, `texto` (max 1000), `categoria`, `tags`, `autor_user_id`, `retirada` | Crear: autenticados con `claims.sub.eq(item.autor_user_id)`. Leer: autenticados. Sin actualizar ni borrar |
| `Propuesta` | `pregunta_id`, `respuesta` (max 2000), `definicion` (max 1000), `autor_user_id`, `autor_email` | Crear: igual que `Pregunta`. Leer: autenticados. Sin actualizar ni borrar |
| `Voto` | `propuesta_id`, `valor` (`a_favor` · `en_contra`), `comentario` (max 1000), `votante_user_id`, `votante_email` | Crear: `claims.sub.eq(item.votante_user_id)`. Leer: autenticados. Sin actualizar ni borrar |
| `Ejecucion` | `agente_id`, `etapa`, `lanzada_por_user_id`, `job_instance_id`, `evaluation_id`, `estado`, `n_preguntas` | Crear y actualizar: solo desde la Function |
| `VeredictoHumano` | `ejecucion_id`, `pregunta_id`, `veredicto_juez`, `veredicto_humano` (`correcto` · `incorrecto` · `ambiguo`), `motivo`, `comentario` (max 1000), `revisor_user_id` | Crear: `claims.sub.eq(item.revisor_user_id)`. Leer: autenticados. Sin actualizar ni borrar |

**Nota sobre la escritura de admin:** las políticas no permiten comprobar pertenencia a una lista. Para el MVP, `Dominio`, `Revisor` y `Agente` se escriben a través de Functions que comprueban que el llamante figura como `admin` en `Revisor` antes de escribir (usando `ctx.getDataClient()`, que conserva la identidad del llamante). El primer admin se siembra directamente en la base de datos.

**Cálculo del estado:** en el MVP, el frontend calcula el estado de cada pregunta a partir de propuestas, votos y revisores para mostrarlo. El cálculo autoritativo (el que decide qué entra en una evaluación o en el export) se hace en el notebook o la Function correspondiente, con la misma lógica. Esa lógica vive en un único módulo compartido con tests.

## 8. Arquitectura e integraciones

```
[Fabric App: frontend React]
   │ GraphQL (Rayfin client)                 → BD de la app: Pregunta, Propuesta, Voto, VeredictoHumano…
   │ Connector fabric-sqlanalytics (lectura) → Lakehouse "tribunal_lh": tablas de resultados del SDK
   │ Functions (identidad de la app)
   │    ├─ registrar/gestionar agentes y revisores (comprobando rol admin)
   │    └─ lanzar evaluación → API Job Scheduler: ejecutar notebook con parámetros
   ▼
[Notebook "evaluar_agente"]
   1. Lee las preguntas aprobadas de la BD de la app (cálculo autoritativo de estado)
   2. evaluate_data_agent(df, agente, workspace, table_name, data_agent_stage)
   3. Escribe resultados en tribunal_lh (tablas del SDK + tabla de metadatos de ejecución)
[Notebook "exportar_banco"]
   → Files/ground_truth/<agente>.csv con question, expected_answer, category, tags
```

Decisiones:
- **Plantilla:** Data App de Rayfin (framework de visuales y validación con Playwright). Activar datos en `rayfin.yml`.
- **Lectura de resultados:** connector `fabric-sqlanalytics` sobre `tribunal_lh`. Con CLI 1.36.2 usa por defecto la identidad de la app; acceso protegido con `@role` en las entidades del connector.
- **Lanzar evaluaciones:** Function con *audience* `Fabric` que llama a *Run On Demand Item Job* del notebook. Límite de 240 s por ejecución de Function: solo lanza el job y devuelve el `job_instance_id`; el seguimiento del estado se hace por consulta posterior.
- **Región:** app, Lakehouse, notebooks y capacidad en la misma región (las conexiones al endpoint SQL entre regiones no están soportadas). Región con Fabric Apps disponible.

## 9. Pantallas

1. **Agentes:** lista de agentes registrados con dominio, nº de preguntas por estado y % de acuerdo juez-humano.
2. **Banco de preguntas (por agente):** columnas por estado (En revisión · Aprobada · En conflicto · Retirada), filtros por categoría.
3. **Detalle de pregunta:** propuestas con su definición, votos con comentarios, historial; acciones de votar y proponer alternativa.
4. **Conflictos:** propuestas enfrentadas lado a lado con sus definiciones y quién respalda cada una.
5. **Ejecuciones:** lanzar evaluación, estado de cada ejecución, resumen de resultados.
6. **Revisión de veredictos:** cola con pregunta, respuesta esperada, respuesta del agente, veredicto del juez y botones de confirmar o corregir.
7. **Calidad del juez:** matriz juez frente a humano, % de acuerdo por agente y categoría, motivos de desacuerdo más frecuentes.

Requisitos visuales: estados vacíos y de error útiles; sin datos simulados si falla una consulta.

Requisitos de idioma:
- Selector **EN | ES** en la cabecera, visible en todas las pantallas. Inglés por defecto; la elección se recuerda por usuario en el navegador.
- Ningún texto visible escrito directamente en los componentes: todo sale de ficheros de traducción (`locales/en.json`, `locales/es.json`) mediante una librería de i18n.
- Los formatos de fecha y número siguen el idioma elegido (`en-GB` y `es-ES`).
- El contenido que escriben los usuarios (preguntas, respuestas, comentarios) no se traduce: se muestra tal cual.
- Un test comprueba que ambos ficheros de traducción tienen las mismas claves.

### 9.1 Vocabulario de la interfaz (metáfora del juicio)

| Concepto | UI (EN) | UI (ES) | Nombre en código |
|---|---|---|---|
| El LLM que evalúa | **Judge** | **Juez** | `judgeVerdict` |
| Expertos de negocio | **Jury** / **Juror** | **Jurado** / **Miembro del jurado** | `Juror` (sustituye a `Revisor`) |
| El Data Agent evaluado | **Defendant** (ayuda) / **Agent** (listas) | **Acusado** (ayuda) / **Agente** (listas) | `Agent` |
| Pregunta con su historial | **Case** | **Caso** | `Case` (sustituye a `Pregunta`) |
| Respuesta esperada propuesta | **Testimony** | **Testimonio** | `Testimony` (sustituye a `Propuesta`) |
| Voto | **Vote** | **Voto** | `Vote` |
| Conflicto entre áreas | **Dispute** | **Disputa** | estado `disputed` |
| Corregir el veredicto del juez | **Appeal** | **Recurso** | `Appeal` (sustituye a `VeredictoHumano`) |
| Respuestas aprobadas y conflictos resueltos | **Case law** | **Jurisprudencia** | vista `caseLaw` |
| Ejecución de evaluación | **Hearing** | **Vista** | `Hearing` (sustituye a `Ejecucion`) |

Estados de un case: `under_review`, `ruled` (aprobado), `disputed`, `dismissed` (retirado).

Regla: la metáfora se usa en títulos y navegación, pero cada pantalla incluye una línea de ayuda en lenguaje llano para que un usuario de negocio entienda qué hace sin conocer la metáfora.

## 10. Requisitos no funcionales

- **Coste:** cada pregunta evaluada consume en torno a 50 s de tiempo de agente más el uso del LLM juez (dato observado por Quality Lab). La app muestra una estimación antes de lanzar una evaluación y permite evaluar un subconjunto.
- **Capacidad:** Data Agents y su evaluación requieren capacidad F2 o superior de pago; no funcionan en capacidades de prueba. Limitar los vCores máximos de la base de datos de la app.
- **Seguridad:** ningún token sale de las Functions. El cliente no es frontera de autorización: toda restricción se aplica con `@role`, políticas y Functions.
- **Trazabilidad:** todo voto, propuesta y veredicto humano queda registrado con autor y fecha; nada se borra.
- **Preview:** Fabric Apps, el SDK de evaluación y los Data Agents están en preview. Fijar versiones (CLI de Rayfin y `fabric-data-agent-sdk`) y documentarlas en el README.

## 11. Supuestos por verificar antes o durante la iteración 3

| # | Supuesto | Cómo verificarlo |
|---|---|---|
| S1 | El nombre exacto del tipo de item de Data Agent en la API *List Items* | Llamada a la API sobre un workspace con un agente |
| S2 | El esquema de las tablas que escribe `evaluate_data_agent` (no documentado en Learn) | Primera ejecución manual y lectura de las tablas |
| S3 | Que un notebook lanzado por la Function (identidad del propietario) pueda evaluar el agente. Los Data Agents solo admiten identidad de usuario | Prueba de extremo a extremo en el tenant personal |
| S4 | Que los enlaces a los hilos de evaluación solo sean visibles para quien ejecutó la evaluación (documentado). Implica que solo el propietario podrá abrirlos | Asumirlo en la UI: no mostrar el enlace a otros usuarios |
| S5 | La mejor forma de que el notebook lea la BD de la app (endpoint SQL de la base de datos o conexión directa) | Prueba en la iteración 3 |

## 11.1 Entorno de demo (prerrequisito de la iteración 3)

La app no necesita un modelo propio, pero sí **algo que juzgar**: al menos un Data Agent publicado sobre datos reales.

| Workspace | Contenido |
|---|---|
| `agent-jury-app` | La Fabric App con su base de datos, el Lakehouse `jury_lh` (resultados del SDK y bancos exportados) y los notebooks `evaluate_agent` y `export_case_law` |
| `agent-jury-demo` | Datos de origen, modelo semántico y los Data Agents a evaluar |

Ambos en la misma capacidad de pago (F2 o superior) y en una región con Fabric Apps disponible.

**Fase A, arranque rápido (iteraciones 1–3):** Lakehouse de AdventureWorks y un Data Agent siguiendo el tutorial de Microsoft Learn.

**Fase B, demo con trampas (iteraciones 4–5):** un modelo semántico pequeño diseñado para provocar disputes entre áreas, con al menos estas ambigüedades:
- **Active customer:** con pedido en los últimos 90 días o en el año en curso.
- **Revenue:** bruta o neta de devoluciones y descuentos.
- **Year:** natural o fiscal (por ejemplo, de julio a junio).
- **Region:** la del cliente o la de la tienda que vende.

Y dos Data Agents sobre los mismos datos: uno sobre el Lakehouse y otro sobre el modelo semántico, para comparar su acierto con el mismo banco de cases.

Configuración de tenant necesaria: Data Agents habilitados y, según la región, procesamiento y almacenamiento entre geografías para IA.

## 12. Plan de iteraciones

| Iteración | Contenido | Criterio de salida |
|---|---|---|
| **I1** | Esqueleto con plantilla Data App + datos activados; entidades `Dominio`, `Revisor`, `Agente`, `Pregunta`, `Propuesta`; pantallas 1–3 sin votos | Un experto crea preguntas y propuestas; despliegue en Fabric correcto |
| **I2** | `Voto`, módulo de cálculo de estado con tests, reglas R1–R6, pantalla 4 | Los estados se calculan bien en todos los casos de prueba, incluidos conflictos y autoaprobación |
| **I3** | Lakehouse, notebook `evaluar_agente`, Function de lanzamiento, connector de lectura, pantalla 5. Verificar S1–S5 | Una evaluación lanzada desde la app produce resultados visibles en la app |
| **I4** | `VeredictoHumano`, pantallas 6 y 7, vuelta a revisión por respuesta esperada incorrecta | Se calcula el % de acuerdo juez-humano por agente y categoría |
| **I5** | Notebook `exportar_banco` y prueba de importación en Quality Lab | El CSV exportado se carga sin errores en Quality Lab |

## 13. Criterios de aceptación del MVP

- [ ] Un usuario no puede crear un voto, propuesta o veredicto en nombre de otro.
- [ ] El voto de un autor sobre su propia propuesta no cuenta para el consenso.
- [ ] Una pregunta con propuestas enfrentadas aparece en la vista de conflictos.
- [ ] Solo las preguntas aprobadas entran en una evaluación y en el export.
- [ ] Una evaluación lanzada desde la app muestra sus resultados en la app sin abrir ningún notebook.
- [ ] La pantalla de calidad del juez muestra el % de acuerdo juez-humano por agente.
- [ ] El CSV exportado es compatible con el formato de bancos de Quality Lab.
- [ ] Ninguna consulta fallida se sustituye por datos simulados.

## 14. Referencias

- Fabric Apps — connectors: https://learn.microsoft.com/fabric/apps/connectors
- Fabric Apps — modelo de datos: https://learn.microsoft.com/fabric/apps/data-models
- Fabric Apps — permisos de datos: https://learn.microsoft.com/fabric/apps/data-permissions
- Fabric Apps — Functions: https://learn.microsoft.com/fabric/apps/functions
- Fabric Apps — precios: https://learn.microsoft.com/fabric/apps/pricing
- Evaluar un Data Agent: https://learn.microsoft.com/fabric/data-science/evaluate-data-agent
- SDK de Data Agents: https://learn.microsoft.com/fabric/data-science/fabric-data-agent-sdk
- Data Agent como servidor MCP: https://learn.microsoft.com/fabric/data-science/data-agent-mcp-server
- Data Agent Quality Lab: https://github.com/omerizm47/data-agent-quality-lab
- fabric-rlm-core (PR #76): https://github.com/pawarbi/fabric-rlm-core/pull/76
