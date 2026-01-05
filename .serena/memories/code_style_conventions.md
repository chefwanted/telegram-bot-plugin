# Code Style & Conventions - Telegram Bot Plugin

## TypeScript Configuration
- **Strict Mode**: Ja (tsconfig.json)
- **Target**: ES2020
- **Module System**: ESNext/CommonJS
- **Path Aliases**: `@/` → `src/`

## Naming Conventions
- **Files**: kebab-case (`telegram-bot.ts`, `session-manager.ts`)
- **Classes**: PascalCase (`TelegramBot`, `SessionManager`)
- **Interfaces**: PascalCase (`Session`, `Storage`)
- **Functions/Methods**: camelCase (`sendMessage`, `getSession`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_SESSIONS`, `DEFAULT_TTL`)
- **Types**: PascalCase (`SessionData`, `PluginConfig`)
- **Private fields**: `_prefix` ( `_storage`, `_bot`)

## Code Organization
- **Exports**: Centraliseer exports in `index.ts` per directory
- **Imports**: Use relative imports of path aliases
- **File structure**: Eén class/interface per file waar mogelijk
- **Barrel exports**: Re-export from `index.ts`

## Documentation Style
- **JSDoc**: Gebruik voor publieke API's
- **Comments**: Nederlandstalig (gebaseerd op README)
- **Examples**: Code voorbeelden in docstrings

## Error Handling
- **Typed Errors**: Custom error types (`TelegramApiError`, `TelegramBotError`)
- **Async**: Try-catch met proper error propagation
- **Logging**: Gebruik logger utility

## Testing Conventions
- **Unit tests**: `*.test.ts` in `tests/unit/`
- **Integration tests**: `*.test.ts` in `tests/integration/`
- **Test framework**: TBD (niet geïmplementeerd)

## Git Conventions
- **Branch naming**: feature/, bugfix/, hotfix/
- **Commit format**: Conventional Commits (feat:, fix:, docs:, etc.)
