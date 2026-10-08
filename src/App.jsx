import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabase";

function App() {
  const [showPostSheet, setShowPostSheet] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [events, setEvents] = useState([]);
  const [imagePreview, setImagePreview] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleRemoveEvent = async (eventId) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this event?",
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("events")
      .update({ is_published: false })
      .eq("id", eventId);

    if (error) {
      console.error("EVENT REMOVE ERROR:", error);
      alert("The event could not be removed.");
      return;
    }

    setEvents((currentEvents) =>
      currentEvents.filter((event) => event.id !== eventId),
    );
  };

  const loadEvents = async () => {
    setLoadingEvents(true);

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("is_published", true)
      .order("event_date", { ascending: true });

    if (error) {
      console.error("EVENT LOAD ERROR:", error);
      setError("Unable to load events right now.");
    } else {
      setEvents(data || []);
    }

    setLoadingEvents(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const openPostSheet = () => {
    setShowPostSheet(true);
    setSubmitted(false);
    setAgreed(false);
    setError("");
  };

  const closeSheet = () => {
    if (submitting) return;

    setShowPostSheet(false);
    setSubmitted(false);
    setAgreed(false);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!agreed) {
      setError("Please agree to the Terms & Conditions.");
      return;
    }

    setSubmitting(true);
    setError("");

    const form = event.currentTarget;

    const title = form.elements.eventName.value.trim();
    const description = form.elements.description.value.trim();
    const category = form.elements.category.value;
    const location = form.elements.location.value.trim();
    const date = form.elements.date.value;
    const time = form.elements.time.value;
    const endTime = form.elements.endTime.value;
    const tillLate = form.elements.tillLate.checked;
    const organizerLink = form.elements.organizerLink.value.trim();
    const contactPhone = form.elements.contactPhone.value.trim();
    const imageFile = form.elements.eventImage.files[0];

    if (!imageFile) {
      setError("Please select an event image.");
      setSubmitting(false);
      return;
    }

    try {
      // Create a unique file name.
      const fileExtension = imageFile.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExtension}`;
      const storagePath = `events/${fileName}`;

      // Upload image to Supabase Storage.
      const { error: uploadError } = await supabase.storage
        .from("event-images")
        .upload(storagePath, imageFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: imageFile.type,
        });

      if (uploadError) {
        console.error("IMAGE UPLOAD ERROR:", uploadError);
        throw new Error("The event image could not be uploaded.");
      }

      // Get public image URL.
      const { data: publicUrlData } = supabase.storage
        .from("event-images")
        .getPublicUrl(storagePath);

      const imageUrl = publicUrlData.publicUrl;

      // Convert the selected local date/time into an ISO timestamp.
      const eventDate = new Date(`${date}T${time}`);

      if (Number.isNaN(eventDate.getTime())) {
        throw new Error("Please enter a valid event date and time.");
      }

      let eventEndTime = null;

      if (tillLate) {
        eventEndTime = null;
      } else if (endTime) {
        const endDate = new Date(`${date}T${endTime}`);

        if (Number.isNaN(endDate.getTime())) {
          throw new Error("Please enter a valid end time.");
        }

        eventEndTime = endDate.toISOString();
      }

      // Insert the event.
      const { error: insertError } = await supabase.from("events").insert({
        title,
        description,
        category,
        location,
        event_date: eventDate.toISOString(),
        event_end_time: eventEndTime,
        event_till_late: tillLate,
        image_url: imageUrl,
        image_storage_path: storagePath,
        organizer_id: null,
        organizer_link: organizerLink,
        contact_phone: contactPhone,
        is_published: true,
      });

      if (insertError) {
        console.error("EVENT INSERT ERROR:", insertError);

        // If the database insert fails, remove the uploaded image
        // so we don't leave an unused file in Storage.
        await supabase.storage.from("event-images").remove([storagePath]);

        throw new Error(
          insertError.message || "The event could not be published.",
        );
      }

      await loadEvents();

      setSubmitted(true);
    } catch (submissionError) {
      console.error("EVENT SUBMISSION ERROR:", submissionError);
      setError(
        submissionError.message ||
          "Something went wrong while publishing the event.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app">
      <header className="navbar">
        <div className="logo">
          <span>Event</span> <strong>Express</strong>
        </div>

        <button className="post-button" onClick={openPostSheet}>
          Post an Event
        </button>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">DISCOVER WHAT'S HAPPENING</p>

          <h1>
            Find your next
            <br />
            <span>event.</span>
          </h1>

          <p className="hero-text">
            Discover events, gatherings and experiences happening around you.
          </p>

          <div className="search-box">
            <input type="text" placeholder="Search events..." />
            <button>Search</button>
          </div>
        </section>

        <section className="categories">
          <div className="section-heading">
            <h2>Explore events</h2>
            <p>Find something that interests you.</p>
          </div>

          <div className="category-list">
            <button>All Events</button>
            <button>Parties</button>
            <button>Concerts</button>
            <button>Sports</button>
            <button>Campus</button>
            <button>Business</button>
            <button>Road Trips</button>
          </div>
        </section>

        <section className="events">
          <div className="section-heading">
            <h2>Upcoming events</h2>
            <p>What's happening next.</p>
          </div>

          {loadingEvents ? (
            <div className="empty-events">
              <h3>Loading events...</h3>
            </div>
          ) : events.length === 0 ? (
            <div className="empty-events">
              <h3>Events are coming soon.</h3>

              <p>Be the first organizer to put your event on Event Express.</p>

              <button className="post-button" onClick={openPostSheet}>
                Post an Event
              </button>
            </div>
          ) : (
            <div className="event-grid">
              {events.map((event) => (
                <article className="event-card" key={event.id}>
                  {event.image_url && (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="event-card-image"
                    />
                  )}

                  <div className="event-card-content">
                    {event.category && (
                      <p className="event-category">{event.category}</p>
                    )}

                    <h3>{event.title}</h3>

                    {event.description && (
                      <p className="event-description">{event.description}</p>
                    )}

                    {event.location && (
                      <p className="event-meta">📍 {event.location}</p>
                    )}

                    
                    {event.event_date && (
  <p className="event-meta">
    📅{' '}
    {new Date(event.event_date).toLocaleDateString(
      undefined,
      {
        dateStyle: 'medium',
      }
    )}
  </p>
)}

{event.event_date && (
  <p className="event-meta">
    🕐{' '}
    {new Date(event.event_date).toLocaleTimeString(
      undefined,
      {
        hour: 'numeric',
        minute: '2-digit',
      }
    )}

    {' – '}

    {event.event_till_late
      ? 'Till late'
      : event.event_end_time
        ? new Date(event.event_end_time).toLocaleTimeString(
            undefined,
            {
              hour: 'numeric',
              minute: '2-digit',
            }
          )
        : 'Time TBA'}
  </p>
)}
                    {event.contact_phone && (
                      <p className="event-meta">📞 {event.contact_phone}</p>
                    )}
                    {event.organizer_link && (
                      <a
                        href={event.organizer_link}
                        target="_blank"
                        rel="noreferrer"
                        className="organizer-link"
                      >
                        Contact / View Organizer →
                      </a>
                    )}
                    <button
                      className="remove-event-button"
                      onClick={() => handleRemoveEvent(event.id)}
                    >
                      Remove Event
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {showPostSheet && (
        <div className="sheet-overlay" onClick={closeSheet}>
          <div
            className="post-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            {!submitted ? (
              <>
                <div className="sheet-header">
                  <div>
                    <p className="eyebrow">ORGANIZER</p>

                    <h2>Post an event</h2>

                    <p>
                      Add your event details and publish it on Event Express.
                    </p>
                  </div>

                  <button
                    className="close-button"
                    onClick={closeSheet}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {error && <div className="form-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="form-section">
                    <h3>Event details</h3>

                    <label>
                      Event name
                      <input
                        name="eventName"
                        type="text"
                        placeholder="e.g. Nairobi Car Meet"
                        required
                      />
                    </label>

                    <div className="form-grid">
                      <label>
                        Category
                        <select name="category" required defaultValue="">
                          <option value="" disabled>
                            Select category
                          </option>

                          <option>Parties</option>
                          <option>Concerts</option>
                          <option>Sports</option>
                          <option>Campus</option>
                          <option>Business</option>
                          <option>Road Trips</option>
                          <option>Other</option>
                        </select>
                      </label>

                      <label>
                        Location
                        <input
                          name="location"
                          type="text"
                          placeholder="e.g. Westlands, Nairobi"
                          required
                        />
                      </label>
                    </div>

                    <div className="form-grid">
                      <label>
                        Date
                        <input name="date" type="date" required />
                      </label>

                      <label>
                        Start time
                        <input name="time" type="time" required />
                      </label>

                      <label>
                        End time
                        <input name="endTime" type="time" />
                      </label>
                      <label className="terms-check">
                        <input name="tillLate" type="checkbox" />

                        <span>Event runs till late</span>
                      </label>
                    </div>

                    <label>
                      Description
                      <textarea
                        name="description"
                        placeholder="Tell people what your event is about..."
                        rows="4"
                        required
                      />
                    </label>

                    <label>
                      Event image
                      <div className="media-upload">
                        <input
                          id="eventImage"
                          name="eventImage"
                          type="file"
                          accept="image/*"
                          required
                          onChange={(event) => {
                            const file = event.target.files[0];

                            if (file) {
                              setImagePreview(URL.createObjectURL(file));
                            }
                          }}
                        />

                        {!imagePreview && (
                          <label
                            htmlFor="eventImage"
                            className="upload-media-button"
                          >
                            Upload Media
                          </label>
                        )}

                        {imagePreview && (
                          <div className="image-preview">
                            <img src={imagePreview} alt="Event preview" />

                            <button
                              type="button"
                              className="remove-preview"
                              onClick={() => {
                                setImagePreview("");
                                document.getElementById("eventImage").value =
                                  "";
                              }}
                              aria-label="Remove image"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                      <small>
                        Add one image to help people discover your event. Event
                        Express V1 allows one image per event.
                      </small>
                    </label>

                    <label>
                      Search tags
                      <input
                        type="text"
                        placeholder="e.g. cars, automotive, drift, Nairobi"
                      />
                      <small>Search tags will be connected later.</small>
                    </label>
                  </div>
                  <label>
                    Organizer link
                    <input
                      name="organizerLink"
                      type="url"
                      placeholder="https://instagram.com/yourpage"
                    />
                    <small>
                      Add a link where people can contact you or learn more
                      about the event.
                    </small>
                  </label>

                  <label>
                    Contact phone number
                    <input
                      name="contactPhone"
                      type="tel"
                      placeholder="e.g. 0712 345 678"
                    />
                    <small>
                      Add a phone number attendees can use to contact the
                      organizer.
                    </small>
                  </label>
                  <label className="terms-check">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(event) => setAgreed(event.target.checked)}
                    />

                    <span>
                      I agree to the{" "}
                      <a href="/terms.html" target="_blank" rel="noreferrer">
                        Event Express Terms & Conditions
                      </a>
                      .
                    </span>
                  </label>

                  <div className="sheet-actions">
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={closeSheet}
                      disabled={submitting}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="submit-button"
                      disabled={!agreed || submitting}
                    >
                      {submitting ? "Publishing..." : "Publish Event"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="success-state">
                <div className="success-icon">✓</div>

                <p className="eyebrow">EVENT PUBLISHED</p>

                <h2>Your event is live.</h2>

                <p>
                  Your event has been published successfully and is now visible
                  on Event Express.
                </p>

                <button className="submit-button" onClick={closeSheet}>
                  Back to Events
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
