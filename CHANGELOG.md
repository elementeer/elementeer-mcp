# Changelog

All notable changes to Elementeer MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-08-11

ELM-CMS-P0 integrity repairs. Wave `CP-OPT-2026-08-05-W1`, iteration I00, candidate `7c2fac1`.
Independently reviewed and reproduced by the Elementeer review authority (EVIDENCE_REVIEW: PASS).

### Fixed
- **IMP-001 queue-type drift**: `elementor_data` is normalised from string to array before the change queue persists it and before the executor applies it. Affects `update_template_data` and `update_page_data`.
- **IMP-002 change-queue tests reactivated**: `describe.skip` removed; suite runs green at 24/24 with an added string/array roundtrip test.

### Notes
- Contract parity against `elementeer-specs` measured read-only: 9 PARITY_OK / 3 PARTIAL / 7 GAP. The 7 gaps (notably `CapabilityBinding` and `ChangeSet`) are P1 candidates and not addressed here.

## [Unreleased]

### Changed
- **Rebrand complete**: All Elementify references replaced with Elementeer across code, docs, and config (readme.txt, plugin composer.json, mirror manifest, quickstart, tier docs)
- **License clarified**: MCP Server = Apache-2.0, WordPress Plugin = GPL-2.0-or-later
- **TIERS.md added**: Complete Free vs Advanced vs Studio comparison table with pricing logic
- **Plugin rebrand**: Main plugin file renamed to `elementeer.php`, namespace `Elementeer\MCP\`
- **Mirror system verified**: Free mirror gate passes with all Elementeer branding

## [2.0.1] - 2026-04-22

### Added
- **Five Advanced Feature Domains**: Media AI, Addon Ecosystem Expansion, Performance Analysis Enhancement, Accessibility Enhancement, Snapshot & Versioning
- **Release Validation Suite**: Comprehensive validation across 8 testing phases with automated scripts
- **Plugin ZIP Structure & Naming Validation**: Ensured consistent versioning and correct file naming
- **Documentation Updates**: Updated changelog, roadmap, and testing workflow documentation
- **ReleaseChain Integration**: Automated release validation workflow with Ralph Loop execution

### Changed
- **Version Consistency**: Updated ELEMENTEER_VERSION constant to 2.0.1
- **Plugin Header**: Version updated to 2.0.1 in plugin main file
- **Build Scripts**: Enhanced create-plugin-zip.sh for proper folder structure
- **Release Naming Convention**: All release ZIP files now follow "elementeer.X.Y.Z.zip" format (non-negotiable)

### Fixed
- **Authentication**: Wildcard capability support and Elementor permission error elimination
- **API Key Validation**: Improved authentication for all endpoints

## [2.0.0] - 2026-04-20

### Added
- **AddonRegistry compatibility fix**: Made AddonRegistry class non-abstract to prevent 500 errors
- **API key structure validation**: Updated API key structure to match exact expected fields
- **Queue V2 improvements**: Fixed duplicate function names and parameter handling

### Changed
- **Plugin version bump**: Updated plugin version to 2.0.0 for consistency
- **Build script enhancements**: Improved build process with fixed TypeScript compilation

## [1.0.0] - 2026-04-18

### Added
- **PRD v4: Elementor Addon Ecosystem Integration**
  - Complete adapter framework for Elementor addons
  - Tier 1-3 plugin adapters (11 total):
    - Essential Addons for Elementor
    - Crocoblock (JetEngine, JetElements)
    - Ultimate Addons for Elementor
    - PowerPack Addons for Elementor  
    - Happy Addons for Elementor
    - ElementsKit Addons for Elementor
    - Premium Addons for Elementor
    - The Plus Addons for Elementor
    - Dynamic Content for Elementor
    - ShopEngine (WooCommerce builder)
    - Unlimited Elements for Elementor
  - Addon detection and analysis tools (45+ new MCP tools)
  - Ecosystem analysis: `analyze_addon_overlap`, `widget_census`, `addon_ecosystem_wizard`
  - Integrated addon data into Site Assessment

### Changed
- **CI Pipeline Stabilization**
  - Fixed Mockery/Patchwork test conflicts
  - Removed `continue-on-error: true` from GitHub Actions
  - Improved test isolation and reliability
  - Added comprehensive E2E test suite
- **Version consistency**: All components now at 1.0.0
- **Improved error handling** in REST API endpoints
- **Enhanced documentation** for addon integration

### Fixed
- Tool registration inconsistencies in `product-tiers.ts`
- PHPUnit test bootstrap conflicts
- TypeScript compilation warnings
- CLI version reporting (now shows 1.0.0)

### Technical Details
- **PHP**: Added `AddonAdapterInterface`, `BaseAddonAdapter`, `AddonRegistry`
- **REST API**: New endpoints `/elementeer/v1/addons`, `/addons/{slug}/widgets`, `/addons/{slug}/usage`
- **TypeScript**: 45+ new tool implementations for addon ecosystem
- **Tests**: 100% test coverage for new features, 657+ passing tests

## [0.5.1] - 2026-04-15

### Added
- Initial PRD v4 foundation
- Basic addon detection framework
- Improved TypeScript tool organization

### Fixed
- Minor bug fixes and improvements

## [0.5.0] - 2026-04-15

### Added
- Phase 5: Production Foundation
- Governance layer with L1-L3 operation modes
- Change queue system for human review
- Premium library integration (Advanced tier)
- Theme Builder template creation
- Advanced creator mode workflows
- Brand adaptation planning
- WooCommerce integration tools
- Amelia booking plugin support
- Charity/donation plugin support
- LMS (LearnDash/Tutor) integration
- Multilingual translation tools
- Accessibility (Ally) integration
- Performance optimization tools
- Security scanning and diagnostics

### Changed
- Complete refactor of MCP server architecture
- Improved error handling and logging
- Enhanced documentation

---

[1.0.0]: https://github.com/elementeer/elementeer-mcp/releases/tag/v1.0.0
[0.5.1]: https://github.com/elementeer/elementeer-mcp/releases/tag/v0.5.1
[0.5.0]: https://github.com/elementeer/elementeer-mcp/releases/tag/v0.5.0