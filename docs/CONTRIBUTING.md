# Contributing Guidelines

This document provides guidelines for contributing to the tiwi-super-app codebase.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Code Organization](#code-organization)
3. [Coding Standards](#coding-standards)
4. [Architecture Guidelines](#architecture-guidelines)
5. [Testing](#testing)
6. [Pull Request Process](#pull-request-process)

---

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Familiarity with TypeScript, React, and Next.js
- Understanding of the [Architecture](./ARCHITECTURE.md)

### Setup

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run type checking
pnpm tsc --noEmit

# Run build
pnpm build
```

---

## Code Organization

### Where to Put Code

Follow the established architecture:

```
lib/
├── backend/      # Server-side logic
├── frontend/     # Client-side logic
└── shared/       # Platform-agnostic code
```

**Decision Tree:**
1. Does it run on the server? → `lib/backend/`
2. Does it use React/browser APIs? → `lib/frontend/`
3. Can it work in mobile? → `lib/shared/`
4. Is it a React component? → `components/`
5. Is it a React hook? → `hooks/`

### File Naming

- **Components:** `kebab-case.tsx` (e.g., `token-selector-modal.tsx`)
- **Hooks:** `camelCase.ts` with `use` prefix (e.g., `useTokenSearch.ts`)
- **Services:** `kebab-case.ts` (e.g., `token-service.ts`)
- **Types:** `kebab-case.ts` (e.g., `backend-tokens.ts`)
- **Utils:** `kebab-case.ts` (e.g., `formatting.ts`)

---

## Coding Standards

### TypeScript

- ✅ Always use TypeScript (no `.js` files)
- ✅ Use explicit types (avoid `any`)
- ✅ Use type imports: `import type { Token } from '...'`
- ✅ Define interfaces for object shapes
- ✅ Use enums for constants

**Example:**
```typescript
// ✅ Good
import type { Token } from '@/lib/frontend/types/tokens';

interface TokenListProps {
  tokens: Token[];
  onSelect: (token: Token) => void;
}

// ❌ Bad
const tokens: any[] = [];
function onSelect(token: any) {}
```

### React

- ✅ Use functional components
- ✅ Use hooks for state and side effects
- ✅ Extract reusable logic to custom hooks
- ✅ Keep components small and focused
- ✅ Use `'use client'` directive for client components

**Example:**
```typescript
// ✅ Good
'use client';

export function TokenSelector({ tokens, onSelect }: TokenSelectorProps) {
  const [query, setQuery] = useState('');
  // ...
}

// ❌ Bad
class TokenSelector extends React.Component { ... }
```

### Code Style

- ✅ Use 2 spaces for indentation
- ✅ Use single quotes for strings
- ✅ Use trailing commas
- ✅ Use semicolons
- ✅ Maximum line length: 100 characters
- ✅ Use meaningful variable names

**Example:**
```typescript
// ✅ Good
const tokenList = tokens.filter((token) => 
  token.chainId === selectedChainId
);

// ❌ Bad
const tl = tks.filter(t => t.cid === scid);
```

### Comments

- ✅ Add JSDoc comments for public functions
- ✅ Explain "why" not "what"
- ✅ Keep comments up to date
- ❌ Don't comment obvious code

**Example:**
```typescript
// ✅ Good
/**
 * Calculate similarity score between query and text (0-1)
 * Uses simple substring matching and Levenshtein-like scoring
 * 
 * @param query - Search query
 * @param text - Text to match against
 * @returns Similarity score between 0 and 1
 */
export function calculateSimilarity(query: string, text: string): number {
  // ...
}

// ❌ Bad
// This function calculates similarity
function calc(query, text) { ... }
```

---

## Architecture Guidelines

### Backend/Frontend Boundaries

**✅ DO:**
- Keep backend code in `lib/backend/`
- Keep frontend code in `lib/frontend/`
- Use shared code for platform-agnostic utilities
- Transform types at API boundaries

**❌ DON'T:**
- Import backend services in components
- Import frontend store in API routes
- Mix backend and frontend logic
- Break type boundaries

See [Architecture](./ARCHITECTURE.md) for details.

### Type Usage

**✅ DO:**
- Use backend types in backend code
- Use frontend types in frontend code
- Use shared types for API contracts
- Transform types in API clients

**❌ DON'T:**
- Use backend types in components
- Use frontend types in API routes
- Mix type categories

See [Type Usage Guidelines](./TYPE_USAGE_GUIDELINES.md) for details.

### Shared Code

**✅ DO:**
- Keep shared code pure (no side effects)
- Avoid framework dependencies
- Make it testable
- Document platform-agnostic nature

**❌ DON'T:**
- Use React in shared utilities
- Use Next.js APIs in shared code
- Add browser-specific code
- Add Node.js-specific code

---

## Testing

### Type Checking

Always run TypeScript type checking:

```bash
pnpm tsc --noEmit
```

### Build Verification

Verify the build works:

```bash
pnpm build
```

### Manual Testing

Test your changes:
- ✅ Test in development mode
- ✅ Test different scenarios
- ✅ Test error cases
- ✅ Test edge cases

---

## Pull Request Process

### Before Submitting

1. **Review your changes**
   - Run `pnpm tsc --noEmit`
   - Run `pnpm build`
   - Test manually

2. **Check architecture**
   - Is code in the right place?
   - Are types used correctly?
   - Are boundaries respected?

3. **Update documentation**
   - Update relevant docs if needed
   - Add comments for complex logic

### PR Description

Include:
- **What** - What does this PR do?
- **Why** - Why is this change needed?
- **How** - How does it work?
- **Testing** - How was it tested?

### Code Review

- Address all review comments
- Keep PRs focused (one feature/fix)
- Keep PRs small when possible
- Update documentation if needed

---

## Common Patterns

### Adding a New Provider

1. Create provider in `lib/backend/providers/`
2. Extend `BaseTokenProvider`
3. Implement required methods
4. Add to `TokenService` or `ChainService`
5. Update chain registry if needed

### Adding a New API Endpoint

1. Create route in `app/api/v1/`
2. Use backend services
3. Return shared API response types
4. Add error handling
5. Update frontend API client

### Adding a New Component

1. Create component in `components/`
2. Use frontend types
3. Use frontend hooks
4. Keep component focused
5. Extract reusable logic to hooks

### Adding a New Utility

1. Determine if it's backend, frontend, or shared
2. Create utility in appropriate location
3. Keep it pure (no side effects if shared)
4. Add JSDoc comments
5. Export from appropriate module

---

## Questions?

- Check [Architecture](./ARCHITECTURE.md) for structure
- Check [Type Usage Guidelines](./TYPE_USAGE_GUIDELINES.md) for types
- Check existing code for patterns
- Ask in PR comments or discussions

---

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn
- Follow the established patterns

Thank you for contributing! 🎉

