# Plan de la iteración I1b: "Clerk's office"

> Estado: **propuesta para revisión**. No hay código de pantalla escrito.
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

## 7. Decisiones que necesito

- **D1 — Nombre visible del juror.** El mockup muestra nombre y email. Propuesta: añadir `Juror.displayName` opcional; si falta, se muestra el email.
- **D2 — Roles en la interfaz.** El mockup ofrece Juror/Admin, pero el modelo tiene `expert`, `approver` y `admin`. Propuesta: tres opciones en el formulario y chips EXPERT, APPROVER y ADMIN (ADMIN relleno, el resto con borde).
- **D3 — "Hasn't signed in yet" y "Copy invite link".** Saber si alguien ha entrado exige leer `dbo.Users` de Rayfin con T-SQL. Propuesta: dejarlo fuera de I1b y mostrar solo la actividad. El enlace de invitación sería el enlace de la app en Fabric, que es un dato privado del despliegue.
- **D4 — Nombre del workspace en las tarjetas de agentes.** El mockup muestra el nombre del workspace; obtenerlo exige la API de Fabric con la identidad de la app. Propuesta: mostrar los IDs abreviados en mono y añadir el nombre más adelante (I3, cuando haya Data Agents reales).
- **D5 — Orden respecto a las pantallas 1–3.** Propuesta: I1b primero, porque construye la base común (masthead, componentes, estados) que reutilizarán las pantallas 1–3.

## 8. Riesgos

- **Propagación tras desplegar:** una Function nueva puede tardar en estar disponible. Los checks esperan y reintentan antes de dar un fallo.
- **`createdAt` lo pone el cliente:** se mitiga con la caducidad de 2 minutos, el rechazo de fechas futuras y el uso único.
- **Concurrencia entre dos admins:** la unicidad de `requestId` evita dobles ejecuciones de una petición. Los cambios de distintos admins sobre el mismo juror se aplican en orden y quedan en el registro.
