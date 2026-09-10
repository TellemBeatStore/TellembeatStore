import { useEffect, useState } from "react";
import heroWoman from "./assets/HERO WOMAN.png";
import heroManWoman from "./assets/HERO MAN AND WOMAN.png";
import LatestBeats from "./LatestBeats";
import BrowseBeats from "./BrowseBeats";
import ProducerDashboard from "./ProducerDashboard";
import ArtistDashboard from "./ArtistDashboard";
import UploadBeat from "./UploadBeat";
import UploadDrumPack from "./UploadDrumPack";
import DrumPacks from "./DrumPacks";
import Albums from "./Albums";
import Playlists from "./Playlists";
import MyBeats from "./MyBeats";
import MyDrumPacks from "./MyDrumPacks";
import EditBeat from "./EditBeat";
import ProducerProfile from "./ProducerProfile";
import AdminDashboard from "./AdminDashboard";
import NotificationBell from "./NotificationBell";
import Messages from "./Messages";
import AppealBeat from "./AppealBeat";
import { supabase } from "./supabaseClient";
import "./App.css";

/*
 * Convert a producer display name into a clean public URL slug.
 *
 * Example:
 * Tellembeatzgo -> tellembeatzgo
 * Candy Boy Tellem -> candy-boy-tellem
 */
function createProducerSlug(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/*
 * Read the current browser URL and convert it into
 * the internal page name used by the existing application.
 */
function getRouteFromUrl() {
  const pathname =
    window.location.pathname.replace(/\/+$/, "") || "/";

  const searchParams = new URLSearchParams(
    window.location.search
  );

  /*
   * Keep existing beat-detail URLs working.
   *
   * Example:
   * /?beat=0cd8029a-246d-4e46-8fed-465767e2920f
   */
  if (searchParams.get("beat")) {
    return {
      page: "browse",
      producerSlug: null,
      beatId: searchParams.get("beat"),
    };
  }

  if (pathname === "/") {
    return {
      page: "home",
      producerSlug: null,
      beatId: null,
    };
  }

  if (pathname === "/beats") {
    return {
      page: "browse",
      producerSlug: null,
      beatId: null,
    };
  }

  if (pathname === "/drum-packs") {
    return {
      page: "drum-packs",
      producerSlug: null,
      beatId: null,
    };
  }

  if (pathname === "/contact") {
    return {
      page: "contact",
      producerSlug: null,
      beatId: null,
    };
  }

  /*
   * Public producer profile:
   *
   * /producer/tellembeatzgo
   */
  const producerMatch =
    pathname.match(/^\/producer\/([^/]+)$/i);

  if (producerMatch) {
    return {
      page: "producer-profile",
      producerSlug: decodeURIComponent(
        producerMatch[1]
      ),
      beatId: null,
    };
  }

  /*
   * Unknown public path.
   * The application will show the home page rather than
   * breaking the entire application.
   */
  return {
    page: "home",
    producerSlug: null,
    beatId: null,
  };
}

function App() {
  const initialRoute = getRouteFromUrl();

  const [page, setPage] = useState(
    initialRoute.page
  );
  const [authMode, setAuthMode] = useState("signin");
  const [signupType, setSignupType] = useState(null);

  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const [editingBeat, setEditingBeat] = useState(null);
  const [selectedProducerId, setSelectedProducerId] =
    useState(null);
  const [producerAvatar, setProducerAvatar] = useState("");
  const [producerName, setProducerName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [dashboardOpen, setDashboardOpen] = useState(true);

  const [messageRecipientId, setMessageRecipientId] =
    useState(null);
  const [messageId, setMessageId] = useState(null);

  const [
    selectedAppealNotification,
    setSelectedAppealNotification,
  ] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] =
    useState("");
  const [isPasswordRecovery, setIsPasswordRecovery] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSubject, setContactSubject] =
    useState("");
  const [contactMessage, setContactMessage] =
    useState("");
  const [contactSending, setContactSending] =
    useState(false);

  /*
   * Update browser URL without doing a full page reload.
   *
   * This gives us real URLs while preserving the existing
   * single-page application behaviour.
   */
  function updateBrowserUrl(path, replace = false) {
    if (
      window.location.pathname === path &&
      !window.location.search &&
      !window.location.hash
    ) {
      return;
    }

    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
  }

  /*
   * Update SEO information whenever a public page changes.
   */
  function updateSeo(pageName, producerDisplayName = "") {
    let title = "Tellem Beat Store";
    let description =
      "Discover premium original beats from talented producers on Tellem Beat Store.";

    if (pageName === "browse") {
      title =
        "Buy & Download Beats | Tellem Beat Store";

      description =
        "Browse and discover original Afrobeats, Amapiano, Ghanaian Drill, Trap, Dancehall and Hiplife beats on Tellem Beat Store.";
    }

    if (pageName === "drum-packs") {
      title =
        "Drum Packs | Tellem Beat Store";

      description =
        "Discover drum packs and production sounds from producers on Tellem Beat Store.";
    }

    if (pageName === "contact") {
      title =
        "Contact Tellem Beat Store";

      description =
        "Contact Tellem Beat Store about beats, licensing, purchases, producers and account support.";
    }

    if (
      pageName === "producer-profile" &&
      producerDisplayName
    ) {
      title =
        `${producerDisplayName} | Producer Profile | Tellem Beat Store`;

      description =
        `Listen to and discover beats by ${producerDisplayName} on Tellem Beat Store.`;
    }

    document.title = title;

    let metaDescription =
      document.querySelector(
        'meta[name="description"]'
      );

    if (!metaDescription) {
      metaDescription =
        document.createElement("meta");

      metaDescription.setAttribute(
        "name",
        "description"
      );

      document.head.appendChild(metaDescription);
    }

    metaDescription.setAttribute(
      "content",
      description
    );
  }

  async function loadUserProfile(
    userId,
    fallbackUser = null
  ) {
    if (!userId) {
      setProducerAvatar("");
      setProducerName("");
      setUserRole(null);
      setIsAdmin(false);
      return;
    }

    const metadataAccountType =
      fallbackUser?.user_metadata?.account_type ||
      fallbackUser?.user_metadata?.role ||
      null;

    const {
      data: producerData,
      error: producerError,
    } = await supabase
      .from("producers")
      .select(
        "avatar_url, display_name, role"
      )
      .eq("id", userId)
      .maybeSingle();

    if (producerError) {
      console.error(
        "Unable to load user profile:",
        producerError.message
      );

      setProducerAvatar("");

      setProducerName(
        fallbackUser?.user_metadata?.display_name ||
          fallbackUser?.user_metadata?.name ||
          fallbackUser?.email?.split("@")[0] ||
          ""
      );

      setUserRole(
        metadataAccountType || "guest"
      );

      setIsAdmin(false);

      return;
    }

    let role = metadataAccountType;

    if (!role) {
      role = producerData?.role || "guest";
    }

    setProducerAvatar(
      producerData?.avatar_url || ""
    );

    setProducerName(
      producerData?.display_name ||
        fallbackUser?.user_metadata?.display_name ||
        fallbackUser?.user_metadata?.name ||
        fallbackUser?.email?.split("@")[0] ||
        ""
    );

    setUserRole(role);
    setIsAdmin(role === "admin");
  }

  /*
   * Creates the Producer profile only after the user has
   * an authenticated Supabase session.
   */
  async function ensureProducerProfile(user) {
    if (!user?.id) return;

    const accountType =
      user.user_metadata?.account_type ||
      user.user_metadata?.role ||
      null;

    if (accountType !== "producer") return;

    const displayName =
      user.user_metadata?.display_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Producer";

    const {
      data: existingProfile,
      error: profileCheckError,
    } = await supabase
      .from("producers")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileCheckError) {
      console.error(
        "Unable to check Producer profile:",
        profileCheckError.message
      );
      return;
    }

    if (existingProfile) {
      return;
    }

    const {
      error: producerProfileError,
    } = await supabase
      .from("producers")
      .insert({
        id: user.id,
        display_name: displayName,
        bio: null,
        avatar_url: null,
        contact_info: null,
        role: "producer",
      });

    if (producerProfileError) {
      console.error(
        "Producer profile creation error:",
        producerProfileError.message
      );
      return;
    }

    console.log(
      "Producer profile created successfully."
    );
  }

  async function checkAdminStatus(userId) {
    if (!userId) {
      setIsAdmin(false);
      return;
    }

    const {
      data: producerData,
      error: producerError,
    } = await supabase
      .from("producers")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (producerError) {
      console.error(
        "Unable to check administrator status:",
        producerError.message
      );

      setIsAdmin(false);
      return;
    }

    setIsAdmin(
      producerData?.role === "admin"
    );
  }

  /*
   * Resolve a public producer URL back to the Supabase
   * producer ID.
   *
   * Example:
   * /producer/tellembeatzgo
   *
   * -> finds display_name "Tellembeatzgo"
   * -> gets its producer UUID
   */
  async function resolveProducerSlug(slug) {
    if (!slug) return null;

    try {
      const {
        data: producerRows,
        error: producerError,
      } = await supabase
        .from("producers")
        .select("id, display_name");

      if (producerError) {
        console.error(
          "Unable to resolve producer URL:",
          producerError.message
        );

        return null;
      }

      const normalizedSlug =
        createProducerSlug(slug);

      const matchedProducer =
        (producerRows || []).find(
          (producerRow) =>
            createProducerSlug(
              producerRow.display_name
            ) === normalizedSlug
        );

      return matchedProducer?.id || null;
    } catch (resolveError) {
      console.error(
        "Producer URL resolution error:",
        resolveError
      );

      return null;
    }
  }

  /*
   * Load the initial public URL.
   *
   * This is especially important when someone opens:
   * https://tellembeatstore.netlify.app/producer/tellembeatzgo
   *
   * directly or refreshes that page.
   */
  useEffect(() => {
    let mounted = true;

    async function loadInitialRoute() {
      const route = getRouteFromUrl();

      if (!mounted) return;

      if (
        route.page ===
        "producer-profile"
      ) {
        setPage("producer-profile");

        const producerId =
          await resolveProducerSlug(
            route.producerSlug
          );

        if (!mounted) return;

        if (producerId) {
          setSelectedProducerId(
            producerId
          );

          updateSeo(
            "producer-profile",
            route.producerSlug
          );
        } else {
          setSelectedProducerId(null);
          setPage("home");
          updateBrowserUrl("/", true);
          updateSeo("home");
        }

        return;
      }

      setPage(route.page);

      if (route.page === "browse") {
        updateSeo("browse");
      } else if (
        route.page === "drum-packs"
      ) {
        updateSeo("drum-packs");
      } else if (
        route.page === "contact"
      ) {
        updateSeo("contact");
      } else {
        updateSeo("home");
      }
    }

    loadInitialRoute();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * Browser Back / Forward support.
   */
  useEffect(() => {
    let mounted = true;

    async function handlePopState() {
      const route = getRouteFromUrl();

      if (!mounted) return;

      if (
        route.page ===
        "producer-profile"
      ) {
        setPage("producer-profile");

        const producerId =
          await resolveProducerSlug(
            route.producerSlug
          );

        if (!mounted) return;

        if (producerId) {
          setSelectedProducerId(
            producerId
          );

          updateSeo(
            "producer-profile",
            route.producerSlug
          );
        } else {
          setSelectedProducerId(null);
          setPage("home");
          updateBrowserUrl("/", true);
          updateSeo("home");
        }

        return;
      }

      setSelectedProducerId(null);
      setPage(route.page);

      if (route.page === "browse") {
        updateSeo("browse");
      } else if (
        route.page === "drum-packs"
      ) {
        updateSeo("drum-packs");
      } else if (
        route.page === "contact"
      ) {
        updateSeo("contact");
      } else {
        updateSeo("home");
      }
    }

    window.addEventListener(
      "popstate",
      handlePopState
    );

    return () => {
      mounted = false;

      window.removeEventListener(
        "popstate",
        handlePopState
      );
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const recoveryInUrl =
      window.location.hash.includes(
        "type=recovery"
      ) ||
      window.location.search.includes(
        "type=recovery"
      );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (!mounted) return;

        if (
          _event === "PASSWORD_RECOVERY"
        ) {
          setIsPasswordRecovery(true);
          setPage("reset-password");
          setMessage("");
          setError("");
          setNewPassword("");
          setConfirmNewPassword("");
        }

        setSession(currentSession);

        setTimeout(async () => {
          if (!mounted) return;

          if (currentSession?.user?.id) {
            await ensureProducerProfile(
              currentSession.user
            );

            await loadUserProfile(
              currentSession.user.id,
              currentSession.user
            );

            await checkAdminStatus(
              currentSession.user.id
            );
          } else {
            setProducerAvatar("");
            setProducerName("");
            setUserRole(null);
            setIsAdmin(false);
          }

          if (mounted) {
            setLoading(false);
          }
        }, 0);
      }
    );

    async function getSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (recoveryInUrl) {
        setIsPasswordRecovery(true);
        setPage("reset-password");
        setMessage("");
        setError("");
        setNewPassword("");
        setConfirmNewPassword("");
      }

      setSession(currentSession);

      if (currentSession?.user?.id) {
        await ensureProducerProfile(
          currentSession.user
        );

        await loadUserProfile(
          currentSession.user.id,
          currentSession.user
        );

        await checkAdminStatus(
          currentSession.user.id
        );
      } else {
        setProducerAvatar("");
        setProducerName("");
        setUserRole(null);
        setIsAdmin(false);
      }

      if (mounted) {
        setLoading(false);
      }
    }

    getSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleAuth(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (authMode === "forgot") {
      if (!email.trim()) {
        setError(
          "Please enter your email address."
        );
        return;
      }

      setLoading(true);

      const {
        error: resetError,
      } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo:
              `${window.location.origin}/`,
          }
        );

      setLoading(false);

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage(
        "Password reset instructions have been sent to your email."
      );

      return;
    }

    if (!email.trim() || !password) {
      setError(
        "Please enter your email and password."
      );
      return;
    }

    if (
      authMode === "signup" &&
      !signupType
    ) {
      setError(
        "Please choose whether you are signing up as a Producer or Guest."
      );
      return;
    }

    setLoading(true);

    if (authMode === "signup") {
      const accountType =
        signupType === "producer"
          ? "producer"
          : "guest";

      const {
        data,
        error: signUpError,
      } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              account_type: accountType,
              role: accountType,
            },
          },
        });

      if (signUpError) {
        setLoading(false);
        setError(signUpError.message);
        return;
      }

      if (
        accountType === "producer" &&
        data?.session?.user?.id
      ) {
        await ensureProducerProfile(
          data.session.user
        );
      }

      setLoading(false);

      if (data.session) {
        setSession(data.session);

        await loadUserProfile(
          data.session.user.id,
          data.session.user
        );

        await checkAdminStatus(
          data.session.user.id
        );

        setMessage(
          accountType === "producer"
            ? "Producer account created successfully."
            : "Guest account created successfully."
        );

        setSignupType(null);
        setPage("home");

        updateBrowserUrl("/", true);
        updateSeo("home");
      } else {
        setMessage(
          accountType === "producer"
            ? "Producer account created successfully! Check your email to confirm your account."
            : "Guest account created successfully! Check your email to confirm your account."
        );
      }

      return;
    }

    const {
      data,
      error: signInError,
    } =
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

    await ensureProducerProfile(
      data.session.user
    );

    await loadUserProfile(
      data.session.user.id,
      data.session.user
    );

    await checkAdminStatus(
      data.session.user.id
    );

    setMessage(
      "Signed in successfully."
    );

    setPage("home");

    updateBrowserUrl("/", true);
    updateSeo("home");
  }

  async function handlePasswordReset(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (newPassword.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (
      newPassword !==
      confirmNewPassword
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    setLoading(true);

    const {
      error: updateError,
    } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNewPassword("");
    setConfirmNewPassword("");
    setIsPasswordRecovery(false);

    await supabase.auth.signOut();

    setSession(null);
    setProducerAvatar("");
    setProducerName("");
    setUserRole(null);
    setIsAdmin(false);
    setPage("auth");
    setAuthMode("signin");

    setMessage(
      "Your password has been updated successfully. Please sign in with your new password."
    );
  }

  async function handleSignOut() {
    setMessage("");
    setError("");

    const {
      error: signOutError,
    } =
      await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    setSession(null);
    setProducerAvatar("");
    setProducerName("");
    setUserRole(null);
    setIsAdmin(false);
    setEditingBeat(null);
    setSelectedProducerId(null);
    setMessageRecipientId(null);
    setMessageId(null);
    setSelectedAppealNotification(null);
    setSignupType(null);
    setPage("home");

    updateBrowserUrl("/", true);
    updateSeo("home");

    setMessage(
      "Signed out successfully."
    );
  }

  function openSignIn() {
    setAuthMode("signin");
    setSignupType(null);
    setEmail("");
    setPassword("");
    setPage("auth");
    setMessage("");
    setError("");
  }

  function openSignUp() {
    setAuthMode("signup");
    setSignupType(null);
    setEmail("");
    setPassword("");
    setPage("auth");
    setMessage("");
    setError("");
  }

  function openForgotPassword() {
    setAuthMode("forgot");
    setSignupType(null);
    setEmail("");
    setPassword("");
    setPage("auth");
    setMessage("");
    setError("");
  }

  function chooseSignupType(type) {
    setSignupType(type);
    setMessage("");
    setError("");
  }

  function openProducerDashboard() {
    if (!session) {
      openSignIn();
      return;
    }

    if (
      !isAdmin &&
      userRole !== "producer"
    ) {
      setError(
        "Producer access only. Guest accounts cannot access the Producer Dashboard."
      );
      return;
    }

    setPage("producer");
    setMessage("");
    setError("");
  }

  function openArtistDashboard() {
    if (!session) {
      openSignIn();
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

    if (!isAdmin) {
      setError(
        "Access denied. Administrator privileges are required."
      );
      return;
    }

    setPage("admin");
    setMessage("");
    setError("");
  }

  function openMessages(options = {}) {
    if (!session) {
      openSignIn();
      return;
    }

    if (
      options?.openAppeal &&
      options?.notification
    ) {
      setSelectedAppealNotification(
        options.notification
      );

      setMessageRecipientId(null);
      setMessageId(null);

      setPage("appeal");
      setMessage("");
      setError("");

      return;
    }

    if (
      options?.openAdminAppeal &&
      options?.notification
    ) {
      setSelectedAppealNotification(
        options.notification
      );

      setMessageRecipientId(null);
      setMessageId(null);

      setPage("admin");
      setMessage("");
      setError("");

      return;
    }

    setMessageRecipientId(
      options?.recipientId || null
    );

    setMessageId(
      options?.messageId || null
    );

    setSelectedAppealNotification(null);

    setPage("messages");
    setMessage("");
    setError("");
  }

  function openAppeal(notification) {
    if (!session) {
      openSignIn();
      return;
    }

    setSelectedAppealNotification(
      notification || null
    );

    setPage("appeal");
    setMessage("");
    setError("");
  }

  function openUploadBeat() {
    if (!session) {
      openSignIn();
      return;
    }

    if (
      !isAdmin &&
      userRole !== "producer"
    ) {
      setError(
        "Guest accounts cannot upload beats. Please create a Producer account to upload and sell beats."
      );
      return;
    }

    setPage("upload");
    setMessage("");
    setError("");
  }

  function openUploadDrumPack() {
    if (!session) {
      openSignIn();
      return;
    }

    if (
      !isAdmin &&
      userRole !== "producer"
    ) {
      setError(
        "Guest accounts cannot upload drum packs. Please create a Producer account."
      );
      return;
    }

    setPage("upload-drum-pack");
    setMessage("");
    setError("");
  }

  function openDrumPacks() {
    setEditingBeat(null);
    setSelectedProducerId(null);
    setPage("drum-packs");
    setMessage("");
    setError("");

    updateBrowserUrl("/drum-packs");
    updateSeo("drum-packs");
  }

  function openAlbums() {
    if (!session) {
      openSignIn();
      return;
    }

    setPage("albums");
    setMessage("");
    setError("");
  }

  function openPlaylists() {
    if (!session) {
      openSignIn();
      return;
    }

    setPage("playlists");
    setMessage("");
    setError("");
  }

  function openMyBeats() {
    if (!session) {
      openSignIn();
      return;
    }

    if (
      !isAdmin &&
      userRole !== "producer"
    ) {
      setError(
        "Guest accounts do not have producer uploads."
      );
      return;
    }

    setPage("mybeats");
    setMessage("");
    setError("");
  }

  function openMyDrumPacks() {
    if (!session) {
      openSignIn();
      return;
    }

    if (
      !isAdmin &&
      userRole !== "producer"
    ) {
      setError(
        "Guest accounts do not have producer uploads."
      );
      return;
    }

    setPage("my-drum-packs");
    setMessage("");
    setError("");
  }

  function openEditBeat(beat) {
    if (!session) {
      openSignIn();
      return;
    }

    if (
      !isAdmin &&
      userRole !== "producer"
    ) {
      setError(
        "Guest accounts cannot edit beats."
      );
      return;
    }

    setEditingBeat(beat);
    setPage("editbeat");
    setMessage("");
    setError("");
  }

  /*
   * Open a producer profile using a real SEO-friendly URL.
   *
   * The child components still send the producer UUID,
   * so none of their existing functionality needs to change.
   */
  async function openProducerProfile(
    producerId
  ) {
    if (!producerId) {
      setError(
        "Producer profile is not available."
      );
      return;
    }

    setSelectedProducerId(
      producerId
    );

    setPage("producer-profile");
    setMessage("");
    setError("");

    try {
      const {
        data: producerData,
        error: producerError,
      } = await supabase
        .from("producers")
        .select(
          "id, display_name"
        )
        .eq("id", producerId)
        .maybeSingle();

      if (producerError) {
        console.error(
          "Unable to load producer URL:",
          producerError.message
        );

        /*
         * Keep the profile functional even if the
         * display name lookup fails.
         */
        updateBrowserUrl(
          `/producer/${encodeURIComponent(
            producerId
          )}`
        );

        updateSeo(
          "producer-profile",
          "Producer"
        );

        return;
      }

      const slug = createProducerSlug(
        producerData?.display_name
      );

      if (!slug) {
        updateBrowserUrl(
          `/producer/${encodeURIComponent(
            producerId
          )}`
        );

        updateSeo(
          "producer-profile",
          "Producer"
        );

        return;
      }

      updateBrowserUrl(
        `/producer/${encodeURIComponent(
          slug
        )}`
      );

      updateSeo(
        "producer-profile",
        producerData.display_name
      );
    } catch (profileError) {
      console.error(
        "Unable to create producer URL:",
        profileError
      );
    }
  }

  function openContact() {
    setEditingBeat(null);
    setSelectedProducerId(null);
    setPage("contact");
    setMessage("");
    setError("");

    updateBrowserUrl("/contact");
    updateSeo("contact");
  }

  async function handleContactSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (
      !contactName.trim() ||
      !contactEmail.trim() ||
      !contactSubject.trim() ||
      !contactMessage.trim()
    ) {
      setError(
        "Please complete all contact form fields."
      );
      return;
    }

    setContactSending(true);

    const {
      error: contactError,
    } = await supabase
      .from("contact_messages")
      .insert({
        name: contactName.trim(),
        email: contactEmail.trim(),
        subject: contactSubject.trim(),
        message: contactMessage.trim(),
      });

    setContactSending(false);

    if (contactError) {
      console.error(
        "Contact form error:",
        contactError.message
      );

      setError(
        "We could not send your message right now. Please try again."
      );

      return;
    }

    setContactName("");
    setContactEmail("");
    setContactSubject("");
    setContactMessage("");

    setMessage(
      "Thank you. Your message has been received. Our team will get back to you soon."
    );
  }

  function handleNavigate(
    nextPage,
    data
  ) {
    if (
      nextPage ===
      "producer-profile"
    ) {
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

    if (nextPage === "contact") {
      openContact();
      return;
    }

    if (nextPage === "admin") {
      openAdminDashboard();
      return;
    }

    if (nextPage === "messages") {
      if (
        data &&
        typeof data === "object"
      ) {
        openMessages(data);
      } else {
        openMessages();
      }

      return;
    }

    if (nextPage === "appeal") {
      openAppeal(data);
      return;
    }

    if (nextPage === "upload") {
      openUploadBeat();
      return;
    }

    if (
      nextPage ===
      "upload-drum-pack"
    ) {
      openUploadDrumPack();
      return;
    }

    if (
      nextPage === "drum-packs"
    ) {
      openDrumPacks();
      return;
    }

    if (nextPage === "albums") {
      openAlbums();
      return;
    }

    if (nextPage === "playlists") {
      openPlaylists();
      return;
    }

    if (nextPage === "mybeats") {
      openMyBeats();
      return;
    }

    if (
      nextPage ===
      "my-drum-packs"
    ) {
      openMyDrumPacks();
      return;
    }

    if (nextPage === "producer") {
      openProducerDashboard();
      return;
    }

    if (nextPage === "artist") {
      openArtistDashboard();
      return;
    }

    setPage(nextPage);
  }

  function goHome() {
    setEditingBeat(null);
    setSelectedProducerId(null);
    setMessageRecipientId(null);
    setMessageId(null);
    setSelectedAppealNotification(null);

    setPage("home");
    setMessage("");
    setError("");

    updateBrowserUrl("/");
    updateSeo("home");
  }

  function goBrowse() {
    setEditingBeat(null);
    setSelectedProducerId(null);
    setMessageRecipientId(null);
    setMessageId(null);
    setSelectedAppealNotification(null);

    setPage("browse");
    setMessage("");
    setError("");

    updateBrowserUrl("/beats");
    updateSeo("browse");
  }

  function returnToMyBeats() {
    setEditingBeat(null);
    setPage("mybeats");
    setMessage("");
    setError("");
  }

  function handleSearch(event) {
    event.preventDefault();
    goBrowse();
  }

  if (
    isPasswordRecovery &&
    page === "reset-password"
  ) {
    return (
      <div className="app">
        <main className="app-main">
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-brand">
                <div className="auth-brand-mark">
                  T
                </div>

                <span>
                  TELLEM BEAT STORE
                </span>
              </div>

              <div className="auth-eyebrow">
                ACCOUNT RECOVERY
              </div>

              <h1>
                Reset Your Password
              </h1>

              <p className="auth-description">
                Enter a new password for your
                Tellem Beat Store account.
              </p>

              <form
                onSubmit={
                  handlePasswordReset
                }
              >
                <label>
                  New Password
                </label>

                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(
                      event.target.value
                    )
                  }
                  placeholder="Enter your new password"
                  required
                  minLength={6}
                  autoFocus
                />

                <label>
                  Confirm New Password
                </label>

                <input
                  type="password"
                  value={
                    confirmNewPassword
                  }
                  onChange={(event) =>
                    setConfirmNewPassword(
                      event.target.value
                    )
                  }
                  placeholder="Confirm your new password"
                  required
                  minLength={6}
                />

                {error && (
                  <div className="auth-message error">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="auth-message success">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  className="auth-submit"
                  disabled={loading}
                >
                  {loading
                    ? "UPDATING PASSWORD..."
                    : "UPDATE PASSWORD"}
                </button>
              </form>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (
    loading &&
    !session
  ) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            TELLEM
          </div>

          <div className="loading-line"></div>

          <p>
            Loading Beat Store...
          </p>
        </div>
      </div>
    );
  }

  const displayName =
    producerName ||
    session?.user?.user_metadata
      ?.display_name ||
    session?.user?.user_metadata
      ?.name ||
    session?.user?.email?.split(
      "@"
    )[0] ||
    "Artist";

  const isProducer =
    isAdmin ||
    userRole === "producer";

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div
            className="logo"
            onClick={goHome}
          >
            <div className="logo-mark">
              T
            </div>

            <div>
              <span>
                TELLEM
              </span>{" "}
              BEAT STORE
            </div>
          </div>

          <nav className="nav">
            <button
              type="button"
              onClick={goHome}
              className={
                page === "home"
                  ? "active"
                  : ""
              }
            >
              HOME
            </button>

            <button
              type="button"
              onClick={goBrowse}
              className={
                page === "browse"
                  ? "active"
                  : ""
              }
            >
              BEATS
            </button>

            <button
              type="button"
              onClick={openDrumPacks}
              className={
                page === "drum-packs"
                  ? "active"
                  : ""
              }
            >
              DRUM PACKS
            </button>

            <button
              type="button"
              onClick={openContact}
              className={
                page === "contact"
                  ? "active"
                  : ""
              }
            >
              CONTACT
            </button>

            {session &&
              isAdmin && (
                <button
                  type="button"
                  onClick={
                    openAdminDashboard
                  }
                  className={`admin-nav-button ${
                    page === "admin"
                      ? "active"
                      : ""
                  }`}
                >
                  ADMIN
                </button>
              )}
          </nav>

          {page === "browse" && (
            <div
              id="browse-header-filters"
              className="browse-header-filters"
            />
          )}

          <div className="header-hero-image">
            <img
              src={heroManWoman}
              alt=""
              aria-hidden="true"
            />

            <div className="header-hero-overlay"></div>
          </div>

          <div className="header-actions">
            {!session ? (
              <>
                <button
                  type="button"
                  onClick={openSignIn}
                  className="header-button"
                >
                  SIGN IN
                </button>

                <button
                  type="button"
                  onClick={openSignUp}
                  className="header-button primary"
                >
                  SIGN UP
                </button>
              </>
            ) : (
              <div className="account-area">
                <NotificationBell
                  user={session.user}
                  onOpenMessages={
                    openMessages
                  }
                  onOpenAppeal={
                    openAppeal
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    openProducerProfile(
                      session.user.id
                    )
                  }
                  className="profile-button"
                  title="View Profile"
                >
                  {producerAvatar ? (
                    <img
                      src={
                        producerAvatar
                      }
                      alt={
                        displayName
                      }
                      className="header-avatar"
                    />
                  ) : (
                    <div className="header-avatar-fallback">
                      👤
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openProducerProfile(
                      session.user.id
                    )
                  }
                  className="account-profile-name"
                  title="View Profile"
                >
                  {displayName}
                </button>

                <button
                  type="button"
                  onClick={
                    handleSignOut
                  }
                  className="header-button"
                >
                  SIGN OUT
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {session && (
        <aside className="dashboard-sidebar">
          <button
            type="button"
            className="dashboard-toggle"
            onClick={() =>
              setDashboardOpen(
                (current) =>
                  !current
              )
            }
            aria-expanded={
              dashboardOpen
            }
          >
            <span>
              DASHBOARD
            </span>

            <span className="dashboard-toggle-arrow">
              {dashboardOpen
                ? "▲"
                : "▼"}
            </span>
          </button>

          {dashboardOpen && (
            <div className="dashboard-menu">
              <button
                type="button"
                onClick={goHome}
                className={
                  page === "home"
                    ? "dashboard-menu-item active"
                    : "dashboard-menu-item"
                }
              >
                <span>
                  ⌂
                </span>
                Return Home
              </button>

              <button
                type="button"
                onClick={goBrowse}
                className={
                  page === "browse"
                    ? "dashboard-menu-item active"
                    : "dashboard-menu-item"
                }
              >
                <span>
                  ♪
                </span>
                Search Beats
              </button>

              <button
                type="button"
                onClick={
                  openMessages
                }
                className={
                  page === "messages"
                    ? "dashboard-menu-item active"
                    : "dashboard-menu-item"
                }
              >
                <span>
                  💬
                </span>
                Messages
              </button>

              <button
                type="button"
                onClick={
                  isProducer
                    ? openProducerDashboard
                    : openArtistDashboard
                }
                className={
                  page === "producer" ||
                  page === "artist"
                    ? "dashboard-menu-item active"
                    : "dashboard-menu-item"
                }
              >
                <span>
                  ⚙
                </span>
                Settings
              </button>

              <button
                type="button"
                onClick={
                  openAlbums
                }
                className={
                  page === "albums"
                    ? "dashboard-menu-item active"
                    : "dashboard-menu-item"
                }
              >
                <span>
                  ▤
                </span>
                Albums
              </button>

              <button
                type="button"
                onClick={
                  openPlaylists
                }
                className={
                  page === "playlists"
                    ? "dashboard-menu-item active"
                    : "dashboard-menu-item"
                }
              >
                <span>
                  ♫
                </span>
                Playlists
              </button>

              {isProducer && (
                <>
                  <button
                    type="button"
                    onClick={
                      openUploadBeat
                    }
                    className={
                      page === "upload"
                        ? "dashboard-menu-item active"
                        : "dashboard-menu-item"
                    }
                  >
                    <span>
                      ↑
                    </span>
                    Upload Beat
                  </button>

                  <button
                    type="button"
                    onClick={
                      openUploadDrumPack
                    }
                    className={
                      page ===
                      "upload-drum-pack"
                        ? "dashboard-menu-item active"
                        : "dashboard-menu-item"
                    }
                  >
                    <span>
                      ▣
                    </span>
                    Upload Drum Pack
                  </button>

                  <button
                    type="button"
                    onClick={
                      openDrumPacks
                    }
                    className={
                      page ===
                      "drum-packs"
                        ? "dashboard-menu-item active"
                        : "dashboard-menu-item"
                    }
                  >
                    <span>
                      ♫
                    </span>
                    Drum Packs
                  </button>

                  <div
                    style={{
                      marginTop:
                        "10px",
                      paddingTop:
                        "12px",
                      borderTop:
                        "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        padding:
                          "0 16px 8px",
                        color:
                          "#d6a84f",
                        fontSize:
                          "10px",
                        fontWeight:
                          "900",
                        letterSpacing:
                          "1.5px",
                      }}
                    >
                      MY UPLOADS
                    </div>

                    <button
                      type="button"
                      onClick={
                        openMyBeats
                      }
                      className={
                        page ===
                        "mybeats"
                          ? "dashboard-menu-item active"
                          : "dashboard-menu-item"
                      }
                      style={{
                        paddingLeft:
                          "32px",
                        fontSize:
                          "13px",
                      }}
                    >
                      <span>
                        ♪
                      </span>
                      My Beats
                    </button>

                    <button
                      type="button"
                      onClick={
                        openMyDrumPacks
                      }
                      className={
                        page ===
                        "my-drum-packs"
                          ? "dashboard-menu-item active"
                          : "dashboard-menu-item"
                      }
                      style={{
                        paddingLeft:
                          "32px",
                        fontSize:
                          "13px",
                      }}
                    >
                      <span>
                        🥁
                      </span>
                      My Drum Packs
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      )}

      <main
        className={
          session
            ? "app-main logged-in-main"
            : "app-main"
        }
      >
        {session && (
          <div className="dashboard-hero-image">
            <img
              src={heroManWoman}
              alt="Music production studio"
            />

            <div className="dashboard-hero-overlay"></div>
          </div>
        )}

        {page === "home" && (
          <>
            <section className="hero">
              <div className="hero-content">
                <div className="hero-eyebrow">
                  GHANA • AFRICA • SOUND
                </div>

                <h1>
                  FIND.
                  <span>
                    {" "}
                    FEEL.
                  </span>
                  <strong>
                    {" "}
                    CREATE.
                  </strong>
                </h1>

                <p>
                  Discover premium original
                  beats from talented producers.
                  Find the sound that turns your
                  next idea into music.
                </p>

                <form
                  className="hero-search"
                  onSubmit={
                    handleSearch
                  }
                >
                  <span className="search-icon">
                    🔍
                  </span>

                  <input
                    type="search"
                    value={
                      searchTerm
                    }
                    onChange={(
                      event
                    ) =>
                      setSearchTerm(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Search beats by genre..."
                    aria-label="Search beats by genre"
                  />

                  <button type="submit">
                    SEARCH
                  </button>
                </form>

                <div className="hero-benefits">
                  <div className="benefit-item">
                    <span className="benefit-icon">
                      ✓
                    </span>

                    <div>
                      <strong>
                        High Quality Beats
                      </strong>

                      <small>
                        Professional sound
                      </small>
                    </div>
                  </div>

                  <div className="benefit-item">
                    <span className="benefit-icon">
                      $
                    </span>

                    <div>
                      <strong>
                        Secure Payments
                      </strong>

                      <small>
                        Safe & protected
                      </small>
                    </div>
                  </div>

                  <div className="benefit-item">
                    <span className="benefit-icon">
                      ↓
                    </span>

                    <div>
                      <strong>
                        Instant Download
                      </strong>

                      <small>
                        Get your beat fast
                      </small>
                    </div>
                  </div>
                </div>

                <div className="hero-actions">
                  <button
                    type="button"
                    onClick={
                      goBrowse
                    }
                    className="hero-button primary"
                  >
                    EXPLORE BEATS
                  </button>
                </div>
              </div>

              <div className="hero-decoration">
                <div className="hero-woman">
                  <div className="hero-neon-ring"></div>

                  <img
                    src={
                      heroWoman
                    }
                    alt="Tellem Beat Store Producer"
                  />

                  <div className="hero-glow"></div>
                </div>
              </div>
            </section>

            <section className="latest-section">
              <div className="section-container">
                <div className="section-heading">
                  <div>
                    <div className="section-kicker">
                      FRESH FROM THE PRODUCERS
                    </div>

                    <h2>
                      NEW RELEASED BEATS
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={
                      goBrowse
                    }
                    className="view-all-button"
                  >
                    VIEW ALL BEATS
                    <span>
                      →
                    </span>
                  </button>
                </div>

                <LatestBeats
                  onNavigate={
                    handleNavigate
                  }
                />
              </div>
            </section>
          </>
        )}

        {page === "messages" &&
          session && (
            <Messages
              user={
                session.user
              }
              isAdmin={
                isAdmin
              }
              onNavigate={
                handleNavigate
              }
              initialRecipientId={
                messageRecipientId
              }
              initialMessageId={
                messageId
              }
            />
          )}

        {page === "appeal" &&
          session &&
          selectedAppealNotification && (
            <AppealBeat
              user={
                session.user
              }
              notification={
                selectedAppealNotification
              }
              onNavigate={
                handleNavigate
              }
            />
          )}

        {page === "contact" && (
          <section className="contact-section">
            <div className="contact-container">
              <div className="contact-header">
                <div className="section-kicker">
                  GET IN TOUCH
                </div>

                <h1>
                  CONTACT TELLEM BEAT STORE
                </h1>

                <p>
                  Have a question about a
                  beat, licensing, purchases,
                  producers or your account?
                  Send us a message and we'll
                  get back to you.
                </p>
              </div>

              <div className="contact-grid">
                <div className="contact-info">
                  <div className="contact-card">
                    <div className="contact-icon">
                      ♪
                    </div>

                    <div>
                      <h3>
                        Beat Support
                      </h3>

                      <p>
                        Need help choosing a
                        beat or understanding
                        our licensing options?
                      </p>
                    </div>
                  </div>

                  <div className="contact-card">
                    <div className="contact-icon">
                      ♫
                    </div>

                    <div>
                      <h3>
                        Producer Support
                      </h3>

                      <p>
                        Are you a producer
                        looking to upload and
                        sell your beats on
                        Tellem Beat Store?
                      </p>
                    </div>
                  </div>

                  <div className="contact-card">
                    <div className="contact-icon">
                      @
                    </div>

                    <div>
                      <h3>
                        Customer Support
                      </h3>

                      <p>
                        Contact our team about
                        your account, downloads,
                        purchases or other
                        questions.
                      </p>
                    </div>
                  </div>
                </div>

                <form
                  className="contact-form"
                  onSubmit={
                    handleContactSubmit
                  }
                >
                  <label htmlFor="contact-name">
                    Your Name
                  </label>

                  <input
                    id="contact-name"
                    type="text"
                    value={
                      contactName
                    }
                    onChange={(
                      event
                    ) =>
                      setContactName(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Enter your name"
                    required
                  />

                  <label htmlFor="contact-email">
                    Email Address
                  </label>

                  <input
                    id="contact-email"
                    type="email"
                    value={
                      contactEmail
                    }
                    onChange={(
                      event
                    ) =>
                      setContactEmail(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="you@example.com"
                    required
                  />

                  <label htmlFor="contact-subject">
                    Subject
                  </label>

                  <input
                    id="contact-subject"
                    type="text"
                    value={
                      contactSubject
                    }
                    onChange={(
                      event
                    ) =>
                      setContactSubject(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="How can we help?"
                    required
                  />

                  <label htmlFor="contact-message">
                    Message
                  </label>

                  <textarea
                    id="contact-message"
                    rows="6"
                    value={
                      contactMessage
                    }
                    onChange={(
                      event
                    ) =>
                      setContactMessage(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Write your message..."
                    required
                  ></textarea>

                  {error && (
                    <div className="auth-message error">
                      {error}
                    </div>
                  )}

                  {message && (
                    <div className="contact-success">
                      {message}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="contact-submit"
                    disabled={
                      contactSending
                    }
                  >
                    {contactSending
                      ? "SENDING..."
                      : "SEND MESSAGE →"}
                  </button>
                </form>
              </div>

              <button
                type="button"
                onClick={
                  goHome
                }
                className="contact-back"
              >
                ← BACK TO HOME
              </button>
            </div>
          </section>
        )}

        {page === "browse" && (
          <BrowseBeats
            onBackHome={
              goHome
            }
            onNavigate={
              handleNavigate
            }
            searchTerm={
              searchTerm
            }
          />
        )}

        {page === "drum-packs" && (
          <DrumPacks />
        )}

        {page === "albums" &&
          session && (
            <Albums
              user={
                session.user
              }
              onNavigate={
                handleNavigate
              }
            />
          )}

        {page === "playlists" &&
          session && (
            <Playlists
              user={
                session.user
              }
              onNavigate={
                handleNavigate
              }
            />
          )}

        {page ===
          "producer-profile" &&
          selectedProducerId && (
            <ProducerProfile
              producerId={
                selectedProducerId
              }
              onNavigate={
                handleNavigate
              }
            />
          )}

        {page === "artist" &&
          session && (
            <ArtistDashboard
              user={
                session.user
              }
              onNavigate={
                handleNavigate
              }
            />
          )}

        {page ===
          "producer" &&
          session &&
          isProducer && (
            <ProducerDashboard
              user={
                session.user
              }
              onUploadBeat={
                openUploadBeat
              }
              onNavigate={
                handleNavigate
              }
            />
          )}

        {page === "admin" &&
          session &&
          isAdmin && (
            <AdminDashboard
              user={
                session.user
              }
              onNavigate={
                handleNavigate
              }
            />
          )}

        {page === "upload" &&
          session &&
          isProducer && (
            <UploadBeat
              user={
                session.user
              }
              onCancel={
                openProducerDashboard
              }
            />
          )}

        {page ===
          "upload-drum-pack" &&
          session &&
          isProducer && (
            <UploadDrumPack
              user={
                session.user
              }
              onCancel={
                openProducerDashboard
              }
            />
          )}

        {page === "mybeats" &&
          session &&
          isProducer && (
            <MyBeats
              user={
                session.user
              }
              onEditBeat={
                openEditBeat
              }
              onNavigate={
                handleNavigate
              }
            />
          )}

        {page ===
          "my-drum-packs" &&
          session &&
          isProducer && (
            <MyDrumPacks
              user={
                session.user
              }
              onNavigate={
                handleNavigate
              }
            />
          )}

        {page ===
          "editbeat" &&
          session &&
          isProducer &&
          editingBeat && (
            <EditBeat
              beat={
                editingBeat
              }
              onSaved={
                returnToMyBeats
              }
              onCancel={
                returnToMyBeats
              }
            />
          )}

        {page === "auth" && (
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-brand">
                <div className="auth-brand-mark">
                  T
                </div>

                <span>
                  TELLEM BEAT STORE
                </span>
              </div>

              {authMode ===
              "signup" ? (
                <>
                  <div className="auth-eyebrow">
                    JOIN THE COMMUNITY
                  </div>

                  <h1>
                    Create Your Account
                  </h1>

                  <p className="auth-description">
                    Choose how you want to use
                    Tellem Beat Store.
                  </p>

                  {!signupType ? (
                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                        gap:
                          "18px",
                        marginTop:
                          "24px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          chooseSignupType(
                            "producer"
                          )
                        }
                        style={{
                          padding:
                            "28px 20px",
                          borderRadius:
                            "16px",
                          border:
                            "1px solid rgba(214,168,79,0.45)",
                          background:
                            "linear-gradient(145deg, rgba(214,168,79,0.14), rgba(255,255,255,0.04))",
                          color:
                            "#fff",
                          cursor:
                            "pointer",
                          textAlign:
                            "left",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "38px",
                            marginBottom:
                              "12px",
                          }}
                        >
                          🎧
                        </div>

                        <strong
                          style={{
                            display:
                              "block",
                            fontSize:
                              "18px",
                            marginBottom:
                              "8px",
                          }}
                        >
                          SIGN UP AS A PRODUCER
                        </strong>

                        <span
                          style={{
                            display:
                              "block",
                            fontSize:
                              "13px",
                            lineHeight:
                              "1.6",
                            opacity:
                              0.78,
                          }}
                        >
                          Upload and sell
                          beats, manage your
                          producer profile,
                          albums, drum packs
                          and marketplace
                          uploads.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          chooseSignupType(
                            "guest"
                          )
                        }
                        style={{
                          padding:
                            "28px 20px",
                          borderRadius:
                            "16px",
                          border:
                            "1px solid rgba(255,255,255,0.16)",
                          background:
                            "rgba(255,255,255,0.045)",
                          color:
                            "#fff",
                          cursor:
                            "pointer",
                          textAlign:
                            "left",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "38px",
                            marginBottom:
                              "12px",
                          }}
                        >
                          👤
                        </div>

                        <strong
                          style={{
                            display:
                              "block",
                            fontSize:
                              "18px",
                            marginBottom:
                              "8px",
                          }}
                        >
                          SIGN UP AS A GUEST
                        </strong>

                        <span
                          style={{
                            display:
                              "block",
                            fontSize:
                              "13px",
                            lineHeight:
                              "1.6",
                            opacity:
                              0.78,
                          }}
                        >
                          Browse and play
                          beats, follow
                          producers, create
                          playlists, use
                          albums, send
                          messages and enjoy
                          the marketplace.
                          Guests cannot
                          upload beats.
                        </span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          marginTop:
                            "18px",
                          marginBottom:
                            "20px",
                          padding:
                            "14px 16px",
                          borderRadius:
                            "12px",
                          background:
                            signupType ===
                            "producer"
                              ? "rgba(214,168,79,0.12)"
                              : "rgba(255,255,255,0.06)",
                          border:
                            signupType ===
                            "producer"
                              ? "1px solid rgba(214,168,79,0.35)"
                              : "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <strong>
                          {signupType ===
                          "producer"
                            ? "🎧 Producer Account"
                            : "👤 Guest Account"}
                        </strong>

                        <button
                          type="button"
                          onClick={() =>
                            setSignupType(
                              null
                            )
                          }
                          style={{
                            float:
                              "right",
                            background:
                              "transparent",
                            border:
                              "none",
                            color:
                              "#d6a84f",
                            cursor:
                              "pointer",
                            fontWeight:
                              "800",
                          }}
                        >
                          CHANGE
                        </button>
                      </div>

                      <form
                        onSubmit={
                          handleAuth
                        }
                      >
                        <label>
                          Email
                        </label>

                        <input
                          type="email"
                          value={
                            email
                          }
                          onChange={(
                            event
                          ) =>
                            setEmail(
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="you@example.com"
                          required
                        />

                        <label>
                          Password
                        </label>

                        <input
                          type="password"
                          value={
                            password
                          }
                          onChange={(
                            event
                          ) =>
                            setPassword(
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="Enter your password"
                          required
                          minLength={
                            6
                          }
                        />

                        {error && (
                          <div className="auth-message error">
                            {error}
                          </div>
                        )}

                        {message && (
                          <div className="auth-message success">
                            {message}
                          </div>
                        )}

                        <button
                          type="submit"
                          className="auth-submit"
                          disabled={
                            loading
                          }
                        >
                          {loading
                            ? "PLEASE WAIT..."
                            : signupType ===
                              "producer"
                            ? "CREATE PRODUCER ACCOUNT"
                            : "CREATE GUEST ACCOUNT"}
                        </button>
                      </form>
                    </>
                  )}

                  <div className="switch-auth">
                    Already have an account?{" "}

                    <button
                      type="button"
                      onClick={
                        openSignIn
                      }
                    >
                      Sign In
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="auth-eyebrow">
                    {authMode ===
                    "signin"
                      ? "WELCOME BACK"
                      : "ACCOUNT RECOVERY"}
                  </div>

                  <h1>
                    {authMode ===
                    "signin"
                      ? "Welcome Back"
                      : "Forgot Password"}
                  </h1>

                  <p className="auth-description">
                    {authMode ===
                    "signin"
                      ? "Sign in to continue to your Tellem Beat Store account."
                      : "Enter your email address and we'll send you instructions to reset your password."}
                  </p>

                  <form
                    onSubmit={
                      handleAuth
                    }
                  >
                    <label>
                      Email
                    </label>

                    <input
                      type="email"
                      value={
                        email
                      }
                      onChange={(
                        event
                      ) =>
                        setEmail(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="you@example.com"
                      required
                    />

                    {authMode !==
                      "forgot" && (
                      <>
                        <label>
                          Password
                        </label>

                        <input
                          type="password"
                          value={
                            password
                          }
                          onChange={(
                            event
                          ) =>
                            setPassword(
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="Enter your password"
                          required
                          minLength={
                            6
                          }
                        />
                      </>
                    )}

                    {authMode ===
                      "signin" && (
                      <div className="forgot-password-row">
                        <button
                          type="button"
                          onClick={
                            openForgotPassword
                          }
                          className="forgot-password-button"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    )}

                    {error && (
                      <div className="auth-message error">
                        {error}
                      </div>
                    )}

                    {message && (
                      <div className="auth-message success">
                        {message}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="auth-submit"
                      disabled={
                        loading
                      }
                    >
                      {loading
                        ? "PLEASE WAIT..."
                        : authMode ===
                          "signin"
                        ? "SIGN IN"
                        : "SEND RESET LINK"}
                    </button>
                  </form>

                  <div className="switch-auth">
                    {authMode ===
                    "signin" ? (
                      <>
                        Don't have an account?{" "}

                        <button
                          type="button"
                          onClick={
                            openSignUp
                          }
                        >
                          Sign Up
                        </button>
                      </>
                    ) : (
                      <>
                        Remember your password?{" "}

                        <button
                          type="button"
                          onClick={
                            openSignIn
                          }
                        >
                          Sign In
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="footer-logo">
          TELLEM{" "}
          <span>
            BEAT STORE
          </span>
        </div>

        <p>
          © 2026 Tellem Beat Store.
          All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default App;