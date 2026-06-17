import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useFloatingAssistant } from '../../contexts/FloatingAssistantContext';
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

const CLOUDFLARE_URL = 'https://spotter-code-popular-questions.thoughtspot-485.workers.dev';
// const CLOUDFLARE_URL = 'http://localhost:8000';

async function* parseSseStream(response: Response): AsyncGenerator<SseEvent> {
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

const getPageId = () => {
    if (typeof window === 'undefined') return undefined;
    return new URLSearchParams(window.location.search).get('pageid')
        || window.location.pathname.split('/').filter(Boolean).pop()
        || undefined;
};

const FloatingAssistant: React.FC = () => {
    const [pageId, setPageId] = useState<string | undefined>(getPageId);
    const {
        isOpen,
        setIsOpen,
        messages,
        setMessages,
        suggestedQuestions,
        setSuggestedQuestions,
        suggestedQuestionsLoaded,
        setSuggestedQuestionsLoaded,
        resetConversation,
    } = useFloatingAssistant();

    const [isClosing, setIsClosing] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [toolStatus, setToolStatus] = useState('');
    const [input, setInput] = useState('');
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

    useEffect(() => {
        const handler = (e: CustomEvent<{ location: Location }>) => {
            const { location } = e.detail;
            const newPageId = new URLSearchParams(location.search).get('pageid')
                || location.pathname.split('/').filter(Boolean).pop()
                || undefined;
            setPageId(newPageId);
            setSuggestedQuestionsLoaded(false);
        };
        window.addEventListener('gatsby-route-update', handler as EventListener);
        return () => window.removeEventListener('gatsby-route-update', handler as EventListener);
    }, [setSuggestedQuestionsLoaded]);

    useEffect(() => {
        if (!pageId || suggestedQuestionsLoaded || messages.length > 0) return;
        fetch(`${CLOUDFLARE_URL}/suggested-questions?pageId=${encodeURIComponent(pageId)}`)
            .then((res) => res.json())
            .then((data: { questions?: string[] }) => {
                setSuggestedQuestions(data.questions ?? []);
                setSuggestedQuestionsLoaded(true);
            })
            .catch(() => {
                setSuggestedQuestionsLoaded(true);
            });
    }, [pageId, suggestedQuestionsLoaded, messages.length, setSuggestedQuestions, setSuggestedQuestionsLoaded]);

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

        let accumulated = '';
        let finalContent = 'Sorry, something went wrong. Please try again.';
        let aborted = false;

        try {
            const response = await fetch(`${CLOUDFLARE_URL}/agent/embed-assistant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: abortRef.current.signal,
                body: JSON.stringify({
                    playgroundType: 'ask-docs',
                    messages: updatedMessages,
                    pageId,
                }),
            });

            if (!response.ok || !response.body) {
                throw new Error(`API error: ${response.status}`);
            }

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

            finalContent = accumulated || 'No response received.';
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                aborted = true;
            }
        } finally {
            if (!aborted) {
                setMessages([...updatedMessages, { role: 'assistant', content: finalContent }]);
            }
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

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 300);
    };

    const isLandingPage = messages.length === 0 && !isLoading;

    return (
        <>
            {/* Chip trigger button */}
            {!isOpen && !isClosing && (
                <button
                    className="floating-assistant__chip"
                    onClick={() => setIsOpen(true)}
                    aria-label="Open SpotterCode assistant"
                >
                    <span className="floating-assistant__chip__chevron">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </span>
                    Ask SpotterCode
                </button>
            )}

            {/* Panel */}
            {(isOpen || isClosing) && (
                <div className={`floating-assistant__panel${isClosing ? ' closing' : ''}`}>
                    {/* Header */}
                    <div className="floating-assistant__header">
                        <span className="floating-assistant__title">SpotterCode</span>
                        <div className="floating-assistant__header-actions">
                            <button
                                className="floating-assistant__close"
                                onClick={handleClose}
                                aria-label="Close assistant"
                                title="Close"
                            >
                                {/* » chevron-right double */}
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="13 17 18 12 13 7" />
                                    <polyline points="6 17 11 12 6 7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="floating-assistant__messages">
                        {isLandingPage ? (
                            <div className="floating-assistant__landing">
                                <div className="floating-assistant__landing-icon">🤖</div>
                                <div className="floating-assistant__landing-title">
                                    Hi, there! I'm <span>SpotterCode</span>
                                </div>
                                <div className="floating-assistant__landing-sub">
                                    Ask me anything about the ThoughtSpot developer docs.
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
                            </div>
                        ) : (
                            <>
                                {messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`floating-assistant__message floating-assistant__message--${msg.role}`}
                                    >
                                        <span className="floating-assistant__message-label">
                                            {msg.role === 'user' ? 'You' : 'SpotterCode'}
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
                                        <span className="floating-assistant__message-label">SpotterCode</span>
                                        {streamingText ? (
                                            <div
                                                className="floating-assistant__message-text floating-assistant__message-text--md"
                                                dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingText) }}
                                            />
                                        ) : (
                                            <div className="floating-assistant__typing">
                                                {toolStatus ? (
                                                    <>
                                                        <span className="floating-assistant__tool-dot" />
                                                        <span className="floating-assistant__tool-status">{toolStatus}</span>
                                                    </>
                                                ) : (
                                                    <><span /><span /><span /></>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="floating-assistant__input-row">
                        <div className="floating-assistant__input-wrapper">
                            <textarea
                                ref={inputRef}
                                className="floating-assistant__input"
                                placeholder="Ask a question..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                rows={1}
                            />
                            <div className="floating-assistant__input-buttons">
                                <button
                                    className="floating-assistant__reset-input"
                                    onClick={() => { resetConversation(); setInput(''); }}
                                    title="Reset conversation"
                                    aria-label="Reset conversation"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                        <path d="M3 3v5h5" />
                                    </svg>
                                </button>
                                <button
                                    className="floating-assistant__send"
                                    onClick={() => sendMessage()}
                                    disabled={!input.trim() || isLoading}
                                    aria-label="Send"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="19" x2="12" y2="5" />
                                        <polyline points="5 12 12 5 19 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="floating-assistant__footer">
                        SpotterCode responses should be reviewed.{' '}
                        <a href="https://docs.thoughtspot.com" target="_blank" rel="noopener noreferrer">
                            Learn more
                        </a>
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingAssistant;
