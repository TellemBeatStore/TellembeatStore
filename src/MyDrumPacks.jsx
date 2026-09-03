import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function MyDrumPacks({
  user,
  onNavigate,
}) {
  const [drumPacks, setDrumPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) {
      setDrumPacks([]);
      setLoading(false);
      return;
    }

    loadMyDrumPacks();
  }, [user?.id]);

  async function loadMyDrumPacks() {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
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
        .eq("producer_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setDrumPacks(data || []);
    } catch (loadError) {
      console.error(
        "Unable to load your drum packs:",
        loadError
      );

      setError(
        loadError.message ||
          "Unable to load your drum packs right now."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(pack) {
    if (!pack.zip_url) {
      setError(
        "This drum pack does not have a ZIP file."
      );
      return;
    }

    setError("");

    try {
      /*
       * Download the ZIP as a blob first.
       * This allows us to force the actual drum pack
       * name instead of using the Supabase UUID/code.
       */
      const response = await fetch(pack.zip_url);

      if (!response.ok) {
        throw new Error(
          "Unable to download the drum pack file."
        );
      }

      const blob = await response.blob();

      /*
       * Clean the drum pack name so it is safe
       * to use as a Windows filename.
       */
      const safeName = (pack.name || "drum-pack")
        .trim()
        .replace(/[<>:"/\\|?*]+/g, "")
        .replace(/\s+/g, " ");

      const blobUrl =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = blobUrl;

      link.download =
        `${safeName || "drum-pack"}.zip`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      /*
       * Release the temporary blob URL after
       * the browser has started the download.
       */
      window.setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);

      /*
       * Update the download count after the
       * download has successfully started.
       */
      const { error: downloadError } =
        await supabase.rpc(
          "increment_drum_pack_download",
          {
            pack_id: pack.id,
          }
        );

      if (downloadError) {
        console.error(
          "Unable to update drum pack download count:",
          downloadError.message
        );

        return;
      }

      setDrumPacks((currentPacks) =>
        currentPacks.map((item) =>
          item.id === pack.id
            ? {
                ...item,
                downloads:
                  Number(item.downloads || 0) + 1,
              }
            : item
        )
      );
    } catch (downloadError) {
      console.error(
        "Drum pack download error:",
        downloadError
      );

      setError(
        "Unable to download this drum pack. Please try again."
      );
    }
  }

  return (
    <section style={styles.section}>

      {/* HEADER */}
      <div style={styles.header}>

        <p style={styles.eyebrow}>
          PRODUCER DASHBOARD
        </p>

        <h1 style={styles.title}>
          MY DRUM PACKS
        </h1>

        <p style={styles.subtitle}>
          Manage and access the drum packs you have uploaded
          to Tellem Beat Store.
        </p>

      </div>

      {/* LOADING */}
      {loading && (
        <div style={styles.status}>
          Loading your drum packs...
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {/* EMPTY */}
      {!loading &&
        !error &&
        drumPacks.length === 0 && (
          <div style={styles.empty}>

            <div style={styles.emptyIcon}>
              🥁
            </div>

            <h2 style={styles.emptyTitle}>
              You haven't uploaded any drum packs yet
            </h2>

            <p style={styles.emptyText}>
              Upload your first free drum pack and make it
              available to the Tellem Beat Store community.
            </p>

            {onNavigate && (
              <button
                type="button"
                onClick={() =>
                  onNavigate("upload-drum-pack")
                }
                style={styles.uploadButton}
              >
                ↑ UPLOAD DRUM PACK
              </button>
            )}

          </div>
        )}

      {/* DRUM PACK GRID */}
      {!loading &&
        !error &&
        drumPacks.length > 0 && (
          <div style={styles.grid}>

            {drumPacks.map((pack) => (
              <article
                key={pack.id}
                style={styles.card}
              >

                {/* COVER */}
                <div style={styles.coverWrapper}>

                  {pack.cover_url ? (
                    <img
                      src={pack.cover_url}
                      alt={pack.name}
                      style={styles.cover}
                    />
                  ) : (
                    <div style={styles.placeholder}>

                      <span
                        style={styles.placeholderIcon}
                      >
                        🥁
                      </span>

                      <small>
                        DRUM PACK
                      </small>

                    </div>
                  )}

                  {/* NEW BADGE */}
                  <div style={styles.newBadge}>
                    NEW
                  </div>

                  {/* FREE BADGE */}
                  <div style={styles.freeBadge}>
                    FREE
                  </div>

                </div>

                {/* CONTENT */}
                <div style={styles.content}>

                  <h2 style={styles.packName}>
                    {pack.name}
                  </h2>

                  {pack.genre && (
                    <span style={styles.genre}>
                      {pack.genre}
                    </span>
                  )}

                  {pack.description && (
                    <p style={styles.description}>
                      {pack.description}
                    </p>
                  )}

                  <div style={styles.meta}>

                    <span>
                      ⬇{" "}
                      {Number(pack.downloads || 0)}{" "}
                      downloads
                    </span>

                    <span>
                      ZIP
                    </span>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownload(pack)
                    }
                    style={styles.downloadButton}
                  >
                    ↓ FREE DOWNLOAD
                  </button>

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
    padding: "0 40px 80px",
    boxSizing: "border-box",
  },

  header: {
    marginBottom: "28px",
  },

  eyebrow: {
    color: "#d6a84f",
    letterSpacing: "3px",
    fontSize: "12px",
    fontWeight: "900",
    margin: 0,
  },

  title: {
    fontSize: "42px",
    margin: "9px 0 14px",
    letterSpacing: "1px",
    color: "#ffffff",
    fontWeight: "900",
  },

  subtitle: {
    color: "#888",
    lineHeight: 1.6,
    maxWidth: "700px",
    margin: 0,
    fontSize: "15px",
  },

  status: {
    padding: "30px",
    textAlign: "center",
    color: "#999",
    background: "#151515",
    border: "1px solid #292929",
    borderRadius: "10px",
  },

  error: {
    padding: "18px",
    background: "#3a1118",
    border: "1px solid #7f1d1d",
    borderRadius: "8px",
    color: "#ffb4b4",
  },

  empty: {
    textAlign: "center",
    padding: "70px 30px",
    background: "#151515",
    border: "1px solid #292929",
    borderRadius: "10px",
  },

  emptyIcon: {
    fontSize: "50px",
    marginBottom: "15px",
  },

  emptyTitle: {
    color: "#ffffff",
    margin: "0 0 10px",
  },

  emptyText: {
    color: "#888",
    maxWidth: "550px",
    margin: "0 auto 25px",
    lineHeight: 1.6,
  },

  uploadButton: {
    padding: "12px 20px",
    background:
      "linear-gradient(145deg, #d6a84f, #9c742d)",
    border: "none",
    borderRadius: "6px",
    color: "#080808",
    fontWeight: "900",
    fontSize: "12px",
    letterSpacing: "0.5px",
    cursor: "pointer",
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
    width: "100%",
    minWidth: 0,
    background:
      "linear-gradient(145deg, #181818, #101010)",
    border:
      "1px solid rgba(214, 168, 79, 0.18)",
    borderRadius: "10px",
    overflow: "hidden",
    boxShadow:
      "0 14px 40px rgba(0,0,0,0.35)",
    transition:
      "transform 0.2s ease, border-color 0.2s ease",
  },

  coverWrapper: {
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

  placeholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    background:
      "linear-gradient(145deg, #202020, #090909)",
    color: "#777",
  },

  placeholderIcon: {
    fontSize: "48px",
  },

  newBadge: {
    position: "absolute",
    top: "14px",
    left: "14px",
    background:
      "linear-gradient(145deg, #d6a84f, #8f6823)",
    color: "#080808",
    padding: "7px 11px",
    borderRadius: "5px",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1px",
    boxShadow:
      "0 4px 15px rgba(0,0,0,0.35)",
  },

  freeBadge: {
    position: "absolute",
    top: "14px",
    right: "14px",
    background: "#8ee5a8",
    color: "#07140b",
    padding: "7px 11px",
    borderRadius: "5px",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "0.5px",
  },

  content: {
    padding: "19px 18px 20px",
  },

  packName: {
    margin: "0 0 10px",
    color: "#ffffff",
    fontSize: "19px",
    fontWeight: "800",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  genre: {
    display: "inline-block",
    background: "#222222",
    border:
      "1px solid rgba(214, 168, 79, 0.25)",
    color: "#d6a84f",
    padding: "5px 9px",
    borderRadius: "5px",
    fontSize: "11px",
    fontWeight: "800",
  },

  description: {
    color: "#888",
    fontSize: "13px",
    lineHeight: 1.6,
    margin: "15px 0",
  },

  meta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#777",
    fontSize: "11px",
    borderTop:
      "1px solid rgba(255,255,255,0.08)",
    paddingTop: "15px",
    marginTop: "15px",
  },

  downloadButton: {
    width: "100%",
    marginTop: "18px",
    padding: "12px",
    background:
      "linear-gradient(145deg, #d6a84f, #9c742d)",
    border: "none",
    borderRadius: "6px",
    color: "#080808",
    fontWeight: "900",
    fontSize: "12px",
    letterSpacing: "0.5px",
    cursor: "pointer",
  },
};

export default MyDrumPacks;