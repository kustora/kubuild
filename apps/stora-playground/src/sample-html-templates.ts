export interface SampleHtmlTemplate {
  id: string;
  name: string;
  description: string;
  html: string;
}

export const SAMPLE_HTML_TEMPLATES: SampleHtmlTemplate[] = [
  {
    id: 'hero',
    name: 'Landing Page Hero',
    description: 'Modern hero section with badge, heading, subtitle, and primary call-to-action button',
    html: `
<section style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 72px 24px; text-align: center; border-radius: 16px; margin: 24px auto; max-width: 1080px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);">
  <div style="max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 20px;">
    <span style="display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #38bdf8; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); padding: 6px 16px; border-radius: 9999px;">
      Next-Gen Web Studio
    </span>
    <h1 style="font-size: 44px; font-weight: 800; line-height: 1.15; margin: 0; color: #f8fafc; letter-spacing: -0.02em;">
      Transform Static HTML Into Declarative Pages
    </h1>
    <p style="font-size: 18px; line-height: 1.6; color: #94a3b8; margin: 0; max-width: 620px;">
      Import untrusted HTML or ZIP archives directly into KUBUILD. Edit layout, tweak responsive typography, and export clean .stora packages effortlessly.
    </p>
    <div style="display: flex; gap: 14px; margin-top: 12px; flex-wrap: wrap; justify-content: center;">
      <a href="#start" style="display: inline-flex; align-items: center; justify-content: center; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);">
        Get Started Now
      </a>
      <a href="#docs" style="display: inline-flex; align-items: center; justify-content: center; background-color: rgba(255, 255, 255, 0.08); color: #e2e8f0; font-weight: 600; font-size: 15px; padding: 12px 24px; border-radius: 8px; text-decoration: none; border: 1px solid rgba(255, 255, 255, 0.15);">
        View Documentation
      </a>
    </div>
  </div>
</section>
`.trim(),
  },
  {
    id: 'contact',
    name: 'Contact Form',
    description: 'Clean contact card with inputs, textarea, validation styling, and submission button',
    html: `
<section style="background-color: #ffffff; padding: 48px 32px; border-radius: 16px; max-width: 540px; margin: 40px auto; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.07); border: 1px solid #e2e8f0; font-family: Inter, sans-serif;">
  <div style="text-align: center; margin-bottom: 28px;">
    <h2 style="font-size: 28px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">
      Send Us a Message
    </h2>
    <p style="font-size: 14px; color: #64748b; margin: 0;">
      Have a question or looking to build together? Drop us a note below.
    </p>
  </div>
  <form style="display: flex; flex-direction: column; gap: 18px;">
    <div style="display: flex; flex-direction: column; gap: 6px; text-align: left;">
      <label style="font-size: 13px; font-weight: 600; color: #334155;">Your Name</label>
      <input type="text" placeholder="Alex Morgan" style="padding: 11px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 14px; background-color: #f8fafc; color: #0f172a;" />
    </div>
    <div style="display: flex; flex-direction: column; gap: 6px; text-align: left;">
      <label style="font-size: 13px; font-weight: 600; color: #334155;">Work Email</label>
      <input type="email" placeholder="alex@company.com" style="padding: 11px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 14px; background-color: #f8fafc; color: #0f172a;" />
    </div>
    <div style="display: flex; flex-direction: column; gap: 6px; text-align: left;">
      <label style="font-size: 13px; font-weight: 600; color: #334155;">Message</label>
      <textarea rows="4" placeholder="Tell us about your project requirements..." style="padding: 11px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 14px; background-color: #f8fafc; color: #0f172a; resize: vertical;"></textarea>
    </div>
    <button type="submit" style="background-color: #2563eb; color: #ffffff; font-weight: 600; padding: 13px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; margin-top: 6px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);">
      Send Message
    </button>
  </form>
</section>
`.trim(),
  },
  {
    id: 'features',
    name: 'Feature Showcase',
    description: 'Three-column responsive grid showcasing platform benefits with cards and badges',
    html: `
<section style="background-color: #f8fafc; padding: 64px 24px; border-radius: 16px; margin: 32px auto; max-width: 1120px;">
  <div style="max-width: 720px; margin: 0 auto 48px auto; text-align: center;">
    <h2 style="font-size: 34px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">
      Engineered for Modern Web Builders
    </h2>
    <p style="font-size: 16px; color: #64748b; line-height: 1.6; margin: 0;">
      From untrusted markup to enterprise-grade declarative components with complete fidelity inspection.
    </p>
  </div>
  <div style="display: flex; flex-wrap: wrap; gap: 24px; justify-content: center;">
    <div style="background-color: #ffffff; padding: 32px 24px; border-radius: 12px; border: 1px solid #e2e8f0; flex: 1; min-width: 280px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 10px; background-color: #dbeafe; color: #2563eb; font-size: 20px; margin-bottom: 16px;">
        ⚡
      </div>
      <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">
        Pure JS Parser
      </h3>
      <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0;">
        Spec-compliant AST compilation without DOMParser dependencies, working uniformly across Node.js and modern browsers.
      </p>
    </div>
    <div style="background-color: #ffffff; padding: 32px 24px; border-radius: 12px; border: 1px solid #e2e8f0; flex: 1; min-width: 280px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 10px; background-color: #dcfce7; color: #16a34a; font-size: 20px; margin-bottom: 16px;">
        🛡️
      </div>
      <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">
        Untrusted Security Shield
      </h3>
      <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0;">
        Automated sanitization of script tags, javascript: URIs, inline handlers, and recursive depth attacks before document assembly.
      </p>
    </div>
    <div style="background-color: #ffffff; padding: 32px 24px; border-radius: 12px; border: 1px solid #e2e8f0; flex: 1; min-width: 280px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 10px; background-color: #f3e8ff; color: #9333ea; font-size: 20px; margin-bottom: 16px;">
        📦
      </div>
      <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">
        Full Stora Round-Trip
      </h3>
      <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0;">
        Instantly preview fidelity metrics, edit canvas nodes, and export production-ready, validated .stora archives.
      </p>
    </div>
  </div>
</section>
`.trim(),
  },
];
