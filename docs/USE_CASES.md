# Use Cases

## Primary Product Use Cases

### 1. Creator Publishes A Quiz

- user signs in through Supabase auth
- user creates a quiz in the Next.js app
- quiz metadata, questions, and answers are stored in Supabase
- published quizzes appear in the creator library and optionally the explore surface

### 2. Host Runs A Live Game

- signed-in host chooses a quiz
- frontend creates a live session through the Phoenix service
- Phoenix becomes the authority for lobby, timer, answers, reveal, and progression
- host controls the round lifecycle

### 3. Player Joins By PIN

- player enters the session PIN
- player joins through Phoenix
- Phoenix issues player identity/session state for that live game
- player sees live updates without requiring a full product account

### 4. Live Round Progression

- host starts the round
- players receive the question and timer
- players submit answers during the answer window
- Phoenix enforces the answer window and scoring
- host reveals results and advances

### 5. Finished Game Reporting

- Phoenix marks the game finished
- Phoenix writes summary results back to Supabase
- dashboard/profile/reporting surfaces can read durable result rows later

### 6. Independent Study

- learner opens study mode from the Next.js app
- study content remains Supabase-backed
- study progress remains outside the Phoenix live runtime

## Operational Use Cases

### 7. Developer Extends Live Gameplay

- developer works in `services/quizworld_realtime/`
- changes should preserve Phoenix authority over live state
- changes should not move quiz content ownership into Phoenix

### 8. Tester Validates The Product

- tester verifies the content side in Next.js
- tester verifies host/join/live progression in Phoenix
- tester confirms finished-game result sync back to Supabase

### 9. Operator Deploys The System

- operator deploys Next.js to Vercel
- operator deploys Phoenix to a dedicated host
- operator applies Supabase SQL needed for result persistence
- operator validates the cross-service env vars and smoke tests
