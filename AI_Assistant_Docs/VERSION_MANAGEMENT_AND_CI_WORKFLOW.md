# Version Management and CI Workflow

## Current Status (as of v1.5.0)

### What Was Accomplished

1. **Feature Implementation**
   - ✅ Added focus feature (`focus_xyxy` and `focal_point` parameters)
   - ✅ Support for both pixel and ratio (0-1) coordinates
   - ✅ Info messages for large images (>300k pixels) without focus
   - ✅ Updated README with comprehensive documentation
   - ✅ All tests passing

2. **Version Management**
   - ✅ Bumped to v1.5.0 (minor version for new features)
   - ✅ Fixed CI workflow to prevent version conflicts
   - ✅ Added `[skip ci]` detection in workflow
   - ✅ Added manual version bump detection

3. **CI/CD Fixes**
   - ✅ CI now skips when commit contains `[skip ci]`
   - ✅ CI detects manual version bumps and doesn't auto-increment
   - ✅ Updated `.gitignore` to exclude `coverage/` directory

## Git History Issue (What Happened)

### The Problem
- Manual `npm version minor` created tags: v1.3.0, v1.4.0
- CI auto-bumped patches: v1.2.7, v1.2.8, v1.2.9, v1.2.10
- This created conflicting version tags

### The Root Causes
1. **CI only did PATCH increments**: Hardcoded to increment patch version only
2. **Merge commits broke tag detection**: HEAD moved away from tagged commits
3. **No [skip ci] support**: GitHub Actions doesn't auto-skip like older CI systems

### The Solution
1. Added explicit `[skip ci]` check:
   ```yaml
   if: "!contains(github.event.head_commit.message, '[skip ci]')"
   ```

2. Added manual version bump detection:
   ```bash
   if git log -1 --pretty=%B | grep -qE '^(1\.[0-9]+\.[0-9]+|chore.*version|[0-9]+\.[0-9]+\.[0-9]+)$'; then
     echo "Manual version bump detected, skipping CI version bump"
   ```

3. Reset to v1.5.0 as clean baseline

## Going Forward: Simple Workflow

### For PATCH Releases (Bug Fixes)
Just push to main → CI auto-bumps patch version:
```bash
git add .
git commit -m "fix: description of bug fix"
git push origin main
# CI will auto-bump from 1.5.0 → 1.5.1
```

### For MINOR Releases (New Features)
Use `npm version minor` with `[skip ci]`:
```bash
npm version minor -m "chore: bump to %s [skip ci]"
git push origin main --follow-tags
# Manual bump from 1.5.0 → 1.6.0, CI won't interfere
```

### For MAJOR Releases (Breaking Changes)
Use `npm version major` with `[skip ci]`:
```bash
npm version major -m "chore: bump to %s [skip ci]"
git push origin main --follow-tags
# Manual bump from 1.5.0 → 2.0.0, CI won't interfere
```

## Current Repository State

- **Version**: 1.5.0
- **Tag**: v1.5.0 (at HEAD)
- **Branch**: main
- **Package**: `@c5t8fbt-wy/mcp-image-extractor`
- **Status**: ✅ Production ready

## CI Workflow Behavior

### When CI Runs
- On push to `main` branch
- Excludes: `**/*.md`, `docs/**`
- Unless: commit contains `[skip ci]`

### What CI Does
1. **Check if HEAD is tagged**
   - If yes → Skip version bump, publish existing version
   - If no → Continue to next check

2. **Check for manual version bump**
   - Pattern match: version numbers, "chore...version"
   - If match → Skip version bump
   - If no match → Continue to auto-bump

3. **Auto-bump (if not skipped)**
   - Increment PATCH version (e.g., 1.5.0 → 1.5.1)
   - Create tag
   - Push to GitHub
   - Publish to npm

## NPM Package

The package `@c5t8fbt-wy/mcp-image-extractor` will be published automatically by CI when:
- A new version tag is pushed (manual workflow)
- CI creates a new patch version (automatic workflow)

## Recommendations

1. **For most commits**: Just push normally, let CI handle patch versioning
2. **For features**: Use `npm version minor -m "chore: bump to %s [skip ci]"`
3. **For breaking changes**: Use `npm version major -m "chore: bump to %s [skip ci]"`
4. **Always include**: Descriptive commit messages following conventional commits
5. **Before pushing**: Run `npm test` and `npm run build` to verify

## Files Modified

- `src/image-utils.ts` - Focus feature implementation
- `src/index.ts` - Tool definitions with focus parameters
- `README.md` - Documentation updates
- `.github/workflows/publish.yml` - CI workflow fixes
- `.gitignore` - Added coverage exclusion
- `package.json` - Version 1.5.0
- `package-lock.json` - Version sync

## Next Steps

The version management workflow is now stable. Future development should follow the simple workflow outlined above. The one-time cleanup is complete.
