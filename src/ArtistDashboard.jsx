import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function ArtistDashboard({ user, onNavigate }) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [savedBeats, setSavedBeats] = useState([]);
  const [likedBeats, setLikedBeats] = useState([]);

  const [loading, setLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(true);
  const [likedLoading, setLikedLoading] = useState(true);

  const [removingBeatId, setRemovingBeatId] = useState(null);
  const [unlikingBeatId, setUnlikingBeatId] = useState(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("artists")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
      }

      if (data) {
        setDisplayName(data.display_name || "");
        setBio(data.bio || "");
        setAvatarUrl(data.avatar_url || "");
      }

      setLoading(false);
    }

    loadProfile();
  }, [user]);

  useEffect(() => {
    async function loadSavedBeats() {
      if (!user) {
        setSavedBeats([]);
        setSavedLoading(false);
        return;
      }

      setSavedLoading(true);

      const { data, error: savedError } = await supabase
        .from("saved_beats")
        .select(`
          id,
          created_at,
          beat_id,
          beats (
            id,
            title,
            genre,
            other_genre,
            bpm,
            musical_key,
            description,
            mp3_url,
            cover_url,
            likes,
            dislikes,
            license_type,
            commercial_use,
            allow_remakes,
            allow_songs,
            allow_instrumental_samples
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (savedError) {
        setError(savedError.message);
        setSavedBeats([]);
        setSavedLoading(false);
        return;
      }

      const cleanedBeats = (data || [])
        .filter((item) => item.beats)
        .map((item) => ({
          savedId: item.id,
          savedAt: item.created_at,
          ...item.beats,
        }));

      setSavedBeats(cleanedBeats);
      setSavedLoading(false);
    }

    loadSavedBeats();
  }, [user]);

  useEffect(() => {
    async function loadLikedBeats() {
      if (!user) {
        setLikedBeats([]);
        setLikedLoading(false);
        return;
      }

      setLikedLoading(true);

      const { data, error: likedError } = await supabase
        .from("liked_beats")
        .select(`
          id,
          created_at,
          beat_id,
          beats (
            id,
            title,
            genre,
            other_genre,
            bpm,
            musical_key,
            description,
            mp3_url,
            cover_url,
            likes,
            dislikes,
            license_type,
            commercial_use,
            allow_remakes,
            allow_songs,
            allow_instrumental_samples
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (likedError) {
        setError(likedError.message);
        setLikedBeats([]);
        setLikedLoading(false);
        return;
      }

      const cleanedBeats = (data || [])
        .filter((item) => item.beats)
        .map((item) => ({
          likedId: item.id,
          likedAt: item.created_at,
          ...item.beats,
        }));

      setLikedBeats(cleanedBeats);
      setLikedLoading(false);
    }

    loadLikedBeats();
  }, [user]);

  async function saveProfile(event) {
    event.preventDefault();

    setSavingProfile(true);
    setMessage("");
    setError("");

    if (!displayName.trim()) {
      setError("Please enter your artist name.");
      setSavingProfile(false);
      return;
    }

    const { error: saveError } = await supabase
      .from("artists")
      .upsert({
        id: user.id,
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });

    setSavingProfile(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setMessage("Artist profile saved successfully.");
  }

  async function removeSavedBeat(beatId) {
    if (!user) {
      return;
    }

    setRemovingBeatId(beatId);
    setError("");

    const { error: removeError } = await supabase
      .from("saved_beats")
      .delete()
      .eq("user_id", user.id)
      .eq("beat_id", beatId);

    if (removeError) {
      setError(removeError.message);
      setRemovingBeatId(null);
      return;
    }

    setSavedBeats((currentBeats) =>
      currentBeats.filter((beat) => beat.id !== beatId)
    );

    setRemovingBeatId(null);
  }

  async function unlikeBeat(beatId) {
    if (!user) {
      return;
    }

    setUnlikingBeatId(beatId);
    setError("");

    const { error: unlikeError } = await supabase
      .from("liked_beats")
      .delete()
      .eq("user_id", user.id)
      .eq("beat_id", beatId);

    if (unlikeError) {
      setError(unlikeError.message);
      setUnlikingBeatId(null);
      return;
    }

    const likedBeat = likedBeats.find(
      (beat) => beat.id === beatId
    );

    if (likedBeat) {
      const newLikes = Math.max(
        0,
        (likedBeat.likes || 0) - 1
      );

      await supabase
        .from("beats")
        .update({
          likes: newLikes,
        })
        .eq("id", beatId);
    }

    setLikedBeats((currentBeats) =>
      currentBeats.filter((beat) => beat.id !== beatId)
    );

    setUnlikingBeatId(null);
  }

  function getGenreName(beat) {
    return beat.genre === "Other"
      ? beat.other_genre || "Other"
      : beat.genre || "Unknown";
  }

  if (loading) {
    return (
      <section style={styles.section}>
        <p style={styles.message}>
          Loading artist profile...
        </p>
      </section>
    );
  }

  return (
    <section style={styles.section}>
      <div style={styles.navigation}>
        <button
          type="button"
          onClick={() =>
            onNavigate && onNavigate("home")
          }
          style={styles.backButton}
        >
          ← Go Back
        </button>
      </div>

      <div style={styles.header}>
        <p style={styles.smallTitle}>
          ARTIST CENTER
        </p>

        <h1 style={styles.title}>
          Artist Dashboard
        </h1>

        <p style={styles.description}>
          Create and manage your artist profile, discover beats,
          and manage your saved and liked beats.
        </p>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>
          Your Artist Profile
        </h2>

        <form onSubmit={saveProfile}>
          <label style={styles.label}>
            Artist Name
          </label>

          <input
            type="text"
            placeholder="Enter your artist name"
            value={displayName}
            onChange={(event) =>
              setDisplayName(event.target.value)
            }
            style={styles.input}
            required
          />

          <label style={styles.label}>
            Bio
          </label>

          <textarea
            placeholder="Tell producers about yourself and your music."
            value={bio}
            onChange={(event) =>
              setBio(event.target.value)
            }
            style={styles.textarea}
            rows={5}
          />

          <label style={styles.label}>
            Profile Picture URL
          </label>

          <input
            type="url"
            placeholder="https://..."
            value={avatarUrl}
            onChange={(event) =>
              setAvatarUrl(event.target.value)
            }
            style={styles.input}
          />

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          {message && (
            <div style={styles.success}>
              {message}
            </div>
          )}

          <button
            type="submit"
            style={styles.button}
            disabled={savingProfile}
          >
            {savingProfile
              ? "Saving..."
              : "Save Artist Profile"}
          </button>
        </form>
      </div>

      <div style={styles.savedSection}>
        <div style={styles.savedHeader}>
          <div>
            <p style={styles.smallTitle}>
              YOUR COLLECTION
            </p>

            <h2 style={styles.savedTitle}>
              ❤️ My Liked Beats
            </h2>
          </div>

          <div style={styles.savedCount}>
            {likedBeats.length}{" "}
            {likedBeats.length === 1
              ? "Beat"
              : "Beats"}
          </div>
        </div>

        {likedLoading ? (
          <p style={styles.message}>
            Loading your liked beats...
          </p>
        ) : likedBeats.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              ❤️
            </div>

            <h3 style={styles.emptyTitle}>
              No liked beats yet
            </h3>

            <p style={styles.emptyText}>
              Like beats in the marketplace and they will
              appear here in your Artist Dashboard.
            </p>
          </div>
        ) : (
          <div style={styles.beatList}>
            {likedBeats.map((beat) => (
              <div
                key={beat.id}
                style={styles.beatCard}
              >
                <div style={styles.coverWrapper}>
                  {beat.cover_url ? (
                    <img
                      src={beat.cover_url}
                      alt={beat.title}
                      style={styles.cover}
                    />
                  ) : (
                    <div style={styles.noCover}>
                      🎵
                    </div>
                  )}
                </div>

                <div style={styles.beatInfo}>
                  <h3 style={styles.beatTitle}>
                    {beat.title}
                  </h3>

                  <p style={styles.beatMeta}>
                    {getGenreName(beat)} •{" "}
                    {beat.bpm || "N/A"} BPM
                    {beat.musical_key
                      ? ` • ${beat.musical_key}`
                      : ""}
                  </p>

                  {beat.description && (
                    <p style={styles.beatDescription}>
                      {beat.description}
                    </p>
                  )}

                  {beat.mp3_url && (
                    <audio
                      controls
                      preload="none"
                      src={beat.mp3_url}
                      style={styles.audio}
                    >
                      Your browser does not support
                      audio playback.
                    </audio>
                  )}

                  <div style={styles.actions}>
                    <button
                      type="button"
                      style={styles.unlikeButton}
                      disabled={
                        unlikingBeatId === beat.id
                      }
                      onClick={() =>
                        unlikeBeat(beat.id)
                      }
                    >
                      {unlikingBeatId === beat.id
                        ? "Removing..."
                        : "💔 Unlike Beat"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.savedSection}>
        <div style={styles.savedHeader}>
          <div>
            <p style={styles.smallTitle}>
              YOUR COLLECTION
            </p>

            <h2 style={styles.savedTitle}>
              🔖 My Saved Beats
            </h2>
          </div>

          <div style={styles.savedCount}>
            {savedBeats.length}{" "}
            {savedBeats.length === 1
              ? "Beat"
              : "Beats"}
          </div>
        </div>

        {savedLoading ? (
          <p style={styles.message}>
            Loading your saved beats...
          </p>
        ) : savedBeats.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              🎧
            </div>

            <h3 style={styles.emptyTitle}>
              No saved beats yet
            </h3>

            <p style={styles.emptyText}>
              Browse the beat marketplace and save beats
              you want to come back to later.
            </p>
          </div>
        ) : (
          <div style={styles.beatList}>
            {savedBeats.map((beat) => (
              <div
                key={beat.id}
                style={styles.beatCard}
              >
                <div style={styles.coverWrapper}>
                  {beat.cover_url ? (
                    <img
                      src={beat.cover_url}
                      alt={beat.title}
                      style={styles.cover}
                    />
                  ) : (
                    <div style={styles.noCover}>
                      🎵
                    </div>
                  )}
                </div>

                <div style={styles.beatInfo}>
                  <h3 style={styles.beatTitle}>
                    {beat.title}
                  </h3>

                  <p style={styles.beatMeta}>
                    {getGenreName(beat)} •{" "}
                    {beat.bpm || "N/A"} BPM
                    {beat.musical_key
                      ? ` • ${beat.musical_key}`
                      : ""}
                  </p>

                  {beat.description && (
                    <p style={styles.beatDescription}>
                      {beat.description}
                    </p>
                  )}

                  {beat.mp3_url && (
                    <audio
                      controls
                      preload="none"
                      src={beat.mp3_url}
                      style={styles.audio}
                    >
                      Your browser does not support
                      audio playback.
                    </audio>
                  )}

                  <div style={styles.actions}>
                    <button
                      type="button"
                      style={styles.removeButton}
                      disabled={
                        removingBeatId === beat.id
                      }
                      onClick={() =>
                        removeSavedBeat(beat.id)
                      }
                    >
                      {removingBeatId === beat.id
                        ? "Removing..."
                        : "🗑️ Remove Saved Beat"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.infoCard}>
        <h2 style={styles.cardTitle}>
          Artist Features
        </h2>

        <div style={styles.feature}>
          <span style={styles.featureIcon}>
            🎧
          </span>

          <div>
            <strong>
              Discover Beats
            </strong>

            <p>
              Browse original beats from producers.
            </p>
          </div>
        </div>

        <div style={styles.feature}>
          <span style={styles.featureIcon}>
            ❤️
          </span>

          <div>
            <strong>
              Like Beats
            </strong>

            <p>
              Like beats you enjoy and manage them
              from your Artist Dashboard.
            </p>
          </div>
        </div>

        <div style={styles.feature}>
          <span style={styles.featureIcon}>
            🔖
          </span>

          <div>
            <strong>
              Save Beats
            </strong>

            <p>
              Save beats you want to come back to later.
            </p>
          </div>
        </div>

        <div style={styles.feature}>
          <span style={styles.featureIcon}>
            💬
          </span>

          <div>
            <strong>
              Comment
            </strong>

            <p>
              Communicate with producers through beat
              comments.
            </p>
          </div>
        </div>

        <div style={styles.feature}>
          <span style={styles.featureIcon}>
            📞
          </span>

          <div>
            <strong>
              Contact Producers
            </strong>

            <p>
              Contact producers when you want WAV,
              STEMS, Unlimited or Exclusive licenses.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const styles = {
  section: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "70px 30px 100px",
  },

  navigation: {
    marginBottom: "25px",
  },

  backButton: {
    padding: "11px 18px",
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "7px",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
  },

  header: {
    marginBottom: "35px",
  },

  smallTitle: {
    color: "#ffb703",
    letterSpacing: "3px",
    fontSize: "12px",
    fontWeight: "bold",
    margin: 0,
  },

  title: {
    fontSize: "42px",
    margin: "10px 0",
  },

  description: {
    color: "#888",
    lineHeight: 1.6,
  },

  card: {
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    padding: "30px",
  },

  cardTitle: {
    marginTop: 0,
    marginBottom: "25px",
    fontSize: "24px",
  },

  label: {
    display: "block",
    marginTop: "18px",
    marginBottom: "8px",
    fontWeight: "bold",
    fontSize: "14px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px",
    background: "#0f0f14",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    outline: "none",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px",
    background: "#0f0f14",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    outline: "none",
    resize: "vertical",
    fontFamily: "Arial, sans-serif",
  },

  button: {
    marginTop: "25px",
    padding: "14px 22px",
    background: "#ffb703",
    border: "none",
    borderRadius: "7px",
    color: "#000",
    fontWeight: "bold",
    cursor: "pointer",
  },

  message: {
    color: "#888",
    padding: "40px 0",
  },

  error: {
    marginTop: "15px",
    padding: "12px",
    background: "#3a1118",
    border: "1px solid #7f1d1d",
    borderRadius: "6px",
    color: "#ffb4b4",
  },

  success: {
    marginTop: "15px",
    padding: "12px",
    background: "#102a1a",
    border: "1px solid #245c35",
    borderRadius: "6px",
    color: "#8ee5a8",
  },

  savedSection: {
    marginTop: "30px",
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    padding: "30px",
  },

  savedHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    marginBottom: "25px",
  },

  savedTitle: {
    margin: "8px 0 0",
    fontSize: "28px",
  },

  savedCount: {
    padding: "8px 14px",
    background: "#0f0f14",
    border: "1px solid #333",
    borderRadius: "20px",
    color: "#aaa",
    fontSize: "13px",
  },

  emptyState: {
    textAlign: "center",
    padding: "45px 20px",
    border: "1px dashed #333",
    borderRadius: "10px",
  },

  emptyIcon: {
    fontSize: "42px",
    marginBottom: "10px",
  },

  emptyTitle: {
    margin: "10px 0",
    fontSize: "20px",
  },

  emptyText: {
    color: "#888",
    lineHeight: 1.6,
    maxWidth: "500px",
    margin: "0 auto",
  },

  beatList: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },

  beatCard: {
    display: "flex",
    gap: "20px",
    padding: "18px",
    background: "#0f0f14",
    border: "1px solid #292932",
    borderRadius: "10px",
  },

  coverWrapper: {
    width: "130px",
    minWidth: "130px",
    height: "130px",
    borderRadius: "8px",
    overflow: "hidden",
  },

  cover: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  noCover: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1c1c24",
    fontSize: "35px",
  },

  beatInfo: {
    flex: 1,
    minWidth: 0,
  },

  beatTitle: {
    margin: "0 0 8px",
    fontSize: "21px",
  },

  beatMeta: {
    color: "#ffb703",
    fontSize: "13px",
    margin: "0 0 10px",
  },

  beatDescription: {
    color: "#999",
    fontSize: "14px",
    lineHeight: 1.5,
    margin: "0 0 12px",
  },

  audio: {
    width: "100%",
    maxWidth: "500px",
    height: "40px",
  },

  actions: {
    marginTop: "14px",
  },

  removeButton: {
    padding: "9px 13px",
    background: "transparent",
    border: "1px solid #5b2525",
    borderRadius: "6px",
    color: "#ff9b9b",
    cursor: "pointer",
  },

  unlikeButton: {
    padding: "9px 13px",
    background: "transparent",
    border: "1px solid #5b2525",
    borderRadius: "6px",
    color: "#ff9b9b",
    cursor: "pointer",
  },

  infoCard: {
    marginTop: "25px",
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    padding: "30px",
  },

  feature: {
    display: "flex",
    gap: "15px",
    padding: "18px 0",
    borderTop: "1px solid #292932",
  },

  featureIcon: {
    fontSize: "24px",
  },
};

export default ArtistDashboard;