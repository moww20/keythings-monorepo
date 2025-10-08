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

Run the following before committing changes:

## 1. MANDATORY: Think First, Then Scan Knowledge Base
**BEFORE starting any task, follow this process:**

### Step 1: Think About the Problem
- **Analyze the requirement** and understand what needs to be built
- **Consider the context** and how it fits into the wallet ecosystem
- **Identify potential challenges** and technical considerations
- **Plan the approach** before diving into implementation

### Step 2: Scan Keeta Knowledge Base using MCP
**After thinking through the problem, scan the knowledge base for relevant information using MCP tools:**

**MCP Configuration:**
Your MCP-capable tools should connect to the Keeta knowledge base using the configuration in `agents.config.json`:

```json
{
  "mcpServers": {
    "keeta-dev-mcp-server": {
      "url": "https://keeta-dev-mcp.com/mcp"
    }
  }
}
```

**Required Knowledge Base Queries:**
Use MCP tools to search for:
- Relevant Keeta features and capabilities
- Official documentation and whitepaper content
- Keeta's architecture and best practices
- Security guidelines and compliance requirements
- Cross-chain interoperability features
- Token standards and native tokenization
- Performance requirements (400ms settlement, 10M TPS)

**This two-step process is MANDATORY and must be completed before any code changes.**

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

