import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Lock, Loader2 } from 'lucide-react';
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from '../lib/firebase';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: any;
}

interface SecretChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SecretChatDrawer({ isOpen, onClose }: SecretChatDrawerProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isUnlocked) {
      const q = query(collection(db, 'secret_chats'), orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
        setMessages(msgs);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
      return () => unsubscribe();
    }
  }, [isUnlocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'devbyandz') {
      setIsUnlocked(true);
      setError('');
    } else {
      setError('Mật khẩu không đúng!');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setIsTyping(true);

    try {
      // 1. Save user message
      await addDoc(collection(db, 'secret_chats'), {
        role: 'user',
        content: userMessage,
        createdAt: serverTimestamp()
      });

      // 2. Prepare history for API (last 10 messages to save tokens)
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

      // 3. Call API
      const res = await fetch('/api/secret-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage, history })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi gọi API');

      // 4. Save AI message
      await addDoc(collection(db, 'secret_chats'), {
        role: 'assistant',
        content: data.reply,
        createdAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error(err);
      alert('Lỗi: ' + err.message);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50">
          <h2 className="font-bold text-neutral-800 flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" /> Trợ lý AI Bí mật
          </h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isUnlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-neutral-50">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-neutral-800 mb-2">Khu vực bảo mật</h3>
            <p className="text-neutral-500 text-sm text-center mb-6">Vui lòng nhập mật mã để truy cập trợ lý AI cá nhân.</p>
            
            <form onSubmit={handleUnlock} className="w-full space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật mã..."
                className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-center font-medium"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}
              <button type="submit" className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition">
                Mở khóa
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center text-neutral-400 text-sm mt-10">
                  Hãy bắt đầu trò chuyện với trợ lý của bạn.
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={msg.id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-neutral-100 border border-neutral-200 text-neutral-800 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-neutral-100 border border-neutral-200 text-neutral-500 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-medium">AI đang nghĩ...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-neutral-100">
              <form onSubmit={handleSend} className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                  className="flex-1 p-3 bg-neutral-100 border-transparent focus:bg-white border focus:border-indigo-300 rounded-xl outline-none text-sm transition"
                  disabled={isTyping}
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || isTyping}
                  className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
