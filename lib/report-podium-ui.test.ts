import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameReport } from '../components/report/GameReport';
import type { GameResult } from './report-analytics';

Object.assign(globalThis, { React });

// Local component fixtures, never live result replacements.
for (const count of [0, 1, 2, 3, 4]) {
  test(`report podium renders the correct places with ${count} players`, () => {
    const players = Array.from({ length: count }, (_, index) => ({
      id: `player-${index}`, nickname: `Player ${index + 1}`, score: (count - index) * 100,
    }));
    const result: GameResult = {
      id: 'fixture', pin: '123456', quiz_id: 'fixture', host_id: 'fixture', player_count: count,
      finished_at: '2026-01-01T00:00:00Z',
      results: { players: [...players].reverse(), question_count: 1, finished_status: 'finished' },
    };
    const html = renderToStaticMarkup(React.createElement(GameReport, { result, pin: result.pin }));
    const names = [...html.matchAll(/class="report-podium-name">([^<]+)</g)].map(match => match[1]);
    const medals = [...html.matchAll(/class="report-podium-medal">([^<]+)</g)].map(match => match[1]);
    const order = [1, 0, 2].filter(index => index < count);
    assert.deepEqual(names, order.map(index => players[index].nickname));
    assert.deepEqual(medals, order.map(index => ['🥇', '🥈', '🥉'][index]));
    assert.equal(new Set(names).size, Math.min(count, 3));
    assert.equal((html.match(/report-podium-bar is-gold/g) ?? []).length, count ? 1 : 0);
  });
}
