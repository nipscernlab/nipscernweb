function toToken(value) {
  return String(value || '').trim();
}

export function publicationKey(pub) {
  return toToken(pub && (pub.id || pub.slug));
}

export function publicationUrl(pub) {
  const key = publicationKey(pub);
  return key ? '/pdf-viewer?id=' + encodeURIComponent(key) : '';
}

export function newsKey(post) {
  return toToken(post && (post.slug || post.id));
}

export function newsPostUrl(post, prefix) {
  const key = newsKey(post);
  const base = prefix || 'post';
  return key ? base + '?id=' + encodeURIComponent(key) : base;
}
