import React, { useState, useEffect } from 'react';
import { FiUser, FiLock } from 'react-icons/fi';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setUser } from '../store/userSlice';
import { addToCart } from '../store/cartSlice';
import { setWishlist } from '../store/wishlistSlice';
import { authService } from '../services/authService';
import { authApi, userApi } from '../services/apiClient';
import { useNavigate, Link } from 'react-router-dom';
import Alert, { AlertType } from '../components/Alert';
import { loadCart, loadWishlist } from '../services/guestSession';

interface AlertState { type: AlertType; message: string; }

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [touched, setTouched] = useState(false);

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
    setAlert(null);
    setLoading(true);
    try {
      const response = await authApi.login({ email: username, password });
      authService.setCustomJwt(response.token);
      dispatch(setUser({
        id:      response.user.uid,
        name:    response.user.username || response.user.email || username,
        isGuest: false,
        isAdmin: response.user.role === 'admin',
      }));

      // Load backend cart + wishlist, merge with any local items
      try {
        const [backendCart, backendWishlist] = await Promise.all([
          userApi.getCart(),
          userApi.getWishlist(),
        ]);

        // Merge: backend wins for qty; local items not in backend are added
        const localCart = loadCart();
        const mergedMap = new Map<string, { productId: string; qty: number; size: string | null }>();
        for (const item of backendCart.cart) {
          mergedMap.set(`${item.productId}__${item.size ?? ''}`, { ...item, size: item.size ?? null });
        }
        for (const item of localCart) {
          const key = `${item.productId}__${item.size ?? ''}`;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, { productId: item.productId, qty: item.qty, size: item.size ?? null });
          }
        }
        Array.from(mergedMap.values()).forEach((item) => {
          dispatch(addToCart({ productId: item.productId, title: '', price: 0, qty: item.qty, size: item.size }));
        });

        // Merge wishlist: union of backend + local
        const localWishlist = loadWishlist();
        const merged = Array.from(new Set([...backendWishlist.wishlist, ...localWishlist]));
        dispatch(setWishlist(merged));
      } catch {
        // non-fatal — localStorage state is already loaded
      }

      navigate('/');
    } catch (e: any) {
      setAlert({ type: 'error', message: e?.body?.error ?? e?.message ?? 'Login failed. Please try again.' });
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-extrabold text-primary text-center mb-1 tracking-tight">Welcome App</h1>
        <p className="text-center text-sm text-gray-500 mb-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-indigo-500 font-semibold hover:underline">
            Sign up
          </Link>
        </p>

        {alert && (
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Email</label>
            <div className={`flex items-center border rounded-xl bg-gray-50 focus-within:ring-2 transition-all ${
              showEmailError
                ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-100'
                : 'border-gray-200 focus-within:border-indigo-400 focus-within:ring-indigo-100'
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
            disabled={loading || !username || !password || !isValidEmail}
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
