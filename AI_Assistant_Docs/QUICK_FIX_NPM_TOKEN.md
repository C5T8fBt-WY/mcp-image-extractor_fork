# Quick Fix: Add NPM_TOKEN Secret

## Problem
The CI/CD workflow failed with:
```
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in
```

## Solution
Even with Trusted Publishing (OIDC), GitHub Actions needs an NPM_TOKEN for authentication. Here's how to fix it:

### Step 1: Generate NPM Access Token

1. Login to npm: https://www.npmjs.com/

2. Go to Access Tokens: https://www.npmjs.com/settings/c5t8fbt-wy/tokens

3. Click "Generate New Token" → **"Classic Token"**

4. Select **"Automation"** type (for CI/CD)

5. Copy the token (format: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

   ⚠️ **Save it now** - you won't see it again!

### Step 2: Add Secret to GitHub Repository

#### Option A: Via GitHub CLI (Recommended)

```powershell
# Set the token as an environment variable first (paste your token)
$env:NPM_TOKEN = "npm_your_actual_token_here"

# Add the secret to GitHub
gh secret set NPM_TOKEN --body $env:NPM_TOKEN --repo C5T8fBt-WY/mcp-image-extractor_fork

# Verify it was added
gh secret list --repo C5T8fBt-WY/mcp-image-extractor_fork
```

#### Option B: Via GitHub Web UI

1. Go to: https://github.com/C5T8fBt-WY/mcp-image-extractor_fork/settings/secrets/actions

2. Click "New repository secret"

3. Name: `NPM_TOKEN`

4. Secret: Paste your npm token

5. Click "Add secret"

### Step 3: Re-run the Workflow

After adding the secret:

```powershell
# Trigger the workflow again
gh workflow run publish.yml --repo C5T8fBt-WY/mcp-image-extractor_fork

# Wait a few seconds and check status
Start-Sleep -Seconds 10
gh run list --repo C5T8fBt-WY/mcp-image-extractor_fork --workflow=publish.yml --limit 1
```

Or manually re-run via web:
1. Go to: https://github.com/C5T8fBt-WY/mcp-image-extractor_fork/actions
2. Click on the failed run
3. Click "Re-run failed jobs"

## Why This Is Needed

- **OIDC (Trusted Publishing)** provides provenance attestation
- **NPM_TOKEN** provides authentication to publish

Both work together:
1. NPM_TOKEN authenticates the publish request
2. OIDC adds cryptographic provenance to the package

## Verification

After successful publish, you should see:
```
✓ Published @c5t8fbt-wy/mcp-image-extractor@1.2.1
```

Then verify:
```powershell
npm view @c5t8fbt-wy/mcp-image-extractor
# Should show version 1.2.1
```

## Security Note

The workflow already has the correct setup:
```yaml
permissions:
  id-token: write  # OIDC for provenance
  contents: write  # Git tags/releases
```

With NPM_TOKEN added, the publish will work with both:
- ✅ Authentication (NPM_TOKEN)
- ✅ Provenance (OIDC)

---

**Next Step**: Generate NPM token and add it to GitHub secrets using one of the methods above.
