import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function ProducerProfile({ producerId, onNavigate }) {
  const [producer, setProducer] = useState(null);
  const [beats, setBeats] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(Boolean(producerId));
  const [error, setError] = useState(
    producerId ? "" : "Producer profile is not available."
  );
  const [showProfileImage, setShowProfileImage] = useState(false);
  const [hoveredBeatId, setHoveredBeatId] = useState(null);

  useEffect(() => {
    if (!producerId) {
      return;
    }

    async function loadProducerProfile() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const loggedInUserId = user?.id || null;

        setCurrentUserId(loggedInUserId);

        const { data: producerData, error: producerError } =
          await supabase
            .from("producers")
            .select(
              `
                id,
                display_name,
                bio,
                avatar_url,
                contact_info
              `
            )
            .eq("id", producerId)
            .single();

        if (producerError) {
          throw producerError;
        }

        const { data: beatData, error: beatError } =
          await supabase
            .from("beats")
            .select(
              `
                id,
                producer_id,
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
                created_at,
                license_type,
                commercial_use,
                allow_remakes,
                allow_songs,
                allow_instrumental_samples
              `
            )
            .eq("producer_id", producerId)
            .eq("is_removed", false)
            .order("created_at", {
              ascending: false,
            });

        if (beatError) {
          throw beatError;
        }

        const { count, error: followerError } =
          await supabase
            .from("producer_follows")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("producer_id", producerId);

        if (followerError) {
          throw followerError;
        }

        let following = false;

        if (
          loggedInUserId &&
          loggedInUserId !== producerId
        ) {
          const { data: followData, error: followError } =
            await supabase
              .from("producer_follows")
              .select("id")
              .eq("follower_id", loggedInUserId)
              .eq("producer_id", producerId)
              .maybeSingle();

          if (followError) {
            throw followError;
          }

          following = Boolean(followData);
        }

        setProducer(producerData);
        setBeats(beatData || []);
        setFollowerCount(count || 0);
        setIsFollowing(following);
      } catch (loadError) {
        console.error(
          "Unable to load producer profile:",
          loadError
        );

        setError(
          loadError.message ||
            "Unable to load producer profile."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProducerProfile();
  }, [producerId]);

  useEffect(() => {
    if (!showProfileImage) {
      return;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setShowProfileImage(false);
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );

      document.body.style.overflow = "";
    };
  }, [showProfileImage]);

  function getGenreName(beat) {
    if (beat.genre === "Other" && beat.other_genre) {
      return beat.other_genre;
    }

    return beat.genre || "Unknown Genre";
  }

  function getLicenseText(beat) {
    return beat.license_type || "Free MP3";
  }

  function handleDownload(beat) {
    if (!beat.mp3_url) {
      window.alert(
        "This beat does not have a download file."
      );
      return;
    }

    const link = document.createElement("a");

    link.href = beat.mp3_url;
    link.download = `${beat.title || "beat"}.mp3`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleOpenBeat(beat) {
    if (!beat?.id) {
      return;
    }

    window.location.href = `/?beat=${encodeURIComponent(
      beat.id
    )}`;
  }

  function handleContactProducer() {
    const contactInfo = producer?.contact_info?.trim();

    if (!contactInfo) {
      window.alert(
        "This producer has not added contact information yet."
      );
      return;
    }

    window.alert(
      `Contact ${producer.display_name}\n\n${contactInfo}`
    );
  }

  async function handleFollowToggle() {
    if (!currentUserId) {
      window.alert(
        "Please sign in to follow this producer."
      );
      return;
    }

    if (currentUserId === producerId) {
      window.alert(
        "You cannot follow your own producer profile."
      );
      return;
    }

    setFollowLoading(true);

    try {
      if (isFollowing) {
        const { error: unfollowError } =
          await supabase
            .from("producer_follows")
            .delete()
            .eq("follower_id", currentUserId)
            .eq("producer_id", producerId);

        if (unfollowError) {
          throw unfollowError;
        }

        setIsFollowing(false);

        setFollowerCount((currentCount) =>
          Math.max(0, currentCount - 1)
        );
      } else {
        const { error: followError } =
          await supabase
            .from("producer_follows")
            .insert({
              follower_id: currentUserId,
              producer_id: producerId,
            });

        if (followError) {
          throw followError;
        }

        setIsFollowing(true);

        setFollowerCount(
          (currentCount) => currentCount + 1
        );
      }
    } catch (followError) {
      console.error(
        "Unable to update producer follow:",
        followError
      );

      window.alert(
        followError.message ||
          "Unable to update follow status."
      );
    } finally {
      setFollowLoading(false);
    }
  }

  const totalLikes = beats.reduce(
    (total, beat) => total + (beat.likes || 0),
    0
  );

  const profileImageUrl =
    producer?.avatar_url ||
    "https://yabmstoxxctiqshbfwop.supabase.co/storage/v1/object/public/avatars/e4894dbe-a9c2-417b-b4fc-c55169983843-1788308635395.png";

  if (!producerId) {
    return (
      <section style={styles.page}>
        <div style={styles.errorCard}>
          <h2>Producer profile is not available</h2>

          <p>
            Please return to Browse Beats and select a
            producer.
          </p>

          <button
            type="button"
            onClick={() =>
              onNavigate && onNavigate("browse")
            }
            style={styles.primaryButton}
          >
            Back to Browse Beats
          </button>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section style={styles.page}>
        <div style={styles.loading}>
          Loading producer profile...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section style={styles.page}>
        <div style={styles.errorCard}>
          <h2>Unable to load producer profile</h2>

          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              onNavigate && onNavigate("browse")
            }
            style={styles.primaryButton}
          >
            Back to Browse Beats
          </button>
        </div>
      </section>
    );
  }

  if (!producer) {
    return (
      <section style={styles.page}>
        <div style={styles.errorCard}>
          <h2>Producer not found</h2>

          <button
            type="button"
            onClick={() =>
              onNavigate && onNavigate("browse")
            }
            style={styles.primaryButton}
          >
            Back to Browse Beats
          </button>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.page}>
      <div style={styles.container}>
        <button
          type="button"
          onClick={() =>
            onNavigate && onNavigate("browse")
          }
          style={styles.backButton}
        >
          ← Back to Browse Beats
        </button>

        <div style={styles.profileCard}>
          <div style={styles.profileTop}>
            <div style={styles.avatarWrapper}>
              <button
                type="button"
                onClick={() => setShowProfileImage(true)}
                style={styles.avatarButton}
                aria-label={`View ${producer.display_name} profile picture`}
                title="View profile picture"
              >
                <img
                  src={profileImageUrl}
                  alt={producer.display_name}
                  style={styles.avatar}
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";

                    if (
                      event.currentTarget
                        .nextElementSibling
                    ) {
                      event.currentTarget.nextElementSibling.style.display =
                        "flex";
                    }
                  }}
                />

                <span style={styles.avatarZoomHint}>
                  🔍
                </span>
              </button>

              <div
                style={{
                  ...styles.avatarFallback,
                  display: "none",
                }}
              >
                🎧
              </div>
            </div>

            <div style={styles.profileInfo}>
              <p style={styles.smallTitle}>
                PRODUCER PROFILE
              </p>

              <h1 style={styles.producerName}>
                {producer.display_name}
              </h1>

              <p style={styles.bio}>
                {producer.bio ||
                  "This producer has not added a bio yet."}
              </p>

              <div style={styles.stats}>
                <div style={styles.stat}>
                  <strong>{beats.length}</strong>
                  <span>Beats</span>
                </div>

                <div style={styles.stat}>
                  <strong>{totalLikes}</strong>
                  <span>Likes</span>
                </div>

                <div style={styles.stat}>
                  <strong>{followerCount}</strong>
                  <span>Followers</span>
                </div>
              </div>

              <div style={styles.profileActions}>
                {currentUserId !== producerId && (
                  <button
                    type="button"
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    style={
                      isFollowing
                        ? styles.followingButton
                        : styles.followButton
                    }
                  >
                    {followLoading
                      ? "Updating..."
                      : isFollowing
                      ? "✓ Following"
                      : "+ Follow Producer"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleContactProducer}
                  style={styles.primaryButton}
                >
                  Contact Producer
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.smallTitle}>
              PRODUCER CATALOG
            </p>

            <h2 style={styles.sectionTitle}>
              Beats by {producer.display_name}
            </h2>
          </div>

          <span style={styles.beatCount}>
            {beats.length}{" "}
            {beats.length === 1 ? "Beat" : "Beats"}
          </span>
        </div>

        {beats.length === 0 ? (
          <div style={styles.emptyCard}>
            <h3>No beats uploaded yet</h3>

            <p>
              This producer has not uploaded any beats yet.
            </p>
          </div>
        ) : (
          <div style={styles.beatGrid}>
            {beats.map((beat) => (
              <article
                key={beat.id}
                style={{
                  ...styles.beatCard,
                  ...(hoveredBeatId === beat.id
                    ? styles.beatCardHover
                    : {}),
                }}
                onMouseEnter={() =>
                  setHoveredBeatId(beat.id)
                }
                onMouseLeave={() =>
                  setHoveredBeatId(null)
                }
              >
                {beat.cover_url ? (
                  <button
                    type="button"
                    onClick={() => handleOpenBeat(beat)}
                    style={styles.coverButton}
                    aria-label={`Open ${beat.title} beat`}
                    title={`Open ${beat.title}`}
                  >
                    <img
                      src={beat.cover_url}
                      alt={beat.title}
                      style={{
                        ...styles.cover,
                        transform:
                          hoveredBeatId === beat.id
                            ? "scale(1.04)"
                            : "scale(1)",
                      }}
                    />

                    <span
                      style={{
                        ...styles.coverOverlay,
                        opacity:
                          hoveredBeatId === beat.id
                            ? 1
                            : 0,
                        transform:
                          hoveredBeatId === beat.id
                            ? "translate(-50%, -50%) scale(1)"
                            : "translate(-50%, -50%) scale(0.92)",
                      }}
                    >
                      ▶ OPEN BEAT
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenBeat(beat)}
                    style={styles.coverButton}
                    aria-label={`Open ${beat.title} beat`}
                    title={`Open ${beat.title}`}
                  >
                    <div style={styles.coverFallback}>
                      NO COVER
                    </div>

                    <span
                      style={{
                        ...styles.coverOverlay,
                        opacity:
                          hoveredBeatId === beat.id
                            ? 1
                            : 0,
                        transform:
                          hoveredBeatId === beat.id
                            ? "translate(-50%, -50%) scale(1)"
                            : "translate(-50%, -50%) scale(0.92)",
                      }}
                    >
                      ▶ OPEN BEAT
                    </span>
                  </button>
                )}

                <div style={styles.beatContent}>
                  <div style={styles.titleRow}>
                    <h3 style={styles.beatTitle}>
                      {beat.title}
                    </h3>

                    <span style={styles.licenseBadge}>
                      {getLicenseText(beat)}
                    </span>
                  </div>

                  <div style={styles.meta}>
                    <span>{getGenreName(beat)}</span>

                    <span>•</span>

                    <span>
                      {beat.bpm || "—"} BPM
                    </span>

                    <span>•</span>

                    <span>
                      {beat.musical_key || "—"}
                    </span>
                  </div>

                  {beat.description && (
                    <p style={styles.description}>
                      {beat.description}
                    </p>
                  )}

                  <div style={styles.engagement}>
                    <span>
                      ❤️ {beat.likes || 0}
                    </span>

                    <span>
                      👎 {beat.dislikes || 0}
                    </span>
                  </div>

                  {beat.mp3_url && (
                    <audio
                      controls
                      src={beat.mp3_url}
                      style={styles.audio}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      handleDownload(beat)
                    }
                    style={styles.downloadButton}
                  >
                    Download Free MP3
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showProfileImage && (
        <div
          style={styles.imageModal}
          onClick={() => setShowProfileImage(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${producer.display_name} profile picture`}
        >
          <button
            type="button"
            onClick={() => setShowProfileImage(false)}
            style={styles.closeImageButton}
            aria-label="Close profile picture"
            title="Close"
          >
            ×
          </button>

          <div
            style={styles.imageModalContent}
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={profileImageUrl}
              alt={producer.display_name}
              style={styles.fullProfileImage}
            />

            <p style={styles.fullImageName}>
              {producer.display_name}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

const styles = {
  page: {
    minHeight: "70vh",
    padding: "50px 30px 80px",
    background: "#0b0b0f",
  },

  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },

  loading: {
    textAlign: "center",
    color: "#ffb703",
    padding: "80px 20px",
    fontSize: "18px",
  },

  errorCard: {
    maxWidth: "600px",
    margin: "60px auto",
    padding: "30px",
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    textAlign: "center",
  },

  backButton: {
    background: "transparent",
    border: "none",
    color: "#ffb703",
    cursor: "pointer",
    padding: "0",
    marginBottom: "25px",
    fontSize: "14px",
    fontWeight: "bold",
  },

  profileCard: {
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "14px",
    padding: "30px",
    marginBottom: "50px",
  },

  profileTop: {
    display: "flex",
    gap: "30px",
    alignItems: "center",
    flexWrap: "wrap",
  },

  avatarWrapper: {
    flexShrink: 0,
    position: "relative",
    width: "150px",
    height: "150px",
  },

  avatarButton: {
    position: "relative",
    display: "block",
    width: "150px",
    height: "150px",
    padding: 0,
    border: "none",
    background: "transparent",
    borderRadius: "50%",
    cursor: "pointer",
    overflow: "hidden",
  },

  avatar: {
    width: "150px",
    height: "150px",
    objectFit: "cover",
    borderRadius: "50%",
    border: "3px solid #ffb703",
    display: "block",
    transition: "transform 0.2s ease",
  },

  avatarZoomHint: {
    position: "absolute",
    right: "8px",
    bottom: "8px",
    width: "30px",
    height: "30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.78)",
    border: "1px solid #ffb703",
    borderRadius: "50%",
    fontSize: "14px",
    pointerEvents: "none",
  },

  avatarFallback: {
    width: "150px",
    height: "150px",
    borderRadius: "50%",
    background: "#0f0f14",
    border: "3px solid #333",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "55px",
  },

  profileInfo: {
    flex: 1,
    minWidth: "260px",
  },

  smallTitle: {
    color: "#ffb703",
    letterSpacing: "3px",
    fontSize: "11px",
    fontWeight: "bold",
    margin: "0 0 8px",
  },

  producerName: {
    fontSize: "42px",
    margin: "0 0 12px",
  },

  bio: {
    color: "#999",
    lineHeight: 1.7,
    maxWidth: "750px",
    margin: "0 0 22px",
  },

  stats: {
    display: "flex",
    gap: "35px",
    marginBottom: "25px",
    flexWrap: "wrap",
  },

  stat: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  profileActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  primaryButton: {
    background: "#ffb703",
    border: "none",
    borderRadius: "7px",
    color: "#000",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "12px 18px",
  },

  followButton: {
    background: "#ffb703",
    border: "none",
    borderRadius: "7px",
    color: "#000",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "12px 18px",
  },

  followingButton: {
    background: "#102a1a",
    border: "1px solid #8ee5a8",
    borderRadius: "7px",
    color: "#8ee5a8",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "12px 18px",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "20px",
    marginBottom: "25px",
  },

  sectionTitle: {
    fontSize: "30px",
    margin: "5px 0 0",
  },

  beatCount: {
    color: "#888",
    fontSize: "14px",
  },

  beatGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },

  beatCard: {
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    overflow: "hidden",
    transition:
      "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
  },

  beatCardHover: {
    transform: "translateY(-4px)",
    borderColor: "#ffb703",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
  },

  coverButton: {
    position: "relative",
    display: "block",
    width: "100%",
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    overflow: "hidden",
  },

  coverOverlay: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform:
      "translate(-50%, -50%) scale(0.92)",
    background: "rgba(0, 0, 0, 0.82)",
    color: "#ffb703",
    border: "1px solid #ffb703",
    borderRadius: "7px",
    padding: "10px 14px",
    fontSize: "12px",
    fontWeight: "bold",
    letterSpacing: "1px",
    pointerEvents: "none",
    opacity: 0,
    transition:
      "opacity 0.2s ease, transform 0.2s ease",
  },

  cover: {
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "cover",
    display: "block",
    transition: "transform 0.3s ease",
  },

  coverFallback: {
    width: "100%",
    aspectRatio: "1 / 1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f0f14",
    color: "#555",
    fontWeight: "bold",
  },

  beatContent: {
    padding: "18px",
  },

  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
  },

  beatTitle: {
    fontSize: "20px",
    margin: 0,
  },

  licenseBadge: {
    background: "#102a1a",
    border: "1px solid #245c35",
    color: "#8ee5a8",
    borderRadius: "5px",
    padding: "5px 8px",
    fontSize: "10px",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },

  meta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
    color: "#888",
    fontSize: "12px",
    marginTop: "10px",
  },

  description: {
    color: "#aaa",
    fontSize: "13px",
    lineHeight: 1.5,
    margin: "15px 0",
  },

  engagement: {
    display: "flex",
    gap: "15px",
    color: "#888",
    fontSize: "13px",
    marginBottom: "15px",
  },

  audio: {
    width: "100%",
    marginBottom: "12px",
  },

  downloadButton: {
    width: "100%",
    background: "transparent",
    border: "1px solid #555",
    borderRadius: "7px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "11px",
  },

  emptyCard: {
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    padding: "40px",
    textAlign: "center",
    color: "#888",
  },

  imageModal: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px",
    background: "rgba(0, 0, 0, 0.92)",
    backdropFilter: "blur(6px)",
    cursor: "zoom-out",
  },

  imageModalContent: {
    position: "relative",
    maxWidth: "90vw",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "default",
  },

  fullProfileImage: {
    maxWidth: "90vw",
    maxHeight: "82vh",
    width: "auto",
    height: "auto",
    objectFit: "contain",
    borderRadius: "12px",
    border: "2px solid #ffb703",
    boxShadow: "0 0 40px rgba(0, 0, 0, 0.8)",
  },

  fullImageName: {
    color: "#fff",
    fontSize: "18px",
    fontWeight: "bold",
    margin: "15px 0 0",
  },

  closeImageButton: {
    position: "fixed",
    top: "20px",
    right: "25px",
    zIndex: 10000,
    width: "45px",
    height: "45px",
    borderRadius: "50%",
    border: "1px solid #ffb703",
    background: "rgba(0, 0, 0, 0.8)",
    color: "#ffb703",
    cursor: "pointer",
    fontSize: "32px",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

export default ProducerProfile;