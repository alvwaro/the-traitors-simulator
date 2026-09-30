import { Link } from 'react-router-dom';
import type { Cast } from '../../../domain/models';
import { CardCover } from './CardCover';
import styles from './Library.module.css';

interface CastCardProps {
  cast: Cast;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Abre a publicação (Área Oficial para donos, Área de Fãs para fãs). */
  onPublish: () => void;
  /** Já está na vitrine (publicar de novo atualiza a cópia). */
  published: boolean;
}

/** Capa do cast (ou o brasão com as iniciais), nome e ações. */
export function CastCard({ cast, onOpen, onEdit, onDelete, onPublish, published }: Readonly<CastCardProps>) {
  const count = cast.characters.length;

  return (
    <article className={styles.castCard}>
      <CardCover name={cast.name} imageUrl={cast.imageUrl} label={`Abrir ${cast.name}`} onOpen={onOpen} />
      <div className={styles.castBody}>
        <h3 className={styles.castName}>
          <button type="button" className={styles.castOpen} onClick={onOpen}>
            {cast.name}
          </button>
        </h3>
        <p className={styles.castMeta}>{count === 1 ? '1 personagem' : `${count} personagens`}</p>
        {cast.description && <p className={styles.castDescription}>{cast.description}</p>}
        <div className={styles.castActions}>
          <button type="button" className={styles.inlineLink} onClick={onOpen}>
            Personagens e ranking
          </button>
          <Link to={`/temporadas/nova?cast=${cast.id}`} className={styles.inlineLink}>
            Nova temporada
          </Link>
          <button type="button" className={styles.inlineLink} onClick={onEdit}>
            Editar
          </button>
          <button type="button" className={styles.inlineLink} onClick={onPublish}>
            {published ? 'Publicação' : 'Publicar'}
          </button>
          <button type="button" className={styles.dangerLink} onClick={onDelete}>
            Remover
          </button>
        </div>
      </div>
    </article>
  );
}
