import type React from 'react';

/**
 * A plugin defines an activate function that receives a PluginContext. When
 * activated the plugin can register commands, panels or other contributions
 * to extend the editor. Plugins are loaded automatically from the
 * src/plugins directory by the PluginProvider.
 */
export interface Plugin {
  name: string;
  /**
   * Called when the plugin is loaded. Use the context to contribute
   * functionality to the host application.
   */
  activate: (ctx: PluginContext) => void;
}

export interface PluginContext {
  /**
   * Register a command that can be invoked via the command palette or
   * programmatically. The id should be globally unique.
   */
  registerCommand: (id: string, callback: (...args: any[]) => void) => void;
  /**
   * Register a React component to render in a named panel. Panels are
   * displayed in the AgentPanel column by default.
   */
  registerPanel: (component: React.ComponentType<any>, name: string) => void;
}