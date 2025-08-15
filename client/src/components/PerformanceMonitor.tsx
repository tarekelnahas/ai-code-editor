import React, { useState, useEffect, useCallback } from 'react';
import { colors, spacing, borderRadius, shadows } from '../design/theme';

interface SystemMetrics {
  cpu_percent: number;
  memory_usage_mb: number;
  memory_percent: number;
  disk_usage_percent: number;
  network_sent_mb: number;
  network_recv_mb: number;
  uptime_seconds: number;
}

interface PerformanceSummary {
  total_requests: number;
  recent_requests: number;
  avg_response_time: number;
  error_rate: number;
  current_memory_mb: number;
  current_cpu_percent: number;
  slow_endpoints: Record<string, any>;
}

interface PerformanceMonitorProps {
  isCollapsed?: boolean;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ isCollapsed = false }) => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [performanceSummary, setPerformanceSummary] = useState<PerformanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

  const fetchMetrics = useCallback(async () => {
    try {
      const [systemResponse, summaryResponse] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/performance/system'),
        fetch('http://127.0.0.1:8000/api/performance/summary')
      ]);

      if (systemResponse.ok && summaryResponse.ok) {
        const systemData = await systemResponse.json();
        const summaryData = await summaryResponse.json();
        
        setSystemMetrics(systemData);
        setPerformanceSummary(summaryData);
        setError(null);
      } else {
        setError('Failed to fetch performance metrics');
      }
    } catch (err) {
      setError('Error connecting to performance API');
      console.error('Performance monitoring error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  const formatBytes = (bytes: number): string => {
    return `${(bytes / 1024).toFixed(1)} GB`;
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (value: number, type: 'cpu' | 'memory' | 'error_rate' | 'response_time'): string => {
    switch (type) {
      case 'cpu':
      case 'memory':
        if (value > 80) return colors.error;
        if (value > 60) return colors.warning;
        return colors.success;
      case 'error_rate':
        if (value > 0.05) return colors.error; // 5%
        if (value > 0.01) return colors.warning; // 1%
        return colors.success;
      case 'response_time':
        if (value > 1000) return colors.error; // 1s
        if (value > 500) return colors.warning; // 500ms
        return colors.success;
      default:
        return colors.neutral[500];
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        padding: spacing[4], 
        background: colors.dark.surface,
        borderRadius: borderRadius.md,
        border: `1px solid ${colors.dark.border}`
      }}>
        <div style={{ color: colors.dark.textMuted }}>Loading performance metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: spacing[4], 
        background: colors.dark.surface,
        borderRadius: borderRadius.md,
        border: `1px solid ${colors.error}`
      }}>
        <div style={{ color: colors.error, fontSize: '14px' }}>
          ⚠️ {error}
        </div>
        <button 
          onClick={fetchMetrics}
          style={{
            marginTop: spacing[2],
            padding: `${spacing[1]} ${spacing[3]}`,
            background: colors.primary[500],
            color: colors.neutral[0],
            border: 'none',
            borderRadius: borderRadius.sm,
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div style={{
        padding: spacing[2],
        background: colors.dark.surface,
        borderRadius: borderRadius.sm,
        display: 'flex',
        gap: spacing[2],
        alignItems: 'center',
        fontSize: '12px'
      }}>
        <div style={{ 
          color: getStatusColor(systemMetrics?.cpu_percent || 0, 'cpu'),
          fontWeight: 'bold'
        }}>
          CPU: {systemMetrics?.cpu_percent.toFixed(1)}%
        </div>
        <div style={{ 
          color: getStatusColor(systemMetrics?.memory_percent || 0, 'memory'),
          fontWeight: 'bold'
        }}>
          RAM: {systemMetrics?.memory_percent.toFixed(1)}%
        </div>
        <div style={{ 
          color: getStatusColor(performanceSummary?.avg_response_time || 0, 'response_time'),
          fontWeight: 'bold'
        }}>
          {performanceSummary?.avg_response_time.toFixed(0)}ms
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: spacing[4], 
      background: colors.dark.surface,
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.dark.border}`,
      boxShadow: shadows.sm
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[4]
      }}>
        <h3 style={{
          margin: 0,
          color: colors.dark.text,
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
          Performance Monitor
        </h3>
        <select 
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(Number(e.target.value))}
          style={{
            padding: `${spacing[1]} ${spacing[2]}`,
            background: colors.dark.bg,
            color: colors.dark.text,
            border: `1px solid ${colors.dark.border}`,
            borderRadius: borderRadius.sm,
            fontSize: '12px'
          }}
        >
          <option value={1000}>1s</option>
          <option value={5000}>5s</option>
          <option value={10000}>10s</option>
          <option value={30000}>30s</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[4] }}>
        {/* System Metrics */}
        <div>
          <h4 style={{ 
            margin: `0 0 ${spacing[2]} 0`, 
            color: colors.dark.text,
            fontSize: '14px',
            fontWeight: 'semibold'
          }}>
            System Resources
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
            <MetricBar 
              label="CPU"
              value={systemMetrics?.cpu_percent || 0}
              max={100}
              unit="%"
              color={getStatusColor(systemMetrics?.cpu_percent || 0, 'cpu')}
            />
            <MetricBar 
              label="Memory"
              value={systemMetrics?.memory_percent || 0}
              max={100}
              unit="%"
              color={getStatusColor(systemMetrics?.memory_percent || 0, 'memory')}
            />
            <MetricBar 
              label="Disk"
              value={systemMetrics?.disk_usage_percent || 0}
              max={100}
              unit="%"
              color={getStatusColor(systemMetrics?.disk_usage_percent || 0, 'memory')}
            />
          </div>
          
          <div style={{ marginTop: spacing[3], fontSize: '12px', color: colors.dark.textMuted }}>
            <div>Network: ↑{formatBytes(systemMetrics?.network_sent_mb || 0)} ↓{formatBytes(systemMetrics?.network_recv_mb || 0)}</div>
            <div>Uptime: {formatUptime(systemMetrics?.uptime_seconds || 0)}</div>
          </div>
        </div>

        {/* Application Metrics */}
        <div>
          <h4 style={{ 
            margin: `0 0 ${spacing[2]} 0`, 
            color: colors.dark.text,
            fontSize: '14px',
            fontWeight: 'semibold'
          }}>
            Application Performance
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              fontSize: '12px'
            }}>
              <span style={{ color: colors.dark.textSecondary }}>Response Time:</span>
              <span style={{ 
                color: getStatusColor(performanceSummary?.avg_response_time || 0, 'response_time'),
                fontWeight: 'bold'
              }}>
                {performanceSummary?.avg_response_time.toFixed(1)}ms
              </span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              fontSize: '12px'
            }}>
              <span style={{ color: colors.dark.textSecondary }}>Error Rate:</span>
              <span style={{ 
                color: getStatusColor(performanceSummary?.error_rate || 0, 'error_rate'),
                fontWeight: 'bold'
              }}>
                {((performanceSummary?.error_rate || 0) * 100).toFixed(2)}%
              </span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              fontSize: '12px'
            }}>
              <span style={{ color: colors.dark.textSecondary }}>Total Requests:</span>
              <span style={{ color: colors.dark.text, fontWeight: 'bold' }}>
                {performanceSummary?.total_requests || 0}
              </span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              fontSize: '12px'
            }}>
              <span style={{ color: colors.dark.textSecondary }}>Recent (5min):</span>
              <span style={{ color: colors.dark.text, fontWeight: 'bold' }}>
                {performanceSummary?.recent_requests || 0}
              </span>
            </div>
          </div>

          {/* Slow Endpoints */}
          {performanceSummary?.slow_endpoints && Object.keys(performanceSummary.slow_endpoints).length > 0 && (
            <div style={{ marginTop: spacing[3] }}>
              <div style={{ 
                fontSize: '12px', 
                color: colors.warning,
                fontWeight: 'bold',
                marginBottom: spacing[1]
              }}>
                ⚠️ Slow Endpoints:
              </div>
              {Object.entries(performanceSummary.slow_endpoints).slice(0, 3).map(([endpoint, stats]: [string, any]) => (
                <div key={endpoint} style={{ 
                  fontSize: '11px', 
                  color: colors.dark.textMuted,
                  marginBottom: spacing[1]
                }}>
                  {endpoint}: {stats.avg_response_time?.toFixed(0)}ms
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface MetricBarProps {
  label: string;
  value: number;
  max: number;
  unit: string;
  color: string;
}

const MetricBar: React.FC<MetricBarProps> = ({ label, value, max, unit, color }) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: spacing[1],
        fontSize: '12px'
      }}>
        <span style={{ color: colors.dark.textSecondary }}>{label}:</span>
        <span style={{ color: colors.dark.text, fontWeight: 'bold' }}>
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div style={{
        width: '100%',
        height: '6px',
        background: colors.dark.bg,
        borderRadius: borderRadius.sm,
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: color,
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  );
};

export default PerformanceMonitor;