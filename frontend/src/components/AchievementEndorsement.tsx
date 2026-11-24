type EndorsementStatus = 'unverified' | 'endorsed' | 'correction_requested';

export default function AchievementEndorsement({ status }: { status?: EndorsementStatus }) {
  if (!status || status === 'unverified' || status === 'endorsed') return null;

  return (
    <span className={`achievement-endorsement achievement-endorsement-${status}`}>
      <span className="achievement-endorsement-dot" />
      CORRECTION REQUESTED
    </span>
  );
}
