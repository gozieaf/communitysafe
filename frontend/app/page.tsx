import { ChatWidget } from "../components/chat/ChatWidget";
import { MapView } from "../components/map/MapView";

export default function HomePage() {
  return <main style={{ fontFamily: "system-ui, sans-serif", margin: "2rem auto", maxWidth: 1200, padding: "0 1.5rem" }}>
    <h1>GeoApp</h1>
    <p>Browse published spatial layers. <a href="/login">Admin sign in</a></p>
    <MapView />
    <ChatWidget />
  </main>;
}
