import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function ProducerDashboard({
  user,
  onUploadBeat,
  onNavigate,
}) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] =
    useState(true);
  const [notificationsError, setNotificationsError] =
    useState("");
  const [showNotifications, setShowNotifications] =
    useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      const {
        data,
        error: profileError,
      } = await supabase
        .from("producers")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setDisplayName(data.display_name || "");
        setBio(data.bio || "");
        setAvatarUrl(data.avatar_url || "");
        setContactInfo(data.contact_info || "");
      }

      setLoading(false);
    }

    loadProfile();
  }, [user]);

  useEffect(() => {
    async function loadNotifications() {
      if (!user?.id) {
        setNotifications([]);
        setNotificationsLoading(false);
        return;
      }

      setNotificationsLoading(true);
      setNotificationsError("");

      const {
        data,
        error: notificationError,
      } = await supabase
        .from("notifications")
        .select(`
          id,
          user_id,
          type,
          title,
          message,
          beat_id,
          producer_id,
          is_read,
          metadata,
          created_at
        `)
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (notificationError) {
        console.error(
          "Notification loading error:",
          notificationError
        );

        setNotificationsError(
          notificationError.message ||
            "Unable to load notifications."
        );

        setNotifications([]);
        setNotificationsLoading(false);
        return;
      }

      setNotifications(data || []);
      setNotificationsLoading(false);
    }

    loadNotifications();
  }, [user]);

  async function markNotificationAsRead(notificationId) {
    if (!notificationId || !user?.id) {
      return;
    }

    const {
      error: updateError,
    } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error(
        "Mark notification as read error:",
        updateError
      );
      return;
    }

    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              is_read: true,
            }
          : notification
      )
    );
  }

  async function markAllNotificationsAsRead() {
    if (!user?.id) {
      return;
    }

    const unreadNotifications = notifications.filter(
      (notification) => !notification.is_read
    );

    if (!unreadNotifications.length) {
      return;
    }

    const {
      error: updateError,
    } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (updateError) {
      console.error(
        "Mark all notifications as read error:",
        updateError
      );

      setNotificationsError(
        updateError.message ||
          "Unable to mark notifications as read."
      );

      return;
    }

    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    );
  }

  function formatNotificationDate(dateString) {
    if (!dateString) {
      return "";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString();
  }

  async function handleAvatarUpload(event) {
    try {
      setUploadingAvatar(true);
      setMessage("");
      setError("");

      const file = event.target.files?.[0];

      if (!file) {
        setUploadingAvatar(false);
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file.");
        setUploadingAvatar(false);
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError(
          "Profile image must be smaller than 5MB."
        );
        setUploadingAvatar(false);
        return;
      }

      const fileExtension = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExtension}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        setError(uploadError.message);
        setUploadingAvatar(false);
        return;
      }

      const {
        data: publicUrlData,
      } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const publicUrl =
        publicUrlData.publicUrl;

      setAvatarUrl(publicUrl);

      const {
        error: updateError,
      } = await supabase
        .from("producers")
        .update({
          avatar_url: publicUrl,
        })
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
        setUploadingAvatar(false);
        return;
      }

      setMessage(
        "Profile picture uploaded successfully."
      );
    } catch (uploadError) {
      setError(
        uploadError.message ||
          "Unable to upload profile picture."
      );
    }

    setUploadingAvatar(false);
  }

  async function saveProfile(event) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    if (!displayName.trim()) {
      setError("Please enter your producer name.");
      setSaving(false);
      return;
    }

    const {
      error: saveError,
    } = await supabase
      .from("producers")
      .upsert({
        id: user.id,
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        contact_info: contactInfo.trim() || null,
      });

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setMessage(
      "Producer profile saved successfully."
    );
  }

  function handleUploadDrumPack() {
    if (onNavigate) {
      onNavigate("upload-drum-pack");
    }
  }

  const unreadNotificationCount =
    notifications.filter(
      (notification) => !notification.is_read
    ).length;

  if (loading) {
    return (
      <section style={styles.section}>
        <p style={styles.message}>
          Loading producer profile...
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
        <div style={styles.headerText}>
          <p style={styles.smallTitle}>
            PRODUCER CENTER
          </p>

          <h1 style={styles.title}>
            Producer Dashboard
          </h1>

          <p style={styles.description}>
            Create and manage your producer profile on
            Tellem Beat Store.
          </p>
        </div>

        <div style={styles.notificationWrapper}>
          <button
            type="button"
            onClick={() =>
              setShowNotifications(
                (currentValue) => !currentValue
              )
            }
            style={{
              ...styles.notificationBellButton,
              ...(showNotifications
                ? styles.notificationBellButtonActive
                : {}),
            }}
            aria-label="Open notifications"
            title="Notifications"
          >
            <span style={styles.bellIcon}>
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                style={styles.bellSvg}
              >
                <path
                  d="M18 9C18 5.686 15.314 3 12 3C8.686 3 6 5.686 6 9C6 14 4 15 4 17H20C20 15 18 14 18 9Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d="M10 21H14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>

            {unreadNotificationCount > 0 && (
              <span style={styles.bellBadge}>
                {unreadNotificationCount > 99
                  ? "99+"
                  : unreadNotificationCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div style={styles.notificationDropdown}>
              <div
                style={
                  styles.notificationDropdownHeader
                }
              >
                <div>
                  <p
                    style={
                      styles.notificationSmallTitle
                    }
                  >
                    PRODUCER ALERTS
                  </p>

                  <h2
                    style={
                      styles.notificationDropdownTitle
                    }
                  >
                    Notifications
                  </h2>
                </div>

                {unreadNotificationCount > 0 && (
                  <button
                    type="button"
                    onClick={
                      markAllNotificationsAsRead
                    }
                    style={styles.markAllButton}
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {notificationsLoading ? (
                <p
                  style={
                    styles.notificationLoading
                  }
                >
                  Loading notifications...
                </p>
              ) : notificationsError ? (
                <div
                  style={styles.notificationError}
                >
                  <strong>
                    Unable to load notifications.
                  </strong>

                  <p>
                    {notificationsError}
                  </p>
                </div>
              ) : notifications.length === 0 ? (
                <div
                  style={styles.emptyNotifications}
                >
                  <div
                    style={
                      styles.emptyNotificationIcon
                    }
                  >
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M18 9C18 5.686 15.314 3 12 3C8.686 3 6 5.686 6 9C6 14 4 15 4 17H20C20 15 18 14 18 9Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <path
                        d="M10 21H14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  <strong>
                    No notifications yet
                  </strong>

                  <p>
                    Important updates about your beats
                    and producer account will appear
                    here.
                  </p>
                </div>
              ) : (
                <div
                  style={styles.notificationList}
                >
                  {notifications.map(
                    (notification) => (
                      <div
                        key={notification.id}
                        style={{
                          ...styles.notificationItem,
                          ...(notification.is_read
                            ? styles.readNotification
                            : styles.unreadNotification),
                        }}
                      >
                        <div
                          style={
                            styles.notificationIcon
                          }
                        >
                          {notification.type ===
                          "beat_removed" ? (
                            "⚠"
                          ) : (
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                            >
                              <path
                                d="M18 9C18 5.686 15.314 3 12 3C8.686 3 6 5.686 6 9C6 14 4 15 4 17H20C20 15 18 14 18 9Z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              <path
                                d="M10 21H14"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </div>

                        <div
                          style={
                            styles.notificationBody
                          }
                        >
                          <div
                            style={
                              styles.notificationItemHeader
                            }
                          >
                            <strong>
                              {notification.title ||
                                "Notification"}
                            </strong>

                            {!notification.is_read && (
                              <span
                                style={
                                  styles.unreadDot
                                }
                              >
                                NEW
                              </span>
                            )}
                          </div>

                          <p
                            style={
                              styles.notificationMessage
                            }
                          >
                            {notification.message}
                          </p>

                          <div
                            style={
                              styles.notificationFooter
                            }
                          >
                            <span
                              style={
                                styles.notificationDate
                              }
                            >
                              {formatNotificationDate(
                                notification.created_at
                              )}
                            </span>

                            {!notification.is_read && (
                              <button
                                type="button"
                                onClick={() =>
                                  markNotificationAsRead(
                                    notification.id
                                  )
                                }
                                style={
                                  styles.readButton
                                }
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={styles.uploadCard}>
        <div>
          <p style={styles.uploadSmallTitle}>
            READY TO SELL?
          </p>

          <h2 style={styles.uploadTitle}>
            Upload Your Beat
          </h2>

          <p style={styles.uploadDescription}>
            Add your MP3, cover artwork, BPM, musical
            key, genre and description.
          </p>
        </div>

        <button
          type="button"
          onClick={onUploadBeat}
          style={styles.uploadButton}
        >
          Upload Beat
        </button>
      </div>

      <div style={styles.drumPackCard}>
        <div style={styles.drumPackContent}>
          <p style={styles.drumPackSmallTitle}>
            COMMUNITY RESOURCE
          </p>

          <h2 style={styles.drumPackTitle}>
            Upload a Free Drum Pack
          </h2>

          <p style={styles.drumPackDescription}>
            Share your original drum sounds and sample
            collections with artists and producers.
            Drum packs are available as free ZIP
            downloads.
          </p>

          <div style={styles.drumPackFeatures}>
            <span>✓ ZIP Format</span>
            <span>✓ Free Download</span>
            <span>✓ Original Sounds</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleUploadDrumPack}
          style={styles.drumPackButton}
        >
          Upload Drum Pack
        </button>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>
          Your Producer Profile
        </h2>

        <div style={styles.avatarSection}>
          <div style={styles.avatarPreview}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Producer profile"
                style={styles.avatarImage}
              />
            ) : (
              <span
                style={styles.avatarPlaceholder}
              >
                👤
              </span>
            )}
          </div>

          <div style={styles.avatarControls}>
            <label style={styles.avatarLabel}>
              Profile Picture
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
              style={styles.fileInput}
            />

            <p style={styles.avatarHint}>
              Upload a JPG, PNG or WebP image.
              Maximum size: 5MB.
            </p>

            {uploadingAvatar && (
              <p style={styles.uploadingText}>
                Uploading profile picture...
              </p>
            )}
          </div>
        </div>

        <form onSubmit={saveProfile}>
          <label style={styles.label}>
            Producer Name
          </label>

          <input
            type="text"
            placeholder="Enter your producer name"
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
            placeholder="Tell artists about yourself and your music."
            value={bio}
            onChange={(event) =>
              setBio(event.target.value)
            }
            style={styles.textarea}
            rows={5}
          />

          <label style={styles.label}>
            Contact Information
          </label>

          <input
            type="text"
            placeholder="WhatsApp, phone number, email, Instagram, etc."
            value={contactInfo}
            onChange={(event) =>
              setContactInfo(event.target.value)
            }
            style={styles.input}
          />

          <p style={styles.contactHint}>
            Add the contact method you want artists to
            use when they are interested in WAV, STEMS,
            Unlimited or Exclusive licenses.
          </p>

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
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save Producer Profile"}
          </button>
        </form>
      </div>

      <div style={styles.nextCard}>
        <h2 style={styles.cardTitle}>
          Producer Tools
        </h2>

        <div style={styles.feature}>
          <span style={styles.featureIcon}>
            🎵
          </span>

          <div>
            <strong>Upload Beats</strong>

            <p>
              Upload your original MP3 files and cover
              artwork.
            </p>
          </div>
        </div>

        <div style={styles.feature}>
          <span style={styles.featureIcon}>
            🥁
          </span>

          <div>
            <strong>Free Drum Packs</strong>

            <p>
              Upload original drum packs as ZIP files
              for the community to download for free.
            </p>

            <button
              type="button"
              onClick={handleUploadDrumPack}
              style={styles.toolButton}
            >
              Upload Free Drum Pack →
            </button>
          </div>
        </div>

        <div style={styles.feature}>
          <span style={styles.featureIcon}>
            💰
          </span>

          <div>
            <strong>
              Licensing & Pricing
            </strong>

            <p>
              Set your beat licenses and prices for
              artists.
            </p>
          </div>
        </div>

        <div style={styles.feature}>
          <span style={styles.featureIcon}>
            📊
          </span>

          <div>
            <strong>Manage Your Beats</strong>

            <p>
              View, edit and manage all beats you
              upload.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const styles = {
  section: {
    maxWidth: "1000px",
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
    position: "relative",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "25px",
    marginBottom: "35px",
  },

  headerText: {
    flex: 1,
    minWidth: 0,
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

  notificationWrapper: {
    position: "relative",
    flexShrink: 0,
    zIndex: 20,
    paddingTop: "5px",
  },

  notificationBellButton: {
    position: "relative",
    width: "56px",
    height: "56px",
    minWidth: "56px",
    minHeight: "56px",
    borderRadius: "50%",
    background: "#15151b",
    border: "2px solid #ffb703",
    color: "#ffb703",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    margin: 0,
    appearance: "none",
    WebkitAppearance: "none",
    opacity: 1,
    visibility: "visible",
    boxSizing: "border-box",
    zIndex: 30,
    transition: "all 0.2s ease",
    boxShadow:
      "0 0 0 3px rgba(255, 183, 3, 0.08)",
  },

  notificationBellButtonActive: {
    background: "#211c0b",
    border: "2px solid #ffb703",
    color: "#ffb703",
    boxShadow:
      "0 0 0 4px rgba(255, 183, 3, 0.15)",
  },

  bellIcon: {
    width: "26px",
    height: "26px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffb703",
    flexShrink: 0,
  },

  bellSvg: {
    display: "block",
    width: "26px",
    height: "26px",
    color: "#ffb703",
    flexShrink: 0,
  },

  bellBadge: {
    position: "absolute",
    top: "-6px",
    right: "-6px",
    minWidth: "22px",
    height: "22px",
    padding: "0 5px",
    borderRadius: "50%",
    background: "#ffb703",
    color: "#000",
    fontSize: "10px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    border: "2px solid #0f0f14",
  },

  notificationDropdown: {
    position: "absolute",
    top: "66px",
    right: 0,
    width: "420px",
    maxWidth: "calc(100vw - 40px)",
    maxHeight: "600px",
    overflowY: "auto",
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    padding: "20px",
    boxSizing: "border-box",
    boxShadow:
      "0 18px 45px rgba(0, 0, 0, 0.45)",
  },

  notificationDropdownHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    flexWrap: "wrap",
    paddingBottom: "15px",
    marginBottom: "5px",
    borderBottom: "1px solid #292932",
  },

  notificationDropdownTitle: {
    fontSize: "22px",
    margin: "7px 0 0",
  },

  notificationSmallTitle: {
    color: "#ffb703",
    letterSpacing: "2px",
    fontSize: "10px",
    fontWeight: "bold",
    margin: 0,
  },

  markAllButton: {
    padding: "8px 11px",
    background: "transparent",
    border: "1px solid #5b4500",
    borderRadius: "6px",
    color: "#ffb703",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "11px",
  },

  notificationLoading: {
    color: "#888",
    padding: "20px 0",
    textAlign: "center",
  },

  notificationError: {
    padding: "15px",
    marginTop: "10px",
    background: "#3a1118",
    border: "1px solid #7f1d1d",
    borderRadius: "7px",
    color: "#ffb4b4",
  },

  emptyNotifications: {
    padding: "30px 10px",
    textAlign: "center",
    color: "#888",
  },

  emptyNotificationIcon: {
    width: "32px",
    height: "32px",
    margin: "0 auto 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffb703",
  },

  notificationList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "12px",
  },

  notificationItem: {
    display: "flex",
    gap: "12px",
    padding: "14px",
    borderRadius: "9px",
    border: "1px solid #292932",
  },

  unreadNotification: {
    background: "#211c0b",
    border: "1px solid #5b4500",
  },

  readNotification: {
    background: "#0f0f14",
  },

  notificationIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "#292932",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "17px",
    color: "#ffb703",
  },

  notificationBody: {
    flex: 1,
    minWidth: 0,
  },

  notificationItemHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },

  unreadDot: {
    fontSize: "8px",
    fontWeight: "bold",
    letterSpacing: "1px",
    background: "#ffb703",
    color: "#000",
    borderRadius: "4px",
    padding: "3px 5px",
  },

  notificationMessage: {
    color: "#bbb",
    lineHeight: 1.5,
    margin: "7px 0 10px",
    whiteSpace: "pre-line",
  },

  notificationFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
  },

  notificationDate: {
    color: "#666",
    fontSize: "10px",
  },

  readButton: {
    padding: "6px 9px",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "5px",
    color: "#aaa",
    cursor: "pointer",
    fontSize: "10px",
  },

  uploadCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "25px",
    flexWrap: "wrap",
    background: "#1a170d",
    border: "1px solid #5b4500",
    borderRadius: "12px",
    padding: "25px 30px",
    marginBottom: "25px",
  },

  uploadSmallTitle: {
    color: "#ffb703",
    letterSpacing: "2px",
    fontSize: "11px",
    fontWeight: "bold",
    margin: 0,
  },

  uploadTitle: {
    fontSize: "25px",
    margin: "8px 0",
  },

  uploadDescription: {
    color: "#999",
    margin: 0,
    lineHeight: 1.5,
  },

  uploadButton: {
    background: "#ffb703",
    border: "none",
    borderRadius: "7px",
    color: "#000",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "14px 25px",
    whiteSpace: "nowrap",
  },

  drumPackCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "25px",
    flexWrap: "wrap",
    background: "#101d16",
    border: "1px solid #245c35",
    borderRadius: "12px",
    padding: "25px 30px",
    marginBottom: "25px",
  },

  drumPackContent: {
    flex: 1,
  },

  drumPackSmallTitle: {
    color: "#8ee5a8",
    letterSpacing: "2px",
    fontSize: "11px",
    fontWeight: "bold",
    margin: 0,
  },

  drumPackTitle: {
    fontSize: "25px",
    margin: "8px 0",
  },

  drumPackDescription: {
    color: "#aaa",
    lineHeight: 1.6,
    margin: 0,
  },

  drumPackFeatures: {
    display: "flex",
    gap: "18px",
    flexWrap: "wrap",
    marginTop: "15px",
    color: "#8ee5a8",
    fontSize: "12px",
    fontWeight: "bold",
  },

  drumPackButton: {
    background: "#8ee5a8",
    border: "none",
    borderRadius: "7px",
    color: "#07140b",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "14px 25px",
    whiteSpace: "nowrap",
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

  avatarSection: {
    display: "flex",
    alignItems: "center",
    gap: "25px",
    padding: "20px",
    background: "#0f0f14",
    border: "1px solid #292932",
    borderRadius: "10px",
    marginBottom: "25px",
    flexWrap: "wrap",
  },

  avatarPreview: {
    width: "110px",
    height: "110px",
    borderRadius: "50%",
    overflow: "hidden",
    background: "#292932",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  avatarPlaceholder: {
    fontSize: "45px",
  },

  avatarControls: {
    flex: 1,
  },

  avatarLabel: {
    display: "block",
    fontWeight: "bold",
    marginBottom: "10px",
  },

  fileInput: {
    color: "#fff",
    width: "100%",
  },

  avatarHint: {
    color: "#777",
    fontSize: "12px",
    marginTop: "8px",
  },

  uploadingText: {
    color: "#ffb703",
    fontSize: "13px",
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

  contactHint: {
    color: "#777",
    fontSize: "12px",
    lineHeight: 1.5,
    marginTop: "8px",
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

  toolButton: {
    marginTop: "8px",
    padding: "8px 13px",
    background: "transparent",
    border: "1px solid #245c35",
    borderRadius: "6px",
    color: "#8ee5a8",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "12px",
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

  nextCard: {
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

export default ProducerDashboard;