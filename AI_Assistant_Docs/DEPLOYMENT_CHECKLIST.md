# Deployment Checklist: @c5t8fbt-wy/mcp-image-extractor

## Pre-Publishing Verification

### ✅ Code Changes Complete
- [x] Increased MAX_IMAGE_SIZE from 10MB to 50MB
- [x] Added environment variable support for dimensions (DEFAULT_MAX_WIDTH, DEFAULT_MAX_HEIGHT)
- [x] Added environment variable support for compression (COMPRESSION_QUALITY, PNG_COMPRESSION_LEVEL)
- [x] Updated package.json with scoped name `@c5t8fbt-wy/mcp-image-extractor`
- [x] Updated package.json version to 1.2.0
- [x] Added publishConfig for npm public access

### ✅ Documentation Complete
- [x] Updated README.md with comprehensive configuration guide
- [x] Created AI_Assistant_Docs/NPM_PUBLISHING_SETUP.md
- [x] Created AI_Assistant_Docs/FORK_DIFFERENCES.md
- [x] Created AI_Assistant_Docs/CONFIGURABLE_IMAGE_SETTINGS.md
- [x] Created AI_Assistant_Docs/FIX_MAX_CONTENT_LENGTH_ERROR.md
- [x] Created AI_Assistant_Docs/IMAGE_FLOW_THROUGH_MODEL.md

### ✅ Build Verification
- [x] Dependencies installed (594 packages)
- [x] TypeScript compilation successful
- [x] dist/index.js created
- [x] dist/image-utils.js created
- [x] Executable permissions set on dist/index.js

### ✅ GitHub Workflow
- [x] .github/workflows/publish.yml created and enhanced
- [x] Workflow triggers: workflow_dispatch, release, push to main
- [x] Auto-tagging configured
- [x] GitHub release creation configured
- [x] NPM publishing with provenance configured

---

## Publishing Steps

### Step 1: NPM Account Setup (One-Time)

**Status**: ⏳ Pending User Action

1. **Create NPM Account** (if you don't have one):
   - Go to: https://www.npmjs.com/signup
   - Username: `c5t8fbt-wy` (recommended) or your preferred username
   - Verify email address

2. **Enable 2FA** (Required for Trusted Publishing):
   - Go to: https://www.npmjs.com/settings/YOUR_USERNAME/tfa
   - Select: "Authorization and Publishing" or "Authorization only"
   - Follow authenticator app setup
   - **Save backup codes**

**Note**: With Trusted Publishing (OIDC), you don't need to generate manual NPM tokens! GitHub Actions will authenticate automatically using OIDC tokens.

### Step 2: Verify GitHub Workflow (Already Configured)

**Status**: ✅ Complete

The workflow is already configured for Trusted Publishing:
- ✅ `permissions: id-token: write` enables OIDC
- ✅ `--provenance` flag for cryptographic attestation
- ✅ Node 20.x with provenance support

**No GitHub secrets needed for basic operation!**

Optional: Add `NPM_TOKEN` as fallback (see [TRUSTED_PUBLISHING_SETUP.md](TRUSTED_PUBLISHING_SETUP.md))

### Step 3: Publish to NPM (Choose One Method)

**Status**: ⏳ Pending User Action

#### Option A: Automatic via Git Push (Recommended)
```powershell
cd c:\Users\Astrsk\Documents\GitHub\mcp-image-extractor_fork

# Commit all changes
git add .
git commit -m "chore(release): v1.2.0 - Enhanced fork with configurable settings"

# Push to main branch (triggers workflow)
git push origin main
```

#### Option B: Manual Workflow Trigger
1. Go to: https://github.com/C5T8fBt-WY/mcp-image-extractor_fork/actions/workflows/publish.yml
2. Click: "Run workflow" dropdown
3. Select: Branch "main"
4. Click: "Run workflow" button

#### Option C: Create GitHub Release
1. Go to: https://github.com/C5T8fBt-WY/mcp-image-extractor_fork/releases/new
2. Tag version: `v1.2.0`
3. Release title: `Release v1.2.0`
4. Description: `Enhanced fork with configurable image processing settings`
5. Click: "Publish release"

#### Option D: Manual Local Publish
```powershell
cd c:\Users\Astrsk\Documents\GitHub\mcp-image-extractor_fork

# Login to npm (first time only)
npm login
# Enter: username, password, email, OTP (if enabled)

# Build the package
npm run build

# Publish
npm publish --access public
```

### Step 4: Verify Publication

**Status**: ⏳ Pending User Action

1. **Check NPM Registry** (wait 2-5 minutes after publish):
   - Visit: https://www.npmjs.com/package/@c5t8fbt-wy/mcp-image-extractor
   - Expected: Version 1.2.0 listed
   - Expected: "public" package status

2. **Check GitHub Release** (if using Option A/B/C):
   - Visit: https://github.com/C5T8fBt-WY/mcp-image-extractor_fork/releases
   - Expected: Release v1.2.0 with auto-generated notes

3. **Test Installation**:
   ```powershell
   # Test npx execution
   npx -y @c5t8fbt-wy/mcp-image-extractor@latest
   
   # Expected output: MCP server starting message or help text
   ```

### Step 5: Update MCP Configuration

**Status**: ⏳ Pending User Action

Update your MCP client configuration (e.g., `claude_desktop_config.json` or Cursor MCP settings):

```json
{
  "mcpServers": {
    "image-extractor": {
      "command": "npx",
      "args": [
        "-y",
        "@c5t8fbt-wy/mcp-image-extractor@latest"
      ],
      "env": {
        "DEFAULT_MAX_WIDTH": "768",
        "DEFAULT_MAX_HEIGHT": "768",
        "COMPRESSION_QUALITY": "80",
        "MAX_IMAGE_SIZE": "52428800"
      }
    }
  }
}
```

**Restart your MCP client** after updating configuration.

### Step 6: Test in Production

**Status**: ⏳ Pending User Action

Test the published package with real images:

1. **Test Basic Image**:
   - Ask Claude/Cursor: "Extract this image: https://example.com/small-image.png"
   - Expected: Base64 data returned successfully

2. **Test Large Image** (verify 50MB limit works):
   - Ask: "Extract this image: https://example.com/30MB-image.png"
   - Expected: Downloads and processes successfully (vs original's 10MB limit error)

3. **Test Configuration** (verify env vars work):
   - Modify env vars in MCP config
   - Restart MCP client
   - Extract same image
   - Expected: Different output size based on settings

---

## Troubleshooting

### "403 Forbidden - You must be logged in to publish packages"
**Cause**: npm account not properly linked to GitHub OIDC  
**Fix**: 
1. Verify npm account email is verified
2. Enable 2FA on npm account
3. Try publishing again (workflow will authenticate via OIDC)

### "403 Forbidden - You do not have permission to publish"
**Cause**: First-time publish, npm doesn't recognize GitHub identity  
**Fix**: 
1. Login to npmjs.com
2. Verify email address
3. Enable 2FA (required for provenance)
4. Try publishing again - npm will auto-link GitHub OIDC on first successful publish

### "Package not found" After Publishing
**Cause**: NPM registry cache delay  
**Fix**: Wait 2-5 minutes, then try again

### "Version 1.2.0 already published"
**Cause**: Attempting to publish same version twice  
**Fix**: Update version in package.json:
```powershell
cd c:\Users\Astrsk\Documents\GitHub\mcp-image-extractor_fork
npm version patch  # Changes to 1.2.1
git push origin main
```

### GitHub Workflow Fails
**Cause**: Check Actions tab for specific error  
**Fix**: Visit https://github.com/C5T8fBt-WY/mcp-image-extractor_fork/actions and review logs

---

## Success Criteria

All items must be checked before considering deployment complete:

- [ ] NPM account created and verified
- [ ] 2FA enabled on npm account (required for trusted publishing)
- [ ] Package published to npm registry (v1.2.0) with provenance
- [ ] GitHub release created (v1.2.0)
- [ ] Package visible at https://www.npmjs.com/package/@c5t8fbt-wy/mcp-image-extractor
- [ ] Provenance badge visible on npm package page
- [ ] `npx @c5t8fbt-wy/mcp-image-extractor@latest` runs successfully
- [ ] MCP configuration updated with new package name
- [ ] MCP client restarted
- [ ] Test image extraction works
- [ ] Environment variables functional
- [ ] Documentation reviewed and accurate

---

## Post-Publishing Tasks

### Optional Enhancements

- [ ] Add package to Smithery registry: https://smithery.ai/
- [ ] Create npm badge for README: `[![npm version](https://img.shields.io/npm/v/@c5t8fbt-wy/mcp-image-extractor.svg)](https://www.npmjs.com/package/@c5t8fbt-wy/mcp-image-extractor)`
- [ ] Add download stats badge: `[![npm downloads](https://img.shields.io/npm/dm/@c5t8fbt-wy/mcp-image-extractor.svg)](https://www.npmjs.com/package/@c5t8fbt-wy/mcp-image-extractor)`
- [ ] Enable GitHub Discussions for community support
- [ ] Create CHANGELOG.md for version history
- [ ] Add CI badge to README showing build status

### Future Versions

When publishing updates:

```powershell
cd c:\Users\Astrsk\Documents\GitHub\mcp-image-extractor_fork

# For bug fixes
npm version patch  # 1.2.0 → 1.2.1

# For new features
npm version minor  # 1.2.0 → 1.3.0

# For breaking changes
npm version major  # 1.2.0 → 2.0.0

# Push changes (triggers auto-publish)
git push origin main --follow-tags
```

---

## Current Status Summary

✅ **Completed**:
- Code enhancements (50MB limit, env vars)
- Package configuration (@c5t8fbt-wy/mcp-image-extractor)
- TypeScript build successful
- GitHub Actions workflow configured
- Comprehensive documentation created

⏳ **Pending User Action**:
1. Create NPM account (if needed) / Enable 2FA
2. Choose publishing method and execute (push to main / manual workflow / release)
3. Monitor GitHub Actions workflow for success
4. Verify publication on npmjs.com (check for provenance badge)
5. Update MCP client configuration
6. Test in production

🎯 **Next Immediate Step**: 
**Enable 2FA on npm account** → Then push to main or trigger workflow → See Step 1 & 3 above

---

**Package Name**: `@c5t8fbt-wy/mcp-image-extractor`  
**Version**: 1.2.0  
**Repository**: https://github.com/C5T8fBt-WY/mcp-image-extractor_fork  
**NPM URL** (after publish): https://www.npmjs.com/package/@c5t8fbt-wy/mcp-image-extractor  

**Last Updated**: 2025-01-XX  
**Prepared By**: GitHub Copilot (Claude Sonnet 4.5)
