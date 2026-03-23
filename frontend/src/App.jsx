import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function App() {
  const [isCalling, setIsCalling] = useState(false);
  const [status, setStatus] = useState("Status: Ready to help");
  const [language, setLanguage] = useState("en");
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [reminderTask, setReminderTask] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [lastResponse, setLastResponse] = useState(null);
  const [messages, setMessages] = useState([
    { text: "Hello! Choose your language and click the phone icon to ask me anything about Diabetes.", isUser: false, lang: 'en' }
  ]);

  const chatBoxRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // Polling notifications from Flask
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:5000/get_notifications');
        if (response.data && response.data.length > 0) {
          response.data.forEach(notification => {

  setMessages(prev => [...prev, {
    text: `⏰ REMINDER: ${notification.task}`,
    isUser: false,
    lang: 'en'
  }]);

  // 🔊 INSIDE LOOP
  if (notification.audio_url) {
    const audio = new Audio(`http://127.0.0.1:5000/${notification.audio_url}`);
    audio.play();
  }

});
          
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };
    const interval = setInterval(checkNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  // 🔊 Replay FIXED (uses backend audio)
  const handleReplay = async (text, msgLang) => {
    if (!lastResponse?.audio_url) return;
    const audio = new Audio(`http://127.0.0.1:5000/${lastResponse.audio_url}`);
    audio.play();
  };

  const handleSetReminder = async () => {
    if (!reminderTask || !reminderTime) return alert("Please fill all fields");
    try {
      await axios.post('http://127.0.0.1:5000/set_reminder', { task: reminderTask, time: reminderTime });
      alert(`Reminder set for ${reminderTime}`);
      setReminderTask(""); 
      setReminderTime(""); 
      setIsReminderOpen(false);
    } catch (err) { console.error(err); }
  };

  // 🎤 Mic FIXED
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
        const blob = new Blob(chunks, { type: "audio/webm" });

        const formData = new FormData();
        formData.append("audio", blob);
        formData.append("lang", language);

        try {
          const resp = await axios.post(
            "http://127.0.0.1:5000/process_voice",
            formData
          );

          if (resp.data.user_text) {
            setLastResponse(resp.data);

            setMessages(prev => [
              ...prev,
              { text: resp.data.user_text, isUser: true, lang: language },
              { text: resp.data.assistant_response, isUser: false, lang: language }
            ]);

            // 🔊 Play backend audio
            if (resp.data.audio_url) {
              const audio = new Audio(`http://127.0.0.1:5000/${resp.data.audio_url}`);
              audio.play();
            }
          }
        } catch (err) {
          console.error(err);
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
      setMessages(prev => [...prev, { text: "Error: Could not hear clearly.", isUser: false, lang: 'en' }]);
      setIsCalling(false);
      setStatus("Status: Ready");
    }
  };

  return (
    <div className="bg-white w-[1000px] h-[700px] rounded-3xl shadow-2xl flex overflow-hidden font-sans">
      
      {/* LEFT PANEL */}
      <div className="w-1/2 bg-[#0055ff] p-8 flex flex-col items-center justify-between text-white relative">
        
        <button 
          onClick={() => setIsReminderOpen(true)}
          className="absolute top-6 left-6 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all border border-white/30 shadow-sm"
          title="Set Reminder"
        >
          <i className="fas fa-bell text-white text-sm"></i>
        </button>

        <div className="text-center mt-4">
          <h2 className="text-2xl font-semibold">Diabetes Health Assistant</h2>
          <div className="text-white/70 text-xs mt-1">{status}</div>
        </div>

        <div className="w-44 h-44 rounded-full bg-[#1e88e5] flex items-center justify-center shadow-lg border-2 border-white/10 relative">
          <i className="fas fa-hand-holding-medical text-6xl text-white"></i>
          {isCalling && <div className="absolute inset-0 rounded-full bg-white/20 animate-ping"></div>}
        </div>

        <div className="flex flex-col items-center gap-6 w-full">
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

          <div className="flex items-center gap-4">
            <button 
              onClick={handleCall} 
              className={`w-16 h-16 ${isCalling ? 'bg-red-500' : 'bg-[#4caf50]'} rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all`}
            >
              <i className="fas fa-phone text-2xl text-white"></i>
            </button>
            {lastResponse && (
              <button 
                onClick={() => handleReplay(lastResponse.text, lastResponse.lang)} 
                className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center shadow-md active:scale-90"
              >
                <i className="fas fa-redo text-lg text-white"></i>
              </button>
            )}
          </div>
          <p className="text-white/80 text-[11px]">Click the phone to start speaking</p>
        </div>

        {isReminderOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-[320px] p-8 rounded-3xl shadow-2xl text-slate-800 animate-modalIn">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-blue-900">Set Reminder</h3>
                <button 
                  onClick={() => setIsReminderOpen(false)} 
                  className="text-slate-400 hover:text-red-500"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Task Name" 
                  value={reminderTask} 
                  onChange={(e) => setReminderTask(e.target.value)} 
                  className="w-full border p-3 rounded-xl text-sm outline-none focus:border-blue-500" 
                />
                <input 
                  type="time" 
                  value={reminderTime} 
                  onChange={(e) => setReminderTime(e.target.value)} 
                  className="w-full border p-3 rounded-xl text-sm outline-none focus:border-blue-500" 
                />
                <button 
                  onClick={handleSetReminder} 
                  className="w-full bg-[#0055ff] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
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
              {!msg.isUser && (
                <button 
                  onClick={() => handleReplay(msg.text, msg.lang)} 
                  className="flex items-center gap-1 mt-3 text-[10px] font-bold text-blue-500 uppercase hover:text-blue-700"
                >
                  <i className="fas fa-volume-up"></i> Repeat Audio
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes modalIn { 
          from { opacity: 0; transform: scale(0.9); } 
          to { opacity: 1; transform: scale(1); } 
        } 
        .animate-modalIn { animation: modalIn 0.2s ease-out; } 
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

export default App;