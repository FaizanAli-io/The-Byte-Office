import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gradient-to-br from-black via-slate-900 to-black text-white relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-3xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              The Byte Office
            </h3>
            <p className="text-gray-400 mb-6 max-w-md leading-relaxed">
              Transforming businesses with cutting-edge AI, automation, and full-stack development
              solutions.
            </p>
            <div className="flex space-x-5">
              {["twitter", "linkedin", "github"].map((platform, idx) => (
                <a
                  key={idx}
                  href="#"
                  className="text-white/30 hover:text-white transition duration-300 hover:scale-110"
                >
                  <span className="sr-only">{platform}</span>
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    {/* Your SVG paths as-is */}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xl font-bold mb-4 text-white/90">Services</h4>
            <ul className="space-y-3">
              {["AI Development", "Full-Stack Dev", "Automation", "Consulting"].map(
                (service, idx) => (
                  <li key={idx}>
                    <Link
                      href="/services"
                      className="text-white/50 hover:text-purple-400 transition duration-200"
                    >
                      {service}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-xl font-bold mb-4 text-white/90">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { name: "About Us", href: "/about" },
                { name: "Contact", href: "/contact" },
                { name: "Portfolio", href: "/projects" }
              ].map((link, idx) => (
                <li key={idx}>
                  <Link
                    href={link.href}
                    className="text-white/50 hover:text-purple-400 transition duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 border-t border-white/10 pt-6 text-center text-white/40 text-sm">
          &copy; 2025 The Byte Office. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
