# Style Guide

## Product Design Direction

QuizWorld should feel like a modern quiz show rather than a plain admin tool.

The intended design language is:

- bright, high-contrast stage energy
- strong typography hierarchy
- playful but controlled color use
- clear host-versus-player separation
- obvious momentum from lobby to question to reveal to final result

## UI Principles

- the live game should feel dramatic, not bureaucratic
- the host should feel in control
- players should always know whether they are waiting, answering, or locked in
- leaderboard states should be readable at a glance
- mobile touch targets must stay comfortable during live play

## Live Game Surface

The Phoenix LiveView game screen should emphasize:

- a large visible PIN
- strong status labeling
- a countdown that feels urgent
- clear answer cards with immediate lock-in feedback
- reveal states that show both correctness and crowd behavior
- a leaderboard with obvious rank hierarchy

## Layout Guidance

- use a stage-like hero at the top of the live game room
- keep the primary question panel dominant
- keep host controls and leaderboard in a secondary side rail
- collapse to a single-column flow cleanly on smaller screens

## Motion Guidance

- use a few meaningful animations rather than constant movement
- prioritize round transitions, countdown urgency, and leaderboard emphasis
- motion should reinforce state changes, not distract from answering

## Content Tone

- short, confident, game-host style copy
- avoid enterprise/admin phrasing in the live room
- use direct language for errors and player actions

## Implementation Note

The current Phoenix LiveView game surface in `services/quizworld_realtime/lib/quizworld_realtime_web/live/game_live/show.ex` is the reference implementation for this direction. Future design changes should preserve clarity, mobile usability, and host authority cues.
