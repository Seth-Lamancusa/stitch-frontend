// Bot configuration and metadata
export const AVAILABLE_BOTS = [
  { 
    uid: "claude-system",
    display_name: "Claude",
    user_tag: "claude",
    email: "claude@stitch.fyi"
  },
  { 
    uid: "grok-system",
    display_name: "Grok",
    user_tag: "grok",
    email: "grok@stitch.fyi"
  },
  { 
    uid: "gemini-system",
    display_name: "Gemini",
    user_tag: "gemini",
    email: "gemini@stitch.fyi"
  },
  { 
    uid: "chatgpt-system",
    display_name: "GP",
    user_tag: "chatgpt",
    email: "chatgpt@stitch.fyi"
  }
];

// Helper functions for bot operations
export const getBotByUid = (uid) => AVAILABLE_BOTS.find(bot => bot.uid === uid);
export const getBotByTag = (tag) => AVAILABLE_BOTS.find(bot => bot.user_tag === tag);

export default AVAILABLE_BOTS; 