import type { Pack } from './types';

export const pack: Pack = { id: 'demo', revision: '1', title: 'Geography', category: 'Geography', source: 'bundled', sourceLabel: 'Repository sample', questions: [{ id: 'q1', text: 'Largest continent?', answers: [{ id: 'a', text: 'Asia', is_correct: true }, { id: 'b', text: 'Europe', is_correct: false }] }] };
