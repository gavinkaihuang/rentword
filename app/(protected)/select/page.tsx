'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Word {
    id: number;
    spelling: string;
    isUnfamiliar?: boolean;
}

export default function SelectWordsPage() {
    const router = useRouter();
    const [words, setWords] = useState<Word[]>([]);
    const [selectedLetter, setSelectedLetter] = useState('a');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);

    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

    useEffect(() => {
        fetchWords(selectedLetter);
    }, [selectedLetter]);

    const fetchWords = async (letter: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/words?letter=${letter}`);
            const data = await res.json();
            if (data.words) {
                setWords(data.words);
            } else {
                setWords([]);
            }
        } catch (e) {
            console.error('Failed to fetch words', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleStartLearning = () => {
        if (selectedIds.size === 0) {
            alert('Please select at least one word.');
            return;
        }
        const ids = Array.from(selectedIds).join(',');
        router.push(`/learn?mode=6&ids=${ids}`);
    };

    const toggleUnfamiliar = async (e: React.MouseEvent, wordId: number, currentStatus: boolean) => {
        e.stopPropagation();
        // Optimistic update
        setWords(prev => prev.map(w => w.id === wordId ? { ...w, isUnfamiliar: !currentStatus } : w));

        try {
            await fetch('/api/words', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordId, isUnfamiliar: !currentStatus })
            });
        } catch (err) {
            console.error(err);
            // Revert on error
            setWords(prev => prev.map(w => w.id === wordId ? { ...w, isUnfamiliar: currentStatus } : w));
        }
    };

    return (
        <div className="min-h-screen bg-[#e1e2e7] flex flex-col pt-4 pb-24 md:p-8 md:pb-8 relative">
            <div className="max-w-6xl w-full mx-auto px-4 md:px-0">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={() => router.push('/')} className="text-[#565f89] hover:text-[#343b58] font-medium">
                        ← Back Home
                    </button>
                    <h1 className="text-2xl font-bold text-[#343b58]">Select Words to Study</h1>
                    <div className="w-20"></div> {/* Spacer */}
                </div>

                {/* Filter Bar */}
                <div className="bg-[#f2f3f5] p-4 rounded-xl shadow-sm border border-[#c0caf5] mb-6 overflow-x-auto">
                    <div className="flex gap-2 min-w-max">
                        {letters.map(letter => (
                            <button
                                key={letter}
                                onClick={() => setSelectedLetter(letter)}
                                className={`w-10 h-10 rounded-lg font-bold text-lg uppercase transition-all
                                    ${selectedLetter === letter
                                        ? 'bg-[#34548a] text-white shadow-md scale-105'
                                        : 'bg-[#f2f3f5] text-[#565f89] hover:bg-[#e1e2e7]'}
                                `}
                            >
                                {letter}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Word Grid */}
                {loading ? (
                    <div className="text-center py-20 text-[#565f89]">Loading words...</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-20">
                        {words.map(word => {
                            const isSelected = selectedIds.has(word.id);
                            return (
                                <div
                                    key={word.id}
                                    onClick={() => toggleSelection(word.id)}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all select-none
                                        ${isSelected
                                            ? 'border-[#34548a] bg-[#eef1f8] text-[#34548a] shadow-md'
                                            : 'border-transparent bg-[#f2f3f5] text-[#343b58] hover:border-[#cfc9c2] shadow-sm'}
                                    `}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg">{word.spelling}</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => toggleUnfamiliar(e, word.id, !!word.isUnfamiliar)}
                                                className={`p-1 rounded-full hover:bg-black/10 transition-colors ${word.isUnfamiliar ? 'text-[#8c4351]' : 'text-[#9aa5ce] hover:text-[#565f89]'}`}
                                                title={word.isUnfamiliar ? "Marked as unfamiliar" : "Mark as unfamiliar"}
                                            >
                                                {word.isUnfamiliar ? '★' : '☆'}
                                            </button>
                                            {isSelected && <span className="text-[#34548a]">✓</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {words.length === 0 && (
                            <div className="col-span-full text-center py-10 text-[#9aa5ce]">
                                No words found starting with "{selectedLetter.toUpperCase()}".
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-[#f2f3f5] border-t border-[#c0caf5] p-4 shadow-lg z-50">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div>
                        <span className="text-[#565f89] text-sm">Selected</span>
                        <div className="text-2xl font-bold text-[#34548a]">{selectedIds.size} <span className="text-sm font-normal text-[#9aa5ce]">words</span></div>
                    </div>
                    <button
                        onClick={handleStartLearning}
                        disabled={selectedIds.size === 0}
                        className={`px-8 py-3 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95
                            ${selectedIds.size > 0
                                ? 'bg-[#34548a] hover:bg-[#2a4470] text-white'
                                : 'bg-[#e1e2e7] text-[#9aa5ce] cursor-not-allowed'}
                        `}
                    >
                        Start Learning →
                    </button>
                </div>
            </div>
        </div>
    );
}
