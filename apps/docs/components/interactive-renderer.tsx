'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { PageDocument, Node } from '@kubuild/schema';
import type { ComponentDefinition, ComponentRegistry } from '@kubuild/components';
import { createDefaultComponentRegistry } from '@kubuild/components';
import {
  Eye,
  Code2,
  Copy,
  Check,
  Monitor,
  Tablet,
  Smartphone,
  Loader2,
  Sparkles,
  Sliders,
  RotateCcw,
  Variable,
  Activity,
  Trash2,
  Server,
  Globe,
  Radio,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Bot,
  Wand2,
  Undo2,
} from 'lucide-react';
import { createRenderContext, toastManager, type RenderContext } from '@kubuild/renderer';

export type StoraDocument = PageDocument;

interface DemoCustomRendererProps {
  props: Record<string, unknown>;
  styles?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

export interface VariableControl {
  key: string;
  label: string;
  defaultValue?: string | number;
  type?: 'text' | 'number';
  placeholder?: string;
  group?: string;
}

export interface TrackingLogEntry {
  id: string;
  timestamp: string;
  provider: 'meta' | 'google' | 'gtm' | 'tiktok' | 'server';
  channel: 'browser' | 'server';
  eventName: string;
  eventId?: string;
  pixelId?: string;
  callSnippet: string;
  payload: Record<string, unknown>;
}

export interface InteractiveRendererProps {
  document?: StoraDocument | Record<string, unknown>;
  initialDocument?: StoraDocument | Record<string, unknown>;
  registry?: ComponentRegistry;
  context?: RenderContext;
  initialVariables?: Record<string, unknown>;
  variableControls?: VariableControl[];
  enableTrackingEmulator?: boolean;
  enableAiEmulator?: boolean;
  aiPromptSuggestions?: string[];
  height?: string | number;
  showJsonToggle?: boolean;
  readOnly?: boolean;
  defaultView?: 'preview' | 'json';
  defaultViewport?: 'desktop' | 'tablet' | 'mobile';
  title?: string;
  className?: string;
}

/**
 * Built-in Demo Custom Component: Testimonial Card
 */
export const demoTestimonialCardDefinition: ComponentDefinition = {
  type: 'custom.testimonial-card',
  label: 'Testimonial Card',
  category: 'custom',
  description: 'Customer review card with star rating, avatar, author role, and quote.',
  acceptsChildren: false,
  propFields: [
    { name: 'quote', label: 'Quote', type: 'textarea' },
    { name: 'author', label: 'Author Name', type: 'string' },
    { name: 'role', label: 'Role / Title', type: 'string' },
    { name: 'company', label: 'Company', type: 'string' },
    { name: 'avatarUrl', label: 'Avatar URL', type: 'image' },
    { name: 'rating', label: 'Rating (1-5)', type: 'number', defaultValue: 5 },
    { name: 'badge', label: 'Badge Text', type: 'string' },
    { name: 'verified', label: 'Verified Buyer', type: 'boolean', defaultValue: true },
  ],
  defaultProps: {
    quote: 'KUBUILD decoupled JSON schema from React runtime rendering, giving our host app complete design system freedom.',
    author: 'Sarah Jenkins',
    role: 'VP of Engineering',
    company: 'CloudScale Systems',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&auto=format&fit=crop&q=80',
    rating: 5,
    badge: 'Enterprise Customer',
    verified: true,
  },
  validateProps: (props) => {
    const errors: string[] = [];
    if (!props.author) errors.push('Author name is required.');
    if (!props.quote) errors.push('Quote text is required.');
    return errors.length > 0 ? errors : true;
  },
  renderer: ({ props, styles, onClick }: DemoCustomRendererProps) => {
    const author = String(props.author || 'Anonymous');
    const role = String(props.role || '');
    const company = String(props.company || '');
    const quote = String(props.quote || '');
    const avatarUrl = typeof props.avatarUrl === 'string' ? props.avatarUrl : '';
    const rating = Math.min(5, Math.max(1, Number(props.rating) || 5));
    const verified = Boolean(props.verified ?? true);
    const badge = typeof props.badge === 'string' ? props.badge : '';

    return (
      <div
        style={{
          boxSizing: 'border-box',
          ...styles,
        }}
        onClick={onClick}
      >
        {/* Star Rating & Badge Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                style={{
                  color: star <= rating ? '#fbbf24' : '#475569',
                  fontSize: '18px',
                  lineHeight: 1,
                }}
              >
                ★
              </span>
            ))}
          </div>
          {badge ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>

        {/* Quote Body */}
        <p
          style={{
            fontSize: '15px',
            lineHeight: '1.65',
            fontStyle: 'normal',
            margin: '0 0 20px 0',
            opacity: 0.95,
          }}
        >
          &ldquo;{quote}&rdquo;
        </p>

        {/* Author Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={author}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid rgba(255, 255, 255, 0.15)',
              }}
            />
          ) : (
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '15px',
              }}
            >
              {author.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{author}</span>
              {verified && (
                <span
                  title="Verified Customer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}
                >
                  ✓
                </span>
              )}
            </div>
            {(role || company) && (
              <span style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
                {role}
                {role && company ? ' • ' : ''}
                {company}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
};

/**
 * Built-in Demo Custom Component: Pricing Tier Card
 */
export const demoPricingCardDefinition: ComponentDefinition = {
  type: 'custom.pricing-card',
  label: 'Pricing Tier Card',
  category: 'custom',
  description: 'Tiered subscription pricing card with billing toggle, feature list, and call-to-action.',
  acceptsChildren: false,
  propFields: [
    { name: 'planName', label: 'Plan Name', type: 'string' },
    { name: 'price', label: 'Price', type: 'string' },
    { name: 'period', label: 'Period', type: 'string' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'badge', label: 'Highlight Badge', type: 'string' },
    { name: 'ctaText', label: 'CTA Label', type: 'string' },
    { name: 'popular', label: 'Is Popular', type: 'boolean' },
  ],
  renderer: ({ props, styles, onClick }: DemoCustomRendererProps) => {
    const planName = String(props.planName || 'Pro Plan');
    const price = String(props.price || '$49');
    const period = String(props.period || '/ month');
    const description = String(props.description || 'Full features for expanding engineering teams.');
    const badge = typeof props.badge === 'string' ? props.badge : '';
    const ctaText = String(props.ctaText || 'Get Started Now');
    const isPopular = Boolean(props.popular);

    return (
      <div
        style={{
          boxSizing: 'border-box',
          ...styles,
        }}
        onClick={onClick}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{planName}</h3>
          {badge && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: isPopular ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                color: '#ffffff',
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <p style={{ fontSize: '13px', opacity: 0.75, margin: '0 0 16px 0' }}>{description}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '20px' }}>
          <span style={{ fontSize: '32px', fontWeight: 800 }}>{price}</span>
          <span style={{ fontSize: '14px', opacity: 0.7 }}>{period}</span>
        </div>
        <button
          type="button"
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            background: isPopular ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#334155',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          {ctaText}
        </button>
      </div>
    );
  },
};

/**
 * Creates a default component registry initialized with standard core definitions
 * and enriched with documentation demo custom components.
 */
export function createDocsDemoRegistry(): ComponentRegistry {
  const reg = createDefaultComponentRegistry();
  reg.register(demoTestimonialCardDefinition);
  reg.register(demoPricingCardDefinition);
  return reg;
}

/**
 * Built-in AI generation preset templates for interactive sandbox simulation.
 */
export const AI_PRESET_TEMPLATES: Record<string, Node> = {
  pricing: {
    id: 'section-ai-pricing',
    type: 'section',
    styles: {
      base: {
        paddingTop: '48px',
        paddingBottom: '48px',
        paddingLeft: '24px',
        paddingRight: '24px',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        textAlign: 'center',
      },
    },
    children: [
      {
        id: 'pricing-badge',
        type: 'badge',
        props: {
          text: 'PILIHAN PAKET SAAS',
        },
        styles: {
          base: {
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            color: '#a5b4fc',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            display: 'inline-block',
            marginBottom: '12px',
          },
        },
      },
      {
        id: 'pricing-heading',
        type: 'heading',
        props: {
          text: 'Pilih Paket yang Sesuai untuk Skala Bisnis Anda',
          level: 2,
        },
        styles: {
          base: {
            fontSize: '24px',
            fontWeight: 700,
            margin: '0 0 8px 0',
            color: '#ffffff',
          },
        },
      },
      {
        id: 'pricing-subheading',
        type: 'paragraph',
        props: {
          text: 'Transparan tanpa biaya tersembunyi. Semua paket mencakup AI document assistant dan zero-secret security.',
        },
        styles: {
          base: {
            fontSize: '14px',
            color: '#94a3b8',
            maxWidth: '560px',
            margin: '0 auto 32px auto',
          },
        },
      },
      {
        id: 'pricing-grid',
        type: 'columns',
        props: {
          columns: 3,
          gap: '20px',
        },
        styles: {
          base: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            maxWidth: '880px',
            margin: '0 auto',
            textAlign: 'left',
          },
        },
        children: [
          {
            id: 'tier-starter',
            type: 'custom.pricing-card',
            props: {
              planName: 'Starter',
              price: 'Rp 199.000',
              period: '/ bulan',
              description: 'Cocok untuk individual developer dan eksperimen awal.',
              ctaText: 'Mulai Uji Coba',
              popular: false,
            },
            styles: {
              base: {
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#ffffff',
              },
            },
          },
          {
            id: 'tier-pro',
            type: 'custom.pricing-card',
            props: {
              planName: 'Pro SaaS',
              price: 'Rp 499.000',
              period: '/ bulan',
              description: 'Paling diminati tim berkembang dengan AI Copilot unlimited.',
              badge: 'Paling Populer',
              ctaText: 'Pilih Paket Pro',
              popular: true,
            },
            styles: {
              base: {
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: '#1e293b',
                border: '2px solid #6366f1',
                color: '#ffffff',
                boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.3)',
              },
            },
          },
          {
            id: 'tier-enterprise',
            type: 'custom.pricing-card',
            props: {
              planName: 'Enterprise',
              price: 'Custom',
              period: '/ tahun',
              description: 'Khusus organisasi berskala besar dengan custom proxy & SLA 99.9%.',
              ctaText: 'Hubungi Sales',
              popular: false,
            },
            styles: {
              base: {
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#ffffff',
              },
            },
          },
        ],
      },
    ],
  },
  testimonials: {
    id: 'section-ai-testimonials',
    type: 'section',
    styles: {
      base: {
        paddingTop: '48px',
        paddingBottom: '48px',
        paddingLeft: '24px',
        paddingRight: '24px',
        backgroundColor: '#0b1120',
        color: '#f8fafc',
        textAlign: 'center',
      },
    },
    children: [
      {
        id: 'testimonial-badge',
        type: 'badge',
        props: {
          text: 'TESTIMONI PENGGUNA',
        },
        styles: {
          base: {
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            color: '#fbbf24',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            display: 'inline-block',
            marginBottom: '12px',
          },
        },
      },
      {
        id: 'testi-heading',
        type: 'heading',
        props: {
          text: 'Dipercaya oleh 10.000+ Tim Kreatif & SaaS Host',
          level: 2,
        },
        styles: {
          base: {
            fontSize: '24px',
            fontWeight: 700,
            margin: '0 0 8px 0',
            color: '#ffffff',
          },
        },
      },
      {
        id: 'testi-subheading',
        type: 'paragraph',
        props: {
          text: 'Bagaimana AI Assistant di KUBUILD memangkas waktu delivery landing page dari hitungan hari menjadi hitungan menit.',
        },
        styles: {
          base: {
            fontSize: '14px',
            color: '#94a3b8',
            maxWidth: '580px',
            margin: '0 auto 32px auto',
          },
        },
      },
      {
        id: 'testi-grid',
        type: 'columns',
        props: {
          columns: 3,
          gap: '20px',
        },
        styles: {
          base: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '20px',
            maxWidth: '920px',
            margin: '0 auto',
            textAlign: 'left',
          },
        },
        children: [
          {
            id: 'testi-card-1',
            type: 'custom.testimonial-card',
            props: {
              author: 'Sarah Jenkins',
              role: 'VP of Engineering',
              company: 'NexaFlow Systems',
              quote: 'KUBUILD memisahkan JSON AST dari runtime React. AI Copilot menghasilkan layout siap pakai tanpa pernah menghasilkan arbitrary script berbahaya.',
              rating: 5,
              badge: 'Enterprise Host',
              verified: true,
            },
            styles: {
              base: {
                padding: '22px',
                borderRadius: '12px',
                backgroundColor: '#131b2e',
                border: '1px solid #1e293b',
                color: '#f1f5f9',
              },
            },
          },
          {
            id: 'testi-card-2',
            type: 'custom.testimonial-card',
            props: {
              author: 'Budi Santoso',
              role: 'Lead Product Designer',
              company: 'Stora Studio',
              quote: 'Atomic undo adalah penyelamat! Setiap prompt AI yang dijalankan dibungkus ke dalam satu transaksi, cukup tekan Cmd+Z sekali untuk membatalkan seluruh blok.',
              rating: 5,
              badge: 'SaaS Platform',
              verified: true,
            },
            styles: {
              base: {
                padding: '22px',
                borderRadius: '12px',
                backgroundColor: '#131b2e',
                border: '1px solid #1e293b',
                color: '#f1f5f9',
              },
            },
          },
          {
            id: 'testi-card-3',
            type: 'custom.testimonial-card',
            props: {
              author: 'Ahmad Rifai',
              role: 'Head of Performance Growth',
              company: 'Kuantum Media',
              quote: 'Pola Backend Proxy menjamin API Key OpenAI/Claude tidak pernah bocor ke browser pengunjung. Integrasi Next.js sangat rapi.',
              rating: 5,
              badge: 'Growth Agency',
              verified: true,
            },
            styles: {
              base: {
                padding: '22px',
                borderRadius: '12px',
                backgroundColor: '#131b2e',
                border: '1px solid #1e293b',
                color: '#f1f5f9',
              },
            },
          },
        ],
      },
    ],
  },
  faq: {
    id: 'section-ai-faq',
    type: 'section',
    styles: {
      base: {
        paddingTop: '48px',
        paddingBottom: '48px',
        paddingLeft: '24px',
        paddingRight: '24px',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        textAlign: 'center',
      },
    },
    children: [
      {
        id: 'faq-badge',
        type: 'badge',
        props: {
          text: 'PERTANYAAN UMUM',
        },
        styles: {
          base: {
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            color: '#6ee7b7',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            display: 'inline-block',
            marginBottom: '12px',
          },
        },
      },
      {
        id: 'faq-heading',
        type: 'heading',
        props: {
          text: 'Pertanyaan yang Sering Diajukan (FAQ)',
          level: 2,
        },
        styles: {
          base: {
            fontSize: '24px',
            fontWeight: 700,
            margin: '0 0 8px 0',
            color: '#ffffff',
          },
        },
      },
      {
        id: 'faq-subheading',
        type: 'paragraph',
        props: {
          text: 'Pahami arsitektur keamanan, proteksi API key backend-proxy, dan sistem Atomic Undo di KUBUILD.',
        },
        styles: {
          base: {
            fontSize: '14px',
            color: '#94a3b8',
            maxWidth: '560px',
            margin: '0 auto 32px auto',
          },
        },
      },
      {
        id: 'faq-items-wrapper',
        type: 'container',
        props: {},
        styles: {
          base: {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '720px',
            margin: '0 auto',
            textAlign: 'left',
          },
        },
        children: [
          {
            id: 'faq-item-1',
            type: 'container',
            props: {},
            styles: {
              base: {
                padding: '16px 20px',
                borderRadius: '10px',
                backgroundColor: '#131b2e',
                border: '1px solid #1e293b',
              },
            },
            children: [
              {
                id: 'faq-q-1',
                type: 'heading',
                props: {
                  text: 'Bagaimana KUBUILD melindungi API Key OpenAI / Claude dari kebocoran?',
                  level: 4,
                },
                styles: {
                  base: {
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: '0 0 6px 0',
                  },
                },
              },
              {
                id: 'faq-a-1',
                type: 'paragraph',
                props: {
                  text: 'KUBUILD mewajibkan pola Backend Proxy. Endpoint host (/api/ai) menyimpan API Key di server-side env. Klien browser tidak pernah menerima atau menyimpan credential sensitif.',
                },
                styles: {
                  base: {
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: '#94a3b8',
                    margin: 0,
                  },
                },
              },
            ],
          },
          {
            id: 'faq-item-2',
            type: 'container',
            props: {},
            styles: {
              base: {
                padding: '16px 20px',
                borderRadius: '10px',
                backgroundColor: '#131b2e',
                border: '1px solid #1e293b',
              },
            },
            children: [
              {
                id: 'faq-q-2',
                type: 'heading',
                props: {
                  text: 'Mengapa output AI KUBUILD aman dari XSS dan arbitrary script injection?',
                  level: 4,
                },
                styles: {
                  base: {
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: '0 0 6px 0',
                  },
                },
              },
              {
                id: 'faq-a-2',
                type: 'paragraph',
                props: {
                  text: 'AI tidak menghasilkan string raw HTML. Model memanggil JSON Tool Functions terstruktur yang divalidasi skema Zod. Atribut berbahaya seperti javascript:, <script>, dan CSS expression otomatis ditolak.',
                },
                styles: {
                  base: {
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: '#94a3b8',
                    margin: 0,
                  },
                },
              },
            ],
          },
          {
            id: 'faq-item-3',
            type: 'container',
            props: {},
            styles: {
              base: {
                padding: '16px 20px',
                borderRadius: '10px',
                backgroundColor: '#131b2e',
                border: '1px solid #1e293b',
              },
            },
            children: [
              {
                id: 'faq-q-3',
                type: 'heading',
                props: {
                  text: 'Bagaimana cara kerja Atomic Undo jika hasil AI tidak sesuai?',
                  level: 4,
                },
                styles: {
                  base: {
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: '0 0 6px 0',
                  },
                },
              },
              {
                id: 'faq-a-3',
                type: 'paragraph',
                props: {
                  text: 'Semua perubahan dalam satu eksekusi prompt dibundel dalam satu transaksi history atomic. Cukup tekan tombol Undo atau Cmd+Z sekali untuk membatalkan seluruh blok seketika.',
                },
                styles: {
                  base: {
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: '#94a3b8',
                    margin: 0,
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

// Default sample document if none is passed
const DEFAULT_FALLBACK_DOCUMENT: PageDocument = {
  schema: 'stora.page',
  version: '1.3.0',
  metadata: {
    title: 'Interactive Component Demo',
    description: 'Live interactive preview powered by @kubuild/renderer',
    author: 'KUBUILD Team',
    tags: ['interactive', 'preview'],
    category: 'demo',
    version: '1.0.0',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  document: {
    id: 'root-demo-page',
    type: 'page',
    props: { title: 'KUBUILD Sandbox' },
    styles: {
      base: {
        backgroundColor: '#ffffff',
        color: '#0f172a',
        padding: '36px 24px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        minHeight: '100%',
        boxSizing: 'border-box',
      },
    },
    children: [
      {
        id: 'hero-section',
        type: 'section',
        props: {},
        styles: {
          base: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px',
            maxWidth: '600px',
            margin: '0 auto',
          },
        },
        children: [
          {
            id: 'heading-1',
            type: 'heading',
            props: {
              level: 2,
              text: 'Build Visually. Ship Pure Schema.',
            },
            styles: {
              base: {
                fontSize: '26px',
                fontWeight: '700',
                letterSpacing: '-0.02em',
                lineHeight: '1.25',
                color: '#0f172a',
                margin: '0',
              },
            },
          },
          {
            id: 'desc-1',
            type: 'paragraph',
            props: {
              text: 'KUBUILD decouples the visual canvas from the runtime renderer. Every component is compiled into a lightweight .stora JSON AST.',
            },
            styles: {
              base: {
                fontSize: '15px',
                lineHeight: '1.6',
                color: '#64748b',
                margin: '0',
              },
            },
          },
          {
            id: 'btn-explore',
            type: 'button',
            props: {
              label: 'Interactive Action',
              variant: 'solid',
            },
            styles: {
              base: {
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                padding: '10px 22px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                border: 'none',
                marginTop: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                transition: 'all 0.15s ease',
              },
            },
          },
        ],
      },
    ],
  },
};

/**
 * Dynamically import KubuildRenderer with ssr: false
 * to prevent heavy bundle on initial page load and SSR hydration mismatch.
 */
const DynamicKubuildRenderer = dynamic(
  () => import('@kubuild/renderer').then((mod) => mod.KubuildRenderer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full min-h-[240px] items-center justify-center p-8 text-fd-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-xs font-medium">Loading Kubuild Canvas...</span>
      </div>
    ),
  }
);

/**
 * Normalize incoming document:
 * Handles full PageDocument or wrapped single Node.
 */
function normalizeDoc(raw?: StoraDocument | Record<string, unknown>): PageDocument {
  if (!raw) return DEFAULT_FALLBACK_DOCUMENT;

  // If already a valid PageDocument with document tree
  if ('document' in raw && typeof raw.document === 'object' && raw.document !== null) {
    return raw as unknown as PageDocument;
  }

  // If passed as a single node (e.g. { type: 'section', ... })
  if ('type' in raw && typeof raw.type === 'string') {
    return {
      schema: 'stora.page',
      version: '1.3.0',
      metadata: {
        title: 'Preview',
        description: 'Auto-wrapped component preview',
        author: 'KUBUILD',
        tags: ['preview'],
        category: 'general',
        version: '1.0.0',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      document: {
        id: 'auto-root',
        type: 'page',
        props: {},
        styles: {
          base: {
            padding: '24px',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            minHeight: '100%',
            fontFamily: 'Inter, system-ui, sans-serif',
          },
        },
        children: [raw as unknown as Node],
      },
    };
  }

  return DEFAULT_FALLBACK_DOCUMENT;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightJson(jsonStr: string): string {
  const safe = escapeHtml(jsonStr);
  return safe.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'text-amber-600 dark:text-amber-400';
      if (/^&quot;/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-sky-600 dark:text-sky-400 font-semibold';
        } else {
          cls = 'text-emerald-600 dark:text-emerald-400';
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-purple-600 dark:text-purple-400 font-semibold';
      } else if (/null/.test(match)) {
        cls = 'text-rose-600 dark:text-rose-400 italic';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

export function InteractiveRenderer({
  document: docProp,
  initialDocument,
  registry: customRegistry,
  context: customContext,
  initialVariables,
  variableControls,
  enableTrackingEmulator,
  enableAiEmulator = false,
  aiPromptSuggestions,
  height = '420px',
  showJsonToggle = true,
  defaultView = 'preview',
  defaultViewport = 'desktop',
  title = 'Interactive Preview',
  className = '',
}: InteractiveRendererProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'preview' | 'json'>(defaultView);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>(defaultViewport);
  const [copied, setCopied] = useState(false);

  // AI Assistant Emulator state
  const initialNormalizedDoc = useMemo(() => {
    return normalizeDoc(docProp || initialDocument);
  }, [docProp, initialDocument]);

  const [aiDocState, setAiDocState] = useState<PageDocument>(initialNormalizedDoc);
  const [aiDocHistory, setAiDocHistory] = useState<PageDocument[]>([]);
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiStreamingPhase, setAiStreamingPhase] = useState<string | null>(null);
  const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState<string | null>(null);

  useEffect(() => {
    setAiDocState(initialNormalizedDoc);
    setAiDocHistory([]);
  }, [initialNormalizedDoc]);

  const activeDoc = enableAiEmulator ? aiDocState : initialNormalizedDoc;

  const defaultAiSuggestions = useMemo(() => {
    return (
      aiPromptSuggestions || [
        'Tambahkan modern SaaS Pricing Table 3 kolom',
        'Generate Testimonial Section dengan rating bintang 5',
        'Buat FAQ Accordion modern',
      ]
    );
  }, [aiPromptSuggestions]);

  const handleExecuteAiPrompt = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed || isAiGenerating) return;

      setIsAiGenerating(true);
      setAiStreamingPhase('1/4: Menghubungi endpoint /api/ai proxy handler...');
      await new Promise((r) => setTimeout(r, 220));

      setAiStreamingPhase('2/4: LLM Tool Calling: insert_component(type="section")...');
      await new Promise((r) => setTimeout(r, 260));

      setAiStreamingPhase('3/4: Memvalidasi skema Zod AST & safe attributes (anti-XSS)...');
      await new Promise((r) => setTimeout(r, 240));

      setAiStreamingPhase('4/4: Rekonsiliasi Node Tree & commit transaksi atomic...');
      await new Promise((r) => setTimeout(r, 180));

      const lower = trimmed.toLowerCase();
      let newSection: Node;

      if (
        lower.includes('pricing') ||
        lower.includes('harga') ||
        lower.includes('paket') ||
        lower.includes('langganan')
      ) {
        newSection = JSON.parse(JSON.stringify(AI_PRESET_TEMPLATES.pricing));
      } else if (
        lower.includes('testimonial') ||
        lower.includes('testimoni') ||
        lower.includes('rating') ||
        lower.includes('review')
      ) {
        newSection = JSON.parse(JSON.stringify(AI_PRESET_TEMPLATES.testimonials));
      } else if (
        lower.includes('faq') ||
        lower.includes('tanya') ||
        lower.includes('accordion') ||
        lower.includes('pertanyaan')
      ) {
        newSection = JSON.parse(JSON.stringify(AI_PRESET_TEMPLATES.faq));
      } else {
        const uniqueSuffix = Date.now().toString(36);
        newSection = {
          id: `section-ai-${uniqueSuffix}`,
          type: 'section',
          props: {},
          styles: {
            base: {
              paddingTop: '48px',
              paddingBottom: '48px',
              paddingLeft: '24px',
              paddingRight: '24px',
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              textAlign: 'center',
            },
          },
          children: [
            {
              id: `heading-${uniqueSuffix}`,
              type: 'heading',
              props: {
                text: trimmed,
                level: 2,
              },
              styles: {
                base: {
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '10px',
                },
              },
            },
            {
              id: `p-${uniqueSuffix}`,
              type: 'paragraph',
              props: {
                text: 'Bagian ini di-generate secara real-time dari prompt melalui streaming LLM reconciliation.',
              },
              styles: {
                base: {
                  fontSize: '14px',
                  color: '#94a3b8',
                  maxWidth: '580px',
                  margin: '0 auto',
                },
              },
            },
          ],
        };
      }

      setAiDocHistory((prev) => [...prev, aiDocState]);
      setAiDocState((prev) => {
        const currentChildren = prev.document?.children || [];
        return {
          ...prev,
          document: {
            ...prev.document,
            children: [...currentChildren, newSection],
          },
        };
      });

      setLastGeneratedPrompt(trimmed);
      setIsAiGenerating(false);
      setAiStreamingPhase(null);
      setAiPromptInput('');

      toastManager.showToast({
        type: 'success',
        title: 'AI Layout Generated!',
        message: 'Bagian baru berhasil direkonsiliasi ke dalam AST dokumen (Atomic undo aktif).',
      });
    },
    [aiDocState, isAiGenerating]
  );

  const handleAiUndo = useCallback(() => {
    if (aiDocHistory.length === 0) return;
    const previousDoc = aiDocHistory[aiDocHistory.length - 1];
    setAiDocState(previousDoc);
    setAiDocHistory((prev) => prev.slice(0, -1));
    toastManager.showToast({
      type: 'info',
      title: 'Atomic Undo Berhasil',
      message: 'Perubahan AI telah dibatalkan ke kondisi sebelumnya (1 transaksi dikembalikan).',
    });
  }, [aiDocHistory]);

  const handleAiReset = useCallback(() => {
    setAiDocState(initialNormalizedDoc);
    setAiDocHistory([]);
    setLastGeneratedPrompt(null);
    toastManager.showToast({
      type: 'info',
      title: 'Reset Dokumen',
      message: 'Dokumen dikembalikan ke layout awal.',
    });
  }, [initialNormalizedDoc]);

  // Keydown listener for Cmd+Z / Ctrl+Z
  useEffect(() => {
    if (!enableAiEmulator || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (aiDocHistory.length > 0) {
          e.preventDefault();
          handleAiUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableAiEmulator, aiDocHistory, handleAiUndo]);

  // Tracking emulator state
  const [trackingLogs, setTrackingLogs] = useState<TrackingLogEntry[]>([]);
  const [trackingFilter, setTrackingFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    if (trackingFilter === 'all') return trackingLogs;
    return trackingLogs.filter((l) => l.provider === trackingFilter);
  }, [trackingLogs, trackingFilter]);

  const isTrackingEmulatorActive = Boolean(
    enableTrackingEmulator ||
      ((activeDoc as any)?.tracking?.enabled !== false &&
        Array.isArray((activeDoc as any)?.tracking?.pixels) &&
        (activeDoc as any)?.tracking?.pixels.length > 0)
  );

  // Initialize variables from initialVariables and variableControls defaults
  const defaultVars = useMemo(() => {
    const init: Record<string, unknown> = { ...(initialVariables || {}) };
    if (variableControls) {
      for (const ctrl of variableControls) {
        if (!(ctrl.key in init) && ctrl.defaultValue !== undefined) {
          init[ctrl.key] = ctrl.defaultValue;
        }
      }
    }
    return init;
  }, [initialVariables, variableControls]);

  const [variables, setVariables] = useState<Record<string, unknown>>(defaultVars);

  const handleVariableChange = useCallback((key: string, value: unknown) => {
    setVariables((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleResetVariables = useCallback(() => {
    setVariables(defaultVars);
  }, [defaultVars]);

  const activeRegistry = useMemo(() => {
    return customRegistry || createDocsDemoRegistry();
  }, [customRegistry]);

  // Intercept client-side pixel calls if tracking emulator is active
  useEffect(() => {
    if (!isTrackingEmulatorActive || typeof window === 'undefined') return;

    const origFbq = window.fbq;
    const origGtag = window.gtag;
    const origTtq = window.ttq;
    const origDataLayer = window.dataLayer;

    // Mock/Intercept Meta fbq
    window.fbq = function (...args: unknown[]) {
      origFbq?.(...args);
      const method = String(args[0] || 'track');
      let pixelId = '';
      let eventName = '';
      let params: Record<string, unknown> = {};
      let options: Record<string, unknown> = {};

      if (method === 'trackSingle' || method === 'trackSingleCustom') {
        pixelId = String(args[1] || '');
        eventName = String(args[2] || '');
        params = (args[3] as Record<string, unknown>) || {};
        options = (args[4] as Record<string, unknown>) || {};
      } else if (method === 'track' || method === 'trackCustom') {
        eventName = String(args[1] || '');
        params = (args[2] as Record<string, unknown>) || {};
        options = (args[3] as Record<string, unknown>) || {};
      }

      if (eventName && eventName !== 'init') {
        const eventId = String(options.eventID || (params as any).eventID || '');
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
        const snippet = pixelId
          ? `fbq('${method}', '${pixelId}', '${eventName}', ${JSON.stringify(params)}${eventId ? `, { eventID: '${eventId}' }` : ''})`
          : `fbq('${method}', '${eventName}', ${JSON.stringify(params)}${eventId ? `, { eventID: '${eventId}' }` : ''})`;

        setTrackingLogs((prev) => [
          {
            id: `meta_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp,
            provider: 'meta',
            channel: 'browser',
            eventName,
            eventId: eventId || undefined,
            pixelId: pixelId || undefined,
            callSnippet: snippet,
            payload: { ...params, ...(eventId ? { eventID: eventId } : {}) },
          },
          ...prev,
        ]);
      }
    };

    // Mock/Intercept Google gtag
    window.dataLayer = window.dataLayer || [];
    window.gtag = function (...args: unknown[]) {
      origGtag?.(...args);
      const command = String(args[0] || '');
      if (command === 'event') {
        const eventName = String(args[1] || '');
        const params = (args[2] as Record<string, unknown>) || {};
        const eventId = String(params.event_id || '');
        const pixelId = String(params.send_to || '');
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
        const snippet = `gtag('event', '${eventName}', ${JSON.stringify(params)})`;

        setTrackingLogs((prev) => [
          {
            id: `ga4_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp,
            provider: 'google',
            channel: 'browser',
            eventName,
            eventId: eventId || undefined,
            pixelId: pixelId || undefined,
            callSnippet: snippet,
            payload: params,
          },
          ...prev,
        ]);
      }
    };

    // Mock/Intercept TikTok ttq
    const makeTikTokInstance = (pid: string) => ({
      track: (eventName: string, params?: Record<string, unknown>, opts?: Record<string, unknown>) => {
        const eventId = String(opts?.event_id || '');
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
        const snippet = `ttq.instance('${pid}').track('${eventName}', ${JSON.stringify(params || {})}${eventId ? `, { event_id: '${eventId}' }` : ''})`;
        setTrackingLogs((prev) => [
          {
            id: `tt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp,
            provider: 'tiktok',
            channel: 'browser',
            eventName,
            eventId: eventId || undefined,
            pixelId: pid,
            callSnippet: snippet,
            payload: { ...(params || {}), ...(eventId ? { event_id: eventId } : {}) },
          },
          ...prev,
        ]);
      },
      page: () => {
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
        setTrackingLogs((prev) => [
          {
            id: `tt_page_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp,
            provider: 'tiktok',
            channel: 'browser',
            eventName: 'PageView',
            pixelId: pid,
            callSnippet: `ttq.instance('${pid}').page()`,
            payload: {},
          },
          ...prev,
        ]);
      },
    });

    window.ttq = {
      load: () => {},
      page: () => {},
      instance: (pid: string) => makeTikTokInstance(pid) as any,
      track: (eventName: string, params?: Record<string, unknown>, opts?: Record<string, unknown>) => {
        const eventId = String(opts?.event_id || '');
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
        const snippet = `ttq.track('${eventName}', ${JSON.stringify(params || {})}${eventId ? `, { event_id: '${eventId}' }` : ''})`;
        setTrackingLogs((prev) => [
          {
            id: `tt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp,
            provider: 'tiktok',
            channel: 'browser',
            eventName,
            eventId: eventId || undefined,
            callSnippet: snippet,
            payload: { ...(params || {}), ...(eventId ? { event_id: eventId } : {}) },
          },
          ...prev,
        ]);
      },
    } as any;

    // Mock/Intercept GTM dataLayer
    const origPush = window.dataLayer.push.bind(window.dataLayer);
    window.dataLayer.push = function (...items: unknown[]) {
      const res = origPush(...items);
      for (const item of items) {
        if (item && typeof item === 'object' && 'event' in item && typeof (item as any).event === 'string') {
          const evtObj = item as Record<string, unknown>;
          const eventName = String(evtObj.event);
          if (eventName !== 'gtm.js' && eventName !== 'gtm.dom' && eventName !== 'gtm.load') {
            const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
            const eventId = String(evtObj.event_id || '');
            const snippet = `dataLayer.push(${JSON.stringify(evtObj)})`;
            setTrackingLogs((prev) => [
              {
                id: `gtm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                timestamp,
                provider: 'gtm',
                channel: 'browser',
                eventName,
                eventId: eventId || undefined,
                callSnippet: snippet,
                payload: evtObj,
              },
              ...prev,
            ]);
          }
        }
      }
      return res;
    };

    return () => {
      window.fbq = origFbq;
      window.gtag = origGtag;
      window.ttq = origTtq;
      if (origDataLayer) window.dataLayer = origDataLayer;
    };
  }, [isTrackingEmulatorActive]);

  const activeContext = useMemo(() => {
    const relayHandler = async (url: string, init?: RequestInit): Promise<Response> => {
      try {
        const parsed = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        const evt = parsed.event || {};
        const eventId = evt.eventId || 'evt_simulated';
        const eventName = evt.eventName || 'Event';
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
        const snippet = `POST ${url} (CAPI Relay: ${parsed.provider || 'all'})`;

        setTrackingLogs((prev) => [
          {
            id: `server_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp,
            provider: 'server',
            channel: 'server',
            eventName,
            eventId,
            callSnippet: snippet,
            payload: {
              endpoint: url,
              protocolVersion: parsed.version || '1.0.0',
              provider: parsed.provider,
              eventId,
              eventTime: evt.eventTime,
              eventSourceUrl: evt.eventSourceUrl,
              actionSource: evt.actionSource,
              params: evt.params,
              userData: evt.userData,
              deduplicationNote: 'Shared eventId matches client-side browser pixel for 100% accurate deduplication.',
            },
          },
          ...prev,
        ]);

        return new Response(
          JSON.stringify({
            success: true,
            version: '1.0.0',
            timestamp: Math.floor(Date.now() / 1000),
            results: {
              'meta:px_meta_primary': { success: true, eventId },
              'meta:px_meta_agency': { success: true, eventId },
              'tiktok:px_tiktok_primary': { success: true, eventId },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
      }
    };

    return createRenderContext({
      ...customContext,
      variables: {
        ...(customContext?.variables || {}),
        ...variables,
      },
      tracking: {
        relayUrl: customContext?.tracking?.relayUrl || (isTrackingEmulatorActive ? '/api/tracking' : undefined),
        fetchFn: isTrackingEmulatorActive ? (relayHandler as any) : customContext?.tracking?.fetchFn,
        ...(customContext?.tracking || {}),
      },
      onFormSubmit:
        customContext?.onFormSubmit ||
        (async (submission, helpers) => {
          // Simulate network latency
          await new Promise((resolve) => setTimeout(resolve, 600));

          // Simulate server-side rejection for test email
          if (submission.values.email === 'error@example.com') {
            helpers.setErrors({
              email: 'Alamat email ini sudah terdaftar di sistem kami (Server validation error).',
            });
            toastManager.showToast({
              type: 'error',
              title: 'Server Error',
              message: 'Email error@example.com ditolak oleh server host.',
            });
            return;
          }

          // Success notification
          toastManager.showToast({
            type: 'success',
            title: 'Formulir Berhasil Dikirim!',
            message: `Terima kasih ${submission.values.name || 'Pengunjung'}, data Anda berhasil diterima host!`,
          });
          helpers.resetForm();
        }),
    });
  }, [customContext, variables]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const jsonString = useMemo(() => {
    return JSON.stringify(activeDoc, null, 2);
  }, [activeDoc]);

  const highlightedJsonHtml = useMemo(() => {
    return highlightJson(jsonString);
  }, [jsonString]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(false);
    }
  }, [jsonString]);

  // Frame width constraints based on selected viewport
  const viewportWidthStyle = useMemo(() => {
    if (viewport === 'tablet') return 'max-w-[768px]';
    if (viewport === 'mobile') return 'max-w-[375px]';
    return 'w-full';
  }, [viewport]);

  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`my-6 overflow-hidden rounded-xl border border-fd-border bg-fd-card text-fd-foreground shadow-sm transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border bg-fd-muted/50 px-3 py-2 text-xs">
        {/* Left: Title & Viewport Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-medium text-fd-foreground">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{title}</span>
          </div>

          {/* Viewport Toggles (only visible in Preview mode) */}
          {view === 'preview' && (
            <div className="ml-2 flex items-center rounded-md border border-fd-border bg-fd-background p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewport('desktop')}
                title="Desktop View (100%)"
                className={`flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors ${
                  viewport === 'desktop'
                    ? 'bg-fd-accent text-fd-accent-foreground shadow-2xs'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Desktop</span>
              </button>

              <button
                type="button"
                onClick={() => setViewport('tablet')}
                title="Tablet View (768px)"
                className={`flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors ${
                  viewport === 'tablet'
                    ? 'bg-fd-accent text-fd-accent-foreground shadow-2xs'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                }`}
              >
                <Tablet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tablet</span>
              </button>

              <button
                type="button"
                onClick={() => setViewport('mobile')}
                title="Mobile View (375px)"
                className={`flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors ${
                  viewport === 'mobile'
                    ? 'bg-fd-accent text-fd-accent-foreground shadow-2xs'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Preview/JSON Tab & Copy Button */}
        <div className="flex items-center gap-1.5">
          {showJsonToggle && (
            <div className="flex items-center rounded-md border border-fd-border bg-fd-background p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setView('preview')}
                className={`flex h-6 items-center gap-1 rounded px-2 font-medium transition-colors ${
                  view === 'preview'
                    ? 'bg-fd-accent text-fd-accent-foreground shadow-2xs'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Preview</span>
              </button>

              <button
                type="button"
                onClick={() => setView('json')}
                className={`flex h-6 items-center gap-1 rounded px-2 font-medium transition-colors ${
                  view === 'json'
                    ? 'bg-fd-accent text-fd-accent-foreground shadow-2xs'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>JSON Schema</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopy}
            title="Copy .stora Schema JSON"
            className="flex h-7 items-center gap-1 rounded-md border border-fd-border bg-fd-background px-2 font-medium text-fd-muted-foreground shadow-2xs transition-colors hover:bg-fd-accent hover:text-fd-foreground"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy JSON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{ minHeight: heightStyle, maxHeight: '680px' }}
        className="relative flex flex-col overflow-auto bg-fd-muted/20"
      >
        {/* Live AI Copilot & Prompt Emulator Panel */}
        {mounted && view === 'preview' && enableAiEmulator && (
          <div className="border-b border-purple-500/30 bg-gradient-to-r from-purple-950/20 via-indigo-950/20 to-slate-900/40 backdrop-blur-xs p-3.5 font-sans">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-purple-400 animate-ping" />
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-200">
                  <Bot className="h-4 w-4 text-purple-400" />
                  <span>AI Copilot & Document Assistant Emulator</span>
                  <span className="hidden sm:inline-block text-[10px] font-normal px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/50">
                    Live Prompt-to-Layout Engine
                  </span>
                </div>
              </div>

              {/* Action buttons (Undo / Reset) */}
              <div className="flex items-center gap-2">
                {aiDocHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAiUndo}
                    title="Batalkan perubahan AI terakhir (Cmd+Z)"
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-purple-900/40 text-purple-200 border border-purple-700/40 hover:bg-purple-800/50 transition-colors shadow-2xs"
                  >
                    <Undo2 className="h-3 w-3" />
                    <span>Undo AI (Cmd+Z)</span>
                  </button>
                )}
                {aiDocHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAiReset}
                    title="Kembalikan ke layout awal"
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Input Prompt & Execute */}
            <div className="flex gap-2 mb-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={aiPromptInput}
                  onChange={(e) => setAiPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleExecuteAiPrompt(aiPromptInput);
                    }
                  }}
                  disabled={isAiGenerating}
                  placeholder="Ketik instruksi prompt (e.g. 'Tambahkan modern SaaS Pricing Table 3 kolom')..."
                  className="w-full rounded-lg border border-purple-500/40 bg-slate-950/80 px-3 py-1.5 text-xs text-white placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                onClick={() => handleExecuteAiPrompt(aiPromptInput)}
                disabled={!aiPromptInput.trim() || isAiGenerating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 transition-all cursor-pointer"
              >
                {isAiGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>Generate</span>
              </button>
            </div>

            {/* Suggestions Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-purple-300/80 mr-1 flex items-center gap-1">
                <Wand2 className="h-3 w-3" /> Rekomendasi Prompt:
              </span>
              {defaultAiSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={isAiGenerating}
                  onClick={() => {
                    setAiPromptInput(suggestion);
                    handleExecuteAiPrompt(suggestion);
                  }}
                  className="rounded-full border border-purple-500/30 bg-purple-950/40 px-2.5 py-0.5 text-[11px] text-purple-200 hover:bg-purple-800/40 hover:border-purple-400/60 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Streaming Reconciliation Indicator */}
            {isAiGenerating && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-purple-500/40 bg-purple-950/60 px-3 py-2 text-xs text-purple-100 shadow-inner animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                <span className="font-mono text-[11px]">{aiStreamingPhase}</span>
              </div>
            )}

            {/* Reconciled Transaction Banner */}
            {!isAiGenerating && lastGeneratedPrompt && (
              <div className="mt-2 flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1 text-[11px] text-emerald-300">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    Deterministic AST Reconciled: <strong>&ldquo;{lastGeneratedPrompt}&rdquo;</strong>
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400/70 font-mono">
                  Atomic Transaction: tx_ai_{lastGeneratedPrompt.length}a9b
                </span>
              </div>
            )}
          </div>
        )}

        {/* Optional Live Variable Controls Panel */}
        {mounted && view === 'preview' && variableControls && variableControls.length > 0 && (
          <div className="border-b border-fd-border/70 bg-fd-background/80 backdrop-blur-xs p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-fd-foreground">
                <Sliders className="h-3.5 w-3.5 text-sky-500" />
                <span>Host Variable Simulator</span>
                <span className="text-[10px] font-normal text-fd-muted-foreground">
                  (Edit nilai di bawah untuk melihat live interpolation)
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetVariables}
                title="Reset ke nilai awal"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-fd-muted-foreground hover:text-fd-foreground transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {variableControls.map((ctrl) => {
                const val = variables[ctrl.key] !== undefined ? String(variables[ctrl.key]) : '';
                return (
                  <div
                    key={ctrl.key}
                    className="flex flex-col gap-1 rounded-md border border-fd-border/60 bg-fd-card/50 p-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-fd-foreground truncate" title={ctrl.label}>
                        {ctrl.label}
                      </span>
                      <code className="text-[10px] font-mono px-1 py-0.2 rounded bg-fd-muted text-sky-600 dark:text-sky-400">
                        {`{{ ${ctrl.key} }}`}
                      </code>
                    </div>
                    <input
                      type={ctrl.type === 'number' ? 'number' : 'text'}
                      value={val}
                      placeholder={ctrl.placeholder || ctrl.label}
                      onChange={(e) => {
                        const nextVal = ctrl.type === 'number' ? Number(e.target.value) : e.target.value;
                        handleVariableChange(ctrl.key, nextVal);
                      }}
                      className="w-full rounded border border-fd-border bg-fd-background px-2 py-1 text-xs text-fd-foreground placeholder:text-fd-muted-foreground/60 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!mounted ? (
          // Server-rendered & initial client skeleton to eliminate hydration mismatch
          <div className="flex h-full w-full min-h-[300px] flex-col items-center justify-center gap-2 p-8 text-fd-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-fd-primary" />
            <span className="text-xs">Initializing sandbox...</span>
          </div>
        ) : view === 'preview' ? (
          // Live Preview Frame
          <div className="flex w-full flex-1 items-start justify-center p-4">
            <div
              className={`w-full ${viewportWidthStyle} transition-all duration-200 ease-out`}
            >
              <div className="overflow-hidden rounded-lg border border-fd-border/80 bg-white text-slate-900 shadow-sm dark:border-fd-border">
                <DynamicKubuildRenderer
                  document={activeDoc}
                  viewport={viewport}
                  responsive={viewport === 'desktop' ? 'css' : 'viewport'}
                  registry={activeRegistry}
                  context={activeContext}
                />
              </div>
            </div>
          </div>
        ) : (
          // JSON Schema View
          <div className="flex-1 overflow-auto bg-fd-background/90 p-4 font-mono text-xs leading-relaxed text-fd-foreground">
            <pre className="m-0 whitespace-pre font-mono">
              <code dangerouslySetInnerHTML={{ __html: highlightedJsonHtml }} />
            </pre>
          </div>
        )}

        {/* Live Tracking Event Emulator Console Panel */}
        {mounted && view === 'preview' && isTrackingEmulatorActive && (
          <div className="border-t border-fd-border bg-slate-950 text-slate-100 p-3 sm:p-4 font-sans">
            {/* Header with status & clear */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <span>Tracking Event Emulator</span>
                  <span className="hidden sm:inline-block text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Live Interceptor & CAPI Relay
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">
                  Total Events: <strong className="text-white">{trackingLogs.length}</strong>
                </span>
                {trackingLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTrackingLogs([])}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Clear tracking logs"
                  >
                    <Trash2 className="h-3 w-3 text-rose-400" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Provider Filter Tabs */}
            <div className="flex items-center gap-1.5 pt-2.5 pb-2 overflow-x-auto text-[11px]">
              {[
                { id: 'all', label: 'All Events', count: trackingLogs.length },
                { id: 'meta', label: 'Meta Pixel', count: trackingLogs.filter((l) => l.provider === 'meta').length },
                { id: 'google', label: 'Google GA4', count: trackingLogs.filter((l) => l.provider === 'google').length },
                { id: 'tiktok', label: 'TikTok Pixel', count: trackingLogs.filter((l) => l.provider === 'tiktok').length },
                { id: 'gtm', label: 'GTM dataLayer', count: trackingLogs.filter((l) => l.provider === 'gtm').length },
                { id: 'server', label: 'Server CAPI Relay', count: trackingLogs.filter((l) => l.provider === 'server').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTrackingFilter(tab.id)}
                  className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors ${
                    trackingFilter === tab.id
                      ? 'bg-sky-600 text-white font-medium'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {tab.label} <span className="opacity-70 text-[10px]">({tab.count})</span>
                </button>
              ))}
            </div>

            {/* Event Log Items */}
            <div className="space-y-2 max-h-[260px] overflow-y-auto pt-1 font-mono text-xs pr-1">
              {filteredLogs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-slate-400 text-xs font-sans">
                  <p className="font-medium text-slate-300 mb-1">Belum ada event tracking yang tertembak.</p>
                  <p className="text-[11px] text-slate-500">
                    Klik tombol <strong className="text-sky-400">Beli Sekarang (AddToCart)</strong> atau submit formulir{' '}
                    <strong className="text-emerald-400">Daftar Webinar (Lead)</strong> di canvas preview untuk melihat log event!
                  </p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const providerColors: Record<string, { bg: string; text: string; border: string }> = {
                    meta: { bg: 'bg-blue-950/60', text: 'text-blue-400', border: 'border-blue-800/60' },
                    google: { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-800/60' },
                    tiktok: { bg: 'bg-pink-950/60', text: 'text-pink-400', border: 'border-pink-800/60' },
                    gtm: { bg: 'bg-teal-950/60', text: 'text-teal-400', border: 'border-teal-800/60' },
                    server: { bg: 'bg-purple-950/60', text: 'text-purple-300', border: 'border-purple-800/60' },
                  };
                  const color = providerColors[log.provider] || { bg: 'bg-slate-900', text: 'text-slate-300', border: 'border-slate-800' };

                  return (
                    <div
                      key={log.id}
                      className={`rounded-lg border ${color.border} ${color.bg} p-2.5 transition-all text-xs`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-sans">{log.timestamp}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${color.border} ${color.text}`}>
                            {log.provider === 'server' ? 'Server CAPI' : log.provider}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400 font-semibold text-[11px]">
                            {log.eventName}
                          </span>
                          {log.channel === 'server' ? (
                            <span className="px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 text-[10px] border border-purple-700/50">
                              Server Relay
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px]">
                              Browser Pixel
                            </span>
                          )}
                          {log.pixelId && (
                            <span className="text-[10px] text-slate-400 font-sans">
                              (id: {log.pixelId})
                            </span>
                          )}
                        </div>

                        {log.eventId && (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 rounded">
                            <span className="text-slate-400">event_id:</span>
                            <span className="font-mono font-bold truncate max-w-[140px]" title={log.eventId}>
                              {log.eventId}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Snippet */}
                      <div className="flex items-center justify-between gap-2 bg-slate-900/90 rounded p-1.5 text-[11px] text-slate-200 border border-slate-800/80">
                        <code className="truncate flex-1" title={log.callSnippet}>
                          {log.callSnippet}
                        </code>
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="text-[10px] text-slate-400 hover:text-slate-200 underline whitespace-nowrap ml-1 cursor-pointer"
                        >
                          {isExpanded ? 'Hide Payload' : 'View Payload'}
                        </button>
                      </div>

                      {/* Expandable Payload */}
                      {isExpanded && (
                        <div className="mt-2 p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                          <pre className="overflow-x-auto whitespace-pre font-mono m-0 text-[10px]">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-fd-border bg-fd-muted/30 px-3 py-1.5 text-[11px] text-fd-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span>Portable Stora Schema v1.3.0</span>
        </div>
        <div>
          <span>{view === 'preview' ? `Viewport: ${viewport}` : 'Raw JSON AST'}</span>
        </div>
      </div>
    </div>
  );
}

// Alias for flexibility in MDX documentation
export const InteractiveSandbox = InteractiveRenderer;
