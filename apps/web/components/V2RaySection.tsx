'use client';

import React from 'react';
import { Zap, ExternalLink } from 'lucide-react';
import Reveal from './motion/Reveal';
import TiltCard from './motion/TiltCard';

const V2RAY_FEATURES = [
  { title: 'Protocols Supported', desc: 'VMess, VLESS, Trojan, Shadowsocks, gRPC, WebSocket' },
  { title: 'Bypass & Gaming', desc: 'Optimized routing for gaming lag reduction & ISP bypass' },
  { title: 'Unlimited Bandwidth', desc: 'High-speed 10Gbps node connections with zero throttling' },
  { title: 'Netch & V2RayN Ready', desc: '1-click import subscription URLs for Windows, Android, iOS' },
];

export default function V2RaySection() {
  return (
    <section className="py-20 bg-transparent text-white relative font-sans border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal className="bg-gradient-to-r from-[#12132a] via-[#1a1738] to-[#12132a] border border-purple-500/30 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          {/* Background Glow Aura */}
          <div className="absolute right-0 top-0 w-96 h-96 bg-purple-600/20 blur-3xl rounded-full pointer-events-none" />

          <div className="grid lg:grid-cols-2 gap-8 items-center relative z-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-purple-300" /> High-Speed Proxy Solutions</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                V2Ray &amp; Netch <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-300 to-indigo-300">Proxy Configs</span>
              </h2>
              <p className="text-text-muted text-sm leading-relaxed">
                Looking for low-latency gaming proxies, VMess/VLESS tunneling, or private Netch configurations? We offer premium high-speed V2Ray proxy subscriptions powered by our worldwide edge nodes.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {V2RAY_FEATURES.map((item, idx) => (
                  <Reveal key={idx} index={idx} delay={0.1}>
                    <TiltCard strength={4} spotlight={false} className="h-full bg-black/30 border border-white/10 rounded-2xl p-4 space-y-1 hover:border-purple-500/30">
                      <h4 className="font-bold text-xs text-white">{item.title}</h4>
                      <p className="text-[11px] text-text-muted">{item.desc}</p>
                    </TiltCard>
                  </Reveal>
                ))}
              </div>

              <div className="pt-2 flex flex-wrap gap-4 items-center">
                <a
                  href="https://store.shanutechx.com"
                  target="_blank"
                  rel="noreferrer"
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-glow-violet transition-all flex items-center gap-2"
                >
                  <span>Visit V2Ray Proxy Store Portal</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <span className="text-xs text-text-faint font-mono">Instant subscription delivery after payment</span>
              </div>
            </div>

            {/* Right Card Mockup */}
            <Reveal index={2}>
              <TiltCard strength={5} spotlight={false} className="bg-[#0b0c1b] border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="font-mono text-xs text-purple-300 font-bold">V2Ray Node Status Monitor</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 uppercase">99.99% Online</span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  {[
                    { name: 'DE-Frankfurt-VLESS', ping: '18 ms', protocol: 'VLESS+TLS' },
                    { name: 'US-Virginia-VMess', ping: '24 ms', protocol: 'VMess+WS' },
                    { name: 'SG-Singapore-Trojan', ping: '12 ms', protocol: 'Trojan+gRPC' },
                    { name: 'LK-Colombo-Shadowsocks', ping: '5 ms', protocol: 'Shadowsocks-2022' },
                  ].map((node, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="font-bold text-white">{node.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted text-[11px]">{node.protocol}</span>
                        <span className="text-emerald-400 font-bold">{node.ping}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </TiltCard>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
