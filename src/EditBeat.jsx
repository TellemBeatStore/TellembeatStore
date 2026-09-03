import { useState } from "react";
import { supabase } from "./supabaseClient";

function EditBeat({ beat, onSaved, onCancel }) {
  const [title, setTitle] = useState(beat.title || "");
  const [genre, setGenre] = useState(beat.genre || "");
  const [otherGenre, setOtherGenre] = useState(
    beat.other_genre || ""
  );
  const [bpm, setBpm] = useState(
    beat.bpm ? String(beat.bpm) : ""
  );
  const [musicalKey, setMusicalKey] = useState(
    beat.musical_key || ""
  );
  const [description, setDescription] = useState(
    beat.description || ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSave(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!title.trim()) {
      setError("Please enter a beat title.");
      return;
    }

    if (!genre) {
      setError("Please select a genre.");
      return;
    }

    setSaving(true);

    const { data, error: updateError } = await supabase
      .from("beats")
      .update({
        title: title.trim(),
        genre,
        other_genre:
          genre === "Other"
            ? otherGenre.trim() || null
            : null,
        bpm: bpm ? Number(bpm) : null,
        musical_key: musicalKey.trim() || null,
        description: description.trim() || null,
      })
      .eq("id", beat.id)
      .eq("producer_id", beat.producer_id)
      .select()
      .single();

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Beat updated successfully.");

    if (onSaved) {
      onSaved(data);
    }
  }

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <p style={styles.smallTitle}>PRODUCER CENTER</p>

        <h1 style={styles.title}>Edit Beat</h1>

        <p style={styles.description}>
          Update the information for your beat.
        </p>
      </div>

      <div style={styles.card}>
        <form onSubmit={handleSave}>
          <label style={styles.label}>Beat Title</label>

          <input
            type="text"
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            style={styles.input}
            required
          />

          <label style={styles.label}>Genre</label>

          <select
            value={genre}
            onChange={(event) =>
              setGenre(event.target.value)
            }
            style={styles.input}
            required
          >
            <option value="">Select genre</option>
            <option value="Afrobeats">Afrobeats</option>
            <option value="Afro-Dancehall">
              Afro-Dancehall
            </option>
            <option value="Amapiano">Amapiano</option>
            <option value="Hip Hop">Hip Hop</option>
            <option value="Drill">Drill</option>
            <option value="Highlife">Highlife</option>
            <option value="Gospel">Gospel</option>
            <option value="KARVO">KARVO</option>
            <option value="Dancehall">Dancehall</option>
            <option value="Trap">Trap</option>
            <option value="R&B">R&B</option>
            <option value="Other">Other</option>
          </select>

          {genre === "Other" && (
            <>
              <label style={styles.label}>
                Other Genre
              </label>

              <input
                type="text"
                placeholder="Enter genre"
                value={otherGenre}
                onChange={(event) =>
                  setOtherGenre(event.target.value)
                }
                style={styles.input}
              />
            </>
          )}

          <label style={styles.label}>BPM</label>

          <input
            type="number"
            min="1"
            max="300"
            placeholder="e.g. 120"
            value={bpm}
            onChange={(event) =>
              setBpm(event.target.value)
            }
            style={styles.input}
          />

          <label style={styles.label}>
            Musical Key
          </label>

          <input
            type="text"
            placeholder="e.g. D Minor"
            value={musicalKey}
            onChange={(event) =>
              setMusicalKey(event.target.value)
            }
            style={styles.input}
          />

          <label style={styles.label}>
            Description
          </label>

          <textarea
            placeholder="Describe your beat..."
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            style={styles.textarea}
            rows={5}
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

          <div style={styles.actions}>
            <button
              type="submit"
              style={styles.saveButton}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={onCancel}
              style={styles.cancelButton}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

const styles = {
  section: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "70px 30px 100px",
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

  card: {
    background: "#15151b",
    border: "1px solid #292932",
    borderRadius: "12px",
    padding: "30px",
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

  actions: {
    display: "flex",
    gap: "12px",
    marginTop: "25px",
    flexWrap: "wrap",
  },

  saveButton: {
    padding: "13px 22px",
    background: "#ffb703",
    border: "none",
    borderRadius: "7px",
    color: "#000",
    fontWeight: "bold",
    cursor: "pointer",
  },

  cancelButton: {
    padding: "13px 22px",
    background: "transparent",
    border: "1px solid #555",
    borderRadius: "7px",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
  },

  error: {
    marginTop: "18px",
    padding: "12px",
    background: "#3a1118",
    border: "1px solid #7f1d1d",
    borderRadius: "6px",
    color: "#ffb4b4",
  },

  success: {
    marginTop: "18px",
    padding: "12px",
    background: "#102a1a",
    border: "1px solid #245c35",
    borderRadius: "6px",
    color: "#8ee5a8",
  },
};

export default EditBeat;
