import { useState } from "react";
import { supabase } from "./supabaseClient";

function AppealBeat({
  user,
  notification,
  onNavigate,
}) {
  const [appealMessage, setAppealMessage] =
    useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!user) {
    return (
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "40px 20px",
          textAlign: "center",
        }}
      >
        <h2>Beat Appeal</h2>
        <p>Please sign in to submit an appeal.</p>
      </div>
    );
  }

  const beatId = notification?.beat_id || null;

  const metadata =
    notification?.metadata || {};

  const beatTitle =
    metadata.beat_title ||
    "Your Beat";

  const removalReason =
    metadata.removal_reason ||
    "No removal reason was provided.";

  const removedAt =
    metadata.removed_at ||
    notification?.created_at ||
    null;

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!beatId) {
      setError(
        "The beat associated with this removal could not be identified."
      );
      return;
    }

    if (!appealMessage.trim()) {
      setError(
        "Please explain why you believe the beat should be restored."
      );
      return;
    }

    setSending(true);

    /*
     * Prevent duplicate pending appeals for the same beat.
     */
    const {
      data: existingAppeals,
      error: existingError,
    } = await supabase
      .from("beat_appeals")
      .select(`
        id,
        status
      `)
      .eq("beat_id", beatId)
      .eq("producer_id", user.id)
      .eq("status", "pending")
      .limit(1);

    if (existingError) {
      console.error(
        "Existing appeal check error:",
        existingError
      );

      setError(
        existingError.message ||
          "Unable to check existing appeals."
      );

      setSending(false);
      return;
    }

    if (
      existingAppeals &&
      existingAppeals.length > 0
    ) {
      setError(
        "You already have a pending appeal for this beat."
      );

      setSubmitted(true);
      setSending(false);
      return;
    }

    /*
     * Create the appeal.
     */
    const {
      data: appeal,
      error: appealError,
    } = await supabase
      .from("beat_appeals")
      .insert({
        beat_id: beatId,
        producer_id: user.id,
        reason: removalReason,
        message: appealMessage.trim(),
        status: "pending",
      })
      .select(`
        id,
        beat_id,
        producer_id,
        reason,
        message,
        status,
        created_at
      `)
      .single();

    if (appealError) {
      console.error(
        "Appeal submission error:",
        appealError
      );

      setError(
        appealError.message ||
          "Unable to submit your appeal."
      );

      setSending(false);
      return;
    }

    /*
     * Notify every administrator.
     */
    const {
      data: admins,
      error: adminsError,
    } = await supabase
      .from("producers")
      .select("id")
      .eq("role", "admin");

    if (adminsError) {
      console.error(
        "Admin lookup for appeal notification failed:",
        adminsError
      );
    } else if (admins && admins.length > 0) {
      const notifications =
        admins.map((admin) => ({
          user_id: admin.id,
          type: "appeal",
          title: "New Beat Appeal",
          message:
            `A producer has submitted an appeal for "${beatTitle}".`,
          beat_id: beatId,
          producer_id: user.id,
          is_read: false,
          metadata: {
            appeal_id: appeal?.id || null,
            beat_id: beatId,
            beat_title: beatTitle,
            producer_id: user.id,
            sender_id: user.id,
            status: "pending",
          },
        }));

      const {
        error: notificationError,
      } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error(
          "Appeal notification error:",
          notificationError
        );
      }
    }

    setAppealMessage("");
    setSuccess(
      "Your appeal has been submitted successfully. The Tellem Beat Store team will review it."
    );
    setSubmitted(true);
    setSending(false);
  }

  return (
    <section
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "30px 20px 60px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "15px",
          marginBottom: "25px",
        }}
      >
        <div>
          <div
            style={{
              color: "#ffb703",
              fontSize: "12px",
              fontWeight: "800",
              letterSpacing: "1.5px",
            }}
          >
            BEAT REMOVAL
          </div>

          <h1
            style={{
              margin: "6px 0 0",
            }}
          >
            Appeal Beat Removal
          </h1>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() =>
              onNavigate("messages")
            }
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #333",
              background: "#15151b",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            BACK TO MESSAGES
          </button>
        )}
      </div>

      <div
        style={{
          background: "#101014",
          border: "1px solid #29292f",
          borderRadius: "14px",
          padding: "24px",
        }}
      >
        <div
          style={{
            paddingBottom: "20px",
            borderBottom:
              "1px solid #29292f",
          }}
        >
          <div
            style={{
              color: "#888",
              fontSize: "12px",
              fontWeight: "700",
              letterSpacing: "1px",
              marginBottom: "7px",
            }}
          >
            REMOVED BEAT
          </div>

          <h2
            style={{
              margin: 0,
              color: "#fff",
            }}
          >
            {beatTitle}
          </h2>
        </div>

        <div
          style={{
            marginTop: "22px",
            padding: "18px",
            borderRadius: "10px",
            background:
              "rgba(193, 18, 31, 0.10)",
            border:
              "1px solid rgba(193, 18, 31, 0.30)",
          }}
        >
          <div
            style={{
              color: "#ff7777",
              fontSize: "12px",
              fontWeight: "800",
              letterSpacing: "1px",
              marginBottom: "8px",
            }}
          >
            REMOVAL REASON
          </div>

          <div
            style={{
              color: "#ddd",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {removalReason}
          </div>

          {removedAt && (
            <div
              style={{
                marginTop: "12px",
                color: "#888",
                fontSize: "12px",
              }}
            >
              Removed:{" "}
              {new Date(
                removedAt
              ).toLocaleString()}
            </div>
          )}
        </div>

        {success && (
          <div
            style={{
              marginTop: "20px",
              padding: "14px 16px",
              borderRadius: "9px",
              background:
                "rgba(0, 180, 100, 0.12)",
              border:
                "1px solid rgba(0, 180, 100, 0.35)",
              color: "#69e6a7",
              lineHeight: 1.5,
            }}
          >
            {success}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "20px",
              padding: "14px 16px",
              borderRadius: "9px",
              background:
                "rgba(255, 0, 0, 0.12)",
              border:
                "1px solid rgba(255, 0, 0, 0.35)",
              color: "#ff7777",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {!submitted && (
          <form
            onSubmit={handleSubmit}
            style={{
              marginTop: "25px",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                color: "#fff",
              }}
            >
              Why should this beat be restored?
            </h3>

            <p
              style={{
                color: "#999",
                lineHeight: 1.6,
                fontSize: "14px",
              }}
            >
              Explain why you believe the removal
              was incorrect or provide any information
              that may help our team review the decision.
            </p>

            <textarea
              value={appealMessage}
              onChange={(event) =>
                setAppealMessage(
                  event.target.value
                )
              }
              placeholder="Write your appeal..."
              rows={7}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px",
                borderRadius: "9px",
                border: "1px solid #333",
                background: "#15151b",
                color: "#fff",
                resize: "vertical",
                outline: "none",
                lineHeight: 1.5,
              }}
            />

            <button
              type="submit"
              disabled={sending}
              style={{
                marginTop: "14px",
                padding: "13px 22px",
                borderRadius: "8px",
                border: "none",
                background: sending
                  ? "#555"
                  : "#ffb703",
                color: "#111",
                fontWeight: "900",
                cursor: sending
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {sending
                ? "SUBMITTING APPEAL..."
                : "SUBMIT APPEAL"}
            </button>
          </form>
        )}

        {submitted && !success && (
          <div
            style={{
              marginTop: "25px",
              padding: "18px",
              borderRadius: "9px",
              background: "#15151b",
              color: "#aaa",
            }}
          >
            This beat already has a pending appeal.
          </div>
        )}
      </div>
    </section>
  );
}

export default AppealBeat;
