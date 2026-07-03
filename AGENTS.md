<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Versioning

The app version lives in `package.json` `version` and is shown in the nav (AppNav reads it directly). Semver: major.minor.patch.

On every push, bump the version first based on what the push contains: patch for fixes and small tweaks, minor for new features or schema additions, major only with explicit direction or permission from Jacob — never advance the major version on your own.
