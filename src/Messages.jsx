import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

function Messages({
  user,
  onNavigate,
  initialRecipientId = null,
  initialMessageId = null,
  isAdmin = false,
  compact = false,
}) {
  const [people, setPeople] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedRecipientId, setSelectedRecipientId] =
    useState(initialRecipientId);

  const [subject, setSubject] = useState("");
  const [messageText, setMessageText] = useState("");

  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const messageInputRef = useRef(null);

  /*
   * Keep the recipient supplied by a notification.
   */
  useEffect(() => {
    if (initialRecipientId) {
      setSelectedRecipientId(initialRecipientId);
    }
  }, [initialRecipientId]);

  /*
   * Load all messages involving the logged-in user.
   *
   * The conversation list is built from these messages.
   * This guarantees that an existing conversation appears
   * even when the normal producer directory does not.
   */
  async function loadMessages() {
    if (!user?.id) {
      setMessages([]);
      setPeople([]);
      setLoadingMessages(false);
      setLoadingPeople(false);
      return;
    }

    setLoadingMessages(true);
    setLoadingPeople(true);
    setError("");

    const {
      data,
      error: messagesError,
    } = await supabase
      .from("messages")
      .select(`
        id,
        sender_id,
        recipient_id,
        subject,
        message,
        is_read,
        created_at
      `)
      .or(
        `sender_id.eq.${user.id},recipient_id.eq.${user.id}`
      )
      .order("created_at", {
        ascending: true,
      });

    if (messagesError) {
      console.error(
        "Messages loading error:",
        messagesError
      );

      setError(
        messagesError.message ||
          "Unable to load messages."
      );

      setMessages([]);
      setPeople([]);
      setLoadingMessages(false);
      setLoadingPeople(false);
      return;
    }

    const loadedMessages = data || [];

    setMessages(loadedMessages);
    setLoadingMessages(false);

    /*
     * Find every person who has exchanged a message
     * with the current user.
     */
    const conversationPersonIds = [
      ...new Set(
        loadedMessages
          .map((item) => {
            if (item.sender_id === user.id) {
              return item.recipient_id;
            }

            if (item.recipient_id === user.id) {
              return item.sender_id;
            }

            return null;
          })
          .filter(Boolean)
          .filter((id) => id !== user.id)
      ),
    ];

    /*
     * If a notification opened a specific conversation,
     * make sure that person is included even if the
     * conversation list has not loaded yet.
     */
    if (
      initialRecipientId &&
      initialRecipientId !== user.id &&
      !conversationPersonIds.includes(initialRecipientId)
    ) {
      conversationPersonIds.push(initialRecipientId);
    }

    /*
     * Load producer profiles for the people found in
     * the actual messages table.
     */
    let profilePeople = [];

    if (conversationPersonIds.length > 0) {
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("producers")
        .select(`
          id,
          display_name,
          role,
          avatar_url
        `)
        .in("id", conversationPersonIds);

      if (profileError) {
        console.error(
          "Message profile loading error:",
          profileError
        );
      } else {
        profilePeople = profileData || [];
      }
    }

    /*
     * For admins, also load all non-admin producers so
     * the admin can start a new conversation.
     *
     * Existing conversations are already guaranteed by
     * conversationPersonIds above.
     */
    if (isAdmin) {
      const {
        data: allPeople,
        error: allPeopleError,
      } = await supabase
        .from("producers")
        .select(`
          id,
          display_name,
          role,
          avatar_url
        `)
        .neq("id", user.id)
        .neq("role", "admin")
        .order("display_name", {
          ascending: true,
        });

      if (allPeopleError) {
        console.error(
          "Admin contact loading error:",
          allPeopleError
        );
      } else {
        /*
         * Merge all producers with existing conversation
         * contacts without creating duplicates.
         */
        const mergedPeople = [
          ...profilePeople,
          ...(allPeople || []),
        ];

        const uniquePeople = [
          ...new Map(
            mergedPeople.map((person) => [
              person.id,
              person,
            ])
          ).values(),
        ];

        setPeople(uniquePeople);
      }
    } else {
      /*
       * Producers/users only need admins in the contact
       * list, plus anyone with whom they already have
       * an existing conversation.
       */
      const filteredPeople = profilePeople.filter(
        (person) =>
          person.role === "admin" ||
          conversationPersonIds.includes(person.id)
      );

      /*
       * If a profile could not be loaded, still create a
       * temporary conversation entry so the conversation
       * remains accessible.
       */
      const knownIds = new Set(
        filteredPeople.map((person) => person.id)
      );

      const fallbackPeople = conversationPersonIds
        .filter((id) => !knownIds.has(id))
        .map((id) => ({
          id,
          display_name: "Conversation Participant",
          role: "user",
          avatar_url: "",
        }));

      setPeople([
        ...filteredPeople,
        ...fallbackPeople,
      ]);
    }

    setLoadingPeople(false);

    /*
     * If the notification supplied a message ID, determine
     * the conversation partner directly from that message.
     */
    if (initialMessageId) {
      const notificationMessage =
        loadedMessages.find(
          (item) => item.id === initialMessageId
        );

      if (notificationMessage) {
        const otherPersonId =
          notificationMessage.sender_id === user.id
            ? notificationMessage.recipient_id
            : notificationMessage.sender_id;

        if (otherPersonId) {
          setSelectedRecipientId(otherPersonId);
        }
      }
    }

    /*
     * Mark received messages as read.
     */
    const unreadIds = loadedMessages
      .filter(
        (item) =>
          item.recipient_id === user.id &&
          item.is_read === false
      )
      .map((item) => item.id);

    if (unreadIds.length > 0) {
      const {
        error: readError,
      } = await supabase
        .from("messages")
        .update({
          is_read: true,
        })
        .in("id", unreadIds);

      if (readError) {
        console.error(
          "Unable to mark messages as read:",
          readError
        );
      }
    }
  }

  /*
   * Initial message loading and automatic refresh.
   */
  useEffect(() => {
    loadMessages();

    const interval = setInterval(() => {
      loadMessages();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [
    user?.id,
    initialMessageId,
    initialRecipientId,
    isAdmin,
  ]);

  /*
   * Find the selected person's profile.
   */
  const selectedPerson = useMemo(() => {
    if (!selectedRecipientId) {
      return null;
    }

    const person = people.find(
      (item) =>
        item.id === selectedRecipientId
    );

    if (person) {
      return person;
    }

    return {
      id: selectedRecipientId,
      display_name: "Conversation Participant",
    };
  }, [
    people,
    selectedRecipientId,
  ]);

  /*
   * Get the current conversation.
   */
  const conversationMessages = useMemo(() => {
    if (!user?.id || !selectedRecipientId) {
      return [];
    }

    return messages.filter(
      (item) =>
        (item.sender_id === user.id &&
          item.recipient_id ===
            selectedRecipientId) ||
        (item.sender_id ===
            selectedRecipientId &&
          item.recipient_id === user.id)
    );
  }, [
    messages,
    user?.id,
    selectedRecipientId,
  ]);

  /*
   * Send a new message or reply.
   */
  async function handleSendMessage(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!user?.id) {
      setError(
        "You must be signed in to send a message."
      );
      return;
    }

    if (!selectedRecipientId) {
      setError(
        "Unable to determine who this reply is for."
      );
      return;
    }

    if (!messageText.trim()) {
      setError("Please enter a message.");
      return;
    }

    setSending(true);

    const {
      data: insertedMessage,
      error: sendError,
    } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: selectedRecipientId,
        subject:
          subject.trim() ||
          "Message from Tellem Beat Store",
        message: messageText.trim(),
        is_read: false,
      })
      .select(`
        id,
        sender_id,
        recipient_id,
        subject,
        message,
        is_read,
        created_at
      `)
      .single();

    if (sendError) {
      console.error(
        "Message sending error:",
        sendError
      );

      setError(
        sendError.message ||
          "Unable to send your message."
      );

      setSending(false);
      return;
    }

    setMessages((current) => [
      ...current,
      insertedMessage,
    ]);

    setSubject("");
    setMessageText("");

    setSuccess(
      conversationMessages.length > 0
        ? "Reply sent successfully."
        : "Message sent successfully."
    );

    /*
     * Make sure the recipient appears in the
     * conversation list immediately.
     */
    setPeople((current) => {
      if (
        current.some(
          (person) =>
            person.id === selectedRecipientId
        )
      ) {
        return current;
      }

      return [
        ...current,
        {
          id: selectedRecipientId,
          display_name:
            "Conversation Participant",
          role: "user",
          avatar_url: "",
        },
      ];
    });

    setSending(false);

    setTimeout(() => {
      setSuccess("");
    }, 3000);
  }

  /*
   * Focus the reply box.
   */
  function handleReply() {
    if (!selectedRecipientId) {
      setError(
        "Unable to determine the recipient for this reply."
      );
      return;
    }

    setError("");

    if (messageInputRef.current) {
      messageInputRef.current.focus();

      messageInputRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  function formatDate(dateString) {
    if (!dateString) return "";

    return new Date(dateString).toLocaleString(
      undefined,
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }

  if (!user) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
        }}
      >
        <h2>Messages</h2>
        <p>Please sign in to use messages.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: compact
          ? "900px"
          : "1200px",
        margin: "0 auto",
        padding: compact
          ? "10px 0"
          : "30px 20px 60px",
      }}
    >
      {!compact && (
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
            <p
              style={{
                margin: 0,
                color: "#ffb703",
                fontWeight: 700,
                letterSpacing: "1px",
                fontSize: "12px",
              }}
            >
              DIRECT COMMUNICATION
            </p>

            <h1
              style={{
                margin: "6px 0 0",
              }}
            >
              Messages
            </h1>
          </div>

          {onNavigate && (
            <button
              type="button"
              onClick={() =>
                onNavigate("home")
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
              BACK
            </button>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: "15px",
            padding: "12px 15px",
            borderRadius: "8px",
            background:
              "rgba(255, 0, 0, 0.12)",
            border:
              "1px solid rgba(255, 0, 0, 0.35)",
            color: "#ff7777",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginBottom: "15px",
            padding: "12px 15px",
            borderRadius: "8px",
            background:
              "rgba(0, 180, 100, 0.12)",
            border:
              "1px solid rgba(0, 180, 100, 0.35)",
            color: "#69e6a7",
          }}
        >
          {success}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            compact
              ? "1fr"
              : "280px minmax(0, 1fr)",
          gap: "20px",
        }}
      >
        {!compact && (
          <div
            style={{
              background: "#101014",
              border: "1px solid #29292f",
              borderRadius: "14px",
              padding: "18px",
              height: "fit-content",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: "15px",
              }}
            >
              Conversations
            </h3>

            {loadingPeople ? (
              <p>Loading conversations...</p>
            ) : people.length === 0 ? (
              <p
                style={{
                  color: "#aaa",
                  lineHeight: 1.6,
                }}
              >
                No conversations yet.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {people.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() =>
                      setSelectedRecipientId(
                        person.id
                      )
                    }
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px",
                      borderRadius: "9px",
                      border:
                        selectedRecipientId ===
                        person.id
                          ? "1px solid #ffb703"
                          : "1px solid #29292f",
                      background:
                        selectedRecipientId ===
                        person.id
                          ? "rgba(255,183,3,0.10)"
                          : "#15151b",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    {person.display_name ||
                      "Unnamed User"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            background: "#101014",
            border: "1px solid #29292f",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px",
              borderBottom:
                "1px solid #29292f",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "15px",
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                }}
              >
                {selectedPerson
                  ? `Conversation with ${
                      selectedPerson.display_name ||
                      "User"
                    }`
                  : selectedRecipientId
                    ? "Conversation"
                    : "Select a conversation"}
              </h3>

              {initialMessageId &&
                selectedRecipientId && (
                  <div
                    style={{
                      marginTop: "5px",
                      color: "#888",
                      fontSize: "12px",
                    }}
                  >
                    Opened from notification
                  </div>
                )}
            </div>

            {selectedRecipientId && (
              <button
                type="button"
                onClick={handleReply}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#ffb703",
                  color: "#111",
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                ↩ REPLY
              </button>
            )}
          </div>

          <div
            style={{
              minHeight: compact
                ? "180px"
                : "300px",
              maxHeight: compact
                ? "420px"
                : "500px",
              overflowY: "auto",
              padding: "18px",
            }}
          >
            {!selectedRecipientId ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "#999",
                }}
              >
                Select a person to view the
                conversation.
              </div>
            ) : loadingMessages ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "#999",
                }}
              >
                Loading messages...
              </div>
            ) : conversationMessages.length ===
              0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "#999",
                }}
              >
                No messages yet.
                <br />
                Send the first message below.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {conversationMessages.map(
                  (item) => {
                    const mine =
                      item.sender_id ===
                      user.id;

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent:
                            mine
                              ? "flex-end"
                              : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "80%",
                            padding:
                              "12px 14px",
                            borderRadius:
                              "12px",
                            background: mine
                              ? "#ffb703"
                              : "#202027",
                            color: mine
                              ? "#111"
                              : "#fff",
                          }}
                        >
                          {item.subject && (
                            <div
                              style={{
                                fontWeight: 700,
                                marginBottom:
                                  "5px",
                              }}
                            >
                              {item.subject}
                            </div>
                          )}

                          <div
                            style={{
                              whiteSpace:
                                "pre-wrap",
                              lineHeight: 1.5,
                            }}
                          >
                            {item.message}
                          </div>

                          <div
                            style={{
                              marginTop: "7px",
                              fontSize: "11px",
                              opacity: 0.7,
                            }}
                          >
                            {formatDate(
                              item.created_at
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSendMessage}
            style={{
              padding: "18px",
              borderTop:
                "1px solid #29292f",
            }}
          >
            {selectedRecipientId && (
              <>
                <div
                  style={{
                    marginBottom: "10px",
                    color: "#aaa",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {conversationMessages.length >
                  0
                    ? "REPLY TO THIS CONVERSATION"
                    : "START CONVERSATION"}
                </div>

                <input
                  type="text"
                  value={subject}
                  onChange={(event) =>
                    setSubject(
                      event.target.value
                    )
                  }
                  placeholder="Subject (optional)"
                  style={{
                    width: "100%",
                    boxSizing:
                      "border-box",
                    padding: "12px",
                    marginBottom:
                      "10px",
                    borderRadius: "8px",
                    border:
                      "1px solid #333",
                    background: "#15151b",
                    color: "#fff",
                    outline: "none",
                  }}
                />

                <textarea
                  ref={messageInputRef}
                  value={messageText}
                  onChange={(event) =>
                    setMessageText(
                      event.target.value
                    )
                  }
                  placeholder={
                    conversationMessages.length >
                    0
                      ? "Write your reply..."
                      : "Write your message..."
                  }
                  rows={4}
                  style={{
                    width: "100%",
                    boxSizing:
                      "border-box",
                    padding: "12px",
                    borderRadius: "8px",
                    border:
                      "1px solid #333",
                    background: "#15151b",
                    color: "#fff",
                    resize: "vertical",
                    outline: "none",
                  }}
                />

                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    marginTop: "10px",
                    padding:
                      "12px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: sending
                      ? "#555"
                      : "#ffb703",
                    color: "#111",
                    fontWeight: 800,
                    cursor: sending
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {sending
                    ? "SENDING..."
                    : conversationMessages.length >
                        0
                      ? "SEND REPLY"
                      : "SEND MESSAGE"}
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default Messages;
