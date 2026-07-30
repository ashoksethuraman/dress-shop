import { fireEvent, render, screen } from '@testing-library/react';
import AlertModal from './AlertModal';

describe('AlertModal', () => {
  it('renders title and message bullets', () => {
    render(
      <AlertModal
        title="Stock issue"
        messages={['Size S is unavailable', 'Please remove item']}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Stock issue')).toBeInTheDocument();
    expect(screen.getByText('Size S is unavailable')).toBeInTheDocument();
    expect(screen.getByText('Please remove item')).toBeInTheDocument();
  });

  it('invokes close and primary action callbacks', () => {
    const onClose = jest.fn();
    const onAction = jest.fn();

    render(
      <AlertModal
        title="Cart update needed"
        messages={['Review your cart']}
        onClose={onClose}
        actionLabel="Go to Cart"
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /go to cart/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
