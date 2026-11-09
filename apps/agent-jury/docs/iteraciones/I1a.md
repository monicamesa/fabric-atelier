# Plan de la iteración I1a

> Estado: propuesta para revisión. No hay código escrito.
> Fuentes: [especificación v0.3](../especificacion-general.md) (secciones 6, 7, 9, 12 y 13), [AGENTS.md](../../AGENTS.md) ("Project rules"), la documentación de Rayfin 1.36.2 incluida en `node_modules/@microsoft/rayfin-core` y `rayfin-guide`, y Microsoft Learn (Fabric Apps: data models y data permissions; Data API builder: database policies).

## Alcance

**I1a (este plan):**
- Activar datos en `rayfin.yml`.
- Entidades `Domain`, `Juror`, `Agent`, `Case` y `Testimony`, con sus políticas `@role`.
- Datos iniciales (*seed*) de `Domain`, `Juror` y `Agent`, cargados directamente en la base de datos.
- Selector de idioma EN | ES y ficheros de traducción.
- Pantallas 1 (Agents), 2 (Case board, sin votos) y 3 (Case detail, con testimonios y sin votos).

**I1b (fuera de este plan):** Functions de administración de `Domain`, `Juror` y `Agent`, que comprueban que quien llama es un juror `admin`. Ver el riesgo R2: condiciona cómo se hará.

**Fuera de I1:** `Vote`, cálculo de consenso, conflictos (I2) y todo lo de I3–I5.

## 1. Ficheros

### Configuración y compilación

| Fichero | Cambio |
|---|---|
| `rayfin/rayfin.yml` | `services.data.enabled: true` y `dialect: mssql` |
| `rayfin/tsconfig.json` | **Nuevo.** La plantilla Data App no lo trae. Lo copiaré de una plantilla plana recién generada con `npm create @microsoft/rayfin@latest` en una carpeta temporal fuera del repositorio, sin inventarlo |
| `tsconfig.json` | Añadir `"references": [{ "path": "./rayfin" }]` |
| `package.json` | Dependencias nuevas, con versión exacta: `i18next` y `react-i18next` |
| `vite.config.ts` | Probablemente sin cambios (ver el riesgo R5) |

### Modelo de datos (`rayfin/data/`)

| Fichero | Contenido |
|---|---|
| `Domain.ts`, `Juror.ts`, `Agent.ts`, `Case.ts`, `Testimony.ts` | Una entidad por fichero (sección 2) |
| `schema.ts` | `AgentJurySchema`: mapa de las cinco entidades, solo con `import type` |

### Seed (`rayfin/seed/`)

| Fichero | Contenido |
|---|---|
| `seed.sql` | `Domain`, `Juror` y `Agent` de ejemplo, idempotente |
| `admin.sql` | Plantilla para darte de alta como admin, con una variable SQLCMD y sin datos personales |
| `README.md` | Cómo ejecutar los dos scripts (sección 3) |

### Frontend

| Fichero | Contenido |
|---|---|
| `src/lib/rayfin-client.ts` | El tipo del cliente pasa de `EntitySchema` a `AgentJurySchema` (`import type`) |
| `src/i18n/i18n.ts` | Inicialización de i18next con los dos idiomas incluidos en el bundle |
| `src/i18n/language-preference.ts` | Leer y guardar el idioma elegido en `localStorage` (clave `agent-jury.language`). Es la única entrada permitida en el navegador |
| `src/locales/en.json`, `src/locales/es.json` | Todos los textos visibles |
| `src/lib/format.ts` | `formatDate` y `formatNumber` con `Intl`, `en-GB` o `es-ES` según el idioma |
| `src/data/*.service.ts` | Una función por consulta o alta: `listAgents`, `listCasesByAgent`, `getCase`, `listTestimonies`, `createCase`, `createTestimony`, `listDomains`, `findCurrentJurors` |
| `src/domain/case-state.ts` | Módulo único del estado de un case (regla 18). En I1a solo devuelve `dismissed` o `under_review`; I2 añade `ruled` y `disputed` |
| `src/domain/case-board.ts` | Funciones puras: agrupar cases por estado y filtrar por categoría |
| `src/hooks/use-async-data.ts` | Carga con `isLoading` y `error`, para mostrar estados vacíos y de error útiles |
| `src/components/app-header.component.tsx` | Título, línea de ayuda y selector EN \| ES |
| `src/components/language-selector.component.tsx` | El selector |
| `src/screens/agents.screen.tsx` | Pantalla 1 |
| `src/screens/case-board.screen.tsx` | Pantalla 2, con el formulario "New case" |
| `src/screens/case-detail.screen.tsx` | Pantalla 3, con el formulario "Add testimony" |
| `src/App.tsx` | Navegación entre las tres pantallas |
| `src/services/language.service.ts` | Se adapta para que los textos de los visuales sigan el idioma elegido y no el del portal |

`EmptyStatePreview.tsx` y su imagen se borran.

**Navegación:** se hace con estado en React (`agents` → `caseBoard(agentId)` → `caseDetail(caseId)`). No añado `react-router` ni deep links; si quieres URLs compartibles, sería un cambio aparte con `@microsoft/rayfin-app-state-fabric`.

## 2. Definición de las entidades

Reglas aplicadas, todas comprobadas en la documentación de 1.36.2:
- Clave primaria `@uuid() id`.
- `@text`/`@email` siempre con `max`.
- Claves foráneas `{property}_id` declaradas como `@text({ max: 36 })` junto a la navegación `@one()`, como en el ejemplo de Learn.
- Importaciones relativas con extensión `.js` y como valor, no `import type`, para que funcione `@one(() => X)`.
- Permisos con el atajo `@authenticated`, que la documentación prefiere a `@role('authenticated', …)`.
- Ninguna entidad usa un nombre reservado de GraphQL.

### Domain

```ts
import { entity, authenticated, uuid, text, many } from '@microsoft/rayfin-core';
import { Juror } from './Juror.js';
import { Agent } from './Agent.js';

@entity()
@authenticated('read')
export class Domain {
  @uuid() id!: string;
  @text({ max: 100, unique: true }) name!: string;
  @many(() => Juror) jurors?: Juror[];
  @many(() => Agent) agents?: Agent[];
}
```

### Juror

```ts
@entity()
@authenticated('read')
export class Juror {
  @uuid() id!: string;
  @email({ max: 254 }) email!: string;
  @text({ max: 36 }) domain_id!: string;
  @one(() => Domain) domain?: Domain;
  @set('expert', 'approver', 'admin') role!: 'expert' | 'approver' | 'admin';
  @boolean({ default: true }) active!: boolean;
}
```

### Agent

```ts
@entity()
@authenticated('read')
export class Agent {
  @uuid() id!: string;
  @text({ max: 200 }) name!: string;
  @text({ max: 36 }) workspaceId!: string;
  @text({ max: 36 }) itemId!: string;
  @text({ max: 36 }) domain_id!: string;
  @one(() => Domain) domain?: Domain;
  @boolean({ default: true }) active!: boolean;
  @many(() => Case) cases?: Case[];
}
```

`Domain`, `Juror` y `Agent` solo tienen `read`. Sin `create`, `update` ni `delete`, ningún cliente puede escribirlas (DAB deniega por defecto). En I1a se cargan por SQL (sección 3).

### Case

```ts
@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.authorUserId),
  exclude: ['dismissed'],
})
export class Case {
  @uuid() id!: string;
  @text({ max: 36 }) agent_id!: string;
  @one(() => Agent) agent?: Agent;
  @text({ max: 1000 }) text!: string;
  @text({ max: 100 }) category!: string;
  @text({ max: 500, optional: true }) tags?: string;   // comma-separated
  @text({ max: 255 }) authorUserId!: string;
  @boolean({ default: false }) dismissed!: boolean;
  @date() createdAt!: Date;
  @many(() => Testimony) testimonies?: Testimony[];
}
```

### Testimony

```ts
@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.authorUserId).and(claims.email.eq(item.authorEmail)),
})
export class Testimony {
  @uuid() id!: string;
  @text({ max: 36 }) case_id!: string;
  @one(() => Case) case?: Case;
  @text({ max: 2000 }) answer!: string;
  @text({ max: 1000 }) definition!: string;
  @text({ max: 255 }) authorUserId!: string;
  @email({ max: 254 }) authorEmail!: string;
  @date() createdAt!: Date;
}
```

- **Solo inserción (reglas 15 y 23):** `Case` y `Testimony` no tienen `update` ni `delete`.
- **`dismissed`:** excluido del `create` para que nadie cree un case ya retirado. Ver la duda D1.
- **`authorEmail`:** la política también exige `claims.email` en `Testimony`, si el token de Fabric trae ese claim (riesgo R3).
- **Autoría en el cliente:** `authorUserId` se rellena con `session.user.id` y `authorEmail` con `session.user.email`. La política no los rellena; solo los valida.

## 3. Seed

Los datos de ejemplo no contienen datos personales.

**Contenido de `rayfin/seed/seed.sql`:**
- Dominios `Finance` y `Sales`.
- Jurors con emails `@example.com`: un `expert` y un `approver` por dominio, y un `admin`.
- Un `Agent` de ejemplo por dominio.

**Formato:**
- IDs fijos con el patrón `00000000-0000-4000-8000-0000000000NN`, que el hook de pre-commit permite.
- Los `workspaceId` e `itemId` de los agentes de ejemplo usan el mismo patrón. Son marcadores; los reales se registrarán en I1b o I3, cuando exista un Data Agent.
- Idempotente: `IF NOT EXISTS (…) INSERT`, para poder ejecutarlo dos veces.

**Cómo se carga:**
1. Desplegar el esquema con `npx.cmd rayfin up`.
2. Abrir la base de datos SQL hija de la app en `FabricApp-AgentJury` y copiar su cadena de conexión desde el portal.
3. Antes de escribir `seed.sql`, consultar `INFORMATION_SCHEMA.TABLES` y `COLUMNS` para usar los nombres reales de tablas y columnas que genera Rayfin. La documentación no los da (riesgo R4).
4. Ejecutar `seed.sql` con la extensión mssql de VS Code, conectada con Entra ID como propietaria del item.

**Cómo te das de alta como admin, en tu máquina:** `rayfin/seed/admin.sql` inserta un juror `admin` con `$(AdminEmail)`, una variable SQLCMD. El valor no se escribe en ningún fichero versionado:
1. En VS Code, abrir `admin.sql` y activar el modo SQLCMD de la extensión mssql.
2. Ejecutarlo con `:setvar AdminEmail <ACCOUNT_EMAIL>`, con el valor tomado de `.private/values.env`.
3. Alternativa: `sqlcmd -v AdminEmail=<ACCOUNT_EMAIL> -i rayfin/seed/admin.sql` con la cadena de conexión.

Si escribes el valor en el editor, no guardes el fichero: el hook bloquearía el commit de todos modos.

## 4. i18n: i18next + react-i18next

**Por qué:**
- Es la opción más usada en React, con TypeScript y una API mínima (`useTranslation`, `t`). Admite interpolación, plurales y claves anidadas.
- Los recursos son JSON planos (`en.json`, `es.json`), lo que facilita el test de claves iguales (regla 7).
- El cambio de idioma en caliente es una sola llamada (`i18n.changeLanguage`).

**Alternativa descartada:** `react-intl` (FormatJS). Usa mensajes ICU, más potentes de lo que necesitamos, y sus componentes de formato duplican lo que `Intl` ya hace en `src/lib/format.ts`.

**Decisiones:**
- **Sin detección automática.** No uso `i18next-browser-languagedetector`: la especificación dice inglés por defecto, no el idioma del navegador o del portal. El idioma inicial es el guardado en `localStorage` o, si no hay ninguno o no es válido, `en`.
- **Formatos de fecha y número:** `Intl.DateTimeFormat` y `Intl.NumberFormat`, con `en-GB` o `es-ES` según el idioma. El contenido de los usuarios se muestra tal cual.
- **Metáfora del juicio y ayuda:** cada pantalla tiene título y línea de ayuda en `screens.<screen>.title` y `screens.<screen>.help`, con el vocabulario de la sección 9.1.

## 5. Pantallas

| Pantalla | Datos | Acciones | Estados vacíos y de error |
|---|---|---|---|
| 1. Agents | `Agent` con su `Domain`. Nº de cases por estado (en I1a, `under_review` y `dismissed`). % de acuerdo juez-humano: "—" hasta I4 | Abrir el case board de un agent | Sin agents: explica que los registra un admin. Error de carga: mensaje y botón de reintento |
| 2. Case board | Cases del agent en columnas `under_review` · `ruled` · `disputed` · `dismissed`, y filtro por categoría | "New case" (solo si eres juror activo del dominio del agent): pregunta, categoría, tags, primera respuesta y su definición | Columna vacía con texto de ayuda. Error de carga o de alta: mensaje sin perder lo escrito |
| 3. Case detail | El case y sus testimonies, con definición, autor y fecha. Sin votos ni historial | "Add testimony" (respuesta alternativa), con la misma condición de juror | Sin testimonies: explica cómo añadir uno |

**Consultas:**
- Las listas usan `.first(n).executePaginated()` y siguen el cursor hasta `hasNextPage === false`, porque `.execute()` corta en 100 filas sin avisar.
- `Domain` y `Juror` son tablas pequeñas, pero se leen igual para no depender de ese límite.

**Saber si el usuario es juror:** se buscan sus filas `Juror` por `email` (sin distinguir mayúsculas) con `session.user.email`. No es una frontera de seguridad (regla 21): solo decide qué botones se muestran. La validez real de cada aportación se calcula en I2.

## 6. Tests

| Spec | Qué comprueba |
|---|---|
| `src/locales/locales.spec.ts` | `en.json` y `es.json` tienen exactamente las mismas claves anidadas, sin valores vacíos (regla 7) |
| `src/i18n/language-preference.spec.ts` | Por defecto `en`; guarda y recupera `es`; ignora valores no válidos; usa solo la clave `agent-jury.language` |
| `src/lib/format.spec.ts` | La misma fecha y el mismo número se formatean distinto en `en-GB` y `es-ES` |
| `src/domain/case-state.spec.ts` | `dismissed` → `dismissed`; el resto → `under_review` (I2 lo amplía) |
| `src/domain/case-board.spec.ts` | Agrupación por estado (con columnas vacías) y filtro por categoría |
| `src/data/jurors.spec.ts` | `findCurrentJurors`: coincidencia sin distinguir mayúsculas, ignora inactivos, admite varios dominios |
| `src/data/*.service.spec.ts` | Con el cliente simulado en el test (no son datos de la app): campos seleccionados, paginación completa, y `authorUserId`/`authorEmail` tomados de la sesión |
| `src/screens/*.spec.tsx` | Estados de carga, vacío y error de cada pantalla. "New case" y "Add testimony" solo aparecen a jurors activos del dominio |
| `src/App.spec.tsx` | Actualizado: cabecera con selector; al cambiar a ES cambian los textos y la preferencia se guarda |
| `rayfin/data/entities.spec.ts` | Revisa el código fuente de cada entidad: `@text`/`@email` con `max`, claves foráneas `*_id` con `max: 36`, y ningún `update` ni `delete` en `Case` y `Testimony`. Lee el código y no importa las clases (riesgo R5) |

**Pruebas manuales contra la app desplegada**, porque no se pueden automatizar sin un segundo usuario:
- Crear un `Case` con un `authorUserId` ajeno desde la consola del navegador.
- Crear un `Domain` desde el cliente.

Ambas deben fallar (criterios A1 y A2).

## 7. Riesgos y dudas no confirmados en la documentación

| # | Riesgo o duda | Qué haré |
|---|---|---|
| **R1** | **Las políticas de `create`.** La documentación de Data API builder dice que las *database policies* no se aplican a `create` (un INSERT no tiene WHERE). Rayfin documenta políticas de `create` (`claims.sub.eq(item.createdBy)`) y dice que las compila bajo una clave `check`, lo que sugiere que sí las aplica, pero no lo dice expresamente. Si no se aplican, cualquiera podría insertar en nombre de otro y fallaría el criterio A1 | Prueba negativa justo después del primer despliegue y antes de construir pantallas. Si falla, me detengo y te consulto: la alternativa sería mover las altas a Functions, lo que adelantaría parte de I1b |
| **R2** | **Functions y permisos (afecta a I1b).** `ctx.getDataClient()` usa la identidad y los permisos de quien llama, no los de la app. Una Function no podrá escribir en `Domain`, `Juror` o `Agent` si `authenticated` no tiene `create`/`update`, y si los tiene, cualquier cliente podría escribir sin pasar por la Function. Las reglas 20 y 21 no se pueden cumplir tal como están escritas | Se decide al planificar I1b. Opciones: un claim de rol propio (`claims.role.eq('admin')`, si Fabric SSO lo permite) o que la Function escriba con la identidad de la app a través de una conexión externa a la base de datos |
| **R3** | **`claims.email` en Fabric SSO.** La documentación lo lista como claim admitido, pero no confirma que el token de Fabric lo traiga ni si es el UPN o el correo | Comprobarlo en la prueba de R1. Si no viene, quitar `.and(claims.email…)` de `Testimony` y aceptar que `authorEmail` lo declara el cliente |
| **R4** | **Escribir directamente en la base de datos.** La guía dice que la base de datos SQL "es de solo lectura en el portal" y que se puede copiar su cadena de conexión. No está claro si se puede insertar con la extensión mssql o sqlcmd, ni cómo se llaman las tablas y columnas generadas | Probarlo tras el primer despliegue. Si no se puede escribir, te consulto antes de cualquier alternativa (por ejemplo, conceder `create` temporal a `authenticated`, que va contra la regla 20) |
| **R5** | **Decoradores TC39 y SWC.** La guía avisa de que `@vitejs/plugin-react-swc`, que usa esta plantilla, no entiende los decoradores TC39 (`Expression expected`) | El frontend y los tests solo importan tipos de `rayfin/data` (`import type`), que se borran al compilar. Si aun así falla, cambiar a `@vitejs/plugin-react`, como indica la guía |
| **R6** | **`tsc -b` con la referencia a `rayfin/`.** Si importar tipos de un proyecto referenciado exige compilarlo antes, el build podría cambiar | Copiar la configuración de una plantilla plana oficial (sección 1) y comprobar `npm run build` antes de seguir |
| **R7** | **`createdAt` lo pone el cliente.** No encontré cómo dar un valor por defecto de servidor a `@date` (`default` es "a default value expression", sin ejemplos de fecha), así que un cliente podría falsear la fecha | Aceptarlo en I1a. Si `@date({ default: … })` admite una expresión SQL, usarla y excluir `createdAt` del `create` |
| **R8** | **`Case` es palabra reservada de SQL** (`CASE`). Rayfin debería entrecomillar el nombre de la tabla, pero no lo he confirmado | Si el despliegue falla por esto: `@entity('JuryCase')` y la clase sigue llamándose `Case` en el código |
| **R9** | **Alta en dos pasos.** Crear un case y su primer testimony son dos inserciones. Si falla la segunda, queda un case sin testimony, que no se puede borrar | La pantalla 3 permite añadirlo después. Se aceptan los cases sin testimony |
| **R10** | **Idioma de los visuales.** La plantilla pide el idioma al portal de Fabric para los textos de los visuales (`language.service.ts`) | Que sigan el idioma elegido en la app. En I1a no hay gráficos, así que el impacto es bajo |

**Dudas de la especificación:**
- **D1 — `dismissed` en una entidad de solo inserción.** Si `Case` no admite `update`, nadie puede retirarlo. Propuesta: en I1a nadie retira cases. Más adelante, un case se retiraría con una entidad aparte (`Dismissal`, de solo inserción) o con una Function de admin.
- **D2 — Un juror en varios dominios.** El modelo admite una fila `Juror` por par email–dominio. ¿Puede alguien ser `expert` en un dominio y `approver` en otro? El diseño lo permite.
- **D3 — El admin y los dominios.** `Juror.domain_id` es obligatorio, así que el admin tiene que pertenecer a un dominio. Alternativa: hacer `domain` opcional solo para el admin.
- **D4 — Quién crea cases.** La política no puede comprobar que el autor sea juror del dominio. En I1a la UI solo muestra el botón a los jurors activos del dominio, y la validez se calcula en I2 (regla 18).

## 8. Criterios de aceptación de I1a

De la sección 13 de la especificación, en lo que aplica a I1a:
- **A1.** Un usuario no puede crear un `Case` ni un `Testimony` en nombre de otro (prueba negativa contra la app desplegada).
- **A2.** Ningún cliente puede crear, modificar ni borrar `Domain`, `Juror` o `Agent`, y nadie puede modificar ni borrar `Case` ni `Testimony` (prueba negativa).
- **A3.** Ninguna consulta fallida se sustituye por datos simulados: cada pantalla muestra un error útil y un botón de reintento.

Criterio de salida de I1 (sección 12), adaptado a I1a:
- **A4.** En la app desplegada en `FabricApp-AgentJury`, un juror de ejemplo de los cargados con el seed, o tú tras darte de alta, crea un case con su primer testimony y añade un testimony alternativo.

Idioma (sección 9 y reglas 6–8):
- **A5.** El selector EN | ES aparece en la cabecera de las tres pantallas, el inglés es el idioma por defecto y la elección se recuerda al recargar.
- **A6.** No hay textos visibles fuera de `en.json`/`es.json`, y el test de claves iguales pasa.
- **A7.** Fechas y números siguen `en-GB`/`es-ES`. El texto de cases y testimonies se muestra tal cual.

Calidad:
- **A8.** `npm run build`, `npm test` y `npm run lint` pasan, y el hook de pre-commit no bloquea nada.
- **A9.** Todos los campos de texto tienen `max` (test de entidades).

## 9. Orden de trabajo

Me detengo para consultarte en los pasos 2 y 4 si R1 o R4 fallan.

1. Activar datos, crear `rayfin/tsconfig.json` y las entidades, y comprobar `npm run build`.
2. `npx.cmd rayfin up` (y `git restore rayfin/rayfin.yml` para la URL). Pruebas negativas A1, A2 y R3.
3. Revisar las tablas generadas, escribir `seed.sql` y `admin.sql`.
4. Cargar el seed y darte de alta como admin.
5. i18n con sus tests.
6. Servicios de datos y funciones de dominio con sus tests.
7. Pantallas 1–3 con sus tests.
8. Despliegue, comprobación de A4–A7 y actualización de `estado.md`.
