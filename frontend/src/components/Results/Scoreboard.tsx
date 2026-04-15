import type { ScoreboardEntry } from '../../types/game';

interface Props {
  entries: ScoreboardEntry[];
}

/** Final game scoreboard showing rankings and per-round scores. */
export function Scoreboard({ entries }: Props) {
  if (entries.length === 0) return <p>Загрузка результатов...</p>;

  const totalRounds = entries[0]?.round_scores.length ?? 0;

  return (
    <div className="scoreboard">
      <table>
        <thead>
          <tr>
            <th>Место</th>
            <th>Команда</th>
            {Array.from({ length: totalRounds }, (_, i) => (
              <th key={i}>Р{i + 1}</th>
            ))}
            <th>Итого</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.team_id} className={entry.rank === 1 ? 'winner' : ''}>
              <td>{entry.rank}</td>
              <td>
                <span className="team-dot" style={{ background: entry.team_color }} />
                {entry.team_name}
              </td>
              {entry.round_scores.map((score, i) => (
                <td key={i}>{score ?? '-'}</td>
              ))}
              <td className="total-score">{entry.total_score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
