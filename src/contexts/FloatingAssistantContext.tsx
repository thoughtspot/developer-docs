import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

type Message = {
    role: 'user' | 'assistant';
    content: string;
    quotedText?: string;
    toolSteps?: string[];
    durationMs?: number;
    sentAt?: number;
};

type FloatingAssistantContextType = {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    messages: Message[];
    setMessages: (messages: Message[]) => void;
    suggestedQuestions: string[];
    setSuggestedQuestions: (questions: string[]) => void;
    suggestedQuestionsLoaded: boolean;
    setSuggestedQuestionsLoaded: (loaded: boolean) => void;
    resetConversation: () => void;
    quotedText: string | null;
    setQuotedText: (text: string | null) => void;
};

const STORAGE_KEY = 'floatingAssistantState';

const FloatingAssistantContext = createContext<FloatingAssistantContextType | undefined>(undefined);

const isPageReload = (): boolean => {
    try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        return nav?.type === 'reload';
    } catch {
        return false;
    }
};

export const FloatingAssistantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Always start with SSR-safe defaults to avoid hydration mismatch.
    // sessionStorage is restored in useEffect after hydration.
    const [isOpen, setIsOpenState] = useState(false);
    const [messages, setMessagesState] = useState<Message[]>([]);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    const [suggestedQuestionsLoaded, setSuggestedQuestionsLoaded] = useState(false);
    const [quotedText, setQuotedText] = useState<string | null>(null);

    useEffect(() => {
        if (isPageReload()) {
            sessionStorage.removeItem(STORAGE_KEY);
            return;
        }
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) {
                const { isOpen: savedOpen, messages: savedMsgs } = JSON.parse(saved);
                if (savedOpen) setIsOpenState(savedOpen);
                if (savedMsgs?.length) setMessagesState(savedMsgs);
            }
        } catch {
            // ignore
        }
    }, []);

    const saveState = useCallback((open: boolean, msgs: Message[]) => {
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ isOpen: open, messages: msgs }));
    }, []);

    const setIsOpen = useCallback((open: boolean) => {
        setIsOpenState(open);
        saveState(open, messages);
    }, [messages, saveState]);

    const setMessages = useCallback((msgs: Message[]) => {
        setMessagesState(msgs);
        saveState(isOpen, msgs);
    }, [isOpen, saveState]);

    const resetConversation = useCallback(() => {
        setMessagesState([]);
        setSuggestedQuestionsLoaded(false);
        setQuotedText(null);
        sessionStorage.removeItem(STORAGE_KEY);
    }, []);

    return (
        <FloatingAssistantContext.Provider
            value={{
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
            }}
        >
            {children}
        </FloatingAssistantContext.Provider>
    );
};

const NOOP = () => {};

const FLOATING_ASSISTANT_DEFAULT: FloatingAssistantContextType = {
    isOpen: false,
    setIsOpen: NOOP,
    messages: [],
    setMessages: NOOP,
    suggestedQuestions: [],
    setSuggestedQuestions: NOOP,
    suggestedQuestionsLoaded: false,
    setSuggestedQuestionsLoaded: NOOP,
    resetConversation: NOOP,
    quotedText: null,
    setQuotedText: NOOP,
};

export const useFloatingAssistant = () => {
    return useContext(FloatingAssistantContext) ?? FLOATING_ASSISTANT_DEFAULT;
};
