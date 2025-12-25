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

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/stats/letters');
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
                <div className="flex justify-between items-center mb-8">
                    <button onClick={() => router.push('/')} className="text-[#565f89] hover:text-[#343b58] flex items-center gap-2">
                        ← Back Home
                    </button>
                    <h1 className="text-3xl font-bold text-[#343b58]">📊 A-Z Statistics</h1>
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
                                                {formatDate(stat.lastStudied)}
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
