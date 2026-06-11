import React, { useState } from 'react';
import './index.scss';

type FeedbackState = 'idle' | 'helpful' | 'not-helpful' | 'submitted';

/*
 * Feedback submission hook.
 *
 * Currently logs to the browser console.
 * To wire up a real endpoint, replace the console.log with a fetch() call:
 *
 *   fetch('/api/feedback', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   });
 *
 * Common integrations: Google Analytics event, Segment track(), Airtable API,
 * GitHub Discussions API, or a custom backend endpoint.
 */
const submitFeedback = (payload: {
    url: string;
    helpful: boolean;
    comment?: string;
}) => {
    console.log('[Feedback] Page feedback received:', payload);
    /* ── Replace the line above with your endpoint call ── */
};

const WasThisHelpful = () => {
    const [state, setFeedbackState] = useState<FeedbackState>('idle');
    const [feedback, setFeedback] = useState('');

    const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

    /* Thumbs up → immediately thank the user; no follow-up form */
    const handleThumbsUp = () => {
        submitFeedback({ url: pageUrl, helpful: true });
        setFeedbackState('submitted');
    };

    /* Thumbs down → show improvement text input */
    const handleThumbsDown = () => {
        setFeedbackState('not-helpful');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitFeedback({ url: pageUrl, helpful: false, comment: feedback });
        setFeedbackState('submitted');
    };

    const handleSkip = () => {
        submitFeedback({ url: pageUrl, helpful: false });
        setFeedbackState('submitted');
    };

    if (state === 'submitted') {
        return (
            <div className="was-helpful" role="region" aria-label="Page feedback">
                <div className="was-helpful__thanks">
                    Thank you for your feedback!
                </div>
            </div>
        );
    }

    return (
        <div className="was-helpful" role="region" aria-label="Page feedback">
            <div className="was-helpful__prompt">
                Was this information helpful?
            </div>
            <div className="was-helpful__actions">
                <button
                    className={`was-helpful__btn was-helpful__btn--up ${state === 'helpful' ? 'active' : ''}`}
                    onClick={handleThumbsUp}
                    aria-label="Yes, this was helpful"
                    title="Yes, this was helpful"
                >
                    <span className="was-helpful__emoji" aria-hidden="true">👍</span>
                    <span>Yes</span>
                </button>
                <button
                    className={`was-helpful__btn was-helpful__btn--down ${state === 'not-helpful' ? 'active' : ''}`}
                    onClick={handleThumbsDown}
                    aria-label="No, this was not helpful"
                    title="No, this was not helpful"
                >
                    <span className="was-helpful__emoji" aria-hidden="true">👎</span>
                    <span>No</span>
                </button>
            </div>

            {state === 'not-helpful' && (
                <div className="was-helpful__followup">
                    <p className="was-helpful__followup-text">What can we improve?</p>
                    <form className="was-helpful__form" onSubmit={handleSubmit}>
                        <textarea
                            className="was-helpful__textarea"
                            placeholder="Tell us what was unclear or missing..."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            rows={3}
                            aria-label="Improvement suggestions"
                            autoFocus
                        />
                        <div className="was-helpful__form-actions">
                            <button type="submit" className="was-helpful__submit">
                                Submit
                            </button>
                            <button type="button" className="was-helpful__skip" onClick={handleSkip}>
                                Skip
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default WasThisHelpful;
