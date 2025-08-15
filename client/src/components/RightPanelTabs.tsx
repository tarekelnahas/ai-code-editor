import React, { useState, useMemo } from "react";
import QualityHub from "../quality/QualityHub";
import AIToolsChat from "./AIToolsChat";
import ExperimentDashboard from "./ExperimentDashboard";
import { colors, spacing, typography, borderRadius } from '../design/theme';
import { buttonStyles } from '../design/components';

interface RightPanelTabsProps {
  isCollapsed: boolean;
  activeFile: string | null;
  fileContent: string;
}

interface TabConfig {
  id: string;
  label: string;
  icon: string;
  component: React.ReactNode;
  description: string;
  badge?: string | number;
}

/**
 * Context 7 Rebuilt Right Panel Component
 * 
 * Features:
 * - Enhanced AI tools integration
 * - Quality analysis with real-time feedback
 * - Experiment tracking and management
 * - Collapsible view with icon-only mode
 * - Context-aware content based on active file
 * - Improved accessibility and navigation
 */
export default function RightPanelTabs({ 
  isCollapsed, 
  activeFile, 
  fileContent 
}: RightPanelTabsProps) {
  const [activeTab, setActiveTab] = useState<string>("chat");

  // Dynamic tab configuration based on context
  const tabConfigs: TabConfig[] = useMemo(() => [
    {
      id: "chat",
      label: "AI Assistant",
      icon: "🤖",
      description: "Get AI help with coding, debugging, and explanations",
      component: (
        <AIToolsChat 
          activeFile={activeFile}
          fileContent={fileContent}
        />
      ),
      badge: "NEW"
    },
    {
      id: "quality",
      label: "Code Quality",
      icon: "🔍",
      description: "Analyze code quality, performance, and best practices",
      component: <QualityHub activeFile={activeFile} fileContent={fileContent} />
    },
    {
      id: "experiments",
      label: "Experiments",
      icon: "🔬",
      description: "Manage and track development experiments",
      component: <ExperimentDashboard activeFile={activeFile} />
    },
    {
      id: "insights",
      label: "Insights",
      icon: "📊",
      description: "Code analytics and development insights",
      component: <CodeInsights activeFile={activeFile} fileContent={fileContent} />
    },
    {
      id: "docs",
      label: "Documentation",
      icon: "📚",
      description: "Auto-generated documentation and guides",
      component: <DocumentationPanel activeFile={activeFile} fileContent={fileContent} />
    }
  ], [activeFile, fileContent]);

  const activeTabConfig = tabConfigs.find(tab => tab.id === activeTab) || tabConfigs[0];

  // Collapsed view with icon-only tabs
  if (isCollapsed) {
    return (
      <div style={{
        width: '60px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: colors.dark.surface,
        borderLeft: `1px solid ${colors.dark.border}`
      }}>
        {tabConfigs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...buttonStyles.base,
              ...buttonStyles.ghost,
              width: '60px',
              height: '60px',
              fontSize: '20px',
              flexDirection: 'column',
              gap: spacing[1],
              background: tab.id === activeTab ? colors.primary[500] + '20' : 'transparent',
              border: `2px solid ${tab.id === activeTab ? colors.primary[500] : 'transparent'}`,
              borderRadius: 0
            }}
            title={`${tab.label}: ${tab.description}`}
            aria-label={tab.label}
          >
            <span>{tab.icon}</span>
            {tab.badge && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: colors.primary[500],
                color: colors.neutral[0],
                fontSize: '8px',
                padding: '2px 4px',
                borderRadius: borderRadius.full,
                minWidth: '16px',
                textAlign: 'center'
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Full view with tabbed interface
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: colors.dark.surface,
      fontFamily: typography.fonts.sans
    }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${colors.dark.border}`,
        background: colors.dark.elevated,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {tabConfigs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...buttonStyles.base,
              flex: '1 0 auto',
              minWidth: '80px',
              height: '48px',
              padding: `${spacing[2]} ${spacing[3]}`,
              borderRadius: 0,
              fontSize: typography.sizes.sm,
              fontWeight: tab.id === activeTab ? typography.weights.semibold : typography.weights.normal,
              background: tab.id === activeTab 
                ? colors.primary[500] 
                : 'transparent',
              color: tab.id === activeTab 
                ? colors.neutral[0] 
                : colors.dark.textSecondary,
              border: 'none',
              borderBottom: `3px solid ${tab.id === activeTab ? colors.primary[500] : 'transparent'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[2],
              position: 'relative',
              transition: 'all 150ms ease'
            }}
            onMouseEnter={(e) => {
              if (tab.id !== activeTab) {
                e.currentTarget.style.background = colors.dark.surface;
                e.currentTarget.style.color = colors.dark.text;
              }
            }}
            onMouseLeave={(e) => {
              if (tab.id !== activeTab) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = colors.dark.textSecondary;
              }
            }}
            title={tab.description}
            aria-label={tab.label}
            role="tab"
            aria-selected={tab.id === activeTab}
          >
            <span style={{ fontSize: '16px' }}>{tab.icon}</span>
            <span style={{ 
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {tab.label}
            </span>
            {tab.badge && (
              <span style={{
                background: tab.id === activeTab ? colors.neutral[0] : colors.primary[500],
                color: tab.id === activeTab ? colors.primary[500] : colors.neutral[0],
                fontSize: typography.sizes.xs,
                padding: `${spacing[1]} ${spacing[2]}`,
                borderRadius: borderRadius.full,
                fontWeight: typography.weights.bold,
                minWidth: '18px',
                textAlign: 'center',
                lineHeight: 1
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content Header */}
      <div style={{
        padding: spacing[4],
        borderBottom: `1px solid ${colors.dark.border}`,
        background: colors.dark.surface
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[3],
          marginBottom: spacing[2]
        }}>
          <span style={{ fontSize: '24px' }}>{activeTabConfig.icon}</span>
          <div>
            <h3 style={{
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.bold,
              color: colors.dark.text,
              margin: 0,
              fontFamily: typography.fonts.display
            }}>
              {activeTabConfig.label}
            </h3>
            <p style={{
              fontSize: typography.sizes.sm,
              color: colors.dark.textSecondary,
              margin: 0,
              lineHeight: typography.lineHeight.normal
            }}>
              {activeTabConfig.description}
            </p>
          </div>
        </div>

        {/* Context indicator */}
        {activeFile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
            padding: `${spacing[2]} ${spacing[3]}`,
            background: colors.dark.elevated,
            borderRadius: borderRadius.md,
            border: `1px solid ${colors.dark.border}`
          }}>
            <span style={{ fontSize: '14px' }}>📄</span>
            <span style={{
              fontSize: typography.sizes.sm,
              color: colors.dark.text,
              fontWeight: typography.weights.medium
            }}>
              Working on: {activeFile.split('/').pop()}
            </span>
            <span style={{
              fontSize: typography.sizes.xs,
              color: colors.dark.textMuted,
              marginLeft: 'auto'
            }}>
              {fileContent.split('\n').length} lines
            </span>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {activeTabConfig.component}
      </div>
    </div>
  );
}

// Placeholder components for additional tabs
const CodeInsights: React.FC<{ activeFile: string | null; fileContent: string }> = ({ activeFile, fileContent }) => (
  <div style={{ padding: spacing[4], color: colors.dark.textSecondary }}>
    <div style={{ textAlign: 'center', padding: spacing[8] }}>
      <div style={{ fontSize: '48px', marginBottom: spacing[4] }}>📊</div>
      <h3 style={{ color: colors.dark.text, marginBottom: spacing[2] }}>Code Insights</h3>
      <p>Analytics and insights for your codebase coming soon...</p>
      {activeFile && (
        <div style={{ marginTop: spacing[4], padding: spacing[3], background: colors.dark.elevated, borderRadius: borderRadius.md }}>
          <strong>Current file stats:</strong>
          <ul style={{ textAlign: 'left', marginTop: spacing[2] }}>
            <li>Lines: {fileContent.split('\n').length}</li>
            <li>Characters: {fileContent.length}</li>
            <li>Words: {fileContent.split(/\s+/).length}</li>
          </ul>
        </div>
      )}
    </div>
  </div>
);

const DocumentationPanel: React.FC<{ activeFile: string | null; fileContent: string }> = ({ activeFile, fileContent }) => (
  <div style={{ padding: spacing[4], color: colors.dark.textSecondary }}>
    <div style={{ textAlign: 'center', padding: spacing[8] }}>
      <div style={{ fontSize: '48px', marginBottom: spacing[4] }}>📚</div>
      <h3 style={{ color: colors.dark.text, marginBottom: spacing[2] }}>Documentation</h3>
      <p>Auto-generated documentation and guides coming soon...</p>
      {activeFile && (
        <div style={{ marginTop: spacing[4] }}>
          <button style={{
            ...buttonStyles.base,
            ...buttonStyles.primary
          }}>
            Generate Docs for {activeFile.split('/').pop()}
          </button>
        </div>
      )}
    </div>
  </div>
);