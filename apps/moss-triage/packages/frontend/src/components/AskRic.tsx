import { useEffect, useState } from 'react';
import { CornerDownLeft, MessageSquareReply, Sparkles } from 'lucide-react';

import { useAskRic, type AskRicReason } from '@/hooks/use-ask-ric';

const reasonText: Record<AskRicReason, string> = {
  config: 'A Ric le falta su dirección (el secreto RIC_DATA_AGENT_MCP_URL). Pásate por Secrets.',
  auth: 'Ric no te deja pasar: revisa los permisos sobre el agente y sus fuentes.',
  timeout: 'Ric no contesta. Probablemente está en una reunión.',
  agent: 'Ric ha devuelto algo raro. Prueba a reformular la pregunta.',
  unknown: 'Ric no contesta. Probablemente está en una reunión.',
};

export function AskRic({
  customerName,
  ticketSubject,
  onUseAnswer,
}: {
  customerName: string;
  ticketSubject: string;
  onUseAnswer?: (answer: string) => void;
}) {
  const { status, question, answer, reason, ask } = useAskRic();
  const [draft, setDraft] = useState('');
  const [seconds, setSeconds] = useState(0);
  const loading = status === 'loading';
  const suggestions = [
    `¿Cuántos tickets ha abierto ${customerName} en los últimos 7 días?`,
    `¿Hay más tickets parecidos a «${ticketSubject}» esta semana?`,
    '¿Quién del equipo tiene menos carga ahora mismo?',
  ];

  useEffect(() => {
    if (!loading) return undefined;
    const started = Date.now();
    const reset = window.setTimeout(() => setSeconds(0), 0);
    const timer = window.setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => {
      window.clearTimeout(reset);
      window.clearInterval(timer);
    };
  }, [loading]);

  function submit(text: string) {
    if (loading || !text.trim()) return;
    void ask(text);
  }

  return (
    <div className="ask-ric">
      <div className="ask-ric-intro">
        <Sparkles aria-hidden="true" />
        <p>
          Ric es el <strong>data agent</strong> de Fabric del equipo: responde con los datos del Lakehouse
          a través de la ontología. Pregúntale en lenguaje natural.
        </p>
      </div>

      <div className="ask-ric-suggestions" aria-label="Preguntas rápidas">
        {suggestions.map((text) => (
          <button key={text} type="button" className="chip" disabled={loading} onClick={() => { setDraft(text); submit(text); }}>
            {text}
          </button>
        ))}
      </div>

      <form className="ask-ric-form" onSubmit={(event) => { event.preventDefault(); submit(draft); }}>
        <label className="visually-hidden" htmlFor="ask-ric-question">Pregunta para Ric</label>
        <input
          id="ask-ric-question"
          value={draft}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="RIC> escribe tu pregunta…"
          disabled={loading}
        />
        <button type="submit" className="button button-primary" disabled={loading || !draft.trim()}>
          <CornerDownLeft aria-hidden="true" /> Preguntar a Ric
        </button>
      </form>

      <div className={`ask-ric-console is-${status}`} role="status" aria-live="polite">
        {status === 'idle' && <p className="ask-ric-muted">RIC&gt; Esperando pregunta. Las respuestas pueden tardar hasta un minuto.</p>}
        {status !== 'idle' && <p className="ask-ric-question">TÚ&gt; {question}</p>}
        {loading && (
          <p className="ask-ric-thinking">
            RIC&gt; Ric está pensando<span className="ask-ric-dots" aria-hidden="true" /> <small>{seconds} s</small>
          </p>
        )}
        {status === 'done' && <p className="ask-ric-answer">RIC&gt; {answer}</p>}
        {status === 'error' && reason && <p className="ask-ric-error">RIC&gt; {reasonText[reason]}</p>}
      </div>

      {status === 'done' && onUseAnswer && (
        <button type="button" className="button button-small button-outline ask-ric-use" onClick={() => onUseAnswer(answer)}>
          <MessageSquareReply aria-hidden="true" /> Usar en la respuesta al cliente
        </button>
      )}
    </div>
  );
}

export default AskRic;
