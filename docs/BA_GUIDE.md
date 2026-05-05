# BA Guide

## Product Scope

QuizWorld `v9` is a split-platform quiz product:

- `Next.js + Supabase` for content and account flows
- `Phoenix` for live multiplayer gameplay

## Primary User Journeys

- creator signs in and authors a quiz
- host signs in and starts a live game
- player joins anonymously by PIN
- learner studies saved content outside live play

## Why v9 Exists

`v8` kept breaking around live multiplayer because too much game authority lived in the browser or mixed backend paths. `v9` isolates live game logic into a dedicated service.

## Acceptance Focus

- live session ownership is authoritative
- players cannot spoof scoring/state transitions
- content flows remain stable in Supabase
- documentation clearly describes the two-service deployment model
