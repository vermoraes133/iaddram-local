# Security

Do not attach credentials, real memory archives or private project content to
public issues. Report vulnerabilities privately through GitHub:
<https://github.com/vermoraes133/iaddram-local/security/advisories/new>.
Supported version: the latest 0.1.x preview.

This preview protects memory content at rest and isolates each MCP process to
its configured project. Any process with access to your OS account and unlocked
credential store belongs to the same trust boundary. It is not a sandbox for
hostile software running as your user.

Retrieved memories are untrusted data. Secret-pattern scanning helps reject
common credentials but cannot detect every secret or malicious instruction.
Agent clients must preserve provenance and must not elevate retrieved text to
system instructions. See README for metadata exposure and deletion limits.
