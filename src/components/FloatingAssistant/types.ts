export type Message = {
    role: 'user' | 'assistant';
    content: string;
    quotedText?: string;
    toolSteps?: string[];
    durationMs?: number;
    sentAt?: number;
};

export type SseEvent =
    | { type: 'text'; content: string }
    | { type: 'tool-start'; toolName: string; content: string; input: unknown }
    | { type: 'tool-result'; toolName: string; content: string; output: unknown }
    | { type: 'summary'; content: string }
    | { type: 'done' }
    | { type: 'error'; content: string };
