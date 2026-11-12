# I3b — Recursos y confianza en el juez: plan

> Solo plan (2026-11-12): sin código ni despliegues. Parte de [I3.md](I3.md) (secciones 4, 5, 6, 13 y 17) y de la regla R9 de la [especificación](../especificacion-general.md). Vocabulario: "fallado" = `ruled`; "recurso" es solo el término de la interfaz (una revisión que discrepa del juez).

## 1. Alcance y datos de la demo

- **Entra:** entidad `VerdictReview`, recursos por jurados, confianza en el juez y R9 (un case `ruled` con una revisión válida `expected_answer_wrong` de un **aprobador activo** vuelve a `under_review`).
- **No entra:** export (I3c), pantalla de conflictos (I2).
- **Recurso de demostración, verificado hoy** con una sola consulta DAX de solo lectura contra `SalesModel` (2026-11-12): clientes de España por `Customer[Country]` (facturación) = **141**; por `Customer[ShipToCountry]` (envío) = **265**. Coinciden con I3 §10 y §17. No se ha vuelto a preguntar al agente (cuesta capacidad).

## 2. Entidades y políticas

`VerdictReview` (nueva; solo inserción, como `Vote`): `id`, `verdict_id` (`@uuid`, `@one` a `Verdict`), `humanVerdict` (`correct` · `incorrect` · `ambiguous`), `reason` (opcional: `judge_too_strict` · `judge_too_lenient` · `expected_answer_wrong` · `other`), `comment` (max 1000, opcional), `reviewerUserId` (max 255), `reviewerEmail` (max 254), `createdAt`.

- **Leer:** autenticados. **Crear:** `claims.sub.eq(item.reviewerUserId)` y `claims.email.eq(item.reviewerEmail)`. Sin actualizar ni borrar.
- **El testimony revisado no necesita campo propio:** `verdict_id` → `Verdict` (`hearing_id`, `case_id`) → `HearingCase.testimony_id`.
- **Validez calculada** (no en la política): revisor juror activo; no fechada más de 5 min en el futuro; un recurso (discrepa del juez) necesita comentario; de cada revisor cuenta la última por veredicto (como R1).
- Cambios en código: `schema.ts`, `entities.spec.ts` (lista de entidades y de solo inserción), especificación §7 (la fila ya habla de `VerdictReview`).

## 3. Functions

**Ninguna acción nueva.** Cambia lo que ya existe: el módulo compartido de reglas (`rayfin/functions/src/rules/`, reexportado en `src/rules/`) recibe veredictos, `HearingCase` y revisiones, y `launchHearing` los lee con T-SQL para que un case reabierto por R9 deje de contar como `ruled` (R5). Hay que ampliar `hearing-rules.spec.ts`.

## 4. R9 y confianza: reglas

**R9, mecánica (D1, D2):**
- `ruledAt` = fecha del último voto a favor vigente del testimony aprobado.
- Hay reapertura si existe una revisión válida `expected_answer_wrong` de un aprobador activo, posterior a `ruledAt`.
- Mientras esté reabierto, del testimony revisado solo cuentan los votos **posteriores** a la revisión: así el testimony 265 puede competir con el 141 sin que el case salte a `disputed` por los votos viejos. Un voto nuevo a favor del 141 lo vuelve a aprobar (R3). Un experto o un admin no reabren.

**Confianza en el juez (por agente):**
1. Se ignoran las revisiones `expected_answer_wrong` (el juez comparó bien con una respuesta mala).
2. Por veredicto, decide la mayoría de las revisiones válidas; el empate queda "pending review" y no cuenta (I3 D6).
3. Acuerdo: `correct`↔`correct`, `incorrect`↔`incorrect`, `unclear`↔`ambiguous`. Cualquier otra pareja es desacuerdo (D3).
4. `confianza = acuerdos / (acuerdos + desacuerdos)`, y se muestra "n de m" junto al porcentaje.

**Ejemplo (7 veredictos del agente):**

| Veredicto | Juez | Revisiones | Resultado |
|---|---|---|---|
| V1 | correct | Ana: correct | acuerdo |
| V2 | incorrect | Ana: incorrect | acuerdo |
| V3 | incorrect | Ana: correct | **desacuerdo** (recurso ganado) |
| V4 | correct | Ana: correct, Beto: incorrect | empate: pending, no cuenta |
| V5 | unclear | Ana: ambiguous | acuerdo |
| V6 | correct | Ana (aprobadora): incorrect, `expected_answer_wrong` | excluido (y reabre su case, R9) |
| V7 | correct | — | sin revisar |

Decididos: V1, V2, V3, V5 → 3 de 4 = **75 %**. Pending 1, excluido 1, sin revisar 1.

## 5. Pantallas (reuso de los mockups)

- **Hearing** (`live-hearing.html`): bajo cada veredicto, "Yes, agree" / "No, appeal" y atajos A · X · J/K · ?. "No, appeal" abre el formulario (veredicto humano, motivo, comentario obligatorio). Si ya revisaste, muestra tu respuesta y deja cambiarla.
- **Case detail** (`case-detail.html`): chip de vuelta a `under_review` con la frase "Reopened: the expected answer was challenged", y la revisión (quién, motivo, comentario) en el acta.
- **Home:** `JudgeTrustLine` sustituye al marcador vacío ("coincidió en 3 de 4"); sin revisiones sigue el estado vacío, nunca un porcentaje inventado. **Ticker:** "Judge overruled" para recursos ganados (V3).
- Textos en `en.json` y `es.json` ("resolución/resuelto" para el jurado; "veredicto" solo para el juez); solo tokens.

## 6. Decisiones abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| D1 | Cuándo reabre R9 | Revisión válida de un aprobador, posterior a `ruledAt`; basta una (coherente con I3 D7) |
| D2 | Qué pasa con los votos antiguos del testimony revisado | Se ignoran los anteriores a la revisión; solo cuentan los nuevos |
| D3 | `unclear` del juez frente a `ambiguous` humano | Acuerdo; el resto de combinaciones con `unclear` son desacuerdo |
| D4 | Mínimo para mostrar el porcentaje | Mostrar siempre "n de m"; el porcentaje grande desde 5 decididos (constante única) |
| D5 | Alcance de la confianza | Todos los veredictos revisados del agente (cada vista es una unidad); contador por vista aparte |
| D6 | Cambiar de opinión sobre un veredicto | Vale la última revisión del mismo revisor; nada se borra |
| D7 | Datos de la demo | Hearing y veredicto de ejemplo sembrados por SQL **solo en pruebas** (jurors `example.com`), sin gastar capacidad; una ejecución real del case 141 al final es opcional (una pregunta, ~50 s de agente) |
| D8 | Ticker de recursos ganados | Entra en I3b (cambio pequeño y solo de interfaz) |

## 7. Plan de pruebas

- **Unitarias (reglas):** R9 con juez `correct`, con experto/admin (no reabre), revisión anterior al fallo, revisor inactivo, fecha futura, votos nuevos que reaprueban o disputan, cambio de opinión; confianza con el ejemplo de arriba como fixture, empate, excluidos y `unclear`/`ambiguous`; el módulo del navegador y el de la Function dan lo mismo.
- **Datos y entidades:** `entities.spec` (solo inserción; ambas condiciones de `create`), servicio `createVerdictReview` con la sesión.
- **Pantallas:** botones y atajos, comentario obligatorio en el recurso, estado vacío de la confianza, "pending review"; claves EN/ES iguales y sin la familia "fall…" en español.
- **Contra pruebas (`scripts/i3b-checks.mjs`):** el cliente inserta su revisión; rechaza otro `sub` u otro email; no puede actualizar ni borrar; R9 de punta a punta sobre el caso sembrado. Sin lanzar vistas ni polling.

## 8. Qué va a pruebas y qué a producción (reglas de capacidad de AGENTS.md)

1. **Local (puerto 5180, tests, `tsc`, lint):** reglas, servicio y pantallas.
2. **Pruebas, una vez:** esquema (`VerdictReview`) y Functions (cambia el cargador de `launchHearing`), siembra de la demo (D7) y `i3b-checks`. Capturas solo de lo que cambió, máximo 4.
3. **Producción, un solo despliegue al cerrar el bloque:** esquema + Functions + código con `scripts/deploy-production.mjs --allow-production`, con el esquema antes o a la vez que el código (lista de verificación del README). **Sin demo sembrada** hasta que la propietaria registre el `Sales Agent` allí. Comprobación mínima: arranque, Home con la confianza vacía, Hearings carga, sin errores de consola.
4. Los arreglos posteriores solo de interfaz se verifican en local y van directos a producción en un lote.
