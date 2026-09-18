"use client";

import { useEffect, useRef, useState } from "react";
import type { CircleLayerSpecification, FillLayerSpecification, GeoJSONSource, LineLayerSpecification, Map as MapLibreMap, SymbolLayerSpecification } from "maplibre-gl";

import { deleteLayer, getLayerFeatures, getLayers, type LayerSummary } from "../../lib/api-client";

function isPolygon(type: string): boolean { return type === "Polygon" || type === "MultiPolygon"; }
function isLine(type: string): boolean { return type === "LineString" || type === "MultiLineString"; }

export function MapView({ isAdmin, isAuthenticated }: { isAdmin: boolean; isAuthenticated: boolean }) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const layersRef = useRef<LayerSummary[]>([]);
  const [layers, setLayers] = useState<LayerSummary[]>([]);
  const [mapLayerIds, setMapLayerIds] = useState<Set<string>>(new Set());
  const [visibleLayerIds, setVisibleLayerIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [removingLayerId, setRemovingLayerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "published">("map");

  useEffect(() => {
    if (!isAuthenticated) {
      setLayers([]);
      setMapLayerIds(new Set());
      setVisibleLayerIds(new Set());
      return;
    }
    const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
    if (!container.current || !styleUrl) {
      if (!styleUrl) setError("Set NEXT_PUBLIC_MAP_STYLE_URL to display the map.");
      return;
    }
    let disposed = false;
    let map: MapLibreMap | null = null;

    async function initialize(): Promise<void> {
      try {
        const availableLayers = await getLayers();
        if (disposed) return;
        layersRef.current = availableLayers;
        setLayers(availableLayers);
        setMapLayerIds(new Set(availableLayers.map((layer) => layer.id)));
        setVisibleLayerIds(new Set(availableLayers.map((layer) => layer.id)));
        const maplibregl = await import("maplibre-gl");
      if (disposed || !container.current) return;
      map = new maplibregl.Map({ container: container.current, style: styleUrl, center: [3.3792, 6.5244], zoom: 8 });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = map;
      map.on("load", async () => {
        try {
          if (disposed || !map) return;
          for (const layer of availableLayers) {
            map.addSource(layer.id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            const style = layer.style ?? {};
            if (isPolygon(layer.geometry_type)) map.addLayer({ id: layer.id, source: layer.id, type: "fill", paint: style.paint as FillLayerSpecification["paint"], layout: style.layout as FillLayerSpecification["layout"] });
            else if (isLine(layer.geometry_type)) map.addLayer({ id: layer.id, source: layer.id, type: "line", paint: style.paint as LineLayerSpecification["paint"], layout: style.layout as LineLayerSpecification["layout"] });
            else map.addLayer({ id: layer.id, source: layer.id, type: "circle", paint: style.paint as CircleLayerSpecification["paint"], layout: style.layout as CircleLayerSpecification["layout"] });
            map.addLayer({ id: `${layer.id}-labels`, source: layer.id, type: "symbol", layout: { "text-field": ["get", "name"], "text-size": 12, "text-offset": [0, 1], "text-anchor": "top" } as SymbolLayerSpecification["layout"], paint: { "text-color": "#111827", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } as SymbolLayerSpecification["paint"] });
          }
          await refreshFeatures();
        } catch (reason) {
          if (!disposed) setError(reason instanceof Error ? reason.message : "Could not load map layers");
        }
      });
      map.on("moveend", () => { void refreshFeatures(); });
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "Could not load map layers");
      }
    }

    async function refreshFeatures(): Promise<void> {
      if (!map || disposed) return;
      const bounds = map.getBounds();
      const bbox: [number, number, number, number] = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      await Promise.all(layersRef.current.map(async (layer) => {
        const source = map?.getSource(layer.id) as GeoJSONSource | undefined;
        if (source) source.setData(await getLayerFeatures(layer.id, bbox));
      }));
    }

    void initialize();
    return () => { disposed = true; map?.remove(); mapRef.current = null; };
  }, [isAuthenticated]);

  function toggleLayer(layerId: string): void {
    const map = mapRef.current;
    const isVisible = visibleLayerIds.has(layerId);
    const nextVisible = new Set(visibleLayerIds);
    if (isVisible) nextVisible.delete(layerId);
    else nextVisible.add(layerId);
    setVisibleLayerIds(nextVisible);
    if (map?.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", isVisible ? "none" : "visible");
    if (map?.getLayer(`${layerId}-labels`)) map.setLayoutProperty(`${layerId}-labels`, "visibility", isVisible ? "none" : "visible");
  }

  function addToMap(layerId: string): void {
    setMapLayerIds((current) => new Set(current).add(layerId));
    setVisibleLayerIds((current) => new Set(current).add(layerId));
    const map = mapRef.current;
    if (map?.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "visible");
    if (map?.getLayer(`${layerId}-labels`)) map.setLayoutProperty(`${layerId}-labels`, "visibility", "visible");
    setActiveTab("map");
  }

  function removeFromMap(layerId: string): void {
    setMapLayerIds((current) => {
      const next = new Set(current);
      next.delete(layerId);
      return next;
    });
    setVisibleLayerIds((current) => {
      const next = new Set(current);
      next.delete(layerId);
      return next;
    });
    const map = mapRef.current;
    if (map?.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "none");
    if (map?.getLayer(`${layerId}-labels`)) map.setLayoutProperty(`${layerId}-labels`, "visibility", "none");
  }

  async function removeLayer(layer: LayerSummary): Promise<void> {
    if (!window.confirm(`Remove ${layer.name} from the map?`)) return;
    setRemovingLayerId(layer.id);
    setError(null);
    try {
      await deleteLayer(layer.id);
      const map = mapRef.current;
      if (map?.getLayer(`${layer.id}-labels`)) map.removeLayer(`${layer.id}-labels`);
      if (map?.getLayer(layer.id)) map.removeLayer(layer.id);
      if (map?.getSource(layer.id)) map.removeSource(layer.id);
      layersRef.current = layersRef.current.filter((item) => item.id !== layer.id);
      setLayers((current) => current.filter((item) => item.id !== layer.id));
      setVisibleLayerIds((current) => {
        const next = new Set(current);
        next.delete(layer.id);
        return next;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove layer");
    } finally {
      setRemovingLayerId(null);
    }
  }

  return <section>
    <h2>Map</h2>
    {!isAuthenticated && <p>Sign in to view community resources on the map. <a href="/login">Sign in</a></p>}
    {isAuthenticated && <>
    <aside aria-labelledby="layers-heading" style={{ marginBottom: "1rem", padding: "0.9rem 1rem", border: "1px solid #d1d5db" }}>
      <h3 id="layers-heading" style={{ marginTop: 0 }}>Layers</h3>
      <div role="tablist" aria-label="Layer views" style={{ display: "flex", gap: 8, marginBottom: "0.75rem" }}>
        <button type="button" role="tab" aria-selected={activeTab === "map"} onClick={() => setActiveTab("map")}>Map</button>
        <button type="button" role="tab" aria-selected={activeTab === "published"} onClick={() => setActiveTab("published")}>Published</button>
      </div>
      {layers.length === 0 ? <p>No published layers yet.</p> : activeTab === "map" ? <div style={{ display: "grid", gap: 8 }}>
        {layers.filter((layer) => mapLayerIds.has(layer.id)).map((layer) => {
          const visible = visibleLayerIds.has(layer.id);
          return <div key={layer.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" aria-label={`Remove ${layer.name} from map`} onClick={() => removeFromMap(layer.id)}>−</button>
            <label style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
              <input type="checkbox" checked={visible} onChange={() => toggleLayer(layer.id)} />
              <span>{layer.name} · {layer.author_verified ? "Verified author" : "Unverified author"}</span>
            </label>
            {isAdmin && <button type="button" onClick={() => void removeLayer(layer)} disabled={removingLayerId === layer.id}>{removingLayerId === layer.id ? "Removing…" : "Remove"}</button>}
          </div>;
        })}
      </div> : <div style={{ display: "grid", gap: 12 }}>
        {layers.map((layer) => <article key={layer.id}>
          <strong>{layer.name}</strong>
          <p>{layer.description || "No description provided."}</p>
          <small>Author: {layer.author || "Unknown"} · Published: {new Date(layer.created_at).toLocaleString()}</small>
          {!mapLayerIds.has(layer.id) && <button type="button" onClick={() => addToMap(layer.id)} style={{ display: "block", marginTop: "0.5rem" }}>Add to map</button>}
        </article>)}
      </div>}
    </aside>
    {error ? <p role="alert">{error}</p> : <div ref={container} style={{ height: 560, width: "100%" }} aria-label="Interactive map" />}
    </>}
  </section>;
}
