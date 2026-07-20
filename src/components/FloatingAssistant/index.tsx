import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingAssistant } from '../../contexts/FloatingAssistantContext';
import { isPublicSite } from '../../utils/app-utils';
import { CUSTOM_PAGE_ID } from '../../configs/doc-configs';
import { Alert, Icon, IconID, IconSize, IconColor, LoadingIndicator } from '@thoughtspot/radiant-react';
import '@thoughtspot/radiant-react/styles';
import './index.scss';
import SpotterCodeLogo from './SpotterCodeLogo';
import { LOADING_PHASES, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH, PANEL_DEFAULT_WIDTH, LOADING_PHASE_DELAYS, ERROR_MESSAGES } from './constants';
import { Message } from './types';
import { renderMarkdown, formatTimestamp, formatDuration, getPageId, stripMarkdown } from './helpers';
import { fetchSuggestedQuestions, streamAgentResponse } from './api';

const SparkleIcon = () => (
    <Icon id={IconID.AI_SPARKLE_SELECTED} size={IconSize.XLARGE} color={IconColor.BLUE} />
);

const MsgCopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleCopy = () => {
        navigator.clipboard.writeText(stripMarkdown(text)).catch(() => {});
        if (timerRef.current) clearTimeout(timerRef.current);
        setCopied(true);
        timerRef.current = setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button className={`fa-msg-copy-btn${copied ? ' fa-msg-copy-btn--copied' : ''}`} onClick={handleCopy} aria-label="Copy response">
            <Icon id={copied ? IconID.CHECKMARK : IconID.COPY} size={IconSize.SMALL} color={copied ? IconColor.GREEN : IconColor.GRAY} />
        </button>
    );
};

const AssistantAvatar = () => (
    <div className="floating-assistant__avatar-icon">
        <SpotterCodeLogo />
    </div>
);

const FloatingAssistant: React.FC = () => {
    const [pageId, setPageId] = useState<string | undefined>(getPageId);
    const [isEmbedded, setIsEmbedded] = useState(false);
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
    const [loadingPhase, setLoadingPhase] = useState(0);
    const [questionsKey, setQuestionsKey] = useState(0);
    const loadingPhaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showFeedbackToast, setShowFeedbackToast] = useState(false);
    const [toastExiting, setToastExiting] = useState(false);
    const feedbackToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const toastExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hideToast = () => {
        setToastExiting(true);
        toastExitTimer.current = setTimeout(() => {
            setShowFeedbackToast(false);
            setToastExiting(false);
        }, 250);
    };

    const giveFeedback = (idx: number, type: 'up' | 'down') => {
        const isUnfill = feedbackGiven[idx] === type;
        setFeedbackGiven((prev: Record<number, 'up' | 'down'>) => {
            const next = { ...prev };
            if (isUnfill) delete next[idx];
            else next[idx] = type;
            return next;
        });
        if (!isUnfill) {
            if (feedbackToastTimer.current) clearTimeout(feedbackToastTimer.current);
            if (toastExitTimer.current) clearTimeout(toastExitTimer.current);
            setToastExiting(false);
            setShowFeedbackToast(true);
            feedbackToastTimer.current = setTimeout(hideToast, 2500);
        }
    };
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState('');
    const editDivRef = useRef<HTMLDivElement | null>(null);
    const editOriginalRef = useRef<string>('');

    const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
    const isResizing = useRef(false);
    const resizeStartX = useRef(0);
    const resizeStartWidth = useRef(0);

    const onResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        resizeStartX.current = e.clientX;
        resizeStartWidth.current = panelWidth;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (ev: MouseEvent) => {
            if (!isResizing.current) return;
            const delta = resizeStartX.current - ev.clientX;
            const next = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, resizeStartWidth.current + delta));
            setPanelWidth(next);
        };

        const onMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleReset = () => {
        abortRef.current?.abort();
        resetConversation();
        setInput('');
        setIsLoading(false);
        setStreamingText('');
        setToolSteps([]);
        setFeedbackGiven({});
        setEditingIndex(null);
        setEditDraft('');
    };

    const [editQuotedText, setEditQuotedText] = useState<string | undefined>(undefined);

    const startEdit = (idx: number, content: string, quotedText?: string) => {
        const draft = quotedText ? content.replace(`"${quotedText}"\n\n`, '') : content;
        editOriginalRef.current = draft;
        setEditingIndex(idx);
        setEditQuotedText(quotedText);
        setEditDraft(draft);
    };

    const cancelEdit = () => {
        if (editDivRef.current) {
            editDivRef.current.innerText = editOriginalRef.current;
        }
        setEditingIndex(null);
        setEditDraft('');
        setEditQuotedText(undefined);
    };

    const submitEdit = async (idx: number) => {
        const draft = editDraft.trim();
        if (!draft) return;
        const original = messages[idx];
        const effectiveQuote = editQuotedText;
        const fullText = effectiveQuote ? `"${effectiveQuote}"\n\n${draft}` : draft;
        const updated: Message = { ...original, content: fullText, quotedText: effectiveQuote, sentAt: Date.now() };
        const trimmed = [...messages.slice(0, idx), updated];
        setEditingIndex(null);
        setEditDraft('');
        setEditQuotedText(undefined);
        await sendMessage(fullText, trimmed);
    };
    const [isClosing, setIsClosing] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [toolSteps, setToolSteps] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const userScrolledRef = useRef(false);

    useEffect(() => {
        setIsOpen(true);
    }, []);

    useEffect(() => {
        if (!userScrolledRef.current && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, streamingText]);

    useEffect(() => {
        if (isOpen && messages.length > 0) {
            userScrolledRef.current = false;
            setTimeout(() => {
                const el = messagesContainerRef.current;
                if (el) el.scrollTop = el.scrollHeight;
            }, 280);
        }
    }, [isOpen]);

    const handleMessagesScroll = () => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const isAtBottom = distFromBottom <= 80;
        setShowScrollDown(!isAtBottom);
        userScrolledRef.current = !isAtBottom;
    };

    const scrollToBottom = () => {
        userScrolledRef.current = false;
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setShowScrollDown(false);
    };

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [input]);

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
        setIsEmbedded(!isPublicSite(window.location.search));
        const handler = (e: CustomEvent<{ location: Location }>) => {
            setIsEmbedded(!isPublicSite(e.detail.location.search));
        };
        window.addEventListener('gatsby-route-update', handler as EventListener);
        return () => window.removeEventListener('gatsby-route-update', handler as EventListener);
    }, []);

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
        fetchSuggestedQuestions(id)
            .then((questions) => {
                setSuggestedQuestions(questions);
                setSuggestedQuestionsLoaded(true);
                setQuestionsKey((k: number) => k + 1);
            })
            .catch(() => {
                setSuggestedQuestionsLoaded(true);
            });
    }, [pageId, suggestedQuestionsLoaded, messages.length, setSuggestedQuestions, setSuggestedQuestionsLoaded]);

    const stopGeneration = () => {
        abortRef.current?.abort();
    };

    const sendMessage = async (text?: string, historyOverride?: Message[]) => {
        const messageText = (text ?? input).trim();
        if (!messageText || isLoading) return;

        let updatedMessages: Message[];
        if (historyOverride) {
            updatedMessages = historyOverride;
        } else {
            const fullText = quotedText ? `"${quotedText}"\n\n${messageText}` : messageText;
            const userMessage: Message = { role: 'user', content: fullText, quotedText: quotedText ?? undefined, sentAt: Date.now() };
            setQuotedText(null);
            updatedMessages = [...messages, userMessage];
        }

        setMessages(updatedMessages);
        if (!text) setInput('');
        setIsLoading(true);
        setStreamingText('');
        setToolSteps([]);
        setLoadingPhase(0);
        userScrolledRef.current = false;

        LOADING_PHASE_DELAYS.forEach((delay, idx) => {
            const t = setTimeout(() => setLoadingPhase(idx), delay);
            if (idx === LOADING_PHASE_DELAYS.length - 1) loadingPhaseTimer.current = t;
        });

        abortRef.current = new AbortController();
        const startTime = Date.now();

        let accumulated = '';
        let collectedSteps: string[] = [];
        let finalContent: string = ERROR_MESSAGES.DEFAULT;
        let aborted = false;

        try {
            for await (const event of streamAgentResponse(updatedMessages, pageId, abortRef.current.signal)) {
                if (event.type === 'text') {
                    accumulated += event.content;
                    setStreamingText(accumulated);
                } else if (event.type === 'tool-start') {
                    collectedSteps = [...collectedSteps, event.toolName];
                    setToolSteps([...collectedSteps]);
                } else if (event.type === 'done') {
                    break;
                } else if (event.type === 'error') {
                    throw new Error(event.content);
                }
            }

            finalContent = accumulated || ERROR_MESSAGES.NO_RESPONSE;
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                aborted = true;
                finalContent = accumulated || '';
            }
        } finally {
            if (!aborted || accumulated) {
                setMessages([...updatedMessages, {
                    role: 'assistant',
                    content: finalContent,
                    toolSteps: collectedSteps.length > 0 ? collectedSteps : undefined,
                    durationMs: Date.now() - startTime,
                }]);
            }
            setStreamingText('');
            if (loadingPhaseTimer.current) clearTimeout(loadingPhaseTimer.current);
            setLoadingPhase(0);
            setToolSteps([]);
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

    const copyTimers = useRef<Map<HTMLElement, ReturnType<typeof setTimeout>>>(new Map());
    const handleCodeCopy = (e: React.MouseEvent<HTMLDivElement>) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.fa-code-copy');
        if (!btn) return;
        const code = decodeURIComponent(btn.dataset.code ?? '');
        navigator.clipboard.writeText(code).catch(() => {});
        const existing = copyTimers.current.get(btn);
        if (existing) clearTimeout(existing);
        btn.textContent = 'Copied!';
        btn.classList.add('fa-code-copy--copied');
        btn.classList.remove('fa-code-copy--fading');
        const t = setTimeout(() => {
            btn.classList.add('fa-code-copy--fading');
            const reset = setTimeout(() => {
                btn.textContent = 'Copy';
                btn.classList.remove('fa-code-copy--copied', 'fa-code-copy--fading');
                copyTimers.current.delete(btn);
            }, 300);
            copyTimers.current.set(btn, reset);
        }, 1500);
        copyTimers.current.set(btn, t);
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 300);
    };

    const isLandingPage = messages.length === 0 && !isLoading;

    if (pageId === CUSTOM_PAGE_ID.API_PLAYGROUND) return null;

    return (
        <>
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

            {(isOpen || isClosing) && (
                <div
                    className={`floating-assistant__panel${isClosing ? ' closing' : ''}${!isLandingPage ? ' floating-assistant__panel--conversation' : ''}${isEmbedded ? ' floating-assistant__panel--embedded' : ''}`}
                    style={{ width: panelWidth }}
                >
                    <div className="floating-assistant__resize-handle" onMouseDown={onResizeMouseDown} />
                    <div className="floating-assistant__header">
                        <span className="floating-assistant__title">SpotterCode</span>
                        <button className="floating-assistant__close-btn" onClick={handleClose} aria-label="Close assistant">
                            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8.55252 7.73942L3.4796 12.8123L2.22266 11.5554L6.03863 7.73942L2.22266 3.92345L3.4796 2.6665L8.55252 7.73942ZM13.8859 7.73942L8.81293 12.8123L7.55599 11.5554L11.372 7.73942L7.55599 3.92345L8.81293 2.6665L13.8859 7.73942Z" fill="#1D232F"/>
                            </svg>
                        </button>
                    </div>

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
                                        <div key={questionsKey} className="floating-assistant__suggestions">
                                            {suggestedQuestions.map((q, i) => (
                                                <button
                                                    key={i}
                                                    className="floating-assistant__suggestion"
                                                    style={{ animationDelay: `${i * 60}ms` }}
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
                                            <div className="floating-assistant__user-message-wrap">
                                                <div
                                                    className={`floating-assistant__user-bubble${editingIndex === i ? ' floating-assistant__user-bubble--editing' : ''}`}
                                                    contentEditable={editingIndex === i}
                                                    suppressContentEditableWarning
                                                    ref={el => {
                                                        if (editingIndex === i) {
                                                            editDivRef.current = el;
                                                            if (el && document.activeElement !== el) {
                                                                el.focus();
                                                                const range = document.createRange();
                                                                range.selectNodeContents(el);
                                                                range.collapse(false);
                                                                window.getSelection()?.removeAllRanges();
                                                                window.getSelection()?.addRange(range);
                                                            }
                                                        }
                                                    }}
                                                    onInput={e => setEditDraft((e.target as HTMLDivElement).innerText)}
                                                    onKeyDown={e => {
                                                        if (editingIndex !== i) return;
                                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(i); }
                                                        if (e.key === 'Escape') cancelEdit();
                                                    }}
                                                    onPaste={e => {
                                                        e.preventDefault();
                                                        const text = e.clipboardData.getData('text/plain');
                                                        const sel = window.getSelection();
                                                        if (!sel || !sel.rangeCount) return;
                                                        const range = sel.getRangeAt(0);
                                                        range.deleteContents();
                                                        range.insertNode(document.createTextNode(text));
                                                        range.collapse(false);
                                                        sel.removeAllRanges();
                                                        sel.addRange(range);
                                                        setEditDraft((e.currentTarget as HTMLDivElement).innerText);
                                                    }}
                                                >
                                                    {editingIndex === i ? (
                                                        editQuotedText && (
                                                            <div className="floating-assistant__quote-chip floating-assistant__quote-chip--message">
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,color:'#a5acb9'}}><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                                                                <span className="floating-assistant__quote-text">{editQuotedText}</span>
                                                                <button
                                                                    className="floating-assistant__quote-dismiss-inline"
                                                                    onClick={() => setEditQuotedText(undefined)}
                                                                    aria-label="Remove quote"
                                                                >
                                                                    <Icon id={IconID.CROSS} size={IconSize.XSMALL} color={IconColor.GRAY} />
                                                                </button>
                                                            </div>
                                                        )
                                                    ) : (
                                                        msg.quotedText && (
                                                            <div className="floating-assistant__quote-chip floating-assistant__quote-chip--message">
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,color:'#a5acb9'}}><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                                                                <span className="floating-assistant__quote-text">{msg.quotedText}</span>
                                                            </div>
                                                        )
                                                    )}
                                                    {msg.quotedText
                                                        ? msg.content.replace(`"${msg.quotedText}"\n\n`, '')
                                                        : msg.content}
                                                </div>
                                                <div className="floating-assistant__user-meta">
                                                    {msg.sentAt && editingIndex !== i && (
                                                        <span className="floating-assistant__timestamp">{formatTimestamp(msg.sentAt)}</span>
                                                    )}
                                                    {editingIndex === i ? (
                                                        <>
                                                            <button className="floating-assistant__edit-action-btn" onClick={cancelEdit} aria-label="Cancel edit">
                                                                <Icon id={IconID.CROSS} size={IconSize.SMALL} color={IconColor.GRAY} />
                                                            </button>
                                                            <button className="floating-assistant__edit-action-btn floating-assistant__edit-action-btn--send" onClick={() => submitEdit(i)} aria-label="Send edit" disabled={editDraft === editOriginalRef.current}>
                                                                <Icon id={IconID.ARROW_UP} size={IconSize.SMALL} color={IconColor.WHITE} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        i === messages.map((m, idx) => m.role === 'user' ? idx : -1).filter(x => x >= 0).pop() && !isLoading && (
                                                            <button className="floating-assistant__edit-action-btn" onClick={() => startEdit(i, msg.content, msg.quotedText)} aria-label="Edit message">
                                                                <Icon id={IconID.PENCIL} size={IconSize.SMALL} color={IconColor.GRAY} />
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="floating-assistant__assistant-block">
                                                <AssistantAvatar />
                                                {msg.durationMs !== undefined && (
                                                    <div className="floating-assistant__gen-summary-header">
                                                        <span>Work done in {formatDuration(msg.durationMs)}</span>
                                                    </div>
                                                )}
                                                <div
                                                    className="floating-assistant__message-text floating-assistant__message-text--md"
                                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                                />
                                                <div className="floating-assistant__feedback">
                                                    <button
                                                        className={`fa-feedback-btn${feedbackGiven[i] === 'down' ? ' fa-feedback-btn--active' : ''}`}
                                                        aria-label="Thumbs down"
                                                        onClick={() => giveFeedback(i, 'down')}
                                                    >
                                                        <Icon id={feedbackGiven[i] === 'down' ? IconID.THUMB_DOWN_UNDO : IconID.THUMB_DOWN} size={IconSize.SMALL} color={feedbackGiven[i] === 'down' ? IconColor.BLUE : IconColor.GRAY} />
                                                    </button>
                                                    <button
                                                        className={`fa-feedback-btn${feedbackGiven[i] === 'up' ? ' fa-feedback-btn--active' : ''}`}
                                                        aria-label="Thumbs up"
                                                        onClick={() => giveFeedback(i, 'up')}
                                                    >
                                                        <Icon id={feedbackGiven[i] === 'up' ? IconID.THUMB_UP_UNDO : IconID.THUMB_UP} size={IconSize.SMALL} color={feedbackGiven[i] === 'up' ? IconColor.BLUE : IconColor.GRAY} />
                                                    </button>
                                                    <MsgCopyButton text={msg.content} />
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
                                            ) : (
                                                <div className="floating-assistant__loading-status">
                                                    <LoadingIndicator.Contextual loaderColor="blue" />
                                                    <span key={loadingPhase} className="floating-assistant__loading-phase">
                                                        {LOADING_PHASES[loadingPhase]}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {!isLandingPage && (
                        <div className={`floating-assistant__messages-fade${showScrollDown ? ' floating-assistant__messages-fade--visible' : ''}`}>
                            {showScrollDown && (
                                <button className="floating-assistant__scroll-down" aria-label="Scroll to bottom" onClick={scrollToBottom}>
                                    <Icon id={IconID.CHEVRON_DOWN} size={IconSize.SMALL} color={IconColor.GRAY} />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="floating-assistant__input-row">
                        <div className="floating-assistant__input-wrapper">
                            {quotedText && (
                                <div className="floating-assistant__quote-chip">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,color:'#a5acb9'}}><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                                    <span className="floating-assistant__quote-text">{quotedText}</span>
                                    <button className="floating-assistant__quote-dismiss" aria-label="Remove quote" onClick={() => setQuotedText(null)}>
                                        <Icon id={IconID.CROSS} size={IconSize.XSMALL} color={IconColor.GRAY} />
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
                                onFocus={() => {
                                    if (editingIndex !== null) cancelEdit();
                                }}
                                rows={1}
                            />
                            <div className="floating-assistant__input-buttons">
                                <button
                                    className="floating-assistant__reset-input"
                                    onClick={handleReset}
                                    aria-label="Reset conversation"
                                    disabled={messages.length === 0 && !input.trim() && !quotedText}
                                >
                                    <Icon id={IconID.RESET} size={IconSize.SMALL} color={IconColor.TEXT_COLOR} />
                                </button>
                                {isLoading ? (
                                    <button
                                        className="floating-assistant__stop"
                                        onClick={stopGeneration}
                                        aria-label="Stop generation"
                                    >
                                        <Icon id={IconID.STOP_SQUARE} size={IconSize.SMALL} color={IconColor.CONTENT_TERTIARY} />
                                    </button>
                                ) : (
                                    <button
                                        className="floating-assistant__send"
                                        onClick={() => sendMessage()}
                                        disabled={!input.trim()}
                                        aria-label="Send"
                                    >
                                        <Icon id={IconID.ARROW_UP} size={IconSize.SMALL} color={IconColor.WHITE} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="floating-assistant__footer">
                        SpotterCode responses should be reviewed.{' '}
                        <a href="https://developers.thoughtspot.com/docs/SpotterCode" target="_blank" rel="noopener noreferrer">
                            Learn more
                        </a>
                    </div>
                </div>
            )}
            {typeof document !== 'undefined' && showFeedbackToast && createPortal(
                <Alert.Toast
                    message="Thank you for submitting feedback."
                    isVisible={!toastExiting}
                    autoHide={false}
                    showCloseButton
                    onClose={hideToast}
                />,
                document.body
            )}
        </>
    );
};

export default FloatingAssistant;
