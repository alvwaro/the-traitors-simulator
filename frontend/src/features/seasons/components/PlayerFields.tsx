import { Portrait } from '../../../components/player/Portrait';
import { IdentityFields } from '../../../components/player/IdentityFields';
import styles from './ModePicker.module.css';

export interface PlayerDraft {
  name: string;
  imageUrl: string;
  interactionLimit: number;
}

/** Modo Jogador: quem você é no castelo e quantas conversas pode ter em cada momento. */
export function PlayerFields({ value, onChange }: Readonly<{ value: PlayerDraft; onChange: (value: PlayerDraft) => void }>) {
  return (
    <div className={styles.simulation}>
      <div className={styles.you}>
        <Portrait name={value.name || 'Você'} imageUrl={value.imageUrl.trim() || null} size="sm" hideName />
        <div className={styles.youFields}>
          <IdentityFields
            name={value.name}
            imageUrl={value.imageUrl}
            onName={(name) => onChange({ ...value, name })}
            onImageUrl={(imageUrl) => onChange({ ...value, imageUrl })}
            nameLabel="Seu nome no jogo"
            imageLabel="Sua foto (opcional)"
            namePlaceholder="Como o castelo vai te chamar"
          />
        </div>
      </div>
      <label className={styles.chaos}>
        <span className={styles.chaosHead}>
          <span className={styles.chaosTitle}>Conversas por momento</span>
          <strong className={styles.chaosValue}>{value.interactionLimit}</strong>
        </span>
        <input type="range" min={0} max={10} value={value.interactionLimit} onChange={(e) => onChange({ ...value, interactionLimit: Number(e.target.value) })} />
        <span className={styles.chaosHint}>
          Em cada momento (chegada, café, missão, mesa redonda, mesa final) você pode falar com os personagens este número de vezes. Seu papel é sorteado como o de qualquer um.
        </span>
      </label>
    </div>
  );
}
