import '@testing-library/jest-dom'

// Mock Monaco Editor
const mockMonaco = {
  editor: {
    create: vi.fn(() => ({
      dispose: vi.fn(),
      getValue: vi.fn(() => ''),
      setValue: vi.fn(),
      onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() })),
      layout: vi.fn(),
      focus: vi.fn(),
      getModel: vi.fn(() => ({
        dispose: vi.fn()
      }))
    })),
    createModel: vi.fn(() => ({
      dispose: vi.fn()
    })),
    defineTheme: vi.fn(),
    setTheme: vi.fn()
  },
  languages: {
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    setLanguageConfiguration: vi.fn()
  }
}

// Mock the monaco-editor module
vi.mock('monaco-editor', () => mockMonaco)
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ onChange, value, language, theme, options }) => {
    return (
      <div data-testid="monaco-editor" data-language={language} data-theme={theme}>
        <textarea 
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          data-testid="monaco-textarea"
        />
      </div>
    )
  })
}))

// Mock xterm
vi.mock('xterm', () => ({
  Terminal: vi.fn(() => ({
    open: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    loadAddon: vi.fn()
  }))
}))

vi.mock('xterm-addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    activate: vi.fn(),
    dispose: vi.fn(),
    fit: vi.fn()
  }))
}))

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
})) as any

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
})) as any

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
})) as any