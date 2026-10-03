import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IWikiClient, WikiParticipantData } from '../../src/application/ports/IWikiClient';
import { parseParticipant } from '../../src/infrastructure/http/fandomParser';
import { wikiPage } from '../../src/infrastructure/http/FandomWikiClient';
import { buildApp } from '../../src/main/app';
import { createCharacters, createSeason, ok, signUp } from '../helpers';

/** Wiki falsa: o que a página da Dorinda diz (duas temporadas, duas fotos), sem internet. */
const DORINDA: WikiParticipantData = {
  wikiUrl: 'https://thetraitors.fandom.com/wiki/Dorinda_Medley',
  seasons: [
    { code: 'US3', label: 'EUA · 3ª temporada', role: 'FAITHFUL', roleDetail: null, fate: 'Assassinado(a) no episódio 2', placement: '23º de 23', shieldWins: 0, episodes: 2 },
    { code: 'US4', label: 'EUA · 4ª temporada', role: 'FAITHFUL', roleDetail: null, fate: 'Assassinado(a) no episódio 9', placement: '10º de 23', shieldWins: 1, episodes: 9 },
  ],
  otherShows: ['The Real Housewives of New York City'],
  photos: [
    { url: 'https://example.com/us4-dorinda.webp', label: 'EUA · 4ª temporada' },
    { url: 'https://example.com/us3-dorinda.webp', label: 'EUA · 3ª temporada' },
  ],
};
const fakeWiki: IWikiClient = { participant: async () => DORINDA };
const wikiApp = buildApp({ wiki: fakeWiki });

describe('página do participante, fotos por cast e wiki', () => {
  it('importa da wiki, liga à temporada oficial publicada e abre para todos só nos personagens dos donos', async () => {
    const { agent: owner } = await signUp('wikidono', true, wikiApp);
    const [dorinda] = await createCharacters(owner, ['Dorinda Medley']);
    // Uma temporada oficial com as missões da 4ª temporada americana.
    const season = await createSeason(owner, 4, { missionPool: 'US_S4' });
    const publication = ok(await owner.post('/api/publications').send({ kind: 'SEASON', sourceId: season.id }), 201);

    const imported = ok(await owner.post(`/api/characters/${dorinda}/wiki`).send({ url: DORINDA.wikiUrl }));
    expect(imported.profile.seasons.map((s: { label: string }) => s.label)).toEqual(['EUA · 3ª temporada', 'EUA · 4ª temporada']);
    expect(imported.profile.seasons[1].publicationId).toBe(publication.id);
    expect(imported.photos).toHaveLength(2);
    expect(imported.imageUrl).toBe(DORINDA.photos[0].url);

    // Editar à mão: outra temporada e outro reality.
    const profile = { ...imported.profile, otherShows: [...imported.profile.otherShows, 'Ultimate Girls Trip'] };
    ok(await owner.patch(`/api/characters/${dorinda}`).send({ profile }));

    const { agent: fan } = await signUp('wikifa', false, wikiApp);
    const page = ok(await fan.get(`/api/participants/${dorinda}`));
    expect(page.canEdit).toBe(false);
    expect(page.profile.otherShows).toContain('Ultimate Girls Trip');
    expect(ok(await owner.get(`/api/participants/${dorinda}`)).canEdit).toBe(true);
    expect((await fan.post(`/api/characters/${dorinda}/wiki`).send({ url: DORINDA.wikiUrl })).status).toBe(404);

    // Personagem de fã: só quem criou vê a página.
    const [mine] = await createCharacters(fan, ['Minha Personagem']);
    expect((await owner.get(`/api/participants/${mine}`)).status).toBe(404);
    ok(await fan.get(`/api/participants/${mine}`));
  });

  it('cada cast usa a sua foto do personagem, inclusive na temporada criada a partir dele', async () => {
    const { agent } = await signUp('fotos', false, wikiApp);
    const ids = await createCharacters(agent, ['Foto A', 'Foto B', 'Foto C', 'Foto D']);
    ok(await agent.patch(`/api/characters/${ids[0]}`).send({ imageUrl: 'https://example.com/a.png', photos: [{ url: 'https://example.com/a-t4.png', label: 'T4' }] }));
    const cast = ok(await agent.post('/api/casts').send({ name: 'Temporada 4', characterIds: ids }), 201);

    const updated = ok(await agent.patch(`/api/casts/${cast.id}/members/${ids[0]}/photo`).send({ imageUrl: 'https://example.com/a-t4.png' }));
    expect(updated.characters[0].imageUrl).toBe('https://example.com/a-t4.png');
    expect(ok(await agent.get(`/api/characters/${ids[0]}`)).imageUrl).toBe('https://example.com/a.png');

    const season = ok(await agent.post('/api/seasons').send({ name: 'Com fotos', castId: cast.id }), 201);
    expect(season.players.find((p: { characterId: string }) => p.characterId === ids[0]).imageUrl).toBe('https://example.com/a-t4.png');

    // Tirar do cast apaga a escolha; null volta à foto principal.
    ok(await agent.patch(`/api/casts/${cast.id}/members/${ids[0]}/photo`).send({ imageUrl: null }));
    expect(ok(await agent.get(`/api/casts/${cast.id}`)).characters[0].imageUrl).toBe('https://example.com/a.png');
    expect((await agent.patch(`/api/casts/${cast.id}/members/${ids[1]}/photo`).send({ imageUrl: 'ftp://x' })).status).toBe(400);
  });
});

describe('leitura da wiki Fandom', () => {
  it('só aceita páginas de wikis da Fandom', () => {
    expect(wikiPage('https://thetraitors.fandom.com/wiki/Dorinda_Medley')).toEqual({ host: 'thetraitors.fandom.com', page: 'Dorinda Medley' });
    expect(() => wikiPage('https://evil.example.com/wiki/X')).toThrow();
    expect(() => wikiPage('http://thetraitors.fandom.com/wiki/X')).toThrow();
    expect(() => wikiPage('não é link')).toThrow();
  });

  it('entende o infobox: temporadas, recrutamento, destino, fotos e outros realities', () => {
    const wikitext = readFileSync(join(__dirname, '../fixtures/wiki-eric-nam.txt'), 'utf8');
    const parsed = parseParticipant('Eric Nam', wikitext);
    expect(parsed.seasons).toEqual([
      {
        code: 'US4',
        label: 'EUA · 4ª temporada',
        role: 'RECRUITED',
        roleDetail: 'Recrutado(a): Traidor(a) a partir do episódio 9',
        fate: 'Banido(a) no episódio 11',
        placement: '3º de 23',
        shieldWins: 2,
        episodes: 11,
      },
    ]);
    expect(parsed.images).toEqual([{ file: 'US4 Eric Nam.webp', label: 'EUA · 4ª temporada' }]);
    expect(parsed.otherShows).toEqual(['K-pop Star']);
  });
});
