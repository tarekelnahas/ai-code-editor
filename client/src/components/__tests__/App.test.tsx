import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

// Mock fetch for API calls
global.fetch = vi.fn()

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful API responses
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok',
        model: 'test-model'
      })
    })
  })

  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByTestId('app-container')).toBeInTheDocument()
  })

  it('displays main layout components', async () => {
    render(<App />)
    
    // Check for main layout elements
    await waitFor(() => {
      expect(screen.getByTestId('top-bar')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
      expect(screen.getByTestId('editor-container')).toBeInTheDocument()
      expect(screen.getByTestId('terminal-panel')).toBeInTheDocument()
      expect(screen.getByTestId('status-bar')).toBeInTheDocument()
    })
  })

  it('handles file tab creation and switching', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('top-bar')).toBeInTheDocument()
    })

    // Simulate creating a new file tab
    const newFileButton = screen.getByTestId('new-file-button')
    await user.click(newFileButton)

    // Check that a new tab was created
    await waitFor(() => {
      expect(screen.getByText('untitled-1.txt')).toBeInTheDocument()
    })
  })

  it('handles panel collapse and expand', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    })

    // Find and click sidebar toggle
    const sidebarToggle = screen.getByTestId('sidebar-toggle')
    await user.click(sidebarToggle)

    // Check that sidebar is collapsed (might check CSS classes or attributes)
    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toHaveClass('collapsed')
    })
  })

  it('handles keyboard shortcuts', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('app-container')).toBeInTheDocument()
    })

    // Test Ctrl+P for command palette
    await user.keyboard('{Control>}p{/Control}')
    
    await waitFor(() => {
      expect(screen.getByTestId('command-palette')).toBeInTheDocument()
    })
  })

  it('displays AI status correctly', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('ai-status')).toBeInTheDocument()
    })

    // Should show online status when API is responding
    expect(screen.getByText(/online/i)).toBeInTheDocument()
  })

  it('handles WebSocket connection', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('app-container')).toBeInTheDocument()
    })

    // WebSocket should be mocked and connection attempted
    expect(global.WebSocket).toHaveBeenCalledWith('ws://127.0.0.1:8000/ws/ai')
  })

  it('handles file tree interactions', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('file-tree')).toBeInTheDocument()
    })

    // Test file selection
    const testFile = screen.getByText('test.py')
    await user.click(testFile)

    // File should be selected and opened in editor
    await waitFor(() => {
      expect(screen.getByText('test.py')).toHaveClass('selected')
    })
  })

  it('handles terminal interactions', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('terminal-panel')).toBeInTheDocument()
    })

    // Test terminal input
    const terminalInput = screen.getByTestId('terminal-input')
    await user.type(terminalInput, 'echo "Hello World"')
    await user.keyboard('{Enter}')

    // Terminal should process the command
    await waitFor(() => {
      expect(screen.getByText(/Hello World/)).toBeInTheDocument()
    })
  })

  it('handles layout resize', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('layout-container')).toBeInTheDocument()
    })

    // Find resize handle
    const resizeHandle = screen.getByTestId('sidebar-resize-handle')
    
    // Simulate drag to resize
    fireEvent.mouseDown(resizeHandle, { clientX: 280 })
    fireEvent.mouseMove(document, { clientX: 350 })
    fireEvent.mouseUp(document)

    // Layout should have updated width
    await waitFor(() => {
      const sidebar = screen.getByTestId('sidebar')
      expect(sidebar).toHaveStyle({ width: '350px' })
    })
  })

  it('displays error states gracefully', async () => {
    // Mock API error
    global.fetch.mockRejectedValueOnce(new Error('API Error'))
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('ai-status')).toBeInTheDocument()
    })

    // Should show offline status when API fails
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })

  it('handles theme switching', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
    })

    const themeToggle = screen.getByTestId('theme-toggle')
    await user.click(themeToggle)

    // Theme should switch (check CSS classes or data attributes)
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    })
  })
})