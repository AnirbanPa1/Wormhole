import { candidateLemmas } from '../src/services/morphology.service';

describe('candidateLemmas', () => {
  it('returns the lowercase word itself first', () => {
    expect(candidateLemmas('Run')).toEqual(['run']);
  });

  it('handles irregular verbs', () => {
    expect(candidateLemmas('ran')).toEqual(['ran', 'run']);
    expect(candidateLemmas('went')).toEqual(['went', 'go']);
    expect(candidateLemmas('was')).toEqual(['was', 'be']);
    expect(candidateLemmas('seen')).toEqual(['seen', 'see']);
  });

  it('handles irregular plurals', () => {
    expect(candidateLemmas('children')).toContain('child');
    expect(candidateLemmas('people')).toContain('person');
    expect(candidateLemmas('men')).toContain('man');
  });

  it('handles progressive -ing', () => {
    expect(candidateLemmas('running')).toContain('run');
    expect(candidateLemmas('making')).toContain('make');
    expect(candidateLemmas('going')).toContain('go');
  });

  it('handles past tense -ed', () => {
    expect(candidateLemmas('walked')).toContain('walk');
    expect(candidateLemmas('tried')).toContain('try');
    expect(candidateLemmas('stopped')).toContain('stop');
  });

  it('handles plurals -s / -es', () => {
    expect(candidateLemmas('books')).toContain('book');
    expect(candidateLemmas('boxes')).toContain('box');
    expect(candidateLemmas('babies')).toContain('baby');
    expect(candidateLemmas('studies')).toContain('study');
  });

  it('handles comparatives / superlatives', () => {
    expect(candidateLemmas('happier')).toContain('happy');
    expect(candidateLemmas('happiest')).toContain('happy');
    expect(candidateLemmas('smaller')).toContain('small');
  });

  it('normalizes apostrophe and case', () => {
    expect(candidateLemmas("student's")).toContain('student');
    expect(candidateLemmas('BOOK')).toEqual(['book']);
  });

  it('removes punctuation attached by PDF text extraction', () => {
    expect(candidateLemmas('insurmountable,')).toContain('insurmountable');
    expect(candidateLemmas('insurmountable.')).toContain('insurmountable');
    expect(candidateLemmas('“insurmountable”')).toContain('insurmountable');
  });
});
