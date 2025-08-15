import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Editor from '../Editor'

describe('Editor Component', () => {
  const defaultProps = {
    value: 'console.log("Hello World");',
    onChange: vi.fn(),
    language: 'javascript',
    theme: 'vs-dark',
    file: {
      id: '1',
      name: 'test.js',
      path: '/test.js',
      content: 'console.log("Hello World");',
      language: 'javascript',
      isDirty: false
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders editor with correct props', async () => {
    render(<Editor {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
    })
    
    const editor = screen.getByTestId('monaco-editor')
    expect(editor).toHaveAttribute('data-language', 'javascript')
    expect(editor).toHaveAttribute('data-theme', 'vs-dark')
  })

  it('displays file information in toolbar', async () => {
    render(<Editor {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('editor-toolbar')).toBeInTheDocument()
    })
    
    expect(screen.getByText('test.js')).toBeInTheDocument()
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
  })

  it('shows cursor position', async () => {
    render(<Editor {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('cursor-position')).toBeInTheDocument()
    })
    
    // Should show line and column
    expect(screen.getByText(/Line 1, Column 1/)).toBeInTheDocument()
  })

  it('handles content changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(<Editor {...defaultProps} onChange={onChange} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('monaco-textarea')).toBeInTheDocument()
    })
    
    const textarea = screen.getByTestId('monaco-textarea')
    await user.type(textarea, '\nconsole.log("New line");')
    
    expect(onChange).toHaveBeenCalled()
  })

  it('supports different languages', async () => {
    const { rerender } = render(<Editor {...defaultProps} language="python" />)
    
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'python')
    })
    
    rerender(<Editor {...defaultProps} language="typescript" />)
    
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'typescript')
    })
  })

  it('shows file dirty state', async () => {
    const dirtyFile = { ...defaultProps.file, isDirty: true }
    render(<Editor {...defaultProps} file={dirtyFile} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('file-dirty-indicator')).toBeInTheDocument()
    })
    
    expect(screen.getByText('●')).toBeInTheDocument() // Dirty indicator
  })

  it('handles save shortcut', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    
    render(<Editor {...defaultProps} onSave={onSave} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
    })
    
    // Simulate Ctrl+S
    await user.keyboard('{Control>}s{/Control}')
    
    expect(onSave).toHaveBeenCalled()
  })

  it('displays line count', async () => {
    const multiLineContent = 'line 1\nline 2\nline 3'
    render(<Editor {...defaultProps} value={multiLineContent} />)
    
    await waitFor(() => {
      expect(screen.getByText('3 lines')).toBeInTheDocument()
    })
  })

  it('handles different themes', async () => {
    const { rerender } = render(<Editor {...defaultProps} theme="vs-light" />)
    
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-theme', 'vs-light')
    })
    
    rerender(<Editor {...defaultProps} theme="vs-dark" />)
    
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-theme', 'vs-dark')
    })
  })

  it('shows encoding information', async () => {
    render(<Editor {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('UTF-8')).toBeInTheDocument()
    })
  })

  it('handles empty file', async () => {
    const emptyFile = { ...defaultProps.file, content: '', name: 'empty.js' }
    render(<Editor {...defaultProps} file={emptyFile} value="" />)
    
    await waitFor(() => {
      expect(screen.getByText('empty.js')).toBeInTheDocument()
      expect(screen.getByText('0 lines')).toBeInTheDocument()
    })
  })

  it('supports word wrap toggle', async () => {
    const user = userEvent.setup()
    render(<Editor {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('word-wrap-toggle')).toBeInTheDocument()
    })
    
    const wordWrapToggle = screen.getByTestId('word-wrap-toggle')
    await user.click(wordWrapToggle)
    
    // Should toggle word wrap setting
    expect(wordWrapToggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('displays syntax errors', async () => {
    const invalidJS = 'console.log("missing quote);'
    render(<Editor {...defaultProps} value={invalidJS} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('error-indicator')).toBeInTheDocument()
    })
    
    expect(screen.getByText(/1 error/)).toBeInTheDocument()
  })
})