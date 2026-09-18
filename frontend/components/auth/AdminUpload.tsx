"use client";

import { ChangeEvent, useState } from "react";
import { uploadLayer } from "../../lib/api-client";

export function AdminUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [layerName, setLayerName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function chooseFile(event: ChangeEvent<HTMLInputElement>): void {
    setFile(event.target.files?.[0] ?? null);
    setMessage(null);
    setError(null);
  }

  async function submit(): Promise<void> {
    if (!file) {
      setError("Choose a spatial file first.");
      return;
    }
    setUploading(true);
    setMessage(null);
    setError(null);
    try {
      const layer = await uploadLayer(file, layerName, description);
      setMessage(`Uploaded ${layer.name} (${layer.feature_count} features).`);
      setFile(null);
      setLayerName("");
      setDescription("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return <section id="admin-upload" aria-labelledby="admin-upload-heading" style={{ display: "grid", gap: "0.75rem", margin: "1rem 0", padding: "1rem", border: "1px solid #d1d5db" }}>
    <h2 id="admin-upload-heading">Admin layer upload</h2>
    <p>Upload a zipped Shapefile, GeoPackage, or GeoJSON layer.</p>
    <label style={{ display: "grid", gap: "0.35rem", justifyItems: "start" }}>Layer name<input required type="text" maxLength={255} value={layerName} onChange={(event) => setLayerName(event.target.value)} placeholder="Community locations" /></label>
    <label style={{ display: "grid", gap: "0.35rem", justifyItems: "start" }}>Description<textarea maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What can users find here?" /></label>
    <input style={{ justifySelf: "start" }} type="file" accept=".zip,.gpkg,.geojson,.json" onChange={chooseFile} />
    <button type="button" onClick={() => void submit()} disabled={uploading || !file || !layerName.trim()} style={{ justifySelf: "start" }}>
      {uploading ? "Uploading…" : "Upload layer"}
    </button>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}