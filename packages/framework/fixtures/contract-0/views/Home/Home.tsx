import styles from './Home.module.css';

type HomeProps = {
  className?: string;
};

export default function Home({ className }: HomeProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`}>
      <h1 data-scamp-id="title_a1b1" className={styles.title_a1b1}>Noise With Friends</h1>
      <svg data-scamp-id="icon_a1b3" className={styles.icon_a1b3} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v18M3 12h18" /></svg>
      <p data-scamp-id="lede_a1b2" className={styles.lede_a1b2}>A party game for four people and one phone each.</p>
    </div>
  );
}

export const _scamp = { contract: 0, events: [] } as const;
