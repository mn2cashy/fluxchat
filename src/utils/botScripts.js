// Bot conversation scripts - multiple personality paths
const BOT_SCRIPTS = [
  // Path 1: Friendly traveler
  {
    name: 'Traveler',
    greetings: [
      "Hey! How's it going? 👋",
      "Hey there! What's up?",
      "Hi! Nice to meet you 😊",
      "Hello! How are you today?",
      "Hey! What brings you here?",
    ],
    conversations: [
      // Q&A style - bot asks about you
      {
        question: "Where are you from? 🌍",
        followups: ["That's awesome! I've always wanted to visit.", "Nice! Is it cold/warm there right now?", "Cool! What's the best thing about where you live?"],
      },
      {
        question: "What do you do for fun? 🎮",
        followups: ["That sounds fun!", "Nice! I'm into that too.", "Oh cool, how did you get into that?"],
      },
      {
        question: "What kind of music do you like? 🎵",
        followups: ["Great taste!", "I'll have to check that out.", "Nice, I'm more into electronic myself."],
      },
      {
        question: "Seen any good movies or shows lately? 🎬",
        followups: ["I've been meaning to watch that!", "Oh I heard that was good!", "I'll add it to my list!"],
      },
      {
        question: "What's the most interesting place you've traveled to? ✈️",
        followups: ["That sounds amazing!", "What was the food like there?", "Would you go back?"],
      },
      {
        question: "Do you have any pets? 🐱",
        followups: ["Aww that's cute!", "Pets are the best.", "I want one so bad!"],
      },
    ],
    exits: [
      "Hey, I gotta go! Nice chatting with you 😊",
      "Someone's calling me, gotta run! Take care!",
      "This was fun but I have to go now. Good luck! ✌️",
      "Gotta go! Nice meeting you 🚀",
      "Sorry, gotta dip! Catch you later!",
    ],
  },
  // Path 2: Casual chatter
  {
    name: 'Casual',
    greetings: [
      "Yo! What's good? 🤙",
      "Hey hey! How are you?",
      "Sup! Nice to meet a random person 😄",
      "Hey! This is fun, talking to strangers!",
    ],
    conversations: [
      {
        question: "So what brings you to random chat today? 🎯",
        followups: ["Same here, just bored!", "Fair enough!", "That's cool, meeting new people is fun."],
      },
      {
        question: "What's the best thing that happened to you this week? ✨",
        followups: ["That's awesome!", "Love hearing that!", "Small wins are the best wins."],
      },
      {
        question: "Are you a morning person or night owl? 🌙",
        followups: ["Same lol", "Respect! I'm definitely a night person.", "I wish I was a morning person!"],
      },
      {
        question: "What's your go-to comfort food? 🍕",
        followups: ["Can't go wrong with that!", "Now I'm hungry haha", "Good choice!"],
      },
      {
        question: "If you could have dinner with any fictional character, who? 🤔",
        followups: ["Interesting pick!", "That would be a wild conversation!", "I love that answer!"],
      },
    ],
    exits: [
      "Alright I gotta bounce! Peace! ✌️",
      "Fun chatting! Gotta go, take care!",
      "I'll catch you later! Stay awesome 🚀",
      "Gotta run! Nice meeting you! 😊",
    ],
  },
  // Path 3: Gamer/nerd
  {
    name: 'Gamer',
    greetings: [
      "Hey! What games you playing? 🎮",
      "Yo! PC or console?",
      "Hey! You a gamer by any chance?",
      "Sup! What's your favorite game right now?",
    ],
    conversations: [
      {
        question: "What games are you into right now? 🎮",
        followups: ["Nice! I've been playing that too.", "Solid choice!", "I need to get into that game."],
      },
      {
        question: "PC, console, or mobile? 🖥️",
        followups: ["Same here, PC master race lol", "Console is so chill though", "Mobile gaming is underrated!"],
      },
      {
        question: "What's the best game you've ever played? 🏆",
        followups: ["Absolute classic!", "That game changed everything.", "GOAT material right there."],
      },
      {
        question: "Do you watch any streamers? 📺",
        followups: ["They're so entertaining!", "I watch them too!", "Fair, I prefer playing too."],
      },
    ],
    exits: [
      "Gotta go queue up for a game! Later! 🎮",
      "Nice chatting! Time to grind 😤",
      "GG! Was fun chatting, gotta go! ✌️",
      "Alright, my squad's waiting. Later! 🚀",
    ],
  },
];

// Pick a random script path
function getRandomScript() {
  return BOT_SCRIPTS[Math.floor(Math.random() * BOT_SCRIPTS.length)];
}

// Get a random greeting from a script
function getGreeting(script) {
  return script.greetings[Math.floor(Math.random() * script.greetings.length)];
}

// Get a random question from a script
function getNextQuestion(script, usedIndices = []) {
  const available = script.conversations.filter((_, i) => !usedIndices.includes(i));
  if (available.length === 0) return null;
  const idx = script.conversations.indexOf(available[Math.floor(Math.random() * available.length)]);
  const convo = script.conversations[idx];
  return { index: idx, question: convo.question, followups: convo.followups };
}

// Get a random exit message
function getExit(script) {
  return script.exits[Math.floor(Math.random() * script.exits.length)];
}

// Simple keyword matching for followup selection
function pickFollowup(followups, userMessage) {
  const msg = userMessage.toLowerCase();
  // Pick followup based on message length or random
  if (msg.length < 10) {
    return followups[Math.floor(Math.random() * followups.length)];
  }
  return followups[Math.floor(Math.random() * followups.length)];
}

export { BOT_SCRIPTS, getRandomScript, getGreeting, getNextQuestion, getExit, pickFollowup };
