[English](manual-test.md) · Español

# Agent Jury · Guion de pruebas manuales

Guion para probar la app de principio a fin. Las reglas están en la [guía de usuario](user-guide.es.md) ([English](user-guide.md)). Los nombres de pantallas y botones van en español, con el inglés entre paréntesis cuando cambia.

No escribas en este documento (ni en capturas que compartas) nombres, emails ni IDs reales.

## Antes de empezar

- La app en el entorno que vayas a probar, abierta en tu navegador, con la capacidad de Fabric encendida.
- Un admin (tú) y, para la Prueba B, **otras dos cuentas** del tenant (invitado o usuario nuevo): una aprobadora y una experta. **Con dos personas no se puede resolver un caso**: cada respuesta solo puede recibir el voto de la otra persona, y hacen falta dos votos válidos. Con tres sí.
- Tu cuenta es admin, y un admin no puede ser también aprobador. Para reabrir un caso hace falta una cuenta con rol de aprobador.
- **Con un solo aprobador, los casos que proponga ese aprobador no se pueden resolver nunca**: su propio voto no cuenta y para resolver hace falta el voto de un aprobador. Para una sesión de juego, **recomendamos al menos 2 aprobadores**, de modo que cada caso tenga un aprobador que no sea su autor.
- Una hora de capacidad: las vistas usan la capacidad compartida; solo se celebra una a la vez y hay 10 minutos de descanso entre vistas.
- Cuando no sepas qué hacer, mira **Tu turno** (Your turn) arriba en Home: te dice qué necesita tu atención ahora.

## Prueba A: tú sola (unos 15 minutos)

Con una sola persona no se puede resolver un caso, así que esta parte prueba todo lo demás.

- [ ] Recarga con Ctrl+Shift+R: sale la pantalla de lanzamiento (Sesión → Casos → En pie) y luego Home (Inicio).
- [ ] Home: **Cómo funciona** (How it works) abre la Intro; se puede saltar (**Saltar la introducción**) y vuelve a Home. En el último paso, **Leer la guía completa** abre la guía dentro de la app y **Volver** te devuelve.
- [ ] Cambia EN/ES: todos los textos cambian, sin "fallo" ni "fallado" en ningún sitio.
- [ ] Cambia el tema de Windows a oscuro y recarga: todo se lee bien.
- [ ] **Secretaría** (Clerk's office) → Agentes (Agents) → **Registrar el agente** (Register the agent): nombre, **ID del workspace** e **ID del agente**, copiados de la dirección del agente en Fabric. Un ID mal escrito se rechaza con un aviso. El agente nuevo aparece enseguida, también en los selectores de Home y Casos, sin recargar.
- [ ] Secretaría: **Mostrar datos de ejemplo** (Show example data) está desactivado en producción; al activarlo aparecen los jurados y agentes de ejemplo (etiquetados "Ejemplo") y los contadores de las pestañas cambian. Al recargar vuelve a estar desactivado.
- [ ] Secretaría → Jurados → tu fila → **Editar datos** (Edit details): cambia tu nombre visible y se ve reflejado en la lista.
- [ ] **Casos** (Cases) → **+ Proponer un caso**: propón 3 casos con respuesta y definición completa, con preguntas cuya respuesta conozcas (ver tabla). El formulario dice que la pregunta se envía al agente tal cual, en este idioma. Cada caso queda "abierto a votación" con 0 votos: proponer no es votar.
- [ ] Home → **Tu turno** (Your turn, columna de la derecha): al proponer tus casos dice "Estás al día" (solo esperas a los demás) con un enlace para proponer un caso; la línea "La partida" (propuestos · abiertos a votación · resueltos · en vista · revisados) cuenta tus casos y marca "Ahora: faltan votos" con "N casos".
- [ ] Las listas dicen qué pasa ahora para ti: en tus casos, "Lo propusiste tú: esperando a los demás".
- [ ] Ticker ("Último en el jurado"): aparece en Home cuando hay al menos 2 líneas, se mueve, se para al pasar el ratón o con el botón de pausa, y cada línea abre su caso.
- [ ] En uno de tus casos, **Votar la respuesta A** no está disponible para ti: "Es tu propia respuesta: tu voto no contaría". Cada respuesta muestra qué cuenta, el periodo, a quién cuenta y la tabla de origen.
- [ ] **Exportar jurisprudencia** (Export case law) está desactivado y el aviso explica por qué (aún no hay casos resueltos).
- [ ] Móvil (390 px): abre la app en el teléfono y recorre Home, Casos y un caso; nada se sale de la pantalla. En Secretaría los jurados se ven como tarjetas, sin recortes.

| Pregunta para proponer | Respuesta verificada | Definición |
| --- | --- | --- |
| ¿Cuántos clientes tenemos en España? | 141 | País de facturación (alternativas: 265 por país de envío, 292 cualquiera de los dos) |
| ¿Cuánto vendimos (neto) en el año fiscal 2026? | 2.183.973,48 | Neto sin impuestos ni portes, julio 2025 a junio 2026 |
| ¿Cuál es el valor medio de un pedido? | 2.226,97 | Neto; el agente suele dar 2.460,80 (bruto), un error seguro para la demo |

## Prueba B: con otras dos personas (unos 45 minutos)

Mejor en la misma llamada, cada una en su ordenador. Llamamos **Ana** a tu cuenta admin, **Beto** a la aprobadora y **Carla** a la experta.

**Acceso**

- [ ] Antes de añadirlas: Beto entra con su cuenta y ve "¡Protesto!" con "Todavía no estás en este jurado. Pide a un admin que te añada." y el botón **Copiar mi nombre de inicio de sesión**, más la línea "Envíaselo a un admin para que te añada." No hay botón de reintentar.
- [ ] Ana las añade en Secretaría → **Incorporar a un jurado**: Beto con rol Aprobador y Carla con rol Experto.
- [ ] Al recargar, cada una ve la Intro (su primera vez) y luego Home; al volver a recargar, va directa a Home.

**Resolver un caso**

- [ ] Beto y Carla ven en **Tu turno** "1 caso espera tu voto" (con un botón **Votar**); Beto, como aprobador, ve "1 caso necesita el voto de una aprobadora".
- [ ] Ana propone el caso de España con la respuesta 141 (país de facturación). Beto y Carla votan **Votar la respuesta A**: con el voto de Beto (aprobador) y el de Carla, el caso queda **resuelto** y el ticker lo anuncia. Mientras tanto, la respuesta decía "Faltan N votos a favor; al menos uno de una aprobadora".
- [ ] Ana propone otro caso (por ejemplo, el del año fiscal 2026) y solo Carla vota a favor: **no** se resuelve; la lista dice "Esperando a una aprobadora". Cuando Beto también vota, queda resuelto.

**Disputa**

- [ ] Un caso nuevo: Ana propone 141 y Beto propone **otra respuesta** (265, país de envío) con su definición. Carla vota 141 y Ana vota 265: el caso pasa a **disputa** y se ven las dos definiciones.
- [ ] Beto vota 141. Sigue en disputa mientras alguien apoye 265. Ana vota **en contra** de 265 con un motivo: queda solo 141 con apoyo y el caso se **resuelve**. (No hay desempate por mayoría: la disputa solo se acaba cuando se retira el apoyo.)
- [ ] Alternativa: otro caso ambiguo; Ana usa **Desestimar: la pregunta es ambigua** con un motivo y el caso queda desestimado, sin entrar nunca en una vista.

**Exportar**

- [ ] Ana pulsa **Exportar jurisprudencia** y abre el CSV en Excel: salen solo los casos resueltos, con acentos bien, sin nombres ni emails. El nombre del archivo lleva el agente y la fecha.

**Vista y revisión del juez**

- [ ] Ana ve en **Tu turno** "N casos resueltos listos para una vista". En **Vistas** (Hearings) → **Iniciar una vista** (Start a hearing): elige 1 a 3 casos resueltos (máximo 5), mira la estimación y la versión del agente (publicada o borrador), e inicia. Beto y Carla no ven el formulario: "Solo los admins pueden iniciar una vista."
- [ ] Mientras corre: se ve el progreso; no se puede iniciar otra. Si parece atascada, **Consultar a Fabric** (Check with Fabric) hace una sola pregunta; **Cancelar la vista** la detiene.
- [ ] Al acabar, hay un veredicto por caso (Correcta / Incorrecta / Dudosa). En **Tu turno**, cada jurado ve "N veredictos del juez por revisar".
- [ ] Ana, Beto y Carla revisan cada veredicto: **Sí, de acuerdo** o **No, recurrir** (con comentario). Si la mayoría corrige al juez, el ticker dice "Juez corregido". Home muestra la confianza como "n de m" (el porcentaje solo aparece a partir de 5 veredictos decididos).
- [ ] Beto (aprobador), al revisar el veredicto del caso de España, marca el motivo "La respuesta esperada es incorrecta": el caso se reabre, los votos antiguos salen como "antes de la revisión" en el acta y ya no cuentan, y Ana y Carla tienen que votar de nuevo. Una nueva vista ya no lo incluye. Carla (experta) puede revisar, pero ese motivo no reabre el caso.
- [ ] Al terminar: baja la capacidad o páusala.

Si algo falla, apunta la pantalla, la hora y una captura sin datos personales, y pásaselo a Copilot.
