import type { Plugin } from '../types/plugin';
import React from 'react';
import QualityHub from '../quality/QualityHub';

/**
 * qualityHubPlugin registers the Quality Hub panel with the
 * application. This panel aggregates dozens of third‑party tools and
 * presents them in a single interface where users can browse
 * categories and run individual tools on demand. The plugin is
 * intentionally light, delegating all heavy lifting to the server
 * endpoints.
 */
const qualityHubPlugin: Plugin = {
  name: 'quality-hub-plugin',
  activate(ctx) {
    ctx.registerPanel(QualityHub, 'quality.hub');
  },
};

export default qualityHubPlugin;