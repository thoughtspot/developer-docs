import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type Message = {
    role: 'user' | 'assistant';
    content: string;
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

const getInitialState = () => {
    if (typeof window === 'undefined') return { isOpen: false, messages: [] };
    if (isPageReload()) {
        sessionStorage.removeItem(STORAGE_KEY);
        return { isOpen: false, messages: [] };
    }
    try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {
        // ignore
    }
    return { isOpen: false, messages: [] };
};

export const FloatingAssistantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const initialState = getInitialState();
    const [isOpen, setIsOpenState] = useState(initialState.isOpen);
    const [messages, setMessagesState] = useState<Message[]>(initialState.messages);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    const [suggestedQuestionsLoaded, setSuggestedQuestionsLoaded] = useState(false);

    // Synchronous save to sessionStorage only
    const saveState = useCallback((open: boolean, msgs: Message[]) => {
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ isOpen: open, messages: msgs }));
    }, []);

    // Wrapped setters that save immediately
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
            }}
        >
            {children}
        </FloatingAssistantContext.Provider>
    );
};

export const useFloatingAssistant = () => {
    const context = useContext(FloatingAssistantContext);
    if (!context) {
        throw new Error('useFloatingAssistant must be used within FloatingAssistantProvider');
    }
    return context;
};
