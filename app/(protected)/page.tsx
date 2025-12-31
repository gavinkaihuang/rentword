'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [mode1From, setMode1From] = useState('');
  const [mode1To, setMode1To] = useState('');
  const [recentTask, setRecentTask] = useState<any>(null);

  // WordBook State
  const [wordBooks, setWordBooks] = useState<any[]>([]);
  const [activeBookId, setActiveBookId] = useState<number | null>(null);

  useEffect(() => {
    // 1. Fetch Books & Active Book
    Promise.all([
      fetch('/api/wordbooks').then(res => res.json()),
      fetch('/api/wordbooks/active').then(res => res.json())
    ]).then(([booksData, activeData]) => {
      setWordBooks(booksData.wordBooks || []);
      setActiveBookId(activeData.activeWordBookId);
    }).catch(console.error);

    // 2. Fetch Recent Tasks
    const today = new Date().toISOString().split('T')[0];
    fetch(`/api/tasks?date=${today}`)
      .then(res => res.json())
      .then(data => {
        if (data.tasks && data.tasks.length > 0) {
          const incomplete = data.tasks.find((t: any) => t.status !== 'COMPLETED');
          if (incomplete) setRecentTask(incomplete);
        }
      })
      .catch(console.error);

    // 3. Fetch Current User Info (for Admin Link)
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data && data.role === 'ADMIN') {
          setIsAdmin(true);
        }
      })
      .catch(() => { }); // Ignore error, just don't show admin link
  }, []);

  const [isAdmin, setIsAdmin] = useState(false);

  const handleBookSwitch = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = parseInt(e.target.value);
    setActiveBookId(newId);

    // Call API to persist
    try {
      await fetch('/api/wordbooks/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordBookId: newId })
      });
      // Allow user to see change, maybe refresh to reset state if needed
      // window.location.reload(); // Hard reload to ensure all downstream fetches use new cookie?
      // Actually, standard fetch calls might need to know. 
      // But we just set the cookie. Future fetches will use it.
      // We should probably clear recentTask or re-fetch it if it belongs to old book?
      // For simplicity: Reload to ensure clean state.
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch book', err);
    }
  };

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
    <main className="min-h-screen bg-[#e1e2e7] flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl flex justify-between items-center mb-10">
        <h1 className="text-4xl font-bold text-[#34548a]">Vocabulary Master</h1>

        <div className="flex items-center gap-4">

          {/* Admin Link */}
          {isAdmin && (
            <button
              onClick={() => router.push('/admin/users')}
              className="px-4 py-2 rounded-lg bg-[#34548a] text-white hover:bg-[#2a4470] transition shadow-sm font-medium"
            >
              Manage Users
            </button>
          )}

          {/* WordBook Switcher */}
          {activeBookId && (
            <div className="relative">
              <select
                value={activeBookId}
                onChange={handleBookSwitch}
                className="appearance-none bg-white border border-[#cfc9c2] px-4 py-2 pr-8 rounded-lg text-[#34548a] font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#34548a]"
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
          )}

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-[#e1e2e7] border border-[#cfc9c2] text-[#565f89] hover:bg-[#f4dbd6] hover:text-[#8c4351] hover:border-[#8c4351] transition shadow-sm"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Resume Task Section */}
      {recentTask && (
        <div className="w-full max-w-4xl mb-8 bg-gradient-to-r from-[#eef1f8] to-[#e9f5f4] border border-[#34548a] rounded-xl p-6 shadow-md flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-[#34548a]">🚀 Continue Learning</h2>
            <p className="text-[#565f89]">{recentTask.description} ({recentTask.completedCount}/{recentTask.totalCount})</p>
            <div className="w-48 bg-[#d5d6db] rounded-full h-2 mt-2">
              <div
                className="bg-[#34548a] h-2 rounded-full"
                style={{ width: `${(recentTask.completedCount / recentTask.totalCount) * 100}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => router.push(`/learn?taskId=${recentTask.id}`)}
            className="bg-[#34548a] hover:bg-[#2a4470] text-white font-bold py-2 px-6 rounded-lg shadow-lg"
          >
            Resume
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {/* Mode 1 */}
        <div className="bg-[#d5d6db] p-6 rounded-xl shadow-lg border border-[#c0caf5] flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-[#343b58]">Sequential Learning</h2>
          <p className="text-[#565f89] mb-6 flex-grow">Learn words in order from the dictionary.</p>

          <div className="space-y-4 mb-4">
            <input
              type="text"
              placeholder="From (e.g., a)"
              className="w-full p-2 border border-[#cfc9c2] rounded text-[#343b58]"
              value={mode1From}
              onChange={(e) => setMode1From(e.target.value)}
            />
            <input
              type="text"
              placeholder="To (e.g., all)"
              className="w-full p-2 border border-[#cfc9c2] rounded text-[#343b58]"
              value={mode1To}
              onChange={(e) => setMode1To(e.target.value)}
            />
          </div>

          <button
            onClick={startMode1}
            className="w-full bg-[#34548a] hover:bg-[#2a4470] text-white font-bold py-3 rounded-lg transition"
          >
            Start Learning
          </button>
        </div>

        {/* Mode 6: Select Words (New 2nd Option) */}
        <div className="bg-[#d5d6db] p-6 rounded-xl shadow-lg border border-[#c0caf5] flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-[#343b58]">Select Words</h2>
          <p className="text-[#565f89] mb-6 flex-grow">Pick specific words from the list to study.</p>
          <button
            onClick={() => router.push('/select')}
            className="w-full bg-[#5a4a78] hover:bg-[#483b60] text-white font-bold py-3 rounded-lg mt-auto transition"
          >
            Select & Start
          </button>
        </div>

        {/* Mode 2 */}
        <div className="bg-[#d5d6db] p-6 rounded-xl shadow-lg border border-[#c0caf5] flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-[#343b58]">Smart Review</h2>
          <p className="text-[#565f89] mb-6 flex-grow">Review words you missed or are due for consolidation.</p>
          <button
            onClick={() => router.push('/learn?mode=2')}
            className="w-full bg-[#33635c] hover:bg-[#29514b] text-white font-bold py-3 rounded-lg mt-auto transition"
          >
            Start Review
          </button>
        </div>

        {/* Mode 3 */}
        <div className="bg-[#d5d6db] p-6 rounded-xl shadow-lg border border-[#c0caf5] flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-[#343b58]">Random Practice</h2>
          <p className="text-[#565f89] mb-6 flex-grow">Practice with random words from the entire database.</p>
          <button
            onClick={() => router.push('/learn?mode=3')}
            className="w-full bg-[#565f89] hover:bg-[#4a5277] text-white font-bold py-3 rounded-lg mt-auto transition"
          >
            Start Random
          </button>
        </div>

        {/* Mistake Notebook (New Card) */}
        <div className="bg-[#d5d6db] p-6 rounded-xl shadow-lg border border-[#c0caf5] flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-[#343b58]">Mistake Notebook</h2>
          <p className="text-[#565f89] mb-6 flex-grow">Review your past mistakes and strengthen your memory.</p>
          <button
            onClick={() => router.push('/mistakes')}
            className="w-full bg-[#8c4351] hover:bg-[#723642] text-white font-bold py-3 rounded-lg mt-auto transition"
          >
            Open Notebook
          </button>
        </div>

        {/* Unfamiliar Words (New Mode 8) */}
        <div className="bg-[#d5d6db] p-6 rounded-xl shadow-lg border border-[#c0caf5] flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-[#343b58]">Unfamiliar Words</h2>
          <p className="text-[#565f89] mb-6 flex-grow">Focus on words you have marked as unfamiliar.</p>
          <button
            onClick={() => router.push('/learn?mode=8')}
            className="w-full bg-[#c0a36e] hover:bg-[#a68b5b] text-white font-bold py-3 rounded-lg mt-auto transition"
          >
            Start Learning
          </button>
        </div>

        {/* Recitation Calendar Link */}
        <div className="md:col-span-3 bg-[#d5d6db] p-6 rounded-xl shadow-lg border border-[#c0caf5] flex items-center justify-between hover:bg-[#c9cdd8] transition cursor-pointer" onClick={() => router.push('/calendar')}>
          <div>
            <h2 className="text-2xl font-semibold text-[#343b58]">📅 Recitation Calendar</h2>
            <p className="text-[#565f89]">View your daily progress and history.</p>
          </div>
          <button className="bg-[#34548a] hover:bg-[#2a4470] text-white font-bold py-2 px-6 rounded-lg transition">
            View Calendar
          </button>
        </div>

        {/* Letter Statistics Link */}
        <div className="md:col-span-3 bg-[#d5d6db] p-6 rounded-xl shadow-lg border border-[#c0caf5] flex items-center justify-between hover:bg-[#c9cdd8] transition cursor-pointer" onClick={() => router.push('/stats')}>
          <div>
            <h2 className="text-2xl font-semibold text-[#343b58]">📊 A-Z Statistics</h2>
            <p className="text-[#565f89]">Check your progress by alphabet.</p>
          </div>
          <button className="bg-[#5a4a78] hover:bg-[#483b60] text-white font-bold py-2 px-6 rounded-lg transition">
            View Stats
          </button>
        </div>
      </div>
    </main>
  );
}
