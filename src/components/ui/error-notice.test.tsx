import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ErrorPage from '@/app/error';

describe('error page', () => {
  it('explains the failure, logs it, and retries on request', async () => {
    const error = new Error('chunk failed');
    const retry = vi.fn();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ErrorPage error={error} retry={retry} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'This page didn’t load properly.',
    );
    expect(log).toHaveBeenCalledWith(error);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
    log.mockRestore();
  });
});
