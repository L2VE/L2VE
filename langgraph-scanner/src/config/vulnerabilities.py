"""
Vulnerability taxonomy shared between Discovery and Analysis agents.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict


@dataclass(frozen=True)
class VulnerabilityDefinition:
    """Represents a single vulnerability category."""

    label: str
    cwe: str | None
    description: str
    include_in_analysis: bool = True
    is_general: bool = False
    analysis_prompt: str | None = None


VULNERABILITY_TYPE_DEFINITIONS: Dict[str, VulnerabilityDefinition] = {
    "XSS": VulnerabilityDefinition(
        label="XSS",
        cwe="CWE-79",
        description="Cross-Site Scripting where untrusted data reaches HTML/JS sinks without escaping.",
        analysis_prompt=(
            "Focus on template rendering, DOM manipulation, or response bodies that echo user input. "
            "Note the exact sink (e.g., mark_safe, innerHTML) and whether encoding/sanitization is missing."
        ),
    ),
    "SQLI": VulnerabilityDefinition(
        label="SQLI",
        cwe="CWE-89",
        description="SQL Injection where attacker-controlled data flows into database queries.",
    ),
    "SSRF": VulnerabilityDefinition(
        label="SSRF",
        cwe="CWE-918",
        description="Server-Side Request Forgery abusing outbound HTTP clients to access internal resources.",
        analysis_prompt=(
            "Identify the HTTP client and how external URLs are accepted. Highlight missing allowlists, scheme/IP validation, "
            "and mention any network controls to be added (private IP blocks, host allowlists, etc.)."
        ),
    ),
    "OpenRedirect": VulnerabilityDefinition(
        label="OpenRedirect",
        cwe="CWE-601",
        description="Open redirect exposures that forward victims to attacker-controlled URLs.",
        analysis_prompt=(
            "Emphasize how redirect URLs are built. Capture validation gaps (missing domain allowlist, parameter tampering) "
            "and reference the response mechanism (e.g., HttpResponseRedirect)."
        ),
    ),
    "InsecureDeserialization": VulnerabilityDefinition(
        label="InsecureDeserialization",
        cwe="CWE-502",
        description="Unsafe deserialization of attacker-controlled payloads leading to code execution.",
        analysis_prompt=(
            "Document the serializer/deserializer API, the untrusted entry point, and any gadget chain or dangerous magic methods invoked. "
            "Explicitly show the payload structure if possible, mention signing/hardening options (e.g., json loads + schema validation), and provide a safe replacement or hardening strategy."
        ),
    ),
    "IDOR": VulnerabilityDefinition(
        label="IDOR",
        cwe="CWE-639",
        description="Insecure direct object references that bypass authorization checks.",
        analysis_prompt=(
            "Capture which identifier is user-controlled and what authorization check is missing. "
            "Provide concrete abuse scenario (e.g., guessing IDs to read other accounts)."
        ),
    ),
    "NO": VulnerabilityDefinition(
        label="NO",
        cwe=None,
        description="Elements that Discovery marked as non-vulnerable.",
        include_in_analysis=False,
    ),
    "CommandInjection": VulnerabilityDefinition(
        label="CommandInjection",
        cwe="CWE-77",
        description="Command injection through shell execution APIs fed by untrusted data.",
        analysis_prompt=(
            "Highlight the executor (e.g., subprocess, os.system), the exact user input reaching it, "
            "and suggest mitigations (argument lists, shlex, allowlists)."
        ),
    ),
    "PathTraversal": VulnerabilityDefinition(
        label="PathTraversal",
        cwe="CWE-22",
        description="Path traversal where user input manipulates filesystem paths.",
        analysis_prompt=(
            "Describe how paths are concatenated, what validation is missing (e.g., basename, resolve), and realistic payloads."
        ),
    ),
    "CodeInjection": VulnerabilityDefinition(
        label="CodeInjection",
        cwe="CWE-94",
        description="Code injection or template injection that executes attacker input.",
        analysis_prompt=(
            "Explain how user-controlled expressions reach eval/exec/template rendering. "
            "Mention relevant sandbox gaps and concrete malicious payloads."
        ),
    ),
    "General": VulnerabilityDefinition(
        label="General",
        cwe=None,
        description="Catch-all analyst that handles any remaining vulnerability classifications not covered above.",
        include_in_analysis=True,
        is_general=True,
        analysis_prompt=(
            "Act as a generalist: restate the risk, summarize impact, and produce a precise fix even if the vulnerability "
            "doesn't match a predefined category."
        ),
    ),
}


def get_analysis_targets() -> List[Dict[str, str]]:
    """
    Return the vulnerability categories that should spawn dedicated Analysis Agents.
    """
    targets: List[Dict[str, str]] = []
    for definition in VULNERABILITY_TYPE_DEFINITIONS.values():
        if not definition.include_in_analysis:
            continue
        targets.append(
            {
                "label": definition.label,
                "cwe": definition.cwe or "",
                "description": definition.description,
                "is_general": definition.is_general,
                "analysis_prompt": definition.analysis_prompt or "",
            }
        )
    return targets


DISCOVERY_VULNERABILITY_TYPES: List[str] = [
    definition.label
    for definition in VULNERABILITY_TYPE_DEFINITIONS.values()
    if not definition.is_general
]
