import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import { FiDownload, FiHome, FiPackage, FiCheckCircle, FiLock } from 'react-icons/fi';

export default function OrderSuccessPage() {
  const loc   = useLocation();
  const order = (loc.state as any)?.order;

  /* ── PDF receipt ── */
  const downloadPdf = () => {
    const doc  = new jsPDF();
    const addr = order.shippingAddress;
    const placedOn = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Order Receipt', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Order placed: ${placedOn}`, 14, 28);
    doc.text(`Order number: ${order.id}`, 14, 34);
    doc.text(`Email: ${order.contactEmail || ''}`, 14, 40);

    // Divider
    doc.setDrawColor(200);
    doc.line(14, 44, 196, 44);

    // Ship to
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Ship to', 14, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const fullName = `${addr.firstName} ${addr.lastName}`;
    const addrLines = [
      fullName,
      addr.company || '',
      addr.address,
      addr.apartment || '',
      `${addr.city}, ${addr.state} - ${addr.pinCode}`,
      'India',
      `Phone: ${addr.phone}`,
    ].filter(Boolean);
    addrLines.forEach((line, i) => doc.text(line, 14, 60 + i * 6));

    // Payment
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Payment method', 110, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Razorpay (UPI / Card / Wallet)', 110, 60);
    doc.setTextColor(40, 167, 69);
    doc.setFont('helvetica', 'bold');
    doc.text(`PAID  ₹${order.total.toFixed(2)}`, 110, 68);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');

    // Items
    const itemsY = 60 + addrLines.length * 6 + 10;
    doc.setDrawColor(200);
    doc.line(14, itemsY - 4, 196, itemsY - 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Items ordered', 14, itemsY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let y = itemsY + 12;
    order.items?.forEach((it: any) => {
      doc.text(`${it.title}  ×  ${it.qty}`, 14, y);
      doc.text(`₹${(it.price * it.qty).toFixed(2)}`, 180, y, { align: 'right' });
      y += 8;
    });

    // Totals
    doc.line(14, y, 196, y);
    y += 7;
    doc.text('Subtotal', 140, y);
    doc.text(`₹${order.total.toFixed(2)}`, 180, y, { align: 'right' });
    y += 6;
    doc.text('Shipping', 140, y);
    doc.text('Free', 180, y, { align: 'right' });
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Grand Total', 140, y);
    doc.text(`₹${order.total.toFixed(2)}`, 180, y, { align: 'right' });

    doc.save(`receipt-${order.id}.pdf`);
  };

  /* ── No order state ── */
  if (!order) return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <p className="text-gray-500 mb-4">No order details found.</p>
      <Link to="/" className="text-indigo-600 hover:underline font-medium">Go home</Link>
    </div>
  );

  const addr      = order.shippingAddress ?? {};
  const subtotal  = order.items?.reduce((s: number, i: any) => s + i.price * i.qty, 0) ?? order.total;
  const placedOn  = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <nav className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
          <Link to="/" className="hover:text-indigo-600 transition-colors">Home</Link>
          <span>›</span>
          <span className="text-gray-500">Orders</span>
          <span>›</span>
          <span className="text-indigo-600 font-medium">Order Details</span>
        </nav>

        {/* Page heading row */}
        <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FiCheckCircle size={22} className="text-green-500 flex-shrink-0" />
              <h1 className="text-2xl font-extrabold text-gray-900">Order Details</h1>
            </div>
            <p className="text-sm text-gray-500">
              Order placed <span className="font-medium text-gray-700">{placedOn}</span>
              <span className="mx-3 text-gray-300">|</span>
              Order number <span className="font-mono font-semibold text-gray-800">{order.id}</span>
            </p>
          </div>

          {/* Invoice / Download button */}
          <button
            onClick={downloadPdf}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-300 text-indigo-600 font-semibold text-sm hover:bg-indigo-50 transition-colors flex-shrink-0"
          >
            <FiDownload size={14} /> Download Receipt
          </button>
        </div>

        {/* ── Info card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">

            {/* Ship to */}
            <div className="px-6 py-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ship to</p>
              <p className="text-sm font-semibold text-gray-800">{addr.firstName} {addr.lastName}</p>
              {addr.company && <p className="text-sm text-gray-600">{addr.company}</p>}
              <p className="text-sm text-gray-600">{addr.address}</p>
              {addr.apartment && <p className="text-sm text-gray-600">{addr.apartment}</p>}
              <p className="text-sm text-gray-600">{addr.city}, {addr.state} {addr.pinCode}</p>
              <p className="text-sm text-gray-600">India</p>
            </div>

            {/* Payment method */}
            <div className="px-6 py-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Payment method</p>
              <p className="text-sm font-semibold text-gray-800">Razorpay</p>
              <p className="text-xs text-gray-400 mt-0.5">UPI / Card / Wallet</p>
              {/* Payment status */}
              <div className="mt-3 inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                <FiCheckCircle size={11} />
                Paid
              </div>
              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                <FiLock size={10} /> ₹{order.total.toFixed(2)} charged successfully
              </p>
            </div>

            {/* Order summary */}
            <div className="px-6 py-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Order Summary</p>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Item(s) Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping:</span>
                  <span>₹0.00</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total:</span>
                  <span>₹{order.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-gray-900 pt-1.5 border-t border-gray-100 mt-1">
                  <span>Grand Total:</span>
                  <span>₹{order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Items section ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">

          {/* Delivery status bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <p className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FiPackage size={16} className="text-indigo-500" /> Order Confirmed
              </p>
              <p className="text-xs text-gray-400 mt-0.5">We'll notify you when your order ships.</p>
            </div>
            {/* Track Package */}
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
              onClick={() => alert(`Tracking ID: ${order.id}`)}
            >
              <FiPackage size={14} /> Track package
            </button>
          </div>

          {/* Item rows */}
          <div className="divide-y divide-gray-100">
            {order.items?.map((it: any) => (
              <div key={it.productId} className="flex items-center gap-4 px-6 py-4">
                {/* Thumbnail placeholder */}
                <div className="w-16 h-16 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100">
                  <FiPackage size={20} className="text-indigo-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{it.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Qty: {it.qty}</p>
                  <p className="text-sm font-bold text-gray-700 mt-1">₹{it.price.toFixed(2)}</p>
                </div>
                <p className="text-sm font-bold text-gray-800 flex-shrink-0">
                  ₹{(it.price * it.qty).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-6 flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors no-underline shadow-md"
          >
            <FiHome size={15} /> Back to Home
          </Link>
        </div>

      </div>
    </div>
  );
}
