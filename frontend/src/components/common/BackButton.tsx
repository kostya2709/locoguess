import { useNavigate } from 'react-router-dom';

interface Props {
  to?: string;
  label?: string;
}

/** Simple back navigation button. Goes to `to` or uses browser history. */
export function BackButton({ to, label = 'Назад' }: Props) {
  const navigate = useNavigate();

  return (
    <button
      className="back-btn"
      onClick={() => (to ? navigate(to) : navigate(-1))}
    >
      ← {label}
    </button>
  );
}
