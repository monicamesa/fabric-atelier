# Estado del proyecto — traspaso

> Última actualización: 2026-11-09 · Especificación: [v0.3](../especificacion-general.md)

## Hecho

Repositorio `fabric-atelier` publicado en https://github.com/monicamesa/fabric-atelier (rama `main`).

| Commit | Contenido |
|---|---|
| `569c1ef` | Scaffold de `apps/agent-jury` con la plantilla Data App de Rayfin (CLI 1.36.2), sin modificar |
| `69e8b00` | Eliminados `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md` y el workflow de CodeQL de la plantilla |
| `644ad43` | `.vscode/mcp.json` para que GitHub Copilot use el servidor MCP de Rayfin |
| `f0a3765` | README de la raíz, `docs/conventions.md`, README de la app, `docs/`, `fabric/notebooks/` y "Project rules" en `AGENTS.md` |
| `afe41e0` | Especificación v0.3 (nombres en inglés, workspaces) y regla de almacenamiento en el navegador |
| (este commit) | Campos de la sección 7 en camelCase, regla de nombres en `AGENTS.md` y este documento |

Estado de la app:
- Plantilla sin cambios de código. Datos desactivados (`services.data.enabled: false`), sin connectors y sin desplegar.
- `npm ci`, `npm run build` y `npm test` pasan con Node 24.22.1 (11 ficheros, 138 tests).
- El servidor MCP de Rayfin (1.36.2) arranca y responde.

## Decisiones

- **Estructura:** un proyecto npm independiente por app en `apps/<app>/`. La raíz no es un npm workspace.
- **Workspaces de Fabric:** `FabricApp-AgentJury` (app, Lakehouse `jury_lh`, notebooks) y `FabricApp-AgentJury-Demo` (datos y Data Agents a evaluar).
- **Nombres en código:** en inglés, según la sección 9.1 (`Domain`, `Juror`, `Agent`, `Case`, `Testimony`, `Vote`, `Hearing`, `Appeal`). Estados: `under_review`, `ruled`, `disputed`, `dismissed`. Notebooks `evaluate_agent` y `export_case_law`.
- **Nombres de campo:** camelCase, salvo las claves foráneas de relaciones, que Rayfin exige con el formato `{property}_id`. Verificado en Microsoft Learn, "Define data models for Fabric Apps".
- **Persistencia:** los datos del dominio van a la base de datos de la app mediante entidades de Rayfin. En el navegador solo se guarda la preferencia de idioma.
- **Node.js:** 24, instalado con winget y anclado con `winget pin` a `24.*`. Se descartó nvm-windows (ver problemas del entorno).
- **MCP:** `@microsoft/rayfin-mcp` sin versión fija, porque lo gestiona la CLI de Rayfin.
- **CI:** CodeQL desactivado hasta que el repositorio sea público.
- **Commits:** prefijo con el nombre de la app (`agent-jury:`) o `repo:` para cambios solo de la raíz.

## Pendiente (en orden)

1. Abrir `apps/agent-jury` como carpeta en VS Code para que Copilot cargue `.vscode/mcp.json`. Con `C:\Dev\fabric-apps` abierta no lo lee.
2. Crear los workspaces `FabricApp-AgentJury` y `FabricApp-AgentJury-Demo` en una capacidad F2 o superior de pago, en una región con Fabric Apps.
3. **Iteración I1:**
   1. Activar datos en `rayfin/rayfin.yml` (dialecto `mssql`). Comprobar en qué carpeta espera las entidades esta plantilla (las plantillas planas usan `rayfin/data/`).
   2. Entidades `Domain`, `Juror`, `Agent`, `Case` y `Testimony` según la sección 7.
   3. Base de i18n EN/ES: selector en la cabecera, `locales/en.json` y `locales/es.json`, y el test de claves iguales.
   4. Pantallas 1–3 sin votos.
   5. Primer despliegue en `FabricApp-AgentJury`.
4. Iteraciones I2 a I5, según la sección 12 de la especificación.
5. Tareas de [docs/conventions.md](../../../../docs/conventions.md#pending): CodeQL al hacer público el repositorio, revisión de `npm audit --omit=dev` y carga de cada pantalla bajo demanda.

## Problemas conocidos del entorno

- **Ruta de usuario con tilde (`C:\Users\MónicaMesa`):** algunas herramientas no la leen bien. nvm-windows no encontraba su propia carpeta, y npm muestra la ruta como `M├│nicaMesa`. Instalar las herramientas fuera de la carpeta de usuario.
- **PowerShell bloquea `npm.ps1`:** la política de ejecución lo impide. Usar `npm.cmd` y `npx.cmd`.
- **Instalaciones con winget que piden administrador:** desde la terminal de VS Code la ventana de UAC no aparece y la instalación termina con el código 1602. Lanzarlas desde una PowerShell abierta como administrador.
- **La terminal integrada a veces no devuelve salida,** aunque el comando sí se ejecuta. Un `npm ci` repetido mientras el anterior seguía en marcha provocó `ENOTEMPTY` y `EPERM`. Antes de repetir un comando largo, comprobar que no queda ningún proceso `node`.
- **Avisos de `npm ci` heredados de la plantilla:** paquetes obsoletos (`koa-router`, `prebuild-install`, `glob`), 25 vulnerabilidades (14 moderadas, 11 altas) y 7 paquetes con scripts de instalación sin aprobar en `allowScripts`.
- **Avisos del build:** el bundle principal pesa 2,26 MB (726 kB comprimido), más que el umbral de 500 kB de Vite.
- **`.vscode/mcp.json` usa `npx.cmd`:** solo funciona en Windows.
- **Identidad de Git:** este repositorio usa `MonicaMesa` / `monica.mesa.r@gmail.com` en su configuración local. La configuración global es `Monica Mesa` / email noreply de GitHub.
