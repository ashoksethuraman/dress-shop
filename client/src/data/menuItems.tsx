import { FiGrid, FiTrendingUp, FiInfo, FiTruck, FiMail, FiShoppingBag } from 'react-icons/fi';
import React from 'react';

const menuItems: { to: string; key: string; label: string; Icon: React.FC<any> }[] = [
  { to: '/',              key: 'home',        label: 'Home',         Icon: FiGrid },
  // { to: '/products',      key: 'shop',        label: 'Shop',         Icon: FiShoppingBag },
  { to: '/collections',   key: 'collections', label: 'Collections',  Icon: FiInfo },
  { to: '/best-sellers',  key: 'bestsellers', label: 'Best Sellers', Icon: FiTrendingUp },
  { to: '/about',         key: 'about',       label: 'Our Story',    Icon: FiInfo },
  { to: '/shipping',      key: 'shipping',    label: 'Shipping/Tracking', Icon: FiTruck },
  { to: '/contact',       key: 'contact',     label: 'Contact',      Icon: FiMail },
];

export default menuItems;
