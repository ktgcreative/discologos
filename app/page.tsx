"use client";

import { useState } from "react";
import { PiNotionLogoBold, PiSpotifyLogoDuotone, PiXLogo } from "react-icons/pi";
import { FaDiscord, FaFacebook, FaFacebookMessenger, FaInstagram, FaLinkedin, FaReddit, FaWhatsapp, FaYoutube } from "react-icons/fa";
import { FaThreads } from "react-icons/fa6";
import { SiClaude, SiNetflix, SiSlack, SiSnapchat, SiTiktok, SiUbereats } from "react-icons/si";
import {
  DiscoScene,
  type DiscoFaceIcon,
} from "@/components/disco/disco-cube";
import {
  DiscoToolbar,
  type DiscoToolbarState,
  type IconOption,
} from "@/components/disco/toolbar";
import {
  DEFAULT_DISCO_CONTROLS,
  DISCO_CLOSENESS,
  densityToMirrorSize,
} from "@/components/disco/control-config";
import {
  CUBE_CONFIG,
  paletteFromTint,
} from "@/components/disco/theme-config";
import { SiteHeader } from "@/components/disco/site-header";
import { FirstTableIcon } from "@/components/disco/icons";

type LogoConfig = {
  id: string;
  label: string;
  Icon: IconOption["Icon"];
  faceIcon: DiscoFaceIcon;
  tint: string;
  iconTint: string;
  tintGradient?: string[];
};


const LOGO_CONFIG: LogoConfig[] = [
  { id: "netflix", label: "Netflix", Icon: SiNetflix, faceIcon: SiNetflix, tint: "#E50914", iconTint: "#ffffff" },
  {
    id: "instagram",
    label: "Instagram",
    Icon: FaInstagram,
    faceIcon: FaInstagram,
    tint: "#E1306C",
    iconTint: "#ffffff",
    tintGradient: ["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"],
  },
  { id: "slack", label: "Slack", Icon: SiSlack, faceIcon: { svgUrl: "/Slack.svg" }, tint: "#ffffff", iconTint: "#ffffff" },
  {
    id: "firsttable",
    label: "FirstTable",
    Icon: FirstTableIcon,
    faceIcon: { svgUrl: "/FirstTable.svg" },
    tint: "#265682",
    iconTint: "#ffffff",
  },
  {
    id: "messenger",
    label: "Messenger",
    Icon: FaFacebookMessenger,
    faceIcon: FaFacebookMessenger,
    tint: "#0084FF",
    iconTint: "#ffffff",
    tintGradient: ["#00B2FF", "#006AFF", "#FF006E", "#FF7E29"],
  },



  { id: "tiktok", label: "TikTok", Icon: SiTiktok, faceIcon: { svgUrl: "/tiktok.svg" }, tint: "#1a1a1a", iconTint: "#ffffff" },
  { id: "x", label: "X", Icon: PiXLogo, faceIcon: PiXLogo, tint: "#1a1a1a", iconTint: "#ffffff" },
  { id: "linkedin", label: "LinkedIn", Icon: FaLinkedin, faceIcon: FaLinkedin, tint: "#0A66C2", iconTint: "#ffffff" },
  { id: "notion", label: "Notion", Icon: PiNotionLogoBold, faceIcon: PiNotionLogoBold, tint: "#ffffff", iconTint: "#111111" },
  { id: "youtube", label: "YouTube", Icon: FaYoutube, faceIcon: FaYoutube, tint: "#FF0000", iconTint: "#ffffff" },
  { id: "claude", label: "Claude", Icon: SiClaude, faceIcon: SiClaude, tint: "#D97444", iconTint: "#ffffff" },
  {
    id: "spotify",
    label: "Spotify",
    Icon: PiSpotifyLogoDuotone,
    faceIcon: PiSpotifyLogoDuotone,
    tint: "#1a1a1a",
    iconTint: "#1DB954",
  },
  { id: "ubereats", label: "Uber Eats", Icon: SiUbereats, faceIcon: SiUbereats, tint: "#06C167", iconTint: "#111111" },
  { id: "snapchat", label: "Snapchat", Icon: SiSnapchat, faceIcon: SiSnapchat, tint: "#FFFC00", iconTint: "#ffffff" },
  { id: "reddit", label: "Reddit", Icon: FaReddit, faceIcon: FaReddit, tint: "#FF4500", iconTint: "#ffffff" },
  { id: "facebook", label: "Facebook", Icon: FaFacebook, faceIcon: FaFacebook, tint: "#1877F2", iconTint: "#ffffff" },

  { id: "threads", label: "Threads", Icon: FaThreads, faceIcon: FaThreads, tint: "#1a1a1a", iconTint: "#ffffff" },
  { id: "whatsapp", label: "WhatsApp", Icon: FaWhatsapp, faceIcon: FaWhatsapp, tint: "#25D366", iconTint: "#ffffff" },
  { id: "discord", label: "Discord", Icon: FaDiscord, faceIcon: FaDiscord, tint: "#5865F2", iconTint: "#ffffff" },

];

const ICON_OPTIONS: IconOption[] = LOGO_CONFIG.map(({ id, label, Icon, tint, iconTint }) => ({
  id,
  label,
  Icon,
  tint,
  iconTint,
}));

const LOGO_CONFIG_BY_ID = Object.fromEntries(
  LOGO_CONFIG.map((config) => [config.id, config]),
) as Record<string, LogoConfig>;

const DEFAULT_LOGO = LOGO_CONFIG_BY_ID.netflix;

export default function DiscoPage() {
  const [state, setState] = useState<DiscoToolbarState>({
    ...DEFAULT_DISCO_CONTROLS,
    tint: DEFAULT_LOGO.tint,
    iconTint: DEFAULT_LOGO.iconTint,
    iconKey: DEFAULT_LOGO.id,
  });

  const handleChange = (next: DiscoToolbarState) => {
    // When the user picks a different logo, snap the body + icon tints to its
    // brand preset so the colors track the selection.
    if (next.iconKey !== state.iconKey) {
      const config = LOGO_CONFIG_BY_ID[next.iconKey];
      if (config) {
        next = { ...next, tint: config.tint, iconTint: config.iconTint };
      }
    }
    setState(next);
  };

  const face = LOGO_CONFIG_BY_ID[state.iconKey]?.faceIcon;
  const faceIcons: DiscoFaceIcon[] | undefined =
    state.shape === CUBE_CONFIG.shape && face
      ? [face, face, face, face, face, face]
      : undefined;
  const palette = paletteFromTint(state.tint);

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        background: `
          radial-gradient(circle at 50% 42%, ${palette.bgFocus} 0%, transparent 34%),
          radial-gradient(circle at 63% 57%, ${palette.bgAccent} 0%, transparent 32%),
          linear-gradient(145deg, ${palette.bgStart}, ${palette.bgEnd})
        `,
      }}
    >
      <SiteHeader />
      <DiscoScene
        shape={state.shape}
        mirrorSize={densityToMirrorSize(state.density)}
        tint={state.tint}
        tintGradient={LOGO_CONFIG_BY_ID[state.iconKey]?.tintGradient}
        gradientDirection={CUBE_CONFIG.gradientDirection}
        iconTint={state.iconTint}
        autoRotateSpeed={state.autoRotateSpeed}
        closeness={DISCO_CLOSENESS}
        faceIcons={faceIcons}
        iconScale={CUBE_CONFIG.iconScale}
        iconRaise={CUBE_CONFIG.iconRaise}
        iconDepth={CUBE_CONFIG.iconDepth}
        className="absolute inset-0 h-full w-full"
      />
      <DiscoToolbar
        value={state}
        onChange={handleChange}
        iconOptions={ICON_OPTIONS}
      />
    </div>
  );
}
