import { FiHome, FiInfo, FiTruck, FiMail } from 'react-icons/fi';
import React from 'react';

const menuItems: { to: string; key: string; label: string; Icon: React.FC<any> }[] = [
  { to: '/', key: 'home', label: 'Home', Icon: FiHome },
  { to: '/about', key: 'about', label: 'About', Icon: FiInfo },
  { to: '/shipping', key: 'shipping', label: 'Shipping/Tracking', Icon: FiTruck },
  { to: '/contact', key: 'contact', label: 'Contact', Icon: FiMail },
];

export default menuItems;
