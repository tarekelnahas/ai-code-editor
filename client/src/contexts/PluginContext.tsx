import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { Plugin, PluginContext as PluginCtx } from '../types/plugin';

/**
 * PluginContext allows extensions to register commands and panels. The
 * application passes this context into each plugin's activate function.
 */
const InternalPluginContext = createContext<PluginCtx>({
  registerCommand: () => void 0,
  registerPanel: () => void 0
});

interface RegisteredCommand {
  id: string;
  callback: (...args: any[]) => void;
}

interface RegisteredPanel {
  name: string;
  component: React.ComponentType<any>;
}

export const PluginProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [commands, setCommands] = useState<RegisteredCommand[]>([]);
  const [panels, setPanels] = useState<RegisteredPanel[]>([]);
  const initialized = useRef(false);

  // Provide functions to register commands and panels. When called by plugins
  // these update local state, triggering re‑renders where necessary.
  const pluginAPI: PluginCtx = {
    registerCommand(id, callback) {
      setCommands(prev => {
        const existing = prev.find(cmd => cmd.id === id);
        if (existing) {
          console.warn(`Command ${id} already registered, skipping duplicate`);
          return prev;
        }
        return [...prev, { id, callback }];
      });
    },
    registerPanel(component, name) {
      setPanels(prev => {
        const existing = prev.find(panel => panel.name === name);
        if (existing) {
          console.warn(`Panel ${name} already registered, skipping duplicate`);
          return prev;
        }
        return [...prev, { name, component }];
      });
    }
  };

  // Dynamically import and activate all plugins under src/plugins. During
  // development Vite will automatically detect new files. In production the
  // imports are bundled statically at build time.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Vite's glob import signature
    const modules = import.meta.glob('../plugins/**/*.{ts,tsx}', { eager: true });
    Object.values(modules).forEach((mod: any) => {
      const plugin: Plugin | undefined = mod.default;
      if (plugin && typeof plugin.activate === 'function') {
        try {
          plugin.activate(pluginAPI);
        } catch (err) {
          console.error(`Plugin ${plugin.name} failed to activate`, err);
        }
      }
    });
  }, []);

  return (
    <InternalPluginContext.Provider value={pluginAPI}>
      {children}
      {/* Render panels registered by plugins after the rest of the UI. */}
      {panels.map(({ name, component: Component }) => (
        <Component key={name} />
      ))}
    </InternalPluginContext.Provider>
  );
};

export function usePluginContext(): PluginCtx {
  return useContext(InternalPluginContext);
}