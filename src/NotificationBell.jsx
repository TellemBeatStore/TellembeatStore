import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function NotificationBell({
  user,
  onOpenMessages,
}) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] =
    useState(false);
  const [loading, setLoading] = useState(true);

  async function loadNotifications() {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
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
      })
      .limit(50);

    if (error) {
      console.error(
        "Notification loading error:",
        error.message
      );

      setNotifications([]);
      setLoading(false);
      return;
    }

    setNotifications(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(() => {
      loadNotifications();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((current) => {
            const alreadyExists = current.some(
              (notification) =>
                notification.id === payload.new.id
            );

            if (alreadyExists) {
              return current;
            }

            return [
              payload.new,
              ...current,
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function markNotificationRead(
    notificationId
  ) {
    if (!user?.id || !notificationId) {
      return false;
    }

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      console.error(
        "Unable to mark notification as read:",
        error.message
      );

      return false;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              is_read: true,
            }
          : notification
      )
    );

    return true;
  }

  async function markAllNotificationsRead() {
    if (!user?.id) return;

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error(
        "Unable to mark all notifications as read:",
        error.message
      );

      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    );
  }

  /*
   * Handle clicking an individual notification.
   */
  async function handleNotificationClick(
    notification
  ) {
    if (!notification) return;

    await markNotificationRead(notification.id);

    /*
     * PRODUCER BEAT REMOVAL
     *
     * Opens the dedicated producer appeal screen.
     */
    if (
      notification.type === "beat_removed"
    ) {
      setShowNotifications(false);

      if (onOpenMessages) {
        onOpenMessages({
          recipientId: null,
          messageId: null,
          notification,
          openAppeal: true,
        });
      }

      return;
    }

    /*
     * INTERNAL MESSAGE
     *
     * Opens the exact conversation associated
     * with the notification.
     */
    if (
      notification.type === "message" ||
      notification.metadata?.message_id
    ) {
      const senderId =
        notification.metadata?.sender_id || null;

      setShowNotifications(false);

      if (onOpenMessages) {
        onOpenMessages({
          recipientId: senderId,
          messageId:
            notification.metadata?.message_id ||
            null,
          notification,
        });
      }

      return;
    }

    /*
     * PRODUCER APPEAL
     *
     * IMPORTANT:
     * This does NOT open the normal Messages screen.
     *
     * It tells App.jsx that the administrator wants
     * to review the appeal inside AdminDashboard.
     */
    if (
      notification.type === "appeal" ||
      notification.type === "beat_appeal"
    ) {
      setShowNotifications(false);

      if (onOpenMessages) {
        onOpenMessages({
          recipientId: null,
          messageId: null,
          notification,
          openAdminAppeal: true,
        });
      }

      return;
    }

    /*
     * UNKNOWN NOTIFICATION TYPES
     */
    setShowNotifications(false);
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  if (!user?.id) {
    return null;
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <button
        type="button"
        onClick={() =>
          setShowNotifications(
            (current) => !current
          )
        }
        aria-label="Notifications"
        title="Notifications"
        style={{
          position: "relative",
          width: "48px",
          height: "48px",
          minWidth: "48px",
          minHeight: "48px",
          borderRadius: "50%",
          border: "2px solid #ffb703",
          background: "#15151b",
          color: "#ffb703",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          margin: 0,
          boxSizing: "border-box",
          opacity: 1,
          visibility: "visible",
          zIndex: 1001,
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M18 8C18 5.23858 15.7614 3 13 3H11C8.23858 3 6 5.23858 6 8V12.5C6 13.6046 5.55228 14.6046 4.82843 15.3284L4 16.1569V17H20V16.1569L19.1716 15.3284C18.4477 14.6046 18 13.6046 12.5V8Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="M9.5 20C10.1 20.63 11.02 21 12 21C12.98 21 13.9 20.63 14.5 20"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "21px",
              height: "21px",
              padding: "0 5px",
              borderRadius: "999px",
              background: "#e63946",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "800",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #15151b",
              boxSizing: "border-box",
            }}
          >
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div
          style={{
            position: "absolute",
            top: "58px",
            right: 0,
            width: "360px",
            maxWidth:
              "calc(100vw - 24px)",
            background: "#111118",
            border: "1px solid #33333d",
            borderRadius: "14px",
            boxShadow:
              "0 18px 45px rgba(0,0,0,0.45)",
            overflow: "hidden",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              padding: "14px 16px",
              borderBottom:
                "1px solid #2b2b34",
            }}
          >
            <strong
              style={{
                color: "#ffffff",
                fontSize: "15px",
              }}
            >
              Notifications
            </strong>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={
                  markAllNotificationsRead
                }
                style={{
                  border: "none",
                  background:
                    "transparent",
                  color: "#ffb703",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "700",
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div
            style={{
              maxHeight: "420px",
              overflowY: "auto",
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: "25px 16px",
                  color: "#aaa",
                  textAlign: "center",
                }}
              >
                Loading notifications...
              </div>
            ) : notifications.length ===
              0 ? (
              <div
                style={{
                  padding: "30px 16px",
                  color: "#aaa",
                  textAlign: "center",
                }}
              >
                No notifications yet.
              </div>
            ) : (
              notifications.map(
                (notification) => {
                  const isMessage =
                    notification.type ===
                      "message" ||
                    Boolean(
                      notification.metadata
                        ?.message_id
                    );

                  const isRemoval =
                    notification.type ===
                    "beat_removed";

                  const isAppeal =
                    notification.type ===
                      "appeal" ||
                    notification.type ===
                      "beat_appeal";

                  return (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() =>
                        handleNotificationClick(
                          notification
                        )
                      }
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        borderBottom:
                          "1px solid #24242c",
                        background:
                          notification.is_read
                            ? "#111118"
                            : "#1b1b24",
                        padding:
                          "14px 16px",
                        cursor: "pointer",
                        display: "block",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems:
                            "flex-start",
                          gap: "10px",
                        }}
                      >
                        <span
                          style={{
                            width: "9px",
                            height: "9px",
                            minWidth: "9px",
                            borderRadius:
                              "50%",
                            marginTop: "5px",
                            background:
                              notification.is_read
                                ? "#55555f"
                                : "#ffb703",
                          }}
                        />

                        <div
                          style={{
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems:
                                "center",
                              gap: "8px",
                              marginBottom:
                                "5px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div
                              style={{
                                color:
                                  "#ffffff",
                                fontWeight:
                                  "800",
                                fontSize:
                                  "14px",
                              }}
                            >
                              {notification.title ||
                                "Notification"}
                            </div>

                            {isMessage && (
                              <span
                                style={{
                                  fontSize:
                                    "10px",
                                  fontWeight:
                                    "800",
                                  color:
                                    "#111",
                                  background:
                                    "#ffb703",
                                  borderRadius:
                                    "999px",
                                  padding:
                                    "3px 6px",
                                }}
                              >
                                MESSAGE
                              </span>
                            )}

                            {isRemoval && (
                              <span
                                style={{
                                  fontSize:
                                    "10px",
                                  fontWeight:
                                    "800",
                                  color:
                                    "#fff",
                                  background:
                                    "#c1121f",
                                  borderRadius:
                                    "999px",
                                  padding:
                                    "3px 6px",
                                }}
                              >
                                BEAT REMOVED
                              </span>
                            )}

                            {isAppeal && (
                              <span
                                style={{
                                  fontSize:
                                    "10px",
                                  fontWeight:
                                    "800",
                                  color:
                                    "#111",
                                  background:
                                    "#ffb703",
                                  borderRadius:
                                    "999px",
                                  padding:
                                    "3px 6px",
                                }}
                              >
                                APPEAL
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              color:
                                "#c7c7cf",
                              fontSize:
                                "13px",
                              lineHeight:
                                "1.45",
                            }}
                          >
                            {
                              notification.message
                            }
                          </div>

                          {isMessage && (
                            <div
                              style={{
                                marginTop:
                                  "7px",
                                color:
                                  "#ffb703",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  "700",
                              }}
                            >
                              Click to open
                              conversation →
                            </div>
                          )}

                          {isRemoval && (
                            <div
                              style={{
                                marginTop:
                                  "7px",
                                color:
                                  "#ffb703",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  "800",
                              }}
                            >
                              CLICK TO APPEAL THIS
                              DECISION →
                            </div>
                          )}

                          {isAppeal && (
                            <div
                              style={{
                                marginTop:
                                  "7px",
                                color:
                                  "#ffb703",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  "800",
                              }}
                            >
                              CLICK TO REVIEW APPEAL →
                            </div>
                          )}

                          <div
                            style={{
                              color:
                                "#777783",
                              fontSize:
                                "11px",
                              marginTop:
                                "7px",
                            }}
                          >
                            {notification.created_at
                              ? new Date(
                                  notification.created_at
                                ).toLocaleString()
                              : ""}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                }
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
