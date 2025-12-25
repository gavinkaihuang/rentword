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

    const [status, setStatus] = useState<'unmastered' | 'mastered'>('unmastered');

    useEffect(() => {
        fetchMistakes();
        setSelectedIds(new Set()); // Reset selection on change
    }, [page, status]);

    const fetchMistakes = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/mistakes?page=${page}&limit=20&status=${status}`);
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
        <div className="min-h-screen bg-[#e1e2e7] flex flex-col p-4 md:p-8">
            <div className="max-w-5xl w-full mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/')} className="text-[#565f89] hover:text-[#343b58] flex items-center gap-2">
                            ← Back Home
                        </button>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/learn?mode=7')}
                            className="mr-3 px-6 py-2 rounded-lg font-bold bg-[#5a4a78] hover:bg-[#483b60] text-white transition flex items-center gap-2 shadow-lg"
                        >
                            <span>🧠</span> Smart Review (All)
                        </button>
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-[#343b58] mb-6">📕 Mistake Notebook</h1>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-[#cfc9c2]">
                    <button
                        onClick={() => { setStatus('unmastered'); setPage(1); }}
                        className={`pb-2 px-4 font-bold transition-all border-b-2 ${status === 'unmastered'
                            ? 'border-[#34548a] text-[#34548a]'
                            : 'border-transparent text-[#9aa5ce] hover:text-[#565f89]'
                            }`}
                    >
                        😟 Unresolved (Need Practice)
                    </button>
                    <button
                        onClick={() => { setStatus('mastered'); setPage(1); }}
                        className={`pb-2 px-4 font-bold transition-all border-b-2 ${status === 'mastered'
                            ? 'border-[#33635c] text-[#33635c]'
                            : 'border-transparent text-[#9aa5ce] hover:text-[#565f89]'
                            }`}
                    >
                        😎 Resolved (Mastered)
                    </button>
                </div>

                <div className="bg-[#f2f3f5] rounded-2xl shadow-lg p-6 border border-[#c0caf5]">
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-[#565f89]">
                            Selected: <span className="font-bold text-[#34548a]">{selectedIds.size}</span> words
                        </div>

                        <button
                            onClick={handleReview}
                            disabled={selectedIds.size === 0}
                            className={`px-6 py-2 rounded-lg font-bold transition
                                ${selectedIds.size > 0 ? 'bg-[#34548a] hover:bg-[#2a4470] text-white' : 'bg-[#e1e2e7] text-[#9aa5ce] cursor-not-allowed'}
                            `}
                        >
                            Review Selected
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-[#565f89]">Loading mistakes...</div>
                    ) : mistakes.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-[#cfc9c2] text-[#9aa5ce] text-sm">
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
                                        <tr key={mistake.wordId} className="border-b border-[#f2f3f5] hover:bg-[#e1e2e7] transition text-[#343b58]">
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(mistake.wordId)}
                                                    onChange={() => handleSelect(mistake.wordId)}
                                                />
                                            </td>
                                            <td className="p-3 font-bold">{mistake.spelling}</td>
                                            <td className="p-3 text-[#565f89]">{mistake.meaning}</td>
                                            <td className="p-3 text-center">
                                                <span className="bg-[#f4dbd6] text-[#8c4351] px-2 py-0.5 rounded text-xs font-bold">
                                                    {mistake.errorCount}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right text-sm text-[#9aa5ce]">
                                                {new Date(mistake.lastErrorDate).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-20 text-[#565f89]">
                            <div className="text-4xl mb-4">🎉</div>
                            <h3 className="text-xl font-bold text-[#343b58] mb-2">No mistakes found!</h3>
                            <p>You haven't made any mistakes yet, or your mistak history is empty.</p>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center mt-6 gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 border border-[#cfc9c2] rounded hover:bg-[#e1e2e7] disabled:opacity-50 text-[#343b58]"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1 text-[#565f89]">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1 border border-[#cfc9c2] rounded hover:bg-[#e1e2e7] disabled:opacity-50 text-[#343b58]"
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
