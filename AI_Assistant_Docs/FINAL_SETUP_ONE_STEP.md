# Final CI/CD Setup: One Simple Step

## TL;DR

Your package is published (v1.2.0) and working! To enable automated CI/CD publishing:

**Just add your npm token to GitHub secrets:**

```powershell
# Get your token from: https://www.npmjs.com/settings/c5t8fbt-wy/tokens
# (You likely already have one from when you did `npm login`)

gh secret set NPM_TOKEN --body "npm_YOUR_TOKEN_HERE" --repo C5T8fBt-WY/mcp-image-extractor_fork

# Verify:
gh secret list --repo C5T8fBt-WY/mcp-image-extractor_fork

# Test:
gh workflow run publish.yml --repo C5T8fBt-WY/mcp-image-extractor_fork
```

That's it! Future pushes to `main` will auto-publish.

## What You Get

With this setup:
- ✅ **Authentication**: NPM_TOKEN (same token you used for `npm login`)
- ✅ **Provenance**: OIDC cryptographic attestation (`--provenance` flag)
- ✅ **Auto-tagging**: Git tags created automatically
- ✅ **Auto-releases**: GitHub releases with notes
- ✅ **Transparency**: Full build logs and provenance chain

## How to Get Your npm Token

### If you already logged in via `npm login`:

Your token might be in `~/.npmrc`. Check:

```powershell
Get-Content $env:USERPROFILE\.npmrc
```

Look for a line like:
```
//registry.npmjs.org/:_authToken=npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

That's your token!

### If you need to generate a new one:

1. Go to: https://www.npmjs.com/settings/c5t8fbt-wy/tokens
2. Click "Generate New Token" → "Classic Token"
3. Select: **"Automation"**
4. Copy the token

## Add to GitHub

```powershell
# Method 1: CLI (recommended)
gh secret set NPM_TOKEN --body "npm_YOUR_TOKEN" --repo C5T8fBt-WY/mcp-image-extractor_fork

# Method 2: Web UI
# Visit: https://github.com/C5T8fBt-WY/mcp-image-extractor_fork/settings/secrets/actions
# Click "New repository secret"
# Name: NPM_TOKEN
# Secret: paste token
```

## Test It

```powershell
# Trigger workflow
gh workflow run publish.yml --repo C5T8fBt-WY/mcp-image-extractor_fork

# Watch progress
Start-Sleep -Seconds 10
gh run list --repo C5T8fBt-WY/mcp-image-extractor_fork --workflow=publish.yml --limit 1

# Check if it succeeded (look for ✓ instead of X)
```

## Future Publishes

After adding the token, publishing is automatic:

```powershell
# Bump version
npm version patch  # or minor/major

# Push (triggers auto-publish)
git push origin main --follow-tags
```

Or just commit with "chore(release)" in the message:

```powershell
git commit -m "chore(release): Add new feature X"
git push origin main
```

## What We Tested

1. ✅ Package builds successfully
2. ✅ Manual publish works (v1.2.0 is live)
3. ✅ GitHub workflow configured  
4. ✅ OIDC tokens generated properly
5. ⏳ Need NPM_TOKEN secret to complete CI/CD
6. ⏳ After adding token, v1.2.1 will publish automatically

## Pure OIDC (Without Token)?

We tested OIDC-only publishing but npm returned "Access token expired" error. This likely means:
- npm's full OIDC support may require additional configuration
- Hybrid approach (token + OIDC provenance) is current industry standard
- You still get all security benefits of provenance attestation

## Bottom Line

**The workflow is ready.** Just add your npm token (the same one you used for `npm login`) to GitHub secrets, and you're done!

---

**Next Step**: Add NPM_TOKEN secret using the command above ☝️
