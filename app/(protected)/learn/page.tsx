'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface Option {
    meaning: string;
    isCorrect: boolean;
}

interface Question {
    word: {
        id: number;
        spelling: string;
    };
    options: Option[];
}

function QuizContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const mode = searchParams.get('mode');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

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
    const [hideSpelling, setHideSpelling] = useState(false);
    const [hideMeaning, setHideMeaning] = useState(false);
    const [learnedWords, setLearnedWords] = useState<Set<number>>(new Set());

    useEffect(() => {
        fetchQuestions();
    }, [mode, from, to]);

    const fetchQuestions = async () => {
        setLoading(true);
        let url = '';
        if (mode === '1') {
            const limit = searchParams.get('limit') || '20';
            url = `/api/learn/mode1?from=${from}&to=${to}&limit=${limit}`;
        }
        else if (mode === '2') url = `/api/learn/mode2`;
        else if (mode === '3') url = `/api/learn/mode3?limit=20`;
        else if (mode === '4') {
            const date = searchParams.get('date');
            if (date) url = `/api/learn/mode4?date=${date}`;
        }
        else if (mode === '5') {
            const ids = searchParams.get('ids');
            if (ids) url = `/api/learn/mode5?ids=${ids}`;
        }
        else if (mode === '6') {
            const ids = searchParams.get('ids');
            if (ids) url = `/api/learn/mode6?ids=${ids}`;
        }

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.questions && data.questions.length > 0) {
                setPreviewQuestions(data.questions);
                // Initialize queue immediately or wait for Start?
                // Preview uses previewQuestions.
                setView('preview');
            } else {
                setPreviewQuestions([]);
                setFinished(true); // No questions found
            }
        } catch (e) {
            console.error(e);
            alert('Failed to load questions');
        } finally {
            setLoading(false);
        }
    };

    const startQuiz = () => {
        // 1. Randomize
        const shuffled = [...previewQuestions].sort(() => Math.random() - 0.5);

        // 2. Init Progress
        const initProgress: Record<number, { streak: number, required: number }> = {};
        shuffled.forEach(q => {
            initProgress[q.word.id] = { streak: 0, required: 2 }; // Target 2 consecutive correct
        });

        setQueue(shuffled);
        setProgress(initProgress);
        setMasteredIds(new Set());
        setFinished(false);
        setView('quiz');
    };

    const handleAnswer = async (option: Option) => {
        const currentQ = queue[0];
        const isCorrect = option.isCorrect;
        const wordId = currentQ.word.id;

        // Feedback
        if (isCorrect) {
            setFeedback({ message: '✅ 正确！', type: 'success' });
        } else {
            const correctMeaning = currentQ.options.find(o => o.isCorrect)?.meaning;
            setFeedback({ message: `❌ 错误。正确意是：${correctMeaning}`, type: 'error' });
        }

        // Submit to Backend (SRS stats)
        try {
            await fetch('/api/learn/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordId, isCorrect })
            });
        } catch (e) { console.error(e); }

        // Algorithm Logic
        setTimeout(() => {
            setFeedback(null);

            const newQueue = [...queue];
            newQueue.shift(); // Remove current

            const currentProgress = progress[wordId] || { streak: 0, required: 3 };
            const isAlreadyMastered = masteredIds.has(wordId);

            if (isCorrect) {
                const newStreak = currentProgress.streak + 1;

                // Check Mastery
                if (isAlreadyMastered) {
                    // Filler maintenance: Keep mastered (do nothing), or reduce probability?
                    // Just let it disappear from queue (already shifted).
                } else if (newStreak >= currentProgress.required) {
                    // Just Mastered!
                    setMasteredIds(prev => new Set(prev).add(wordId));

                    // Check if all words are mastered
                    // If this was the last unmastered word, finish immediately
                    const isNewMastery = !masteredIds.has(wordId);
                    if (isNewMastery && (masteredIds.size + 1 >= previewQuestions.length)) {
                        setFinished(true);
                        // Clear queue to ensure consistency if we return early
                        setQueue([]);
                        return;
                    }
                } else {
                    // Not mastered yet, Schedule recurrence
                    // Random insert 3-10 positions ahead
                    const insertAt = Math.min(newQueue.length, Math.floor(Math.random() * 8) + 3);
                    // Shuffle options before re-inserting
                    const nextQ = { ...currentQ, options: [...currentQ.options].sort(() => Math.random() - 0.5) };

                    newQueue.splice(insertAt, 0, nextQ);

                    // Update Streak
                    setProgress(prev => ({
                        ...prev,
                        [wordId]: { ...currentProgress, streak: newStreak }
                    }));
                }
            } else {
                // Wrong
                // If it was mastered (filler failure), un-master it!
                if (isAlreadyMastered) {
                    setMasteredIds(prev => {
                        const s = new Set(prev);
                        s.delete(wordId);
                        return s;
                    });
                }

                // Reset streak, Set required to 3 (harder)
                setProgress(prev => ({
                    ...prev,
                    [wordId]: { streak: 0, required: 3 }
                }));

                // Re-insert soon (2-5 positions) WITH Shuffled Options
                const insertAt = Math.min(newQueue.length, Math.floor(Math.random() * 4) + 2);
                const nextQ = { ...currentQ, options: [...currentQ.options].sort(() => Math.random() - 0.5) };

                newQueue.splice(insertAt, 0, nextQ);
            }

            // Filler Logic
            const masteredList = previewQuestions.filter(q => masteredIds.has(q.word.id));

            // If queue is short (last few words) AND we have mastered words involved
            // AND we have pending difficult words (implied by queue length > 0)
            if (newQueue.length > 0 && newQueue.length <= 2 && masteredList.length >= 5) {
                // Determine if we should inject a filler to reduce frustration
                const randomMastered = masteredList[Math.floor(Math.random() * masteredList.length)];
                if (randomMastered) {
                    // Randomize options for filler
                    const fillerQ = { ...randomMastered, options: [...randomMastered.options].sort(() => Math.random() - 0.5) };

                    // Insert at position 1
                    const fillerPos = Math.min(newQueue.length, 1);
                    newQueue.splice(fillerPos, 0, fillerQ);
                }
            }

            setQueue(newQueue);

            if (newQueue.length === 0) {
                setFinished(true);
            }

        }, 1500);
    };

    const toggleLearned = (id: number) => {
        const newLearned = new Set(learnedWords);
        if (newLearned.has(id)) newLearned.delete(id);
        else newLearned.add(id);
        setLearnedWords(newLearned);
    };

    if (loading) return <div className="p-10 text-center">Loading questions...</div>;

    if (finished) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <h2 className="text-3xl font-bold mb-6 text-green-600">Session Complete!</h2>
                <p className="mb-6 text-gray-600">You have mastered {masteredIds.size} words.</p>
                <div className="flex gap-4">
                    <button
                        onClick={() => { setView('preview'); setFinished(false); }}
                        className="bg-gray-500 text-white px-6 py-3 rounded-lg font-bold"
                    >
                        Review List
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="bg-blue-500 text-white px-6 py-3 rounded-lg font-bold"
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    if (previewQuestions.length === 0 && view === 'preview') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <h2 className="text-2xl font-bold mb-6">No words found.</h2>
                <button
                    onClick={() => router.push('/')}
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg font-bold"
                >
                    Return Home
                </button>
            </div>
        );
    }

    // PREVIEW MODE
    if (view === 'preview') {
        return (
            <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
                <div className="max-w-3xl w-full">
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-700">
                            ← Back
                        </button>
                        <h1 className="text-2xl font-bold text-gray-800">Word Preview ({previewQuestions.length})</h1>
                        <button
                            onClick={startQuiz}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition transform hover:scale-105"
                        >
                            Start Quiz →
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 sticky top-4 z-10 border border-blue-100">
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => setHideSpelling(!hideSpelling)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${hideSpelling ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {hideSpelling ? '👁️ Show Spelling' : '🙈 Hide Spelling'}
                            </button>
                            <button
                                onClick={() => setHideMeaning(!hideMeaning)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${hideMeaning ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {hideMeaning ? '👁️ Show Meaning' : '🙈 Hide Meaning'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4 pb-20">
                        {previewQuestions.map((q, idx) => {
                            const correctOption = q.options.find(o => o.isCorrect);
                            const isLearned = learnedWords.has(q.word.id);
                            return (
                                <div
                                    key={q.word.id}
                                    className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${isLearned ? 'border-green-200 bg-green-50 opacity-70' : 'border-gray-200 hover:shadow-md'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                            <div className="flex items-center">
                                                <span className="text-gray-400 font-mono mr-3 w-6 text-right">#{idx + 1}</span>
                                                <span className={`text-xl font-bold ${hideSpelling && !isLearned ? 'blur-md select-none' : 'text-gray-800'}`}>
                                                    {q.word.spelling}
                                                </span>
                                            </div>
                                            <div className={`text-gray-600 ${hideMeaning && !isLearned ? 'blur-md select-none' : ''}`}>
                                                {correctOption?.meaning}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleLearned(q.word.id)}
                                            className={`ml-4 p-2 rounded-full transition ${isLearned ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                }`}
                                            title="Mark as learned"
                                        >
                                            {isLearned ? '✓' : '○'}
                                        </button>
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl">
                <div className="flex justify-between text-sm text-gray-400 mb-4">
                    <span>Active Queue: {queue.length}</span>
                    <span>Mastered: {masteredIds.size} / {totalCount}</span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
                    <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(masteredIds.size / totalCount) * 100}%` }}
                    />
                </div>

                <div className="text-center mb-10">
                    <h1 className="text-5xl font-bold text-gray-800 mt-4">{currentQ.word.spelling}</h1>
                </div>

                {feedback ? (
                    <div className={`p-6 rounded-xl text-center text-xl font-bold mb-6 ${feedback.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {feedback.message}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {currentQ.options.map((option, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(option)}
                                className="text-left p-4 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-all text-lg font-medium"
                            >
                                <span className="font-bold mr-3">{String.fromCharCode(65 + idx)}.</span>
                                {option.meaning}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button
                onClick={() => setView('preview')}
                className="mt-8 text-gray-500 hover:text-gray-800"
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
