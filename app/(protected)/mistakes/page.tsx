'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Mistake {
    wordId: number;
    spelling: string;
    meaning: string;
    errorCount: number;
    lastErrorDate: string;
}

export default function MistakeNotebook() {
    const router = useRouter();
    const [mistakes, setMistakes] = useState<Mistake[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        fetchMistakes();
    }, [page]);

    const fetchMistakes = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/mistakes?page=${page}&limit=20`);
            const data = await res.json();
            setMistakes(data.mistakes);
            setTotalPages(data.pagination.totalPages);
        } catch (e) {
            console.error('Failed to fetch mistakes', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleReview = () => {
        if (selectedIds.size === 0) {
            alert('Please select at least one word to review.');
            return;
        }
        const ids = Array.from(selectedIds).join(',');
        router.push(`/learn?mode=5&ids=${ids}`);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            // Select all on current page
            const newSelected = new Set(selectedIds);
            mistakes.forEach(m => newSelected.add(m.wordId));
            setSelectedIds(newSelected);
        } else {
            // Deselect all on current page
            const newSelected = new Set(selectedIds);
            mistakes.forEach(m => newSelected.delete(m.wordId));
            setSelectedIds(newSelected);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-4 md:p-8">
            <div className="max-w-5xl w-full mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-700 flex items-center gap-2">
                        ← Back Home
                    </button>
                    <h1 className="text-3xl font-bold text-gray-800">📕 Mistake Notebook</h1>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-gray-600">
                            Selected: <span className="font-bold text-blue-600">{selectedIds.size}</span> words
                        </div>
                        <button
                            onClick={handleReview}
                            disabled={selectedIds.size === 0}
                            className={`px-6 py-2 rounded-lg font-bold transition
                                ${selectedIds.size > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                            `}
                        >
                            Review Selected
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Loading mistakes...</div>
                    ) : mistakes.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-100 text-gray-500 text-sm">
                                        <th className="p-3 w-10">
                                            <input
                                                type="checkbox"
                                                onChange={handleSelectAll}
                                                checked={mistakes.length > 0 && mistakes.every(m => selectedIds.has(m.wordId))}
                                            />
                                        </th>
                                        <th className="p-3">Word</th>
                                        <th className="p-3">Meaning</th>
                                        <th className="p-3 text-center">Errors</th>
                                        <th className="p-3 text-right">Last Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mistakes.map((mistake) => (
                                        <tr key={mistake.wordId} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(mistake.wordId)}
                                                    onChange={() => handleSelect(mistake.wordId)}
                                                />
                                            </td>
                                            <td className="p-3 font-bold text-gray-800">{mistake.spelling}</td>
                                            <td className="p-3 text-gray-600">{mistake.meaning}</td>
                                            <td className="p-3 text-center">
                                                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs font-bold">
                                                    {mistake.errorCount}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right text-sm text-gray-500">
                                                {new Date(mistake.lastErrorDate).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-20 text-gray-500">
                            <div className="text-4xl mb-4">🎉</div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">No mistakes found!</h3>
                            <p>You haven't made any mistakes yet, or your mistak history is empty.</p>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center mt-6 gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1 text-gray-600">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
