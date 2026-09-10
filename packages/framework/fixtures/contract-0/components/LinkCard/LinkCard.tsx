import styles from './LinkCard.module.css';

type LinkCardProps = {
  label?: string;
  url?: string;
  status?: string;
  children?: React.ReactNode;
  className?: string;
};

export default function LinkCard({ label = "Player 1", url = "https://example.com", status = "Open", children, className }: LinkCardProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`}>
      <a data-scamp-id="link_b2c1" className={styles.link_b2c1} href={url}>{label}</a>
      <span data-scamp-id="status_b2c2" className={styles.status_b2c2}>{status}</span>
      <div data-scamp-id="actions_b2c3" className={styles.actions_b2c3}>{children}</div>
    </div>
  );
}

export const _scamp = { contract: 0, events: [] } as const;
