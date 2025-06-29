"use client";

import { useState } from "react";
import SectionHeading from "../components/SectionHeading";
import { PrimaryCTAButton } from "../components/CTAButtons";
import BackgroundEffect from "../components/BackgroundEffect";

interface FormData {
  name: string;
  email: string;
  company: string;
  service: string;
  message: string;
}

const Input = ({
  id,
  label,
  required,
  type = "text",
  ...rest
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label htmlFor={id} className="block text-gray-300 text-sm font-medium mb-2">
      {label} {required && "*"}
    </label>
    <input
      id={id}
      name={id}
      required={required}
      type={type}
      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      {...rest}
    />
  </div>
);

const TextArea = ({
  id,
  label,
  required,
  ...rest
}: {
  id: string;
  label: string;
  required?: boolean;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <div>
    <label htmlFor={id} className="block text-gray-300 text-sm font-medium mb-2">
      {label} {required && "*"}
    </label>
    <textarea
      id={id}
      name={id}
      required={required}
      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      {...rest}
    />
  </div>
);

export default function Contact() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    company: "",
    service: "",
    message: ""
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    alert("Thank you for your message! We'll get back to you soon.");
    setFormData({ name: "", email: "", company: "", service: "", message: "" });
  };

  return (
    <div className="relative bg-black min-h-screen overflow-hidden">
      <BackgroundEffect />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Get In"
          highlight="Touch"
          subtitle={
            <>
              Ready to transform your business? Let's discuss your project and explore how we can
              help{" "}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-semibold">
                you achieve your goals
              </span>
              .
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-10 border border-white/10 shadow-lg">
            <h2 className="text-3xl font-bold text-white mb-8">Send us a message</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                id="name"
                label="Full Name"
                required
                placeholder="Your full name"
                value={formData.name}
                onChange={handleChange}
              />
              <Input
                id="email"
                type="email"
                label="Email Address"
                required
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleChange}
              />
              <Input
                id="company"
                label="Company/Organization"
                placeholder="Company name"
                value={formData.company}
                onChange={handleChange}
              />
              <div>
                <label htmlFor="service" className="block text-gray-300 text-sm font-medium mb-2">
                  Service Interested In
                </label>
                <select
                  id="service"
                  name="service"
                  value={formData.service}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a service</option>
                  <option value="ai-development">AI Development</option>
                  <option value="automation">Automation Solutions</option>
                  <option value="full-stack">Full-Stack Development</option>
                  <option value="consulting">Consulting</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <TextArea
                id="message"
                label="Project Details"
                required
                rows={6}
                placeholder="Tell us about your project, goals, timeline..."
                value={formData.message}
                onChange={handleChange}
              />
              <PrimaryCTAButton href="/contact" label="Send Message" />
            </form>
          </div>

          <div className="space-y-12">
            <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-10 border border-white/10 shadow-lg">
              <h2 className="text-3xl font-bold text-white mb-6">Let's Connect</h2>
              <div className="space-y-6 text-white/80">
                <div className="flex gap-4 items-start">
                  <span className="text-xl">📧</span>
                  <div>
                    <h4 className="font-semibold text-white">Email</h4>
                    <p>thebyteoffice@gmail.com</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <span className="text-xl">💬</span>
                  <div>
                    <h4 className="font-semibold text-white">Response Time</h4>
                    <p>Within 24 hours</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <span className="text-xl">🌐</span>
                  <div>
                    <h4 className="font-semibold text-white">Working Hours</h4>
                    <p>Mon - Fri: 9 AM - 6 PM (PKT)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-10 border border-white/10 shadow-lg">
              <h3 className="text-2xl font-bold text-white mb-6">What Happens Next?</h3>
              <div className="space-y-6 text-white/80">
                {[
                  ["Initial Consultation", "We'll discuss your project requirements and goals."],
                  ["Project Proposal", "Detailed proposal with timeline and pricing."],
                  ["Development & Delivery", "Agile development with regular updates."]
                ].map(([title, desc], idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-semibold text-white">{title}</h4>
                      <p className="text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
