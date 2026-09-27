import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { siteConfig } from './src/config/site.config'

// Injecte les balises SEO (titre, description, Open Graph, données
// structurées) directement à partir de src/config/site.config.ts, pour que
// ce fichier reste le seul à modifier lors du clonage du site pour une
// autre école (voir le commentaire en tête de site.config.ts).
function seoHtmlPlugin(): Plugin {
  const escapeAttr = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  return {
    name: 'seo-html-from-site-config',
    transformIndexHtml(html) {
      const title = `${siteConfig.schoolName} — ${siteConfig.tagline}`
      const description = siteConfig.hero.description
      const url = siteConfig.siteUrl
      const logo = siteConfig.logoUrl.startsWith('http')
        ? siteConfig.logoUrl
        : `${url}/Images/RezoCampus.png`

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'EducationalOrganization',
        name: siteConfig.schoolName,
        description,
        url,
        logo,
        email: siteConfig.contact.email,
        telephone: siteConfig.contact.phone,
        address: {
          '@type': 'PostalAddress',
          streetAddress: siteConfig.contact.addressLines.join(', '),
        },
      }

      const seoTags = `
    <title>${escapeAttr(title)}</title>
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${url}/" />
    <meta name="theme-color" content="#2563eb" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeAttr(siteConfig.schoolName)}" />
    <meta property="og:locale" content="fr_FR" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${url}/" />
    <meta property="og:image" content="${logo}" />

    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${logo}" />

    <link rel="icon" type="image/png" href="/Images/RezoCampus.png" />

    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  `

      return html.replace('<!--SEO_HEAD-->', seoTags)
    },
    generateBundle() {
      const url = siteConfig.siteUrl
      const publicPaths = ['/', '/contact', '/confidentialite']
      const today = new Date().toISOString().slice(0, 10)

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${url}/sitemap.xml\n`,
      })

      const urlEntries = publicPaths
        .map((p) => `  <url>\n    <loc>${url}${p}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
        .join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`,
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), seoHtmlPlugin()],
  server: {
    port: 8080
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
