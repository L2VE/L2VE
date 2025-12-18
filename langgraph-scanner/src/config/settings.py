"""
Configuration settings for Discovery-With-Seed project
"""
import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_aws import ChatBedrockConverse
from typing import Literal

# Load environment variables
load_dotenv()

# API Settings
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
AWS_BEARER_TOKEN_BEDROCK = os.getenv("AWS_BEARER_TOKEN_BEDROCK")
BEDROCK_AWS_REGION = os.getenv("BEDROCK_AWS_REGION", "ap-southeast-2")

# Azure OpenAI Settings
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

# OpenAI Compatible Backend (vLLM, LocalAI, etc.)
OPENAI_COMPATIBLE_API_KEY = os.getenv("OPENAI_COMPATIBLE_API_KEY", "not-needed")
OPENAI_COMPATIBLE_BASE_URL = os.getenv("OPENAI_COMPATIBLE_BASE_URL")
OPENAI_COMPATIBLE_MODEL = os.getenv("OPENAI_COMPATIBLE_MODEL")

# OpenRouter Settings (OpenAI-compatible backend)
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", OPENAI_COMPATIBLE_MODEL or "x-ai/grok-4.1-fast")


API_BASE_URL = os.getenv("API_BASE_URL", "http://backend:3000")
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:9121/mcp")
# MCP Configuration
MCP_CONFIG = {
    "source-code-viewer": {
        "transport": "streamable_http",
        "url": MCP_SERVER_URL
    }
}

# LLM Provider type
LLMProvider = Literal["google", "groq", "openai", "azure", "anthropic", "compatible", "openrouter", "bedrock"]

# LLM Configuration
def get_llm(
    provider: str = "google",
    model_name: str | None = None,
    temperature: float = 0.0,
    max_tokens: int = 8192
):
    """
    Get configured LLM instance
    
    Args:
        provider: LLM provider ("google", "groq", "openai", "azure", "anthropic", "compatible", "openrouter")
        model_name: Model name (provider-specific defaults if None)
        temperature: Temperature for generation (default: 0.0)
        max_tokens: Maximum tokens for response (default: 8192)
    
    Returns:
        Configured LLM instance
    
    Supported Models:
    - Google: gemini-2.0-flash-exp, gemini-1.5-pro, gemini-1.5-flash
    - Groq: llama-3.3-70b-versatile, llama-3.1-70b-versatile, mixtral-8x7b-32768
    - OpenAI: gpt-5, gpt-4o, gpt-4o-mini, gpt-4-turbo, o1-preview, o1-mini
    - Anthropic: Claude 4.5 Sonnet (default) or any supported Claude model name
    - Azure OpenAI: Uses deployment name from AZURE_OPENAI_DEPLOYMENT_NAME
    - Compatible: Any OpenAI-compatible backend (vLLM, LocalAI, Ollama, etc.)
    - OpenRouter: OpenAI-compatible backend hosted by openrouter.ai
    - Bedrock: global.anthropic.claude-sonnet-4-5-20250929-v1:0, amazon.titan-ultimate-001, etc.
    
    Rate Limits (as of 2024):
    - Google Gemini 2.0 Flash: 10 RPM (free), 1000 RPM (paid)
    - Groq: 30 RPM / 14,400 TPM (free tier)
    - OpenAI: Varies by tier
    - Azure OpenAI: Varies by deployment tier
    - Compatible: Depends on your backend setup
    - OpenRouter: Varies by plan
    - Bedrock: Varies by model and AWS region
    """
    provider = provider.lower()
    
    if provider == "google":
        if not GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY not found in environment variables")
        
        default_model = model_name or "gemini-2.0-flash-exp"
        
        return ChatGoogleGenerativeAI(
            model=default_model,
            google_api_key=GOOGLE_API_KEY,
            temperature=temperature,
            max_tokens=max_tokens,
            max_retries=3
        )
    
    elif provider == "groq":
        if not GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        
        default_model = model_name or "qwen/qwen3-32b"
        
        # Groq uses GROQ_API_KEY environment variable
        return ChatGroq(
            model=default_model,
            temperature=temperature,
            max_tokens=max_tokens,
            max_retries=3
        )
    
    elif provider == "openai":
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        default_model = model_name or "gpt-4o-mini"
        
        # OpenAI uses OPENAI_API_KEY environment variable
        return ChatOpenAI(
            model=default_model,
            temperature=temperature,
            max_completion_tokens=max_tokens,
            max_retries=3
        )
    
    elif provider == "azure":
        if not AZURE_OPENAI_API_KEY:
            raise ValueError("AZURE_OPENAI_API_KEY not found in environment variables")
        if not AZURE_OPENAI_ENDPOINT:
            raise ValueError("AZURE_OPENAI_ENDPOINT not found in environment variables")
        if not AZURE_OPENAI_DEPLOYMENT_NAME:
            raise ValueError("AZURE_OPENAI_DEPLOYMENT_NAME not found in environment variables")
        
        # For Azure, deployment_name is required, model_name is optional override
        deployment = model_name or AZURE_OPENAI_DEPLOYMENT_NAME
        
        return ChatOpenAI(
            model=deployment,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_API_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
            temperature=temperature,
            max_completion_tokens=max_tokens,
            max_retries=3
        )
    
    elif provider == "anthropic":
        if not ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY not found in environment variables")
        
        selected_model = model_name or "claude-sonnet-4-5-20250929"
        
        return ChatAnthropic(
            model=selected_model,
            api_key=ANTHROPIC_API_KEY,
            temperature=temperature,
            max_tokens=max_tokens,
            max_retries=3
        )
    
    elif provider == "compatible":
        if not OPENAI_COMPATIBLE_BASE_URL:
            raise ValueError("OPENAI_COMPATIBLE_BASE_URL not found in environment variables")
        
        # Use model_name override if provided, otherwise use environment variable
        model = model_name or OPENAI_COMPATIBLE_MODEL
        
        # OpenAI-compatible backend (vLLM, LocalAI, Ollama, etc.)
        return ChatOpenAI(
            model=model,
            base_url=OPENAI_COMPATIBLE_BASE_URL,
            api_key=OPENAI_COMPATIBLE_API_KEY,  # Some backends don't need this
            temperature=temperature,
            max_completion_tokens=max_tokens,
            max_retries=3
        )
    
    elif provider == "openrouter":
        if not OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY not found in environment variables")
        model = model_name or OPENROUTER_MODEL
        if not model:
            raise ValueError("OPENROUTER_MODEL is not configured. Set OPENROUTER_MODEL or pass --model.")
        return ChatOpenAI(
            model=model,
            base_url=OPENROUTER_BASE_URL,
            api_key=OPENROUTER_API_KEY,
            temperature=temperature,
            max_completion_tokens=max_tokens,
            max_retries=3
        )
    elif provider == "bedrock":
        if not AWS_BEARER_TOKEN_BEDROCK:
            raise ValueError("AWS_BEARER_TOKEN_BEDROCK not found in environment variables")
        
        default_model = model_name or "global.anthropic.claude-sonnet-4-5-20250929-v1:0"

        return ChatBedrockConverse(
            region_name=BEDROCK_AWS_REGION,
            model_id=default_model,
            temperature=temperature,
            max_tokens=max_tokens
        )
    
    else:
        raise ValueError(
            f"Unsupported provider: {provider}. Choose from: google, groq, openai, azure, anthropic, compatible, openrouter"
        )


# Get LLM provider from environment
DEFAULT_LLM_PROVIDER = os.getenv("LLM_PROVIDER", "google")
DEFAULT_LLM_MODEL = os.getenv("LLM_MODEL", None)  # Use provider default if not set

# Analysis Configuration
MAX_CHUNK_SIZE = int(os.getenv("MAX_CHUNK_SIZE", "30000"))  # Maximum JSON string length per chunk (reduced for large prompts)
MAX_ANSWER_CHARS = int(os.getenv("MAX_ANSWER_CHARS", "100000"))  # MCP tool max answer chars
AGENT_RECURSION_LIMIT = int(os.getenv("AGENT_RECURSION_LIMIT", "50"))  # ReAct Agent recursion limit
AGENT_MAX_TOOL_CALLS = int(os.getenv("AGENT_MAX_TOOL_CALLS", "10"))   # Max tool calls per batch
ANALYSIS_CONTEXT_WINDOW = int(
    os.getenv("ANALYSIS_CONTEXT_WINDOW")
    or os.getenv("LLM_CONTEXT_WINDOW")
    or "24000"
)
ANALYSIS_RESPONSE_TOKEN_RESERVE = int(os.getenv("ANALYSIS_RESPONSE_TOKEN_RESERVE", "2000"))
MAX_FAILED_RETRIES = int(os.getenv("MAX_FAILED_RETRIES", "0"))  # Max retries for failed batches (0 = no retry)
DISCOVERY_TOOL_ONLY_RETRY_LIMIT = int(os.getenv("DISCOVERY_TOOL_ONLY_RETRY_LIMIT", "10"))
ANALYSIS_WORKERS_DEFAULT = int(os.getenv("ANALYSIS_WORKERS_DEFAULT", "1"))
ANALYSIS_WORKER_OVERRIDES = os.getenv("ANALYSIS_WORKER_OVERRIDES", "")
ANALYSIS_WORKER_MAX_RETRIES = int(os.getenv("ANALYSIS_WORKER_MAX_RETRIES", "0"))

# Discovery Configuration - Multi-worker settings
# Discovery Configuration - Multi-worker settings
DISCOVERY_MAX_WORKERS = int(os.getenv("DISCOVERY_MAX_WORKERS", "4"))
DISCOVERY_WORKER_MAX_RETRIES = int(os.getenv("DISCOVERY_WORKER_MAX_RETRIES", "1"))
DISCOVERY_RECURSION_LIMIT = int(os.getenv("DISCOVERY_RECURSION_LIMIT", "2000"))

# Project Configuration
DEFAULT_PROJECT_TITLE = os.getenv("DEFAULT_PROJECT_TITLE", "")
