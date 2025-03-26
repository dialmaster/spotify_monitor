const Toast = (() => {
  // Create toast notification container
  let toastContainerEl = null;
  // Track displayed messages to prevent duplicates
  const displayedToasts = new Set();

  const initialize = () => {
    // Create toast container
    toastContainerEl = document.createElement('div');
    toastContainerEl.id = 'toast-container';
    document.body.appendChild(toastContainerEl);

    return {
      showToast
    };
  };

  // Function to show toast notification
  const showToast = (message, duration = 15000) => {
    // Check if the same message is already being displayed
    if (displayedToasts.has(message)) {
      return; // Skip duplicate toast
    }

    // Add to displayed messages set
    displayedToasts.add(message);

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;

    // Add to container
    toastContainerEl.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Remove after duration
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');

      // Remove from DOM after animation completes
      setTimeout(() => {
        toast.remove();
        // Remove from set of displayed messages
        displayedToasts.delete(message);
      }, 500);
    }, duration);
  };

  return {
    initialize
  };
})();