import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Clock3,
  Users,
  Video,
  Plus,
  Search,
  LayoutDashboard,
  Ticket,
  Check,
  CheckCircle2,
  X,
  ChevronLeft,
  MapPin,
  Cloud,
  Menu,
  LogOut,
  ScanLine,
  ExternalLink,
  SlidersHorizontal,
  Copy,
  Leaf,
  Code2,
  Shapes,
  Mic2,
  Briefcase,
  LoaderCircle,
} from "lucide-react";
import "./styles.css";
import { Amplify } from "aws-amplify";
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  confirmSignIn,
} from "aws-amplify/auth";

const API = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const DEMO = API === "/api";
const COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;

const COGNITO_USER_POOL_CLIENT_ID = import.meta.env
  .VITE_COGNITO_USER_POOL_CLIENT_ID;

if (COGNITO_USER_POOL_ID && COGNITO_USER_POOL_CLIENT_ID) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: COGNITO_USER_POOL_ID,
        userPoolClientId: COGNITO_USER_POOL_CLIENT_ID,
      },
    },
  });
}
const profiles = [
  ["student-1", "Jamie Chen"],
  ["student-2", "Priya Shah"],
  ["student-3", "Sam Rivera"],
  ["organizer-demo", "Alex · Organizer"],
];
const categories = [
  "All events",
  "Technology",
  "Design",
  "Career",
  "Community",
];
const fmt = (value, options) =>
  new Date(value).toLocaleDateString("en-IN", options);
const date = (value) => fmt(value, { day: "numeric", month: "short" });
const time = (value) =>
  new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
const icons = {
  Technology: Code2,
  Design: Shapes,
  Career: Briefcase,
  Community: Mic2,
};
function App() {
  const [user, setUser] = useState(
    sessionStorage.getItem("cloudmeet-user") || "student-1",
  );
  const [signedIn, setSignedIn] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [events, setEvents] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [page, setPage] = useState("discover"),
    [selected, setSelected] = useState(null),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("All events"),
    [search, setSearch] = useState(""),
    [mobile, setMobile] = useState(false);
  const [checkToken, setCheckToken] = useState("");
  async function request(path, method = "GET", body) {
    let token;

    if (!DEMO) {
      try {
        const session = await fetchAuthSession();
        token = session.tokens?.accessToken?.toString();
      } catch {
        // Public event requests should still work when signed out.
      }
    }

    const response = await fetch(API + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(DEMO
          ? { "x-demo-user": user }
          : token
            ? { Authorization: `Bearer ${token}` }
            : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  }
  async function refresh() {
    try {
      const data = await request("/events");
      setEvents(data);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

useEffect(() => {
  setLoading(true);
  refresh();
  const timer = setInterval(refresh, 15000);
  return () => clearInterval(timer);
}, [user, signedIn]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const dialog = document.querySelector('[role="dialog"]');
    const focusable = () =>
      [
        ...dialog.querySelectorAll(
          "button,input,select,textarea,summary,a[href]",
        ),
      ].filter((el) => !el.disabled);
    focusable()[0]?.focus();
    const handle = (e) => {
      if (e.key === "Escape" && !busy) setModal(null);
      if (e.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [modal, busy]);
  useEffect(() => {
    if (DEMO) return;

    getCurrentUser()
      .then((current) => {
        setAuthUsername(current.username);
        setSignedIn(true);
      })
      .catch(() => {
        setAuthUsername("");
        setSignedIn(false);
      });
  }, []);
  const event = events.find((e) => e.eventId === selected);
  const registered = events.filter((e) => e.registration);
  const owned = events.filter((e) => e.isOwner);
  const organizer = DEMO ? user === "organizer-demo" : owned.length > 0;
  function navigate(next) {
    setPage(next);
    setSelected(null);
    setMobile(false);
    setError("");
    window.scrollTo({ top: 0 });
  }
  function openEvent(e) {
    setSelected(e.eventId);
    setPage("detail");
    window.scrollTo({ top: 0 });
  }
  async function action(path, body, message) {
    setBusy(true);
    setError("");
    try {
      await request(path, "POST", body);
      await refresh();
      setNotice(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveEvent(e) {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    const body = {
      ...fields,
      capacity: Number(fields.capacity),
      startTime: new Date(fields.startTime).toISOString(),
      endTime: new Date(fields.endTime).toISOString(),
    };
    setBusy(true);
    setError("");
    try {
      await request(
        modal?.event ? `/events/${modal.event.eventId}` : "/events",
        modal?.event ? "PATCH" : "POST",
        body,
      );
      setModal(null);
      await refresh();
      setNotice("Your event is ready. Bring your people together.");
      setPage("dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const totals = owned.reduce(
    (a, e) => ({
      confirmed: a.confirmed + e.confirmed,
      waitlisted: a.waitlisted + e.waitlisted,
      checkedIn: a.checkedIn + e.checkedIn,
    }),
    { confirmed: 0, waitlisted: 0, checkedIn: 0 },
  );
  const visible = events.filter(
    (e) =>
      (filter === "All events" || e.category === filter) &&
      `${e.title} ${e.description} ${e.organizerName}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="app">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("discover");
          }}
        >
          <span className="brand-icon">
            <Cloud size={23} />
          </span>
          cloudmeet<span className="brand-dot">.</span>
        </a>
        <nav className={mobile ? "nav open" : "nav"}>
          <button
            className={page === "discover" ? "active" : ""}
            onClick={() => navigate("discover")}
          >
            Discover
          </button>
          <button
            className={page === "tickets" ? "active" : ""}
            onClick={() => navigate("tickets")}
          >
            My events
            {registered.length > 0 && (
              <span className="nav-count">{registered.length}</span>
            )}
          </button>
          <button
            className={page === "dashboard" ? "active" : ""}
            onClick={() => navigate("dashboard")}
          >
            Organizer dashboard
          </button>
        </nav>
        <div className="account">
          {DEMO ? (
            <>
              <span className="demo-label">DEMO</span>
              <select
                aria-label="Demo identity"
                value={user}
                onChange={(e) => {
                  setUser(e.target.value);
                  sessionStorage.setItem("cloudmeet-user", e.target.value);
                  setError("");
                }}
              >
                {profiles.map(([id, name]) => (
                  <option value={id} key={id}>
                    {name}
                  </option>
                ))}
              </select>
            </>
          ) : (
          <button
            className="text-button"
            onClick={() => setModal({ type: 'session' })}
          >
            {signedIn ? 'Manage account' : 'Sign in'}
          </button>
          )}
          <span className="avatar">
            {DEMO
              ? user === "organizer-demo"
                ? "AM"
                : user === "student-2"
                  ? "PS"
                  : user === "student-3"
                    ? "SR"
                    : "JC"
              : "CM"}
          </span>
          <button
            className="mobile-menu icon-button"
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
        </div>
      </header>
      <main>
        {error && (
          <div className="alert error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <CheckCircle2 size={18} />
            {notice}
          </div>
        )}
        {page === "discover" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span /> A LITTLE CURIOSITY. A LOT OF CONNECTION.
                </div>
                <h1>
                  Your campus.
                  <br />
                  Your people.
                  <br />
                  <span>Your next thing.</span>
                </h1>
                <p>
                  Big ideas start with showing up. Find a workshop,
                  <br className="desktop-break" /> meet your community, and make
                  something happen.
                </p>
                <button
                  className="button primary"
                  onClick={() =>
                    document
                      .getElementById("events")
                      .scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Find your next event <ArrowUpRight size={18} />
                </button>
                <div className="hero-social">
                  <div className="avatar-stack">
                    <span>JS</span>
                    <span>AK</span>
                    <span>MR</span>
                    <span>PD</span>
                  </div>
                  <span>A space for every kind of curious.</span>
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-grid" />
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <span className="art-spark">✳</span>
                <span className="art-star">✦</span>
                <div className="floating-label label-one">
                  <span className="small-green-dot" /> Good people. Great ideas.
                </div>
                <div className="visual-card visual-back">
                  <div className="visual-icon">
                    <Shapes size={52} />
                  </div>
                  <div className="visual-bars">
                    <i />
                    <i />
                  </div>
                </div>
                <div className="visual-card visual-front">
                  <div className="mini-eyebrow">YOU’RE INVITED</div>
                  <div className="art-calendar">
                    <CalendarDays size={46} />
                    <span className="calendar-star">✦</span>
                  </div>
                  <h3>
                    Something good
                    <br />
                    is coming up.
                  </h3>
                  <div className="art-card-bottom">
                    <span>Save your seat</span>
                    <span>
                      <ArrowUpRight size={20} />
                    </span>
                  </div>
                </div>
                <div className="floating-label label-two">
                  <Video size={17} /> Meet from anywhere <span>↗</span>
                </div>
                <div className="art-leaf">
                  <Leaf size={32} />
                </div>
              </div>
            </section>
            <div className="benefits">
              <span>
                <span className="benefit-symbol">✳</span> Made for campus
                communities
              </span>
              <span>
                <Video size={17} /> A front-row seat, from anywhere
              </span>
              <span>
                <Ticket size={17} /> Less planning. More being there.
              </span>
            </div>
            <section id="events" className="events-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow muted">
                    GO WHERE YOUR CURIOSITY TAKES YOU
                  </div>
                  <h2>
                    Something for everyone<span>.</span>
                  </h2>
                  <p>
                    Your next conversation, skill, or spark of inspiration is
                    right here.
                  </p>
                </div>
                <button
                  className="button light"
                  onClick={() =>
                    organizer
                      ? setModal({ type: "event" })
                      : navigate("dashboard")
                  }
                >
                  <Plus size={17} /> Host an event
                </button>
              </div>
              <div className="filter-row">
                <div className="filters">
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={filter === c ? "selected" : ""}
                      onClick={() => setFilter(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Search events"
                    placeholder="Find your thing..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              {loading ? (
                <Loading />
              ) : visible.length ? (
                <div className="event-grid">
                  {visible.map((e, i) => (
                    <EventCard
                      key={e.eventId}
                      event={e}
                      index={i}
                      onClick={() => openEvent(e)}
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  title="Nothing here just yet"
                  text="Try another category or search, or bring a new event to campus."
                />
              )}
            </section>
            <section className="host-banner">
              <div className="host-symbol">✳</div>
              <div>
                <span className="eyebrow">
                  GOT AN IDEA? MAKE IT A GATHERING.
                </span>
                <h2>Good things happen when you host.</h2>
                <p>
                  A workshop, a conversation, a club catch-up. There’s room for
                  your idea.
                </p>
              </div>
              <button
                className="button primary"
                onClick={() =>
                  organizer
                    ? setModal({ type: "event" })
                    : navigate("dashboard")
                }
              >
                Create an event <ArrowUpRight size={18} />
              </button>
            </section>
          </>
        )}
        {page === "tickets" && (
          <section className="page-section">
            <PageHeading
              eyebrow="MAKE ROOM FOR WHAT MATTERS"
              title="Your upcoming moments."
              text="Every seat you’ve saved, all in one place."
            />
            {loading ? (
              <Loading />
            ) : registered.length ? (
              <div className="event-grid">
                {registered.map((e, i) => (
                  <EventCard
                    key={e.eventId}
                    event={e}
                    index={i}
                    onClick={() => openEvent(e)}
                  />
                ))}
              </div>
            ) : (
              <Empty
                title="Your next thing is out there"
                text="Explore the events, follow your curiosity, and save your first seat."
                action={() => navigate("discover")}
                label="Explore events"
              />
            )}
          </section>
        )}
        {page === "dashboard" && (
          <section className="page-section">
            <PageHeading
              eyebrow="A LITTLE ORGANIZING. A BIG IMPACT."
              title="Bring your people together."
              text="Your events, registrations, and attendance at a glance."
            />
            {(organizer || !DEMO) && (
              <button
                className="button primary dashboard-create"
                onClick={() => setModal({ type: "event" })}
              >
                <Plus size={18} /> Create event
              </button>
            )}
            {DEMO && !organizer ? (
              <Empty
                title="Pull up the organizer’s chair"
                text="Switch the demo identity to Alex · Organizer in the top navigation to create events and manage attendance."
              />
            ) : (
              <>
                <div className="stats-grid">
                  {[
                    ["Events hosted", owned.length, CalendarDays],
                    ["Confirmed seats", totals.confirmed, Users],
                    ["On the waitlist", totals.waitlisted, Clock3],
                    ["Checked in", totals.checkedIn, ScanLine],
                  ].map(([label, value, Icon]) => (
                    <div className="stat" key={label}>
                      <Icon size={20} />
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="dashboard-list">
                  {owned.length ? (
                    owned.map((e) => (
                      <div className="dashboard-row" key={e.eventId}>
                        <div className="date-box">
                          <strong>
                            {fmt(e.startTime, { day: "2-digit" })}
                          </strong>
                          <span>{fmt(e.startTime, { month: "short" })}</span>
                        </div>
                        <div className="dashboard-event">
                          <span className="category-text">{e.category}</span>
                          <h3>{e.title}</h3>
                          <p>
                            {e.confirmed}/{e.capacity} confirmed ·{" "}
                            {e.waitlisted} waitlisted · {e.checkedIn} checked in
                          </p>
                        </div>
                        <button
                          className="button light"
                          onClick={() => openEvent(e)}
                        >
                          Manage event <ArrowRight size={16} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title="Start with one good idea"
                      text="Create your first event and give your community something to look forward to."
                    />
                  )}
                </div>
              </>
            )}
          </section>
        )}
        {(page === "detail" || page === "meeting") &&
          (loading && !event ? (
            <Loading />
          ) : event ? (
            <section className="detail-section">
              <button
                className="back-button"
                onClick={() => navigate("discover")}
              >
                <ChevronLeft size={16} /> Back to events
              </button>
              <div className="detail-layout">
                <article>
                  <EventArt category={event.category} large />
                  <div className="detail-title">
                    <span className="badge">{event.category}</span>
                    <h1>{event.title}</h1>
                    <p className="host-line">
                      <span className="avatar small">
                        {event.organizerName?.slice(0, 1)}
                      </span>{" "}
                      Hosted by <strong>{event.organizerName}</strong>
                    </p>
                  </div>
                  <h3>About this event</h3>
                  <p className="description">{event.description}</p>
                  <div className="detail-facts">
                    <div>
                      <CalendarDays />
                      <span>
                        {fmt(event.startTime, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        <small>
                          {time(event.startTime)} – {time(event.endTime)} ·{" "}
                          {Intl.DateTimeFormat().resolvedOptions().timeZone}
                        </small>
                      </span>
                    </div>
                    <div>
                      <Video />
                      <span>
                        Online, together
                        <small>Join the meeting right here on CloudMeet</small>
                      </span>
                    </div>
                  </div>
                  {event.isOwner && (
                    <section className="attendance">
                      <div className="section-heading">
                        <h3>Attendance desk</h3>
                        <button
                          className="text-button"
                          onClick={() => setModal({ type: "event", event })}
                        >
                          Edit event <ArrowUpRight size={14} />
                        </button>
                      </div>
                      <div className="inline-stats">
                        <span>
                          <b>{event.confirmed}</b> confirmed
                        </span>
                        <span>
                          <b>{event.waitlisted}</b> waitlisted
                        </span>
                        <span>
                          <b>{event.checkedIn}</b> checked in
                        </span>
                      </div>
                      <form
                        className="checkin-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await action(
                            `/events/${event.eventId}/check-in`,
                            { token: checkToken },
                            "Attendance recorded. Welcome in!",
                          );
                          setCheckToken("");
                        }}
                      >
                        <label htmlFor="check-token">
                          Scan a ticket into this field, or paste its token
                        </label>
                        <div>
                          <input
                            id="check-token"
                            value={checkToken}
                            onChange={(e) => setCheckToken(e.target.value)}
                            placeholder="Paste one-time check-in token"
                            required
                            maxLength={250}
                          />
                          <button className="button primary" disabled={busy}>
                            <ScanLine size={16} /> Check in
                          </button>
                        </div>
                      </form>
                      <div className="attendee-list">
                        {event.attendees?.length ? (
                          event.attendees.map((r) => (
                            <div key={r.registrationId}>
                              <span>{r.name}</span>
                              <span
                                className={`status ${r.checkedInAt ? "checked" : r.status.toLowerCase()}`}
                              >
                                {r.checkedInAt
                                  ? "Checked in"
                                  : r.status === "WAITLISTED"
                                    ? "Waitlisted"
                                    : "Confirmed"}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p>
                            No registrations yet. Your community is on its way.
                          </p>
                        )}
                      </div>
                    </section>
                  )}
                  {page === "meeting" &&
                    (event.registration?.status === "CONFIRMED" ||
                      event.isOwner) && (
                      <Meeting
                        event={event}
                        name={
                          profiles.find((p) => p[0] === user)?.[1] || "Student"
                        }
                      />
                    )}
                </article>
                <aside className="ticket-panel">
                  <div className="ticket-top">
                    <span className="eyebrow">YOUR NEXT GOOD THING</span>
                    <span className="free-label">Free</span>
                  </div>
                  <h2>
                    {event.registration?.checkedInAt
                      ? "You’re checked in."
                      : event.registration?.status === "CONFIRMED"
                        ? "You’re on the list."
                        : event.registration?.status === "WAITLISTED"
                          ? "You’re in the queue."
                          : "Save a seat for yourself."}
                  </h2>
                  <p>
                    {event.registration?.status === "WAITLISTED"
                      ? `You’re #${event.registration.waitlistPosition} on the waitlist. If a seat opens, you’re automatically moved up.`
                      : event.registration?.status === "CONFIRMED"
                        ? "A little curiosity brought you here. We’ll see you there."
                        : `${event.seatsLeft} of ${event.capacity} seats available. A whole new experience awaits.`}
                  </p>
                  <div className="capacity-track">
                    <i
                      style={{
                        width: `${(event.confirmed / event.capacity) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="capacity-label">
                    <Users size={14} />
                    {event.confirmed} going{" "}
                    <span>{event.capacity} total seats</span>
                  </div>
                  {!event.registration ? (
                    <button
                      className="button primary full"
                      disabled={busy || Date.parse(event.endTime) < Date.now()}
                      onClick={() =>
                        action(
                          `/events/${event.eventId}/register`,
                          {},
                          event.seatsLeft
                            ? "Your seat is saved. See you there!"
                            : "You’re on the waitlist. We’ll keep your place.",
                        )
                      }
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : (
                        <Ticket size={18} />
                      )}{" "}
                      {event.seatsLeft
                        ? "Register for event"
                        : "Join the waitlist"}
                    </button>
                  ) : (
                    <>
                      <div
                        className={`registration-label ${event.registration.status.toLowerCase()}`}
                      >
                        <CheckCircle2 size={17} />
                        {event.registration.checkedInAt
                          ? "Attendance recorded"
                          : event.registration.status === "CONFIRMED"
                            ? "Registration confirmed"
                            : "On the waitlist"}
                      </div>
                      {event.registration.status === "CONFIRMED" && (
                        <>
                          <button
                            className="button primary full"
                            onClick={() =>
                              setPage(page === "meeting" ? "detail" : "meeting")
                            }
                          >
                            <Video size={18} />
                            {page === "meeting"
                              ? "Close meeting"
                              : "Join meeting"}
                          </button>
                          {event.registration.token && (
                            <TicketQR token={event.registration.token} />
                          )}
                        </>
                      )}
                      {!event.registration.checkedInAt && (
                        <button
                          className="cancel-button"
                          disabled={busy}
                          onClick={() => setModal({ type: "cancel" })}
                        >
                          Cancel registration
                        </button>
                      )}
                    </>
                  )}
                  {event.isOwner && !event.registration && (
                    <button
                      className="button light full"
                      onClick={() =>
                        setPage(page === "meeting" ? "detail" : "meeting")
                      }
                    >
                      <Video size={16} />{" "}
                      {page === "meeting"
                        ? "Close meeting"
                        : "Open host meeting"}
                    </button>
                  )}
                  <div className="ticket-foot">
                    <Leaf size={16} /> Made for connection. Open to everyone.
                  </div>
                </aside>
              </div>
            </section>
          ) : (
            <Empty
              title="Event unavailable"
              text="Return to discovery to find another event."
              action={() => navigate("discover")}
              label="Discover events"
            />
          ))}
      </main>
      <footer>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("discover");
          }}
        >
          <Cloud size={23} /> cloudmeet<span className="brand-dot">.</span>
        </a>
        <span>A little closer. A lot more connected.</span>
        <span className="footer-note">
          Made for campus life <span>↗</span>
        </span>
      </footer>
      <div className="demo-footer">
        {DEMO
          ? "LOCAL DEMO · Synthetic profiles · Data saved on this computer"
          : "CLOUDMEET · Campus events, connected"}
        <span>Built with curiosity & cloud.</span>
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal.type === "event"
                ? "Event details"
                : modal.type === "cancel"
                  ? "Cancel registration"
                  : "Sign in"
            }
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal.type === "event" ? (
              <>
                <span className="eyebrow">MAKE SOMETHING HAPPEN</span>
                <h2>
                  {modal.event
                    ? "A few finishing touches."
                    : "Every gathering starts here."}
                </h2>
                <p>Give your community a reason to show up.</p>
                <EventForm
                  event={modal.event}
                  busy={busy}
                  onSubmit={saveEvent}
                />
              </>
            ) : modal.type === "cancel" ? (
              <>
                <h2>Let this seat find someone new?</h2>
                <p>
                  Cancelling gives the earliest waitlisted attendee your seat.
                  You can register again if your plans change.
                </p>
                <button
                  className="button primary full"
                  disabled={busy}
                  onClick={async () => {
                    setModal(null);
                    await action(
                      `/events/${selected}/cancel`,
                      {},
                      "Registration cancelled. Thanks for making room.",
                    );
                  }}
                >
                  Cancel my registration
                </button>
                <button
                  className="cancel-button"
                  onClick={() => setModal(null)}
                >
                  Keep my seat
                </button>
              </>
            ) : (
            <SessionForm
              signedIn={signedIn}
              username={authUsername}
              onSave={username => {
                setAuthUsername(username);
                setSignedIn(true);
                setModal(null);
                setError('');
                refresh();
              }}
              onSignOut={async () => {
                try {
                  await signOut();
                  setSignedIn(false);
                  setAuthUsername('');
                  setModal(null);
                  setPage('discover');
                  setNotice('You have signed out.');
                  await refresh();
                } catch (err) {
                  setError(err.message || 'Unable to sign out.');
                }
              }}
            />
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function EventArt({ category, large = false }) {
  const Icon = icons[category] || Code2;
  return (
    <div
      className={`event-art art-${category.toLowerCase()} ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      <div className="art-lines" />
      <span className="art-overline">
        {category === "Technology"
          ? "THE NEXT BIG IDEA"
          : category === "Design"
            ? "MAKE ROOM FOR IDEAS"
            : category === "Career"
              ? "WHAT’S NEXT FOR YOU"
              : "A LITTLE MORE TOGETHER"}
      </span>
      <div className="event-art-object">
        <Icon size={large ? 100 : 66} strokeWidth={1.3} />
      </div>
      <span className="event-art-spark">✳</span>
      <span className="event-art-caption">
        {category === "Technology"
          ? "hello, possibility."
          : category === "Design"
            ? "a different perspective."
            : category === "Career"
              ? "onwards & upwards."
              : "find your people."}
      </span>
      <ArrowUpRight className="art-corner" size={25} />
    </div>
  );
}
function EventCard({ event: e, onClick }) {
  return (
    <button className="event-card" onClick={onClick}>
      <div className="card-image">
        <EventArt category={e.category} />
        <span className="date-sticker">
          <strong>{fmt(e.startTime, { day: "2-digit" })}</strong>
          <span>{fmt(e.startTime, { month: "short" })}</span>
        </span>
        {e.registration && (
          <span
            className={`card-status ${e.registration.status.toLowerCase()}`}
          >
            {e.registration.status === "CONFIRMED" ? (
              <Check size={12} />
            ) : (
              <Clock3 size={12} />
            )}{" "}
            {e.registration.status === "CONFIRMED"
              ? "You’re going"
              : "Waitlisted"}
          </span>
        )}
      </div>
      <div className="card-content">
        <div className="card-meta">
          <span className={`category-text ${e.category.toLowerCase()}`}>
            {e.category}
          </span>
          <span>FREE EVENT</span>
        </div>
        <h3>{e.title}</h3>
        <p className="card-description">{e.description}</p>
        <div className="card-time">
          <Clock3 size={14} />
          {time(e.startTime)}
          <span>·</span>
          <Video size={14} /> Online
        </div>
        <div className="card-bottom">
          <span>
            <Users size={15} />
            {e.seatsLeft ? `${e.seatsLeft} seats left` : "Waitlist open"}
          </span>
          <span className="card-arrow">
            <ArrowUpRight size={19} />
          </span>
        </div>
      </div>
    </button>
  );
}
function PageHeading({ eyebrow, title, text }) {
  return (
    <div className="page-heading">
      <div className="eyebrow muted">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}
function Empty({ title, text, action, label }) {
  return (
    <div className="empty">
      <Cloud size={38} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button primary" onClick={action}>
          {label}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Finding your next good
      thing...
    </div>
  );
}
function TicketQR({ token }) {
  const [url, setUrl] = useState(""),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(token, {
      width: 200,
      margin: 2,
      color: { dark: "#163d32", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then((value) => active && setUrl(value));
    return () => {
      active = false;
    };
  }, [token]);
  return (
    <div className="qr-ticket">
      {url && (
        <img
          src={url}
          width="166"
          height="166"
          alt="Your one-time attendance QR ticket"
        />
      )}
      <strong>Your little ticket in</strong>
      <p>Show this QR to your organizer at check-in.</p>
      <button
        className="text-button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        <Copy size={13} />
        {copied ? "Copied!" : "Copy check-in token"}
      </button>
      <details>
        <summary>Show token for manual entry</summary>
        <code>{token}</code>
      </details>
    </div>
  );
}
function EventForm({ event, busy, onSubmit }) {
  const local = (value) => {
    const d = new Date(value);
    return new Date(+d - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  return (
    <form className="event-form" onSubmit={onSubmit}>
      <label>
        Event title
        <input
          name="title"
          required
          minLength={3}
          maxLength={100}
          defaultValue={event?.title}
          placeholder="A good idea deserves a name"
        />
      </label>
      <div className="form-columns">
        <label>
          Starts at
          <input
            name="startTime"
            type="datetime-local"
            required
            defaultValue={event ? local(event.startTime) : ""}
          />
        </label>
        <label>
          Ends at
          <input
            name="endTime"
            type="datetime-local"
            required
            defaultValue={event ? local(event.endTime) : ""}
          />
        </label>
      </div>
      <p className="field-note">
        Times use your device timezone:{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}.
      </p>
      <div className="form-columns">
        <label>
          Seats available
          <input
            name="capacity"
            type="number"
            required
            min={1}
            max={100}
            defaultValue={event?.capacity || 30}
          />
        </label>
        <label>
          Category
          <select
            name="category"
            defaultValue={event?.category || "Technology"}
          >
            {categories.slice(1).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        About the event
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          defaultValue={event?.description}
          placeholder="What will people learn, share, or experience?"
        />
      </label>
      <label>
        Jitsi room reference
        <input
          name="meetingRoomRef"
          required
          minLength={8}
          maxLength={150}
          pattern="[a-zA-Z0-9_-]+"
          defaultValue={
            event?.meetingRoomRef || `cloudmeet-${crypto.randomUUID()}`
          }
        />
      </label>
      <p className="field-note">
        Use your configured Jitsi provider’s room reference. Keep the random
        reference for demo rooms.
      </p>
      <button className="button primary full" disabled={busy}>
        {busy ? (
          <LoaderCircle size={18} className="spin" />
        ) : (
          <Plus size={18} />
        )}{" "}
        {event ? "Save changes" : "Create event"}
      </button>
    </form>
  );
}
function Meeting({ event, name }) {
  const parent = useRef(null),
    [failure, setFailure] = useState("");
  useEffect(() => {
    let api,
      disposed = false;
    const domain = import.meta.env.VITE_JITSI_DOMAIN || "meet.jit.si";
    if (!/^[a-zA-Z0-9.-]+(?::\d+)?$/.test(domain)) {
      setFailure("Configure a valid Jitsi domain.");
      return;
    }
    const script = document.createElement("script");
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = () => {
      if (disposed) return;
      try {
        api = new window.JitsiMeetExternalAPI(domain, {
          roomName: event.meetingRoomRef,
          parentNode: parent.current,
          width: "100%",
          height: 480,
          userInfo: { displayName: name },
          configOverwrite: { prejoinConfig: { enabled: true } },
        });
      } catch {
        setFailure(
          "The video provider could not start. Please check its configuration.",
        );
      }
    };
    script.onerror = () =>
      setFailure(
        "The video provider could not load. Check your connection and provider configuration.",
      );
    document.body.appendChild(script);
    return () => {
      disposed = true;
      api?.dispose();
      script.remove();
    };
  }, [event.meetingRoomRef, name]);
  return (
    <section className="meeting-section">
      <h3>
        <Video size={20} /> You’re in good company.
      </h3>
      <p className="field-note">
        Video is provided by{" "}
        {import.meta.env.VITE_JITSI_DOMAIN || "meet.jit.si"}. Public demo rooms
        may require host authentication. Allow camera and microphone access when
        prompted.
      </p>
      {failure ? (
        <p role="alert" className="form-error">
          {failure}
        </p>
      ) : (
        <div ref={parent} className="meeting-frame" />
      )}
    </section>
  );
}

function SessionForm({ signedIn, username, onSave, onSignOut }) {
  const [value, setValue] = useState(username || '');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState('signIn');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');

    try {
      if (step === 'newPassword') {
        const result = await confirmSignIn({
          challengeResponse: newPassword,
        });

        if (result.isSignedIn) {
          const current = await getCurrentUser();
          onSave(current.username || value.trim());
        } else {
          setFormError(
            'Cognito requires another verification step. Please check your user-pool sign-in settings.'
          );
        }

        return;
      }

      const result = await signIn({
        username: value.trim(),
        password,
      });

      if (result.isSignedIn) {
        const current = await getCurrentUser();
        onSave(current.username || value.trim());
      } else if (
        result.nextStep?.signInStep ===
        'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED'
      ) {
        setStep('newPassword');
        setFormError('');
      } else {
        setFormError(
          `Additional sign-in verification is required (${result.nextStep?.signInStep || 'unknown step'}).`
        );
      }
    } catch (err) {
      setFormError(err.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  if (signedIn) {
    return (
      <div className="event-form">
        <span className="eyebrow">YOUR CAMPUS CONNECTION</span>
        <h2>You're connected.</h2>
        <p>Signed in as {username}.</p>
        <button
          className="button primary full"
          type="button"
          onClick={onSignOut}
        >
          <LogOut size={17} /> Sign out
        </button>
      </div>
    );
  }

  return (
    <form className="event-form" onSubmit={submit}>
      <span className="eyebrow">YOUR CAMPUS CONNECTION</span>

      <h2>
        {step === 'newPassword'
          ? 'Set your new password.'
          : 'Welcome back.'}
      </h2>

      <p>
        {step === 'newPassword'
          ? 'Your account needs a new password before you can continue.'
          : 'Sign in with your campus account to join the community.'}
      </p>

      {step === 'signIn' ? (
        <>
          <label>
            Username
            <input
              autoComplete="username"
              value={value}
              onChange={e => setValue(e.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </label>
        </>
      ) : (
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
      )}

      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}

      <button className="button primary full" disabled={busy}>
        {busy
          ? <LoaderCircle className="spin" size={18} />
          : null}
        {step === 'newPassword' ? 'Set password' : 'Sign in'}
      </button>
    </form>
  );
}

createRoot(document.getElementById("root")).render(<App />);
