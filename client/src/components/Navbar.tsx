import React, { useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiSearch, FiUser, FiShoppingCart, FiMenu, FiLogOut, FiHeart, FiX, FiUsers } from 'react-icons/fi';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../store/userSlice';
import { clearCart } from '../store/cartSlice';
import { clearWishlist } from '../store/wishlistSlice';
import { authService } from '../services/authService';
import { clearUserSession } from '../services/guestSession';
import { useClickOutside } from '../hooks/useClickOutside';

type Props = {
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  cartCount: number;
  user: any;
  bump: boolean;
  isAuthPage?: boolean;
};

export default function Navbar({ menuOpen, setMenuOpen, cartCount, user, bump, isAuthPage }: Props) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wishlistCount = useAppSelector((s) => s.wishlist.ids.length);
  const location = useLocation();
  const isWishlistActive = location.pathname === '/wishlist';
  const isCartActive = location.pathname === '/cart';
  const isUserActive = location.pathname === '/profile' || location.pathname === '/auth';

  useClickOutside(userMenuRef, () => setUserMenuOpen(false), userMenuOpen);
  useClickOutside(searchRef, () => { setSearchOpen(false); setSearchValue(''); }, searchOpen);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate(val.trim() ? `/?q=${encodeURIComponent(val.trim())}` : '/');
    }, 400);
  };

  const handleSearchToggle = () => {
    if (searchOpen) {
      setSearchOpen(false);
      setSearchValue('');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      navigate('/');
    } else {
      setSearchOpen(true);
    }
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    const isGuest = user?.isGuest;
    await authService.signOut();
    if (!isGuest) {
      clearUserSession();
      dispatch(clearCart());
      dispatch(clearWishlist());
    }
    dispatch(logout());
    navigate('/auth');
  };

  const handleToggle = () => setMenuOpen(!menuOpen);

  // Close menu when viewport changes
  useEffect(() => {
    const onResize = () => { if (menuOpen) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [menuOpen, setMenuOpen]);

  return (
    <>
      <header
        className="fixed top-0 inset-x-0 z-50 bg-white border-b border-brand-border"
      >
        {/* ── Main row ── */}
        <div className="h-[90px] flex items-center px-3 md:px-8 gap-2">

          {/* LEFT — hamburger + logo (mobile) / hamburger only (desktop) */}
          <div className="flex flex-1 items-center gap-2">
            {!isAuthPage && (
              <button
                onClick={handleToggle}
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
                className={`flex items-center justify-center w-9 h-9 rounded-lg border-none cursor-pointer transition-all duration-200 text-brand-border hover:bg-brand-border/25 active:bg-brand-border/40 ${menuOpen ? 'bg-brand-border/25' : 'bg-transparent'}`}
              >
                <FiMenu size={20} />
              </button>
            )}
            {/* Logo shown beside hamburger on mobile only */}
            <Link to="/" className="flex items-center no-underline sm:hidden" aria-label="Halley Comet Home">
              <img
                src="/app-logo.png"
                alt="Halley Comet"
                className="h-14 w-auto object-contain"
              />
            </Link>
          </div>

          {/* CENTER — brand (desktop only, hidden on mobile) */}
          <div className="hidden sm:flex flex-shrink-0 justify-center">
            <Link to="/" className="flex items-center justify-center no-underline" aria-label="Halley Comet Home">
              <img
                src="/app-logo.png"
                alt="Halley Comet"
                className="h-24 w-auto object-contain mt-1"
                style={{ maxWidth: '180px' }}
              />
            </Link>
          </div>

          {/* RIGHT — icons */}
          <div className="flex flex-1 items-center justify-end gap-0.5">

            {/* Search — desktop expandable pill */}
            <div
              ref={searchRef}
              className="hidden sm:flex items-center rounded-full gap-2 overflow-hidden transition-all duration-300"
              style={{
                background: searchOpen ? 'rgba(255,255,255,0.85)' : 'transparent',
                border: searchOpen ? '1px solid var(--brand-border)' : '1px solid transparent',
                width: searchOpen ? '260px' : '38px',
                padding: searchOpen ? '5px 12px' : '5px 9px',
              }}
            >
              {searchOpen && (
                <input
                  autoFocus
                  type="text"
                  placeholder="Search products..."
                  value={searchValue}
                  onChange={handleSearchChange}
                  className="bg-transparent outline-none flex-1 text-sm w-full text-primary"
                  onKeyDown={(e) => e.key === 'Escape' && handleSearchToggle()}
                />
              )}
              <button
                onClick={handleSearchToggle}
                className={`flex items-center justify-center border-none cursor-pointer p-0 shrink-0 transition-all rounded-full w-7 h-7 ${searchOpen ? 'bg-brand-border/35 text-brand-border' : 'bg-transparent text-brand-border hover:bg-brand-border/25 active:bg-brand-border/40'}`}
              >
                {searchOpen ? <FiX size={17} /> : <FiSearch size={18} />}
              </button>
            </div>

            {/* Wishlist */}
            {!isAuthPage && (
              <Link
                to="/wishlist"
                title="Wishlist"
                className={`relative flex items-center justify-center w-9 h-9 rounded-full no-underline transition-all ${isWishlistActive ? 'bg-brand-border/35 text-brand-border' : 'text-brand-border hover:bg-brand-border/25 active:bg-brand-border/40'}`}
              >
                <FiHeart size={18} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                    {wishlistCount > 9 ? '9+' : wishlistCount}
                  </span>
                )}
              </Link>
            )}

            {/* Cart */}
            {!isAuthPage && (
              <Link
                to="/cart"
                title="Cart"
                className={`relative flex items-center justify-center w-9 h-9 rounded-full no-underline transition-all ${isCartActive ? 'bg-brand-border/35 text-brand-border' : 'text-brand-border hover:bg-brand-border/25 active:bg-brand-border/40'}`}
              >
                <FiShoppingCart size={18} />
                {cartCount > 0 && (
                  <span
                    className={`cart-counter absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full ${bump ? 'bump' : ''}`}
                  >
                    {cartCount}
                  </span>
                )}
              </Link>
            )}

            {/* User */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  title={user.name || 'Account'}
                  className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden focus:outline-none cursor-pointer transition-all"
                  style={{ border: isUserActive ? '2px solid #738A6E' : '1.5px solid rgba(115,138,110,0.5)', background: isUserActive ? 'rgba(115,138,110,0.15)' : 'rgba(255,255,255,0.6)' }}
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name || 'Avatar'} className="w-full h-full object-cover" />
                  ) : user.name ? (
                    <span className="w-full h-full text-xs font-bold flex items-center justify-center text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <FiUser size={17} className="text-brand-border" />
                  )}
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-1 z-50 border border-border">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold truncate text-primary">{user.name || 'Account'}</p>
                      {user.isGuest && <p className="text-xs text-gray-400 mt-0.5">Guest user</p>}
                    </div>
                    <Link to="/profile" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm no-underline transition-colors hover:bg-gray-50 text-primary">
                      <FiUser size={14} /> Profile
                    </Link>
                    {(user.role === 'admin' || user.isAdmin) && (
                      <Link to="/admin/users" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm no-underline transition-colors hover:bg-gray-50 text-primary">
                        <FiUsers size={14} /> Manage Users
                      </Link>
                    )}
                    <button onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer">
                      <FiLogOut size={14} /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                title="Login"
                className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all no-underline ${isUserActive ? 'bg-brand-border/35 text-brand-border border-brand-border' : 'text-brand-border border-brand-border/60 hover:bg-brand-border/25 active:bg-brand-border/40'}`}
              >
                <FiUser size={17} />
              </Link>
            )}
          </div>
        </div>

        {/* ── Mobile search bar (below main row, visible on small screens only) ── */}
        {!isAuthPage && (
          <div className="sm:hidden px-3 pb-2.5">
            <div className="flex items-center gap-2 bg-white/70 border border-brand-border rounded-full px-3 py-1.5">
              <FiSearch size={14} className="text-brand-border flex-shrink-0" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchValue}
                onChange={handleSearchChange}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setSearchValue(''); navigate('/'); }
                }}
                className="bg-transparent outline-none flex-1 text-sm text-primary placeholder-gray-400"
              />
              {searchValue && (
                <button
                  onClick={() => { setSearchValue(''); navigate('/'); }}
                  className="flex-shrink-0 text-gray-400 hover:text-primary border-none bg-transparent cursor-pointer p-0"
                >
                  <FiX size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile overlay removed — handled by SideMenu backdrop */}
    </>
  );
}
