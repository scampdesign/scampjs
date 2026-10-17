import styles from './Button.module.css';

type ButtonProps = {
  variant?: "default" | "outline" | "secondary";
  size?: "small" | "medium" | "large";
  label?: string;
  onClick?: () => void;
  className?: string;
};

export default function Button({ variant = "default", size = "medium", label = "Save", onClick, className }: ButtonProps) {
  return (
    <button data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} type="button" data-variant={variant} data-size={size} onClick={onClick}>
      <span data-scamp-id="label_c1a1" className={styles.label_c1a1}>{label}</span>
    </button>
  );
}

export const _scamp = { contract: 2, events: ['onClick'] } as const;
