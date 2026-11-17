export async function getNightLock(req, res) {
  res.json({ nightLock: req.user.nightLock });
}
export async function saveNightLock(req, res) {
  req.user.nightLock = { ...(req.user.nightLock?.toObject?.() || req.user.nightLock || {}), ...req.body };
  await req.user.save();
  res.json({ nightLock: req.user.nightLock });
}
