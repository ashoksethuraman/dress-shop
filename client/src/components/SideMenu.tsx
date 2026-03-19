import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiLogIn, FiShield } from 'react-icons/fi';
import menuItems from '../data/menuItems';
import { useAppSelector } from '../store/hooks';

type Props = {
  mobileOpen?: boolean;
  onClose?: () => void;
  sideCollapsed?: boolean;
  toggleSide?: () => void;
};

export default function SideMenu({ mobileOpen, onClose, sideCollapsed }: Props) {
  const location = useLocation();
  const user = useAppSelector((s) => s.user.user);

  // Desktop: 240px when expanded, 64px when collapsed; slide in from left on mobile
  const asideClass = [
    'fixed top-16 left-0 z-[100] bg-white border-r border-gray-200 shadow-sm',
    'flex flex-col h-[calc(100vh-4rem)] overflow-y-auto transition-all duration-300',
    // Mobile: hidden (off-screen) unless mobileOpen
    'max-[991px]:w-60 max-[991px]:-translate-x-full max-[991px]:shadow-xl',
    mobileOpen ? 'max-[991px]:translate-x-0' : '',
    // Desktop: full vs collapsed width
    'min-[992px]:translate-x-0',
    sideCollapsed ? 'min-[992px]:w-16' : 'min-[992px]:w-60',
  ].join(' ');

  return (
    <>
      <aside className={asideClass}>
        {/* Header label (only visible when expanded on desktop) */}
        {/* <div className="flex items-center h-12 px-4 border-b border-gray-100 shrink-0">
          <span className={`text-xs font-bold uppercase tracking-widest text-gray-400 transition-opacity duration-200 ${sideCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            Menu
          </span>
        </div> */}

        {/* Nav links */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {menuItems.map((m) => {
            const active = location.pathname === m.to;
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
          <Link
            to="/auth"
            onClick={onClose}
            title="Login"
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg no-underline transition-colors duration-150 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-indigo-500',
              sideCollapsed ? 'min-[992px]:justify-center' : '',
            ].join(' ')}
          >
            <span className="shrink-0 text-[18px]"><FiLogIn size={18} /></span>
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${sideCollapsed ? 'min-[992px]:hidden' : ''}`}>
              {user ? user.name : 'Login'}
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}
