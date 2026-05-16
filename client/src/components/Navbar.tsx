import React, { useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiSearch, FiUser, FiShoppingCart, FiMenu, FiLogOut, FiHeart, FiX, FiUsers } from 'react-icons/fi';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../store/userSlice';
import { clearCart } from '../store/cartSlice';
import { clearWishlist } from '../store/wishlistSlice';
import { authService } from '../services/authService';
import { authApi } from '../services/apiClient';
import { clearUserSession } from '../services/guestSession';
import { useClickOutside } from '../hooks/useClickOutside';
import SearchDropdown from './SearchDropdown';

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
  useClickOutside(searchRef, handleCloseSearch, searchOpen);

  function handleCloseSearch() {
    setSearchOpen(false);
    setSearchValue('');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    if (!searchOpen) setSearchOpen(true);
  };

  const handleSearchToggle = () => {
    if (searchOpen) {
      handleCloseSearch();
    } else {
      setSearchOpen(true);
    }
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    const isGuest = user?.isGuest;
    // Tell the server to clear the HttpOnly __session and XSRF-TOKEN cookies
    if (!isGuest) {
      await authApi.logout().catch(() => { /* best-effort */ });
    }
    authService.signOut();
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
        className="fixed top-0 inset-x-0 z-50 bg-[#D9B3AF]"
      >
        {/* ── Main row ── */}
        <div className="max-w-6xl mx-auto w-full h-[100px] flex items-center px-6 sm:px-8 lg:px-12 gap-3 justify-between">

          {/* LEFT — hamburger button */}
          <div className="flex items-center">
            {!isAuthPage && (
              <button
                onClick={handleToggle}
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
                className={`flex items-center justify-center w-10 h-10 rounded-lg cursor-pointer transition-all duration-200 ${menuOpen ? 'bg-black/10 text-[#1a1a1a]' : 'bg-transparent text-[#1a1a1a] hover:bg-black/5 active:bg-black/10'}`}
              >
                <FiMenu size={22} />
              </button>
            )}
          </div>

          {/* CENTER — brand + primary links */}
          <div className="flex-1 flex items-center justify-center">
            <Link to="/" className="flex items-center justify-center no-underline" aria-label="Halley Comet Home">
              <img
                src="/halley-comet-logo.png"
                alt="Halley Comet"
                className="h-18 w-auto object-contain"
                style={{ maxWidth: '160px' }}
              />
            </Link>
            {/* <nav className="hidden md:flex items-center gap-10 ml-12 text-sm font-semibold text-[#1a1a1a]">
              <Link
                to="/"
                className={`transition pb-1 border-b-2 ${location.pathname === '/' ? 'border-black text-black' : 'border-transparent text-black/70 hover:text-black'}`}
              >
                Home
              </Link>
              <Link
                to="/products"
                className={`transition pb-1 border-b-2 ${location.pathname === '/products' || location.pathname === '/collections' ? 'border-black text-black' : 'border-transparent text-black/70 hover:text-black'}`}
              >
                Shop
              </Link>
              <Link
                to="/collections"
                className={`transition pb-1 border-b-2 ${location.pathname === '/collections' ? 'border-black text-black' : 'border-transparent text-black/70 hover:text-black'}`}
              >
                Collections
              </Link>
            </nav> */}
          </div>

          {/* RIGHT — icons */}
          <div className="flex items-center justify-end gap-1">

            {/* Search — desktop icon button */}
            <button
              onClick={handleSearchToggle}
              className={`hidden sm:flex items-center justify-center w-10 h-10 rounded-lg transition-all ${searchOpen ? 'bg-black/10 text-[#1a1a1a]' : 'bg-transparent text-[#1a1a1a] hover:bg-black/5 active:bg-black/10'}`}
              title="Search"
            >
              <FiSearch size={20} />
            </button>

            {/* Wishlist */}
            {!isAuthPage && (
              <Link
                to="/wishlist"
                title="Wishlist"
                className={`relative flex items-center justify-center w-10 h-10 rounded-lg no-underline transition-all ${isWishlistActive ? 'bg-black/10 text-[#1a1a1a]' : 'bg-transparent text-[#1a1a1a] hover:bg-black/5 active:bg-black/10'}`}
              >
                <FiHeart size={18} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#1a1a1a] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
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
                className={`relative flex items-center justify-center w-10 h-10 rounded-lg no-underline transition-all ${isCartActive ? 'bg-black/10 text-[#1a1a1a]' : 'bg-transparent text-[#1a1a1a] hover:bg-black/5 active:bg-black/10'}`}
              >
                <FiShoppingCart size={18} />
                {cartCount > 0 && (
                  <span
                    className={`cart-counter absolute -top-1 -right-1 bg-[#1a1a1a] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${bump ? 'bump' : ''}`}
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
                  className="flex items-center justify-center w-10 h-10 rounded-lg overflow-hidden focus:outline-none cursor-pointer transition-all"
                  style={{ background: isUserActive ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)' }}
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name || 'Avatar'} className="w-full h-full object-cover" />
                  ) : user.name ? (
                    <span className="w-full h-full text-xs font-bold flex items-center justify-center text-[#1a1a1a]">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <FiUser size={17} className="text-[#1a1a1a]" />
                  )}
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-1 z-50 border border-black/10">
                    <div className="px-4 py-3 border-b border-black/10">
                      <p className="text-sm font-semibold truncate text-[#1a1a1a]">{user.name || 'Account'}</p>
                      {user.isGuest && <p className="text-xs text-gray-400 mt-0.5">Guest user</p>}
                    </div>
                    <Link to="/profile" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm no-underline transition-colors hover:bg-gray-50 text-[#1a1a1a]">
                      <FiUser size={14} /> Profile
                    </Link>
                    {(user.role === 'admin' || user.isAdmin) && (
                      <Link to="/admin/users" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm no-underline transition-colors hover:bg-gray-50 text-[#1a1a1a]">
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
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all no-underline ${isUserActive ? 'bg-black/10 text-[#1a1a1a]' : 'bg-transparent text-[#1a1a1a] hover:bg-black/5 active:bg-black/10'}`}
              >
                <FiUser size={17} />
              </Link>
            )}
          </div>
        </div>

        {/* ── Mobile search button (below main row, visible on small screens only) ── */}
        {!isAuthPage && (
          <div className="sm:hidden px-4 pb-3">
            <button
              onClick={handleSearchToggle}
              className="w-full flex items-center gap-2 bg-black/5 border border-black/15 rounded-lg px-3 py-2.5 text-left hover:bg-black/10 transition-colors"
            >
              <FiSearch size={16} className="text-[#1a1a1a] flex-shrink-0" />
              <span className="text-sm text-black/40">Search products...</span>
            </button>
          </div>
        )}
      </header>

      {/* Search Overlay Panel */}
      {searchOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            onClick={handleCloseSearch}
          />
          
          {/* Search Panel */}
          <div className="fixed top-0 left-0 right-0 z-[70] pt-[90px]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div 
                ref={searchRef}
                className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-slideDown"
              >
                {/* Search Input Section */}
                <div className="p-6 bg-gradient-to-r from-[#f5e6e4] to-[#f9ebe9] border-b border-gray-200">
                  {/* Header with title and close button */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-[#1a1a1a]">Search Collections</h2>
                    <button
                      onClick={handleCloseSearch}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/5 hover:bg-black/10 active:bg-black/15 transition-all duration-200 text-[#1a1a1a]"
                      aria-label="Close search"
                      title="Close search"
                    >
                      <FiX size={20} />
                    </button>
                  </div>
                  
                  {/* Search Input */}
                  <div className="relative">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search for products, brands, categories..."
                      value={searchValue}
                      onChange={handleSearchChange}
                      onKeyDown={(e) => e.key === 'Escape' && handleCloseSearch()}
                      className="w-full px-6 py-4 pr-12 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9B3AF] focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <FiSearch size={24} />
                    </div>
                  </div>
                </div>
                
                {/* Results Section */}
                <SearchDropdown
                  searchQuery={searchValue}
                  isOpen={true}
                  onClose={handleCloseSearch}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
