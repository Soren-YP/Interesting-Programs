async function postJson(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `本地服务请求失败（${response.status}）。`);
  }
  return data;
}

export function fetchMetadata(url) {
  return postJson('/api/metadata', { url });
}

export async function checkLinks(urls, onProgress) {
  const unique = [...new Set(urls)];
  const results = [];
  for (let index = 0; index < unique.length; index += 50) {
    const batch = unique.slice(index, index + 50);
    const data = await postJson('/api/check-links', { urls: batch });
    results.push(...data.results);
    onProgress?.(Math.min(index + batch.length, unique.length), unique.length);
  }
  return results;
}
