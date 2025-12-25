
import React, { useState, useRef, useEffect } from 'react';
import { chatWithGemini } from '../services/geminiService';
import { ChatMessage, Language } from '../types';

interface ChatBotProps {
  language: Language;
  isOpenOverride?: boolean;
  onCloseOverride?: () => void;
}

const ChatBot: React.FC<ChatBotProps> = ({ language, isOpenOverride, onCloseOverride }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOpen = isOpenOverride !== undefined ? isOpenOverride : internalIsOpen;
  const toggleOpen = () => {
    if (onCloseOverride && isOpen) {
      onCloseOverride();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };

  useEffect(() => {
    setMessages([
      { role: 'model', text: `Hi! I am Gemini. I can assist you in ${language}. How can I help today?`, timestamp: Date.now() }
    ]);
  }, [language]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await chatWithGemini(messages.map(m => ({ role: m.role, text: m.text })), input, language);
      const botMsg: ChatMessage = { role: 'model', text: response || 'I had trouble thinking of a response.', timestamp: Date.now() };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-28 right-6 z-[110]">
      {isOpen ? (
        <div className="w-80 h-96 glass rounded-2xl flex flex-col shadow-2xl border border-zinc-700 animate-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/50 rounded-t-2xl">
            <h3 className="font-semibold text-sm">Gemini Assistant</h3>
            <button onClick={toggleOpen} className="text-zinc-500 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-200'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 p-3 rounded-xl">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-zinc-800 flex space-x-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            />
            <button onClick={handleSend} className="bg-blue-600 p-2 rounded-lg hover:bg-blue-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </button>
          </div>
        </div>
      ) : isOpenOverride === undefined ? (
        <button 
          onClick={toggleOpen}
          className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 hover:bg-blue-500 transition-all"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
        </button>
      ) : null}
    </div>
  );
};

export default ChatBot;
