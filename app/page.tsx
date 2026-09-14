"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RoundPreview } from "@/components/game/RoundPreview";
import { catalogCategoryHref } from "@/lib/catalog-discovery";

const TOPICS = [
  ['General Knowledge', 'A little of everything', '✳'], ['Science & Nature', 'Stay curious', '◎'],
  ['History', 'Connect the dots', '⌛'], ['Geography', 'Think beyond borders', '↗'],
  ['Sports', 'Know the game', '◈'], ['Music', 'Find your rhythm', '♫'],
];

export default function HomePage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    const value = pin.trim().toUpperCase();
    if (!value.length) { setPinError('Enter your game PIN to continue'); return; }
    if (value.length !== 6) { setPinError('Game PINs are 6 characters'); return; }
    setPinError(''); router.push(`/join?pin=${encodeURIComponent(value)}`);
  }
  return <div className="home-root">
    <section className="home-hero container">
      <aside className="home-join-card" aria-labelledby="home-join-heading">
        <div className="home-join-intro"><h2 id="home-join-heading" className="font-display home-join-title">Have a game PIN?</h2>
        <p className="home-join-subtitle">Your host has a place for you.</p></div>
        <form action="/join" method="get" onSubmit={handleJoin} className="home-inline-join">
          <label htmlFor="home-pin" className="field-label">Game PIN</label>
          <input id="home-pin" name="pin" type="text" autoCapitalize="characters" autoComplete="off" spellCheck={false}
            placeholder="6-character PIN" className={`input-pin ${pinError ? 'input-pin--error' : ''}`}
            value={pin} onChange={event => {setPin(event.target.value.toUpperCase()); setPinError('');}}
            maxLength={8} aria-invalid={!!pinError} aria-describedby={pinError ? 'home-pin-error' : undefined} />
          <button type="submit" className="btn btn-primary">Enter Game <span aria-hidden="true">→</span></button>
          {pinError && <p id="home-pin-error" className="home-pin-error" role="alert">{pinError}</p>}
        </form>
        <div className="home-join-bottom"><span>No account needed</span><Link prefetch={false} href="/present/join">Join a presentation</Link></div>
      </aside>
      <div className="home-intro">
        <p className="eyebrow">Good questions. Better together.</p>
        <h1 className="font-display home-hero-title">Turn a little curiosity<br className="home-wide-break" /> into <span>game night.</span></h1>
        <p className="home-hero-desc">Bring your friends, class, or team. Pick a quiz, share a PIN, and let everyone play.</p>
        <div className="home-hero-actions">
          <Link prefetch={false} href="/explore" className="btn btn-primary">Find a quiz <span aria-hidden="true">↗</span></Link>
          <Link prefetch={false} href="/create" className="btn btn-secondary">Create a Quiz</Link>
        </div>
      </div>

      <RoundPreview />
    </section>
    <section className="home-topics container" aria-labelledby="topics-heading">
      <div className="section-heading"><div><p className="eyebrow">Follow your curiosity</p><h2 id="topics-heading">What’s your thing?</h2></div><Link prefetch={false} href="/explore" className="text-link">Explore Library ↗</Link></div>
      <div className="home-topic-grid">{TOPICS.map(([label,desc,symbol])=><Link prefetch={false} key={label} href={catalogCategoryHref(label)} className="home-category-card"><span className="home-category-symbol" aria-hidden="true">{symbol}</span><span><strong>{label}</strong><small>{desc}</small></span><span aria-hidden="true">↗</span></Link>)}</div>
    </section>
    <section className="home-host-section container" aria-labelledby="host-heading">
      <div><p className="eyebrow">Your turn to bring everyone together</p><h2 id="host-heading">Less setup.<br />More “one more round.”</h2><Link prefetch={false} href="/host" className="btn btn-primary">Host a Game ↗</Link></div>
      <ol className="home-steps"><li><span>01</span><div><h3>Find your starting point</h3><p>Choose from the public library or create your own quiz.</p></div></li><li><span>02</span><div><h3>Make it your room</h3><p>Choose a game mode. Host the show or play along.</p></div></li><li><span>03</span><div><h3>Share the PIN. You’re on.</h3><p>Players join on their devices. You control when each round starts.</p></div></li></ol>
    </section>
  </div>;
}
