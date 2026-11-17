import { CLUBS, GROUP_CHALLENGES } from '../../../shared/constants.js';
import { CampusEvent, User } from '../models/index.js';
import { notFound } from '../utils/httpError.js';

export async function events(req, res) {
  const items = await CampusEvent.find().lean();
  const joined = new Set(req.user.joinedEvents || []);
  res.json({
    events: items.map((e) => ({ id: e.key, title: e.title, when: e.date, place: e.place, type: e.type, link: e.link, emoji: e.emoji, joined: joined.has(e.key) })),
    clubs: CLUBS.map((c) => ({ ...c, joined: joined.has(c.id) })),
    challenges: GROUP_CHALLENGES.map((c) => ({ ...c, joined: joined.has(c.id) })),
  });
}

export async function join(req, res) {
  const id = String(req.params.key);
  const exists = (await CampusEvent.exists({ key: id })) || CLUBS.some((c) => c.id === id) || GROUP_CHALLENGES.some((c) => c.id === id);
  if (!exists) throw notFound('Event');
  const update = req.body.joined ? { $addToSet: { joinedEvents: id } } : { $pull: { joinedEvents: id } };
  const user = await User.findByIdAndUpdate(req.userId, update, { new: true });
  res.json({ joinedEvents: user.joinedEvents });
}
