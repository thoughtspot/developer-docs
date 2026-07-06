import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useFloatingAssistant } from '../../contexts/FloatingAssistantContext';
import './index.scss';

function renderMarkdown(text: string): string {
    const html = marked.parse(text, { async: false }) as string;
    const sanitized = DOMPurify.sanitize(html);
    // Wrap <pre><code> blocks with a copy-button container
    return sanitized.replace(
        /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g,
        (_, attrs, code) =>
            `<div class="fa-code-block">` +
            `<button class="fa-code-copy" data-code="${encodeURIComponent(code)}" title="Copy">` +
            `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
            `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>` +
            `</svg></button>` +
            `<pre><code${attrs}>${code}</code></pre>` +
            `</div>`,
    );
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

const SparkleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" />
        <path d="M19 15L19.8 17.2L22 18L19.8 18.8L19 21L18.2 18.8L16 18L18.2 17.2L19 15Z" opacity="0.7" />
        <path d="M5 3L5.6 4.4L7 5L5.6 5.6L5 7L4.4 5.6L3 5L4.4 4.4L5 3Z" opacity="0.7" />
    </svg>
);

const AssistantAvatar = () => (
    <div className="floating-assistant__avatar-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
            <circle cx="12" cy="12" r="12" fill="#5b3fa6"/>
            <path d="M7 10 L6 6 L10 8.5 Z" fill="#8b6fd4"/>
            <path d="M17 10 L18 6 L14 8.5 Z" fill="#8b6fd4"/>
            <ellipse cx="12" cy="13" rx="6" ry="5.5" fill="#8b6fd4"/>
            <circle cx="10" cy="11.5" r="1.8" fill="white"/>
            <circle cx="14" cy="11.5" r="1.8" fill="white"/>
            <circle cx="10.4" cy="11.5" r="1" fill="#1a0a3a"/>
            <circle cx="14.4" cy="11.5" r="1" fill="#1a0a3a"/>
            <circle cx="10.7" cy="11.1" r="0.4" fill="white"/>
            <circle cx="14.7" cy="11.1" r="0.4" fill="white"/>
            <ellipse cx="12" cy="15" rx="3" ry="2" fill="#b89ee0"/>
            <ellipse cx="12" cy="14.5" rx="0.7" ry="0.5" fill="#5b3fa6"/>
        </svg>
    </div>
);

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
        if (suggestedQuestionsLoaded || messages.length > 0) return;
        const id = pageId || 'home';
        fetch(`${CLOUDFLARE_URL}/suggested-questions?pageId=${encodeURIComponent(id)}`)
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
                    setToolStatus(`${event.toolName}`);
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

    const handleCodeCopy = (e: React.MouseEvent<HTMLDivElement>) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.fa-code-copy');
        if (!btn) return;
        const code = decodeURIComponent(btn.dataset.code ?? '');
        navigator.clipboard.writeText(code).catch(() => {});
        const prev = btn.innerHTML;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.innerHTML = prev; }, 1500);
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
            {/* Chip trigger */}
            {!isOpen && !isClosing && (
                <button
                    className="floating-assistant__chip"
                    onClick={() => setIsOpen(true)}
                    aria-label="Open SpotterCode assistant"
                >
                    <span className="floating-assistant__chip__icon">
                        <SparkleIcon />
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
                        <button
                            className="floating-assistant__close"
                            onClick={handleClose}
                            aria-label="Close assistant"
                            title="Close"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="13 17 18 12 13 7" />
                                <polyline points="6 17 11 12 6 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="floating-assistant__messages" onClick={handleCodeCopy}>
                        {isLandingPage ? (
                            <div className="floating-assistant__landing">
                                <div className="floating-assistant__landing-intro">
                                    <div className="floating-assistant__landing-avatar">
                                        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
                                            <circle cx="24" cy="24" r="24" fill="#1a2340"/>
                                            <path d="M13 18 L10 8 L20 15 Z" fill="#2a3560"/>
                                            <path d="M35 18 L38 8 L28 15 Z" fill="#2a3560"/>
                                            <ellipse cx="24" cy="26" rx="14" ry="13" fill="#2a3560"/>
                                            <ellipse cx="24" cy="31" rx="7" ry="5" fill="#3a4a80"/>
                                            <circle cx="19" cy="23" r="4" fill="white"/>
                                            <circle cx="29" cy="23" r="4" fill="white"/>
                                            <circle cx="20" cy="23" r="2.2" fill="#0a1020"/>
                                            <circle cx="30" cy="23" r="2.2" fill="#0a1020"/>
                                            <circle cx="20.7" cy="22.3" r="0.8" fill="white"/>
                                            <circle cx="30.7" cy="22.3" r="0.8" fill="white"/>
                                            <ellipse cx="24" cy="28.5" rx="1.5" ry="1" fill="#1a2340"/>
                                            <path d="M21 31 Q24 33.5 27 31" stroke="#3a4a80" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
                                        </svg>
                                    </div>
                                    <div className="floating-assistant__landing-title">
                                        Hey, I'm <span>SpotterCode</span>.<br />
                                        Where do we start?
                                    </div>
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
                                        {msg.role === 'user' ? (
                                            <div className="floating-assistant__user-bubble">
                                                {msg.content}
                                            </div>
                                        ) : (
                                            <div className="floating-assistant__assistant-block">
                                                <AssistantAvatar />
                                                <div
                                                    className="floating-assistant__message-text floating-assistant__message-text--md"
                                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                                />
                                                <div className="floating-assistant__feedback">
                                                    <button className="floating-assistant__feedback-btn" aria-label="Thumbs down">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/>
                                                            <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                                                        </svg>
                                                    </button>
                                                    <button className="floating-assistant__feedback-btn" aria-label="Thumbs up">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/>
                                                            <path d="M7 22H4.72A2.31 2.31 0 0 1 2.4 20v-7a2.31 2.31 0 0 1 2.33-2H7"/>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="floating-assistant__message floating-assistant__message--assistant">
                                        <div className="floating-assistant__assistant-block">
                                            <AssistantAvatar />
                                            {streamingText ? (
                                                <div
                                                    className="floating-assistant__message-text floating-assistant__message-text--md"
                                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingText) }}
                                                />
                                            ) : toolStatus ? (
                                                <div className="floating-assistant__tool-steps">
                                                    <div className="floating-assistant__tool-header">
                                                        <span className="floating-assistant__tool-header-text">{toolStatus}</span>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="18 15 12 9 6 15"/>
                                                        </svg>
                                                    </div>
                                                    <div className="floating-assistant__tool-step floating-assistant__tool-step--active">
                                                        <span className="floating-assistant__tool-step-dot floating-assistant__tool-step-dot--yellow" />
                                                        <span className="floating-assistant__tool-step-name">{toolStatus}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="floating-assistant__typing">
                                                    <span /><span /><span />
                                                </div>
                                            )}
                                        </div>
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
                                placeholder="Ask, learn, code..."
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
