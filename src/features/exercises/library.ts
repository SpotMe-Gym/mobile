/**
 * Exercise library: Free Exercise DB (public domain, github.com/yuhonas/free-exercise-db),
 * bundled so search works offline. Photos (start and end position) come from jsDelivr,
 * pinned to the dataset commit so they never change under us.
 *
 * Ids are the dataset's ids ("Barbell_Bench_Press_-_Medium_Grip"); custom exercises use
 * "custom:<uuid>". Workouts store these ids, so the media source can change without touching
 * anyone's plans.
 */
import raw from '@/features/exercises/exercise-library.json';

export type Muscle =
  | 'abdominals'
  | 'abductors'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'forearms'
  | 'glutes'
  | 'hamstrings'
  | 'lats'
  | 'lower back'
  | 'middle back'
  | 'neck'
  | 'quadriceps'
  | 'shoulders'
  | 'traps'
  | 'triceps';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';

export interface LibraryExercise {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'expert';
  category: string;
  equipment: string;
  force: string | null;
  mechanic: string | null;
  primary: Muscle[];
  secondary: Muscle[];
  instructions: string[];
  frames: number;
}

const data = raw as unknown as { commit: string; exercises: LibraryExercise[] };

export const EXERCISES: readonly LibraryExercise[] = data.exercises;
const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export const CUSTOM_PREFIX = 'custom:';
export const isCustomId = (id: string | undefined): boolean => !!id && id.startsWith(CUSTOM_PREFIX);

export function getLibraryExercise(id: string | undefined): LibraryExercise | undefined {
  return id ? BY_ID.get(id) : undefined;
}

const MEDIA_BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${data.commit}/exercises`;

/** Start and end position photos (empty when the dataset has none). */
export function frameUrls(id: string | undefined): string[] {
  const e = getLibraryExercise(id);
  if (!e || e.frames < 1) return [];
  return Array.from({ length: e.frames }, (_, i) => `${MEDIA_BASE}/${encodeURIComponent(e.id)}/${i}.jpg`);
}

export const MUSCLE_GROUPS: Record<MuscleGroup, readonly Muscle[]> = {
  chest: ['chest'],
  back: ['lats', 'middle back', 'lower back', 'traps'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  core: ['abdominals'],
};
export const GROUP_ORDER: readonly MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

export function groupOf(muscle: string): MuscleGroup | null {
  for (const g of GROUP_ORDER) if ((MUSCLE_GROUPS[g] as readonly string[]).includes(muscle)) return g;
  return null;
}

/** Italian gym words → the English words the library uses (searching "panca" finds bench presses). */
const ALIASES: Record<string, string[]> = {
  panca: ['bench'],
  piana: ['flat', 'bench'],
  inclinata: ['incline'],
  declinata: ['decline'],
  stacco: ['deadlift'],
  stacchi: ['deadlift'],
  affondi: ['lunge'],
  affondo: ['lunge'],
  rematore: ['row'],
  trazioni: ['pull-up', 'chin-up', 'pullup', 'chin'],
  trazione: ['pull-up', 'chin-up'],
  lat: ['pulldown', 'lat'],
  piegamenti: ['push-up', 'pushup'],
  flessioni: ['push-up', 'pushup'],
  alzate: ['raise'],
  laterali: ['lateral'],
  frontali: ['front'],
  spinte: ['press'],
  distensioni: ['press'],
  lento: ['military', 'overhead', 'shoulder press'],
  polpacci: ['calf'],
  addominali: ['crunch', 'sit-up', 'ab'],
  manubri: ['dumbbell'],
  manubrio: ['dumbbell'],
  bilanciere: ['barbell'],
  cavi: ['cable'],
  cavo: ['cable'],
  macchina: ['machine'],
  bicipiti: ['biceps', 'curl'],
  tricipiti: ['triceps'],
  spalle: ['shoulder'],
  petto: ['chest'],
  pettorali: ['chest'],
  dorsali: ['lats', 'pulldown'],
  dorso: ['back', 'row'],
  schiena: ['back'],
  gambe: ['leg'],
  glutei: ['glute'],
  femorali: ['hamstring', 'leg curl'],
  quadricipiti: ['quadriceps', 'leg extension'],
  croci: ['fly', 'flye'],
  estensioni: ['extension'],
  pressa: ['leg press'],
  ponte: ['bridge'],
  allungamento: ['stretch'],
  salto: ['jump'],
  salti: ['jump'],
  corsa: ['run'],
  vogatore: ['rowing'],
  kettlebell: ['kettlebell'],
  elastico: ['band'],
  elastici: ['bands'],
  rumeno: ['romanian'],
  rumeni: ['romanian'],
  bulgaro: ['split squat'],
  bulgari: ['split squat'],
  militare: ['military'],
  pulley: ['cable row', 'pulldown'],
  tirate: ['upright row'],
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim();

/** Precomputed search text per exercise: name + muscles + equipment. */
const HAYSTACK = new Map(
  EXERCISES.map((e) => [e.id, fold(`${e.name} ${e.primary.join(' ')} ${e.equipment}`)] as const),
);

/** Gym staples: ranked first when they match, so "panca" finds the bench press before bench dips. */
const STAPLES = new Set([
  'Barbell_Bench_Press_-_Medium_Grip',
  'Barbell_Full_Squat',
  'Barbell_Deadlift',
  'Standing_Military_Press',
  'Barbell_Shoulder_Press',
  'Dumbbell_Shoulder_Press',
  'Wide-Grip_Lat_Pulldown',
  'Pullups',
  'Chin-Up',
  'Pushups',
  'Bent_Over_Barbell_Row',
  'Dumbbell_Bench_Press',
  'Incline_Dumbbell_Press',
  'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'Leg_Press',
  'Romanian_Deadlift',
  'Barbell_Curl',
  'Hammer_Curls',
  'Triceps_Pushdown',
  'Dips_-_Triceps_Version',
  'Side_Lateral_Raise',
  'Seated_Cable_Rows',
  'Face_Pull',
  'Cable_Crossover',
  'Plank',
  'Crunches',
  'Hanging_Leg_Raise',
  'Barbell_Hip_Thrust',
  'Lying_Leg_Curls',
  'Leg_Extensions',
  'Standing_Calf_Raises',
  'Dumbbell_Lunges',
  'Goblet_Squat',
]);
const popularity = (e: LibraryExercise) =>
  (STAPLES.has(e.id) ? 3 : 0) +
  (e.category === 'strength' || e.category === 'powerlifting' ? 2 : 0) +
  (e.mechanic === 'compound' ? 1 : 0) +
  (e.level === 'beginner' ? 0.5 : 0) -
  e.name.length / 100;

export interface SearchFilters {
  group?: MuscleGroup;
  equipment?: string;
}

/** Ranked search: every word must match (in English, or through an Italian alias). */
export function searchExercises(query: string, filters: SearchFilters = {}, limit = 80): LibraryExercise[] {
  const words = fold(query).split(' ').filter(Boolean);
  const variants = words.map((w) => [w, ...(ALIASES[w] ?? [])].map(fold));
  const groupMuscles = filters.group ? MUSCLE_GROUPS[filters.group] : null;

  const scored: { e: LibraryExercise; score: number }[] = [];
  for (const e of EXERCISES) {
    if (groupMuscles && !e.primary.some((m) => groupMuscles.includes(m))) continue;
    if (filters.equipment && e.equipment !== filters.equipment) continue;
    const hay = HAYSTACK.get(e.id) ?? '';
    const name = fold(e.name);
    let score = popularity(e);
    let ok = true;
    for (const options of variants) {
      let best = -1;
      for (const v of options) {
        if (name.startsWith(v)) best = Math.max(best, 4);
        else if (name.includes(` ${v}`)) best = Math.max(best, 3);
        else if (name.includes(v)) best = Math.max(best, 2);
        else if (hay.includes(v)) best = Math.max(best, 1);
      }
      if (best < 0) {
        ok = false;
        break;
      }
      score += best;
    }
    if (ok) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, limit).map((s) => s.e);
}
