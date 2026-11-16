import { useCallback, useRef, useState } from 'react';

import { getRayfinClient } from '@/lib/rayfin-client';

export type AskRicReason = 'config' | 'auth' | 'timeout' | 'agent' | 'unknown';
export type AskRicStatus = 'idle' | 'loading' | 'done' | 'error';

type AskRicState = {
  status: AskRicStatus;
  question: string;
  answer: string;
  reason: AskRicReason | null;
};

const idle: AskRicState = { status: 'idle', question: '', answer: '', reason: null };

/** Asks the published Fabric data agent (via the askRic Rayfin function). */
export function useAskRic() {
  const [state, setState] = useState<AskRicState>(idle);
  const latest = useRef(0);

  const ask = useCallback(async (rawQuestion: string) => {
    const question = rawQuestion.trim().slice(0, 500);
    if (!question) return;
    const id = ++latest.current;
    setState({ status: 'loading', question, answer: '', reason: null });
    try {
      const client = await getRayfinClient();
      // A data agent can take a while; the host ceiling is 250 s.
      const result = await client.functions.askRic.invoke({ question }, { timeoutMs: 200_000 });
      if (id !== latest.current) return;
      setState(
        result.ok
          ? { status: 'done', question, answer: result.answer, reason: null }
          : { status: 'error', question, answer: '', reason: result.reason }
      );
    } catch {
      if (id === latest.current) setState({ status: 'error', question, answer: '', reason: 'unknown' });
    }
  }, []);

  const reset = useCallback(() => {
    latest.current++;
    setState(idle);
  }, []);

  return { ...state, ask, reset };
}
