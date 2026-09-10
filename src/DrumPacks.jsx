import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function DrumPacks() {
  const [drumPacks, setDrumPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDrumPacks();
  }, []);

  async function loadDrumPacks() {
    setLoading(true);
    setError("");

    try {
      /*
       * Load drum packs without using a Supabase relationship.
       * This avoids errors caused by missing/incorrect foreign-key
       * relationships between drum_packs and producers.
       */
      const { data: packs, error: fetchError } = await supabase
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
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const loadedPacks = packs || [];

      /*
       * Collect all producer IDs used by the drum packs.
       */
      const producerIds = [
        ...new Set(
          loadedPacks
            .map((pack) => pack.producer_id)
            .filter(Boolean)
        ),
      ];

      let producers = [];

      /*
       * Load producer profiles separately.
       * This does NOT require a foreign-key relationship.
       */
      if (producerIds.length > 0) {
        const {
          data: producerData,
          error: producerError,
        } = await supabase
          .from("producers")
          .select(`
            id,
            display_name,
            avatar_url
          `)
          .in("id", producerIds);

        if (producerError) {
          console.error(
            "Unable to load producer profiles:",
            producerError.message
          );
        } else {
          producers = producerData || [];
        }
      }

      /*
       * Create a quick producer lookup table.
       */
      const producerMap = {};

      producers.forEach((producer) => {
        producerMap[producer.id] = producer;
      });

      /*
       * Attach the producer information to each drum pack.
       */
      const packsWithProducers = loadedPacks.map((pack) => ({
        ...pack,
        producers: pack.producer_id
          ? producerMap[pack.producer_id] || null
          : null,
      }));

      setDrumPacks(packsWithProducers);
    } catch (loadError) {
      console.error(
        "Unable to load drum packs:",
        loadError
      );

      setError(
        loadError.message ||
          "Unable to load drum packs right now."
      );
    } finally {
      setLoading(false);
    }
  }

  function getProducerName(pack) {
    if (pack.producers?.display_name) {
      return pack.producers.display_name;
    }

    return "Unknown Producer";
  }

  async function handleDownload(pack) {
    if (!pack.zip_url) {
      setError("This drum pack does not have a ZIP file.");
      return;
    }

    setError("");

    try {
      /*
       * Download the ZIP as a blob first.
       * This allows us to force the actual drum pack
       * name instead of allowing Supabase's UUID/code
       * to become the filename.
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

      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = blobUrl;
      link.download = `${safeName || "drum-pack"}.zip`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      /*
       * Give the browser a moment to start the download
       * before releasing the temporary blob URL.
       */
      window.setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);

      /*
       * Update download count only after the file
       * has successfully started downloading.
       */
      const { error: downloadError } = await supabase.rpc(
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

      {/* SECTION HEADER */}
      <div style={styles.header}>

        <p style={styles.eyebrow}>
          NEW RELEASES
        </p>

        <h1 style={styles.title}>
          DRUM PACKS
        </h1>

        <p style={styles.subtitle}>
          Fresh drum kits, percussion, samples and sound
          collections uploaded by producers on Tellem Beat Store.
        </p>

      </div>

      {/* LOADING */}
      {loading && (
        <div style={styles.status}>
          Loading new drum packs...
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

            <h2>
              No drum packs yet
            </h2>

            <p>
              Be the first producer to upload a free
              drum pack to the Tellem Beat Store community.
            </p>

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

                  <p style={styles.producer}>
                    🎧 {getProducerName(pack)}
                  </p>

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
    margin: 0,
    color: "#ffffff",
    fontSize: "19px",
    fontWeight: "800",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  producer: {
    margin: "9px 0 8px",
    color: "#cccccc",
    fontSize: "14px",
    fontWeight: "700",
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

export default DrumPacks;