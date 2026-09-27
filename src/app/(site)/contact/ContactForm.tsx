'use client';

import { useMemo, useState } from 'react';
import { contactApi } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import { company } from '@/content/site';

type FormData = {
  name: string;
  email: string;
  companyName: string;
  service: string;
  message: string;
  /** Honeypot. Hidden from people; bots fill it in and get silently dropped. */
  website: string;
};

const initialForm: FormData = {
  name: '',
  email: '',
  companyName: '',
  service: '',
  message: '',
  website: '',
};

export default function ContactForm() {
  const [formData, setFormData] = useState<FormData>(initialForm);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`Project inquiry from ${formData.name || 'website visitor'}`);
    const body = encodeURIComponent(
      [
        `Name: ${formData.name}`,
        `Email: ${formData.email}`,
        `Company: ${formData.companyName || 'Not provided'}`,
        `Service: ${formData.service || 'Not selected'}`,
        '',
        'Project details:',
        formData.message,
      ].join('\n')
    );
    return `mailto:${company.email}?subject=${subject}&body=${body}`;
  }, [formData]);

  const updateField = (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    if (status !== 'idle') setStatus('idle');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'sending') return;

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setError('Please add your name, email, and project details before submitting.');
      setStatus('error');
      return;
    }

    setStatus('sending');
    setError('');
    try {
      await contactApi.send({
        name: formData.name,
        email: formData.email,
        company: formData.companyName,
        service: formData.service,
        message: formData.message,
        website: formData.website,
      });
      setStatus('success');
      setFormData(initialForm);
    } catch (cause) {
      setError(errorMessage(cause, 'Something went wrong. Please email us directly.'));
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Full name"
          name="name"
          value={formData.name}
          onChange={updateField}
          autoComplete="name"
          required
        />
        <Field
          label="Email address"
          name="email"
          type="email"
          value={formData.email}
          onChange={updateField}
          autoComplete="email"
          required
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Company or organization"
          name="companyName"
          value={formData.companyName}
          onChange={updateField}
          autoComplete="organization"
        />
        <div>
          <label htmlFor="service" className="text-sm font-bold text-slate-300">
            Service interested in
          </label>
          <select
            id="service"
            name="service"
            value={formData.service}
            onChange={updateField}
            className="mt-2 min-h-12 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-slate-100 shadow-sm focus:border-cyan-400"
          >
            <option value="">Select a service</option>
            <option value="Full-stack development">Full-stack development</option>
            <option value="AI and LLM applications">AI and LLM applications</option>
            <option value="Automation solutions">Automation solutions</option>
            <option value="Backend and cloud systems">Backend and cloud systems</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="message" className="text-sm font-bold text-slate-300">
          Project details
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={7}
          value={formData.message}
          onChange={updateField}
          placeholder="Tell us what you want to build, automate, improve, or connect."
          className="mt-2 w-full resize-y rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-slate-100 shadow-sm focus:border-cyan-400"
        />
      </div>

      {status === 'success' ? (
        <p
          className="rounded-md border border-emerald-400/20 bg-emerald-400/8 px-4 py-3 text-sm font-semibold text-emerald-200"
          role="status"
        >
          Thanks — your message is on its way. We usually reply {company.responseTime.toLowerCase()}.
        </p>
      ) : null}

      {status === 'error' ? (
        <p
          className="rounded-md border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm font-semibold text-rose-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={formData.website}
          onChange={updateField}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" className="button-base button-primary" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send Message'}
        </button>
        <a href={mailtoHref} className="button-base button-secondary">
          Open Email Draft
        </a>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  value,
  onChange,
  required = false,
  autoComplete,
}: {
  label: string;
  name: keyof FormData;
  type?: string;
  value: string;
  onChange: (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-bold text-slate-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        className="mt-2 min-h-12 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-slate-100 shadow-sm focus:border-cyan-400"
      />
    </div>
  );
}
