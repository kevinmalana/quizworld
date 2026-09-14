import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayerIdentityForm } from '../components/game/PlayerIdentityForm';
Object.assign(globalThis, { React });

test('player identity uses a native submit form, labelled nickname and named selected avatars', () => {
  const html = renderToStaticMarkup(React.createElement(PlayerIdentityForm, {
    pin: '123456', nickname: 'Alex', avatar: '🦁', error: 'Try again', joining: false,
    onNicknameChange() {}, onAvatarChange() {}, onSubmit() {},
  }));
  assert.match(html, /<form/);
  assert.match(html, /<label[^>]*for="player-nickname"[^>]*>Nickname/);
  assert.match(html, /type="submit"/);
  assert.match(html, /aria-label="Lion" aria-pressed="true"/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /type="submit"[^>]*disabled/);
});
