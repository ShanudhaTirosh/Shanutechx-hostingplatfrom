"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Database,
  Layers,
  Cpu,
  Terminal,
  Box,
  Sparkles,
  ShieldCheck,
  ShoppingBag,
  Globe,
  ExternalLink,
  Tv,
  Zap,
  Headphones,
} from "lucide-react";

export default function BentoGrid() {
  return (
    <section
      style={{
        maxWidth: "1160px",
        margin: "10px auto 50px",
        padding: "0 24px",
        fontFamily: "'Inter', sans-serif",
        color: "#f8fafc",
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Section Header */}
      <div style={{ textAlign: "center", marginBottom: "44px" }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 16px",
            borderRadius: "9999px",
            background: "rgba(56, 189, 248, 0.08)",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            color: "#38bdf8",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "14px",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          <Sparkles size={14} /> Platform Ecosystem
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            margin: "0 0 12px",
            lineHeight: 1.15,
          }}
        >
          Everything You Need. In One Place.
        </motion.h2>
        <p
          style={{
            fontSize: "16px",
            color: "#94a3b8",
            margin: 0,
            maxWidth: "580px",
            marginInline: "auto",
          }}
        >
          Autonomous cloud infrastructure, direct repository deployments, bot
          daemons, database clusters &amp; 1-click app catalog.
        </p>
      </div>

      {/* Grid Layout Container */}
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* ─── ROW 1: Cloud VPS (50%) & App & Repo Hosting (50%) ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "18px",
          }}
        >
          {/* CARD 1: Cloud VPS */}
          <motion.a
            href="/vps"
            whileHover="hover"
            initial="initial"
            variants={{
              initial: {
                scale: 1,
                y: 0,
                borderColor: "rgba(255, 255, 255, 0.12)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              },
              hover: {
                scale: 1.015,
                y: -6,
                borderColor: "rgba(56, 189, 248, 0.6)",
                boxShadow:
                  "0 20px 45px rgba(0,0,0,0.8), 0 0 35px rgba(56, 189, 248, 0.25)",
              },
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              minHeight: "260px",
              background: "linear-gradient(135deg, #0b182e 0%, #0a0b1c 100%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "24px",
              padding: "28px",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              textDecoration: "none",
            }}
          >
            {/* Top Hairline Glow */}
            <motion.div
              variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                background:
                  "linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.9), transparent)",
                pointerEvents: "none",
                zIndex: 12,
              }}
            />

            {/* Ambient Radial Glow */}
            <motion.div
              variants={{
                initial: { opacity: 0, scale: 0.8 },
                hover: { opacity: 1, scale: 1 },
              }}
              transition={{ duration: 0.5 }}
              style={{
                position: "absolute",
                top: "-50px",
                right: "-50px",
                width: "200px",
                height: "200px",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(56, 189, 248, 0.25), transparent 70%)",
                pointerEvents: "none",
                zIndex: 3,
                filter: "blur(25px)",
              }}
            />

            {/* Animated Background Artwork */}
            <motion.img
              src="/images/bento-vps.png"
              alt="Cloud VPS Background"
              variants={{
                initial: { scale: 1, x: 0, opacity: 0.45 },
                hover: { scale: 1.08, x: -6, opacity: 0.75 },
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                height: "100%",
                width: "65%",
                objectFit: "cover",
                maskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                pointerEvents: "none",
                zIndex: 2,
              }}
              onError={(e: any) => {
                e.target.src = "/images/vps.png";
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to right, #0b182e 0%, rgba(11,24,46,0.85) 50%, transparent 100%)",
                zIndex: 3,
              }}
            />

            {/* Content */}
            <div style={{ position: "relative", zIndex: 10 }}>
              {/* Provider Logo Badges */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "14px",
                  alignItems: "center",
                }}
              >
                {[
                  { name: "Leaseweb", logo: "/images/provider-stx-big.png" },
                  { name: "Linode", logo: "/images/logos/linode.svg" },
                  {
                    name: "DigitalOcean",
                    logo: "/images/logos/digitalocean.svg",
                  },
                  { name: "BreezeHost", logo: "/images/provider-stx-fav.ico" },
                ].map((provider, idx) => (
                  <div
                    key={idx}
                    title={provider.name}
                    style={{
                      height: "28px",
                      padding: "0 8px",
                      borderRadius: "7px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <img
                      src={provider.logo}
                      alt={provider.name}
                      style={{
                        width: "15px",
                        height: "15px",
                        objectFit: "contain",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#ffffff",
                      }}
                    >
                      {provider.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Badges / Tech Tags */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "14px",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "7px",
                    background: "rgba(56, 189, 248, 0.15)",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    color: "#38bdf8",
                    fontSize: "11.5px",
                    fontWeight: 700,
                  }}
                >
                  <Cpu size={13} /> NVMe Speed Nodes
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "7px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.18)",
                    color: "#f8fafc",
                    fontSize: "11.5px",
                    fontWeight: 700,
                  }}
                >
                  <Terminal size={13} /> Root SSH
                </div>
              </div>

              <h3
                style={{
                  fontSize: "26px",
                  fontWeight: 900,
                  color: "#ffffff",
                  margin: "0 0 8px",
                  letterSpacing: "-0.01em",
                  textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                }}
              >
                Cloud VPS
              </h3>
              <p
                style={{
                  fontSize: "14.5px",
                  color: "#cbd5e1",
                  margin: 0,
                  lineHeight: 1.5,
                  maxWidth: "340px",
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}
              >
                High-speed NVMe compute nodes with root SSH
              </p>
            </div>

            {/* CTA */}
            <div
              style={{ position: "relative", zIndex: 10, marginTop: "24px" }}
            >
              <motion.div
                variants={{
                  initial: {
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderColor: "rgba(255,255,255,0.18)",
                  },
                  hover: {
                    backgroundColor: "rgba(56, 189, 248, 0.22)",
                    borderColor: "rgba(56, 189, 248, 0.6)",
                  },
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 22px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                Explore VPS
                <motion.span
                  variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                  transition={{ duration: 0.3 }}
                  style={{ display: "inline-flex" }}
                >
                  <ArrowRight size={15} color="#38bdf8" />
                </motion.span>
              </motion.div>
            </div>
          </motion.a>

          {/* CARD 2: App & Repo Hosting */}
          <motion.a
            href="/app-hosting"
            whileHover="hover"
            initial="initial"
            variants={{
              initial: {
                scale: 1,
                y: 0,
                borderColor: "rgba(255, 255, 255, 0.12)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              },
              hover: {
                scale: 1.015,
                y: -6,
                borderColor: "rgba(168, 85, 247, 0.6)",
                boxShadow:
                  "0 20px 45px rgba(0,0,0,0.8), 0 0 35px rgba(168, 85, 247, 0.25)",
              },
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              minHeight: "260px",
              background: "linear-gradient(135deg, #1d0f33 0%, #0a0b1c 100%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "24px",
              padding: "28px",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              textDecoration: "none",
            }}
          >
            {/* Top Hairline Glow */}
            <motion.div
              variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                background:
                  "linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.9), transparent)",
                pointerEvents: "none",
                zIndex: 12,
              }}
            />

            {/* Ambient Radial Glow */}
            <motion.div
              variants={{
                initial: { opacity: 0, scale: 0.8 },
                hover: { opacity: 1, scale: 1 },
              }}
              transition={{ duration: 0.5 }}
              style={{
                position: "absolute",
                top: "-50px",
                right: "-50px",
                width: "200px",
                height: "200px",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(168, 85, 247, 0.25), transparent 70%)",
                pointerEvents: "none",
                zIndex: 3,
                filter: "blur(25px)",
              }}
            />

            {/* Animated Background Artwork */}
            <motion.img
              src="/images/bento-app-repo.png"
              alt="App Hosting Background"
              variants={{
                initial: { scale: 1, x: 0, opacity: 0.45 },
                hover: { scale: 1.08, x: -6, opacity: 0.75 },
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                height: "100%",
                width: "65%",
                objectFit: "cover",
                maskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                pointerEvents: "none",
                zIndex: 2,
              }}
              onError={(e: any) => {
                e.target.src = "/images/technology.png";
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to right, #1d0f33 0%, rgba(29,15,51,0.85) 50%, transparent 100%)",
                zIndex: 3,
              }}
            />

            {/* Content */}
            <div style={{ position: "relative", zIndex: 10 }}>
              {/* Git Badges */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "16px",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  GitHub
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    borderRadius: "8px",
                    background: "rgba(252, 109, 38, 0.15)",
                    border: "1px solid rgba(252, 109, 38, 0.35)",
                    color: "#fc6d26",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="#FC6D26"
                  >
                    <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 015.5 2a.43.43 0 01.41.29l2.45 7.53h7.28l2.45-7.53A.43.43 0 0118.5 2a.42.42 0 01.79.22l2.44 7.51 1.22 3.78a.84.84 0 01-.3.94z" />
                  </svg>
                  GitLab
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    borderRadius: "8px",
                    background: "rgba(168, 85, 247, 0.15)",
                    border: "1px solid rgba(168, 85, 247, 0.35)",
                    color: "#c084fc",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  <Box size={14} /> ZIP Packages
                </div>
              </div>

              <h3
                style={{
                  fontSize: "26px",
                  fontWeight: 900,
                  color: "#ffffff",
                  margin: "0 0 8px",
                  letterSpacing: "-0.01em",
                  textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                }}
              >
                App &amp; Repo Hosting
              </h3>
              <p
                style={{
                  fontSize: "14.5px",
                  color: "#cbd5e1",
                  margin: 0,
                  lineHeight: 1.5,
                  maxWidth: "340px",
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}
              >
                Deploy from GitHub, GitLab, or ZIP packages
              </p>
            </div>

            {/* CTA */}
            <div
              style={{ position: "relative", zIndex: 10, marginTop: "24px" }}
            >
              <motion.div
                variants={{
                  initial: {
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderColor: "rgba(255,255,255,0.18)",
                  },
                  hover: {
                    backgroundColor: "rgba(168, 85, 247, 0.22)",
                    borderColor: "rgba(168, 85, 247, 0.6)",
                  },
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 22px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                Deploy App
                <motion.span
                  variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                  transition={{ duration: 0.3 }}
                  style={{ display: "inline-flex" }}
                >
                  <ArrowRight size={15} color="#c084fc" />
                </motion.span>
              </motion.div>
            </div>
          </motion.a>
        </div>

        {/* ─── ROW 2: 24/7 Bot Hosting (span 5) | Managed Databases (span 7) ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "18px",
          }}
        >
          {/* CARD 3: 24/7 Bot Hosting (span 5) */}
          <motion.a
            href="/bot-hosting"
            whileHover="hover"
            initial="initial"
            variants={{
              initial: {
                scale: 1,
                y: 0,
                borderColor: "rgba(255, 255, 255, 0.12)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              },
              hover: {
                scale: 1.015,
                y: -6,
                borderColor: "rgba(88, 101, 242, 0.6)",
                boxShadow:
                  "0 20px 45px rgba(0,0,0,0.8), 0 0 35px rgba(88, 101, 242, 0.25)",
              },
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              gridColumn: "span 5",
              minHeight: "260px",
              background: "linear-gradient(135deg, #10163b 0%, #0a0b1c 100%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "24px",
              padding: "28px",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              textDecoration: "none",
            }}
            className="bento-card-responsive"
          >
            {/* Top Hairline Glow */}
            <motion.div
              variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                background:
                  "linear-gradient(90deg, transparent, rgba(88, 101, 242, 0.9), transparent)",
                pointerEvents: "none",
                zIndex: 12,
              }}
            />

            {/* Ambient Radial Glow */}
            <motion.div
              variants={{
                initial: { opacity: 0, scale: 0.8 },
                hover: { opacity: 1, scale: 1 },
              }}
              transition={{ duration: 0.5 }}
              style={{
                position: "absolute",
                top: "-50px",
                right: "-50px",
                width: "200px",
                height: "200px",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(88, 101, 242, 0.25), transparent 70%)",
                pointerEvents: "none",
                zIndex: 3,
                filter: "blur(25px)",
              }}
            />

            {/* Animated Background Artwork */}
            <motion.img
              src="/images/bento-bot-hosting.png"
              alt="Bot Hosting Background"
              variants={{
                initial: { scale: 1, x: 0, opacity: 0.45 },
                hover: { scale: 1.08, x: -6, opacity: 0.75 },
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                height: "100%",
                width: "65%",
                objectFit: "cover",
                maskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                pointerEvents: "none",
                zIndex: 2,
              }}
              onError={(e: any) => {
                e.target.src = "/images/category-bg-discord.png";
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to right, #10163b 0%, rgba(16,22,59,0.85) 50%, transparent 100%)",
                zIndex: 3,
              }}
            />

            {/* Content */}
            <div style={{ position: "relative", zIndex: 10 }}>
              {/* Bot Icons */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "16px",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(88, 101, 242, 0.2)",
                    border: "1px solid rgba(88, 101, 242, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "5px",
                    backdropFilter: "blur(4px)",
                  }}
                  title="Discord"
                >
                  <img
                    src="/images/discord-icon.png"
                    alt="Discord Bot"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(38, 165, 228, 0.2)",
                    border: "1px solid rgba(38, 165, 228, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(4px)",
                  }}
                  title="Telegram"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="#26A5E4"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.562 8.161c-.18.717-.962 4.084-1.362 5.791-.168.73-.441.974-.704.998-.574.053-1.01-.378-1.566-.743-.87-.571-1.362-.926-2.208-1.483-.977-.643-.344-.997.213-1.576.146-.151 2.684-2.46 2.733-2.67.006-.026.012-.125-.047-.177-.058-.052-.144-.034-.207-.02-.089.02-1.503.956-4.242 2.808-.401.275-.764.41-1.089.403-.358-.008-1.047-.203-1.56-.37-.629-.204-1.129-.312-1.085-.66.023-.182.274-.368.753-.559 2.946-1.284 4.912-2.13 5.9-2.539 2.825-1.173 3.411-1.378 3.794-1.385.084 0 .273.021.395.12.103.084.132.197.146.277.014.08.03.262.016.406z" />
                  </svg>
                </div>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(37, 211, 102, 0.2)",
                    border: "1px solid rgba(37, 211, 102, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(4px)",
                  }}
                  title="WhatsApp"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="#25D366"
                  >
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l.399.637-1.159 4.234 4.332-1.136.571.332z" />
                  </svg>
                </div>
              </div>

              <h3
                style={{
                  fontSize: "24px",
                  fontWeight: 900,
                  color: "#ffffff",
                  margin: "0 0 8px",
                  letterSpacing: "-0.01em",
                  textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                }}
              >
                24/7 Bot Hosting
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "#cbd5e1",
                  margin: 0,
                  lineHeight: 1.5,
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}
              >
                Discord, Telegram &amp; WhatsApp bot daemons
              </p>
            </div>

            {/* CTA */}
            <div
              style={{ position: "relative", zIndex: 10, marginTop: "20px" }}
            >
              <motion.div
                variants={{
                  initial: {
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderColor: "rgba(255,255,255,0.18)",
                  },
                  hover: {
                    backgroundColor: "rgba(88, 101, 242, 0.22)",
                    borderColor: "rgba(88, 101, 242, 0.6)",
                  },
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 22px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                Host Bots
                <motion.span
                  variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                  transition={{ duration: 0.3 }}
                  style={{ display: "inline-flex" }}
                >
                  <ArrowRight size={15} color="#5865F2" />
                </motion.span>
              </motion.div>
            </div>
          </motion.a>

          {/* CARD 4: Managed Databases (span 7) */}
          <motion.a
            href="/databases"
            whileHover="hover"
            initial="initial"
            variants={{
              initial: {
                scale: 1,
                y: 0,
                borderColor: "rgba(255, 255, 255, 0.12)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              },
              hover: {
                scale: 1.015,
                y: -6,
                borderColor: "rgba(16, 185, 129, 0.6)",
                boxShadow:
                  "0 20px 45px rgba(0,0,0,0.8), 0 0 35px rgba(16, 185, 129, 0.25)",
              },
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              gridColumn: "span 7",
              minHeight: "260px",
              background: "linear-gradient(135deg, #09241b 0%, #0a0b1c 100%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "24px",
              padding: "28px",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              textDecoration: "none",
            }}
            className="bento-card-responsive"
          >
            {/* Top Hairline Glow */}
            <motion.div
              variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                background:
                  "linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.9), transparent)",
                pointerEvents: "none",
                zIndex: 12,
              }}
            />

            {/* Ambient Radial Glow */}
            <motion.div
              variants={{
                initial: { opacity: 0, scale: 0.8 },
                hover: { opacity: 1, scale: 1 },
              }}
              transition={{ duration: 0.5 }}
              style={{
                position: "absolute",
                top: "-50px",
                right: "-50px",
                width: "200px",
                height: "200px",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(16, 185, 129, 0.25), transparent 70%)",
                pointerEvents: "none",
                zIndex: 3,
                filter: "blur(25px)",
              }}
            />

            {/* Animated Background Artwork */}
            <motion.img
              src="/images/bento-db.png"
              alt="Managed Databases Background"
              variants={{
                initial: { scale: 1, x: 0, opacity: 0.45 },
                hover: { scale: 1.08, x: -6, opacity: 0.75 },
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                height: "100%",
                width: "65%",
                objectFit: "cover",
                maskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                pointerEvents: "none",
                zIndex: 2,
              }}
              onError={(e: any) => {
                e.target.src = "/images/configs.png";
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to right, #09241b 0%, rgba(9,36,27,0.85) 50%, transparent 100%)",
                zIndex: 3,
              }}
            />

            {/* Content */}
            <div style={{ position: "relative", zIndex: 10 }}>
              {/* Database Provider Logo Badges (PostgreSQL, MySQL, Redis, MongoDB) */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "14px",
                  alignItems: "center",
                }}
              >
                {[
                  { name: "PostgreSQL", logo: "/images/logos/postgresql.svg" },
                  { name: "MySQL", logo: "/images/logos/mysql.svg" },
                  { name: "Redis", logo: "/images/logos/redis.svg" },
                  { name: "MongoDB", logo: "/images/logos/mongodb.svg" },
                ].map((db, idx) => (
                  <div
                    key={idx}
                    title={db.name}
                    style={{
                      height: "28px",
                      padding: "0 8px",
                      borderRadius: "7px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <img
                      src={db.logo}
                      alt={db.name}
                      style={{
                        width: "15px",
                        height: "15px",
                        objectFit: "contain",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#ffffff",
                      }}
                    >
                      {db.name}
                    </span>
                  </div>
                ))}
              </div>

              <h3
                style={{
                  fontSize: "26px",
                  fontWeight: 900,
                  color: "#ffffff",
                  margin: "0 0 8px",
                  letterSpacing: "-0.01em",
                  textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                }}
              >
                Managed Databases
              </h3>
              <p
                style={{
                  fontSize: "14.5px",
                  color: "#cbd5e1",
                  margin: 0,
                  lineHeight: 1.5,
                  maxWidth: "380px",
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}
              >
                PostgreSQL, MySQL, Redis &amp; MongoDB clusters
              </p>
            </div>

            {/* CTA */}
            <div
              style={{ position: "relative", zIndex: 10, marginTop: "20px" }}
            >
              <motion.div
                variants={{
                  initial: {
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderColor: "rgba(255,255,255,0.18)",
                  },
                  hover: {
                    backgroundColor: "rgba(16, 185, 129, 0.22)",
                    borderColor: "rgba(16, 185, 129, 0.6)",
                  },
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 22px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                Launch Database
                <motion.span
                  variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                  transition={{ duration: 0.3 }}
                  style={{ display: "inline-flex" }}
                >
                  <ArrowRight size={15} color="#10b981" />
                </motion.span>
              </motion.div>
            </div>
          </motion.a>
        </div>

        {/* ─── ROW 3: CARD 5: 1-Click Catalog (Full Width, 100%) ─── */}
        <motion.a
          href="/catalog"
          whileHover="hover"
          initial="initial"
          variants={{
            initial: {
              scale: 1,
              y: 0,
              borderColor: "rgba(255, 255, 255, 0.12)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            },
            hover: {
              scale: 1.012,
              y: -6,
              borderColor: "rgba(236, 72, 153, 0.6)",
              boxShadow:
                "0 20px 45px rgba(0,0,0,0.8), 0 0 35px rgba(236, 72, 153, 0.25)",
            },
          }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            minHeight: "260px",
            background: "linear-gradient(135deg, #2b0b23 0%, #0a0b1c 100%)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "24px",
            padding: "32px",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            textDecoration: "none",
          }}
        >
          {/* Top Hairline Glow */}
          <motion.div
            variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
            transition={{ duration: 0.4 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "2px",
              background:
                "linear-gradient(90deg, transparent, rgba(236, 72, 153, 0.9), transparent)",
              pointerEvents: "none",
              zIndex: 12,
            }}
          />

          {/* Ambient Radial Glow */}
          <motion.div
            variants={{
              initial: { opacity: 0, scale: 0.8 },
              hover: { opacity: 1, scale: 1 },
            }}
            transition={{ duration: 0.5 }}
            style={{
              position: "absolute",
              top: "-50px",
              right: "-50px",
              width: "260px",
              height: "260px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(236, 72, 153, 0.25), transparent 70%)",
              pointerEvents: "none",
              zIndex: 3,
              filter: "blur(25px)",
            }}
          />

          {/* Background Image / Banner */}
          <motion.img
            src="/images/bento-catalog.png"
            alt="1-Click Catalog Background"
            variants={{
              initial: { scale: 1, x: 0, opacity: 0.45 },
              hover: { scale: 1.08, x: -6, opacity: 0.75 },
            }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              height: "100%",
              width: "60%",
              objectFit: "cover",
              objectPosition: "left top",
              maskImage:
                "linear-gradient(to left, rgba(0,0,0,1) 50%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to left, rgba(0,0,0,1) 50%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 2,
            }}
            onError={(e: any) => {
              e.target.src = "/images/dashboard.png";
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, #2b0b23 0%, rgba(43,11,35,0.85) 50%, transparent 100%)",
              zIndex: 3,
            }}
          />

          {/* Content Left */}
          <div style={{ position: "relative", zIndex: 10, maxWidth: "520px" }}>
            {/* Catalog App Badges (WordPress, N8n, Plausible, 15+ Templates) */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                marginBottom: "14px",
                alignItems: "center",
              }}
            >
              {[
                { name: "WordPress", logo: "/images/logos/wordpress.svg" },
                { name: "N8n", logo: "/images/logos/n8n.svg" },
                { name: "Plausible", logo: "/images/logos/plausible.svg" },
                { name: "15+ Templates", isIcon: true },
              ].map((app, idx) => (
                <div
                  key={idx}
                  title={app.name}
                  style={{
                    height: "28px",
                    padding: "0 8px",
                    borderRadius: "7px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {app.isIcon ? (
                    <Layers size={13} color="#f472b6" />
                  ) : (
                    <img
                      src={app.logo}
                      alt={app.name}
                      style={{
                        width: "15px",
                        height: "15px",
                        objectFit: "contain",
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#ffffff",
                    }}
                  >
                    {app.name}
                  </span>
                </div>
              ))}
            </div>

            <h3
              style={{
                fontSize: "28px",
                fontWeight: 900,
                color: "#ffffff",
                margin: "0 0 10px",
                letterSpacing: "-0.01em",
                textShadow: "0 2px 10px rgba(0,0,0,0.8)",
              }}
            >
              1-Click Catalog
            </h3>
            <p
              style={{
                fontSize: "15px",
                color: "#cbd5e1",
                margin: "0 0 24px",
                lineHeight: 1.5,
                textShadow: "0 1px 4px rgba(0,0,0,0.8)",
              }}
            >
              WordPress, N8n, Plausible &amp; 15+ templates
            </p>

            <motion.div
              variants={{
                initial: {
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.18)",
                },
                hover: {
                  backgroundColor: "rgba(236, 72, 153, 0.22)",
                  borderColor: "rgba(236, 72, 153, 0.6)",
                },
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 24px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
            >
              Browse Catalog
              <motion.span
                variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                transition={{ duration: 0.3 }}
                style={{ display: "inline-flex" }}
              >
                <ArrowRight size={15} color="#ec4899" />
              </motion.span>
            </motion.div>
          </div>
        </motion.a>

        {/* ─── ROW 4: V2Ray Proxies (50%) & Digital Goods Store (50%) ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "18px",
          }}
        >
          {/* CARD 6: V2Ray & High-Speed Proxies (External Store) */}
          <motion.a
            href="https://store.shanutechx.com"
            target="_blank"
            rel="noopener noreferrer"
            whileHover="hover"
            initial="initial"
            variants={{
              initial: {
                scale: 1,
                y: 0,
                borderColor: "rgba(255, 255, 255, 0.12)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              },
              hover: {
                scale: 1.015,
                y: -6,
                borderColor: "rgba(56, 189, 248, 0.6)",
                boxShadow:
                  "0 20px 45px rgba(0,0,0,0.8), 0 0 35px rgba(56, 189, 248, 0.25)",
              },
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              minHeight: "270px",
              background: "linear-gradient(135deg, #0f122c 0%, #0a0b1c 100%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "24px",
              padding: "28px",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              textDecoration: "none",
            }}
          >
            <motion.div
              variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                background:
                  "linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.9), transparent)",
                pointerEvents: "none",
                zIndex: 12,
              }}
            />

            {/* Background Image */}
            <motion.img
              src="/images/category-bg-v2ray.png.jpeg"
              alt="V2Ray Proxy Background"
              variants={{
                initial: { scale: 1, x: 0, opacity: 0.5 },
                hover: { scale: 1.08, x: -6, opacity: 0.8 },
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                height: "100%",
                width: "60%",
                objectFit: "cover",
                maskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                pointerEvents: "none",
                zIndex: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to right, #0f122c 0%, rgba(15,18,44,0.85) 45%, transparent 100%)",
                zIndex: 3,
              }}
            />

            <div style={{ position: "relative", zIndex: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    background: "rgba(56, 189, 248, 0.15)",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 15px rgba(56, 189, 248, 0.2)",
                  }}
                >
                  <ShieldCheck size={22} color="#38bdf8" />
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#38bdf8",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: "rgba(56, 189, 248, 0.12)",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  Ultra-Fast VPN
                </span>
              </div>

              <h3
                style={{
                  fontSize: "26px",
                  fontWeight: 900,
                  color: "#ffffff",
                  margin: "0 0 10px",
                  letterSpacing: "-0.01em",
                  textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                }}
              >
                V2Ray &amp; STX Proxies
              </h3>
              <p
                style={{
                  fontSize: "14.5px",
                  color: "#cbd5e1",
                  margin: "0 0 18px",
                  lineHeight: 1.5,
                  maxWidth: "360px",
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}
              >
                High-speed VMess, VLess &amp; Trojan obfuscated VPN nodes.
                Available exclusively on our dedicated store at store.shanutechx.com.
              </p>

              {/* Protocol Badges */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "16px",
                }}
              >
                {[
                  "VMess / VLess",
                  "Trojan Protocol",
                  "ShadowSocks",
                  "store.shanutechx.com",
                ].map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#f8fafc",
                      background: "rgba(255,255,255,0.08)",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 10 }}>
              <motion.div
                variants={{
                  initial: {
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderColor: "rgba(255,255,255,0.18)",
                  },
                  hover: {
                    backgroundColor: "rgba(56, 189, 248, 0.22)",
                    borderColor: "rgba(56, 189, 248, 0.6)",
                  },
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 22px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  width: "fit-content",
                  transition: "all 0.3s ease",
                }}
              >
                Visit Store Portal
                <motion.span
                  variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                  transition={{ duration: 0.3 }}
                >
                  <ArrowRight size={15} color="#38bdf8" />
                </motion.span>
              </motion.div>
            </div>
          </motion.a>

          {/* CARD 7: Digital Goods Store (store.shanutechx.com) */}
          <motion.a
            href="https://store.shanutechx.com"
            target="_blank"
            rel="noopener noreferrer"
            whileHover="hover"
            initial="initial"
            variants={{
              initial: {
                scale: 1,
                y: 0,
                borderColor: "rgba(255, 255, 255, 0.12)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              },
              hover: {
                scale: 1.015,
                y: -6,
                borderColor: "rgba(168, 85, 247, 0.6)",
                boxShadow:
                  "0 20px 45px rgba(0,0,0,0.8), 0 0 35px rgba(168, 85, 247, 0.28)",
              },
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              minHeight: "270px",
              background: "linear-gradient(135deg, #120e2e 0%, #0a0b1c 100%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "24px",
              padding: "28px",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              textDecoration: "none",
            }}
          >
            <motion.div
              variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                background:
                  "linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.9), transparent)",
                pointerEvents: "none",
                zIndex: 12,
              }}
            />

            {/* Background Image with App Logos */}
            <motion.img
              src="/images/bento-digital-store.png"
              alt="STX Digital Store Background"
              variants={{
                initial: { scale: 1, x: 0, opacity: 0.5 },
                hover: { scale: 1.08, x: -6, opacity: 0.8 },
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                height: "100%",
                width: "60%",
                objectFit: "cover",
                maskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)",
                pointerEvents: "none",
                zIndex: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to right, #120e2e 0%, rgba(18,14,46,0.85) 45%, transparent 100%)",
                zIndex: 3,
              }}
            />

            <div style={{ position: "relative", zIndex: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    background: "rgba(168, 85, 247, 0.15)",
                    border: "1px solid rgba(168, 85, 247, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 15px rgba(168, 85, 247, 0.2)",
                  }}
                >
                  <ShoppingBag size={22} color="#c084fc" />
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#c084fc",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: "rgba(168, 85, 247, 0.12)",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                  }}
                >
                  STX Digital Store
                </span>
              </div>

              <h3
                style={{
                  fontSize: "26px",
                  fontWeight: 900,
                  color: "#ffffff",
                  margin: "0 0 10px",
                  letterSpacing: "-0.01em",
                  textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                }}
              >
                Digital Goods &amp; Accounts
              </h3>
              <p
                style={{
                  fontSize: "14.5px",
                  color: "#cbd5e1",
                  margin: "0 0 18px",
                  lineHeight: 1.5,
                  maxWidth: "360px",
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}
              >
                Buy premium subscriptions instantly: CapCut Pro, Netflix 4K, Spotify,
                Google AI Pro, Claude Pro &amp; ChatGPT Plus.
              </p>

              {/* Digital Goods Product Badges with Icons */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "16px",
                }}
              >
                {[
                  { name: "CapCut Pro", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)" },
                  { name: "Netflix 4K", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
                  { name: "Spotify Premium", color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)" },
                  { name: "ChatGPT Plus", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
                  { name: "Claude Pro", color: "#c084fc", bg: "rgba(192, 132, 252, 0.15)" },
                  { name: "Google AI Pro", color: "#eab308", bg: "rgba(234, 179, 8, 0.15)" },
                ].map((item, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#ffffff",
                      background: item.bg,
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: `1px solid ${item.color}50`,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <span style={{ color: item.color }}>●</span>
                    {item.name}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 10 }}>
              <motion.div
                variants={{
                  initial: {
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderColor: "rgba(255,255,255,0.18)",
                  },
                  hover: {
                    backgroundColor: "rgba(168, 85, 247, 0.22)",
                    borderColor: "rgba(168, 85, 247, 0.6)",
                  },
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 22px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  width: "fit-content",
                  transition: "all 0.3s ease",
                }}
              >
                Visit store.shanutechx.com
                <motion.span
                  variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                  transition={{ duration: 0.3 }}
                >
                  <ExternalLink size={15} color="#c084fc" />
                </motion.span>
              </motion.div>
            </div>
          </motion.a>
        </div>
      </div>

      {/* Responsive Grid Breakpoints */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (max-width: 868px) {
          .bento-card-responsive { grid-column: span 12 !important; min-height: 220px !important; }
        }
      `,
        }}
      />
    </section>
  );
}
