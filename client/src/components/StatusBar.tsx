import React, { useState, useEffect, useCallback } from "react";
import { colors, spacing, typography, borderRadius } from '../design/theme';
import { buttonStyles } from '../design/components';

interface StatusBarProps {
  activeFile: string | null;
  hasUnsavedChanges: boolean;
  layout: {
    isSidebarCollapsed: boolean;
    isTerminalCollapsed: boolean;
    isRightPanelCollapsed: boolean;
    terminalHeight: number;
  };
}

interface SystemStatus {
  device: string;
  seed: number;
  memory: string;
  cpu: string;
  branch: string;
  provider: string;
  aiStatus: 'online' | 'offline' | 'connecting';
  projectStats?: {
    files: number;
    lines: number;
    size: string;
  };
}

/**
 * Context 7 Rebuilt StatusBar Component
 * 
 * Features:
 * - Real-time system monitoring
 * - Git integration with branch and status
 * - AI model status and provider info
 * - Project statistics and metrics
 * - File encoding and position info
 * - Performance metrics and diagnostics
 * - Quick action buttons
 */
export default function StatusBar({ 
  activeFile, 
  hasUnsavedChanges, 
  layout 
}: StatusBarProps) {
  const [status, setStatus] = useState<SystemStatus>({
    device: 'cpu',
    seed: 0,
    memory: '~1.2GB',
    cpu: '18%',
    branch: 'main',
    provider: 'TinyLLaMA',
    aiStatus: 'connecting'
  });

  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch system status periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/system/status');
        if (response.ok) {
          const data = await response.json();
          setStatus(prev => ({
            ...prev,
            ...data,
            aiStatus: 'online'
          }));
        } else {
          setStatus(prev => ({ ...prev, aiStatus: 'offline' }));
        }
      } catch (error) {
        console.error('Failed to fetch system status:', error);
        setStatus(prev => ({ ...prev, aiStatus: 'offline' }));
      }
    };

    fetchStatus();
    const intervalId = setInterval(fetchStatus, 15000); // Refresh every 15 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Update current time
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Get file language and encoding
  const getFileInfo = useCallback(() => {
    if (!activeFile) return null;

    const extension = activeFile.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'JavaScript',
      'jsx': 'JavaScript React',
      'ts': 'TypeScript',
      'tsx': 'TypeScript React',
      'py': 'Python',
      'rs': 'Rust',
      'go': 'Go',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'html': 'HTML',
      'css': 'CSS',
      'json': 'JSON',
      'md': 'Markdown'
    };

    return {
      language: languageMap[extension || ''] || 'Plain Text',
      encoding: 'UTF-8'
    };
  }, [activeFile]);

  const fileInfo = getFileInfo();

  // Status bar sections
  const leftSection = () => (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: spacing[4],
      fontSize: typography.sizes.xs
    }}>
      {/* Git status */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: spacing[2]
      }}>
        <span style={{ fontSize: '14px' }}>🌿</span>
        <span>
          <strong>{status.branch}</strong>
          {hasUnsavedChanges && (
            <span style={{ 
              color: colors.warning,
              marginLeft: spacing[1]
            }}>
              ● {hasUnsavedChanges ? '1' : '0'}
            </span>
          )}
        </span>
      </div>

      {/* AI status */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: spacing[2],
        padding: `${spacing[1]} ${spacing[2]}`,
        background: status.aiStatus === 'online' 
          ? `${colors.success}20` 
          : status.aiStatus === 'offline' 
            ? `${colors.error}20` 
            : `${colors.warning}20`,
        borderRadius: borderRadius.sm,
        border: `1px solid ${status.aiStatus === 'online' 
          ? `${colors.success}40` 
          : status.aiStatus === 'offline' 
            ? `${colors.error}40` 
            : `${colors.warning}40`}`
      }}>
        <span style={{ fontSize: '12px' }}>
          {status.aiStatus === 'online' ? '🤖' : status.aiStatus === 'offline' ? '🔴' : '🟡'}
        </span>
        <span style={{
          color: status.aiStatus === 'online' 
            ? colors.success 
            : status.aiStatus === 'offline' 
              ? colors.error 
              : colors.warning
        }}>
          {status.provider} {status.aiStatus}
        </span>
      </div>

      {/* System performance */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: spacing[3]
      }}>
        <span>💻 CPU: <strong>{status.cpu}</strong></span>
        <span>🧠 RAM: <strong>{status.memory}</strong></span>
        <span>🎯 Device: <strong>{status.device.toUpperCase()}</strong></span>
      </div>
    </div>
  );

  const centerSection = () => activeFile && fileInfo && (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: spacing[4],
      fontSize: typography.sizes.xs
    }}>
      {/* File info */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: spacing[2]
      }}>
        <span style={{ fontSize: '12px' }}>📄</span>
        <span><strong>{fileInfo.language}</strong></span>
        <span style={{ opacity: 0.7 }}>|</span>
        <span>{fileInfo.encoding}</span>
      </div>

      {/* Layout status */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: spacing[1]
      }}>
        <span style={{ opacity: 0.7 }}>Layout:</span>
        <span style={{ color: layout.isSidebarCollapsed ? colors.error : colors.success }}>
          📁{layout.isSidebarCollapsed ? '×' : '✓'}
        </span>
        <span style={{ color: layout.isTerminalCollapsed ? colors.error : colors.success }}>
          💻{layout.isTerminalCollapsed ? '×' : '✓'}
        </span>
        <span style={{ color: layout.isRightPanelCollapsed ? colors.error : colors.success }}>
          🤖{layout.isRightPanelCollapsed ? '×' : '✓'}
        </span>
      </div>
    </div>
  );

  const rightSection = () => (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: spacing[3],
      fontSize: typography.sizes.xs
    }}>
      {/* Project stats */}
      {status.projectStats && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: spacing[2]
        }}>
          <span>📊</span>
          <span>{status.projectStats.files} files</span>
          <span style={{ opacity: 0.7 }}>|</span>
          <span>{status.projectStats.lines} lines</span>
          <span style={{ opacity: 0.7 }}>|</span>
          <span>{status.projectStats.size}</span>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: spacing[1]
      }}>
        <button
          onClick={() => setShowDetailedStats(!showDetailedStats)}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.ghost,
            padding: `${spacing[1]} ${spacing[2]}`,
            fontSize: typography.sizes.xs,
            height: '24px'
          }}
          title="Show detailed statistics"
        >
          📊 Stats
        </button>

        <button
          style={{
            ...buttonStyles.base,
            ...buttonStyles.ghost,
            padding: `${spacing[1]} ${spacing[2]}`,
            fontSize: typography.sizes.xs,
            height: '24px'
          }}
          title="View logs"
        >
          📋 Logs
        </button>
      </div>

      {/* Current time */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: spacing[1],
        opacity: 0.8
      }}>
        <span style={{ fontSize: '12px' }}>🕐</span>
        <span>{currentTime.toLocaleTimeString()}</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Main status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '32px',
        padding: `0 ${spacing[4]}`,
        borderTop: `1px solid ${colors.dark.border}`,
        background: `linear-gradient(135deg, ${colors.primary[600]} 0%, ${colors.primary[700]} 100%)`,
        color: colors.neutral[0],
        fontSize: typography.sizes.xs,
        fontFamily: typography.fonts.sans,
        fontWeight: typography.weights.medium,
        boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        {leftSection()}
        {centerSection()}
        {rightSection()}
      </div>

      {/* Detailed stats overlay */}
      {showDetailedStats && (
        <div style={{
          position: 'absolute',
          bottom: '32px',
          right: spacing[4],
          width: '320px',
          background: colors.dark.elevated,
          border: `1px solid ${colors.dark.border}`,
          borderRadius: borderRadius.lg,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          zIndex: 1000
        }}>
          <div style={{
            padding: spacing[4],
            borderBottom: `1px solid ${colors.dark.border}`
          }}>
            <h4 style={{
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.bold,
              color: colors.dark.text,
              margin: 0,
              marginBottom: spacing[2]
            }}>
              System Statistics
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: spacing[2],
              fontSize: typography.sizes.xs,
              color: colors.dark.textSecondary
            }}>
              <div>CPU: {status.cpu}</div>
              <div>Memory: {status.memory}</div>
              <div>Device: {status.device}</div>
              <div>Seed: {status.seed}</div>
              <div>AI Status: {status.aiStatus}</div>
              <div>Provider: {status.provider}</div>
            </div>
          </div>
          
          {activeFile && fileInfo && (
            <div style={{ padding: spacing[4] }}>
              <h5 style={{
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.semibold,
                color: colors.dark.text,
                margin: 0,
                marginBottom: spacing[2]
              }}>
                Current File
              </h5>
              <div style={{
                fontSize: typography.sizes.xs,
                color: colors.dark.textSecondary,
                lineHeight: typography.lineHeight.relaxed
              }}>
                <div>Path: {activeFile}</div>
                <div>Language: {fileInfo.language}</div>
                <div>Encoding: {fileInfo.encoding}</div>
                <div>Status: {hasUnsavedChanges ? 'Modified' : 'Saved'}</div>
              </div>
            </div>
          )}

          <div style={{
            padding: spacing[2],
            borderTop: `1px solid ${colors.dark.border}`,
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={() => setShowDetailedStats(false)}
              style={{
                ...buttonStyles.base,
                ...buttonStyles.ghost,
                padding: `${spacing[1]} ${spacing[3]}`,
                fontSize: typography.sizes.xs
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}