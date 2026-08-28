import { CLOUDFLARE_URL, API_PATHS } from './constants';
import { Message, SseEvent } from './types';
import { parseSseStream } from './helpers';

export async function fetchSuggestedQuestions(pageId: string): Promise<string[]> {
    const res = await fetch(
        `${CLOUDFLARE_URL}${API_PATHS.SUGGESTED_QUESTIONS}?pageId=${encodeURIComponent(pageId)}`,
    );
    const data: { questions?: string[] } = await res.json();
    return data.questions ?? [];
}

export async function* streamAgentResponse(
    messages: Message[],
    pageId: string | undefined,
    signal: AbortSignal,
): AsyncGenerator<SseEvent> {
    const response = await fetch(`${CLOUDFLARE_URL}${API_PATHS.AGENT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({ playgroundType: 'ask-docs', messages, pageId }),
    });

    if (!response.ok || !response.body) {
        throw new Error(`API error: ${response.status}`);
    }

    yield* parseSseStream(response);
}

export async function sendFeedback(
    traceId: string,
    observationId: string | undefined,
    value: 'up' | 'down',
): Promise<void> {
    const response = await fetch(`${CLOUDFLARE_URL}${API_PATHS.FEEDBACK}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traceId, observationId, value }),
    });

    if (!response.ok) {
        throw new Error(`Feedback API error: ${response.status}`);
    }
}
