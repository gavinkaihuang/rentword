'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface Option {
    meaning: string;
    isCorrect: boolean;
}

interface Question {
    type?: 'standard' | 'reverse'; // 'standard': word->meaning, 'reverse': meaning->word
    word: {
        id: number;
        spelling: string;
        orderIndex?: number;
        phonetic?: string;
        grammar?: string;
        example?: string;
        roots?: string;
        affixes?: string;
        history?: string;
        variations?: string;
        mnemonic?: string;
        story?: string;
        wordBookId?: number;
        meaning?: string;
        displayMode?: number;
    };
    options: Option[];
    // For reverse mode override
    reversePrompt?: string;
    reverseOptions?: { label: string; isCorrect: boolean }[];
}

function FormattedMeaning({ text, spelling }: { text: string; spelling: string }) {
    if (!text) return null;

    // Split by Part of Speech (n. vt. adj. etc.)
    // Regex looks for standard abbreviations followed by a dot, preceded by start or space
    // Refined splitting strategy: Match POS tags not preceded by letters (to avoid matching inside words like 'creation.')
    // This captures n. vt. etc. when preceded by space, Chinese, numbers, or start of line.
    const processedMeaning = text.replace(
        /(^|[^a-zA-Z])(n\.|v\.|vi\.|vt\.|adj\.|adv\.|prep\.|pron\.|conj\.|int\.|num\.|abbr\.|art\.)/gi,
        '$1|POS|$2'
    );

    let lines = processedMeaning.split('|POS|').map(l => l.trim()).filter(l => l);

    // If no splits (no POS tags found), fallback to semicolon for basic structure
    if (lines.length === 1 && lines[0] === text.trim()) {
        lines = text.split(/[;；]/).map(l => l.trim()).filter(l => l);
    }

    return (
        <div>
            {lines.map((line, lineIdx) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return null;

                // Highlight spelling in each line
                return (
                    <div key={lineIdx} className={lineIdx > 0 ? "mt-1" : ""}>
                        {(() => {
                            if (!spelling) return trimmedLine;
                            const parts = trimmedLine.split(new RegExp(`(${spelling})`, 'gi'));
                            return parts.map((part, i) =>
                                part.toLowerCase() === spelling.toLowerCase()
                                    ? <span key={i} className="text-[#8c4351] font-bold mx-0.5 bg-[#f4dbd6] px-1 rounded">{part}</span>
                                    : part
                            );
                        })()}
                    </div>
                );
            })}
        </div>
    );
}

function QuizContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // New Task Params
    const taskIdParam = searchParams.get('taskId');

    // Old Mode Params (for initialization)
    const mode = searchParams.get('mode');

    // Data for Preview
    const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);

    // Data for Quiz (Algorithm Scheme)
    const [queue, setQueue] = useState<Question[]>([]);
    const [progress, setProgress] = useState<Record<number, { streak: number, required: number }>>({});
    const [masteredIds, setMasteredIds] = useState<Set<number>>(new Set()); // Completions (Unique IDs)

    const [loading, setLoading] = useState(true);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error'; canRetry?: boolean } | null>(null);
    const [finished, setFinished] = useState(false);

    const [view, setView] = useState<'preview' | 'quiz' | 'spelling'>('preview');
    const [spellingInput, setSpellingInput] = useState('');
    const [learnedWords, setLearnedWords] = useState<Set<number>>(new Set());
    const [mistakeStatusMap, setMistakeStatusMap] = useState<Record<number, 'resolved' | 'unresolved'>>({});
    const [unfamiliarStatusMap, setUnfamiliarStatusMap] = useState<Record<number, boolean>>({});

    const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
    const [hideSpelling, setHideSpelling] = useState(false);
    const [hideMeaning, setHideMeaning] = useState(false);

    // Common derived state
    const totalCount = previewQuestions.length;

    // Initial Load
    useEffect(() => {
        if (taskIdParam) {
            loadTask(parseInt(taskIdParam));
        } else if (mode) {
            initTaskFromParams();
        }
    }, [taskIdParam, mode]);

    // Track when feedback changed to prevent immediate dismissal via Enter
    const feedbackTimestampRef = useRef<number>(0);

    // Enter key confirmation for Error Feedback
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (feedback && feedback.type === 'error' && e.code === 'Enter') {
                // Grace period check: Ignore Enter if feedback appeared less than 500ms ago
                if (Date.now() - feedbackTimestampRef.current < 500) {
                    return;
                }

                e.preventDefault(); // Prevent default
                // Trigger the "Confirm & Next" action or "Retry" action
                if (queue.length > 0) {
                    if (feedback.canRetry) {
                        // Retry flow: Clear feedback and input, stay on same word
                        setFeedback(null);
                        setSpellingInput('');
                        document.getElementById('spelling-input')?.focus();
                    } else {
                        // Next flow
                        setFeedback(null);
                        setSpellingInput('');
                        const currentWordId = queue[0].word.id;
                        processNext(currentWordId, false);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [feedback, queue]);

    // Update timestamp when feedback appears
    useEffect(() => {
        if (feedback) {
            feedbackTimestampRef.current = Date.now();
        }
    }, [feedback]); // Rerun when feedback or queue changes loops is fine if we check feedback existence

    // Time Tracking
    useEffect(() => {
        const startTime = Date.now();
        const type = view === 'preview' ? 'LEARN' : 'EXERCISE';

        return () => {
            const duration = Math.floor((Date.now() - startTime) / 1000);
            if (duration > 0) {
                fetch('/api/log-time', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ duration, type }),
                    keepalive: true
                }).catch(e => console.error(e));
            }
        };
    }, [view]);

    const checkMistakes = async (questions: Question[]) => {
        if (questions.length === 0) return;
        const wordIds = questions.map(q => q.word.id);
        try {
            const res = await fetch('/api/mistakes/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordIds })
            });
            const data = await res.json();
            if (data.mistakeStatus) {
                setMistakeStatusMap(data.mistakeStatus);
            }
            if (data.unfamiliarStatus) {
                setUnfamiliarStatusMap(data.unfamiliarStatus);
            }
        } catch (e) {
            console.error('Failed to check mistakes', e);
        }
    };

    const toggleUnfamiliar = async (e: React.MouseEvent, wordId: number) => {
        e.stopPropagation();
        const currentStatus = unfamiliarStatusMap[wordId] || false;

        // Optimistic update
        setUnfamiliarStatusMap(prev => ({ ...prev, [wordId]: !currentStatus }));

        try {
            const res = await fetch('/api/words', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordId, isUnfamiliar: !currentStatus })
            });
            if (!res.ok) throw new Error('Failed to update');
        } catch (err) {
            console.error(err);
            // Revert on error
            setUnfamiliarStatusMap(prev => ({ ...prev, [wordId]: currentStatus }));
        }
    };

    const initTaskFromParams = async () => {
        setLoading(true);
        try {
            // Construct body from searchParams
            const params: any = {};
            searchParams.forEach((value, key) => { params[key] = value; });

            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });

            if (res.status === 401) {
                // Redirect to login if unauthorized (session expired/invalid)
                router.replace('/login');
                return;
            }

            const data = await res.json();

            if (data.task) {
                // Redirect to the same page but with taskId
                // using replace to avoid history stack buildup
                router.replace(`/learn?taskId=${data.task.id}`);
            } else {
                alert('Failed to initialize task: ' + (data.error || 'Unknown error'));
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    }

    const loadTask = async (id: number) => {
        setLoading(true);
        setCurrentTaskId(id);
        try {
            const res = await fetch(`/api/tasks/${id}`);
            const data = await res.json();

            if (data.task) {
                const questions = JSON.parse(data.task.content);
                console.log('[Frontend Debug] Loaded Questions:', questions);
                if (questions.length > 0) {
                    console.log('[Frontend Debug] Sample Word:', questions[0].word);
                }

                const taskProgress = JSON.parse(data.task.progress || '{}');
                const previousMasteredIds = new Set<number>(taskProgress.masteredIds || []);

                setPreviewQuestions(questions);
                setMasteredIds(previousMasteredIds);
                checkMistakes(questions); // Check mistakes

                // Filter out mastered words from the initial queue?
                // Actually, let's just set the preview questions, but startQuiz will handle filtering.
                // Or if we are 'Resuming', maybe we skip preview?
                // Users might want to review the full list even if partially done.
                // Let's stay in preview mode initially.

                // If the task is already marked completed in DB
                if (data.task.status === 'COMPLETED') {
                    setFinished(true);
                }

                setView('preview');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const startQuiz = () => {
        // 1. Filter out mastered words from previewQuestions
        const remaining = previewQuestions.filter(q => !masteredIds.has(q.word.id));

        if (remaining.length === 0) {
            setFinished(true); // Nothing left to do
            return;
        }

        // 2. Randomize
        const shuffled = [...remaining].map(q => ({ ...q, type: 'standard' as const })).sort(() => Math.random() - 0.5);

        // 3. Init Progress
        const initProgress: Record<number, { streak: number, required: number }> = {};
        shuffled.forEach(q => {
            initProgress[q.word.id] = { streak: 0, required: 2 }; // Target 2 consecutive correct
        });

        setQueue(shuffled);
        setProgress(initProgress);
        setFinished(false);
        setView('quiz');
    };

    const startRecitation = () => {
        const remaining = previewQuestions.filter(q => !masteredIds.has(q.word.id));

        if (remaining.length === 0) {
            setFinished(true);
            return;
        }

        // Generate Mixed Questions
        const mixedQueue = remaining.map(q => {
            if (Math.random() > 0.5) {
                // Type 1: Standard (Word -> Meaning)
                return { ...q, type: 'standard' as const };
            } else {
                // Type 2: Reverse (Meaning -> Word)
                const correctMeaning = q.options.find(o => o.isCorrect)?.meaning || 'Definition not found';

                // Pick distractors from OTHER words in the full preview list (to ensure variety)
                const otherWords = previewQuestions.filter(i => i.word.id !== q.word.id);
                // Simple shuffle and take 3
                const distractors = otherWords.sort(() => Math.random() - 0.5).slice(0, 3).map(d => d.word.spelling);

                const options = [
                    { label: q.word.spelling, isCorrect: true },
                    ...distractors.map(d => ({ label: d, isCorrect: false }))
                ].sort(() => Math.random() - 0.5);

                return {
                    ...q,
                    type: 'reverse' as const,
                    reversePrompt: correctMeaning,
                    reverseOptions: options
                };
            }
        }).sort(() => Math.random() - 0.5);

        // Init Progress (reuse logc)
        const initProgress: Record<number, { streak: number, required: number }> = {};
        mixedQueue.forEach(q => {
            initProgress[q.word.id] = { streak: 0, required: 2 };
        });

        setQueue(mixedQueue);
        setProgress(initProgress);
        setFinished(false);
        setView('quiz');
    };

    const startSpelling = () => {
        const remaining = previewQuestions.filter(q => !masteredIds.has(q.word.id));
        if (remaining.length === 0) {
            setFinished(true);
            return;
        }

        // Shuffle
        const shuffled = [...remaining].map(q => ({ ...q, type: 'standard' as const })).sort(() => Math.random() - 0.5);

        // Init Progress
        const initProgress: Record<number, { streak: number, required: number }> = {};
        shuffled.forEach(q => {
            initProgress[q.word.id] = { streak: 0, required: 1 }; // Spelling is harder, maybe 1 is enough? Let's stick to 2 for consistency or 1 as explicit check? Let's use 1 for now or 2? User didn't specify. Let's use 2.
            // Actually, for spelling, often 1 correct entry is good enough proof. Let's set req to 1 for spelling.
            initProgress[q.word.id] = { streak: 0, required: 1 };
        });

        setQueue(shuffled);
        setProgress(initProgress);
        setFinished(false);
        setSpellingInput('');
        setView('spelling');
    };

    const handleAnswer = async (option: Option) => {
        if (feedback) return; // Prevent double clicks

        const currentQ = queue[0];
        const isCorrect = option.isCorrect;
        const wordId = currentQ.word.id;

        // Submit to Backend (Fire and forget)
        fetch('/api/learn/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wordId, isCorrect })
        }).catch(e => console.error(e));

        if (isCorrect) {
            setFeedback({ message: '✅ 正确！', type: 'success' });
            // Fast auto-advance for correct
            setTimeout(() => {
                processNext(wordId, true);
            }, 500);
        } else {
            let correctText = '';
            if (currentQ.type === 'reverse') {
                // For reverse mode, the "meaning" of the option is actually the spelling (label)
                // We want to show the correct spelling.
                // In my render logic, I passed { meaning: label, isCorrect } to handleAnswer
                const correctOpt = currentQ.reverseOptions?.find(o => o.isCorrect);
                correctText = correctOpt?.label || currentQ.word.spelling;
            } else {
                const correctOption = currentQ.options.find(o => o.isCorrect);
                correctText = correctOption?.meaning || 'Unknown';
            }

            setFeedback({ message: `❌ 错误。\n\n正确答案是：\n${correctText}`, type: 'error' });
            // No auto-advance for wrong
        }
    };

    const handleSpellingSubmit = async () => {
        if (feedback) return;
        const currentQ = queue[0];
        const rawTarget = currentQ.word.spelling.trim();
        const cleanTarget = rawTarget.replace(/[^a-zA-Z]/g, '');
        const input = spellingInput.trim();

        // Compare clean input vs clean target
        const isCorrect = input.toLowerCase() === cleanTarget.toLowerCase();
        const wordId = currentQ.word.id;

        // Submit to Backend
        fetch('/api/learn/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wordId,
                isCorrect,
                mistakeType: isCorrect ? null : 'SPELLING'
            })
        }).catch(e => console.error(e));

        if (isCorrect) {
            setFeedback({ message: '✅ 正确！', type: 'success' });
            setTimeout(() => {
                setSpellingInput('');
                processNext(wordId, true);
            }, 1500); // Increased from 500ms
        } else {
            setFeedback({
                message: `❌ 拼写错误。\n\n正确拼写：\n${rawTarget}`,
                type: 'error',
                canRetry: true
            });
            // Add to mistake notebook via backend submit is done above
        }
    };

    const handleSpellingGiveUp = () => {
        if (feedback) return;
        const currentQ = queue[0];
        const targetSpelling = currentQ.word.spelling.trim();
        const wordId = currentQ.word.id;

        // Submit to Backend as incorrect
        fetch('/api/learn/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wordId,
                isCorrect: false,
                mistakeType: 'SPELLING'
            })
        }).catch(e => console.error(e));

        // Show correct answer and allow retry
        setFeedback({
            message: `❌ 正确拼写是：\n\n${targetSpelling}`,
            type: 'error',
            canRetry: true
        });
    };

    const processNext = (wordId: number, isCorrect: boolean) => {
        setFeedback(null);
        const currentQ = queue[0];
        const newQueue = [...queue];
        newQueue.shift(); // Remove current

        const currentProgress = progress[wordId] || { streak: 0, required: 3 };
        const isAlreadyMastered = masteredIds.has(wordId);

        if (isCorrect) {
            const newStreak = currentProgress.streak + 1;

            if (isAlreadyMastered) {
                // Done
            } else if (newStreak >= currentProgress.required) {
                const newMastered = new Set(masteredIds).add(wordId);
                setMasteredIds(newMastered);
                saveTaskProgress(newMastered, false);

                if (newMastered.size >= previewQuestions.length) {
                    setFinished(true);
                    saveTaskProgress(newMastered, true);
                    setQueue([]);
                    return;
                }
            } else {
                const insertAt = Math.min(newQueue.length, Math.floor(Math.random() * 8) + 3);
                const nextQ = { ...currentQ, options: [...currentQ.options].sort(() => Math.random() - 0.5) };
                newQueue.splice(insertAt, 0, nextQ);

                setProgress(prev => ({
                    ...prev,
                    [wordId]: { ...currentProgress, streak: newStreak }
                }));
            }
        } else {
            // Wrong Logic
            if (isAlreadyMastered) {
                const newMastered = new Set(masteredIds);
                newMastered.delete(wordId);
                setMasteredIds(newMastered);
                saveTaskProgress(newMastered, false);
            }

            setProgress(prev => ({
                ...prev,
                [wordId]: { streak: 0, required: 3 }
            }));

            const insertAt = Math.min(newQueue.length, Math.floor(Math.random() * 4) + 2);
            const nextQ = { ...currentQ, options: [...currentQ.options].sort(() => Math.random() - 0.5) };
            newQueue.splice(insertAt, 0, nextQ);
        }

        setQueue(newQueue);

        // Final check
        if (newQueue.length === 0) {
            if (masteredIds.size >= previewQuestions.length) {
                setFinished(true);
                saveTaskProgress(masteredIds, true);
            } else {
                setFinished(true);
            }
        }
    };

    const saveTaskProgress = async (mastered: Set<number>, isCompleted: boolean) => {
        if (!currentTaskId) return;
        try {
            await fetch(`/api/tasks/${currentTaskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    masteredIds: Array.from(mastered),
                    isCompleted
                })
            });
        } catch (e) { console.error('Failed to save progress', e); }
    };

    const toggleLearned = (id: number) => {
        const newLearned = new Set(learnedWords);
        if (newLearned.has(id)) newLearned.delete(id);
        else newLearned.add(id);
        setLearnedWords(newLearned);
    };

    if (loading) return <div className="p-10 text-center">Loading task...</div>;

    if (finished) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#e1e2e7]">
                <h2 className="text-3xl font-bold mb-6 text-[#33635c]">Session Complete!</h2>
                <p className="mb-6 text-[#565f89]">You have mastered {masteredIds.size} words.</p>
                <div className="flex gap-4">
                    <button
                        onClick={() => { setView('preview'); setFinished(false); }}
                        className="bg-[#565f89] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#4a5277]"
                    >
                        Review List
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="bg-[#34548a] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#2a4470]"
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }


    if (previewQuestions.length === 0 && view === 'preview') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#e1e2e7]">
                <h2 className="text-2xl font-bold mb-6 text-[#343b58]">No words found.</h2>
                <button
                    onClick={() => router.push('/')}
                    className="bg-[#34548a] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#2a4470]"
                >
                    Return Home
                </button>
            </div>
        );
    }

    // PREVIEW MODE
    if (view === 'preview') {
        const remainingCount = previewQuestions.length - masteredIds.size;
        return (
            <div className="min-h-screen bg-[#d1d5db] p-4 md:p-8 flex flex-col items-center">
                <div className="max-w-6xl w-full">
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={() => router.push('/')} className="text-[#565f89] hover:text-[#343b58]">
                            ← Back
                        </button>
                        <h1 className="text-2xl font-bold text-[#343b58]">Word Preview ({previewQuestions.length})</h1>
                        {remainingCount > 0 ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={startQuiz}
                                    className="bg-[#34548a] hover:bg-[#2a4470] text-white px-6 py-2 rounded-lg font-bold shadow-lg transition transform hover:scale-105"
                                >
                                    Start Quiz ({remainingCount} left) →
                                </button>
                                <button
                                    onClick={startRecitation}
                                    className="bg-[#5a4a78] hover:bg-[#483b60] text-white px-6 py-2 rounded-lg font-bold shadow-lg transition transform hover:scale-105"
                                >
                                    Start Recitation 🧠
                                </button>
                                <button
                                    onClick={startSpelling}
                                    className="bg-[#33635c] hover:bg-[#264a44] text-white px-6 py-2 rounded-lg font-bold shadow-lg transition transform hover:scale-105"
                                >
                                    Start Spelling ✍️
                                </button>
                            </div>
                        ) : (
                            <span className="text-[#33635c] font-bold">All Mastered!</span>
                        )}
                    </div>

                    <div className="bg-[#f2f3f5] rounded-2xl shadow-lg p-6 mb-6 sticky top-4 z-10 border border-[#c0caf5]">
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => setHideSpelling(!hideSpelling)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${hideSpelling ? 'bg-[#eec49f] text-[#8f5e15]' : 'bg-[#e1e2e7] text-[#565f89] hover:bg-[#d5d6db]'}`}
                            >
                                {hideSpelling ? '👁️ Show Spelling' : '🙈 Hide Spelling'}
                            </button>
                            <button
                                onClick={() => setHideMeaning(!hideMeaning)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${hideMeaning ? 'bg-[#eec49f] text-[#8f5e15]' : 'bg-[#e1e2e7] text-[#565f89] hover:bg-[#d5d6db]'}`}
                            >
                                {hideMeaning ? '👁️ Show Meaning' : '🙈 Hide Meaning'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4 pb-20">
                        {previewQuestions.map((q, idx) => {
                            const isLearned = learnedWords.has(q.word.id); // For aesthetic toggle only
                            const isMastered = masteredIds.has(q.word.id);
                            const mistakeStatus = mistakeStatusMap[q.word.id]; // 'resolved' | 'unresolved' | undefined
                            const correctOption = q.options.find(o => o.isCorrect);

                            // Alternating gray backgrounds (Odd/Even) for eye comfort
                            const cardBg = isMastered ? 'bg-[#e9f5f4]' : isLearned ? 'bg-[#eef1f8]' : (idx % 2 === 0 ? 'bg-[#f2f3f5]' : 'bg-[#e3e5e8]');

                            return (
                                <div
                                    key={q.word.id}
                                    className={`${cardBg} rounded-xl p-4 shadow-sm border transition-all ${isMastered ? 'border-[#33635c] opacity-80' :
                                        isLearned ? 'border-[#34548a] opacity-90' : 'border-[#cfc9c2] hover:shadow-md'
                                        }`}
                                >
                                    <div className={`flex-grow grid grid-cols-1 ${q.word.displayMode === 2 ? 'grid-cols-1' : 'md:grid-cols-2'} gap-4 items-center`}>
                                        <div className="flex flex-col">
                                            <div className="flex items-center w-full">
                                                <span className="text-[#9aa5ce] font-mono mr-4 w-14 text-right text-lg shrink-0">#{q.word.orderIndex || idx + 1}</span>
                                                <div className="flex flex-col mr-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xl font-bold ${hideSpelling && !isMastered && !isLearned ? 'blur-md select-none' : 'text-[#343b58]'}`}>
                                                            {q.word.spelling}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const utterance = new SpeechSynthesisUtterance(q.word.spelling);
                                                                utterance.lang = 'en-US';
                                                                window.speechSynthesis.speak(utterance);
                                                            }}
                                                            className="text-[#94a3b8] hover:text-[#34548a] transition-colors p-1.5 rounded-full hover:bg-black/5"
                                                            title="Play Pronunciation"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                                                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                                                                <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    {q.word.phonetic && (
                                                        <span className="text-[#565f89] text-sm mt-1 font-mono">
                                                            {q.word.phonetic}
                                                        </span>
                                                    )}
                                                    {mistakeStatus === 'unresolved' && (
                                                        <span className="text-xs bg-[#f4dbd6] text-[#8c4351] px-2 py-0.5 rounded-full w-fit mt-1 font-bold">
                                                            Mistake (Unresolved)
                                                        </span>
                                                    )}
                                                    {mistakeStatus === 'resolved' && (
                                                        <span className="text-xs bg-[#e9f5f4] text-[#33635c] px-2 py-0.5 rounded-full w-fit mt-1 font-bold">
                                                            Mistake (Mastered)
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-2 items-end ml-auto shrink-0">
                                                    <button
                                                        onClick={(e) => toggleLearned(q.word.id)}
                                                        className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors shadow-sm ${isLearned
                                                            ? 'bg-[#eef1f8] text-[#34548a] border-[#34548a] hover:bg-[#d0d8e8]'
                                                            : 'bg-white text-[#565f89] border-[#cfc9c2] hover:border-[#343b58] hover:text-[#343b58] hover:bg-[#f1f5f9]'
                                                            }`}
                                                    >
                                                        {isLearned ? '✓ Known' : 'Mark Known'}
                                                    </button>
                                                    <button
                                                        onClick={(e) => toggleUnfamiliar(e, q.word.id)}
                                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${unfamiliarStatusMap[q.word.id]
                                                            ? 'bg-[#fff2cd] text-[#b45309] hover:bg-[#ffebb0]'
                                                            : 'bg-transparent text-[#9aa5ce] hover:text-[#b45309] hover:bg-[#fff2cd]'
                                                            }`}
                                                        title={unfamiliarStatusMap[q.word.id] ? "Marked as unfamiliar" : "Mark as unfamiliar"}
                                                    >
                                                        {unfamiliarStatusMap[q.word.id] ? '★ Unfamiliar' : '☆ Unfamiliar'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Meaning for Rich Content Mode (Book ID 3) - Moved here for full width layout */}
                                            {q.word.displayMode === 2 && (
                                                <div className={`mt-6 px-5 py-4 border-l-4 border-[#8c4351] bg-[#fffcfb] rounded-r-lg shadow-sm ${hideMeaning && !isMastered && !isLearned ? 'blur-md select-none' : ''}`}>
                                                    <span className="block text-xs font-bold text-[#94a3b8] mb-1 uppercase tracking-wider">Meaning (基本释义)</span>
                                                    <div className="text-[#334155] text-xl font-medium leading-relaxed">
                                                        <FormattedMeaning
                                                            text={q.word.meaning || correctOption?.meaning || ''}
                                                            spelling={q.word.spelling}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Expanded Info */}
                                            {/* Expanded Info - Conditional Layout */}
                                            {(!hideMeaning || isMastered || isLearned) && (
                                                <>
                                                    {/* NEW STYLE for GPT-8000 (ID 3) */}
                                                    {q.word.displayMode === 2 ? (
                                                        <div className="mt-8 ml-0 space-y-8">

                                                            {/* Section B: Etymology & Depth */}
                                                            {(q.word.roots || q.word.affixes || q.word.history) && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    {q.word.roots && (
                                                                        <div className="relative bg-white pt-6 pb-4 px-5 rounded-xl border border-[#cbd5e1] hover:border-[#94a3b8] transition-colors">
                                                                            <div className="absolute -top-3 left-4 bg-[#64748b] text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-sm tracking-wide">
                                                                                🌳 词根 (Root)
                                                                            </div>
                                                                            <p className="text-[#475569] text-base leading-relaxed font-sans">{q.word.roots}</p>
                                                                        </div>
                                                                    )}
                                                                    {q.word.affixes && (
                                                                        <div className="relative bg-[#f5f2f0] p-4 rounded-lg border border-[#cfc9c2]">
                                                                            <div className="absolute -top-3 left-3 bg-[#33635c] text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm">
                                                                                🧩 词缀 (Affixes)
                                                                            </div>
                                                                            <p className="mt-2 text-[#565f89] text-sm leading-relaxed">{q.word.affixes}</p>
                                                                        </div>
                                                                    )}
                                                                    {q.word.history && (
                                                                        <div className="col-span-1 md:col-span-2 relative bg-[#f2f3f5] p-4 rounded-lg border border-[#cfc9c2] italic">
                                                                            <div className="absolute -top-3 left-3 bg-[#565f89] text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm">
                                                                                📜 历史与文化 (History)
                                                                            </div>
                                                                            <p className="mt-2 text-[#565f89] text-sm leading-relaxed not-italic">{q.word.history}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Section C: Memory Aids */}
                                                            {(q.word.mnemonic || q.word.story) && (
                                                                <div className="grid grid-cols-1 gap-6">
                                                                    {q.word.mnemonic && (
                                                                        <div className="relative bg-[#f0fdf4] pt-6 pb-4 px-5 rounded-xl border border-[#bbf7d0] shadow-sm">
                                                                            <div className="absolute -top-3 left-4 bg-[#15803d] text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-sm tracking-wide">
                                                                                💡 记忆辅助 (Mnemonic)
                                                                            </div>
                                                                            <p className="text-[#166534] text-base leading-relaxed font-medium">{q.word.mnemonic}</p>
                                                                        </div>
                                                                    )}
                                                                    {q.word.story && (
                                                                        <div className="relative bg-[#eff6ff] pt-6 pb-4 px-5 rounded-xl border border-[#bfdbfe] shadow-sm">
                                                                            <div className="absolute -top-3 left-4 bg-[#1d4ed8] text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-sm tracking-wide">
                                                                                📖 小故事 (Story)
                                                                            </div>
                                                                            <p className="text-[#1e40af] text-base leading-relaxed italic">"{q.word.story}"</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Section D: Practical Usage */}
                                                            <div className="space-y-6 pt-6 border-t border-[#cbd5e1] mt-2">
                                                                {q.word.variations && (
                                                                    <div className="relative bg-white pt-6 pb-4 px-5 rounded-xl border border-[#cbd5e1] hover:border-[#94a3b8] transition-colors">
                                                                        <div className="absolute -top-3 left-4 bg-[#475569] text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-sm tracking-wide">
                                                                            🔄 变形 (Variations)
                                                                        </div>
                                                                        <p className="text-[#475569] text-base leading-relaxed font-sans">{q.word.variations}</p>
                                                                    </div>
                                                                )}
                                                                {q.word.grammar && (
                                                                    <div className="relative bg-white pt-6 pb-4 px-5 rounded-xl border border-[#cbd5e1] hover:border-[#94a3b8] transition-colors">
                                                                        <div className="absolute -top-3 left-4 bg-[#334155] text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-sm tracking-wide">
                                                                            ⚖️ 常用语法 (Grammar)
                                                                        </div>
                                                                        <p className="text-[#475569] text-base leading-relaxed font-sans">{q.word.grammar}</p>
                                                                    </div>
                                                                )}
                                                                {q.word.example && (
                                                                    <div className="relative bg-[#f8fafc] pt-7 pb-5 px-5 rounded-xl border border-[#cbd5e1] shadow-sm">
                                                                        <div className="absolute -top-3 left-4 bg-[#3b82f6] text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-sm tracking-wide">
                                                                            🗣️ 例句 (Examples)
                                                                        </div>
                                                                        <div className="text-[#334155] space-y-3">
                                                                            {q.word.example.match(/\d+\./)
                                                                                ? q.word.example.split(/(?=\d+\.)/).map((line, i) => (
                                                                                    line.trim() && (
                                                                                        <div key={i} className="leading-relaxed pl-2 border-l-2 border-[#bfdbfe]">
                                                                                            {line.trim()}
                                                                                        </div>
                                                                                    )
                                                                                ))
                                                                                : <p className="leading-relaxed">{q.word.example}</p>
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* OLD STYLE (Preserved for other books) */
                                                        <div className="mt-6 space-y-6">
                                                            {/* Simplified view for standard words with upgraded UI */}
                                                            {q.word.roots && (
                                                                <div className="relative bg-[#f1f5f9] pt-6 pb-4 px-5 rounded-xl border border-[#cbd5e1] shadow-sm">
                                                                    <div className="absolute -top-3 left-4 bg-[#64748b] text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-sm tracking-wide">
                                                                        🌱 词根 analysis
                                                                    </div>
                                                                    <p className="text-[#475569] text-base leading-relaxed font-sans">{q.word.roots}</p>
                                                                </div>
                                                            )}
                                                            {q.word.grammar && (
                                                                <div className="relative bg-white pt-6 pb-4 px-5 rounded-xl border border-[#cbd5e1] hover:border-[#94a3b8] transition-colors">
                                                                    <div className="absolute -top-3 left-4 bg-[#334155] text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-sm tracking-wide">
                                                                        ⚖️ 常用语法 (Grammar)
                                                                    </div>
                                                                    <ul className="list-disc list-inside text-[#475569] text-base leading-relaxed font-sans">
                                                                        {q.word.grammar.split(/,|，/).map((item, i) => (
                                                                            <li key={i}>{item.trim()}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {q.word.example && (
                                                                <div className="relative bg-[#f8fafc] pt-7 pb-5 px-5 rounded-xl border border-[#cbd5e1] shadow-sm">
                                                                    <div className="absolute -top-3 left-4 bg-[#3b82f6] text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-sm tracking-wide">
                                                                        🗣️ 例句 (Examples)
                                                                    </div>
                                                                    <div className="text-[#334155] space-y-3">
                                                                        {/* Try splitter logic on standard words too */}
                                                                        {q.word.example.match(/\d+\./)
                                                                            ? q.word.example.split(/(?=\d+\.)/).map((line, i) => (
                                                                                line.trim() && (
                                                                                    <div key={i} className="leading-relaxed pl-2 border-l-2 border-[#bfdbfe]">
                                                                                        {line.trim()}
                                                                                    </div>
                                                                                )
                                                                            ))
                                                                            : <p className="leading-relaxed italic">"{q.word.example}"</p>
                                                                        }
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <div className={`text-[#565f89] ${hideMeaning && !isMastered && !isLearned ? 'blur-md select-none' : ''}`}>
                                            {/* Fix: Use FormattedMeaning for simple view as well */}
                                            {q.word.displayMode !== 2 && (
                                                <FormattedMeaning
                                                    text={correctOption?.meaning || ''}
                                                    spelling={q.word.spelling}
                                                />
                                            )}
                                        </div>
                                    </div>

                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-center mt-6 pb-20">
                        {remainingCount > 0 ? (
                            <div className="flex gap-4">
                                <button
                                    onClick={startQuiz}
                                    className="bg-[#34548a] hover:bg-[#2a4470] text-white px-8 py-3 rounded-lg font-bold shadow-lg transition transform hover:scale-105 text-lg"
                                >
                                    Start Quiz ({remainingCount} left) →
                                </button>
                                <button
                                    onClick={startRecitation}
                                    className="bg-[#5a4a78] hover:bg-[#483b60] text-white px-8 py-3 rounded-lg font-bold shadow-lg transition transform hover:scale-105 text-lg"
                                >
                                    Start Recitation 🧠
                                </button>
                            </div>
                        ) : (
                            <span className="text-[#33635c] font-bold text-lg">All Mastered!</span>
                        )}
                    </div>
                </div>
            </div >
        );
    }

    // SPELLING MODE
    if (view === 'spelling' && queue.length > 0) {
        const currentQ = queue[0];
        const correctOption = currentQ.options.find(o => o.isCorrect);
        const meaning = correctOption?.meaning || currentQ.word.meaning || '';
        const rawTarget = currentQ.word.spelling.trim();
        const cleanTarget = rawTarget.replace(/[^a-zA-Z]/g, ''); // Only letters required

        return (
            <div className="min-h-screen bg-[#e1e2e7] flex flex-col items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-[#f2f3f5] rounded-3xl shadow-xl p-8 relative overflow-hidden border border-[#c0caf5]">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8 relative z-10">
                        <span className="text-[#565f89] font-bold text-sm tracking-wider">
                            SPELLING CHECK ({masteredIds.size} / {totalCount})
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setView('preview'); setQueue([]); }}
                                className="text-[#94a3b8] hover:text-[#565f89]"
                            >
                                Quit
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col items-center gap-8">
                        {/* 1. Meaning Display */}
                        <div className="text-center">
                            <h2 className="text-[#343b58] text-2xl font-bold mb-2">Based on the meaning:</h2>
                            <div className="text-[#33635c] text-xl font-medium p-4 bg-[#e9f5f4] rounded-xl border border-[#33635c]/20">
                                <FormattedMeaning text={meaning} spelling="" />
                            </div>
                        </div>

                        {/* 2. Spelling Boxes */}
                        <div className="flex flex-wrap gap-2 justify-center my-4" onClick={() => document.getElementById('spelling-input')?.focus()}>
                            {(() => {
                                let letterIdx = 0;
                                return rawTarget.split('').map((char, idx) => {
                                    if (/[^a-zA-Z]/.test(char)) {
                                        // Non-letter separator
                                        return (
                                            <div key={idx} className="w-12 h-14 flex items-center justify-center text-2xl font-bold text-[#565f89] select-none">
                                                {char}
                                            </div>
                                        );
                                    }

                                    const inputChar = spellingInput[letterIdx] || '';
                                    const isFilled = !!inputChar;
                                    const currentIdx = letterIdx; // capture for closure if needed, though simple map is fine
                                    letterIdx++;

                                    return (
                                        <div
                                            key={idx}
                                            className={`w-12 h-14 flex items-center justify-center text-2xl font-mono font-bold rounded-lg border-2 transition-all
                                                ${isFilled
                                                    ? 'bg-white border-[#34548a] text-[#343b58] shadow-md transform -translate-y-1'
                                                    : 'bg-gray-100 border-gray-300 text-transparent'
                                                }
                                            `}
                                        >
                                            {inputChar}
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Hidden Input for Keyboard capture */}
                        <input
                            id="spelling-input"
                            type="text"
                            className="opacity-0 absolute top-0 left-0 w-full h-full cursor-default"
                            value={spellingInput}
                            autoFocus
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            onChange={(e) => {
                                if (feedback) return; // Locked during feedback
                                const val = e.target.value;
                                // Only allow letters, max length = cleanTarget length
                                if (val.length <= cleanTarget.length && /^[a-zA-Z]*$/.test(val)) {
                                    setSpellingInput(val);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSpellingSubmit();
                                } else if (e.key === '?') {
                                    e.preventDefault();
                                    handleSpellingGiveUp();
                                }
                            }}
                        />

                        {/* Feedback Overlay */}
                        {feedback && (
                            <div className={`absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-50 rounded-3xl animate-fadeIn`}>
                                <div className={`bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center transform transition-all scale-100`}>
                                    <div className="text-4xl mb-4">{feedback.type === 'success' ? '🎉' : '🤔'}</div>
                                    <h3 className={`text-xl font-bold mb-2 ${feedback.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                                        {feedback.type === 'success' ? 'Correct!' : 'Incorrect'}
                                    </h3>
                                    <p className="whitespace-pre-wrap text-gray-600 mb-6">{feedback.message.replace('✅ 正确！', '').replace('❌ 错误。\n\n', '').replace('❌ 拼写错误。\n\n', '')}</p>

                                    {feedback.type === 'error' && (
                                        <button
                                            onClick={() => {
                                                if (feedback.canRetry) {
                                                    setFeedback(null);
                                                    setSpellingInput('');
                                                    document.getElementById('spelling-input')?.focus();
                                                } else {
                                                    setFeedback(null);
                                                    setSpellingInput('');
                                                    const currentQ = queue[0];
                                                    processNext(currentQ.word.id, false);
                                                }
                                            }}
                                            className="bg-[#34548a] text-white px-6 py-2 rounded-lg hover:bg-[#2a4470] w-full font-bold"
                                        >
                                            {feedback.canRetry ? 'Practice (Retry)' : 'Confirm & Next →'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Instructions & Actions */}
                        <div className="flex flex-col items-center gap-4 mt-4 relative z-10">
                            <p className="text-[#9aa5ce] text-sm">
                                Type letters only.
                            </p>
                            <button
                                onClick={handleSpellingGiveUp}
                                className="text-[#34548a] font-bold py-2 px-4 rounded-lg hover:bg-[#34548a]/10 transition text-sm flex items-center gap-2"
                                title="Press '?' to give up"
                            >
                                🤷 I don't know <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded text-gray-500 font-mono">?</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Auto-check effect for spelling
    useEffect(() => {
        if (view === 'spelling' && queue.length > 0 && !feedback) {
            const rawTarget = queue[0].word.spelling.trim();
            const cleanTarget = rawTarget.replace(/[^a-zA-Z]/g, '');

            if (spellingInput.length === cleanTarget.length) {
                // Determine correctness immediately
                const isCorrect = spellingInput.toLowerCase() === cleanTarget.toLowerCase();

                // Small delay to let the user see the last letter typed
                const timer = setTimeout(() => {
                    // Call the submit logic
                    // We need to duplicate the logic of handleSpellingSubmit here because handleSpellingSubmit relies on state 'spellingInput'
                    // which matches 'spellingInput' dependency here.

                    const currentQ = queue[0];
                    const wordId = currentQ.word.id;

                    fetch('/api/learn/submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            wordId,
                            isCorrect,
                            mistakeType: isCorrect ? null : 'SPELLING'
                        })
                    }).catch(e => console.error(e));

                    if (isCorrect) {
                        setFeedback({ message: '✅ 正确！', type: 'success' });
                        setTimeout(() => {
                            setSpellingInput('');
                            processNext(wordId, true);
                        }, 1500);
                    } else {
                        setFeedback({
                            message: `❌ 拼写错误。\n\n正确拼写：\n${rawTarget}`,
                            type: 'error',
                            canRetry: true
                        });
                    }

                }, 300);

                return () => clearTimeout(timer);
            }
        }
    }, [spellingInput, view, queue, feedback]);


    // QUIZ MODE
    if (queue.length === 0) return <div>Loading next card...</div>; // Should trigger finished if empty

    const currentQ = queue[0];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#e1e2e7] p-4">
            <div className="bg-[#f2f3f5] p-8 rounded-2xl shadow-xl w-full max-w-2xl border border-[#c0caf5] relative">
                <div className="flex justify-between items-center text-sm text-[#9aa5ce] mb-4 min-h-[32px]">
                    <div className="flex gap-4">
                        <span>Active Queue: {queue.length}</span>
                        <span>Mastered: {masteredIds.size} / {totalCount}</span>
                    </div>

                    {/* Unfamiliar Toggle */}
                    <button
                        onClick={(e) => toggleUnfamiliar(e, currentQ.word.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${unfamiliarStatusMap[currentQ.word.id]
                            ? 'bg-[#fff2cd] text-[#b45309] hover:bg-[#ffebb0]'
                            : 'bg-white/50 text-[#9aa5ce] hover:text-[#b45309] hover:bg-[#fff2cd] border border-transparent hover:border-[#b45309]/20'
                            }`}
                        title={unfamiliarStatusMap[currentQ.word.id] ? "Marked as unfamiliar" : "Mark as unfamiliar"}
                    >
                        <span className="text-lg leading-none pb-0.5">{unfamiliarStatusMap[currentQ.word.id] ? '★' : '☆'}</span>
                        <span>Unfamiliar</span>
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#d5d6db] rounded-full h-2 mb-8">
                    <div
                        className="bg-[#33635c] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(masteredIds.size / totalCount) * 100}%` }}
                    />
                </div>

                <div className="text-center mb-10">
                    <h1 className="text-5xl font-bold text-[#343b58] mt-4">
                        {currentQ.type === 'reverse' ? currentQ.reversePrompt : currentQ.word.spelling}
                    </h1>
                    {currentQ.type !== 'reverse' && currentQ.word.phonetic && (
                        <div className="text-[#565f89] text-xl mt-2 font-mono">{currentQ.word.phonetic}</div>
                    )}
                </div>

                {feedback ? (
                    <div className={`p-6 rounded-xl text-center mb-6 flex flex-col items-center gap-4 ${feedback.type === 'success' ? 'bg-[#e9f5f4] text-[#33635c]' : 'bg-[#f4dbd6] text-[#8c4351]'
                        }`}>
                        <div className="text-xl font-bold whitespace-pre-wrap">{feedback.message}</div>

                        {feedback.type === 'error' && (
                            <button
                                onClick={() => processNext(currentQ.word.id, false)}
                                className="mt-4 bg-[#8c4351] text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-[#723642] transition-colors w-full md:w-auto"
                                autoFocus
                            >
                                Continue →
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {currentQ.type === 'reverse' ? (
                            // REVERSE MODE OPTIONS (Spellings)
                            currentQ.reverseOptions?.map((option, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer({ meaning: option.label, isCorrect: option.isCorrect })}
                                    className="text-left p-4 rounded-xl border border-[#cfc9c2] hover:bg-[#eef1f8] hover:border-[#34548a] transition-all text-lg font-medium text-[#343b58]"
                                >
                                    <span className="font-bold mr-3 text-[#34548a]">{String.fromCharCode(65 + idx)}.</span>
                                    {option.label}
                                </button>
                            ))
                        ) : (
                            // STANDARD MODE OPTIONS (Meanings)
                            currentQ.options.map((option, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(option)}
                                    className="text-left p-4 rounded-xl border border-[#cfc9c2] hover:bg-[#eef1f8] hover:border-[#34548a] transition-all text-lg font-medium text-[#343b58]"
                                >
                                    <span className="font-bold mr-3 text-[#34548a]">{String.fromCharCode(65 + idx)}.</span>
                                    {option.meaning}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            <button
                onClick={() => setView('preview')}
                className="mt-8 text-[#565f89] hover:text-[#343b58]"
            >
                Pause & Check List
            </button>
        </div>
    );
}

export default function LearnPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <QuizContent />
        </Suspense>
    );
}
