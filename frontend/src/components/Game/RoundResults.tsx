import type { GuessResult } from '../../types/game';

interface RevealData {
  correct: { lat: number; lng: number; name: string | null };
  guesses: GuessResult[];
}

interface Props {
  data: RevealData;
}

/** Displays round results: correct location and each team's score. */
export function RoundResults({ data }: Props) {
  const sorted = [...data.guesses].sort((a, b) => b.score - a.score);

  return (
    <div className="round-results">
      <h3>
        Правильный ответ: {data.correct.name || `${data.correct.lat.toFixed(2)}, ${data.correct.lng.toFixed(2)}`}
      </h3>
      <table>
        <thead>
          <tr>
            <th>Команда</th>
            <th>Расстояние</th>
            <th>Очки</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((g) => (
            <tr key={g.team_id}>
              <td>
                <span className="team-dot" style={{ background: g.team_color }} />
                {g.team_name}
              </td>
              <td>{g.distance_km.toFixed(1)} км</td>
              <td>{g.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
