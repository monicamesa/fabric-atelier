<!-- repo-only -->[English](user-guide.md) · Español<!-- /repo-only -->

# Agent Jury · Guía de usuario

Agent Jury pone a personas de negocio a decidir qué respuesta es la correcta antes de dejar que un juez de IA califique a un Fabric Data Agent. Esta guía explica cómo se juega y qué reglas hay.<!-- repo-only --> Para probar la app de principio a fin, usa el [guion de pruebas](manual-test.es.md). English version: [user-guide.md](user-guide.md).<!-- /repo-only -->

## Qué es y quién hace qué

Un Data Agent responde preguntas de negocio, pero nadie le ha dicho qué respuesta es la buena. En Agent Jury el jurado decide primero la respuesta esperada de cada pregunta; después un juez de IA compara lo que contesta el agente con esa respuesta, y el jurado revisa al juez.

Cada persona tiene **un único rol**:

| Rol | Qué puede hacer |
| --- | --- |
| Experto | Proponer casos y respuestas, votarlos, desestimar sus propios casos y revisar los veredictos del juez |
| Aprobador | Todo lo del experto, y además: un caso solo queda resuelto si lo confirma el voto de un aprobador, y solo un aprobador puede reabrir un caso resuelto porque su respuesta esperada era incorrecta |
| Admin | Todo lo del experto (su voto cuenta como el de un experto), y además gestiona en Secretaría quién es jurado y qué agentes se evalúan, **inicia y cancela vistas** y puede desestimar cualquier caso |

Quien no está en el jurado no entra: al abrir la app ve "¡Protesto!" con el aviso "Todavía no estás en este jurado" y un botón para copiar su nombre de inicio de sesión y pasárselo a un admin, que lo añade en Secretaría.

Palabras del juego:

- **Caso**: una pregunta de negocio.
- **Respuesta** (testimonio): una respuesta propuesta para un caso, con su definición.
- **Resolución**: la respuesta que el jurado da por buena. El caso queda **resuelto**.
- **Vista**: una ejecución del agente contra casos resueltos.
- **Veredicto**: lo que dice el juez de IA (Correcta, Incorrecta o Dudosa). La palabra "veredicto" es solo del juez; lo del jurado es la "resolución".
- **Recurso**: una revisión del jurado que no coincide con el veredicto del juez.
- **Jurisprudencia**: el conjunto de casos resueltos, exportable a CSV.

## Cómo se juega

Una partida va de una pregunta de negocio a una respuesta acordada, y de ahí a medir al agente y al juez. En la app, **Cómo se juega** (un enlace en Home y el último paso de la Intro) muestra las cinco etapas (Proponer · Votar · Resuelto · Vista · Revisar) como un recorrido dibujado con una ilustración para cada una, un ejemplo y las preguntas más frecuentes; este texto es su versión detallada.

**¿No sabes qué hacer? Empieza en Home: "Tu turno" está en la columna de la derecha, junto al titular.** Enumera, por orden de urgencia y con un enlace cada una, lo que te necesita ahora: casos que esperan tu voto, disputas en las que puedes dar tu opinión, casos que necesitan el voto de una aprobadora (aprobadores), veredictos del juez por revisar y, para los admins, casos resueltos listos para una vista. Si no hay nada pendiente dice "Estás al día" y enlaza a los casos abiertos. Bajo el titular, la línea "La partida" (propuestos · abiertos a votación · resueltos · en vista · revisados) muestra cuántos casos hay en cada paso y marca en coral dónde se acumula el trabajo. Cada caso de las listas indica además qué pasa ahora *para ti*.

**Elige primero el agente.** Arriba de Home, Casos y Vistas, "1 · Elige el agente" es el único sitio donde se cambia de agente: todo lo que ves y propones es para ese agente.

**La fuente** muestra una instantánea fechada de SalesModel, cifras de referencia, definiciones e ideas de preguntas; no consulta el modelo.

¿Algo confuso o una idea? **Danos tu opinión** (arriba a la derecha, en todas las páginas) envía una nota corta a los admins.

1. **Preparar la sala (admin).** En **Secretaría** añade a los jurados (email con el que entran en Fabric y rol) y registra el agente que se va a evaluar: nombre, **ID del workspace** e **ID del agente**, que se copian de la dirección del agente en Fabric. Los admins también pueden editar su propio nombre visible (Secretaría → pestaña **Jurados** → **Editar datos**), leer las notas que enviaron los jurados en la pestaña **Opiniones** (lo más reciente primero, sin nombres ni correos) y, en la pestaña **Agentes**, activar o desactivar **Mostrar datos de ejemplo** (desactivado por defecto; no se borra nada).
2. **Proponer un caso.** Cualquier jurado pulsa **+ Proponer un caso** en Casos, escribe la pregunta como la haría negocio ("¿Cuántos clientes tenemos en España?"), una categoría, etiquetas opcionales y **su respuesta** con una definición (una frase). Los detalles opcionales (criterio, ventana de tiempo, población, fuente) ayudan a ver en qué se diferencian dos respuestas. Proponer un caso **no cuenta como voto**: tu propia respuesta empieza sin votos y tu voto sobre ella nunca cuenta.
3. **Votar.** El resto del jurado entra en el caso y pulsa **Votar la respuesta A**, o **Votar en contra** (con un motivo obligatorio), o propone otra con **Proponer otra respuesta** y su propia definición. Se puede cambiar de opinión: vale el último voto de cada persona. **Sobre qué se vota:** la respuesta que *debería* dar el agente. No juzgas el estilo ni recalculas la cifra; compruebas que la definición es la correcta para esta pregunta (cada respuesta muestra qué cuenta, el periodo, a quién cuenta y la tabla de origen). Si la definirías de otra forma, propón otra respuesta.
4. **Resolver o discutir.** Un caso queda *resuelto* cuando hay dos votos válidos a favor de la misma respuesta, al menos uno de ellos de un aprobador, y ningún aprobador en contra (detalle abajo). Si dos respuestas distintas tienen apoyo, el caso pasa a **disputa**, y ahí aparecen las definiciones que cada área usa sin saberlo (por ejemplo, país de facturación frente a país de envío).
5. **Celebrar una vista (admin).** En **Vistas**, **Iniciar una vista**: se eligen las preguntas resueltas (hasta 5 por ahora), la versión del agente (publicada o borrador) y se ve una estimación de tiempo. Un notebook en Fabric hace las preguntas al agente y el juez de IA da un veredicto por caso. La pantalla de la vista muestra el progreso y los veredictos según llegan. Bajo cada veredicto, **Cómo llegó el agente a su respuesta** (cerrado por defecto) enseña los pasos que dio el agente: dónde miró y la consulta que generó (DAX, SQL o KQL). Nunca muestra los datos que devolvió la consulta.
6. **Revisar al juez.** Cada jurado revisa cada veredicto: **Sí, de acuerdo** o **No, recurrir** (en escritorio, teclas A y X; J/K para moverse). Un recurso necesita un comentario. Si la mayoría del jurado corrige al juez, el ticker lo anuncia como "Juez corregido".
7. **Reabrir si hace falta.** Si un aprobador, al revisar un veredicto, elige el motivo "La respuesta esperada es incorrecta", el caso se reabre: los votos anteriores quedan en el acta como "antes de la revisión" y dejan de contar, y el jurado vota de nuevo.
8. **Medir la confianza en el juez.** Home muestra cuántas veces el jurado está de acuerdo con el juez ("n de m"), por agente y por criterio del juez. Por defecto la etiqueta dice "Juez: criterio estándar": el juez de IA usa el criterio estándar de Fabric. Si cambia el criterio, la confianza empieza de cero.
9. **Exportar la jurisprudencia.** En Casos, **Exportar jurisprudencia** descarga un CSV (`question,expected_answer,category,tags`) con los casos resueltos del agente, para reutilizarlo en otras evaluaciones.

La primera vez, la app enseña una Intro de tres pasos; se puede repetir desde Home con **Cómo funciona**.

### Idioma de las preguntas

Las preguntas, respuestas y definiciones **no se traducen nunca**: la pregunta se envía al agente tal cual está escrita, y traducirla cambiaría la prueba. Escribe cada pregunta en el idioma en el que quieras probar al agente; el idioma de las pantallas (EN | ES) solo cambia los textos de la propia app. Cada caso muestra una pequeña insignia **EN** o **ES** junto a su pregunta: el idioma que eliges en el formulario de proponer (por defecto, el de la pantalla); los casos antiguos no tienen insignia.

## Las reglas, con precisión

### Cuándo queda resuelto un caso

Una respuesta resuelve el caso cuando se cumplen las tres cosas a la vez:

- Tiene **al menos 2 votos a favor válidos** (el umbral actual es 2).
- **Al menos uno** de esos votos es de un **aprobador**.
- **Ningún aprobador** ha votado en contra de esa respuesta.

Un voto es válido si lo emite un jurado activo y **no es el autor de esa respuesta**. Un voto en contra necesita un motivo; sin él no cuenta. Un admin vota como un experto, nunca con el peso de un aprobador.

Importante: con el umbral actual hacen falta **al menos dos personas que voten una respuesta ajena**, y una de ellas aprobadora. Con solo dos jurados nada puede resolverse (cada respuesta solo puede recibir el voto de la otra persona), así que para probar la app hacen falta **tres jurados**. Con un solo aprobador, los casos que proponga ese aprobador no se pueden resolver nunca (su propio voto no cuenta y resolver exige el voto de un aprobador), así que una sesión de juego debería tener **al menos 2 aprobadores**.

### Disputa y cómo se resuelve

El caso está en **disputa** si:

- dos o más respuestas tienen cada una algún voto a favor, aunque una tenga muchos más; o
- una misma respuesta tiene a la vez votos a favor y en contra **de aprobadores**.

No hay desempate automático ni gana la mayoría. La disputa se resuelve entre las personas, de una de estas formas:

- quien apoyaba una de las respuestas **cambia su voto** (a "en contra", con motivo), de modo que solo quede una respuesta con apoyo; o
- se **desestima** el caso (lo puede hacer su autor o un admin) si la pregunta es ambigua; el caso se conserva en el acta pero nunca se usa en una vista.

Cuando solo queda una respuesta con apoyo, se aplican las reglas de resolución de arriba.

### Vistas

- **Solo un admin** inicia (y cancela) vistas; los demás las ven y revisan.
- Solo entran casos **resueltos** (de jurados activos) y que no estén reabiertos. Máximo **5 casos por vista** por ahora.
- Se celebra **una vista a la vez** en toda la capacidad, con **10 minutos de descanso** entre vistas.
- Antes de iniciar, la app muestra una estimación de tiempo (unos 2 minutos de preparación más unos 30 segundos por pregunta).

### Reapertura (R9)

Un aprobador activo, al revisar un veredicto de una vista, elige el motivo "La respuesta esperada es incorrecta". Da igual lo que dijera el juez. El caso vuelve a "Abierto a votación": los votos antiguos quedan visibles como "antes de la revisión" pero no cuentan, y todos tienen que votar de nuevo. Si los votos nuevos se reparten entre respuestas, el caso pasa a disputa por las reglas normales. Un experto o un admin pueden revisar, pero **no reabren**. Como cada persona tiene un único rol, un admin no puede ser también aprobador: para reabrir hace falta una cuenta con rol de aprobador.

### Confianza en el juez

- Se calcula **por agente y por criterio del juez** (otro criterio es otro juez; un prompt propio muestra el nombre de su versión): el actual en grande y los anteriores como historial.
- Por cada veredicto decide la **mayoría** de las revisiones válidas; si hay empate, queda "pendiente" y no cuenta.
- Hay acuerdo cuando el jurado dice lo mismo que el juez (si el juez dice "Dudosa", el acuerdo es "Ambigua").
- Las revisiones con el motivo "La respuesta esperada es incorrecta" no cuentan (el juez comparó bien con una respuesta mala).
- La confianza es acuerdos / (acuerdos + desacuerdos). El porcentaje grande aparece a partir de 5 veredictos decididos; antes, solo "n de m".
- Los datos de demostración (filas marcadas "seed" o de comprobación) no cuentan.

### Otras reglas

| Regla | Cómo funciona |
| --- | --- |
| Cambiar de opinión | Vale la última revisión o voto de cada persona; nada se borra |
| Casos y respuestas de quien ya no es jurado activo | Se muestran como "no verificados" y no cuentan ni entran en vistas ni en la exportación |
| Datos de ejemplo | Lo sembrado para demos no sale en la exportación |
| Exportación | Solo casos resueltos del agente, no reabiertos, sin nombres, emails ni ids; las celdas que un Excel leería como fórmula llevan un `'` delante |

El agente no siempre responde lo mismo: con la pregunta de España ha respondido 141 una vez y 292 otra. Por eso merece la pena repetir vistas y mirar la evolución, no una sola ejecución.
