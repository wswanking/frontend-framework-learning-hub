<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount, useId } from "vue";
const props = defineProps<{ open: boolean; title: string; drawer?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>(),
  titleId = useId();
let trigger: HTMLElement | null = null;
watch(
  () => props.open,
  async (value) => {
    await nextTick();
    if (value) {
      trigger = document.activeElement as HTMLElement;
      dialog.value?.showModal();
      await nextTick();
      (
        dialog.value?.querySelector<HTMLElement>("input,select,textarea") ||
        dialog.value?.querySelector("button")
      )?.focus();
    } else {
      dialog.value?.close();
      if (trigger?.isConnected) trigger.focus();
      else document.getElementById("v3-main")?.focus();
    }
  },
  { immediate: true },
);
function keyboard(e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const items = Array.from(
    dialog.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
    ) || [],
  ).filter((x) => x.getClientRects().length);
  const first = items[0],
    last = items.at(-1);
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
  }
}
onBeforeUnmount(() => dialog.value?.close());
</script>
<template>
  <dialog
    ref="dialog"
    class="modal"
    :class="{ drawer }"
    :aria-labelledby="titleId"
    @cancel.prevent="emit('close')"
    @keydown="keyboard"
  >
    <div class="modal-head">
      <h2 :id="titleId">{{ title }}</h2>
      <button type="button" aria-label="关闭对话框" @click="emit('close')">
        ×
      </button>
    </div>
    <div class="modal-body"><slot /></div>
  </dialog>
</template>
