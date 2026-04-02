import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_BACKEND_URL;
console.log("BASE_URL:", BASE_URL);

function App() {
  const [isCalling, setIsCalling] = useState(false);
  const [status, setStatus] = useState("Status: Ready to help");
  const [language, setLanguage] = useState("en");
  const [lastResponse, setLastResponse] = useState(null);
  const [messages, setMessages] = useState([
    { text: "Hello! Choose your language and click the phone icon to ask me anything about Diabetes.", isUser: false, lang: 'en' }
  ]);

  const chatBoxRef = useRef(null);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // ✅ Browser speech instead of backend MP3
  const speakText = (text, lang = "en-IN") => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // stop previous speech if any
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  };

  const handleReplay = () => {
    if (!lastResponse?.assistant_response) return;
    speakText(
      lastResponse.assistant_response,
      language === "te" ? "te-IN" : "en-IN"
    );
  };

  const handleCall = async () => {
    setIsCalling(true);
    setStatus("Listening...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      let chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });

        const formData = new FormData();
        formData.append("audio", blob);
        formData.append("lang", language);

        try {
          const resp = await axios.post(`${BASE_URL}/process_voice`, formData);

          if (resp.data.user_text) {
            setLastResponse(resp.data);

            setMessages(prev => [
              ...prev,
              { text: resp.data.user_text, isUser: true, lang: language },
              { text: resp.data.assistant_response, isUser: false, lang: language }
            ]);

            // ✅ Speak using browser
            speakText(
              resp.data.assistant_response,
              language === "te" ? "te-IN" : "en-IN"
            );

          } else if (resp.data.error) {
            setMessages(prev => [
              ...prev,
              { text: "⚠️ " + resp.data.error, isUser: false, lang: 'en' }
            ]);
          }

        } catch (err) {
          console.error("Voice request failed:", err);

          const errorMsg =
            err.response?.data?.error || "Voice processing failed on server.";

          setMessages(prev => [
            ...prev,
            { text: "⚠️ " + errorMsg, isUser: false, lang: "en" }
          ]);
        }

        setIsCalling(false);
        setStatus("Status: Ready");
      };

      mediaRecorder.start();

      setTimeout(() => {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
      }, 5000);

    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        { text: "Error: Could not hear clearly.", isUser: false, lang: 'en' }
      ]);
      setIsCalling(false);
      setStatus("Status: Ready");
    }
  };

  return (
    <div className="bg-white w-[1000px] h-[700px] rounded-3xl shadow-2xl flex overflow-hidden font-sans">
      
      {/* LEFT PANEL */}
      <div className="w-1/2 bg-[#0055ff] p-8 flex flex-col items-center justify-between text-white relative">
        
        {/* SAME HEADER */}
        <div className="text-center mt-4">
          <h2 className="text-2xl font-semibold">Diabetes Health Assistant</h2>
          <div className="text-white/70 text-xs mt-1">{status}</div>
        </div>

        {/* SAME CIRCLE ICON */}
        <div className="w-44 h-44 rounded-full bg-[#1e88e5] flex items-center justify-center shadow-lg border-2 border-white/10 relative">
          <i className="fas fa-hand-holding-medical text-6xl text-white"></i>
          {isCalling && <div className="absolute inset-0 rounded-full bg-white/20 animate-ping"></div>}
        </div>

        <div className="flex flex-col items-center gap-6 w-full">
          {/* SAME LANGUAGE SELECT */}
          <div className="relative w-44">
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-[#1e88e5] text-white text-sm rounded-lg px-4 py-2 outline-none appearance-none cursor-pointer border-none text-center shadow-md font-medium"
            >
              <option value="en">English</option>
              <option value="te">తెలుగు (Telugu)</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <i className="fas fa-caret-down text-[10px] text-white/90"></i>
            </div>
          </div>

          {/* SAME BUTTONS */}
          <div className="flex items-center gap-4">
            <button 
              onClick={handleCall} 
              className={`w-16 h-16 ${isCalling ? 'bg-red-500' : 'bg-[#4caf50]'} rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all`}
            >
              <i className="fas fa-phone text-2xl text-white"></i>
            </button>

            {lastResponse && (
              <button 
                onClick={handleReplay} 
                className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center shadow-md active:scale-90"
              >
                <i className="fas fa-redo text-lg text-white"></i>
              </button>
            )}
          </div>

          <p className="text-white/80 text-[11px]">Click the phone to start speaking</p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-1/2 flex flex-col bg-[#f5f7f9]">
        <div className="p-5 border-b bg-white">
          <h3 className="text-sm font-semibold text-slate-600">Conversation History</h3>
        </div>

        <div ref={chatBoxRef} className="flex-1 p-6 overflow-y-auto space-y-4 flex flex-col scrollbar-hide">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`${
                msg.isUser 
                ? "bg-[#0055ff] text-white self-end rounded-2xl rounded-tr-none shadow-md" 
                : "bg-white text-slate-700 self-start border border-slate-100 rounded-2xl rounded-tl-none shadow-sm"
              } p-4 max-w-[85%] text-sm`}
            >
              {msg.text}

              {!msg.isUser && i !== 0 && (
                <button 
                  onClick={handleReplay} 
                  className="flex items-center gap-1 mt-3 text-[10px] font-bold text-blue-500 uppercase hover:text-blue-700"
                >
                  <i className="fas fa-volume-up"></i> Repeat Audio
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;