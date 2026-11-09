# Agent Jury — Especificación general del MVP

> **Who judges the judge?**
> Documento pensado para vivir en `docs/especificacion-general.md` del repositorio y servir de guía a agentes de código (plan → especificación → implementación → testing → despliegue).
> Fecha: 2026-11-09 · Estado: borrador v0.4 (sin dominios; roles globales; Function de admin con T-SQL; cases no verificados; `CaseDismissal`; I1 dividida en I1a e I1b)
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
| **Experto** | Persona de negocio | Proponer preguntas y respuestas esperadas; votar propuestas |
| **Aprobador** | Responsable de negocio | Todo lo del experto; su voto cuenta para el consenso y puede rechazar |
| **Revisor de veredictos** | Experto o aprobador | Confirmar o corregir el veredicto del juez LLM |
| **Admin** | Equipo de datos | Registrar agentes, gestionar jurors, retirar cases, lanzar evaluaciones, exportar |

El rol de cada juror es **global** (`expert`, `approver` o `admin`): no hay dominios ni áreas con permisos propios. El campo opcional `team` (texto libre, por ejemplo "Finanzas") solo se muestra en la interfaz y no tiene ningún efecto en permisos ni en el consenso.

**Limitación de la plataforma que condiciona el diseño:** las políticas de `@role` solo comparan *claims* del usuario (`sub`, `email`, `role`) con campos de la fila mediante `.eq()`. No pueden consultar otra tabla, por lo que no es posible expresar "el votante es aprobador" ni "el autor es juror" como política. Ver el patrón de la sección 7.

## 5. Flujos principales

### F1. Proponer una pregunta
1. Un experto elige un agente y escribe la pregunta, una categoría y la respuesta que considera correcta.
2. Junto a la respuesta indica **la definición usada**: periodo, filtros, criterio ("clientes activos = al menos un pedido en los últimos 90 días").
3. La pregunta queda en estado `under_review` (en revisión).

### F2. Revisar y votar
1. Otros expertos y aprobadores ven la pregunta y sus propuestas.
2. Pueden votar a favor, en contra (con comentario obligatorio) o añadir **una propuesta alternativa**.
3. La app calcula el estado según las reglas de consenso (sección 6).

### F3. Resolver conflictos
1. La vista de conflictos muestra preguntas con propuestas enfrentadas, con sus definiciones lado a lado.
2. Los aprobadores acuerdan una propuesta o reformulan la pregunta para que sea inequívoca.
3. El conflicto resuelto queda registrado: es una **decisión de definición de métrica**, útil más allá de la app.

### F4. Lanzar una evaluación
1. El admin elige agente, etapa (`sandbox` o `production`) y el subconjunto de preguntas aprobadas.
2. La app lanza un notebook de evaluación mediante una Function (sección 8).
3. La app muestra el estado de la ejecución y, al terminar, sus resultados.

### F5. Revisar veredictos del juez
1. Una cola muestra cada resultado: pregunta, respuesta esperada, respuesta del agente y veredicto del juez.
2. El revisor confirma o corrige el veredicto y, si corrige, indica el motivo: juez demasiado estricto, juez demasiado laxo, respuesta esperada incorrecta u otro.
3. Si el motivo es "respuesta esperada incorrecta", la pregunta vuelve a `under_review`.

### F6. Exportar el banco aprobado
El admin exporta las preguntas aprobadas de un agente a un CSV con columnas `question, expected_answer, category, tags`, compatible con Quality Lab.

### F7. Retirar una pregunta
1. El autor de la pregunta o un admin la retira indicando un motivo.
2. La app inserta un `CaseDismissal`; la pregunta pasa a `dismissed` si la retirada es válida (R8). Nada se borra.

### F8. Administrar jurors y agentes
1. Un admin da de alta, cambia el rol o desactiva jurors, y registra o desactiva agentes, en la pantalla de administración.
2. Cada cambio pasa por la Function de admin (sección 7), que comprueba que quien llama es admin.

## 6. Reglas de negocio

- **R1. Votos inmutables.** Un voto no se edita ni se borra. Para cambiar de opinión se emite un voto nuevo; cuenta el último de cada persona.
- **R2. Nadie se aprueba a sí mismo.** El voto del autor de una propuesta no cuenta para su consenso.
- **R3. Consenso (configurable).** Una propuesta queda aprobada, y su pregunta pasa a `ruled`, cuando tiene al menos `N` votos a favor de revisores válidos (jurors activos), al menos uno de un aprobador, y ningún voto en contra vigente de un aprobador. Valor por defecto: `N = 1`, pensado para equipos pequeños.
- **R4. Conflicto.** Una pregunta está en estado `disputed` (en conflicto) si tiene dos o más propuestas con algún voto a favor, o si una propuesta tiene votos a favor y en contra de aprobadores a la vez.
- **R5. Solo se evalúa lo aprobado.** Las evaluaciones solo usan preguntas en estado `ruled`, con la propuesta aprobada como respuesta esperada.
- **R6. La verdad se calcula, no se escribe.** El estado de una pregunta (`under_review`, `ruled`, `disputed` o `dismissed`) no es un campo editable por el cliente: se deriva de propuestas, votos y retiradas (sección 7).
- **R7. Cases no verificados.** Cualquier usuario autenticado puede insertar un case, pero solo cuentan los que tiene como autor un juror activo. Los demás se muestran como "no verificados" (*unverified*) y nunca entran en una evaluación ni en el export. Lo mismo vale para los testimonies: solo cuentan los de jurors activos.
- **R8. Retirada.** Un case está `dismissed` si tiene al menos un `CaseDismissal` válido: insertado por el autor del case o por un admin. Las retiradas de otros usuarios se ignoran.

## 7. Modelo de datos (base de datos de la app)

Patrón general: **registros de solo inserción con identidad verificada + estado calculado**. Las políticas garantizan que nadie inserta en nombre de otro (`claims.sub.eq(item.authorUserId)` y equivalentes); la validez de cada registro (autor juror activo, rol, no autoaprobación, retirada por autor o admin) se calcula al derivar el estado. Así se respetan las limitaciones de `@role` sin perder garantías.

Convenciones de Rayfin a respetar:
- Clave primaria siempre `id` UUID; sin claves compuestas.
- Todo campo de texto con `max` explícito (sin `max` genera `NVARCHAR(MAX)` y puede romper la generación de metadatos GraphQL).
- Nombres de campo en camelCase (`createdAt`, `judgeVerdict`, `authorUserId`), salvo las claves foráneas de relaciones.
- Relaciones con `@one()` / `@many()` y claves foráneas con el formato `{propiedad}_id` que exige Rayfin (`case_id`, `testimony_id`). Sin muchos a muchos.
- La identidad del usuario se guarda en un campo de texto `*UserId` (max 255) rellenado desde `claims.sub`. No es una clave foránea: no se puede relacionar con la entidad de sistema `USER`.
- Las claves foráneas son texto con max 36. Los valores cerrados usan `@set()`.
- Los emails de autor (`authorEmail`, `voterEmail`…) se guardan para comparar con `Juror.email` al calcular la validez; la política de inserción también exige `claims.email.eq(item.<role>Email)` si el token de Fabric trae ese claim.

| Entidad | Campos principales | Permisos |
|---|---|---|
| `Juror` | `email` (único), `role` (`expert` · `approver` · `admin`), `team` (opcional, solo informativo), `active` | Lectura: autenticados. Escritura: solo la Function de admin (ver nota) |
| `Agent` | `name`, `workspaceId`, `itemId`, `active` | Lectura: autenticados. Escritura: solo la Function de admin (ver nota) |
| `Case` | `agent_id`, `text` (max 1000), `category`, `tags`, `authorUserId`, `authorEmail`, `createdAt` | Crear: autenticados con `claims.sub.eq(item.authorUserId)`. Leer: autenticados. Sin actualizar ni borrar |
| `Testimony` | `case_id`, `answer` (max 2000), `definition` (max 1000), `authorUserId`, `authorEmail`, `createdAt` | Crear: igual que `Case`. Leer: autenticados. Sin actualizar ni borrar |
| `CaseDismissal` | `case_id`, `reason` (max 1000), `dismissedByUserId`, `dismissedByEmail`, `createdAt` | Crear: `claims.sub.eq(item.dismissedByUserId)`. Leer: autenticados. Sin actualizar ni borrar |
| `Vote` | `testimony_id`, `value` (`for` · `against`), `comment` (max 1000), `voterUserId`, `voterEmail`, `createdAt` | Crear: `claims.sub.eq(item.voterUserId)`. Leer: autenticados. Sin actualizar ni borrar |
| `Hearing` | `agent_id`, `stage`, `launchedByUserId`, `jobInstanceId`, `evaluationId`, `status`, `caseCount`, `createdAt` | Crear y actualizar: solo desde la Function |
| `Appeal` | `hearing_id`, `case_id`, `judgeVerdict`, `humanVerdict` (`correct` · `incorrect` · `ambiguous`), `reason`, `comment` (max 1000), `reviewerUserId`, `createdAt` | Crear: `claims.sub.eq(item.reviewerUserId)`. Leer: autenticados. Sin actualizar ni borrar |

**Nota sobre la escritura de admin:** las políticas no permiten comprobar pertenencia a una lista, y `ctx.getDataClient()` escribe con los permisos de quien llama. Por eso:
- El cliente solo tiene `read` sobre `Juror` y `Agent`; ningún rol tiene `create`, `update` ni `delete`.
- Toda escritura de admin pasa por una Function que (1) obtiene la identidad de quien llama (`sub` y `email`) del token Rayfin de la invocación, (2) comprueba en `Juror` que es un admin activo y rechaza la llamada si no, y (3) escribe con T-SQL usando el token `AudienceType.Sql` (identidad de la app), nunca con el cliente de datos de quien llama.
- El primer admin lo crea el script de seed, con el email pasado como variable al ejecutarlo; nunca se guarda en el repositorio.

**Cálculo del estado:** en el MVP, el frontend calcula el estado de cada pregunta (y si está verificada) a partir de propuestas, votos, retiradas y jurors para mostrarlo. El cálculo autoritativo (el que decide qué entra en una evaluación o en el export) se hace en el notebook o la Function correspondiente, con la misma lógica. Esa lógica vive en un único módulo compartido con tests.

## 8. Arquitectura e integraciones

```
[Fabric App: frontend React]
   │ GraphQL (Rayfin client)                 → BD de la app: Case, Testimony, Vote, Appeal…
   │ Connector fabric-sqlanalytics (lectura) → Lakehouse "jury_lh": tablas de resultados del SDK
   │ Functions
   │    ├─ admin: identidad de quien llama (token Rayfin) → comprueba admin en Juror
   │    │         → escribe Juror/Agent con T-SQL y el token AudienceType.Sql (identidad de la app)
   │    └─ lanzar evaluación → API Job Scheduler: ejecutar notebook con parámetros
   ▼
[Notebook "evaluate_agent"]
   1. Lee las preguntas aprobadas de la BD de la app (cálculo autoritativo de estado)
   2. evaluate_data_agent(df, agente, workspace, table_name, data_agent_stage)
   3. Escribe resultados en jury_lh (tablas del SDK + tabla de metadatos de ejecución)
[Notebook "export_case_law"]
   → Files/ground_truth/<agent>.csv con question, expected_answer, category, tags
```

Decisiones:
- **Plantilla:** Data App de Rayfin (framework de visuales y validación con Playwright). Activar datos en `rayfin.yml`.
- **Lectura de resultados:** connector `fabric-sqlanalytics` sobre `jury_lh`. Con CLI 1.36.2 usa por defecto la identidad de la app; acceso protegido con `@role` en las entidades del connector.
- **Lanzar evaluaciones:** Function con *audience* `Fabric` que llama a *Run On Demand Item Job* del notebook. Límite de 240 s por ejecución de Function: solo lanza el job y devuelve el `jobInstanceId`; el seguimiento del estado se hace por consulta posterior.
- **Región:** app, Lakehouse, notebooks y capacidad en la misma región (las conexiones al endpoint SQL entre regiones no están soportadas). Región con Fabric Apps disponible.

## 9. Pantallas

1. **Agentes:** lista de agentes registrados, nº de preguntas por estado y % de acuerdo juez-humano.
2. **Banco de preguntas (por agente):** columnas por estado (`under_review` · `ruled` · `disputed` · `dismissed`), filtros por categoría. Los cases no verificados (R7) se marcan como tales.
3. **Detalle de pregunta:** propuestas con su definición, votos con comentarios, historial; acciones de votar, proponer alternativa y retirar (autor o admin).
4. **Conflictos:** propuestas enfrentadas lado a lado con sus definiciones y quién respalda cada una.
5. **Ejecuciones:** lanzar evaluación, estado de cada ejecución, resumen de resultados.
6. **Revisión de veredictos:** cola con pregunta, respuesta esperada, respuesta del agente, veredicto del juez y botones de confirmar o corregir.
7. **Calidad del juez:** matriz juez frente a humano, % de acuerdo por agente y categoría, motivos de desacuerdo más frecuentes.
8. **Administración:** solo para admins. Alta, cambio de rol y desactivación de jurors; alta y desactivación de agentes. Todo pasa por la Function de admin.

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
| Expertos de negocio | **Jury** / **Juror** | **Jurado** / **Miembro del jurado** | `Juror` |
| El Data Agent evaluado | **Defendant** (ayuda) / **Agent** (listas) | **Acusado** (ayuda) / **Agente** (listas) | `Agent` |
| Pregunta con su historial | **Case** | **Caso** | `Case` |
| Respuesta esperada propuesta | **Testimony** | **Testimonio** | `Testimony` |
| Voto | **Vote** | **Voto** | `Vote` |
| Conflicto entre áreas | **Dispute** | **Disputa** | estado `disputed` |
| Corregir el veredicto del juez | **Appeal** | **Recurso** | `Appeal` |
| Respuestas aprobadas y conflictos resueltos | **Case law** | **Jurisprudencia** | vista `caseLaw` |
| Ejecución de evaluación | **Hearing** | **Vista** | `Hearing` |

Estados de un case: `under_review`, `ruled` (aprobado), `disputed`, `dismissed` (retirado).

Regla: la metáfora se usa en títulos y navegación, pero cada pantalla incluye una línea de ayuda en lenguaje llano para que un usuario de negocio entienda qué hace sin conocer la metáfora.

## 10. Requisitos no funcionales

- **Coste:** cada pregunta evaluada consume en torno a 50 s de tiempo de agente más el uso del LLM juez (dato observado por Quality Lab). La app muestra una estimación antes de lanzar una evaluación y permite evaluar un subconjunto.
- **Capacidad:** Data Agents y su evaluación requieren capacidad F2 o superior de pago; no funcionan en capacidades de prueba. Limitar los vCores máximos de la base de datos de la app.
- **Seguridad:** ningún token sale de las Functions. El cliente no es frontera de autorización: toda restricción se aplica con `@role`, políticas y Functions.
- **Trazabilidad:** todo voto, propuesta y veredicto humano queda registrado con autor y fecha; nada se borra.
- **Preview:** Fabric Apps, el SDK de evaluación y los Data Agents están en preview. Fijar versiones (CLI de Rayfin y `fabric-data-agent-sdk`) y documentarlas en el README.

## 11. Supuestos por verificar

### En la iteración I1a, tras el primer despliegue y antes de construir pantallas

Si alguno falla, se para y se replantea el diseño.

| # | Supuesto | Cómo verificarlo |
|---|---|---|
| R1 | Las políticas de `create` (`claims.sub.eq(item.authorUserId)`) se aplican de verdad. Data API builder documenta que sus *database policies* no se aplican a `create`; Rayfin documenta políticas de `create` | Prueba negativa: insertar un `Case` con un `authorUserId` ajeno debe fallar |
| S-A | Una Function puede conectarse a la base de datos SQL de la propia app con el token `AudienceType.Sql` (identidad de la app), insertar y leer una fila de `Juror`, y obtener `sub` y `email` de quien llama del token Rayfin | Function mínima desplegada e invocada desde el cliente |
| S-B | Una fila insertada con T-SQL aparece correctamente en la API de datos de Rayfin (columnas, `id`, campos de sistema que Rayfin espere) | Leer con el cliente la fila insertada por S-A y comparar con una fila creada por GraphQL |

### Durante la iteración 3

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
| `FabricApp-AgentJury` | La Fabric App con su base de datos, el Lakehouse `jury_lh` (resultados del SDK y bancos exportados) y los notebooks `evaluate_agent` y `export_case_law` |
| `FabricApp-AgentJury-Demo` | Datos de origen, modelo semántico y los Data Agents a evaluar |

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
| **I1a** | Datos activados; entidades `Juror`, `Agent`, `Case`, `Testimony` y `CaseDismissal`; seed; i18n EN/ES; tests; verificación de R1, S-A y S-B; pantallas 1–3 sin votos | Un juror crea preguntas y propuestas en la app desplegada; R1, S-A y S-B confirmados |
| **I1b** | Function de admin (T-SQL con identidad de la app) y pantalla 8 para gestionar jurors y agentes | Solo un admin puede dar de alta o modificar jurors y agentes; cualquier otro intento se rechaza |
| **I2** | `Vote`, módulo de cálculo de estado con tests, reglas R1–R8, pantalla 4 | Los estados se calculan bien en todos los casos de prueba, incluidos conflictos, autoaprobación, cases no verificados y retiradas |
| **I3** | Lakehouse `jury_lh`, notebook `evaluate_agent`, Function de lanzamiento, connector de lectura, pantalla 5. Verificar S1–S5 | Una evaluación lanzada desde la app produce resultados visibles en la app |
| **I4** | `Appeal`, pantallas 6 y 7, vuelta a revisión por respuesta esperada incorrecta | Se calcula el % de acuerdo juez-humano por agente y categoría |
| **I5** | Notebook `export_case_law` y prueba de importación en Quality Lab | El CSV exportado se carga sin errores en Quality Lab |

## 13. Criterios de aceptación del MVP

- [ ] Un usuario no puede crear un voto, propuesta, retirada o veredicto en nombre de otro.
- [ ] Solo un admin puede crear o modificar jurors y agentes; el cliente no tiene permisos de escritura sobre ellos.
- [ ] Un case cuyo autor no es juror activo aparece como no verificado y no entra en evaluaciones ni en el export.
- [ ] Una retirada solo cuenta si la hace el autor del case o un admin.
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
