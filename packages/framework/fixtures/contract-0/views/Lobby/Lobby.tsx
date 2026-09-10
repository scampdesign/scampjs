import styles from './Lobby.module.css';
import LinkCard from '@/components/LinkCard/LinkCard';
import RoundTag from '@/components/RoundTag/RoundTag';

type LobbyProps = {
  code?: string;
  joinedLabel?: string;
  players?: Array<{ id: string; label: string; url: string; status: string }>;
  waiting?: boolean;
  canStart?: boolean;
  onCopy?: (id: string) => void;
  onStart?: () => void;
  className?: string;
};

export default function Lobby({
  code = "KZQ4",
  joinedLabel = "2 of 4 joined",
  players = [
    { id: "1", label: "Player 1 · Alex", url: "https://example.com/game/KZQ4/player-1", status: "Joined" },
    { id: "2", label: "Player 2 · Bea", url: "https://example.com/game/KZQ4/player-2", status: "Open" },
  ],
  waiting = true,
  canStart = false,
  onCopy,
  onStart,
  className,
}: LobbyProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`}>
      <header data-scamp-id="page_header_e1c1" className={styles.page_header_e1c1}>
        <p data-scamp-id="kicker_e1c2" className={styles.kicker_e1c2}>Step 3 of 3</p>
        <h1 data-scamp-id="page_title_e1c3" className={styles.page_title_e1c3}>Share the links</h1>
      </header>
      <section data-scamp-id="code_card_e1d0" className={styles.code_card_e1d0}>
        <p data-scamp-id="code_label_e1d1" className={styles.code_label_e1d1}>Room code</p>
        <h2 data-scamp-id="code_value_e1d2" className={styles.code_value_e1d2}>{code}</h2>
      </section>
      <section data-scamp-id="links_section_e1e0" className={styles.links_section_e1e0}>
        <div data-scamp-id="links_head_e1e1" className={styles.links_head_e1e1}>
          <h2 data-scamp-id="section_title_e1e2" className={styles.section_title_e1e2}>Player links</h2>
          <RoundTag data-scamp-instance-id="inst_7d19" label={joinedLabel} />
        </div>
        <div data-scamp-id="links_list_e1e3" className={styles.links_list_e1e3}>
          {players.map((player) => (
            <LinkCard data-scamp-instance-id="inst_2c40" key={player.id} label={player.label} url={player.url} status={player.status}>
              <button data-scamp-id="copy_button_e1f1" className={styles.copy_button_e1f1} type="button" onClick={() => onCopy?.(player.id)}>Copy link</button>
            </LinkCard>
          ))}
        </div>
        {waiting && (
          <p data-scamp-id="waiting_note_e1f5" className={styles.waiting_note_e1f5}>Waiting for everyone to join</p>
        )}
      </section>
      <button data-scamp-id="start_button_e1f9" className={styles.start_button_e1f9} type="button" disabled={!canStart} onClick={onStart}>Start the game</button>
    </div>
  );
}

export const _scamp = { contract: 0, events: ['onCopy', 'onStart'] } as const;
