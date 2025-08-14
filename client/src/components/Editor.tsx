import React, { useEffect, useRef } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditorNamespace } from 'monaco-editor';
import { useWebSocket } from '../hooks/useWebSocket';

interface EditorProps {
  filePath: string | null;
  content: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
}

/**
 * Editor component wraps the Monaco editor and integrates basic keyboard
 * shortcuts. It reacts to changes in the open file and notifies
 * parents when the buffer is modified. AI completions are stubbed via
 * WebSocket for future expansion.
 */
const Editor: React.FC<EditorProps> = ({ filePath, content, onChange, onSave }) => {
  // Keep a ref to the underlying Monaco editor instance. We use the
  // explicit namespace import to avoid referring to the global monaco
  // object directly which is not available in the renderer context.
  const editorRef = useRef<MonacoEditorNamespace.IStandaloneCodeEditor | null>(null);
  const { ready, send, messages } = useWebSocket<any, any>('ws://localhost:8000/ws/ai');

  // When the file path or content changes, update the editor. Avoid
  // stomping on the user's unsaved edits by checking the model value.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    const currentValue = model.getValue();
    if (content !== currentValue) {
      model.setValue(content);
    }
  }, [content]);

  // Save the file on Ctrl+S / Cmd+S. We attach the listener once the
  // editor mounts. When triggered we call onSave with the current
  // contents. The default action (browser save) is prevented.
  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.onKeyDown(e => {
      const isSave = (e.metaKey || e.ctrlKey) && e.keyCode === monaco.KeyCode.KeyS;
      if (isSave) {
        e.preventDefault();
        onSave(editor.getValue());
      }
    });
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      onChange(value);
      // In the future we can stream the context to the AI server for
      // completions. At the moment we just send the entire buffer as
      // plaintext on every change when the WebSocket is ready.
      if (ready) {
        send({ type: 'update', path: filePath, content: value });
      }
    });
  };

  return (
    <div style={{ 
      height: '100%', 
      width: '100%', 
      overflow: 'hidden',
      background: '#1e1e1e',
      position: 'relative'
    }}>
      {filePath && (
        <div style={{
          height: '32px',
          borderBottom: '1px solid #3c3c3c',
          background: '#2d2d30',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          fontSize: '13px',
          color: '#cccccc',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }}>
          <span style={{ 
            marginRight: '8px',
            fontSize: '14px',
            color: getFileIconColor(filePath)
          }}>
            {getFileIcon(filePath)}
          </span>
          <span style={{ fontWeight: 500 }}>
            {filePath.split('/').pop()}
          </span>
          <span style={{
            marginLeft: '8px',
            fontSize: '11px',
            opacity: 0.6
          }}>
            {filePath}
          </span>
        </div>
      )}
      <div style={{ 
        height: filePath ? 'calc(100% - 32px)' : '100%',
        position: 'relative'
      }}>
        <MonacoEditor
          height="100%"
          defaultLanguage="typescript"
          defaultValue={content || '// Open or create a file to begin coding...'}
          theme="vs-dark"
          onMount={handleMount}
          options={{
            automaticLayout: true,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
            minimap: { enabled: false },
            wordWrap: 'on',
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
            renderWhitespace: 'selection',
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorSmoothCaretAnimation: true,
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: false,
            cursorStyle: 'line',
            occurrencesHighlight: false,
            selectionHighlight: false,
            bracketPairColorization: {
              enabled: true
            }
          }}
        />
      </div>
    </div>
  );
};

// Helper function to get file type icons
function getFileIcon(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js': case 'jsx': return '🟨';
    case 'ts': case 'tsx': return '🔷';
    case 'css': return '🎨';
    case 'html': return '🌐';
    case 'json': return '📋';
    case 'md': return '📝';
    case 'py': return '🐍';
    default: return '📄';
  }
}

// Helper function to get file type colors
function getFileIconColor(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js': case 'jsx': return '#f7df1e';
    case 'ts': case 'tsx': return '#3178c6';
    case 'css': return '#1572b6';
    case 'html': return '#e34c26';
    case 'json': return '#ffd700';
    case 'md': return '#083fa1';
    case 'py': return '#3776ab';
    default: return '#75beff';
  }
}

export default Editor;