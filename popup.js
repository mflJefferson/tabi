document.getElementById('collapseAll').onclick = () => chrome.runtime.sendMessage({action: "collapseAll", state: true});
document.getElementById('expandAll').onclick = () => chrome.runtime.sendMessage({action: "expandAll", state: false});
document.getElementById('sortGroups').onclick = () => chrome.runtime.sendMessage({action: "sortGroups"});
document.getElementById('sortTabs').onclick = () => chrome.runtime.sendMessage({action: "sortTabs"});
document.getElementById('groupAll').onclick = () => chrome.runtime.sendMessage({action: "groupAll"});