'use client';

import { useState } from 'react';

type FormType = 'entity' | 'event';
type EntityType = 'musician' | 'sports_team' | 'recurring_event';

export function RequestForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [formType, setFormType] = useState<FormType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');

  // Entity fields
  const [entityName, setEntityName] = useState('');
  const [entityType, setEntityType] = useState<EntityType | ''>('');
  const [genreOrSport, setGenreOrSport] = useState('');
  const [socialUrl, setSocialUrl] = useState('');
  const [entityEmail, setEntityEmail] = useState('');
  const [entityNotes, setEntityNotes] = useState('');

  // Event fields
  const [eventArtist, setEventArtist] = useState('');
  const [eventVenue, setEventVenue] = useState('');
  const [eventCity, setEventCity] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTour, setEventTour] = useState('');
  const [eventEmail, setEventEmail] = useState('');
  const [eventNotes, setEventNotes] = useState('');

  function selectType(t: FormType) {
    setFormType(t);
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const requester_email = formType === 'entity' ? entityEmail : eventEmail;

    const payload =
      formType === 'entity'
        ? {
            name: entityName,
            entity_type: entityType,
            genre_or_sport: genreOrSport || undefined,
            social_url: socialUrl || undefined,
            notes: entityNotes || undefined,
          }
        : {
            entity_name: eventArtist,
            venue: eventVenue,
            city: eventCity,
            date: eventDate,
            tour_name: eventTour || undefined,
            notes: eventNotes || undefined,
          };

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: formType, requester_email, payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Something went wrong');
      }
      setSubmittedEmail(requester_email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-800 bg-green-950/40 p-8 text-center">
        <p className="text-lg font-semibold text-white">Request submitted!</p>
        <p className="mt-2 text-sm text-gray-400">
          We'll email you at <span className="text-white">{submittedEmail}</span> if it gets added.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Step 1 — choose type */}
      <div>
        <p className="mb-4 text-sm font-medium text-gray-400 uppercase tracking-widest font-mono text-[10px]">
          // WHAT ARE YOU REQUESTING?
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TypeCard
            selected={formType === 'entity'}
            onClick={() => selectType('entity')}
            title="Add an artist or team"
            description="Musicians, sports teams, or recurring events like Coachella or the Kentucky Derby"
          />
          <TypeCard
            selected={formType === 'event'}
            onClick={() => selectType('event')}
            title="Add a specific show or game"
            description="A single concert, match, or event that's missing from an existing page"
          />
        </div>
      </div>

      {/* Step 2 — details */}
      {step === 2 && formType === 'entity' && (
        <div className="space-y-5 rounded-lg border border-ash bg-smoke p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
            // ARTIST / TEAM DETAILS
          </p>

          <Field label="Name" required>
            <input
              type="text"
              placeholder="Morgan Wallen"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          <Field label="Type" required>
            <div className="flex flex-wrap gap-2">
              {(['musician', 'sports_team', 'recurring_event'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEntityType(t)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    entityType === t
                      ? 'border-croll bg-croll/10 text-croll'
                      : 'border-ash text-gray-400 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  {t === 'musician' ? 'Musician' : t === 'sports_team' ? 'Sports Team' : 'Recurring Event'}
                </button>
              ))}
            </div>
            <input type="hidden" value={entityType} required />
          </Field>

          <Field label="Genre or sport">
            <input
              type="text"
              placeholder="Country, NFL, …"
              value={genreOrSport}
              onChange={(e) => setGenreOrSport(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Social link">
            <input
              type="url"
              placeholder="Instagram or Wikipedia URL"
              value={socialUrl}
              onChange={(e) => setSocialUrl(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Your email" required>
            <input
              type="email"
              placeholder="you@example.com"
              value={entityEmail}
              onChange={(e) => setEntityEmail(e.target.value)}
              required
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-600">We'll notify you when this is added</p>
          </Field>

          <Field label={`Notes (${entityNotes.length}/280)`}>
            <textarea
              rows={3}
              maxLength={280}
              value={entityNotes}
              onChange={(e) => setEntityNotes(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {step === 2 && formType === 'event' && (
        <div className="space-y-5 rounded-lg border border-ash bg-smoke p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
            // SHOW / GAME DETAILS
          </p>

          <Field label="Artist / Team / Event" required>
            <input
              type="text"
              placeholder="Taylor Swift"
              value={eventArtist}
              onChange={(e) => setEventArtist(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          <Field label="Venue" required>
            <input
              type="text"
              placeholder="Madison Square Garden"
              value={eventVenue}
              onChange={(e) => setEventVenue(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          <Field label="City" required>
            <input
              type="text"
              placeholder="New York, NY"
              value={eventCity}
              onChange={(e) => setEventCity(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          <Field label="Date" required>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          <Field label="Tour name">
            <input
              type="text"
              placeholder="Eras Tour"
              value={eventTour}
              onChange={(e) => setEventTour(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Your email" required>
            <input
              type="email"
              placeholder="you@example.com"
              value={eventEmail}
              onChange={(e) => setEventEmail(e.target.value)}
              required
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-600">We'll notify you when this is added</p>
          </Field>

          <Field label={`Notes (${eventNotes.length}/280)`}>
            <textarea
              rows={3}
              maxLength={280}
              value={eventNotes}
              onChange={(e) => setEventNotes(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {step === 2 && (
        <button
          type="submit"
          disabled={submitting || !formType}
          className="w-full rounded-md bg-croll px-4 py-3 text-sm font-semibold text-ink transition hover:bg-croll/90 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      )}
    </form>
  );
}

function TypeCard({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-5 text-left transition ${
        selected
          ? 'border-croll bg-croll/10'
          : 'border-ash bg-smoke hover:border-gray-500'
      }`}
    >
      <p className={`font-semibold ${selected ? 'text-croll' : 'text-white'}`}>{title}</p>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </button>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-400">
        {label}
        {required && <span className="ml-0.5 text-croll">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-ash bg-ink px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none';
