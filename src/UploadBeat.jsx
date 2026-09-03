import { useState } from "react";
import decode from "audio-decode";
import { detect } from "@audio/beat";
import { chroma, key } from "@audio/mir";
import { supabase } from "./supabaseClient";

function UploadBeat({ user, onCancel }) {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [otherGenre, setOtherGenre] = useState("");
  const [bpm, setBpm] = useState("");
  const [musicalKey, setMusicalKey] = useState("");
  const [description, setDescription] = useState("");
  const [mp3File, setMp3File] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function analyzeBeat(file) {
    if (!file) {
      return;
    }

    setAnalyzing(true);
    setAnalysisMessage("Analyzing beat for BPM and musical key...");
    setError("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decoded = await decode(arrayBuffer);

      let sampleRate;
      let samples;

      if (
        decoded &&
        typeof decoded.getChannelData === "function"
      ) {
        sampleRate = decoded.sampleRate;

        const channelCount = decoded.numberOfChannels || 1;
        const firstChannel = decoded.getChannelData(0);

        if (channelCount === 1) {
          samples = firstChannel;
        } else {
          samples = new Float32Array(firstChannel.length);

          for (let channel = 0; channel < channelCount; channel++) {
            const channelData = decoded.getChannelData(channel);

            for (let i = 0; i < samples.length; i++) {
              samples[i] += channelData[i] / channelCount;
            }
          }
        }
      } else if (
        decoded &&
        Array.isArray(decoded.channelData)
      ) {
        sampleRate = decoded.sampleRate;

        const channels = decoded.channelData;

        if (channels.length === 1) {
          samples = channels[0];
        } else {
          const length = channels[0].length;
          samples = new Float32Array(length);

          for (const channelData of channels) {
            for (let i = 0; i < length; i++) {
              samples[i] += channelData[i] / channels.length;
            }
          }
        }
      } else {
        throw new Error(
          "The audio file could not be decoded for analysis."
        );
      }

      if (!sampleRate || !samples?.length) {
        throw new Error(
          "No usable audio data was found in the selected file."
        );
      }

      /*
       * Use the first 90 seconds for analysis.
       */
      const maxAnalysisSamples = Math.floor(
        sampleRate * 90
      );

      const analysisSamples =
        samples.length > maxAnalysisSamples
          ? samples.slice(0, maxAnalysisSamples)
          : samples;

      /*
       * BPM DETECTION
       */
      const tempoResult = detect(analysisSamples, {
        fs: sampleRate,
        minBpm: 60,
        maxBpm: 200,
      });

      const rawDetectedBpm = Number(
        Number(tempoResult?.bpm).toFixed(1)
      );

      /*
       * DOUBLE-TIME BPM CORRECTION
       *
       * Some beats are detected at double their musical tempo.
       *
       * Example:
       * 197 BPM -> 98.5 BPM
       * 196 BPM -> 98 BPM
       * 224 BPM -> 112 BPM
       * 240 BPM -> 120 BPM
       *
       * We only halve BPM values above 180 BPM.
       * Normal values such as 100 BPM remain unchanged.
       */
      let detectedBpm = rawDetectedBpm;

      if (
        Number.isFinite(detectedBpm) &&
        detectedBpm > 180
      ) {
        detectedBpm = Number(
          (detectedBpm / 2).toFixed(1)
        );
      }

      /*
       * MUSICAL KEY DETECTION
       *
       * @audio/mir chroma expects proper FFT-sized frames.
       * We therefore analyze multiple 4096-sample frames.
       */
      const frameSize = 4096;
      const hopSize = 4096;
      const chromaFrames = [];
      const maxKeyFrames = 120;

      /*
       * Start slightly into the beat to reduce the influence
       * of silence or a very short intro.
       */
      const startOffset = Math.min(
        Math.floor(sampleRate * 2),
        Math.max(0, analysisSamples.length - frameSize)
      );

      for (
        let offset = startOffset;
        offset + frameSize <= analysisSamples.length &&
        chromaFrames.length < maxKeyFrames;
        offset += hopSize
      ) {
        const frame = analysisSamples.slice(
          offset,
          offset + frameSize
        );

        try {
          const chromaFrame = chroma(frame, {
            fs: sampleRate,
            method: "nnls",
          });

          if (chromaFrame) {
            chromaFrames.push(chromaFrame);
          }
        } catch (chromaError) {
          console.warn(
            "Skipping invalid chroma frame:",
            chromaError
          );
        }
      }

      let detectedKey = "";

      if (chromaFrames.length > 0) {
        const keyResult = key(chromaFrames);

        if (keyResult?.key) {
          detectedKey = String(keyResult.key);
        } else if (keyResult?.label) {
          detectedKey = String(keyResult.label);
        } else if (
          keyResult?.tonic &&
          keyResult?.mode
        ) {
          detectedKey = `${keyResult.tonic} ${keyResult.mode}`;
        }
      }

      /*
       * Put corrected BPM into the form.
       */
      if (
        Number.isFinite(detectedBpm) &&
        detectedBpm >= 1 &&
        detectedBpm <= 300
      ) {
        setBpm(String(detectedBpm));
      }

      /*
       * Put detected musical key into the form.
       */
      if (detectedKey) {
        setMusicalKey(detectedKey);
      }

      /*
       * Show the result.
       */
      if (detectedKey) {
        if (
          Number.isFinite(rawDetectedBpm) &&
          rawDetectedBpm !== detectedBpm
        ) {
          setAnalysisMessage(
            `✓ Auto-detected: ${detectedBpm} BPM • ${detectedKey}. Double-time detection corrected from ${rawDetectedBpm} BPM. You can edit these values before uploading.`
          );
        } else {
          setAnalysisMessage(
            `✓ Auto-detected: ${detectedBpm} BPM • ${detectedKey}. You can edit these values before uploading.`
          );
        }
      } else if (
        Number.isFinite(detectedBpm)
      ) {
        if (
          Number.isFinite(rawDetectedBpm) &&
          rawDetectedBpm !== detectedBpm
        ) {
          setAnalysisMessage(
            `✓ BPM detected: ${detectedBpm}. Double-time detection corrected from ${rawDetectedBpm} BPM. Musical key could not be determined confidently. You can enter the key manually.`
          );
        } else {
          setAnalysisMessage(
            `✓ BPM detected: ${detectedBpm}. Musical key could not be determined confidently. You can enter the key manually.`
          );
        }
      } else {
        setAnalysisMessage(
          "Automatic analysis could not determine the BPM or musical key. You can enter them manually."
        );
      }
    } catch (analysisError) {
      console.error(
        "Beat analysis error:",
        analysisError
      );

      setAnalysisMessage(
        "Automatic analysis could not be completed. You can enter BPM and Musical Key manually."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleMp3Change(event) {
    const file = event.target.files?.[0] || null;

    setMp3File(file);
    setBpm("");
    setMusicalKey("");
    setAnalysisMessage("");
    setError("");

    if (file) {
      await analyzeBeat(file);
    }
  }

  function handleCancel() {
    if (uploading || analyzing) {
      return;
    }

    setTitle("");
    setGenre("");
    setOtherGenre("");
    setBpm("");
    setMusicalKey("");
    setDescription("");
    setMp3File(null);
    setCoverFile(null);
    setAnalysisMessage("");
    setMessage("");
    setError("");

    const mp3Input = document.getElementById("mp3-file");
    const coverInput = document.getElementById("cover-file");

    if (mp3Input) {
      mp3Input.value = "";
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
      setError("You must be signed in to upload a beat.");
      return;
    }

    if (!mp3File) {
      setError("Please select an MP3 file.");
      return;
    }

    if (!coverFile) {
      setError("Please select cover artwork.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a beat title.");
      return;
    }

    if (!genre) {
      setError("Please select a genre.");
      return;
    }

    if (analyzing) {
      setError(
        "Please wait for the BPM and musical key analysis to finish."
      );
      return;
    }

    setUploading(true);

    let mp3Path = null;
    let coverPath = null;

    try {
      const timestamp = Date.now();

      const mp3Extension =
        mp3File.name.split(".").pop()?.toLowerCase() || "mp3";

      const coverExtension =
        coverFile.name.split(".").pop()?.toLowerCase() || "jpg";

      mp3Path = `${user.id}/${timestamp}-beat.${mp3Extension}`;
      coverPath = `${user.id}/${timestamp}-cover.${coverExtension}`;

      const { error: mp3Error } = await supabase.storage
        .from("beats")
        .upload(mp3Path, mp3File, {
          cacheControl: "3600",
          upsert: false,
          contentType: mp3File.type || "audio/mpeg",
        });

      if (mp3Error) {
        throw new Error(
          `MP3 upload failed: ${mp3Error.message}`
        );
      }

      const { error: coverError } = await supabase.storage
        .from("covers")
        .upload(coverPath, coverFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: coverFile.type || "image/jpeg",
        });

      if (coverError) {
        await supabase.storage
          .from("beats")
          .remove([mp3Path]);

        throw new Error(
          `Cover upload failed: ${coverError.message}`
        );
      }

      const {
        data: { publicUrl: mp3Url },
      } = supabase.storage
        .from("beats")
        .getPublicUrl(mp3Path);

      const {
        data: { publicUrl: coverUrl },
      } = supabase.storage
        .from("covers")
        .getPublicUrl(coverPath);

      const { error: databaseError } = await supabase
        .from("beats")
        .insert({
          producer_id: user.id,
          title: title.trim(),
          genre,
          other_genre:
            genre === "Other"
              ? otherGenre.trim() || null
              : null,
          bpm: bpm ? Number(bpm) : null,
          musical_key: musicalKey.trim() || null,
          description: description.trim() || null,
          mp3_url: mp3Url,
          cover_url: coverUrl,
          likes: 0,
          dislikes: 0,
          license_type: "Free MP3",
          commercial_use: false,
          allow_remakes: false,
          allow_songs: false,
          allow_instrumental_samples: false,
        });

      if (databaseError) {
        await supabase.storage
          .from("beats")
          .remove([mp3Path]);

        await supabase.storage
          .from("covers")
          .remove([coverPath]);

        throw new Error(
          `Beat database save failed: ${databaseError.message}`
        );
      }

      setMessage("Beat uploaded successfully.");

      setTitle("");
      setGenre("");
      setOtherGenre("");
      setBpm("");
      setMusicalKey("");
      setDescription("");
      setMp3File(null);
      setCoverFile(null);
      setAnalysisMessage("");

      const mp3Input = document.getElementById("mp3-file");
      const coverInput = document.getElementById("cover-file");

      if (mp3Input) {
        mp3Input.value = "";
      }

      if (coverInput) {
        coverInput.value = "";
      }
    } catch (uploadError) {
      setError(
        uploadError.message ||
          "Something went wrong while uploading."
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
          disabled={uploading || analyzing}
        >
          ← Go Back
        </button>

        <button
          type="button"
          onClick={handleCancel}
          style={styles.cancelButton}
          disabled={uploading || analyzing}
        >
          Cancel Upload
        </button>
      </div>

      <div style={styles.header}>
        <p style={styles.smallTitle}>PRODUCER CENTER</p>

        <h1 style={styles.title}>Upload a Beat</h1>

        <p style={styles.description}>
          Upload your original beat and make it available on
          Tellem Beat Store.
        </p>
      </div>

      <div style={styles.licenseCard}>
        <div style={styles.licenseHeader}>
          <div>
            <p style={styles.licenseSmallTitle}>
              DEFAULT LICENSE
            </p>

            <h2 style={styles.licenseTitle}>
              Free MP3 License
            </h2>
          </div>

          <span style={styles.freeBadge}>FREE</span>
        </div>

        <p style={styles.licenseText}>
          This beat is available for free download for
          listening, practice, writing, and non-commercial
          demonstration purposes only.
        </p>

        <div style={styles.restrictions}>
          <div>✓ Free MP3 download</div>
          <div>✕ No remakes allowed</div>
          <div>✕ No commercial songs or releases</div>
          <div>✕ No instrumental samples</div>
          <div>✕ No resale or redistribution</div>
          <div>✕ No Content ID registration or copyright claims</div>
        </div>

        <p style={styles.copyrightText}>
          Producer retains 100% ownership and copyright of
          the instrumental. A paid license is required for
          commercial use.
        </p>

        <p style={styles.typeBeatText}>
          Artist-name “Type Beat” titles are permitted for
          descriptive purposes only and do not imply
          endorsement, affiliation, or participation by the
          named artist.
        </p>
      </div>

      <div style={styles.card}>
        <form onSubmit={handleUpload}>
          <label style={styles.label}>Beat Title</label>

          <input
            type="text"
            placeholder="e.g. Level Up"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
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
            <option value="Other">Other</option>
          </select>

          {genre === "Other" && (
            <>
              <label style={styles.label}>Other Genre</label>

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
            step="0.1"
            placeholder="e.g. 120"
            value={bpm}
            onChange={(event) => setBpm(event.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>Musical Key</label>

          <input
            type="text"
            placeholder="e.g. D Minor"
            value={musicalKey}
            onChange={(event) =>
              setMusicalKey(event.target.value)
            }
            style={styles.input}
          />

          {analysisMessage && (
            <div
              style={
                analyzing
                  ? styles.analysisLoading
                  : styles.analysisSuccess
              }
            >
              {analysisMessage}
            </div>
          )}

          <label style={styles.label}>Description</label>

          <textarea
            placeholder="Describe your beat..."
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            style={styles.textarea}
            rows={5}
          />

          <label style={styles.label}>MP3 File</label>

          <input
            id="mp3-file"
            type="file"
            accept="audio/mpeg,audio/mp3"
            onChange={handleMp3Change}
            style={styles.fileInput}
            disabled={uploading}
            required
          />

          {mp3File && (
            <p style={styles.fileName}>
              Selected: {mp3File.name}
            </p>
          )}

          <label style={styles.label}>Cover Artwork</label>

          <input
            id="cover-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              setCoverFile(event.target.files?.[0] || null)
            }
            style={styles.fileInput}
            disabled={uploading}
            required
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
              disabled={uploading || analyzing}
            >
              Cancel / Close
            </button>

            <button
              type="submit"
              style={styles.button}
              disabled={uploading || analyzing}
            >
              {analyzing
                ? "Analyzing Beat..."
                : uploading
                ? "Uploading Beat..."
                : "Upload Beat"}
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

  licenseCard: {
    background: "#1a170d",
    border: "1px solid #5b4500",
    borderRadius: "12px",
    padding: "25px 30px",
    marginBottom: "25px",
  },

  licenseHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
  },

  licenseSmallTitle: {
    color: "#ffb703",
    letterSpacing: "2px",
    fontSize: "11px",
    fontWeight: "bold",
    margin: 0,
  },

  licenseTitle: {
    fontSize: "25px",
    margin: "8px 0 0",
  },

  freeBadge: {
    background: "#ffb703",
    color: "#000",
    padding: "7px 12px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "bold",
  },

  licenseText: {
    color: "#bbb",
    lineHeight: 1.6,
    marginTop: "20px",
  },

  restrictions: {
    display: "grid",
    gap: "9px",
    color: "#ddd",
    lineHeight: 1.5,
    marginTop: "18px",
  },

  copyrightText: {
    color: "#999",
    lineHeight: 1.6,
    borderTop: "1px solid #3b3219",
    paddingTop: "18px",
    marginTop: "20px",
  },

  typeBeatText: {
    color: "#888",
    fontSize: "13px",
    lineHeight: 1.6,
    marginBottom: 0,
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

  analysisLoading: {
    marginTop: "15px",
    padding: "13px",
    background: "#1d1d25",
    border: "1px solid #444",
    borderRadius: "6px",
    color: "#ddd",
    lineHeight: 1.5,
  },

  analysisSuccess: {
    marginTop: "15px",
    padding: "13px",
    background: "#172313",
    border: "1px solid #49652d",
    borderRadius: "6px",
    color: "#b9e88f",
    lineHeight: 1.5,
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

export default UploadBeat;
