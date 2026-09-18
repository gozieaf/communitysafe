import type { Metadata } from "next";
import type { ReactNode } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { Footer } from "../components/system/Footer";

export const metadata: Metadata = {
  title: "CommunitySafe",
  description: "Find community resources.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}<Footer /></body></html>;
}
