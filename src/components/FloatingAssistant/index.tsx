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

const SpotterCodeLogo = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <g clipPath="url(#clip0_298_49030)">
            <path d="M10 19.9815C15.5129 19.9815 19.982 15.5124 19.982 9.99952C19.982 4.48665 15.5129 0.0175781 10 0.0175781C4.48714 0.0175781 0.0180664 4.48665 0.0180664 9.99952C0.0180664 15.5124 4.48714 19.9815 10 19.9815Z" fill="#D1C0FB"/>
            <mask id="mask0_298_49030" style={{maskType:'luminance'}} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
                <path d="M10 19.9815C15.5129 19.9815 19.982 15.5124 19.982 9.99952C19.982 4.48665 15.5129 0.0175781 10 0.0175781C4.48714 0.0175781 0.0180664 4.48665 0.0180664 9.99952C0.0180664 15.5124 4.48714 19.9815 10 19.9815Z" fill="white"/>
            </mask>
            <g mask="url(#mask0_298_49030)">
                <path d="M4.54589 21.1833C1.99728 21.7965 -1.96938 18.2937 -2.69369 15.859C-3.418 13.4242 -2.31105 10.5562 2.90562 9.57146C5.48131 9.08535 8.29867 10.386 8.83201 12.8701C9.60284 16.4597 7.09451 20.5701 4.54589 21.1833Z" fill="#1B3E61"/>
            </g>
            <path d="M5.6416 11.8545L7.10063 14.7399L10.5416 16.1663L13.4659 15.5691L14.2972 14.342L14.4763 12.6774L5.6416 11.8545Z" fill="#D1C0FB"/>
            <path d="M5.33883 8.5121C4.73258 10.5329 5.52147 14.5607 8.73675 15.8197C12.418 17.2607 14.3145 15.8593 14.8986 14.8371C15.427 13.9121 14.8229 12.5593 14.8229 12.5593L14.0895 13.2753C14.0895 13.2753 14.668 15.4315 11.6694 15.4614C7.843 15.4996 6.60828 12.5079 6.60828 12.5079C7.64231 13.5517 9.28744 15.2281 12.4784 14.3433C14.218 13.8614 16.1034 12.8857 16.6381 12.1378C17.4062 11.0642 13.1104 11.6892 13.9284 7.42251C14.0444 7.25654 14.2798 6.86487 14.1423 6.58084C13.3076 4.85237 11.2361 6.22876 11.2361 6.22876C11.2361 6.22876 10.4847 5.09682 10.1465 5.20585C9.64161 5.36904 10.1013 6.06765 9.618 6.1496C9.13467 6.23154 8.1437 2.50307 6.43258 2.86904C5.35758 3.0989 4.6055 5.6239 5.33814 8.5114L5.33883 8.5121Z" fill="#1B3E61"/>
            <path d="M7.0019 11.4135C7.16857 11.7753 7.42898 12.0892 7.76232 12.3072C8.42621 12.7405 9.06996 12.8204 9.68107 12.6322C10.447 12.3968 11.1297 11.7503 11.1991 10.9517C11.2477 10.3905 10.997 9.84402 10.6783 9.37943C10.1547 8.61763 9.4269 7.99888 8.59426 7.59818C8.25815 7.43638 7.85398 7.54124 7.63384 7.84263C7.18523 8.45651 6.75676 9.2204 6.73246 9.88429C6.70885 10.5447 6.76579 10.9037 7.00121 11.4135H7.0019Z" fill="white"/>
            <path d="M9.38075 11.9256C9.87742 11.9256 10.2801 11.5229 10.2801 11.0263C10.2801 10.5296 9.87742 10.127 9.38075 10.127C8.88408 10.127 8.48145 10.5296 8.48145 11.0263C8.48145 11.5229 8.88408 11.9256 9.38075 11.9256Z" fill="#1B3E61"/>
            <path d="M13.7842 11.1653C13.2592 11.1653 12.7898 10.8869 12.462 10.3813C12.1044 9.96118 12.0815 8.39451 12.5509 7.34104C12.8092 6.76118 13.119 6.63965 13.3328 6.63965C13.4349 6.63965 13.5384 6.66673 13.6419 6.7202C14.6287 7.26326 15.2981 8.24034 15.3509 9.21257C15.4148 9.75423 15.2662 10.2591 14.9328 10.6341C14.6328 10.9716 14.2141 11.1653 13.7842 11.1653Z" fill="white"/>
            <path d="M13.3327 6.77778C13.4105 6.77778 13.4925 6.79861 13.5779 6.84305C14.4688 7.33333 15.1612 8.24514 15.2126 9.22361C15.3397 10.2833 14.5841 11.0257 13.7841 11.0257C13.3487 11.0257 12.9001 10.8056 12.573 10.2965C12.0619 9.72847 12.4043 6.77778 13.3327 6.77778ZM13.3327 6.5C13.0772 6.5 12.7126 6.63611 12.4237 7.28403C12.2209 7.73819 12.0862 8.38819 12.0619 9.02222C12.0466 9.41667 12.0654 10.1222 12.3501 10.4639C12.7043 11.0056 13.2126 11.3035 13.7841 11.3035C14.2543 11.3035 14.7112 11.0931 15.0369 10.725C15.3959 10.3208 15.5563 9.77917 15.489 9.19931C15.4313 8.18264 14.7348 7.1625 13.7112 6.59931L13.7084 6.59792L13.7057 6.59653C13.5827 6.53264 13.457 6.5 13.3327 6.5Z" fill="#1B3E61"/>
            <path d="M11.2791 6.45801C11.4597 6.80106 11.7743 6.80592 11.9069 7.17051C12.5201 8.85662 13.5798 10.3788 14.9486 11.5386L12.4104 11.7379L10.6777 7.55592L11.2798 6.45801H11.2791Z" fill="#1B3E61"/>
            <path d="M13.7113 10.2626C12.9738 9.47373 12.7175 8.97443 12.2939 8.14735C12.0661 7.7029 11.7821 7.14943 11.3439 6.39387C10.9224 5.72512 10.3592 4.97998 10.1974 4.94387C10.2009 4.94457 10.2147 4.94526 10.2307 4.93832L10.1147 4.68623C10.2071 4.64387 10.4877 4.51471 11.5821 6.25082C12.0266 7.01748 12.312 7.57373 12.5411 8.02165C12.9682 8.85429 13.2036 9.31332 13.9147 10.0737L13.712 10.2633L13.7113 10.2626Z" fill="url(#paint0_linear_298_49030)"/>
            <path d="M13.8442 10.3086C14.2512 10.3086 14.581 9.97869 14.581 9.57177C14.581 9.16484 14.2512 8.83496 13.8442 8.83496C13.4373 8.83496 13.1074 9.16484 13.1074 9.57177C13.1074 9.97869 13.4373 10.3086 13.8442 10.3086Z" fill="#1B3E61"/>
            <path d="M6.28125 8.71721C6.74236 8.41374 7.34931 8.4936 7.8875 8.6186C8.425 8.74429 8.99375 8.90332 9.51667 8.72554C9.79514 8.6311 10.0347 8.44707 10.2549 8.25124C10.5806 7.96165 10.8875 7.62068 11.0028 7.20054L8.74236 6.34082L6.51736 7.44152L6.28125 8.71721Z" fill="#1B3E61"/>
            <path d="M10.4794 8.21973C9.96342 8.99473 9.21898 9.14125 8.35162 8.95306C7.62939 8.80931 6.92939 8.50514 6.19189 8.77389C6.32384 8.63223 6.50439 8.52806 6.69675 8.46695C7.6162 8.16903 8.56828 8.73848 9.48009 8.63084C9.81689 8.59403 10.1433 8.4107 10.4794 8.21973Z" fill="#D1C0FB"/>
        </g>
        <defs>
            <linearGradient id="paint0_linear_298_49030" x1="9.6828" y1="5.11679" x2="14.2766" y2="9.71054" gradientUnits="userSpaceOnUse">
                <stop offset="0.41" stopColor="#A9EFFF"/>
                <stop offset="0.64" stopColor="white"/>
            </linearGradient>
            <clipPath id="clip0_298_49030">
                <rect width="20" height="20" fill="white"/>
            </clipPath>
        </defs>
    </svg>
);

const AssistantAvatar = () => (
    <div className="floating-assistant__avatar-icon">
        <SpotterCodeLogo />
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
                                        <SpotterCodeLogo />
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
