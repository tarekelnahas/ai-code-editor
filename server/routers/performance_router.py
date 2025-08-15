"""
Performance monitoring API endpoints
"""

from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import psutil
from datetime import datetime, timedelta

from middleware.performance import performance_monitor, performance_alerter


router = APIRouter()


class SystemMetrics(BaseModel):
    """System metrics response model"""
    cpu_percent: float
    memory_usage_mb: float
    memory_percent: float
    disk_usage_percent: float
    network_sent_mb: float
    network_recv_mb: float
    uptime_seconds: float
    load_average: List[float] = []


class PerformanceSummary(BaseModel):
    """Performance summary response model"""
    total_requests: int
    recent_requests: int
    avg_response_time: float
    error_rate: float
    current_memory_mb: float
    current_cpu_percent: float
    slow_endpoints: Dict[str, Any]


@router.get("/performance/system", response_model=SystemMetrics)
async def get_system_metrics():
    """Get current system performance metrics"""
    try:
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # Memory metrics
        memory = psutil.virtual_memory()
        memory_usage_mb = memory.used / (1024 * 1024)
        memory_percent = memory.percent
        
        # Disk metrics
        disk = psutil.disk_usage('/')
        disk_usage_percent = disk.percent
        
        # Network metrics
        network = psutil.net_io_counters()
        network_sent_mb = network.bytes_sent / (1024 * 1024)
        network_recv_mb = network.bytes_recv / (1024 * 1024)
        
        # System uptime
        boot_time = psutil.boot_time()
        uptime_seconds = datetime.now().timestamp() - boot_time
        
        # Load average (Unix systems only)
        load_avg = []
        try:
            load_avg = list(psutil.getloadavg())
        except AttributeError:
            # Windows doesn't have load average
            pass
        
        return SystemMetrics(
            cpu_percent=cpu_percent,
            memory_usage_mb=memory_usage_mb,
            memory_percent=memory_percent,
            disk_usage_percent=disk_usage_percent,
            network_sent_mb=network_sent_mb,
            network_recv_mb=network_recv_mb,
            uptime_seconds=uptime_seconds,
            load_average=load_avg
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system metrics: {str(e)}")


@router.get("/performance/summary", response_model=PerformanceSummary)
async def get_performance_summary():
    """Get application performance summary"""
    try:
        summary = performance_monitor.get_summary()
        slow_endpoints = performance_monitor.get_slow_endpoints()
        
        return PerformanceSummary(
            total_requests=summary.get('total_requests', 0),
            recent_requests=summary.get('recent_requests', 0),
            avg_response_time=summary.get('avg_response_time', 0),
            error_rate=summary.get('error_rate', 0),
            current_memory_mb=summary.get('current_memory_mb', 0),
            current_cpu_percent=summary.get('current_cpu_percent', 0),
            slow_endpoints=slow_endpoints
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get performance summary: {str(e)}")


@router.get("/performance/metrics")
async def get_metrics(
    minutes: int = Query(default=60, ge=1, le=1440, description="Time period in minutes")
):
    """Get detailed performance metrics for a time period"""
    try:
        metrics = performance_monitor.get_metrics_for_period(minutes)
        return {
            "period_minutes": minutes,
            "metric_count": len(metrics),
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")


@router.get("/performance/endpoints")
async def get_endpoint_stats():
    """Get detailed statistics for each endpoint"""
    try:
        stats = performance_monitor.endpoint_stats
        
        # Calculate additional metrics
        enriched_stats = {}
        for endpoint, data in stats.items():
            avg_time = data['total_time'] / data['count'] if data['count'] > 0 else 0
            error_rate = data['error_count'] / data['count'] if data['count'] > 0 else 0
            
            enriched_stats[endpoint] = {
                **data,
                'avg_response_time': avg_time,
                'error_rate': error_rate,
                'requests_per_minute': data['count'] / max(1, performance_monitor.metrics[-1].timestamp.timestamp() - performance_monitor.metrics[0].timestamp.timestamp()) * 60 if performance_monitor.metrics else 0
            }
        
        return enriched_stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get endpoint stats: {str(e)}")


@router.get("/performance/alerts")
async def get_performance_alerts():
    """Get current performance alerts"""
    try:
        alerts = performance_alerter.check_alerts()
        return {
            "alert_count": len(alerts),
            "alerts": alerts,
            "thresholds": performance_alerter.alert_thresholds,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get alerts: {str(e)}")


@router.get("/performance/health")
async def get_health_status():
    """Get overall application health status"""
    try:
        summary = performance_monitor.get_summary()
        alerts = performance_alerter.check_alerts()
        
        # Determine health status
        health_status = "healthy"
        if alerts:
            health_status = "warning" if len(alerts) <= 2 else "critical"
        
        # Check key metrics
        if summary.get('error_rate', 0) > 0.1:  # 10% error rate
            health_status = "critical"
        elif summary.get('avg_response_time', 0) > 5000:  # 5 second response time
            health_status = "critical"
        
        return {
            "status": health_status,
            "alerts": alerts,
            "metrics": {
                "avg_response_time": summary.get('avg_response_time', 0),
                "error_rate": summary.get('error_rate', 0),
                "memory_usage_mb": summary.get('current_memory_mb', 0),
                "cpu_percent": summary.get('current_cpu_percent', 0)
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get health status: {str(e)}")


@router.post("/performance/optimize")
async def trigger_optimization():
    """Trigger performance optimization tasks"""
    try:
        # Perform garbage collection
        import gc
        gc.collect()
        
        # Clear old metrics (keep last 1000)
        if len(performance_monitor.metrics) > 1000:
            # Keep only the most recent 1000 metrics
            recent_metrics = list(performance_monitor.metrics)[-1000:]
            performance_monitor.metrics.clear()
            performance_monitor.metrics.extend(recent_metrics)
        
        # Reset endpoint stats for very old data
        current_time = datetime.now()
        for endpoint in list(performance_monitor.endpoint_stats.keys()):
            stats = performance_monitor.endpoint_stats[endpoint]
            # If no requests in the last hour, reset stats
            if stats['count'] == 0:
                del performance_monitor.endpoint_stats[endpoint]
        
        return {
            "status": "optimization_completed",
            "actions": [
                "garbage_collection",
                "metrics_cleanup",
                "stats_reset"
            ],
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to optimize: {str(e)}")


@router.get("/performance/debug")
async def get_debug_info():
    """Get debug information for performance issues"""
    try:
        import platform
        import sys
        
        # Get process information
        process = psutil.Process()
        
        debug_info = {
            "system": {
                "platform": platform.platform(),
                "python_version": sys.version,
                "cpu_count": psutil.cpu_count(),
                "total_memory_mb": psutil.virtual_memory().total / (1024 * 1024)
            },
            "process": {
                "pid": process.pid,
                "memory_info": process.memory_info()._asdict(),
                "cpu_times": process.cpu_times()._asdict(),
                "create_time": process.create_time(),
                "num_threads": process.num_threads(),
                "open_files": len(process.open_files()),
                "connections": len(process.connections())
            },
            "performance_monitor": {
                "metrics_count": len(performance_monitor.metrics),
                "endpoint_count": len(performance_monitor.endpoint_stats),
                "oldest_metric": performance_monitor.metrics[0].timestamp.isoformat() if performance_monitor.metrics else None,
                "newest_metric": performance_monitor.metrics[-1].timestamp.isoformat() if performance_monitor.metrics else None
            }
        }
        
        return debug_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get debug info: {str(e)}")