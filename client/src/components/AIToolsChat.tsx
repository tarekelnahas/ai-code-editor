import React, { useState, useEffect, useRef } from 'react';
import { fetchJson, API_BASE } from "../utils/net";

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  id: string;
  isStreaming?: boolean;
  tokens?: number;
}

// Chat templates for quick prompts
const CHAT_TEMPLATES = [
  { name: "Code Review", prompt: "Please review this code for bugs, performance, and best practices:\n\n```\n[paste your code here]\n```" },
  { name: "Explain Code", prompt: "Explain what this code does in simple terms:\n\n```\n[paste your code here]\n```" },
  { name: "Debug Help", prompt: "I'm getting an error with my code. Here's the error and code:\n\nError: [paste error here]\n\nCode:\n```\n[paste code here]\n```" },
  { name: "Optimize Code", prompt: "How can I optimize this code for better performance?\n\n```\n[paste your code here]\n```" },
  { name: "Write Tests", prompt: "Write unit tests for this function:\n\n```\n[paste your function here]\n```" },
  { name: "API Design", prompt: "Help me design a REST API for [describe your use case]" }
];

export default function AIToolsChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load available tools on mount
  useEffect(() => {
    fetchJson(`${API_BASE}/api/tools`)
      .then(tools => {
        const toolNames = tools.map((t: any) => t.name);
        setAvailableTools(toolNames.slice(0, 20)); // Show first 20 tools
      })
      .catch(console.error);
  }, []);

  // Load chat history from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem('ai-chat-history');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.slice(-50)); // Keep last 50 messages
      } catch (e) {
        console.warn('Failed to load chat history:', e);
      }
    }
  }, []);

  // Save chat history to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ai-chat-history', JSON.stringify(messages));
    }
  }, [messages]);

  const generateMessageId = () => Math.random().toString(36).substr(2, 9);

  const sendMessage = async (useStreaming = true) => {
    if (!input.trim() || loading) return;

    const messageId = generateMessageId();
    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
      id: generateMessageId()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    if (useStreaming) {
      // Try WebSocket streaming first
      try {
        await sendStreamingMessage(currentInput, messageId);
        return;
      } catch (error) {
        console.warn('WebSocket streaming failed, falling back to REST:', error);
      }
    }

    // Fallback to REST API
    try {
      const enhancedPrompt = `${currentInput}

Available tools you can use:
${availableTools.join(', ')}

To run a tool, you can ask me to "run [tool name]" and I'll execute it for you.
`;

      const response = await fetchJson(`${API_BASE}/ai/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          role: 'general'
        })
      });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content || 'No response received',
        timestamp: new Date().toISOString(),
        id: messageId
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Check if the AI response mentions running a tool
      const toolRunPattern = /run\s+([a-zA-Z0-9\-\.]+)/i;
      const match = response.content.match(toolRunPattern);
      
      if (match && availableTools.includes(match[1])) {
        const toolName = match[1];
        
        // Actually run the tool
        try {
          const toolResponse = await fetchJson(`${API_BASE}/api/tools/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: toolName })
          });

          const toolMessage: ChatMessage = {
            role: 'system',
            content: `🔧 Ran ${toolName}:\nStatus: ${toolResponse.status}\nOutput: ${toolResponse.output}`,
            timestamp: new Date().toISOString()
          };

          setMessages(prev => [...prev, toolMessage]);
        } catch (error) {
          const errorMessage: ChatMessage = {
            role: 'system',
            content: `❌ Failed to run ${toolName}: ${error}`,
            timestamp: new Date().toISOString()
          };

          setMessages(prev => [...prev, errorMessage]);
        }
      }

    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const sendStreamingMessage = async (prompt: string, messageId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Close existing connection
      if (wsConnection) {
        wsConnection.close();
      }

      const ws = new WebSocket(`ws://127.0.0.1:8000/ws/ai`);
      setWsConnection(ws);
      setStreamingMessageId(messageId);

      // Add empty assistant message for streaming
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        id: messageId,
        isStreaming: true
      };
      setMessages(prev => [...prev, assistantMessage]);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'user',
          content: prompt
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'assistant' || data.type === 'thinking') {
            setMessages(prev => prev.map(msg => 
              msg.id === messageId 
                ? { ...msg, content: msg.content + (data.content || ''), isStreaming: data.type !== 'assistant' }
                : msg
            ));
          } else if (data.type === 'error') {
            setMessages(prev => prev.map(msg => 
              msg.id === messageId 
                ? { ...msg, content: `Error: ${data.content}`, isStreaming: false }
                : msg
            ));
            reject(new Error(data.content));
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };

      ws.onclose = () => {
        setWsConnection(null);
        setStreamingMessageId(null);
        setLoading(false);
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, isStreaming: false } : msg
        ));
        resolve();
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnection(null);
        setStreamingMessageId(null);
        setLoading(false);
        reject(error);
      };
    });
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const deleteMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem('ai-chat-history');
  };

  const applyTemplate = (template: typeof CHAT_TEMPLATES[0]) => {
    setInput(template.prompt);
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else if (e.key === 'Escape') {
      setShowTemplates(false);
    }
  };

  // Simple code syntax highlighting
  const highlightCode = (content: string) => {
    return content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<div style="background: #1e1e1e; border: 1px solid #444; border-radius: 6px; padding: 12px; margin: 8px 0; overflow-x: auto;">
        <div style="color: #888; font-size: 11px; margin-bottom: 6px;">${lang || 'code'}</div>
        <pre style="margin: 0; color: #d4d4d4; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; line-height: 1.4;">${code.trim()}</pre>
      </div>`;
    });
  };

  return (
    <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 0}} data-version="upgraded-v2">
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #3c3c3c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: '16px'}}>🤖</span>
          <span style={{fontSize: 14, fontWeight: 600, color: '#cccccc'}}>AI Assistant</span>
          <span style={{fontSize: '11px', background: 'rgba(0, 122, 204, 0.15)', padding: '3px 8px', borderRadius: '12px', color: '#007acc'}}>
            {availableTools.length} tools
          </span>
        </div>
        <div style={{display: 'flex', gap: 8}}>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            style={{
              background: 'none',
              border: '1px solid #484848',
              color: '#cccccc',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 11,
              cursor: 'pointer'
            }}
            title="Quick Templates"
          >
            📝 Templates
          </button>
          <button
            onClick={clearHistory}
            style={{
              background: 'none',
              border: '1px solid #484848',
              color: '#cccccc',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 11,
              cursor: 'pointer'
            }}
            title="Clear Chat History"
          >
            🗑️ Clear
          </button>
        </div>
      </div>
      
      {/* Templates Dropdown */}
      {showTemplates && (
        <div style={{
          background: '#2d2d30',
          borderBottom: '1px solid #3c3c3c',
          padding: '8px 16px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <div style={{fontSize: 12, color: '#888', marginBottom: 8}}>Quick Templates:</div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8}}>
            {CHAT_TEMPLATES.map((template, idx) => (
              <button
                key={idx}
                onClick={() => applyTemplate(template)}
                style={{
                  background: '#1e1e1e',
                  border: '1px solid #484848',
                  color: '#cccccc',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#1e1e1e'}
              >
                <div style={{fontWeight: 600, marginBottom: 4}}>{template.name}</div>
                <div style={{fontSize: 10, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  {template.prompt.substring(0, 60)}...
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px',
        background: '#252526'
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#888',
            fontSize: 14
          }}>
            <div style={{fontSize: 48, marginBottom: 16}}>💬</div>
            <div style={{marginBottom: 8}}>Welcome to AI Assistant!</div>
            <div style={{fontSize: 12, opacity: 0.8}}>
              Ask me anything about code, get help with debugging, or use templates for common tasks.
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div 
            key={msg.id || idx} 
            style={{
              marginBottom: 20,
              padding: '16px 20px',
              borderRadius: 12,
              background: msg.role === 'user' ? 'rgba(0, 122, 204, 0.08)' : 
                          msg.role === 'system' ? 'rgba(255, 152, 0, 0.08)' : 
                          'rgba(40, 40, 40, 0.6)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(0, 122, 204, 0.2)' : 
                                    msg.role === 'system' ? 'rgba(255, 152, 0, 0.2)' : 
                                    'rgba(60, 60, 60, 0.4)'}`,
              position: 'relative',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              const actions = e.currentTarget.querySelector('.message-actions') as HTMLElement;
              if (actions) actions.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              const actions = e.currentTarget.querySelector('.message-actions') as HTMLElement;
              if (actions) actions.style.opacity = '0';
            }}
          >
            {/* Message Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                color: msg.role === 'user' ? '#007acc' : 
                       msg.role === 'system' ? '#ff9800' : '#4caf50'
              }}>
                <span style={{fontSize: 14}}>
                  {msg.role === 'user' ? '👤' : msg.role === 'system' ? '⚙️' : '🤖'}
                </span>
                {msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}
                {msg.isStreaming && (
                  <span style={{
                    fontSize: 10,
                    background: '#4caf50',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    animation: 'pulse 1.5s infinite'
                  }}>
                    streaming...
                  </span>
                )}
                {msg.timestamp && (
                  <span style={{opacity: 0.6, fontSize: 10, fontWeight: 400}}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
              
              {/* Message Actions */}
              <div 
                className="message-actions"
                style={{
                  display: 'flex',
                  gap: 6,
                  opacity: 0,
                  transition: 'opacity 0.15s ease'
                }}
              >
                <button
                  onClick={() => copyMessage(msg.content)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: '#cccccc',
                    padding: '4px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    cursor: 'pointer'
                  }}
                  title="Copy message"
                >
                  📋
                </button>
                {msg.role !== 'system' && (
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    style={{
                      background: 'rgba(244, 67, 54, 0.2)',
                      border: 'none',
                      color: '#f44336',
                      padding: '4px 6px',
                      borderRadius: 4,
                      fontSize: 10,
                      cursor: 'pointer'
                    }}
                    title="Delete message"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
            
            {/* Message Content */}
            <div 
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: '#e0e0e0',
                fontFamily: msg.role === 'system' ? 'monospace' : 'inherit'
              }}
              dangerouslySetInnerHTML={{
                __html: msg.role === 'assistant' ? highlightCode(msg.content) : msg.content.replace(/\n/g, '<br>')
              }}
            />
          </div>
        ))}
        
        <div ref={messagesEndRef} />
        
        {loading && (
          <div style={{fontSize: 12, opacity: 0.7}}>🤔 AI is thinking...</div>
        )}
      </div>

      {/* Input Area */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #3c3c3c',
        background: '#2d2d30'
      }}>
        <div style={{display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 8}}>
          <div style={{flex: 1, position: 'relative'}}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about code, debugging, or use Ctrl+Enter for templates..."
              style={{
                width: '100%',
                minHeight: 60,
                maxHeight: 150,
                padding: '12px 16px',
                resize: 'vertical',
                background: '#1e1e1e',
                color: '#e0e0e0',
                border: '2px solid #484848',
                borderRadius: 10,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}
              disabled={loading}
              onFocus={(e) => {
                e.target.style.borderColor = '#007acc';
                e.target.style.boxShadow = '0 0 0 3px rgba(0, 122, 204, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#484848';
                e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                } else if (e.ctrlKey && e.key === 'Enter') {
                  e.preventDefault();
                  setShowTemplates(true);
                }
              }}
            />
            {input.length > 0 && (
              <div style={{
                position: 'absolute',
                right: 8,
                bottom: 8,
                fontSize: 10,
                color: '#666',
                background: '#2d2d30',
                padding: '2px 6px',
                borderRadius: 4
              }}>
                {input.length} chars
              </div>
            )}
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            <button
              onClick={() => sendMessage(true)}
              disabled={loading || !input.trim()}
              style={{
                padding: '12px 18px',
                background: loading ? '#333' : 'linear-gradient(135deg, #007acc, #005a9e)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 14,
                minHeight: 48,
                minWidth: 80,
                transition: 'all 0.15s ease',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(0, 122, 204, 0.3)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {loading ? (
                <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                  <span style={{
                    width: 12,
                    height: 12,
                    border: '2px solid #fff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></span>
                  AI...
                </span>
              ) : (
                <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                  🚀 Send
                </span>
              )}
            </button>
            
            <button
              onClick={() => sendMessage(false)}
              disabled={loading || !input.trim()}
              style={{
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#cccccc',
                border: '1px solid #484848',
                borderRadius: 6,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                transition: 'all 0.15s ease'
              }}
              title="Send without streaming"
            >
              📤 REST
            </button>
          </div>
        </div>
        
        {/* Status Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#888'
        }}>
          <div>
            💡 Tip: Use templates button or Ctrl+Enter for quick prompts
          </div>
          <div>
            {wsConnection ? '🟢 Streaming ready' : '🔵 REST mode'} • {availableTools.length} tools available
          </div>
        </div>
      </div>
    </div>
  );
}