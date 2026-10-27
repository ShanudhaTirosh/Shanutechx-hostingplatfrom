import nodemailer from "nodemailer";
import { getNotificationConfig, NotificationConfig } from "@/lib/settings";

export interface AlertTarget {
  name: string;
  url: string;
}

async function sendEmail(
  cfg: NotificationConfig["email"],
  site: AlertTarget,
  isUp: boolean,
  latency: number | null,
  error: string | null
) {
  if (!cfg.enabled || !cfg.host || !cfg.user || !cfg.pass || !cfg.to) return;

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const subject = `[${isUp ? "RECOVERED" : "DOWN"}] ${site.name} is ${isUp ? "up" : "down"}`;
  const text = `
Site: ${site.name} (${site.url})
Status: ${isUp ? "RECOVERED" : "DOWN"}
Time: ${new Date().toLocaleString()}
${isUp ? `Latency: ${latency}ms` : `Error: ${error}`}
  `;

  try {
    const info = await transporter.sendMail({
      from: cfg.from,
      to: cfg.to,
      subject,
      text,
    });
    console.log("Email sent: %s", info.messageId);
  } catch (err) {
    console.error("Error sending email:", err);
  }
}

async function sendGoogleChat(
  cfg: NotificationConfig["googleChat"],
  site: AlertTarget,
  isUp: boolean,
  latency: number | null,
  error: string | null
) {
  if (!cfg.enabled || !cfg.webhookUrl) return;

  const text = `*${isUp ? "RECOVERED" : "DOWN"}:* ${site.name} (${site.url})\nTime: ${new Date().toLocaleString()}\n${isUp ? `Latency: ${latency}ms` : `Error: ${error}`}`;

  try {
    await fetch(cfg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    console.log("Google Chat alert sent");
  } catch (err) {
    console.error("Error sending Google Chat alert:", err);
  }
}

async function sendDiscord(
  cfg: NotificationConfig["discord"],
  site: AlertTarget,
  isUp: boolean,
  latency: number | null,
  error: string | null
) {
  if (!cfg.enabled || !cfg.webhookUrl) return;

  const color = isUp ? 0x2ecc71 : 0xe74c3c;
  const title = `${isUp ? "[RECOVERED]" : "[DOWN]"} ${site.name}`;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: "Service", value: site.name, inline: true },
    { name: "Status", value: isUp ? "Operational / Recovered" : "Service Disruption / Down", inline: true },
    {
      name: isUp ? "Latency" : "Error",
      value: isUp ? `${latency ?? 0}ms` : (error || "Service unreachable"),
      inline: true,
    },
  ];

  if (site.url) {
    fields.push({ name: "Endpoint", value: site.url, inline: false });
  }

  const embed = {
    title,
    color,
    fields,
    footer: { text: "STX Status Telemetry" },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(cfg.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; STXStatusBot/1.0)",
      },
      body: JSON.stringify({
        username: "STX Status",
        embeds: [embed],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Discord alert error response:", res.status, errText);
    } else {
      console.log("Discord alert sent");
    }
  } catch (err) {
    console.error("Error sending Discord alert:", err);
  }
}

async function sendTeams(
  cfg: NotificationConfig["teams"],
  site: AlertTarget,
  isUp: boolean,
  latency: number | null,
  error: string | null
) {
  if (!cfg.enabled || !cfg.webhookUrl) return;

  const color = isUp ? "00FF00" : "FF0000";
  const title = `${isUp ? "RECOVERED" : "DOWN"}: ${site.name}`;

  const card = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: color,
    summary: title,
    sections: [
      {
        activityTitle: title,
        activitySubtitle: site.url,
        activityImage: "",
        facts: [
          { name: "Status", value: isUp ? "RECOVERED" : "DOWN" },
          { name: "Time", value: new Date().toLocaleString() },
          {
            name: isUp ? "Latency" : "Error",
            value: isUp ? `${latency}ms` : error,
          },
        ],
        markdown: true,
      },
    ],
  };

  try {
    await fetch(cfg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    console.log("Teams alert sent");
  } catch (err) {
    console.error("Error sending Teams alert:", err);
  }
}

async function sendTelegram(
  cfg: NotificationConfig["telegram"],
  site: AlertTarget,
  isUp: boolean,
  latency: number | null,
  error: string | null
) {
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return;

  const text = `${isUp ? "[RECOVERED]" : "[DOWN]"}: ${site.name} (${site.url})\nTime: ${new Date().toLocaleString()}\n${isUp ? `Latency: ${latency}ms` : `Error: ${error}`}`;

  try {
    await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.chatId, text }),
    });
    console.log("Telegram alert sent");
  } catch (err) {
    console.error("Error sending Telegram alert:", err);
  }
}

export async function sendAlert(
  site: AlertTarget,
  isUp: boolean,
  latency: number | null,
  error: string | null
) {
  const cfg = await getNotificationConfig();
  await Promise.allSettled([
    sendEmail(cfg.email, site, isUp, latency, error),
    sendGoogleChat(cfg.googleChat, site, isUp, latency, error),
    sendDiscord(cfg.discord, site, isUp, latency, error),
    sendTeams(cfg.teams, site, isUp, latency, error),
    sendTelegram(cfg.telegram, site, isUp, latency, error),
  ]);
}

export interface IncidentAlertPayload {
  title: string;
  type: string;
  status: string;
  impact: string;
  message: string;
  monitors?: string[];
}

export async function sendIncidentAlert(payload: IncidentAlertPayload) {
  const cfg = await getNotificationConfig();
  const prefix = payload.type === "maintenance" ? "MAINTENANCE" : "INCIDENT";
  const header = `[${prefix}] ${payload.title}`;
  const details = `Type: ${payload.type.toUpperCase()}
Status: ${payload.status.toUpperCase()}
Impact: ${payload.impact.toUpperCase()}
${payload.monitors && payload.monitors.length > 0 ? `Affected: ${payload.monitors.join(", ")}\n` : ""}Time: ${new Date().toLocaleString()}

Update:
${payload.message}`;

  const promises: Promise<any>[] = [];

  // Email
  if (cfg.email.enabled && cfg.email.host && cfg.email.user && cfg.email.pass && cfg.email.to) {
    const transporter = nodemailer.createTransport({
      host: cfg.email.host,
      port: cfg.email.port,
      secure: cfg.email.secure,
      auth: { user: cfg.email.user, pass: cfg.email.pass },
    });
    promises.push(
      transporter
        .sendMail({
          from: cfg.email.from,
          to: cfg.email.to,
          subject: header,
          text: details,
        })
        .catch((err) => console.error("Error sending incident email:", err))
    );
  }

  // Google Chat
  if (cfg.googleChat.enabled && cfg.googleChat.webhookUrl) {
    const text = `*${prefix}:* ${payload.title}\n*Status:* ${payload.status.toUpperCase()} | *Impact:* ${payload.impact.toUpperCase()}\n*Update:* ${payload.message}\nTime: ${new Date().toLocaleString()}`;
    promises.push(
      fetch(cfg.googleChat.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch((err) => console.error("Error sending incident Google Chat alert:", err))
    );
  }

  // Discord
  if (cfg.discord.enabled && cfg.discord.webhookUrl) {
    let color = 0xe67e22; // default orange
    if (payload.type === "maintenance") {
      color = payload.status === "completed" ? 0x2ecc71 : 0x3498db;
    } else if (payload.status === "resolved") {
      color = 0x2ecc71;
    } else if (payload.impact === "critical") {
      color = 0xe74c3c;
    } else if (payload.impact === "minor") {
      color = 0xf1c40f;
    }

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: "Type", value: payload.type.toUpperCase(), inline: true },
      { name: "Status", value: payload.status.toUpperCase(), inline: true },
      { name: "Impact", value: payload.impact.toUpperCase(), inline: true },
    ];

    if (payload.monitors && payload.monitors.length > 0) {
      fields.push({ name: "Affected Services", value: payload.monitors.join(", "), inline: false });
    }

    fields.push({ name: "Update Message", value: payload.message, inline: false });

    const embed = {
      title: header,
      color,
      fields,
      footer: { text: "STX Status Incident Manager" },
      timestamp: new Date().toISOString(),
    };

    promises.push(
      fetch(cfg.discord.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; STXStatusBot/1.0)",
        },
        body: JSON.stringify({
          username: "STX Status",
          embeds: [embed],
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            console.error("Discord incident alert error response:", res.status, errText);
          } else {
            console.log("Discord incident alert sent");
          }
        })
        .catch((err) => console.error("Error sending incident Discord alert:", err))
    );
  }

  // Teams
  if (cfg.teams.enabled && cfg.teams.webhookUrl) {
    const card = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      themeColor:
        payload.type === "maintenance"
          ? "0078D7"
          : payload.impact === "critical"
          ? "FF0000"
          : "FFA500",
      summary: header,
      sections: [
        {
          activityTitle: header,
          activitySubtitle: `Status: ${payload.status.toUpperCase()}`,
          facts: [
            { name: "Impact", value: payload.impact.toUpperCase() },
            { name: "Time", value: new Date().toLocaleString() },
            { name: "Message", value: payload.message },
          ],
          markdown: true,
        },
      ],
    };
    promises.push(
      fetch(cfg.teams.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      }).catch((err) => console.error("Error sending incident Teams alert:", err))
    );
  }

  // Telegram
  if (cfg.telegram.enabled && cfg.telegram.botToken && cfg.telegram.chatId) {
    const text = `${prefix}: ${payload.title}\nStatus: ${payload.status.toUpperCase()}\nImpact: ${payload.impact.toUpperCase()}\n\n${payload.message}\n\nTime: ${new Date().toLocaleString()}`;
    promises.push(
      fetch(`https://api.telegram.org/bot${cfg.telegram.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: cfg.telegram.chatId, text }),
      }).catch((err) => console.error("Error sending incident Telegram alert:", err))
    );
  }

  await Promise.allSettled(promises);
}

export async function sendTestNotification(
  targetChannel?: string
): Promise<{ success: boolean; message: string }> {
  const cfg = await getNotificationConfig();

  if (targetChannel === "discord" || (!targetChannel && cfg.discord.enabled)) {
    if (!cfg.discord.webhookUrl) {
      throw new Error("Discord webhook URL is not configured");
    }
    const embed = {
      title: "STX Status Test Notification",
      description: "Discord webhook integration is successfully configured and active on STX Status Page.",
      color: 0x2ecc71,
      fields: [
        { name: "Channel", value: "Discord Webhook", inline: true },
        { name: "Timestamp", value: new Date().toLocaleString(), inline: true },
        { name: "Status", value: "Operational", inline: true },
        { name: "Platform", value: "STX Cloud Infrastructure", inline: false },
      ],
      footer: { text: "STX Status Notification Engine" },
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(cfg.discord.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; STXStatusBot/1.0)",
      },
      body: JSON.stringify({
        username: "STX Status",
        embeds: [embed],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Discord returned HTTP ${res.status}: ${errText || res.statusText}`);
    }

    return { success: true, message: "Discord test notification sent successfully!" };
  }

  throw new Error(`Channel ${targetChannel || "default"} is not configured or not enabled.`);
}
