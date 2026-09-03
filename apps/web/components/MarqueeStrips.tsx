"use client";

import React from "react";

const ITEMS_TOP = [
  "TRUSTED #1 CLOUD PLATFORM",
  "AUTONOMOUS DOCKER CONTAINERS",
  "INSTANT AUTOMATED PROVISIONING",
  "5-STAR CUSTOMER REVIEWS",
  "HIGH-SPEED V2RAY TUNNELS",
  "24/7 INSTANT SUPPORT",
];

const ITEMS_BOTTOM = [
  "PROFESSIONAL CLOUD VPS",
  "PREMIUM DATABASE CLUSTERS",
  "5-STAR CUSTOMER REVIEWS",
  "99.9% UPTIME GUARANTEE",
  "GENUINE PERFORMANCE",
  "DOCKER & BOT HOSTING ENGINE",
];

export default function MarqueeStrips() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        padding: "10px 0 20px",
        margin: "-15px 0 0",
        overflow: "hidden",
        zIndex: 5,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* Background glow behind crossing strips */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "120px",
          background:
            "radial-gradient(ellipse at center, rgba(124, 58, 237, 0.25), transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Container wrapper for the two crossing strips */}
      <div style={{ position: "relative", minHeight: "110px", width: "100%" }}>
        {/* Strip 1 - Tilted (-2.2deg), moving left to right */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "-5%",
            width: "110%",
            transform: "rotate(-2.2deg)",
            background: "rgba(13, 11, 24, 0.92)",
            borderTop: "1px solid rgba(168, 85, 247, 0.35)",
            borderBottom: "1px solid rgba(168, 85, 247, 0.35)",
            boxShadow:
              "0 4px 24px rgba(124, 58, 237, 0.25), 0 0 12px rgba(0,0,0,0.8)",
            backdropFilter: "blur(12px)",
            overflow: "hidden",
            padding: "12px 0",
            display: "flex",
            whiteSpace: "nowrap",
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              animation: "marqueeLeft 35s linear infinite",
              willChange: "transform",
            }}
          >
            {[...ITEMS_TOP, ...ITEMS_TOP, ...ITEMS_TOP, ...ITEMS_TOP].map(
              (item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "18px",
                    padding: "0 18px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 900,
                      color: "#ffffff",
                      letterSpacing: "0.12em",
                      fontFamily: "'Inter', sans-serif",
                      textShadow: "0 0 10px rgba(255,255,255,0.4)",
                    }}
                  >
                    {item}
                  </span>
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "#c084fc",
                      boxShadow: "0 0 10px #c084fc, 0 0 4px #a855f7",
                      display: "inline-block",
                    }}
                  />
                </div>
              ),
            )}
          </div>
        </div>

        {/* Strip 2 - Tilted (+2.2deg), moving right to left (crosses Strip 1) */}
        <div
          style={{
            position: "absolute",
            top: "35px",
            left: "-5%",
            width: "110%",
            transform: "rotate(2.2deg)",
            background: "rgba(10, 15, 30, 0.92)",
            borderTop: "1px solid rgba(56, 189, 248, 0.35)",
            borderBottom: "1px solid rgba(56, 189, 248, 0.35)",
            boxShadow:
              "0 4px 24px rgba(56, 189, 248, 0.25), 0 0 12px rgba(0,0,0,0.8)",
            backdropFilter: "blur(12px)",
            overflow: "hidden",
            padding: "12px 0",
            display: "flex",
            whiteSpace: "nowrap",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              animation: "marqueeRight 35s linear infinite",
              willChange: "transform",
            }}
          >
            {[
              ...ITEMS_BOTTOM,
              ...ITEMS_BOTTOM,
              ...ITEMS_BOTTOM,
              ...ITEMS_BOTTOM,
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "18px",
                  padding: "0 18px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 900,
                    color: "#ffffff",
                    letterSpacing: "0.12em",
                    fontFamily: "'Inter', sans-serif",
                    textShadow: "0 0 10px rgba(255,255,255,0.4)",
                  }}
                >
                  {item}
                </span>
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "#38bdf8",
                    boxShadow: "0 0 10px #38bdf8, 0 0 4px #06b6d4",
                    display: "inline-block",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Infinite marquee CSS keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marqueeLeft {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @keyframes marqueeRight {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0%);
          }
        }
      ` }} />
    </div>
  );
}
