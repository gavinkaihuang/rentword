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
    };
    options: Option[];
    // For reverse mode override
    reversePrompt?: string;
    reverseOptions?: { label: string; isCorrect: boolean }[];
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
    const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [finished, setFinished] = useState(false);

    const [view, setView] = useState<'preview' | 'quiz'>('preview');
    const [learnedWords, setLearnedWords] = useState<Set<number>>(new Set());
    const [mistakeStatusMap, setMistakeStatusMap] = useState<Record<number, 'resolved' | 'unresolved'>>({});

    const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
    const [hideSpelling, setHideSpelling] = useState(false);
    const [hideMeaning, setHideMeaning] = useState(false);

    // Initial Load
    useEffect(() => {
        if (taskIdParam) {
            loadTask(parseInt(taskIdParam));
        } else if (mode) {
            initTaskFromParams();
        }
    }, [taskIdParam, mode]);

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
        } catch (e) {
            console.error('Failed to check mistakes', e);
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
            <div className="min-h-screen bg-[#e1e2e7] p-4 md:p-8 flex flex-col items-center">
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

                            return (
                                <div
                                    key={q.word.id}
                                    className={`bg-[#d5d6db] rounded-xl p-4 shadow-sm border transition-all ${isMastered ? 'border-[#33635c] bg-[#e9f5f4] opacity-80' :
                                        isLearned ? 'border-[#34548a] bg-[#eef1f8] opacity-90' : 'border-[#cfc9c2] hover:shadow-md'
                                        }`}
                                >
                                    <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                        <div className="flex flex-col">
                                            <div className="flex items-center">
                                                <span className="text-[#9aa5ce] font-mono mr-6 w-12 text-right text-lg">#{q.word.orderIndex || idx + 1}</span>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-xl font-bold ${hideSpelling && !isMastered && !isLearned ? 'blur-md select-none' : 'text-[#343b58]'}`}>
                                                            {q.word.spelling}
                                                        </span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleLearned(q.word.id); }}
                                                            className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors ${isLearned
                                                                ? 'bg-[#eef1f8] text-[#34548a] border-[#34548a] hover:bg-[#d0d8e8]'
                                                                : 'bg-[#d5d6db] text-[#565f89] border-[#cfc9c2] hover:border-[#343b58] hover:text-[#343b58]'
                                                                }`}
                                                        >
                                                            {isLearned ? '✓ Licensed' : 'Mark Known'}
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
                                            </div>

                                            {/* Expanded Info */}
                                            {(q.word.grammar || q.word.example) && (!hideMeaning || isMastered || isLearned) && (
                                                <div className="mt-3 ml-16 text-sm text-[#565f89] space-y-2">
                                                    {q.word.grammar && (
                                                        <div className="bg-[#e1e2e7] p-2 rounded">
                                                            <span className="font-bold text-[#343b58] block text-xs uppercase mb-1">Common Grammar</span>
                                                            <ul className="list-disc list-inside">
                                                                {q.word.grammar.split(/,|，/).map((item, i) => (
                                                                    <li key={i} className="text-[#565f89]">{item.trim()}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {q.word.example && (
                                                        <div className="bg-[#e1e2e7] p-2 rounded italic border-l-2 border-[#34548a]">
                                                            {q.word.example}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className={`text-[#565f89] ${hideMeaning && !isMastered && !isLearned ? 'blur-md select-none' : ''}`}>
                                            {correctOption?.meaning}
                                        </div>
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // QUIZ MODE
    if (queue.length === 0) return <div>Loading next card...</div>; // Should trigger finished if empty

    const currentQ = queue[0];
    const totalCount = previewQuestions.length; // Approximate total

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#e1e2e7] p-4">
            <div className="bg-[#f2f3f5] p-8 rounded-2xl shadow-xl w-full max-w-2xl border border-[#c0caf5]">
                <div className="flex justify-between text-sm text-[#9aa5ce] mb-4">
                    <span>Active Queue: {queue.length}</span>
                    <span>Mastered: {masteredIds.size} / {totalCount}</span>
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
