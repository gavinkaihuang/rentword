'use client';

import { useState, useEffect } from 'react';

interface User {
    id: number;
    username: string;
    role: string;
    createdAt: string;
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ username: '', password: '', role: 'USER' });
    const [msg, setMsg] = useState('');

    // Edit Mode State
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState({ password: '', role: 'USER' });
    const [editMsg, setEditMsg] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg('');
        if (!formData.username || !formData.password) return;

        const res = await fetch('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            setMsg('User created successfully');
            setFormData({ username: '', password: '', role: 'USER' });
            fetchUsers();
            setTimeout(() => setMsg(''), 3000);
        } else {
            const d = await res.json();
            setMsg(d.error || 'Error creating user');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this user? This will delete all their learning progress.')) return;

        const res = await fetch(`/api/admin/users/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            fetchUsers();
        } else {
            alert('Failed to delete user');
        }
    };

    const startEdit = (user: User) => {
        setEditingUser(user);
        setEditForm({ password: '', role: user.role });
        setEditMsg('');
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
            method: 'PUT',
            body: JSON.stringify(editForm)
        });

        if (res.ok) {
            setEditingUser(null);
            fetchUsers();
        } else {
            setEditMsg('Failed to update user');
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-8 text-[#e2e8f0]">User Management</h1>
            <a href="/" className="mb-4 inline-block text-blue-400 hover:underline">&larr; Back to Dashboard</a>

            {/* Create Form */}
            <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] mb-8">
                <h2 className="text-xl font-semibold mb-4 text-[#9aa5ce]">Add New User</h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:flex-row md:items-end">
                    <div>
                        <label className="block text-xs font-mono text-[#64748b] mb-1">USERNAME</label>
                        <input
                            type="text"
                            className="bg-[#0f172a] border border-[#334155] rounded px-3 py-2 text-[#e2e8f0] focus:outline-none focus:border-[#3b82f6]"
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-mono text-[#64748b] mb-1">PASSWORD</label>
                        <input
                            type="text"
                            className="bg-[#0f172a] border border-[#334155] rounded px-3 py-2 text-[#e2e8f0] focus:outline-none focus:border-[#3b82f6]"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-mono text-[#64748b] mb-1">ROLE</label>
                        <select
                            className="bg-[#0f172a] border border-[#334155] rounded px-3 py-2 text-[#e2e8f0] focus:outline-none focus:border-[#3b82f6]"
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                        >
                            <option value="USER">User</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </div>
                    <button type="submit" className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 rounded font-medium transition-colors">
                        Create User
                    </button>
                </form>
                {msg && <p className="text-sm mt-2 text-green-400">{msg}</p>}
            </div>

            {/* List */}
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#0f172a] border-b border-[#334155]">
                        <tr>
                            <th className="p-4 text-xs font-mono text-[#64748b]">ID</th>
                            <th className="p-4 text-xs font-mono text-[#64748b]">USERNAME</th>
                            <th className="p-4 text-xs font-mono text-[#64748b]">ROLE</th>
                            <th className="p-4 text-xs font-mono text-[#64748b]">CREATED</th>
                            <th className="p-4 text-xs font-mono text-[#64748b]">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]">
                        {loading && <tr><td colSpan={5} className="p-4 text-center text-[#94a3b8]">Loading...</td></tr>}
                        {!loading && users.map(user => (
                            <tr key={user.id} className="hover:bg-[#2d3a52] transition-colors">
                                <td className="p-4 text-sm text-[#94a3b8] font-mono">#{user.id}</td>
                                <td className="p-4 text-sm text-[#e2e8f0] font-bold">{user.username}</td>
                                <td className="p-4">
                                    <span className={`text-xs px-2 py-1 rounded font-mono ${user.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-4 text-sm text-[#94a3b8]">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="p-4 flex gap-2">
                                    <button
                                        onClick={() => startEdit(user)}
                                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user.id)}
                                        className="text-red-400 hover:text-red-300 text-sm font-medium"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal / Overlay */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] max-w-md w-full">
                        <h2 className="text-xl font-semibold mb-4 text-[#e2e8f0]">Edit User: {editingUser.username}</h2>

                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-mono text-[#64748b] mb-1">NEW PASSWORD (Leave blank to keep)</label>
                                <input
                                    type="text"
                                    className="w-full bg-[#0f172a] border border-[#334155] rounded px-3 py-2 text-[#e2e8f0] focus:outline-none focus:border-[#3b82f6]"
                                    value={editForm.password}
                                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                                    placeholder="New Password"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-mono text-[#64748b] mb-1">ROLE</label>
                                <select
                                    className="w-full bg-[#0f172a] border border-[#334155] rounded px-3 py-2 text-[#e2e8f0] focus:outline-none focus:border-[#3b82f6]"
                                    value={editForm.role}
                                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                                >
                                    <option value="USER">User</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>

                            {editMsg && <p className="text-red-400 text-sm">{editMsg}</p>}

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setEditingUser(null)}
                                    className="px-4 py-2 rounded text-[#94a3b8] hover:text-[#e2e8f0]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 rounded font-medium"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
