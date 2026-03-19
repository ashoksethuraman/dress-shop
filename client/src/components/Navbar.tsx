import React from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiUser, FiHeart, FiShoppingCart, FiLogIn, FiMenu } from 'react-icons/fi';

type Props = {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  cartCount: number;
  user: any;
  bump: boolean;
  sideCollapsed: boolean;
  toggleSide: () => void;
};

export default function Navbar({ mobileOpen, setMobileOpen, cartCount, user, bump, sideCollapsed, toggleSide }: Props) {
  const isMenuOpen = mobileOpen || !sideCollapsed;

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
            {[
              { to: '#profile', icon: <FiUser size={18} />, label: 'Profile' },
              { to: '#wishlist', icon: <FiHeart size={18} />, label: 'Wishlist' },
            ].map(({ to, icon, label }) => (
              <Link key={label} to={to} title={label}
                className="flex items-center justify-center w-9 h-9 rounded-full text-gray-700 hover:bg-gray-100 hover:text-indigo-500 transition-colors no-underline">
                {icon}
              </Link>
            ))}

            <Link to="/cart" title="Cart"
              className="relative flex items-center justify-center w-9 h-9 rounded-full text-gray-700 hover:bg-gray-100 hover:text-indigo-500 transition-colors no-underline">
              <FiShoppingCart size={18} />
              {cartCount > 0 && (
                <span className={`cart-counter absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${bump ? 'bump' : ''}`}>
                  {cartCount}
                </span>
              )}
            </Link>

            {user
              ? <span className="text-xs font-semibold text-gray-800 max-w-[100px] truncate">{user.name}</span>
              : <Link to="/auth" title="Login"
                  className="flex items-center justify-center w-9 h-9 rounded-full text-gray-700 hover:bg-gray-100 hover:text-indigo-500 transition-colors no-underline">
                  <FiLogIn size={18} />
                </Link>
            }
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
}
