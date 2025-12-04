import { useState, useRef, useEffect } from 'react';
import './ChatInterface.css';
import HtmlPreview from './HtmlPreview';

interface CallCost {
  callNumber: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
}

interface CostInfo {
  totalCost: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  calls: number;
  callCosts?: CallCost[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  cost?: CostInfo;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch HTML document when documentId is provided
  const fetchDocument = async (documentId: string) => {
    try {
      console.log('Fetching document from API:', documentId);
      const response = await fetch(`/api/document/${documentId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Document fetched successfully:', data.document.id);
        setHtmlContent(data.document.content);
        setCurrentDocumentId(documentId);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error fetching document:', response.status, errorData);
      }
    } catch (error) {
      console.error('Error fetching document:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Format messages for API
      const messagesForAPI = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: messagesForAPI }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        cost: data.cost,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If a document ID is returned, fetch and display it
      let docId = data.documentId;
      
      // Fallback: Try to extract document ID from the message text
      // Handles formats like: doc-123456, `doc-123456`, ID: doc-123456, etc.
      if (!docId) {
        const docIdMatch = data.message.match(/doc-\d+/);
        if (docIdMatch) {
          docId = docIdMatch[0];
        }
      }
      
      if (docId) {
        console.log('Fetching document:', docId);
        await fetchDocument(docId);
      } else {
        console.log('No document ID found in response:', data);
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response. Please check your API key and try again.'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-interface-wrapper">
      <div className="chat-interface">
        <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Welcome!</h2>
            <p>
              This chat app uses OpenAI Agents SDK with the following capabilities:
            </p>
            <ul>
              <li>✓ Reads sample business profile</li>
              <li>✓ Accesses long-term memory</li>
              <li>✓ Creates HTML documents</li>
              <li>✓ Edits HTML documents</li>
            </ul>
            <p>Start by asking about the business profile or try creating an HTML document!</p>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-content">
              <div className="message-header">
                <span className="message-role">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <span className="message-time">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className="message-text">
                {message.content.split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < message.content.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
              {message.cost && message.role === 'assistant' && (
                <div className="message-cost">
                  <div className="cost-label">API Call Cost:</div>
                  <div className="cost-details">
                    <span className="cost-amount">${message.cost.totalCost.toFixed(6)}</span>
                    <span className="cost-breakdown">
                      (Total: {message.cost.promptTokens.toLocaleString()} prompt + {message.cost.completionTokens.toLocaleString()} completion tokens, {message.cost.calls} call{message.cost.calls !== 1 ? 's' : ''})
                    </span>
                  </div>
                  {message.cost.callCosts && message.cost.callCosts.length > 0 && (
                    <div className="cost-per-call">
                      <div className="cost-per-call-label">Cost per call:</div>
                      {message.cost.callCosts.map((call, index) => (
                        <div key={index} className="call-cost-item">
                          <span className="call-number">Call {call.callNumber}:</span>
                          <span className="call-cost-amount">${call.cost.toFixed(6)}</span>
                          <span className="call-cost-tokens">
                            ({call.promptTokens.toLocaleString()} + {call.completionTokens.toLocaleString()} tokens)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-content">
              <div className="message-header">
                <span className="message-role">Assistant</span>
              </div>
              <div className="message-text">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="input-form">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
          className="message-input"
          rows={1}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="send-button"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
      </div>
      <HtmlPreview htmlContent={htmlContent} documentId={currentDocumentId} />
    </div>
  );
}

