const UserProfile = (() => {
  let elements = null;

  const initialize = (elementRefs) => {
    elements = elementRefs;

    return {
      fetchUserProfile
    };
  };

  // Fetch user profile information
  async function fetchUserProfile() {
    try {
      const response = await fetch('/api/user-profile');

      if (!response.ok) {
        console.error('Failed to fetch user profile:', response.status);
        return;
      }

      const userData = await response.json();

      if (userData.display_name || userData.email) {
        if (userData.display_name) {
          elements.userDisplayNameEl.textContent = userData.display_name;
        }

        if (userData.email) {
          elements.userEmailEl.textContent = userData.email;
        }

        elements.userInfoContainerEl.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }

  return {
    initialize
  };
})();