# Security Policy

## Supported versions

Security fixes are provided for the latest tagged release.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub Security Advisories for
this repository. Do not include secrets, API keys, or private Session content
in an issue.

## Security boundary

The Host operation that creates directories is exposed as exact Fetch routes
under DSH's shared `/api` Connection channel, behind its Host/Origin fence and
browser authentication. The workspace root can be configured through the
authenticated settings API. Topic directory names are sanitized and constrained
under the configured root; existing symlinks and path escapes are rejected.
Rollback removes only directories allocated by the current operation when empty.

Native installation is limited to DSH Desktop 0.2.0-rc.2 and checks archive hashes,
paired plugin versions and optional compatibility patches before replacement.
Keep installation backups for restoration. DSH archives, user profiles and model
logs are excluded from this repository and its release assets.
