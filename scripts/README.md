# Dashiki Scripts & Database Setup

This directory contains SQL scripts for setting up the Dashiki backend database and utilities for project management.

## Prerequisites

Before setting up the database, ensure you have:

1. **Supabase Account**: Create a project at [supabase.com](https://supabase.com)
2. **Node.js**: Version 18+ installed
3. **PostgreSQL Knowledge**: Familiarity with SQL and Supabase's SQL editor

## Database Setup

### Step 1: Configure Environment Variables

Create a `.env` file in the root `dashiki/` directory with your Supabase credentials:

```
env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these in your Supabase project dashboard under:
- **Settings** → **API** → **Project URL**
- **Settings** → **API** → **anon public** key

### Step 2: Run SQL Scripts in Order

Execute the SQL scripts in the Supabase SQL Editor in the following order:

| Order | Script | Description |
|-------|--------|-------------|
| 1 | `01_tables.sql` | Creates core database tables (profiles, challenges, transactions, etc.) |
| 2 | `02_storage_buckets.sql` | Sets up storage buckets for images and media |
| 3 | `03_seed_data.sql` | Adds initial seed data for testing |
| 4 | `04_alter_tables_stake.sql` | Adds stake-related columns and constraints |
| 5 | `05_friends_table.sql` | Creates friends/following system |
| 6 | `06_settlement.sql` | Implements settlement/payout logic |
| 7 | `07_settlement_cron.sql` | Sets up scheduled settlement jobs |
| 8 | `07_add_challenge_friends.sql` | Adds friend challenge functionality |
| 9 | `08_challenge_invitations.sql` | Creates challenge invitation system |
| 10 | `09_notifications_metadata.sql` | Adds notification metadata tables |
| 11 | `10_push_tokens.sql` | Handles push notification tokens |
| 12 | `11_challenge_thumbnails.sql` | Adds challenge thumbnail support |
| 13 | `12_max_random_calls.sql` | Limits random verification calls |
| 14 | `13_random_verification_calls.sql` | Implements random verification call system |

### Running Scripts via Supabase CLI (Optional)

If you have the Supabase CLI installed:

```
bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Run a specific script
supabase db execute -f scripts/01_tables.sql
```

## App Setup

### Step 1: Install Dependencies

```
bash
cd dashiki
npm install
```

### Step 2: Start the Development Server

```
bash
npx expo start
```

### Step 3: Run on Specific Platform

```
bash
# iOS Simulator
npx expo run:ios

# Android Emulator
npx expo run:android

# Web
npx expo start --web
```

## Database Schema Overview

### Core Tables

- **profiles**: User profiles with points and wallet balance
- **challenges**: Challenge definitions with stake amounts
- **participants**: Users participating in challenges
- **transactions**: Ledger of all financial transactions
- **proofs**: Proof submissions for challenge verification

### Feature Tables

- **friends**: Social connections between users
- **challenge_invitations**: Invitation system for private challenges
- **notifications**: Push notification records
- **push_tokens**: Device push notification tokens
- **verification_calls**: Video call verification records

## Troubleshooting

### Database Connection Issues

1. Verify your `.env` file has correct Supabase credentials
2. Check that your Supabase project is active
3. Ensure your IP is allowlisted in Supabase settings

### SQL Script Errors

1. Run scripts in the exact order specified
2. Check for existing tables before running (some scripts use `DROP IF EXISTS`)
3. Verify you have sufficient permissions in Supabase

### Common Issues

- **Missing tables**: Ensure all preceding scripts ran successfully
- **Authentication failures**: Verify `EXPO_PUBLIC_SUPABASE_ANON_KEY` is correct
- **Storage errors**: Check that storage buckets were created successfully

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Expo Documentation](https://docs.expo.dev)
- [Dashiki Main README](../README.md)

## Scripts Quick Reference

```
bash
# Reset project to fresh state
npm run reset-project

# Start Expo development server
npm start

# Build for production
npx expo build
```

## Support

For issues related to:
- **Database/Supabase**: Check Supabase dashboard logs
- **App Development**: Refer to the main README.md
- **Video Calling**: See TODO_VIDEOCALL.md for known issues
