import styles from './signal.module.css';

/**
 * Follow the signal: a green line from the hero's status dot, down the left gutter past each
 * section label, into the email address in Contact. Pure CSS (see signal.module.css), so it ships
 * no JavaScript. The home page mounts it once, inside <main> after Contact (its two anchors come
 * first); it is drawn only on a page that has both of its ends.
 */
export function Signal() {
  return (
    <div aria-hidden data-signal="line" className={styles.signal}>
      <div className={styles.intro}>
        <div className={styles.trace} />
      </div>
    </div>
  );
}

/** The node on the line beside a section label. It lights as the line reaches it. */
export function SignalNode() {
  return <span aria-hidden data-signal="node" className={styles.node} />;
}

/** The element the line starts from (the hero's status dot). */
export const signalOrigin = styles.origin;
/** The link the line arrives at (the email address in Contact). */
export const signalEnd = styles.end;
/** The address text inside that link, with the address in `data-address` for its underline. */
export const signalAddress = styles.address;
