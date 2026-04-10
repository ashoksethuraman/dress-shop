import React, { useMemo, useState } from 'react';
import {
  FiX, FiCheckCircle, FiAlertTriangle, FiCreditCard, FiLock, FiCopy,
} from 'react-icons/fi';
import Loader from './Loader';

export interface MockPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  /** Extra fields passed through for payment ledger record */
  transactionRef: string;
  utr: string;
  cardLast4: string;
  cardNetwork: string;
}

export interface MockPaymentError {
  description: string;
  reason: string;
}

interface Props {
  orderId: string;
  amount: number;
  name: string;
  email: string;
  onSuccess: (response: MockPaymentResponse) => Promise<void>;
  onDismiss: () => void;
  onPaymentFailed: (error: MockPaymentError) => void;
}

/* ── tiny helpers ── */
function randAlnum(prefix: string, len = 14): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = prefix;
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function randHex(len = 64): string {
  let s = '';
  for (let i = 0; i < len; i++) s += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  return s;
}

function DetailRow({
  label, value, mono = false,
}: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-gray-500 shrink-0 w-32">{label}</span>
      <span className={`text-gray-800 font-medium truncate flex-1 text-right ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-gray-400 hover:text-brand-dark transition-colors"
        title="Copy"
      >
        {copied ? <FiCheckCircle size={12} className="text-green-500" /> : <FiCopy size={12} />}
      </button>
    </div>
  );
}

export default function MockPaymentModal({
  orderId, amount, name, email, onSuccess, onDismiss, onPaymentFailed,
}: Props) {
  const [processing, setProcessing] = useState(false);

  // Generate stable mock IDs for this modal instance
  const ids = useMemo(() => ({
    razorpayOrderId: randAlnum('order_'),
    paymentId:       randAlnum('pay_'),
    signature:       randHex(64),
    transactionRef:  randAlnum('TXN', 10),
    utr:             randAlnum('', 12).toUpperCase(),
  }), []);

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      await onSuccess({
        razorpay_order_id:   ids.razorpayOrderId,
        razorpay_payment_id: ids.paymentId,
        razorpay_signature:  ids.signature,
        transactionRef:      ids.transactionRef,
        utr:                 ids.utr,
        cardLast4:           '4242',
        cardNetwork:         'Visa',
      });
    } catch {
      setProcessing(false);
    }
  };

  const handleFail = () => {
    onPaymentFailed({ description: 'Payment declined by bank', reason: 'card_declined' });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Test payment gateway"
    >
      {processing && <Loader fullPage label="Confirming payment…" />}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ── Test Mode Banner ── */}
        <div className="bg-amber-400 px-4 py-2.5 flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
            🧪 Test Payment Gateway — Mock Mode
          </span>
          <button
            type="button"
            onClick={onDismiss}
            disabled={processing}
            aria-label="Close"
            className="text-amber-800 hover:text-amber-900 disabled:opacity-50 transition-colors"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-1.5 mb-1">
            <FiLock size={12} className="text-brand-dark" />
            <span className="text-xs text-gray-400 font-medium">Secure Mock Payment</span>
          </div>
          <p className="text-2xl font-extrabold text-gray-900">₹{amount.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{name} · {email}</p>
        </div>

        {/* ── Transaction Details ── */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex flex-col gap-2.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
            Transaction Details
          </p>
          <DetailRow label="Order Ref"          value={orderId} />
          <DetailRow label="Razorpay Order ID"  value={ids.razorpayOrderId} mono />
          <DetailRow label="Payment ID"          value={ids.paymentId} mono />
          <DetailRow label="Transaction Ref"     value={ids.transactionRef} mono />
          <DetailRow label="UTR Number"          value={ids.utr} mono />
          <DetailRow
            label="Signature"
            value={`${ids.signature.slice(0, 20)}…`}
            mono
          />
        </div>

        {/* ── Mock Card ── */}
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Payment Instrument
          </p>
          <div className="flex items-center gap-3 bg-gradient-to-r from-brand-dark to-brand-hover rounded-xl p-3.5 text-white shadow-md">
            <FiCreditCard size={22} />
            <div>
              <p className="text-[10px] font-semibold opacity-75">Test Visa Card</p>
              <p className="font-bold tracking-widest text-sm mt-0.5">**** **** **** 4242</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] opacity-75">EXP</p>
              <p className="text-xs font-bold">12/26</p>
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="px-6 py-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-50 text-white font-bold text-sm transition-colors shadow-sm"
          >
            <FiCheckCircle size={16} />
            Confirm &amp; Pay ₹{amount.toFixed(2)}
          </button>

          <button
            type="button"
            onClick={handleFail}
            disabled={processing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-400 text-red-500 hover:bg-red-50 active:bg-red-100 disabled:opacity-50 font-bold text-sm transition-colors"
          >
            <FiAlertTriangle size={15} />
            Simulate Payment Failure
          </button>

          <button
            type="button"
            onClick={onDismiss}
            disabled={processing}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors text-center py-1"
          >
            Cancel / Pay later
          </button>
        </div>
      </div>
    </div>
  );
}
