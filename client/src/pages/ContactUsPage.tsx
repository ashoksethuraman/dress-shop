import React from 'react';
import { FiMail, FiPhone, FiMapPin, FiClock, FiTag, FiInfo } from 'react-icons/fi';

const INFO_ROWS = [
  { Icon: FiTag,    label: 'Trade Name',        value: 'Halley Comet Garments' },
  { Icon: FiInfo,   label: 'Brand Name',         value: 'Halley Comet · Cozy Luna Wears' },
  { Icon: FiMapPin, label: 'Address',            value: '27 Sample Colony, 1st Street,\nTirupur – 641602, Tamil Nadu, India.' },
  { Icon: FiPhone,  label: 'Phone / WhatsApp',   value: '+91 XXXXX XXXXX' },
  { Icon: FiMail,   label: 'Email',              value: 'support@halleycomet.com' },
  { Icon: FiClock,  label: 'Operating Hours',    value: 'Monday – Saturday, 10:00 AM to 6:00 PM (IST)' },
];

export default function ContactUsPage() {
  return (
    <div className="h-full flex flex-col">

      {/* Page header */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <FiMail size={22} className="text-brand-dark" />
          <h1 className="text-2xl font-bold text-gray-900 font-display">Contact</h1>
        </div>
      </div>

      <div className="flex flex-col items-center px-6 py-6">

      {/* Info card – original row sizes */}
      <div className="bg-brand rounded-2xl border border-brand-border shadow-sm p-6 w-full max-w-lg flex flex-col gap-4">
        {INFO_ROWS.map(({ Icon, label, value }) => (
          <div key={label} className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon size={15} className="text-brand-dark" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-0.5">{label}</p>
              <p className="text-sm font-medium text-primary whitespace-pre-line">{value}</p>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}


