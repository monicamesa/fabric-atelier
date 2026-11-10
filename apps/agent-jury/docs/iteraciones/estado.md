# Estado del proyecto — traspaso

> Última actualización: 2026-11-09 · Especificación: [v0.3](../especificacion-general.md) · Convenciones: [docs/conventions.md](../../../../docs/conventions.md)

## Qué está hecho

### Entorno

| Herramienta | Versión | Notas |
|---|---|---|
| Node.js | 24.22.1 | Instalado con winget (`OpenJS.NodeJS.LTS`) en `C:\Program Files\nodejs`, anclado con `winget pin` a `24.*` |
| npm | 11.19.1 | El que trae Node 24.22.1 |
| Rayfin CLI | 1.36.2 | Dependencia local de la app (`npx rayfin`), no instalada de forma global |
| Servidor MCP de Rayfin | 1.36.2 | Arranca y responde; configurado en `.mcp.json` y `.vscode/mcp.json` |
| Git | 2.56.0 | Identidad local del repositorio: `MonicaMesa` / `<PERSONAL_EMAIL>` |

### Repositorio

- `C:\Dev\fabric-apps\fabric-atelier`, publicado en https://github.com/monicamesa/fabric-atelier (rama `main`).
- Commits principales:

| Commit | Contenido |
|---|---|
| `569c1ef` | Scaffold de `apps/agent-jury` con la plantilla Data App de Rayfin, sin modificar |
| `69e8b00` | Eliminados `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md` y el workflow de CodeQL de la plantilla |
| `644ad43` | `.vscode/mcp.json` para GitHub Copilot |
| `f0a3765` | README de la raíz, `docs/conventions.md`, README de la app, estructura y "Project rules" en `AGENTS.md` |
| `afe41e0` | Especificación v0.3: nombres en inglés y workspaces |
| `a504d5e` | Campos de la sección 7 en camelCase y regla de nombres en `AGENTS.md` |
| `a2063d1` | Fase 1 desplegada en `FabricApp-AgentJury` |
| `ec0b63d` | Valores privados en `.private/values.env`, hook de pre-commit y limpieza de valores personales |
| `c26b860` | `.vscode/settings.json` de la app fuera de Git (`.vscode/mcp.json` sigue versionado) |

### Estructura y documentación

```text
fabric-atelier/
├── README.md                 # Colección de apps, requisitos comunes, convención de commits
├── docs/conventions.md       # Reglas comunes: Requirements, Exceptions, Pending
└── apps/agent-jury/
    ├── AGENTS.md             # Instrucciones de la plantilla + "Project rules"
    ├── README.md             # Descripción, versiones fijadas, comandos
    ├── docs/
    │   ├── especificacion-general.md
    │   └── iteraciones/estado.md
    ├── fabric/notebooks/     # Vacía: aquí irán evaluate_agent y export_case_law
    ├── rayfin/rayfin.yml     # Datos desactivados, sin connectors
    └── src/                  # Código de la plantilla, sin cambios
```

- La app es la plantilla sin cambios de código. `npm ci`, `npm run build` y `npm test` pasan con Node 24.22.1 (11 ficheros, 138 tests).
- **Fase 1 completada y comprobada (2026-11-09):** la plantilla está desplegada en el workspace `FabricApp-AgentJury` (capacidad `fclabfrc01`, France Central) con `npx.cmd rayfin up` (CLI 1.36.2), y la app se abre en el portal de Fabric.
  - Item Rayfin `agent-jury` (AppBackend). Servicios: `auth` activado, `data` desactivado.
  - App: `<APP_URL_AGENT_JURY>` (valor en `.private/values.env`).
  - Acceso a los ficheros estáticos: `assetAccess: protected` (solo usuarios con permiso de lectura sobre el item de Fabric, con inicio de sesión).
  - `rayfin up` añadió a `rayfin.yml` `http://127.0.0.1:5173` y la URL de la app en `allowedRedirectUris`, `assetAccess: protected` y `functions.enabled: false`. La URL de la app no se versiona: ver `rayfin.yml` en `docs/conventions.md`.
  - `rayfin/.env` y `rayfin/.deployments.json` siguen fuera de Git (`.gitignore`). El enlace al portal y los IDs están en `.deployments.json` y en `npx.cmd rayfin up status`.

## Decisiones de esta sesión

Solo las que no están ya en la especificación ni en `conventions.md`.

- **Se descartó nvm-windows.** Se instaló dentro de `<WINDOWS_USER_PATH>\AppData\Local\nvm` y no admite rutas con caracteres no ASCII. `nvm root C:\nvm4w` falló con "could not be found" (leía mal la tilde de la ruta) y, al reescribir `settings.txt`, borró la línea `path:` del enlace de Node. Se desinstaló y Node 24 se instaló directamente con winget. No quedan variables `NVM_*`, entradas de nvm en el PATH ni la carpeta `C:\nvm4w`.
- **Node 24 se instaló desde una PowerShell de administrador** abierta fuera de VS Code, porque desde la terminal integrada la ventana de UAC no aparecía.
- **Se mantienen `.mcp.json` y `.vscode/mcp.json`.** El primero es para otros agentes y lo gestiona la CLI de Rayfin. El segundo es para GitHub Copilot y usa `npx.cmd` porque es la forma verificada en Windows. Copilot solo lo lee si `apps/agent-jury` es la carpeta abierta en VS Code.
- **Licencia:** se quitaron la licencia y las políticas de Microsoft que traía la plantilla. La licencia del repositorio se decidirá en la raíz.
- **README de la app:** sustituye al de la plantilla, que sigue disponible en el commit `569c1ef`.
- **Prefijo `repo:`** para los commits que solo afectan a la raíz (está en el README de la raíz).
- **Privacidad:**
  - Los valores privados viven en `.private/values.env` (ignorado por Git), y los ficheros versionados usan su nombre de clave (`<TENANT_ID>`). Plantilla: `private.example.env`.
  - El hook `.githooks/pre-commit` (activado con `git config core.hooksPath .githooks`) bloquea esos valores, GUID fuera de la lista permitida, emails, URLs de apps desplegadas, enlaces a workspaces del portal y rutas de usuario de Windows.
  - **El historial no se reescribió a propósito.** Los commits anteriores a `ec0b63d` contienen el email personal (también como autor de todos los commits), la URL de la app y la ruta de usuario de Windows. Son datos que se aceptan como públicos. Nunca se versionaron el tenant, los IDs de workspace, item o capacidad ni el email de la cuenta de Fabric.
  - El autor de los commits sigue siendo el email personal; no se usa la dirección noreply de GitHub.
- **Almacenamiento en el navegador:** solo la preferencia de idioma. Ningún dato de usuario en `localStorage`, `sessionStorage` ni IndexedDB (regla 2 de "Project rules" en `AGENTS.md`).
- **Modelo de datos:**
  - Se añadió `createdAt` a `Case`, `Testimony`, `Vote`, `Hearing` y `Appeal`, porque la sección 10 exige guardar autor y fecha.
  - Los campos de identidad (`authorUserId`, `voterUserId`…) van en camelCase aunque el ejemplo de Learn use `user_id`, porque no son claves foráneas de una relación.

## Qué queda pendiente (en orden)

1. **Iteración 1**, dividida en tres partes:
   - **I1a:** datos activados; entidades `Juror`, `Agent`, `Case`, `Testimony` y `CaseDismissal`; seed; base de i18n EN/ES; tests; verificación de R1, S-A y S-B; pantallas 1–3 sin votos (cuando llegue la guía de diseño). Plan en [I1a.md](I1a.md).
     - **Hecho (2026-11-09):** entidades, Functions de los spikes, scripts de seed, base de i18n, reglas de validez y servicios de datos, con sus tests. Desplegado en `FabricApp-AgentJury` con datos y Functions.
     - **R1 y S-B pasan. S-A pasa en la parte T-SQL, pero falla en la identidad:** la Function no recibe el token Rayfin del usuario, sino un token de plataforma sin `email`. Detalle en la sección 6 de [I1a.md](I1a.md).
     - **Identidad de admin resuelta (2026-11-09):**
       - El navegador inserta un `AdminRequest` y la Function `clerkExecute(requestId)` lo procesa con T-SQL.
       - Salvaguardas: solo ejecuta la acción guardada, cada petición se usa una vez, caduca a los 2 minutos y el resultado queda en `AdminRequestResult`.
       - Las pruebas (a)–(d), uso único, caducidad y registro de rechazos pasan (52 comprobaciones en dos ejecuciones).
       - Las Functions cuyo nombre empieza por `admin` o `runtime` devuelven NotFound, porque esas rutas las reserva el host de Azure Functions (regla 24 de `AGENTS.md`).
       - Se retiraron los spikes (`whoAmI`, `spikeSqlJuror`) y las Functions de diagnóstico (`dataPing`, `echo…`), y se comprobó que ya no responden.
     - **Datos:** se borraron los datos de prueba con un script privado y se cargó el seed (4 jurors y 2 agentes de ejemplo). La propietaria es admin activa.
     - `externalEntraExchange: true` está activado para los scripts de comprobación (ver `docs/conventions.md`).
     - La guía de diseño "The Docket" ya está en `docs/design/`, con sus tokens en `src/styles/docket-tokens.css`.
     - Pendiente: pantallas 1–3, que pasan a I1c.
   - **I1b:** acciones de `clerkExecute` y pantalla "Clerk's office" (Secretaría) para gestionar jurors y agentes. **Implementada y desplegada (2026-11-09)**; detalle y resultados en [I1b.md](I1b.md), secciones 7 y 9.
     - Decisiones D1–D5 aplicadas: `displayName` opcional (si falta, la parte del email antes de la @; emails completos solo en la secretaría), tres roles con descripción, ID del agente abreviado con copia, y base común de componentes en `src/components/docket/`.
     - Errores en lenguaje claro (403, 409, caducada…) con el detalle técnico plegado; autoprotección del admin en la interfaz y en `clerkExecute`; "Latest admin changes" incluye los rechazos.
     - Comprobaciones: tests unitarios y de pantalla, `i1b-checks.mjs` 21/21 e `i1a-checks.mjs` 22/22 tras el despliegue.
     - **Aprobada (2026-11-09)** con arreglos menores (sección 11 de [I1b.md](I1b.md)): corte de comprobaciones antiguas como secreto opcional `LEGACY_CHECK_CUTOFF_UTC` (solo en este despliegue), acción "Edit details", filtro de agentes, comprobación del foco con teclado, equipo con puntos suspensivos y pestaña corta en móvil.
   - **I1c:** pantallas 1–3 (Home, Cases, Case detail) con votos y el cálculo de estado R1–R8. **Aprobada con correcciones (2026-11-10) y desplegada en producción.** La prueba con dos personas queda aplazada al final del proyecto (ver Pendiente). Decisiones D1–D14, correcciones de la revisión y resultados en [I1c.md](I1c.md), secciones 8 y 11.
     - Pasos 0–7 del plan hechos: despliegue de pruebas, `Vote` y campos de definición, reglas R1–R8 con `CONSENSUS_MIN_VOTES = 2`, servicios, Case detail, Cases, Home y rutas por hash.
     - Carga en una sola ronda en paralelo, también sin agente en la URL. Sin *throttling*: Home 1,5 s / 0,5 s, Home sin agente 1,5 s / 0,4 s y Case detail 1,6 s / 0,5 s (primera / segunda carga). Antes, con *throttling* y cuatro rondas, unos 82 s.
     - `createdAt` no lo puede generar Rayfin: se ignoran los registros fechados más de 5 minutos en el futuro (riesgo documentado en la especificación).
     - Correcciones de la revisión: número de case con los 4 últimos caracteres, tabla de diferencias con borde coral y marcador "≠", ticker solo con fallos, "Desestimar" en español, ayuda de las filas en 2 líneas en móvil y confianza en el juez como línea compacta en Home móvil.
     - Pruebas: `npm test` (31 ficheros, 328 tests) y `tsc -b` pasan. Contra el despliegue de pruebas: I1c 19/19, I1a 46/46 e I1b 23/23 (2026-11-10, tras el despliegue en producción).
     - Capturas hechas (16, una pasada nueva tras las correcciones), en `.private/screenshots/i1c/`.
     - El *throttling* del 2026-11-09 (20 s por petición) se resolvió pausando y reanudando la capacidad. Las reglas de uso están en `docs/conventions.md` ("Capacity usage").
     - **Pendiente:**
       1. **Prueba manual con dos personas, aplazada al final del proyecto.**
          - **Preparación:**
            - Dos usuarios de prueba en Entra ID, del mismo tenant: uno aprobador y otro experto.
            - Los dos con licencia de Fabric y rol Viewer en el workspace de pruebas.
            - Sus emails se guardan en `.private/values.env` y nunca en el repositorio.
            - Desde la secretaría del despliegue de pruebas, la propietaria los da de alta como jurados activos con su rol.
          - **Escenario 1, fallado:** un tercero propone un case con su respuesta. El experto y el aprobador votan a favor, y el case pasa a `ruled` con dos votos de quien no es el autor (R2, R3).
          - **Escenario 2, en disputa:** cada uno propone y apoya una respuesta distinta en el mismo case, con los cuatro campos de definición. El case pasa a `disputed` (R4) y la tabla de diferencias marca las filas que difieren.
          - **Escenario 3, desestimación:** la retirada de quien no es el autor ni admin se ignora y el case sigue abierto. La del autor lo pasa a `dismissed` (R8). El acta muestra las dos retiradas.
       2. Consumo de CU de las comprobaciones, desde Capacity Metrics.
     - Para arrancar la app local contra pruebas: `node .private/use-test-env-local.mjs` y `npx.cmd vite` (`npm run dev` regenera `.env.local` desde producción). Al terminar, parar Vite y devolver `.env.local` a producción.
   - **Despliegue de pruebas (D12 de I1c): hecho.** Workspace propio en la misma capacidad, `rayfin/.env.test` y claves `*_TEST` en `.private/values.env`. Comandos en el README de la app ("Test deployment").
   - **Candidatos para más adelante** (fuera de I1b, decisión D3):
     - "Hasn't signed in yet" en la tabla de jurors: exige leer `dbo.Users` de Rayfin con T-SQL desde la Function.
     - "Copy invite link": el enlace de la app en Fabric es un dato privado del despliegue; habría que decidir de dónde se lee.
     - Nombre del workspace en las tarjetas de agentes (D4): con la API de Fabric, en I3.
   - Especificación v0.4: sin dominios, roles globales de juror, cases no verificados (R7) y retiradas con `CaseDismissal` (R8).
   - Criterio de salida de I1: un experto crea preguntas y propuestas en la app desplegada.

## Problemas conocidos del entorno

- **Política de ejecución de PowerShell:** bloquea `npm.ps1` y `npx.ps1` ("la ejecución de scripts está deshabilitada"). Usar siempre `npm.cmd` y `npx.cmd`, o cambiar la política con `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- **Bloqueos de `node_modules`:**
  - Dos `npm ci` simultáneos provocaron `ENOTEMPTY` y, después, `EPERM` al borrar carpetas.
  - Antes de repetir un comando de npm, comprobar que no queda ningún proceso: `Get-Process node`.
  - Si `node_modules` queda a medias: cerrar el Explorador de archivos en esa carpeta, ejecutar `Remove-Item -Recurse -Force node_modules` y lanzar `npm.cmd ci` una sola vez.
- **La terminal integrada a veces no devuelve salida,** aunque el comando se ejecuta igualmente. Esto fue lo que provocó el `npm ci` duplicado. Si pasa, abrir una terminal nueva en lugar de repetir el comando.
  - Le pasó también a `npx.cmd rayfin login`: no abrió el navegador ni inició sesión. En una terminal nueva funcionó a la primera.
- **Ruta de usuario con tilde (`<WINDOWS_USER_PATH>`):** nvm-windows no la admite, y npm muestra mal la tilde en los mensajes. Instalar las herramientas fuera de la carpeta de usuario cuando se pueda elegir.
- **Instalaciones con winget que piden administrador:** desde la terminal de VS Code fallan con el código 1602 (el registro dice "El usuario ha cancelado la instalación") porque la ventana de UAC no aparece. Lanzarlas desde una PowerShell abierta como administrador.
- **Avisos de `npm ci` heredados de la plantilla:**
  - Paquetes obsoletos: `koa-router`, `prebuild-install` y `glob`.
  - 25 vulnerabilidades (14 moderadas, 11 altas).
  - 7 paquetes con scripts de instalación sin aprobar en `allowScripts`.
  - La revisión está anotada en Pending de `conventions.md`.
- **Aviso del build:** el bundle principal pesa 2,26 MB (726 kB comprimido), más que el umbral de 500 kB de Vite. Anotado en Pending de `conventions.md`.
