export const CLOUDFLARE_URL = 'https://spotter-code-popular-questions.thoughtspot-485.workers.dev';

export const LOADING_PHASES = [
    'Processing your request...',
    'Thinking...',
    'Understanding your query...',
    'Searching documentation...',
    'Generating response...',
];

export const PANEL_MIN_WIDTH = 360;
export const PANEL_MAX_WIDTH = 720;
export const PANEL_DEFAULT_WIDTH = 360;

export const LOADING_PHASE_DELAYS = [0, 1200, 2800, 4800, 7000];

export const API_PATHS = {
    SUGGESTED_QUESTIONS: '/suggested-questions',
    AGENT: '/agent/embed-assistant',
} as const;

export const ERROR_MESSAGES = {
    DEFAULT: 'Sorry, something went wrong. Please try again.',
    NO_RESPONSE: 'No response received.',
} as const;

export const STORAGE_KEY = 'floatingAssistantState';

export const LANG_LABEL_MAP: Record<string, string> = {
    javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
    bash: 'Bash', shell: 'Shell', sh: 'Shell', sql: 'SQL', json: 'JSON',
    html: 'HTML', css: 'CSS', scss: 'SCSS', java: 'Java', go: 'Go',
    ruby: 'Ruby', rust: 'Rust', cpp: 'C++', c: 'C', csharp: 'C#',
    yaml: 'YAML', xml: 'XML', markdown: 'Markdown', curl: 'cURL',
};

export const isPageReload = (): boolean => {
    try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        return nav?.type === 'reload';
    } catch {
        return false;
    }
};
