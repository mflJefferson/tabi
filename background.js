// Color palette for Firefox Tab Groups
const COLORS = ["blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];

const COMMON_TLDS = [
  'com', 'net', 'org', 'info', 'biz', // Generic
  'us', 'uk', 'de', 'cn', 'jp', 'ca', 'fr', 'au', 'br', 'kr', // Country Code
  'io', 'ai', 'co', 'me', 'tv', // Tech/Startup Favorites
  'app', 'dev', 'tech', 'shop', 'online' // New gTLDs
];

const isCommonTLD = (tld) => {
  if (typeof tld !== 'string') return false;
  
  // Remove leading dot and convert to lowercase for comparison
  const cleanTLD = tld.startsWith('.') ? tld.slice(1).toLowerCase() : tld.toLowerCase();
  
  return COMMON_TLDS.includes(cleanTLD);
};

/**
 * Main Message Listener
 */
browser.runtime.onMessage.addListener(async (message) => {
  switch (message.action) {
    case "sortGroups":
      sortGroupsAlphabetically();
      break;
    case "sortTabs":
      sortTabsInsideGroups();
    case "collapseAll":
    case "expandAll":
      await toggleAllGroups(message.state);
      break;
    case "groupAll":
      await groupAllExistingTabs();
      break;
    default:
      console.warn("Unknown action:", message.action);
  }
});

/**
 * Alphabetically sorts tabs inside a specific group.
 */
async function sortTabsInGroup(groupId) {
  const tabsInGroup = await browser.tabs.query({ groupId: groupId });
  
  // Sort by title (case-insensitive)
  tabsInGroup.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));

  // Find the leftmost index of the group to maintain its relative position
  const baseIndex = Math.min(...tabsInGroup.map(t => t.index));

  // Move tabs sequentially to their new sorted positions
  for (let i = 0; i < tabsInGroup.length; i++) {
    await browser.tabs.move(tabsInGroup[i].id, { index: baseIndex + i });
  }
}

/**
 * Collapses or expands every group in the current window.
 */
async function toggleAllGroups(shouldCollapse) {
  const groups = await browser.tabGroups.query({ windowId: browser.windows.WINDOW_ID_CURRENT });
  
  for (const group of groups) {
    await browser.tabGroups.update(group.id, { collapsed: shouldCollapse });
  }
}

browser.tabs.onCreated.addListener(async (tab) => {
  // New tabs often start as 'about:blank' or 'about:newtab'
  if (!tab.url || tab.url === "about:blank" || tab.url === "about:newtab") {
    await addToSystemGroup(tab.id, tab.windowId);
  }
});

async function addToSystemGroup(tabId, windowId) {
  const groups = await browser.tabGroups.query({ windowId: windowId, title: "System" });
  if (groups.length > 0) {
    await browser.tabs.group({ tabIds: tabId, groupId: groups[0].id });
  } else {
    const groupId = await browser.tabs.group({ tabIds: tabId });
    await browser.tabGroups.update(groupId, { title: "System", color: "grey" });
  }
}

/**
 * Automation: Watch for URL changes to auto-group new tabs
 */
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only trigger if the URL has finished loading and the tab isn't pinned
  if (changeInfo.url && !tab.pinned) {
    try {
      const url = new URL(changeInfo.url);
      let targetTitle = url.hostname;
      let targetColor = COLORS[Math.floor(Math.random() * COLORS.length)];

      // --- START SYSTEM GROUP LOGIC ---
      // Check for internal Firefox pages or Mozilla domains
      if (url.protocol === "about:") {
        targetTitle = "System";
      } else {
        const parts = url.hostname.split('.');
        let rawTitle;
        if (parts.length >= 2) {
          const isUrlCommonTLD = isCommonTLD(parts[parts.length - 2]);
          rawTitle = isUrlCommonTLD ? parts[parts.length - 3] : parts[parts.length - 2];
        } else {
          rawTitle = url.hostname
        }
        targetTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1).toLowerCase();
      }
      // --- END SYSTEM GROUP LOGIC ---

      // Check if a group for this title already exists
      const groups = await browser.tabGroups.query({ 
        windowId: tab.windowId, 
        title: targetTitle 
      });

      if (groups.length > 0) {
        // Add to the existing group
        const groupId = groups[0].id;
        await browser.tabs.group({ tabIds: tabId, groupId: groupId });
      } else {
        // Create a brand new group for this title
        const groupId = await browser.tabs.group({ tabIds: tabId });
        await browser.tabGroups.update(groupId, {
          title: targetTitle,
          color: targetColor
        });
        await browser.tabGroups.move(groupId, { index: -1 });
      }
    } catch (e) {
      console.error(e);
    }
  }
}, { properties: ["url"] });

async function groupAllExistingTabs() {
  const tabs = await browser.tabs.query({ currentWindow: true, pinned: false });
  const domainMap = new Map();

  tabs.forEach(tab => {
    try {
      const url = new URL(tab.url);
      let targetTitle = url.hostname;

      if (url.protocol === "about:") {
        targetTitle = "System";
      } else {
        const parts = url.hostname.split('.');
        let rawTitle;
        if (parts.length >= 2) {
          const isUrlCommonTLD = isCommonTLD(parts[parts.length - 2]);
          rawTitle = isUrlCommonTLD ? parts[parts.length - 3] : parts[parts.length - 2];
        } else {
          rawTitle = url.hostname
        }
        targetTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1).toLowerCase();
      }

      if (!domainMap.has(targetTitle)) {
        domainMap.set(targetTitle, []);
      }
      domainMap.get(targetTitle).push(tab.id);
    } catch (e) {
      console.error(`Skipping invalid URL: ${tab.url}`, e);
    }
  });

  // Processing
  for (const [title, tabIds] of domainMap.entries()) {
    // Check if a group with this title already exists in the window
    const existingGroups = await browser.tabGroups.query({ 
      windowId: browser.windows.WINDOW_ID_CURRENT, 
      title: title 
    });

    if (existingGroups.length > 0) {
      // Add existing tabs to the existing group
      await browser.tabs.group({ 
        tabIds: tabIds, 
        groupId: existingGroups[0].id 
      });
    } else {
      // Create a new group for these tabs
      const groupId = await browser.tabs.group({ tabIds: tabIds });
      await browser.tabGroups.update(groupId, {
        title: title,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      });
    }
  }
}

/**
 * Sorts individual tabs within each group by their page title
 */
async function sortTabsInsideGroups() {
  const groups = await browser.tabGroups.query({ windowId: browser.windows.WINDOW_ID_CURRENT });

  for (const group of groups) {
    const tabs = await browser.tabs.query({ groupId: group.id });
    const groupStartBoundary = tabs[0].index;
    
    // Sort tabs based on title
    tabs.sort((a, b) => a.title.localeCompare(b.title));
    
    const tabIds = tabs.map(t => t.id);
    browser.tabs.move(tabIds, { index: groupStartBoundary});
  }
}

/**
 * Sorts the groups themselves based on their titles (A-Z)
 */
async function sortGroupsAlphabetically() {
  const groups = await browser.tabGroups.query({ windowId: browser.windows.WINDOW_ID_CURRENT });
  
  // Sort the array of group objects
  groups.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  // Move them one by one to the end to reorder the strip
  for (const group of groups) {
    await browser.tabGroups.move(group.id, { index: -1 });
  }
}
