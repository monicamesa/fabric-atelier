# Plan de la iteración I1c: pantallas 1–3 (Home, Cases, Case detail)

> Estado: **propuesta para revisión**. No hay código escrito.
> Fuentes: [especificación v0.4](../especificacion-general.md) (secciones 5, 6, 7 y 9), [AGENTS.md](../../AGENTS.md) (reglas 15–19, 23, 25–30), [guía de diseño](../design/design-guide.md) y los mockups [`home.html`](../design/mockups/home.html), [`cases.html`](../design/mockups/cases.html) y [`case-detail.html`](../design/mockups/case-detail.html). Base: la secretaría de I1b y sus componentes en `src/components/docket/`.

## 1. Objetivo y criterio de salida

Un jurado propone cases, añade testimonies, vota y ve cómo cada case pasa a fallado o en disputa, sin que nadie pueda escribir un estado a mano.

**Criterio de salida:** en la app desplegada, dos jurados (uno experto y uno aprobador) llevan un case de `under_review` a `ruled`. Otro case llega a `disputed` con dos respuestas respaldadas, y su tabla de diferencias señala dónde difieren las definiciones. El autor retira un tercero, y la retirada de un no autor se ignora. Inicio, Cases y el detalle muestran lo mismo.

**Fuera de I1c:**
- Pantalla 4 (conflictos lado a lado de todos los cases). En I1c, la disputa se ve en el detalle de cada case.
- Vistas (hearings), recursos, confianza en el juez real y export.
- "Story of the week" y "Juror of the week" de `home.html` (D9).

## 2. Lo que hay que añadir al modelo

I1c necesita votos, que la especificación dejaba para I2 (D1).

| Entidad | Campos | Permisos |
|---|---|---|
| `Vote` (nueva) | `testimony_id` (`@uuid()`, `@one(() => Testimony)`), `value` (`for` · `against`), `comment` (max 1000, opcional), `voterUserId` (max 255), `voterEmail` (max 254), `createdAt` | Crear: `claims.sub.eq(item.voterUserId).and(claims.email.eq(item.voterEmail))`. Leer: autenticados. Sin actualizar ni borrar |
| `Testimony` | Campos opcionales de definición estructurada para la tabla de diferencias (D3): `criterion`, `timeWindow`, `population`, `source` (max 300 cada uno). `definition` se mantiene como resumen | Sin cambios |
| `Case` | Nada | Sin cambios |

Las entidades siguen siendo de solo inserción (reglas 15 y 23). Un voto en contra exige comentario en la interfaz; la política no puede comprobar que el texto no esté vacío, así que el cálculo trata como no válido un voto en contra sin comentario (D4).

## 3. Cálculo del estado (R1–R8): un solo módulo

Amplía `src/rules/case-validity.ts` (regla 18). Funciones puras, sin red ni fechas del sistema:

| Función | Regla | Qué hace |
|---|---|---|
| `currentVotes(votes)` | **R1** | Por jurado y testimony, solo cuenta su último voto (por `createdAt`; a igualdad, por `id`). Nada se edita: cambiar de opinión es un voto nuevo |
| `countsForTestimony(vote, testimony, jurors)` | **R2**, **R7** | No cuenta el voto del autor de la testimony, ni el de quien no es jurado activo |
| `isValidTestimony(testimony, jurors)` | **R7** | Solo cuentan testimonies de jurados activos; las demás se muestran como no verificadas |
| `getCaseState(case, testimonies, votes, dismissals, jurors, n = 1)` | **R3**, **R4**, **R6**, **R8** | `dismissed` si hay una retirada válida (R8). Si no, `disputed` si dos o más testimonies válidas tienen algún voto a favor válido, o una tiene votos a favor y en contra de aprobadores a la vez (R4). Si no, `ruled` si una testimony tiene al menos `n` votos a favor válidos, uno de ellos de un aprobador y ningún voto en contra vigente de un aprobador (R3). Si no, `under_review` |
| `rulingTestimony(...)` | **R5** (preparación) | La testimony que hace el case `ruled`. I3 la usará como respuesta esperada |
| `caseEvents(...)` | **R6** | Los hechos de un case en orden (propuesto, respuesta añadida, voto, fallado, en disputa, retirado) para el acta del juicio y el ticker. "Fallado" y "en disputa" se calculan repasando los votos en orden; nunca se guardan |
| `needsMyVote(case, me, ...)` | — | Case verificado, `under_review` o `disputed`, con alguna testimony válida que no sea mía y sin voto vigente mío en ese case (D5) |

**La verdad se calcula, no se escribe (R6):** ninguna pantalla escribe un estado. Cada pantalla lee cases, testimonies, votos, retiradas y jurados, y llama a `getCaseState`. El notebook de I3 aplicará la misma lógica para lo que sea autoritativo.

**Prioridad entre estados:** `dismissed` > `disputed` > `ruled` > `under_review`. Un case fallado vuelve a disputa si después aparece apoyo válido a otra testimony; el acta lo cuenta.

## 4. Pantallas

Todas usan la cabecera, los tokens y los componentes de I1b, siguen [la guía](../design/design-guide.md) y tienen línea de ayuda, selector EN/ES y tema. El contenido escrito por los usuarios no se traduce (regla 8).

### 4.1 Home (`home.html`)

| Zona | Contenido | Datos y reglas |
|---|---|---|
| Selector de agente | Pestañas "Sales Agent · 18" con el nº de cases por agente activo. El agente elegido va en la URL (`#home?agent=<id>`), no en el navegador (D6) | `Agent` (activos) |
| Titular | Hero "Who judges the judge?" y línea de ayuda | i18n |
| Docket de hoy | Filas `#número · pregunta · estado + siguiente paso` ("Cast your vote", "Settle the dispute"; los cases cerrados muestran el resultado, no un botón). Número del case: D7 | `getCaseState`, `needsMyVote` |
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
- **Tabla de diferencias** ("Where the definitions part ways"), solo si el case está en disputa: filas criterio, ventana temporal, a quién incluye y fuente. Las filas donde las respuestas difieren van con `--dispute-bg` (D3).
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
- **Desplegadas (`i1c-checks.mjs`):**
  - Votar con la propia identidad funciona; votar con el `sub` o el email de otro se rechaza al insertar.
  - No hay mutaciones `updateVote` ni `deleteVote`, ni de `Case`, `Testimony` o `CaseDismissal`.
  - Leer sin sesión se rechaza.
  - Los cases, testimonies y votos de las comprobaciones llevan la etiqueta `automated-check` y no aparecen en Home ni en Cases (D12).

## 8. Decisiones que necesito

- **D1 — Votos en I1c.** Las pantallas que pides necesitan votos ("waiting for my vote", confirmar el fallo), que la especificación pone en I2. Propuesta: traer a I1c `Vote` y el cálculo completo de R1–R8. I2 queda para la pantalla 4 (conflictos) y lo que surja. Actualizo la sección 12 de la especificación.
- **D2 — Quién puede actuar.** Propuesta: solo los jurados activos ven "Propose a case", votar y añadir respuestas. El resto ve todo en solo lectura con un aviso. R7 sigue protegiendo el cálculo aunque alguien inserte por su cuenta.
- **D3 — Tabla de diferencias.** El mockup compara filas ("What makes a customer active", "Time window", "Who counts", "Source table"), pero hoy `definition` es texto libre. Propuesta: cuatro campos opcionales en `Testimony` (`criterion`, `timeWindow`, `population`, `source`) y `definition` como resumen de una frase. Alternativa: mostrar las dos definiciones en texto libre lado a lado, sin filas.
- **D4 — Voto en contra sin comentario.** Propuesta: la interfaz lo exige, y el cálculo no cuenta un voto en contra con el comentario vacío.
- **D5 — "Needs your vote".** Propuesta: cases verificados en revisión o en disputa, con alguna respuesta válida que no sea mía y sin voto vigente mío en el case. ¿Cuentan también para los admins?
- **D6 — Agente seleccionado.** Propuesta: en la URL (`#home?agent=…`), porque el navegador solo guarda el idioma (regla 2). Sin agente en la URL, el primero activo por nombre.
- **D7 — Número del case ("#015").** No hay campo secuencial. Propuesta: número de orden por `createdAt` dentro del agente, calculado al leer. Es estable porque nada se borra. Alternativa: los 4 primeros caracteres del id en mono.
- **D8 — Categoría.** Propuesta: texto libre con sugerencias de las categorías ya usadas en el agente. Alternativa: lista cerrada por agente, gestionada en la secretaría.
- **D9 — "Story of the week" y "Juror of the week".** Propuesta: fuera de I1c. La historia necesita recursos (I4); "Juror of the week" puede volver cuando haya votos suficientes.
- **D10 — Proponer un case son dos inserciones** (`Case` y su primera `Testimony`), no atómicas. Propuesta: si la segunda falla, el case queda sin respuesta, se muestra con "No answer yet. Add the first one." y el formulario conserva lo escrito para reintentar. Alternativa: una Function que inserte las dos en una transacción, más compleja y sin la política de identidad de GraphQL.
- **D11 — Voto de un admin.** Propuesta: cuenta como el de un experto, no como el de un aprobador (R3 pide "un aprobador": negocio, no el equipo de datos).
- **D12 — Datos de las comprobaciones.** Los cases que creen las comprobaciones se verían en el docket de todos. Propuesta: crear antes el despliegue de pruebas de `estado.md` y ejecutar ahí `i1c-checks.mjs`. Mientras no exista: etiqueta `automated-check` en `Case.tags`, oculta por defecto con la misma casilla "Show automated checks". Solo cuenta si la puso un admin activo, como en I1b.
- **D13 — `createdAt` lo pone el cliente.** Ordena votos (R1) y el acta. Un cliente malicioso podría fechar un voto en el futuro para que gane siempre. Propuesta: en I1c, el cálculo ignora votos con fecha posterior a "ahora + 5 min" y los marca en el acta. A medio plazo, comprobar si Rayfin admite un valor por defecto del servidor para `@date`.
- **D14 — Volumen.** El cliente lee todos los cases, testimonies y votos del agente, con paginación. Propuesta: suficiente para el MVP (cientos de cases). Si crece, se mueve el cálculo a una vista o a la Function.

## 9. Riesgos

- **Rendimiento con muchos votos:** el cálculo es O(votos) por case. Se memoriza por agente en `use-docket`.
- **Consistencia entre pantallas:** las tres usan el mismo hook y el mismo módulo de reglas, así que no pueden contradecirse.
- **Animaciones** (mazo, sellos, ticker): siempre con `prefers-reduced-motion` y sin depender de ellas para entender el estado.

## 10. Orden de trabajo propuesto

1. Modelo (`Vote`, campos de `Testimony`), despliegue y comprobación de políticas.
2. Módulo de reglas con todos sus tests.
3. Servicios y `use-docket`.
4. Case detail, porque contiene casi todos los componentes nuevos.
5. Cases.
6. Home.
7. Comprobaciones desplegadas, capturas (EN/ES × claro/oscuro, móvil) y parada para revisión.
