import { FiGrid, FiTrendingUp, FiInfo, FiTruck, FiMail } from 'react-icons/fi';
import React from 'react';

const menuItems: { to: string; key: string; label: string; Icon: React.FC<any> }[] = [
  { to: '/',                    key: 'all-products',  label: 'All Products',  Icon: FiGrid },
  { to: '/?filter=bestsellers', key: 'bestsellers',   label: 'Best Sellers',  Icon: FiTrendingUp },
  { to: '/about',               key: 'about',         label: 'Our Story',         Icon: FiInfo },
  { to: '/shipping',            key: 'shipping',      label: 'Shipping/Tracking', Icon: FiTruck },
  { to: '/contact',             key: 'contact',       label: 'Contact',       Icon: FiMail },
];

export default menuItems;
