"""
Rate limiter for LLM API calls
"""
import os
import time
import asyncio
from typing import Dict, Optional
from datetime import datetime, timedelta
from collections import deque


class RateLimiter:
    """
    Rate limiter for controlling API requests
    
    Supports:
    - RPM (Requests Per Minute)
    - TPM (Tokens Per Minute)
    """
    
    def __init__(
        self,
        rpm: Optional[int] = None,
        tpm: Optional[int] = None,
        name: str = "RateLimiter"
    ):
        """
        Initialize rate limiter
        
        Args:
            rpm: Requests per minute limit
            tpm: Tokens per minute limit
            name: Name for logging
        """
        self.rpm = rpm
        self.tpm = tpm
        self.name = name
        
        # Track requests in the last minute
        self.request_times: deque = deque()
        
        # Track tokens in the last minute
        self.token_usage: deque = deque()  # (timestamp, token_count)
        
        print(f"✅ {name} initialized: RPM={rpm}, TPM={tpm}")
    
    def _clean_old_entries(self, queue: deque, window_seconds: int = 60):
        """Remove entries older than window_seconds"""
        cutoff_time = time.time() - window_seconds
        while queue and queue[0][0] < cutoff_time:
            queue.popleft()
    
    def _get_current_rpm(self) -> int:
        """Get current requests in the last minute"""
        self._clean_old_entries(self.request_times)
        return len(self.request_times)
    
    def _get_current_tpm(self) -> int:
        """Get current tokens used in the last minute"""
        self._clean_old_entries(self.token_usage)
        return sum(tokens for _, tokens in self.token_usage)
    
    def _calculate_wait_time(self, estimated_tokens: int = 0) -> float:
        """
        Calculate how long to wait before making request
        
        Args:
            estimated_tokens: Estimated tokens for this request
        
        Returns:
            Wait time in seconds
        """
        wait_times = []
        
        # Check RPM limit
        if self.rpm is not None:
            current_rpm = self._get_current_rpm()
            if current_rpm >= self.rpm:
                # Need to wait until oldest request expires
                oldest_time = self.request_times[0][0]
                wait_time = 60 - (time.time() - oldest_time) + 0.1  # Add buffer
                wait_times.append(wait_time)
                print(f"⏳ {self.name} RPM limit reached ({current_rpm}/{self.rpm}), waiting {wait_time:.1f}s")
        
        # Check TPM limit
        if self.tpm is not None and estimated_tokens > 0:
            current_tpm = self._get_current_tpm()
            if current_tpm + estimated_tokens > self.tpm:
                # Need to wait until enough tokens free up
                # Find when we'll have enough capacity
                cumulative = 0
                target_index = 0
                for i, (ts, tokens) in enumerate(self.token_usage):
                    cumulative += tokens
                    if current_tpm - cumulative + estimated_tokens <= self.tpm:
                        target_index = i
                        break
                
                if target_index < len(self.token_usage):
                    oldest_time = self.token_usage[target_index][0]
                    wait_time = 60 - (time.time() - oldest_time) + 0.1
                    wait_times.append(wait_time)
                    print(f"⏳ {self.name} TPM limit reached ({current_tpm}/{self.tpm}), waiting {wait_time:.1f}s")
        
        return max(wait_times) if wait_times else 0
    
    async def acquire(self, estimated_tokens: int = 1000):
        """
        Acquire permission to make a request
        
        Args:
            estimated_tokens: Estimated tokens for this request
        """
        wait_time = self._calculate_wait_time(estimated_tokens)
        
        if wait_time > 0:
            await asyncio.sleep(wait_time)
        
        # Record this request
        current_time = time.time()
        self.request_times.append((current_time, 1))
        
        # Estimate token usage (will be updated later if actual count is known)
        if estimated_tokens > 0:
            self.token_usage.append((current_time, estimated_tokens))
    
    def record_usage(self, actual_tokens: int):
        """
        Update with actual token usage after request completes
        
        Args:
            actual_tokens: Actual tokens used
        """
        # Replace the last estimated entry with actual
        if self.token_usage:
            timestamp, _ = self.token_usage[-1]
            self.token_usage[-1] = (timestamp, actual_tokens)
    
    def get_stats(self) -> Dict:
        """Get current rate limiter statistics"""
        current_rpm = self._get_current_rpm()
        current_tpm = self._get_current_tpm()
        
        return {
            "rpm": {
                "current": current_rpm,
                "limit": self.rpm,
                "available": self.rpm - current_rpm if self.rpm else "unlimited"
            },
            "tpm": {
                "current": current_tpm,
                "limit": self.tpm,
                "available": self.tpm - current_tpm if self.tpm else "unlimited"
            }
        }


# Global rate limiters for each provider
_rate_limiters: Dict[str, RateLimiter] = {}


def get_rate_limiter(provider: str) -> RateLimiter:
    """
    Get or create rate limiter for provider
    
    Args:
        provider: LLM provider name
    
    Returns:
        RateLimiter instance
    """
    if provider not in _rate_limiters:
        # Load rate limits from environment variables, with fallback to defaults
        google_tpm_str = os.getenv("GOOGLE_TPM")
        groq_tpm_str = os.getenv("GROQ_TPM", "14400")
        openai_tpm_str = os.getenv("OPENAI_TPM", "10000")
        bedrock_rpm_str = os.getenv("AWS_BEDROCK_RPM", "60")
        bedrock_tpm_str = os.getenv("AWS_BEDROCK_TPM", "60000")
        
        rate_limits = {
            "google": {
                "rpm": int(os.getenv("GOOGLE_RPM", "10")),
                "tpm": int(google_tpm_str) if google_tpm_str else None
            },
            "groq": {
                "rpm": int(os.getenv("GROQ_RPM", "30")),
                "tpm": int(groq_tpm_str) if groq_tpm_str else None
            },
            "openai": {
                "rpm": int(os.getenv("OPENAI_RPM", "500")),
                "tpm": int(openai_tpm_str) if openai_tpm_str else None
            },
            "bedrock": {
                "rpm": int(bedrock_rpm_str) if bedrock_rpm_str else None,
                "tpm": int(bedrock_tpm_str) if bedrock_tpm_str else None
            }
        }
        
        limits = rate_limits.get(provider, {"rpm": None, "tpm": None})
        _rate_limiters[provider] = RateLimiter(
            rpm=limits["rpm"],
            tpm=limits["tpm"],
            name=f"{provider.upper()} RateLimiter"
        )
    
    return _rate_limiters[provider]


def update_rate_limits(provider: str, rpm: Optional[int] = None, tpm: Optional[int] = None):
    """
    Update rate limits for a provider
    
    Args:
        provider: LLM provider name
        rpm: New RPM limit
        tpm: New TPM limit
    """
    if provider in _rate_limiters:
        limiter = _rate_limiters[provider]
        if rpm is not None:
            limiter.rpm = rpm
            print(f"✅ Updated {provider} RPM limit: {rpm}")
        if tpm is not None:
            limiter.tpm = tpm
            print(f"✅ Updated {provider} TPM limit: {tpm}")
    else:
        _rate_limiters[provider] = RateLimiter(rpm=rpm, tpm=tpm, name=f"{provider.upper()} RateLimiter")
