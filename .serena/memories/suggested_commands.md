# Development Commands - Telegram Bot Plugin

## Build Commands
```bash
npm run build          # Compile TypeScript naar dist/
tsc                    # Direct TypeScript compiler
```

## Test Commands
```bash
npm test               # Niet geïmplementeerd (placeholder)
```

## Setup Commands
```bash
npm install            # Installeer dependencies
```

## Git Commands
```bash
git status             # Check repository status
git add .              # Stage alle wijzigingen
git commit -m "msg"    # Commit met bericht
git push               # Push naar remote (github.com/WantedChef/telegram-bot-plugin)
```

## Utility Commands
```bash
ls -la                 # Lijst bestanden (inclusief hidden)
grep -r "pattern" .    # Zoek in bestanden
find . -name "*.ts"    # Vind TypeScript bestanden
```

## Entry Points
- **Main**: `src/index.ts` (momenteel leeg)
- **Bot**: `src/bot/index.ts`
- **API**: `src/api/index.ts`
- **Events**: `src/events/index.ts`

## Development Workflow
1. Bewerk TypeScript bestanden in `src/`
2. Run `npm run build` om te compileren
3. Output verschijnt in `dist/`
4. Test indien beschikbaar
