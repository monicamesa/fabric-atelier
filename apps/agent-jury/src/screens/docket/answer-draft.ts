export interface AnswerDraft {
    answer: string;
    definition: string;
    criterion: string;
    timeWindow: string;
    population: string;
    source: string;
}

export const EMPTY_ANSWER: AnswerDraft = { answer: "", definition: "", criterion: "", timeWindow: "", population: "", source: "" };

export type AnswerErrors = Partial<Record<"answer" | "definition", string>>;

/** Required fields only; lengths are capped by maxLength on the inputs. Values are i18n keys. */
export function validateAnswer(draft: AnswerDraft): AnswerErrors {
    const errors: AnswerErrors = {};
    if (!draft.answer.trim()) errors.answer = "answerForm.answerRequired";
    if (!draft.definition.trim()) errors.definition = "answerForm.definitionRequired";
    return errors;
}

export function trimDraft(draft: AnswerDraft): AnswerDraft {
    return {
        answer: draft.answer.trim(),
        definition: draft.definition.trim(),
        criterion: draft.criterion.trim(),
        timeWindow: draft.timeWindow.trim(),
        population: draft.population.trim(),
        source: draft.source.trim(),
    };
}
