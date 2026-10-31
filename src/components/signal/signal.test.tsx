import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Contact } from '@/components/sections/contact';
import { SectionHeading } from '@/components/ui/section-heading';
import { person } from '@/content/profile';
import { Signal, signalAddress, signalEnd } from './signal';

describe('Signal', () => {
  it('is decoration: hidden from assistive technology, with nothing to focus or read', () => {
    const { container } = render(<Signal />);
    const line = container.firstElementChild!;

    expect(line).toHaveAttribute('aria-hidden', 'true');
    expect(line).toHaveTextContent('');
    expect(line.querySelector('a, button, [tabindex]')).toBeNull();
  });

  it('puts a hidden node before each section label, leaving the label and heading as they were', () => {
    render(
      <SectionHeading id="work-title" label="Selected work" title="Things I built">
        <p>Intro</p>
      </SectionHeading>,
    );
    const heading = screen.getByRole('heading', { level: 2, name: 'Things I built' });
    const label = screen.getByText('Selected work');
    const node = label.firstElementChild!;

    expect(heading).toHaveAttribute('id', 'work-title');
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(label).toHaveTextContent(/^Selected work$/);
    expect(node).toHaveAttribute('aria-hidden', 'true');
    expect(node).toBeEmptyDOMElement();
  });

  it('ends at the contact email, whose link is still named by the address alone', () => {
    render(<Contact />);
    const email = screen.getByRole('link', { name: person.email });
    const address = email.querySelector(`.${signalAddress}`)!;

    expect(email).toHaveClass(signalEnd!);
    expect(email).toHaveAttribute('href', person.links.email);
    // The green underline is drawn by a copy of this attribute in CSS, with empty alt text.
    expect(address).toHaveAttribute('data-address', person.email);
    expect(address).toHaveTextContent(person.email);
    // Contact's heading keeps the id and focus target its section links rely on.
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('id', 'contact-title');
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('tabindex', '-1');
  });
});
