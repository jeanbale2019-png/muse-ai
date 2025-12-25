
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getConversationSuggestions } from '../services/geminiService';
import { ConversationSuggestion, Language } from '../types';

interface ConversationCoachProps {
  language: Language;
}

const ConversationCoach: React.FC<ConversationCoachProps> = ({ language }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [suggestions, setSuggestions] = useState<ConversationSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Helper to start/restart recognition safely
  const startRecognition = () => {
    try {
      recognitionRef.current?.start();
    } catch (e) {
      // Recognition might already be started or in the process of starting
      console.debug("Recognition start attempt ignored:", e);
    }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const final = event.results[i][0].transcript;
            setTranscript(final);
            handleNewTranscript(final);
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
      };

      recognition.onerror = (event: any) => {
        // 'no-speech' is a common non-critical error that happens when the mic is active but no sound is detected.
        // We ignore it to keep the session active.
        if (event.error === 'no-speech') {
          return;
        }
        console.error("Speech Recognition Error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        // If the user hasn't explicitly stopped, restart the recognition.
        // This handles cases where the browser's speech engine times out or stops during silence.
        if (isListening) {
          startRecognition();
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, [language, isListening]); // Added isListening to dependency array to ensure onend closure is fresh

  const handleNewTranscript = async (text: string) => {
    if (!text || text.trim().length < 5) return;
    setIsLoadingSuggestions(true);
    try {
      const newSuggestions = await getConversationSuggestions(text, language);
      setSuggestions(newSuggestions);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      recognitionRef.current?.stop();
    } else {
      setTranscript('');
      setSuggestions([]);
      setIsListening(true);
      startRecognition();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12 animate-in slide-in-from-bottom-8 duration-700">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-serif font-light tracking-tight text-white">Social <span className="text-emerald-400">Mentor</span></h1>
        <p className="text-zinc-400 text-lg">Real-time coaching for meaningful connections.</p>
      </div>

      <div className="flex flex-col items-center space-y-8">
        <button 
          onClick={toggleListening}
          className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 relative ${
            isListening ? 'bg-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)]' : 'bg-zinc-800'
          }`}
        >
          {isListening && (
            <div className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-25"></div>
          )}
          {isListening ? (
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H10a1 1 0 01-1-1v-4z"></path></svg>
          ) : (
            <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v10a3 3 0 006 0V6a3 3 0 00-3-3z"></path></svg>
          )}
        </button>
        
        <div className="w-full text-center">
          <p className="text-zinc-500 text-sm italic mb-2">
            {isListening ? "Listening to your conversation..." : "Tap to start listening"}
          </p>
          <div className="h-8 flex items-center justify-center">
            {transcript && (
              <p className="text-emerald-100 text-lg font-medium opacity-80 animate-in fade-in transition-opacity">
                &quot;{transcript}&quot;
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 w-full px-4">
          {isLoadingSuggestions ? (
            <div className="flex justify-center space-x-2 py-8">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce delay-75"></div>
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce delay-150"></div>
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce delay-300"></div>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((s, idx) => (
              <div 
                key={idx}
                className="glass p-5 rounded-2xl flex items-start space-x-4 border-l-4 border-l-emerald-500 hover:translate-x-2 transition-transform cursor-pointer group"
                style={{ animationDelay: `${idx * 150}ms` }}
              >
                <div className="p-2 bg-zinc-800 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform">
                  {s.type === 'relance' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                  {s.type === 'empathy' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>}
                  {s.type === 'humor' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-1">{s.type}</h4>
                  <p className="text-zinc-200 leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))
          ) : !isListening && (
            <div className="text-center py-12 text-zinc-600">
              <p>Suggestions will appear here as you speak.</p>
            </div>
          )}
        </div>
      </div>

      <div className="text-center p-4 bg-zinc-900/50 rounded-xl">
        <p className="text-xs text-zinc-500 flex items-center justify-center space-x-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          <span>Privacy Guaranteed: Audio is processed in-memory and never stored on a server.</span>
        </p>
      </div>
    </div>
  );
};

export default ConversationCoach;
