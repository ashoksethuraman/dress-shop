import React, { useState } from 'react';
import { FiUser, FiLock } from 'react-icons/fi';
import { useAppDispatch } from '../store/hooks';
import { setUser } from '../store/userSlice';
import { authService } from '../services/authService';
import { useNavigate } from 'react-router-dom';

export default function AuthLandingPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fbUser = await authService.signInGuest(username || 'User');
      if (fbUser) {
        dispatch(setUser({
          id: fbUser.uid,
          name: username || 'User',
          isGuest: fbUser.isAnonymous,
          isAdmin: username.toLowerCase() === 'admin',
        }));
        navigate('/');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const fbUser = await authService.signInGuest('Guest');
      if (fbUser) {
        dispatch(setUser({ id: fbUser.uid, name: 'Guest', isGuest: fbUser.isAnonymous }));
        navigate('/');
      }
    } catch (e: any) {
      setError(e.message || 'Guest login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-extrabold text-primary text-center mb-6 tracking-tight">Welcome Back</h1>

        {error && (
          <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Username</label>
            <div className="flex items-center border border-gray-200 rounded-xl bg-gray-50 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <span className="pl-3 text-gray-400"><FiUser size={16} /></span>
              <input
                type="text"
                placeholder="Type your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Password</label>
            <div className="flex items-center border border-gray-200 rounded-xl bg-gray-50 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <span className="pl-3 text-gray-400"><FiLock size={16} /></span>
              <input
                type="password"
                placeholder="Type your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-400"
              />
            </div>
          </div>

          <div className="text-right -mt-2">
            <a href="#forgot" className="text-xs text-indigo-500 hover:underline">Forgot password?</a>
          </div>

          <button
            type="submit"
            disabled={loading || !username}
            className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'LOGGING IN...' : 'LOGIN'}
          </button>
        </form>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full py-2.5 rounded-xl border-2 border-indigo-300 text-indigo-600 font-semibold text-sm hover:bg-indigo-50 disabled:opacity-50 transition-colors"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
