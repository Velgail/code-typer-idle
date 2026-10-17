// Fixed endpoint is always revalidated; executable assets have content-specific URLs.
export function watchForUpdates({ build, prepare, failed }) {
  const banner = document.getElementById('update-banner');
  const button = document.getElementById('update-button');
  let nextBuild, checking = false;
  async function check() {
    if (checking || document.hidden) return;
    checking = true;
    try {
      const response = await fetch(new URL('./version.json', document.baseURI), { cache: 'no-store' });
      if (!response.ok) return;
      const release = await response.json();
      if (/^[a-f0-9]{16}$/.test(release.id) && release.id !== build) {
        nextBuild = release.id;
        document.getElementById('update-message').textContent = `新しいバージョン（${release.version}）を利用できます。`;
        banner.classList.remove('hidden');
      }
    } catch { /* Offline play continues without hiding or resetting the save. */ }
    finally { checking = false; }
  }
  button.addEventListener('click', () => {
    if (!nextBuild || !prepare()) { failed(); return; }
    const url = new URL(location.href);
    url.searchParams.set('v', nextBuild);
    location.replace(url);
  });
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  setInterval(check, 60000);
  check();
}
