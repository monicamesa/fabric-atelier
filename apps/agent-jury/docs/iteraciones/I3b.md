# I3b — Recursos y confianza en el juez: plan

> Plan aprobado el 2026-11-12 (D1–D8) y en construcción en la rama `feature/i3b`; no está en `main` ni en producción. Parte de [I3.md](I3.md) (secciones 4, 5, 6, 13 y 17) y de la regla R9 de la [especificación](../especificacion-general.md). Vocabulario: "fallado" = `ruled`; "recurso" es solo el término de la interfaz (una revisión que discrepa del juez).

## 1. Alcance y datos de la demo

- **Entra:** entidad `VerdictReview`, recursos por jurados, confianza en el juez y R9 (un case `ruled` con una revisión válida `expected_answer_wrong` de un **aprobador activo** vuelve a `under_review`).
- **No entra:** export (I3c), pantalla de conflictos (I2).
- **Recurso de demostración, verificado el 2026-11-12** con consultas DAX de solo lectura contra `SalesModel`: clientes de España por `Customer[Country]` (facturación) = **141**; por `Customer[ShipToCountry]` (envío) = **265**; **cualquiera de los dos = 292** (`Country = "Spain"` o `ShipToCountry = "Spain"`). **No determinismo del agente:** en la prueba anterior (I3a) respondió 141; en la vista real de pruebas de I3b respondió **292** ("cuenta clientes cuyo Country o ShipToCountry es Spain"), con la misma versión publicada. El juez dio `incorrect` (esperado 141). Es parte de la historia de la demo: las tres cifras son defendibles según la definición, y por eso la respuesta esperada necesita una definición.

## 2. Entidades y políticas

`VerdictReview` (nueva; solo inserción, como `Vote`): `id`, `verdict_id` (`@uuid`, `@one` a `Verdict`), `humanVerdict` (`correct` · `incorrect` · `ambiguous`), `reason` (opcional: `judge_too_strict` · `judge_too_lenient` · `expected_answer_wrong` · `other`), `comment` (max 1000, opcional), `reviewerUserId` (max 255), `reviewerEmail` (max 254), `createdAt`.

- **Leer:** autenticados. **Crear:** `claims.sub.eq(item.reviewerUserId)` y `claims.email.eq(item.reviewerEmail)`. Sin actualizar ni borrar.
- **El testimony revisado no necesita campo propio:** `verdict_id` → `Verdict` (`hearing_id`, `case_id`) → `HearingCase.testimony_id`.
- **Validez calculada** (no en la política): revisor juror activo; no fechada más de 5 min en el futuro; un recurso (discrepa del juez) necesita comentario; de cada revisor cuenta la última por veredicto (como R1).
- Cambios en código: `schema.ts`, `entities.spec.ts` (lista de entidades y de solo inserción), especificación §7 (la fila ya habla de `VerdictReview`).

## 3. Functions

**Ninguna acción nueva.** Cambia lo que ya existe: el módulo compartido de reglas (`rayfin/functions/src/rules/`, reexportado en `src/rules/`) recibe veredictos, `HearingCase` y revisiones, y `launchHearing` los lee con T-SQL para que un case reabierto por R9 deje de contar como `ruled` (R5). `launchHearing` también guarda `Hearing.criticPromptVersion`. Probado en `hearing-actions.spec.ts`.

## 4. R9 y confianza: reglas

**R9, mecánica (D1, D2 aprobadas):**
- Hay reapertura si existe una revisión válida `expected_answer_wrong` de un **aprobador activo** sobre un veredicto de ese case (basta una). Un experto o un admin no reabren.
- **Los votos anteriores a la revisión se conservan y se ven en el acta** (marcados "antes de la revisión"), pero **dejan de contar**: quien votó antes tiene que votar de nuevo. Un voto nuevo cuenta con normalidad.
- Si los votos nuevos se reparten entre respuestas, el case pasa a `disputed` por las reglas normales (R4); si reaprueban la respuesta cuestionada o aprueban otra, vuelve a `ruled` (R3).
- Una revisión posterior de otro aprobador sobre la misma respuesta fija un nuevo corte. Una revisión sembrada (`source`) cuenta para R9; solo la confianza la ignora.

**Confianza en el juez (D5 aprobada): por agente y por versión del `critic_prompt`.** Un prompt distinto es un juez distinto, así que cada versión tiene sus números: la actual, en grande; las anteriores, como historial. Cada vista guarda su versión (`Hearing.criticPromptVersion`; vacía = el prompt por defecto del SDK, versión `default`). La versión vive en una constante (`CRITIC_PROMPT` en `rules/judge-trust.ts`): para cambiar el prompt se cambia el texto y la versión en el mismo commit. Por cada versión:
1. Se ignoran las revisiones con `source` (filas de demostración `seed` y de comprobación `check`) y las `expected_answer_wrong` (el juez comparó bien con una respuesta mala).
2. Por veredicto, decide la mayoría de las revisiones válidas; el empate queda "pending review" y no cuenta (I3 D6).
3. Acuerdo: `correct`↔`correct`, `incorrect`↔`incorrect`, `unclear`↔`ambiguous`. Cualquier otra pareja es desacuerdo (D3).
4. `confianza = acuerdos / (acuerdos + desacuerdos)`; siempre "n de m", y el porcentaje grande desde 5 decididos (D4, constante `JUDGE_TRUST_MIN_DECIDED`). Además, un contador por vista ("el jurado coincide con el juez en n de m").

**Ejemplo (un agente; 10 veredictos en dos versiones del prompt):** las vistas H1 (prompt `default`) y H2 (prompt `v2`, la actual).

| Veredicto | Vista / versión | Juez | Revisiones | Resultado |
|---|---|---|---|---|
| V1 | H1 · default | correct | Ana: correct | acuerdo |
| V2 | H1 · default | incorrect | Ana: correct | **desacuerdo** (recurso ganado) |
| V3 | H2 · v2 | correct | Ana: correct | acuerdo |
| V4 | H2 · v2 | incorrect | Ana: incorrect | acuerdo |
| V5 | H2 · v2 | incorrect | Ana: correct | **desacuerdo** (recurso ganado) |
| V6 | H2 · v2 | correct | Ana: correct, Beto: incorrect | empate: pending, no cuenta |
| V7 | H2 · v2 | unclear | Ana: ambiguous | acuerdo |
| V8 | H2 · v2 | correct | Bruno (aprobador): incorrect, `expected_answer_wrong` | excluido (y reabre su case, R9) |
| V9 | H2 · v2 | correct | Bruno: incorrect, `source = seed` | sin revisar (la fila sembrada no cuenta) |
| V10 | H2 · v2 | correct | — | sin revisar |

- **v2 (actual): 3 de 4 acuerdos = 75 %** (V3, V4, V5, V7 decididos, con V5 desacuerdo; solo "3 de 4", sin porcentaje grande porque aún no hay 5 decididos). Pending 1, excluido 1, sin revisar 2.
- **Historial · default: 1 de 2 = 50 %** (V1 acuerdo, V2 desacuerdo).
- Por vista: H2 → "3 de 4"; H1 → "1 de 2". Las dos versiones nunca se suman.
## 5. Pantallas (reuso de los mockups)

- **Hearing** (`live-hearing.html`): bajo cada veredicto, "Yes, agree" / "No, appeal" y atajos A · X · J/K · ?. "No, appeal" abre el formulario (veredicto humano, motivo, comentario obligatorio). Si ya revisaste, muestra tu respuesta y deja cambiarla.
- **Case detail** (`case-detail.html`): chip de vuelta a `under_review` con la frase "Reopened: the expected answer was challenged", y la revisión (quién, motivo, comentario) en el acta.
- **Home:** `JudgeTrustLine` sustituye al marcador vacío ("coincidió en 3 de 4"); sin revisiones sigue el estado vacío, nunca un porcentaje inventado. **Ticker:** "Judge overruled" para recursos ganados (V3).
- Textos en `en.json` y `es.json` ("resolución/resuelto" para el jurado; "veredicto" solo para el juez); solo tokens.

## 6. Decisiones (aprobadas el 2026-11-12)

| # | Decisión | Resultado |
|---|---|---|
| D1 | Cuándo reabre R9 | Revisión válida de un aprobador; basta una (coherente con I3 D7) |
| D2 | Votos anteriores a la revisión | Se conservan y se ven en el acta ("antes de la revisión"), no cuentan; quien votó antes vota de nuevo; si los nuevos se reparten, `disputed` por las reglas normales |
| D3 | `unclear` del juez frente a `ambiguous` humano | Acuerdo; el resto de combinaciones con `unclear` son desacuerdo |
| D4 | Mínimo para mostrar el porcentaje | Siempre "n de m"; porcentaje grande desde 5 decididos |
| D5 | Alcance de la confianza | **Por agente y por versión del `critic_prompt`**; la actual en grande, las anteriores como historial; contador por vista aparte |
| D6 | Cambiar de opinión | Vale la última revisión del mismo revisor; nada se borra |
| D7 | Datos de la demo | **Sin veredictos falsos.** En pruebas, **una vista real de una sola pregunta** (el case de España, esperado 141 por país de facturación) tras desplegar esquema y Functions; solo se siembran por SQL los votos y la revisión de jurados necesarios para la historia, y las revisiones llevan `source = 'seed'` y la confianza las ignora. `Vote` no tiene campo `source` (no se cambia una entidad central): sus filas usan el prefijo `example-` de `docket-examples.sql` y la confianza no lee votos |
| D8 | Ticker | Entra en I3b: líneas del juez (CORRECT / INCORRECT / UNCLEAR; ES CORRECTA / INCORRECTA / DUDOSA, "AI judge") con el último veredicto de cada case y "Judge overruled" para recursos ganados, a partir de los datos de arranque |

**Resiliencia de Home:** si la lectura de veredictos/revisiones falla (por ejemplo, esquema no aplicado) Home carga igual; la confianza en el juez y las líneas del juez del ticker se ocultan y R9 no se aplica en pantalla (`ReviewData.available = false`, `console.warn`). Mismo patrón que `intro_seen`. La Function sí aplica R9 al lanzar vistas.
## 7. Plan de pruebas

- **Unitarias (reglas):** R9 con juez `correct`, con experto/admin (no reabre), revisión anterior al fallo, revisor inactivo, fecha futura, votos nuevos que reaprueban o disputan, cambio de opinión; confianza con el ejemplo de arriba como fixture, empate, excluidos y `unclear`/`ambiguous`; el módulo del navegador y el de la Function dan lo mismo.
- **Datos y entidades:** `entities.spec` (solo inserción; ambas condiciones de `create`), servicio `createVerdictReview` con la sesión.
- **Pantallas:** botones y atajos, comentario obligatorio en el recurso, estado vacío de la confianza, "pending review"; claves EN/ES iguales y sin la familia "fall…" en español.
- **Home sin datos de revisión:** `home.screen.spec.tsx` (la lectura de `VerdictReview` o `Verdict` falla y Home carga, sin confianza ni líneas del juez).
- **Contra pruebas (`scripts/i3b-checks.mjs`, 8 comprobaciones + R.9):** veredicto real y versión del prompt guardada; revisión sembrada legible y marcada; rechaza otro `sub` u otro email; acepta la propia (marcada `check`, solo la primera vez; las siguientes ejecuciones reutilizan esa fila y no añaden otra); no se actualiza ni borra; R9 en el servidor (`launchHearing` rechaza el case reabierto). Sin vistas nuevas ni polling.

## 8. Qué va a pruebas y qué a producción (reglas de capacidad de AGENTS.md)

1. **Local (puerto 5180, tests, `tsc`, lint):** reglas, servicio y pantallas.
2. **Pruebas, una vez (hecho el 2026-11-12):** esquema (`VerdictReview`, `Hearing.criticPromptVersion`) y Functions con `deploy-test.mjs`; siembra `rayfin/seed/i3b-story-1-ruled-case.sql`; **una** vista real de una pregunta (`scripts/i3b-run-hearing.mjs`); siembra `i3b-story-2-appeal.sql` y `i3b-checks`. Capturas solo de lo que cambió, máximo 4. El notebook no cambia en esta entrega (el `CRITIC_PROMPT` solo se envía con un prompt propio).
3. **Producción, un solo despliegue al cerrar el bloque:** esquema + Functions + código con `scripts/deploy-production.mjs --allow-production`, con el esquema antes o a la vez que el código (lista de verificación del README). **Sin demo sembrada** hasta que la propietaria registre el `Sales Agent` allí. Comprobación mínima: arranque, Home con la confianza vacía, Hearings carga, sin errores de consola.
4. Los arreglos posteriores solo de interfaz se verifican en local y van directos a producción en un lote.
