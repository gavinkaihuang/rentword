'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';

interface LetterStat {
    letter: string;
    total: number;
    learned: number;
    percentage: number;
    lastStudied: string | null;
    errorRate: number;
}

export default function LetterStatsPage() {
    const router = useRouter();
    const [stats, setStats] = useState<LetterStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
    const [wordBooks, setWordBooks] = useState<any[]>([]);

    useEffect(() => {
        // Fetch available books and initial active book
        Promise.all([
            fetch('/api/wordbooks').then(res => res.json()),
            // We can just rely on the first fetchStats (no arg) to get default, 
            // but we want the dropdown to show the correct default.
            // We can guess the default is the cookie one, but simpler is to fetching active again?
            // Or better: fetchStats() first (uses cookie), then set selectedBookId to active from metadata if API returned it?
            // API doesn't return active ID.
            // Let's fetch active book ID separately to set initial state correctly.
            fetch('/api/wordbooks/active').then(res => res.json())
        ]).then(([booksData, activeData]) => {
            setWordBooks(booksData.wordBooks || []);
            const defaultId = activeData.activeWordBookId || (booksData.wordBooks?.[0]?.id);
            setSelectedBookId(defaultId);
            fetchStats(defaultId);
        }).catch(e => console.error(e));
    }, []);

    const fetchStats = async (bookId?: number) => {
        setLoading(true);
        try {
            const url = bookId ? `/api/stats/letters?wordBookId=${bookId}` : '/api/stats/letters';
            const res = await fetch(url);
            const data = await res.json();
            if (data.stats) {
                setStats(data.stats);
            }
        } catch (e) {
            console.error('Failed to fetch stats', e);
        } finally {
            setLoading(false);
        }
    };

    const handleBookChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = parseInt(e.target.value);
        setSelectedBookId(id);
        fetchStats(id);
    };

    const formatDate = (isoString: string | null) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleDateString() + ' ' + new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getErrorColor = (rate: number) => {
        if (rate > 20) return 'text-[#8c4351] bg-[#f4dbd6]';
        if (rate > 10) return 'text-[#8f5e15] bg-[#eec49f]';
        if (rate === 0) return 'text-[#9aa5ce]';
        return 'text-[#33635c] bg-[#e9f5f4]';
    };

    return (
        <div className="min-h-screen bg-[#e1e2e7] flex flex-col p-4 md:p-8">
            <div className="max-w-6xl w-full mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button onClick={() => router.push('/')} className="text-[#565f89] hover:text-[#343b58] flex items-center gap-2">
                            ← Back Home
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <h1 className="text-3xl font-bold text-[#343b58]">📊 A-Z Statistics</h1>

                        {/* Book Selector */}
                        <div className="relative">
                            <select
                                value={selectedBookId || ''}
                                onChange={handleBookChange}
                                className="appearance-none bg-white border border-[#c0caf5] px-4 py-2 pr-8 rounded-lg text-[#34548a] font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#34548a] shadow-sm"
                            >
                                {wordBooks.map(book => (
                                    <option key={book.id} value={book.id}>
                                        📚 {book.name}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#34548a]">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-[#565f89]">Loading statistics...</div>
                ) : (
                    <div className="bg-[#f2f3f5] rounded-2xl shadow-lg border border-[#c0caf5] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#f2f3f5] text-[#565f89] text-sm uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4 pl-6 text-center w-16">Letter</th>
                                        <th className="p-4">Words</th>
                                        <th className="p-4">Learned</th>
                                        <th className="p-4 w-1/3">Completion</th>
                                        <th className="p-4">Last Studied</th>
                                        <th className="p-4 text-right pr-6">Error Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#c0caf5]">
                                    {stats.map((stat) => (
                                        <tr key={stat.letter} className="hover:bg-[#eef1f8] transition-colors">
                                            <td className="p-4 pl-6 text-center">
                                                <div className="w-10 h-10 rounded-full bg-[#34548a] text-white font-bold flex items-center justify-center text-lg font-mono">
                                                    {stat.letter}
                                                </div>
                                            </td>
                                            <td className="p-4 text-[#343b58] font-medium">{stat.total}</td>
                                            <td className="p-4 text-[#565f89]">{stat.learned}</td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-bold w-10 text-right text-[#343b58]">{stat.percentage}%</span>
                                                    <div className="flex-grow bg-[#d5d6db] rounded-full h-2.5">
                                                        <div
                                                            className="bg-[#34548a] h-2.5 rounded-full"
                                                            style={{ width: `${stat.percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-[#9aa5ce] font-mono">
                                                <span suppressHydrationWarning>
                                                    {formatDate(stat.lastStudied)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right pr-6">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getErrorColor(stat.errorRate)}`}>
                                                    {stat.errorRate.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
