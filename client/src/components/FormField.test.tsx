import { render, screen } from '@testing-library/react';
import FormField from './FormField';

describe('FormField', () => {
  it('renders label and placeholder', () => {
    render(
      <FormField
        label="First name"
        id="firstName"
        placeholder="Enter first name"
        registration={{}}
      />
    );

    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter first name')).toBeInTheDocument();
  });

  it('shows optional and error text', () => {
    render(
      <FormField
        label="Company"
        id="company"
        optional
        error="Company is invalid"
        registration={{}}
      />
    );

    expect(screen.getByText('(optional)')).toBeInTheDocument();
    expect(screen.getByText('Company is invalid')).toBeInTheDocument();
  });
});
