import { HeartHandshake, Phone, ShieldAlert, UserRound } from 'lucide-react';
import { SUPPORT_CONTACTS } from '@shared/constants.js';
import { Card, CardHeader } from '../components/ui/Card.jsx';

/** Screen 12: Support (feature F13). FocusNest is not a crisis service. */
export default function Support() {
  return (
    <div className="page space-y-5">
      <Card className="flex flex-col items-start gap-4 bg-gradient-to-br from-teal to-teal-700 text-white sm:flex-row sm:items-center">
        <HeartHandshake className="h-12 w-12 shrink-0" aria-hidden />
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold">Talk to someone</h2>
          <p className="text-teal-50">If stress, loneliness or something online is weighing on you, a real conversation helps. You deserve support.</p>
        </div>
        <a href="tel:1166" className="rounded-full bg-white px-6 py-3 font-semibold text-teal-700 hover:bg-teal-50">Call 1166</a>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Counseling and helplines" icon={Phone} subtitle="Free and confidential (Pakistan)" />
          <ul className="space-y-3">
            {SUPPORT_CONTACTS.map((c) => (
              <li key={c.name} className="list-row">
                <div><p className="font-semibold">{c.name}</p><p className="muted text-sm">{c.detail}</p></div>
                {c.href && <a href={c.href} className="shrink-0 rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-200">Call</a>}
              </li>
            ))}
          </ul>
          <p className="muted mt-4 text-xs">If you or someone else is in immediate danger, call emergency services (1122 or 15) or go to the nearest hospital. FocusNest does not provide counseling or emergency response.</p>
        </Card>

        <div className="space-y-5">
          <Guide icon={UserRound} title="Feeling lonely" points={[
            'Loneliness is common and it is not your fault.',
            'Send one message to someone today — "thinking of you" is enough.',
            'Join one small offline activity this week (see Community).',
            'Scrolling can make loneliness feel bigger. Notice how you feel after.',
          ]} />
          <Guide icon={ShieldAlert} title="Harassment and online abuse" points={[
            'It is not your fault. You do not have to reply.',
            'Block and report the account using the app’s safety tools.',
            'Save screenshots only if it is safe, in case you want to report later.',
            'Tell someone you trust. In Pakistan you can also call the national cybercrime helpline (1991).',
          ]} />
        </div>
      </div>
    </div>
  );
}

function Guide({ icon, title, points }) {
  return (
    <Card>
      <CardHeader title={title} icon={icon} />
      <ul className="space-y-2">{points.map((p) => <li key={p} className="flex gap-2"><span className="text-teal" aria-hidden>•</span><span>{p}</span></li>)}</ul>
    </Card>
  );
}
