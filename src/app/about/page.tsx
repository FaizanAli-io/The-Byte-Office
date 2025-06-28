import Link from "next/link";

import BackgroundEffect from "../components/BackgroundEffect";

export default function About() {
  const features = [
    {
      icon: "⚡",
      title: "Rapid Delivery",
      description: "Fast turnaround times without compromising on quality or attention to detail."
    },
    {
      icon: "🎨",
      title: "Custom Solutions",
      description: "Tailored approaches that fit your unique business requirements and goals."
    },
    {
      icon: "🔧",
      title: "Latest Technologies",
      description: "We stay current with emerging tech to provide cutting-edge solutions."
    },
    {
      icon: "🤝",
      title: "Collaborative Approach",
      description: "We work closely with you throughout the entire development process."
    },
    {
      icon: "📈",
      title: "Proven Results",
      description: "Track record of delivering projects that drive measurable business impact."
    },
    {
      icon: "🛡️",
      title: "Quality Assurance",
      description: "Rigorous testing and quality control ensure reliable, robust solutions."
    }
  ];

  return (
    <div className="bg-gradient-to-br from-black via-gray-900 to-blue-900 min-h-screen pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            About{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              The Byte Office
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            We're passionate technologists dedicated to transforming businesses through innovative
            AI, automation, and development solutions.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <h2 className="text-4xl font-bold text-white mb-6">Our Mission</h2>
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              At The Byte Office, we believe that every business deserves access to cutting-edge
              technology. Our mission is to democratize AI and automation, making these powerful
              tools accessible to organizations of all sizes.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed">
              We combine deep technical expertise with a passion for innovation to deliver solutions
              that don't just meet requirements — they exceed expectations and drive real business
              transformation.
            </p>
          </div>
          <div className="glass-effect rounded-2xl p-10 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-2xl font-bold text-white mb-4">Our Vision</h3>
            <p className="text-gray-300">
              To be the leading freelance agency that bridges the gap between emerging technologies
              and practical business solutions, empowering organizations to thrive in the digital
              age.
            </p>
          </div>
        </div>

        <div className="mb-24">
          <h2 className="text-4xl font-bold text-white text-center mb-12">Why Choose Us?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div
                key={i}
                className="glass-effect rounded-2xl p-6 text-center hover:bg-white/10 transition-all duration-300 shadow-xl"
              >
                <div className="text-4xl mb-4">
                  <span className="emoji">{feature.icon}</span>{" "}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-gray-300 mb-8 max-w-xl mx-auto">
            Let's discuss how we can help transform your business with innovative technology
            solutions.
          </p>
          <Link
            href="/contact"
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-12 py-4 rounded-full text-xl font-semibold hover:scale-105 transition-all duration-300 pulse-glow inline-block"
          >
            Start Your Project
          </Link>
        </div>
      </div>
    </div>
  );
}
