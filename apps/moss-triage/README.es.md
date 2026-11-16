[English](README.md) · Español

# Moss Triage

> **¿Has probado a apagarlo y volverlo a encender?**

Moss Triage es una Fabric App para un servicio de soporte (ficticio) que trabaja en el sótano. Los agentes ven los tickets abiertos, se asignan uno, lo escalan a nivel 2, responden al cliente y lo cierran. Cuando necesitan contexto, le preguntan a **Ric**, un Fabric Data Agent que responde en lenguaje natural sobre los mismos datos, sin salir de la app.

Se creó para la sesión *De «qué interesante» a «esto sí podría usarlo»* (Microsoft Reactor Data Days, noviembre de 2026) como segunda demo. La primera enseña la ontología de Fabric IQ y el Data Agent; esta enseña ese agente dentro de una app que la gente puede usar a diario. Está hecha con Fabricator y VS Code.

La interfaz está **solo en español**: es una demo para público hispanohablante y una excepción a la regla bilingüe de [conventions.md](../../docs/conventions.md). El humor es un guiño a la cultura del soporte informático; la mascota, Ping, y todos los datos son originales y ficticios.

## Qué hace

- **Tablero de tickets:** los tickets abiertos de un Lakehouse, con prioridad, canal, categoría y cuenta atrás del SLA. Filtros (prioridad, canal, categoría, «solo SLA incumplido»), vistas y paginación.
- **Panel del equipo:** quién está de guardia, la carga del equipo y algunos indicadores (abiertos, SLA incumplido, resueltos hoy, racha sin SLA roto).
- **Detalle del ticket**, con cuatro pestañas:
  - **Ticket:** el mensaje del cliente y su contexto.
  - **Responder:** asignárselo, escalarlo a nivel 2 (N2), escribir la respuesta y resolverlo.
  - **✦ Preguntar a Ric:** preguntar al Data Agent por el ticket o el cliente; la respuesta se puede copiar a la contestación.
  - **Historial:** cada asignación, escalado, respuesta y resolución.
- **Manual del sótano:** una guía dentro de la app con el vocabulario (N1/N2, SLA…), el flujo de trabajo y los atajos de teclado.

## Cómo funciona

| Camino | Por dónde va | Con qué identidad |
|---|---|---|
| Leer tickets, clientes y equipo | Conector `ricsupport` (`fabric-sqlanalytics`) → SQL analytics endpoint del Lakehouse, solo lectura | La app |
| Asignar, escalar, responder, resolver | Servicio de datos de Rayfin → base de datos de la app (`TicketAssignment`, `TicketEvent`) | El usuario que ha iniciado sesión |
| Preguntar a Ric | Rayfin Function `askRic` → endpoint MCP del Data Agent publicado → ontología → Lakehouse | La app (la dueña del elemento) |

La app nunca escribe en el Lakehouse: el estado del flujo vive en su propia base de datos.

`askRic` se ejecuta en el servidor: lee el endpoint MCP del secreto `RIC_DATA_AGENT_MCP_URL`, obtiene un token de Fabric con `ctx.Tokens.Fabric` y llama al agente por MCP (`initialize` → `tools/list` → `tools/call`). Las respuestas suelen tardar entre 15 y 20 segundos.

> **Nota de seguridad.** La identidad de la app es la persona dueña del elemento Fabric App, así que Ric responde con sus permisos. En una demo está bien. Para un uso real, dale a la app una identidad dedicada con el mínimo privilegio y decide en la Function a qué agente puede llamar cada usuario.

## Requisitos

- Todo lo del [README raíz](../../README.es.md#requisitos-comunes).
- Un Lakehouse con tres tablas: `tickets`, `customers` y `support_team`. Las columnas que espera la app están en [`rayfin/connectors/ricsupport/schema.ts`](rayfin/connectors/ricsupport/schema.ts). Los datos de la demo los genera un notebook que no forma parte de este repositorio.
- Un Fabric Data Agent **publicado** sobre esos datos (en la demo, encima de una ontología de Fabric IQ), con su endpoint MCP (agente → *Settings* → *Model Context Protocol*).
- Una capacidad de Fabric de pago (los Data Agents no funcionan en capacidades de prueba).

## Configuración

Ejecuta todos los comandos desde `apps/moss-triage`.

1. Instala las dependencias:

   ```powershell
   npm.cmd ci
   ```

2. Crea `rayfin/.env` a partir del ejemplo (Git lo ignora) y rellena los IDs del workspace y del Lakehouse:

   ```powershell
   Copy-Item rayfin/.env.example rayfin/.env
   notepad rayfin/.env
   ```

3. Configura el secreto con el endpoint MCP del agente, en local y para la app publicada (Fabricator → *Código* → *Secretos*, o `npx.cmd rayfin secret set RIC_DATA_AGENT_MCP_URL`). En local, las Rayfin Functions lo leen de `packages/functions/local.settings.json`, que Git también ignora.

4. Arráncala:

   ```powershell
   npm.cmd run dev
   ```

## Publicar

```powershell
npx.cmd rayfin up
```

`rayfin up` escribe la URL publicada en `rayfin/rayfin.yml`. No la subas: `allowedRedirectUris` la lee de `MOSS_TRIAGE_APP_URL` en `rayfin/.env`. Después de cada publicación, revisa `git diff rayfin/rayfin.yml` y restaura el fichero si aparece la URL literal (consulta [conventions.md](../../docs/conventions.md#rayfinyml-after-a-deploy)).

## Lecciones aprendidas

Los problemas que encontramos con esta app están en [docs/lessons-learned.md](../../docs/lessons-learned.md#9-moss-triage-fabricator-and-a-data-agent-in-an-app) (en inglés).
