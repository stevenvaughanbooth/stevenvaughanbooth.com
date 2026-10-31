import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { adage } from '@/content/profile';
import { CountUp, parseFigure } from './count-up';

describe('parseFigure', () => {
  it('splits a whole number from the unit after it', () => {
    expect(parseFigure('48%')).toEqual({ value: 48, suffix: '%' });
    expect(parseFigure('3×')).toEqual({ value: 3, suffix: '×' });
    expect(parseFigure('12')).toEqual({ value: 12, suffix: '' });
  });

  it('leaves anything that is not one whole number, or has text before it, alone', () => {
    expect(parseFigure('~3×')).toBeNull();
    expect(parseFigure('1.5×')).toBeNull();
    expect(parseFigure('19 of 20')).toBeNull();
    expect(parseFigure('n/a')).toBeNull();
  });

  it('can count every Adage evidence figure', () => {
    for (const result of adage.evidence.results) expect(parseFigure(result.value)).not.toBeNull();
  });
});

describe('CountUp', () => {
  it('keeps the real figure in the DOM and hands the count to CSS', () => {
    const { container } = render(<CountUp text="48%" className="text-5xl" />);
    expect(screen.getByText('48%')).toBeInTheDocument();
    expect(container).toHaveTextContent(/^48%$/);

    const figure = container.firstElementChild as HTMLElement;
    expect(figure).toHaveClass('text-5xl');
    expect(figure).toHaveAttribute('data-suffix', '%');
    expect(figure.style.getPropertyValue('--count-to')).toBe('48');
  });

  it('renders text that cannot count as it is', () => {
    const { container } = render(<CountUp text="1.5×" className="text-5xl" />);
    expect(container.innerHTML).toBe('<span class="text-5xl">1.5×</span>');
  });
});
