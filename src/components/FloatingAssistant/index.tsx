import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useFloatingAssistant } from '../../contexts/FloatingAssistantContext';
import './index.scss';

function renderMarkdown(text: string): string {
    const cleaned = text.replace(/\s*cite\w+/g, '');
    const html = marked.parse(cleaned, { async: false }) as string;
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
    quotedText?: string;
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
    <svg width="26" height="27" viewBox="0 0 27 27" fill="#2770EF" xmlns="http://www.w3.org/2000/svg">
        <path d="M8.25809 7.21109C8.83155 5.59342 11.1191 5.59349 11.6927 7.21109L13.4163 12.0753C13.4919 12.2885 13.6602 12.4568 13.8733 12.5324L18.7376 14.256C20.3555 14.8294 20.3555 17.1172 18.7376 17.6906L13.8733 19.4142C13.6601 19.4898 13.4918 19.658 13.4163 19.8712L11.6927 24.7355C11.1191 26.353 8.83157 26.3531 8.25809 24.7355L6.53445 19.8712C6.4589 19.658 6.29064 19.4898 6.07742 19.4142L1.21316 17.6906C-0.404397 17.1171 -0.404379 14.8295 1.21316 14.256L6.07742 12.5324C6.29058 12.4568 6.45883 12.2885 6.53445 12.0753L8.25809 7.21109ZM20.2805 0.49136C20.6395 -0.163697 21.6064 -0.163877 21.9651 0.49136L22.0315 0.642727L22.888 3.05972L25.3059 3.91616C26.1625 4.21966 26.1622 5.43079 25.3059 5.73452L22.888 6.59097L22.0315 9.00894C21.7279 9.86544 20.5167 9.86552 20.2132 9.00894L19.3567 6.59097L16.9397 5.73452C16.0831 5.43098 16.0831 4.21969 16.9397 3.91616L19.3567 3.05972L20.2132 0.642727L20.2805 0.49136Z" />
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
        quotedText,
        setQuotedText,
    } = useFloatingAssistant();

    const [feedbackGiven, setFeedbackGiven] = useState<Record<number, 'up' | 'down'>>({});
    const [isClosing, setIsClosing] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [toolStatus, setToolStatus] = useState('');
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        setIsOpen(true);
    }, []);

    useEffect(() => {
        if (!showScrollDown && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, streamingText]);

    const handleMessagesScroll = () => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowScrollDown(distFromBottom > 80);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setShowScrollDown(false);
    };

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (quotedText) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [quotedText]);

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
        const handler = (e: CustomEvent<{ quotedText: string }>) => {
            setQuotedText(e.detail.quotedText);
            setIsOpen(true);
        };
        window.addEventListener('spotter-code-ask', handler as EventListener);
        return () => window.removeEventListener('spotter-code-ask', handler as EventListener);
    }, [setIsOpen, setQuotedText]);

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

        const fullText = quotedText ? `"${quotedText}"\n\n${messageText}` : messageText;
        const userMessage: Message = { role: 'user', content: fullText, quotedText: quotedText ?? undefined };
        setQuotedText(null);
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
        btn.style.color = '#0d9f6e';
        setTimeout(() => { btn.innerHTML = prev; btn.style.color = ''; }, 1500);
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
                <div className="floating-assistant__chip-ring">
                    <button
                        className="floating-assistant__chip"
                        onClick={() => setIsOpen(true)}
                        aria-label="Open SpotterCode assistant"
                    >
                        <SparkleIcon />
                    </button>
                </div>
            )}

            {/* Panel */}
            {(isOpen || isClosing) && (
                <div className={`floating-assistant__panel${isClosing ? ' closing' : ''}${!isLandingPage ? ' floating-assistant__panel--conversation' : ''}`}>
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
                    <div
                        className="floating-assistant__messages"
                        ref={messagesContainerRef}
                        onScroll={handleMessagesScroll}
                        onClick={handleCodeCopy}
                    >
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
                                    {suggestedQuestions.length > 0 && (
                                    <div className="floating-assistant__suggestions">
                                        {suggestedQuestions.slice(0, 5).map((q, i) => (
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
                                                {msg.quotedText && (
                                                    <div className="floating-assistant__quote-chip floating-assistant__quote-chip--message">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                                                        </svg>
                                                        <span className="floating-assistant__quote-text">{msg.quotedText}</span>
                                                    </div>
                                                )}
                                                {msg.quotedText
                                                    ? msg.content.replace(`"${msg.quotedText}"\n\n`, '')
                                                    : msg.content}
                                            </div>
                                        ) : (
                                            <div className="floating-assistant__assistant-block">
                                                <AssistantAvatar />
                                                <div
                                                    className="floating-assistant__message-text floating-assistant__message-text--md"
                                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                                />
                                                <div className="floating-assistant__feedback">
                                                    {feedbackGiven[i] ? (
                                                        <span className="floating-assistant__feedback-thanks">
                                                            {feedbackGiven[i] === 'up' ? (
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/>
                                                                    <path d="M7 22H4.72A2.31 2.31 0 0 1 2.4 20v-7a2.31 2.31 0 0 1 2.33-2H7"/>
                                                                </svg>
                                                            ) : (
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                                                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/>
                                                                    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                                                                </svg>
                                                            )}
                                                            Thank you for feedback!
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <button className="floating-assistant__feedback-btn" aria-label="Thumbs down" onClick={() => setFeedbackGiven(prev => ({ ...prev, [i]: 'down' }))}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/>
                                                                    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                                                                </svg>
                                                            </button>
                                                            <button className="floating-assistant__feedback-btn" aria-label="Thumbs up" onClick={() => setFeedbackGiven(prev => ({ ...prev, [i]: 'up' }))}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/>
                                                                    <path d="M7 22H4.72A2.31 2.31 0 0 1 2.4 20v-7a2.31 2.31 0 0 1 2.33-2H7"/>
                                                                </svg>
                                                            </button>
                                                        </>
                                                    )}
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

                    {/* Fade + scroll-to-bottom */}
                    {!isLandingPage && (
                        <div className={`floating-assistant__messages-fade${showScrollDown ? ' floating-assistant__messages-fade--visible' : ''}`}>
                            {showScrollDown && (
                                <button
                                    className="floating-assistant__scroll-down"
                                    onClick={scrollToBottom}
                                    aria-label="Scroll to bottom"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Input */}
                    <div className="floating-assistant__input-row">
                        <div className="floating-assistant__input-wrapper">
                            {quotedText && (
                                <div className="floating-assistant__quote-chip">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                                    </svg>
                                    <span className="floating-assistant__quote-text">{quotedText}</span>
                                    <button className="floating-assistant__quote-dismiss" onClick={() => setQuotedText(null)} aria-label="Remove quote">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                    </button>
                                </div>
                            )}
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
