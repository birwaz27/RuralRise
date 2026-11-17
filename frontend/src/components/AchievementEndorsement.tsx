import { BadgeCheck } from 'lucide-react';

type EndorsementStatus = 'unverified' | 'endorsed' | 'correction_requested';

export default function AchievementEndorsement({ status }: { status?: EndorsementStatus }) {
  if (!status || status === 'unverified') return null;

  return (
    <span className={`achievement-endorsement achievement-endorsement-${status}`}>
      {status === 'endorsed' ? <BadgeCheck size={13} /> : <span className="achievement-endorsement-dot" />}
      {status === 'endorsed' ? 'PE TEACHER ENDORSED' : 'CORRECTION REQUESTED'}
    </span>
  );
}
