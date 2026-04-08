# Business Documentation

## Product Summary

QuizWorld `v9` is a hybrid quiz platform with two core business surfaces:

- a content product for creating, discovering, studying, and managing quizzes
- a live-hosted multiplayer experience for running game-show style quiz sessions

The business decision behind `v9` is to keep authored content and user data stable in Supabase while moving live gameplay authority into Phoenix.

## Business Goals

- reduce live-game failures caused by browser-authoritative logic
- support fast, social, hosted quiz sessions with clearer host control
- preserve the content library, study flows, and dashboard value already built in Next.js
- create a platform that can serve classroom, training, community, and event use cases

## Value Proposition

QuizWorld aims to combine:

- the simplicity of a lightweight quiz website
- the energy of a live hosted game
- the utility of reusable study content

This positions the product between a pure study tool and a fully gamified classroom platform.

## Primary Audience Segments

- creators who want to publish quizzes quickly
- hosts running live sessions for a group
- players joining by PIN with minimal friction
- learners studying quiz content outside the live event
- operators and future dev teams deploying the system

## Why The Phoenix Split Matters

Earlier versions mixed local browser state, Supabase writes, and partial realtime logic. That caused product-level risk in the most visible flow: live gameplay. `v9` separates concerns so the business can rely on:

- stable content workflows
- safer live session authority
- better long-term multiplayer scalability

## Business Risks

- the Phoenix runtime still needs full real-environment validation
- the product now has a two-service deployment model, which raises operational complexity
- live-game UX still needs runtime polish and testing after deployment

## Success Indicators

- hosts can reliably create and start games without manual intervention
- players can join, answer, and see timely state changes
- finished games write summary results back to Supabase
- dashboard/profile surfaces can use durable game-result data
- future teams can understand the architecture from the docs set without reverse-engineering the repo
