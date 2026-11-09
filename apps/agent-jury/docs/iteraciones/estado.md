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

1. **Iteración 1**, dividida en dos partes:
   - **I1a:** datos activados; entidades `Juror`, `Agent`, `Case`, `Testimony` y `CaseDismissal`; seed; base de i18n EN/ES; tests; verificación de R1, S-A y S-B; pantallas 1–3 sin votos (cuando llegue la guía de diseño). Plan en [I1a.md](I1a.md).
     - **Hecho (2026-11-09):** entidades, Functions de los spikes, scripts de seed, base de i18n, reglas de validez y servicios de datos, con sus tests. Desplegado en `FabricApp-AgentJury` con datos y Functions.
     - **R1 y S-B pasan; S-A pasa en la parte T-SQL, pero falla en la identidad:** la Function no recibe el token Rayfin del usuario, sino un token de plataforma sin `email`. Detalle en la sección 6 de [I1a.md](I1a.md). **Parado a la espera de decidir cómo identifica la Function de admin a quien llama.**
     - Pendiente: ejecutar el seed y darte de alta como admin; pantallas 1–3 tras la guía de diseño; quitar los spikes (`whoAmI`, `spikeSqlJuror`) antes de I1b.
   - **I1b:** Function de admin (T-SQL con identidad de la app) y pantalla de administración de jurors y agentes.
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
