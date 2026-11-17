import { ImageResponse } from "next/og";
import { AppIconArt } from "@/lib/appIcon";

// Home-screen icon for iPhone and iPad (iOS rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconArt size={180} round={false} />, size);
}
