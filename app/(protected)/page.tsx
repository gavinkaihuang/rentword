'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [mode1From, setMode1From] = useState('');
  const [mode1To, setMode1To] = useState('');

  const startMode1 = async () => {
    if (!mode1From) {
      alert('Please enter a Start word');
      return;
    }

    try {
      const res = await fetch(`/api/learn/validate?from=${mode1From}&to=${mode1To}`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Validation failed');
        return;
      }

      // Proceed with resolved start and end words, passing the count as limit
      router.push(`/learn?mode=1&from=${data.startWord}&to=${data.endWord}&limit=${data.count}`);
    } catch (e) {
      console.error(e);
      alert('An error occurred while validating inputs.');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl flex justify-between items-center mb-10">
        <h1 className="text-4xl font-bold text-blue-600">Vocabulary Master</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition shadow-sm"
        >
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {/* Mode 1 */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Sequential Learning</h2>
          <p className="text-gray-600 mb-6 flex-grow">Learn words in order from the dictionary.</p>

          <div className="space-y-4 mb-4">
            <input
              type="text"
              placeholder="From (e.g., a)"
              className="w-full p-2 border rounded"
              value={mode1From}
              onChange={(e) => setMode1From(e.target.value)}
            />
            <input
              type="text"
              placeholder="To (e.g., all)"
              className="w-full p-2 border rounded"
              value={mode1To}
              onChange={(e) => setMode1To(e.target.value)}
            />
          </div>

          <button
            onClick={startMode1}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition"
          >
            Start Learning
          </button>
        </div>

        {/* Mode 6: Select Words (New 2nd Option) */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Select Words</h2>
          <p className="text-gray-600 mb-6 flex-grow">Pick specific words from the list to study.</p>
          <button
            onClick={() => router.push('/select')}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-lg mt-auto transition"
          >
            Select & Start
          </button>
        </div>

        {/* Mode 2 */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Smart Review</h2>
          <p className="text-gray-600 mb-6 flex-grow">Review words you missed or are due for consolidation.</p>
          <button
            onClick={() => router.push('/learn?mode=2')}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg mt-auto transition"
          >
            Start Review
          </button>
        </div>

        {/* Mode 3 */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Random Practice</h2>
          <p className="text-gray-600 mb-6 flex-grow">Practice with random words from the entire database.</p>
          <button
            onClick={() => router.push('/learn?mode=3')}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-lg mt-auto transition"
          >
            Start Random
          </button>
        </div>

        {/* Mistake Notebook (New Card) */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Mistake Notebook</h2>
          <p className="text-gray-600 mb-6 flex-grow">Review your past mistakes and strengthen your memory.</p>
          <button
            onClick={() => router.push('/mistakes')}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg mt-auto transition"
          >
            Open Notebook
          </button>
        </div>

        {/* Recitation Calendar Link */}
        <div className="md:col-span-3 bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex items-center justify-between hover:bg-blue-50 transition cursor-pointer" onClick={() => router.push('/calendar')}>
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">📅 Recitation Calendar</h2>
            <p className="text-gray-600">View your daily progress and history.</p>
          </div>
          <button className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition">
            View Calendar
          </button>
        </div>

        {/* Letter Statistics Link */}
        <div className="md:col-span-3 bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex items-center justify-between hover:bg-purple-50 transition cursor-pointer" onClick={() => router.push('/stats')}>
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">📊 A-Z Statistics</h2>
            <p className="text-gray-600">Check your progress by alphabet.</p>
          </div>
          <button className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-6 rounded-lg transition">
            View Stats
          </button>
        </div>
      </div>
    </main>
  );
}
