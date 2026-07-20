import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { LANG_LABEL_MAP } from './constants';
import { SseEvent } from './types';

export function renderMarkdown(text: string): string {
    const cleaned = text
        .replace(/【[\d]+】/g, '')
        .replace(/【[\d†]+†?[^】]*】/g, '')
        .replace(/\s*\bcite\w*/gi, '')
        .replace(/\s*\[cite[^\]]*\]/gi, '');
    const html = marked.parse(cleaned, { async: false }) as string;
    const sanitized = DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] });
    const withLinks = sanitized.replace(
        /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g,
        (_, href, label) => {
            const trimmed = label.trim();
            let display = trimmed;
            if (/^https?:\/\//i.test(trimmed)) {
                try {
                    const url = new URL(trimmed);
                    const slug = url.pathname.split('/').filter(Boolean).pop() || url.hostname;
                    display = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                } catch {
                    display = trimmed;
                }
            }
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${display}</a>`;
        },
    );
    return withLinks.replace(
        /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g,
        (_, attrs, code) => {
            const langMatch = attrs.match(/class="language-([^"]+)"/);
            const lang = langMatch?.[1];
            const decoded = code
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&');
            let highlighted = decoded;
            let detectedLang = lang;
            try {
                if (lang && hljs.getLanguage(lang)) {
                    highlighted = hljs.highlight(decoded, { language: lang }).value;
                } else {
                    const result = hljs.highlightAuto(decoded);
                    highlighted = result.value;
                    detectedLang = result.language;
                }
            } catch { /* fallback to plain */ }
            const label = detectedLang ? (LANG_LABEL_MAP[detectedLang.toLowerCase()] || detectedLang.toUpperCase()) : 'Code';
            return `<div class="fa-code-block">` +
                `<div class="fa-code-header">` +
                `<span class="fa-code-lang">${label}</span>` +
                `<button class="fa-code-copy" data-code="${encodeURIComponent(decoded)}">Copy</button>` +
                `</div>` +
                `<pre><code${attrs}>${highlighted}</code></pre>` +
                `</div>`;
        },
    );
}

export function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${h12}:${m} ${ampm}, ${month}/${day}/${year}`;
}

export function formatDuration(ms: number): string {
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec} second${totalSec !== 1 ? 's' : ''}`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const minPart = `${mins} min${mins !== 1 ? 's' : ''}`;
    return secs > 0 ? `${minPart} ${secs} second${secs !== 1 ? 's' : ''}` : minPart;
}

export async function* parseSseStream(response: Response): AsyncGenerator<SseEvent> {
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

export const getPageId = (): string | undefined => {
    if (typeof window === 'undefined') return undefined;
    return new URLSearchParams(window.location.search).get('pageid')
        || window.location.pathname.split('/').filter(Boolean).pop()
        || undefined;
};

export const stripMarkdown = (md: string) =>
    md.replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/, '').replace(/```$/, '').trim())
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .trim();
