"""
Performance monitoring middleware for AI Code Editor
"""

import time
import logging
from typing import Callable, Dict, Any
from fastapi import Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware
import psutil
import asyncio
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta


@dataclass
class PerformanceMetrics:
    """Performance metrics data structure"""
    endpoint: str
    method: str
    status_code: int
    response_time_ms: float
    memory_usage_mb: float
    cpu_percent: float
    timestamp: datetime
    request_size_bytes: int = 0
    response_size_bytes: int = 0


class PerformanceMonitor:
    """Performance monitoring and analytics"""
    
    def __init__(self, max_metrics: int = 10000):
        self.metrics: deque[PerformanceMetrics] = deque(maxlen=max_metrics)
        self.endpoint_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            'count': 0,
            'total_time': 0.0,
            'min_time': float('inf'),
            'max_time': 0.0,
            'error_count': 0,
            'avg_memory': 0.0,
            'avg_cpu': 0.0
        })
        self.logger = logging.getLogger(__name__)
    
    def add_metric(self, metric: PerformanceMetrics) -> None:
        """Add a performance metric"""
        self.metrics.append(metric)
        self._update_endpoint_stats(metric)
    
    def _update_endpoint_stats(self, metric: PerformanceMetrics) -> None:
        """Update endpoint statistics"""
        key = f"{metric.method} {metric.endpoint}"
        stats = self.endpoint_stats[key]
        
        stats['count'] += 1
        stats['total_time'] += metric.response_time_ms
        stats['min_time'] = min(stats['min_time'], metric.response_time_ms)
        stats['max_time'] = max(stats['max_time'], metric.response_time_ms)
        
        if metric.status_code >= 400:
            stats['error_count'] += 1
        
        # Calculate rolling averages
        stats['avg_memory'] = (stats['avg_memory'] * (stats['count'] - 1) + metric.memory_usage_mb) / stats['count']
        stats['avg_cpu'] = (stats['avg_cpu'] * (stats['count'] - 1) + metric.cpu_percent) / stats['count']
    
    def get_summary(self) -> Dict[str, Any]:
        """Get performance summary"""
        if not self.metrics:
            return {}
        
        recent_metrics = [m for m in self.metrics if m.timestamp > datetime.now() - timedelta(minutes=5)]
        
        return {
            'total_requests': len(self.metrics),
            'recent_requests': len(recent_metrics),
            'avg_response_time': sum(m.response_time_ms for m in recent_metrics) / len(recent_metrics) if recent_metrics else 0,
            'error_rate': sum(1 for m in recent_metrics if m.status_code >= 400) / len(recent_metrics) if recent_metrics else 0,
            'current_memory_mb': psutil.virtual_memory().used / (1024 * 1024),
            'current_cpu_percent': psutil.cpu_percent(),
            'endpoint_stats': dict(self.endpoint_stats)
        }
    
    def get_slow_endpoints(self, threshold_ms: float = 1000.0) -> Dict[str, Any]:
        """Get endpoints that are slower than threshold"""
        slow_endpoints = {}
        
        for endpoint, stats in self.endpoint_stats.items():
            avg_time = stats['total_time'] / stats['count'] if stats['count'] > 0 else 0
            if avg_time > threshold_ms:
                slow_endpoints[endpoint] = {
                    'avg_response_time': avg_time,
                    'max_response_time': stats['max_time'],
                    'request_count': stats['count'],
                    'error_rate': stats['error_count'] / stats['count'] if stats['count'] > 0 else 0
                }
        
        return slow_endpoints
    
    def get_metrics_for_period(self, minutes: int = 60) -> list[Dict[str, Any]]:
        """Get metrics for a specific time period"""
        cutoff = datetime.now() - timedelta(minutes=minutes)
        return [
            asdict(metric) for metric in self.metrics 
            if metric.timestamp > cutoff
        ]


# Global performance monitor instance
performance_monitor = PerformanceMonitor()


class PerformanceMiddleware(BaseHTTPMiddleware):
    """ASGI middleware for performance monitoring"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip monitoring for health checks and static files
        if request.url.path in ['/health', '/ping', '/favicon.ico']:
            return await call_next(request)
        
        start_time = time.time()
        
        # Get initial system metrics
        memory_before = psutil.virtual_memory().used / (1024 * 1024)
        cpu_before = psutil.cpu_percent()
        
        # Get request size
        request_size = 0
        if hasattr(request, 'headers') and 'content-length' in request.headers:
            try:
                request_size = int(request.headers['content-length'])
            except (ValueError, TypeError):
                pass
        
        # Process request
        response = await call_next(request)
        
        # Calculate metrics
        end_time = time.time()
        response_time = (end_time - start_time) * 1000  # Convert to milliseconds
        
        memory_after = psutil.virtual_memory().used / (1024 * 1024)
        cpu_after = psutil.cpu_percent()
        
        # Get response size
        response_size = 0
        if hasattr(response, 'headers') and 'content-length' in response.headers:
            try:
                response_size = int(response.headers['content-length'])
            except (ValueError, TypeError):
                pass
        
        # Create performance metric
        metric = PerformanceMetrics(
            endpoint=request.url.path,
            method=request.method,
            status_code=response.status_code,
            response_time_ms=response_time,
            memory_usage_mb=memory_after,
            cpu_percent=cpu_after,
            timestamp=datetime.now(),
            request_size_bytes=request_size,
            response_size_bytes=response_size
        )
        
        # Add to monitor
        performance_monitor.add_metric(metric)
        
        # Log slow requests
        if response_time > 1000:  # Log requests slower than 1 second
            performance_monitor.logger.warning(
                f"Slow request: {request.method} {request.url.path} took {response_time:.2f}ms"
            )
        
        # Add performance headers
        response.headers["X-Response-Time"] = str(response_time)
        response.headers["X-Memory-Usage"] = str(memory_after)
        
        return response


async def cleanup_old_metrics():
    """Background task to cleanup old metrics"""
    while True:
        try:
            cutoff = datetime.now() - timedelta(hours=24)
            # Remove metrics older than 24 hours
            while performance_monitor.metrics and performance_monitor.metrics[0].timestamp < cutoff:
                performance_monitor.metrics.popleft()
            
            # Sleep for 1 hour before next cleanup
            await asyncio.sleep(3600)
        except Exception as e:
            logging.error(f"Error in metrics cleanup: {e}")
            await asyncio.sleep(300)  # Wait 5 minutes before retry


# Performance alerting
class PerformanceAlerter:
    """Alert system for performance issues"""
    
    def __init__(self):
        self.alert_thresholds = {
            'response_time_ms': 2000,
            'error_rate': 0.05,  # 5%
            'memory_usage_mb': 1024,  # 1GB
            'cpu_percent': 80
        }
        self.last_alert_time = {}
        self.alert_cooldown = 300  # 5 minutes
    
    def check_alerts(self) -> list[str]:
        """Check for performance alerts"""
        alerts = []
        current_time = time.time()
        
        summary = performance_monitor.get_summary()
        if not summary:
            return alerts
        
        # Check response time
        if summary.get('avg_response_time', 0) > self.alert_thresholds['response_time_ms']:
            if self._should_alert('response_time', current_time):
                alerts.append(f"High response time: {summary['avg_response_time']:.2f}ms")
        
        # Check error rate
        if summary.get('error_rate', 0) > self.alert_thresholds['error_rate']:
            if self._should_alert('error_rate', current_time):
                alerts.append(f"High error rate: {summary['error_rate']:.2%}")
        
        # Check memory usage
        if summary.get('current_memory_mb', 0) > self.alert_thresholds['memory_usage_mb']:
            if self._should_alert('memory', current_time):
                alerts.append(f"High memory usage: {summary['current_memory_mb']:.2f}MB")
        
        # Check CPU usage
        if summary.get('current_cpu_percent', 0) > self.alert_thresholds['cpu_percent']:
            if self._should_alert('cpu', current_time):
                alerts.append(f"High CPU usage: {summary['current_cpu_percent']:.2f}%")
        
        return alerts
    
    def _should_alert(self, alert_type: str, current_time: float) -> bool:
        """Check if we should send an alert (respecting cooldown)"""
        last_alert = self.last_alert_time.get(alert_type, 0)
        if current_time - last_alert > self.alert_cooldown:
            self.last_alert_time[alert_type] = current_time
            return True
        return False


# Global alerter instance
performance_alerter = PerformanceAlerter()