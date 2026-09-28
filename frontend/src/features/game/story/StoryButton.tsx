import { fireAndForget } from '../../../lib/async';
import { domToPng } from 'modern-screenshot';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { phaseLabel } from '../../../domain/labels';
import { toRoman } from '../../../lib/format';
import { useGame } from '../context/GameContext';
import { refitLines, STORY_SIZE, StoryCard } from './StoryCard';
import { useStoryShared } from './StoryContext';
import { castScene, recordedVotesScene, shieldedToday, shieldScene, storyScene, type StoryScene } from './storyScene';
import styles from './StoryButton.module.css';

/** Fontes usadas só na arte: são carregadas antes de desenhar. */
const STORY_FONTS = ['700 49px "Cinzel"', '600 20px "Cinzel"', '400 16px "DM Sans"', '700 16px "DM Sans"', 'italic 600 19px "Cormorant Garamond"', 'italic 400 19px "Cormorant Garamond"', '700 21px "Cormorant Garamond"'];

interface Request {
  scene: StoryScene;
  /** Identifica a arte no nome do arquivo. */
  label: string;
}

interface Story {
  url: string;
  fileName: string;
  label: string;
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Espera fontes e fotos da arte carregarem (foto quebrada não trava a exportação). */
async function whenReady(node: HTMLElement) {
  await Promise.all(STORY_FONTS.map((font) => document.fonts.load(font).catch(() => undefined)));
  await Promise.all([...node.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)));
  // com as fontes finais, as linhas do anúncio são medidas de novo para não passarem da caixa
  refitLines(node);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/**
 * Botões das artes do Instagram (1080×1920):
 *  - a situação da fase atual;
 *  - o elenco inteiro, com mortos e banidos atualizados;
 *  - quem recebeu escudo hoje (aparece quando há escudos);
 *  - a torre, com um encapuzado no lugar dos Traidores (durante o conclave).
 */
export function StoryButton() {
  const game = useGame();
  const draft = useStoryShared();
  const { state } = game;
  const [request, setRequest] = useState<Request | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const day = `Dia ${toRoman(state.day ?? 1)}`;
  const phaseName = state.phase ? ` · ${phaseLabel[state.phase]}` : '';
  const moment = `${day}${phaseName}`;
  const hasShields = shieldedToday(game, draft.shieldIds).length > 0;
  const atTable = state.phase === 'ROUND_TABLE' || state.phase === 'ENDGAME_ROUND_TABLE';
  const votesScene = atTable ? recordedVotesScene(game) : null;

  useEffect(() => {
    const node = cardRef.current;
    if (!request || !node) return;
    let cancelled = false;
    void (async () => {
      try {
        await whenReady(node);
        const url = await domToPng(node, { width: STORY_SIZE.width, height: STORY_SIZE.height, scale: STORY_SIZE.scale });
        if (!cancelled) setStory({ url, label: request.label, fileName: `the-traitors-${slug(state.season.name)}-${slug(request.label)}.png` });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível gerar a imagem.');
      } finally {
        if (!cancelled) setRequest(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request, state.season.name]);

  function generate(next: Request) {
    setError(null);
    setRequest(next);
  }

  async function share() {
    if (!story) return;
    const blob = await (await fetch(story.url)).blob();
    const file = new File([blob], story.fileName, { type: 'image/png' });
    await navigator.share({ files: [file] }).catch(() => undefined);
  }

  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([], 'x.png', { type: 'image/png' })] });

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.buttons}>
          <Button variant="ghost" pending={request?.label === moment} disabled={!!request} onClick={() => generate({ scene: storyScene(game, draft), label: moment })}>
            Estilizar para o Instagram
          </Button>
          <Button variant="ghost" pending={request?.label === `Elenco · ${day}`} disabled={!!request} onClick={() => generate({ scene: castScene(game), label: `Elenco · ${day}` })}>
            Estilizar elenco atualizado
          </Button>
          {/* Depois de confirmar a votação, a arte principal vira a do banimento; os votos continuam disponíveis. */}
          {votesScene && draft.votes.length === 0 && (
            <Button variant="ghost" pending={request?.label === `Votos · ${moment}`} disabled={!!request} onClick={() => generate({ scene: votesScene, label: `Votos · ${moment}` })}>
              Estilizar votos
            </Button>
          )}
          {state.phase === 'TRAITORS_MEETING' && (
            <Button variant="ghost" pending={request?.label === `Torre · ${day}`} disabled={!!request} onClick={() => generate({ scene: { kind: 'tower' }, label: `Torre · ${day}` })}>
              Estilizar torre
            </Button>
          )}
          {hasShields && (
            <Button variant="ghost" pending={request?.label === `Escudos · ${day}`} disabled={!!request} onClick={() => generate({ scene: shieldScene(game, draft.shieldIds), label: `Escudos · ${day}` })}>
              Estilizar escudos
            </Button>
          )}
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {request &&
        createPortal(
          <div className={styles.offscreen} aria-hidden="true">
            <StoryCard ref={cardRef} scene={request.scene} seasonName={state.season.name} currency={state.season.currency} />
          </div>,
          document.body,
        )}

      <Modal
        open={!!story}
        title="Arte para o story"
        onClose={() => setStory(null)}
        footer={
          <>
            {canShare && (
              <Button variant="ghost" onClick={fireAndForget(share)}>
                Compartilhar
              </Button>
            )}
            <a className={styles.download} href={story?.url} download={story?.fileName}>
              Baixar imagem
            </a>
          </>
        }
      >
        {story && <img className={styles.preview} src={story.url} alt={`Arte do story: ${story.label}`} />}
      </Modal>
    </>
  );
}
