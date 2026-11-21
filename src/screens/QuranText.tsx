// Texte d'un verset, avec les noms d'Allah et de Rabb en couleur.
import { divineMask } from '../data/divine';

/** Verset (sourate s, verset n) : les mots Allah et Rabb sont entourés d'un <span class="allah">. */
export function ColoredAyah({ text, s, n }: { text: string; s: number; n: number }) {
  const words = text.split(' ');
  const mask = divineMask(words, s, n);
  return <>{words.map((w, i) => (
    <>{i > 0 && ' '}{mask[i] ? <span class="allah">{w}</span> : w}</>
  ))}</>;
}
