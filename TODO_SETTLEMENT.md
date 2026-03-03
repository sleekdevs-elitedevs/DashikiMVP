# Challenge Settlement System - Implementation TODO

## Phase 1: Database & Backend
- [x] Create database script (06_settlement.sql) - Add settlement columns and functions
- [x] Create settlement API (api/settlement.ts) - Stakes generator and winning algorithm
- [x] Update challenges API (api/challenges.ts) - Add stake-related fields
- [x] Update participants API (api/participants.ts) - Add stake tracking

## Phase 2: Stakes Generator Logic
- [x] Implement stake calculation based on difficulty
- [x] Implement stake calculation based on participant count
- [x] Implement dynamic reward multiplier
- [x] Add minimum/maximum stake limits

## Phase 3: Winning Algorithm
- [x] Implement winner determination based on approved proofs
- [x] Implement proportional distribution logic
- [x] Handle edge cases (no winners, all complete, etc.)
- [x] Add tie-breaking rules

## Phase 4: Frontend Integration
- [ ] Update challenge detail page to show stakes
- [ ] Update join flow to integrate stake calculation
- [ ] Add settlement status display
- [ ] Update leaderboard with winnings

## Phase 5: Testing & Polish
- [ ] Test stake calculations
- [ ] Test winner determination
- [ ] Test distribution logic
- [ ] UI/UX polish
