import { lines } from './lines';

/**
 * Bonzinho(a) demais: depois de muita gentileza sem nunca tomar partido, o castelo estranha.
 * {user} = quem estranha, {user1} = jogador.
 */

/** Quem recebeu a gentileza responde com o pé atrás. */
export const REPLY_TOO_NICE = lines(`
{user} estranhou: "Tanto elogio... O que você quer de mim, {user1}?"
{user} cruzou os braços: "Bonzinho(a) demais, {user1}. Os Traidores também são."
{user} sorriu sem graça: "Você é gentil com todo mundo, {user1}. Isso me deixa com o pé atrás."
{user} riu de canto: "Você nunca desconfia de ninguém, {user1}? Estranho."
{user} disse: "Quem agrada todo mundo esconde alguma coisa, {user1}."
{user} desconfiou: "Esse charme todo é estratégia, {user1}?"
{user} apertou os olhos: "Você não tem um inimigo aqui dentro, {user1}. Como pode?"
{user} disse: "Obrigado(a)... mas eu já vi esse filme, {user1}."
{user} ficou em silêncio, medindo {user1} de cima a baixo.
{user} respondeu seco(a): "Tá bom, {user1}. Agora fala sério."
`);

/** Alguém que ouviu comenta à parte. */
export const ASIDE_TOO_NICE = lines(`
{user} cochichou do outro lado: "{user1} é bonzinho(a) demais. Isso não me cheira bem."
{user} comentou baixinho: "Já reparou que {user1} nunca acusa ninguém?"
{user} revirou os olhos para tanta gentileza de {user1}.
{user} murmurou: "Agradar todo mundo é o jogo perfeito de um Traidor."
{user} observou {user1} em silêncio. Tanta simpatia assim incomoda.
{user} comentou: "{user1} quer ser amigo(a) de todo mundo. Por quê?"
`);

/** Alguém vem falar a sós: tanta gentileza assusta. */
export const APPROACH_TOO_NICE = lines(`
{user} chamou {user1} num canto: "Posso ser sincero(a)? Você é bonzinho(a) demais. Isso assusta."
{user} disse a {user1}: "Você nunca escolhe um lado. Tá esperando o quê?"
{user} cochichou: "{user1}, quem não acusa ninguém vira suspeito aqui dentro."
{user} disse a {user1}: "Tem gente achando que você é Traidor(a). Simpatia demais."
{user} disse a {user1}: "Você elogia todo mundo. Até quem você nem conhece. Por quê?"
{user} avisou {user1}: "Ser querido(a) por todos é ótimo... até alguém perguntar o motivo."
{user} disse a {user1}: "Uma hora você vai ter que apontar alguém. Ou vão apontar você."
`);
