import React, { useState } from 'react';
import { FiMail, FiSend } from 'react-icons/fi';

export default function ContactUsPage() {
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-indigo-500"><FiMail size={28} /></span>
        <h2 className="text-2xl font-bold text-primary">Contact Us</h2>
      </div>

      {sent ? (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl px-6 py-8 text-center">
          <p className="text-lg font-semibold">Thanks for reaching out!</p>
          <p className="text-sm mt-1 text-green-600">We'll be in touch soon.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-4">
          <p className="text-sm text-muted">Have a question or feedback? Drop us a message below.</p>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={6}
            placeholder="Your message..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none transition-all"
          />
          <button
            onClick={() => setSent(true)}
            disabled={!msg.trim()}
            className="self-end flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FiSend size={14} /> Send
          </button>
        </div>
      )}
    </div>
  );
}
