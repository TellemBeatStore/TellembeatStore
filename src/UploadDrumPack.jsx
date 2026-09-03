import { useState } from "react";
import { supabase } from "./supabaseClient";

function UploadDrumPack({ user, onCancel }) {
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [zipFile, setZipFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleCancel() {
    if (uploading) {
      return;
    }

    setName("");
    setGenre("");
    setDescription("");
    setZipFile(null);
    setCoverFile(null);
    setMessage("");
    setError("");

    const zipInput = document.getElementById("drum-pack-zip");
    const coverInput = document.getElementById("drum-pack-cover");

    if (zipInput) {
      zipInput.value = "";
    }

    if (coverInput) {
      coverInput.value = "";
    }

    if (onCancel) {
      onCancel();
    }
  }

  async function handleUpload(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!user) {
      setError("You must be signed in to upload a drum pack.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter a drum pack name.");
      return;
    }

    if (!zipFile) {
      setError("Please select a ZIP file.");
      return;
    }

    if (!zipFile.name.toLowerCase().endsWith(".zip")) {
      setError("Drum packs must be uploaded as a ZIP file.");
      return;
    }

    if (!genre) {
      setError("Please select a genre.");
      return;
    }

    if (zipFile.size > 500 * 1024 * 1024) {
      setError("The ZIP file must be 500 MB or smaller.");
      return;
    }

    setUploading(true);

    let zipPath = null;
    let coverPath = null;

    try {
      const timestamp = Date.now();

      zipPath = `${user.id}/${timestamp}-drum-pack.zip`;

      const { error: zipError } = await supabase.storage
        .from("drum-packs")
        .upload(zipPath, zipFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/zip",
        });

      if (zipError) {
        throw new Error(
          `ZIP upload failed: ${zipError.message}`
        );
      }

      let coverUrl = null;

      if (coverFile) {
        const coverExtension =
          coverFile.name.split(".").pop()?.toLowerCase() || "jpg";

        coverPath = `${user.id}/${timestamp}-cover.${coverExtension}`;

        const { error: coverError } = await supabase.storage
          .from("covers")
          .upload(coverPath, coverFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: coverFile.type || "image/jpeg",
          });

        if (coverError) {
          await supabase.storage
            .from("drum-packs")
            .remove([zipPath]);

          throw new Error(
            `Cover upload failed: ${coverError.message}`
          );
        }

        const {
          data: { publicUrl },
        } = supabase.storage
          .from("covers")
          .getPublicUrl(coverPath);

        coverUrl = publicUrl;
      }

      const {
        data: { publicUrl: zipUrl },
      } = supabase.storage
        .from("drum-packs")
        .getPublicUrl(zipPath);

      const { error: databaseError } = await supabase
        .from("drum_packs")
        .insert({
          producer_id: user.id,
          name: name.trim(),
          genre,
          description: description.trim() || null,
          zip_url: zipUrl,
          cover_url: coverUrl,
          downloads: 0,
        });

      if (databaseError) {
        await supabase.storage
          .from("drum-packs")
          .remove([zipPath]);

        if (coverPath) {
          await supabase.storage
            .from("covers")
            .remove([coverPath]);
        }

        throw new Error(
          `Drum pack database save failed: ${databaseError.message}`
        );
      }

      setMessage(
        "Drum pack uploaded successfully and is now available for free download."
      );

      setName("");
      setGenre("");
      setDescription("");
      setZipFile(null);
      setCoverFile(null);

      const zipInput = document.getElementById("drum-pack-zip");
      const coverInput = document.getElementById("drum-pack-cover");

      if (zipInput) {
        zipInput.value = "";
      }

      if (coverInput) {
        coverInput.value = "";
      }
    } catch (uploadError) {
      setError(
        uploadError.message ||
          "Something went wrong while uploading the drum pack."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <section style={styles.section}>
      <div style={styles.topActions}>
        <button
          type="button"
          onClick={handleCancel}
          style={styles.backButton}
          disabled={uploading}
        >
          ← Go Back
        </button>

        <button
          type="button"
          onClick={handleCancel}
          style={styles.cancelButton}
          disabled={uploading}
        >
          Cancel Upload
        </button>
      </div>

      <div style={styles.header}>
        <p style={styles.smallTitle}>PRODUCER CENTER</p>

        <h1 style={styles.title}>Upload Drum Pack</h1>

        <p style={styles.description}>
          Share your drum sounds and sample collections with
          the Tellem Beat Store community.
        </p>
      </div>

      <div style={styles.freeCard}>
        <div style={styles.freeHeader}>
          <div>
            <p style={styles.freeSmallTitle}>COMMUNITY RESOURCE</p>

            <h2 style={styles.freeTitle}>
              Free Drum Pack
            </h2>
          </div>

          <span style={styles.freeBadge}>FREE</span>
        </div>

        <p style={styles.freeText}>
          Drum packs uploaded here are completely free for
          users to download. There is no price or payment
          required.
        </p>

        <div style={styles.rules}>
          <div>✓ ZIP download</div>
          <div>✓ Free for the community</div>
          <div>✓ Original content only</div>
          <div>✕ No copyrighted material you do not have permission to distribute</div>
          <div>✕ No malware or harmful files</div>
        </div>
      </div>

      <div style={styles.card}>
        <form onSubmit={handleUpload}>
          <label style={styles.label}>Drum Pack Name</label>

          <input
            type="text"
            placeholder="e.g. African Percussion Pack"
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={styles.input}
            required
          />

          <label style={styles.label}>Genre</label>

          <select
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
            style={styles.input}
            required
          >
            <option value="">Select genre</option>
            <option value="Afrobeats">Afrobeats</option>
            <option value="Afro-Dancehall">Afro-Dancehall</option>
            <option value="Amapiano">Amapiano</option>
            <option value="Hip Hop">Hip Hop</option>
            <option value="Drill">Drill</option>
            <option value="Highlife">Highlife</option>
            <option value="Gospel">Gospel</option>
            <option value="KARVO">KARVO</option>
            <option value="Dancehall">Dancehall</option>
            <option value="Trap">Trap</option>
            <option value="R&B">R&B</option>
            <option value="Percussion">Percussion</option>
            <option value="Other">Other</option>
          </select>

          <label style={styles.label}>Description</label>

          <textarea
            placeholder="Describe the sounds included in your drum pack..."
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            style={styles.textarea}
            rows={5}
          />

          <label style={styles.label}>
            ZIP Drum Pack
          </label>

          <input
            id="drum-pack-zip"
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={(event) =>
              setZipFile(event.target.files?.[0] || null)
            }
            style={styles.fileInput}
            required
          />

          {zipFile && (
            <p style={styles.fileName}>
              Selected: {zipFile.name}
            </p>
          )}

          <p style={styles.fileHint}>
            Maximum file size: 500 MB. Upload your drum pack
            as one ZIP file.
          </p>

          <label style={styles.label}>
            Cover Artwork <span style={styles.optional}>(Optional)</span>
          </label>

          <input
            id="drum-pack-cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              setCoverFile(event.target.files?.[0] || null)
            }
            style={styles.fileInput}
          />

          {coverFile && (
            <p style={styles.fileName}>
              Selected: {coverFile.name}
            </p>
          )}

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

          <div style={styles.bottomActions}>
            <button
              type="button"
              onClick={handleCancel}
              style={styles.bottomCancelButton}
              disabled={uploading}
            >
              Cancel / Close
            </button>

            <button
              type="submit"
              style={styles.button}
              disabled={uploading}
            >
              {uploading
                ? "Uploading Drum Pack..."
                : "Upload Free Drum Pack"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

const styles = {
  section: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "40px 30px 100px",
  },

  topActions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    marginBottom: "30px",
  },

  backButton: {
    background: "#292932",
    border: "1px solid #444",
    borderRadius: "7px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "10px 16px",
  },

  cancelButton: {
    background: "transparent",
    border: "1px solid #7f1d1d",
    borderRadius: "7px",
    color: "#ffb4b4",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "10px 16px",
  },

  header: {
    marginBottom: "35px",
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

  freeCard: {
    background: "#101d16",
    border: "1px solid #245c35",
    borderRadius: "12px",
    padding: "25px 30px",
    marginBottom: "25px",
  },

  freeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
  },

  freeSmallTitle: {
    color: "#8ee5a8",
    letterSpacing: "2px",
    fontSize: "11px",
    fontWeight: "bold",
    margin: 0,
  },

  freeTitle: {
    fontSize: "25px",
    margin: "8px 0 0",
  },

  freeBadge: {
    background: "#8ee5a8",
    color: "#07140b",
    padding: "7px 12px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "bold",
  },

  freeText: {
    color: "#bbb",
    lineHeight: 1.6,
    marginTop: "20px",
  },

  rules: {
    display: "grid",
    gap: "9px",
    color: "#ddd",
    lineHeight: 1.5,
    marginTop: "18px",
  },

  card: {
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    padding: "30px",
  },

  label: {
    display: "block",
    marginTop: "20px",
    marginBottom: "8px",
    fontWeight: "bold",
    fontSize: "14px",
  },

  optional: {
    color: "#777",
    fontWeight: "normal",
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

  fileInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    background: "#0f0f14",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
  },

  fileName: {
    color: "#888",
    fontSize: "13px",
    marginTop: "8px",
  },

  fileHint: {
    color: "#777",
    fontSize: "12px",
    marginTop: "7px",
  },

  bottomActions: {
    display: "flex",
    gap: "12px",
    marginTop: "30px",
  },

  bottomCancelButton: {
    flex: 1,
    padding: "15px",
    background: "#292932",
    border: "1px solid #444",
    borderRadius: "7px",
    color: "#fff",
    fontWeight: "bold",
    fontSize: "15px",
    cursor: "pointer",
  },

  button: {
    flex: 2,
    padding: "15px",
    background: "#ffb703",
    border: "none",
    borderRadius: "7px",
    color: "#000",
    fontWeight: "bold",
    fontSize: "15px",
    cursor: "pointer",
  },

  error: {
    marginTop: "20px",
    padding: "13px",
    background: "#3a1118",
    border: "1px solid #7f1d1d",
    borderRadius: "6px",
    color: "#ffb4b4",
  },

  success: {
    marginTop: "20px",
    padding: "13px",
    background: "#102a1a",
    border: "1px solid #245c35",
    borderRadius: "6px",
    color: "#8ee5a8",
  },
};

export default UploadDrumPack;