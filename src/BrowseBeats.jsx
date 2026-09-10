import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function BrowseBeats({
  onNavigate,
  searchTerm: initialSearchTerm = "",
}) {
  const [beats, setBeats] = useState([]);
  const [comments, setComments] = useState({});
  const [savedBeats, setSavedBeats] = useState([]);
  const [likedBeats, setLikedBeats] = useState([]);
  const [commentText, setCommentText] = useState({});
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedGenre, setSelectedGenre] = useState("All Genres");
  const [sortOption, setSortOption] = useState("Newest");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [submittingBeatId, setSubmittingBeatId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [savingBeatId, setSavingBeatId] = useState(null);
  const [likingBeatId, setLikingBeatId] = useState(null);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [failedCoverIds, setFailedCoverIds] = useState([]);

  async function loadUser() {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    setUser(currentUser || null);

    if (!currentUser) {
      setSavedBeats([]);
      setLikedBeats([]);
      return;
    }

    const { data: savedData, error: savedError } =
      await supabase
        .from("saved_beats")
        .select("beat_id")
        .eq("user_id", currentUser.id);

    if (savedError) {
      setError(savedError.message);
      setSavedBeats([]);
    } else {
      setSavedBeats(
        (savedData || []).map((item) => item.beat_id)
      );
    }

    const { data: likedData, error: likedError } =
      await supabase
        .from("liked_beats")
        .select("beat_id")
        .eq("user_id", currentUser.id);

    if (likedError) {
      setError(likedError.message);
      setLikedBeats([]);
    } else {
      setLikedBeats(
        (likedData || []).map((item) => item.beat_id)
      );
    }
  }

  async function loadComments(beatIds) {
    if (!beatIds || beatIds.length === 0) {
      setComments({});
      return;
    }

    setCommentsLoading(true);
    setCommentError("");

    const { data, error: commentsError } =
      await supabase
        .from("comments")
        .select(
          "id, beat_id, user_id, comment_text, created_at"
        )
        .in("beat_id", beatIds)
        .order("created_at", {
          ascending: false,
        });

    if (commentsError) {
      setCommentError(commentsError.message);
      setComments({});
      setCommentsLoading(false);
      return;
    }

    const groupedComments = {};

    (data || []).forEach((comment) => {
      if (!groupedComments[comment.beat_id]) {
        groupedComments[comment.beat_id] = [];
      }

      groupedComments[comment.beat_id].push(comment);
    });

    setComments(groupedComments);
    setCommentsLoading(false);
  }

  async function loadBeats() {
    setLoading(true);
    setError("");

    const { data, error: beatsError } =
      await supabase
        .from("beats")
        .select(`
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
          allow_instrumental_samples,
          producers!beats_producer_id_fkey (
            id,
            display_name,
            bio,
            avatar_url,
            contact_info
          )
        `)
        .eq("is_removed", false)
        .order("created_at", {
          ascending: false,
        });

    if (beatsError) {
      setError(beatsError.message);
      setBeats([]);
      setLoading(false);
      return;
    }

    const loadedBeats = data || [];

    setBeats(loadedBeats);
    setFailedCoverIds([]);

    await loadComments(
      loadedBeats.map((beat) => beat.id)
    );

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUser();
      loadBeats();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    setSearchTerm(initialSearchTerm || "");
  }, [initialSearchTerm]);

  const genres = useMemo(() => {
    const values = beats
      .map((beat) => beat.genre)
      .filter(Boolean);

    return [
      "All Genres",
      ...new Set(values),
    ];
  }, [beats]);

  const filteredBeats = useMemo(() => {
    const normalizedSearch =
      searchTerm.trim().toLowerCase();

    const filtered = beats.filter((beat) => {
      const title =
        beat.title?.toLowerCase() || "";

      const genre =
        beat.genre?.toLowerCase() || "";

      const otherGenre =
        beat.other_genre?.toLowerCase() || "";

      const description =
        beat.description?.toLowerCase() || "";

      const producerName =
        beat.producers?.display_name?.toLowerCase() ||
        "";

      const matchesSearch =
        !normalizedSearch ||
        title.includes(normalizedSearch) ||
        genre.includes(normalizedSearch) ||
        otherGenre.includes(normalizedSearch) ||
        description.includes(normalizedSearch) ||
        producerName.includes(normalizedSearch);

      const matchesGenre =
        selectedGenre === "All Genres" ||
        beat.genre === selectedGenre;

      return matchesSearch && matchesGenre;
    });

    return [...filtered].sort((a, b) => {
      if (sortOption === "Newest") {
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      }

      if (sortOption === "Oldest") {
        return (
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
        );
      }

      if (sortOption === "Most Likes") {
        return (
          (b.likes || 0) - (a.likes || 0)
        );
      }

      if (sortOption === "Most Comments") {
        return (
          (comments[b.id]?.length || 0) -
          (comments[a.id]?.length || 0)
        );
      }

      return 0;
    });
  }, [
    beats,
    comments,
    searchTerm,
    selectedGenre,
    sortOption,
  ]);

  function formatDate(dateString) {
    if (!dateString) {
      return "";
    }

    return new Date(dateString).toLocaleDateString();
  }

  function getProducerName(beat) {
    return (
      beat.producers?.display_name ||
      "Producer"
    );
  }

  function getProducerBio(beat) {
    return (
      beat.producers?.bio ||
      "This producer has not added a bio yet."
    );
  }

  function getLicenseText(beat) {
    return (
      beat.license_type ||
      "Free MP3"
    );
  }

  function getCommentsForBeat(beatId) {
    return comments[beatId] || [];
  }

  function isBeatSaved(beatId) {
    return savedBeats.includes(beatId);
  }

  function isBeatLiked(beatId) {
    return likedBeats.includes(beatId);
  }

  function handleCoverError(beatId) {
    setFailedCoverIds((currentIds) => {
      if (currentIds.includes(beatId)) {
        return currentIds;
      }

      return [...currentIds, beatId];
    });
  }

  async function handleDownload(beat) {
    if (!beat.mp3_url) {
      setError(
        "This beat does not have an MP3 file."
      );
      return;
    }

    setError("");

    const { error: downloadError } =
      await supabase
        .from("beat_downloads")
        .insert({
          beat_id: beat.id,
          user_id: user?.id || null,
        });

    if (downloadError) {
      console.error(
        "Download tracking error:",
        downloadError.message
      );
    }

    try {
      const response = await fetch(beat.mp3_url);

      if (!response.ok) {
        throw new Error(
          "Unable to download the beat file."
        );
      }

      const blob = await response.blob();

      const blobUrl =
        window.URL.createObjectURL(blob);

      const safeTitle =
        (beat.title || "beat")
          .trim()
          .replace(/[<>:"/\\|?*]+/g, "")
          .replace(/\s+/g, " ");

      const link =
        document.createElement("a");

      link.href = blobUrl;
      link.download =
        `${safeTitle || "beat"}.mp3`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);
    } catch (downloadError) {
      console.error(
        "Beat download error:",
        downloadError
      );

      setError(
        "Unable to download this beat. Please try again."
      );
    }
  }

  function handlePaidLicenseContact(beat) {
    const contactInfo =
      beat.producers?.contact_info?.trim();

    if (!contactInfo) {
      window.alert(
        "The producer has not added contact information yet."
      );
      return;
    }

    window.alert(
      `Contact ${getProducerName(
        beat
      )} directly:\n\n${contactInfo}`
    );
  }

  function handleViewProducerProfile(beat) {
    if (!beat.producer_id) {
      setError(
        "Producer profile is not available."
      );
      return;
    }

    if (onNavigate) {
      onNavigate(
        "producer-profile",
        beat.producer_id
      );
      return;
    }

    window.alert(
      `Producer: ${getProducerName(
        beat
      )}\n\n${getProducerBio(beat)}`
    );
  }

  async function handleLike(beat) {
    if (!user) {
      setError(
        "Please sign in to like beats."
      );
      return;
    }

    const alreadyLiked =
      isBeatLiked(beat.id);

    const currentLikes =
      Number(beat.likes) || 0;

    setLikingBeatId(beat.id);
    setError("");

    if (alreadyLiked) {
      const { error: deleteError } =
        await supabase
          .from("liked_beats")
          .delete()
          .eq("user_id", user.id)
          .eq("beat_id", beat.id);

      if (deleteError) {
        setError(deleteError.message);
        setLikingBeatId(null);
        return;
      }

      const newLikes =
        Math.max(
          0,
          currentLikes - 1
        );

      const { error: updateError } =
        await supabase
          .from("beats")
          .update({
            likes: newLikes,
          })
          .eq("id", beat.id);

      if (updateError) {
        setError(updateError.message);
        setLikingBeatId(null);
        return;
      }

      setLikedBeats(
        (currentLiked) =>
          currentLiked.filter(
            (id) => id !== beat.id
          )
      );

      setBeats(
        (currentBeats) =>
          currentBeats.map((item) =>
            item.id === beat.id
              ? {
                  ...item,
                  likes: newLikes,
                }
              : item
          )
      );
    } else {
      const { error: insertError } =
        await supabase
          .from("liked_beats")
          .insert({
            user_id: user.id,
            beat_id: beat.id,
          });

      if (insertError) {
        setError(insertError.message);
        setLikingBeatId(null);
        return;
      }

      const newLikes =
        currentLikes + 1;

      const { error: updateError } =
        await supabase
          .from("beats")
          .update({
            likes: newLikes,
          })
          .eq("id", beat.id);

      if (updateError) {
        await supabase
          .from("liked_beats")
          .delete()
          .eq("user_id", user.id)
          .eq("beat_id", beat.id);

        setError(updateError.message);
        setLikingBeatId(null);
        return;
      }

      setLikedBeats(
        (currentLiked) => [
          ...currentLiked,
          beat.id,
        ]
      );

      setBeats(
        (currentBeats) =>
          currentBeats.map((item) =>
            item.id === beat.id
              ? {
                  ...item,
                  likes: newLikes,
                }
              : item
          )
      );
    }

    setLikingBeatId(null);
  }

  async function handleDislike(beat) {
    const currentDislikes =
      Number(beat.dislikes) || 0;

    const { error: updateError } =
      await supabase
        .from("beats")
        .update({
          dislikes:
            currentDislikes + 1,
        })
        .eq("id", beat.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setBeats(
      (currentBeats) =>
        currentBeats.map((item) =>
          item.id === beat.id
            ? {
                ...item,
                dislikes:
                  currentDislikes + 1,
              }
            : item
        )
    );
  }

  async function handleSaveBeat(beatId) {
    if (!user) {
      setError(
        "Please sign in to save beats."
      );
      return;
    }

    const alreadySaved =
      isBeatSaved(beatId);

    setSavingBeatId(beatId);
    setError("");

    if (alreadySaved) {
      const { error: deleteError } =
        await supabase
          .from("saved_beats")
          .delete()
          .eq("user_id", user.id)
          .eq("beat_id", beatId);

      if (deleteError) {
        setError(deleteError.message);
        setSavingBeatId(null);
        return;
      }

      setSavedBeats(
        (currentSaved) =>
          currentSaved.filter(
            (id) => id !== beatId
          )
      );
    } else {
      const { error: saveError } =
        await supabase
          .from("saved_beats")
          .insert({
            user_id: user.id,
            beat_id: beatId,
          });

      if (saveError) {
        setError(saveError.message);
        setSavingBeatId(null);
        return;
      }

      setSavedBeats(
        (currentSaved) => [
          ...currentSaved,
          beatId,
        ]
      );
    }

    setSavingBeatId(null);
  }

  async function handleSubmitComment(beatId) {
    const text =
      commentText[beatId]?.trim();

    if (!text) {
      setCommentError(
        "Please enter a comment."
      );
      return;
    }

    if (!user) {
      setCommentError(
        "Please sign in before commenting."
      );
      return;
    }

    setSubmittingBeatId(beatId);
    setCommentError("");

    const { data, error: insertError } =
      await supabase
        .from("comments")
        .insert({
          beat_id: beatId,
          user_id: user.id,
          comment_text: text,
        })
        .select(
          "id, beat_id, user_id, comment_text, created_at"
        )
        .single();

    if (insertError) {
      setCommentError(insertError.message);
      setSubmittingBeatId(null);
      return;
    }

    setComments(
      (currentComments) => ({
        ...currentComments,
        [beatId]: [
          data,
          ...(currentComments[beatId] || []),
        ],
      })
    );

    setCommentText(
      (currentText) => ({
        ...currentText,
        [beatId]: "",
      })
    );

    setSubmittingBeatId(null);
  }

  async function handleDeleteComment(
    commentId,
    beatId
  ) {
    setDeletingCommentId(commentId);
    setCommentError("");

    const { error: deleteError } =
      await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

    if (deleteError) {
      setCommentError(deleteError.message);
      setDeletingCommentId(null);
      return;
    }

    setComments(
      (currentComments) => ({
        ...currentComments,
        [beatId]: (
          currentComments[beatId] || []
        ).filter(
          (comment) =>
            comment.id !== commentId
        ),
      })
    );

    setDeletingCommentId(null);
  }

  function clearFilters() {
    setSearchTerm("");
    setSelectedGenre("All Genres");
    setSortOption("Newest");
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          Loading beats...
        </div>
      </div>
    );
  }

  const headerFilterTarget =
    typeof document !== "undefined"
      ? document.getElementById(
          "browse-header-filters"
        )
      : null;

  return (
    <>
      {headerFilterTarget &&
        createPortal(
          <div className="browse-filter-nav">
            <div className="filter-group search-group">
              <label htmlFor="beat-search">
                Search
              </label>

              <input
                id="beat-search"
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search beats, genres, producers..."
              />
            </div>

            <div className="filter-group">
              <label htmlFor="genre-filter">
                Genre
              </label>

              <select
                id="genre-filter"
                value={selectedGenre}
                onChange={(event) =>
                  setSelectedGenre(
                    event.target.value
                  )
                }
              >
                {genres.map((genre) => (
                  <option
                    key={genre}
                    value={genre}
                  >
                    {genre}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="sort-filter">
                Sort
              </label>

              <select
                id="sort-filter"
                value={sortOption}
                onChange={(event) =>
                  setSortOption(
                    event.target.value
                  )
                }
              >
                <option value="Newest">
                  Newest
                </option>

                <option value="Oldest">
                  Oldest
                </option>

                <option value="Most Likes">
                  Most Likes
                </option>

                <option value="Most Comments">
                  Most Comments
                </option>
              </select>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>,
          headerFilterTarget
        )}

      <div className="page-container">
        <div className="page-header">
          <div>
            <h1>Browse Beats</h1>

            <p>
              Discover original beats from
              producers on Tellem Beat Store.
            </p>
          </div>

          {onNavigate && (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                onNavigate("home")
              }
            >
              Back Home
            </button>
          )}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="browse-summary">
          <strong>
            {filteredBeats.length}
          </strong>{" "}
          beat
          {filteredBeats.length !== 1
            ? "s"
            : ""}{" "}
          found
        </div>

        {filteredBeats.length === 0 ? (
          <div className="empty-state">
            <h2>No beats found</h2>

            <p>
              Try changing your search or
              filters.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="beats-grid">
            {filteredBeats.map((beat) => {
              const beatComments =
                getCommentsForBeat(beat.id);

              const producerName =
                getProducerName(beat);

              const producerBio =
                getProducerBio(beat);

              const producerAvatar =
                beat.producers?.avatar_url;

              const beatIsSaved =
                isBeatSaved(beat.id);

              const beatIsLiked =
                isBeatLiked(beat.id);

              const coverFailed =
                failedCoverIds.includes(
                  beat.id
                );

              return (
                <article
                  className="beat-card"
                  key={beat.id}
                >
                  <div className="beat-cover">
                    {beat.cover_url &&
                    !coverFailed ? (
                      <img
                        src={beat.cover_url}
                        alt={`${beat.title} cover`}
                        onError={() =>
                          handleCoverError(
                            beat.id
                          )
                        }
                      />
                    ) : (
                      <div
                        className="cover-placeholder"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: "220px",
                          padding: "20px",
                          textAlign: "center",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              display: "block",
                              fontSize: "20px",
                              marginBottom: "6px",
                            }}
                          >
                            MUSIC
                          </strong>

                          <span>
                            {beat.title ||
                              "Beat"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="beat-content">
                    <div className="beat-title-row">
                      <div>
                        <h2>
                          {beat.title}
                        </h2>

                        <p className="producer-name">
                          Produced by{" "}
                          <strong>
                            {producerName}
                          </strong>
                        </p>
                      </div>

                      <span className="license-badge">
                        {getLicenseText(
                          beat
                        )}
                      </span>
                    </div>

                    <div
                      className="producer-profile-preview"
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                        padding: "12px",
                        margin: "12px 0",
                        border:
                          "1px solid #e5e7eb",
                        borderRadius: "10px",
                      }}
                    >
                      {producerAvatar ? (
                        <img
                          src={producerAvatar}
                          alt={`${producerName} profile`}
                          style={{
                            width: "52px",
                            height: "52px",
                            borderRadius:
                              "50%",
                            objectFit:
                              "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "52px",
                            height: "52px",
                            minWidth: "52px",
                            borderRadius:
                              "50%",
                            display: "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            background:
                              "#f1f5f9",
                            fontSize: "18px",
                            fontWeight:
                              "700",
                          }}
                        >
                          TB
                        </div>
                      )}

                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <strong>
                          {producerName}
                        </strong>

                        <p
                          style={{
                            margin:
                              "4px 0 0",
                            fontSize:
                              "14px",
                            lineHeight:
                              "1.4",
                          }}
                        >
                          {producerBio}
                        </p>
                      </div>
                    </div>

                    <div className="beat-meta">
                      <span>
                        Genre:{" "}
                        <strong>
                          {beat.genre ||
                            "N/A"}
                        </strong>
                      </span>

                      {beat.other_genre && (
                        <span>
                          Other:{" "}
                          <strong>
                            {
                              beat.other_genre
                            }
                          </strong>
                        </span>
                      )}

                      <span>
                        BPM:{" "}
                        <strong>
                          {beat.bpm ||
                            "N/A"}
                        </strong>
                      </span>

                      <span>
                        Key:{" "}
                        <strong>
                          {beat.musical_key ||
                            "N/A"}
                        </strong>
                      </span>
                    </div>

                    {beat.description && (
                      <p className="beat-description">
                        {beat.description}
                      </p>
                    )}

                    <p className="beat-date">
                      Added{" "}
                      {formatDate(
                        beat.created_at
                      )}
                    </p>

                    {beat.mp3_url && (
                      <audio
                        controls
                        preload="none"
                        className="beat-audio"
                        src={beat.mp3_url}
                      >
                        Your browser does not
                        support audio playback.
                      </audio>
                    )}

                    <div className="beat-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={
                          likingBeatId ===
                          beat.id
                        }
                        onClick={() =>
                          handleLike(beat)
                        }
                      >
                        {likingBeatId ===
                        beat.id
                          ? "Saving..."
                          : beatIsLiked
                          ? `Liked ${beat.likes || 0}`
                          : `LIKE ${beat.likes || 0}`}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          handleDislike(beat)
                        }
                      >
                        DISLIKE{" "}
                        {beat.dislikes ||
                          0}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        disabled={
                          savingBeatId ===
                          beat.id
                        }
                        onClick={() =>
                          handleSaveBeat(
                            beat.id
                          )
                        }
                      >
                        {savingBeatId ===
                        beat.id
                          ? "Saving..."
                          : beatIsSaved
                          ? "SAVED"
                          : "SAVE BEAT"}
                      </button>

                      <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                          handleDownload(
                            beat
                          )
                        }
                      >
                        Download Free MP3
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          handlePaidLicenseContact(
                            beat
                          )
                        }
                      >
                        Contact Producer
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          handleViewProducerProfile(
                            beat
                          )
                        }
                      >
                        View Producer Profile
                      </button>
                    </div>

                    <div className="license-info">
                      <h3>
                        Free MP3 License
                      </h3>

                      <p>
                        This beat is available
                        for free download for
                        listening, practice,
                        writing, and
                        non-commercial
                        demonstration purposes
                        only.
                      </p>

                      <ul>
                        <li>
                          No remakes
                        </li>

                        <li>
                          No commercial songs
                          or releases
                        </li>

                        <li>
                          No instrumental
                          samples
                        </li>

                        <li>
                          No resale or
                          redistribution
                        </li>

                        <li>
                          No Content ID
                          registration
                        </li>

                        <li>
                          No copyright claims
                        </li>
                      </ul>

                      <p>
                        Producer{" "}
                        <strong>
                          {producerName}
                        </strong>{" "}
                        retains 100% ownership
                        and copyright of the
                        instrumental.
                      </p>

                      <p>
                        A paid license must be
                        obtained before using
                        the beat commercially
                        or releasing a song
                        using the beat.
                      </p>

                      <p>
                        Artist-name "Type Beat"
                        titles are permitted for
                        descriptive and search
                        purposes only and do not
                        imply endorsement,
                        affiliation, or
                        participation by the
                        named artist.
                      </p>
                    </div>

                    <div className="comments-section">
                      <div className="comments-header">
                        <h3>
                          Comments (
                          {
                            beatComments.length
                          }
                          )
                        </h3>
                      </div>

                      {commentsLoading &&
                      beatComments.length ===
                        0 ? (
                        <p>
                          Loading comments...
                        </p>
                      ) : beatComments.length ===
                        0 ? (
                        <p>
                          No comments yet. Be
                          the first to comment.
                        </p>
                      ) : (
                        <div className="comments-list">
                          {beatComments.map(
                            (comment) => (
                              <div
                                className="comment-item"
                                key={
                                  comment.id
                                }
                              >
                                <div className="comment-content">
                                  <strong>
                                    Artist
                                  </strong>

                                  <p>
                                    {
                                      comment.comment_text
                                    }
                                  </p>

                                  <small>
                                    {formatDate(
                                      comment.created_at
                                    )}
                                  </small>
                                </div>

                                {user &&
                                  user.id ===
                                    comment.user_id && (
                                    <button
                                      type="button"
                                      className="danger-button"
                                      disabled={
                                        deletingCommentId ===
                                        comment.id
                                      }
                                      onClick={() =>
                                        handleDeleteComment(
                                          comment.id,
                                          beat.id
                                        )
                                      }
                                    >
                                      {deletingCommentId ===
                                      comment.id
                                        ? "Deleting..."
                                        : "Delete"}
                                    </button>
                                  )}
                              </div>
                            )
                          )}
                        </div>
                      )}

                      <div className="comment-form">
                        <textarea
                          value={
                            commentText[
                              beat.id
                            ] || ""
                          }
                          onChange={(event) =>
                            setCommentText(
                              (
                                currentText
                              ) => ({
                                ...currentText,
                                [beat.id]:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                          placeholder={
                            user
                              ? "Write a comment..."
                              : "Sign in to comment..."
                          }
                          disabled={!user}
                          rows={3}
                        />

                        <button
                          type="button"
                          className="primary-button"
                          disabled={
                            !user ||
                            submittingBeatId ===
                              beat.id
                          }
                          onClick={() =>
                            handleSubmitComment(
                              beat.id
                            )
                          }
                        >
                          {submittingBeatId ===
                          beat.id
                            ? "Posting..."
                            : "Post Comment"}
                        </button>
                      </div>

                      {commentError && (
                        <p className="error-message">
                          {commentError}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default BrowseBeats;