# AGENTS Instructions

Welcome to the bigCat repository. Follow these rules whenever you modify code.

## ⚠️ CRITICAL: Build Command Usage - READ THIS FIRST

**🚨 MANDATORY RULE**: The `bun run build` command should be run **ONLY ONCE** after completing your implementation, unless there are actual build errors that need to be fixed.

### ✅ CORRECT Usage:
- Run `bun run build` **ONCE** after finishing your code changes
- Rerun `bun run build` **ONLY** if the first run failed with errors that you then fixed

### ❌ INCORRECT Usage:
- Running `bun run build` multiple times without errors
- Running `bun run build` twice "just to be sure"
- Running `bun run build` after every small change
- Running `bun run build` as a verification step when no errors occurred

**This rule prevents unnecessary build cycles and improves efficiency.**

---

## 🚨 CRITICAL: Dev Server Management - MANDATORY WORKFLOW

**🚨 MANDATORY RULE**: The Keeta Wallet extension **ONLY works with `localhost:3000`** for development. You MUST follow this exact workflow after every code change.

### ✅ REQUIRED Workflow After Every Code Change:

1. **After making code changes and running build:**
   ```bash
   bun run build  # Run ONCE to verify compilation
   ```

2. **Terminate ALL previous terminals/dev servers:**
   - Stop any running `bun run dev` processes
   - Kill all Node.js/Bun background processes if necessary
   - Ensure port 3000 is completely free

3. **Start fresh dev server on localhost:3000:**
   ```bash
   bun run dev -- -p 3000
   ```
   OR
   ```bash
   bun run dev  # If package.json already configured for port 3000
   ```

### 🔒 Why This is Critical:

- The Keeta Wallet extension has a **hardcoded whitelist** for `http://localhost:3000`
- The extension will **reject all requests** from other ports (3001, 3002, 5173, etc.)
- You will get "Origin is not authorized" or "read capability token is required" errors on other ports
- **Every code change** requires a fresh server restart on port 3000 to ensure proper wallet connection

### ❌ NEVER Do This:
- Running dev server on any port other than 3000
- Keeping old dev servers running after code changes
- Assuming the wallet will work on other localhost ports
- Forgetting to restart the dev server after build

### 📝 Dev Server Checklist:
- [ ] Stop all previous dev servers
- [ ] Verify port 3000 is free
- [ ] Start `bun run dev -- -p 3000`
- [ ] Verify server is running on `http://localhost:3000`
- [ ] Test wallet connection before proceeding

**This workflow is MANDATORY for all wallet-related development.**

---

## 🔒 CRITICAL: NON-CUSTODIAL ARCHITECTURE - SECURITY FIRST

**🚨 MANDATORY SECURITY PRINCIPLE**: This application follows a **ZERO-CUSTODY** design. The backend NEVER holds user funds or private keys.

### Core Architecture Principle

```
USER SIGNS EVERYTHING. BACKEND HAS ZERO CUSTODY.
```

**What This Means:**

✅ **Frontend builds transactions** - Uses Keeta SDK to construct operations  
✅ **User signs via wallet** - Every operation requires explicit wallet approval  
✅ **Backend tracks state only** - Stateless coordinator with NO custody  
✅ **No operator key stored** - Backend cannot move funds  
✅ **User maintains OWNER** - Full control over storage accounts  

### Implementation Rules

#### ❌ NEVER Do This:
```typescript
// BAD: Backend creates storage account and holds key
POST /api/pools/create
Backend: Creates storage account, stores operator key, moves funds
```

#### ✅ ALWAYS Do This:
```typescript
// GOOD: User creates storage account via wallet
Frontend: Builds transaction with Keeta SDK
User: Signs transaction in wallet extension
Keeta Network: Settles transaction (400ms)
Backend: Notified of pool creation (tracking only)
```

### Pool Operations Flow

**Pool Creation (User-Controlled):**
1. User enters pool parameters in UI
2. Frontend builds unsigned transaction using Keeta SDK
3. Wallet extension prompts user to sign
4. User approves → Transaction submitted to Keeta
5. Keeta settles transaction (400ms)
6. Frontend notifies backend for UI tracking
7. Backend updates internal state (NO custody involved)

**Add/Remove Liquidity (User-Controlled):**
1. User requests liquidity operation
2. Frontend builds transaction (transfers to/from user's pool storage account)
3. User signs in wallet (user is OWNER of storage account)
4. Transaction settles on Keeta
5. Backend updates UI state only

**Security Benefits:**
- ✅ **Zero custody risk** - Backend breach ≠ stolen funds
- ✅ **User control** - User can withdraw anytime
- ✅ **Transparent** - All operations visible on Keeta explorer
- ✅ **Revocable** - User can close pool without backend permission
- ✅ **No single point of failure** - Must compromise individual wallets

### Code Guidelines

**Frontend Transaction Builder Pattern:**
```typescript
import { useWallet } from '../contexts/WalletContext';

async function createPoolOnChain(params) {
  const { client, publicKey } = useWallet();
  
  // Build transaction
  const builder = client.initBuilder();
  const poolStorage = builder.generateIdentifier(STORAGE);
  
  // User is OWNER
  builder.setInfo({
    defaultPermission: new Permissions(['STORAGE_DEPOSIT', 'STORAGE_CAN_HOLD'])
  }, { account: poolStorage.account });
  
  // Transfer funds
  builder.send(poolStorage.account, amountA, tokenA);
  builder.send(poolStorage.account, amountB, tokenB);
  
  // User signs and publishes
  const result = await client.publishBuilder(builder);
  
  // Notify backend (tracking only - NO custody)
  await fetch('/api/pools/created', {
    method: 'POST',
    body: JSON.stringify({
      pool_id, storage_account, tx_hash,
      // Backend just tracks for UI
    })
  });
}
```

**Backend Notification-Only Pattern:**
```rust
// Backend endpoint (NO custody, just tracking)
pub async fn notify_pool_created(
    state: web::Data<PoolState>,
    body: web::Json<PoolCreatedNotification>,
) -> HttpResponse {
    // User already created pool on-chain
    // Backend just updates tracking for UI
    
    let pool = LiquidityPool {
        id: body.pool_id,
        storage_account: body.storage_account, // User-owned
        creator: body.creator, // User's wallet address
        // NO operator key, NO custody
    };
    
    state.pool_manager.register_pool(pool);
    
    HttpResponse::Ok().json(json!({ "status": "tracked" }))
}
```

### Prohibited Patterns

❌ **NEVER store operator private keys in backend:**
```rust
// WRONG - DO NOT DO THIS
let operator_seed = env::var("OPERATOR_SEED")?; // ❌ Custody risk!
```

❌ **NEVER have backend sign transactions:**
```rust
// WRONG - DO NOT DO THIS
let signed_tx = operator.sign(transaction)?; // ❌ Backend custody!
```

❌ **NEVER create storage accounts from backend:**
```rust
// WRONG - DO NOT DO THIS
let storage = keeta_client.create_storage_account()?; // ❌ Backend control!
```

### Verification Checklist

Before deploying any pool/liquidity feature:
- [ ] User signs ALL operations via wallet
- [ ] Backend has NO operator private key
- [ ] Backend endpoints are notification-only
- [ ] Storage accounts owned by users (not operator)
- [ ] All funds movements visible on Keeta explorer
- [ ] Backend CANNOT move funds (only track state)

**See `keeta-pool-integration.plan.md` for complete architecture documentation.**

---

## 🎨 DESIGN SYSTEM STANDARDIZATION

**MANDATORY**: When creating UI elements, buttons, cards, or any visual components, follow these standardized design patterns from the home page.

### Color Palette & CSS Variables

**Always use CSS variables - NEVER hardcode colors:**

#### Background Colors:
- `bg-[color:var(--background)]` - Main page background (#0b0b0f dark, #f7f8fa light)
- `.glass` - Glassmorphism cards (var(--surface-glass) with backdrop-filter)
- `bg-surface` - Soft surface background (6% foreground opacity)
- `bg-surface-strong` - Stronger surface (10% foreground opacity)
- `bg-accent` - Primary action color (blue #6aa8ff)

#### Text Colors:
- `text-foreground` - Primary text (#e6e6e6 dark, #0c0d10 light)
- `text-muted` - Secondary text (62% foreground opacity, #9aa0a6)
- `text-subtle` - Tertiary text (74% foreground opacity)
- `text-faint` - Quaternary text (48% foreground opacity)

#### Border Colors:
- `border-hairline` - Subtle borders (rgba(255,255,255,0.08) dark, rgba(0,0,0,0.08) light)
- `border-soft` - Slightly stronger borders (18-20% foreground opacity)

#### Accent Colors:
- `bg-accent` - Blue accent (#6aa8ff)
- `text-accent` - Use for links, highlights
- Avoid hardcoded accent colors - use CSS variable

### Typography Hierarchy

#### Font Sizes:
- **Page Title**: `text-4xl` (2.25rem / 36px) - Used for main headings
- **Section Title**: `text-xl` (1.25rem / 20px) - Section headers like "Markets"
- **Subsection Title**: `text-lg` (1.125rem / 18px) - "Estimated Balance", "Menu"
- **Body Large**: `text-base` (1rem / 16px) - Default body text
- **Body Regular**: `text-sm` (0.875rem / 14px) - Menu items, buttons, labels
- **Body Small**: `text-xs` (0.75rem / 12px) - Captions, metadata
- **Balance Display**: `text-3xl` (1.875rem / 30px) - Large numbers/balances

#### Font Weights:
- **Bold**: `font-bold` (700) - Page titles, important headings
- **Semibold**: `font-semibold` (600) - Section titles, emphasized text
- **Medium**: `font-medium` (500) - Buttons, menu items, labels
- **Regular**: (400) - Default body text

### Spacing & Padding Rhythm

#### Container Padding:
- **Page Container**: `px-6 py-8` - Main content wrapper
- **Card/Box Padding**: `p-6` or `p-4` - Glass containers
- **Small Card**: `p-4` - Sidebar, compact cards

#### Component Gaps:
- **Large Gap**: `gap-8` - Between major sections
- **Medium Gap**: `gap-6` - Within sections
- **Standard Gap**: `gap-3` - Button groups, form fields
- **Compact Gap**: `gap-2` - Icon + text, tight elements
- **Minimal Gap**: `gap-1` - Very tight spacing

#### Button Padding:
- **Primary Button**: `px-6 py-2.5` or `px-6 py-3` - CTA buttons
- **Secondary Button**: `px-6 py-2.5` - Action buttons
- **Icon Button**: `p-3` - Square icon-only buttons
- **Small Button**: `px-3 py-2` - Menu items, compact actions
- **Minimal Button**: `p-2` or `p-1` - Utility buttons

#### Margin Rhythm:
- **Section Bottom**: `mb-8` - Between major sections
- **Element Bottom**: `mb-4` or `mb-6` - Between elements
- **Small Bottom**: `mb-2` - Between small elements

### Border Radius Standards

- **Extra Large**: `rounded-2xl` (1rem / 16px) - Sidebar, major cards
- **Large**: `rounded-lg` (0.5rem / 8px) - Menu items, buttons, cards
- **Medium**: `rounded-md` (0.375rem / 6px) - Action buttons
- **Full**: `rounded-full` (9999px) - Pills, connect wallet button

### Component Patterns

#### Glassmorphism Cards:
```jsx
<div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
  <div className="p-6">
    {/* Content */}
  </div>
</div>
```

#### Sidebar/Navigation Items:
```jsx
// Active State
<a className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-surface-strong rounded-lg transition-all duration-200 hover:bg-surface-strong/80">
  <IconComponent className="h-4 w-4 flex-shrink-0" />
  <span className="truncate">Label</span>
</a>

// Inactive State
<a className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200">
  <IconComponent className="h-4 w-4 flex-shrink-0" />
  <span className="truncate">Label</span>
</a>
```

#### Primary Action Button:
```jsx
<button className="inline-flex items-center justify-center gap-2 bg-accent text-white px-6 py-2.5 rounded-md font-medium hover:bg-accent/90 transition-colors min-w-[120px]">
  <IconComponent className="h-4 w-4" />
  Button Text
</button>
```

#### Secondary Action Button:
```jsx
<button className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]">
  <IconComponent className="h-4 w-4" />
  Button Text
</button>
```

#### Large Primary Button (Connect Wallet):
```jsx
<button className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_20px_50px_rgba(15,15,20,0.35)] transition-all duration-200 hover:bg-white/90 disabled:opacity-70 disabled:cursor-not-allowed">
  Button Text
</button>
```

### Icon Standards

**ALWAYS use Lucide React icons** - Import from `lucide-react`:

#### Icon Sizes:
- **Menu Icons**: `h-4 w-4` - Sidebar, navigation
- **Button Icons**: `h-4 w-4` - Action buttons
- **Large Icons**: `h-5 w-5` or `h-6 w-6` - Feature highlights
- **Dropdown/Utility**: `h-3 w-3` - Small indicators

#### Common Icons:
- `LayoutDashboard` - Dashboard
- `Wallet` - Assets/Wallet
- `ShoppingCart` - Orders
- `Gift` - Rewards
- `Users` - Referral/Team
- `UserCircle` - Account
- `Users2` - Sub Accounts
- `Settings` - Settings
- `ArrowDownToLine` - Deposit
- `ArrowUpFromLine` - Withdraw
- `Banknote` - Cash/Money

#### Icon Usage:
```jsx
import { IconName } from 'lucide-react';

<IconName className="h-4 w-4 flex-shrink-0" />
```

### Hover Effects

**NO scale/transform effects** - Only highlight effects:

#### Standard Hover Pattern:
- **Text Color**: `hover:text-foreground` (brighten text)
- **Background**: `hover:bg-surface` (show background)
- **Transition**: `transition-all duration-200` (smooth 200ms)

#### Button Hover Pattern:
- **Primary**: `hover:bg-accent/90` (slightly dim)
- **Secondary**: `hover:bg-surface-strong` (brighten background)
- **Glass**: `hover:bg-surface` (show background)

#### Active State:
- **Background**: `bg-surface-strong` (10% opacity)
- **Hover**: `hover:bg-surface-strong/80` (slightly dim)

### Shadow Standards

- **Card Shadow**: `shadow-[0_20px_60px_rgba(6,7,10,0.45)]` - Glass cards
- **Button Shadow**: `shadow-[0_20px_50px_rgba(15,15,20,0.35)]` - Primary buttons
- **Subtle Shadow**: `shadow-sm` or no shadow for secondary elements

### Responsive Breakpoints

- **Mobile First**: Default styles for mobile
- **Small**: `sm:` (640px+) - Small tablets
- **Large**: `lg:` (1024px+) - Tablets/small desktops
- **Extra Large**: `xl:` (1280px+) - Desktop sidebar appears

#### Common Responsive Patterns:
```jsx
// Flex direction
className="flex flex-col sm:flex-row gap-3"

// Grid columns
className="xl:grid xl:grid-cols-[16rem_minmax(0,1fr)]"

// Hide on mobile
className="hidden xl:block"

// Show on mobile only
className="xl:hidden"
```

### Layout Containers

#### Page Wrapper:
```jsx
<main className="relative overflow-hidden min-h-screen bg-[color:var(--background)]">
  <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
    {/* Content */}
  </div>
</main>
```

#### Sidebar Width:
- **Desktop Sidebar**: `w-64` (16rem / 256px)
- **Grid Column**: `xl:grid-cols-[16rem_minmax(0,1fr)]`

### Animation & Transitions

**Timing Standards:**
- **Fast**: `duration-200` (200ms) - Hover effects, color changes
- **Medium**: `duration-300` (300ms) - Larger transforms, modals
- **Slow**: `duration-500` (500ms) - Page transitions

**Easing:**
- Use `transition-all` for multi-property animations
- Use `transition-colors` for color-only changes

### Table Styling

#### Table Structure:
```jsx
<div className="overflow-x-auto">
  <table className="w-full">
    <thead>
      <tr className="border-b border-hairline">
        <th className="text-left py-4 px-6 text-muted text-sm font-medium">
          Header
        </th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-hairline hover:bg-surface/50 transition-colors">
        <td className="py-4 px-6">
          <div className="text-foreground font-medium">Content</div>
          <div className="text-muted text-sm">Subtext</div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

#### Table Padding:
- **Cell Padding**: `py-4 px-6` - Standard table cells
- **Header Padding**: `py-4 px-6` - Table headers

### Form Elements

#### Input Fields:
- Use `.input-pill` class for form inputs
- Border: `border border-hairline`
- Padding: `px-4 py-2`
- Rounded: `rounded-lg` or `rounded-full`

### Mobile Menu Pattern

```jsx
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

// Toggle Button
<button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
  <svg>...</svg>
</button>

// Mobile Sidebar
{isMobileMenuOpen && (
  <>
    <div className="fixed inset-0 bg-black/50 z-40 xl:hidden" onClick={() => setIsMobileMenuOpen(false)} />
    <div className="fixed inset-y-0 left-0 w-64 glass border-r border-hairline z-50 xl:hidden overflow-auto">
      {/* Menu content */}
    </div>
  </>
)}
```

### Z-Index Hierarchy

- **Backdrop**: `z-40` - Overlay backgrounds
- **Modal/Sidebar**: `z-50` - Slide-out menus
- **Content**: `z-10` - Main content layer
- **Background**: `-z-10` - Background decorations

### Disabled States

```jsx
disabled:opacity-70 
disabled:cursor-not-allowed 
disabled:transform-none
```

### Loading States

#### Spinner SVG:
```jsx
<svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>
```

---

## 🚫 NO MOCK DATA / FALLBACK DATA

**MANDATORY**: Never use mock data or fallback data in the application code.

**Why:**
- ❌ Mixes with real data (hard to detect)
- ❌ Can leak to production
- ❌ Hides backend connection issues
- ❌ Creates false sense of functionality

**What to do instead:**
- ✅ Show clear error states when backend is unavailable
- ✅ Display helpful error messages with instructions
- ✅ Make it obvious the backend needs to be running
- ✅ Use proper loading/error/empty state handling

**Example - WRONG:**
```typescript
// ❌ BAD: Fallback to mock data
catch (error) {
  if (process.env.NODE_ENV === 'development') {
    setData(MOCK_DATA); // NO! Don't do this
  }
}
```

**Example - CORRECT:**
```typescript
// ✅ GOOD: Show clear error
catch (error) {
  setError('Backend not running. Start with: cd keythings-dapp-engine && cargo run');
  setData([]);
}
```

---

## 🔍 INPUT VALIDATION & ERROR HANDLING

**MANDATORY**: All input validation and data parsing must use Zod schemas. Try/catch blocks should be minimized and used only for truly exceptional cases.

### Zod Validation Standards

**ALWAYS use Zod for:**
- API response validation
- User input validation
- Environment variable validation
- Configuration validation
- Third-party data parsing (wallet provider responses, CoinGecko API, etc.)
- Function parameter validation

**Installation:**
```bash
bun add zod
```

### ✅ CORRECT Approach - Using Zod

```typescript
import { z } from 'zod';

// Define schema
const WalletResponseSchema = z.object({
  accounts: z.array(z.string()),
  balance: z.string(),
  network: z.object({
    name: z.string(),
    chainId: z.string(),
  }),
});

// Validate data
const result = WalletResponseSchema.safeParse(data);

if (!result.success) {
  console.error('Invalid wallet response:', result.error);
  // Handle validation error
  return null;
}

// TypeScript now knows result.data is valid
const { accounts, balance, network } = result.data;
```

### ❌ INCORRECT Approach - Using Try/Catch

```typescript
// BAD: Don't use try/catch for validation
try {
  const accounts = data.accounts; // No type checking
  const balance = data.balance;   // Could be undefined
  // ... more unvalidated access
} catch (error) {
  console.error('Error:', error);
}
```

### Common Zod Patterns

#### API Response Validation:
```typescript
const TokenMetadataSchema = z.object({
  address: z.string(),
  name: z.string().optional(),
  ticker: z.string().optional(),
  decimals: z.number().optional(),
  metadata: z.string().optional(),
});

async function fetchTokenMetadata(address: string) {
  const response = await provider.getTokenMetadata(address);
  const result = TokenMetadataSchema.safeParse(response);
  
  if (!result.success) {
    console.warn('Invalid token metadata:', result.error);
    return null;
  }
  
  return result.data;
}
```

#### User Input Validation:
```typescript
const SendTransactionSchema = z.object({
  to: z.string().min(1, 'Recipient address required'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
  token: z.string().optional(),
});

function validateTransactionInput(input: unknown) {
  return SendTransactionSchema.safeParse(input);
}
```

#### Environment Variables:
```typescript
const EnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

const env = EnvSchema.parse(process.env);
```

#### Array Validation:
```typescript
const TokenListSchema = z.array(
  z.object({
    token: z.string(),
    balance: z.string(),
    metadata: z.string().optional(),
  })
);

const tokens = TokenListSchema.safeParse(rawTokens);
if (!tokens.success) {
  console.error('Invalid token list');
  return [];
}
```

### When to Use Try/Catch

**ONLY use try/catch for:**
- Network requests that might fail
- File system operations
- External API calls (fetch, etc.)
- Truly exceptional runtime errors

**Example of Acceptable Try/Catch:**
```typescript
async function fetchFromApi(url: string) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    // Validate with Zod
    const result = ApiResponseSchema.safeParse(data);
    if (!result.success) {
      return null;
    }
    
    return result.data;
  } catch (error) {
    // Network error or parsing error
    console.error('API request failed:', error);
    return null;
  }
}
```

### Prohibited Patterns

❌ **NEVER do this:**
```typescript
// BAD: Using try/catch for type checking
try {
  const value = data.field.subfield.value;
} catch {
  const value = null;
}

// GOOD: Use Zod with optional chaining
const schema = z.object({
  field: z.object({
    subfield: z.object({
      value: z.string().optional(),
    }).optional(),
  }).optional(),
});
const validated = schema.safeParse(data);
const value = validated.success ? validated.data.field?.subfield?.value : null;
```

❌ **NEVER suppress validation errors:**
```typescript
// BAD: Silently ignoring validation errors
const result = schema.safeParse(data);
// Just continue without checking result.success

// GOOD: Handle validation errors properly
const result = schema.safeParse(data);
if (!result.success) {
  console.error('Validation failed:', result.error);
  // Show user-friendly error or return fallback
  return null;
}
```

### Type Safety Benefits

Using Zod provides:
- ✅ **Runtime type checking** - Catch data errors at runtime
- ✅ **TypeScript inference** - Automatic type inference from schemas
- ✅ **Clear error messages** - Detailed validation error reports
- ✅ **Self-documenting code** - Schema serves as documentation
- ✅ **Prevents runtime crashes** - Invalid data caught before use

### Integration with ESLint

Add these ESLint rules to enforce Zod usage:

```javascript
// eslint.config.mjs
{
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TryStatement > CatchClause > Identifier',
        message: 'Use Zod validation instead of try/catch for data validation',
      },
    ],
  },
}
```

### Migration Checklist

When refactoring existing code:
- [ ] Identify all try/catch blocks used for validation
- [ ] Create Zod schemas for the data being validated
- [ ] Replace try/catch with `.safeParse()` calls
- [ ] Add proper error handling for validation failures
- [ ] Update TypeScript types to match Zod schemas
- [ ] Test with invalid data to ensure validation works
- [ ] Remove unnecessary try/catch blocks

---

Run the following before committing changes:

## 1. MANDATORY: Think First, Then Scan Knowledge Base
**BEFORE starting any task, follow this process:**

> 📚 **See [RAG_DEVELOPMENT_GUIDE.md](./RAG_DEVELOPMENT_GUIDE.md) for comprehensive RAG usage guide**

### Step 1: Think About the Problem
- **Analyze the requirement** and understand what needs to be built
- **Consider the context** and how it fits into the wallet ecosystem
- **Identify potential challenges** and technical considerations
- **Plan the approach** before diving into implementation

### Step 2: Scan Keeta Knowledge Base using MCP
**After thinking through the problem, scan the knowledge base for relevant information using MCP tools:**

**MCP Configuration:**
Your MCP-capable tools should connect to the Keeta knowledge base using the global Cursor MCP settings.

**Required Knowledge Base Queries:**
Use MCP tools to search for:
- Relevant Keeta features and capabilities
- Official documentation and whitepaper content
- Keeta's architecture and best practices
- Security guidelines and compliance requirements
- Cross-chain interoperability features
- Token standards and native tokenization
- Performance requirements (400ms settlement, 10M TPS)

**Quick RAG Query Examples:**
- "Keeta SDK [feature name] implementation best practices"
- "Keeta SDK [operation] security guidelines"
- "Keeta SDK error handling for [feature]"
- "Keeta SDK performance optimization for [use case]"

**This two-step process is MANDATORY and must be completed before any code changes.**

---

## 1.1. MANDATORY: MCP Tool Selection & Usage Strategy

**🚨 CRITICAL RULE**: Always use the RIGHT MCP tool for the RIGHT problem. Choose based on problem type, not convenience.

### Available MCP Tools

#### 1. **Keeta MCP** (`mcp_keeta-dev-mcp-server_search_keeta_docs`)
**Use for:** Keeta-specific technical questions and implementation guidance

**When to use:**
- ✅ Understanding Keeta SDK features and APIs
- ✅ Keeta architecture, design patterns, and best practices
- ✅ Keeta security guidelines and compliance requirements
- ✅ Keeta performance standards (400ms settlement, 10M TPS)
- ✅ Keeta cross-chain interoperability and token standards
- ✅ Keeta transaction lifecycle and settlement mechanics
- ✅ Official Keeta documentation and whitepaper content
- ✅ Keeta RPC methods and provider integration
- ✅ Keeta network configuration and chain details

**Example queries:**
```
"How does Keeta handle transaction settlement?"
"What are Keeta's security best practices for wallet integration?"
"How to implement read capability tokens in Keeta SDK?"
"What is Keeta's approach to cross-chain asset transfers?"
```

**When NOT to use:**
- ❌ UI/UX issues (use Browser MCP instead)
- ❌ General web development questions (use your knowledge)
- ❌ Non-Keeta blockchain questions
- ❌ Browser console errors (use Browser MCP)

---

#### 2. **Browser MCP** (`mcp_browsermcp_*`)
**Use for:** Real-time browser debugging, UI testing, and user experience validation

**When to use:**
- ✅ Debugging wallet connection issues in real browser
- ✅ Testing UI interactions with actual wallet extension
- ✅ Monitoring console logs for runtime errors
- ✅ Validating responsive design and layout
- ✅ Testing form submissions and user flows
- ✅ Verifying visual appearance and styling
- ✅ Checking accessibility and user experience
- ✅ Monitoring network requests and API calls
- ✅ Testing transaction flows with real wallet
- ✅ Debugging state management in browser

**Available Browser MCP Tools:**
- `browser_navigate` - Navigate to URL
- `browser_snapshot` - Get page structure (accessibility tree)
- `browser_screenshot` - Visual inspection
- `browser_get_console_logs` - Monitor console output
- `browser_click` - Interact with elements
- `browser_type` - Fill forms and inputs
- `browser_hover` - Test hover states
- `browser_select_option` - Test dropdowns
- `browser_wait_for` - Wait for elements/text

**Example usage:**
```
1. Navigate to http://localhost:3000
2. Snapshot page to see elements
3. Get console logs to check for errors
4. Click "Connect Wallet" button
5. Screenshot to verify UI state
6. Monitor console for wallet connection flow
```

**When NOT to use:**
- ❌ Keeta SDK technical questions (use Keeta MCP)
- ❌ Code architecture decisions
- ❌ Security best practices research
- ❌ Performance optimization strategies

---

### MCP Tool Selection Decision Tree

```
Is this a Keeta SDK/network/protocol question?
├─ YES → Use Keeta MCP
│   └─ Query documentation for implementation guidance
│
└─ NO → Is this a UI/browser/runtime issue?
    ├─ YES → Use Browser MCP
    │   ├─ Navigate to the page
    │   ├─ Take snapshot/screenshot
    │   ├─ Monitor console logs
    │   └─ Test interactions
    │
    └─ NO → Use standard codebase tools
        ├─ codebase_search for semantic search
        ├─ grep for exact matches
        └─ read_file for reading code
```

---

### MCP Usage Best Practices

#### **1. Keeta MCP Best Practices:**
- **Be specific** in queries - mention exact SDK methods, features, or concepts
- **Include context** - specify what you're trying to accomplish
- **Query sequentially** - ask one focused question at a time
- **Cross-reference** - validate findings with actual code implementation
- **Document learnings** - add important findings to self-learning section

**Good Keeta MCP Query:**
```
"How does Keeta implement read capability tokens for wallet provider integration?"
```

**Bad Keeta MCP Query:**
```
"wallet stuff"
```

---

#### **2. Browser MCP Best Practices:**
- **Always connect first** - User must connect browser tab via extension
- **Snapshot before interact** - Get page structure before clicking
- **Monitor console** - Check logs after each interaction
- **Screenshot for visual** - Use screenshots to verify UI state
- **Test user flows** - Simulate real user interactions
- **Document issues** - Log browser errors to self-learning section

**Good Browser MCP Workflow:**
```
1. browser_navigate(http://localhost:3000)
2. browser_snapshot() - see page structure
3. browser_get_console_logs() - check for errors
4. browser_click("Connect Wallet") - test interaction
5. browser_get_console_logs() - monitor connection flow
6. browser_screenshot() - verify success state
```

**Bad Browser MCP Workflow:**
```
1. browser_navigate(url)
2. Assume everything works without checking
```

---

### When to Use BOTH MCPs Together

**Combined Strategy for Wallet Integration Issues:**

1. **Discover the problem** (Browser MCP):
   - Navigate to page with issue
   - Check console logs for errors
   - Screenshot to see visual problem

2. **Research the solution** (Keeta MCP):
   - Query Keeta docs for proper implementation
   - Check security guidelines
   - Find best practices

3. **Implement the fix** (Code tools):
   - Make code changes based on findings
   - Follow Keeta standards from MCP

4. **Validate the fix** (Browser MCP):
   - Test in real browser
   - Monitor console logs
   - Verify wallet connection works

**Example Combined Workflow:**
```
Problem: Wallet connection failing

Step 1 (Browser MCP):
  - Navigate to localhost:3000
  - Get console logs → "Origin is not authorized"
  - Screenshot showing error state

Step 2 (Keeta MCP):
  - Query: "How does Keeta validate origins for wallet connections?"
  - Find: Need to set APP_ORIGIN_ALLOWLIST

Step 3 (Code):
  - Update origin configuration
  - Rebuild and restart dev server

Step 4 (Browser MCP):
  - Refresh page
  - Click "Connect Wallet"
  - Check console → Connection successful
  - Screenshot showing connected state
```

---

### MCP Tool Performance Tips

- **Keeta MCP**: Cache responses mentally - if you already queried about a topic, reference that knowledge
- **Browser MCP**: Take snapshots before screenshots - snapshots are faster and show structure
- **Parallel queries**: When researching multiple unrelated topics, query Keeta MCP for each in separate calls
- **Progressive debugging**: Start with broad snapshots, then drill into specific elements

---

### Prohibited MCP Usage Patterns

❌ **NEVER do this:**
- Query Keeta MCP for generic web dev questions
- Use Browser MCP without user connecting a tab first
- Skip MCP tools when they would provide critical information
- Use Browser MCP for Keeta protocol questions
- Use Keeta MCP for UI debugging
- Make assumptions without verifying via MCP when applicable

✅ **ALWAYS do this:**
- Choose the right MCP for the problem type
- Query Keeta MCP before implementing Keeta features
- Use Browser MCP to verify fixes work in real browser
- Document MCP findings in self-learning section
- Cross-validate MCP results with actual implementation

---

## 2. Required Commands After Every Task
Run the following commands ONCE after completing your implementation:

```bash
bun run build        # Run ONCE after implementation (Bun-optimized build)
bun audit            # Check for vulnerabilities
```

**🚨 Build Command Rules:**
- **MANDATORY**: Run `bun run build` **EXACTLY ONCE** after implementation
- **ONLY RERUN** if the first run failed with errors that you then fixed
- **NEVER RUN** multiple times "just to be sure" or for verification
- **NEVER RUN** after every small change - wait until implementation is complete
- All commands must finish with no errors or warnings before proceeding

---

## 2.1. MANDATORY: Immediate Warning and Linting Resolution

**🚨 ZERO TOLERANCE POLICY**: All warnings and linting issues must be addressed immediately upon detection. No warnings or linting errors should be left unresolved.

### Immediate Action Required:
1. **Run `bun run lint`** after every code change to detect issues
2. **Fix ALL warnings and errors** before proceeding with any other tasks
3. **Never silence or ignore** warnings - they indicate real code quality issues
4. **Address linting issues** as soon as they appear, not at the end

### Warning Categories and Required Actions:

#### 🚨 **Critical Issues (MUST FIX IMMEDIATELY)**
- **TypeScript errors**: Type mismatches, missing types, compilation failures
- **Security warnings**: Unsafe operations, exposed secrets, vulnerability alerts
- **Build failures**: Code that prevents successful compilation
- **Runtime errors**: Code that will crash at runtime

#### ⚠️ **High Priority Warnings (FIX BEFORE CONTINUING)**
- **ESLint errors**: Code style violations, unused variables, missing dependencies
- **Import/export issues**: Missing imports, circular dependencies, unused exports
- **Type safety warnings**: `any` types, missing type annotations, unsafe operations
- **Performance warnings**: Memory leaks, inefficient operations, bundle size issues

#### 💡 **Code Quality Warnings (FIX BEFORE COMMIT)**
- **Style inconsistencies**: Formatting, naming conventions, code organization
- **Dead code**: Unused functions, variables, or imports
- **Accessibility issues**: Missing ARIA labels, keyboard navigation problems
- **Best practice violations**: React patterns, security practices, performance optimizations

### Required Linting Commands:
```bash
# Check for linting issues in specific files
bun run lint src/lib/keeta-amount-utils.ts src/components/Dashboard.tsx

# Check for all linting issues in the project
bun run lint

# Fix auto-fixable issues
bun run lint --fix
```

### Warning Resolution Process:
1. **Detect**: Use `bun run lint` to identify all issues
2. **Categorize**: Determine severity level (Critical/High/Quality)
3. **Fix**: Address each issue with appropriate solution
4. **Verify**: Re-run `bun run lint` to confirm resolution
5. **Build**: Run `bun run build` to ensure no regressions
6. **Build**: Run `bun run build` to verify clean compilation

### Prohibited Actions:
- ❌ **NEVER** use `// eslint-disable` comments to silence warnings
- ❌ **NEVER** ignore TypeScript errors with `// @ts-ignore`
- ❌ **NEVER** leave unused imports or variables
- ❌ **NEVER** commit code with warnings or linting errors
- ❌ **NEVER** suppress warnings without fixing the underlying issue

### Quality Gate Requirements:
- **All linting errors must be resolved** before any commit
- **All warnings must be addressed** before any commit
- **Clean build output** with no warnings or errors
- **All tests must pass** after fixing linting issues
- **No new warnings introduced** by the changes

---

## 2.2. MANDATORY: Warning and Linting Workflow

**Every code change must follow this exact workflow to maintain a clean codebase:**

### Step-by-Step Process:
1. **Make Code Changes** - Implement the required functionality
2. **Run `bun run lint`** - Check for any warnings or errors immediately
3. **Fix ALL Issues** - Address every warning and error found
4. **Re-run `bun run lint`** - Verify all issues are resolved
5. **Run `bun run build`** - Verify clean compilation (once only)
6. **Run `bun audit`** - Check for security vulnerabilities

### Immediate Action Triggers:
- **Any warning detected** → Stop current task, fix immediately
- **Any linting error** → Stop current task, fix immediately  
- **Any TypeScript error** → Stop current task, fix immediately
- **Any build failure** → Stop current task, fix immediately

### Prohibited Workflows:
- ❌ **NEVER** continue coding with warnings present
- ❌ **NEVER** commit code with any warnings or errors
- ❌ **NEVER** ignore linting issues "for later"
- ❌ **NEVER** use suppression comments instead of fixing issues

### Quality Standards:
- **Zero warnings** - All warnings must be resolved
- **Zero errors** - All errors must be resolved
- **Clean build** - No compilation warnings or errors
- **Passing tests** - All tests must pass after fixes
- **Clean audit** - No high-severity vulnerabilities

---

## 3. Review Workflow
After running the commands, the AI assistant will perform a manual code review. The review should:

- Inspect `git diff` for your changes.
- Check security: no secret exposure, safe key handling, no sensitive logging.
- Verify architecture: maintain module boundaries and avoid circular dependencies.
- Evaluate code quality: strong typing (no `any`), handled promises, functional React components, and proper i18n usage.
- Report findings by priority:
  - 🚨 Critical Issues – must be fixed immediately
  - ⚠️ Warnings – address before merge
  - 💡 Suggestions – optional improvements

---

## 4. MANDATORY: Keeta Alignment Verification
**BEFORE finalizing any changes, verify alignment with Keeta standards using MCP:**

**Required Alignment Checks:**
- ✅ **Architecture Compliance:** Does the implementation follow Keeta's design patterns?
- ✅ **Security Standards:** Are Keeta's security guidelines being followed?
- ✅ **Performance Requirements:** Does it meet Keeta's 400ms settlement and 10M TPS standards?
- ✅ **Cross-Chain Compatibility:** Is the feature compatible with Keeta's interoperability goals?
- ✅ **Token Standards:** Does it properly support Keeta's native tokenization?
- ✅ **Compliance:** Does it align with Keeta's built-in compliance protocols?

**Final Verification Questions:**
1. Does this change leverage Keeta's unique capabilities?
2. Is it aligned with Keeta's "blockchain banking" vision?
3. Does it support cross-chain interoperability?
4. Are we following Keeta's security and performance standards?

**This verification is MANDATORY before any commit.**

---

## 5. Mandatory Review Workflow

After running the above commands—and before pushing or committing—invoke the **Stronghold code review**. This internal review protocol ensures top-tier standards in crypto security and code quality.
### Review Invocation
1. Run the specialized review workflow immediately after modifying code.
2. The review should analyze `git diff` for the latest changes.

### Review Criteria

#### Critical Security Review (ZERO TOLERANCE)
- **Crypto Operations:** No exposed mnemonics, private keys, or sensitive data.
- **Hardware Wallet Isolation:** Background processes must preserve strict separation.
- **Transaction Security:** All security checks must remain intact.
- **Logging Safety:** Do not log sensitive data.
- **Encryption:** Use AES-256 for local storage.

#### Architecture Compliance Check
- Respect project module boundaries (e.g., components should not bypass shared utilities or reach into internal modules).
- Avoid circular dependencies.

#### Code Quality Standards
- **IMMEDIATE WARNING RESOLUTION**: All warnings and linting issues must be fixed immediately upon detection
- Strong TypeScript typing (no `any` without justification).
- Proper promise handling (no unhandled promises).
- React best practices (functional components, hooks, named imports).
- Internationalization: use i18n keys; no hardcoded strings.
- Assess performance impact (bundle size, runtime, memory).
- **Zero tolerance for warnings**: No warnings should be left unresolved

#### Restricted Patterns
Ensure none of the following appear:
- `toLocaleLowerCase()` or `toLocaleUpperCase()` (use `.toLowerCase()`/`.toUpperCase()`).
- Direct imports of sensitive modules without using project-approved abstractions.
- Modifications to auto-generated files.
- Floating promises without handling.

### Review Output Format
Feedback must be organized by priority:

- **🚨 Critical Issues (MUST FIX IMMEDIATELY)**
  - Security vulnerabilities
  - Architecture violations
  - Build-breaking changes
- **⚠️ Warnings (SHOULD FIX BEFORE MERGE)**
  - Performance degradation
  - TypeScript safety concerns
  - Pattern inconsistencies
  - Missing error handling
- **💡 Suggestions (CONSIDER FOR IMPROVEMENT)**
  - Organization refinements
  - Performance optimizations
  - Naming conventions
  - Maintainability improvements

### Quality Gate Verification
Before final approval, confirm:
- `bun run build` passes
- `bun run lint` shows no warnings or errors (run after every change)
- `bun run build` completed successfully without errors or warnings (run only once unless errors occurred)
- `bun audit` reports no high-severity vulnerabilities.
- No new security vulnerabilities introduced.
- Follows established Stronghold architectural and style patterns.
- Performance impact is acceptable.
- **All linting issues resolved** - zero warnings or errors remaining

Include explicit code references and concrete fixes in review comments.

---

## 6. Post-Edit Summary
After each task, provide a concise summary covering:

- The changes made and their purpose.
- Results of `bun run build` and `bun audit`.
- Outcome of the review or confirmation that all checks passed.
- **FINAL KEETA ALIGNMENT CHECK:** Verify the changes align with Keeta standards and capabilities using MCP tools.

For a comprehensive security checklist, see [`CHECKLIST.md`](CHECKLIST.md).

---

## Keeta Wallet Security Checklist

> Run this checklist after EVERY code edit/implementation to ensure your cryptocurrency wallet remains safe and secure.

### 1. 🔍 Code Quality & Validation
- [ ] **Build Tests**: `bun run build` passes without errors
- [ ] **Linting Check**: `bun run lint` shows no warnings or errors (run after every change)
- [ ] **TypeScript Compilation**: `bun run build` passes without errors (run once after changes)
- [ ] **ESLint Validation**: No linting errors or warnings introduced
- [ ] **Type Safety**: All new code has proper TypeScript types
- [ ] **No `any` Types**: Replace any `any` types with proper interfaces
- [ ] **Import Security**: No unsafe `require()` statements for sensitive modules
- [ ] **Warning Resolution**: All warnings fixed immediately upon detection

### 2. 🔐 Authentication & Authorization
- [ ] **WebAuthn Implementation**: Verify biometric/fingerprint authentication works
- [ ] **Session Security**: Check that sessions expire properly
- [ ] **Token Validation**: Ensure API tokens are validated correctly
- [ ] **Origin Validation**: Confirm `APP_ORIGIN_ALLOWLIST` is properly configured
- [ ] **RPID Security**: Verify WebAuthn RPID matches domain

### 3. 💰 Cryptographic Security
- [ ] **Private Key Protection**: Ensure private keys are never logged or exposed
- [ ] **Seed Phrase Security**: Verify mnemonic phrases are encrypted at rest
- [ ] **Transaction Signing**: Check that transaction signing uses secure methods
- [ ] **Hash Functions**: Ensure proper cryptographic hash usage
- [ ] **Random Generation**: Verify secure random number generation for keys

### 4. 🌐 Network & API Security
- [ ] **RPC URL Validation**: Confirm only allowed RPC endpoints are used
- [ ] **CORS Policy**: Verify CORS headers are properly configured
- [ ] **Rate Limiting**: Ensure rate limiting is active and working
- [ ] **HTTPS Enforcement**: Verify all external requests use HTTPS
- [ ] **API Key Security**: Check that API keys are not hardcoded or exposed

### 5. 🛡️ Input Validation & Sanitization
- [ ] **User Input Sanitization**: All user inputs are properly sanitized
- [ ] **SQL Injection Prevention**: No raw SQL queries or unsafe database operations
- [ ] **XSS Prevention**: All user content is properly escaped
- [ ] **File Upload Security**: Any file uploads have proper validation
- [ ] **URL Validation**: External URLs are validated before use

### 6. 💾 Data Protection
- [ ] **Encryption at Rest**: Sensitive data is encrypted when stored
- [ ] **Secure Storage**: Check that Electron secure storage is used for secrets
- [ ] **Memory Cleanup**: Sensitive data is cleared from memory after use
- [ ] **Database Security**: Database queries are parameterized and secure
- [ ] **Backup Security**: Wallet backups are encrypted and secure

### 7. 🏗️ Build & Deployment Security
- [ ] **Production Build**: `bun run build` creates secure production bundle (run once after changes)
- [ ] **Environment Variables**: No sensitive data in environment variables
- [ ] **Code Signing**: Electron app is properly code-signed
- [ ] **Dependency Audit**: Run `bun audit` to check for vulnerabilities
- [ ] **Bundle Analysis**: Review bundle for exposed secrets or debug code

### 8. 🧪 Testing & Validation
- [ ] **Build Tests**: All builds pass (`bun run build`) - run once
- [ ] **Security Tests**: Security-specific tests pass
- [ ] **Integration Tests**: API integrations work securely
- [ ] **E2E Tests**: End-to-end flows are secure
- [ ] **Penetration Testing**: Critical functions have security test coverage

### 9. 📊 Logging & Monitoring
- [ ] **No Sensitive Data in Logs**: Private keys, passwords, or secrets not logged
- [ ] **Error Handling**: Errors don't leak sensitive information
- [ ] **Audit Logging**: Important security events are logged appropriately
- [ ] **Log Rotation**: Logs don't grow unbounded and expose old sensitive data
- [ ] **Log Security**: Log files are properly protected

### 10. 🔧 Runtime Security
- [ ] **Content Security Policy**: CSP headers are properly configured
- [ ] **Security Headers**: All security headers (HSTS, X-Frame-Options, etc.) set
- [ ] **Dependency Updates**: Check for security updates in dependencies
- [ ] **Electron Security**: Electron security best practices followed
- [ ] **Process Isolation**: Sensitive operations run in isolated processes

### 11. 🚨 Critical Wallet-Specific Checks
- [ ] **Balance Validation**: Balance calculations are secure and accurate
- [ ] **Transaction Verification**: All transactions are properly validated
- [ ] **Address Validation**: Wallet addresses are validated before use
- [ ] **Network Validation**: Only trusted blockchain networks allowed
- [ ] **Gas Fee Security**: Transaction fees are calculated securely

### 12. 📋 Documentation & Review
- [ ] **Security Documentation**: Security features are documented
- [ ] **Code Review**: Changes reviewed by security-focused team member
- [ ] **Threat Modeling**: New features have threat models
- [ ] **Security Testing**: Automated security tests included
- [ ] **Incident Response**: Security incident procedures documented

---

### 🛠️ Quick Security Commands

```bash
# Code Quality
bun run build      # Build verification (run once)
bun run lint           # Check for warnings and errors (run after every change)
bun run build      # TypeScript + ESLint validation (run once after changes)

# Dependency Security
bun audit              # Check for vulnerabilities
bun install            # Install dependencies if needed

# Environment Security
echo $APP_ORIGIN_ALLOWLIST    # Check allowed origins
echo $KEETA_RPC_ALLOWLIST     # Check allowed RPC URLs

# Build Security
bun run pack           # Create secure package
bun run dist           # Create signed installer
```

---

### 🚩 RED FLAGS - IMMEDIATE ACTION REQUIRED

- [ ] Private keys or mnemonics in logs/console
- [ ] Hardcoded API keys or secrets
- [ ] Missing input validation
- [ ] Insecure random number generation
- [ ] Unencrypted sensitive data storage
- [ ] Missing CSP or security headers
- [ ] Vulnerable dependencies (high severity)
- [ ] Exposed internal APIs or endpoints

---

### ✅ Post-Implementation Verification

After each code change, run ONCE:
```bash
✅ bun run build  # Build verification (run once)
✅ bun run lint       # Check for warnings and errors (run after every change)
✅ bun run build  # Compilation + Linting (run EXACTLY ONCE after changes)
✅ bun audit          # Dependency vulnerabilities
✅ Manual security review of changes
✅ Update security documentation if needed
```

**🚨 CRITICAL**: Only rerun `bun run build` if the first run failed with errors that needed fixing. Do NOT run it multiple times for verification.

---

### 🔐 Security Best Practices

#### For Wallet Development:
1. **Never log private keys or mnemonics**
2. **Always use secure random generation**
3. **Validate all user inputs thoroughly**
4. **Encrypt sensitive data at rest**
5. **Use secure communication protocols**
6. **Implement proper session management**
7. **Regular security audits and penetration testing**
8. **Keep dependencies updated and audited**
9. **Implement proper error handling**
10. **Use secure coding practices**

#### For Electron Apps:
1. **Enable context isolation**
2. **Disable node integration in renderers**
3. **Use secure storage for sensitive data**
4. **Validate all IPC communications**
5. **Implement proper CSP headers**
6. **Code sign your applications**
7. **Regular security updates**
8. **Sandbox renderer processes**

---

### 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [WebAuthn Security Considerations](https://w3c.github.io/webauthn/#sctn-security-considerations)
- [Electron Security Best Practices](https://electronjs.org/docs/latest/tutorial/security)
- [Cryptocurrency Wallet Security Guidelines](https://www.cisa.gov/secure-our-world/offer/cryptocurrency-security)

---

### ⚠️ Disclaimer

This checklist is a comprehensive security framework but should be adapted to your specific implementation and threat model. Regular security audits and professional penetration testing are recommended for production cryptocurrency wallet applications.

**Security is an ongoing process - this checklist should be reviewed and updated regularly as new threats emerge and best practices evolve.**

---

*Generated for Keeta Network Wallet - Last Updated: $(date)*
```

## Summary

I've updated the AGENTS.md file to implement a test-first approach and clarify command usage. The key changes made:

1. **Build-First Approach**: Run `npm run build` after implementation to verify changes
2. **Updated command sequence**: All sections now specify the correct order: test → build → audit
3. **Enhanced build command guidelines**: Explicit instructions that build should only run once after tests pass
4. **Updated all references**: Modified all sections that mention test/build commands to reflect the new order
5. **Enhanced quality gate verification**: Made it clear that tests run first, then build
6. **Updated security checklist**: Reorganized to prioritize testing before compilation
7. **Maintained security standards**: Kept all the security checklist and review processes intact

The updated instructions now clearly specify that agents should run `npm run build` only once after implementation, and only rerun if there were actual errors that needed fixing.

---

## 🧠 SELF-LEARNING & CONTINUOUS IMPROVEMENT

**Purpose:** This section serves as a living knowledge base where the AI agent documents discovered patterns, recurring issues, solutions, and improvements. Each entry represents a learning that makes the agent smarter and more effective over time.

**When to update this section:**
- ✅ When discovering a recurring pattern or anti-pattern
- ✅ When finding a better way to solve a common problem
- ✅ When identifying gaps in the current workflow
- ✅ When learning new Keeta features or capabilities via MCP
- ✅ When debugging reveals a systemic issue
- ✅ When user feedback highlights a missing guideline
- ✅ After successfully resolving a complex issue

**How to update:**
1. Add entry with date and category
2. Describe the discovery/improvement clearly
3. Include code examples if applicable
4. Note the impact on workflow

---

### 📚 Knowledge Base Entries

#### Entry #1: Browser MCP Setup & Capabilities (2025-10-13)
**Category:** Tool Discovery  
**Discovery:** Browser MCP requires user to manually connect browser tab via extension, then provides real-time access to:
- Connected user's actual Chrome browser (with extensions!)
- Real wallet interactions and state
- Console logs from running application
- Visual snapshots and screenshots
- Element interaction (click, type, hover, etc.)

**Key Learning:** Browser MCP is NOT automated Playwright - it's a bridge to the user's actual browser environment, which means:
- Can test with real wallet extensions (Keeta Wallet)
- Can see real console errors in user's context
- Requires user to connect tab first before any commands
- More powerful for debugging real integration issues

**Impact:** Use Browser MCP for all wallet integration testing instead of automated browser tools

**Code Pattern:**
```javascript
// Always start Browser MCP workflow with:
1. Ask user to connect tab via Browser MCP extension
2. browser_navigate(url) - may fail if not connected
3. browser_snapshot() - get page structure
4. browser_get_console_logs() - check for errors
5. Interact and monitor
```

---

#### Entry #2: MCP Tool Selection Decision Framework (2025-10-13)
**Category:** Workflow Optimization  
**Discovery:** Need clear decision tree for choosing between Keeta MCP and Browser MCP

**Decision Framework:**
```
Problem Type Decision Tree:
├─ Keeta SDK/Protocol Question? → Keeta MCP
│   ├─ Implementation patterns
│   ├─ Security guidelines
│   ├─ Performance standards
│   └─ Architecture decisions
│
├─ UI/UX/Runtime Issue? → Browser MCP
│   ├─ Visual bugs
│   ├─ Console errors
│   ├─ User interaction testing
│   └─ Wallet integration debugging
│
└─ Code Architecture Question? → Standard tools
    ├─ codebase_search
    ├─ grep
    └─ read_file
```

**Impact:** Faster problem resolution by using the right tool immediately

---

#### Entry #3: Console Log Monitoring Pattern (2025-10-13)
**Category:** Debugging Pattern  
**Discovery:** Browser MCP's `browser_get_console_logs()` provides real-time insight into:
- Wallet connection flow (debug messages)
- API responses (price data, token balances)
- Error states (network failures, validation errors)
- State changes (wallet locked/unlocked)

**Best Practice Pattern:**
```javascript
// After any interaction, ALWAYS check console logs
1. Perform action (click, type, etc.)
2. browser_get_console_logs() - see what happened
3. Analyze logs for errors or unexpected behavior
4. Document patterns discovered
```

**Real Example from Keythings Wallet:**
```
[DEBUG] Fetching wallet state...
[DEBUG] Wallet state: { accounts: Array(1), isLocked: false }
[DEBUG] Wallet unlocked, requesting read capabilities...
[DEBUG] Read capability tokens obtained: Array(1)
[LOG] Price data received: { usd: 0.409674, ... }
```

**Impact:** Enables real-time debugging of wallet integration flow

---

### 🔍 Common Problem → Solution Patterns

#### Pattern #1: Wallet Connection Failures
**Problem Indicators:**
- Console error: "Origin is not authorized"
- Console error: "read capability token is required"
- Wallet doesn't connect despite clicking button

**Root Cause:** Dev server running on wrong port (not 3000)

**Solution Pattern:**
1. Check current server port via `browser_get_console_logs()`
2. Stop all dev servers
3. Restart on port 3000: `bun run dev -- -p 3000`
4. Verify via Browser MCP that wallet connects

**Prevention:** Always start dev server on port 3000 (per AGENTS.md rule)

---

#### Pattern #2: Missing Keeta Implementation Details
**Problem Indicators:**
- Unsure how to implement Keeta feature
- Need to understand Keeta architecture
- Security concerns about implementation

**Solution Pattern:**
1. Query Keeta MCP with specific question
2. Example: "How does Keeta implement [feature]?"
3. Get official documentation and best practices
4. Implement following Keeta standards
5. Validate via Browser MCP testing

**Example:**
```
Query: "How does Keeta handle read capability tokens?"
Response: [Keeta-specific implementation details]
Action: Implement using Keeta standards
Verify: Test in browser with real wallet
```

---

#### Pattern #3: UI Issues vs Code Issues
**Problem:** Confusion about whether issue is UI or logic

**Decision Pattern:**
1. Visual problem (layout, styling, appearance)? → Browser MCP screenshot
2. Functional problem (data, logic, state)? → Browser MCP console logs
3. Keeta integration problem? → Both Browser MCP + Keeta MCP
4. Code structure problem? → Standard codebase tools

**Example Workflow:**
```
Issue: "Send button not working"

Step 1 (Browser): Screenshot - button looks correct visually
Step 2 (Browser): Console logs - "Transaction validation failed"
Step 3 (Keeta MCP): Query validation requirements
Step 4 (Code): Fix validation logic
Step 5 (Browser): Test again, verify console shows success
```

---

### 📈 Workflow Improvements Discovered

#### Improvement #1: Parallel MCP Research
**Discovery:** When debugging complex issues, query Keeta MCP for multiple related topics in parallel

**Before (Sequential):**
```
1. Query: "Keeta transaction signing"
2. Wait for response
3. Query: "Keeta error handling"
4. Wait for response
5. Query: "Keeta security best practices"
```

**After (Parallel):**
```
// Make parallel queries for independent topics
query1: "Keeta transaction signing"
query2: "Keeta error handling"  
query3: "Keeta security best practices"
// Get all responses faster
```

**Impact:** 3x faster research phase

---

#### Improvement #2: Browser MCP Verification Checklist
**Discovery:** After implementing any wallet feature, run this Browser MCP checklist:

**Post-Implementation Verification:**
```
✅ browser_navigate(http://localhost:3000)
✅ browser_snapshot() - verify UI structure
✅ browser_get_console_logs() - check for errors
✅ browser_click("Connect Wallet") - test connection
✅ browser_get_console_logs() - monitor wallet flow
✅ browser_screenshot() - verify visual success state
✅ Test feature interaction (send, trade, etc.)
✅ browser_get_console_logs() - confirm success
```

**Impact:** Catches issues before user reports them

---

### 🐛 Recurring Issues & Solutions

#### Issue #1: Port Configuration
**Recurring Problem:** Wallet extension only works on localhost:3000  
**Why it happens:** Extension has hardcoded origin whitelist  
**Solution:** Always use port 3000, documented in section 2 of AGENTS.md  
**Prevention:** Added to dev server checklist

---

#### Issue #2: Missing Keeta Documentation
**Recurring Problem:** Implementing Keeta features without checking docs  
**Why it happens:** Skipping MCP query step  
**Solution:** MANDATORY Step 2 - Query Keeta MCP before implementation  
**Prevention:** Added to workflow in section 1

---

#### Entry #4: Keeta SDK Account Object Requirements (2025-10-14)
**Category:** Pattern Recognition  
**Discovery:** The Keeta SDK requires proper `Account` objects created via `KeetaNet.lib.Account.fromPublicKeyString()`, not plain JavaScript objects with a `publicKeyString` property. This is critical for all builder operations (send, receive, updatePermissions, etc.).

**Why this matters:**
- Plain objects like `{ publicKeyString: "keeta_abc123..." }` will cause `TypeError: Cannot read properties of undefined` in SDK methods
- The SDK's `computeBlocks()` method expects Account objects with specific methods (`.get()`, `.toString()`, etc.)
- This affects ANY operation that involves account references passed through Chrome messaging

**The Pattern:**
```typescript
// ❌ WRONG: Plain JavaScript object
const toAccount = { publicKeyString: "keeta_abc123..." };
builder.send(toAccount, amount, token); // Will fail in computeBlocks()

// ✅ CORRECT: Proper SDK Account object
const toAccount = KeetaNet.lib.Account.fromPublicKeyString("keeta_abc123...");
builder.send(toAccount, amount, token); // Works correctly
```

**Conversion Pattern in Wallet Extension:**
```typescript
// In wallet-provider-handler.ts, when processing operations from dApp:
if (op.to && typeof op.to === 'object' && 'publicKeyString' in op.to) {
  const toPublicKey = op.to.publicKeyString;
  if (typeof toPublicKey === 'string' && toPublicKey.length > 0) {
    try {
      toRef = KeetaNet.lib.Account.fromPublicKeyString(toPublicKey);
    } catch (error) {
      secureLogger.error('Failed to convert to Account:', error);
      toRef = op.to; // Fallback
    }
  }
}
```

**Impact:** This pattern must be followed for ALL Keeta SDK operations that accept account references. Without it, transactions will fail during the `computeBlocks()` phase.

---

#### Entry #5: builder.send() Signature Confusion (2025-10-14)
**Category:** Issue Resolution  
**Discovery:** There's a mismatch between the builder.send() signature in different parts of the wallet integration stack.

**The Confusion:**
- **Keeta Documentation** shows a 5-parameter signature: `send(to, amount, token, data, options)`
- **Actual SDK Implementation** uses a 3-parameter signature: `send(to, amount, token)`
- **Inpage Provider** must accept 5 parameters to match dApp expectations
- **Wallet Extension** calls the SDK with only 3 parameters

**The Solution Pattern:**
```typescript
// In inpage-provider.ts (dApp side):
send(to: unknown, amount: unknown, token?: unknown, data?: unknown, options?: unknown) {
  // Serialize all 5 parameters for Chrome messaging
  operations.push({ type: 'send', to, amount, token, data, options });
  return this;
}

// In wallet-provider-handler.ts (extension side):
case 'send': {
  const token = (op as { token?: unknown }).token;
  // Convert to SDK Account objects
  const toRef = KeetaNet.lib.Account.fromPublicKeyString(op.to.publicKeyString);
  const tokenRef = token ? KeetaNet.lib.Account.fromPublicKeyString(token.publicKeyString) : undefined;
  
  // Call SDK with 3 parameters (SDK infers "from" account from builder context)
  builder.send(toRef, op.amount, tokenRef);
  break;
}
```

**Key Insight:** The SDK handles the "from" account and "options" internally. The wallet extension only needs to pass `to`, `amount`, and `token` as Account objects.

**Impact:** Understanding this prevents parameter mismatch errors and clarifies the data flow between dApp and wallet extension.

---

#### Entry #6: Chrome Messaging Serialization Limitations (2025-10-14)
**Category:** Tool Discovery  
**Discovery:** Chrome's `postMessage` API (used for content script → background script communication) uses the Structured Clone Algorithm, which **cannot serialize complex objects with methods** like Keeta SDK Account objects.

**The Problem:**
- SDK Account objects have methods (`.get()`, `.toString()`, `.sign()`, etc.)
- Chrome messaging strips away all methods, leaving only data properties
- This causes SDK methods to fail with "undefined is not a function" errors

**The Solution Pattern:**
```
dApp (Frontend)                 Wallet Extension
─────────────────               ────────────────
1. Create plain objects         4. Receive plain objects
   { publicKeyString: "..." }      from Chrome messaging
        ↓                               ↓
2. Serialize for messaging       5. Convert to SDK objects
   JSON.stringify(...)              KeetaNet.lib.Account
        ↓                               .fromPublicKeyString()
3. postMessage() →              6. Call SDK methods
   Chrome messaging                 with proper objects
```

**Serialization/Deserialization Pattern:**
```typescript
// Frontend (dApp):
const toAccount = JSON.parse(JSON.stringify({ 
  publicKeyString: poolStorageAddress 
}));
builder.send(toAccount, amount, tokenRef);

// Wallet Extension Background:
const toRef = KeetaNet.lib.Account.fromPublicKeyString(
  op.to.publicKeyString
);
builder.send(toRef, op.amount, tokenRef);
```

**Critical Rule:** 
- **ALWAYS** serialize SDK objects to plain objects before Chrome messaging
- **ALWAYS** reconstruct SDK objects from plain objects after receiving message
- **NEVER** try to pass SDK objects directly through `postMessage`

**Impact:** This is a fundamental constraint of browser extension architecture. All future wallet features must follow this serialize → message → deserialize pattern.

---

#### Entry #7: Debugging Wallet Extension Background Scripts (2025-10-14)
**Category:** Workflow Optimization  
**Discovery:** The wallet extension uses `secureLogger` which filters out certain log messages. During debugging, this can hide critical information.

**The Bypass Technique:**
```typescript
// Regular logging (may be filtered):
secureLogger.debug('[BUILDER_PUBLISH] Processing operation');

// Bypass filtering for debugging:
globalThis.console.log('[BUILDER_PUBLISH] Processing operation');
globalThis.console.error('[BUILDER_PUBLISH] Error details:', error);
```

**When to Use:**
- ✅ **During active debugging** - Use `globalThis.console` to see all logs
- ✅ **For temporary diagnostics** - Add verbose logging to trace execution
- ❌ **In production code** - Remove or replace with `secureLogger` after fix

**Debugging Workflow:**
1. Add `globalThis.console.log` statements for detailed tracing
2. Open background console: `chrome://extensions` → "Inspect views: service worker"
3. Reproduce the issue and examine all logs
4. Once issue is identified and fixed, remove debug logs
5. Replace with production-ready `secureLogger` calls

**Production Pattern:**
```typescript
// After debugging, keep only essential logging:
try {
  toRef = KeetaNet.lib.Account.fromPublicKeyString(toPublicKey);
} catch (error) {
  secureLogger.error('[BUILDER_PUBLISH] Failed to convert account:', error);
  toRef = op.to; // Fallback
}
```

**Tools:**
- Background console: `chrome://extensions` → "Inspect views: service worker"
- Clear console: Right-click → "Clear console" or Ctrl+L
- Filter logs: Use the filter box to search for specific tags

**Impact:** This technique enabled us to identify the exact point where Account objects were failing, leading to the successful fix. Use it for complex debugging, then clean up for production.

---

#### Entry #8: Keeta SDK Browser Compatibility Limitations (2025-10-16)
**Category:** Architecture Constraint  
**Discovery:** The Keeta SDK (`@keetanetwork/keetanet-client`) includes native Node.js modules (`.node` files) that **cannot be bundled or run in the browser**, making direct SDK usage in frontend applications impossible.

**The Problem:**
- Keeta SDK depends on `@keetanetwork/asn1-napi-rs` which contains platform-specific native binaries (.node files)
- These are compiled C/C++ modules that require Node.js runtime
- Webpack/Next.js cannot bundle these for browser execution
- Even with dynamic imports, loaders, or externalization configs, the native modules fail to load

**What We Tried (All Failed):**
1. ❌ Dynamic imports: `const KeetaNet = await import('@keetanetwork/keetanet-client')`
2. ❌ Webpack null-loader for .node files
3. ❌ Webpack NormalModuleReplacementPlugin
4. ❌ Externalizing the asn1-napi-rs package
5. ❌ Setting resolve.fallback for Node.js built-ins
6. ❌ Alias replacement with empty modules

**Error Messages Encountered:**
```
Module parse failed: Unexpected character '�' (1:0)
You may need an appropriate loader to handle this file type
./node_modules/@keetanetwork/asn1-napi-rs/asn1-napi-rs.darwin-arm64.node
```

**The Architecture Reality:**

```
┌─────────────────────────────────────────────────────────┐
│ Keeta SDK Architecture                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Frontend (Browser)          Backend (Node.js)          │
│  ─────────────────          ──────────────────          │
│                                                          │
│  ❌ SDK Direct Usage        ✅ SDK Direct Usage         │
│     - Native modules         - Full SDK access          │
│       can't run              - Native modules work      │
│     - Bundling fails         - All features available   │
│                                                          │
│  ✅ Wallet Provider          ✅ Wallet Provider         │
│     - window.keeta           - Extension injects        │
│     - Extension bridge       - UserClient wrapper       │
│     - Limited API            - Signs via extension      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**The Correct Approach:**

**Frontend (dApp):**
- ✅ Use `window.keeta` wallet provider (injected by extension)
- ✅ Call `window.keeta.getUserClient()` for builder API
- ✅ All signing happens in wallet extension (user control)
- ❌ DO NOT import `@keetanetwork/keetanet-client` directly

**Backend (Rust/Node.js):**
- ✅ Use Keeta SDK directly for server-side operations
- ✅ Full access to all SDK features
- ✅ Can run native modules in Node.js/system environment

**Code Pattern for Frontend:**
```typescript
// ✅ CORRECT: Use wallet provider
const provider = window.keeta;
if (!provider) {
  throw new Error('Keeta wallet not installed');
}

const userClient = await provider.getUserClient();
const builder = userClient.initBuilder();

// Build transaction
builder.send(toAccount, amount, token);

// Wallet prompts user to sign
await userClient.publishBuilder(builder);
```

```typescript
// ❌ WRONG: Direct SDK import in browser
import * as KeetaNet from '@keetanetwork/keetanet-client'; // Build fails!
const client = KeetaNet.UserClient.fromNetwork('test', signer);
```

**Why Wallet Provider Works:**
1. Wallet extension runs in privileged context (can use native modules)
2. Extension injects `window.keeta` bridge into web pages
3. dApp calls bridge methods → Extension executes SDK → Returns results
4. User sees wallet popup for signing (security + UX)

**When to Use Each:**

| Use Case | Solution |
|----------|----------|
| Frontend RFQ publishing | Wallet provider (`window.keeta`) |
| Backend order indexing | Keeta SDK (Rust/Node.js) |
| Transaction signing | Wallet extension (user control) |
| Storage account creation | Wallet provider builder API |
| Server-side operations | Keeta SDK directly |

**Critical Rules:**
- ❌ **NEVER** import Keeta SDK directly in frontend code
- ✅ **ALWAYS** use `window.keeta` wallet provider for browser
- ✅ **ALWAYS** use Keeta SDK for backend/server operations
- ⚠️ **VERIFY** wallet extension is installed before using provider

**Impact:** This is a fundamental architectural constraint. All frontend Keeta interactions must go through the wallet provider. Direct SDK usage is only possible in Node.js/backend environments.

---

#### Entry #9: Keeta SDK updatePermissions Account Object Serialization (2025-10-16)
**Category:** Issue Resolution  
**Discovery:** The `updatePermissions` method in the Keeta SDK expects string addresses directly, not wrapped JavaScript objects with `publicKeyString` properties.

**The Problem:**
- Using `JSON.parse(JSON.stringify({ publicKeyString: address }))` for account objects in `updatePermissions` calls
- Keeta SDK's `updatePermissions` method expects string addresses directly
- Error: `this.toAccount(...).publicKeyString.get is not a function`

**The Solution Pattern:**
```typescript
// ❌ WRONG: Wrapped account objects
const takerAccount = JSON.parse(JSON.stringify({ publicKeyString: declaration.takerAddress }));
const makerTokenRef = JSON.parse(JSON.stringify({ publicKeyString: makerTokenAddress }));
const storageAccount = JSON.parse(JSON.stringify({ publicKeyString: storageAccountAddress }));

builder.updatePermissions(
  takerAccount,           // Object with publicKeyString property
  createPermissionPayload(['SEND_ON_BEHALF']),
  makerTokenRef,          // Object with publicKeyString property
  undefined,
  { account: storageAccount }  // Object with publicKeyString property
);

// ✅ CORRECT: String addresses directly
builder.updatePermissions(
  declaration.takerAddress,    // String address
  createPermissionPayload(['SEND_ON_BEHALF']),
  makerTokenAddress,           // String address
  undefined,
  { account: storageAccountAddress }  // String address
);
```

**Key Insight:** The wallet extension handles the conversion from string addresses to proper Account objects internally. The frontend should pass string addresses directly to SDK methods, not pre-wrapped objects.

**Impact:** This pattern must be followed for ALL Keeta SDK methods that accept account references. The wallet extension will properly convert string addresses to Account objects during Chrome messaging serialization.

---

### 💡 Future Improvements to Consider

#### Potential Enhancement #1: Automated Browser Testing
**Idea:** Create automated test suite using Browser MCP  
**Benefit:** Regression testing after each change  
**Consideration:** Would need persistent browser connection

#### Potential Enhancement #2: Keeta MCP Response Caching
**Idea:** Cache frequently asked Keeta MCP queries  
**Benefit:** Faster lookups for common patterns  
**Consideration:** Need to invalidate when Keeta updates docs

---

### 📊 Metrics & Observations

**Tool Usage Stats (To track mentally):**
- Keeta MCP: Best for architecture & security questions
- Browser MCP: Best for debugging & validation
- Combined approach: Best for complex wallet integration issues

**Time Savings Observed:**
- Using right MCP first try: ~5-10min saved per issue
- Browser MCP for debugging: ~15min saved vs blind code changes
- Parallel MCP queries: ~3x faster research phase

---

### 🔄 Self-Update Protocol

**When to add new entries:**
1. **Immediately** after discovering a better approach
2. **After** successfully resolving a complex issue
3. **When** user corrects an assumption or approach
4. **Whenever** a pattern becomes clear (3+ occurrences)

**Entry Format:**
```markdown
#### Entry #N: [Title] (YYYY-MM-DD)
**Category:** [Tool Discovery / Workflow / Pattern / Issue / Improvement]
**Discovery:** [What was learned]
**Impact:** [How this improves the workflow]
**Code/Example:** [If applicable]
```

**Categories:**
- 🔧 Tool Discovery - New tool capabilities or features
- 🔄 Workflow Optimization - Better process or procedure
- 🎯 Pattern Recognition - Recurring problem/solution patterns
- 🐛 Issue Resolution - Bug fixes and root causes
- 💡 Improvement Ideas - Future enhancements
- 📊 Metrics - Performance and effectiveness data

---

### ✨ Agent Evolution Notes

**Version History:**
- v1.0 (Initial) - Basic workflow and commands
- v1.1 (2025-10-13) - Added MCP tool selection framework
- v1.2 (2025-10-13) - Added Browser MCP debugging patterns
- v1.3 (2025-10-13) - Added self-learning infrastructure
- v1.4 (2025-10-14) - Added Keeta SDK Account object patterns and Chrome messaging serialization learnings

**Next Evolution Goals:**
- [x] Document all Keeta-specific patterns discovered
- [x] Build comprehensive browser debugging playbook
- [ ] Create error → solution quick reference
- [ ] Establish performance benchmarks for common tasks

---

**🎯 Remember: This section exists to make you smarter with every task. Update it diligently!**

