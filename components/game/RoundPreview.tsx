"use client";
import {useState} from 'react';

const PHASES = [
  {id:'join', label:'1. Gather', title:'One room. Every screen.', description:'Share the PIN. Everyone joins on their own device.'},
  {id:'play', label:'2. Play', title:'A question for everyone.', description:'Choose an answer on your device. Your host controls the pace.'},
  {id:'reveal', label:'3. Reveal', title:'The moment of truth.', description:'See the answer. See where you stand.'},
] as const;

/** Interactive explanation only. Never creates a room or simulates live results. */
export function RoundPreview() {
  const [phase,setPhase]=useState<typeof PHASES[number]['id']>('join');
  const current=PHASES.find(item=>item.id===phase)!;
  return <section className="round-preview" data-phase={phase} aria-label="How a live round works">
    <div className="round-preview-top"><p className="eyebrow">How a live round works</p></div>
    <svg className="round-scene" viewBox="0 0 500 240" fill="none" aria-hidden="true">
      <ellipse cx="250" cy="132" rx="211" ry="80" stroke="#5a6d8b" strokeDasharray="3 8"/>
      <path className="round-connect" d="m105 170 92-72 108 0 90 72" stroke="#dcfa60" strokeWidth="3" strokeDasharray="6 8"/>
      <g className="round-phone round-phone-left"><rect x="38" y="93" width="78" height="123" rx="15" fill="#e9efff" stroke="#10162f" strokeWidth="3"/><path d="M62 105H92M65 204H89" stroke="#172c4b" strokeWidth="4" strokeLinecap="round"/><circle cx="77" cy="144" r="13" fill="#75dbc9"/><path d="M56 181c0-23 42-23 42 0" fill="#172c4b"/></g>
      <g className="round-phone round-phone-right"><rect x="384" y="93" width="78" height="123" rx="15" fill="#e9efff" stroke="#10162f" strokeWidth="3"/><path d="M408 105h30M411 204h24" stroke="#172c4b" strokeWidth="4" strokeLinecap="round"/><circle cx="423" cy="144" r="13" fill="#ff886f"/><path d="M402 181c0-23 42-23 42 0" fill="#172c4b"/></g>
      <g className="round-screen"><rect x="161" y="28" width="178" height="151" rx="18" fill="#f3f6fc" stroke="#10162f" strokeWidth="3"/><rect x="179" y="45" width="142" height="27" rx="7" fill="#dce4ef"/><path d="M208 58h84" stroke="#172c4b" strokeWidth="4" strokeLinecap="round"/>
      <rect className="round-choice round-choice-a" x="179" y="86" width="65" height="35" rx="8" fill="#ff886f"/><rect className="round-choice round-choice-b" x="256" y="86" width="65" height="35" rx="8" fill="#75dbc9"/><rect className="round-choice round-choice-c" x="179" y="132" width="65" height="29" rx="8" fill="#a8c9ff"/><rect className="round-choice round-choice-d" x="256" y="132" width="65" height="29" rx="8" fill="#dcfa60"/>
      <path className="round-check" d="m272 103 9 8 17-19" stroke="#172c4b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></g>
      <g className="round-podium"><path d="M200 218v-20h30v20M235 218v-46h30v46M270 218v-29h30v29" fill="#dcfa60"/><path d="m239 160 11-13 11 13" stroke="#dcfa60" strokeWidth="4" strokeLinecap="round"/></g>
    </svg>
    <h2>{current.title}</h2><p className="round-caption" role="status">{current.description}</p>
    <div className="round-controls" role="group" aria-label="Explore the round">{PHASES.map(item=><button key={item.id} type="button" aria-pressed={phase===item.id} onClick={()=>setPhase(item.id)}>{item.label}</button>)}</div>
    <noscript><p>Players join by PIN, answer questions on their devices, and see the reveal together.</p></noscript>
  </section>;
}
