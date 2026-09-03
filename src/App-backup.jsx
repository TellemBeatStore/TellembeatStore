import { useEffect, useState } from "react";
import LatestBeats from "./LatestBeats";
import BrowseBeats from "./BrowseBeats";
import ProducerDashboard from "./ProducerDashboard";
import ArtistDashboard from "./ArtistDashboard";
import UploadBeat from "./UploadBeat";
import MyBeats from "./MyBeats";
import EditBeat from "./EditBeat";
import ProducerProfile from "./ProducerProfile";
import AdminDashboard from "./AdminDashboard";
import { supabase } from "./supabaseClient";

function App() {
  const [page, setPage] = useState("home");
  const [authMode, setAuthMode] = useState("signin");
  const [session, setSession] = useState(null);
  const [editingBeat, setEditingBeat] = useState(null);
  const [selectedProducerId, setSelectedProducerId] = useState(null);
  const [producerAvatar, setProducerAvatar] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadProducerAvatar(userId) {
    if (!userId) {
      setProducerAvatar("");
      return;
    }

    const { data: producerData, error: producerError } =
      await supabase
        .from("producers")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();

    if (producerError) {
      console.error(
        "Unable to load producer profile picture:",
        producerError.message
      );
      setProducerAvatar("");
      return;
    }

    setProducerAvatar(producerData?.avatar_url || "");
  }

  useEffect(() => {
    async function getSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);

      if (currentSession?.user?.id) {
        await loadProducerAvatar(currentSession.user.id);
      }

      setLoading(false);
    }

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSession(currentSession);

        if (currentSession?.user?.id) {
          await loadProducerAvatar(currentSession.user.id);
        } else {
          setProducerAvatar("");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleAuth(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    if (authMode === "signup") {
      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

      setLoading(false);

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        setSession(data.session);
        await loadProducerAvatar(data.session.user.id);
        setMessage("Account created successfully.");
        setPage("artist");
      } else {
        setMessage(
          "Account created successfully! Check your email to confirm your account."
        );
      }

      return;
    }

    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setSession(data.session);
    await loadProducerAvatar(data.session.user.id);
    setMessage("Signed in successfully.");
    setPage("artist");
  }

  async function handleSignOut() {
    setMessage("");
    setError("");

    const { error: signOutError } =
      await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    setSession(null);
    setProducerAvatar("");
    setEditingBeat(null);
    setSelectedProducerId(null);
    setPage("home");
    setMessage("Signed out successfully.");
  }

  function openSignIn() {
    setAuthMode("signin");
    setPage("auth");
    setMessage("");
    setError("");
  }

  function openSignUp() {
    setAuthMode("signup");
    setPage("auth");
    setMessage("");
    setError("");
  }

  function openProducerDashboard() {
    if (!session) {
      openSignUp();
      return;
    }

    setPage("producer");
    setMessage("");
    setError("");
  }

  function openArtistDashboard() {
    if (!session) {
      openSignUp();
      return;
    }

    setPage("artist");
    setMessage("");
    setError("");
  }

  function openAdminDashboard() {
    if (!session) {
      openSignIn();
      return;
    }

    setPage("admin");
    setMessage("");
    setError("");
  }

  function openUploadBeat() {
    if (!session) {
      openSignIn();
      return;
    }

    setPage("upload");
    setMessage("");
    setError("");
  }

  function openMyBeats() {
    if (!session) {
      openSignIn();
      return;
    }

    setPage("mybeats");
    setMessage("");
    setError("");
  }

  function openEditBeat(beat) {
    if (!session) {
      openSignIn();
      return;
    }

    setEditingBeat(beat);
    setPage("editbeat");
    setMessage("");
    setError("");
  }

  function openProducerProfile(producerId) {
    if (!producerId) {
      setError("Producer profile is not available.");
      return;
    }

    setSelectedProducerId(producerId);
    setPage("producer-profile");
    setMessage("");
    setError("");
  }

  function handleNavigate(nextPage, data) {
    if (nextPage === "producer-profile") {
      openProducerProfile(data);
      return;
    }

    if (nextPage === "home") {
      goHome();
      return;
    }

    if (nextPage === "browse") {
      goBrowse();
      return;
    }

    setPage(nextPage);
  }

  function goHome() {
    setEditingBeat(null);
    setSelectedProducerId(null);
    setPage("home");
    setMessage("");
    setError("");
  }

  function goBrowse() {
    setEditingBeat(null);
    setSelectedProducerId(null);
    setPage("browse");
    setMessage("");
    setError("");
  }

  function returnToMyBeats() {
    setEditingBeat(null);
    setPage("mybeats");
    setMessage("");
    setError("");
  }

  if (loading && !session) {
    return (
      <div style={styles.loadingScreen}>
        Loading Tellem Beat Store...
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.logo} onClick={goHome}>
          TELLEM BEAT STORE
        </div>

        <nav style={styles.nav}>
          <button
            type="button"
            onClick={goHome}
            style={styles.navButton}
          >
            Home
          </button>

          <button
            type="button"
            onClick={goBrowse}
            style={styles.navButton}
          >
            Browse Beats
          </button>

          {session && (
            <>
              <button
                type="button"
                onClick={openArtistDashboard}
                style={styles.navButton}
              >
                Artist Dashboard
              </button>

              <button
                type="button"
                onClick={openProducerDashboard}
                style={styles.navButton}
              >
                Producer Dashboard
              </button>

              <button
                type="button"
                onClick={openMyBeats}
                style={styles.navButton}
              >
                My Beats
              </button>

              <button
                type="button"
                onClick={openAdminDashboard}
                style={styles.adminButton}
              >
                Admin Dashboard
              </button>
            </>
          )}

          {!session ? (
            <>
              <button
                type="button"
                onClick={openSignIn}
                style={styles.navButton}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={openSignUp}
                style={styles.primaryButton}
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              <div style={styles.accountArea}>
                <button
                  type="button"
                  onClick={() =>
                    openProducerProfile(session.user.id)
                  }
                  style={styles.profileButton}
                  title="View Profile"
                >
                  {producerAvatar ? (
                    <img
                      src={producerAvatar}
                      alt="Profile"
                      style={styles.headerAvatar}
                    />
                  ) : (
                    <div style={styles.headerAvatarFallback}>
                      👤
                    </div>
                  )}
                </button>

                <span style={styles.email}>
                  {session.user.email}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                style={styles.navButton}
              >
                Sign Out
              </button>
            </>
          )}
        </nav>
      </header>

      <main>
        {page === "home" && (
          <>
            <section style={styles.hero}>
              <p style={styles.smallTitle}>
                GHANA • AFRICA • SOUND
              </p>

              <h1 style={styles.heroTitle}>
                Find Your Next Sound.
              </h1>

              <p style={styles.heroText}>
                Discover original beats from producers and
                creators around the world.
              </p>

              <div style={styles.heroButtons}>
                <button
                  type="button"
                  onClick={goBrowse}
                  style={styles.primaryButton}
                >
                  Browse Beats
                </button>

                <button
                  type="button"
                  onClick={openArtistDashboard}
                  style={styles.secondaryButton}
                >
                  Join as Artist
                </button>

                <button
                  type="button"
                  onClick={openProducerDashboard}
                  style={styles.secondaryButton}
                >
                  Join as Producer
                </button>
              </div>
            </section>

            <LatestBeats />
          </>
        )}

        {page === "browse" && (
          <BrowseBeats
            onBackHome={goHome}
            onNavigate={handleNavigate}
          />
        )}

        {page === "producer-profile" &&
          selectedProducerId && (
            <ProducerProfile
              producerId={selectedProducerId}
              onNavigate={handleNavigate}
            />
          )}

        {page === "artist" && session && (
          <ArtistDashboard
            user={session.user}
            onNavigate={handleNavigate}
          />
        )}

        {page === "producer" && session && (
          <ProducerDashboard
            user={session.user}
            onUploadBeat={openUploadBeat}
            onNavigate={handleNavigate}
          />
        )}

        {page === "admin" && session && (
          <AdminDashboard
            user={session.user}
            onNavigate={handleNavigate}
          />
        )}

        {page === "upload" && session && (
          <UploadBeat
            user={session.user}
            onCancel={openProducerDashboard}
          />
        )}

        {page === "mybeats" && session && (
          <MyBeats
            user={session.user}
            onEditBeat={openEditBeat}
            onNavigate={handleNavigate}
          />
        )}

        {page === "editbeat" &&
          session &&
          editingBeat && (
            <EditBeat
              beat={editingBeat}
              onSaved={returnToMyBeats}
              onCancel={returnToMyBeats}
            />
          )}

        {page === "auth" && (
          <section style={styles.authSection}>
            <div style={styles.authCard}>
              <p style={styles.smallTitle}>
                TELLEM BEAT STORE
              </p>

              <h1 style={styles.authTitle}>
                {authMode === "signin"
                  ? "Welcome Back"
                  : "Create Your Account"}
              </h1>

              <p style={styles.authText}>
                {authMode === "signin"
                  ? "Sign in to continue to your Tellem Beat Store account."
                  : "Create an account to discover beats, connect with producers and build your music profile."}
              </p>

              <form onSubmit={handleAuth}>
                <label style={styles.label}>
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  style={styles.input}
                  required
                />

                <label style={styles.label}>
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  style={styles.input}
                  required
                  minLength={6}
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
                  style={styles.primaryButton}
                  disabled={loading}
                >
                  {loading
                    ? "Please wait..."
                    : authMode === "signin"
                    ? "Sign In"
                    : "Create Account"}
                </button>
              </form>

              <div style={styles.switchAuth}>
                {authMode === "signin" ? (
                  <>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={openSignUp}
                      style={styles.linkButton}
                    >
                      Sign Up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={openSignIn}
                      style={styles.linkButton}
                    >
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer style={styles.footer}>
        <p>
          © 2026 Tellem Beat Store. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#0b0b0f",
    color: "#fff",
    fontFamily: "Arial, sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    padding: "20px 30px",
    borderBottom: "1px solid #222",
    background: "#0f0f14",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },

  logo: {
    fontSize: "18px",
    fontWeight: "bold",
    letterSpacing: "1px",
    cursor: "pointer",
  },

  nav: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  navButton: {
    background: "transparent",
    border: "none",
    color: "#ddd",
    cursor: "pointer",
    padding: "9px 10px",
  },

  adminButton: {
    background: "#7c3aed",
    border: "none",
    borderRadius: "7px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "9px 12px",
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

  secondaryButton: {
    background: "transparent",
    border: "1px solid #555",
    borderRadius: "7px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "12px 18px",
  },

  accountArea: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
  },

  profileButton: {
    padding: 0,
    margin: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  headerAvatar: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid #ffb703",
    display: "block",
  },

  headerAvatarFallback: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    background: "#15151b",
    border: "2px solid #555",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
  },

  email: {
    color: "#888",
    fontSize: "13px",
    maxWidth: "240px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  hero: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "100px 30px 70px",
  },

  smallTitle: {
    color: "#ffb703",
    letterSpacing: "3px",
    fontSize: "12px",
    fontWeight: "bold",
    margin: 0,
  },

  heroTitle: {
    fontSize: "58px",
    lineHeight: 1.05,
    maxWidth: "700px",
    margin: "15px 0",
  },

  heroText: {
    color: "#999",
    fontSize: "18px",
    lineHeight: 1.6,
    maxWidth: "650px",
  },

  heroButtons: {
    display: "flex",
    gap: "12px",
    marginTop: "30px",
    flexWrap: "wrap",
  },

  authSection: {
    maxWidth: "500px",
    margin: "0 auto",
    padding: "80px 30px 100px",
  },

  authCard: {
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    padding: "30px",
  },

  authTitle: {
    fontSize: "36px",
    margin: "10px 0",
  },

  authText: {
    color: "#888",
    lineHeight: 1.6,
    marginBottom: "25px",
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

  switchAuth: {
    marginTop: "25px",
    color: "#888",
    fontSize: "14px",
    textAlign: "center",
  },

  linkButton: {
    background: "none",
    border: "none",
    color: "#ffb703",
    cursor: "pointer",
    padding: 0,
    fontWeight: "bold",
  },

  loadingScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0b0b0f",
    color: "#ffb703",
    fontFamily: "Arial, sans-serif",
  },

  footer: {
    borderTop: "1px solid #222",
    padding: "25px 30px",
    color: "#666",
    textAlign: "center",
    fontSize: "13px",
  },
};

export default App;