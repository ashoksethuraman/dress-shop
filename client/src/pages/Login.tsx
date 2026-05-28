import React, { useState, useEffect, useRef } from 'react';
import { FiUser, FiLock, FiX } from 'react-icons/fi';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setUser } from '../store/userSlice';
import { authService } from '../services/authService';
import { authApi } from '../services/apiClient';
import { useNavigate, Link, useLocation } from 'react-router-dom';

export default function Login() {
  const location = useLocation();
  const signupSuccess = (location.state as any)?.signupSuccess === true;
  const signupEmail   = (location.state as any)?.email as string | undefined;

  const [username, setUsername] = useState(signupEmail ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [showSignupBanner, setShowSignupBanner] = useState(signupSuccess);
  const signupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear React Router location.state so a refresh / back-navigation doesn't re-show the banner
  useEffect(() => {
    if (signupSuccess) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss signup success banner after 30 s
  useEffect(() => {
    if (showSignupBanner) {
      signupTimerRef.current = setTimeout(() => setShowSignupBanner(false), 30_000);
    }
    return () => { if (signupTimerRef.current) clearTimeout(signupTimerRef.current); };
  }, [showSignupBanner]);

  // Clear banner as soon as the user starts getting an auth error
  useEffect(() => {
    if (alertMsg) setShowSignupBanner(false);
  }, [alertMsg]);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);
  const showEmailError = touched && username.length > 0 && !isValidEmail;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.user.user);

  // If already logged in (has id + role info), redirect to home
  useEffect(() => {
    if (user && user.id && !user.isGuest) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setAlertMsg(null);
    setLoading(true);
    try {
      const response = await authApi.login({ email: username, password });
      const userMeta = {
        id:      response.user.uid,
        name:    response.user.username || response.user.email || username,
        isGuest: false,
        isAdmin: response.user.role === 'admin',
      };
      authService.saveUserMeta(userMeta);
      dispatch(setUser(userMeta));

      // Navigate — localStorage cart/wishlist already hydrates Redux via preloadedState.
      // Backend sync will happen automatically when user interacts (add to cart / wishlist).
      navigate('/');
    } catch (e: any) {
      setAlertMsg(e?.body?.error ?? e?.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    const guestUser = authService.signInGuest();
    dispatch(setUser(guestUser));
    navigate('/');
  };

  return (
    <div className="min-h-[calc(100vh-132px)] sm:min-h-[calc(100vh-90px)] flex items-center justify-center bg-brand-border/10 px-4 py-8 overflow-x-hidden">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold text-primary text-center mb-1 tracking-tight">Halley Comet</h1>
        <p className="text-center text-sm text-gray-500 mb-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-brand-border font-semibold hover:underline">
            Sign up
          </Link>
        </p>

        {showSignupBanner && (
          <div className="mb-4 flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <span className="flex-1">Account created successfully. Please log in with your credentials.</span>
            <button
              type="button"
              onClick={() => setShowSignupBanner(false)}
              className="shrink-0 mt-0.5 text-green-500 hover:text-green-700 transition-colors"
              aria-label="Dismiss"
            >
              <FiX size={16} />
            </button>
          </div>
        )}

        {alertMsg && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{alertMsg}</p>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Email</label>
            <div className={`flex items-center border rounded-xl bg-gray-50 focus-within:ring-2 transition-all ${
              showEmailError
                ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-100'
                : 'border-gray-200 focus-within:border-brand-dark focus-within:ring-brand'
            }`}>
              <span className="pl-3 text-gray-400"><FiUser size={16} /></span>
              <input
                type="email"
                placeholder="you@example.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={() => setTouched(true)}
                disabled={loading}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-400"
              />
            </div>
            {showEmailError && (
              <p className="text-xs text-red-500 mt-1 ml-1">Please enter a valid email address.</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Password</label>
            <div className="flex items-center border border-gray-200 rounded-xl bg-gray-50 focus-within:border-brand-dark focus-within:ring-2 focus-within:ring-brand transition-all overflow-hidden">
              <span className="pl-3 text-gray-400 flex-shrink-0"><FiLock size={16} /></span>
              <input
                type="password"
                placeholder="Type your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-400 min-w-0"
              />
            </div>
          </div>

          <div className="text-right -mt-2">
            <a href="#forgot" className="text-xs text-brand-border hover:underline">Forgot password?</a>
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password || !isValidEmail}
            className="w-full py-2.5 rounded-xl bg-brand-dark hover:bg-brand-hover text-white font-bold text-sm tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'LOGGING IN...' : 'LOGIN'}
          </button>
        </form>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-brand-dark hover:bg-brand-hover text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
