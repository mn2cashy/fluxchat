// FluxChat Configuration
// Change this to your deployed backend URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Fake stats to show when there are no real users
const FAKE_STATS = {
  online: { min: 847, max: 1532 },
  waiting: { min: 23, max: 67 },
  chats: { min: 145, max: 389 },
  fluctuationInterval: 8000, // ms between fluctuations
};

// Bot configuration
const BOT_CONFIG = {
  typingDelay: { min: 800, max: 2500 }, // ms
  disconnectAfter: { min: 3, max: 6 }, // exchanges before bot leaves
  reconnectionDelay: { min: 2000, max: 4000 }, // ms before re-matching
};

export { BACKEND_URL, FAKE_STATS, BOT_CONFIG };
