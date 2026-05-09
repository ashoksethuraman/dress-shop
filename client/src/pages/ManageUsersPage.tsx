import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import {
  FiUsers, FiAlertCircle, FiCheckCircle, FiRefreshCw,
  FiShield, FiUser, FiToggleLeft, FiToggleRight, FiSearch,
  FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import { useAppSelector } from '../store/hooks';
import { adminUsersApi, type ManagedUser } from '../services/apiClient';

const PAGE_SIZE = 10;

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
  const currentUid = (user as any)?.uid ?? (user as any)?.id ?? '';
  const isAdmin = (user as any)?.role === 'admin' || (user as any)?.isAdmin === true;

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks uid of in-progress row action
  const [bulkLoading, setBulkLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);

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

  // ── Filtered list (must be before early returns) ──
  const filtered = useMemo(() => users.filter((u) => {
    const matchSearch =
      !search.trim() ||
      (u.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && u.isActive) ||
      (filterStatus === 'inactive' && !u.isActive);
    return matchSearch && matchStatus;
  }), [users, search, filterStatus]);

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); }, [search, filterStatus]);

  if (!user || user.isGuest) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Selection helpers (operate on current page only) ──
  const pageIds = paginated.map((u) => u.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id)) && !allPageSelected;

  const toggleAll = () => {
    if (allPageSelected) {
      setSelected((prev) => { const next = new Set(prev); pageIds.forEach((id) => next.delete(id)); return next; });
    } else {
      setSelected((prev) => new Set(Array.from(prev).concat(pageIds)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  // ── Bulk status update ──
  const handleStatusUpdate = async (isActive: boolean) => {
    const uids = Array.from(selected);
    if (uids.length === 0) return;
    setBulkLoading(true);
    try {
      const res = await adminUsersApi.updateStatus(uids, isActive);
      setUsers((prev) => prev.map((u) => (uids.includes(u.id) ? { ...u, isActive } : u)));
      setSelected(new Set());
      showToast(`${res.updated} user${res.updated !== 1 ? 's' : ''} ${isActive ? 'activated' : 'deactivated'} successfully.`, 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to update user status.', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  // ── Toggle admin role for a single user ──
  const handleToggleAdmin = async (targetUser: ManagedUser) => {
    if (targetUser.id === currentUid) return; // cannot change own role
    const makeAdmin = targetUser.role !== 'admin';
    setActionLoading(targetUser.id);
    try {
      await adminUsersApi.setAdmin(targetUser.id, makeAdmin);
      setUsers((prev) =>
        prev.map((u) => u.id === targetUser.id ? { ...u, role: makeAdmin ? 'admin' : 'user' } : u)
      );
      showToast(`${targetUser.username ?? targetUser.email} is now ${makeAdmin ? 'an Admin' : 'a regular User'}.`, 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to update role.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const selectedCount = selected.size;
  const canDeactivate = selectedCount > 0 && Array.from(selected).some((id) => users.find((u) => u.id === id)?.isActive);
  const canActivate   = selectedCount > 0 && Array.from(selected).some((id) => !users.find((u) => u.id === id)?.isActive);

  return (
    <div className="max-w-6xl g-white mx-auto px-6 sm:px-8 lg:px-12 py-6">
      <div className="max-w-6xl mx-auto">

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
            disabled={loading || bulkLoading}
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
            <button onClick={fetchUsers} className="ml-auto text-xs underline text-red-500 bg-transparent border-none cursor-pointer">Retry</button>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors capitalize cursor-pointer border-none
                  ${filterStatus === f ? 'bg-brand-border/20 text-brand-border' : 'bg-transparent text-gray-500 hover:bg-gray-100'}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Bulk action bar ── */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-3 bg-white border border-brand-border/40 rounded-xl px-4 py-3 mb-4 shadow-sm">
            <span className="text-sm font-medium text-gray-700">{selectedCount} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              {canActivate && (
                <button onClick={() => handleStatusUpdate(true)} disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 cursor-pointer border-none">
                  <FiToggleRight size={14} /> Activate
                </button>
              )}
              {canDeactivate && (
                <button onClick={() => handleStatusUpdate(false)} disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer border-none">
                  <FiToggleLeft size={14} /> Deactivate
                </button>
              )}
              <button onClick={() => setSelected(new Set())}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent">
                Clear
              </button>
            </div>
            {bulkLoading && <div className="ml-2 w-4 h-4 border-2 border-brand-border border-t-transparent rounded-full animate-spin" />}
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
                        checked={allPageSelected}
                        ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded accent-[#738A6E] cursor-pointer"
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">User</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Role</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Joined</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-500 text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((u, idx) => {
                    const isSelf = u.id === currentUid;
                    const isUserAdmin = u.role === 'admin';
                    const isRowLoading = actionLoading === u.id;
                    return (
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
                            <div className="w-9 h-9 rounded-full bg-brand-border/20 flex items-center justify-center text-brand-border font-bold text-sm shrink-0 relative">
                              {(u.username ?? u.email ?? '?').charAt(0).toUpperCase()}
                              {isSelf && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-brand-dark rounded-full border-2 border-white" title="You" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 leading-tight">
                                {u.username ?? '—'}
                                {isSelf && <span className="ml-1.5 text-[10px] text-brand-dark font-semibold">(You)</span>}
                              </p>
                              <p className="text-xs text-gray-400 md:hidden">{u.email ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{u.email ?? '—'}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {isUserAdmin ? (
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
                        <td className="px-4 py-3 text-right">
                          {isSelf ? (
                            <span className="text-xs text-gray-300 italic">—</span>
                          ) : (
                            <button
                              onClick={() => handleToggleAdmin(u)}
                              disabled={isRowLoading || bulkLoading}
                              title={isUserAdmin ? 'Remove Admin' : 'Make Admin'}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                                ${isUserAdmin
                                  ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                  : 'border-brand-border/50 text-brand-dark bg-brand/40 hover:bg-brand/70'}`}
                            >
                              {isRowLoading ? (
                                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              ) : isUserAdmin ? (
                                <><FiUser size={11} /> Remove Admin</>
                              ) : (
                                <><FiShield size={11} /> Make Admin</>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <p className="text-xs text-gray-400">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-white transition-colors"
              >
                <FiChevronLeft size={15} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium border transition-colors cursor-pointer
                        ${safePage === p ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-white transition-colors"
              >
                <FiChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── Footer count (no pagination) ── */}
        {!loading && filtered.length > 0 && totalPages <= 1 && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Showing {filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}

