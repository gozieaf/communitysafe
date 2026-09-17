"use client";

import { useEffect, useRef, useState } from "react";
import type { CircleLayerSpecification, FillLayerSpecification, GeoJSONSource, LineLayerSpecification, Map as MapLibreMap } from "maplibre-gl";

import { getLayerFeatures, getLayers, type LayerSummary } from "../../lib/api-client";

function isPolygon(type: string): boolean { return type === "Polygon" || type === "MultiPolygon"; }
function isLine(type: string): boolean { return type === "LineString" || type === "MultiLineString"; }

export function MapView() {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const layersRef = useRef<LayerSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
    if (!container.current || !styleUrl) {
      if (!styleUrl) setError("Set NEXT_PUBLIC_MAP_STYLE_URL to display the map.");
      return;
    }
    let disposed = false;
    let map: MapLibreMap | null = null;

    async function initialize(): Promise<void> {
      const maplibregl = await import("maplibre-gl");
      if (disposed || !container.current) return;
      map = new maplibregl.Map({ container: container.current, style: styleUrl, center: [3.3792, 6.5244], zoom: 8 });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = map;
      map.on("load", async () => {
        try {
          const layers = await getLayers();
          if (disposed || !map) return;
          layersRef.current = layers;
          for (const layer of layers) {
            map.addSource(layer.id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            const style = layer.style ?? {};
            if (isPolygon(layer.geometry_type)) map.addLayer({ id: layer.id, source: layer.id, type: "fill", paint: style.paint as FillLayerSpecification["paint"], layout: style.layout as FillLayerSpecification["layout"] });
            else if (isLine(layer.geometry_type)) map.addLayer({ id: layer.id, source: layer.id, type: "line", paint: style.paint as LineLayerSpecification["paint"], layout: style.layout as LineLayerSpecification["layout"] });
            else map.addLayer({ id: layer.id, source: layer.id, type: "circle", paint: style.paint as CircleLayerSpecification["paint"], layout: style.layout as CircleLayerSpecification["layout"] });
          }
          await refreshFeatures();
        } catch (reason) {
          if (!disposed) setError(reason instanceof Error ? reason.message : "Could not load map layers");
        }
      });
      map.on("moveend", () => { void refreshFeatures(); });
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
  }, []);

  return <section><h2>Map</h2>{error ? <p role="alert">{error}</p> : <div ref={container} style={{ height: 560, width: "100%" }} aria-label="Interactive map" />}</section>;
}
