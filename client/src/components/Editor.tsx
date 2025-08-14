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
    <div className="h-full w-full overflow-hidden">
      <MonacoEditor
        height="100%"
        defaultLanguage="typescript"
        defaultValue={content || '// Open or create a file to begin.'}
        theme="vs-dark"
        onMount={handleMount}
        options={{
          automaticLayout: true,
          fontSize: 14,
          minimap: { enabled: false },
          wordWrap: 'on'
        }}
      />
    </div>
  );
};

export default Editor;