import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import {
  FiDownload, FiHome, FiPackage, FiCheckCircle, FiLock,
  FiMapPin, FiMail, FiCalendar, FiHash, FiCreditCard, FiArrowRight,
  FiAlertCircle, FiRefreshCw,
} from 'react-icons/fi';
import { formatAddressLines } from '../utils/format';
import Loader from '../components/Loader';

// ── Types & constants ───────────────────────────────────────────────────────
interface OrderStatusState {
  order: any;
  paymentId?: string; paymentMethod?: string; verifyFailed?: boolean;
  reason?: 'payment_dismissed' | 'payment_failed';
  description?: string; errorCode?: string;
}
const FAILURE_TITLES: Record<string, string> = {
  payment_dismissed: 'Payment Cancelled',
  payment_failed:    'Payment Failed',
};
const FAILURE_DETAILS: Record<string, string> = {
  payment_dismissed: 'You cancelled the payment before it was completed. Your card was not charged.',
  payment_failed:    'Your payment could not be processed. Please try again or use a different payment method.',
};

// ── Shared sub-components ───────────────────────────────────────────────────
function MetaCard({ icon, label, value, mono = false, accent = 'text-gray-400' }: {
  icon: React.ReactNode; label: string; value: string; mono?: boolean; accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-start gap-3">
      <span className={`mt-0.5 flex-shrink-0 ${accent}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
        <p className={`text-sm font-semibold text-gray-800 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden mb-5">
      <div className="px-6 py-3 border-b border-brand-border bg-brand">
        <p className="text-[11px] font-bold text-brand-dark/70 uppercase tracking-widest">{title}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function AddressBlock({ addr }: { addr: any }) {
  if (!addr) return <p className="text-sm text-gray-400">—</p>;
  return (
    <div>
      {formatAddressLines(addr).map((l, i) => (
        <p key={i} className={`text-sm leading-relaxed ${i === 0 ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{l}</p>
      ))}
      {addr.phone && <p className="text-sm text-gray-500 mt-1">📞 {addr.phone}</p>}
    </div>
  );
}

function ItemRows({ items, compact }: { items: any[]; compact: boolean }) {
  return (
    <div className="divide-y divide-gray-100">
      {items?.map((it: any, idx: number) => (
        <div key={it.productId ?? idx} className={`flex items-center gap-4 px-6 ${compact ? 'py-3.5' : 'py-4'}`}>
          <div className={`rounded-xl flex items-center justify-center flex-shrink-0 ${
            compact ? 'w-12 h-12 bg-gray-100' : 'w-14 h-14 bg-brand border border-brand-border'
          }`}>
            <FiPackage size={compact ? 16 : 18} className={compact ? 'text-gray-300' : 'text-brand-dark'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{it.title}</p>
            {it.size && <p className="text-xs text-gray-400 mt-0.5">Size: {it.size}</p>}
            <p className="text-xs text-gray-500 mt-0.5">Qty: {it.qty} × ₹{Number(it.unitPrice).toFixed(2)}</p>
          </div>
          <p className="text-sm font-bold text-gray-800 flex-shrink-0">₹{Number(it.total ?? it.unitPrice * it.qty).toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
}

function PriceSummary({ order, subtotal, isFailure }: { order: any; subtotal: number; isFailure: boolean }) {
  return (
    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50">
      <div className="ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{Number(subtotal).toFixed(2)}</span></div>
        <div className="flex justify-between text-gray-500"><span>Shipping</span><span className="text-green-600 font-medium">Free</span></div>
        {Number(order.taxAmount) > 0 && (
          <div className="flex justify-between text-gray-600"><span>Tax</span><span>₹{Number(order.taxAmount).toFixed(2)}</span></div>
        )}
        {Number(order.discount) > 0 && (
          <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{Number(order.discount).toFixed(2)}</span></div>
        )}
        <div className="flex justify-between font-extrabold text-gray-900 text-base pt-2 border-t border-gray-200">
          {isFailure ? (
            <><span>Total <span className="text-xs font-normal text-red-400">(not charged)</span></span><span className="text-red-500">₹{Number(order.totalAmount).toFixed(2)}</span></>
          ) : (
            <><span>Grand Total</span><span className="text-brand-dark">₹{Number(order.totalAmount).toFixed(2)}</span></>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PDF builder (pure function) ─────────────────────────────────────────────
interface PdfCtx {
  order: any; isFailure: boolean; reason?: string;
  paymentId?: string; paymentMethod?: string; placedOn: string;
  shipAddr: any; billAddr: any; addrSame: boolean; subtotal: number; errorCode?: string;
  logoDataUrl?: string;
}
function buildPdf({ order, isFailure, reason, paymentId, paymentMethod, placedOn, shipAddr, billAddr, addrSame, subtotal, errorCode, logoDataUrl }: PdfCtx) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, L = 14, R = W - 14;
  let y = 0;
  const sf = (sz: number, st: 'normal' | 'bold' | 'italic' = 'normal') => { doc.setFontSize(sz); doc.setFont('helvetica', st); };
  const sc = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);
  const ln = (h = 6) => { y += h; };
  const hr = (col = 220) => { doc.setDrawColor(col); doc.line(L, y, R, y); ln(4); };
  const tx = (t: string, x: number, a: 'left' | 'right' | 'center' = 'left') => doc.text(t, x, y, { align: a });

  // Header band — use fixed y coords inside the band, then jump y to 38
  isFailure ? doc.setFillColor(220, 38, 38) : doc.setFillColor(115, 138, 110);
  doc.rect(0, 0, W, 30, 'F');
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', L, 4, 42, 22);
  } else {
    sf(20, 'bold'); sc(255, 255, 255);
    doc.text('Halley Comet', L, 14);
  }
  sf(10); sc(255, 255, 255);
  doc.text(isFailure ? 'Payment Failure Report' : 'Order Receipt', L, 26);
  doc.text(placedOn, R, 14, { align: 'right' });
  if (order.id) doc.text(`Order: ${order.id}`, R, 22, { align: 'right' });
  y = 38;

  // Status badge
  if (isFailure) {
    doc.setFillColor(254, 226, 226); doc.setDrawColor(252, 165, 165);
    doc.roundedRect(L, y - 5, 60, 9, 3, 3, 'FD'); sf(9, 'bold'); sc(185, 28, 28);
    tx(`X  ${FAILURE_TITLES[reason ?? 'payment_failed']}`, L + 4);
  } else {
    doc.setFillColor(220, 252, 231); doc.setDrawColor(134, 239, 172);
    doc.roundedRect(L, y - 5, 36, 9, 3, 3, 'FD'); sf(9, 'bold'); sc(21, 128, 61);
    tx('PAID', L + 9);
  }
  y += 11; hr(); sc(30, 30, 30);

  // Meta rows
  const meta: string[][] = [
    ['Order ID:', order.id ?? '—'], ['Email:', order.contactEmail ?? '—'],
    ...(isFailure
      ? [['Status:', FAILURE_TITLES[reason ?? 'payment_failed']], ...(errorCode ? [['Error:', errorCode]] : [])]
      : [...(paymentId ? [['Payment ID:', paymentId]] : []), ...(paymentMethod ? [['Method:', paymentMethod]] : [])]),
  ];
  meta.forEach(([label, value]) => {
    sf(10); tx(label, L); sf(10, 'bold');
    if (isFailure && label === 'Status:') sc(185, 28, 28);
    tx(value, L + 32); sc(30, 30, 30); ln();
  });
  ln(2); hr();

  // Addresses (success only)
  if (!isFailure) {
    const shipLines = [...formatAddressLines(shipAddr), shipAddr.phone ? `Ph: ${shipAddr.phone}` : ''].filter(Boolean);
    sf(9, 'bold'); sc(130, 130, 130); tx('SHIP TO', L); ln(5);
    sf(10, 'normal'); sc(30, 30, 30); shipLines.forEach(l => { tx(l, L); ln(); });
    if (!addrSame) {
      const billLines = [...formatAddressLines(billAddr), billAddr.phone ? `Ph: ${billAddr.phone}` : ''].filter(Boolean);
      const sy = y; y -= shipLines.length * 6 + 9;
      sf(9, 'bold'); sc(130, 130, 130); tx('BILL TO', W / 2 + 4); ln(5);
      sf(10, 'normal'); sc(30, 30, 30); billLines.forEach(l => { tx(l, W / 2 + 4); ln(); });
      y = Math.max(y, sy);
    }
    ln(2); hr();
  }

  // Items table
  sf(9, 'bold'); sc(130, 130, 130);
  tx('ITEM', L); tx('QTY', 125); tx('UNIT PRICE', 148); tx('TOTAL', R, 'right');
  ln(1); hr(210); sf(10); sc(30, 30, 30);
  order.items?.forEach((it: any) => {
    const itemLabel = it.size ? `${it.title} (Size: ${it.size})` : it.title;
    tx(itemLabel, L); tx(String(it.qty), 125);
    tx(`Rs.${Number(it.unitPrice).toFixed(2)}`, 148);
    sf(10, 'bold'); tx(`Rs.${Number(it.total ?? it.unitPrice * it.qty).toFixed(2)}`, R, 'right');
    sf(10); ln();
  });
  ln(1); hr(210);

  // Totals
  const tX = 140; sf(10);
  tx('Subtotal', tX); tx(`Rs.${Number(subtotal).toFixed(2)}`, R, 'right'); ln();
  tx('Shipping', tX); tx(`Rs.${Number(order.shippingFee ?? 0).toFixed(2)}`, R, 'right'); ln();
  if (Number(order.taxAmount) > 0) { tx('Tax', tX); tx(`Rs.${Number(order.taxAmount).toFixed(2)}`, R, 'right'); ln(); }
  if (Number(order.discount)  > 0) { tx('Discount', tX); tx(`-Rs.${Number(order.discount).toFixed(2)}`, R, 'right'); ln(); }
  sf(12, 'bold'); isFailure ? sc(220, 38, 38) : sc(115, 138, 110);
  tx(isFailure ? 'Total (NOT CHARGED)' : 'Grand Total', tX);
  tx(`Rs.${Number(order.totalAmount).toFixed(2)}`, R, 'right'); ln(14);
  sf(8, 'italic'); sc(160, 160, 160);
  doc.text(
    isFailure ? 'Payment was NOT taken.  |  support@halleycomet.com' : 'Thank you for shopping with Halley Comet!  |  support@halleycomet.com',
    W / 2, y, { align: 'center' },
  );
  doc.save(isFailure ? `HalleyComet-PaymentFailed-${order.id}.pdf` : `HalleyComet-Receipt-${order.id}.pdf`);
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function OrderStatusPage() {
  const loc   = useLocation();
  const nav   = useNavigate();
  const state = loc.state as OrderStatusState | null;

  const order         = state?.order;
  const isFailure     = !!(state?.reason);
  const reason        = state?.reason;
  const description   = state?.description ?? (reason ? FAILURE_DETAILS[reason] : '');
  const errorCode     = state?.errorCode;
  const paymentId     = state?.paymentId;
  const paymentMethod = state?.paymentMethod;
  const verifyFailed  = state?.verifyFailed === true;

  const shipAddr = useMemo(() => order?.shippingAddress ?? order?.billingAddress ?? {}, [order]);
  const billAddr = useMemo(() => order?.billingAddress ?? {}, [order]);
  const addrSame = order?.billingAndShippingSame !== false;
  const subtotal = order?.subtotal
    ?? order?.items?.reduce((s: number, i: any) => s + Number(i.unitPrice) * Number(i.qty), 0)
    ?? order?.totalAmount ?? 0;
  const placedOn = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const downloadPdf = useCallback(async () => {
    if (!order) return;
    let logoDataUrl: string | undefined;
    try {
      const res = await fetch('/app-logo.png');
      const blob = await res.blob();
      logoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { /* logo fetch failed — fall back to text */ }
    buildPdf({ order, isFailure, reason, paymentId, paymentMethod, placedOn, shipAddr, billAddr, addrSame, subtotal, errorCode, logoDataUrl });
  }, [order, isFailure, reason, paymentId, paymentMethod, placedOn, shipAddr, billAddr, addrSame, subtotal, errorCode]);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return <Loader fullPage label="Loading order details…" />;

  if (!order) return (
    <div className="max-w-lg mx-auto px-4 py-28 text-center">
      <FiPackage size={52} className="text-gray-200 mx-auto mb-5" />
      <h2 className="text-xl font-bold text-gray-700 mb-2">No order details found</h2>
      <p className="text-sm text-gray-500 mb-6">This page requires an active order session. Check your email for confirmation.</p>
      <Link to="/" className="px-6 py-3 rounded-xl bg-brand-dark text-white font-bold text-sm hover:bg-brand-hover transition-colors">Back to Home</Link>
    </div>
  );

  /* ── FAILURE VIEW ── */
  if (isFailure) {
    const title = FAILURE_TITLES[reason ?? 'payment_failed'];
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <nav className="text-xs text-gray-400 mb-5 flex items-center gap-1.5">
            <Link to="/" className="hover:text-red-500 transition-colors">Home</Link>
            <span>›</span><span className="text-red-500 font-medium">{title}</span>
          </nav>

          <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-5 mb-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 shadow-sm">
              <FiAlertCircle size={24} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{FAILURE_DETAILS[reason ?? 'payment_failed']}</p>
              {description && description !== FAILURE_DETAILS[reason ?? 'payment_failed'] && (
                <p className="text-xs text-red-600 font-medium mt-2 bg-red-100 rounded-lg px-3 py-1.5 inline-block">
                  Detail: {description}
                </p>
              )}
              {errorCode && <p className="text-xs font-mono text-red-400 mt-2">Error code: {errorCode}</p>}
            </div>
            <button onClick={downloadPdf} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-300 text-red-600 font-semibold text-xs hover:bg-red-100 transition-colors flex-shrink-0">
              <FiDownload size={12} /> Download
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-5">
            <MetaCard icon={<FiHash size={14}/>}     label="Order Reference" value={order.id}                   mono />
            <MetaCard icon={<FiCalendar size={14}/>} label="Date"            value={placedOn} />
            <MetaCard icon={<FiMail size={14}/>}     label="Email"           value={order.contactEmail ?? '—'} />
          </div>

          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
            <span className="text-xl flex-shrink-0">💳</span>
            <p className="text-sm text-amber-800">
              <strong>Your card was not charged.</strong> Ref: <span className="font-mono font-bold">{order.id}</span>. You can retry anytime.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-5">
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/70">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Items in Order</p>
            </div>
            <ItemRows items={order.items} compact={true} />
            <PriceSummary order={order} subtotal={subtotal} isFailure={true} />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8">
            <button onClick={() => nav('/checkout')} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-dark hover:bg-brand-hover text-white font-bold text-sm transition-colors shadow-md">
              <FiRefreshCw size={14} /> Try Payment Again
            </button>
            <a href={`mailto:support@dressshop.com?subject=Payment%20Issue%20Order%20${encodeURIComponent(order.id ?? '')}`} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">
              <FiMail size={14} /> Contact Support
            </a>
            <Link to="/" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 transition-colors">
              <FiHome size={14} /> Back to Home
            </Link>
            <button onClick={downloadPdf} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-red-300 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors">
              <FiDownload size={14} /> Download Report
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center pb-10">
            If you were charged without receiving confirmation, contact{' '}
            <a href="mailto:support@dressshop.com" className="text-brand-dark hover:underline">support@dressshop.com</a>
          </p>
        </div>
      </div>
    );
  }

  /* ── SUCCESS VIEW ── */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <nav className="text-xs text-gray-400 mb-5 flex items-center gap-1.5">
          <Link to="/" className="hover:text-brand-dark transition-colors">Home</Link>
          <span>›</span><span className="text-brand-dark font-medium">Order Confirmed</span>
        </nav>

        {verifyFailed && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <span className="mt-0.5 shrink-0 text-xl">⚠️</span>
            <span>
              <strong>Payment received, but server confirmation failed.</strong>{' '}
              Email <a href="mailto:support@dressshop.com" className="underline font-medium">support@dressshop.com</a> with order ID{' '}
              <span className="font-mono font-bold">{order.id}</span>.
            </span>
          </div>
        )}

        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 shadow-sm">
              <FiCheckCircle size={26} className="text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Order Confirmed!</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="font-mono font-semibold text-gray-700">{order.id}</span>
                <span className="mx-2 text-gray-300">·</span>{placedOn}
              </p>
            </div>
          </div>
          <button onClick={downloadPdf} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-dark hover:bg-brand-hover text-white font-semibold text-sm transition-colors shadow-sm flex-shrink-0">
            <FiDownload size={14} /> Download Receipt
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <MetaCard icon={<FiHash size={14}/>}       label="Order ID" value={order.id}                                                          mono accent="text-brand-dark" />
          <MetaCard icon={<FiCalendar size={14}/>}   label="Date"     value={placedOn}                                                               accent="text-brand-dark" />
          <MetaCard icon={<FiMail size={14}/>}       label="Email"    value={order.contactEmail ?? '—'}                                              accent="text-brand-dark" />
          <MetaCard icon={<FiCreditCard size={14}/>} label="Payment"  value={paymentId ? `···${paymentId.slice(-6)}` : (paymentMethod ?? 'Paid')}    accent="text-brand-dark" />
        </div>

        <div className={`grid ${addrSame ? '' : 'sm:grid-cols-2'} gap-5 mb-5`}>
          <SectionCard title={addrSame ? 'Billing & Shipping Address' : 'Shipping Address'}>
            <div className="flex items-start gap-3">
              <FiMapPin size={15} className="text-brand-dark mt-0.5 flex-shrink-0" />
              <AddressBlock addr={shipAddr} />
            </div>
          </SectionCard>
          {!addrSame && (
            <SectionCard title="Billing Address">
              <div className="flex items-start gap-3">
                <FiMapPin size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <AddressBlock addr={billAddr} />
              </div>
            </SectionCard>
          )}
        </div>

        <SectionCard title="Payment">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-sm font-bold px-3 py-1.5 rounded-full">
                <FiCheckCircle size={13} /> Paid
              </div>
              <span className="text-sm font-semibold text-gray-700">₹{Number(order.totalAmount).toFixed(2)} charged successfully</span>
            </div>
            <div className="text-right space-y-0.5">
              {paymentMethod && <p className="text-xs text-gray-500">Method: <span className="font-semibold text-gray-700">{paymentMethod}</span></p>}
              {paymentId && <p className="text-xs font-mono text-gray-500">ID: <span className="font-semibold text-gray-700">{paymentId}</span></p>}
              <p className="text-xs text-gray-400 flex items-center justify-end gap-1"><FiLock size={10} /> Secured by Razorpay</p>
            </div>
          </div>
        </SectionCard>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-5">
          <div className="flex items-center justify-between px-6 py-4 bg-brand border-b border-brand-border">
            <div className="flex items-center gap-2">
              <FiPackage size={16} className="text-brand-dark" />
              <span className="text-base font-bold text-gray-900">Order Items</span>
              <span className="text-xs text-gray-400 ml-1">— we will notify you when it ships.</span>
            </div>
            <button onClick={() => nav('/shipping')} className="flex items-center gap-1 text-xs font-semibold text-brand-dark hover:text-brand-hover transition-colors">
              Track Order <FiArrowRight size={12} />
            </button>
          </div>
          <ItemRows items={order.items} compact={false} />
          <PriceSummary order={order} subtotal={subtotal} isFailure={false} />
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap pb-10">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-brand-dark transition-colors">
            <FiHome size={14} /> Continue Shopping
          </Link>
          <button onClick={downloadPdf} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-dark hover:bg-brand-hover text-white font-bold text-sm transition-colors shadow-md">
            <FiDownload size={14} /> Download PDF Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
