// Migration entry for HTML cached before releases used fingerprinted assets.
// Keep legacy dependency URLs intact so an already-cached old app stays coherent.
try {
  const response = await fetch(new URL('../version.json', import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error('Version unavailable');
  const release = await response.json();
  if (!/^[a-f0-9]{16}$/.test(release.id)) throw new Error('Invalid version');
  const target = new URL(location.href);
  target.searchParams.set('v', release.id);
  location.replace(target);
} catch {
  const notice = document.createElement('p');
  notice.textContent = '更新データを取得できませんでした。通信を確認して再読み込みしてください。保存済みの進行は保持されています。';
  document.body.prepend(notice);
}
