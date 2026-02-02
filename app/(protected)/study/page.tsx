
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface StudyWord {
    id: number;
    spelling: string;
    meaning: string;
    phonetic?: string;
    // SM-2 metadata
    _progress?: {
        interval: number;
        easinessFactor: number;
        nextReviewDate: string;
    };
    _isNew?: boolean;
}

export default function StudyPage() {
    const router = useRouter();
    const [queue, setQueue] = useState<StudyWord[]>([]);
    const [currentStart, setCurrentStart] = useState(0);
    const [loading, setLoading] = useState(true);
    const [finished, setFinished] = useState(false);

    // Card State
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        fetchBatch();
    }, []);

    const fetchBatch = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/study/next-batch?limit=10');
            const data = await res.json();

            if (data.queue && data.queue.length > 0) {
                setQueue(prev => [...prev, ...data.queue]);
                setFinished(false);
            } else if (queue.length === 0) {
                setFinished(true); // No words at all
            }
            // If queue is not empty but fetched 0, we just continue with existing queue
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const currentWord = queue[currentStart];

    const handleRate = async (quality: number) => {
        if (!currentWord) return;

        // Optimistic UI: Move to next immediately
        const wordId = currentWord.id;

        // API Call
        try {
            await fetch('/api/study/submit-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordId, quality })
            });
        } catch (e) {
            console.error('Failed to submit review', e);
            // In a real app, might want to queue for offline sync or show error
        }

        // Move next
        setIsRevealed(false);
        const nextIndex = currentStart + 1;

        // Check if we need to fetch more
        if (nextIndex >= queue.length - 2 && !loading) {
            fetchBatch();
        }

        if (nextIndex < queue.length) {
            setCurrentStart(nextIndex);
        } else {
            // If empty and no fetch results coming...
            if (!loading) setFinished(true);
            else setCurrentStart(nextIndex); // Wait for load
        }
    };

    if (loading && queue.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#e1e2e7] text-[#565f89]">
                Loading Study Session...
            </div>
        );
    }

    if (finished && currentStart >= queue.length) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#e1e2e7] p-8">
                <h1 className="text-3xl font-bold text-[#34548a] mb-4">🎉 Session Complete!</h1>
                <p className="text-[#565f89] mb-8">You have reviewed all due words for now.</p>
                <button
                    onClick={() => router.push('/')}
                    className="bg-[#34548a] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#2a4470] transition"
                >
                    Return Home
                </button>
            </div>
        );
    }

    if (!currentWord) return null;

    return (
        <div className="min-h-screen bg-[#e1e2e7] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <button onClick={() => router.back()} className="text-[#565f89] hover:text-[#34548a]">← Quit</button>
                    <div className="text-[#565f89] font-medium">
                        {currentWord._isNew ? '🆕 New Word' : '↻ Review'}
                    </div>
                </div>

                {/* Flashcard */}
                <div className="bg-[#fdfbf7] rounded-xl shadow-xl border border-[#d5d6db] overflow-hidden min-h-[400px] flex flex-col relative">

                    {/* Front */}
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center transition-all">
                        <h2 className="text-5xl font-bold text-[#343b58] mb-4">{currentWord.spelling}</h2>
                        {currentWord.phonetic && (
                            <p className="text-xl text-[#565f89] font-mono">{currentWord.phonetic}</p>
                        )}
                    </div>

                    {/* Reveal Overlay / Button */}
                    {!isRevealed && (
                        <div className="flex items-center justify-center pb-12 cursor-pointer" onClick={() => setIsRevealed(true)}>
                            <button
                                className="bg-[#34548a] text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-[#2a4470] transition transform hover:scale-105"
                            >
                                Show Answer
                            </button>
                        </div>
                    )}

                    {/* Back (Meaning) */}
                    {isRevealed && (
                        <div className="flex-1 bg-[#f4f5f7] border-t border-[#e2e2e2] p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="prose prose-slate max-w-none">
                                <p className="text-xl text-[#343b58] font-medium whitespace-pre-wrap">{currentWord.meaning}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                {isRevealed && (
                    <div className="grid grid-cols-4 gap-4 mt-8 animate-in fade-in zoom-in-95 duration-200">
                        <button
                            onClick={() => handleRate(0)}
                            className="bg-[#e06c75] hover:bg-[#c25d66] text-white py-4 rounded-xl font-bold shadow-md transition flex flex-col items-center"
                        >
                            <span>Again</span>
                            <span className="text-xs opacity-75 font-normal mt-1">&lt; 1 min</span>
                        </button>
                        <button
                            onClick={() => handleRate(3)}
                            className="bg-[#e5c07b] hover:bg-[#d1af6e] text-white py-4 rounded-xl font-bold shadow-md transition flex flex-col items-center"
                        >
                            <span>Hard</span>
                            <span className="text-xs opacity-75 font-normal mt-1">2 days</span>
                        </button>
                        <button
                            onClick={() => handleRate(4)}
                            className="bg-[#98c379] hover:bg-[#86ac6b] text-white py-4 rounded-xl font-bold shadow-md transition flex flex-col items-center"
                        >
                            <span>Good</span>
                            <span className="text-xs opacity-75 font-normal mt-1">4 days</span>
                        </button>
                        <button
                            onClick={() => handleRate(5)}
                            className="bg-[#61afef] hover:bg-[#5294ca] text-white py-4 rounded-xl font-bold shadow-md transition flex flex-col items-center"
                        >
                            <span>Easy</span>
                            <span className="text-xs opacity-75 font-normal mt-1">7 days</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
