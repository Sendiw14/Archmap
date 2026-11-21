# Security policy

Report vulnerabilities privately via GitHub Security Advisories on this repository ("Report a vulnerability"). Do not open public issues for security problems.

The analyzer treats every repository as untrusted: it never executes repository code, never follows symlinks and never reads outside the given root. See [docs/security/threat-model.md](docs/security/threat-model.md).
