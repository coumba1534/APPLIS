// Noms d'Allah en couleur : le nom « Allah » sous toutes ses formes et « Rabb » (le Seigneur).
// Le repérage se fait sur les lettres seules (sans voyelles ni signes du mushaf).

/** Enlève voyelles, signes coraniques et tatweel ; ramène les formes d'alif à ا. */
export function letters(word: string) {
  return word
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ\s]/g, '')
    .replace(/[ٱآأإٲٳ]/g, 'ا');
}

// Allah : ٱللَّه, لِلَّهِ, بِٱللَّهِ, وَٱللَّهُ, تَٱللَّهِ, ءَآللَّهُ, ٱللَّهُمَّ…
// (et pas ٱللَّهَب « la flamme » ni ٱللَّهۡو « le divertissement »).
const ALLAH = /^(?:[وفءا]?[بتكل]?)?(?:الله|لله)م?$/;

// Rabb : رَبِّ, رَبُّكَ, رَبَّنَا, لِرَبِّهِۦ, فَبِرَبِّكُم, فَوَرَبِّكَ (serment), يَٰرَبِّ (« ô mon Seigneur »)…
// (et pas رُبَمَا « peut-être », أَرۡبَاب « des seigneurs », ٱلرِّبَوٰا « l'usure », يُرۡبِي « il fait fructifier », رَبَائِب…).
const RABB = /^(?:[وف]{0,2}[بل]?رب(?:ك|كم|كما|ه|ها|هم|هما|نا|ي)?|[وف]?يرب)$/;

export const isAllah = (word: string) => ALLAH.test(letters(word));
export const isRabb = (word: string) => RABB.test(letters(word));

/**
 * Versets où « Rabb » désigne un être humain ou un astre, et non Allah : on ne colore pas.
 * Clé « sourate:verset » → numéros (1, 2…) des occurrences de Rabb concernées dans le verset.
 * À faire vérifier.
 */
export const RABB_EXCEPTIONS: Record<string, number[]> = {
  '6:76': [1], // « هَٰذَا رَبِّي » : Ibrahim et l'étoile
  '6:77': [1], // « هَٰذَا رَبِّي » : la lune (la 2e occurrence, « رَبِّي » qui guide, est Allah)
  '6:78': [1], // « هَٰذَا رَبِّي » : le soleil
  '12:23': [1], // « إِنَّهُۥ رَبِّيٓ أَحۡسَنَ مَثۡوَايَ » : son maître (selon la majorité des exégètes)
  '12:41': [1], // « فَيَسۡقِي رَبَّهُۥ خَمۡرٗا » : son maître, le roi
  '12:42': [1, 2], // « ٱذۡكُرۡنِي عِندَ رَبِّكَ … ذِكۡرَ رَبِّهِۦ » : le roi
  '12:50': [1], // « ٱرۡجِعۡ إِلَىٰ رَبِّكَ » : le roi (la 2e occurrence, « إِنَّ رَبِّي », est Allah)
  '79:24': [1], // « أَنَا۠ رَبُّكُمُ ٱلۡأَعۡلَىٰ » : parole de Pharaon
};

/** Pour les mots d'un verset : vrai si le mot doit être coloré. */
export function divineMask(words: string[], s: number, n: number): boolean[] {
  const skip = RABB_EXCEPTIONS[`${s}:${n}`] ?? [];
  let rabb = 0;
  return words.map((w) => {
    if (isAllah(w)) return true;
    if (isRabb(w)) { rabb++; return !skip.includes(rabb); }
    return false;
  });
}
