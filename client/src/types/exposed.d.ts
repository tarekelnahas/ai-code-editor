declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, listener: (...args: any[]) => void) => () => void;
    };
    platform: {
      platform: string;
      env?: string;
    };
  }
}

export {};