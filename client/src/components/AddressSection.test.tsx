import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import AddressSection from './AddressSection';

function AddressSectionHarness() {
  const { register } = useForm<any>();

  return (
    <AddressSection
      prefix="shippingAddress"
      register={register}
      errors={{}}
      isRequired
    />
  );
}

describe('AddressSection', () => {
  it('renders address fields for India checkout', () => {
    render(<AddressSectionHarness />);

    expect(screen.getByText('Country / Region')).toBeInTheDocument();
    expect(screen.getByText('India')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(screen.getByLabelText('State')).toBeInTheDocument();
  });
});
