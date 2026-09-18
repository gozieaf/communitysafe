"use client";

import { useEffect, useState } from "react";
import { getLayers, type LayerSummary } from "../../lib/api-client";

export default function ResourcesPage() {
  const [layers, setLayers] = useState<LayerSummary[]>([]);
  useEffect(() => { void getLayers().then(setLayers); }, []);
  return <main style={{ margin: "2rem auto", maxWidth: 720, padding: "0 1.5rem" }}><h1>Resources</h1>{layers.map((layer) => <article key={layer.id}><h2>{layer.name}</h2><p>{layer.description || "No description provided."}</p><p>Author: {layer.author || "Unknown"} ({layer.author_verified ? "Verified" : "Not verified"})</p><p>Published: {new Date(layer.created_at).toLocaleString()}</p><a href={`/?layer=${layer.id}`}>View on map</a></article>)}<p><a href="/">Back to map</a></p></main>;
}