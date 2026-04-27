import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './index.scss';

function renderMarkdown(text: string): string {
    const html = marked.parse(text, { async: false }) as string;
    return DOMPurify.sanitize(html);
}

type Message = {
    role: 'user' | 'assistant';
    content: string;
};

type SseEvent =
    | { type: 'text'; content: string }
    | { type: 'tool-start'; toolName: string; content: string; input: unknown }
    | { type: 'tool-result'; toolName: string; content: string; output: unknown }
    | { type: 'summary'; content: string }
    | { type: 'done' }
    | { type: 'error'; content: string };

type FloatingAssistantProps = {
    isDarkMode?: boolean;
    pageId?:string
};

const CLOUDFLARE_URL = 'https://spotter-code.thoughtspot-485.workers.dev';

async function* parseSseStream(
    response: Response,
): AsyncGenerator<SseEvent> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data:')) continue;
            const json = line.slice('data:'.length).trim();
            try {
                yield JSON.parse(json) as SseEvent;
            } catch {
                // skip malformed lines
            }
        }
    }
}

const FloatingAssistant: React.FC<FloatingAssistantProps> = ({ isDarkMode, pageId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingText, setStreamingText] = useState('');
    const [toolStatus, setToolStatus] = useState('');
    const [input, setInput] = useState('');
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);


    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, streamingText]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const sendMessage = async (text?: string) => {
        const messageText = (text ?? input).trim();
        if (!messageText || isLoading) return;

        const userMessage: Message = { role: 'user', content: messageText };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        if (!text) setInput('');
        setIsLoading(true);
        setStreamingText('');
        setToolStatus('');

        abortRef.current = new AbortController();

        console.log("sendMessage", pageId)
        try {
            const response = await fetch(
                `${CLOUDFLARE_URL}/agent/embed-assistant`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: abortRef.current.signal,
                    body: JSON.stringify({
                        playgroundType: 'ask-docs',
                        messages: updatedMessages,
                        pageId:pageId
                    }),
                },
            );

            if (!response.ok || !response.body) {
                throw new Error(`API error: ${response.status}`);
            }

            let accumulated = '';

            for await (const event of parseSseStream(response)) {
                if (event.type === 'text') {
                    accumulated += event.content;
                    setStreamingText(accumulated);
                } else if (event.type === 'tool-start') {
                    setToolStatus(`Using ${event.toolName}…`);
                } else if (event.type === 'tool-result') {
                    setToolStatus('');
                } else if (event.type === 'done') {
                    break;
                } else if (event.type === 'error') {
                    throw new Error(event.content);
                }
            }

            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: accumulated || 'No response received.' },
            ]);
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return;
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: 'Sorry, something went wrong. Please try again.',
                },
            ]);
        } finally {
            setStreamingText('');
            setToolStatus('');
            setIsLoading(false);
            abortRef.current = null;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div
            className={`floating-assistant${isDarkMode ? ' dark' : ''}`}
            data-theme={isDarkMode ? 'dark' : 'light'}
        >
            {isOpen && (
                <div className="floating-assistant__panel">
                    <div className="floating-assistant__header">
                        <span className="floating-assistant__title">Ask AI</span>
                        <button
                            className="floating-assistant__close"
                            onClick={() => setIsOpen(false)}
                            aria-label="Close assistant"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="floating-assistant__messages">
                        {messages.length === 0 && !isLoading && (
                            <>
                                <div className="floating-assistant__empty">
                                    Ask me anything about the ThoughtSpot docs.
                                </div>
                                {suggestedQuestions.length > 0 && (
                                    <div className="floating-assistant__suggestions">
                                        {suggestedQuestions.map((q, i) => (
                                            <button
                                                key={i}
                                                className="floating-assistant__suggestion"
                                                onClick={() => sendMessage(q)}
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`floating-assistant__message floating-assistant__message--${msg.role}`}
                            >
                                <span className="floating-assistant__message-label">
                                    {msg.role === 'user' ? 'You' : 'AI'}
                                </span>
                                {msg.role === 'assistant' ? (
                                    <div
                                        className="floating-assistant__message-text floating-assistant__message-text--md"
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                    />
                                ) : (
                                    <div className="floating-assistant__message-text">
                                        {msg.content}
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="floating-assistant__message floating-assistant__message--assistant">
                                <span className="floating-assistant__message-label">AI</span>
                                {streamingText ? (
                                    <div
                                        className="floating-assistant__message-text floating-assistant__message-text--md"
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingText) }}
                                    />
                                ) : (
                                    <div className="floating-assistant__typing">
                                        {toolStatus ? (
                                            <span className="floating-assistant__tool-status">
                                                {toolStatus}
                                            </span>
                                        ) : (
                                            <>
                                                <span /><span /><span />
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="floating-assistant__input-row">
                        <textarea
                            ref={inputRef}
                            className="floating-assistant__input"
                            placeholder="Ask a question..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                        />
                        <button
                            className="floating-assistant__send"
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isLoading}
                            aria-label="Send"
                        >
                            ➤
                        </button>
                    </div>
                </div>
            )}
            <button
                className="floating-assistant__bubble"
                onClick={() => setIsOpen((o) => !o)}
                aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
            >
                {isOpen ? (
                    <span className="floating-assistant__bubble-icon">✕</span>
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                            fill="currentColor"
                        />
                    </svg>
                )}
            </button>
        </div>
    );
};

export default FloatingAssistant;
