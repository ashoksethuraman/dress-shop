import { render, screen, fireEvent } from '@testing-library/react';
import Alert from './Alert';

describe('Alert', () => {
  it('renders the message', () => {
    render(<Alert type="success" message="Saved successfully" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Saved successfully');
  });

  it('calls onClose when dismiss button is clicked', () => {
    const onClose = jest.fn();
    render(<Alert type="error" message="Something went wrong" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
