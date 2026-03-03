# Challenge Settlement Example - Complete Walkthrough

## Scenario: "30-Day Fitness Challenge"

### Step 1: Challenge Creation

**Creator sets up the challenge with:**
- Entry Fee: $25.00
- Difficulty: Hard
- Initial Participants: 0

**System calculates initial stakes:**
```
Base Stake = Entry Fee × Difficulty Multiplier
Base Stake = $25.00 × 2.0 (Hard) = $50.00

Difficulty Multipliers:
- Easy: 1.0x
- Medium: 1.5x  
- Hard: 2.0x
```

### Step 2: Participants Join

**10 users join the challenge:**

| User | Join Time | Stake on Join |
|------|-----------|---------------|
| Alice | Day 1 | $62.50 |
| Bob | Day 1 | $62.50 |
| Charlie | Day 2 | $62.50 |
| Diana | Day 2 | $62.50 |
| Evan | Day 3 | $62.50 |
| Fiona | Day 4 | $62.50 |
| George | Day 5 | $62.50 |
| Hannah | Day 6 | $62.50 |
| Ian | Day 7 | $62.50 |
| Jane | Day 8 | $62.50 |

**Stake calculation after each join:**
```
With 1 participant: $50.00 × 1.05 = $52.50
With 2 participants: $50.00 × 1.10 = $55.00
With 10 participants: $50.00 × 1.50 = $75.00

Formula: Base × (1 + 5% × participant_count)
```

**Final stakes after 10 participants:**
- Current Stake: $75.00 per person
- Total Pool: $750.00 (10 × $75)
- Potential Reward: ~$1,350.00 (estimated at 50% win rate)

### Step 3: Challenge Progress

**During the 30 days:**
- Users submit video proofs of their daily workouts
- Each proof must be approved by the system

**Proof submissions:**
| User | Proofs Submitted | Approved Proofs |
|------|-----------------|------------------|
| Alice | 30 | 28 |
| Bob | 25 | 22 |
| Charlie | 30 | 30 |
| Diana | 28 | 25 |
| Evan | 20 | 18 |
| Fiona | 15 | 12 |
| George | 10 | 8 |
| Hannah | 5 | 3 |
| Ian | 3 | 2 |
| Jane | 0 | 0 |

### Step 4: Challenge Completion

**Only 4 users completed the challenge (status = 'completed'):**
1. Charlie - 30 approved proofs ✓
2. Alice - 28 approved proofs ✓
3. Diana - 25 approved proofs ✓
4. Bob - 22 approved proofs ✓

**6 users did NOT complete (status = 'joined'):**
- Evan, Fiona, George, Hannah, Ian, Jane

### Step 5: Settlement Calculation

**When settlement runs:**
```
Total Pool = 10 participants × $75.00 = $750.00
Platform Fee (10%) = $75.00
Distributable Amount = $750.00 - $75.00 = $675.00

Winners Count = 4
Per-Winner Payout = $675.00 ÷ 4 = $168.75
```

### Step 6: Payout Distribution

**Winners receive:**
| User | Status | Proofs | Payout |
|------|--------|--------|--------|
| Charlie | Winner | 30 | +$168.75 |
| Alice | Winner | 28 | +$168.75 |
| Diana | Winner | 25 | +$168.75 |
| Bob | Winner | 22 | +$168.75 |

**Losers forfeit their stake:**
| User | Status | Proofs | Forfeited |
|------|--------|--------|-----------|
| Evan | Loser | 18 | -$62.50 |
| Fiona | Loser | 12 | -$62.50 |
| George | Loser | 8 | - |
| Hannah | Loser | $62.503 | -$62.50 |
| Ian | Loser | 2 | -$62.50 |
| Jane | Loser | 0 | -$62.50 |

### Summary

**From the Creator's perspective:**
- Created a Hard challenge with $25 entry fee
- 10 participants joined
- Final stake: $75.00 per person
- Total pool: $750.00
- 4 winners received $168.75 each
- Platform earned $75.00 in fees

**From a Winner's perspective (Alice):**
- Paid $75.00 to join
- Submitted 28 approved proofs
- Received $168.75 at settlement
- **Net profit: +$93.75**

**From a Loser's perspective (Evan):**
- Paid $75.00 to join
- Submitted 18 approved proofs (not enough to complete)
- Did not receive any payout
- **Net loss: -$62.50** (stake forfeited)

---

## Edge Cases

### Case 1: No Winners (Nobody Completed)
```
Total Pool = $750.00
No distribution occurs
All stakes remain in pool or are refunded
```

### Case 2: All Complete (10/10 Winners)
```
Total Pool = $750.00
Platform Fee = $75.00
Distributable = $675.00
Per-Winner = $675.00 ÷ 10 = $67.50 each
```

### Case 3: Single Winner
```
Total Pool = $750.00
Platform Fee = $75.00
Distributable = $675.00
Single Winner = $675.00
```

---

## API Usage Example

```
typescript
import { calculateStake, generateStakes, determineWinners, calculateDistribution } from '@/api/settlement';

// 1. Calculate stakes when creating/joining
const stake = calculateStake(25.00, 'Hard', 10);
// Result: { baseStake: 50, difficultyMultiplier: 2, finalStake: 75, potentialReward: 1350 }

// 2. Determine winners at end of challenge
const winners = await determineWinners('challenge-uuid');
// Returns ranked list by proof count

// 3. Calculate distribution
const distribution = calculateDistribution(750, 4, 10);
// Result: { platformFee: 75, perWinnerPayout: 168.75 }

// 4. Run settlement
const settlement = await settlementApi.createSettlement('challenge-uuid');
// Creates settlement records and updates wallet balances
