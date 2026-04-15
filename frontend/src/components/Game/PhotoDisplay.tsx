interface Props {
  url: string;
}

/** Displays the current round's photo. */
export function PhotoDisplay({ url }: Props) {
  return (
    <div className="photo-display">
      <img src={url} alt="Угадайте место" />
    </div>
  );
}
