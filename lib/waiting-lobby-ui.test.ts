import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WaitingLobbyPanel } from "../components/game/WaitingLobbyPanel";
import type { GamePlayer } from "./game/session-normalizers";
Object.assign(globalThis, { React });
const player = { id: "owned-player", nickname: "Alex", avatar: "🎮", score: 0 } as GamePlayer;
function render(isHost: boolean, currentPlayer: GamePlayer | null, players = [player], gameMode = "classic") {
  return renderToStaticMarkup(React.createElement(WaitingLobbyPanel, {
    pin: "123456", joinUrl: "https://www.quizworld.xyz/join?pin=123456", notice: null,
    players, readyPlayers: new Set<string>(), readyCount: 0, isHost, currentPlayer,
    playerSessionReady: true, amReady: false, onReady() {}, onStart() {}, gameMode,
  }));
}
test("waiting lobby names composed host/player role and exposes zero readiness", () => {
  const html = render(true, player);
  assert.match(html, /Hosting and playing/);
  assert.match(html, /0\/1 players ready/);
  assert.match(html, /Alex[\s\S]*You/);
  assert.match(html, /Ready ✅/);
  assert.match(html, /Start Game 🚀/);
});
test("spectators cannot start or ready; host-only retains start without ready", () => {
  const spectator = render(false, null);
  assert.match(spectator, /Join this game/);
  assert.doesNotMatch(spectator, /Start Game 🚀|Ready ✅/);
  const host = render(true, null);
  assert.match(host, /Hosting only/);
  assert.match(host, /Start Game 🚀/);
  assert.doesNotMatch(host, /Ready ✅/);
});
test("existing minimum player start guards remain in every mode", () => {
  for (const mode of ["classic", "team", "survival"]) assert.match(render(true, null, [], mode), /<button[^>]*disabled/);
  for (const mode of ["team", "survival"]) assert.match(render(true, player, [player], mode), /<button[^>]*disabled/);
  assert.doesNotMatch(render(false, player), /Start Game 🚀/);
});
