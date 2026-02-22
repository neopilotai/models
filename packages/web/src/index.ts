const modal = document.getElementById("modal") as HTMLDialogElement;
const modalClose = document.getElementById("close")!;
const help = document.getElementById("help")!;
const search = document.getElementById("search")! as HTMLInputElement;

/////////////////////////
// URL State Management
/////////////////////////
function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

function updateQueryParams(updates: Record<string, string | null>) {
  const params = getQueryParams();
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }
  const newPath = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.pushState({}, "", newPath);
}

function getColumnNameForURL(headerEl: Element): string {
  const text = headerEl.textContent?.trim().toLowerCase() || "";
  return text.replace(/↑|↓/g, "").trim().split(/\s+/).slice(0, 2).join("-");
}

function getColumnIndexByUrlName(name: string): number {
  const headers = document.querySelectorAll("th.sortable");
  return Array.from(headers).findIndex(
    (header) => getColumnNameForURL(header) === name
  );
}

/////////////////////////
// Handle "How to use"
/////////////////////////
let y = 0;

help.addEventListener("click", () => {
  y = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${y}px`;
  modal.showModal();
});

function closeDialog() {
  modal.close();
  document.body.style.position = "";
  document.body.style.top = "";
  window.scrollTo(0, y);
}

modalClose.addEventListener("click", closeDialog);
modal.addEventListener("cancel", closeDialog);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeDialog();
});

////////////////////
// Handle Sorting
////////////////////
let currentSort = { column: -1, direction: "asc" };

function sortTable(column: number, direction: "asc" | "desc") {
  const header = document.querySelectorAll("th.sortable")[column];
  const columnType = header.getAttribute("data-type");
  if (!columnType) return;

  // update state
  currentSort = { column, direction };
  updateQueryParams({
    sort: getColumnNameForURL(header),
    order: direction,
  });

  // sort rows
  const tbody = document.querySelector("table tbody")!;
  const rows = Array.from(
    tbody.querySelectorAll("tr")
  ) as HTMLTableRowElement[];
  rows.sort((a, b) => {
    const aValue = getCellValue(a.cells[column], columnType);
    const bValue = getCellValue(b.cells[column], columnType);

    // Handle undefined values - always sort to bottom
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;

    let comparison = 0;
    if (columnType === "number" || columnType === "modalities") {
      comparison = (aValue as number) - (bValue as number);
    } else if (columnType === "boolean") {
      comparison = (aValue as string).localeCompare(bValue as string);
    } else {
      comparison = (aValue as string).localeCompare(bValue as string);
    }

    return direction === "asc" ? comparison : -comparison;
  });
  rows.forEach((row) => tbody.appendChild(row));

  // update sort indicators with animation
  const headers = document.querySelectorAll("th.sortable");
  headers.forEach((header, i) => {
    const indicator = header.querySelector(".sort-indicator")!;

    if (i === column) {
      indicator.textContent = direction === "asc" ? "↑" : "↓";
      // Add subtle animation
      indicator.style.opacity = "0";
      setTimeout(() => {
        indicator.style.transition = "opacity 0.2s ease";
        indicator.style.opacity = "1";
      }, 0);
    } else {
      indicator.style.transition = "opacity 0.2s ease";
      indicator.style.opacity = "0";
      setTimeout(() => {
        indicator.textContent = "";
      }, 200);
    }
  });
}

function getCellValue(
  cell: HTMLTableCellElement,
  type: string
): string | number | undefined {
  if (type === "modalities")
    return cell.querySelectorAll(".modality-icon").length;

  const text = cell.textContent?.trim() || "";
  if (text === "-") return;
  if (type === "number") return parseFloat(text.replace(/[$,]/g, "")) || 0;
  return text;
}

document.querySelectorAll("th.sortable").forEach((header) => {
  header.addEventListener("click", () => {
    const column = Array.from(header.parentElement!.children).indexOf(header);
    const direction =
      currentSort.column === column && currentSort.direction === "asc"
        ? "desc"
        : "asc";
    sortTable(column, direction);
  });
});

///////////////////
// Handle Search
///////////////////
function filterTable(value: string) {
  const lowerCaseValues = value.toLowerCase().split(",").filter(str => str.trim() !== "");
  const rows = document.querySelectorAll(
    "table tbody tr"
  ) as NodeListOf<HTMLTableRowElement>;

  let visibleCount = 0;

  rows.forEach((row) => {
    const cellTexts = Array.from(row.cells).map((cell) =>
      cell.textContent!.toLowerCase()
    );
    const isVisible = lowerCaseValues.length === 0 ||
      lowerCaseValues.some((lowerCaseValue) => cellTexts.some((text) => text.includes(lowerCaseValue)));
    
    if (isVisible) {
      visibleCount++;
      row.style.display = "";
      row.style.opacity = "1";
      row.style.transition = "opacity 0.2s ease";
    } else {
      row.style.transition = "opacity 0.15s ease";
      row.style.opacity = "0.3";
      row.style.pointerEvents = "none";
      setTimeout(() => {
        if (row.style.opacity === "0.3") {
          row.style.display = "none";
        }
      }, 150);
    }
  });

  updateQueryParams({ search: value || null });
}

// Search input with keyboard shortcuts
search.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    search.value = "";
    filterTable("");
  }
});

search.addEventListener("input", (e) => {
  filterTable((e.target as HTMLInputElement).value);
});

search.addEventListener("input", () => {
  filterTable(search.value);
});

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    search.focus();
  }
});

search.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    search.value = "";
    search.dispatchEvent(new Event("input"));
  }
});

///////////////////////////////////
// Handle Copy model ID function
///////////////////////////////////
(window as any).copyModelId = async (
  button: HTMLButtonElement,
  modelId: string
) => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(modelId);

      // Add visual feedback
      button.classList.add("copied");

      // Switch to check icon
      const copyIcon = button.querySelector(".copy-icon") as HTMLElement;
      const checkIcon = button.querySelector(".check-icon") as HTMLElement;

      copyIcon.style.display = "none";
      checkIcon.style.display = "block";

      // Switch back after 2 seconds
      setTimeout(() => {
        copyIcon.style.display = "block";
        checkIcon.style.display = "none";
        button.classList.remove("copied");
      }, 2000);
    }
  } catch (err) {
    console.error("Failed to copy text: ", err);
  }
};

///////////////////////////////////
// Handle Model Details Drawer
///////////////////////////////////
const drawer = document.getElementById("drawer") as HTMLElement;
const drawerTitle = document.getElementById("drawer-title") as HTMLElement;
const drawerContent = document.getElementById("drawer-content") as HTMLElement;
let lastSelectedRow: HTMLTableRowElement | null = null;

(window as any).openDrawer = (modelId: string, providerId: string, modelName: string) => {
  drawerTitle.textContent = modelName;
  
  // Find the model data from table
  const rows = document.querySelectorAll("table tbody tr");
  let modelRow: HTMLTableRowElement | null = null;
  
  rows.forEach((row) => {
    const cells = row.cells;
    if (cells[4].textContent?.trim() === modelId) {
      modelRow = row as HTMLTableRowElement;
    }
  });

  // Update selection state
  if (lastSelectedRow && lastSelectedRow !== modelRow) {
    lastSelectedRow.classList.remove("selected");
  }
  if (modelRow) {
    modelRow.classList.add("selected");
    lastSelectedRow = modelRow;
  }

  if (modelRow) {
    const cells = modelRow.cells;
    const provider = cells[0].textContent?.trim() || "Unknown";
    const family = cells[2].textContent?.trim() || "-";
    const toolCall = cells[5].textContent?.trim() === "Yes";
    const reasoning = cells[6].textContent?.trim() === "Yes";
    const inputCost = cells[8].textContent?.trim() || "-";
    const outputCost = cells[9].textContent?.trim() || "-";
    const contextLimit = cells[15].textContent?.trim() || "-";
    const structuredOutput = cells[19].textContent?.trim() || "-";
    const openWeights = cells[21].textContent?.trim() || "-";
    const releaseDate = cells[23].textContent?.trim() || "-";

    drawerContent.innerHTML = `
      <div class="drawer-section">
        <div class="drawer-section-title">Provider</div>
        <div class="drawer-section-content">
          <p>${provider}</p>
        </div>
      </div>

      ${family !== "-" ? `<div class="drawer-section">
        <div class="drawer-section-title">Family</div>
        <div class="drawer-section-content">
          <p>${family}</p>
        </div>
      </div>` : ''}

      <div class="drawer-section">
        <div class="drawer-section-title">Capabilities</div>
        <div class="drawer-section-content" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${toolCall ? '<span class="capability-badge tool-call">✓ Tool Calling</span>' : ''}
          ${reasoning ? '<span class="capability-badge reasoning">✓ Reasoning</span>' : ''}
          <span class="capability-badge vision">✓ Vision</span>
          <span class="capability-badge audio">✓ Audio</span>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Pricing (per 1M tokens)</div>
        <div class="drawer-section-content">
          <p><span style="color: var(--color-text-tertiary);">Input:</span> <strong>${inputCost}</strong></p>
          <p><span style="color: var(--color-text-tertiary);">Output:</span> <strong>${outputCost}</strong></p>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Specifications</div>
        <div class="drawer-section-content">
          <p><span style="color: var(--color-text-tertiary);">Context:</span> <strong>${contextLimit}</strong></p>
          <p><span style="color: var(--color-text-tertiary);">Structured Output:</span> <strong>${structuredOutput}</strong></p>
          <p><span style="color: var(--color-text-tertiary);">Open Weights:</span> <strong>${openWeights}</strong></p>
          ${releaseDate !== "-" ? `<p><span style="color: var(--color-text-tertiary);">Released:</span> <strong>${releaseDate}</strong></p>` : ''}
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-code-block">import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const message = await client.messages.create({
  model: "${modelId}",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Hello, world!" },
  ],
});
        </div>
      </div>

      <div class="drawer-section" style="display: flex; flex-direction: column; gap: 0.5rem;">
        <button onclick="copyModelId(null, '${modelId}')" class="drawer-button-group" style="margin: 0;">
          <button class="primary" style="width: 100%;">Copy Model ID</button>
        </button>
      </div>
    `;
  }

  // Animate drawer open
  drawer.classList.add("active");
};

(window as any).closeDrawer = () => {
  drawer.classList.remove("active");
  drawerContent.innerHTML = '<p>Select a model to view details</p>';
  
  // Clear selection
  if (lastSelectedRow) {
    lastSelectedRow.classList.remove("selected");
    lastSelectedRow = null;
  }
};

///////////////////////////////////
// Handle Sidebar Filters
///////////////////////////////////
const filterCheckboxes = document.querySelectorAll(".filter-item input[type='checkbox']");
const activeFilters = {
  toolCall: false,
  reasoning: false,
  vision: false,
  audio: false,
  free: false,
};

filterCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    // Update active filters
    if (checkbox.id === "filter-tool-call") activeFilters.toolCall = (checkbox as HTMLInputElement).checked;
    if (checkbox.id === "filter-reasoning") activeFilters.reasoning = (checkbox as HTMLInputElement).checked;
    if (checkbox.id === "filter-vision") activeFilters.vision = (checkbox as HTMLInputElement).checked;
    if (checkbox.id === "filter-audio") activeFilters.audio = (checkbox as HTMLInputElement).checked;
    if (checkbox.id === "filter-free") activeFilters.free = (checkbox as HTMLInputElement).checked;

    // Apply filters to table
    applyFilters();
  });
});

function applyFilters() {
  const rows = document.querySelectorAll("table tbody tr");
  
  rows.forEach((row) => {
    const cells = row.cells;
    const toolCall = cells[5].textContent?.trim() === "Yes";
    const reasoning = cells[6].textContent?.trim() === "Yes";
    let isVisible = true;

    // Check capabilities filters
    if (activeFilters.toolCall && !toolCall) isVisible = false;
    if (activeFilters.reasoning && !reasoning) isVisible = false;

    // Update row visibility with animation
    if (!isVisible) {
      (row as HTMLElement).style.opacity = "0.3";
      (row as HTMLElement).style.pointerEvents = "none";
      (row as HTMLElement).style.display = "none";
    } else {
      (row as HTMLElement).style.opacity = "1";
      (row as HTMLElement).style.pointerEvents = "auto";
      (row as HTMLElement).style.display = "";
    }
  });
}

///////////////////////////////////
// Initialize State from URL
///////////////////////////////////
function initializeFromURL() {
  const params = getQueryParams();

  (() => {
    const searchQuery = params.get("search");
    if (!searchQuery) return;
    search.value = searchQuery;
    filterTable(searchQuery);
  })();

  (() => {
    const columnName = params.get("sort");
    if (!columnName) return;

    const columnIndex = getColumnIndexByUrlName(columnName);
    if (columnIndex === -1) return;

    const direction = (params.get("order") as "asc" | "desc") || "asc";
    sortTable(columnIndex, direction);
  })();

  // Update dynamic URLs in code blocks
  document.querySelectorAll(".host").forEach((el) => {
    el.textContent = window.location.host;
  });
}

document.addEventListener("DOMContentLoaded", initializeFromURL);
window.addEventListener("popstate", initializeFromURL);
