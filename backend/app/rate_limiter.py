"""Rate limiting for API endpoints"""
from fastapi import HTTPException, Request, status
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Tuple
import asyncio


class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        # Store: {ip: {endpoint: (count, window_start)}}
        self.requests: Dict[str, Dict[str, Tuple[int, datetime]]] = defaultdict(dict)
        self.lock = asyncio.Lock()
    
    async def check_rate_limit(
        self, 
        request: Request,
        max_requests: int = 100,
        window_seconds: int = 60
    ) -> bool:
        """Check if request is within rate limit"""
        client_ip = request.client.host
        endpoint = f"{request.method}:{request.url.path}"
        
        async with self.lock:
            now = datetime.utcnow()
            
            if endpoint in self.requests[client_ip]:
                count, window_start = self.requests[client_ip][endpoint]
                
                # Check if window expired
                if now - window_start > timedelta(seconds=window_seconds):
                    # Reset window
                    self.requests[client_ip][endpoint] = (1, now)
                    return True
                
                # Check if limit exceeded
                if count >= max_requests:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Rate limit exceeded. Max {max_requests} requests per {window_seconds} seconds.",
                        headers={"Retry-After": str(window_seconds)}
                    )
                
                # Increment counter
                self.requests[client_ip][endpoint] = (count + 1, window_start)
            else:
                # First request in window
                self.requests[client_ip][endpoint] = (1, now)
            
            return True
    
    async def cleanup_old_entries(self, max_age_hours: int = 24):
        """Clean up old entries to prevent memory leaks"""
        async with self.lock:
            cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
            
            for ip in list(self.requests.keys()):
                for endpoint in list(self.requests[ip].keys()):
                    _, window_start = self.requests[ip][endpoint]
                    if window_start < cutoff:
                        del self.requests[ip][endpoint]
                
                # Remove IP if no endpoints left
                if not self.requests[ip]:
                    del self.requests[ip]


# Global rate limiter instance
rate_limiter = RateLimiter()


async def rate_limit_dependency(request: Request):
    """FastAPI dependency for rate limiting"""
    await rate_limiter.check_rate_limit(
        request,
        max_requests=100,  # 100 requests
        window_seconds=60   # per minute
    )

