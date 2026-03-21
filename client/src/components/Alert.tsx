import React from 'react';
import { FiAlertCircle, FiCheckCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi';

export type AlertType = 'error' | 'success' | 'warning' | 'info';

interface AlertProps {
  type: AlertType;
  message: string;
  onClose?: () => void;
}

const CONFIG: Record<AlertType, { icon: React.ReactNode; container: string; text: string }> = {
  error: {
    icon: <FiAlertCircle size={16} />,
    container: 'bg-red-50 border border-red-300 text-red-700',
    text: 'text-red-700',
  },
  success: {
    icon: <FiCheckCircle size={16} />,
    container: 'bg-green-50 border border-green-300 text-green-700',
    text: 'text-green-700',
  },
  warning: {
    icon: <FiAlertTriangle size={16} />,
    container: 'bg-amber-50 border border-amber-300 text-amber-700',
    text: 'text-amber-700',
  },
  info: {
    icon: <FiInfo size={16} />,
    container: 'bg-blue-50 border border-blue-300 text-blue-700',
    text: 'text-blue-700',
  },
};

export default function Alert({ type, message, onClose }: AlertProps) {
  const { icon, container, text } = CONFIG[type];
  return (
    <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm ${container}`} role="alert">
      <span className={`shrink-0 mt-0.5 ${text}`}>{icon}</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className={`shrink-0 mt-0.5 cursor-pointer bg-transparent border-none p-0 ${text} hover:opacity-70`}
        >
          <FiX size={14} />
        </button>
      )}
    </div>
  );
}
