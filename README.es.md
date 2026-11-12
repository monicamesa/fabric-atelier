[English](README.md) · Español

# Fabric Atelier

Una colección de Fabric Apps creadas con [Rayfin](https://learn.microsoft.com/fabric/apps/overview), la CLI y el SDK para Microsoft Fabric Apps.

Cada app vive en su propia carpeta dentro de `apps/` y es un proyecto npm independiente.

Los documentos para desarrolladores (convenciones, planes de iteración, guía de diseño, lecciones aprendidas) están en inglés. Los documentos para usuarios (READMEs, guía de usuario, guion de pruebas manuales) están en inglés y en español.

## Apps

| App | Descripción | Estado | Carpeta |
|---|---|---|---|
| Agent Jury | ¿Quién juzga al juez? Expertos de negocio acuerdan las respuestas esperadas de los Fabric Data Agents y revisan los veredictos del juez de IA. | En desarrollo | [apps/agent-jury](apps/agent-jury) |

## Requisitos comunes

- Node.js 24, fijado con winget (la CLI de Rayfin admite Node.js 20, 22 y 24).
- Git.
- Un tenant de Microsoft Fabric con la carga de trabajo Fabric Apps activada, y un workspace en el que seas Colaborador, Miembro o Administrador.
- Cada app puede añadir sus propios requisitos; consulta su README.

Consulta [docs/conventions.md](docs/conventions.md) (en inglés) para ver las reglas comunes a todas las apps.

## Configuración inicial tras clonar

1. Crea tu archivo de valores privados a partir del ejemplo y rellénalo. Git lo ignora:

   ```powershell
   New-Item -ItemType Directory -Force .private | Out-Null
   Copy-Item private.example.env .private/values.env
   notepad .private/values.env
   ```

2. Activa los hooks de Git versionados:

   ```powershell
   git config core.hooksPath .githooks
   ```

El hook pre-commit bloquea cualquier línea añadida que contenga un valor de `.private/values.env`, un GUID que no esté en su lista permitida, un email que no sea noreply ni de ejemplo (`example.com`, `example.org`, `example.net` o cualquier dominio `*.example`), una URL de una Fabric App desplegada, un enlace de workspace del portal de Fabric o una ruta de usuario de Windows. Si falta `.private/values.env`, avisa y ejecuta solo las comprobaciones genéricas.

## Trabajar en una app

Ejecuta siempre los comandos de npm y Rayfin desde la carpeta de la app, nunca desde la raíz del repositorio:

```powershell
cd apps/agent-jury
npm ci
npm run dev
```

## Convención de commits

Empieza cada mensaje de commit con la app a la que afecta, seguida de dos puntos:

```text
agent-jury: add vote entity and consensus tests
```

Usa `repo:` para los cambios que solo afectan a la raíz del repositorio (README, documentos compartidos, `.gitignore`).

## Licencia

MIT, copyright Mónica Mesa. Consulta [LICENSE](LICENSE).
