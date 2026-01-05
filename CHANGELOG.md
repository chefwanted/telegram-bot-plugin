# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Complete git pipeline commands (push, pull, clone, remote, branch)
- Comprehensive CI/CD workflows
  - CI workflow with linting and security checks
  - Release workflow for automated releases
  - Deploy workflow for multi-environment deployments
  - Dependency update workflow
  - Code quality workflow
  - PR automation workflow
- GitHub Actions automation for better code review process
- Code owners configuration
- PR labeler for automatic labeling
- File download support for uploaded documents/photos
- Configurable FILES_DIR and DATABASE_PATH paths

### Changed
- Enhanced git integration with full workflow support
- Improved CI pipeline with better caching and parallel jobs
- Git commands now use safe argument execution
- File storage uses per-chat directories and stores file paths

### Fixed
- Git pipeline implementation completed
- File deletion now works by file_id and removes stored files

## [2.2.0] - 2026-01-05

### Added
- Files feature module
- Git integration (basic commands)
- Session management improvements
- Streaming support for real-time updates

### Changed
- Refactored bot command structure
- Enhanced error handling

### Fixed
- Various bug fixes and stability improvements

## [2.1.0] - Previous release

### Added
- Claude Code integration
- Custom tools support
- Analytics tracking

### Changed
- API improvements
- Better TypeScript support

### Fixed
- Session storage issues

## [2.0.0] - Initial refactored release

### Added
- Complete rewrite with TypeScript
- Modular architecture
- Feature-based organization
- Comprehensive test suite

### Changed
- New project structure
- Improved maintainability

---

## Categories

### Added
New features added to the project.

### Changed
Changes in existing functionality.

### Deprecated
Features that will be removed in upcoming releases.

### Removed
Features that have been removed.

### Fixed
Bug fixes.

### Security
Security vulnerability fixes.
