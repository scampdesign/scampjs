import styles from './Home.module.css';

type HomeProps = {
  className?: string;
};

export default function Home({ className }: HomeProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`}>
      <h1 data-scamp-id="title_a1b1" className={styles.title_a1b1}>Noise With Friends</h1>
      <p data-scamp-id="lede_a1b2" className={styles.lede_a1b2}>A party game for four people and one phone each.</p>
    </div>
  );
}

export const _scamp = { contract: 0, events: [] } as const;
