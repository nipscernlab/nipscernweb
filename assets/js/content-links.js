function toToken(value) {
  return String(value || '').trim();
}

export function publicationKey(pub) {
  return toToken(pub && (pub.id || pub.slug));
}

export function publicationUrl(pub) {
  const key = publicationKey(pub);
  return key ? '/pdf-viewer.html?id=' + encodeURIComponent(key) : '';
}

export function newsKey(post) {
  return toToken(post && (post.slug || post.id));
}

/* A post's own page, news/<slug>, drawn at build time by tools/build-news.js.
   The prefix says where the news folder is from the calling page: 'news/post'
   or 'news/post.html' from the root, nothing from inside news/. */
export function newsPostUrl(post, prefix) {
  const key = newsKey(post);
  const base = (prefix || 'post.html').replace(/post(\.html)?$/, '');
  return key ? base + encodeURIComponent(key) : (prefix || 'post.html');
}
