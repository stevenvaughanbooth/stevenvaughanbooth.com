import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { careerStartYear, experience } from '@/content/profile';
import { Roles } from './chart';
import { buildTimeline } from './timeline';

const { steps } = buildTimeline(experience, careerStartYear, new Date('2026-10-29'));

const disclosure = (name: RegExp) =>
  screen.getByText(name, { selector: 'summary *' }).closest('details')!;

describe('Roles', () => {
  it('is an ordered list carrying every role, its dates, and its focus', () => {
    render(<Roles steps={steps} />);
    const list = screen.getByRole('list', { name: /roles at salesforce/i });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(experience.length);
    expect(items[0]).toHaveTextContent('Associate Engineer');
    expect(items[0]).toHaveTextContent('Associate Member of Technical Staff');
    experience.forEach((role) => {
      expect(list).toHaveTextContent(role.start);
      if (role.focus) expect(list).toHaveTextContent(role.focus);
    });
  });

  it('makes each role a disclosure, with only the current one open and no toggle state', () => {
    const { container } = render(<Roles steps={steps} />);
    const details = [...container.querySelectorAll('details')];
    expect(details).toHaveLength(experience.length);
    expect(new Set(details.map((item) => item.getAttribute('name'))).size).toBe(1);
    expect(details.filter((item) => item.open)).toEqual([disclosure(/principal engineer/i)]);
    expect(container.querySelector('[aria-pressed]')).toBeNull();
    details.forEach((item) => expect(item.firstElementChild?.tagName).toBe('SUMMARY'));
  });

  it('opens a role from its summary', () => {
    render(<Roles steps={steps} />);
    const lead = disclosure(/lead engineer/i);
    expect(lead.open).toBe(false);

    fireEvent.click(within(lead).getByText(/lead engineer/i, { selector: 'summary *' }));
    expect(lead.open).toBe(true);
  });
});
