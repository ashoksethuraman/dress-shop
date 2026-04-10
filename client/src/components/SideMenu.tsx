import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiShield, FiUser } from 'react-icons/fi';
import menuItems from '../data/menuItems';
import { useAppSelector } from '../store/hooks';

type Props = {
  mobileOpen?: boolean;
  onClose?: () => void;
  sideCollapsed?: boolean;
};

export default function SideMenu({ mobileOpen, onClose, sideCollapsed }: Props) {
  const location = useLocation();
  const user = useAppSelector((s) => s.user.user);

  // Desktop: 240px when expanded, 64px when collapsed; slide in from left on mobile
  const asideClass = [
    'fixed top-16 left-0 z-[100] bg-white border-r border-gray-200 shadow-sm',
    'flex flex-col h-[calc(100vh-4rem)] overflow-y-auto transition-all duration-300',
    'max-[991px]:w-60 max-[991px]:-translate-x-full max-[991px]:shadow-xl',
    mobileOpen ? 'max-[991px]:translate-x-0' : '',
    'min-[992px]:translate-x-0',
    sideCollapsed ? 'min-[992px]:w-16' : 'min-[992px]:w-60',
  ].join(' ');

  return (
    <>
      <aside className={asideClass}>
        {/* Nav links */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
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
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg no-underline transition-colors duration-150 text-sm font-medium',
                  active
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-500',
                  sideCollapsed ? 'min-[992px]:justify-center' : '',
                ].join(' ')}
              >
                <span className="shrink-0 text-[18px]"><m.Icon size={18} /></span>
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${sideCollapsed ? 'min-[992px]:hidden' : ''}`}>
                  {m.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer: Admin link (only for admin users) + Login */}
        <div className="p-3 border-t border-gray-100 shrink-0 flex flex-col gap-1">
          {user?.isAdmin && (
            <Link
              to="/admin"
              onClick={onClose}
              title="Admin"
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg no-underline transition-colors duration-150 text-sm font-medium',
                location.pathname === '/admin'
                  ? 'bg-indigo-50 text-indigo-600 font-semibold'
                  : 'text-purple-600 hover:bg-purple-50 hover:text-purple-700',
                sideCollapsed ? 'min-[992px]:justify-center' : '',
              ].join(' ')}
            >
              <span className="shrink-0 text-[18px]"><FiShield size={18} /></span>
              <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${sideCollapsed ? 'min-[992px]:hidden' : ''}`}>
                Admin Panel
              </span>
            </Link>
          )}
          {user ? (
            <Link
              to="/profile"
              onClick={onClose}
              title="Profile"
              className={[
                'flex items-center no-underline transition-all duration-300 text-sm font-medium',
                sideCollapsed
                  ? 'min-[992px]:justify-center min-[992px]:py-1.5 min-[992px]:px-0 gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100'
                  : 'gap-2 px-2 py-1.5 rounded-full border hover:bg-indigo-50',
                sideCollapsed
                  ? (location.pathname === '/profile' ? 'text-indigo-600 bg-indigo-50 font-semibold' : 'text-gray-700 hover:text-indigo-500')
                  : (location.pathname === '/profile' ? 'border-indigo-400 bg-indigo-50 text-indigo-600 font-semibold' : 'border-gray-200 hover:border-indigo-300 text-gray-700 hover:text-indigo-500'),
              ].join(' ')}
            >
              <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full overflow-hidden border-2 border-indigo-300 hover:border-indigo-500 transition-colors">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name || 'Avatar'} className="w-full h-full object-cover" />
                ) : user.name ? (
                  <span className="w-full h-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <span className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <FiUser size={16} className="text-gray-600" />
                  </span>
                )}
              </span>
              <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${sideCollapsed ? 'min-[992px]:hidden' : ''}`}>
                {user.name || 'Profile'}
              </span>
            </Link>
          ) : (
            <Link
              to="/auth"
              onClick={onClose}
              title="Login"
              className={[
                'flex items-center no-underline transition-all duration-300 text-sm font-medium text-gray-500',
                sideCollapsed
                  ? 'min-[992px]:justify-center min-[992px]:py-1.5 min-[992px]:px-0 gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 hover:text-indigo-500'
                  : 'gap-2 px-2 py-1.5 rounded-full border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-500',
              ].join(' ')}
            >
              <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full border-2 border-gray-300 hover:border-indigo-400 bg-gray-100 hover:bg-indigo-50 transition-colors overflow-hidden">
                <svg viewBox="0 0 80 80" fill="currentColor" className="w-5 h-5 text-gray-500">
                  <circle cx="40" cy="28" r="16" />
                  <path d="M10 68c0-16.569 13.431-30 30-30s30 13.431 30 30" />
                </svg>
              </span>
              <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${sideCollapsed ? 'min-[992px]:hidden' : ''}`}>
                Login
              </span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
