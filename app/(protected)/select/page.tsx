'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Word {
    id: number;
    spelling: string;
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

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pt-4 pb-24 md:p-8 md:pb-8 relative">
            <div className="max-w-6xl w-full mx-auto px-4 md:px-0">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-700 font-medium">
                        ← Back Home
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800">Select Words to Study</h1>
                    <div className="w-20"></div> {/* Spacer */}
                </div>

                {/* Filter Bar */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 overflow-x-auto">
                    <div className="flex gap-2 min-w-max">
                        {letters.map(letter => (
                            <button
                                key={letter}
                                onClick={() => setSelectedLetter(letter)}
                                className={`w-10 h-10 rounded-lg font-bold text-lg uppercase transition-all
                                    ${selectedLetter === letter
                                        ? 'bg-blue-600 text-white shadow-md scale-105'
                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}
                                `}
                            >
                                {letter}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Word Grid */}
                {loading ? (
                    <div className="text-center py-20 text-gray-500">Loading words...</div>
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
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                                            : 'border-transparent bg-white text-gray-700 hover:border-gray-200 shadow-sm'}
                                    `}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg">{word.spelling}</span>
                                        {isSelected && <span className="text-blue-500">✓</span>}
                                    </div>
                                </div>
                            );
                        })}
                        {words.length === 0 && (
                            <div className="col-span-full text-center py-10 text-gray-400">
                                No words found starting with "{selectedLetter.toUpperCase()}".
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 shadow-lg z-50">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div>
                        <span className="text-gray-500 text-sm">Selected</span>
                        <div className="text-2xl font-bold text-blue-600">{selectedIds.size} <span className="text-sm font-normal text-gray-400">words</span></div>
                    </div>
                    <button
                        onClick={handleStartLearning}
                        disabled={selectedIds.size === 0}
                        className={`px-8 py-3 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95
                            ${selectedIds.size > 0
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                        `}
                    >
                        Start Learning →
                    </button>
                </div>
            </div>
        </div>
    );
}
