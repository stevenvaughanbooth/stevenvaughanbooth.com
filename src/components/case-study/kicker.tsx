/**
 * A theme's kicker is set in capitals (.label), which would turn "APIs" into "APIS". Words in
 * capitals with a lowercase plural are kept as written.
 */
export function kickerParts(text: string): { text: string; asWritten: boolean }[] {
  return text
    .split(/(\b[A-Z]{2,}s\b)/)
    .filter(Boolean)
    .map((part) => ({ text: part, asWritten: /^[A-Z]{2,}s$/.test(part) }));
}

export function Kicker({ text }: { text: string }) {
  return kickerParts(text).map((part) =>
    part.asWritten ? (
      <span key={part.text} className="normal-case">
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}
