# Security policy

## Supported versions

Only the latest version published on npm is supported. There are no fixes for older versions, so update to the latest before reporting an issue.

| Version | Supported |
| --- | --- |
| latest | yes |
| older | no |

## Reporting a vulnerability

If you find a vulnerability, don't open a public issue. Use [GitHub Security Advisories](https://github.com/dukxa/goo-button/security/advisories/new) for this repo instead. It's a private channel only the author can see.

Include in your report:

- what the vulnerability is and how to reproduce it,
- which version is affected,
- the impact (for example, a CSP bypass or an injection through an attribute).

## What to expect

This is a solo project worked on in spare time, so there's no fixed SLA, but I'll respond as fast as I can, usually within a few days. If the vulnerability checks out, I'll ship a fix and credit you in the release notes unless you'd rather I didn't.

## What isn't a vulnerability

The documented limitations in `docs/usage.md#limits` (the drop not mirroring for RTL, not reserving space for it, and so on) are intentional and aren't security issues.
