import type { Plugin } from '../types/plugin';
import React from 'react';

/**
 * Example plugin demonstrating how to extend the host. It adds a command
 * that displays an alert and a simple panel. Real plugins could do
 * anything from adding code actions to integrating task runners.
 */

const HelloPanel: React.FC = () => {
  return (
    <div className="p-2 text-sm">
      <h2 className="font-semibold mb-1">Example Plugin</h2>
      <p>This panel was contributed by the example plugin. You can register your own panels from any plugin.</p>
    </div>
  );
};

const examplePlugin: Plugin = {
  name: 'example-plugin',
  activate(ctx) {
    ctx.registerCommand('example.sayHello', () => {
      window.alert('Hello from the example plugin!');
    });
    ctx.registerPanel(HelloPanel, 'example-plugin.panel');
  }
};

export default examplePlugin;