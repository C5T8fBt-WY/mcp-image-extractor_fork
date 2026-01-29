# NPM Trusted Publishing Setup

## What is Trusted Publishing?

Trusted Publishing (Provenance) is npm's modern authentication method that uses **GitHub's OIDC tokens** instead of long-lived npm access tokens. It's more secure because:

✅ No secrets stored in GitHub repository  
✅ Short-lived tokens generated per-workflow  
✅ Automatic cryptographic verification  
✅ Transparent supply chain (provenance attestation)  

## How It Works

```
GitHub Actions Workflow
  ↓
  permissions: id-token: write  ← Enables OIDC token generation
  ↓
  npm publish --provenance  ← Uses GitHub OIDC token
  ↓
  npm Registry verifies GitHub identity
  ↓
  Package published with provenance badge
```

## Setup Steps

### Option 1: Pure Trusted Publishing (Recommended)

This fork already has the workflow configured correctly with:
- ✅ `permissions: id-token: write` in workflow
- ✅ `--provenance` flag in publish command
- ✅ Node 20.x (provenance support)

**No NPM_TOKEN needed!** GitHub automatically provides authentication via OIDC.

#### Setup on npmjs.com:

1. **Login to npm**: https://www.npmjs.com/

2. **Enable 2FA** (required for provenance):
   - Go to: https://www.npmjs.com/settings/YOUR_USERNAME/tfa
   - Choose "Authorization and Publishing" or "Authorization only"
   - Follow setup instructions

3. **Configure Trusted Publishing** (if package doesn't exist yet):
   - The first `npm publish --provenance` from GitHub Actions will automatically configure it
   - npm will recognize the GitHub OIDC token and link it to your account

4. **Verify Package Ownership**:
   - After first publish, check: https://www.npmjs.com/package/@c5t8fbt-wy/mcp-image-extractor
   - You should see a "Provenance" badge

### Option 2: Hybrid (Trusted Publishing + NPM Token Fallback)

If you want a backup authentication method, also configure NPM_TOKEN:

1. Generate **Automation Token** at https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Add to GitHub Secrets: https://github.com/C5T8fBt-WY/mcp-image-extractor_fork/settings/secrets/actions
   - Name: `NPM_TOKEN`
   - Secret: Your token

Workflow will try OIDC first, fall back to NPM_TOKEN if OIDC fails.

## First Publish Process

### Method 1: Via Git Push (Automatic)

```powershell
cd c:\Users\Astrsk\Documents\GitHub\mcp-image-extractor_fork

# Ensure you're logged into GitHub CLI
gh auth status

# Commit and push
git add .
git commit -m "chore(release): v1.2.0"
git push origin main
```

**What happens:**
1. GitHub Actions workflow triggers
2. Builds package (`npm ci && npm run build`)
3. Generates OIDC token (because `permissions: id-token: write`)
4. Runs `npm publish --provenance --access public`
5. npm verifies GitHub identity via OIDC
6. Package published with provenance attestation

### Method 2: Manual Workflow Trigger

1. Go to: https://github.com/C5T8fBt-WY/mcp-image-extractor_fork/actions/workflows/publish.yml
2. Click "Run workflow"
3. Select branch "main"
4. Click "Run workflow"

Same OIDC authentication process as Method 1.

## Verification

After publishing, check for provenance:

```powershell
# Check package metadata
npm view @c5t8fbt-wy/mcp-image-extractor

# Verify provenance attestation
npm view @c5t8fbt-wy/mcp-image-extractor attestations
```

Expected output:
```
provenance: {
  buildType: 'https://actions.github.io/buildtypes/workflow/v1',
  builder: { id: 'https://github.com/actions/runner/...' },
  invocation: { ... },
  materials: [ { uri: 'git+https://github.com/C5T8fBt-WY/mcp-image-extractor_fork@...' } ]
}
```

## Why Classic Tokens Are Deprecated

| Classic Token | Trusted Publishing (OIDC) |
|---------------|---------------------------|
| ❌ Long-lived (never expires) | ✅ Short-lived (minutes) |
| ❌ Stored as secret | ✅ Generated per-workflow |
| ❌ Manual rotation needed | ✅ Auto-rotated |
| ❌ No audit trail | ✅ Full GitHub audit log |
| ❌ No provenance | ✅ Cryptographic attestation |
| ❌ If leaked, full account access | ✅ If leaked, already expired |

## Troubleshooting

### "npm ERR! code EOTP" (One-Time Password required)

**Cause**: 2FA enabled but OIDC not working  
**Fix**: 
1. Ensure `permissions: id-token: write` in workflow ✅ (already set)
2. Check Node version is 20+ ✅ (already 20.x)
3. Verify npm version supports provenance: `npm --version` (should be 9.5.0+)

### "npm ERR! 403 You do not have permission to publish"

**Cause**: First-time publish, npm doesn't recognize GitHub identity  
**Fix**: 
1. Login to npmjs.com
2. Verify email address
3. Enable 2FA
4. Try publishing again

### "npm ERR! code E404 - Package not found"

**Cause**: Scoped package `@c5t8fbt-wy/mcp-image-extractor` doesn't exist yet  
**Fix**: This is normal for first publish. npm will create it automatically.

### Provenance Badge Not Showing

**Cause**: Published without `--provenance` flag or wrong permissions  
**Fix**: Verify workflow has:
```yaml
permissions:
  id-token: write  # ← Critical for OIDC
  contents: write  # ← For creating releases
```

## Current Workflow Configuration

✅ **Permissions configured**:
```yaml
permissions:
  contents: write  # Git tags and releases
  id-token: write  # OIDC token for provenance
```

✅ **Publish command**:
```yaml
run: npm publish --provenance --access public
```

✅ **Node version**: 20.x (supports provenance)

✅ **Fallback**: NPM_TOKEN in env (optional)

## Comparison with Original Workflow

| Feature | Original | This Fork |
|---------|----------|-----------|
| Authentication | NPM_TOKEN required | **OIDC (trusted publishing)** |
| Security | Medium (token-based) | **High (OIDC + provenance)** |
| Token Management | Manual rotation | **Automatic** |
| Provenance | ❌ No | ✅ **Yes** |
| Supply Chain | Not verified | **Cryptographically verified** |
| Node Version | 18.x | **20.x** |

## Best Practices

1. ✅ **Enable 2FA on npm account** (required for provenance)
2. ✅ **Use workflow_dispatch for testing** (manual trigger)
3. ✅ **Verify provenance after first publish** (`npm view ... attestations`)
4. ✅ **Monitor GitHub Actions logs** for publish confirmation
5. ⚠️ **Don't commit .npmrc files** (tokens could leak)

## Next Steps

1. **Verify npm account has 2FA enabled**
2. **Push commit with `chore(release)` message** or trigger workflow manually
3. **Monitor workflow**: https://github.com/C5T8fBt-WY/mcp-image-extractor_fork/actions
4. **Verify package published**: https://www.npmjs.com/package/@c5t8fbt-wy/mcp-image-extractor
5. **Check provenance badge appears on package page**

---

**Key Takeaway**: This fork uses modern **Trusted Publishing (OIDC)** which is more secure than classic tokens. No manual token management needed - GitHub automatically authenticates via OIDC when publishing from Actions.

**Last Updated**: 2025-01-XX  
**Authentication Method**: GitHub OIDC (Trusted Publishing)  
**Token Management**: Automatic (no manual secrets required)
