{
  try {
    const saved = localStorage.getItem('goo-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  } catch { /* storage blocked: fall back to the system scheme */ }
}