# Color Scheme Implementation TODO

## Task: Use color scheme in index.tsx, upload.tsx, and ledger.tsx

### Files to edit:
- [x] dashiki/app/(tabs)/index.tsx - Already has imports but needs to USE the color variables in styles
- [x] dashiki/app/(tabs)/upload.tsx - Needs full color scheme implementation (imports + usage)
- [x] dashiki/app/(tabs)/ledger.tsx - Needs full color scheme implementation (imports + usage)

### Changes needed for each file:
1. Import Colors from '@/constants/theme'
2. Import useColorScheme from '@/hooks/use-color-scheme'
3. Get the colorScheme using useColorScheme hook
4. Create color variables from Colors[colorScheme ?? 'light']
5. Replace hardcoded colors in StyleSheet.create with the color variables

### Progress:
- [x] Implement color scheme in index.tsx
- [x] Implement color scheme in upload.tsx
- [x] Implement color scheme in ledger.tsx

## ALL TASKS COMPLETED ✅
