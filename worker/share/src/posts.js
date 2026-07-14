// ---------------------------------------------------------------------------
// Post resolution — pure helpers shared by the Worker and the local preview.
// Works for both regular posts (data/news.json) and the featured story
// (data/news-featured.json). English is the top-level content; other languages
// live under `translations[lang]`.
// ---------------------------------------------------------------------------

const MONTHS = {
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  pt: ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],
};

/** Format an ISO date as "10 Jul 2026" / "10 jul 2026". */
export function formatDateLabel(iso, lang = 'en') {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const mm = (MONTHS[lang] || MONTHS.en)[d.getUTCMonth()];
  return `${d.getUTCDate()} ${mm} ${d.getUTCFullYear()}`;
}

/** True when the post is the featured-story shape. */
function isFeatured(post) {
  return !!(post && post.featured) || !!(post && post.translations && post.translations.en && post.translations.en.content_html);
}

/** Headline for a post in the requested language, with sensible fallbacks. */
export function titleFor(post, lang = 'en') {
  if (!post) return '';
  if (isFeatured(post)) {
    const tr = post.translations || {};
    const t = tr[lang] || tr.en || tr.pt || Object.values(tr)[0] || {};
    return t.title || post.title || '';
  }
  if (lang === 'en') return post.title || '';
  const t = (post.translations && post.translations[lang]) || {};
  return t.title || post.title || '';
}

/** Which languages actually have a headline for this post (always includes en). */
export function availableLangs(post) {
  const langs = ['en'];
  const tr = (post && post.translations) || {};
  for (const l of Object.keys(tr)) {
    if (l !== 'en' && (tr[l].title || tr[l].subtitle)) langs.push(l);
  }
  return langs;
}

/** Resolve everything the template needs for a given post + language. */
export function resolveShareMeta(post, lang = 'en') {
  return {
    slug: (post && (post.slug || post.id)) || '',
    title: titleFor(post, lang),
    category: (post && post.category) || 'news',
    dateLabel: formatDateLabel(post && post.date, lang),
    coverUrl: (post && post.image) || null,
    lang,
  };
}

/** Find a post by slug or id across the regular feed and the featured story. */
export function findPost(newsData, featured, slug) {
  if (featured && (featured.slug === slug || featured.id === slug)) return featured;
  return (newsData || []).find(p => p.slug === slug || p.id === slug) || null;
}
