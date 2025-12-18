"""
Data models for Discovery-With-Seed project
"""
from typing import TypedDict, List, Optional, Dict, Any, Annotated
from enum import Enum
import operator


class VulnerabilityType(str, Enum):
    """Vulnerability types"""
    XSS = "XSS"
    SSRF = "SSRF"
    OPEN_REDIRECT = "OpenRedirect"
    INSECURE_DESERIALIZATION = "InsecureDeserialization"
    IDOR = "IDOR"
    NO = "NO"


class SeverityLevel(str, Enum):
    """Severity levels"""
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class VulnerabilityElement(TypedDict, total=False):
    """
    Single vulnerability element from API
    """
    file_path: str
    line_num: str
    code_snippet: str
    vulnerability_types: Optional[List[str]]  # Added by Discovery Agent
    analysis_result: Optional[Dict[str, Any]]  # Added by Analysis Agent (DetailedVulnerability)


class TaintFlowSource(TypedDict):
    """Taint flow source information"""
    explanation: str
    code_snippet: str


class TaintFlowPropagation(TypedDict):
    """Taint flow propagation information"""
    explanation: str
    code_snippet: str


class TaintFlowSink(TypedDict):
    """Taint flow sink information"""
    explanation: str
    code_snippet: str


class TaintFlowAnalysis(TypedDict):
    """Complete taint flow analysis"""
    source: TaintFlowSource
    propagation: TaintFlowPropagation
    sink: TaintFlowSink


class ProofOfConcept(TypedDict):
    """Proof of concept information"""
    scenario: str
    example: str


class LocationInfo(TypedDict):
    """Location information for vulnerability"""
    file_path: str
    line_number: str


class Recommendation(TypedDict):
    """Recommendation for fixing vulnerability"""
    how_to_fix: str
    code_example_fix: str


class CodeFixPatch(TypedDict, total=False):
    """Patch suggestion emitted directly by Analysis Agent"""
    target_file: str
    line_range: str
    original_snippet: str
    modified_snippet: str
    notes: str


class TestPlan(TypedDict, total=False):
    """Represents a functional or security regression test suggestion"""
    description: str
    framework: str
    dependencies: List[str]
    file_path: str
    command: str
    script: str
    setup_commands: Optional[List[str]]


class DetailedVulnerability(TypedDict):
    """
    Detailed vulnerability analysis result from Analysis Agent
    """
    vulnerability_title: str
    severity: str
    cwe: str
    location: LocationInfo
    description: str
    taint_flow_analysis: TaintFlowAnalysis
    proof_of_concept: ProofOfConcept
    recommendation: Recommendation
    code_fix_patch: CodeFixPatch
    functional_test: Optional[TestPlan]
    security_regression_test: Optional[TestPlan]


class DiscoveryState(TypedDict, total=False):
    """
    State for Discovery Agent workflow
    """
    project_title: str
    seed_source: str
    input_seed_file: Optional[str]
    local_seed_file: Optional[str]
    unseen_elements: List[VulnerabilityElement]
    total_elements: int
    processed_count: int
    current_batch: List[VulnerabilityElement]
    classified_batch: List[VulnerabilityElement]
    all_classified: Annotated[List[VulnerabilityElement], operator.add]
    messages: List[str]
    current_stage: str


class AnalysisState(TypedDict, total=False):
    """
    State for Analysis Agent workflow
    """
    project_title: str
    classification_source: str
    classification_file: Optional[str]
    ignore_previous_versions: bool
    target_label: Optional[str]
    target_cwe: Optional[str]
    system_prompt: Optional[str]
    target_is_general: bool
    worker_id: int
    worker_count: int
    classified_elements: List[VulnerabilityElement]
    total_elements: int
    processed_count: int
    current_batch: List[VulnerabilityElement]
    analyzed_batch: List[DetailedVulnerability]
    all_analyzed: List[DetailedVulnerability]
    analyzed_keys: set  # Set of (file_path, line_num) tuples successfully analyzed
    failed_elements: List[VulnerabilityElement]  # Elements that failed JSON parsing
    failed_retry_count: int  # Number of retries for failed items
    messages: List[str]
    current_stage: str
    agent_message_history: List[Any]  # Store LLM message history for compression
