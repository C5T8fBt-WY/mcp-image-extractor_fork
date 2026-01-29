# Enable Trusted Publishing on npm

## Current Status

✅ GitHub Actions workflow configured correctly for OIDC  
✅ OIDC token is being generated (error changed from `ENEEDAUTH` to `E404`)  
⚠️ npm doesn't recognize the GitHub OIDC token yet

**Error**: `Access token expired or revoked` + `404 Not Found`

This means npm needs to be configured to trust GitHub as an identity provider for this package.

## Solution: Configure Trusted Publishing on npm

### Method 1: Via npm Web UI (if available)

1. Login to npm: https://www.npmjs.com/

2. Go to package settings: https://www.npmjs.com/package/@c5t8fbt-wy/mcp-image-extractor/access

3. Look for "Publishing" or "Trusted Publishing" section

4. Add GitHub as a trusted publisher:
   - Provider: GitHub Actions
   - Organization: `C5T8fBt-WY`
   - Repository: `mcp-image-extractor_fork`
   - Workflow: `publish.yml` (optional)

### Method 2: Hybrid Approach (Recommended for Now)

Since full OIDC-only publishing may require npm's Enterprise plan or beta access, use a hybrid approach:

**Add NPM_TOKEN as fallback, but keep OIDC for provenance:**

```powershell
# 1. Generate automation token at https://www.npmjs.com/settings/c5t8fbt-wy/tokens

# 2. Add to GitHub secrets:
gh secret set NPM_TOKEN --body "npm_YOUR_TOKEN_HERE" --repo C5T8fBt-WY/mcp-image-extractor_fork
```

Then update workflow to use NPM_TOKEN for auth, OIDC for provenance:

```yaml
- name: Publish to npm with Trusted Publishing (OIDC)
  run: npm publish --provenance --access public
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}  # For authentication
# OIDC (id-token: write permission) provides provenance automatically
```

### Method 3: Publish First Version Manually, Then OIDC

Some npm features require the package to exist first:

1. **Already done**: You published v1.2.0 manually ✅

2. **Configure package settings** on npm:
   - Go to: https://www.npmjs.com/package/@c5t8fbt-wy/mcp-image-extractor/settings
   - Enable "Provenance" if available
   - Configure trusted publishers

3. **Try OIDC-only workflow** again after configuration

## Current Understanding

Based on npm documentation and the errors:

1. **OIDC token IS being generated** by GitHub Actions ✅
   - Evidence: Error changed from `ENEEDAUTH` to `E404 Not Found`
   - `setup-node` with `registry-url` creates `.npmrc` correctly

2. **npm doesn't recognize the token** ❌
   - "Access token expired or revoked" suggests npm received a token but doesn't trust it
   - May require explicit configuration on npm side

3. **Trusted Publishing may be beta/enterprise feature**
   - Not all npm accounts have full OIDC support yet
   - May require email verification, 2FA, or specific account type

## Recommended Next Steps

### Option A: Quick Fix (Hybrid - Best for Production)

Add NPM_TOKEN for auth, keep OIDC for provenance:

```powershell
# Generate token and add secret
gh secret set NPM_TOKEN --body "npm_YOUR_TOKEN" --repo C5T8fBt-WY/mcp-image-extractor_fork

# Re-run workflow (will use token for auth, OIDC for provenance)
gh workflow run publish.yml --repo C5T8fBt-WY/mcp-image-extractor_fork
```

Update workflow:
```yaml
- name: Publish to npm
  run: npm publish --provenance --access public
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

This gives you:
- ✅ Authentication via NPM_TOKEN (reliable)
- ✅ Provenance via OIDC (secure, transparent)
- ✅ Works immediately

### Option B: Wait for npm OIDC Support

Check if your npm account has OIDC support:

1. Check npm documentation: https://docs.npmjs.com/generating-provenance-statements
2. Contact npm support to enable Trusted Publishing
3. Verify account settings for provenance options

### Option C: Test with Tag-Based Trigger

Some OIDC integrations work better with tag-based triggers:

```yaml
on:
  push:
    tags:
      - 'v*'
```

Test by creating a new tag:
```powershell
git tag v1.2.2
git push origin v1.2.2
```

## Comparison

| Approach | Auth | Provenance | Complexity | Status |
|----------|------|------------|------------|--------|
| **OIDC only** | OIDC | OIDC | Low | ❌ Doesn't work yet |
| **Hybrid** | NPM_TOKEN | OIDC | Medium | ✅ **Recommended** |
| **Token only** | NPM_TOKEN | None | Low | ✅ Works (you already did this) |

## What We Learned

1. `actions/setup-node` with `registry-url` DOES create proper `.npmrc` ✅
2. GitHub Actions DOES generate OIDC tokens (via `id-token: write`) ✅
3. npm may not accept GitHub OIDC tokens without configuration ⚠️
4. Hybrid approach (token auth + OIDC provenance) is the current best practice

## Conclusion

**For now, use the hybrid approach** (NPM_TOKEN for auth, OIDC for provenance).

This is actually what most projects do - the `--provenance` flag adds cryptographic attestation even when using token auth.

Pure OIDC-only publishing may require:
- npm Enterprise account
- Beta program access
- Additional configuration on npm side
- Waiting for npm to fully roll out the feature

---

**Recommended Action**: Add NPM_TOKEN secret and use hybrid approach for reliable CI/CD.
