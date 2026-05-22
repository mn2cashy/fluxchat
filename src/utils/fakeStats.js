// Fake stats generator
import { FAKE_STATS } from '../config';

let currentOnline = FAKE_STATS.online.min;
let currentWaiting = FAKE_STATS.waiting.min;
let currentChats = FAKE_STATS.chats.min;

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nudge(value, min, max, step = 20) {
  const dir = Math.random() > 0.5 ? 1 : -1;
  let newVal = value + (dir * randomBetween(1, step));
  return Math.max(min, Math.min(max, newVal));
}

export function getStats(realConnected = 0, realChatting = 0) {
  currentOnline = nudge(currentOnline, FAKE_STATS.online.min, FAKE_STATS.online.max);
  currentWaiting = nudge(currentWaiting, FAKE_STATS.waiting.min, FAKE_STATS.waiting.max);
  currentChats = nudge(currentChats, FAKE_STATS.chats.min, FAKE_STATS.chats.max);
  
  return {
    online: currentOnline + realConnected,
    waiting: currentWaiting + Math.max(0, realConnected - realChatting),
    chats: currentChats + realChatting,
  };
}

// Reset to defaults
export function resetStats() {
  currentOnline = FAKE_STATS.online.min;
  currentWaiting = FAKE_STATS.waiting.min;
  currentChats = FAKE_STATS.chats.min;
}
