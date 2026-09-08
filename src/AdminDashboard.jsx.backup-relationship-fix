import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function AdminDashboard({ onNavigate }) {
  const [beats, setBeats] = useState([]);
  const [drumPacks, setDrumPacks] = useState([]);
  const [contactMessages, setContactMessages] = useState([]);
  const [producers, setProducers] = useState([]);
  const [appeals, setAppeals] = useState([]);

  const [selectedProducer, setSelectedProducer] =
    useState(null);

  const [selectedProducerBeats, setSelectedProducerBeats] =
    useState([]);

  const [
    selectedProducerDrumPacks,
    setSelectedProducerDrumPacks,
  ] = useState([]);

  const [
    selectedProducerFollowers,
    setSelectedProducerFollowers,
  ] = useState(0);

  const [loadingProducer, setLoadingProducer] =
    useState(false);

  const [stats, setStats] = useState({
    beats: 0,
    drumPacks: 0,
    producers: 0,
    likes: 0,
    comments: 0,
    contactMessages: 0,
    pendingAppeals: 0,
  });

  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [deletingDrumPackId, setDeletingDrumPackId] =
    useState("");
  const [deletingContactId, setDeletingContactId] =
    useState("");
  const [markingContactId, setMarkingContactId] =
    useState("");
  const [processingAppealId, setProcessingAppealId] =
    useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAdminData() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You must be signed in as an administrator."
        );
      }

      const {
        data: adminProfile,
        error: adminError,
      } = await supabase
        .from("producers")
        .select("id, display_name, role")
        .eq("id", user.id)
        .single();

      if (adminError) {
        throw adminError;
      }

      if (adminProfile.role !== "admin") {
        throw new Error(
          "Access denied. Administrator privileges are required."
        );
      }

      const [
        beatsResult,
        drumPacksResult,
        producersResult,
        likesResult,
        commentsResult,
        contactMessagesResult,
        appealsResult,
      ] = await Promise.all([
        supabase
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
            removal_reason,
            removed_at,
            removed_by,
            producers (
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
          }),

        supabase
          .from("drum_packs")
          .select(`
            id,
            producer_id,
            name,
            genre,
            description,
            zip_url,
            cover_url,
            downloads,
            created_at,
            producers (
              id,
              display_name,
              bio,
              avatar_url,
              contact_info
            )
          `)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("producers")
          .select(`
            id,
            display_name,
            bio,
            avatar_url,
            contact_info,
            role
          `)
          .order("display_name", {
            ascending: true,
          }),

        supabase
          .from("beats")
          .select("likes")
          .eq("is_removed", false),

        supabase
          .from("comments")
          .select("id", {
            count: "exact",
            head: true,
          }),

        supabase
          .from("contact_messages")
          .select(
            "id, name, email, subject, message, created_at, is_read"
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("beat_appeals")
          .select(`
            id,
            beat_id,
            producer_id,
            reason,
            message,
            status,
            admin_response,
            created_at,
            resolved_at
          `)
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (beatsResult.error) {
        throw beatsResult.error;
      }

      if (drumPacksResult.error) {
        throw drumPacksResult.error;
      }

      if (producersResult.error) {
        throw producersResult.error;
      }

      if (likesResult.error) {
        throw likesResult.error;
      }

      if (commentsResult.error) {
        throw commentsResult.error;
      }

      if (contactMessagesResult.error) {
        throw contactMessagesResult.error;
      }

      if (appealsResult.error) {
        throw appealsResult.error;
      }

      /*
       * IMPORTANT:
       * Removed beats are not included in the public/admin
       * active beat list above.
       *
       * Therefore, appeals must load their beats separately.
       */
      const appealRows = appealsResult.data || [];

      const appealBeatIds = [
        ...new Set(
          appealRows
            .map((appeal) => appeal.beat_id)
            .filter(Boolean)
        ),
      ];

      const appealProducerIds = [
        ...new Set(
          appealRows
            .map((appeal) => appeal.producer_id)
            .filter(Boolean)
        ),
      ];

      const [
        appealBeatsResult,
        appealProducersResult,
      ] = await Promise.all([
        appealBeatIds.length
          ? supabase
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
                removal_reason,
                removed_at,
                removed_by
              `)
              .in("id", appealBeatIds)
          : Promise.resolve({
              data: [],
              error: null,
            }),

        appealProducerIds.length
          ? supabase
              .from("producers")
              .select(`
                id,
                display_name,
                bio,
                avatar_url,
                contact_info,
                role
              `)
              .in("id", appealProducerIds)
          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

      if (appealBeatsResult.error) {
        throw appealBeatsResult.error;
      }

      if (appealProducersResult.error) {
        throw appealProducersResult.error;
      }

      const beatMap = Object.fromEntries(
        (appealBeatsResult.data || []).map(
          (beat) => [beat.id, beat]
        )
      );

      const producerMap = Object.fromEntries(
        (appealProducersResult.data || []).map(
          (producer) => [producer.id, producer]
        )
      );

      const enrichedAppeals =
        appealRows.map((appeal) => ({
          ...appeal,
          beat:
            beatMap[appeal.beat_id] ||
            null,
          producer:
            producerMap[appeal.producer_id] ||
            null,
        }));

      const totalLikes = (
        likesResult.data || []
      ).reduce(
        (total, beat) =>
          total + Number(beat.likes || 0),
        0
      );

      const messages =
        contactMessagesResult.data || [];

      const allProducerData =
        producersResult.data || [];

      const producerData =
        allProducerData.filter(
          (producer) =>
            producer.role !== "admin"
        );

      setBeats(beatsResult.data || []);
      setDrumPacks(
        drumPacksResult.data || []
      );
      setProducers(producerData);
      setContactMessages(messages);
      setAppeals(enrichedAppeals);

      setStats({
        beats:
          beatsResult.data?.length || 0,
        drumPacks:
          drumPacksResult.data?.length || 0,
        producers:
          producerData.length || 0,
        likes: totalLikes,
        comments:
          commentsResult.count || 0,
        contactMessages:
          messages.length,
        pendingAppeals:
          enrichedAppeals.filter(
            (appeal) =>
              appeal.status === "pending"
          ).length,
      });
    } catch (err) {
      console.error(
        "Admin dashboard loading error:",
        err
      );

      setError(
        err.message ||
          "Unable to load the Admin Dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initializeAdminDashboard() {
      if (cancelled) {
        return;
      }

      await loadAdminData();
    }

    initializeAdminDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  function getGenreName(beat) {
    return (
      beat?.other_genre ||
      beat?.genre ||
      "Unknown Genre"
    );
  }

  function getDate(createdAt) {
    if (!createdAt) {
      return "Unknown date";
    }

    return new Date(
      createdAt
    ).toLocaleDateString();
  }

  function getDateTime(createdAt) {
    if (!createdAt) {
      return "Unknown date";
    }

    return new Date(
      createdAt
    ).toLocaleString();
  }

  function getStoragePathFromPublicUrl(
    url,
    bucket
  ) {
    if (!url) {
      return null;
    }

    const marker =
      `/storage/v1/object/public/${bucket}/`;

    if (!url.includes(marker)) {
      return null;
    }

    return decodeURIComponent(
      url.split(marker)[1]
    );
  }

  async function deleteStorageFile(
    bucket,
    url
  ) {
    const path =
      getStoragePathFromPublicUrl(
        url,
        bucket
      );

    if (!path) {
      return;
    }

    const {
      error: storageError,
    } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (storageError) {
      throw storageError;
    }
  }

  /*
   * OPEN INTERNAL MESSAGES
   */
  function handleOpenMessages() {
    if (onNavigate) {
      onNavigate("messages");
    }
  }

  /*
   * LOAD COMPLETE PRODUCER DETAILS
   */
  async function handleSelectProducer(
    producer
  ) {
    setSelectedProducer(producer);
    setSelectedProducerBeats([]);
    setSelectedProducerDrumPacks([]);
    setSelectedProducerFollowers(0);
    setLoadingProducer(true);
    setError("");
    setMessage("");

    try {
      const [
        producerBeatsResult,
        producerDrumPacksResult,
        followersResult,
      ] = await Promise.all([
        supabase
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
            removal_reason,
            removed_at,
            removed_by
          `)
          .eq(
            "producer_id",
            producer.id
          )
          .eq("is_removed", false)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("drum_packs")
          .select(`
            id,
            producer_id,
            name,
            genre,
            description,
            zip_url,
            cover_url,
            downloads,
            created_at
          `)
          .eq(
            "producer_id",
            producer.id
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("producer_follows")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "producer_id",
            producer.id
          ),
      ]);

      if (producerBeatsResult.error) {
        throw producerBeatsResult.error;
      }

      if (producerDrumPacksResult.error) {
        throw producerDrumPacksResult.error;
      }

      if (followersResult.error) {
        throw followersResult.error;
      }

      setSelectedProducerBeats(
        producerBeatsResult.data || []
      );

      setSelectedProducerDrumPacks(
        producerDrumPacksResult.data || []
      );

      setSelectedProducerFollowers(
        followersResult.count || 0
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load producer information."
      );
    } finally {
      setLoadingProducer(false);
    }
  }

  function handleBackToProducers() {
    setSelectedProducer(null);
    setSelectedProducerBeats([]);
    setSelectedProducerDrumPacks([]);
    setSelectedProducerFollowers(0);
    setError("");
    setMessage("");
  }

  /*
   * REMOVE BEAT
   *
   * SOFT REMOVE:
   * The beat remains in the database.
   * The producer can appeal the decision.
   */
  async function handleDeleteBeat(beat) {
    const reason = window.prompt(
      `Why are you removing "${beat.title}"?\n\nEnter the reason that will be sent to the producer.`
    );

    if (reason === null) {
      return;
    }

    const trimmedReason =
      reason.trim();

    if (!trimmedReason) {
      window.alert(
        "A removal reason is required."
      );
      return;
    }

    const confirmed = window.confirm(
      `Remove "${beat.title}" from the marketplace?\n\nReason:\n${trimmedReason}\n\nThe beat will be hidden from the marketplace but kept safely in the database so the producer can appeal the decision.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(beat.id);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "Administrator session could not be verified."
        );
      }

      const removalTime =
        new Date().toISOString();

      const {
        error: updateError,
      } = await supabase
        .from("beats")
        .update({
          is_removed: true,
          removal_reason:
            trimmedReason,
          removed_at:
            removalTime,
          removed_by: user.id,
        })
        .eq("id", beat.id);

      if (updateError) {
        throw updateError;
      }

      let notificationCreated =
        false;

      if (beat.producer_id) {
        const {
          error: notificationError,
        } = await supabase
          .from("notifications")
          .insert({
            user_id:
              beat.producer_id,
            type: "beat_removed",
            title: "Beat Removed",
            message:
              `Your beat "${beat.title}" has been removed from the marketplace. Reason: ${trimmedReason}`,
            beat_id: beat.id,
            producer_id:
              beat.producer_id,
            is_read: false,
            metadata: {
              beat_title:
                beat.title,
              removal_reason:
                trimmedReason,
              removed_by:
                user.id,
              removed_at:
                removalTime,
              appeal_available:
                true,
            },
          });

        if (notificationError) {
          console.error(
            "Notification creation error:",
            notificationError
          );
        } else {
          notificationCreated =
            true;
        }
      }

      setBeats((currentBeats) =>
        currentBeats.filter(
          (item) =>
            item.id !== beat.id
        )
      );

      setSelectedProducerBeats(
        (currentBeats) =>
          currentBeats.filter(
            (item) =>
              item.id !== beat.id
          )
      );

      setStats((currentStats) => ({
        ...currentStats,
        beats: Math.max(
          0,
          currentStats.beats - 1
        ),
        likes: Math.max(
          0,
          currentStats.likes -
            Number(beat.likes || 0)
        ),
      }));

      if (notificationCreated) {
        setMessage(
          `"${beat.title}" was removed from the marketplace and the producer was notified.`
        );
      } else {
        setMessage(
          `"${beat.title}" was removed from the marketplace, but the producer notification could not be created.`
        );
      }
    } catch (err) {
      console.error(
        "Beat removal error:",
        err
      );

      setError(
        err.message ||
          "Unable to remove the beat."
      );
    } finally {
      setDeletingId("");
    }
  }

  /*
   * APPEAL REVIEW
   *
   * APPROVED:
   * - Restores beat
   * - Clears removal information
   * - Approves appeal
   * - Notifies producer
   *
   * REJECTED:
   * - Beat remains removed
   * - Rejects appeal
   * - Notifies producer
   */
  async function handleReviewAppeal(
    appeal,
    decision
  ) {
    if (
      !appeal?.id ||
      appeal.status !== "pending"
    ) {
      return;
    }

    const isGrant =
      decision === "approved";

    const beatTitle =
      appeal.beat?.title ||
      "this beat";

    const response = window.prompt(
      isGrant
        ? `GRANT APPEAL\n\nRestore "${beatTitle}" to the marketplace?\n\nEnter an optional response to the producer.`
        : `DENY APPEAL\n\nEnter the reason for denying the appeal.`
    );

    if (response === null) {
      return;
    }

    const trimmedResponse =
      response.trim();

    if (
      !isGrant &&
      !trimmedResponse
    ) {
      window.alert(
        "A reason is required when denying an appeal."
      );
      return;
    }

    const confirmed = window.confirm(
      isGrant
        ? `GRANT APPEAL?\n\n"${beatTitle}" will immediately be restored to the marketplace and the producer will be notified.`
        : `DENY APPEAL?\n\n"${beatTitle}" will remain removed from the marketplace and the producer will be notified.`
    );

    if (!confirmed) {
      return;
    }

    setProcessingAppealId(
      appeal.id
    );
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "Administrator session could not be verified."
        );
      }

      const resolvedAt =
        new Date().toISOString();

      let restoredBeat = null;

      /*
       * RESTORE BEAT
       */
      if (isGrant) {
        const {
          data: restoredBeatData,
          error: restoreError,
        } = await supabase
          .from("beats")
          .update({
            is_removed: false,
            removal_reason: null,
            removed_at: null,
            removed_by: null,
          })
          .eq(
            "id",
            appeal.beat_id
          )
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
            removal_reason,
            removed_at,
            removed_by
          `)
          .maybeSingle();

        if (restoreError) {
          throw restoreError;
        }

        if (!restoredBeatData) {
          throw new Error(
            "The beat could not be found or restored."
          );
        }

        restoredBeat =
          restoredBeatData;
      }

      /*
       * UPDATE APPEAL
       */
      const {
        error: appealUpdateError,
      } = await supabase
        .from("beat_appeals")
        .update({
          status: decision,
          admin_response:
            trimmedResponse ||
            null,
          resolved_at:
            resolvedAt,
        })
        .eq(
          "id",
          appeal.id
        )
        .eq(
          "status",
          "pending"
        );

      if (appealUpdateError) {
        /*
         * If restoring the beat succeeded but
         * the appeal update failed, put the beat
         * back into its removed state.
         */
        if (
          isGrant &&
          restoredBeat
        ) {
          await supabase
            .from("beats")
            .update({
              is_removed: true,
              removal_reason:
                appeal.beat
                  ?.removal_reason ||
                appeal.reason ||
                null,
              removed_at:
                appeal.beat
                  ?.removed_at ||
                null,
              removed_by:
                appeal.beat
                  ?.removed_by ||
                null,
            })
            .eq(
              "id",
              appeal.beat_id
            );
        }

        throw appealUpdateError;
      }

      /*
       * PRODUCER NOTIFICATION
       */
      let notificationCreated =
        false;

      const producerId =
        appeal.producer_id ||
        restoredBeat?.producer_id ||
        appeal.beat?.producer_id;

      const finalBeatTitle =
        restoredBeat?.title ||
        appeal.beat?.title ||
        "your beat";

      if (producerId) {
        const notificationType =
          isGrant
            ? "beat_restored"
            : "appeal_rejected";

        const notificationTitle =
          isGrant
            ? "Beat Restored"
            : "Appeal Rejected";

        const notificationMessage =
          isGrant
            ? `Your appeal for "${finalBeatTitle}" was approved. Your beat has been restored to the marketplace.`
            : `Your appeal for "${finalBeatTitle}" was rejected. The beat remains removed from the marketplace.`;

        const {
          error: notificationError,
        } = await supabase
          .from("notifications")
          .insert({
            user_id:
              producerId,
            type:
              notificationType,
            title:
              notificationTitle,
            message:
              notificationMessage,
            beat_id:
              appeal.beat_id,
            producer_id:
              producerId,
            is_read: false,
            metadata: {
              appeal_id:
                appeal.id,
              beat_id:
                appeal.beat_id,
              beat_title:
                finalBeatTitle,
              producer_id:
                producerId,
              sender_id:
                user.id,
              status:
                decision,
              admin_response:
                trimmedResponse ||
                null,
              resolved_at:
                resolvedAt,
              resolved_by:
                user.id,
            },
          });

        if (notificationError) {
          console.error(
            "Appeal notification error:",
            notificationError
          );
        } else {
          notificationCreated =
            true;
        }
      }

      /*
       * UPDATE LOCAL APPEAL STATE
       */
      setAppeals(
        (currentAppeals) =>
          currentAppeals.map(
            (item) =>
              item.id === appeal.id
                ? {
                    ...item,
                    status:
                      decision,
                    admin_response:
                      trimmedResponse ||
                      null,
                    resolved_at:
                      resolvedAt,
                    beat:
                      restoredBeat ||
                      item.beat,
                  }
                : item
          )
      );

      /*
       * IF GRANTED, ADD THE BEAT BACK
       */
      if (
        isGrant &&
        restoredBeat
      ) {
        setBeats(
          (currentBeats) => {
            const exists =
              currentBeats.some(
                (item) =>
                  item.id ===
                  restoredBeat.id
              );

            if (exists) {
              return currentBeats;
            }

            return [
              restoredBeat,
              ...currentBeats,
            ];
          }
        );

        setStats(
          (currentStats) => ({
            ...currentStats,
            beats:
              currentStats.beats +
              1,
            likes:
              currentStats.likes +
              Number(
                restoredBeat.likes ||
                  0
              ),
          })
        );

        if (
          selectedProducer?.id ===
          restoredBeat.producer_id
        ) {
          setSelectedProducerBeats(
            (currentBeats) => {
              const exists =
                currentBeats.some(
                  (item) =>
                    item.id ===
                    restoredBeat.id
                );

              if (exists) {
                return currentBeats;
              }

              return [
                restoredBeat,
                ...currentBeats,
              ];
            }
          );
        }
      }

      /*
       * REDUCE PENDING APPEALS
       */
      setStats(
        (currentStats) => ({
          ...currentStats,
          pendingAppeals:
            Math.max(
              0,
              currentStats.pendingAppeals -
                1
            ),
        })
      );

      if (notificationCreated) {
        setMessage(
          isGrant
            ? `Appeal granted. "${finalBeatTitle}" has been restored and the producer was notified.`
            : `Appeal rejected. "${finalBeatTitle}" remains removed and the producer was notified.`
        );
      } else {
        setMessage(
          isGrant
            ? `Appeal granted. "${finalBeatTitle}" has been restored, but the producer notification could not be created.`
            : `Appeal rejected. "${finalBeatTitle}" remains removed, but the producer notification could not be created.`
        );
      }
    } catch (err) {
      console.error(
        "Appeal review error:",
        err
      );

      setError(
        err.message ||
          "Unable to process the appeal."
      );
    } finally {
      setProcessingAppealId("");
    }
  }

  /*
   * DELETE DRUM PACK
   */
  async function handleDeleteDrumPack(
    pack
  ) {
    const confirmed =
      window.confirm(
        `Delete "${pack.name}"?\n\nThis will permanently remove the free drum pack from the marketplace and delete its ZIP file and cover artwork.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingDrumPackId(
      pack.id
    );
    setError("");
    setMessage("");

    try {
      await deleteStorageFile(
        "drum-packs",
        pack.zip_url
      );

      await deleteStorageFile(
        "covers",
        pack.cover_url
      );

      const {
        error: deleteError,
      } = await supabase
        .from("drum_packs")
        .delete()
        .eq("id", pack.id);

      if (deleteError) {
        throw deleteError;
      }

      setDrumPacks(
        (currentPacks) =>
          currentPacks.filter(
            (item) =>
              item.id !== pack.id
          )
      );

      setSelectedProducerDrumPacks(
        (currentPacks) =>
          currentPacks.filter(
            (item) =>
              item.id !== pack.id
          )
      );

      setStats(
        (currentStats) => ({
          ...currentStats,
          drumPacks:
            Math.max(
              0,
              currentStats.drumPacks -
                1
            ),
        })
      );

      setMessage(
        `"${pack.name}" was successfully removed from the free Drum Packs section.`
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete the drum pack."
      );
    } finally {
      setDeletingDrumPackId("");
    }
  }

  /*
   * CONTACT MESSAGE
   */
  async function handleMarkContactRead(
    contact
  ) {
    setMarkingContactId(
      contact.id
    );
    setError("");
    setMessage("");

    try {
      const {
        error: updateError,
      } = await supabase
        .from("contact_messages")
        .update({
          is_read: true,
        })
        .eq(
          "id",
          contact.id
        );

      if (updateError) {
        throw updateError;
      }

      setContactMessages(
        (currentMessages) =>
          currentMessages.map(
            (item) =>
              item.id === contact.id
                ? {
                    ...item,
                    is_read: true,
                  }
                : item
          )
      );

      setMessage(
        "Message marked as read."
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to mark the message as read."
      );
    } finally {
      setMarkingContactId("");
    }
  }

  async function handleDeleteContact(
    contact
  ) {
    const confirmed =
      window.confirm(
        `Delete this message from ${contact.name}?\n\nThis will permanently remove the message from your contact inbox.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingContactId(
      contact.id
    );
    setError("");
    setMessage("");

    try {
      const {
        error: deleteError,
      } = await supabase
        .from("contact_messages")
        .delete()
        .eq(
          "id",
          contact.id
        );

      if (deleteError) {
        throw deleteError;
      }

      setContactMessages(
        (currentMessages) =>
          currentMessages.filter(
            (item) =>
              item.id !== contact.id
          )
      );

      setStats(
        (currentStats) => ({
          ...currentStats,
          contactMessages:
            Math.max(
              0,
              currentStats.contactMessages -
                1
            ),
        })
      );

      setMessage(
        "Contact message was deleted successfully."
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete the contact message."
      );
    } finally {
      setDeletingContactId("");
    }
  }

  function handleBack() {
    if (onNavigate) {
      onNavigate("home");
    }
  }

  /*
   * PRODUCER DETAIL VIEW
   */
  if (selectedProducer) {
    const producerLikes =
      selectedProducerBeats.reduce(
        (total, beat) =>
          total +
          Number(beat.likes || 0),
        0
      );

    const producerDislikes =
      selectedProducerBeats.reduce(
        (total, beat) =>
          total +
          Number(
            beat.dislikes || 0
          ),
        0
      );

    if (loadingProducer) {
      return (
        <main className="page-container">
          <section className="dashboard-section">
            <button
              type="button"
              className="secondary-button"
              onClick={
                handleBackToProducers
              }
            >
              ← Back to Producers
            </button>

            <div className="dashboard-header">
              <div>
                <p className="eyebrow">
                  PRODUCER DIRECTORY
                </p>

                <h1>
                  {selectedProducer.display_name ||
                    "Producer"}
                </h1>

                <p>
                  Loading producer information...
                </p>
              </div>
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className="page-container">
        <section className="dashboard-section">
          <button
            type="button"
            className="secondary-button"
            onClick={
              handleBackToProducers
            }
            style={{
              marginBottom: "24px",
            }}
          >
            ← Back to Producers
          </button>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {message && (
            <div className="success-message">
              {message}
            </div>
          )}

          <div
            className="dashboard-header"
            style={{
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "24px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: "110px",
                  height: "110px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  background:
                    "rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
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
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: "42px",
                    }}
                  >
                    🎧
                  </span>
                )}
              </div>

              <div>
                <p className="eyebrow">
                  PRODUCER PROFILE
                </p>

                <h1>
                  {selectedProducer.display_name ||
                    "Unknown Producer"}
                </h1>

                <p>
                  {selectedProducer.role ||
                    "producer"}
                </p>
              </div>
            </div>
          </div>

          <div
            className="dashboard-stats"
            style={{
              marginTop: "30px",
            }}
          >
            <div className="stat-card">
              <span className="stat-icon">
                🎵
              </span>

              <strong>
                {
                  selectedProducerBeats.length
                }
              </strong>

              <span>Total Beats</span>
            </div>

            <div className="stat-card">
              <span className="stat-icon">
                ❤️
              </span>

              <strong>
                {producerLikes}
              </strong>

              <span>Total Likes</span>
            </div>

            <div className="stat-card">
              <span className="stat-icon">
                👥
              </span>

              <strong>
                {
                  selectedProducerFollowers
                }
              </strong>

              <span>Total Followers</span>
            </div>

            <div className="stat-card">
              <span className="stat-icon">
                👎
              </span>

              <strong>
                {producerDislikes}
              </strong>

              <span>Dislikes</span>
            </div>

            <div className="stat-card">
              <span className="stat-icon">
                🥁
              </span>

              <strong>
                {
                  selectedProducerDrumPacks.length
                }
              </strong>

              <span>Drum Packs</span>
            </div>
          </div>

          <div className="section-heading">
            <div>
              <p className="eyebrow">
                PRODUCER INFORMATION
              </p>

              <h2>About the Producer</h2>
            </div>
          </div>

          <div className="admin-beat-card">
            <div className="admin-beat-content">
              <div className="beat-description">
                <strong>Bio</strong>

                <p>
                  {selectedProducer.bio ||
                    "No producer bio has been provided."}
                </p>
              </div>

              <div className="beat-description">
                <strong>
                  Contact Information
                </strong>

                <p>
                  {selectedProducer.contact_info ||
                    "No contact information has been provided."}
                </p>
              </div>

              <div className="beat-details">
                <span>
                  Producer ID:{" "}
                  {selectedProducer.id}
                </span>
              </div>
            </div>
          </div>

          <div className="section-heading">
            <div>
              <p className="eyebrow">
                PRODUCER CATALOG
              </p>

              <h2>
                Beats by{" "}
                {selectedProducer.display_name ||
                  "Producer"}
              </h2>
            </div>
          </div>

          {selectedProducerBeats.length ===
          0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                🎵
              </div>

              <h3>
                No beats uploaded
              </h3>

              <p>
                This producer has not uploaded
                any beats yet.
              </p>
            </div>
          ) : (
            <div className="admin-beats-list">
              {selectedProducerBeats.map(
                (beat) => (
                  <article
                    key={beat.id}
                    className="admin-beat-card"
                  >
                    <div className="admin-beat-cover">
                      {beat.cover_url ? (
                        <img
                          src={
                            beat.cover_url
                          }
                          alt={`${beat.title} cover`}
                        />
                      ) : (
                        <div className="cover-placeholder">
                          🎵
                        </div>
                      )}
                    </div>

                    <div className="admin-beat-content">
                      <div className="admin-beat-top">
                        <div>
                          <p className="eyebrow">
                            PRODUCER BEAT
                          </p>

                          <h3>
                            {beat.title}
                          </h3>
                        </div>

                        <span className="license-badge">
                          {beat.license_type ||
                            "Free MP3"}
                        </span>
                      </div>

                      <div className="beat-details">
                        <span>
                          Genre:{" "}
                          {getGenreName(
                            beat
                          )}
                        </span>

                        <span>
                          BPM:{" "}
                          {beat.bpm || "—"}
                        </span>

                        <span>
                          Key:{" "}
                          {beat.musical_key ||
                            "—"}
                        </span>

                        <span>
                          Uploaded:{" "}
                          {getDate(
                            beat.created_at
                          )}
                        </span>
                      </div>

                      <p className="beat-description">
                        {beat.description ||
                          "No description provided."}
                      </p>

                      <div className="admin-engagement">
                        <span>
                          ❤️{" "}
                          {beat.likes || 0} likes
                        </span>

                        <span>
                          👎{" "}
                          {beat.dislikes ||
                            0} dislikes
                        </span>
                      </div>

                      {beat.mp3_url && (
                        <audio
                          controls
                          preload="none"
                          src={
                            beat.mp3_url
                          }
                        >
                          Your browser does not
                          support audio playback.
                        </audio>
                      )}

                      <div className="admin-actions">
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() =>
                            handleDeleteBeat(
                              beat
                            )
                          }
                          disabled={
                            deletingId ===
                            beat.id
                          }
                        >
                          {deletingId ===
                          beat.id
                            ? "Removing..."
                            : "🚫 Remove Beat"}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          )}

          <div
            className="section-heading"
            style={{
              marginTop: "60px",
            }}
          >
            <div>
              <p className="eyebrow">
                COMMUNITY RESOURCES
              </p>

              <h2>
                Drum Packs by{" "}
                {selectedProducer.display_name ||
                  "Producer"}
              </h2>
            </div>
          </div>

          {selectedProducerDrumPacks.length ===
          0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                🥁
              </div>

              <h3>
                No drum packs uploaded
              </h3>

              <p>
                This producer has not uploaded
                any drum packs yet.
              </p>
            </div>
          ) : (
            <div className="admin-beats-list">
              {selectedProducerDrumPacks.map(
                (pack) => (
                  <article
                    key={pack.id}
                    className="admin-beat-card"
                  >
                    <div className="admin-beat-cover">
                      {pack.cover_url ? (
                        <img
                          src={
                            pack.cover_url
                          }
                          alt={`${pack.name} cover`}
                        />
                      ) : (
                        <div className="cover-placeholder">
                          🥁
                        </div>
                      )}
                    </div>

                    <div className="admin-beat-content">
                      <div className="admin-beat-top">
                        <div>
                          <p className="eyebrow">
                            FREE DRUM PACK
                          </p>

                          <h3>
                            {pack.name}
                          </h3>
                        </div>

                        <span className="license-badge">
                          FREE
                        </span>
                      </div>

                      <div className="beat-details">
                        <span>
                          Genre:{" "}
                          {pack.genre ||
                            "Unknown Genre"}
                        </span>

                        <span>
                          Downloads:{" "}
                          {Number(
                            pack.downloads ||
                              0
                          )}
                        </span>

                        <span>
                          Format: ZIP
                        </span>

                        <span>
                          Uploaded:{" "}
                          {getDate(
                            pack.created_at
                          )}
                        </span>
                      </div>

                      <p className="beat-description">
                        {pack.description ||
                          "No description provided."}
                      </p>

                      <div className="admin-actions">
                        {pack.zip_url && (
                          <a
                            href={
                              pack.zip_url
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="secondary-button"
                          >
                            ↓ Download ZIP
                          </a>
                        )}

                        <button
                          type="button"
                          className="danger-button"
                          onClick={() =>
                            handleDeleteDrumPack(
                              pack
                            )
                          }
                          disabled={
                            deletingDrumPackId ===
                            pack.id
                          }
                        >
                          {deletingDrumPackId ===
                          pack.id
                            ? "Deleting..."
                            : "🗑️ Delete Drum Pack"}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  /*
   * LOADING
   */
  if (loading) {
    return (
      <main className="page-container">
        <section className="dashboard-section">
          <div className="dashboard-header">
            <div>
              <p className="eyebrow">
                ADMINISTRATION
              </p>

              <h1>
                Admin Dashboard
              </h1>

              <p>
                Loading marketplace information...
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  /*
   * ERROR
   */
  if (
    error &&
    beats.length === 0 &&
    drumPacks.length === 0 &&
    contactMessages.length === 0 &&
    appeals.length === 0
  ) {
    return (
      <main className="page-container">
        <section className="dashboard-section">
          <div className="dashboard-header">
            <div>
              <p className="eyebrow">
                ADMINISTRATION
              </p>

              <h1>
                Admin Dashboard
              </h1>

              <p className="error-message">
                {error}
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={handleBack}
            >
              ← Back
            </button>
          </div>
        </section>
      </main>
    );
  }

  /*
   * MAIN ADMIN DASHBOARD
   */
  return (
    <main className="page-container">
      <section className="dashboard-section">
        <div className="dashboard-header">
          <div>
            <p className="eyebrow">
              ADMINISTRATION
            </p>

            <h1>
              Admin Dashboard
            </h1>

            <p>
              Manage producers, appeals and
              customer messages for the
              Tellem Beat Store.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              className="primary-button"
              onClick={
                handleOpenMessages
              }
            >
              💬 Messages
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handleBack}
            >
              ← Back
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {message && (
          <div className="success-message">
            {message}
          </div>
        )}

        {/* ADMIN STATISTICS */}

        <div className="dashboard-stats">
          <div className="stat-card">
            <span className="stat-icon">
              🎵
            </span>

            <strong>
              {stats.beats}
            </strong>

            <span>Total Beats</span>
          </div>

          <div className="stat-card">
            <span className="stat-icon">
              🥁
            </span>

            <strong>
              {stats.drumPacks}
            </strong>

            <span>Drum Packs</span>
          </div>

          <div className="stat-card">
            <span className="stat-icon">
              👥
            </span>

            <strong>
              {stats.producers}
            </strong>

            <span>Total Producers</span>
          </div>

          <div className="stat-card">
            <span className="stat-icon">
              ❤️
            </span>

            <strong>
              {stats.likes}
            </strong>

            <span>Total Likes</span>
          </div>

          <div className="stat-card">
            <span className="stat-icon">
              💬
            </span>

            <strong>
              {stats.comments}
            </strong>

            <span>Total Comments</span>
          </div>

          <div className="stat-card">
            <span className="stat-icon">
              📩
            </span>

            <strong>
              {stats.contactMessages}
            </strong>

            <span>Contact Messages</span>
          </div>

          <div className="stat-card">
            <span className="stat-icon">
              ⚖️
            </span>

            <strong>
              {stats.pendingAppeals}
            </strong>

            <span>Pending Appeals</span>
          </div>
        </div>

        {/* APPEAL REVIEW */}

        <div
          className="section-heading"
          style={{
            marginTop: "60px",
          }}
        >
          <div>
            <p className="eyebrow">
              CONTENT MODERATION
            </p>

            <h2>
              Beat Appeals
            </h2>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={
              loadAdminData
            }
          >
            ↻ Refresh
          </button>
        </div>

        {appeals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              ⚖️
            </div>

            <h3>
              No appeals yet
            </h3>

            <p>
              Producer appeals will appear
              here when a removed beat is
              challenged.
            </p>
          </div>
        ) : (
          <div className="admin-beats-list">
            {appeals.map((appeal) => {
              const appealBeat =
                appeal.beat;

              const appealProducer =
                appeal.producer;

              const isPending =
                appeal.status ===
                "pending";

              return (
                <article
                  key={appeal.id}
                  className="admin-beat-card"
                >
                  <div className="admin-beat-cover">
                    {appealBeat?.cover_url ? (
                      <img
                        src={
                          appealBeat.cover_url
                        }
                        alt={
                          appealBeat.title ||
                          "Beat cover"
                        }
                      />
                    ) : (
                      <div className="cover-placeholder">
                        ⚖️
                      </div>
                    )}
                  </div>

                  <div className="admin-beat-content">
                    <div className="admin-beat-top">
                      <div>
                        <p className="eyebrow">
                          BEAT APPEAL
                        </p>

                        <h3>
                          {appealBeat?.title ||
                            "Removed Beat"}
                        </h3>

                        <p className="producer-name">
                          👤{" "}
                          {appealProducer?.display_name ||
                            "Unknown Producer"}
                        </p>
                      </div>

                      <span className="license-badge">
                        {appeal.status
                          ? appeal.status.toUpperCase()
                          : "PENDING"}
                      </span>
                    </div>

                    <div className="beat-details">
                      <span>
                        Submitted:{" "}
                        {getDateTime(
                          appeal.created_at
                        )}
                      </span>

                      {appeal.resolved_at && (
                        <span>
                          Resolved:{" "}
                          {getDateTime(
                            appeal.resolved_at
                          )}
                        </span>
                      )}
                    </div>

                    <div className="beat-description">
                      <strong>
                        Beat Information
                      </strong>

                      <p>
                        {appealBeat?.title ||
                          "Removed beat"}
                      </p>

                      <p>
                        Genre:{" "}
                        {getGenreName(
                          appealBeat
                        )}
                      </p>

                      {appealBeat?.removal_reason && (
                        <p>
                          Original removal reason:{" "}
                          {
                            appealBeat.removal_reason
                          }
                        </p>
                      )}
                    </div>

                    <div className="beat-description">
                      <strong>
                        Producer
                      </strong>

                      <p>
                        {appealProducer?.display_name ||
                          "Unknown Producer"}
                      </p>

                      {appealProducer?.contact_info && (
                        <p>
                          Contact:{" "}
                          {
                            appealProducer.contact_info
                          }
                        </p>
                      )}
                    </div>

                    <div className="beat-description">
                      <strong>
                        Removal Reason
                      </strong>

                      <p>
                        {appeal.reason ||
                          appealBeat?.removal_reason ||
                          "No removal reason recorded."}
                      </p>
                    </div>

                    <div className="beat-description">
                      <strong>
                        Producer's Appeal
                      </strong>

                      <p>
                        {appeal.message ||
                          "No appeal message provided."}
                      </p>
                    </div>

                    {appeal.admin_response && (
                      <div className="beat-description">
                        <strong>
                          Admin Response
                        </strong>

                        <p>
                          {
                            appeal.admin_response
                          }
                        </p>
                      </div>
                    )}

                    {appealBeat?.mp3_url && (
                      <audio
                        controls
                        preload="none"
                        src={
                          appealBeat.mp3_url
                        }
                        style={{
                          width: "100%",
                          marginTop: "12px",
                        }}
                      >
                        Your browser does not
                        support audio playback.
                      </audio>
                    )}

                    {isPending ? (
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() =>
                            handleReviewAppeal(
                              appeal,
                              "approved"
                            )
                          }
                          disabled={
                            processingAppealId ===
                            appeal.id
                          }
                        >
                          {processingAppealId ===
                          appeal.id
                            ? "Processing..."
                            : "✅ GRANT / RESTORE BEAT"}
                        </button>

                        <button
                          type="button"
                          className="danger-button"
                          onClick={() =>
                            handleReviewAppeal(
                              appeal,
                              "rejected"
                            )
                          }
                          disabled={
                            processingAppealId ===
                            appeal.id
                          }
                        >
                          {processingAppealId ===
                          appeal.id
                            ? "Processing..."
                            : "❌ DECLINE APPEAL"}
                        </button>
                      </div>
                    ) : (
                      <div
                        className="beat-details"
                        style={{
                          marginTop: "12px",
                        }}
                      >
                        <span>
                          Decision:{" "}
                          <strong>
                            {appeal.status ===
                            "approved"
                              ? "APPEAL GRANTED — BEAT RESTORED"
                              : "APPEAL DECLINED — BEAT REMAINS REMOVED"}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* PRODUCER DIRECTORY */}

        <div className="section-heading">
          <div>
            <p className="eyebrow">
              CREATOR MANAGEMENT
            </p>

            <h2>
              Producers
            </h2>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={
              loadAdminData
            }
          >
            ↻ Refresh
          </button>
        </div>

        {producers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              👥
            </div>

            <h3>
              No producers found
            </h3>

            <p>
              Registered producers will appear
              here.
            </p>
          </div>
        ) : (
          <div className="admin-beats-list">
            {producers.map(
              (producer) => (
                <article
                  key={producer.id}
                  className="admin-beat-card"
                  style={{
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    handleSelectProducer(
                      producer
                    )
                  }
                >
                  <div
                    className="admin-beat-cover"
                    style={{
                      width: "100px",
                      height: "100px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {producer.avatar_url ? (
                      <img
                        src={
                          producer.avatar_url
                        }
                        alt={
                          producer.display_name ||
                          "Producer"
                        }
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div className="cover-placeholder">
                        🎧
                      </div>
                    )}
                  </div>

                  <div className="admin-beat-content">
                    <div className="admin-beat-top">
                      <div>
                        <p className="eyebrow">
                          PRODUCER
                        </p>

                        <h3>
                          {producer.display_name ||
                            "Unknown Producer"}
                        </h3>

                        <p className="producer-name">
                          {producer.role ||
                            "producer"}
                        </p>
                      </div>

                      <span className="license-badge">
                        VIEW PROFILE →
                      </span>
                    </div>

                    {producer.bio && (
                      <p className="beat-description">
                        {producer.bio}
                      </p>
                    )}
                  </div>
                </article>
              )
            )}
          </div>
        )}

        {/* CONTACT MESSAGES */}

        <div className="section-heading">
          <div>
            <p className="eyebrow">
              CUSTOMER SUPPORT
            </p>

            <h2>
              Contact Messages
            </h2>
          </div>
        </div>

        {contactMessages.length ===
        0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              📩
            </div>

            <h3>
              No contact messages yet
            </h3>

            <p>
              Messages submitted through the
              Contact form will appear here.
            </p>
          </div>
        ) : (
          <div className="admin-beats-list">
            {contactMessages.map(
              (contact) => (
                <article
                  key={contact.id}
                  className="admin-beat-card"
                >
                  <div className="admin-beat-cover">
                    <div className="cover-placeholder">
                      📩
                    </div>
                  </div>

                  <div className="admin-beat-content">
                    <div className="admin-beat-top">
                      <div>
                        <p className="eyebrow">
                          CUSTOMER MESSAGE
                        </p>

                        <h3>
                          {contact.subject}
                        </h3>

                        <p className="producer-name">
                          👤{" "}
                          {contact.name}
                        </p>
                      </div>

                      <span className="license-badge">
                        {contact.is_read
                          ? "READ"
                          : "UNREAD"}
                      </span>
                    </div>

                    <div className="beat-details">
                      <span>
                        Email:{" "}
                        {contact.email}
                      </span>

                      <span>
                        Received:{" "}
                        {getDateTime(
                          contact.created_at
                        )}
                      </span>
                    </div>

                    <div className="beat-description">
                      <strong>
                        Message
                      </strong>

                      <p>
                        {contact.message}
                      </p>
                    </div>

                    <div className="admin-actions">
                      <a
                        href={`mailto:${contact.email}?subject=Re: ${encodeURIComponent(
                          contact.subject
                        )}`}
                        className="secondary-button"
                      >
                        ✉️ Reply by Email
                      </a>

                      {!contact.is_read && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            handleMarkContactRead(
                              contact
                            )
                          }
                          disabled={
                            markingContactId ===
                            contact.id
                          }
                        >
                          {markingContactId ===
                          contact.id
                            ? "Marking..."
                            : "✓ Mark as Read"}
                        </button>
                      )}

                      <button
                        type="button"
                        className="danger-button"
                        onClick={() =>
                          handleDeleteContact(
                            contact
                          )
                        }
                        disabled={
                          deletingContactId ===
                          contact.id
                        }
                      >
                        {deletingContactId ===
                        contact.id
                          ? "Deleting..."
                          : "🗑️ Delete Message"}
                      </button>
                    </div>
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminDashboard;