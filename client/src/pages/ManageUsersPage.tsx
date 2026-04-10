import React, { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
  FiUsers, FiAlertCircle, FiCheckCircle, FiRefreshCw,
  FiShield, FiUser, FiToggleLeft, FiToggleRight, FiSearch,
} from 'react-icons/fi';
import { useAppSelector } from '../store/hooks';
import { adminUsersApi, type ManagedUser } from '../services/apiClient';

// ─── Status badge ────────────────────────────────────────────────────────────
function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
      Inactive
    </span>
  );
}

// ─── Toast notification ──────────────────────────────────────────────────────
function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border text-sm font-medium transition-all animate-slide-up
        ${type === 'success'
          ? 'bg-white border-green-200 text-green-700'
          : 'bg-white border-red-200 text-red-600'}`}
    >
      {type === 'success'
        ? <FiCheckCircle size={18} className="shrink-0 text-green-500" />
        : <FiAlertCircle size={18} className="shrink-0 text-red-400" />}
      {message}
      <button
        onClick={onDismiss}
        className="ml-2 text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer p-0 leading-none"
        aria-label="Dismiss"
      >✕</button>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function ManageUsersPage() {
  const user = useAppSelector((s) => s.user.user);
  const isAdmin = (user as any)?.role === 'admin' || (user as any)?.isAdmin === true;

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setSelected(new Set());
    try {
      const res = await adminUsersApi.getAll();
      setUsers(res.users);
    } catch (err: any) {
      setFetchError(err?.message ?? 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  if (!user || user.isGuest) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  // ── Filtered list ──
  const filtered = users.filter((u) => {
    const matchSearch =
      !search.trim() ||
      (u.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && u.isActive) ||
      (filterStatus === 'inactive' && !u.isActive);
    return matchSearch && matchStatus;
  });

  // ── Selection helpers ──
  const allFilteredIds = filtered.map((u) => u.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const someSelected = allFilteredIds.some((id) => selected.has(id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set(Array.from(prev).concat(allFilteredIds)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Bulk status update ──
  const handleStatusUpdate = async (isActive: boolean) => {
    const uids = Array.from(selected);
    if (uids.length === 0) return;

    setActionLoading(true);
    try {
      const res = await adminUsersApi.updateStatus(uids, isActive);
      setUsers((prev) =>
        prev.map((u) => (uids.includes(u.id) ? { ...u, isActive } : u))
      );
      setSelected(new Set());
      showToast(
        `${res.updated} user${res.updated !== 1 ? 's' : ''} ${isActive ? 'activated' : 'deactivated'} successfully.`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to update user status.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedCount = selected.size;
  const canDeactivate = selectedCount > 0 && Array.from(selected).some((id) => users.find((u) => u.id === id)?.isActive);
  const canActivate   = selectedCount > 0 && Array.from(selected).some((id) => !users.find((u) => u.id === id)?.isActive);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand via-white to-brand-bg px-4 py-8">
      <div className="max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-border/20 flex items-center justify-center">
              <FiUsers size={20} className="text-brand-border" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Manage Users</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? 'Loading…' : `${users.length} registered user${users.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading || actionLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-brand-border/50 text-brand-border bg-white hover:bg-brand/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* ── Fetch error ── */}
        {fetchError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-600">
            <FiAlertCircle size={18} className="shrink-0" />
            {fetchError}
            <button
              onClick={fetchUsers}
              className="ml-auto text-xs underline text-red-500 bg-transparent border-none cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
            <FiSearch size={15} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
          {/* Status filter */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors capitalize cursor-pointer border-none
                  ${filterStatus === f
                    ? 'bg-brand-border/20 text-brand-border'
                    : 'bg-transparent text-gray-500 hover:bg-gray-100'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ── Bulk action bar ── */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-3 bg-white border border-brand-border/40 rounded-xl px-4 py-3 mb-4 shadow-sm animate-fade-in">
            <span className="text-sm font-medium text-gray-700">
              {selectedCount} selected
            </span>
            <div className="flex items-center gap-2 ml-auto">
              {canActivate && (
                <button
                  onClick={() => handleStatusUpdate(true)}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
                >
                  <FiToggleRight size={14} />
                  Activate
                </button>
              )}
              {canDeactivate && (
                <button
                  onClick={() => handleStatusUpdate(false)}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
                >
                  <FiToggleLeft size={14} />
                  Deactivate
                </button>
              )}
              <button
                onClick={() => setSelected(new Set())}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent"
              >
                Clear
              </button>
            </div>
            {actionLoading && (
              <div className="ml-2 w-4 h-4 border-2 border-brand-border border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        )}

        {/* ── Table card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-2 border-brand-border border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading users…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
              <FiUsers size={36} />
              <p className="text-sm">No users found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected; }}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded accent-[#738A6E] cursor-pointer"
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">User</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Role</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, idx) => (
                    <tr
                      key={u.id}
                      className={`border-b border-gray-50 transition-colors ${selected.has(u.id) ? 'bg-brand/20' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-brand/10`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(u.id)}
                          onChange={() => toggleOne(u.id)}
                          className="w-4 h-4 rounded accent-[#738A6E] cursor-pointer"
                          aria-label={`Select ${u.username ?? u.email}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-border/20 flex items-center justify-center text-brand-border font-bold text-xs shrink-0">
                            {(u.username ?? u.email ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{u.username ?? '—'}</p>
                            <p className="text-xs text-gray-400 md:hidden">{u.email ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{u.email ?? '—'}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark bg-brand border border-brand-border rounded-full px-2 py-0.5">
                            <FiShield size={10} /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                            <FiUser size={10} /> User
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge isActive={u.isActive} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer count ── */}
        {!loading && filtered.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Showing {filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
