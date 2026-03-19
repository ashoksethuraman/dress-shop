import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { CheckoutFormState, INDIAN_STATES } from '../utils/types';

type AddressPrefix = 'shippingAddress' | 'billingAddress';

interface Props {
  prefix: AddressPrefix;
  register: UseFormRegister<CheckoutFormState>;
  errors: FieldErrors<CheckoutFormState>;
}

/* ─── Reusable text/tel/email input ─────────────────────── */
function Field({
  label, id, error, placeholder, type = 'text', optional = false, registration,
}: {
  label: string; id: string; error?: string; placeholder?: string;
  type?: string; optional?: boolean; registration: object;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-gray-500">
        {label}{optional && <span className="text-gray-400 ml-1">(optional)</span>}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder ?? label}
        {...registration}
        className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all
          ${error ? 'border-red-400 focus:ring-red-100' : 'border-gray-300 focus:border-indigo-400 focus:ring-indigo-100'}`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ─── Address Section ────────────────────────────────────── */
export default function AddressSection({ prefix, register, errors }: Props) {
  // Access nested error object for the given prefix
  const errs = (errors[prefix] ?? {}) as Record<string, { message?: string } | undefined>;

  // Helper: register a nested field, e.g. "shippingAddress.firstName"
  const r = (name: string, rules?: object) =>
    register(`${prefix}.${name}` as any, rules);

  return (
    <div className="flex flex-col gap-3">
      {/* Country – fixed to India */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Country / Region</label>
        <div className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-sm text-gray-800">
          India
        </div>
      </div>

      {/* First / Last name */}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="First name" id={`${prefix}-firstName`}
          error={errs.firstName?.message}
          registration={r('firstName', { required: 'First name is required' })}
        />
        <Field
          label="Last name" id={`${prefix}-lastName`}
          error={errs.lastName?.message}
          registration={r('lastName', { required: 'Last name is required' })}
        />
      </div>

      {/* Company (optional) */}
      <Field
        label="Company" id={`${prefix}-company`} optional
        registration={r('company')}
      />

      {/* Address */}
      <Field
        label="Address" id={`${prefix}-address`} placeholder="House no., Street, Area"
        error={errs.address?.message}
        registration={r('address', { required: 'Address is required' })}
      />

      {/* Apartment (optional) */}
      <Field
        label="Apartment, suite, etc." id={`${prefix}-apartment`} optional
        placeholder="Apartment, suite, etc."
        registration={r('apartment')}
      />

      {/* City + State */}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="City" id={`${prefix}-city`}
          error={errs.city?.message}
          registration={r('city', { required: 'City is required' })}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor={`${prefix}-state`} className="text-xs text-gray-500">State</label>
          <select
            id={`${prefix}-state`}
            {...register(`${prefix}.state` as any, { required: 'Select a state' })}
            className={`w-full border rounded-xl px-4 py-3 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 transition-all appearance-none
              ${errs.state ? 'border-red-400 focus:ring-red-100' : 'border-gray-300 focus:border-indigo-400 focus:ring-indigo-100'}`}
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {errs.state && <p className="text-xs text-red-500">{errs.state.message}</p>}
        </div>
      </div>

      {/* PIN code + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="PIN code" id={`${prefix}-pinCode`} type="tel" placeholder="6-digit PIN"
          error={errs.pinCode?.message}
          registration={r('pinCode', {
            required: 'PIN code is required',
            pattern: { value: /^\d{6}$/, message: 'PIN code must be 6 digits' },
          })}
        />
        <Field
          label="Phone" id={`${prefix}-phone`} type="tel" placeholder="10-digit mobile"
          error={errs.phone?.message}
          registration={r('phone', {
            required: 'Phone number is required',
            pattern: { value: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit mobile number' },
          })}
        />
      </div>
    </div>
  );
}
