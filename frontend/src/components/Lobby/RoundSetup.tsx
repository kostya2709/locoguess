import { useState, useRef } from 'react';
import { api } from '../../api/client';
import { PickerMap } from '../Map/PickerMap';

interface Props {
  joinCode: string;
  totalRounds: number;
  onRoundAdded: () => void;
}

interface AddedRound {
  roundNumber: number;
  locationName: string;
}

export function RoundSetup({ joinCode, totalRounds, onRoundAdded }: Props) {
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [locationName, setLocationName] = useState('');
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [addedRounds, setAddedRounds] = useState<AddedRound[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allAdded = addedRounds.length >= totalRounds;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPhotoFiles(files);
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  async function handleAddRound(e: React.FormEvent) {
    e.preventDefault();
    if (!position || photoFiles.length === 0) return;
    setError('');
    setUploading(true);
    try {
      // Upload all photos
      const filenames: string[] = [];
      for (const file of photoFiles) {
        const filename = await api.uploadPhoto(joinCode, file);
        filenames.push(filename);
      }
      // Store as JSON array if multiple, plain string if single
      const photoPath = filenames.length === 1 ? filenames[0] : JSON.stringify(filenames);
      const round = await api.addRound(
        joinCode,
        photoPath,
        position[0],
        position[1],
        locationName || undefined,
      );
      setAddedRounds((prev) => [
        ...prev,
        { roundNumber: round.round_number, locationName: locationName || `${photoFiles.length} фото` },
      ]);
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setLocationName('');
      setPosition(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onRoundAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить раунд');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="card round-setup">
      <h2>
        Настройка раундов ({addedRounds.length}/{totalRounds})
      </h2>

      {addedRounds.length > 0 && (
        <ul className="added-rounds-list">
          {addedRounds.map((r) => (
            <li key={r.roundNumber}>
              Раунд {r.roundNumber + 1}: {r.locationName}
            </li>
          ))}
        </ul>
      )}

      {!allAdded && (
        <form onSubmit={handleAddRound} className="round-form">
          {error && <div className="error">{error}</div>}

          <div className="file-upload-area">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="file-input"
              id="photo-upload"
            />
            <label htmlFor="photo-upload" className="file-upload-label">
              {photoPreviews.length > 0 ? (
                <div className="file-previews">
                  {photoPreviews.map((url, i) => (
                    <img key={i} src={url} alt={`Фото ${i + 1}`} className="file-preview" />
                  ))}
                </div>
              ) : (
                <span>Нажмите, чтобы выбрать фото (можно несколько)</span>
              )}
            </label>
          </div>

          <input
            type="text"
            placeholder="Название места (необязательно)"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
          />
          <p className="hint">Нажмите на карту, чтобы отметить правильное место:</p>
          <div className="round-setup-map">
            <PickerMap position={position} onPositionChange={(pos) => setPosition(pos)} height="250px" />
          </div>
          {position && (
            <p className="hint">
              Выбрано: {position[0].toFixed(4)}, {position[1].toFixed(4)}
            </p>
          )}
          <button type="submit" disabled={photoFiles.length === 0 || !position || uploading}>
            {uploading ? 'Загрузка...' : `Добавить раунд ${addedRounds.length + 1}`}
          </button>
        </form>
      )}

      {allAdded && (
        <p className="success">Все {totalRounds} раундов настроены!</p>
      )}
    </section>
  );
}
