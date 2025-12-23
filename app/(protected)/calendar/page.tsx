
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface DayStats {
    total: number;
    correct: number;
    incorrect: number;
}

interface ReviewLog {
    id: number;
    word: {
        spelling: string;
        meaning: string;
    };
    isCorrect: boolean;
}

export default function CalendarPage() {
    const router = useRouter();
    const [stats, setStats] = useState<Record<string, DayStats>>({});

    // Time Stats State
    const [monthTime, setMonthTime] = useState<{ learn: number; review: number }>({ learn: 0, review: 0 });
    const [dayTimeStats, setDayTimeStats] = useState<{ learnSeconds: number; reviewSeconds: number } | null>(null);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [dayDetails, setDayDetails] = useState<{ word: { spelling: string; meaning: string }; attempts: number; correct: number }[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Simple calendar logic
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today);

    useEffect(() => {
        fetchStats();
    }, [currentMonth]);

    const fetchStats = async () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;
        try {
            const res = await fetch(`/api/calendar/stats?year=${year}&month=${month}`);
            const data = await res.json();
            setStats(data.dailyStats || {});
            setMonthTime({
                learn: data.totalLearnSeconds || 0,
                review: data.totalReviewSeconds || 0
            });
        } catch (e) {
            console.error('Failed to fetch stats', e);
        }
    };

    const handleDayClick = async (dayStr: string) => {
        setSelectedDate(dayStr);
        setLoadingDetails(true);
        setDayDetails([]);
        setDayTimeStats(null);
        try {
            const res = await fetch(`/api/calendar/day?date=${dayStr}`);
            const data = await res.json();
            if (data.words) {
                setDayDetails(data.words);
            }
            if (data.timeStats) {
                setDayTimeStats(data.timeStats);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDetails(false);
        }
    };

    // Calendar generation
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { year, month, days, firstDay };
    };

    const { year, month, days, firstDay } = getDaysInMonth(currentMonth);
    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(year, month + 1, 1));
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const renderCalendarDays = () => {
        const calendarDays = [];
        // Empty slots for previous month
        for (let i = 0; i < firstDay; i++) {
            calendarDays.push(<div key={`empty-${i}`} className="h-24 bg-gray-50 border border-gray-100"></div>);
        }

        for (let d = 1; d <= days; d++) {
            const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const stat = stats[dayStr];
            const isToday = new Date().toISOString().split('T')[0] === dayStr;
            const isSelected = selectedDate === dayStr;

            calendarDays.push(
                <div
                    key={dayStr}
                    onClick={() => handleDayClick(dayStr)}
                    className={`h-24 border border-gray-200 p-2 cursor-pointer transition-colors relative hover:bg-blue-50
                        ${isSelected ? 'bg-blue-100 ring-2 ring-blue-400 z-10' : 'bg-white'}
                        ${isToday ? 'font-bold' : ''}
                    `}
                >
                    <div className="flex justify-between items-start">
                        <span className={`text-sm ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{d}</span>
                        {stat && (
                            <span className="text-xs font-bold bg-blue-500 text-white rounded-full px-2 py-0.5">
                                {stat.total}
                            </span>
                        )}
                    </div>

                    {stat && (
                        <div className="mt-2 text-xs space-y-1">
                            <div className="flex items-center text-green-600">
                                <span>✓ {stat.correct}</span>
                            </div>
                            <div className="flex items-center text-red-500">
                                <span>✗ {stat.incorrect}</span>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        return calendarDays;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-4 md:p-8">
            <div className="max-w-6xl w-full mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-700 flex items-center gap-2">
                        ← Back Home
                    </button>
                    <div className="text-right">
                        <h1 className="text-3xl font-bold text-gray-800">Recitation Calendar</h1>
                        <div className="text-sm text-gray-600 mt-1">
                            <span className="mr-4">📅 This Month:</span>
                            <span className="font-bold text-blue-600 mr-2">Study: {formatDuration(monthTime.learn)}</span>
                            <span className="font-bold text-purple-600">Recite: {formatDuration(monthTime.review)}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Calendar Section */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-lg">←</button>
                            <h2 className="text-xl font-bold">{monthName}</h2>
                            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-lg">→</button>
                        </div>

                        <div className="grid grid-cols-7 gap-px mb-2 text-center text-sm text-gray-500">
                            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                            {renderCalendarDays()}
                        </div>
                    </div>

                    {/* Details Section */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 h-fit max-h-[800px] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">
                            {selectedDate ? `Activity for ${selectedDate}` : 'Select a date'}
                        </h2>

                        {/* Daily Time Stats */}
                        {selectedDate && dayTimeStats && (
                            <div className="mb-6 bg-gray-50 p-4 rounded-xl">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Daily Effort</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Learning</p>
                                        <p className="text-lg font-bold text-blue-600">{formatDuration(dayTimeStats.learnSeconds)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Recitation</p>
                                        <p className="text-lg font-bold text-purple-600">{formatDuration(dayTimeStats.reviewSeconds)}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedDate && dayDetails.length > 0 && (
                            <div className="mb-4">
                                <button
                                    onClick={() => router.push(`/learn?mode=4&date=${selectedDate}`)}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                                >
                                    <span>🔄</span> Study These Values Again
                                </button>
                            </div>
                        )}

                        {loadingDetails ? (
                            <div className="text-gray-500 text-center py-10">Loading details...</div>
                        ) : selectedDate ? (
                            dayDetails.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="text-sm text-gray-500 mb-2">
                                        Recited {dayDetails.length} unique words.
                                    </div>
                                    {dayDetails.map((item, idx) => (
                                        <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-bold text-lg text-gray-800">{item.word.spelling}</h3>
                                                <div className="px-2 py-0.5 rounded text-xs font-bold bg-gray-200 text-gray-700">
                                                    {item.correct}/{item.attempts} Correct
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 line-clamp-2">{item.word.meaning}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-gray-500 text-center py-10">
                                    No recitation history found for this day.
                                </div>
                            )
                        ) : (
                            <div className="text-gray-500 text-center py-10">
                                Click on a date in the calendar to view recitation details.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
