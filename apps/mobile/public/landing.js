document.addEventListener("DOMContentLoaded", () => {
  const demoLabels = /try live demo|start my rescue map|photograph your working|try the interactive demo/i;
  document.querySelectorAll("button").forEach((button) => {
    if (demoLabels.test(button.textContent || "")) {
      button.addEventListener("click", () => { window.location.assign("/demo"); });
    }
  });
});
