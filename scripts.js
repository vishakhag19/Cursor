(function () {
  const header = document.querySelector("[data-header]");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const navMenu = document.querySelector("[data-nav-menu]");
  const promptText = document.querySelector("[data-prompt-text]");
  const promptButton = document.querySelector("[data-prompt-button]");

  const setHeaderState = () => {
    if (!header) {
      return;
    }

    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };

  const closeMenu = () => {
    if (!navToggle || !navMenu) {
      return;
    }

    navToggle.setAttribute("aria-expanded", "false");
    navMenu.classList.remove("is-open");
    document.body.classList.remove("nav-open");
  };

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!isOpen));
      navMenu.classList.toggle("is-open", !isOpen);
      document.body.classList.toggle("nav-open", !isOpen);
    });

    navMenu.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    });
  }

  const prompts = [
    "Redesign an error state as if it were a helpful museum guide.",
    "Turn a password reset flow into a three-panel comic strip.",
    "Sketch a loading state that teaches users what is happening behind the curtain.",
    "Rewrite an empty state for someone who is tired, rushed, and on mobile.",
    "Design a settings page using only verbs, not nouns.",
    "Invent a celebration moment that feels calm instead of loud.",
    "Map a checkout flow as a recipe card with ingredients and timing.",
    "Prototype a dashboard for a houseplant that wants fewer notifications."
  ];

  if (promptButton && promptText) {
    promptButton.addEventListener("click", () => {
      const currentPrompt = promptText.textContent ? promptText.textContent.trim() : "";
      const availablePrompts = prompts.filter((prompt) => prompt !== currentPrompt);
      const nextPrompt =
        availablePrompts[Math.floor(Math.random() * availablePrompts.length)] || prompts[0];

      promptText.textContent = nextPrompt;
    });
  }

  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });
})();
