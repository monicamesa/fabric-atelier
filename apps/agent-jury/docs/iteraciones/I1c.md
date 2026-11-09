# Plan de la iteración I1c: pantallas 1–3 (Home, Cases, Case detail)

> Estado: **construida y desplegada solo en pruebas (2026-11-09), pendiente de revisión**. Sección 8: decisiones; sección 11: resultados.
> Fuentes: [especificación v0.4](../especificacion-general.md) (secciones 5, 6, 7 y 9), [AGENTS.md](../../AGENTS.md) (reglas 15–19, 23, 25–30), [guía de diseño](../design/design-guide.md) y los mockups [`home.html`](../design/mockups/home.html), [`cases.html`](../design/mockups/cases.html) y [`case-detail.html`](../design/mockups/case-detail.html). Base: la secretaría de I1b y sus componentes en `src/components/docket/`.

## 1. Objetivo y criterio de salida

Un jurado propone cases, añade testimonies, vota y ve cómo cada case pasa a fallado o en disputa, sin que nadie pueda escribir un estado a mano.

**Criterio de salida:** en el despliegue de pruebas, dos jurados (un experto y un aprobador) llevan un case de `under_review` a `ruled` con los 2 votos que exige R3. Otro case llega a `disputed` con dos respuestas respaldadas, y su tabla de diferencias señala dónde difieren las definiciones. El autor retira un tercero, y la retirada de un no autor se ignora. Inicio, Cases y el detalle muestran lo mismo.

**Fuera de I1c:**
- Pantalla 4 (conflictos lado a lado de todos los cases). En I1c, la disputa se ve en el detalle de cada case.
- Vistas (hearings), recursos, confianza en el juez real y export.
- "Story of the week" y "Juror of the week" de `home.html` (D9).

## 2. Lo que hay que añadir al modelo

I1c necesita votos, que la especificación dejaba para I2 (D1).

| Entidad | Campos | Permisos |
|---|---|---|
| `Vote` (nueva) | `testimony_id` (`@uuid()`, `@one(() => Testimony)`), `value` (`for` · `against`), `comment` (max 1000, opcional), `voterUserId` (max 255), `voterEmail` (max 254), `createdAt` | Crear: `claims.sub.eq(item.voterUserId).and(claims.email.eq(item.voterEmail))`. Leer: autenticados. Sin actualizar ni borrar |
| `Testimony` | Campos opcionales de definición estructurada para la tabla de diferencias (D3): `criterion`, `timeWindow`, `population`, `source` (max 300 cada uno). `definition` sigue siendo el resumen de una frase | Sin cambios |
| `Case` | Nada | Sin cambios |

Las entidades siguen siendo de solo inserción (reglas 15 y 23). Un voto en contra exige comentario en la interfaz; la política no puede comprobar que el texto no esté vacío, así que el cálculo ignora un voto en contra con el comentario vacío (D4).

**`createdAt` no puede generarlo el servidor (D13, comprobado):**
- El `default` de los decoradores de Rayfin (`@date({ default })`) solo admite un valor fijo, no "ahora".
- Las tablas que crea Rayfin solo tienen un valor por defecto del servidor en `id` (`newid()`); `createdAt` es `datetime2 NOT NULL` sin valor por defecto, y no hay columnas de sistema con fecha.
- Un `DEFAULT` o un trigger añadidos a mano con T-SQL quedarían fuera de lo que gestiona Rayfin, y el cliente seguiría pudiendo enviar `createdAt`.
- **Se aplica la alternativa:** el cálculo ignora los registros con `createdAt` más de 5 minutos en el futuro (respecto al reloj de quien calcula), el acta los marca, y la especificación lo documenta como riesgo conocido.

## 3. Cálculo del estado (R1–R8): un solo módulo

Amplía `src/rules/case-validity.ts` (regla 18). Funciones puras, sin red ni fechas del sistema:

| Función | Regla | Qué hace |
|---|---|---|
| `currentVotes(votes)` | **R1** | Por jurado y testimony, solo cuenta su último voto (por `createdAt`; a igualdad, por `id`). Nada se edita: cambiar de opinión es un voto nuevo |
| `countsForTestimony(vote, testimony, jurors)` | **R2**, **R7** | No cuenta el voto del autor de la testimony, ni el de quien no es jurado activo |
| `isValidTestimony(testimony, jurors)` | **R7** | Solo cuentan testimonies de jurados activos; las demás se muestran como no verificadas |
| `getCaseState(case, testimonies, votes, dismissals, jurors)` | **R3**, **R4**, **R6**, **R8** | `dismissed` si hay una retirada válida (R8). Si no, `disputed` si dos o más testimonies válidas tienen algún voto a favor válido, o una tiene votos a favor y en contra de aprobadores a la vez (R4). Si no, `ruled` si una testimony tiene al menos `CONSENSUS_MIN_VOTES` votos a favor válidos, uno de ellos de un aprobador y ningún voto en contra vigente de un aprobador (R3). Si no, `under_review` |
| `rulingTestimony(...)` | **R5** (preparación) | La testimony que hace el case `ruled`. I3 la usará como respuesta esperada |
| `caseEvents(...)` | **R6** | Los hechos de un case en orden (propuesto, respuesta añadida, voto, fallado, en disputa, retirado) para el acta del juicio y el ticker. "Fallado" y "en disputa" se calculan repasando los votos en orden; nunca se guardan |
| `needsMyVote(case, me, ...)` | — | Case verificado, `under_review` o `disputed`, con alguna testimony válida que no sea mía y sin voto vigente mío en ese case (D5) |

**Umbral de R3:** `CONSENSUS_MIN_VOTES = 2`, en una sola constante (`src/rules/consensus.ts`) que usan el módulo de reglas y los textos de la interfaz ("2 votes settle the case"). Con 1, un aprobador fallaría solo. Los tests cubren n = 1, 2 y 3. Un voto de admin cuenta como el de un experto, nunca como el de un aprobador (D11).

**Fechas futuras (D13):** los votos, testimonies y retiradas con `createdAt` más de 5 minutos en el futuro no cuentan y el acta los marca como "date in the future".

**La verdad se calcula, no se escribe (R6):** ninguna pantalla escribe un estado. Cada pantalla lee cases, testimonies, votos, retiradas y jurados, y llama a `getCaseState`. El notebook de I3 aplicará la misma lógica para lo que sea autoritativo.

**Prioridad entre estados:** `dismissed` > `disputed` > `ruled` > `under_review`. Un case fallado vuelve a disputa si después aparece apoyo válido a otra testimony; el acta lo cuenta.

## 4. Pantallas

Todas usan la cabecera, los tokens y los componentes de I1b, siguen [la guía](../design/design-guide.md) y tienen línea de ayuda, selector EN/ES y tema. El contenido escrito por los usuarios no se traduce (regla 8).

### 4.1 Home (`home.html`)

| Zona | Contenido | Datos y reglas |
|---|---|---|
| Selector de agente | Pestañas "Sales Agent · 18" con el nº de cases por agente activo. El agente elegido va en la URL (`#home?agent=<id>`), no en el navegador (D6) | `Agent` (activos) |
| Titular | Hero "Who judges the judge?" y línea de ayuda | i18n |
| Docket de hoy | Filas `#id · pregunta · estado + siguiente paso` ("Cast your vote", "Settle the dispute"; los cases cerrados muestran el resultado, no un botón). El número es la parte inicial del id en mono (D7) | `getCaseState`, `needsMyVote` |
| "N cases need your vote" | Recuento y enlace al tablero filtrado | `needsMyVote` |
| Confianza en el juez | "No hearings yet" con una frase de qué medirá, hasta I3 | — |
| Glosario | Case, Ruling, Hearing, Appeal (sección 5 de la guía) | i18n |
| Ticker de veredictos | Últimos hechos del agente en palabras llanas ("all 3 jurors agree"). Se pausa con hover y foco, y queda estático con movimiento reducido | `caseEvents` |
| "Propose a case" | Botón primario. Formulario: pregunta (max 1000), categoría, etiquetas y la primera respuesta con su definición (D3, D8). Solo para jurados activos (D2) | Inserta `Case` y luego `Testimony` (D10) |

### 4.2 Cases (`cases.html`)

- Cuatro columnas: Under review, Disputed, Ruled, Dismissed. Cada una con recuento y una frase ("Needs votes from the jury"). En móvil las columnas se apilan.
- Recortes de case: los disputados con `--dispute-bg` y borde coral; los retirados atenuados, con borde discontinuo y la pregunta tachada; los no verificados con la marca "Unverified" (R7).
- Búsqueda en pregunta, categoría y etiquetas (en el cliente, sin distinguir mayúsculas ni acentos).
- Filtros "All", "Waiting for my vote · n" y "Proposed by me" (con `aria-pressed`). El filtro activo va en la URL.

### 4.3 Case detail (`case-detail.html`)

- **Pregunta** en Fraunces grande, con su estado y una frase que explica por qué está así ("Needs one approver's vote").
- **Testimonies** ("The two answers on the table"): etiqueta "ANSWER A · NOMBRE, EQUIPO", la respuesta, la definición en una frase, la barra de votos (a favor y en contra válidos) y "Vote for answer A". Los votos que no cuentan (propios, de no jurados, sustituidos) se ven en el acta, pero no en la barra.
- **Tabla de diferencias** ("Where the definitions part ways"), si el case está en disputa: filas criterio, ventana temporal, a quién incluye y fuente, con `--dispute-bg` en las filas que difieren. Solo se pinta si las dos testimonies comparadas tienen campos estructurados; si no, las dos respuestas lado a lado con la pista "Add the definition to see where they differ" (D3).
- **Sin respuestas:** el autor del case ve "Add your answer" mientras el case no tenga ninguna (D10).
- **Acta del juicio** (court record): línea de tiempo de solo lectura con la nota "The record is never edited".
- **Acciones por rol** (D2). La interfaz no es una frontera de seguridad: las políticas y el cálculo deciden.

| Quién | Puede |
|---|---|
| Experto activo | Votar a favor o en contra (en contra con comentario) en testimonies ajenas. Añadir otra respuesta |
| Aprobador activo | Lo mismo. Además, "Confirm the ruling" en la testimony que lidera, que es su voto a favor (R3) |
| Autor del case | "Dismiss this case" con motivo (R8) |
| Admin | Retirar cualquier case (R8). Su voto cuenta como el de un experto (D11) |
| No jurado | Solo lectura, con un aviso de por qué |

En la propia testimony no hay botón de voto, con la explicación "Your vote doesn't count on your own answer" (R2).

## 5. Estados de cada pantalla

| Pantalla | Cargando | Error | Vacío |
|---|---|---|---|
| Home | Esqueletos del docket (filas), de las pestañas de agentes y del ticker, con "The jury is deliberating…" | "Objection!" con reintento y detalles técnicos plegados; el resto de la página sigue usable | Sin agentes activos: "No agents on trial yet" (y el enlace a la secretaría para admins). Agente sin cases: "No cases yet. Propose the first question your agent should answer." |
| Cases | Cuatro columnas de esqueletos | Igual | Por columna, con su frase. Búsqueda sin resultados: "No case matches" con "Clear the search" |
| Case detail | Esqueletos de la pregunta, las dos tarjetas y el acta | Igual. Case inexistente: "This case isn't on the docket" y vuelta a Cases | Sin testimonies: "No answer yet. Add the first one." |
| Formularios | Botón con "Proposing…" | Error claro sin perder lo escrito (como en I1b) | — |

## 6. Ficheros

| Fichero | Cambio |
|---|---|
| `rayfin/data/Vote.ts` (nuevo), `Testimony.ts`, `schema.ts` | Entidad `Vote` y campos de definición |
| `src/rules/case-validity.ts` (+ spec) | Sección 3 |
| `src/data/cases.service.ts`, `votes.service.ts` (nuevo, + specs) | Lecturas por agente y case; inserciones con la identidad de la sesión |
| `src/hooks/use-docket.ts` | Carga cases, testimonies, votos, retiradas y jurados de un agente, y calcula los estados una sola vez |
| `src/components/docket/` | Docket row, case clipping, testimony card, diff table, court record, stamp, gavel, ticker, glossary, judge-trust placeholder |
| `src/screens/home/`, `src/screens/cases/`, `src/screens/case-detail/` (+ specs) | Las tres pantallas |
| `src/App.tsx` | Rutas por hash: `#home`, `#cases?agent=…&filter=…`, `#case/<id>` |
| `src/locales/en.json`, `es.json` | Textos |
| `scripts/i1c-checks.mjs` | Comprobaciones desplegadas (sección 7) |

## 7. Tests

- **Reglas (`case-validity.spec.ts`)**, con una tabla de escenarios:
  - R1: el último voto sustituye al anterior, y el orden no depende del orden de lectura.
  - R2: el voto del autor no cuenta.
  - R3: `n` votos a favor con un aprobador → fallado; sin aprobador → en revisión; con un aprobador en contra → no fallado.
  - R4: dos testimonies apoyadas, o un aprobador a favor y otro en contra → en disputa.
  - R7: testimonies y votos de no jurados o de jurados inactivos no cuentan.
  - R8: la retirada del autor o de un admin vale; la de otro, no.
  - Prioridad entre estados, voto en contra sin comentario, y `needsMyVote`.
  - `caseEvents` reproduce la secuencia fallado → en disputa.
- **Servicios:** la identidad sale de la sesión; no existen `update` ni `delete`.
- **Pantallas:**
  - Estados de carga, error y vacío.
  - Acciones visibles por rol y ocultas en la propia testimony.
  - Filtros y búsqueda.
  - La tabla de diferencias resalta solo las filas distintas.
  - Cambio EN/ES.
  - Ticker estático con movimiento reducido.
- **Accesibilidad:** foco visible con teclado (la comprobación de I1b, ampliada a estas pantallas), `aria-pressed` en filtros, `aria-current` en navegación, `role="status"` y `role="alert"`.
- **Desplegadas (`i1c-checks.mjs`), solo contra el despliegue de pruebas (D12):**
  - Votar con la propia identidad funciona; votar con el `sub` o el email de otro se rechaza al insertar.
  - No hay mutaciones `updateVote` ni `deleteVote`, ni de `Case`, `Testimony` o `CaseDismissal`.
  - Leer sin sesión se rechaza.
  - Se anota el número de peticiones y la duración, y el consumo de CU del workspace de pruebas en esa ventana (D14).

## 8. Decisiones (tomadas el 2026-11-09)

- **D1 — Votos en I1c.** Sí: `Vote` y el cálculo completo de R1–R8 entran en I1c. La sección 12 de la especificación se actualiza: I2 queda para la pantalla 4 (conflictos) y lo que surja.
- **D2 — Quién puede actuar.** Solo los jurados activos ven "Propose a case", votar y añadir respuestas. El resto, solo lectura con una explicación breve.
- **D3 — Tabla de diferencias.** Cuatro campos opcionales en `Testimony` (`criterion`, `timeWindow`, `population`, `source`); `definition` sigue siendo el resumen de una frase. La tabla solo se pinta si las dos testimonies comparadas tienen campos estructurados. Si no, las dos respuestas lado a lado con "Add the definition to see where they differ" / "Añade la definición para ver en qué se diferencian".
- **D4 — Voto en contra.** La interfaz exige comentario; el cálculo ignora un voto en contra con el comentario vacío.
- **D5 — "Needs your vote".** Como se propuso, y también para los admins (su voto cuenta como el de un experto, D11).
- **D6 — Agente seleccionado.** En la URL; por defecto, el primer agente activo por nombre.
- **D7 — Número del case.** Número de orden por `createdAt` (a igualdad, por `id`) dentro del agente, pero solo si `createdAt` lo genera el servidor (D13). Como D13 acaba en la alternativa, se usan **los 4 primeros caracteres del id en mono**.
- **D8 — Categoría.** Texto libre con sugerencias de las categorías existentes, normalizadas (sin espacios sobrantes y sin distinguir mayúsculas), para que "Sales" y "sales " no sean dos categorías.
- **D9 — "Story of the week" y "Juror of the week".** Fuera de I1c.
- **D10 — Proponer un case son dos inserciones.** Como se propuso. Además, en el detalle, el autor del case ve "Add your answer" / "Añadir tu respuesta" mientras el case no tenga testimony.
- **D11 — Voto de un admin.** Cuenta como el de un experto, nunca como el de un aprobador.
- **D12 — Despliegue de pruebas.** Se crea antes que nada: un segundo item de la app en su propio workspace, con su `rayfin/.env.test` (no versionado, documentado en `private.example.env`). Los scripts de comprobación se niegan por defecto a ejecutarse contra el item de producción. Las comprobaciones de I1a e I1b también pasan a ese despliegue. Sin IDs de items ni URLs en el repositorio. Se descarta la etiqueta `automated-check` en cases, testimonies y votos.
- **D13 — `createdAt` del servidor.** Comprobado: Rayfin no lo admite (sección 2). Se aplica la alternativa (sección 3) y la especificación lo documenta como riesgo conocido.
- **D14 — Volumen.** Suficiente para el MVP. El consumo de CU de las comprobaciones de I1c se anota en la sección 11 como referencia.

**Ajuste del plan:** el umbral de R3 pasa de 1 a 2 (sección 3).

## 9. Riesgos

- **Rendimiento con muchos votos:** el cálculo es O(votos) por case. Se memoriza por agente en `use-docket`.
- **Consistencia entre pantallas:** las tres usan el mismo hook y el mismo módulo de reglas, así que no pueden contradecirse.
- **Animaciones** (mazo, sellos, ticker): siempre con `prefers-reduced-motion` y sin depender de ellas para entender el estado.

## 10. Orden de trabajo

0. Despliegue de pruebas (D12) y traslado de las comprobaciones de I1a e I1b.
1. Modelo (`Vote`, campos de `Testimony`), despliegue y comprobación de políticas.
2. Módulo de reglas con todos sus tests.
3. Servicios y `use-docket`.
4. Case detail, porque contiene casi todos los componentes nuevos.
5. Cases.
6. Home.
7. Comprobaciones desplegadas, capturas (EN/ES × claro/oscuro, móvil) y parada para revisión.

## 11. Resultados (2026-11-09)

**Construido (pasos 0–7):**

| Paso | Resultado |
|---|---|
| 0 | Despliegue de pruebas en su propio workspace (`scripts/deploy-test.mjs`, `scripts/lib/deployment-target.mjs`). Los scripts de comprobación van contra pruebas por defecto y se niegan con producción salvo `--target=production --allow-production`. `run-sql.mjs` se niega a ejecutar sin `--target=test` los ficheros marcados `-- target: test-only` |
| 1 | `Vote` y los cuatro campos de definición en `Testimony`, desplegados en pruebas |
| 2 | `src/rules/case-validity.ts` con R1–R8, `analyzeCase` (estado y motivo), `needsMyVote` y `caseEvents`; `CONSENSUS_MIN_VOTES = 2` en `src/rules/consensus.ts` |
| 3 | `cases.service.ts` (lecturas por lotes de 50 ids, `createVote`), `src/data/docket.ts` (agrupa y calcula los estados una vez por agente) y `use-docket` |
| 4 | Case detail: tarjetas de respuesta con votos, voto en contra con motivo obligatorio, tabla de diferencias o respuestas lado a lado (D3), acta, "Add your answer" del autor (D10), retirada por el autor o un admin |
| 5 | Cases: cuatro columnas con su frase, búsqueda sin tildes ni mayúsculas, filtros "Waiting for my vote" y "Proposed by me" en la URL, "+ n more" |
| 6 | Home: ticker (pausa con hover y foco, estático con movimiento reducido), titular, confianza en el juez como marcador "—" hasta I3, glosario, "Today's docket" con los votos pendientes primero, selector de agente en la URL (D6) y formulario para proponer un case |
| 7 | Rutas por hash (`#home?agent=`, `#cases?agent=&filter=&q=`, `#case/<id>`), con historial: el botón Atrás funciona |

**Tests:** 30 ficheros, 324 tests (`npm test`); `tsc -b` y `eslint` sin errores. Nuevos: reglas con n = 1, 2 y 3, docket, rutas, formato de días relativos, visor (quién puede actuar), vistas (orden de Home, filtros, búsqueda, filas distintas de la tabla), servicios (`createVote`, campos opcionales, lotes) y la pantalla de detalle (motivo obligatorio, sin voto en la respuesta propia, "Add your answer", solo lectura).

**Comprobaciones desplegadas (`scripts/i1c-checks.mjs`, despliegue de pruebas): 19 de 19.**

| Comprobación | Resultado |
|---|---|
| Leer votos sin sesión | Rechazado |
| Case y testimony con los cuatro campos de definición | Aceptados y leídos tal cual |
| Campo de definición de más de 300 caracteres; comentario de más de 1000 | Rechazados (el servidor responde "Internal server error", no un mensaje de validación) |
| Voto a favor y voto en contra con comentario, con la propia identidad | Aceptados; los dos se conservan |
| Voto con el `sub` o el email de otro | Rechazados al insertar ("Could not insert row") |
| Voto con un valor distinto de `for`/`against` | Rechazado por la restricción |
| `updateVote`, `deleteVote`, `updateTestimony` | No existen en el esquema |
| Limpieza | El autor retira el case de la comprobación |

Las comprobaciones de I1a (46/46) e I1b (23/23) también pasan contra el despliegue de pruebas.

**Volumen (D14):** 17 peticiones de datos en 368,5 s, inicio de sesión incluido (unos 20 s por petición en esta ejecución; la primera conexión T-SQL a la base de datos de pruebas también agotó su tiempo y funcionó al repetirla). El consumo de CU no se puede leer desde los scripts: hay que consultarlo en la app Fabric Capacity Metrics para el workspace de pruebas en la ventana de la ejecución. Queda pendiente anotarlo aquí.

**Datos de ejemplo en pruebas:** `rayfin/seed/docket-examples.sql` (solo pruebas) añade un case en cada estado con los jurados de ejemplo, porque una sola cuenta no puede producir votos de varios jurados. Las capturas usan esos datos.

**Pendiente para cerrar el criterio de salida:** que dos personas reales (un experto y un aprobador) lleven un case a `ruled` desde la app desplegada en pruebas. Con una sola cuenta solo se puede comprobar que el voto propio no cuenta (R2).

**Producción:** sin cambios. I1c solo está desplegada en pruebas.
