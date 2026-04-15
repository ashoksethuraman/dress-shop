import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import AddressSection from '../AddressSection';
import { CheckoutFormState } from '../../utils/types';

type Props = {
  register: UseFormRegister<CheckoutFormState>;
  errors: FieldErrors<CheckoutFormState>;
};

export default function DeliverySection({ register, errors }: Props) {
  return (
    <section>
      <h2 className="text-lg font-bold text-gray-900 mb-3">Delivery</h2>
      <div className="flex flex-col gap-3">
        <AddressSection prefix="shippingAddress" register={register} errors={errors} />

      </div>
    </section>
  );
}
