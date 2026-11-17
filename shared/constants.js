// Shared constants used by the web app and the Node.js API.
// Wording follows the FocusNest Complete Project Document.

export const USER_TYPES = ['School student', 'University student', 'Working professional', 'Other'];

export const STRUGGLES = [
  { id: 'reels', label: 'Reels & scrolling', emoji: '📱' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'comparison', label: 'Comparing with others', emoji: '🪞' },
  { id: 'lonely', label: 'Feeling lonely', emoji: '🫂' },
  { id: 'latenight', label: 'Late-night phone use', emoji: '🌙' },
];

export const DANGER_TIMES = ['Morning', 'Afternoon', 'Evening', 'Late night (after 12 AM)'];

export const MOODS = [
  { id: 'great', emoji: '😄', label: 'Great' },
  { id: 'good', emoji: '🙂', label: 'Good' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'tired', emoji: '😴', label: 'Tired' },
  { id: 'stressed', emoji: '😟', label: 'Stressed' },
  { id: 'low', emoji: '😔', label: 'Low' },
];

export const MAIN_APPS = ['Instagram', 'TikTok', 'YouTube', 'WhatsApp', 'Snapchat', 'Games', 'Netflix', 'Other'];

export const WIND_DOWN_CHECKLIST = [
  { id: 'charger', label: 'Charger away', emoji: '🔌' },
  { id: 'teeth', label: 'Brush teeth', emoji: '🪥' },
  { id: 'alarm', label: 'Set alarm', emoji: '⏰' },
  { id: 'screens', label: 'No screens', emoji: '📵' },
];

export const NIGHT_LOCK_APPS = [
  { id: 'social', label: 'Social feed', example: 'Instagram, TikTok' },
  { id: 'video', label: 'Endless video', example: 'YouTube, Reels' },
  { id: 'games', label: 'Time-sink games', example: 'PUBG and other games' },
  { id: 'messaging', label: 'Group chats', example: 'Late-night chats' },
];

export const LIMITS = {
  maxExtensionsPerBreak: 2,
  extensionMinutes: 5,
  demoSeconds: 30,
  focusMinutesDefault: 25,
  breakMinutesDefault: 30,
  activityPointsPerDay: 3, // offline activities that earn points per day
  pauseSeconds: 30, // breathing pause before an extension
};

export const POINTS = {
  focusPer25: 10, // completed focus session: +10 points per 25 minutes
  returnOnTime: 5, // back to focus on time after a break
  bedtimeOnTarget: 10, // in bed within 30 minutes of the goal
  offlineActivity: 5,
  pointsPerLevel: 800,
};

export const LEVEL_NAMES = [
  'Hatchling', 'Nestling', 'Branch Hopper', 'Fledgling', 'Fledgling Focus',
  'Steady Flyer', 'Sky Glider', 'High Flyer', 'Free Bird', 'Nest Master',
];

export const BADGES = [
  { code: 'first-flight', name: 'First Flight', description: 'Complete your first focus session', emoji: '🐣' },
  { code: 'early-bird', name: 'Early Bird', description: 'Reach a 3-day sleep streak', emoji: '🌅' },
  { code: 'night-owl-tamed', name: 'Night Owl Tamed', description: 'Reach a 7-day sleep streak', emoji: '🦉' },
  { code: 'consistency-king', name: 'Consistency King', description: 'Reach a 14-day sleep streak', emoji: '👑' },
  { code: 'deep-thinker', name: 'Deep Thinker', description: 'Complete 10 focus sessions', emoji: '🧠' },
  { code: 'weekly-hero', name: 'Weekly Hero', description: 'Complete a weekly quest', emoji: '🦸' },
  { code: 'offline-explorer', name: 'Offline Explorer', description: 'Finish 5 offline activities', emoji: '🌿' },
  { code: 'grateful-heart', name: 'Grateful Heart', description: 'Write wins on 7 different days', emoji: '💚' },
  { code: 'century-club', name: 'Century Club', description: 'Earn 1,000 points', emoji: '💯' },
];

export const ACTIVITIES = [
  { id: 'walk', title: 'Go for a 15 minute walk', description: 'Step outside and notice five things around you.', minutes: 15, category: 'Move', emoji: '🚶' },
  { id: 'cricket', title: 'Play a quick game of cricket', description: 'Invite a friend or two for a short match.', minutes: 15, category: 'Move', emoji: '🏏' },
  { id: 'stretch', title: 'Stretch for 15 minutes', description: 'Neck, shoulders, back — gently undo the screen posture.', minutes: 15, category: 'Move', emoji: '🧘' },
  { id: 'call-family', title: 'Call someone in your family', description: 'A real voice beats a feed. Ask how their day went.', minutes: 15, category: 'Connect', emoji: '📞' },
  { id: 'tea-friend', title: 'Have tea with a friend', description: 'Face-to-face time, phones face down on the table.', minutes: 15, category: 'Connect', emoji: '🍵' },
  { id: 'help-someone', title: 'Help someone nearby', description: 'Cook, tidy or carry something for someone at home.', minutes: 15, category: 'Connect', emoji: '🤝' },
  { id: 'music', title: 'Listen to music with your eyes closed', description: 'Pick one album or playlist and just listen.', minutes: 15, category: 'Calm', emoji: '🎧' },
  { id: 'breathe', title: 'Do a breathing exercise', description: 'In for 4, hold for 4, out for 6. Repeat for a few minutes.', minutes: 10, category: 'Calm', emoji: '🌬️' },
  { id: 'read', title: 'Read 10 pages of a book', description: 'Paper pages, no notifications.', minutes: 15, category: 'Calm', emoji: '📖' },
  { id: 'doodle', title: 'Draw or doodle something', description: 'No skill needed — just let the pen move.', minutes: 15, category: 'Create', emoji: '🎨' },
  { id: 'journal', title: 'Write a page in a journal', description: 'What is on your mind right now?', minutes: 15, category: 'Create', emoji: '✍️' },
  { id: 'cook', title: 'Make a simple snack', description: 'Cut fruit, make chai or a sandwich — with full attention.', minutes: 15, category: 'Create', emoji: '🥪' },
];

export const ACTIVITY_CATEGORIES = ['Move', 'Connect', 'Calm', 'Create'];

// Static community data (Phase 1: static)
export const CAMPUS_EVENTS = [
  { id: 'evt-walk', title: 'Sunset walking group', when: 'Every Tuesday, 5:30 PM', place: 'Main campus gate', type: 'Campus', emoji: '🚶' },
  { id: 'evt-study', title: 'Silent study circle', when: 'Weekdays, 4:00 PM', place: 'Library, 2nd floor', type: 'Campus', emoji: '📚' },
  { id: 'evt-cricket', title: 'Friday cricket meetup', when: 'Fridays, 4:30 PM', place: 'Sports ground', type: 'Local', emoji: '🏏' },
  { id: 'evt-tea', title: 'Tea & talk break', when: 'Wednesdays, 1:00 PM', place: 'Cafeteria / office pantry', type: 'Workplace', emoji: '☕' },
  { id: 'evt-art', title: 'Sketch & chill evening', when: 'Saturdays, 6:00 PM', place: 'Community centre', type: 'Local', emoji: '🎨' },
];

export const CLUBS = [
  { id: 'club-sports', name: 'Sports society', description: 'Cricket, football and badminton every week.' },
  { id: 'club-books', name: 'Book club', description: 'One book a month, one chat a week.' },
  { id: 'club-volunteer', name: 'Volunteer network', description: 'Small weekend projects that help others.' },
  { id: 'club-music', name: 'Music circle', description: 'Play, sing or just listen together.' },
];

export const GROUP_CHALLENGES = [
  { id: 'ch-phone-free-dinner', title: 'Phone-free dinner week', description: 'Eat dinner without phones for 7 days.', participants: 42 },
  { id: 'ch-sleep-before-12', title: 'In bed before 12 AM', description: 'Five nights in bed before midnight.', participants: 67 },
  { id: 'ch-offline-weekend', title: 'Offline Sunday morning', description: 'No screens before noon on Sunday.', participants: 28 },
];

export const POSITIVE_PROMPTS = [
  'Compare yourself to yesterday, not to others.',
  'Small steps still move you forward.',
  'Rest is part of the work.',
  'You decide where your attention goes.',
  'Progress, not perfection.',
  'A good day can start with one small win.',
  'Being bored is how new ideas begin.',
];

// Verified Nov 2026 from public listings (TherapyRoute, Rozan). Re-check before launch.
export const SUPPORT_CONTACTS = [
  { name: 'Sehat Tahaffuz 1166', detail: 'National health helpline, includes the Humraaz mental health service', href: 'tel:1166' },
  { name: 'Rozan Counseling Helpline', detail: '0800-22444 (toll-free) — confidential emotional support in Urdu and English', href: 'tel:080022444' },
  { name: 'Taskeen mental health support', detail: '0316-8275336 — free support, 11 AM to 11 PM', href: 'tel:+923168275336' },
  { name: 'Emergency services (Pakistan)', detail: 'Dial 1122 (rescue) or 15 (police) in an emergency', href: 'tel:1122' },
  { name: 'Your campus or workplace counselor', detail: 'Ask student affairs or HR for verified contact details.', href: null },
];
