import { useState, type SubmitEvent } from 'react';
import { useServices } from '../../app/services';
import { Button } from '../../components/ui/Button';
import { Field, FormRow, Input, Select, TextArea } from '../../components/ui/Form';
import type { Participant, ParticipantRole, ParticipantSeason, Publication } from '../../domain/models';
import { useAction } from '../../hooks/useAction';
import { fireAndForget } from '../../lib/async';
import styles from './Participant.module.css';

interface ProfileEditorProps {
  participant: Participant;
  /** Temporadas oficiais publicadas, para ligar cada participação ao cartão dela. */
  seasons: Publication[];
  onSaved: () => void;
  onImported: () => void;
}

const EMPTY_SEASON: ParticipantSeason = { label: '', seasonId: null, role: null, roleDetail: null, fate: null, placement: null, shieldWins: null, episodes: null };
const ROLES: { value: ParticipantRole | ''; label: string }[] = [
  { value: '', label: 'Não informado' },
  { value: 'FAITHFUL', label: 'Fiel' },
  { value: 'TRAITOR', label: 'Traidor(a)' },
  { value: 'RECRUITED', label: 'Recrutado(a)' },
];

const toNumber = (value: string) => (value.trim() === '' ? null : Math.max(0, Math.round(Number(value))));

/** Edita a página do participante: importa da wiki Fandom ou ajusta à mão temporadas, spoilers e realities. */
export function ProfileEditor({ participant, seasons, onSaved, onImported }: Readonly<ProfileEditorProps>) {
  const { characters } = useServices();
  const profile = participant.profile;
  const [wikiUrl, setWikiUrl] = useState(profile?.wikiUrl ?? '');
  const [list, setList] = useState<ParticipantSeason[]>(profile?.seasons ?? []);
  const [shows, setShows] = useState((profile?.otherShows ?? []).join('\n'));

  const importWiki = useAction(() => characters.importWiki(participant.id, wikiUrl.trim()), { success: 'Informações importadas da wiki' });
  const save = useAction(
    () =>
      characters.update(participant.id, {
        profile: {
          wikiUrl: wikiUrl.trim() || null,
          seasons: list.filter((s) => s.label.trim()),
          otherShows: shows.split('\n').map((s) => s.trim()).filter(Boolean),
        },
      }),
    { success: 'Página do participante salva' },
  );

  const set = (i: number, patch: Partial<ParticipantSeason>) => setList((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  async function handleImport() {
    const imported = await importWiki.run();
    if (!imported) return;
    // O que veio da wiki já está salvo; o formulário mostra o resultado para ajustes.
    setWikiUrl(imported.profile?.wikiUrl ?? wikiUrl);
    setList(imported.profile?.seasons ?? []);
    setShows((imported.profile?.otherShows ?? []).join('\n'));
    onImported();
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (await save.run()) onSaved();
  }

  return (
    <form className={styles.editor} onSubmit={fireAndForget(handleSubmit)}>
      <h1 className={styles.name}>{participant.name}</h1>
      <Field label="Página na wiki Fandom" hint="Ex.: https://thetraitors.fandom.com/wiki/Dorinda_Medley. Importar preenche temporadas, papel, destino, outros realities e as fotos de cada temporada.">
        {(id) => (
          <div className={styles.inline}>
            <Input id={id} type="url" value={wikiUrl} onChange={(e) => setWikiUrl(e.target.value)} placeholder="https://thetraitors.fandom.com/wiki/..." />
            <Button variant="ghost" disabled={!wikiUrl.trim()} pending={importWiki.pending} onClick={fireAndForget(handleImport)}>
              Importar da wiki
            </Button>
          </div>
        )}
      </Field>

      <h2 className={styles.blockTitle}>Temporadas de The Traitors</h2>
      {list.map((s, i) => (
        <fieldset key={i} className={styles.seasonEditor}>
          <legend>{s.label || `Temporada ${i + 1}`}</legend>
          <FormRow>
            <Field label="Temporada">{(id) => <Input id={id} value={s.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="EUA · 4ª temporada" maxLength={120} required />}</Field>
            <Field label="Cartão da temporada no site">
              {(id) => (
                <Select id={id} value={s.seasonId ?? ''} onChange={(e) => set(i, { seasonId: e.target.value || null })}>
                  <option value="">Nenhum</option>
                  {seasons.map((p) => (
                    <option key={p.id} value={p.seasonId ?? ''}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Papel (spoiler)">
              {(id) => (
                <Select id={id} value={s.role ?? ''} onChange={(e) => set(i, { role: (e.target.value || null) as ParticipantRole | null })}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Detalhe do papel">{(id) => <Input id={id} value={s.roleDetail ?? ''} onChange={(e) => set(i, { roleDetail: e.target.value || null })} placeholder="Recrutado(a) no episódio 9" maxLength={200} />}</Field>
          </FormRow>
          <FormRow>
            <Field label="Destino (spoiler)">{(id) => <Input id={id} value={s.fate ?? ''} onChange={(e) => set(i, { fate: e.target.value || null })} placeholder="Assassinado(a) no episódio 9" maxLength={200} />}</Field>
            <Field label="Colocação">{(id) => <Input id={id} value={s.placement ?? ''} onChange={(e) => set(i, { placement: e.target.value || null })} placeholder="10º de 23" maxLength={40} />}</Field>
          </FormRow>
          <FormRow>
            <Field label="Escudos ganhos">{(id) => <Input id={id} type="number" min={0} value={s.shieldWins ?? ''} onChange={(e) => set(i, { shieldWins: toNumber(e.target.value) })} />}</Field>
            <Field label="Episódios">{(id) => <Input id={id} type="number" min={0} value={s.episodes ?? ''} onChange={(e) => set(i, { episodes: toNumber(e.target.value) })} />}</Field>
          </FormRow>
          <div>
            <Button variant="quiet" size="sm" onClick={() => setList((all) => all.filter((_, j) => j !== i))}>
              Tirar esta temporada
            </Button>
          </div>
        </fieldset>
      ))}
      <div>
        <Button variant="ghost" size="sm" onClick={() => setList((all) => [...all, { ...EMPTY_SEASON }])} disabled={list.length >= 20}>
          Adicionar temporada
        </Button>
      </div>

      <Field label="Outros realities" hint="Um por linha.">
        {(id) => <TextArea id={id} rows={3} value={shows} onChange={(e) => setShows(e.target.value)} placeholder={'Love Island USA\nThe Real Housewives of New York City'} />}
      </Field>

      <div>
        <Button type="submit" pending={save.pending}>
          Salvar página
        </Button>
      </div>
    </form>
  );
}
