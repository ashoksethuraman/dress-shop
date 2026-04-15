import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import FormField from '../FormField';
import { CheckoutFormState } from '../../utils/types';
import type { User } from '../../utils/types';

type Props = {
  register: UseFormRegister<CheckoutFormState>;
  errors: FieldErrors<CheckoutFormState>;
  user: User | null;
};

export default function ContactSection({ register, errors, user }: Props) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900">Contact</h2>
        {!user && (
          <a href="/auth" className="text-sm text-brand-dark hover:underline font-medium">
            Sign in
          </a>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <FormField
          label="Email"
          id="email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          registration={register('email', {
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
          })}
        />

      </div>
    </section>
  );
}
