# RELEASE_BACKLOG

Purpose: track only unfinished work and production risks. Completed items are not duplicated here.

## Severity rules
- Blocker: release cannot proceed.
- High: major user or data risk; should be fixed before release.
- Medium: important quality issue; can be scheduled if release date is fixed.
- Low: polish or minor UX inconsistency.

## Open

### High
- [ ] BUG-101 | Area: Navigation/UX | Status: Open
  - Title: `About App` should be a note entity.
  - Description: `About App` behaves like a separate UI block instead of the standard note flow.
  - Expected: open via note route and use the same note rendering/navigation model.
  - Acceptance: no special-case screen behavior outside note flow.

- [ ] BUG-102 | Area: Editor/Links | Status: Open
  - Title: redesign link UX without `alert`.
  - Description: link interactions still rely on blocking browser alerts in parts of the flow.
  - Expected: use markup-driven UI (popover/inline form), with inline validation and non-blocking errors.
  - Acceptance: no `alert` in link create/edit flow; error states are visible and consistent.

- [ ] BUG-103 | Area: Editor/Internal navigation | Status: Open
  - Title: visual style for internal app links (`notes`, `spaces`, etc.).
  - Description: internal links look too similar to generic external links.
  - Expected: dedicated internal-link style and predictable in-app navigation behavior.
  - Acceptance: internal links are visually distinct and navigate correctly inside app context.

- [ ] BUG-106 | Area: Security/Architecture | Status: Open
  - Title: pre-prod security and architecture review.
  - Description: run a focused review for auth boundaries, data access checks, and unsafe UX patterns.
  - Expected: documented findings with severity and remediation plan.
  - Acceptance: no unresolved critical security issue before release.

### Medium
- [ ] BUG-104 | Area: Editor/Block system | Status: Open
  - Title: define Database Schema block lifecycle.
  - Description: insertion and editing model needs a clear, stable UX contract.
  - Expected: explicit create/edit/view behavior and stored data shape.
  - Acceptance: documented flow and predictable editing behavior.

- [ ] BUG-105 | Area: UI/Theming | Status: Open
  - Title: dark theme sidebar highlight inconsistency.
  - Description: sidebar controls sometimes show light-toned highlights in dark theme.
  - Expected: stable dark-theme tokens for hover/focus/active states.
  - Acceptance: no light highlight artifacts in dark mode.

- [ ] TECH-201 | Area: Frontend architecture | Status: Open
  - Title: modular icon and avatar system by theme.
  - Description: icons/avatars are scattered; theme-specific extraction is hard to scale.
  - Expected: centralized icon module strategy where UI requests semantic assets and theme resolver returns proper variant.
  - Acceptance: components consume icons/avatars through unified module API; theme switch updates assets consistently.

## In Progress
- None.

## Ready for Verify
- None.

## Done
- None.
