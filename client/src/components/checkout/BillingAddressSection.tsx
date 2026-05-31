import React, { useEffect } from 'react';
import { Controller, type Control, type FieldErrors, type UseFormRegister, useWatch, type UseFormClearErrors } from 'react-hook-form';
import type { CheckoutFormState } from '../../utils/types';
import AddressSection from '../AddressSection';

type Props = {
  control: Control<CheckoutFormState>;
  register: UseFormRegister<CheckoutFormState>;
  errors: FieldErrors<CheckoutFormState>;
  clearErrors: UseFormClearErrors<CheckoutFormState>;
};

const OPTIONS = [
  { label: 'Same as shipping address', value: true },
  { label: 'Use a different billing address', value: false },
] as const;

export default function BillingAddressSection({ control, register, errors, clearErrors }: Props) {
  // Watch the billing option to clear errors when switching to "Same as shipping"
  const billingOptionSame = useWatch({ control, name: 'billingOptionSame', defaultValue: true });
  
  // Clear billing address errors when switching to "Same as shipping"
  useEffect(() => {
    if (billingOptionSame) {
      clearErrors('billingAddress');
    }
  }, [billingOptionSame, clearErrors]);

  return (
    <Controller
      name="billingOptionSame"
      control={control}
      defaultValue={true}
      render={({ field }) => {
        const billingAddressSame = field.value ?? true;

        return (
          <>
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">Billing address</h2>
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {OPTIONS.map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => field.onChange(opt.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 text-left ${
                      billingAddressSame === opt.value ? 'bg-brand' : 'bg-white hover:bg-gray-50'
                    }`}
                    aria-pressed={billingAddressSame === opt.value}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      billingAddressSame === opt.value ? 'border-brand-dark' : 'border-gray-400'
                    }`}>
                      {billingAddressSame === opt.value && <div className="w-2 h-2 rounded-full bg-brand-dark" />}
                    </div>
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <div
              style={{
                maxHeight: !billingAddressSame ? '900px' : '0px',
                opacity: !billingAddressSame ? 1 : 0,
                overflow: 'hidden',
                transition: 'max-height 0.4s ease, opacity 0.3s ease',
              }}
            >
              <section className="pt-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Billing address</h2>
                <AddressSection 
                  prefix="billingAddress" 
                  register={register} 
                  errors={errors}
                  isRequired={!billingAddressSame}
                />
              </section>
            </div>
          </>
        );
      }}
    />
  );
}
