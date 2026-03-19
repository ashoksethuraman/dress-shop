import React from 'react';
import { FiInfo } from 'react-icons/fi';

export default function AboutPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-indigo-500"><FiInfo size={28} /></span>
        <h2 className="text-2xl font-bold text-primary">About</h2>
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-6 text-sm text-muted leading-relaxed">
        <p>This is a demo Dress Shop application built with React, TypeScript, Redux Toolkit, Firebase, and Tailwind CSS.</p>
        <p className="mt-3">It showcases a complete e-commerce flow: browse products, add to cart, place orders, and download receipts.</p>
      </div>
    </div>
  );
}
