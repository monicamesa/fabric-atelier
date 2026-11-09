# Plan de la iteración I1a

> Estado: aprobado con cambios (decisiones de revisión del 2026-11-09). Las pantallas 1–3 esperan la guía de diseño.
> Fuentes: [especificación v0.4](../especificacion-general.md) (secciones 6, 7, 9, 11, 12 y 13), [AGENTS.md](../../AGENTS.md) ("Project rules"), la documentación de Rayfin 1.36.2 incluida en `node_modules/@microsoft/rayfin-core` y `rayfin-guide`, y Microsoft Learn (Fabric Apps: data models y data permissions; Data API builder: database policies).

## Decisiones de la revisión

1. **Sin dominios.** El rol de `Juror` es global (`expert`, `approver`, `admin`) y `team` es un texto libre opcional, solo informativo.
2. **Escrituras de admin:**
   - El cliente solo tiene `read` sobre `Juror` y `Agent`.
   - Las escrituras pasan por una Function que obtiene `sub` y `email` del token Rayfin de la invocación, comprueba en `Juror` que quien llama es admin y escribe con T-SQL usando el token `AudienceType.Sql` (identidad de la app). Esa Function es de I1b.
   - El primer admin lo crea el seed, con el email como variable.
3. **Validez calculada:**
   - `Case`, `Testimony` y `CaseDismissal` son de solo inserción por GraphQL.
   - Cualquier usuario autenticado puede insertar un case, pero solo cuentan los de jurors activos; el resto son "unverified" (R7).
   - Un case está retirado si tiene un `CaseDismissal` de su autor o de un admin (R8).
4. **Verificación de políticas (R1)** tras el primer despliegue.
5. **Spikes S-A y S-B** tras el primer despliegue, junto con R1. Si falla R1, S-A o S-B, se para y se informa.
6. **I1a / I1b:** I1a sin la Function de admin ni su pantalla, que pasan a I1b.
7. **Pantallas 1–3:** quedan fuera hasta recibir la guía de diseño. I1a hace ahora todo lo que no tiene parte visual.

## Alcance

**I1a, parte sin interfaz (ahora):**
- Datos activados y entidades `Juror`, `Agent`, `Case`, `Testimony` y `CaseDismissal`.
- Seed.
- Base de i18n: librería, ficheros de traducción, preferencia de idioma y formatos.
- Reglas de validez y servicios de datos, con sus tests.
- R1, S-A y S-B.

**I1a, parte visual (después de la guía de diseño):** selector EN | ES y pantallas 1 (Agents), 2 (Case board) y 3 (Case detail, con testimonies y sin votos).

**I1b:** Function de admin y pantalla 8 (administración de jurors y agentes).

## 1. Ficheros

| Fichero | Cambio |
|---|---|
| `rayfin/rayfin.yml` | `data` activado con `dialect: mssql`; `functions` activado (`auth.type: application`); `auth.fabric.externalEntraExchange: true` (ver la sección 6) |
| `rayfin/tsconfig.json` | **Nuevo.** Proyecto de referencia para compilar las entidades |
| `tsconfig.json` | `"references": [{ "path": "./rayfin" }]` |
| `rayfin/data/*.ts` | `Juror`, `Agent`, `Case`, `Testimony`, `CaseDismissal` y `schema.ts` |
| `rayfin/functions/` | Generado con `npx rayfin functions init`. En I1a solo contiene la Function del spike S-A |
| `rayfin/seed/seed.sql`, `admin.sql`, `README.md` | Seed (sección 3) |
| `scripts/i1a-checks.mjs` | Script de Node que ejecuta R1, S-A y S-B contra la app desplegada (sección 6) |
| `src/lib/rayfin-client.ts` | El tipo del cliente pasa a `AgentJurySchema` y `AppFunctionsSchema` (`import type`) |
| `src/i18n/i18n.ts`, `language-preference.ts` | i18next y la preferencia de idioma |
| `src/locales/en.json`, `es.json` | Textos, con las mismas claves |
| `src/lib/format.ts` | Fechas y números con `Intl` (`en-GB`, `es-ES`) |
| `src/rules/case-validity.ts` | Módulo único de reglas (regla 18): juror activo por email, case verificado (R7), retirada válida (R8) y estado (`dismissed` o `under_review` en I1a; I2 añade `ruled` y `disputed`) |
| `src/data/*.service.ts` | Lecturas paginadas y altas de `Case`, `Testimony` y `CaseDismissal` con la autoría tomada de la sesión |

La carpeta de reglas se llama `src/rules/` y no `src/domain/`, para no confundirla con los dominios eliminados.

## 2. Entidades

Reglas comprobadas en la documentación de 1.36.2:
- `@uuid() id`.
- `max` en todo `@text`/`@email`.
- Claves foráneas `{property}_id` como `@uuid()` junto a `@one()`. La CLI 1.36.2 rechazó en el primer despliegue la forma `@text({ max: 36 })` del ejemplo de Learn ("Foreign key type conflict").
- Importaciones relativas `.js` como valor.
- Atajo `@authenticated`.
- Ningún nombre reservado de GraphQL.

```ts
@entity()
@authenticated('read')
export class Juror {
  @uuid() id!: string;
  @email({ max: 254, unique: true }) email!: string;
  @set('expert', 'approver', 'admin') role!: 'expert' | 'approver' | 'admin';
  @text({ max: 100, optional: true }) team?: string;
  @boolean({ default: true }) active!: boolean;
}

@entity()
@authenticated('read')
export class Agent {
  @uuid() id!: string;
  @text({ max: 200 }) name!: string;
  @text({ max: 36 }) workspaceId!: string;
  @text({ max: 36 }) itemId!: string;
  @boolean({ default: true }) active!: boolean;
  @many(() => Case) cases?: Case[];
}

@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.authorUserId).and(claims.email.eq(item.authorEmail)),
})
export class Case {
  @uuid() id!: string;
  @uuid() agent_id!: string;
  @one(() => Agent) agent?: Agent;
  @text({ max: 1000 }) text!: string;
  @text({ max: 100 }) category!: string;
  @text({ max: 500, optional: true }) tags?: string;
  @text({ max: 255 }) authorUserId!: string;
  @email({ max: 254 }) authorEmail!: string;
  @date() createdAt!: Date;
  @many(() => Testimony) testimonies?: Testimony[];
  @many(() => CaseDismissal) dismissals?: CaseDismissal[];
}

@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.authorUserId).and(claims.email.eq(item.authorEmail)),
})
export class Testimony {
  @uuid() id!: string;
  @uuid() case_id!: string;
  @one(() => Case) case?: Case;
  @text({ max: 2000 }) answer!: string;
  @text({ max: 1000 }) definition!: string;
  @text({ max: 255 }) authorUserId!: string;
  @email({ max: 254 }) authorEmail!: string;
  @date() createdAt!: Date;
}

@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.dismissedByUserId).and(claims.email.eq(item.dismissedByEmail)),
})
export class CaseDismissal {
  @uuid() id!: string;
  @uuid() case_id!: string;
  @one(() => Case) case?: Case;
  @text({ max: 1000 }) reason!: string;
  @text({ max: 255 }) dismissedByUserId!: string;
  @email({ max: 254 }) dismissedByEmail!: string;
  @date() createdAt!: Date;
}
```

- **Emails de autor.** Se añaden `authorEmail` en `Case` y `dismissedByEmail` en `CaseDismissal`. Son necesarios para comprobar en `Juror` (por email) si el autor es juror (R7) o admin (R8). La política exige que coincidan con `claims.email`.
- **Si el token de Fabric no trae `claims.email`** (se comprueba en R1): se quita `.and(claims.email…)` y el email lo declara el cliente. En ese caso, R7 y R8 compararían `authorUserId` con un `Juror.userId` que rellenaría la Function de admin; se replantearía en I1b.
- **`Juror.email` es único.** Al comparar con la sesión no se distinguen mayúsculas.

## 3. Seed

- **Contenido de `rayfin/seed/seed.sql`:**
  - Jurors de ejemplo `@example.com`: dos `expert`, un `approver` y un `admin`, con `team` informativo.
  - Dos agentes de ejemplo.
- **Formato:**
  - IDs fijos con el patrón `00000000-0000-4000-8000-0000000000NN`, que permite el hook de pre-commit.
  - Los `workspaceId` e `itemId` de los agentes de ejemplo son marcadores con el mismo patrón.
  - Idempotente (`IF NOT EXISTS`).
- **Primer admin:** `rayfin/seed/admin.sql` inserta un juror `admin` con la variable SQLCMD `$(AdminEmail)`. El valor (`<ACCOUNT_EMAIL>` de `.private/values.env`) se pasa al ejecutarlo y no se guarda en el repositorio.
  - Opción 1: `:setvar` en modo SQLCMD de la extensión mssql.
  - Opción 2: `sqlcmd -v AdminEmail=…`.
- **Cuándo y cómo:** después del primer despliegue, con los nombres de tablas y columnas reales (`INFORMATION_SCHEMA`). Se ejecuta conectada con Entra ID a la base de datos SQL de la app. S-A y S-B confirman antes que las filas insertadas por T-SQL funcionan bien en la API.

## 4. i18n: i18next + react-i18next

- **Por qué:** es la librería más usada en React, con `useTranslation`/`t` y recursos JSON planos, fáciles de comprobar en el test de claves iguales. `react-intl` se descarta porque su formato ICU duplica lo que ya hace `Intl` en `src/lib/format.ts`.
- **Sin detección automática:** el idioma inicial es el guardado en `localStorage` (clave `agent-jury.language`) o `en`.
- **Dependencias:** `i18next` y `react-i18next`, con versión exacta.
- **Ahora:** la inicialización, `en.json`/`es.json` con los textos que ya existen (cabecera, ayudas de pantalla, estados), la preferencia de idioma y los formatos.
- **Con las pantallas:** el selector y su conexión con la interfaz.

## 5. Tests

| Spec | Qué comprueba |
|---|---|
| `src/locales/locales.spec.ts` | Mismas claves anidadas en `en.json` y `es.json`, sin valores vacíos |
| `src/i18n/language-preference.spec.ts` | Por defecto `en`; guarda y recupera `es`; ignora valores no válidos |
| `src/lib/format.spec.ts` | Fechas y números distintos en `en-GB` y `es-ES` |
| `src/rules/case-validity.spec.ts` | Juror activo por email sin distinguir mayúsculas; inactivo no cuenta; case de no juror → unverified; retirada del autor o de un admin → `dismissed`; retirada de otro usuario o de un admin inactivo → se ignora |
| `src/data/*.service.spec.ts` | Paginación completa; la autoría (`authorUserId`, `authorEmail`) sale de la sesión; sin sesión, error |
| `src/data/entities.spec.ts` | Revisa el código fuente: `max` en todos los campos de texto y email, `*_id` como `@uuid()`, y solo `read` y `create` en las entidades de solo inserción |

## 6. R1, S-A y S-B (tras el primer despliegue)

**Cómo se ejecutan:** como aún no hay pantallas, se ejecutan con `scripts/i1a-checks.mjs`, un script de Node que:
1. Obtiene un token delegado de Entra con `az account get-access-token --resource https://analysis.windows.net/powerbi/api`, con el tenant leído de `.private/values.env`.
2. Inicia sesión en la app con `signInWithEntraToken()` (documentado en "Direct Entra token sign-in"). Esto exige `services.auth.fabric.externalEntraExchange: true`, el mismo ajuste que usa el inicio de sesión automático en desarrollo local.
3. Lanza las comprobaciones y muestra el resultado sin imprimir tokens ni emails.

**R1, políticas de inserción:**
- Insertar `Case`, `Testimony` y `CaseDismissal` propios debe funcionar.
- Insertarlos con un `authorUserId` ajeno o con un `authorEmail` distinto del de la sesión debe fallar.
- Crear, modificar o borrar `Juror` y `Agent`, y modificar o borrar `Case`, debe fallar.

**S-A, Function con identidad de la app** (`spikeSqlJuror`, `AudienceType.Sql`):
- Decodifica el token Rayfin de la invocación (`ctx.accessToken`) y devuelve si trae `sub` y `email`, sin devolver el token ni los valores.
- Se conecta con `mssql` a la base de datos SQL de la app. El servidor y la base de datos se leen de los secretos de Rayfin `APP_SQL_SERVER` y `APP_SQL_DATABASE` (`rayfin secret set`), para no escribir identificadores en el código.
- Inserta un `Juror` de prueba (`spike-<fecha>@example.com`, `active = 0`) y lo vuelve a leer.
- Con el script, se comprueba también que una invocación sin sesión se rechaza.

**S-B, filas T-SQL en la API:**
- Leer con el cliente de datos el `Juror` insertado por S-A y comparar sus campos con los esperados (`id`, `email`, `role`, `team`, `active`).
- Repetir con un `Case` creado por GraphQL para ver qué columnas genera Rayfin (incluidas las de sistema, si las hay) y comprobar que T-SQL puede rellenarlas.

**Si R1, S-A o S-B fallan,** se para y se informa antes de seguir.

### Resultados (2026-11-09, `scripts/i1a-checks.mjs`)

| Comprobación | Resultado |
|---|---|
| **R1**: políticas de inserción | **Pasa.** Las inserciones propias de `Case`, `Testimony` y `CaseDismissal` se aceptan. Con otro `authorUserId`, otro `authorEmail` u otro `dismissedByUserId` se rechazan ("Could not insert row with given values"): Rayfin sí aplica las políticas de `create`, incluida `claims.email`. Sin sesión no se lee nada. No existen mutaciones `create`/`update` para `Juror` y `Agent`, ni `update`/`delete` para `Case` |
| **S-A**: Function con T-SQL e identidad de la app | **Pasa.** Con el token `AudienceType.Sql`, la Function se conecta a la base de datos de la app, inserta y lee un `Juror`, e inserta un `Agent`. Sin sesión, la invocación se rechaza (403) |
| **S-A**: identidad de quien llama desde `ctx.accessToken` | **Falla.** El token que recibe la Function no es el token Rayfin del usuario: es un token de plataforma de Fabric (`idtyp: fmi`). Sus claims son `aio, appid, aud, exp, iat, idp, idtyp, iss, nbf, rh, sub, tid, uti, ver, xms_*`: no trae `email`, y su `sub` no coincide con el `id` de la sesión. **El paso (1) de la Function de admin no se puede hacer como está diseñado** |
| **S-B**: filas T-SQL en la API | **Pasa.** El `Juror` insertado por T-SQL se lee por GraphQL con `id`, `email`, `role`, `team` y `active` correctos. Las tablas no tienen columnas de sistema ocultas |

**Hallazgos para el seed y para I1b:**
- **Tablas en plural:** `dbo.Jurors`, `dbo.Agents`, `dbo.Cases`, `dbo.Testimonies` y `dbo.CaseDismissals`, más `dbo.Users` de Rayfin.
- **Tipos de columna:**
  - `id` es `uniqueidentifier` con `default newid()`, y las claves foráneas son `uniqueidentifier`.
  - `active` es `bit` con `default 1`, y `createdAt` es `datetime2` sin valor por defecto.
  - Los textos son `nvarchar`, y `@set` se guarda como `nvarchar`.
- **`serverFqdn` de Fabric** viene como `host,1433`; el driver `mssql` necesita servidor y puerto por separado.
- **`findById()` solo devuelve `id`.** Para leer campos hay que usar `select([...]).where({ id: { eq } })`.
- **Token para el script:** la CLI de Azure no puede obtener el scope `Item.Execute.All` (Entra lo rechaza). El script usa `getAuthenticatedToken` de `@microsoft/rayfin-cli/auth`, como el inicio de sesión automático local.

**Datos de prueba:** limpiados el 2026-11-09 con un script T-SQL privado (`.private/`, no versionado), ejecutado como propietaria del item. Se borraron los jurors `spike-…@example.com`, el agente de ejemplo creado por el spike y los cases "[I1a check]" con sus testimonies y retiradas. Después se cargó el seed (4 jurors y 2 agentes de ejemplo) y se dio de alta a la propietaria como admin con `admin.sql` (email leído de `.private/values.env`). Las filas de `AdminRequest` y `AdminRequestResult` que crean las comprobaciones posteriores se conservan: forman el registro de admin y no se borra nada (regla 23).

### Seguimiento: identidad de admin (2026-11-09)

**Objetivo:** que una Function sepa quién la llama para comprobar que es admin, ya que `ctx.accessToken` no lo dice (S-A).

| Paso | Resultado |
|---|---|
| Quitar `whoAmI` y `spikeSqlJuror` | **Hecho.** Ya no responden. Una Function eliminada devuelve "Application authentication for this function is currently unavailable", no "NotFound" |
| **Opción 1, "prueba por inserción":** la Function inserta un `AdminRequest` con `ctx.getDataClient()`, cuya política exige `claims.email = requesterEmail` | **No concluyente:** la Function `adminProbe` nunca llegó a ejecutarse (ver abajo). Después se comprobó que `getDataClient()` sí funciona dentro de una Function (`dataPing` leyó `Jurors`), pero no se repitió la prueba de identidad porque la opción 2 cumple todos los requisitos |
| **Opción 2 (adoptada):** el navegador inserta el `AdminRequest` y la Function `clerkExecute(requestId)` lo procesa con T-SQL e identidad de la app | **Pasa.** Resultados abajo |

**Causa de los fallos:** las Functions `adminProbe` y `adminExecute` devolvían siempre `WorkloadException/NotFound … invocation failed`, sin llegar al código. El host de Azure Functions reserva las rutas que empiezan por `admin` y `runtime`. Con el nombre `clerkExecute` funciona sin más cambios. Regla 24 de `AGENTS.md`.

**Pruebas de la opción 2** (`scripts/i1a-checks.mjs --only=removed,probe`, sin y con `--expect-admin`):

| Prueba | Resultado |
|---|---|
| (a) Un admin activo ejecuta su petición | Pasa: `200`, `done` |
| (b) Un usuario que no es admin | Pasa: `403` "The requester is not an active admin." y queda en `AdminRequestResult` como `rejected` |
| (c) Insertar una petición con el email de otro usuario | Pasa: la inserción se rechaza ("Could not insert row with given values") |
| (d) Invocar sin sesión | Pasa: "Anonymous access is not allowed for function invocation" |
| Uso único | Pasa: la segunda ejecución devuelve `409` "already processed" (`requestId` único en `AdminRequestResult`) |
| Caducidad | Pasa: `403` con `createdAt` de hace 5 minutos y también con fecha 10 minutos en el futuro |
| Acción desconocida | Pasa: `403` "Unknown action." |
| Id inexistente | Pasa: `404` |
| Escrituras desde el cliente | Pasa: no existen `createAdminRequestResult` ni `updateAdminRequest` |
| Registro de admin | El autor lee el resultado de su propia petición. Para que un admin vea las de todos (incluidos los rechazos), I1b añade una acción de lectura en `clerkExecute`, porque la política de lectura solo deja ver las propias |

**Salvaguardas implementadas** (`rayfin/functions/src/admin-request.ts`):
- La Function recibe solo `requestId`; acción y payload se leen de la fila.
- Petición válida durante 2 minutos (con 30 s de margen de reloj hacia el futuro).
- La comprobación de admin se hace con T-SQL sobre `Jurors`, sin distinguir mayúsculas.
- El resultado se escribe en la misma transacción que la acción, y `requestId` es único.
- `AdminRequest` y `AdminRequestResult` solo los lee su autor.
- Juntos forman el registro de admin.

**Diagnóstico (Functions temporales ya retiradas):** `ping`, `sqlPing`, `dataPing` y seis variantes `echo…` (síncronas y asíncronas, con contexto, con el audience Sql, con `requestId` y con resultados de uniones literales) funcionaron todas. Eso descartó la firma y dejó el nombre como única diferencia.

## 7. Riesgos y dudas

| # | Riesgo | Qué haré |
|---|---|---|
| R1 | Políticas de `create` no aplicadas (DAB no las admite; Rayfin dice que sí) | Sección 6. Si falla, parar |
| R3 | `claims.email` ausente del token de Fabric | Sección 6. Si falta, parar y replantear R7/R8 |
| R4 | No se pueda escribir con T-SQL en la base de datos de la app, o haya columnas de sistema que la API necesite | S-A y S-B |
| R5 | `@vitejs/plugin-react-swc` no entiende decoradores TC39 | El frontend solo importa tipos de `rayfin/data` |
| R6 | La referencia `tsc -b` a `rayfin/` cambia el build | Comprobar `npm run build` antes de desplegar |
| R7 | `createdAt` lo pone el cliente | Aceptado en I1a |
| R8 | `Case` es palabra reservada de SQL | Si falla el despliegue, `@entity('JuryCase')` |
| R9 | Case sin testimony si falla la segunda inserción | Aceptado: se puede añadir después |
| R10 | `externalEntraExchange: true` amplía las formas de iniciar sesión (cualquier token delegado válido del mismo tenant con permiso Execute sobre el item) | Necesario para el script y el desarrollo local. Se documenta; se puede desactivar en producción si se decide |

## 8. Criterios de aceptación de I1a

- **A1.** Nadie puede crear un `Case`, `Testimony` o `CaseDismissal` en nombre de otro (R1).
- **A2.** Ningún cliente puede escribir `Juror` ni `Agent`, ni modificar o borrar `Case`, `Testimony` o `CaseDismissal`.
- **A3.** Una Function escribe y lee `Juror` con T-SQL e identidad de la app, y la fila es correcta en la API (S-A, S-B).
- **A4.** Ninguna consulta fallida se sustituye por datos simulados.
- **A5.** Tras la guía de diseño: en la app desplegada, un juror crea un case con su primer testimony y añade otro; un case de un no juror aparece como unverified.
- **A6.** Selector EN | ES en la cabecera de las tres pantallas; inglés por defecto y la elección se recuerda (parte visual).
- **A7.** Textos solo en `en.json`/`es.json` con las mismas claves (test).
- **A8.** Fechas y números según `en-GB`/`es-ES`; el contenido de los usuarios no se traduce.
- **A9.** `npm run build`, `npm test` y `npm run lint` pasan; el hook no bloquea nada.

## 9. Orden de trabajo

1. Entidades, `rayfin/tsconfig.json`, Functions (`functions init` y spike S-A), `npm run build`.
2. Reglas de validez, i18n y servicios de datos con sus tests.
3. `npx.cmd rayfin up`, `git restore rayfin/rayfin.yml` (solo la URL de la app) y secretos `APP_SQL_SERVER`/`APP_SQL_DATABASE`.
4. R1, S-A y S-B con `scripts/i1a-checks.mjs`. **Parar e informar.**
5. Seed y primer admin.
6. Pantallas 1–3, tras la guía de diseño.
