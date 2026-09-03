import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function Albums({ user, onNavigate }) {
  const [albums, setAlbums] = useState([]);
  const [availableBeats, setAvailableBeats] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumTracks, setAlbumTracks] = useState([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [isPublic, setIsPublic] = useState(true);

  const [selectedBeatIds, setSelectedBeatIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    loadAlbums();
    loadAvailableBeats();
  }, [user?.id]);

  async function loadAlbums() {
    setLoading(true);
    setError("");

    const { data, error: albumsError } = await supabase
      .from("albums")
      .select(`
        id,
        owner_id,
        title,
        description,
        cover_url,
        is_public,
        created_at,
        updated_at
      `)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (albumsError) {
      setError(albumsError.message);
      setAlbums([]);
    } else {
      setAlbums(data || []);
    }

    setLoading(false);
  }

  async function loadAvailableBeats() {
    setError("");

    const beatsMap = new Map();

    // Producer's own beats
    const { data: ownBeats, error: ownBeatsError } = await supabase
      .from("beats")
      .select(`
        id,
        producer_id,
        title,
        genre,
        other_genre,
        bpm,
        musical_key,
        cover_url,
        mp3_url,
        created_at
      `)
      .eq("producer_id", user.id)
      .order("created_at", { ascending: false });

    if (ownBeatsError) {
      console.error("Own beats error:", ownBeatsError);
    }

    (ownBeats || []).forEach((beat) => {
      beatsMap.set(beat.id, beat);
    });

    // Artist's saved beats
    const { data: savedBeats, error: savedBeatsError } = await supabase
      .from("saved_beats")
      .select(`
        beat_id,
        beats (
          id,
          producer_id,
          title,
          genre,
          other_genre,
          bpm,
          musical_key,
          cover_url,
          mp3_url,
          created_at
        )
      `)
      .eq("user_id", user.id);

    if (savedBeatsError) {
      console.error("Saved beats error:", savedBeatsError);
    }

    (savedBeats || []).forEach((saved) => {
      if (saved.beats?.id) {
        beatsMap.set(saved.beats.id, saved.beats);
      }
    });

    setAvailableBeats(Array.from(beatsMap.values()));
  }

  async function openAlbum(album) {
    setSelectedAlbum(album);
    setLoadingTracks(true);
    setError("");

    const { data, error: tracksError } = await supabase
      .from("album_tracks")
      .select(`
        id,
        album_id,
        beat_id,
        track_number,
        beats (
          id,
          producer_id,
          title,
          genre,
          other_genre,
          bpm,
          musical_key,
          cover_url,
          mp3_url,
          created_at
        )
      `)
      .eq("album_id", album.id)
      .order("track_number", { ascending: true });

    if (tracksError) {
      setError(tracksError.message);
      setAlbumTracks([]);
    } else {
      setAlbumTracks(data || []);
    }

    setLoadingTracks(false);
  }

  function toggleBeat(beatId) {
    setSelectedBeatIds((current) =>
      current.includes(beatId)
        ? current.filter((id) => id !== beatId)
        : [...current, beatId]
    );
  }

  async function uploadAlbumCover() {
    if (!coverFile) {
      return null;
    }

    const fileExtension =
      coverFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `album-covers/${user.id}/${crypto.randomUUID()}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(filePath, coverFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: coverFile.type || "image/jpeg",
      });

    if (uploadError) {
      throw new Error(
        `Album cover upload failed: ${uploadError.message}`
      );
    }

    const { data } = supabase.storage
      .from("covers")
      .getPublicUrl(filePath);

    return data?.publicUrl || null;
  }

  async function createAlbum(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!user?.id) {
      setError("You must be signed in to create an album.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter an album title.");
      return;
    }

    if (selectedBeatIds.length === 0) {
      setError("Please select at least one beat for the album.");
      return;
    }

    setSaving(true);

    try {
      const coverUrl = await uploadAlbumCover();

      const { data: album, error: albumError } = await supabase
        .from("albums")
        .insert({
          owner_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          cover_url: coverUrl,
          is_public: isPublic,
        })
        .select()
        .single();

      if (albumError) {
        throw new Error(albumError.message);
      }

      const trackRows = selectedBeatIds.map((beatId, index) => ({
        album_id: album.id,
        beat_id: beatId,
        track_number: index + 1,
      }));

      const { error: tracksError } = await supabase
        .from("album_tracks")
        .insert(trackRows);

      if (tracksError) {
        await supabase
          .from("albums")
          .delete()
          .eq("id", album.id);

        throw new Error(tracksError.message);
      }

      setTitle("");
      setDescription("");
      setCoverFile(null);
      setIsPublic(true);
      setSelectedBeatIds([]);

      setMessage("✓ Album created successfully.");

      await loadAlbums();
    } catch (err) {
      console.error("Create album error:", err);
      setError(err.message || "Failed to create album.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAlbum(album) {
    const confirmed = window.confirm(
      `Delete "${album.title}"?\n\nThis will remove the album and its track list. Your beats will not be deleted.`
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    const { error: deleteError } = await supabase
      .from("albums")
      .delete()
      .eq("id", album.id)
      .eq("owner_id", user.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (selectedAlbum?.id === album.id) {
      setSelectedAlbum(null);
      setAlbumTracks([]);
    }

    setMessage("✓ Album deleted.");
    await loadAlbums();
  }

  async function removeTrack(track) {
    const confirmed = window.confirm(
      `Remove "${track.beats?.title || "this beat"}" from the album?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("album_tracks")
      .delete()
      .eq("id", track.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("✓ Track removed from album.");

    if (selectedAlbum) {
      await openAlbum(selectedAlbum);
    }
  }

  function openBeat(beat) {
    if (!beat?.id) {
      return;
    }

    window.location.href = `/?beat=${encodeURIComponent(beat.id)}`;
  }

  function formatDate(date) {
    if (!date) {
      return "";
    }

    return new Date(date).toLocaleDateString();
  }

  if (!user) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <button
            type="button"
            style={styles.backButton}
            onClick={() => onNavigate?.("home")}
          >
            ← BACK HOME
          </button>

          <div style={styles.emptyBox}>
            <h1 style={styles.title}>ALBUMS</h1>
            <p>Please sign in to create and manage albums.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <button
          type="button"
          style={styles.backButton}
          onClick={() => onNavigate?.("home")}
        >
          ← BACK HOME
        </button>

        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>TELLEM BEAT STORE</div>
            <h1 style={styles.title}>ALBUMS</h1>
            <p style={styles.subtitle}>
              Create and organize your beats into complete albums.
            </p>
          </div>
        </div>

        {message && <div style={styles.success}>{message}</div>}
        {error && <div style={styles.error}>{error}</div>}

        <section style={styles.createSection}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionLabel}>CREATE NEW</div>
              <h2 style={styles.sectionTitle}>Build an Album</h2>
            </div>
          </div>

          <form onSubmit={createAlbum} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>ALBUM TITLE</label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Enter album title"
                style={styles.input}
                maxLength={120}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>DESCRIPTION</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Tell listeners about this album..."
                style={styles.textarea}
                rows={4}
                maxLength={1000}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>ALBUM COVER</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setCoverFile(event.target.files?.[0] || null)
                }
                style={styles.fileInput}
              />
              <small style={styles.helpText}>
                Optional. JPG, PNG or other standard image formats.
              </small>
            </div>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
              />
              <span>
                Make this album public
              </span>
            </label>

            <div style={styles.trackSelection}>
              <div style={styles.trackSelectionHeader}>
                <div>
                  <div style={styles.sectionLabel}>TRACKS</div>
                  <h3 style={styles.trackTitle}>
                    Select Beats
                  </h3>
                </div>

                <div style={styles.selectedCount}>
                  {selectedBeatIds.length} selected
                </div>
              </div>

              {availableBeats.length === 0 ? (
                <div style={styles.emptySmall}>
                  <p>No beats are currently available to add.</p>
                  <p style={styles.muted}>
                    Upload a beat or save a beat from the marketplace first.
                  </p>
                </div>
              ) : (
                <div style={styles.beatSelectionGrid}>
                  {availableBeats.map((beat) => {
                    const selected = selectedBeatIds.includes(beat.id);

                    return (
                      <button
                        key={beat.id}
                        type="button"
                        onClick={() => toggleBeat(beat.id)}
                        style={{
                          ...styles.beatOption,
                          ...(selected
                            ? styles.beatOptionSelected
                            : {}),
                        }}
                      >
                        <div style={styles.optionCoverWrap}>
                          {beat.cover_url ? (
                            <img
                              src={beat.cover_url}
                              alt={beat.title}
                              style={styles.optionCover}
                            />
                          ) : (
                            <div style={styles.optionCoverPlaceholder}>
                              ♪
                            </div>
                          )}

                          {selected && (
                            <div style={styles.selectedMark}>✓</div>
                          )}
                        </div>

                        <div style={styles.optionInfo}>
                          <strong style={styles.optionTitle}>
                            {beat.title}
                          </strong>

                          <span style={styles.optionMeta}>
                            {beat.genre === "Other"
                              ? beat.other_genre || "Other"
                              : beat.genre || "Beat"}
                            {beat.bpm
                              ? ` • ${beat.bpm} BPM`
                              : ""}
                            {beat.musical_key
                              ? ` • ${beat.musical_key}`
                              : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...styles.primaryButton,
                ...(saving ? styles.disabledButton : {}),
              }}
            >
              {saving ? "CREATING ALBUM..." : "CREATE ALBUM"}
            </button>
          </form>
        </section>

        <section style={styles.albumsSection}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionLabel}>YOUR COLLECTION</div>
              <h2 style={styles.sectionTitle}>My Albums</h2>
            </div>
          </div>

          {loading ? (
            <div style={styles.emptyBox}>
              Loading albums...
            </div>
          ) : albums.length === 0 ? (
            <div style={styles.emptyBox}>
              <h3>No albums yet</h3>
              <p>Create your first album above.</p>
            </div>
          ) : (
            <div style={styles.albumGrid}>
              {albums.map((album) => (
                <article key={album.id} style={styles.albumCard}>
                  <button
                    type="button"
                    onClick={() => openAlbum(album)}
                    style={styles.albumCoverButton}
                  >
                    {album.cover_url ? (
                      <img
                        src={album.cover_url}
                        alt={album.title}
                        style={styles.albumCover}
                      />
                    ) : (
                      <div style={styles.albumPlaceholder}>
                        <span>♪</span>
                      </div>
                    )}

                    <div style={styles.albumOverlay}>
                      OPEN ALBUM
                    </div>
                  </button>

                  <div style={styles.albumInfo}>
                    <div style={styles.albumTitle}>
                      {album.title}
                    </div>

                    <div style={styles.albumMeta}>
                      {album.is_public ? "PUBLIC" : "PRIVATE"} •{" "}
                      {formatDate(album.created_at)}
                    </div>

                    {album.description && (
                      <p style={styles.albumDescription}>
                        {album.description}
                      </p>
                    )}

                    <div style={styles.albumActions}>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => openAlbum(album)}
                      >
                        VIEW TRACKS
                      </button>

                      <button
                        type="button"
                        style={styles.deleteButton}
                        onClick={() => deleteAlbum(album)}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {selectedAlbum && (
          <div style={styles.modalBackdrop}>
            <div style={styles.modal}>
              <button
                type="button"
                style={styles.closeButton}
                onClick={() => {
                  setSelectedAlbum(null);
                  setAlbumTracks([]);
                }}
              >
                ×
              </button>

              <div style={styles.modalHeader}>
                {selectedAlbum.cover_url ? (
                  <img
                    src={selectedAlbum.cover_url}
                    alt={selectedAlbum.title}
                    style={styles.modalCover}
                  />
                ) : (
                  <div style={styles.modalCoverPlaceholder}>♪</div>
                )}

                <div>
                  <div style={styles.sectionLabel}>ALBUM</div>
                  <h2 style={styles.modalTitle}>
                    {selectedAlbum.title}
                  </h2>

                  {selectedAlbum.description && (
                    <p style={styles.modalDescription}>
                      {selectedAlbum.description}
                    </p>
                  )}

                  <div style={styles.modalMeta}>
                    {selectedAlbum.is_public
                      ? "PUBLIC ALBUM"
                      : "PRIVATE ALBUM"}
                  </div>
                </div>
              </div>

              <div style={styles.modalTracks}>
                <div style={styles.sectionLabel}>
                  TRACKLIST
                </div>

                {loadingTracks ? (
                  <div style={styles.emptySmall}>
                    Loading tracks...
                  </div>
                ) : albumTracks.length === 0 ? (
                  <div style={styles.emptySmall}>
                    This album has no tracks.
                  </div>
                ) : (
                  <div style={styles.trackList}>
                    {albumTracks.map((track) => (
                      <div
                        key={track.id}
                        style={styles.trackRow}
                      >
                        <div style={styles.trackNumber}>
                          {track.track_number}
                        </div>

                        {track.beats?.cover_url ? (
                          <img
                            src={track.beats.cover_url}
                            alt={track.beats.title}
                            style={styles.trackCover}
                          />
                        ) : (
                          <div style={styles.trackCoverPlaceholder}>
                            ♪
                          </div>
                        )}

                        <div style={styles.trackInfo}>
                          <strong style={styles.trackName}>
                            {track.beats?.title || "Unknown Beat"}
                          </strong>

                          <span style={styles.trackMeta}>
                            {track.beats?.genre || "Beat"}
                            {track.beats?.bpm
                              ? ` • ${track.beats.bpm} BPM`
                              : ""}
                            {track.beats?.musical_key
                              ? ` • ${track.beats.musical_key}`
                              : ""}
                          </span>
                        </div>

                        <button
                          type="button"
                          style={styles.playButton}
                          onClick={() => openBeat(track.beats)}
                        >
                          ▶
                        </button>

                        <button
                          type="button"
                          style={styles.removeButton}
                          onClick={() => removeTrack(track)}
                        >
                          REMOVE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#080808",
    color: "#f5f5f5",
    padding: "32px 16px 70px",
  },

  container: {
    width: "100%",
    maxWidth: "1200px",
    margin: "0 auto",
  },

  backButton: {
    background: "transparent",
    border: "none",
    color: "#d4af37",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "1px",
    cursor: "pointer",
    padding: "8px 0",
    marginBottom: "25px",
  },

  header: {
    borderBottom: "1px solid #292929",
    paddingBottom: "25px",
    marginBottom: "30px",
  },

  eyebrow: {
    color: "#d4af37",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "2px",
    marginBottom: "8px",
  },

  title: {
    margin: 0,
    fontSize: "clamp(32px, 6vw, 58px)",
    fontWeight: "900",
    letterSpacing: "-1px",
  },

  subtitle: {
    color: "#a5a5a5",
    margin: "10px 0 0",
    fontSize: "15px",
    lineHeight: 1.6,
  },

  success: {
    background: "#102b19",
    border: "1px solid #245a35",
    color: "#8ee0a5",
    padding: "13px 15px",
    borderRadius: "8px",
    marginBottom: "20px",
    fontSize: "14px",
  },

  error: {
    background: "#321313",
    border: "1px solid #683030",
    color: "#ff9999",
    padding: "13px 15px",
    borderRadius: "8px",
    marginBottom: "20px",
    fontSize: "14px",
  },

  createSection: {
    background: "#111111",
    border: "1px solid #242424",
    borderRadius: "14px",
    padding: "24px",
    marginBottom: "45px",
  },

  albumsSection: {
    marginTop: "20px",
  },

  sectionHeader: {
    marginBottom: "22px",
  },

  sectionLabel: {
    color: "#d4af37",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "2px",
    marginBottom: "5px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "25px",
    fontWeight: "800",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  label: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "1.2px",
    color: "#c8c8c8",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#080808",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "13px 14px",
    outline: "none",
    fontSize: "14px",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    background: "#080808",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "13px 14px",
    outline: "none",
    fontSize: "14px",
    fontFamily: "inherit",
  },

  fileInput: {
    color: "#ccc",
    fontSize: "13px",
  },

  helpText: {
    color: "#777",
    fontSize: "11px",
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    color: "#ccc",
    fontSize: "13px",
    cursor: "pointer",
  },

  trackSelection: {
    borderTop: "1px solid #292929",
    paddingTop: "22px",
    marginTop: "4px",
  },

  trackSelectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    marginBottom: "15px",
  },

  trackTitle: {
    margin: 0,
    fontSize: "18px",
  },

  selectedCount: {
    color: "#d4af37",
    fontSize: "12px",
    fontWeight: "700",
  },

  beatSelectionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(230px, 1fr))",
    gap: "10px",
  },

  beatOption: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    width: "100%",
    textAlign: "left",
    background: "#090909",
    color: "#fff",
    border: "1px solid #2b2b2b",
    borderRadius: "9px",
    padding: "8px",
    cursor: "pointer",
  },

  beatOptionSelected: {
    border: "1px solid #d4af37",
    background: "#17140a",
  },

  optionCoverWrap: {
    position: "relative",
    width: "54px",
    height: "54px",
    flexShrink: 0,
  },

  optionCover: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "6px",
  },

  optionCoverPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: "6px",
    background: "#202020",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
  },

  selectedMark: {
    position: "absolute",
    top: "-4px",
    right: "-4px",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "#d4af37",
    color: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "900",
  },

  optionInfo: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  optionTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "13px",
  },

  optionMeta: {
    color: "#777",
    fontSize: "10px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  primaryButton: {
    border: "none",
    borderRadius: "8px",
    background: "#d4af37",
    color: "#050505",
    padding: "14px 18px",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "1px",
    cursor: "pointer",
  },

  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  albumGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "22px",
  },

  albumCard: {
    background: "#111",
    border: "1px solid #252525",
    borderRadius: "12px",
    overflow: "hidden",
  },

  albumCoverButton: {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    padding: 0,
    border: "none",
    background: "#181818",
    cursor: "pointer",
    display: "block",
    overflow: "hidden",
  },

  albumCover: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  albumPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "55px",
    color: "#777",
  },

  albumOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.58)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "11px",
    fontWeight: "900",
    letterSpacing: "1px",
  },

  albumInfo: {
    padding: "15px",
  },

  albumTitle: {
    fontSize: "17px",
    fontWeight: "800",
    marginBottom: "6px",
  },

  albumMeta: {
    color: "#777",
    fontSize: "10px",
    letterSpacing: "0.8px",
  },

  albumDescription: {
    color: "#999",
    fontSize: "12px",
    lineHeight: 1.5,
    margin: "10px 0 0",
  },

  albumActions: {
    display: "flex",
    gap: "8px",
    marginTop: "14px",
  },

  secondaryButton: {
    flex: 1,
    border: "1px solid #444",
    borderRadius: "6px",
    background: "transparent",
    color: "#ddd",
    padding: "9px 7px",
    fontSize: "9px",
    fontWeight: "800",
    cursor: "pointer",
  },

  deleteButton: {
    border: "1px solid #572828",
    borderRadius: "6px",
    background: "transparent",
    color: "#e28b8b",
    padding: "9px 8px",
    fontSize: "9px",
    fontWeight: "800",
    cursor: "pointer",
  },

  emptyBox: {
    background: "#111",
    border: "1px solid #252525",
    borderRadius: "12px",
    padding: "35px 20px",
    textAlign: "center",
    color: "#aaa",
  },

  emptySmall: {
    background: "#0a0a0a",
    border: "1px dashed #303030",
    borderRadius: "9px",
    padding: "25px 15px",
    textAlign: "center",
    color: "#999",
    fontSize: "13px",
  },

  muted: {
    color: "#666",
    fontSize: "11px",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.82)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },

  modal: {
    position: "relative",
    width: "100%",
    maxWidth: "850px",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#111",
    border: "1px solid #333",
    borderRadius: "14px",
    padding: "25px",
    boxSizing: "border-box",
  },

  closeButton: {
    position: "absolute",
    top: "12px",
    right: "14px",
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    border: "1px solid #444",
    background: "#191919",
    color: "#fff",
    fontSize: "23px",
    lineHeight: 1,
    cursor: "pointer",
    zIndex: 2,
  },

  modalHeader: {
    display: "flex",
    gap: "20px",
    alignItems: "center",
    paddingRight: "45px",
    paddingBottom: "25px",
    borderBottom: "1px solid #292929",
  },

  modalCover: {
    width: "150px",
    height: "150px",
    objectFit: "cover",
    borderRadius: "9px",
    flexShrink: 0,
  },

  modalCoverPlaceholder: {
    width: "150px",
    height: "150px",
    borderRadius: "9px",
    background: "#202020",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "50px",
    flexShrink: 0,
  },

  modalTitle: {
    margin: "3px 0 8px",
    fontSize: "30px",
    fontWeight: "900",
  },

  modalDescription: {
    color: "#999",
    fontSize: "13px",
    lineHeight: 1.5,
    margin: 0,
  },

  modalMeta: {
    marginTop: "10px",
    color: "#d4af37",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1px",
  },

  modalTracks: {
    paddingTop: "23px",
  },

  trackList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "12px",
  },

  trackRow: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    background: "#090909",
    border: "1px solid #252525",
    borderRadius: "8px",
    padding: "8px",
  },

  trackNumber: {
    width: "24px",
    textAlign: "center",
    color: "#777",
    fontSize: "11px",
    fontWeight: "800",
    flexShrink: 0,
  },

  trackCover: {
    width: "48px",
    height: "48px",
    objectFit: "cover",
    borderRadius: "5px",
    flexShrink: 0,
  },

  trackCoverPlaceholder: {
    width: "48px",
    height: "48px",
    borderRadius: "5px",
    background: "#202020",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  trackInfo: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  trackName: {
    fontSize: "13px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  trackMeta: {
    color: "#777",
    fontSize: "10px",
  },

  playButton: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "1px solid #d4af37",
    background: "transparent",
    color: "#d4af37",
    cursor: "pointer",
    flexShrink: 0,
  },

  removeButton: {
    border: "1px solid #572828",
    background: "transparent",
    color: "#d88787",
    borderRadius: "5px",
    padding: "8px",
    fontSize: "8px",
    fontWeight: "800",
    cursor: "pointer",
    flexShrink: 0,
  },
};

export default Albums;
