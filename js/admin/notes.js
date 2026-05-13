import { bootstrapAdminPage, defaultMeta, renderAdminList, setAdminNotice, textPreview } from "./shared.js";
import { deleteNote, listAdminNotes, saveNote } from "../services/notes-service.js";
import { normalizeTagsInput, tagsToInput } from "../lib/utils.js";

const listRoot = document.querySelector("#adminRecordList");
const form = document.querySelector("#adminEditorForm");
const newButton = document.querySelector("#createNewRecord");
const deleteButton = document.querySelector("#deleteRecord");
let records = [];
let activeId = null;

function resetForm() {
  form?.reset();
  const idInput = form?.querySelector("[name='id']");
  if (idInput) {
    idInput.value = "";
  }
  activeId = null;
}

function populateForm(record) {
  if (!form || !record) {
    return;
  }

  form.elements.id.value = record.id || "";
  form.elements.title.value = record.title || "";
  form.elements.publish_date.value = (record.publish_date || "").slice(0, 16);
  form.elements.mood.value = record.mood || "";
  form.elements.tags.value = tagsToInput(record.tags);
  form.elements.order_index.value = record.order_index ?? "";
  form.elements.content.value = record.content || "";
  form.elements.is_published.checked = Boolean(record.is_published);
  activeId = record.id;
}

function refreshList() {
  renderAdminList(
    listRoot,
    records,
    activeId,
    (item) => `${defaultMeta(item)} · ${textPreview(item.content)}`
  );

  listRoot?.querySelectorAll("[data-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-record-id");
      const record = records.find((entry) => entry.id === id);
      if (record) {
        populateForm(record);
        refreshList();
      }
    });
  });
}

async function loadRecords(selectId) {
  records = await listAdminNotes();
  if (selectId) {
    const target = records.find((record) => record.id === selectId);
    if (target) {
      populateForm(target);
    }
  }
  refreshList();
}

async function initNotesAdminPage() {
  const session = await bootstrapAdminPage();
  if (!session) {
    return;
  }

  try {
    await loadRecords();
  } catch (error) {
    setAdminNotice("碎碎念列表读取失败，请确认 Supabase 配置完成。", "error");
  }

  newButton?.addEventListener("click", () => {
    resetForm();
    refreshList();
  });

  deleteButton?.addEventListener("click", async () => {
    if (!activeId) {
      return;
    }

    if (!window.confirm("确定删除这条碎碎念吗？")) {
      return;
    }

    try {
      await deleteNote(activeId);
      setAdminNotice("已删除碎碎念。", "success");
      resetForm();
      await loadRecords();
    } catch (error) {
      setAdminNotice(error.message || "删除失败，请检查权限配置。", "error");
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const payload = {
        id: form.elements.id.value || undefined,
        title: form.elements.title.value.trim(),
        publish_date: form.elements.publish_date.value ? new Date(form.elements.publish_date.value).toISOString() : new Date().toISOString(),
        mood: form.elements.mood.value.trim(),
        tags: normalizeTagsInput(form.elements.tags.value),
        order_index: form.elements.order_index.value,
        content: form.elements.content.value.trim(),
        is_published: form.elements.is_published.checked
      };

      const record = await saveNote(payload);
      setAdminNotice("碎碎念已保存。", "success");
      await loadRecords(record.id);
    } catch (error) {
      setAdminNotice(error.message || "保存失败，请检查权限配置。", "error");
    }
  });
}

initNotesAdminPage();
