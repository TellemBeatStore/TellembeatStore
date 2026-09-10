import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function LatestBeats({ onNavigate }) {
  const [beats, setBeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playingId, setPlayingId] = useState(null);
  const [selectedBeat, setSelectedBeat] = useState(null);
  const [selectedProducer, setSelectedProducer] = useState(null);

  const [user, setUser] = useState(null);
  const [savedBeatIds, setSavedBeatIds] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.innerWidth <= 700
  );

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 700);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  /*
   * LOAD PUBLIC BEATS
   */
  useEffect(() => {
    let cancelled = false;

    async function loadBeats() {
      setLoading(true);
      setError("");

      const { data, error: beatsError } = await supabase
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
          is_removed,
          producers!beats_producer_id_fkey (
            id,
            display_name,
            bio,
            avatar_url,
            contact_info
          )
        `)
        .eq("is_removed", false)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (beatsError) {
        console.error("Unable to load beats:", beatsError);
        setError(beatsError.message);
        setLoading(false);
        return;
      }

      setBeats(data || []);
      setLoading(false);
    }

    loadBeats();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * AUTHENTICATED USER
   */
  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (mounted) {
        setUser(currentUser || null);
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setUser(session?.user || null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /*
   * LOAD SAVED BEATS
   */
  useEffect(() => {
    if (!user) {
      setSavedBeatIds([]);
      return;
    }

    let cancelled = false;

    async function loadSavedBeats() {
      const { data, error: savedError } = await supabase
        .from("saved_beats")
        .select("beat_id")
        .eq("user_id", user.id);

      if (cancelled) return;

      if (savedError) {
        console.error(
          "Unable to load saved beats:",
          savedError.message
        );
        return;
      }

      setSavedBeatIds(
        (data || []).map((item) => item.beat_id)
      );
    }

    loadSavedBeats();

    return () => {
      cancelled = true;
    };
  }, [user]);

  /*
   * OPEN SHARED BEAT AUTOMATICALLY
   */
  useEffect(() => {
    if (!beats.length) return;

    const params = new URLSearchParams(
      window.location.search
    );

    const beatId = params.get("beat");

    if (!beatId) return;

    let cancelled = false;

    async function loadSharedBeat() {
      const {
        data: sharedBeat,
        error: sharedBeatError,
      } = await supabase
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
          is_removed,
          producers!beats_producer_id_fkey (
            id,
            display_name,
            bio,
            avatar_url,
            contact_info
          )
        `)
        .eq("id", beatId)
        .eq("is_removed", false)
        .maybeSingle();

      if (cancelled) return;

      if (sharedBeatError) {
        console.error(
          "Unable to load shared beat:",
          sharedBeatError.message
        );
        return;
      }

      if (!sharedBeat) {
        setSelectedBeat(null);
        setSelectedProducer(null);
        setComments([]);
        setCommentText("");

        const url = new URL(window.location.href);
        url.searchParams.delete("beat");

        window.history.replaceState(
          {},
          "",
          url.toString()
        );

        return;
      }

      setSelectedBeat(sharedBeat);
      setSelectedProducer(null);
      setCommentText("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }

    loadSharedBeat();

    return () => {
      cancelled = true;
    };
  }, [beats]);

  /*
   * LOAD COMMENTS
   */
  useEffect(() => {
    if (!selectedBeat?.id) {
      setComments([]);
      return;
    }

    let cancelled = false;

    async function loadComments() {
      setCommentsLoading(true);

      const { data, error: commentsError } =
        await supabase
          .from("comments")
          .select("*")
          .eq("beat_id", selectedBeat.id)
          .order("created_at", {
            ascending: true,
          });

      if (cancelled) return;

      if (commentsError) {
        console.error(
          "Unable to load comments:",
          commentsError.message
        );
        setComments([]);
        setCommentsLoading(false);
        return;
      }

      setComments(data || []);
      setCommentsLoading(false);
    }

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [selectedBeat]);

  /*
   * PRODUCER HELPERS
   */
  function getProducer(beat) {
    if (!beat?.producers) {
      return null;
    }

    if (Array.isArray(beat.producers)) {
      return beat.producers[0] || null;
    }

    return beat.producers;
  }

  function getProducerName(beat) {
    const producer = getProducer(beat);

    return producer?.display_name || "Tellembeatzgo";
  }

  /*
   * DOWNLOAD BEAT
   */
  async function handleDownloadBeat(beat) {
    if (!beat?.mp3_url) {
      window.alert(
        "This beat does not have an MP3 file."
      );
      return;
    }

    try {
      const response = await fetch(beat.mp3_url);

      if (!response.ok) {
        throw new Error(
          "Unable to download the beat file."
        );
      }

      const blob = await response.blob();

      const safeTitle = (
        beat.title || "Beat"
      )
        .trim()
        .replace(/[<>:"/\\|?*]+/g, "")
        .replace(/\s+/g, " ");

      const fileName =
        `${safeTitle || "Beat"}.mp3`;

      const blobUrl =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = blobUrl;
      link.download = fileName;
      link.style.display = "none";

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

      window.alert(
        "Unable to download this beat. Please try again."
      );
    }
  }

  /*
   * PLAY / PAUSE
   */
  function togglePlay(beatId) {
    const audio = document.getElementById(
      `latest-audio-${beatId}`
    );

    if (!audio) return;

    if (audio.paused) {
      document
        .querySelectorAll(".latest-beat-audio")
        .forEach((otherAudio) => {
          if (otherAudio !== audio) {
            otherAudio.pause();
          }
        });

      audio
        .play()
        .then(() => {
          setPlayingId(beatId);
        })
        .catch((playError) => {
          console.error(
            "Unable to play audio:",
            playError
          );
          setPlayingId(null);
        });
    } else {
      audio.pause();
      setPlayingId(null);
    }
  }

  function handleAudioEnded() {
    setPlayingId(null);
  }

  /*
   * OPEN BEAT
   */
  async function openBeat(beat) {
    if (!beat?.id) return;

    const {
      data: activeBeat,
      error: activeBeatError,
    } = await supabase
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
        is_removed,
        producers!beats_producer_id_fkey (
          id,
          display_name,
          bio,
          avatar_url,
          contact_info
        )
      `)
      .eq("id", beat.id)
      .eq("is_removed", false)
      .maybeSingle();

    if (activeBeatError) {
      console.error(
        "Unable to verify beat:",
        activeBeatError.message
      );

      window.alert(
        "Unable to open this beat right now. Please try again."
      );

      return;
    }

    if (!activeBeat) {
      setSelectedBeat(null);
      setSelectedProducer(null);
      setComments([]);
      setCommentText("");

      const url = new URL(window.location.href);
      url.searchParams.delete("beat");

      window.history.replaceState(
        {},
        "",
        url.toString()
      );

      window.alert(
        "This beat is no longer available on Tellem Beat Store."
      );

      return;
    }

    setSelectedBeat(activeBeat);
    setSelectedProducer(null);
    setCommentText("");

    document
      .querySelectorAll(".latest-beat-audio")
      .forEach((audio) => {
        audio.pause();
      });

    setPlayingId(null);

    const url = new URL(window.location.href);

    url.searchParams.set(
      "beat",
      activeBeat.id
    );

    window.history.replaceState(
      {},
      "",
      url.toString()
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeBeat() {
    setSelectedBeat(null);
    setSelectedProducer(null);
    setComments([]);
    setCommentText("");

    const url = new URL(window.location.href);
    url.searchParams.delete("beat");

    window.history.replaceState(
      {},
      "",
      url.toString()
    );
  }

  /*
   * OPEN PRODUCER PROFILE
   */
  function openProducerProfile(beat) {
    if (!beat?.producer_id) {
      window.alert(
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

    const producer = getProducer(beat);

    if (!producer) {
      window.alert(
        `Producer: ${getProducerName(beat)}`
      );
      return;
    }

    setSelectedProducer(producer);
    setSelectedBeat(null);
    setComments([]);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeProducerProfile() {
    setSelectedProducer(null);
  }

  /*
   * PUBLIC PRODUCER CATALOG
   */
  function getProducerBeats(producerId) {
    if (!producerId) return [];

    return beats.filter(
      (beat) =>
        beat.producer_id === producerId &&
        beat.is_removed !== true
    );
  }

  /*
   * CONTACT PRODUCER
   */
  function handleContactProducer(beat) {
    const producer = getProducer(beat);

    const contactInfo =
      producer?.contact_info?.trim();

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

  /*
   * LIKE / DISLIKE
   */
  async function handleVote(beatId, voteType) {
    if (!user) {
      window.alert(
        "Please sign in to like or dislike a beat."
      );
      return;
    }

    const {
      data: existingVote,
      error: voteCheckError,
    } = await supabase
      .from("beat_votes")
      .select("id, vote_type")
      .eq("beat_id", beatId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (voteCheckError) {
      window.alert(
        `Unable to process your vote: ${voteCheckError.message}`
      );
      return;
    }

    if (
      existingVote &&
      existingVote.vote_type === voteType
    ) {
      return;
    }

    if (existingVote) {
      const { error: updateError } =
        await supabase
          .from("beat_votes")
          .update({
            vote_type: voteType,
          })
          .eq("id", existingVote.id);

      if (updateError) {
        window.alert(
          `Unable to update your vote: ${updateError.message}`
        );
        return;
      }
    } else {
      const { error: insertError } =
        await supabase
          .from("beat_votes")
          .insert({
            beat_id: beatId,
            user_id: user.id,
            vote_type: voteType,
          });

      if (insertError) {
        window.alert(
          `Unable to save your vote: ${insertError.message}`
        );
        return;
      }
    }

    const { count: likesCount } =
      await supabase
        .from("beat_votes")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("beat_id", beatId)
        .eq("vote_type", "like");

    const { count: dislikesCount } =
      await supabase
        .from("beat_votes")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("beat_id", beatId)
        .eq("vote_type", "dislike");

    setBeats((currentBeats) =>
      currentBeats.map((beat) =>
        beat.id === beatId
          ? {
              ...beat,
              likes: likesCount || 0,
              dislikes: dislikesCount || 0,
            }
          : beat
      )
    );

    setSelectedBeat((currentBeat) =>
      currentBeat?.id === beatId
        ? {
            ...currentBeat,
            likes: likesCount || 0,
            dislikes: dislikesCount || 0,
          }
        : currentBeat
    );
  }

  function handleLike(beatId) {
    handleVote(beatId, "like");
  }

  function handleDislike(beatId) {
    handleVote(beatId, "dislike");
  }

  /*
   * SAVE / UNSAVE
   */
  async function handleSaveBeat(beatId) {
    if (!user) {
      window.alert(
        "Please sign in to save beats."
      );
      return;
    }

    const isSaved =
      savedBeatIds.includes(beatId);

    if (isSaved) {
      const { error: deleteError } =
        await supabase
          .from("saved_beats")
          .delete()
          .eq("beat_id", beatId)
          .eq("user_id", user.id);

      if (deleteError) {
        window.alert(
          `Unable to remove saved beat: ${deleteError.message}`
        );
        return;
      }

      setSavedBeatIds((current) =>
        current.filter(
          (id) => id !== beatId
        )
      );

      return;
    }

    const { error: insertError } =
      await supabase
        .from("saved_beats")
        .insert({
          beat_id: beatId,
          user_id: user.id,
        });

    if (insertError) {
      window.alert(
        `Unable to save beat: ${insertError.message}`
      );
      return;
    }

    setSavedBeatIds((current) => [
      ...current,
      beatId,
    ]);
  }

  /*
   * COMMENTS
   */
  async function handleSubmitComment(event) {
    event.preventDefault();

    if (!selectedBeat?.id) return;

    if (!user) {
      window.alert(
        "Please sign in to post a comment."
      );
      return;
    }

    const trimmedComment =
      commentText.trim();

    if (!trimmedComment) return;

    if (trimmedComment.length > 500) {
      window.alert(
        "Comment cannot exceed 500 characters."
      );
      return;
    }

    setCommentSubmitting(true);

    const {
      data,
      error: insertError,
    } = await supabase
      .from("comments")
      .insert({
        beat_id: selectedBeat.id,
        user_id: user.id,
        comment_text: trimmedComment,
      })
      .select()
      .single();

    if (insertError) {
      window.alert(
        `Unable to post comment: ${insertError.message}`
      );
      setCommentSubmitting(false);
      return;
    }

    if (data) {
      setComments((current) => [
        ...current,
        data,
      ]);
    }

    setCommentText("");
    setCommentSubmitting(false);
  }

  async function handleDeleteComment(comment) {
    if (!user) return;

    if (comment.user_id !== user.id) {
      return;
    }

    const { error: deleteError } =
      await supabase
        .from("comments")
        .delete()
        .eq("id", comment.id)
        .eq("user_id", user.id);

    if (deleteError) {
      window.alert(
        `Unable to delete comment: ${deleteError.message}`
      );
      return;
    }

    setComments((current) =>
      current.filter(
        (item) => item.id !== comment.id
      )
    );
  }

  /*
   * SHARE BEAT
   */
  async function handleShareBeat(beat) {
    if (!beat?.id) {
      window.alert(
        "Unable to create a link for this beat."
      );
      return;
    }

    const beatTitle =
      beat.title || "Beat";

    const shareUrl =
      `${window.location.origin}${window.location.pathname}` +
      `?beat=${encodeURIComponent(beat.id)}`;

    const shareData = {
      title: `${beatTitle} | Tellem Beat Store`,
      text: `Check out "${beatTitle}" by ${getProducerName(
        beat
      )} on Tellem Beat Store.`,
      url: shareUrl,
    };

    try {
      if (
        navigator.share &&
        typeof navigator.share === "function"
      ) {
        await navigator.share(shareData);
        return;
      }

      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          "function"
      ) {
        await navigator.clipboard.writeText(
          shareUrl
        );

        window.alert(
          `"${beatTitle}" link copied!\n\nYou can now paste it on WhatsApp, Facebook, TikTok, Instagram, or anywhere else.`
        );

        return;
      }

      window.prompt(
        "Copy this beat link:",
        shareUrl
      );
    } catch (shareError) {
      if (
        shareError?.name === "AbortError"
      ) {
        return;
      }

      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(
            shareUrl
          );

          window.alert(
            `"${beatTitle}" link copied!`
          );

          return;
        }
      } catch {
        // Continue
      }

      window.alert(
        "Unable to share this beat right now. Please try again."
      );
    }
  }

  /*
   * PRODUCER PROFILE VIEW
   */
  if (selectedProducer) {
    const producerBeats =
      getProducerBeats(
        selectedProducer.id
      );

    return (
      <section style={styles.detailSection}>
        <button
          type="button"
          onClick={closeProducerProfile}
          style={styles.backButton}
        >
          BACK TO LATEST BEATS
        </button>

        <div style={styles.producerProfile}>
          <div
            style={{
              ...styles.profileHeader,
              ...(isMobile
                ? styles.profileHeaderMobile
                : {}),
            }}
          >
            <div
              style={
                styles.profileAvatarWrapper
              }
            >
              {selectedProducer.avatar_url ? (
                <img
                  src={
                    selectedProducer.avatar_url
                  }
                  alt={
                    selectedProducer.display_name ||
                    "Producer"
                  }
                  style={styles.profileAvatar}
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";
                  }}
                />
              ) : (
                <div
                  style={
                    styles.profileAvatarFallback
                  }
                >
                  USER
                </div>
              )}
            </div>

            <div style={styles.profileInfo}>
              <p style={styles.detailSmallTitle}>
                TELLEM BEAT STORE PRODUCER
              </p>

              <h1 style={styles.profileName}>
                {selectedProducer.display_name ||
                  "Producer"}
              </h1>

              {selectedProducer.bio && (
                <p style={styles.profileBio}>
                  {selectedProducer.bio}
                </p>
              )}

              {selectedProducer.contact_info && (
                <div style={styles.contactBox}>
                  <strong>CONTACT</strong>
                  <p>
                    {
                      selectedProducer.contact_info
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          <div
            style={
              styles.producerBeatsHeader
            }
          >
            <p style={styles.smallTitle}>
              PRODUCER CATALOG
            </p>

            <h2 style={styles.heading}>
              All Beats by{" "}
              {selectedProducer.display_name ||
                "Producer"}
            </h2>

            <p style={styles.description}>
              Explore all beats uploaded by this
              producer on Tellem Beat Store.
            </p>
          </div>

          {producerBeats.length === 0 ? (
            <div style={styles.empty}>
              No other beats uploaded yet.
            </div>
          ) : (
            <div style={styles.grid}>
              {producerBeats.map((beat) => (
                <article
                  key={beat.id}
                  style={styles.card}
                  onClick={() =>
                    openBeat(beat)
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      openBeat(beat);
                    }
                  }}
                >
                  <div
                    style={
                      styles.artworkWrapper
                    }
                  >
                    {beat.cover_url ? (
                      <img
                        src={beat.cover_url}
                        alt={
                          beat.title ||
                          "Beat cover"
                        }
                        style={styles.cover}
                        onError={(event) => {
                          event.currentTarget.style.display =
                            "none";

                          const fallback =
                            event.currentTarget
                              .parentElement
                              ?.querySelector(
                                ".latest-cover-fallback"
                              );

                          if (fallback) {
                            fallback.style.display =
                              "flex";
                          }
                        }}
                      />
                    ) : null}

                    <div
                      className="latest-cover-fallback"
                      style={{
                        ...styles.noCover,
                        display: beat.cover_url
                          ? "none"
                          : "flex",
                      }}
                    >
                      MUSIC
                    </div>

                    <div
                      style={styles.newBadge}
                    >
                      BEAT
                    </div>

                    {beat.mp3_url && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          togglePlay(
                            beat.id
                          );
                        }}
                        style={
                          styles.playButton
                        }
                        aria-label={
                          playingId ===
                          beat.id
                            ? "Pause beat"
                            : "Play beat"
                        }
                      >
                        {playingId ===
                        beat.id
                          ? "PAUSE"
                          : "PLAY"}
                      </button>
                    )}
                  </div>

                  {beat.mp3_url && (
                    <audio
                      id={`latest-audio-${beat.id}`}
                      className="latest-beat-audio"
                      src={beat.mp3_url}
                      preload="none"
                      onEnded={
                        handleAudioEnded
                      }
                    />
                  )}

                  <div
                    style={styles.content}
                  >
                    <h3 style={styles.title}>
                      {beat.title ||
                        "Untitled Beat"}
                    </h3>

                    <button
                      type="button"
                      style={
                        styles.producerButton
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        openProducerProfile(
                          beat
                        );
                      }}
                    >
                      {getProducer(
                        beat
                      )?.avatar_url ? (
                        <img
                          src={
                            getProducer(
                              beat
                            ).avatar_url
                          }
                          alt={getProducerName(
                            beat
                          )}
                          style={
                            styles.cardProducerAvatar
                          }
                          onError={(event) => {
                            event.currentTarget.style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <span
                          style={
                            styles.cardProducerAvatarFallback
                          }
                        >
                          USER
                        </span>
                      )}

                      <span
                        style={
                          styles.producerButtonText
                        }
                      >
                        Prod. by{" "}
                        {getProducerName(
                          beat
                        )}
                      </span>
                    </button>

                    <p style={styles.genre}>
                      {beat.genre ||
                        "Instrumental"}
                    </p>

                    <div
                      style={styles.details}
                    >
                      {beat.bpm && (
                        <span>
                          {beat.bpm} BPM
                        </span>
                      )}

                      {beat.musical_key && (
                        <span>
                          {beat.bpm
                            ? " • "
                            : ""}
                          {
                            beat.musical_key
                          }
                        </span>
                      )}
                    </div>

                    {beat.mp3_url && (
                      <button
                        type="button"
                        style={
                          styles.downloadButton
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDownloadBeat(
                            beat
                          );
                        }}
                      >
                        FREE MP3
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  /*
   * FULL BEAT DETAIL VIEW
   */
  if (selectedBeat) {
    const producer =
      getProducer(selectedBeat);

    const producerBeats =
      producer?.id
        ? getProducerBeats(producer.id)
        : [];

    const isSaved =
      savedBeatIds.includes(
        selectedBeat.id
      );

    return (
      <section
        style={{
          ...styles.detailSection,
          ...(isMobile
            ? styles.detailSectionMobile
            : {}),
        }}
      >
        <button
          type="button"
          onClick={closeBeat}
          style={styles.backButton}
        >
          BACK TO LATEST BEATS
        </button>

        <div
          style={{
            ...styles.detailContainer,
            ...(isMobile
              ? styles.detailContainerMobile
              : {}),
          }}
        >
          <div
            style={{
              ...styles.detailArtwork,
              ...(isMobile
                ? styles.detailArtworkMobile
                : {}),
            }}
          >
            {selectedBeat.cover_url ? (
              <img
                src={selectedBeat.cover_url}
                alt={
                  selectedBeat.title ||
                  "Beat cover"
                }
                style={styles.detailCover}
                onError={(event) => {
                  event.currentTarget.style.display =
                    "none";

                  const fallback =
                    event.currentTarget
                      .parentElement
                      ?.querySelector(
                        ".latest-detail-cover-fallback"
                      );

                  if (fallback) {
                    fallback.style.display =
                      "flex";
                  }
                }}
              />
            ) : null}

            <div
              className="latest-detail-cover-fallback"
              style={{
                ...styles.detailNoCover,
                display: selectedBeat.cover_url
                  ? "none"
                  : "flex",
              }}
            >
              MUSIC
            </div>
          </div>

          <div
            style={{
              ...styles.detailInfo,
              ...(isMobile
                ? styles.detailInfoMobile
                : {}),
            }}
          >
            <p
              style={
                styles.detailSmallTitle
              }
            >
              TELLEM BEAT STORE
            </p>

            <h1
              style={{
                ...styles.detailTitle,
                ...(isMobile
                  ? styles.detailTitleMobile
                  : {}),
              }}
            >
              {selectedBeat.title ||
                "Untitled Beat"}
            </h1>

            <p style={styles.detailProducer}>
              Prod. by{" "}
              {getProducerName(
                selectedBeat
              )}
            </p>

            <div
              style={styles.detailTags}
            >
              <span
                style={styles.detailTag}
              >
                {selectedBeat.genre ||
                  "Instrumental"}
              </span>

              {selectedBeat.bpm && (
                <span
                  style={styles.detailTag}
                >
                  {selectedBeat.bpm} BPM
                </span>
              )}

              {selectedBeat.musical_key && (
                <span
                  style={styles.detailTag}
                >
                  {
                    selectedBeat.musical_key
                  }
                </span>
              )}
            </div>

            {selectedBeat.mp3_url && (
              <div
                style={
                  styles.detailPlayer
                }
              >
                <p
                  style={
                    styles.playerLabel
                  }
                >
                  PREVIEW BEAT
                </p>

                <audio
                  controls
                  autoPlay
                  src={selectedBeat.mp3_url}
                  style={
                    styles.largeAudio
                  }
                />
              </div>
            )}

            <div
              style={styles.interactionBox}
            >
              <div
                style={{
                  ...styles.voteGroup,
                  ...(isMobile
                    ? styles.voteGroupMobile
                    : {}),
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    handleLike(
                      selectedBeat.id
                    )
                  }
                  style={
                    styles.likeButton
                  }
                >
                  <span>LIKE</span>
                  <span>
                    {selectedBeat.likes ||
                      0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDislike(
                      selectedBeat.id
                    )
                  }
                  style={
                    styles.dislikeButton
                  }
                >
                  <span>DISLIKE</span>
                  <span>
                    {
                      selectedBeat.dislikes ||
                      0
                    }
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSaveBeat(
                      selectedBeat.id
                    )
                  }
                  style={
                    isSaved
                      ? styles.savedButton
                      : styles.saveButton
                  }
                >
                  {isSaved
                    ? "SAVED"
                    : "SAVE BEAT"}
                </button>
              </div>
            </div>

            {selectedBeat.description && (
              <div
                style={
                  styles.descriptionBox
                }
              >
                <h3>
                  About This Beat
                </h3>

                <p>
                  {
                    selectedBeat.description
                  }
                </p>
              </div>
            )}

            <div
              style={
                styles.producerDetailBox
              }
            >
              <p
                style={
                  styles.playerLabel
                }
              >
                PRODUCER INFORMATION
              </p>

              <div
                style={{
                  ...styles.producerDetailHeader,
                  ...(isMobile
                    ? styles.producerDetailHeaderMobile
                    : {}),
                }}
              >
                {producer?.avatar_url ? (
                  <img
                    src={
                      producer.avatar_url
                    }
                    alt={
                      producer.display_name ||
                      "Producer"
                    }
                    style={
                      styles.producerDetailAvatar
                    }
                    onError={(event) => {
                      event.currentTarget.style.display =
                        "none";
                    }}
                  />
                ) : (
                  <div
                    style={
                      styles.producerDetailAvatarFallback
                    }
                  >
                    USER
                  </div>
                )}

                <div
                  style={{ minWidth: 0 }}
                >
                  <h3
                    style={
                      styles.producerDetailName
                    }
                  >
                    {getProducerName(
                      selectedBeat
                    )}
                  </h3>

                  {producer?.bio && (
                    <p
                      style={
                        styles.producerDetailBio
                      }
                    >
                      {producer.bio}
                    </p>
                  )}
                </div>
              </div>

              {producer?.contact_info ? (
                <div
                  style={styles.contactBox}
                >
                  <strong>
                    CONTACT INFORMATION
                  </strong>

                  <p>
                    {
                      producer.contact_info
                    }
                  </p>
                </div>
              ) : (
                <p
                  style={styles.noContact}
                >
                  This producer has not
                  added contact information
                  yet.
                </p>
              )}

              <div
                style={{
                  ...styles.producerActions,
                  ...(isMobile
                    ? styles.producerActionsMobile
                    : {}),
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    handleContactProducer(
                      selectedBeat
                    )
                  }
                  style={
                    styles.contactButton
                  }
                >
                  CONTACT PRODUCER
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openProducerProfile(
                      selectedBeat
                    )
                  }
                  style={
                    styles.profileButton
                  }
                >
                  VIEW PRODUCER PROFILE
                </button>
              </div>

              {producerBeats.length >
                0 && (
                <p
                  style={
                    styles.catalogHint
                  }
                >
                  This producer has{" "}
                  <strong>
                    {
                      producerBeats.length
                    }
                  </strong>{" "}
                  beat
                  {producerBeats.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  available on Tellem Beat
                  Store.
                </p>
              )}
            </div>

            {/* COMMENTS */}
            <div
              style={styles.commentsBox}
            >
              <div
                style={styles.commentsHeader}
              >
                <div>
                  <p
                    style={
                      styles.playerLabel
                    }
                  >
                    COMMUNITY
                  </p>

                  <h3
                    style={
                      styles.commentsTitle
                    }
                  >
                    Comments
                  </h3>
                </div>

                <span
                  style={
                    styles.commentCount
                  }
                >
                  {comments.length}
                </span>
              </div>

              {user ? (
                <form
                  onSubmit={
                    handleSubmitComment
                  }
                  style={
                    styles.commentForm
                  }
                >
                  <textarea
                    value={commentText}
                    onChange={(event) =>
                      setCommentText(
                        event.target.value
                      )
                    }
                    placeholder="Write a comment about this beat..."
                    maxLength={500}
                    rows={4}
                    style={
                      styles.commentInput
                    }
                  />

                  <div
                    style={{
                      ...styles.commentFormFooter,
                      ...(isMobile
                        ? styles.commentFormFooterMobile
                        : {}),
                    }}
                  >
                    <span
                      style={
                        styles.characterCount
                      }
                    >
                      {commentText.length}
                      /500
                    </span>

                    <button
                      type="submit"
                      disabled={
                        commentSubmitting ||
                        !commentText.trim()
                      }
                      style={
                        styles.commentButton
                      }
                    >
                      {commentSubmitting
                        ? "POSTING..."
                        : "POST COMMENT"}
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  style={
                    styles.signInNotice
                  }
                >
                  <p>
                    Sign in to like, save,
                    and comment on this beat.
                  </p>
                </div>
              )}

              {commentsLoading ? (
                <p
                  style={
                    styles.commentsMessage
                  }
                >
                  Loading comments...
                </p>
              ) : comments.length === 0 ? (
                <div
                  style={styles.noComments}
                >
                  <p>
                    No comments yet. Be the
                    first to comment on this
                    beat.
                  </p>
                </div>
              ) : (
                <div
                  style={styles.commentList}
                >
                  {comments.map(
                    (comment) => (
                      <div
                        key={comment.id}
                        style={
                          styles.commentItem
                        }
                      >
                        <div
                          style={
                            styles.commentAvatar
                          }
                        >
                          {comment.user_id ===
                          user?.id
                            ? "YOU"
                            : "USER"}
                        </div>

                        <div
                          style={
                            styles.commentContent
                          }
                        >
                          <div
                            style={
                              styles.commentMeta
                            }
                          >
                            <strong>
                              {comment.user_id ===
                              user?.id
                                ? "You"
                                : "User"}
                            </strong>

                            <span>
                              {comment.created_at
                                ? new Date(
                                    comment.created_at
                                  ).toLocaleString()
                                : ""}
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

                          {comment.user_id ===
                            user?.id && (
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteComment(
                                  comment
                                )
                              }
                              style={
                                styles.deleteCommentButton
                              }
                            >
                              DELETE
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                ...styles.detailActions,
                ...(isMobile
                  ? styles.detailActionsMobile
                  : {}),
              }}
            >
              {selectedBeat.mp3_url && (
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadBeat(
                      selectedBeat
                    )
                  }
                  style={
                    styles.detailDownload
                  }
                >
                  DOWNLOAD FREE MP3
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  handleShareBeat(
                    selectedBeat
                  )
                }
                style={
                  styles.shareButton
                }
              >
                SHARE BEAT
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /*
   * LATEST BEATS GRID
   */
  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <p style={styles.smallTitle}>
            FRESH FROM THE PRODUCERS
          </p>

          <h2 style={styles.heading}>
            Latest Beats
          </h2>

          <p style={styles.description}>
            Discover the newest original beats
            uploaded by producers on Tellem Beat
            Store.
          </p>
        </div>
      </div>

      {loading && (
        <p style={styles.message}>
          Loading latest beats...
        </p>
      )}

      {!loading && error && (
        <div style={styles.error}>
          <strong>
            Unable to load beats.
          </strong>

          <br />

          {error}
        </div>
      )}

      {!loading &&
        !error &&
        beats.length === 0 && (
          <div style={styles.empty}>
            <div style={styles.icon}>
              MUSIC
            </div>

            <h3>
              No beats uploaded yet
            </h3>

            <p>
              New beats from producers will
              appear here.
            </p>
          </div>
        )}

      {!loading &&
        !error &&
        beats.length > 0 && (
          <div style={styles.grid}>
            {beats.map((beat) => (
              <article
                key={beat.id}
                style={styles.card}
                onClick={() =>
                  openBeat(beat)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    openBeat(beat);
                  }
                }}
              >
                <div
                  style={
                    styles.artworkWrapper
                  }
                >
                  {beat.cover_url ? (
                    <img
                      src={beat.cover_url}
                      alt={
                        beat.title ||
                        "Beat cover"
                      }
                      style={styles.cover}
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";

                        const fallback =
                          event.currentTarget
                            .parentElement
                            ?.querySelector(
                              ".latest-cover-fallback"
                            );

                        if (fallback) {
                          fallback.style.display =
                            "flex";
                        }
                      }}
                    />
                  ) : null}

                  <div
                    className="latest-cover-fallback"
                    style={{
                      ...styles.noCover,
                      display: beat.cover_url
                        ? "none"
                        : "flex",
                    }}
                  >
                    MUSIC
                  </div>

                  <div
                    style={styles.newBadge}
                  >
                    NEW
                  </div>

                  {beat.mp3_url && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePlay(
                          beat.id
                        );
                      }}
                      style={
                        styles.playButton
                      }
                      aria-label={
                        playingId ===
                        beat.id
                          ? "Pause beat"
                          : "Play beat"
                      }
                    >
                      {playingId ===
                      beat.id
                        ? "PAUSE"
                        : "PLAY"}
                    </button>
                  )}
                </div>

                {beat.mp3_url && (
                  <audio
                    id={`latest-audio-${beat.id}`}
                    className="latest-beat-audio"
                    src={beat.mp3_url}
                    preload="none"
                    onEnded={
                      handleAudioEnded
                    }
                  />
                )}

                <div
                  style={styles.content}
                >
                  <div
                    style={styles.titleRow}
                  >
                    <h3
                      style={styles.title}
                    >
                      {beat.title ||
                        "Untitled Beat"}
                    </h3>

                    <button
                      type="button"
                      style={
                        styles.heartButton
                      }
                      title="Like beat"
                      aria-label="Like beat"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleLike(
                          beat.id
                        );
                      }}
                    >
                      LIKE
                    </button>
                  </div>

                  <button
                    type="button"
                    style={
                      styles.producerButton
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      openProducerProfile(
                        beat
                      );
                    }}
                    title={`View ${getProducerName(
                      beat
                    )} profile`}
                    aria-label={`View ${getProducerName(
                      beat
                    )} producer profile`}
                  >
                    {getProducer(
                      beat
                    )?.avatar_url ? (
                      <img
                        src={
                          getProducer(
                            beat
                          ).avatar_url
                        }
                        alt={getProducerName(
                          beat
                        )}
                        style={
                          styles.cardProducerAvatar
                        }
                        onError={(event) => {
                          event.currentTarget.style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <span
                        style={
                          styles.cardProducerAvatarFallback
                        }
                      >
                        USER
                      </span>
                    )}

                    <span
                      style={
                        styles.producerButtonText
                      }
                    >
                      Prod. by{" "}
                      {getProducerName(
                        beat
                      )}
                    </span>
                  </button>

                  <p style={styles.genre}>
                    {beat.genre ||
                      "Instrumental"}
                  </p>

                  <div
                    style={styles.details}
                  >
                    {beat.bpm && (
                      <span>
                        {beat.bpm} BPM
                      </span>
                    )}

                    {beat.musical_key && (
                      <span>
                        {beat.bpm
                          ? " • "
                          : ""}
                        {
                          beat.musical_key
                        }
                      </span>
                    )}
                  </div>

                  <div
                    style={styles.cardActions}
                  >
                    {beat.mp3_url && (
                      <button
                        type="button"
                        style={
                          styles.downloadButton
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDownloadBeat(
                            beat
                          );
                        }}
                      >
                        FREE MP3
                      </button>
                    )}

                    <button
                      type="button"
                      style={
                        styles.cardShareButton
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        handleShareBeat(
                          beat
                        );
                      }}
                      title="Share beat"
                      aria-label="Share beat"
                    >
                      SHARE
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
    </section>
  );
}

const styles = {
  section: {
    width: "100%",
    maxWidth: "1600px",
    margin: "0 auto",
    padding: "70px 40px",
    boxSizing: "border-box",
  },

  header: {
    marginBottom: "40px",
  },

  smallTitle: {
    color: "#ffc107",
    letterSpacing: "3px",
    fontSize: "12px",
    fontWeight: "800",
    margin: 0,
  },

  heading: {
    color: "#ffffff",
    fontSize: "40px",
    fontWeight: "900",
    margin: "8px 0",
    letterSpacing: "-1px",
  },

  description: {
    color: "#888",
    lineHeight: 1.6,
    maxWidth: "700px",
    margin: 0,
    fontSize: "15px",
  },

  message: {
    color: "#888",
    padding: "40px 0",
  },

  error: {
    background: "#3a1118",
    border: "1px solid #7f1d1d",
    color: "#ffb4b4",
    padding: "20px",
    borderRadius: "10px",
  },

  empty: {
    marginTop: "30px",
    padding: "60px 20px",
    textAlign: "center",
    background: "#111111",
    border: "1px solid #292929",
    borderRadius: "14px",
    color: "#888",
  },

  icon: {
    fontSize: "18px",
    fontWeight: "900",
    letterSpacing: "2px",
    color: "#ffc107",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(250px, 1fr))",
    gap: "28px",
    width: "100%",
    alignItems: "start",
  },

  card: {
    minWidth: 0,
    width: "100%",
    background:
      "linear-gradient(145deg, #151515, #0d0d0d)",
    border: "1px solid #2a2a2a",
    borderRadius: "14px",
    overflow: "hidden",
    transition:
      "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
    cursor: "pointer",
    boxSizing: "border-box",
  },

  artworkWrapper: {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    minHeight: "250px",
    background: "#0b0b0b",
    overflow: "hidden",
  },

  cover: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  noCover: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, #151515, #080808)",
    fontSize: "18px",
    fontWeight: "900",
    letterSpacing: "2px",
    color: "#ffc107",
  },

  newBadge: {
    position: "absolute",
    top: "14px",
    left: "14px",
    padding: "6px 11px",
    borderRadius: "5px",
    background:
      "linear-gradient(135deg, #fff0a8, #ffc107, #b8860b)",
    color: "#080808",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1px",
    boxShadow:
      "0 5px 18px rgba(0,0,0,0.35)",
  },

  playButton: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform:
      "translate(-50%, -50%)",
    minWidth: "90px",
    height: "50px",
    padding: "0 18px",
    borderRadius: "25px",
    border: "2px solid #ffffff",
    background:
      "linear-gradient(135deg, #fff0a8, #ffc107, #b8860b)",
    color: "#080808",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "900",
    letterSpacing: "1px",
    cursor: "pointer",
    boxShadow:
      "0 8px 30px rgba(0,0,0,0.55)",
  },

  content: {
    padding: "19px 18px 20px",
  },

  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: "19px",
    fontWeight: "800",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  heartButton: {
    flexShrink: 0,
    border: "1px solid #3b3b3b",
    background: "#181818",
    color: "#ffc107",
    fontSize: "9px",
    fontWeight: "900",
    letterSpacing: "0.5px",
    cursor: "pointer",
    padding: "6px 8px",
    borderRadius: "5px",
  },

  producerButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    margin: "9px 0 6px",
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#dddddd",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "700",
  },

  cardProducerAvatar: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid #ffc107",
    flexShrink: 0,
  },

  cardProducerAvatarFallback: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "#222222",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "7px",
    fontWeight: "900",
    letterSpacing: "0.3px",
    flexShrink: 0,
    border: "1px solid #444444",
    color: "#ffc107",
  },

  producerButtonText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  genre: {
    margin: 0,
    color: "#ffc107",
    fontSize: "12px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },

  details: {
    display: "flex",
    gap: "5px",
    marginTop: "9px",
    color: "#888",
    fontSize: "13px",
  },

  cardActions: {
    display: "flex",
    gap: "8px",
    marginTop: "16px",
    alignItems: "stretch",
  },

  downloadButton: {
    display: "block",
    flex: 1,
    padding: "11px 8px",
    background:
      "linear-gradient(145deg, #191919, #101010)",
    border: "1px solid #3b3b3b",
    color: "#ffc107",
    textDecoration: "none",
    textAlign: "center",
    borderRadius: "7px",
    fontSize: "11px",
    fontWeight: "900",
    letterSpacing: "0.7px",
    boxSizing: "border-box",
    cursor: "pointer",
  },

  cardShareButton: {
    flex: 1,
    padding: "11px 8px",
    background: "#ffc107",
    border: "1px solid #ffc107",
    color: "#080808",
    textAlign: "center",
    borderRadius: "7px",
    fontSize: "11px",
    fontWeight: "900",
    letterSpacing: "0.7px",
    cursor: "pointer",
  },

  detailSection: {
    width: "100%",
    maxWidth: "1300px",
    margin: "0 auto",
    padding: "50px 40px 80px",
    boxSizing: "border-box",
  },

  detailSectionMobile: {
    padding: "25px 16px 50px",
  },

  backButton: {
    border: "1px solid #333",
    background: "#111111",
    color: "#ffffff",
    padding: "11px 18px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "1px",
    marginBottom: "30px",
  },

  detailContainer: {
    display: "grid",
    gridTemplateColumns:
      "minmax(350px, 560px) minmax(0, 1fr)",
    gap: "55px",
    alignItems: "start",
  },

  detailContainerMobile: {
    gridTemplateColumns:
      "minmax(0, 1fr)",
    gap: "24px",
    width: "100%",
    minWidth: 0,
  },

  detailArtwork: {
    width: "100%",
    aspectRatio: "1 / 1",
    background: "#0b0b0b",
    borderRadius: "14px",
    overflow: "hidden",
    border: "1px solid #292929",
  },

  detailArtworkMobile: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },

  detailCover: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  detailNoCover: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    fontWeight: "900",
    letterSpacing: "2px",
    color: "#ffc107",
    background:
      "linear-gradient(135deg, #151515, #080808)",
  },

  detailInfo: {
    paddingTop: "10px",
    minWidth: 0,
  },

  detailInfoMobile: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
    paddingTop: "0",
  },

  detailSmallTitle: {
    color: "#ffc107",
    letterSpacing: "3px",
    fontSize: "11px",
    fontWeight: "900",
    margin: "0 0 12px",
  },

  detailTitle: {
    color: "#ffffff",
    fontSize: "46px",
    lineHeight: 1.05,
    margin: "0 0 15px",
    fontWeight: "900",
  },

  detailTitleMobile: {
    fontSize: "30px",
    lineHeight: 1.1,
    overflowWrap: "anywhere",
  },

  detailProducer: {
    color: "#999",
    fontSize: "15px",
    marginBottom: "22px",
  },

  detailTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "30px",
  },

  detailTag: {
    padding: "8px 12px",
    border: "1px solid #333",
    borderRadius: "5px",
    color: "#ffc107",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
  },

  detailPlayer: {
    background: "#111111",
    border: "1px solid #292929",
    borderRadius: "10px",
    padding: "18px",
    marginBottom: "25px",
    minWidth: 0,
    boxSizing: "border-box",
  },

  playerLabel: {
    margin: "0 0 12px",
    color: "#777",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "2px",
  },

  largeAudio: {
    width: "100%",
    maxWidth: "100%",
    display: "block",
  },

  interactionBox: {
    background: "#111111",
    border: "1px solid #292929",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "25px",
    minWidth: 0,
    boxSizing: "border-box",
  },

  voteGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },

  voteGroupMobile: {
    flexDirection: "column",
    width: "100%",
  },

  likeButton: {
    flex: 1,
    minWidth: "120px",
    padding: "13px 14px",
    border: "1px solid #3b3b3b",
    background: "#181818",
    color: "#ffffff",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "900",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  dislikeButton: {
    flex: 1,
    minWidth: "120px",
    padding: "13px 14px",
    border: "1px solid #3b3b3b",
    background: "#181818",
    color: "#ffffff",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "900",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  saveButton: {
    flex: 1,
    minWidth: "120px",
    padding: "13px 14px",
    border: "1px solid #ffc107",
    background: "#ffc107",
    color: "#080808",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "900",
  },

  savedButton: {
    flex: 1,
    minWidth: "120px",
    padding: "13px 14px",
    border: "1px solid #ffc107",
    background: "#181818",
    color: "#ffc107",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "900",
  },

  descriptionBox: {
    borderTop: "1px solid #292929",
    paddingTop: "22px",
    marginTop: "20px",
    marginBottom: "25px",
    color: "#bbb",
    lineHeight: 1.7,
    overflowWrap: "anywhere",
  },

  producerDetailBox: {
    background: "#111111",
    border: "1px solid #292929",
    borderRadius: "12px",
    padding: "20px",
    marginTop: "25px",
    marginBottom: "25px",
    minWidth: 0,
    boxSizing: "border-box",
  },

  producerDetailHeader: {
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
  },

  producerDetailHeaderMobile: {
    alignItems: "flex-start",
  },

  producerDetailAvatar: {
    width: "70px",
    height: "70px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid #ffc107",
    flexShrink: 0,
  },

  producerDetailAvatarFallback: {
    width: "70px",
    height: "70px",
    borderRadius: "50%",
    background: "#222",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "900",
    color: "#ffc107",
    letterSpacing: "1px",
    flexShrink: 0,
  },

  producerDetailName: {
    margin: "2px 0 7px",
    color: "#ffffff",
    fontSize: "21px",
    fontWeight: "900",
    overflowWrap: "anywhere",
  },

  producerDetailBio: {
    margin: 0,
    color: "#999",
    fontSize: "13px",
    lineHeight: 1.6,
    overflowWrap: "anywhere",
  },

  contactBox: {
    marginTop: "18px",
    padding: "14px",
    border:
      "1px solid rgba(255, 193, 7, 0.25)",
    background:
      "rgba(255, 193, 7, 0.045)",
    borderRadius: "8px",
    color: "#ddd",
    overflowWrap: "anywhere",
    boxSizing: "border-box",
  },

  contactButton: {
    padding: "12px 16px",
    border: "1px solid #ffc107",
    background: "#ffc107",
    color: "#080808",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "900",
    cursor: "pointer",
  },

  profileButton: {
    padding: "12px 16px",
    border: "1px solid #444",
    background: "#181818",
    color: "#ffffff",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "900",
    cursor: "pointer",
  },

  producerActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "16px",
  },

  producerActionsMobile: {
    flexDirection: "column",
  },

  noContact: {
    color: "#777",
    fontSize: "13px",
    marginTop: "16px",
  },

  catalogHint: {
    color: "#777",
    fontSize: "12px",
    marginTop: "18px",
  },

  commentsBox: {
    background: "#111111",
    border: "1px solid #292929",
    borderRadius: "12px",
    padding: "20px",
    marginTop: "25px",
    marginBottom: "25px",
    minWidth: 0,
    boxSizing: "border-box",
  },

  commentsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
  },

  commentsTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: "22px",
    fontWeight: "900",
  },

  commentCount: {
    minWidth: "34px",
    height: "34px",
    padding: "0 10px",
    borderRadius: "50%",
    background: "#ffc107",
    color: "#080808",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "900",
    boxSizing: "border-box",
  },

  commentForm: {
    marginBottom: "25px",
    minWidth: 0,
  },

  commentInput: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    background: "#0b0b0b",
    border: "1px solid #333",
    borderRadius: "8px",
    color: "#ffffff",
    padding: "13px",
    fontSize: "13px",
    lineHeight: 1.6,
    outline: "none",
  },

  commentFormFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
  },

  commentFormFooterMobile: {
    alignItems: "stretch",
    flexDirection: "column",
  },

  characterCount: {
    color: "#666",
    fontSize: "11px",
  },

  commentButton: {
    padding: "11px 18px",
    background: "#ffc107",
    border: "1px solid #ffc107",
    color: "#080808",
    borderRadius: "7px",
    fontSize: "11px",
    fontWeight: "900",
    cursor: "pointer",
  },

  signInNotice: {
    padding: "14px",
    background: "#181818",
    border: "1px solid #333",
    borderRadius: "8px",
    color: "#999",
    fontSize: "13px",
    marginBottom: "20px",
  },

  commentsMessage: {
    color: "#777",
    fontSize: "13px",
  },

  noComments: {
    textAlign: "center",
    padding: "25px 10px",
    color: "#777",
  },

  commentList: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },

  commentItem: {
    display: "flex",
    gap: "12px",
    padding: "14px",
    background: "#0b0b0b",
    border: "1px solid #252525",
    borderRadius: "9px",
    minWidth: 0,
    boxSizing: "border-box",
  },

  commentAvatar: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    background: "#222",
    color: "#ffc107",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "8px",
    fontWeight: "900",
    flexShrink: 0,
  },

  commentContent: {
    flex: 1,
    minWidth: 0,
  },

  commentMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
    marginBottom: "6px",
  },

  commentText: {
    margin: 0,
    color: "#cccccc",
    fontSize: "13px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },

  deleteCommentButton: {
    marginTop: "8px",
    border: "none",
    background: "transparent",
    color: "#777",
    padding: 0,
    fontSize: "9px",
    fontWeight: "900",
    cursor: "pointer",
  },

  detailActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
    marginTop: "10px",
  },

  detailActionsMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },

  detailDownload: {
    display: "inline-block",
    padding: "14px 22px",
    background: "#ffc107",
    color: "#080808",
    border: "1px solid #ffc107",
    borderRadius: "7px",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "0.8px",
    textAlign: "center",
    boxSizing: "border-box",
    cursor: "pointer",
  },

  shareButton: {
    display: "inline-block",
    padding: "14px 22px",
    background: "#181818",
    color: "#ffc107",
    border: "1px solid #ffc107",
    borderRadius: "7px",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "0.8px",
    cursor: "pointer",
  },

  producerProfile: {
    width: "100%",
  },

  profileHeader: {
    display: "flex",
    gap: "30px",
    alignItems: "flex-start",
    padding: "30px",
    background: "#111111",
    border: "1px solid #292929",
    borderRadius: "14px",
    marginBottom: "50px",
  },

  profileHeaderMobile: {
    flexDirection: "column",
    padding: "20px",
    gap: "20px",
    marginBottom: "35px",
  },

  profileAvatarWrapper: {
    flexShrink: 0,
  },

  profileAvatar: {
    width: "150px",
    height: "150px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #ffc107",
  },

  profileAvatarFallback: {
    width: "150px",
    height: "150px",
    borderRadius: "50%",
    background: "#222",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "15px",
    fontWeight: "900",
    letterSpacing: "2px",
    color: "#ffc107",
    border: "3px solid #ffc107",
  },

  profileInfo: {
    flex: 1,
    minWidth: 0,
  },

  profileName: {
    color: "#ffffff",
    fontSize: "42px",
    margin: "5px 0 15px",
    fontWeight: "900",
    overflowWrap: "anywhere",
  },

  profileBio: {
    color: "#aaa",
    lineHeight: 1.7,
    maxWidth: "750px",
    margin: 0,
    overflowWrap: "anywhere",
  },

  producerBeatsHeader: {
    marginBottom: "30px",
  },
};

export default LatestBeats;