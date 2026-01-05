# GitHub Workflows & CI/CD Pipeline - Complete Setup

## 📋 Overzicht

Een complete CI/CD pipeline is geïmplementeerd voor de Telegram Bot Plugin met automatisering voor builds, tests, releases, deployment en code quality checks.

## 🔧 Workflows

### 1. **CI Workflow** (`.github/workflows/ci.yml`)

**Trigger:** Push en Pull Requests op master/main/develop branches

**Jobs:**
- **lint** - Code linting en formatting checks
  - ESLint (als beschikbaar)
  - Format checking
- **build_and_test** - Build en test op multiple Node.js versies
  - Node.js 18.x, 20.x, 22.x
  - TypeScript build
  - Unit tests
- **coverage** - Test coverage rapportage
  - Coverage reports genereren
  - Upload coverage artifacts
  - Automatische PR comments met coverage metrics
- **security** - Security scanning
  - npm audit voor vulnerabilities
  - Production dependency checks
- **quality-gate** - Quality checks
  - Valideer dat alle jobs succesvol zijn
  - Blokkeer merge bij failures

**Features:**
- ✅ Parallel job execution voor snelheid
- ✅ Dependency caching voor betere performance
- ✅ Matrix builds voor cross-version compatibility
- ✅ Automatische PR comments met coverage data

---

### 2. **Release Workflow** (`.github/workflows/release.yml`)

**Trigger:** 
- Git tags (`v*.*.*`)
- Manual dispatch met versie input

**Jobs:**
- **validate** - Pre-release validatie
  - Tests uitvoeren
  - Build valideren
- **create-release** - Release aanmaken
  - Automatische changelog genereren
  - Release archives maken (tar.gz + zip)
  - GitHub Release publiceren met assets

**Features:**
- ✅ Automatische changelog uit commit history
- ✅ Release artifacts (tar.gz & zip)
- ✅ Semver versioning support
- ✅ Manual en automated releases

**Gebruik:**
```bash
# Tag en push voor release
git tag v2.3.0
git push origin v2.3.0

# Of gebruik GitHub Actions UI voor manual release
```

---

### 3. **Deploy Workflow** (`.github/workflows/deploy.yml`)

**Trigger:** Manual dispatch only

**Jobs:**
- **deploy** - Deployment naar environments
  - Development
  - Staging
  - Production
- **rollback** - Automatische rollback prep bij failure

**Features:**
- ✅ Multi-environment support
- ✅ Environment-specific configurations
- ✅ Deployment artifacts
- ✅ Health checks (production)
- ✅ Rollback preparation

**Gebruik:**
```bash
# Via GitHub Actions UI:
# 1. Ga naar Actions tab
# 2. Selecteer "Deploy" workflow
# 3. Klik "Run workflow"
# 4. Kies environment en versie
```

---

### 4. **Dependency Updates** (`.github/workflows/dependencies.yml`)

**Trigger:** 
- Wekelijks (Maandag 9:00 UTC)
- Manual dispatch

**Jobs:**
- **update-dependencies** - Automatische dependency updates
  - Check voor outdated packages
  - Update non-major versions
  - Run tests
  - Create PR met updates
- **security-updates** - Security vulnerability tracking
  - npm audit voor security issues
  - Automatische issue creation bij vulnerabilities

**Features:**
- ✅ Automatische weekly updates
- ✅ PR creation met change summary
- ✅ Security vulnerability tracking
- ✅ Automatic labeling

---

### 5. **Code Quality** (`.github/workflows/code-quality.yml`)

**Trigger:**
- Push en Pull Requests
- Wekelijks (Zondag 3:00 UTC)

**Jobs:**
- **code-quality** - Code kwaliteit checks
  - TypeScript compiler checks
  - Code complexity analysis
  - TODO/FIXME detection via ripgrep in CI
  - Large file detection
  - Duplicate code detection
  - Security linting
- **test-quality** - Test kwaliteit
  - Coverage threshold checks (70%)
  - Test coverage reports
- **documentation-check** - Documentatie validatie
  - README.md check
  - API documentation check
  - CHANGELOG.md check
- **dependency-health** - Dependency health
  - Unused dependencies detection
  - package.json validation
  - License compliance

**Features:**
- ✅ Comprehensive quality metrics
- ✅ Automated quality reports
- ✅ Coverage threshold enforcement
- ✅ Documentation completeness checks

---

### 6. **PR Automation** (`.github/workflows/pr-automation.yml`)

**Trigger:** Pull Request events

**Jobs:**
- **pr-labeler** - Automatische labeling
  - File-based labels
  - Size labels (XS, S, M, L, XL)
- **pr-checker** - PR validatie
  - Conventional Commit format check
  - Breaking change detection
- **pr-welcome** - First-time contributor welcoming
- **pr-reviewer-assignment** - Auto-assign reviewers
- **pr-checklist** - Automatische checklist toevoegen
- **pr-stats** - PR statistieken
  - Files changed
  - Lines added/deleted
  - TypeScript files
  - Test files

**Features:**
- ✅ Automatische PR labeling
- ✅ Conventional Commits enforcement
- ✅ First-time contributor onboarding
- ✅ Auto reviewer assignment
- ✅ PR statistics tracking

---

## 📁 Support Files

### **Labeler Config** (`.github/labeler.yml`)
Automatische label toewijzing op basis van gewijzigde files:
- `feature`, `bot`, `api`, `claude`, `streaming`
- `tests`, `documentation`, `config`, `ci/cd`
- `security`, `utils`, `types`, `dependencies`

### **Code Owners** (`.github/CODEOWNERS`)
- Definieert wie responsible is voor welke delen
- Automatische reviewer assignment
- Per-directory ownership

### **PR Template** (`.github/PULL_REQUEST_TEMPLATE.md`)
Gestructureerde PR template met:
- Description
- Type of change
- Checklist
- Testing details
- Migration guide (voor breaking changes)

### **Issue Templates**
- **Bug Report** (`bug_report.yml`) - Gestructureerde bug rapportage
- **Feature Request** (`feature_request.yml`) - Feature suggesties
- **Question** (`question.yml`) - Vragen stellen
- **Config** (`config.yml`) - Issue template configuratie

---

## 🚀 Workflow Features

### Caching
Alle workflows gebruiken npm dependency caching voor snellere builds:
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

### Matrix Builds
CI workflow test op meerdere Node.js versies:
- Node.js 18.x
- Node.js 20.x
- Node.js 22.x

### Security
- npm audit in elke build
- Automated security issue creation
- Dependency vulnerability tracking

### Quality Gates
- Coverage thresholds (70%)
- All tests must pass
- Build must succeed
- Security checks must pass

---

## 📊 Status Badges

Voeg deze badges toe aan je README.md:

```markdown
![CI](https://github.com/WantedChef/telegram-bot-plugin/workflows/CI/badge.svg)
![Code Quality](https://github.com/WantedChef/telegram-bot-plugin/workflows/Code%20Quality/badge.svg)
![Dependencies](https://github.com/WantedChef/telegram-bot-plugin/workflows/Dependency%20Updates/badge.svg)
```

---

## 🔐 Secrets Configuratie

Zorg dat deze secrets zijn geconfigureerd in GitHub Settings > Secrets:

### Required
- `GITHUB_TOKEN` - Automatisch aanwezig

### Optional
- `SLACK_WEBHOOK_URL` - Voor Slack notifications bij failures
- Deployment secrets (per environment):
  - `DEPLOY_HOST_PRODUCTION`
  - `DEPLOY_SSH_KEY`
  - etc.

---

## 📝 Best Practices

### Branch Strategy
- `main` - Production releases
- `develop` - Development branch
- `feature/*` - Feature branches
- `fix/*` - Bug fixes

### Commit Messages
Gebruik Conventional Commits:
```
feat(api): add new endpoint
fix(bot): resolve timeout issue
docs: update README
chore(deps): update dependencies
```

### Pull Requests
- Gebruik de PR template
- Zorg dat alle checks groen zijn
- Request review van code owners
- Link naar gerelateerde issues

### Releases
- Gebruik semantic versioning (semver)
- Tag releases: `v2.3.0`
- Automatische changelog generatie
- Release notes toevoegen

---

## 🎯 Next Steps

1. **Test de workflows**
   ```bash
   # Push naar develop branch
   git push origin develop
   ```

2. **Configureer branch protection**
   - Settings > Branches > Branch protection rules
   - Require PR reviews
   - Require status checks (CI, Code Quality)
   - Require branches to be up to date

3. **Enable GitHub Discussions**
   - Settings > Features > Discussions

4. **Review en customize**
   - Update CODEOWNERS met je team
   - Pas labeler.yml aan naar je behoeften
   - Configureer deployment targets

---

## ✅ Checklist

- [x] CI workflow met linting
- [x] Release workflow met changelog
- [x] Deploy workflow met environments
- [x] Dependency update automation
- [x] Code quality checks
- [x] PR automation
- [x] Issue templates
- [x] PR template
- [x] CODEOWNERS
- [x] Labeler configuratie
- [x] CHANGELOG.md

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
