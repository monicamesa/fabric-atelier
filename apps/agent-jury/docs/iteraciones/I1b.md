# Plan de la iteración I1b: "Clerk's office"

> Estado: **implementada y desplegada (2026-11-09)**, pendiente de revisión visual. Decisiones D1–D5 tomadas (sección 7) y resultados en la sección 9.
> Fuentes: [especificación v0.4](../especificacion-general.md) (secciones 4, 5 F8, 7 y 9), [AGENTS.md](../../AGENTS.md) (reglas 20, 21, 23, 24 y 27–30), [guía de diseño](../design/design-guide.md) ("Admin table", estados, accesibilidad) y [mockup `admin.html`](../design/mockups/admin.html). Base técnica: resultados del spike de identidad de admin en la sección 6 de [I1a.md](I1a.md).

## 1. Objetivo y criterio de salida

Un admin gestiona jurors y agentes desde la app, y cualquier otro intento se rechaza y queda en el registro de admin.

**Criterio de salida:** en la app desplegada, un admin da de alta un juror, le cambia el rol, lo desactiva y registra y retira un agente. Las mismas peticiones hechas por alguien que no es admin, por otro usuario o fuera de plazo se rechazan, y todas aparecen en el registro.

## 2. Flujo de seguridad (ya verificado en el spike)

1. El navegador inserta un `AdminRequest` (`requesterEmail`, `action`, `payload` JSON, `createdAt`). La política de inserción (`claims.email = requesterEmail`) demuestra quién lo pide.
2. El navegador invoca `clerkExecute(requestId)`, con solo el id.
3. La Function, con T-SQL y la identidad de la app (`AudienceType.Sql`):
   1. Lee la fila y rechaza si tiene más de 2 minutos o fecha futura.
   2. Comprueba que `requesterEmail` es un admin activo.
   3. Valida `action` y `payload`.
   4. Ejecuta la acción y escribe el `AdminRequestResult` (`done` o `rejected`, con el motivo) en la misma transacción. `requestId` es único, así que cada petición se ejecuta una sola vez.
4. **Nunca** se ejecutan parámetros de la llamada, solo lo guardado en la fila.

**Nombre:** la Function se llama `clerk*` y no `admin*`, porque las rutas `admin` y `runtime` están reservadas por el host de Azure Functions (regla 24).

## 3. Acciones de `clerkExecute`

| Acción | Payload | Reglas del servidor |
|---|---|---|
| `swearInJuror` | `email`, `displayName?`, `team?`, `role` | Email válido (se guarda en minúsculas, max 254). Si ya existe, se rechaza con "already on the jury". `role` ∈ `expert`, `approver`, `admin` |
| `setJurorRole` | `jurorId`, `role` | Un admin no puede quitarse a sí mismo el rol de admin. Siempre queda al menos un admin activo |
| `setJurorActive` | `jurorId`, `active` | Un admin no puede desactivarse a sí mismo (guía: "Admins can't deactivate themselves"). Nada se borra |
| `registerAgent` | `name`, `workspaceId`, `itemId` | IDs con formato GUID; nombre max 200; pareja workspace+item única |
| `setAgentActive` | `agentId`, `active` | "Retire" = `active = false`; nada se borra |
| `readAdminLog` | `limit` (≤ 200) | Solo lectura. Devuelve las últimas entradas de `AdminRequestResult` con la acción de su `AdminRequest` |

`readAdminLog` es necesario porque la política de lectura de `AdminRequestResult` solo deja ver a cada usuario sus propias peticiones, y el registro del admin debe mostrar las de todos, incluidos los intentos rechazados de otros.

**Código:** la validación de payloads y las reglas (no quitarse admin, último admin) van en un módulo puro, `rayfin/functions/src/clerk-actions.ts`, sin `mssql`. Así se puede probar con Vitest. La parte T-SQL queda en `admin-request.ts`.

## 4. Pantalla "Clerk's office" (pantalla 8)

Sigue [`admin.html`](../design/mockups/admin.html) y el componente "Admin table" de la guía, usando solo los tokens de `src/styles/docket-tokens.css`.

| Zona | Contenido | Datos |
|---|---|---|
| Cabecera | Kicker "Only visible to admins", título "Clerk's office", línea de ayuda, recuadro "How this is protected", doble regla de 6 px | i18n |
| Pestañas | Jurors · N, Agents · N, Admin log (`role="tablist"`) | Recuentos de `Juror`/`Agent` |
| Jurors | Filtro Active/Inactive (`aria-pressed`). Tabla: avatar con iniciales, nombre y email (mono), team, chip de rol, actividad y acciones a la derecha. En tu propia fila, "You can't remove yourself" | `Juror` por GraphQL. Actividad = nº de cases y testimonies por email (I2 añade votos e I4 recursos) |
| "Swear in a juror" | Email de trabajo, nombre visible, team, rol y botón primario "Add to the jury" | `swearInJuror` |
| Latest admin changes | Últimas 3 entradas, rechazos en `--action-text` con "Rejected:", y "Open the full admin log →" | `readAdminLog` |
| Agents | Tarjetas: nombre, chip ACTIVE/RETIRED, IDs en mono, nº de cases y "Retire"/"Reinstate". Botón secundario "+ Register an agent" con formulario | `Agent` y `registerAgent`/`setAgentActive` |
| Admin log | Lista completa (fecha, quién, acción, resultado) de solo lectura: "The record is never edited" | `readAdminLog` |

**Estados (guía, sección 6):**
- Esqueletos al cargar.
- "Objection!" con `role="alert"` y botón de reintento si algo falla.
- Vacíos con su acción, por ejemplo "No agents yet. Register the first one."
- Mensaje claro si una acción se rechaza (motivo del servidor), sin perder lo escrito en el formulario.

**Acceso:**
- Enlace en la cabecera solo para admins activos. La interfaz decide por `Juror.email` = email de la sesión, sin distinguir mayúsculas.
- No es una frontera de seguridad (regla 21): el servidor rechaza igualmente.
- Si un no admin abre la pantalla, ve un aviso y nada más.

**Base común que esta iteración construye y que reutilizarán las pantallas 1–3:**
- Cabecera (masthead) con el selector EN/ES (`aria-pressed`) y el botón de tema, que aplica `data-theme="dark"`.
- Botones primario y secundario, chip de estado, tabla, pestañas.
- Bloques de carga, error y vacío.
- Hook `useClerkAction(action, payload)`: inserta el `AdminRequest`, invoca `clerkExecute` y devuelve el resultado.

## 5. Ficheros

| Fichero | Cambio |
|---|---|
| `rayfin/data/Juror.ts` | `displayName` opcional (`@text({ max: 100, optional: true })`), por el mockup (ver la decisión D1) |
| `rayfin/functions/src/clerk-actions.ts` (+ `.spec.ts`) | Validación de payloads y reglas puras |
| `rayfin/functions/src/admin-request.ts` | Acciones T-SQL y `readAdminLog`. Sale la acción `probe` |
| `rayfin/functions/src/function_app.ts` | Solo `clerkExecute` |
| `src/data/clerk.service.ts` (+ spec) | Insertar la petición e invocar `clerkExecute`; leer el registro |
| `src/components/` | Masthead, botones, chip, tabla, pestañas, estados (con specs donde haya lógica) |
| `src/screens/clerks-office.screen.tsx` (+ spec) | La pantalla |
| `src/App.tsx` | Navegación mínima (Home provisional y Clerk's office); `EmptyStatePreview` desaparece |
| `src/locales/en.json`, `es.json` | Textos de la pantalla |
| `scripts/i1b-checks.mjs` | Comprobaciones contra la app desplegada (sección 6) |

## 6. Tests

- **Unitarios (`clerk-actions.spec.ts`):**
  - Cada payload válido e inválido.
  - Email normalizado.
  - No quitarse admin ni desactivarse; último admin.
  - Acción desconocida.
- **Servicio (`clerk.service.spec.ts`):** la petición se crea con el email de la sesión, se invoca `clerkExecute` solo con el id y los rechazos llegan como error legible.
- **Pantalla:**
  - Solo los admins ven el contenido.
  - Tu propia fila no tiene acciones.
  - Estados de carga, error y vacío.
  - Un rechazo se muestra sin perder el formulario.
  - Cambio EN/ES.
- **Contra la app desplegada (`i1b-checks.mjs`):**
  - Cada acción como admin (`done`).
  - Como no admin (`rejected`, y queda en el registro).
  - Petición caducada, futura, repetida (409) o de otro email (rechazada al insertar).
  - Quitarse admin o desactivarse.
  - Sin sesión.
  - `readAdminLog` como no admin.

## 7. Decisiones (tomadas el 2026-11-09)

- **D1 — Nombre visible.** Sí: `Juror.displayName` opcional. Si está vacío se muestra la parte del email anterior a la @. Los emails completos solo se muestran en la secretaría.
- **D2 — Roles.** Los tres de la especificación (`expert`, `approver`, `admin`) como chips en la tabla (ADMIN relleno, el resto con borde) y con una línea de descripción en el formulario. Donde el mockup (Juror/Admin) y las decisiones difieren, mandan las decisiones.
- **D3 — "Hasn't signed in yet" y "Copy invite link".** Fuera de I1b. Quedan como candidatos en `estado.md`.
- **D4 — Agentes.** Nombre del agente (lo escribe el admin al registrarlo) como etiqueta principal y el ID del agente abreviado en mono (4 primeros + 4 últimos caracteres) con botón para copiar el ID completo. El nombre del workspace espera a I3.
- **D5 — Orden.** I1b primero, construyendo la base común como componentes reutilizables.

**Requisitos añadidos en la revisión:**
- Errores de `clerkExecute` en lenguaje claro: 403 → "Only active admins can do this", 409 → "This change was already applied", caducada → "Please try again". El detalle técnico solo dentro de "Technical details".
- Un admin no puede desactivarse ni quitarse su rol de admin: la acción se oculta en la interfaz y `clerkExecute` lo rechaza.
- "Latest admin changes" lee `AdminRequestResult`, incluidos los intentos rechazados.
- Tests del mapeo de errores y de la regla de autoprotección.

## 8. Riesgos

- **Propagación tras desplegar:** una Function nueva puede tardar en estar disponible. Los checks esperan y reintentan antes de dar un fallo.
- **`createdAt` lo pone el cliente:** se mitiga con la caducidad de 2 minutos, el rechazo de fechas futuras y el uso único.
- **Concurrencia entre dos admins:** la unicidad de `requestId` evita dobles ejecuciones de una petición. Los cambios de distintos admins sobre el mismo juror se aplican en orden y quedan en el registro.

## 9. Resultados (2026-11-09)

**Lo construido** (difiere del plan de la sección 5 solo en nombres de ficheros):

| Parte | Ficheros |
|---|---|
| Reglas puras compartidas por la Function y la interfaz: validación de payloads, autoprotección (`jurorActionsFor`, `selfProtectionViolation`) | `rayfin/functions/src/clerk-actions.ts` (+ spec) |
| Acciones T-SQL y `readAdminLog`; `findActiveAdmin` devuelve el id del admin para la autoprotección | `admin-request.ts`, `app-sql.ts` |
| `Juror.displayName` y `AdminRequestResult.reason` (motivo legible por la interfaz) | `rayfin/data/` |
| Servicio y mapeo de errores a lenguaje claro | `src/data/clerk.service.ts`, `clerk-errors.ts` (+ spec) |
| Base común reutilizable | `src/components/docket/`: masthead con EN/ES y tema, botones, chips de estado y rol, tabla de admin, campos, "Objection!", esqueleto, vacío, pestañas, avatar e ID abreviado con copia |
| Pantalla | `src/screens/clerks-office/` (+ specs) |
| Comprobaciones contra la app desplegada | `scripts/i1b-checks.mjs` |

**Decisiones de implementación:**
- **Códigos de `clerkExecute`:** 200 hecho · 400 payload no válido · 403 no admin, acción desconocida o caducada · 404 petición o destino inexistente · 409 ya procesada · 422 regla de negocio (autoprotección, ya existe) · 500 error. Cada respuesta lleva además `reason`, que la interfaz traduce; el detalle del servidor solo aparece en "Technical details".
- **Último admin:** con la autoprotección, quien hace el cambio sigue siendo admin activo, así que siempre queda al menos uno. No hace falta otra comprobación.
- **Las lecturas del registro** también son peticiones (para identificar al admin) y quedan en `AdminRequestResult`, pero `readAdminLog` no lista las que salieron bien, para no llenar el registro. Los intentos rechazados de leerlo sí aparecen.
- **La acción `probe` se retira.** `i1a-checks.mjs` usa ahora `readAdminLog` como acción inofensiva.
- **Navegación mínima** sin router: Home provisional (vacío que explica que la lista de casos llega en el siguiente paso) y Secretaría, visible solo para admins activos. `EmptyStatePreview` de la plantilla se ha retirado.

**Comprobaciones:**

| Prueba | Resultado |
|---|---|
| Tests unitarios y de pantalla (Vitest) | Pasan, incluidos el mapeo de errores, la autoprotección (servidor e interfaz), `describeLogEntry` y la conservación del formulario tras un rechazo |
| `scripts/i1b-checks.mjs` (como admin) | **21 de 21.** Alta, cambio de rol, desactivación y reactivación de un juror de ejemplo; registro y retirada de un agente de ejemplo; duplicados (422), autoprotección (422) en rol y desactivación, id inexistente (404), payload no válido (400), `probe` desconocida (403) y registro con rechazos |
| `scripts/i1a-checks.mjs --only=probe --expect-admin` | **22 de 22** tras el despliegue (seguridad del flujo sin cambios) |

**Datos que dejan las comprobaciones** (nada se borra): el juror `i1b.check@example.com` inactivo y el agente "I1b check agent (example)" retirado.

**Capturas para la revisión:** en `apps/agent-jury/.private/screenshots/` (no versionado, porque muestran datos reales del despliegue): claro y oscuro en EN y ES a 1440 px, más las pestañas de agentes y registro y una vista de móvil. Se hicieron con Edge sin interfaz contra el servidor local (`npm run dev`) conectado a la app desplegada, con la sesión de `rayfin login`; la sesión no sale de ese proceso.

**Ajustes tras revisar las capturas:**
- Las columnas de equipo y actividad se ocultan por debajo de 1200 px para que las acciones de cada fila sigan visibles.
- Las etiquetas `sr-only` de la tabla salían del contenedor con scroll y desbordaban la página en móvil.
- Los controles nativos (radios, selects) siguen el tema oscuro con `color-scheme`.
- Las filas antiguas del registro (I1a, sin `reason`) se describen a partir del detalle, y `probe` aparece como "petición de prueba".

## 10. Revisión del 2026-11-09

**Tabla de admin:**
- Actividad se oculta por debajo de 1024 px y Equipo por debajo de 768 px (antes, las dos a 1200 px).
- Por debajo de 640 px cada juror es una tarjeta: avatar y nombre, chip de rol y las acciones como botones a todo el ancho. Sin scroll lateral. La decisión se toma con `useMediaQuery`, así que solo se pinta una de las dos vistas.
- El rol ya no aparece dos veces: queda el chip, y la acción de texto "Change role" / "Cambiar rol" abre un desplegable en la propia fila con Guardar y Cancelar.
- Los desplegables siguen la guía: esquinas rectas, borde de 1 px en tinta, 44 px de alto y colores de los tokens en ambos temas (`SelectField`).
- Rol y Acciones tienen ancho fijo, para que chips y acciones se alineen en todas las filas.
- Avatares con un color estable por persona, derivado de su id, de la paleta (verde de fallo, azul de revisión, coral, tinta). Cada par fondo/texto llega a 4,5:1 en los dos temas.
- La separación entre las pestañas y "The jury" se reduce a la mitad.

**Ruido de las comprobaciones en el registro:**
- Los scripts añaden `source: "check"` al payload de cada `AdminRequest` que crean. No se borra ni se edita nada.
- Las filas anteriores a la marca (todas las de I1a e I1b hasta las 15:11 UTC del 2026-11-09, auditadas una a una) se reconocen por fecha. La fecha ya no está en el código: ver la sección 11.
- Solo cuenta como comprobación una petición de un admin activo: un no admin no puede ocultar sus intentos rechazados añadiendo la marca.
- "Latest admin changes" y la pestaña del registro ocultan las comprobaciones por defecto, con la casilla "Show automated checks" / "Mostrar comprobaciones automáticas". El registro lee ahora hasta 200 entradas. Tests en `log-entry.spec.ts`.

**Inicio y navegación:**
- El anillo de foco solo aparece con teclado (`:focus-visible`). Una regla global quita el contorno tras un clic, aunque una librería lo ponga en `:focus`.
- El enlace a la secretaría y el botón "Go to the clerk's office" solo se muestran a admins activos. Un no admin que abre `#clerk` ve el Inicio. `clerkExecute` sigue siendo la protección real.

## 11. Arreglos de la aprobación (2026-11-09)

**Corte de comprobaciones antiguas como ajuste opcional:**
- La clasificación se hace ahora en `clerkExecute` (`readAdminLog` devuelve `automatedCheck` en cada entrada). Una entrada es comprobación si la pidió un admin activo y su payload lleva `source: "check"`, o si es anterior a `LEGACY_CHECK_CUTOFF_UTC`.
- `LEGACY_CHECK_CUTOFF_UTC` es un secreto de Rayfin opcional, vacío por defecto. `rayfin.yml` solo declara el nombre; el valor se guarda en `.private/values.env` y se sube con `rayfin secret set --stdin` (instrucciones en `private.example.env`). Si no tiene valor, la Function no aplica corte (leer un secreto declarado sin valor lanza un error, y se trata como vacío). Solo este despliegue lo tiene.
- La interfaz ya no contiene ninguna fecha.

**Foco:** la regla global es exactamente `:focus:not(:focus-visible) { outline: none; }`, junto a `:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }`.
- `src/styles/focus.spec.ts` comprueba las dos reglas y que ningún componente de `src/components/docket/` use la variante `focus:` de Tailwind.
- Comprobación manual en Edge (`.private/screenshots.mjs --focus`, recorre la secretaría con Tab): 39 de 39 elementos enfocados muestran el anillo de 3 px, y tras un clic con el ratón en el enlace "Home" el contorno es `none`. jsdom no distingue foco de teclado y de ratón, por eso esta parte se comprueba en el navegador.

**Pestaña de agentes:** filtro "Active · n / Retired · n", con Activos por defecto.

**Columna Team:** sin saltos de línea, con puntos suspensivos y el texto completo en el `title`.

**Pestañas en móvil:** por debajo de 640 px la pestaña del registro se llama "Log" / "Registro", para que las tres quepan en una línea.

**Nueva acción "Edit details" / "Editar datos" (`editJurorDetails`):**
- Cambia el nombre visible y el equipo de un juror, también los propios. Un valor vacío borra el campo.
- Pasa por `clerkExecute` como las demás y queda en el registro.
- Tests: validación del payload y edición propia en `clerk-actions.spec.ts`, la pantalla en `clerks-office.screen.spec.tsx` y la descripción del registro en `log-entry.spec.ts`. En el despliegue, `i1b-checks.mjs` B.21.

**Comprobaciones nuevas en `i1b-checks.mjs`:** B.21 (`editJurorDetails`) y B.22 (las entradas marcadas por las comprobaciones salen con `automatedCheck`).
