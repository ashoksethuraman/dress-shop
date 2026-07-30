import { render, screen } from '@testing-library/react';
import Loader from './Loader';

describe('Loader', () => {
  it('renders default loading status', () => {
    render(<Loader />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders a custom label and full-page mode', () => {
    render(<Loader fullPage label="Loading products" size="sm" />);

    expect(screen.getByRole('status', { name: /loading products/i })).toBeInTheDocument();
    expect(screen.getByText('Loading products')).toBeInTheDocument();
  });
});
