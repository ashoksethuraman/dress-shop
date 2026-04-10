import React from 'react';
import { FiAlertTriangle, FiAlertCircle, FiCheckCircle, FiX, FiShoppingCart } from 'react-icons/fi';

export type AlertModalType = 'error' | 'warning' | 'success';

interface AlertModalProps {
  /** Modal heading */
  title: string;
  /** One bullet line per message */
  messages: string[];
  /** Icon / colour theme — defaults to 'warning' */
  type?: AlertModalType;
  /** Called when backdrop, × button, or Dismiss is clicked */
  onClose: () => void;
  /** Optional primary CTA label (e.g. "Go to Cart") */
  actionLabel?: string;
  /** Called when the primary CTA is clicked */
  onAction?: () => void;
}

const THEME: Record<AlertModalType, {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  iconCls: string;
  titleCls: string;
  headerCls: string;
}> = {
  warning: {
    Icon: FiAlertTriangle,
    iconCls:   'text-amber-500',
    titleCls:  'text-amber-800',
    headerCls: 'bg-amber-50 border-b border-amber-200',
  },
  error: {
    Icon: FiAlertCircle,
    iconCls:   'text-red-500',
    titleCls:  'text-red-800',
    headerCls: 'bg-red-50 border-b border-red-200',
  },
  success: {
    Icon: FiCheckCircle,
    iconCls:   'text-green-500',
    titleCls:  'text-green-800',
    headerCls: 'bg-green-50 border-b border-green-200',
  },
};

export default function AlertModal({
  title, messages, type = 'warning', onClose, actionLabel, onAction,
}: AlertModalProps) {
  const { Icon, iconCls, titleCls, headerCls } = THEME[type];

  return (
    /* backdrop — click-outside closes */
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[500] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
    >
      {/* card — stop propagation so clicks inside don't close */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className={`flex items-center gap-3 px-5 py-4 ${headerCls}`}>
          <Icon size={22} className={iconCls} />
          <h2 id="alert-modal-title" className={`font-bold text-base flex-1 ${titleCls}`}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* body */}
        <ul className="px-5 py-4 flex flex-col gap-2.5">
          {messages.map((msg, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5 shrink-0 text-gray-400">•</span>
              <span>{msg}</span>
            </li>
          ))}
        </ul>

        {/* footer */}
        <div className="px-5 pb-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Dismiss
          </button>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-dark hover:bg-brand-hover text-white text-sm font-bold transition-colors shadow-sm"
            >
              <FiShoppingCart size={14} />
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
