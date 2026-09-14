import styles from './RoundTag.module.css';

type RoundTagProps = {
  label?: string;
  className?: string;
};

export default function RoundTag({ label = "Round 1", className }: RoundTagProps) {
  return (
    <span data-scamp-id="root" className={`${styles.root} ${className ?? ''}`}>{label}</span>
  );
}

export const _scamp = { contract: 0, events: [] } as const;
