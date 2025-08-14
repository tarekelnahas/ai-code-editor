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

  return (
    <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: '16px'}}>
      <div style={{fontSize: 14, fontWeight: 'bold', color: '#007acc', display: 'flex', alignItems: 'center', gap: 8}}>
        <span style={{fontSize: '16px'}}>🤖</span>
        AI Assistant
        <span style={{fontSize: '12px', background: 'rgba(0, 122, 204, 0.1)', padding: '2px 6px', borderRadius: '4px', color: '#007acc'}}>
          {availableTools.length} tools
        </span>
      </div>
      
      <div style={{
        flex: 1,
        overflow: 'auto',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 12,
        background: 'var(--panel)'
      }}>
        {messages.length === 0 && (
          <div style={{opacity: 0.7, fontSize: 12}}>
            Try asking: "Search web for new AI tools" or "Can you take a screenshot?" or "Open Chrome browser"
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 8,
            background: msg.role === 'user' ? 'rgba(0, 122, 204, 0.1)' : 
                        msg.role === 'system' ? 'rgba(139, 69, 19, 0.1)' : 
                        'rgba(40, 40, 40, 0.5)',
            border: `1px solid ${msg.role === 'user' ? 'rgba(0, 122, 204, 0.2)' : 
                                  msg.role === 'system' ? 'rgba(139, 69, 19, 0.2)' : 
                                  'rgba(60, 60, 60, 0.3)'}`,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              fontSize: 11, 
              opacity: 0.8, 
              marginBottom: 8, 
              fontWeight: 600,
              color: msg.role === 'user' ? '#007acc' : 
                     msg.role === 'system' ? '#d2691e' : '#50c878',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <span>{msg.role === 'user' ? '👤' : msg.role === 'system' ? '⚙️' : '🤖'}</span>
              {msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}
              {msg.timestamp && (
                <span style={{opacity: 0.6, fontSize: 10}}>
                  • {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
            <div style={{
              whiteSpace: 'pre-wrap',
              fontSize: 13,
              lineHeight: 1.5,
              color: '#e0e0e0',
              fontFamily: msg.role === 'system' ? 'monospace' : 'inherit'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {loading && (
          <div style={{fontSize: 12, opacity: 0.7}}>🤔 AI is thinking...</div>
        )}
      </div>

      <div style={{display: 'flex', gap: 12, alignItems: 'flex-end'}}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask the AI anything... Press Enter to send"
          style={{
            flex: 1,
            minHeight: 60,
            padding: '12px 16px',
            resize: 'vertical',
            background: '#2d2d30',
            color: '#cccccc',
            border: '1px solid #484848',
            borderRadius: 8,
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.15s ease'
          }}
          disabled={loading}
          onFocus={(e) => e.target.style.borderColor = '#007acc'}
          onBlur={(e) => e.target.style.borderColor = '#484848'}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            padding: '12px 20px',
            background: loading ? '#333' : '#007acc',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 14,
            minHeight: 48,
            transition: 'all 0.15s ease',
            boxShadow: loading ? 'none' : '0 2px 6px rgba(0, 122, 204, 0.3)'
          }}
          onMouseEnter={(e) => !loading && (e.target.style.background = '#005a9e')}
          onMouseLeave={(e) => !loading && (e.target.style.background = '#007acc')}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>

      <div style={{fontSize: 10, opacity: 0.7}}>
        Available tools: {availableTools.slice(0, 5).join(', ')}
        {availableTools.length > 5 && `... +${availableTools.length - 5} more`}
      </div>
    </div>
  );
}