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
        if (rate > 20) return 'text-red-600 bg-red-50';
        if (rate > 10) return 'text-orange-600 bg-orange-50';
        if (rate === 0) return 'text-gray-400';
        return 'text-green-600 bg-green-50';
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-4 md:p-8">
            <div className="max-w-6xl w-full mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-700 flex items-center gap-2">
                        ← Back Home
                    </button>
                    <h1 className="text-3xl font-bold text-gray-800">📊 A-Z Statistics</h1>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-gray-500">Loading statistics...</div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4 pl-6 text-center w-16">Letter</th>
                                        <th className="p-4">Words</th>
                                        <th className="p-4">Learned</th>
                                        <th className="p-4 w-1/3">Completion</th>
                                        <th className="p-4">Last Studied</th>
                                        <th className="p-4 text-right pr-6">Error Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {stats.map((stat) => (
                                        <tr key={stat.letter} className="hover:bg-blue-50 transition-colors">
                                            <td className="p-4 pl-6 text-center">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-lg font-mono">
                                                    {stat.letter}
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-700 font-medium">{stat.total}</td>
                                            <td className="p-4 text-gray-600">{stat.learned}</td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-bold w-10 text-right">{stat.percentage}%</span>
                                                    <div className="flex-grow bg-gray-200 rounded-full h-2.5">
                                                        <div
                                                            className="bg-blue-500 h-2.5 rounded-full"
                                                            style={{ width: `${stat.percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-500 font-mono">
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
