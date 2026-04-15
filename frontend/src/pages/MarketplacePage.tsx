import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { BackButton } from '../components/common/BackButton';
import { PickerMap } from '../components/Map/PickerMap';
import type { PackInfo, PackDetail } from '../api/client';

type View = 'list' | 'detail' | 'create' | 'add_round';

export function MarketplacePage() {
  const [view, setView] = useState<View>('list');
  const [packs, setPacks] = useState<PackInfo[]>([]);
  const [selectedPack, setSelectedPack] = useState<PackDetail | null>(null);
  const [error, setError] = useState('');

  // Create pack form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Edit pack
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Edit round
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [editRoundName, setEditRoundName] = useState('');
  const [editRoundPosition, setEditRoundPosition] = useState<[number, number] | null>(null);
  const [editRoundExistingPhotos, setEditRoundExistingPhotos] = useState<string[]>([]); // existing filenames to keep
  const [editRoundNewPhotos, setEditRoundNewPhotos] = useState<File[]>([]);
  const [editRoundNewPreviews, setEditRoundNewPreviews] = useState<string[]>([]);
  const editRoundFileRef = useRef<HTMLInputElement>(null);

  // Edit round - music
  const [editRoundMusicFile, setEditRoundMusicFile] = useState<File | null>(null);
  const [editRoundHasMusic, setEditRoundHasMusic] = useState(false);

  // Add round form
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [locationName, setLocationName] = useState('');
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadPacks(); }, []);

  async function loadPacks() {
    const p = await api.getPacks();
    setPacks(p);
  }

  async function openPack(packId: string) {
    setError('');
    const detail = await api.getPack(packId);
    setSelectedPack(detail);
    setEditName(detail.name);
    setEditDesc(detail.description);
    setView('detail');
  }

  async function handleCreatePack(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError('');
    try {
      const pack = await api.createPack(newName.trim(), newDesc.trim());
      setNewName('');
      setNewDesc('');
      await loadPacks();
      setSelectedPack(pack);
      setEditName(pack.name);
      setEditDesc(pack.description);
      setView('detail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать набор');
    }
  }

  async function handleSavePack() {
    if (!selectedPack) return;
    setError('');
    try {
      const updated = await api.updatePack(selectedPack.id, { name: editName, description: editDesc });
      setSelectedPack(updated);
      loadPacks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  }

  async function handleDeletePack() {
    if (!selectedPack) return;
    if (!window.confirm(`Удалить набор «${selectedPack.name}»?`)) return;
    await api.deletePack(selectedPack.id);
    setSelectedPack(null);
    setView('list');
    loadPacks();
  }

  async function handleDeleteRound(roundId: string) {
    if (!selectedPack) return;
    if (!window.confirm('Удалить этот раунд?')) return;
    await api.deletePackRound(selectedPack.id, roundId);
    openPack(selectedPack.id);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPhotoFiles(files);
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  async function handleAddRound(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPack || !position || photoFiles.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const filenames: string[] = [];
      for (const file of photoFiles) {
        const fn = await api.uploadPackPhoto(selectedPack.id, file);
        filenames.push(fn);
      }
      const photoPath = filenames.length === 1 ? filenames[0] : JSON.stringify(filenames);
      let musicFn: string | undefined;
      if (musicFile) {
        musicFn = await api.uploadPackMusic(selectedPack.id, musicFile);
      }
      await api.addPackRound(selectedPack.id, photoPath, position[0], position[1], locationName || undefined, musicFn);
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setMusicFile(null);
      setLocationName('');
      setPosition(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      openPack(selectedPack.id);
      setView('detail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить раунд');
    } finally {
      setUploading(false);
    }
  }

  function startEditRound(r: { id: string; photo_path: string; photo_urls: string[]; location_name: string | null; correct_lat: number; correct_lng: number; music_url: string | null }) {
    setEditingRoundId(r.id);
    setEditRoundName(r.location_name || '');
    setEditRoundPosition([r.correct_lat, r.correct_lng]);
    // Parse existing filenames from photo_path
    let existingFiles: string[];
    try {
      const parsed = JSON.parse(r.photo_path);
      existingFiles = Array.isArray(parsed) ? parsed : [r.photo_path];
    } catch {
      existingFiles = [r.photo_path];
    }
    setEditRoundExistingPhotos(existingFiles);
    setEditRoundNewPhotos([]);
    setEditRoundNewPreviews([]);
    setEditRoundMusicFile(null);
    setEditRoundHasMusic(!!r.music_url);
  }

  function handleRemoveExistingPhoto(index: number) {
    setEditRoundExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function handleEditRoundFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setEditRoundNewPhotos((prev) => [...prev, ...files]);
    setEditRoundNewPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  }

  async function handleSaveRound() {
    if (!selectedPack || !editingRoundId) return;
    setError('');
    setUploading(true);
    try {
      const updates: Record<string, unknown> = {};
      updates.location_name = editRoundName || null;
      if (editRoundPosition) {
        updates.correct_lat = editRoundPosition[0];
        updates.correct_lng = editRoundPosition[1];
      }
      // Upload new photos and combine with remaining existing ones
      const newFilenames: string[] = [];
      for (const file of editRoundNewPhotos) {
        const fn = await api.uploadPackPhoto(selectedPack.id, file);
        newFilenames.push(fn);
      }
      const allFilenames = [...editRoundExistingPhotos, ...newFilenames];
      if (allFilenames.length > 0) {
        updates.photo_path = allFilenames.length === 1 ? allFilenames[0] : JSON.stringify(allFilenames);
      }
      if (editRoundMusicFile) {
        const musicFn = await api.uploadPackMusic(selectedPack.id, editRoundMusicFile);
        updates.music_path = musicFn;
      }
      await api.updatePackRound(selectedPack.id, editingRoundId, updates as { photo_path?: string; correct_lat?: number; correct_lng?: number; location_name?: string; music_path?: string });
      setEditingRoundId(null);
      openPack(selectedPack.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить раунд');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="marketplace-page">
      <BackButton to="/" />
      <h1>Наборы</h1>
      {error && <div className="error">{error}</div>}

      {/* Pack list */}
      {view === 'list' && (
        <>
          <div className="mp-actions">
            <button onClick={() => setView('create')}>+ Создать набор</button>
          </div>
          <div className="mp-grid">
            {packs.map((pack) => (
              <button key={pack.id} className="mp-card" onClick={() => openPack(pack.id)}>
                <strong>{pack.name}</strong>
                <span>{pack.description}</span>
                <span className="mp-count">{pack.round_count} раундов</span>
              </button>
            ))}
            {packs.length === 0 && <p className="mp-empty">Наборов пока нет</p>}
          </div>
        </>
      )}

      {/* Create pack */}
      {view === 'create' && (
        <div className="card">
          <h2>Новый набор</h2>
          <form className="settings-form" onSubmit={handleCreatePack}>
            <input type="text" placeholder="Название" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input type="text" placeholder="Описание" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <div className="settings-buttons">
              <button type="button" className="secondary-btn" onClick={() => setView('list')}>Отмена</button>
              <button type="submit" disabled={!newName.trim()}>Создать</button>
            </div>
          </form>
        </div>
      )}

      {/* Pack detail / edit */}
      {view === 'detail' && selectedPack && (
        <div className="mp-detail">
          <div className="card">
            <h2>Редактирование набора</h2>
            <div className="settings-form">
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Название" />
              <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Описание" />
              <div className="settings-buttons">
                <button className="secondary-btn" onClick={() => { setSelectedPack(null); setView('list'); }}>
                  ← К списку
                </button>
                {(editName !== selectedPack.name || editDesc !== selectedPack.description) && (
                  <button onClick={handleSavePack}>Сохранить</button>
                )}
                <button className="danger-btn" onClick={handleDeletePack}>Удалить набор</button>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Раунды ({selectedPack.rounds.length})</h2>
            {selectedPack.rounds.map((r) => (
              <div key={r.id} className="mp-round-wrapper">
                <div className="mp-round">
                  <div className="mp-round-info" onClick={() => editingRoundId === r.id ? setEditingRoundId(null) : startEditRound(r)} style={{ cursor: 'pointer' }}>
                    <span className="mp-round-num">#{r.round_number + 1}</span>
                    {r.photo_urls.length > 0 && (
                      <img src={r.photo_urls[0]} alt="" className="mp-round-thumb" />
                    )}
                    <span>{r.location_name || `${r.correct_lat.toFixed(2)}, ${r.correct_lng.toFixed(2)}`}</span>
                    <span className="mp-photo-count">{r.photo_urls.length} фото</span>
                    {r.music_url && <span className="mp-music-badge">♪</span>}
                  </div>
                  <div className="mp-round-actions">
                    <button
                      className="secondary-btn-sm"
                      disabled={r.round_number === 0}
                      onClick={() => { api.movePackRound(selectedPack.id, r.id, 'up').then(() => openPack(selectedPack.id)); }}
                      title="Вверх"
                    >↑</button>
                    <button
                      className="secondary-btn-sm"
                      disabled={r.round_number >= selectedPack.rounds.length - 1}
                      onClick={() => { api.movePackRound(selectedPack.id, r.id, 'down').then(() => openPack(selectedPack.id)); }}
                      title="Вниз"
                    >↓</button>
                    <button className="secondary-btn-sm" onClick={() => editingRoundId === r.id ? setEditingRoundId(null) : startEditRound(r)}>
                      {editingRoundId === r.id ? '▲' : '✎'}
                    </button>
                    <button className="danger-btn-sm" onClick={() => handleDeleteRound(r.id)}>✕</button>
                  </div>
                </div>
                {editingRoundId === r.id && (
                  <div className="mp-round-edit">
                    <input
                      type="text"
                      placeholder="Название места"
                      value={editRoundName}
                      onChange={(e) => setEditRoundName(e.target.value)}
                    />

                    {/* Existing photos with remove buttons */}
                    {editRoundExistingPhotos.length > 0 && (
                      <div className="mp-existing-photos">
                        <p className="hint">Текущие фото:</p>
                        <div className="mp-photo-list">
                          {editRoundExistingPhotos.map((filename, i) => (
                            <div key={i} className="mp-photo-item">
                              <img src={`/photos/${filename}`} alt="" className="mp-photo-thumb" />
                              <button className="mp-photo-remove" onClick={() => handleRemoveExistingPhoto(i)} title="Убрать">✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New photos to add */}
                    {editRoundNewPreviews.length > 0 && (
                      <div className="mp-existing-photos">
                        <p className="hint">Новые фото:</p>
                        <div className="mp-photo-list">
                          {editRoundNewPreviews.map((url, i) => (
                            <div key={i} className="mp-photo-item">
                              <img src={url} alt="" className="mp-photo-thumb" />
                              <button className="mp-photo-remove" onClick={() => {
                                setEditRoundNewPhotos((prev) => prev.filter((_, j) => j !== i));
                                setEditRoundNewPreviews((prev) => prev.filter((_, j) => j !== i));
                              }} title="Убрать">✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="file-upload-area">
                      <input ref={editRoundFileRef} type="file" accept="image/*" multiple onChange={handleEditRoundFileSelect} className="file-input" id={`edit-photo-${r.id}`} />
                      <label htmlFor={`edit-photo-${r.id}`} className="file-upload-label file-upload-sm">
                        <span>+ Добавить фото</span>
                      </label>
                    </div>
                    <div className="mp-music-upload">
                      <label className="hint">
                        Музыка (необязательно): {editRoundHasMusic && !editRoundMusicFile ? '♪ есть' : ''}
                      </label>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) setEditRoundMusicFile(f); }}
                      />
                    </div>
                    <p className="hint">Нажмите на карту, чтобы изменить место:</p>
                    <div className="round-setup-map">
                      <PickerMap position={editRoundPosition} onPositionChange={(pos) => setEditRoundPosition(pos)} height="200px" />
                    </div>
                    <div className="settings-buttons">
                      <button className="secondary-btn" onClick={() => setEditingRoundId(null)}>Отмена</button>
                      <button onClick={handleSaveRound} disabled={uploading}>
                        {uploading ? 'Сохранение...' : 'Сохранить раунд'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button className="mp-add-round-btn" onClick={() => setView('add_round')}>
              + Добавить раунд
            </button>
          </div>
        </div>
      )}

      {/* Add round */}
      {view === 'add_round' && selectedPack && (
        <div className="card">
          <h2>Добавить раунд в «{selectedPack.name}»</h2>
          <form className="round-form" onSubmit={handleAddRound}>
            <div className="file-upload-area">
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="file-input" id="mp-photo-upload" />
              <label htmlFor="mp-photo-upload" className="file-upload-label">
                {photoPreviews.length > 0 ? (
                  <div className="file-previews">
                    {photoPreviews.map((url, i) => <img key={i} src={url} alt="" className="file-preview" />)}
                  </div>
                ) : (
                  <span>Нажмите, чтобы выбрать фото (можно несколько)</span>
                )}
              </label>
            </div>
            <input type="text" placeholder="Название места (необязательно)" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
            <div className="mp-music-upload">
              <label className="hint">Музыка (необязательно):</label>
              <input type="file" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setMusicFile(f); }} />
            </div>
            <p className="hint">Нажмите на карту, чтобы отметить правильное место:</p>
            <div className="round-setup-map">
              <PickerMap position={position} onPositionChange={(pos) => setPosition(pos)} height="250px" />
            </div>
            {position && <p className="hint">Выбрано: {position[0].toFixed(4)}, {position[1].toFixed(4)}</p>}
            <div className="settings-buttons">
              <button type="button" className="secondary-btn" onClick={() => setView('detail')}>Отмена</button>
              <button type="submit" disabled={photoFiles.length === 0 || !position || uploading}>
                {uploading ? 'Загрузка...' : 'Добавить'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
