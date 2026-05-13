function getDirectChild(parent, selectors) {
  return Array.from(parent.children).find((child) => child.matches(selectors)) || null;
}

function normalizeSidebar(sidebar) {
  const shell =
    getDirectChild(sidebar, ".sidebar-shell, .subpage-rail-card, .writing-rail-inner") ||
    sidebar.firstElementChild;

  if (!shell) {
    return;
  }

  shell.classList.add("sidebar-shell");

  const header =
    getDirectChild(shell, ".sidebar-header, .subpage-rail-head, .writing-rail-head") ||
    shell.querySelector(":scope > .subpage-rail-head, :scope > .writing-rail-head");

  if (!header) {
    return;
  }

  header.classList.add("sidebar-header");

  const kicker = header.querySelector(":scope > .section-label");
  if (kicker) {
    kicker.classList.add("sidebar-kicker");
  }

  const titleLink = header.querySelector(":scope > a");
  if (titleLink) {
    titleLink.classList.add("sidebar-title-link");
  }

  const title = header.querySelector(":scope > h1, :scope > h2, :scope > a > h1, :scope > a > h2");
  if (title) {
    title.classList.add("sidebar-title");
  }

  const description = Array.from(header.children).find(
    (child) =>
      child.tagName === "P" &&
      !child.classList.contains("section-label")
  );
  if (description) {
    description.classList.add("sidebar-description");
  }

  let divider = getDirectChild(shell, ".sidebar-divider");
  if (!divider) {
    divider = document.createElement("div");
    divider.className = "sidebar-divider";
    header.insertAdjacentElement("afterend", divider);
  }

  let body = getDirectChild(shell, ".sidebar-body");
  if (!body) {
    body = document.createElement("div");
    body.className = "sidebar-body";

    let current = divider.nextSibling;
    while (current) {
      const next = current.nextSibling;
      if (current.nodeType === Node.ELEMENT_NODE) {
        body.appendChild(current);
      } else if (current.nodeType === Node.TEXT_NODE && current.textContent.trim()) {
        const wrapper = document.createElement("div");
        wrapper.textContent = current.textContent;
        body.appendChild(wrapper);
        current.remove();
      }
      current = next;
    }

    shell.appendChild(body);
  }

  Array.from(body.children).forEach((section) => {
    section.classList.add("sidebar-section");

    if (
      section.matches(".notes-view-switch, .writing-category-nav, .visual-filter, .subpage-side-list, .subpage-side-chip-row")
    ) {
      section.classList.add("sidebar-action-group");
    }

    section
      .querySelectorAll(":scope > a, :scope > button, :scope > span")
      .forEach((action) => action.classList.add("sidebar-action"));
  });
}

export function initSidebarSystem() {
  document.querySelectorAll(".subpage-sidebar-left").forEach(normalizeSidebar);
}
