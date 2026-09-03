import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function MyBeats({ user, onEditBeat, onNavigate }) {
  const [beats, setBeats] = useState([]);
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  useEffect(() => {
    async function loadMyBeats() {
      if (!user) {
        setLoading(false);
        setCommentsLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data, error: beatsError } = await supabase
        .from("beats")
        .select("*")
        .eq("producer_id", user.id)
        .eq("is_removed", false)
        .order("created_at", { ascending: false });

      if (beatsError) {
        setError(beatsError.message);
        setLoading(false);
        setCommentsLoading(false);
        return;
      }

      const loadedBeats = data || [];
      setBeats(loadedBeats);
      setLoading(false);

      if (loadedBeats.length === 0) {
        setComments({});
        setCommentsLoading(false);
        return;
      }

      const beatIds = loadedBeats.map((beat) => beat.id);

      const { data: commentData, error: commentsError } =
        await supabase
          .from("comments")
          .select("*")
          .in("beat_id", beatIds)
          .order("created_at", {
            ascending: true,
          });

      if (commentsError) {
        setCommentError(commentsError.message);
        setCommentsLoading(false);
        return;
      }

      const groupedComments = {};

      beatIds.forEach((beatId) => {
        groupedComments[beatId] = [];
      });

      (commentData || []).forEach((comment) => {
        if (!groupedComments[comment.beat_id]) {
          groupedComments[comment.beat_id] = [];
        }

        groupedComments[comment.beat_id].push(comment);
      });

      setComments(groupedComments);
      setCommentsLoading(false);
    }

    loadMyBeats();
  }, [user]);

  function getStoragePath(url, bucket) {
    if (!url) {
      return null;
    }

    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.indexOf(marker);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(
      url.substring(index + marker.length)
    );
  }

  async function handleDeleteBeat(beat) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${beat.title}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(beat.id);
    setError("");

    const mp3Path = getStoragePath(
      beat.mp3_url,
      "beats"
    );

    const coverPath = getStoragePath(
      beat.cover_url,
      "covers"
    );

    if (mp3Path) {
      const { error: mp3DeleteError } =
        await supabase.storage
          .from("beats")
          .remove([mp3Path]);

      if (mp3DeleteError) {
        setError(
          `Could not delete the MP3 file: ${mp3DeleteError.message}`
        );
        setDeletingId(null);
        return;
      }
    }

    if (coverPath) {
      const { error: coverDeleteError } =
        await supabase.storage
          .from("covers")
          .remove([coverPath]);

      if (coverDeleteError) {
        setError(
          `Could not delete the cover image: ${coverDeleteError.message}`
        );
        setDeletingId(null);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("beats")
      .delete()
      .eq("id", beat.id)
      .eq("producer_id", user.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingId(null);
      return;
    }

    setBeats((currentBeats) =>
      currentBeats.filter(
        (currentBeat) => currentBeat.id !== beat.id
      )
    );

    setComments((currentComments) => {
      const updatedComments = {
        ...currentComments,
      };

      delete updatedComments[beat.id];

      return updatedComments;
    });

    setDeletingId(null);
  }

  async function handleDeleteComment(comment) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this comment?"
    );

    if (!confirmed) {
      return;
    }

    setDeletingCommentId(comment.id);
    setCommentError("");

    const { error: deleteError } = await supabase
      .from("comments")
      .delete()
      .eq("id", comment.id);

    if (deleteError) {
      setCommentError(deleteError.message);
      setDeletingCommentId(null);
      return;
    }

    setComments((currentComments) => ({
      ...currentComments,
      [comment.beat_id]: (
        currentComments[comment.beat_id] || []
      ).filter(
        (currentComment) =>
          currentComment.id !== comment.id
      ),
    }));

    setDeletingCommentId(null);
  }

  const totalLikes = beats.reduce(
    (total, beat) => total + (beat.likes || 0),
    0
  );

  const totalDislikes = beats.reduce(
    (total, beat) => total + (beat.dislikes || 0),
    0
  );

  const totalComments = Object.values(comments).reduce(
    (total, beatComments) =>
      total + beatComments.length,
    0
  );

  function formatCommentDate(date) {
    if (!date) {
      return "";
    }

    return new Date(date).toLocaleString();
  }

  if (loading) {
    return (
      <section style={styles.section}>
        <p style={styles.message}>
          Loading your beats...
        </p>
      </section>
    );
  }

  return (
    <section style={styles.section}>
      <div style={styles.navigation}>
        <button
          type="button"
          onClick={() => onNavigate("home")}
          style={styles.backButton}
        >
          ← Go Back
        </button>
      </div>

      <div style={styles.header}>
        <p style={styles.smallTitle}>
          PRODUCER CENTER
        </p>

        <h1 style={styles.title}>
          My Beats
        </h1>

        <p style={styles.description}>
          Manage, preview and control all the beats
          you have uploaded to Tellem Beat Store.
        </p>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {commentError && (
        <div style={styles.error}>
          Comments error: {commentError}
        </div>
      )}

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🎵</div>

          <div>
            <p style={styles.statLabel}>
              Total Beats
            </p>

            <strong style={styles.statValue}>
              {beats.length}
            </strong>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>❤️</div>

          <div>
            <p style={styles.statLabel}>
              Total Likes
            </p>

            <strong style={styles.statValue}>
              {totalLikes}
            </strong>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>👎</div>

          <div>
            <p style={styles.statLabel}>
              Total Dislikes
            </p>

            <strong style={styles.statValue}>
              {totalDislikes}
            </strong>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>💬</div>

          <div>
            <p style={styles.statLabel}>
              Comments
            </p>

            <strong style={styles.statValue}>
              {commentsLoading
                ? "..."
                : totalComments}
            </strong>
          </div>
        </div>
      </div>

      {beats.length === 0 && !error && (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>
            🎵
          </div>

          <h2>
            No beats uploaded yet
          </h2>

          <p>
            Your uploaded beats will appear here.
          </p>
        </div>
      )}

      <div style={styles.grid}>
        {beats.map((beat) => {
          const beatComments =
            comments[beat.id] || [];

          return (
            <article
              key={beat.id}
              style={styles.card}
            >
              {beat.cover_url ? (
                <img
                  src={beat.cover_url}
                  alt={
                    beat.title || "Beat cover"
                  }
                  style={styles.cover}
                />
              ) : (
                <div style={styles.noCover}>
                  🎵
                </div>
              )}

              <div style={styles.cardContent}>
                <div style={styles.beatHeader}>
                  <div>
                    <h2 style={styles.beatTitle}>
                      {beat.title ||
                        "Untitled Beat"}
                    </h2>

                    <p style={styles.genre}>
                      {beat.genre ||
                        "Instrumental"}

                      {beat.genre === "Other" &&
                      beat.other_genre
                        ? ` • ${beat.other_genre}`
                        : ""}
                    </p>
                  </div>

                  <span
                    style={styles.licenseBadge}
                  >
                    {beat.license_type ||
                      "Free MP3"}
                  </span>
                </div>

                <div style={styles.detailsBox}>
                  <span>
                    🎚️{" "}
                    {beat.bpm
                      ? `${beat.bpm} BPM`
                      : "BPM not set"}
                  </span>

                  <span>
                    🎹{" "}
                    {beat.musical_key ||
                      "Key not set"}
                  </span>
                </div>

                {beat.description && (
                  <p
                    style={
                      styles.descriptionText
                    }
                  >
                    {beat.description}
                  </p>
                )}

                <div style={styles.licenseBox}>
                  <strong>
                    FREE MP3 LICENSE
                  </strong>

                  <div
                    style={
                      styles.licenseList
                    }
                  >
                    <div>
                      ✓ Free MP3 download
                    </div>

                    <div>
                      ✕ No remakes
                    </div>

                    <div>
                      ✕ No commercial
                      songs/releases
                    </div>

                    <div>
                      ✕ No instrumental
                      sampling
                    </div>

                    <div>
                      ✕ No resale or
                      redistribution
                    </div>

                    <div>
                      ✕ No Content ID or
                      copyright claims
                    </div>
                  </div>

                  <p
                    style={
                      styles.licenseNotice
                    }
                  >
                    Paid license required
                    for commercial use.
                  </p>
                </div>

                <audio
                  controls
                  preload="none"
                  src={beat.mp3_url}
                  style={styles.audio}
                />

                <div style={styles.engagement}>
                  <span>
                    ❤️ {beat.likes || 0} Likes
                  </span>

                  <span>
                    👎{" "}
                    {beat.dislikes || 0} Dislikes
                  </span>

                  <span>
                    💬 {beatComments.length}{" "}
                    {beatComments.length === 1
                      ? "Comment"
                      : "Comments"}
                  </span>
                </div>

                <div style={styles.commentsBox}>
                  <div
                    style={
                      styles.commentsHeader
                    }
                  >
                    <h3
                      style={
                        styles.commentsTitle
                      }
                    >
                      💬 Comments
                    </h3>

                    <span
                      style={
                        styles.commentCount
                      }
                    >
                      {beatComments.length}
                    </span>
                  </div>

                  {commentsLoading ? (
                    <p
                      style={
                        styles.commentMessage
                      }
                    >
                      Loading comments...
                    </p>
                  ) : beatComments.length ===
                    0 ? (
                    <p
                      style={
                        styles.commentMessage
                      }
                    >
                      No comments yet.
                    </p>
                  ) : (
                    <div
                      style={
                        styles.commentList
                      }
                    >
                      {beatComments.map(
                        (comment) => (
                          <div
                            key={comment.id}
                            style={
                              styles.commentItem
                            }
                          >
                            <div
                              style={
                                styles.commentTop
                              }
                            >
                              <strong
                                style={
                                  styles.commentAuthor
                                }
                              >
                                Artist
                              </strong>

                              <span
                                style={
                                  styles.commentDate
                                }
                              >
                                {formatCommentDate(
                                  comment.created_at
                                )}
                              </span>
                            </div>

                            <p
                              style={
                                styles.commentText
                              }
                            >
                              {
                                comment.comment_text
                              }
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteComment(
                                  comment
                                )
                              }
                              style={
                                styles.commentDeleteButton
                              }
                              disabled={
                                deletingCommentId ===
                                comment.id
                              }
                            >
                              {deletingCommentId ===
                              comment.id
                                ? "Deleting..."
                                : "🗑️ Delete Comment"}
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                <div style={styles.actions}>
                  <button
                    type="button"
                    onClick={() =>
                      onEditBeat(beat)
                    }
                    style={styles.editButton}
                    disabled={
                      deletingId === beat.id
                    }
                  >
                    ✏️ Edit Beat
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteBeat(beat)
                    }
                    style={
                      styles.deleteButton
                    }
                    disabled={
                      deletingId === beat.id
                    }
                  >
                    {deletingId === beat.id
                      ? "Deleting..."
                      : "🗑️ Delete"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const styles = {
  section: {
    maxWidth: "1150px",
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
    marginBottom: "30px",
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
    maxWidth: "700px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "15px",
    marginBottom: "35px",
  },

  statCard: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    padding: "20px",
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "10px",
  },

  statIcon: {
    fontSize: "30px",
  },

  statLabel: {
    margin: 0,
    color: "#888",
    fontSize: "12px",
  },

  statValue: {
    display: "block",
    marginTop: "4px",
    fontSize: "22px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "25px",
  },

  card: {
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    overflow: "hidden",
  },

  cover: {
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "cover",
    display: "block",
  },

  noCover: {
    width: "100%",
    aspectRatio: "1 / 1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#101014",
    fontSize: "50px",
  },

  cardContent: {
    padding: "22px",
  },

  beatHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "15px",
  },

  beatTitle: {
    margin: "0 0 7px",
    fontSize: "23px",
  },

  genre: {
    color: "#ffb703",
    fontSize: "14px",
    fontWeight: "bold",
    margin: 0,
  },

  licenseBadge: {
    background: "#ffb703",
    color: "#000",
    padding: "6px 9px",
    borderRadius: "15px",
    fontSize: "10px",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },

  detailsBox: {
    display: "flex",
    flexWrap: "wrap",
    gap: "15px",
    marginTop: "15px",
    padding: "11px",
    background: "#101014",
    borderRadius: "7px",
    color: "#aaa",
    fontSize: "13px",
  },

  descriptionText: {
    color: "#bbb",
    lineHeight: 1.5,
    margin: "15px 0",
  },

  licenseBox: {
    marginTop: "15px",
    padding: "14px",
    background: "#1a170d",
    border: "1px solid #5b4500",
    borderRadius: "8px",
    color: "#ffb703",
  },

  licenseList: {
    display: "grid",
    gap: "6px",
    marginTop: "10px",
    color: "#ccc",
    fontSize: "12px",
    lineHeight: 1.4,
  },

  licenseNotice: {
    margin: "12px 0 0",
    paddingTop: "10px",
    borderTop: "1px solid #3b3219",
    fontSize: "12px",
    fontWeight: "bold",
    lineHeight: 1.5,
  },

  audio: {
    width: "100%",
    marginTop: "16px",
  },

  engagement: {
    display: "flex",
    flexWrap: "wrap",
    gap: "15px",
    marginTop: "15px",
    color: "#999",
    fontSize: "12px",
  },

  commentsBox: {
    marginTop: "18px",
    padding: "16px",
    background: "#101014",
    border: "1px solid #292932",
    borderRadius: "9px",
  },

  commentsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "12px",
  },

  commentsTitle: {
    margin: 0,
    fontSize: "16px",
  },

  commentCount: {
    minWidth: "25px",
    height: "25px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffb703",
    color: "#000",
    borderRadius: "50%",
    fontSize: "11px",
    fontWeight: "bold",
  },

  commentMessage: {
    color: "#777",
    fontSize: "13px",
    margin: 0,
    padding: "10px 0",
  },

  commentList: {
    display: "grid",
    gap: "10px",
  },

  commentItem: {
    padding: "12px",
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "7px",
  },

  commentTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },

  commentAuthor: {
    fontSize: "13px",
  },

  commentDate: {
    color: "#666",
    fontSize: "10px",
  },

  commentText: {
    margin: "8px 0",
    color: "#ccc",
    fontSize: "13px",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },

  commentDeleteButton: {
    padding: "6px 9px",
    background: "transparent",
    border: "1px solid #5b2525",
    borderRadius: "5px",
    color: "#ff9b9b",
    fontSize: "10px",
    cursor: "pointer",
  },

  actions: {
    display: "flex",
    gap: "10px",
    marginTop: "18px",
  },

  editButton: {
    flex: 1,
    padding: "13px",
    background: "#ffb703",
    border: "none",
    borderRadius: "7px",
    color: "#000",
    fontWeight: "bold",
    cursor: "pointer",
  },

  deleteButton: {
    flex: 1,
    padding: "13px",
    background: "#3a1118",
    border: "1px solid #7f1d1d",
    borderRadius: "7px",
    color: "#ffb4b4",
    fontWeight: "bold",
    cursor: "pointer",
  },

  empty: {
    textAlign: "center",
    padding: "70px 20px",
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    marginBottom: "25px",
  },

  emptyIcon: {
    fontSize: "45px",
    marginBottom: "15px",
  },

  message: {
    color: "#888",
    padding: "40px 0",
  },

  error: {
    marginBottom: "25px",
    padding: "12px",
    background: "#3a1118",
    border: "1px solid #7f1d1d",
    borderRadius: "6px",
    color: "#ffb4b4",
  },
};

export default MyBeats;