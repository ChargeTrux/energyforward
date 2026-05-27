import { useEffect, useRef } from "react";
import "./LandingStealth.css";

const A = ({ children = "." }: { children?: React.ReactNode }) => (
  <span className="ef-amber">{children}</span>
);

export default function LandingStealth() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.title = "energyforward · in stealth";
    const setMeta = (name: string, content: string) => {
      let m = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!m) { m = document.createElement("meta"); m.name = name; document.head.appendChild(m); }
      m.content = content;
    };
    setMeta("description", "energyforward · operating in stealth · moving the future of energy forward.");
    setMeta("robots", "noindex,nofollow");

    const v = videoRef.current;
    if (v) {
      const ready = () => v.classList.add("is-ready");
      if (v.readyState >= 2) ready();
      else v.addEventListener("loadeddata", ready, { once: true });
      v.play().catch(() => {});
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll(".ef-reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="ef-root">
      <nav className="ef-nav">
        <div className="ef-brand">energyforward<A /></div>
        <div className="ef-nav-right">
          <div className="ef-nav-meta">
            <span className="ef-dot" />
            <span>operating in stealth</span>
          </div>
          <a href="#access" className="ef-signin">sign in</a>
        </div>
      </nav>

      <section className="ef-hero">
        <video
          ref={videoRef}
          className="ef-bg-video"
          autoPlay muted loop playsInline
          poster="/ef-assets/ef-hero-highway.png"
          src="/ef-assets/hero-cinematic.mp4"
        />
        <div className="ef-hero-veil" />
        <div className="ef-hero-grid" />
        <div className="ef-hero-inner">
          <div className="ef-meta-strip">
            energyforward <A>·</A> stealth <A>·</A> 2026
          </div>
          <h1 className="ef-hero-head">
            moving the future of energy<br />
            <span className="ef-amber">forward.</span>
          </h1>
          <div className="ef-cue">
            <span className="ef-cue-label">read</span>
            <span className="ef-cue-line" />
          </div>
        </div>
      </section>

      <section className="ef-essay ef-essay-teal ef-reveal">
        <div className="ef-essay-inner">
          <div className="ef-label">act i</div>
          <h2 className="ef-essay-head">the railroad<A /></h2>
          <p className="ef-essay-body">
            the railroad was the first great infrastructure network for moving goods across america. transformative. essential. and constrained: you could only receive what the railroad could deliver to where the tracks ran. no track, no commerce. the railroad defined the geography of economic possibility.
          </p>
        </div>
      </section>

      <section className="ef-essay ef-essay-dark ef-reveal">
        <div className="ef-essay-inner">
          <div className="ef-label">act ii</div>
          <h2 className="ef-essay-head">then, the highway<A /></h2>
          <p className="ef-essay-body">
            the highway didn't replace the railroad — it complemented it. but the truck did something the railroad never could. it went to the demand. it brought supply to wherever supply was needed, on any timeline, at any scale, without waiting for track to be laid. together, they unlocked commerce at a speed and scale neither could achieve alone.
          </p>
        </div>
      </section>

      <section className="ef-essay ef-essay-teal ef-reveal">
        <div className="ef-essay-inner">
          <div className="ef-label">act iii</div>
          <h2 className="ef-essay-head">now, apply it to energy<A /></h2>
          <p className="ef-essay-body">
            the grid is the backbone. it moves enormous volumes of electricity efficiently across long distances. it is essential. it is not going away. but it has the same fundamental constraint the railroad always had — you can only receive power where the wires run, and getting new wire to new places takes years.
          </p>
        </div>
      </section>

      <section className="ef-close ef-reveal">
        <div className="ef-close-inner">
          <blockquote className="ef-close-pull">
            energyforward is to the electrical grid what the highway and trucking system was to the railroad<A />
          </blockquote>
          <div className="ef-close-stack">
            <p className="ef-close-body">we don't need the grid to extend itself to deliver clean renewable power. we deliver power ourselves.</p>
            <p className="ef-close-body">
              <span className="ef-stp">speed to power</span>, decoupled from the speed of grid construction<A />
            </p>
            <p className="ef-close-body">energyforward is changing the way clean energy is delivered. not five years from now — delivering yesterday's energy production, today.</p>
            <p className="ef-close-final">we are moving the future of energy forward<A /></p>
          </div>
          <div className="ef-signoff">energyforward<A /></div>
        </div>
      </section>

      <section id="access" className="ef-access ef-reveal">
        <div className="ef-access-inner">
          <div className="ef-access-kicker">credentialed access</div>
          <p className="ef-access-body">if you have been given a passcode, you may enter the portal below<A /></p>
          <div className="ef-access-row">
            <a className="ef-access-link" href="#">customers <span className="ef-arrow">→</span></a>
            <span className="ef-access-sep">·</span>
            <a className="ef-access-link" href="/investor">investors <span className="ef-arrow">→</span></a>
          </div>
        </div>
      </section>

      <footer className="ef-footer">
        <span>energyforward inc<A /></span>
        <span>stealth <span className="ef-amber">·</span> 2026</span>
      </footer>
    </div>
  );
}