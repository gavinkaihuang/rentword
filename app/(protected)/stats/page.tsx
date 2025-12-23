'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';

interface LetterStat {
    letter: string;
    total: number;
    learned: number;
    percentage: number;
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

    const renderCustomLabel = (props: any) => {
        const { x, y, width, height, value, index } = props;
        // Recharts might not pass the full payload in 'value' if dataKey is percentage.
        // But we can access the original data via the stats array using index.
        const stat = stats[index];
        if (!stat) return null;

        return (
            <text x={x + width + 5} y={y + height / 2 + 5} fill="#666" fontSize={12} textAnchor="start">
                {stat.learned}/{stat.total} ({stat.percentage}%)
            </text>
        );
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
                    <div className="space-y-8">
                        {/* Charts Section */}
                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                            <h2 className="text-xl font-bold mb-6 text-gray-700">Progress Overview</h2>
                            {/* Tall container for vertical list of all letters */}
                            <div className="h-[800px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        layout="vertical"
                                        data={stats}
                                        margin={{ top: 5, right: 100, bottom: 5, left: 10 }} // Right margin for labels
                                        barSize={20}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="letter" type="category" width={30} tick={{ fontSize: 14, fontWeight: 'bold' }} />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-white p-2 border border-gray-100 shadow-md rounded-lg text-sm">
                                                            <p className="font-bold">{data.letter}</p>
                                                            <p className="text-blue-600">Learned: {data.learned}</p>
                                                            <p className="text-gray-500">Total: {data.total}</p>
                                                            <p className="text-gray-400">Progress: {data.percentage}%</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="percentage" fill="#3b82f6" radius={[0, 4, 4, 0]} background={{ fill: '#f1f5f9', radius: [0, 4, 4, 0] }}>
                                            <LabelList dataKey="percentage" content={renderCustomLabel} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Grid Section */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {stats.map((stat) => (
                                <div key={stat.letter} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-3xl font-bold text-blue-600 font-mono group-hover:scale-110 transition-transform">{stat.letter}</div>
                                        <div className="text-xs font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                            {stat.percentage}%
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${stat.percentage}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>Learned: {stat.learned}</span>
                                        <span>Total: {stat.total}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
