import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiShield, FiUser, FiX } from 'react-icons/fi';
import menuItems from '../data/menuItems';
import { useAppSelector } from '../store/hooks';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SideMenu({ isOpen, onClose }: Props) {
  const location = useLocation();
  const user = useAppSelector((s) => s.user.user);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[99] bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 z-[100] bg-white flex flex-col w-64
          h-screen overflow-y-auto
          border-r border-brand-border shadow-2xl
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header: dark user banner with close button */}
        <div className="shrink-0 bg-primary flex items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden border-2 border-white/30 bg-white/10 shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.name || 'Avatar'} className="w-full h-full object-cover" />
              ) : user?.name ? (
                <span className="text-sm font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <FiUser size={18} className="text-white/70" />
              )}
            </div>
            <div>
              {user && !user.isGuest ? (
                <>
                  <p className="text-[11px] text-white/60 font-medium leading-none mb-0.5">Hello,</p>
                  <p className="text-sm font-bold text-white leading-none truncate max-w-[140px]">{user.name || 'Account'}</p>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-white/60 font-medium leading-none mb-0.5">Hello,</p>
                  <Link to="/auth" onClick={onClose} className="text-sm font-bold text-white no-underline hover:underline leading-none">
                    {user?.isGuest ? 'Guest' : 'Sign In'}
                  </Link>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors bg-transparent cursor-pointer"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-0.5 p-2 flex-1">
          {menuItems.map((m) => {
            const [mPath, mSearch = ''] = m.to.split('?');
            const isAllProductsWithoutFilter = m.key === 'all-products' && !location.search.includes('filter=');
            const active =
              location.pathname === mPath &&
              (mSearch ? location.search === `?${mSearch}` : location.search === '' || isAllProductsWithoutFilter);
            return (
              <Link
                key={m.key}
                to={m.to}
                onClick={onClose}
                title={m.label}
                style={active ? { background: 'rgba(115,138,110,0.15)', fontWeight: 600 } : {}}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg no-underline transition-all duration-150 text-sm hover:bg-brand-border/10 ${
                  active ? 'text-primary' : 'text-brand-border'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-brand-border" />
                )}
                <span className="shrink-0"><m.Icon size={17} /></span>
                <span className="whitespace-nowrap text-sm font-medium">{m.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 shrink-0 border-t border-brand-border">
          {user?.isAdmin && (
            <Link
              to="/admin"
              onClick={onClose}
              title="Admin"
              style={location.pathname === '/admin' ? { background: 'rgba(115,138,110,0.15)', fontWeight: 600 } : {}}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg no-underline transition-all duration-150 text-sm mb-1 hover:bg-brand-border/10 ${
                location.pathname === '/admin' ? 'text-primary' : 'text-brand-border'
              }`}
            >
              <span className="shrink-0"><FiShield size={17} /></span>
              <span className="whitespace-nowrap text-sm font-medium">Admin Panel</span>
            </Link>
          )}

          {user && !user.isGuest ? (
            <Link
              to="/profile"
              onClick={onClose}
              title={user.name || 'Profile'}
              className="flex items-center gap-3 px-2 py-2 rounded-lg no-underline transition-all duration-150 hover:bg-brand-border/10"
              style={location.pathname === '/profile' ? { background: 'rgba(115,138,110,0.15)' } : {}}
            >
              <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full overflow-hidden border-2 border-brand-border">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name || 'Avatar'} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full text-xs font-bold flex items-center justify-center bg-brand-dark text-white">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <div>
                <p className="text-xs font-semibold truncate max-w-[140px] text-primary">{user.name || 'My Account'}</p>
                <p className="text-[10px] text-muted">View Profile</p>
              </div>
            </Link>
          ) : (
            <Link
              to="/auth"
              onClick={onClose}
              title="Login"
              className="flex items-center gap-3 px-2 py-2 rounded-lg no-underline transition-all duration-150 hover:bg-brand-border/10"
            >
              <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full border-2 border-brand-border">
                <FiUser size={15} className="text-brand-border" />
              </span>
              <span className="text-sm font-medium text-brand-border">Login</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
