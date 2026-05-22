import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { BACKEND_URL, BOT_CONFIG } from './config';
import { getStats } from './utils/fakeStats';
import { getRandomScript, getGreeting, getNextQuestion, getExit, pickFollowup } from './utils/botScripts';
import './App.css';

// ─── Socket Connection ──────────────────────────────────────────────────────
let socket = null;

function createSocket() {
  if (socket?.connected) return socket;
  socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
  });
  return socket;
}

// ─── Main App ───────────────────────────────────────────────────────────────
function App() {
  // App state
  const [screen, setScreen] = useState('intro'); // intro | searching | chatting | finished
  const [mode, setMode] = useState('text'); // video | audio | text
  const [myGender, setMyGender] = useState('any');
  const [wantGender, setWantGender] = useState('any');
  const [stats, setStats] = useState({ online: 847, waiting: 23, chats: 145 });
  const [chatPartner, setChatPartner] = useState(null); // 'bot' | 'real' | null
  const [messages, setMessages] = useState([]);
  const [statusText, setStatusText] = useState('Press Start to find someone');
  const [isConnected, setIsConnected] = useState(false);
  const [localStream, setLocalStream] = useState(null);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const botScriptRef = useRef(null);
  const botUsedIndicesRef = useRef([]);
  const botExchangesRef = useRef(0);
  const statsIntervalRef = useRef(null);
  const peerConnectedRef = useRef(false);

  // ── Scroll to bottom of messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Fake stats ticker ──
  useEffect(() => {
    statsIntervalRef.current = setInterval(() => {
      const connected = socket?.connected ? 1 : 0;
      const chatting = screen === 'chatting' ? 1 : 0;
      setStats(getStats(connected, chatting));
    }, 6000);
    return () => clearInterval(statsIntervalRef.current);
  }, [screen]);

  // ── Connect socket on mount ──
  useEffect(() => {
    const s = createSocket();
    
    s.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });
    
    s.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    // WebRTC signaling
    s.on('signal', async ({ description, candidate }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      
      try {
        if (description) {
          if (description.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(description));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            s.emit('signal', { description: pc.localDescription });
          } else if (description.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(description));
          }
        } else if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Signal error:', err);
      }
    });

    // Chat events
    s.on('partner-found', ({ partnerType }) => {
      setStatusText('Connected!');
      setChatPartner(partnerType);
      setScreen('chatting');
      
      if (partnerType === 'bot') {
        startBotChat();
      }
    });

    s.on('partner-left', () => {
      addSystemMessage('Stranger has disconnected.');
      setChatPartner(null);
      setScreen('finished');
      setStatusText('Partner left. Press Next to find someone else.');
      hangup();
    });

    s.on('chat-message', ({ message, from }) => {
      if (from === 'partner') {
        setMessages(prev => [...prev, { text: message, sender: 'partner', time: Date.now() }]);
      }
    });

    s.on('partner-typing', ({ typing }) => {
      if (typing) {
        setStatusText('Stranger is typing...');
      } else {
        setStatusText('Connected');
      }
    });

    s.on('matched', () => {
      setStatusText('Matching you...');
    });

    s.on('waiting', ({ position }) => {
      setStatusText(`In queue... position #${position}`);
    });

    return () => {
      s.off('connect');
      s.off('disconnect');
      s.off('signal');
      s.off('partner-found');
      s.off('partner-left');
      s.off('chat-message');
      s.off('partner-typing');
      s.off('matched');
      s.off('waiting');
    };
  }, []);

  // ── Bot Chat Logic ──
  const startBotChat = useCallback(() => {
    botScriptRef.current = getRandomScript();
    botUsedIndicesRef.current = [];
    botExchangesRef.current = 0;
    
    // Bot sends greeting after typing delay
    const delay = BOT_CONFIG.typingDelay.min + Math.random() * (BOT_CONFIG.typingDelay.max - BOT_CONFIG.typingDelay.min);
    setStatusText('Stranger is typing...');
    
    setTimeout(() => {
      const greeting = getGreeting(botScriptRef.current);
      setMessages(prev => [...prev, { text: greeting, sender: 'partner', time: Date.now() }]);
      setStatusText('Connected');
      botExchangesRef.current += 1;
    }, delay);
  }, []);

  const handleBotReply = useCallback((userMessage) => {
    const script = botScriptRef.current;
    if (!script) return;
    
    // Check if bot should disconnect
    const maxExchanges = BOT_CONFIG.disconnectAfter.min + 
      Math.floor(Math.random() * (BOT_CONFIG.disconnectAfter.max - BOT_CONFIG.disconnectAfter.min + 1));
    
    if (botExchangesRef.current >= maxExchanges) {
      // Bot leaves
      setStatusText('Stranger is typing...');
      setTimeout(() => {
        const exitMsg = getExit(script);
        setMessages(prev => [...prev, { text: exitMsg, sender: 'partner', time: Date.now() }]);
        setStatusText('Stranger has disconnected.');
        setChatPartner(null);
        setScreen('finished');
        
        // Auto reconnect after delay
        const reconnectDelay = BOT_CONFIG.reconnectionDelay.min + 
          Math.random() * (BOT_CONFIG.reconnectionDelay.max - BOT_CONFIG.reconnectionDelay.min);
        setTimeout(() => {
          addSystemMessage('Finding someone new...');
          setScreen('searching');
          setStatusText('Looking for a partner...');
          setTimeout(() => {
            startBotChat();
            setScreen('chatting');
            setChatPartner('bot');
          }, 1000);
        }, reconnectDelay);
      }, BOT_CONFIG.typingDelay.min + Math.random() * 1000);
      return;
    }
    
    // Bot responds to user message
    setStatusText('Stranger is typing...');
    const delay = BOT_CONFIG.typingDelay.min + Math.random() * (BOT_CONFIG.typingDelay.max - BOT_CONFIG.typingDelay.min);
    
    setTimeout(() => {
      // Either ask a new question or follow up
      const nextQ = getNextQuestion(script, botUsedIndicesRef.current);
      if (nextQ) {
        botUsedIndicesRef.current.push(nextQ.index);
        const followup = pickFollowup(nextQ.followups, userMessage);
        setMessages(prev => [...prev, { text: followup, sender: 'partner', time: Date.now() }]);
        
        // Then ask the question
        setTimeout(() => {
          setMessages(prev => [...prev, { text: nextQ.question, sender: 'partner', time: Date.now() }]);
          setStatusText('Connected');
          botExchangesRef.current += 1;
        }, BOT_CONFIG.typingDelay.min + Math.random() * 1000);
      } else {
        // No more questions - generic response
        const responses = [
          "That's interesting! Tell me more.",
          "Haha I feel you on that!",
          "Cool! What else are you into?",
          "Yeah I get that. So anyway...",
        ];
        const resp = responses[Math.floor(Math.random() * responses.length)];
        setMessages(prev => [...prev, { text: resp, sender: 'partner', time: Date.now() }]);
        setStatusText('Connected');
        botExchangesRef.current += 1;
      }
    }, delay);
  }, [startBotChat]);

  // ── WebRTC Setup ──
  const createPeerConnection = useCallback(() => {
    if (peerConnectedRef.current) return;
    
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const pc = new RTCPeerConnection(config);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.connected) {
        socket.emit('signal', { candidate: event.candidate });
      }
    };
    
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        peerConnectedRef.current = false;
      }
    };
    
    peerConnectionRef.current = pc;
    peerConnectedRef.current = true;
    return pc;
  }, []);

  const startMedia = useCallback(async () => {
    if (mode === 'text') return null;
    try {
      const constraints = {
        video: mode === 'video',
        audio: mode !== 'text',
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Media error:', err);
      addSystemMessage('⚠️ Could not access camera/mic. Check permissions.');
      return null;
    }
  }, [mode]);

  const hangup = useCallback(() => {
    const pc = peerConnectionRef.current;
    if (pc) {
      pc.close();
      peerConnectionRef.current = null;
      peerConnectedRef.current = false;
    }
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, [localStream]);

  // ── Actions ──
  const addSystemMessage = (text) => {
    setMessages(prev => [...prev, { text, sender: 'system', time: Date.now() }]);
  };

  const handleStart = async () => {
    setMessages([]);
    setScreen('searching');
    setStatusText('Looking for a partner...');
    addSystemMessage('Finding someone to chat with...');
    
    // Start camera for video/audio modes
    const stream = (mode !== 'text') ? await startMedia() : null;
    
    // Create WebRTC peer for real connections
    if (mode !== 'text') {
      createPeerConnection();
    }
    
    // Tell backend we're searching
    if (socket?.connected) {
      socket.emit('search', {
        mode,
        myGender,
        wantGender,
      });
    }
    
    // Fallback: if no real partner found in 5s, use bot
    setTimeout(() => {
      if (screen === 'searching' || screen === 'intro') {
        setStatusText('Connected!');
        setChatPartner('bot');
        setScreen('chatting');
        addSystemMessage('📢 Matched with a friendly stranger!');
        startBotChat();
      }
    }, 5000);
  };

  const handleNext = () => {
    hangup();
    setMessages([]);
    setChatPartner(null);
    setScreen('searching');
    setStatusText('Looking for a new partner...');
    addSystemMessage('Finding someone new...');
    
    if (socket?.connected) {
      socket.emit('search', { mode, myGender, wantGender });
    }
    
    // Fallback bot
    setTimeout(() => {
      if (screen === 'searching' || screen === 'finished') {
        setChatPartner('bot');
        setScreen('chatting');
        addSystemMessage('📢 Matched! Say hello!');
        startBotChat();
      }
    }, 5000);
  };

  const handleStop = () => {
    if (socket?.connected) {
      socket.emit('stop-search');
    }
    hangup();
    setScreen('intro');
    setChatPartner(null);
    setStatusText('Press Start to find someone');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    
    setMessages(prev => [...prev, { text, sender: 'me', time: Date.now() }]);
    
    if (chatPartner === 'bot') {
      handleBotReply(text);
    } else if (socket?.connected) {
      socket.emit('chat-message', { message: text });
    }
  };

  const handleGenderPrefChange = (gender) => {
    setWantGender(gender);
  };

  // ── Render ──
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">💬</span>
          <span className="brand-name">FluxChat</span>
        </div>
        <div className="status-inline">
          <span className={`dot ${isConnected ? 'dot-green' : 'dot-red'}`}></span>
          <span className="status-text">{isConnected ? 'Connected' : 'Offline'}</span>
        </div>
      </header>

      <main className="main-content">
        {/* INTRO/START SCREEN */}
        {(screen === 'intro' || screen === 'searching') && (
          <div className="intro-screen">
            <div className="intro-card">
              <h1 className="intro-title">Talk to Strangers</h1>
              <p className="intro-subtitle">Random video, audio & text chat with people worldwide. Free, anonymous, no signup needed.</p>
              
              {/* Mode selector */}
              <div className="mode-selector">
                {['video', 'audio', 'text'].map(m => (
                  <button
                    key={m}
                    className={`mode-btn ${mode === m ? 'active' : ''}`}
                    onClick={() => setMode(m)}
                    disabled={screen === 'searching'}
                  >
                    {m === 'video' ? '🎥' : m === 'audio' ? '🎙️' : '💬'}
                    <span>{m.charAt(0).toUpperCase() + m.slice(1)}</span>
                  </button>
                ))}
              </div>

              {/* Gender preference */}
              <div className="pref-row">
                <span className="pref-label">Looking for</span>
                <div className="gender-pills">
                  {[
                    { value: 'any', label: '✨ Anyone' },
                    { value: 'male', label: '♂ Male' },
                    { value: 'female', label: '♀ Female' },
                  ].map(g => (
                    <button
                      key={g.value}
                      className={`pill ${wantGender === g.value ? 'pill-active' : ''}`}
                      onClick={() => handleGenderPrefChange(g.value)}
                      disabled={screen === 'searching'}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action button */}
              {screen === 'intro' ? (
                <button className="start-btn" onClick={handleStart}>
                  Start Chatting Now!
                </button>
              ) : (
                <div className="searching-animation">
                  <div className="spinner"></div>
                  <p className="searching-text">{statusText}</p>
                  <button className="stop-btn" onClick={handleStop}>Cancel</button>
                </div>
              )}

              {/* Fake Stats */}
              <div className="stats-row">
                <div className="stat">
                  <span className="stat-num">{stats.online.toLocaleString()}</span>
                  <span className="stat-label">Online</span>
                </div>
                <div className="stat">
                  <span className="stat-num">{stats.waiting}</span>
                  <span className="stat-label">Waiting</span>
                </div>
                <div className="stat">
                  <span className="stat-num">{stats.chats}</span>
                  <span className="stat-label">In Chats</span>
                </div>
              </div>
              
              <p className="disclaimer">No signup required. 18+. Be respectful.</p>
            </div>
          </div>
        )}

        {/* CHAT SCREEN */}
        {(screen === 'chatting' || screen === 'finished') && (
          <div className="chat-screen">
            {/* Video/audio area */}
            {(mode === 'video' || mode === 'audio') && (
              <div className="video-grid">
                <div className="video-box">
                  <div className="video-label">You</div>
                  <video ref={localVideoRef} autoPlay muted playsInline className="video-el"></video>
                  {!localStream && <div className="video-placeholder">📷</div>}
                </div>
                <div className="video-box">
                  <div className="video-label">Stranger</div>
                  <video ref={remoteVideoRef} autoPlay playsInline className="video-el"></video>
                  {chatPartner !== 'real' && (
                    <div className="video-placeholder">
                      {chatPartner === 'bot' ? '🤖' : '👤'}
                      {chatPartner === 'bot' && <span className="bot-badge">Bot</span>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chat messages */}
            <div className="chat-area">
              <div className="chat-header">
                <span className="chat-status">{statusText}</span>
                {chatPartner === 'bot' && <span className="bot-badge-chat">AI Partner</span>}
              </div>
              
              <div className="messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`msg msg-${msg.sender}`}>
                    {msg.sender !== 'system' && <div className="msg-bubble">{msg.text}</div>}
                    {msg.sender === 'system' && <div className="msg-system">{msg.text}</div>}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form className="msg-form" onSubmit={handleSendMessage}>
                <input
                  id="msg-input"
                  className="msg-input"
                  type="text"
                  placeholder="Type a message..."
                  maxLength={500}
                  autoFocus
                  disabled={screen === 'finished'}
                />
                <button className="send-btn" type="submit" disabled={screen === 'finished'}>
                  Send
                </button>
              </form>
            </div>

            {/* Controls */}
            <div className="controls">
              <button className="ctrl-btn ctrl-primary" onClick={handleNext} disabled={screen === 'finished'}>
                ⏭ Next
              </button>
              <button className="ctrl-btn ctrl-secondary" onClick={handleStop}>
                ⏹ Stop
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
