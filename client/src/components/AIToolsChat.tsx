import React, { useState, useEffect } from 'react';
import { fetchJson, API_BASE } from "../utils/net";

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export default function AIToolsChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableTools, setAvailableTools] = useState<string[]>([]);

  // Load available tools on mount
  useEffect(() => {
    fetchJson(`${API_BASE}/api/tools`)
      .then(tools => {
        const toolNames = tools.map((t: any) => t.name);
        setAvailableTools(toolNames.slice(0, 20)); // Show first 20 tools
      })
      .catch(console.error);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Enhanced prompt that mentions available tools
      const enhancedPrompt = `${input}

Available tools you can use:
${availableTools.join(', ')}

To run a tool, you can ask me to "run [tool name]" and I'll execute it for you.
`;

      // Use the working AI route endpoint
      const response = await fetchJson(`${API_BASE}/ai/route`, {
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
        timestamp: new Date().toISOString()
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 12}}>
      <div style={{fontSize: 14, fontWeight: 'bold', color: 'var(--accent)'}}>
        🤖 AI with Tools Access ({availableTools.length} tools available)
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
            marginBottom: 12,
            padding: 8,
            borderRadius: 6,
            background: msg.role === 'user' ? 'rgba(34,211,238,0.1)' : 
                        msg.role === 'system' ? 'rgba(167,139,250,0.1)' : 
                        'rgba(255,255,255,0.05)'
          }}>
            <div style={{fontSize: 10, opacity: 0.7, marginBottom: 4}}>
              {msg.role.toUpperCase()} {msg.timestamp && new Date(msg.timestamp).toLocaleTimeString()}
            </div>
            <pre style={{
              whiteSpace: 'pre-wrap',
              fontSize: 12,
              margin: 0,
              fontFamily: 'inherit'
            }}>
              {msg.content}
            </pre>
          </div>
        ))}
        
        {loading && (
          <div style={{fontSize: 12, opacity: 0.7}}>🤔 AI is thinking...</div>
        )}
      </div>

      <div style={{display: 'flex', gap: 8}}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask the AI: 'Search web for new AI tools' or 'Take a screenshot'"
          style={{
            flex: 1,
            minHeight: 60,
            padding: 8,
            resize: 'vertical',
            background: 'var(--bg)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 6
          }}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="btn"
          style={{alignSelf: 'flex-end', minHeight: 60}}
        >
          Send
        </button>
      </div>

      <div style={{fontSize: 10, opacity: 0.7}}>
        Available tools: {availableTools.slice(0, 5).join(', ')}
        {availableTools.length > 5 && `... +${availableTools.length - 5} more`}
      </div>
    </div>
  );
}