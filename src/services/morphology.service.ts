// English morphology: reverse-inflection for dictionary lookup.
// Given a surface form like "running" or "children", produce candidate base
// forms that are likely dictionary lemmas. This is intentionally NOT a full
// stemmer (e.g. no Porter) -- we only transform to forms that exist as real
// words in WordNet so we can hit the lemma index.

const IRREGULAR_PLURALS: Record<string, string> = {
  children: 'child',
  men: 'man',
  women: 'woman',
  people: 'person',
  feet: 'foot',
  teeth: 'tooth',
  geese: 'goose',
  mice: 'mouse',
  lice: 'louse',
  oxen: 'ox',
  dice: 'die',
  crises: 'crisis',
  analyses: 'analysis',
  bases: 'basis',
  hypotheses: 'hypothesis',
  diagnoses: 'diagnosis',
  theses: 'thesis',
  phenomena: 'phenomenon',
  criteria: 'criterion',
  media: 'medium',
  data: 'datum',
  bacteria: 'bacterium',
  vertices: 'vertex',
  indices: 'index',
  matrices: 'matrix',
  alumni: 'alumnus',
  fungi: 'fungus',
  stimuli: 'stimulus',
  syllabi: 'syllabus',
  nuclei: 'nucleus',
  radii: 'radius',
  foci: 'focus',
  curricula: 'curriculum',
  memoranda: 'memorandum',
  addenda: 'addendum',
  errata: 'erratum',
  genera: 'genus',
  vertebrae: 'vertebra',
  larvae: 'larva',
  vitae: 'vita',
};

const IRREGULAR_VERBS: Record<string, string> = {
  is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  went: 'go', gone: 'go',
  saw: 'see', seen: 'see',
  did: 'do', done: 'do',
  made: 'make',
  had: 'have',
  came: 'come',
  took: 'take', taken: 'take',
  gave: 'give', given: 'give',
  knew: 'know', known: 'know',
  grew: 'grow', grown: 'grow',
  threw: 'throw', thrown: 'throw',
  drank: 'drink', drunk: 'drink',
  ate: 'eat', eaten: 'eat',
  rode: 'ride', ridden: 'ride',
  wrote: 'write', written: 'write',
  drove: 'drive', driven: 'drive',
  broke: 'break', broken: 'break',
  spoke: 'speak', spoken: 'speak',
  woke: 'wake', woken: 'wake',
  forgot: 'forget', forgotten: 'forget',
  chose: 'choose', chosen: 'choose',
  froze: 'freeze', frozen: 'freeze',
  stole: 'steal', stolen: 'steal',
  hid: 'hide', hidden: 'hide',
  fell: 'fall', fallen: 'fall',
  rose: 'rise', risen: 'rise',
  ran: 'run',
  began: 'begin', begun: 'begin',
  sang: 'sing', sung: 'sing',
  rang: 'ring', rung: 'ring',
  swam: 'swim', swum: 'swim',
  won: 'win',
  lost: 'lose',
  bought: 'buy',
  brought: 'bring',
  caught: 'catch',
  fought: 'fight',
  taught: 'teach',
  thought: 'think',
  sold: 'sell',
  told: 'tell',
  kept: 'keep',
  slept: 'sleep',
  felt: 'feel',
  left: 'leave',
  built: 'build',
  sent: 'send',
  spent: 'spend',
  lent: 'lend',
  met: 'meet',
  read: 'read',
  put: 'put',
  set: 'set',
  hit: 'hit',
  cut: 'cut',
  shut: 'shut',
  cost: 'cost',
  hurt: 'hurt',
  paid: 'pay',
  found: 'find',
  held: 'hold',
  heard: 'hear',
  wore: 'wear', worn: 'wear',
  tore: 'tear', torn: 'tear',
  bore: 'bear', born: 'bear',
  swore: 'swear', sworn: 'swear',
  lied: 'lie',
  laid: 'lay',
};

function stripIrregular(word: string): string | null {
  return IRREGULAR_VERBS[word] ?? IRREGULAR_PLURALS[word] ?? null;
}

function stripSuffixedForm(word: string): string[] {
  const lower = word.toLowerCase();
  if (!/^[a-z]+$/.test(lower) || lower.length <= 2) {
    return [];
  }
  const candidates: string[] = [];

  // progressive: running -> run, making -> make
  if (lower.endsWith('ing')) {
    const stem = lower.slice(0, -3);
    candidates.push(`${stem}e`, stem);
    if (stem.length > 2 && stemsConsonantDoubled(stem)) {
      candidates.unshift(stem.slice(0, -1));
    }
    if (stem.endsWith('y')) {
      candidates.push(`${stem.slice(0, -1)}ie`);
    }
  }

  // past tense / past participle: walked -> walk, tried -> try, stopped -> stop
  if (lower.endsWith('ed')) {
    const stem = lower.slice(0, -2);
    candidates.push(stem);
    if (stem.endsWith('ie')) {
      candidates.push(`${stem.slice(0, -2)}y`);
    } else if (stem.endsWith('i')) {
      candidates.push(`${stem.slice(0, -1)}y`);
    } else if (stem.endsWith('e')) {
      candidates.push(stem, stem);
    }
    if (stem.length > 2 && stemsConsonantDoubled(stem)) {
      candidates.push(stem.slice(0, -1));
    }
  }

  // plural: books -> book, babies -> baby, boxes -> box, leaves -> leaf
  if (lower.endsWith('ies')) {
    candidates.push(`${lower.slice(0, -3)}y`);
  }
  if (lower.endsWith('es')) {
    const stem = lower.slice(0, -2);
    candidates.push(stem);
    if (stem.endsWith('v')) {
      candidates.push(`${stem.slice(0, -1)}f`);
    }
  }
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
    candidates.push(lower.slice(0, -1));
  }

  // comparative / superlative: happier -> happy, happiest -> happy, smaller -> small
  if (lower.endsWith('ier')) {
    candidates.push(`${lower.slice(0, -3)}y`);
  }
  if (lower.endsWith('iest')) {
    candidates.push(`${lower.slice(0, -4)}y`);
  }
  if (lower.endsWith('er')) {
    candidates.push(lower.slice(0, -2));
  }
  if (lower.endsWith('est')) {
    candidates.push(lower.slice(0, -3));
  }

  const unique = [...new Set(candidates)];
  return unique.filter(c => c !== lower);
}

function stemsConsonantDoubled(stem: string): boolean {
  return (
    stem.length >= 3 &&
    stem[stem.length - 1] === stem[stem.length - 2] &&
    !'aeiou'.includes(stem[stem.length - 1])
  );
}

// Given a surface word, return candidate lemma forms to try, in priority order.
// The first entry is always the word itself (lowercased).
export function candidateLemmas(word: string): string[] {
  const lower = word.toLowerCase().trim();
  const bare = lower
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9]+$/, '');
  const out: string[] = [lower];

  // PDF text runs commonly keep punctuation attached to a word. Preserve the
  // literal token first (some WordNet lemmas legitimately contain punctuation),
  // then try the same token without surrounding quotes/stops.
  if (bare && bare !== lower) {
    out.push(bare);
  }

  if (!lower || lower.length > 40) {
    return out;
  }

  const lookupWord = bare || lower;

  // possessive: "student's" -> student, "teachers'" -> teacher, "dogs'" -> dog
  if (/s'$/.test(lookupWord)) {
    out.push(lookupWord.slice(0, -2));
  } else if (/'s$/.test(lookupWord)) {
    out.push(lookupWord.slice(0, -2));
  } else if (/['\u2019]$/.test(lookupWord)) {
    out.push(lookupWord.slice(0, -1));
  }

  const irregular = stripIrregular(lookupWord);
  if (irregular && !out.includes(irregular)) {
    out.push(irregular);
  }

  if (!/^[a-z]+$/.test(lookupWord) || lookupWord.length <= 2) {
    return out;
  }

  for (const candidate of stripSuffixedForm(lookupWord)) {
    if (candidate && candidate !== lookupWord && !out.includes(candidate)) {
      out.push(candidate);
    }
  }

  return out;
}
