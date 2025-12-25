
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

    // Simple calendar logic
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today);
    const [selectedDate, setSelectedDate] = useState<string | null>(today.toISOString().split('T')[0]);

    // Details State
    const [dayDetails, setDayDetails] = useState<{ word: { id: number; spelling: string; meaning: string }; attempts: number; correct: number; mistakeStatus: 'resolved' | 'unresolved' | null }[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        fetchStats();
    }, [currentMonth]);

    useEffect(() => {
        if (selectedDate) {
            handleDayClick(selectedDate);
        }
    }, []);

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
            calendarDays.push(<div key={`empty-${i}`} className="min-h-[4rem] bg-gray-50 border border-gray-100"></div>);
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
                    className={`min-h-[4rem] border border-gray-200 p-1.5 cursor-pointer transition-colors relative hover:bg-blue-50 flex flex-col justify-between
                        ${isSelected ? 'bg-blue-100 ring-2 ring-blue-400 z-10' : 'bg-white'}
                        ${isToday ? 'font-bold' : ''}
                    `}
                >
                    <div className="flex justify-between items-start">
                        <span className={`text-xs ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{d}</span>
                        {stat && (
                            <span className="text-[10px] font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                                {stat.total}
                            </span>
                        )}
                    </div>

                    {stat && (
                        <div className="mt-1 flex justify-between text-[10px]">
                            <span className="text-green-600">✓{stat.correct}</span>
                            <span className="text-red-500">✗{stat.incorrect}</span>
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

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Calendar Section */}
                    <div className="lg:col-span-4 bg-white rounded-2xl shadow-lg p-6 h-fit">
                        <div className="flex justify-between items-center mb-4">
                            <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-lg">←</button>
                            <h2 className="text-xl font-bold">{monthName}</h2>
                            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-lg">→</button>
                        </div>

                        <div className="grid grid-cols-7 gap-px mb-2 text-center text-xs font-bold text-gray-400">
                            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                            {renderCalendarDays()}
                        </div>
                    </div>

                    {/* Details Section */}
                    <div className="lg:col-span-8 bg-white rounded-2xl shadow-lg p-6 min-h-[500px]">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2 flex justify-between items-center">
                            <span>{selectedDate ? `Activity for ${selectedDate}` : 'Select a date'}</span>
                            {selectedDate && dayDetails.length > 0 && (
                                <span className="text-sm font-normal text-gray-500">{dayDetails.length} words</span>
                            )}
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
                            <div className="mb-6">
                                <button
                                    onClick={() => router.push(`/learn?mode=4&date=${selectedDate}`)}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <span>🔄</span> Study These Values Again
                                </button>
                            </div>
                        )}

                        {loadingDetails ? (
                            <div className="text-gray-500 text-center py-10">Loading details...</div>
                        ) : selectedDate ? (
                            dayDetails.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {dayDetails.map((item, idx) => (
                                        <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-base text-gray-800">{item.word.spelling}</h3>
                                                    </div>
                                                    <div className="flex gap-1 mt-1">
                                                        {item.mistakeStatus === 'unresolved' && (
                                                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                                                                Mistake
                                                            </span>
                                                        )}
                                                        {item.mistakeStatus === 'resolved' && (
                                                            <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-bold">
                                                                Resolved
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-700 whitespace-nowrap">
                                                    {item.correct}/{item.attempts}
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-600 line-clamp-2 mt-1">{item.word.meaning}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-gray-500 text-center py-10">
                                    No recitation history found for this day.
                                </div>
                            )
                        ) : (
                            <div className="text-gray-500 text-center py-10 flex flex-col items-center">
                                <div className="text-4xl mb-2">👈</div>
                                <p>Click on a date in the calendar to view recitation details.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
