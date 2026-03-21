import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSearch, FiUser, FiShoppingCart, FiLogIn, FiMenu, FiLogOut } from 'react-icons/fi';
import { useAppDispatch } from '../store/hooks';
import { logout } from '../store/userSlice';
import { authService } from '../services/authService';
import { useClickOutside } from '../hooks/useClickOutside';

type Props = {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  cartCount: number;
  user: any;
  bump: boolean;
  sideCollapsed: boolean;
  toggleSide: () => void;
  isAuthPage?: boolean;
};

export default function Navbar({ mobileOpen, setMobileOpen, cartCount, user, bump, sideCollapsed, toggleSide, isAuthPage }: Props) {
  const isMenuOpen = mobileOpen || !sideCollapsed;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const handleLogout = async () => {
    setMenuOpen(false);
    await authService.signOut();
    dispatch(logout());
    navigate('/auth');
  };

  const handleToggle = () => {
    if (window.innerWidth >= 992) {
      toggleSide();
    } else {
      setMobileOpen(!mobileOpen);
    }
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-gray-200 shadow-sm h-16 flex items-center">
        <div className="w-full max-w-screen-xl mx-auto flex items-center justify-between px-4 gap-3">

          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggle}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 border-none cursor-pointer
                ${isMenuOpen
                  ? 'bg-indigo-100 text-indigo-600 shadow-md rotate-90'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <FiMenu size={20} />
            </button>
            <Link to="/" className="text-xl font-extrabold text-primary no-underline tracking-tight">
              Dress Shop
            </Link>
          </div>

          {/* Centre nav (hidden on mobile) */}
          <nav className="hidden md:flex gap-6 items-center text-sm font-semibold text-gray-700">
            <Link to="/" className="hover:text-indigo-500 transition-colors">Women</Link>
            <Link to="/" className="hover:text-indigo-500 transition-colors">Men</Link>
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="hidden sm:flex items-center bg-gray-100 rounded-full px-3 py-2 gap-2 text-sm text-gray-500 w-48">
              <input
                type="text"
                placeholder="Search dresses..."
                className="bg-transparent outline-none flex-1 text-sm text-gray-800 placeholder-gray-400"
              />
              <FiSearch size={14} />
            </div>

            {/* Icons */}

            <Link to="/cart" title="Cart"
              className="relative flex items-center justify-center w-9 h-9 rounded-full text-gray-700 hover:bg-gray-100 hover:text-indigo-500 transition-colors no-underline">
              <FiShoppingCart size={18} />
              {cartCount > 0 && (
                <span className={`cart-counter absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${bump ? 'bump' : ''}`}>
                  {cartCount}
                </span>
              )}
            </Link>

            {/* User avatar / login */}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  title={user.name || 'Account'}
                  className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden border-2 border-indigo-300 hover:border-indigo-500 transition-colors focus:outline-none cursor-pointer"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name || 'Avatar'} className="w-full h-full object-cover" />
                  ) : user.name ? (
                    <span className="w-full h-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <span className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <FiUser size={18} className="text-gray-600" />
                    </span>
                  )}
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-800 truncate">{user.name || 'Account'}</p>
                      {user.isGuest && <p className="text-xs text-gray-400 mt-0.5">Guest user</p>}
                    </div>
                    <Link to="/profile" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 no-underline transition-colors">
                      <FiUser size={14} />
                      Profile
                    </Link>
                    <button onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer">
                      <FiLogOut size={14} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/auth" title="Login"
                className="flex items-center justify-center w-9 h-9 rounded-full text-gray-700 hover:bg-gray-100 hover:text-indigo-500 transition-colors no-underline">
                <FiLogIn size={18} />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile overlay — hidden on auth page */}
      {mobileOpen && !isAuthPage && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
}
